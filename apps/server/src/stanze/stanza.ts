/*
 * Una stanza: posti al tavolo, host, impostazioni, squadre, bot, partita, registro e chat.
 * Non sa niente di Socket.IO: riceve comandi già letti e risponde con una `Risposta`.
 * Ogni modifica finisce in un "pacchetto" che il livello di rete raccoglie con `raccogli()` e manda a tutti.
 */

import {
  applica,
  applicaScadenze,
  ASSENZA_MS,
  BANCA_INIZIALE_MS,
  CHAT_CRONOLOGIA,
  CHAT_MAX,
  COLORI,
  connessione,
  contaMessaggio,
  creaPartita,
  durataScena,
  espelli as espelliDallaPartita,
  GIOCATORI_MIN,
  GRAZIA_MS,
  IMPOSTAZIONI_PREDEFINITE,
  LUNGHEZZA_CODICE,
  mescola,
  modificaPartita,
  mosseDeiBot,
  NOME_SQUADRA_MAX,
  nomeCasuale,
  NOMI_SQUADRE_PREDEFINITI,
  PENSIERO_BOT_MS,
  prossimaScadenza,
  pulisciNome,
  REGISTRO_MAX,
  sposta,
  SQUADRE_MAX,
  statisticheIniziali,
  TURNI_TRA_PROPOSTE_BOT,
  vistaPartita,
  type Attivita,
  type Azione,
  type Caso,
  type CodiceErroreServer,
  type ComandoPannello,
  type DadiDecisi,
  type DettaglioPannello,
  type Esito,
  type Evento,
  type EventoStanza,
  type FaseStanza,
  type IdGiocatore,
  type Impostazioni,
  type Istantanea,
  type MessaggioChat,
  type Mossa,
  type PostoInPartita,
  type Risposta,
  type StanzaNelPannello,
  type Stato,
  type VistaStanza,
  type VoceRegistro,
} from '@poordown/engine';
import { nuovoId, type Ambiente } from './ambiente';

/** Segreto del browser: chi lo presenta ritrova il suo posto. Non va mai mandato agli altri. */
export type Token = string;

/**
 * I colori delle pedine, uguali a --p1…--p12 di apps/web/src/stili/token.css: servono a scegliere il colore dei bot.
 * A parità di distanza vince il primo di ORDINE_BOT (i colori che stanno meglio insieme).
 */
const COLORI_PEDINE = [
  '#ff8f80', '#7ee0ae', '#ffb47a', '#8cb4ff', '#cfa2ff', '#f0e27a',
  '#ff9fd0', '#74e0e4', '#c9a37e', '#bfe86e', '#ff6b9a', '#c9d1db',
];
const ORDINE_BOT = [4, 2, 6, 5, 11, 8, 1, 10, 3, 7, 9, 12];

/** Un colore #rrggbb nello spazio OKLab, dove la distanza somiglia a quanto due colori sembrano diversi. */
function oklab(esadecimale: string): [number, number, number] {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(esadecimale.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/**
 * Il colore per un bot che entra: tra quelli liberi, quello più lontano (in OKLab) dal colore più vicino già al tavolo,
 * così le pedine non si confondono. `undefined` se sono tutti presi.
 */
export function coloreBot(usati: readonly number[]): number | undefined {
  const liberi = Array.from({ length: COLORI }, (_, i) => i + 1)
    .filter((c) => !usati.includes(c))
    .sort((a, b) => (ORDINE_BOT.indexOf(a) + 1 || 99) - (ORDINE_BOT.indexOf(b) + 1 || 99));
  const lab = (c: number) => oklab(COLORI_PEDINE[c - 1] ?? '#808080');
  const tra = (a: number, b: number) => {
    const [x, y] = [lab(a), lab(b)];
    return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
  };
  // Senza nessuno al tavolo la distanza è infinita per tutti: vince il primo dell'ordine.
  const distanza = (c: number) => Math.min(Infinity, ...usati.map((u) => tra(c, u)));
  let scelto: number | undefined;
  let migliore = -1;
  for (const c of liberi) {
    const d = distanza(c);
    if (d > migliore + 1e-9) {
      scelto = c;
      migliore = d;
    }
  }
  return scelto;
}

/** In lobby, chi resta senza schede aperte sulla stanza per questo tempo perde il posto. */
export const ATTESA_LOBBY_MS = 2 * 60_000;
/** I bot entrano in lobby a ondate: uno ogni 2,5–6 secondi, finché ci sono posti liberi. */
export const ARRIVO_BOT_MIN_MS = 2_500;
export const ARRIVO_BOT_MAX_MS = 6_000;
/** Se l'host espelle un bot con i bot attivi, ne entra subito un altro. */
export const RIMPIAZZO_BOT_MS = 1_000;

export interface Posto {
  id: IdGiocatore;
  token: Token;
  nome: string;
  colore: number;
  /** Da quando non ha più schede aperte sulla stanza; `null` se è collegato (i bot lo sono sempre). */
  offlineDa: number | null;
  /** Giocatore automatico: non ha un browser e non diventa mai host. Il suo token non è presentabile da nessuno. */
  bot: boolean;
  /** A squadre, la sua squadra (0–3); altrimenti `null`. */
  squadra: number | null;
}

/**
 * Un messaggio della chat come lo tiene il server. Per quelli di squadra, `lettori` sono i giocatori che erano
 * nella squadra quando è stato scritto: solo loro lo leggono, anche se poi le squadre cambiano. Non va ai browser.
 */
export interface MessaggioInStanza extends MessaggioChat {
  lettori?: IdGiocatore[];
}

/** Le modifiche del pannello che si possono annullare, al massimo. */
export const ANNULLA_PANNELLO_MAX = 30;

/** Com'era la stanza prima di una modifica del pannello: serve ad annullarla. */
interface Fotografia {
  partita: Stato | null;
  fase: FaseStanza;
  impostazioni: Impostazioni;
  nomi: Map<IdGiocatore, string>;
}

/** La stanza come si salva su file. */
export interface DatiStanza {
  codice: string;
  fase: FaseStanza;
  versione: number;
  host: IdGiocatore | null;
  impostazioni: Impostazioni;
  /** `bot` e `squadra` mancano nelle stanze salvate prima della Fase 8. */
  posti: (Omit<Posto, 'offlineDa' | 'bot' | 'squadra'> & Partial<Pick<Posto, 'bot' | 'squadra'>>)[];
  nomiSquadre?: string[];
  partita: Stato | null;
  registro: VoceRegistro[];
  /** Nei messaggi di squadra salvati prima delle correzioni della Fase 8 manca `lettori`. */
  chat: MessaggioInStanza[];
  prossimaVoce: number;
  prossimoMessaggio: number;
  /**
   * Da quando la partita è ferma perché nessun giocatore è collegato. Al salvataggio vale al più l'ora del
   * salvataggio: dopo un riavvio la partita riprende da lì, senza contare il tempo a server spento.
   */
  pausaDa?: number | null;
}

export function no(codice: CodiceErroreServer, messaggio: string): { ok: false; codice: CodiceErroreServer; messaggio: string } {
  return { ok: false, codice, messaggio };
}

export function si<T>(dati: T): { ok: true; dati: T } {
  return { ok: true, dati };
}

const SQUADRE_SPENTE = no('squadre_spente', 'In questa stanza non si gioca a squadre.');

export class Stanza {
  fase: FaseStanza = 'lobby';
  versione = 0;
  host: IdGiocatore | null = null;
  impostazioni: Impostazioni;
  /** In ordine di ingresso. */
  posti: Posto[] = [];
  /** I nomi delle quattro squadre possibili. */
  nomiSquadre: string[] = [...NOMI_SQUADRE_PREDEFINITI];
  partita: Stato | null = null;
  registro: VoceRegistro[] = [];
  chat: MessaggioInStanza[] = [];
  /** L'ultima volta che qualcuno ha aperto o chiuso la stanza: serve alla pulizia delle stanze abbandonate. */
  ultimaPresenza: number;

  private prossimaVoce = 1;
  private prossimoMessaggio = 1;
  /** Schede del browser che seguono la stanza: id della connessione → token. */
  private readonly connessioni = new Map<string, Token>();
  private nuove: VoceRegistro[] = [];
  private modificata = false;
  /** Chi sta creando, guardando o trattando uno scambio. Non si salva e non cambia la versione. */
  private attivita = new Map<IdGiocatore, Attivita>();
  private attivitaCambiata = false;
  /**
   * In partita: da quando nessun giocatore in gioco è collegato. Intanto gli orologi sono fermi
   * (niente turni automatici né rimozioni); quando qualcuno torna, ripartono da dove erano.
   */
  private pausaDa: number | null = null;
  /** In lobby: quando entra il prossimo bot; `null` se non ne serve nessuno. */
  private prossimoBot: number | null = null;
  /** In partita: quando gioca il prossimo bot; `null` se nessun bot ha da fare. */
  private prossimaMossaBot: number | null = null;
  /** Fin quando i browser mostrano le animazioni già mandate: i bot aspettano che finiscano. */
  private fineScena = 0;
  /** Il turno in cui ogni bot ha proposto l'ultimo scambio: non insiste a ogni turno. */
  private readonly ultimaProposta = new Map<IdGiocatore, number>();
  /** Il prossimo tiro deciso dal pannello; `null` se i dadi sono liberi. Non si salva. */
  private dadiDecisi: DadiDecisi | null = null;
  /**
   * Com'era la stanza prima di ogni modifica del pannello, dalla più vecchia. Si svuota appena la partita va avanti
   * da sola (una mossa, una scadenza): da lì annullare cancellerebbe anche quello che hanno fatto i giocatori.
   */
  private pilaPannello: Fotografia[] = [];

  constructor(
    readonly codice: string,
    private readonly amb: Ambiente,
    impostazioni: Impostazioni,
  ) {
    this.impostazioni = { ...impostazioni };
    this.ultimaPresenza = amb.adesso();
  }

  /* ------------------------------------------------------------------ */
  /* Connessioni                                                         */
  /* ------------------------------------------------------------------ */

  collega(connessione: string, token: Token): void {
    this.connessioni.set(connessione, token);
    this.ultimaPresenza = this.amb.adesso();
    const posto = this.postoDi(token);
    if (posto) posto.offlineDa = null;
    this.aggiornaPresenze();
    this.segna(...this.passaHost());
  }

  scollega(connessione: string): void {
    const token = this.connessioni.get(connessione);
    if (token === undefined) return;
    this.connessioni.delete(connessione);
    this.ultimaPresenza = this.amb.adesso();
    const posto = this.postoDi(token);
    if (posto && !this.collegato(token)) {
      posto.offlineDa = this.amb.adesso();
      this.togliAttivita((id) => id === posto.id);
    }
    this.aggiornaPresenze();
    this.segna(...this.passaHost());
  }

  /**
   * Chi esce dalla stanza in lobby, o a partita finita, libera il posto (e non torna con «Un'altra partita»),
   * a meno che abbia ancora un'altra scheda aperta sulla stanza. In partita il posto resta: si può tornare.
   */
  esci(connessione: string): void {
    const token = this.connessioni.get(connessione);
    this.scollega(connessione);
    const posto = token === undefined ? undefined : this.postoDi(token);
    if (posto && this.fase !== 'partita' && !this.collegato(posto.token)) this.rimuovi(posto, 'volontaria');
  }

  nessunoCollegato(): boolean {
    return this.connessioni.size === 0;
  }

  /** Al tavolo non è seduta nessuna persona (al più dei bot). */
  senzaPersone(): boolean {
    return !this.posti.some((p) => !p.bot);
  }

  /* ------------------------------------------------------------------ */
  /* Lobby                                                               */
  /* ------------------------------------------------------------------ */

  /** Prende un posto al tavolo. Le persone hanno la precedenza: se è tutto pieno, chi arriva prende il posto dell'ultimo bot. */
  siediti(token: Token, nome: string, colore: number): Risposta<{ io: IdGiocatore }> {
    if (this.fase !== 'lobby') return no('partita_iniziata', 'La partita è già cominciata: puoi solo guardarla.');
    if (this.postoDi(token)) return no('gia_seduto', 'Sei già al tavolo.');
    const piena = this.posti.length >= this.impostazioni.giocatoriMax;
    const bot = piena ? this.posti.findLast((p) => p.bot) : undefined;
    if (piena && !bot) return no('stanza_piena', 'La stanza è piena.');
    const problema = this.controllaColore(colore, bot);
    if (problema) return problema;

    const voci: EventoStanza[] = [];
    if (bot) {
      this.posti = this.posti.filter((p) => p !== bot);
      voci.push({ tipo: 'uscita', giocatore: bot.id, nome: bot.nome, motivo: 'volontaria' });
    }
    const posto: Posto = {
      id: this.idLibero(),
      token,
      nome: pulisciNome(nome) || nomeCasuale(this.amb.caso),
      colore,
      offlineDa: this.collegato(token) ? null : this.amb.adesso(),
      bot: false,
      squadra: this.squadraPerNuovo(),
    };
    this.posti.push(posto);
    this.host ??= posto.id;
    this.segna(...voci, { tipo: 'ingresso', giocatore: posto.id, nome: posto.nome, colore });
    return si({ io: posto.id });
  }

  cambiaColore(token: Token, colore: number): Risposta<null> {
    const posto = this.postoDi(token);
    if (!posto) return no('non_seduto', 'Prima siediti al tavolo.');
    if (this.fase !== 'lobby') return no('partita_iniziata', 'A partita iniziata il colore non si cambia.');
    if (posto.colore === colore) return si(null);
    const problema = this.controllaColore(colore);
    if (problema) return problema;
    posto.colore = colore;
    this.segna();
    return si(null);
  }

  /**
   * Accendendo le squadre, chi è seduto viene diviso in due squadre; spegnendole, le squadre si dimenticano.
   * Se il massimo dei giocatori scende sotto quelli seduti, escono prima i bot. Spegnere i bot non toglie quelli già entrati.
   */
  cambiaImpostazioni(token: Token, modifiche: Partial<Impostazioni>): Risposta<null> {
    const problema = this.soloHostInLobby(token, 'Solo l’host può cambiare le impostazioni.');
    if (problema) return problema;
    const prima = this.impostazioni;
    const nuove = { ...prima, ...modifiche };
    if (JSON.stringify(nuove) === JSON.stringify(prima)) return si(null);
    this.impostazioni = nuove;
    if (nuove.squadre !== prima.squadre) {
      for (const p of this.posti) p.squadra = null;
      if (nuove.squadre) for (const p of this.posti) p.squadra = this.squadraPerNuovo();
    }
    const voci: EventoStanza[] = [];
    while (this.posti.length > nuove.giocatoriMax) {
      const bot = this.posti.findLast((p) => p.bot);
      if (!bot) break;
      this.posti = this.posti.filter((p) => p !== bot);
      voci.push({ tipo: 'uscita', giocatore: bot.id, nome: bot.nome, motivo: 'volontaria' });
    }
    this.segna(...voci);
    return si(null);
  }

  /**
   * In lobby l'host libera il posto di un giocatore (anche di un bot: se i bot sono attivi, ne entra presto un altro).
   * In partita, solo nelle stanze private, lo toglie dalla partita (non mentre gioca il suo turno): i suoi beni
   * tornano alla banca e perde il posto, ma può guardare.
   */
  espelli(token: Token, id: IdGiocatore): Risposta<null> {
    if (this.fase === 'partita') return this.espelliInPartita(token, id);
    const problema = this.soloHostInLobby(token, 'Solo l’host può espellere i giocatori.');
    if (problema) return problema;
    const posto = this.posti.find((p) => p.id === id);
    if (!posto) return no('giocatore_assente', 'Questo giocatore non è più nella stanza.');
    if (posto.token === token) return no('richiesta_non_valida', 'Non puoi espellere te stesso.');
    if (posto.bot && this.impostazioni.bot) this.prossimoBot = this.amb.adesso() + RIMPIAZZO_BOT_MS;
    this.rimuovi(posto, 'espulsione');
    return si(null);
  }

  private espelliInPartita(token: Token, id: IdGiocatore): Risposta<null> {
    const io = this.postoDi(token);
    if (!io || io.id !== this.host) return no('solo_host', 'Solo l’host può togliere un giocatore dalla partita.');
    if (!this.inGioco(io.id)) return no('solo_host', 'Sei fuori dalla partita: non puoi più togliere gli altri giocatori.');
    if (!this.impostazioni.stanzaPrivata) {
      return no('solo_host', 'Nelle stanze pubbliche un giocatore si toglie solo con il voto.');
    }
    if (id === io.id) return no('richiesta_non_valida', 'Non puoi togliere te stesso: usa «Bancarotta».');
    if (!this.partita) return no('partita_non_in_corso', 'La partita non è in corso.');
    const esito = espelliDallaPartita(this.partita, id, this.amb.caso, this.amb.adesso());
    if (!esito.ok) return no(esito.codice, esito.messaggio);
    // Chi è espulso perde anche il posto: può guardare, ma non scrive più in chat.
    this.posti = this.posti.filter((p) => p.id !== id);
    this.registra(esito);
    return si(null);
  }

  /** A squadre, in lobby: si entra nella squadra che si vuole; l'host può spostare chiunque, bot compresi. */
  cambiaSquadra(token: Token, squadra: number, id?: IdGiocatore): Risposta<null> {
    const io = this.postoDi(token);
    if (!io) return no('non_seduto', 'Prima siediti al tavolo.');
    if (this.fase !== 'lobby') return no('partita_iniziata', 'Le squadre si scelgono prima di cominciare.');
    if (!this.impostazioni.squadre) return SQUADRE_SPENTE;
    if (!Number.isInteger(squadra) || squadra < 0 || squadra >= SQUADRE_MAX) {
      return no('richiesta_non_valida', `Le squadre sono al massimo ${SQUADRE_MAX}.`);
    }
    const bersaglio = id === undefined ? io : this.posti.find((p) => p.id === id);
    if (!bersaglio) return no('giocatore_assente', 'Questo giocatore non è più nella stanza.');
    if (bersaglio !== io && io.id !== this.host) return no('solo_host', 'Solo l’host può spostare gli altri giocatori.');
    if (bersaglio.squadra === squadra) return si(null);
    bersaglio.squadra = squadra;
    this.segna();
    return si(null);
  }

  /** L'host dà un nome a una squadra; un nome vuoto riporta quello predefinito. */
  rinominaSquadra(token: Token, squadra: number, nome: string): Risposta<null> {
    const problema = this.soloHostInLobby(token, 'Solo l’host può dare un nome alle squadre.');
    if (problema) return problema;
    if (!this.impostazioni.squadre) return SQUADRE_SPENTE;
    if (!Number.isInteger(squadra) || squadra < 0 || squadra >= SQUADRE_MAX) {
      return no('richiesta_non_valida', `Le squadre sono al massimo ${SQUADRE_MAX}.`);
    }
    const pulito = Array.from(pulisciNome(nome)).slice(0, NOME_SQUADRA_MAX).join('').trim();
    const nuovo = pulito || NOMI_SQUADRE_PREDEFINITI[squadra]!;
    if (this.nomiSquadre[squadra] === nuovo) return si(null);
    this.nomiSquadre[squadra] = nuovo;
    this.segna();
    return si(null);
  }

  /** L'host rifà le squadre a sorte, tenendo il numero di squadre in uso (almeno due). */
  mescolaSquadre(token: Token): Risposta<null> {
    const problema = this.soloHostInLobby(token, 'Solo l’host può mescolare le squadre.');
    if (problema) return problema;
    if (!this.impostazioni.squadre) return SQUADRE_SPENTE;
    const usate = [...new Set(this.posti.map((p) => p.squadra).filter((x): x is number => x !== null))].sort();
    const squadre = usate.length >= 2 ? usate : [0, 1];
    mescola(this.posti, this.amb.caso).forEach((p, i) => {
      p.squadra = squadre[i % squadre.length]!;
    });
    this.segna();
    return si(null);
  }

  avvia(token: Token): Risposta<null> {
    const problema = this.soloHostInLobby(token, 'Solo l’host può avviare la partita.');
    if (problema) return problema;
    if (this.posti.length < GIOCATORI_MIN) return no('pochi_giocatori', 'Servono almeno due giocatori per iniziare.');
    if (this.posti.length > this.impostazioni.giocatoriMax) {
      return no('troppi_giocatori', 'Ci sono più giocatori del massimo scelto nelle impostazioni: espelline qualcuno.');
    }
    const esito = creaPartita(
      this.posti.map(({ id, nome, colore, squadra }) => ({ id, nome, colore, squadra })),
      this.impostazioni,
      this.amb.caso,
      this.amb.adesso(),
      this.nomiSquadre,
    );
    if (!esito.ok) return no(esito.codice, esito.messaggio);
    this.fase = 'partita';
    this.partita = esito.stato;
    this.pausaDa = null;
    this.fineScena = 0;
    this.pilaPannello = [];
    this.dadiDecisi = null;
    this.ultimaProposta.clear();
    this.aggiornaPresenze();
    this.segna(...esito.eventi);
    return si(null);
  }

  /**
   * A partita finita riporta la stanza in lobby per giocarne un'altra: stesse impostazioni, stessi posti e colori.
   * Lo fa l'host; se l'host non è collegato, qualunque giocatore seduto, che diventa host.
   * Chi non è collegato ha di nuovo due minuti per tornare, come in ogni lobby. Il registro riparte da capo.
   * Se due la chiedono insieme, il secondo trova la stanza già in lobby: per lui va bene così.
   */
  nuovaPartita(token: Token): Risposta<null> {
    const posto = this.postoDi(token);
    if (!posto) return no('non_seduto', 'Solo chi era al tavolo può preparare un’altra partita.');
    if (this.fase === 'lobby') return si(null);
    if (this.fase !== 'finita') return no('partita_non_finita', 'La partita non è ancora finita.');
    const host = this.posti.find((p) => p.id === this.host);
    if (posto !== host && host && this.collegato(host.token)) {
      return no('solo_host', 'Solo l’host può preparare un’altra partita.');
    }
    const adesso = this.amb.adesso();
    this.fase = 'lobby';
    this.partita = null;
    this.pausaDa = null;
    this.prossimaMossaBot = null;
    this.pilaPannello = [];
    this.dadiDecisi = null;
    this.registro = [];
    this.togliAttivita(() => true);
    for (const p of this.posti) if (p.offlineDa !== null) p.offlineDa = adesso;
    const voci: EventoStanza[] = [{ tipo: 'nuova_partita', giocatore: posto.id, nome: posto.nome }];
    if (posto !== host) {
      this.host = posto.id;
      voci.push({ tipo: 'nuovo_host', giocatore: posto.id, nome: posto.nome });
    }
    this.segna(...voci);
    return si(null);
  }

  /* ------------------------------------------------------------------ */
  /* Partita e chat                                                      */
  /* ------------------------------------------------------------------ */

  /**
   * Prima della mossa si applicano le scadenze già passate (fine dell'asta, tempo del turno…), anche se la
   * sveglia non è ancora arrivata: così, per esempio, un'offerta arrivata dopo la fine dell'asta non la riapre.
   */
  mossa(token: Token, mossa: Mossa): Risposta<null> {
    const posto = this.postoDi(token);
    if (!posto) return no('non_seduto', 'Stai solo guardando: non puoi giocare.');
    if (this.fase !== 'partita' || !this.partita) return no('partita_non_in_corso', 'La partita non è in corso.');
    this.scadenzeDellaPartita();
    if (this.fase !== 'partita' || !this.partita) return no('partita_non_in_corso', 'La partita è appena finita.');
    const azione = { ...mossa, giocatore: posto.id } as Azione;
    const esito = applica(this.partita, azione, this.casoPer(azione), this.amb.adesso());
    if (!esito.ok) return no(esito.codice, esito.messaggio);
    this.registra(esito);
    return si(null);
  }

  /** Cosa sta facendo il giocatore con gli scambi. Gli spettatori non contano. */
  cambiaAttivita(token: Token, attivita: Attivita | null): void {
    const posto = this.postoDi(token);
    if (!posto || this.fase !== 'partita') return;
    if (JSON.stringify(this.attivita.get(posto.id) ?? null) === JSON.stringify(attivita)) return;
    if (attivita) this.attivita.set(posto.id, attivita);
    else this.attivita.delete(posto.id);
    this.attivitaCambiata = true;
  }

  /** Le attività da mandare a tutti, se sono cambiate dall'ultima volta; altrimenti `null`. */
  raccogliAttivita(): Record<IdGiocatore, Attivita> | null {
    if (!this.attivitaCambiata) return null;
    this.attivitaCambiata = false;
    return this.mappaAttivita();
  }

  /**
   * La chat non cambia la versione: il messaggio va mandato a parte (a tutti, o con `squadra` solo ai compagni:
   * chi può leggerlo lo dice `puoLeggere`). Chi lo può leggere si decide adesso, una volta per tutte.
   */
  scrivi(token: Token, testo: string, squadra = false): Risposta<MessaggioChat> {
    const posto = this.postoDi(token);
    if (!posto) return no('non_seduto', 'Solo i giocatori possono scrivere in chat.');
    const mia = this.squadraPerChat(token);
    if (squadra && mia === null) return SQUADRE_SPENTE;
    const pulito = testo.trim();
    // Un messaggio fatto solo di spazi o di caratteri che non si vedono è vuoto.
    if (!pulisciNome(pulito)) return no('richiesta_non_valida', 'Il messaggio è vuoto.');
    if (Array.from(pulito).length > CHAT_MAX) return no('richiesta_non_valida', `Il messaggio supera i ${CHAT_MAX} caratteri.`);
    const messaggio: MessaggioChat = {
      n: this.prossimoMessaggio++,
      quando: this.amb.adesso(),
      da: posto.id,
      nome: posto.nome,
      colore: posto.colore,
      testo: pulito,
      ...(squadra && mia !== null ? { squadra: mia } : {}),
    };
    const lettori = messaggio.squadra === undefined ? undefined : this.membri(messaggio.squadra);
    this.chat.push(lettori ? { ...messaggio, lettori } : { ...messaggio });
    if (this.chat.length > CHAT_CRONOLOGIA) this.chat.splice(0, this.chat.length - CHAT_CRONOLOGIA);
    // Per le statistiche di fine partita. Non cambia la versione: i browser lo vedono con il prossimo aggiornamento.
    if (this.fase === 'partita' && this.partita) this.partita = contaMessaggio(this.partita);
    return si(messaggio);
  }

  /**
   * Il messaggio è per tutti, oppure è della chat di squadra e chi presenta il token è seduto ed era nella squadra
   * quando il messaggio è stato scritto (chi entra nella squadra dopo non legge i messaggi vecchi).
   */
  puoLeggere(token: Token, messaggio: MessaggioChat): boolean {
    if (messaggio.squadra === undefined) return true;
    return this.leggibile(token, this.chat.findLast((m) => m.n === messaggio.n));
  }

  /** A squadre, la squadra di chi presenta il token, per la chat di squadra; altrimenti `null` (anche per chi guarda). */
  squadraPerChat(token: Token): number | null {
    return this.impostazioni.squadre ? (this.postoDi(token)?.squadra ?? null) : null;
  }

  /* ------------------------------------------------------------------ */
  /* Tempo                                                               */
  /* ------------------------------------------------------------------ */

  /** Toglie dalla lobby chi è sparito da troppo tempo; in partita applica le scadenze rimaste indietro. */
  manutenzione(): void {
    if (this.fase === 'lobby') {
      const adesso = this.amb.adesso();
      for (const posto of [...this.posti]) {
        if (posto.offlineDa !== null && adesso - posto.offlineDa >= ATTESA_LOBBY_MS) this.rimuovi(posto, 'assenza');
      }
    }
    this.scadenze();
  }

  /**
   * Fa quello che è arrivato il momento di fare. In lobby: fa entrare un bot. In partita: chiude l'asta, gioca il turno
   * di chi ha finito il tempo, applica voti e assenze, poi fa giocare un bot. In pausa niente.
   */
  scadenze(): void {
    const adesso = this.amb.adesso();
    if (this.fase === 'lobby') {
      if (this.prossimoBot !== null && this.prossimoBot <= adesso) {
        this.prossimoBot = null;
        this.aggiungiBot();
      }
      return;
    }
    if (this.fase !== 'partita' || this.pausaDa !== null) return;
    this.scadenzeDellaPartita();
    if (this.prossimaMossaBot !== null && this.prossimaMossaBot <= adesso) {
      this.prossimaMossaBot = null;
      this.giocaBot();
    }
  }

  /** Applica le scadenze della partita già passate (asta, tempo del turno, voto, assenze). In pausa niente. */
  private scadenzeDellaPartita(): void {
    if (this.fase !== 'partita' || !this.partita || this.pausaDa !== null) return;
    const esito = applicaScadenze(this.partita, this.amb.caso, this.amb.adesso());
    if (esito?.ok) this.registra(esito);
  }

  /** Millisecondi alla prossima cosa da fare (scadenza della partita, mossa o arrivo di un bot); `null` se niente. */
  attesa(): number | null {
    const tempi: number[] = [];
    if (this.fase === 'lobby' && this.prossimoBot !== null) tempi.push(this.prossimoBot);
    if (this.fase === 'partita' && this.partita && this.pausaDa === null) {
      const scadenza = prossimaScadenza(this.partita);
      if (scadenza !== null) tempi.push(scadenza);
      if (this.prossimaMossaBot !== null) tempi.push(this.prossimaMossaBot);
    }
    return tempi.length === 0 ? null : Math.max(0, Math.min(...tempi) - this.amb.adesso());
  }

  /**
   * Il posto di `token` in questa partita, se lo tiene ancora e nessuna sua scheda è dentro: la home offre di
   * rientrare anche dopo una scheda chiusa. Si perde ASSENZA_MS dopo l'uscita, salvo che la partita sia ferma.
   */
  postoTenuto(token: Token): PostoInPartita | null {
    if (this.fase !== 'partita' || this.partita?.fase !== 'in_corso' || this.collegato(token)) return null;
    const posto = this.postoDi(token);
    const g = posto && !posto.bot ? this.partita.giocatori.find((x) => x.id === posto.id) : undefined;
    if (!g || g.eliminato) return null;
    if (this.pausaDa !== null || g.offlineDa === null) return { codice: this.codice, resta: null };
    return { codice: this.codice, resta: Math.max(0, g.offlineDa + ASSENZA_MS - this.amb.adesso()) };
  }

  /** La partita è ferma perché nessun giocatore in gioco è collegato. */
  inPausa(): boolean {
    return this.pausaDa !== null;
  }

  /** L'orologio del server, che i browser usano per i conti alla rovescia. */
  orologio(): number {
    return this.amb.adesso();
  }

  /* ------------------------------------------------------------------ */
  /* Viste                                                               */
  /* ------------------------------------------------------------------ */

  /** Il posto di chi presenta il token, se è seduto. */
  io(token: Token): IdGiocatore | null {
    return this.postoDi(token)?.id ?? null;
  }

  /** Uguale per tutti: il posto di ciascuno si aggiunge a parte con `io()`. */
  vista(): VistaStanza {
    const spettatori = this.spettatori();
    return {
      codice: this.codice,
      fase: this.fase,
      versione: this.versione,
      host: this.host,
      impostazioni: { ...this.impostazioni },
      partecipanti: this.posti.map((p) => ({
        id: p.id,
        nome: p.nome,
        colore: p.colore,
        connesso: p.offlineDa === null,
        bot: p.bot,
        squadra: p.squadra,
      })),
      squadre: [...this.nomiSquadre],
      spettatori,
      partita: this.partita ? vistaPartita(this.partita) : null,
    };
  }

  istantanea(token: Token): Istantanea {
    return {
      stanza: this.vista(),
      io: this.io(token),
      registro: [...this.registro],
      chat: this.chat.filter((m) => m.squadra === undefined || this.leggibile(token, m)).map(senzaLettori),
      attivita: this.mappaAttivita(),
      adesso: this.amb.adesso(),
    };
  }

  /**
   * Chiude il pacchetto di modifiche: alza la versione e restituisce le voci nuove del registro,
   * oppure `null` se dall'ultima volta non è cambiato niente.
   */
  raccogli(): VoceRegistro[] | null {
    if (!this.modificata) return null;
    this.versione++;
    this.modificata = false;
    const voci = this.nuove;
    this.nuove = [];
    return voci;
  }

  /* ------------------------------------------------------------------ */
  /* Salvataggio                                                         */
  /* ------------------------------------------------------------------ */

  esporta(): DatiStanza {
    return structuredClone({
      codice: this.codice,
      fase: this.fase,
      versione: this.versione,
      host: this.host,
      impostazioni: this.impostazioni,
      posti: this.posti.map(({ id, token, nome, colore, bot, squadra }) => ({ id, token, nome, colore, bot, squadra })),
      nomiSquadre: this.nomiSquadre,
      partita: this.partita,
      registro: this.registro,
      chat: this.chat,
      prossimaVoce: this.prossimaVoce,
      prossimoMessaggio: this.prossimoMessaggio,
      pausaDa: this.fase === 'partita' ? (this.pausaDa ?? this.amb.adesso()) : null,
    });
  }

  /**
   * Dopo un riavvio nessuno è collegato: chi era in lobby ha il solito tempo per tornare;
   * la partita resta in pausa dall'ultimo salvataggio finché non torna qualcuno.
   * Le stanze salvate prima della Fase 8 non hanno bot né squadre.
   * Nei messaggi di squadra salvati senza `lettori`, li possono leggere i giocatori che adesso sono in quella squadra.
   * Se i dati non hanno la forma di una stanza salvata lancia un errore, prima di creare la stanza.
   */
  static importa(dati: DatiStanza, amb: Ambiente): Stanza {
    const problema = problemaDiForma(dati);
    if (problema) throw new Error(`Stanza salvata non valida: ${problema}.`);
    const stanza = new Stanza(dati.codice, amb, { ...IMPOSTAZIONI_PREDEFINITE, ...dati.impostazioni });
    const adesso = amb.adesso();
    const pausaDa = dati.pausaDa ?? adesso;
    stanza.fase = dati.fase;
    stanza.versione = dati.versione;
    stanza.host = dati.host;
    stanza.posti = dati.posti.map((p) => {
      const bot = p.bot ?? false;
      return { ...p, bot, squadra: p.squadra ?? null, offlineDa: bot ? null : adesso };
    });
    stanza.nomiSquadre = NOMI_SQUADRE_PREDEFINITI.map((nome, i) => dati.nomiSquadre?.[i] ?? nome);
    stanza.partita = dati.partita && aggiornaSalvata(dati.partita, pausaDa);
    if (stanza.fase === 'partita') stanza.pausaDa = pausaDa;
    stanza.registro = dati.registro;
    stanza.chat = dati.chat.map((m) =>
      m.squadra === undefined || m.lettori ? m : { ...m, lettori: stanza.membri(m.squadra) },
    );
    stanza.prossimaVoce = dati.prossimaVoce;
    stanza.prossimoMessaggio = dati.prossimoMessaggio;
    return stanza;
  }

  /* ------------------------------------------------------------------ */
  /* Bot                                                                 */
  /* ------------------------------------------------------------------ */

  private bot(): IdGiocatore[] {
    return this.posti.filter((p) => p.bot).map((p) => p.id);
  }

  /** Un bot prende un posto libero: nome casuale "Sostantivo Aggettivo", il colore libero più diverso da quelli al tavolo. */
  private aggiungiBot(): void {
    if (!this.impostazioni.bot || !this.posti.some((p) => !p.bot) || this.posti.length >= this.impostazioni.giocatoriMax) {
      return;
    }
    const colore = coloreBot(this.posti.map((p) => p.colore));
    if (colore === undefined) return;
    let nome = nomeCasuale(this.amb.caso);
    for (let i = 0; i < 10 && this.posti.some((p) => p.nome === nome); i++) nome = nomeCasuale(this.amb.caso);
    const id = this.idLibero();
    this.posti.push({ id, token: `bot:${id}`, nome, colore, offlineDa: null, bot: true, squadra: this.squadraPerNuovo() });
    this.segna({ tipo: 'ingresso', giocatore: id, nome, colore });
  }

  private puoProporre(id: IdGiocatore): boolean {
    const ultima = this.ultimaProposta.get(id);
    return this.partita !== null && (ultima === undefined || this.partita.turno.numero - ultima >= TURNI_TRA_PROPOSTE_BOT);
  }

  /** Un bot fa la sua prossima mossa. Se tocca a più bot (all'asta, per esempio), ne sceglie uno a caso. */
  private giocaBot(): void {
    // Prima le scadenze già passate (come per le mosse delle persone): un'offerta dopo la fine dell'asta non vale.
    this.scadenzeDellaPartita();
    const partita = this.partita;
    if (this.fase !== 'partita' || !partita) return;
    const mosse = mosseDeiBot(partita, this.bot(), (id) => this.puoProporre(id));
    if (mosse.length === 0) return;
    const scelta = mosse[this.amb.caso.intero(mosse.length)]!;
    const adesso = this.amb.adesso();
    let esito = applica(partita, scelta.azione, this.casoPer(scelta.azione), adesso);
    if (!esito.ok) {
      // Non dovrebbe succedere: per non fermare la partita, il bot di turno finisce il turno come può.
      console.error(`  Mossa del bot rifiutata (${scelta.azione.tipo}): ${esito.messaggio}`);
      if (partita.turno.giocatore !== scelta.giocatore) return;
      for (const tipo of ['fine_turno', 'lancia', 'bancarotta'] as const) {
        esito = applica(partita, { tipo, giocatore: scelta.giocatore }, this.amb.caso, adesso);
        if (esito.ok) break;
      }
      if (!esito.ok) return;
    }
    if (scelta.azione.tipo === 'proponi') this.ultimaProposta.set(scelta.giocatore, partita.turno.numero);
    this.registra(esito);
  }

  /**
   * Decide quando i bot faranno la prossima cosa. In lobby: se servono bot, il prossimo entra tra qualche secondo.
   * In partita: un bot gioca quando i browser hanno finito di mostrare le animazioni, più un attimo per "pensare";
   * all'asta e agli scambi risponde dopo un paio di secondi.
   */
  private pianificaBot(eventi: readonly EventoStanza[]): void {
    const adesso = this.amb.adesso();
    if (this.fase === 'lobby') {
      this.prossimaMossaBot = null;
      const servono =
        this.impostazioni.bot && this.posti.some((p) => !p.bot) && this.posti.length < this.impostazioni.giocatoriMax;
      if (!servono) this.prossimoBot = null;
      else this.prossimoBot ??= adesso + ARRIVO_BOT_MIN_MS + this.amb.caso.intero(ARRIVO_BOT_MAX_MS - ARRIVO_BOT_MIN_MS);
      return;
    }
    this.prossimoBot = null;
    const partita = this.partita;
    if (this.fase !== 'partita' || !partita) {
      this.prossimaMossaBot = null;
      return;
    }
    const delGioco = eventi.filter((e): e is Evento => !['ingresso', 'uscita', 'nuovo_host', 'nuova_partita'].includes(e.tipo));
    this.fineScena = Math.max(this.fineScena, adesso) + durataScena(partita, delGioco);
    const mosse = mosseDeiBot(partita, this.bot(), (id) => this.puoProporre(id));
    if (mosse.length === 0) {
      this.prossimaMossaBot = null;
      return;
    }
    const tipi = new Set(mosse.map((m) => m.azione.tipo));
    const caso = this.amb.caso;
    if (partita.asta && [...tipi].every((t) => t === 'offri')) {
      this.prossimaMossaBot = adesso + 800 + caso.intero(1000);
    } else if ([...tipi].every((t) => t === 'accetta' || t === 'rifiuta')) {
      this.prossimaMossaBot = adesso + 2000 + caso.intero(1500);
    } else {
      this.prossimaMossaBot = Math.max(this.fineScena, adesso) + PENSIERO_BOT_MS + caso.intero(500);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Pannello di controllo                                               */
  /* ------------------------------------------------------------------ */

  /**
   * Esegue un comando del pannello di controllo. Restituisce il motivo se non si può fare, altrimenti `null`.
   * Le modifiche alla partita (e i nomi) si possono annullare finché la partita non va avanti.
   */
  pannello(comando: ComandoPannello): string | null {
    switch (comando.tipo) {
      case 'dadi':
        return this.decidiDadi(comando.dadi, comando.giocatore);
      case 'host': {
        const posto = this.posti.find((p) => p.id === comando.giocatore);
        if (!posto) return 'Questo giocatore non è più nella stanza.';
        if (posto.bot) return 'Un bot non può fare l’host.';
        if (this.host === posto.id) return null;
        this.host = posto.id;
        this.segna({ tipo: 'nuovo_host', giocatore: posto.id, nome: posto.nome });
        return null;
      }
      case 'espelli': {
        if (this.fase !== 'lobby') return 'In partita si usa «Togli dalla partita».';
        const posto = this.posti.find((p) => p.id === comando.giocatore);
        if (!posto) return 'Questo giocatore non è più nella stanza.';
        if (posto.bot && this.impostazioni.bot) this.prossimoBot = this.amb.adesso() + RIMPIAZZO_BOT_MS;
        this.rimuovi(posto, 'espulsione');
        return null;
      }
      case 'nome': {
        const posto = this.posti.find((p) => p.id === comando.giocatore);
        const inPartita = this.partita?.giocatori.some((g) => g.id === comando.giocatore) ?? false;
        if (!posto && !inPartita) return 'Questo giocatore non è più nella stanza.';
        const nome = pulisciNome(comando.nome);
        if (!nome) return 'Il nome è vuoto.';
        const prima = this.fotografia();
        if (posto) posto.nome = nome;
        if (this.partita && inPartita) {
          this.partita = {
            ...this.partita,
            giocatori: this.partita.giocatori.map((g) => (g.id === comando.giocatore ? { ...g, nome } : g)),
          };
        }
        this.ricorda(prima);
        this.segna();
        return null;
      }
      default: {
        if (!this.partita) return 'La partita non è ancora cominciata.';
        const esito = modificaPartita(this.partita, comando, this.amb.caso, this.amb.adesso());
        if (!esito.ok) return esito.messaggio;
        const prima = this.fotografia();
        // La stanza tiene le stesse regole della partita (la lobby della prossima partita parte da qui).
        if (comando.tipo === 'regole' || comando.tipo === 'stato') this.impostazioni = { ...esito.stato.impostazioni };
        // Lo stato scritto a mano può riaprire una partita finita.
        this.fase = esito.stato.fase === 'finita' ? 'finita' : 'partita';
        this.registra({ ok: true, stato: esito.stato, eventi: esito.eventi }, true);
        this.ricorda(prima);
        return null;
      }
    }
  }

  /** Torna a com'era la stanza prima dell'ultima modifica del pannello. */
  annullaPannello(): string | null {
    const foto = this.pilaPannello.pop();
    if (!foto) return 'Non c’è niente da annullare: dopo l’ultima modifica la partita è andata avanti.';
    this.partita = foto.partita;
    this.fase = foto.fase;
    this.impostazioni = foto.impostazioni;
    for (const p of this.posti) p.nome = foto.nomi.get(p.id) ?? p.nome;
    const aperti = new Set(this.partita?.scambi.map((x) => x.id) ?? []);
    this.togliAttivita((_, a) => this.fase !== 'partita' || (a.tipo !== 'crea' && !aperti.has(a.scambio)));
    this.aggiornaPresenze();
    this.segna(...this.passaHost());
    return null;
  }

  /** La stanza com'è, per il pannello: tutto tranne i token. */
  dettaglioPannello(): DettaglioPannello {
    return {
      codice: this.codice,
      fase: this.fase,
      versione: this.versione,
      host: this.host,
      impostazioni: { ...this.impostazioni },
      posti: this.posti.map(({ id, nome, colore, bot, squadra, offlineDa }) => ({
        id,
        nome,
        colore,
        bot,
        squadra,
        connesso: offlineDa === null,
      })),
      nomiSquadre: [...this.nomiSquadre],
      spettatori: this.spettatori(),
      partita: this.partita,
      registro: this.registro.slice(-40),
      dadi: this.dadiDecisi,
      annullabile: this.pilaPannello.length > 0,
      inPausa: this.pausaDa !== null,
      adesso: this.amb.adesso(),
    };
  }

  /** La riga della stanza nell'elenco del pannello. */
  vocePannello(): StanzaNelPannello {
    const partita = this.partita;
    const fuori = new Set(partita?.giocatori.filter((g) => g.eliminato).map((g) => g.id) ?? []);
    const diTurno = partita && this.fase === 'partita' ? partita.giocatori.find((g) => g.id === partita.turno.giocatore) : undefined;
    return {
      codice: this.codice,
      fase: this.fase,
      privata: this.impostazioni.stanzaPrivata,
      mappa: this.impostazioni.mappa,
      giocatori: this.posti.map((p) => ({
        nome: p.nome,
        colore: p.colore,
        bot: p.bot,
        connesso: p.offlineDa === null,
        fuori: fuori.has(p.id),
      })),
      turno: partita && this.fase !== 'lobby' ? partita.turno.numero : null,
      diTurno: diTurno?.nome ?? null,
      spettatori: this.spettatori(),
      inPausa: this.pausaDa !== null,
    };
  }

  private decidiDadi(dadi: [number, number] | null, id: IdGiocatore | null): string | null {
    if (dadi === null) {
      this.dadiDecisi = null;
      return null;
    }
    if (this.fase !== 'partita' || !this.partita) return 'I dadi si decidono a partita in corso.';
    if (!dadi.every((d) => Number.isInteger(d) && d >= 1 && d <= 6)) return 'Ogni dado va da 1 a 6.';
    if (id !== null && !this.inGioco(id)) return 'Questo giocatore non è in gioco.';
    this.dadiDecisi = { dadi: [dadi[0], dadi[1]], giocatore: id };
    return null;
  }

  /**
   * Il caso per un'azione: per il tiro deciso dal pannello, i due dadi escono come scelto (e la scelta si consuma);
   * per tutto il resto, il caso vero.
   */
  private casoPer(azione: Azione): Caso {
    const decisi = this.dadiDecisi;
    const vero = this.amb.caso;
    if (!decisi || azione.tipo !== 'lancia' || (decisi.giocatore !== null && decisi.giocatore !== azione.giocatore)) return vero;
    // `tiraDadi` chiede i due dadi (intero(6)) per primi.
    const valori = [decisi.dadi[0] - 1, decisi.dadi[1] - 1];
    return {
      intero: (n) => {
        if (n !== 6 || valori.length === 0) return vero.intero(n);
        const valore = valori.shift()!;
        if (valori.length === 0) this.dadiDecisi = null;
        return valore;
      },
    };
  }

  private fotografia(): Fotografia {
    return {
      partita: this.partita && structuredClone(this.partita),
      fase: this.fase,
      impostazioni: { ...this.impostazioni },
      nomi: new Map(this.posti.map((p) => [p.id, p.nome])),
    };
  }

  private ricorda(foto: Fotografia): void {
    this.pilaPannello.push(foto);
    if (this.pilaPannello.length > ANNULLA_PANNELLO_MAX) this.pilaPannello.shift();
  }

  /* ------------------------------------------------------------------ */
  /* Aiuti                                                               */
  /* ------------------------------------------------------------------ */

  /** Persone che guardano senza essere sedute. */
  private spettatori(): number {
    const seduti = new Set(this.posti.map((p) => p.token));
    return new Set([...this.connessioni.values()].filter((t) => !seduti.has(t))).size;
  }

  private postoDi(token: Token): Posto | undefined {
    return this.posti.find((p) => p.token === token);
  }

  private collegato(token: Token): boolean {
    for (const t of this.connessioni.values()) if (t === token) return true;
    return false;
  }

  /** È nella partita in corso e non ne è ancora uscito. */
  private inGioco(id: IdGiocatore): boolean {
    return this.partita?.giocatori.some((g) => g.id === id && !g.eliminato) ?? false;
  }

  /** Chi è seduto nella squadra indicata, bot compresi. */
  private membri(squadra: number): IdGiocatore[] {
    return this.posti.filter((p) => p.squadra === squadra).map((p) => p.id);
  }

  /** Il messaggio di squadra può leggerlo chi presenta il token: è seduto ed era tra i destinatari all'invio. */
  private leggibile(token: Token, messaggio: MessaggioInStanza | undefined): boolean {
    const posto = this.postoDi(token);
    return posto !== undefined && (messaggio?.lettori?.includes(posto.id) ?? false);
  }

  private idLibero(): IdGiocatore {
    let id = nuovoId();
    while (this.posti.some((p) => p.id === id)) id = nuovoId();
    return id;
  }

  /** La squadra di chi entra: la più piccola tra quelle in uso (o tra le prime due, finché non ce ne sono due). */
  private squadraPerNuovo(): number | null {
    if (!this.impostazioni.squadre) return null;
    const conta = Array.from({ length: SQUADRE_MAX }, (_, i) => this.posti.filter((p) => p.squadra === i).length);
    const usate = conta.flatMap((n, i) => (n > 0 ? [i] : []));
    const candidate = usate.length >= 2 ? usate : [0, 1];
    return candidate.reduce((a, b) => (conta[b]! < conta[a]! ? b : a));
  }

  /** @param escluso un posto che si sta per liberare: il suo colore conta come libero. */
  private controllaColore(colore: number, escluso?: Posto): Risposta<never> | null {
    if (!Number.isInteger(colore) || colore < 1 || colore > COLORI) {
      return no('richiesta_non_valida', `Il colore deve essere un numero da 1 a ${COLORI}.`);
    }
    if (this.posti.some((p) => p !== escluso && p.colore === colore)) {
      return no('colore_preso', 'Un altro giocatore ha appena preso questo colore: scegline un altro.');
    }
    return null;
  }

  private soloHostInLobby(token: Token, messaggio: string): Risposta<never> | null {
    const posto = this.postoDi(token);
    if (!posto || posto.id !== this.host) return no('solo_host', messaggio);
    if (this.fase !== 'lobby') return no('partita_iniziata', 'La partita è già cominciata.');
    return null;
  }

  /**
   * Libera il posto. Se era dell'host, il ruolo passa alla prima persona della lista (mai a un bot).
   * Se non resta nessuna persona, se ne vanno anche i bot.
   */
  private rimuovi(posto: Posto, motivo: 'volontaria' | 'espulsione' | 'assenza'): void {
    this.posti = this.posti.filter((p) => p !== posto);
    const voci: EventoStanza[] = [{ tipo: 'uscita', giocatore: posto.id, nome: posto.nome, motivo }];
    if (this.host === posto.id) {
      const erede = this.posti.find((p) => !p.bot);
      this.host = erede?.id ?? null;
      if (erede) voci.push({ tipo: 'nuovo_host', giocatore: erede.id, nome: erede.nome });
    }
    if (!this.posti.some((p) => !p.bot)) {
      for (const bot of this.posti) voci.push({ tipo: 'uscita', giocatore: bot.id, nome: bot.nome, motivo: 'volontaria' });
      this.posti = [];
    }
    this.segna(...voci);
  }

  /**
   * Accoglie il nuovo stato della partita e toglie le attività sugli scambi che non ci sono più
   * (o di chi è uscito). Se esce l'ultimo giocatore collegato, la partita va in pausa come quando chiude la pagina.
   * Il ruolo di host passa come dice `passaHost`.
   */
  private registra(esito: Extract<Esito, { ok: true }>, dalPannello = false): void {
    const partita = esito.stato;
    this.partita = partita;
    if (partita.fase === 'finita') this.fase = 'finita';
    if (!dalPannello) this.pilaPannello = [];
    const aperti = new Set(partita.scambi.map((x) => x.id));
    const fuori = new Set(partita.giocatori.filter((g) => g.eliminato).map((g) => g.id));
    this.togliAttivita(
      (id, a) => this.fase !== 'partita' || fuori.has(id) || (a.tipo !== 'crea' && !aperti.has(a.scambio)),
    );
    const hostRimosso = esito.eventi.some((e) => e.tipo === 'rimozione' && e.giocatore === this.host);
    this.aggiornaPresenze();
    this.segna(...esito.eventi, ...this.passaHost(hostRimosso));
  }

  /**
   * Il ruolo di host in partita. L'host resta tale finché è in gioco, e anche fuori dalla partita (dopo la bancarotta)
   * finché è collegato a guardare. Se è fuori e non è collegato, il ruolo passa alla prima persona collegata ancora
   * in gioco. Se esce per tempo, assenza o voto (`rimosso`), passa subito alla prima persona ancora in gioco,
   * preferendo chi è collegato. Restituisce la voce del registro per il nuovo host, se c'è.
   */
  private passaHost(rimosso = false): EventoStanza[] {
    const partita = this.partita;
    if (!partita || (this.fase !== 'partita' && !rimosso)) return [];
    const host = this.posti.find((p) => p.id === this.host);
    if (!rimosso && host && (this.inGioco(host.id) || this.collegato(host.token))) return [];
    const persone = partita.giocatori.flatMap((g) => {
      const posto = this.posti.find((p) => p.id === g.id && !p.bot);
      return posto && !g.eliminato ? [{ id: g.id, nome: g.nome, collegato: this.collegato(posto.token) }] : [];
    });
    const erede = persone.find((p) => p.collegato) ?? (rimosso ? persone[0] : undefined);
    if (!erede || erede.id === this.host) return [];
    this.host = erede.id;
    return [{ tipo: 'nuovo_host', giocatore: erede.id, nome: erede.nome }];
  }

  /**
   * Allinea la partita alle connessioni: chi è in gioco e non ha schede aperte risulta assente (i suoi turni
   * passano da soli e dopo due minuti esce). I bot sono sempre presenti.
   * La partita va in pausa se nessuna persona in gioco è collegata: chi è già uscito dalla partita e guarda non conta
   * (se in gioco restano solo bot, si ferma quando non guarda più nessuno). Al ritorno del primo, gli orologi si
   * spostano avanti del tempo passato in pausa. Va richiamata quando cambiano le connessioni o chi è in gioco.
   */
  private aggiornaPresenze(): void {
    if (this.fase !== 'partita' || !this.partita) return;
    const adesso = this.amb.adesso();
    const inGioco = this.partita.giocatori.filter((g) => !g.eliminato);
    const posto = (id: IdGiocatore) => this.posti.find((p) => p.id === id);
    const collegato = (id: IdGiocatore) => {
      const p = posto(id);
      return p !== undefined && (p.bot || this.collegato(p.token));
    };
    const persone = inGioco.filter((g) => !posto(g.id)?.bot);
    const qualcuno = persone.length > 0 ? persone.some((g) => collegato(g.id)) : this.connessioni.size > 0;
    if (!qualcuno) {
      this.pausaDa ??= adesso;
      return;
    }
    if (this.pausaDa !== null) {
      this.partita = sposta(this.partita, adesso - this.pausaDa);
      this.pausaDa = null;
    }
    for (const g of inGioco) this.partita = connessione(this.partita, g.id, collegato(g.id), adesso);
  }

  private mappaAttivita(): Record<IdGiocatore, Attivita> {
    return Object.fromEntries(this.attivita);
  }

  private togliAttivita(via: (id: IdGiocatore, a: Attivita) => boolean): void {
    for (const [id, a] of this.attivita) {
      if (!via(id, a)) continue;
      this.attivita.delete(id);
      this.attivitaCambiata = true;
    }
  }

  /** Registra una modifica (con eventuali voci del registro) da mandare al prossimo `raccogli()`. */
  private segna(...eventi: EventoStanza[]): void {
    this.modificata = true;
    const quando = this.amb.adesso();
    for (const evento of eventi) {
      const voce: VoceRegistro = { n: this.prossimaVoce++, quando, evento };
      this.registro.push(voce);
      this.nuove.push(voce);
    }
    if (this.registro.length > REGISTRO_MAX) this.registro.splice(0, this.registro.length - REGISTRO_MAX);
    this.pianificaBot(eventi);
  }
}

const FASI: readonly unknown[] = ['lobby', 'partita', 'finita'] satisfies FaseStanza[];

const oggetto = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

const postoValido = (p: unknown) =>
  oggetto(p) && typeof p.id === 'string' && typeof p.token === 'string' && typeof p.nome === 'string' && typeof p.colore === 'number';

const messaggioValido = (m: unknown) => oggetto(m) && typeof m.n === 'number' && (m.lettori === undefined || Array.isArray(m.lettori));

/**
 * Cosa non va nei dati di una stanza letti dal file (scritto a mano, rovinato, di un'altra versione), oppure `null`
 * se hanno la forma giusta. Controlla la stanza, non l'interno della partita.
 */
function problemaDiForma(dati: unknown): string | null {
  if (!oggetto(dati)) return 'non è un oggetto';
  if (typeof dati.codice !== 'string' || !new RegExp(`^[a-z0-9]{${LUNGHEZZA_CODICE}}$`).test(dati.codice)) return 'codice non valido';
  if (!FASI.includes(dati.fase)) return 'fase sconosciuta';
  if (dati.fase === 'lobby' ? dati.partita !== null : !oggetto(dati.partita)) return 'partita non coerente con la fase';
  if (dati.impostazioni !== undefined && !oggetto(dati.impostazioni)) return 'impostazioni non valide';
  if (dati.host !== null && typeof dati.host !== 'string') return 'host non valido';
  if (!Array.isArray(dati.posti) || !dati.posti.every(postoValido)) return 'posti non validi';
  if (!Array.isArray(dati.registro) || !dati.registro.every(oggetto)) return 'registro non valido';
  if (!Array.isArray(dati.chat) || !dati.chat.every(messaggioValido)) return 'chat non valida';
  for (const campo of ['versione', 'prossimaVoce', 'prossimoMessaggio']) {
    if (!Number.isFinite(dati[campo])) return `manca ${campo}`;
  }
  return null;
}

/** Il messaggio come lo ricevono i browser: senza l'elenco di chi può leggerlo. */
function senzaLettori(messaggio: MessaggioInStanza): MessaggioChat {
  const copia = { ...messaggio };
  delete copia.lettori;
  return copia;
}

/**
 * Porta una partita salvata dalle versioni precedenti alla forma attuale.
 * - Prima della Fase 5 mancavano asta e scambi.
 * - Prima della Fase 6 mancavano gli orologi: la banca di tempo riparte da capo, il turno da `adesso`.
 * - Prima della Fase 7 mancavano le statistiche: si contano da `adesso`.
 * - Prima della Fase 8 mancavano le squadre: la partita non è a squadre.
 */
function aggiornaSalvata(salvata: Stato, adesso: number): Stato {
  type G = Stato['giocatori'][number];
  type T = Stato['turno'];
  const v = salvata as Omit<
    Stato,
    'asta' | 'scambi' | 'prossimoScambio' | 'giocatori' | 'turno' | 'statistiche' | 'squadre' | 'squadraVincitrice'
  > &
    Partial<Pick<Stato, 'asta' | 'scambi' | 'prossimoScambio' | 'statistiche' | 'squadre' | 'squadraVincitrice'>> & {
      giocatori: (Omit<G, 'banca' | 'automatici' | 'offlineDa' | 'squadra'> &
        Partial<Pick<G, 'banca' | 'automatici' | 'offlineDa' | 'squadra'>>)[];
      turno: Omit<T, 'tempo' | 'votazione'> & Partial<Pick<T, 'tempo' | 'votazione'>>;
    };
  const asta = v.asta ?? null;
  return {
    ...v,
    // Le partite cominciate prima della durata massima continuano senza limite.
    impostazioni: { ...IMPOSTAZIONI_PREDEFINITE, durataMassima: false, ...(v.impostazioni as Partial<Stato['impostazioni']>) },
    asta,
    scambi: v.scambi ?? [],
    prossimoScambio: v.prossimoScambio ?? 1,
    squadre: v.squadre ?? [],
    squadraVincitrice: v.squadraVincitrice ?? null,
    statistiche: v.statistiche ?? {
      ...statisticheIniziali(v.mappa, adesso),
      fine: v.fase === 'finita' ? adesso : null,
      uscite: v.giocatori.filter((g) => g.eliminato).map((g) => g.id),
    },
    giocatori: v.giocatori.map((g) => ({
      ...g,
      banca: g.banca ?? BANCA_INIZIALE_MS,
      automatici: g.automatici ?? 0,
      offlineDa: g.offlineDa ?? null,
      squadra: g.squadra ?? null,
    })),
    turno: {
      ...v.turno,
      tempo: v.turno.tempo ?? {
        inizio: adesso,
        grazia: GRAZIA_MS,
        regalato: 0,
        regali: [],
        richiesta: false,
        automatico: false,
        fermoDa: asta ? adesso : null,
      },
      votazione: v.turno.votazione ?? { voti: [], scadenza: null },
    },
  };
}
