/*
 * Collegamento con il server, indipendente da React.
 * - Manda i comandi e aspetta la risposta (al massimo 10 s).
 * - Tiene l'ultima versione della stanza seguita: applica gli aggiornamenti in ordine, ignora quelli vecchi
 *   e, se ne manca uno, chiede l'istantanea completa.
 * - Dopo una disconnessione rientra da solo nella stanza e ritrova il posto (grazie al token).
 * L'interfaccia legge lo stato con `leggi()` e si iscrive ai cambiamenti con `ascolta()`.
 */

import { io, type Socket } from 'socket.io-client';
import {
  ATTESA_RISPOSTA_MS,
  CHAT_CRONOLOGIA,
  REGISTRO_MAX,
  type Aggiornamento,
  type Attivita,
  type Comandi,
  type EventiClient,
  type EventiServer,
  type IdGiocatore,
  type Istantanea,
  type MessaggioChat,
  type NomeComando,
  type Risposta,
  type VistaStanza,
  type VoceRegistro,
} from '@poordown/engine';

export type StatoRete = 'in_corso' | 'attivo' | 'perso';

export interface StatoCollegamento {
  rete: StatoRete;
  /** La stanza seguita, aggiornata all'ultima versione ricevuta. */
  stanza: VistaStanza | null;
  /** Il mio posto al tavolo, `null` se guardo soltanto. */
  io: IdGiocatore | null;
  registro: VoceRegistro[];
  chat: MessaggioChat[];
  /** Chi sta scrivendo in chat adesso. */
  scrivono: IdGiocatore[];
  /** Chi sta creando, guardando o trattando uno scambio. */
  attivita: Record<IdGiocatore, Attivita>;
  /** Perché la stanza non è più seguita (chiusa, scaduta), da mostrare all'utente. */
  avviso: string | null;
}

export type PresaGioco = Socket<EventiServer, EventiClient>;

/** Per quanto resta acceso "sta scrivendo" dopo l'ultimo segnale. */
const SCRIVE_MS = 3_000;
/** Mentre si scrive, il segnale parte al massimo una volta in questo tempo. */
const SEGNALE_SCRITTURA_MS = 1_500;

const SENZA_RETE = {
  ok: false,
  codice: 'senza_risposta',
  messaggio: 'Non sei collegato al server.',
} as const;

function senzaStanza(): Pick<StatoCollegamento, 'stanza' | 'io' | 'registro' | 'chat' | 'scrivono' | 'attivita'> {
  return { stanza: null, io: null, registro: [], chat: [], scrivono: [], attivita: {} };
}

export class Collegamento {
  private stato: StatoCollegamento = { rete: 'in_corso', ...senzaStanza(), avviso: null };
  private readonly ascoltatori = new Set<() => void>();
  private readonly ascoltatoriVoci = new Set<(voci: VoceRegistro[]) => void>();
  /** Codice della stanza da seguire: resta anche durante una disconnessione. */
  private codice: string | null = null;
  /** Mentre si aspetta un'istantanea, gli aggiornamenti si mettono da parte. */
  private inCarica = false;
  private messiDaParte: Aggiornamento[] = [];
  private readonly timerScrittura = new Map<IdGiocatore, ReturnType<typeof setTimeout>>();
  private ultimoSegnaleScrittura = 0;
  /** Quanto l'orologio del server è avanti rispetto a quello di questo browser (ms). */
  private scarto = 0;
  /** L'ultima attività sugli scambi mandata al server. */
  private miaAttivita: Attivita | null = null;

  constructor(private readonly presa: PresaGioco) {
    presa.on('connect', () => {
      this.cambia({ rete: 'attivo' });
      if (this.codice) void this.rientra(this.codice);
    });
    presa.on('disconnect', () => this.cambia({ rete: 'perso' }));
    presa.on('connect_error', () => this.cambia({ rete: 'perso' }));
    presa.on('aggiornamento', (a) => this.ricevi(a));
    presa.on('messaggio', (m) => this.riceviMessaggio(m));
    presa.on('scrive', (id) => this.segnaScrittura(id));
    presa.on('attivita', (mappa) => {
      if (this.stato.stanza) this.cambia({ attivita: mappa });
    });
    presa.on('stanza_chiusa', (codice) => {
      if (codice === this.codice) this.dimentica('La stanza è stata chiusa.');
    });
  }

  /* --------------------------- Lettura ------------------------------ */

  leggi(): StatoCollegamento {
    return this.stato;
  }

  /** L'ora del server, in millisecondi: per i conti alla rovescia (l'asta) anche se gli orologi non coincidono. */
  orologio(): number {
    return Date.now() + this.scarto;
  }

  /** La stanza che si sta seguendo (anche mentre si aspetta di entrarci), `null` se nessuna. */
  codiceSeguito(): string | null {
    return this.codice;
  }

  /** Chiamata a ogni cambiamento dello stato. Restituisce la funzione per smettere. */
  ascolta(fn: () => void): () => void {
    this.ascoltatori.add(fn);
    return () => this.ascoltatori.delete(fn);
  }

  /** Voci nuove del registro, nell'ordine in cui arrivano (per animazioni e suoni). */
  ascoltaVoci(fn: (voci: VoceRegistro[]) => void): () => void {
    this.ascoltatoriVoci.add(fn);
    return () => this.ascoltatoriVoci.delete(fn);
  }

  /* --------------------------- Comandi ------------------------------ */

  async comando<K extends NomeComando>(nome: K, dati: Comandi[K]['dati']): Promise<Risposta<Comandi[K]['risposta']>> {
    if (!this.presa.connected) return SENZA_RETE;
    const presa = this.presa.timeout(ATTESA_RISPOSTA_MS) as unknown as {
      emitWithAck(nome: string, dati: unknown): Promise<Risposta<Comandi[K]['risposta']>>;
    };
    try {
      return await presa.emitWithAck(nome, dati);
    } catch {
      return { ok: false, codice: 'senza_risposta', messaggio: 'Il server non risponde. Riprova tra poco.' };
    }
  }

  /** Segue la stanza. Se adesso non c'è rete, ci entra appena torna. */
  async entra(codice: string): Promise<Risposta<Istantanea>> {
    this.codice = codice;
    this.cambia({ avviso: null });
    if (!this.presa.connected) return SENZA_RETE;
    return this.rientra(codice);
  }

  /** Smette di seguire la stanza e dimentica anche l'ultimo avviso (già mostrato a chi esce). */
  async esci(): Promise<void> {
    this.codice = null;
    this.cambia({ ...senzaStanza(), avviso: null });
    if (this.presa.connected) await this.comando('esci', {});
  }

  /** Da chiamare a ogni tasto: il segnale parte al massimo ogni 1,5 s. */
  staScrivendo(): void {
    const adesso = Date.now();
    if (!this.presa.connected || adesso - this.ultimoSegnaleScrittura < SEGNALE_SCRITTURA_MS) return;
    this.ultimoSegnaleScrittura = adesso;
    this.presa.emit('sta_scrivendo');
  }

  /** Dice agli altri se si sta creando, guardando o trattando uno scambio. Manda solo i cambiamenti. */
  segnalaAttivita(attivita: Attivita | null): void {
    if (JSON.stringify(attivita) === JSON.stringify(this.miaAttivita)) return;
    this.miaAttivita = attivita;
    if (this.presa.connected) this.presa.emit('attivita', attivita);
  }

  chiudi(): void {
    this.presa.disconnect();
  }

  /* ------------------------ Sincronizzazione ------------------------ */

  private async rientra(codice: string): Promise<Risposta<Istantanea>> {
    const risposta = await this.carica(() => this.comando('entra', { codice }));
    if (this.codice !== codice) return risposta;
    if (risposta.ok) this.codice = risposta.dati.stanza.codice;
    else if (risposta.codice !== 'senza_risposta') this.dimentica(risposta.messaggio);
    return risposta;
  }

  private async sincronizza(): Promise<void> {
    if (this.inCarica) return;
    await this.carica(() => this.comando('sincronizza', {}));
  }

  /** Chiede un'istantanea e la applica, poi riprende gli aggiornamenti arrivati nel frattempo. */
  private async carica(chiedi: () => Promise<Risposta<Istantanea>>): Promise<Risposta<Istantanea>> {
    this.inCarica = true;
    let risposta: Risposta<Istantanea>;
    try {
      risposta = await chiedi();
    } finally {
      this.inCarica = false;
    }
    if (risposta.ok && risposta.dati.stanza.codice === this.codice) {
      const { adesso, ...dati } = risposta.dati;
      this.scarto = adesso - Date.now();
      this.cambia({ ...dati, scrivono: [] });
      // Dopo una riconnessione il server non sa più cosa stavo facendo con gli scambi.
      if (this.miaAttivita && this.presa.connected) this.presa.emit('attivita', this.miaAttivita);
    }
    const daRiprendere = this.messiDaParte.sort((a, b) => a.stanza.versione - b.stanza.versione);
    this.messiDaParte = [];
    for (const a of daRiprendere) this.ricevi(a);
    return risposta;
  }

  private ricevi(a: Aggiornamento): void {
    if (this.inCarica) {
      this.messiDaParte.push(a);
      return;
    }
    const attuale = this.stato.stanza;
    if (!attuale || a.stanza.codice !== attuale.codice || a.stanza.versione <= attuale.versione) return;
    if (a.stanza.versione !== attuale.versione + 1) {
      void this.sincronizza();
      return;
    }
    this.scarto = a.adesso - Date.now();
    // Con «Un'altra partita» la stanza torna in lobby e il registro riparte da capo, come sul server.
    const daCapo = a.stanza.fase === 'lobby' && attuale.fase !== 'lobby';
    const registro = daCapo ? a.voci : [...this.stato.registro, ...a.voci].slice(-REGISTRO_MAX);
    this.cambia({ stanza: a.stanza, io: a.io, registro, attivita: daCapo ? {} : this.stato.attivita });
    if (a.voci.length > 0) for (const fn of this.ascoltatoriVoci) fn(a.voci);
  }

  /* ------------------------------ Chat ------------------------------ */

  private riceviMessaggio(m: MessaggioChat): void {
    if (!this.stato.stanza) return;
    clearTimeout(this.timerScrittura.get(m.da));
    this.timerScrittura.delete(m.da);
    this.cambia({
      chat: [...this.stato.chat, m].slice(-CHAT_CRONOLOGIA),
      scrivono: this.stato.scrivono.filter((id) => id !== m.da),
    });
  }

  private segnaScrittura(id: IdGiocatore): void {
    clearTimeout(this.timerScrittura.get(id));
    this.timerScrittura.set(
      id,
      setTimeout(() => {
        this.timerScrittura.delete(id);
        this.cambia({ scrivono: this.stato.scrivono.filter((x) => x !== id) });
      }, SCRIVE_MS),
    );
    if (!this.stato.scrivono.includes(id)) this.cambia({ scrivono: [...this.stato.scrivono, id] });
  }

  /* ----------------------------- Aiuti ------------------------------ */

  private dimentica(avviso: string): void {
    this.codice = null;
    this.cambia({ ...senzaStanza(), avviso });
  }

  private cambia(parziale: Partial<StatoCollegamento>): void {
    this.stato = { ...this.stato, ...parziale };
    for (const fn of this.ascoltatori) fn();
  }
}

/** Collegamento al server che ha servito la pagina. */
export function apriCollegamento(token: string): Collegamento {
  return new Collegamento(io({ auth: { token } }));
}
