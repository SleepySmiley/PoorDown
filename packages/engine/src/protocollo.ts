/*
 * Protocollo tra browser e server (Socket.IO).
 * - Il browser manda comandi e riceve sempre una risposta: `{ ok: true, dati }` oppure `{ ok: false, codice, messaggio }`.
 * - Il server manda a tutta la stanza un `aggiornamento` a ogni cambiamento, con la stanza intera e una versione
 *   che cresce di 1. Se a un browser manca una versione, chiede `sincronizza` e riceve l'istantanea completa.
 */

import type { Azione, CodiceErrore, Evento, IdGiocatore, IdMappa, Impostazioni, Stato } from './tipi';

/** Risposta di GET /api/info. */
export interface InfoServer {
  nome: string;
  versione: string;
  /** Indirizzi da dare agli amici, il più probabile per primo (es. "http://192.168.1.23:3000"). */
  indirizzi: string[];
}

/* ------------------------------------------------------------------ */
/* Stanza                                                              */
/* ------------------------------------------------------------------ */

export type FaseStanza = 'lobby' | 'partita' | 'finita';

/** Giocatore seduto al tavolo, come lo vedono tutti. */
export interface Partecipante {
  id: IdGiocatore;
  nome: string;
  /** 1–12. */
  colore: number;
  /** Ha almeno una scheda del browser aperta sulla stanza. I bot sono sempre collegati. */
  connesso: boolean;
  /** Giocatore automatico, aggiunto dalla stanza per riempire i posti liberi. */
  bot: boolean;
  /** Nelle stanze a squadre, l'indice della sua squadra (0–3); altrimenti `null`. */
  squadra: number | null;
}

export interface VistaStanza {
  /** 5 caratteri minuscoli, es. "k7q2m". */
  codice: string;
  fase: FaseStanza;
  /** Cresce di 1 a ogni aggiornamento. */
  versione: number;
  host: IdGiocatore | null;
  impostazioni: Impostazioni;
  /** In ordine di ingresso. */
  partecipanti: Partecipante[];
  /** I nomi delle quattro squadre possibili (li cambia l'host). Contano solo con l'impostazione `squadre`. */
  squadre: string[];
  /** Persone che guardano senza essere sedute. */
  spettatori: number;
  /** Stato della partita senza le informazioni nascoste (vedi `vistaPartita`). `null` in lobby. */
  partita: Stato | null;
}

/** Fatti della stanza che non vengono dal motore: entrano nel registro come gli eventi di gioco. */
export type EventoStanza =
  | Evento
  | { tipo: 'ingresso'; giocatore: IdGiocatore; nome: string; colore: number }
  | { tipo: 'uscita'; giocatore: IdGiocatore; nome: string; motivo: 'volontaria' | 'espulsione' | 'assenza' }
  | { tipo: 'nuovo_host'; giocatore: IdGiocatore; nome: string }
  /** A partita finita, `giocatore` ha riportato la stanza in lobby per giocare ancora. */
  | { tipo: 'nuova_partita'; giocatore: IdGiocatore; nome: string };

export interface VoceRegistro {
  /** Numero progressivo nella stanza. */
  n: number;
  /** Millisecondi (orologio del server). */
  quando: number;
  evento: EventoStanza;
}

export interface MessaggioChat {
  n: number;
  quando: number;
  da: IdGiocatore;
  /** Nome e colore al momento dell'invio: restano leggibili anche se il giocatore esce. */
  nome: string;
  colore: number;
  testo: string;
  /** Messaggio della chat di squadra: lo vedono solo i giocatori di quella squadra. */
  squadra?: number;
}

/**
 * Cosa sta facendo un giocatore con gli scambi, perché gli altri lo vedano (matita e occhio accanto agli scambi).
 * Non fa parte della partita: non si salva e non cambia la versione della stanza.
 */
export type Attivita = { tipo: 'crea' } | { tipo: 'guarda'; scambio: number } | { tipo: 'tratta'; scambio: number };

/** Inviato dal server a ogni cambiamento della stanza. */
export interface Aggiornamento {
  stanza: VistaStanza;
  /** Il posto di chi riceve, `null` se guarda soltanto. */
  io: IdGiocatore | null;
  /** Voci del registro nate con questo aggiornamento. */
  voci: VoceRegistro[];
  /** Orologio del server (ms) all'invio: il browser lo usa per i conti alla rovescia, come l'asta. */
  adesso: number;
}

/** Tutto quello che serve per disegnare la stanza da zero: all'ingresso e dopo una risincronizzazione. */
export interface Istantanea {
  stanza: VistaStanza;
  io: IdGiocatore | null;
  /** Ultime voci del registro, dalla più vecchia. */
  registro: VoceRegistro[];
  /** Ultimi messaggi della chat, dal più vecchio. */
  chat: MessaggioChat[];
  /** Chi sta creando, guardando o trattando uno scambio. */
  attivita: Record<IdGiocatore, Attivita>;
  /** Orologio del server (ms) all'invio. */
  adesso: number;
}

/** Una riga di "Tutte le stanze" (solo stanze pubbliche). */
export interface StanzaInElenco {
  codice: string;
  fase: FaseStanza;
  giocatori: { nome: string; colore: number; bot: boolean }[];
  giocatoriMax: number;
  mappa: IdMappa;
  impostazioni: Impostazioni;
}

/* ------------------------------------------------------------------ */
/* Comandi                                                             */
/* ------------------------------------------------------------------ */

type SenzaGiocatore<T> = T extends unknown ? Omit<T, 'giocatore'> : never;
/** Azione di gioco come la manda il browser: chi la compie lo decide il server. */
export type Mossa = SenzaGiocatore<Azione>;

export type CodiceErroreServer =
  | CodiceErrore
  | 'richiesta_non_valida'
  | 'stanza_inesistente'
  | 'troppe_stanze'
  | 'fuori_stanza'
  | 'stanza_piena'
  | 'colore_preso'
  | 'gia_seduto'
  | 'non_seduto'
  | 'solo_host'
  | 'giocatore_assente'
  | 'partita_iniziata'
  | 'partita_non_in_corso'
  | 'partita_non_finita'
  | 'pochi_giocatori'
  | 'troppi_giocatori'
  | 'squadre_spente'
  | 'errore_interno'
  /** Solo lato browser: il server non ha risposto in tempo. */
  | 'senza_risposta';

export type Risposta<T> = { ok: true; dati: T } | { ok: false; codice: CodiceErroreServer; messaggio: string };

type Vuoto = Record<string, never>;

/** Comandi del browser: cosa manda (`dati`) e cosa riceve se va bene (`risposta`). */
export interface Comandi {
  /** Stanze pubbliche aperte sul server. */
  elenco_stanze: { dati: Vuoto; risposta: StanzaInElenco[] };
  /** Crea una stanza vuota: chi la crea ci deve poi entrare e sedersi come gli altri. */
  crea_stanza: { dati: { privata: boolean }; risposta: { codice: string } };
  /** La prima stanza pubblica in attesa con un posto libero, o una nuova. */
  gioca: { dati: Vuoto; risposta: { codice: string } };
  /** Segue la stanza e ne riceve gli aggiornamenti. Chi aveva un posto lo ritrova. */
  entra: { dati: { codice: string }; risposta: Istantanea };
  /** Smette di seguire la stanza. In lobby libera anche il posto. */
  esci: { dati: Vuoto; risposta: null };
  /** Prende un posto al tavolo (solo in lobby). Il primo che si siede diventa host. */
  siediti: { dati: { nome: string; colore: number }; risposta: { io: IdGiocatore } };
  cambia_colore: { dati: { colore: number }; risposta: null };
  /** Solo l'host e solo in lobby. */
  impostazioni: { dati: Partial<Impostazioni>; risposta: null };
  /** In lobby l'host libera un posto (anche di un bot); in partita, nelle stanze private, toglie un giocatore. */
  espelli: { dati: { giocatore: IdGiocatore }; risposta: null };
  /**
   * In lobby, a squadre: entra nella squadra indicata (0–3). L'host può spostarci anche un altro giocatore,
   * bot compresi, indicando `giocatore`.
   */
  squadra: { dati: { squadra: number; giocatore?: IdGiocatore }; risposta: null };
  /** Solo l'host e solo in lobby: dà un nome a una squadra (vuoto: torna quello predefinito). */
  nome_squadra: { dati: { squadra: number; nome: string }; risposta: null };
  /** Solo l'host e solo in lobby: rifà le squadre a sorte, con lo stesso numero di squadre (almeno due). */
  mescola_squadre: { dati: Vuoto; risposta: null };
  /** Solo l'host: servono almeno 2 giocatori e non più del massimo scelto. */
  avvia: { dati: Vuoto; risposta: null };
  /**
   * A partita finita, riporta la stanza in lobby con le stesse impostazioni e gli stessi posti.
   * Solo l'host, oppure qualunque giocatore seduto se l'host non è collegato.
   */
  nuova_partita: { dati: Vuoto; risposta: null };
  mossa: { dati: Mossa; risposta: null };
  /** Solo chi è seduto al tavolo. Con `squadra` il messaggio va solo ai compagni di squadra. */
  scrivi: { dati: { testo: string; squadra?: boolean }; risposta: null };
  sincronizza: { dati: Vuoto; risposta: Istantanea };
}

export type NomeComando = keyof Comandi;

/** Eventi che i browser inviano al server. */
export type EventiClient = {
  [K in NomeComando]: (dati: Comandi[K]['dati'], risposta: (r: Risposta<Comandi[K]['risposta']>) => void) => void;
} & {
  /** Senza risposta: avvisa gli altri che si sta scrivendo in chat. */
  sta_scrivendo: () => void;
  /** Senza risposta: cosa si sta facendo con gli scambi (`null`: niente). */
  attivita: (a: Attivita | null) => void;
};

/** Eventi che il server invia ai browser. */
export interface EventiServer {
  aggiornamento: (a: Aggiornamento) => void;
  messaggio: (m: MessaggioChat) => void;
  /** Un giocatore sta scrivendo in chat. */
  scrive: (giocatore: IdGiocatore) => void;
  /** Chi sta creando, guardando o trattando uno scambio, per intero a ogni cambiamento. */
  attivita: (mappa: Record<IdGiocatore, Attivita>) => void;
  /** La stanza è stata chiusa dal server. */
  stanza_chiusa: (codice: string) => void;
}

/* ------------------------------------------------------------------ */
/* Limiti                                                              */
/* ------------------------------------------------------------------ */

export const LUNGHEZZA_CODICE = 5;
export const NOME_MAX = 32;
export const COLORI = 12;
export const CHAT_MAX = 1000;
/** Messaggi della chat mostrati a chi entra dopo. */
export const CHAT_CRONOLOGIA = 50;
/** Voci del registro conservate dalla stanza. */
export const REGISTRO_MAX = 100;
/** Il browser rinuncia ad aspettare la risposta a un comando dopo questo tempo. */
export const ATTESA_RISPOSTA_MS = 10_000;
