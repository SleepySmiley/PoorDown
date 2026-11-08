/*
 * Una stanza: posti al tavolo, host, impostazioni, partita, registro e chat.
 * Non sa niente di Socket.IO: riceve comandi già letti e risponde con una `Risposta`.
 * Ogni modifica finisce in un "pacchetto" che il livello di rete raccoglie con `raccogli()` e manda a tutti.
 */

import {
  applica,
  applicaScadenze,
  BANCA_INIZIALE_MS,
  CHAT_CRONOLOGIA,
  CHAT_MAX,
  COLORI,
  connessione,
  creaPartita,
  espelli as espelliDallaPartita,
  GIOCATORI_MIN,
  GRAZIA_MS,
  nomeCasuale,
  prossimaScadenza,
  pulisciNome,
  REGISTRO_MAX,
  sposta,
  vistaPartita,
  type Attivita,
  type Azione,
  type CodiceErroreServer,
  type Esito,
  type EventoStanza,
  type FaseStanza,
  type IdGiocatore,
  type Impostazioni,
  type Istantanea,
  type MessaggioChat,
  type Mossa,
  type Risposta,
  type Stato,
  type VistaStanza,
  type VoceRegistro,
} from '@poordown/engine';
import { nuovoId, type Ambiente } from './ambiente';

/** Segreto del browser: chi lo presenta ritrova il suo posto. Non va mai mandato agli altri. */
export type Token = string;

/** In lobby, chi resta senza schede aperte sulla stanza per questo tempo perde il posto. */
export const ATTESA_LOBBY_MS = 2 * 60_000;

export interface Posto {
  id: IdGiocatore;
  token: Token;
  nome: string;
  colore: number;
  /** Da quando non ha più schede aperte sulla stanza; `null` se è collegato. */
  offlineDa: number | null;
}

/** La stanza come si salva su file. */
export interface DatiStanza {
  codice: string;
  fase: FaseStanza;
  versione: number;
  host: IdGiocatore | null;
  impostazioni: Impostazioni;
  posti: Omit<Posto, 'offlineDa'>[];
  partita: Stato | null;
  registro: VoceRegistro[];
  chat: MessaggioChat[];
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

export class Stanza {
  fase: FaseStanza = 'lobby';
  versione = 0;
  host: IdGiocatore | null = null;
  impostazioni: Impostazioni;
  /** In ordine di ingresso. */
  posti: Posto[] = [];
  partita: Stato | null = null;
  registro: VoceRegistro[] = [];
  chat: MessaggioChat[] = [];
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
    this.segna();
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
    this.segna();
  }

  /** Chi esce dalla stanza in lobby libera il posto. In partita il posto resta: si può tornare. */
  esci(connessione: string): void {
    const token = this.connessioni.get(connessione);
    this.scollega(connessione);
    const posto = token === undefined ? undefined : this.postoDi(token);
    if (posto && this.fase === 'lobby') this.rimuovi(posto, 'volontaria');
  }

  nessunoCollegato(): boolean {
    return this.connessioni.size === 0;
  }

  /* ------------------------------------------------------------------ */
  /* Lobby                                                               */
  /* ------------------------------------------------------------------ */

  siediti(token: Token, nome: string, colore: number): Risposta<{ io: IdGiocatore }> {
    if (this.fase !== 'lobby') return no('partita_iniziata', 'La partita è già cominciata: puoi solo guardarla.');
    if (this.postoDi(token)) return no('gia_seduto', 'Sei già al tavolo.');
    if (this.posti.length >= this.impostazioni.giocatoriMax) return no('stanza_piena', 'La stanza è piena.');
    const problema = this.controllaColore(colore);
    if (problema) return problema;

    const posto: Posto = {
      id: this.idLibero(),
      token,
      nome: pulisciNome(nome) || nomeCasuale(this.amb.caso),
      colore,
      offlineDa: this.collegato(token) ? null : this.amb.adesso(),
    };
    this.posti.push(posto);
    this.host ??= posto.id;
    this.segna({ tipo: 'ingresso', giocatore: posto.id, nome: posto.nome, colore });
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

  cambiaImpostazioni(token: Token, modifiche: Partial<Impostazioni>): Risposta<null> {
    const problema = this.soloHostInLobby(token, 'Solo l’host può cambiare le impostazioni.');
    if (problema) return problema;
    const nuove = { ...this.impostazioni, ...modifiche };
    if (JSON.stringify(nuove) === JSON.stringify(this.impostazioni)) return si(null);
    this.impostazioni = nuove;
    this.segna();
    return si(null);
  }

  /**
   * In lobby l'host libera il posto di un giocatore. In partita, solo nelle stanze private, lo toglie dalla
   * partita (non mentre gioca il suo turno): i suoi beni tornano alla banca e perde il posto, ma può guardare.
   */
  espelli(token: Token, id: IdGiocatore): Risposta<null> {
    if (this.fase === 'partita') return this.espelliInPartita(token, id);
    const problema = this.soloHostInLobby(token, 'Solo l’host può espellere i giocatori.');
    if (problema) return problema;
    const posto = this.posti.find((p) => p.id === id);
    if (!posto) return no('giocatore_assente', 'Questo giocatore non è più nella stanza.');
    if (posto.token === token) return no('richiesta_non_valida', 'Non puoi espellere te stesso.');
    this.rimuovi(posto, 'espulsione');
    return si(null);
  }

  private espelliInPartita(token: Token, id: IdGiocatore): Risposta<null> {
    const io = this.postoDi(token);
    if (!io || io.id !== this.host) return no('solo_host', 'Solo l’host può togliere un giocatore dalla partita.');
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

  avvia(token: Token): Risposta<null> {
    const problema = this.soloHostInLobby(token, 'Solo l’host può avviare la partita.');
    if (problema) return problema;
    if (this.posti.length < GIOCATORI_MIN) return no('pochi_giocatori', 'Servono almeno due giocatori per iniziare.');
    if (this.posti.length > this.impostazioni.giocatoriMax) {
      return no('troppi_giocatori', 'Ci sono più giocatori del massimo scelto nelle impostazioni: espelline qualcuno.');
    }
    const esito = creaPartita(
      this.posti.map(({ id, nome, colore }) => ({ id, nome, colore })),
      this.impostazioni,
      this.amb.caso,
      this.amb.adesso(),
    );
    if (!esito.ok) return no(esito.codice, esito.messaggio);
    this.fase = 'partita';
    this.partita = esito.stato;
    this.pausaDa = null;
    this.aggiornaPresenze();
    this.segna(...esito.eventi);
    return si(null);
  }

  /* ------------------------------------------------------------------ */
  /* Partita e chat                                                      */
  /* ------------------------------------------------------------------ */

  mossa(token: Token, mossa: Mossa): Risposta<null> {
    const posto = this.postoDi(token);
    if (!posto) return no('non_seduto', 'Stai solo guardando: non puoi giocare.');
    if (this.fase !== 'partita' || !this.partita) return no('partita_non_in_corso', 'La partita non è in corso.');
    const esito = applica(this.partita, { ...mossa, giocatore: posto.id } as Azione, this.amb.caso, this.amb.adesso());
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

  /** La chat non cambia la versione: il messaggio va mandato a parte. */
  scrivi(token: Token, testo: string): Risposta<MessaggioChat> {
    const posto = this.postoDi(token);
    if (!posto) return no('non_seduto', 'Solo i giocatori possono scrivere in chat.');
    const pulito = testo.trim();
    if (!pulito) return no('richiesta_non_valida', 'Il messaggio è vuoto.');
    if (Array.from(pulito).length > CHAT_MAX) return no('richiesta_non_valida', `Il messaggio supera i ${CHAT_MAX} caratteri.`);
    const messaggio: MessaggioChat = {
      n: this.prossimoMessaggio++,
      quando: this.amb.adesso(),
      da: posto.id,
      nome: posto.nome,
      colore: posto.colore,
      testo: pulito,
    };
    this.chat.push(messaggio);
    if (this.chat.length > CHAT_CRONOLOGIA) this.chat.splice(0, this.chat.length - CHAT_CRONOLOGIA);
    return si(messaggio);
  }

  /* ------------------------------------------------------------------ */
  /* Tempo                                                               */
  /* ------------------------------------------------------------------ */

  /** Toglie dalla lobby chi è sparito da troppo tempo; in partita applica le scadenze rimaste indietro. */
  manutenzione(): void {
    if (this.fase === 'partita') {
      this.scadenze();
      return;
    }
    if (this.fase !== 'lobby') return;
    const adesso = this.amb.adesso();
    for (const posto of [...this.posti]) {
      if (posto.offlineDa !== null && adesso - posto.offlineDa >= ATTESA_LOBBY_MS) this.rimuovi(posto, 'assenza');
    }
  }

  /** Applica quello che è scaduto nella partita: fine dell'asta, tempo del turno, voti, assenze. In pausa niente. */
  scadenze(): void {
    if (this.fase !== 'partita' || !this.partita || this.pausaDa !== null) return;
    const esito = applicaScadenze(this.partita, this.amb.caso, this.amb.adesso());
    if (esito?.ok) this.registra(esito);
  }

  /** Millisecondi alla prossima scadenza della partita, `null` se non ce ne sono o se la partita è in pausa. */
  attesa(): number | null {
    if (this.fase !== 'partita' || !this.partita || this.pausaDa !== null) return null;
    const scadenza = prossimaScadenza(this.partita);
    return scadenza === null ? null : Math.max(0, scadenza - this.amb.adesso());
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
    const seduti = new Set(this.posti.map((p) => p.token));
    const spettatori = new Set([...this.connessioni.values()].filter((t) => !seduti.has(t))).size;
    return {
      codice: this.codice,
      fase: this.fase,
      versione: this.versione,
      host: this.host,
      impostazioni: { ...this.impostazioni },
      partecipanti: this.posti.map((p) => ({ id: p.id, nome: p.nome, colore: p.colore, connesso: p.offlineDa === null })),
      spettatori,
      partita: this.partita ? vistaPartita(this.partita) : null,
    };
  }

  istantanea(token: Token): Istantanea {
    return {
      stanza: this.vista(),
      io: this.io(token),
      registro: [...this.registro],
      chat: [...this.chat],
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
      posti: this.posti.map(({ id, token, nome, colore }) => ({ id, token, nome, colore })),
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
   */
  static importa(dati: DatiStanza, amb: Ambiente): Stanza {
    const stanza = new Stanza(dati.codice, amb, dati.impostazioni);
    const adesso = amb.adesso();
    const pausaDa = dati.pausaDa ?? adesso;
    stanza.fase = dati.fase;
    stanza.versione = dati.versione;
    stanza.host = dati.host;
    stanza.posti = dati.posti.map((p) => ({ ...p, offlineDa: adesso }));
    stanza.partita = dati.partita && aggiornaSalvata(dati.partita, pausaDa);
    if (stanza.fase === 'partita') stanza.pausaDa = pausaDa;
    stanza.registro = dati.registro;
    stanza.chat = dati.chat;
    stanza.prossimaVoce = dati.prossimaVoce;
    stanza.prossimoMessaggio = dati.prossimoMessaggio;
    return stanza;
  }

  /* ------------------------------------------------------------------ */
  /* Aiuti                                                               */
  /* ------------------------------------------------------------------ */

  private postoDi(token: Token): Posto | undefined {
    return this.posti.find((p) => p.token === token);
  }

  private collegato(token: Token): boolean {
    for (const t of this.connessioni.values()) if (t === token) return true;
    return false;
  }

  private idLibero(): IdGiocatore {
    let id = nuovoId();
    while (this.posti.some((p) => p.id === id)) id = nuovoId();
    return id;
  }

  private controllaColore(colore: number): Risposta<never> | null {
    if (!Number.isInteger(colore) || colore < 1 || colore > COLORI) {
      return no('richiesta_non_valida', `Il colore deve essere un numero da 1 a ${COLORI}.`);
    }
    if (this.posti.some((p) => p.colore === colore)) {
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

  /** Libera il posto. Se era dell'host, il ruolo passa al primo della lista. */
  private rimuovi(posto: Posto, motivo: 'volontaria' | 'espulsione' | 'assenza'): void {
    this.posti = this.posti.filter((p) => p !== posto);
    const voci: EventoStanza[] = [{ tipo: 'uscita', giocatore: posto.id, nome: posto.nome, motivo }];
    if (this.host === posto.id) {
      const erede = this.posti[0];
      this.host = erede?.id ?? null;
      if (erede) voci.push({ tipo: 'nuovo_host', giocatore: erede.id, nome: erede.nome });
    }
    this.segna(...voci);
  }

  /**
   * Accoglie il nuovo stato della partita e toglie le attività sugli scambi che non ci sono più
   * (o di chi è uscito). Se l'host esce per tempo, assenza o voto, il ruolo passa al primo giocatore in gioco.
   */
  private registra(esito: Extract<Esito, { ok: true }>): void {
    const partita = esito.stato;
    this.partita = partita;
    if (partita.fase === 'finita') this.fase = 'finita';
    const aperti = new Set(partita.scambi.map((x) => x.id));
    const fuori = new Set(partita.giocatori.filter((g) => g.eliminato).map((g) => g.id));
    this.togliAttivita(
      (id, a) => this.fase !== 'partita' || fuori.has(id) || (a.tipo !== 'crea' && !aperti.has(a.scambio)),
    );
    const voci: EventoStanza[] = [...esito.eventi];
    if (esito.eventi.some((e) => e.tipo === 'rimozione' && e.giocatore === this.host)) {
      const erede = partita.giocatori.find((g) => !g.eliminato && this.posti.some((p) => p.id === g.id));
      if (erede) {
        this.host = erede.id;
        voci.push({ tipo: 'nuovo_host', giocatore: erede.id, nome: erede.nome });
      }
    }
    this.segna(...voci);
  }

  /**
   * Allinea la partita alle connessioni: chi è in gioco e non ha schede aperte risulta assente (i suoi turni
   * passano da soli e dopo due minuti esce). Se nessun giocatore in gioco è collegato la partita va in pausa;
   * al ritorno del primo, gli orologi si spostano avanti del tempo passato in pausa.
   */
  private aggiornaPresenze(): void {
    if (this.fase !== 'partita' || !this.partita) return;
    const adesso = this.amb.adesso();
    const inGioco = this.partita.giocatori.filter((g) => !g.eliminato);
    const collegato = (id: IdGiocatore) => {
      const posto = this.posti.find((p) => p.id === id);
      return posto !== undefined && this.collegato(posto.token);
    };
    if (!inGioco.some((g) => collegato(g.id))) {
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
  }
}

/**
 * Porta una partita salvata dalle versioni precedenti alla forma attuale.
 * - Prima della Fase 5 mancavano asta e scambi.
 * - Prima della Fase 6 mancavano gli orologi: la banca di tempo riparte da capo, il turno da `adesso`.
 */
function aggiornaSalvata(salvata: Stato, adesso: number): Stato {
  type G = Stato['giocatori'][number];
  type T = Stato['turno'];
  const v = salvata as Omit<Stato, 'asta' | 'scambi' | 'prossimoScambio' | 'giocatori' | 'turno'> &
    Partial<Pick<Stato, 'asta' | 'scambi' | 'prossimoScambio'>> & {
      giocatori: (Omit<G, 'banca' | 'automatici' | 'offlineDa'> & Partial<Pick<G, 'banca' | 'automatici' | 'offlineDa'>>)[];
      turno: Omit<T, 'tempo' | 'votazione'> & Partial<Pick<T, 'tempo' | 'votazione'>>;
    };
  const asta = v.asta ?? null;
  return {
    ...v,
    asta,
    scambi: v.scambi ?? [],
    prossimoScambio: v.prossimoScambio ?? 1,
    giocatori: v.giocatori.map((g) => ({
      ...g,
      banca: g.banca ?? BANCA_INIZIALE_MS,
      automatici: g.automatici ?? 0,
      offlineDa: g.offlineDa ?? null,
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
