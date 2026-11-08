/*
 * Una stanza: posti al tavolo, host, impostazioni, partita, registro e chat.
 * Non sa niente di Socket.IO: riceve comandi già letti e risponde con una `Risposta`.
 * Ogni modifica finisce in un "pacchetto" che il livello di rete raccoglie con `raccogli()` e manda a tutti.
 */

import {
  applica,
  CHAT_CRONOLOGIA,
  CHAT_MAX,
  COLORI,
  creaPartita,
  GIOCATORI_MIN,
  nomeCasuale,
  pulisciNome,
  REGISTRO_MAX,
  vistaPartita,
  type Azione,
  type CodiceErroreServer,
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
    this.segna();
  }

  scollega(connessione: string): void {
    const token = this.connessioni.get(connessione);
    if (token === undefined) return;
    this.connessioni.delete(connessione);
    this.ultimaPresenza = this.amb.adesso();
    const posto = this.postoDi(token);
    if (posto && !this.collegato(token)) posto.offlineDa = this.amb.adesso();
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

  espelli(token: Token, id: IdGiocatore): Risposta<null> {
    const problema = this.soloHostInLobby(token, 'Solo l’host può espellere i giocatori.');
    if (problema) return problema;
    const posto = this.posti.find((p) => p.id === id);
    if (!posto) return no('giocatore_assente', 'Questo giocatore non è più nella stanza.');
    if (posto.token === token) return no('richiesta_non_valida', 'Non puoi espellere te stesso.');
    this.rimuovi(posto, 'espulsione');
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
    );
    if (!esito.ok) return no(esito.codice, esito.messaggio);
    this.fase = 'partita';
    this.partita = esito.stato;
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
    const esito = applica(this.partita, { ...mossa, giocatore: posto.id } as Azione, this.amb.caso);
    if (!esito.ok) return no(esito.codice, esito.messaggio);
    this.partita = esito.stato;
    if (esito.stato.fase === 'finita') this.fase = 'finita';
    this.segna(...esito.eventi);
    return si(null);
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

  /** Toglie dalla lobby chi è sparito da troppo tempo. */
  manutenzione(): void {
    if (this.fase !== 'lobby') return;
    const adesso = this.amb.adesso();
    for (const posto of [...this.posti]) {
      if (posto.offlineDa !== null && adesso - posto.offlineDa >= ATTESA_LOBBY_MS) this.rimuovi(posto, 'assenza');
    }
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
    return { stanza: this.vista(), io: this.io(token), registro: [...this.registro], chat: [...this.chat] };
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
    });
  }

  /** Dopo un riavvio nessuno è collegato: chi era in lobby ha il solito tempo per tornare. */
  static importa(dati: DatiStanza, amb: Ambiente): Stanza {
    const stanza = new Stanza(dati.codice, amb, dati.impostazioni);
    const adesso = amb.adesso();
    stanza.fase = dati.fase;
    stanza.versione = dati.versione;
    stanza.host = dati.host;
    stanza.posti = dati.posti.map((p) => ({ ...p, offlineDa: adesso }));
    stanza.partita = dati.partita;
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
