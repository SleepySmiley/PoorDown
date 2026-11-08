/*
 * Tipi del motore di gioco.
 * Lo stato è un oggetto JSON semplice: si copia, si salva su file e si invia così com'è.
 */

export type IdGiocatore = string;
export type IdMappa = 'classica';
export type NomeMazzo = 'busta' | 'cartolina';

/* ------------------------------------------------------------------ */
/* Impostazioni della stanza                                           */
/* ------------------------------------------------------------------ */

export interface Impostazioni {
  /** 2–8. */
  giocatoriMax: number;
  stanzaPrivata: boolean;
  bot: boolean;
  mappa: IdMappa;
  /** L'affitto base raddoppia se il proprietario ha tutta la regione. */
  affittoDoppioSetCompleto: boolean;
  /** Tasse e pagamenti alla banca finiscono in una cassa che incassa chi si ferma in Vacanza. */
  cassaVacanza: boolean;
  aste: boolean;
  /** Chi è in prigione non incassa affitti. */
  nienteAffittoInPrigione: boolean;
  ipoteche: boolean;
  costruzioneUniforme: boolean;
  /** 500–3000, a passi di 500. */
  soldiIniziali: number;
  ordineCasuale: boolean;
  timerTurno: boolean;
}

/* ------------------------------------------------------------------ */
/* Tabellone                                                           */
/* ------------------------------------------------------------------ */

interface CasellaBase {
  nome: string;
  /** Nome corto per il tabellone. Il nome intero resta nella scheda e nel registro. */
  breve?: string;
}

/** Affitto con 0 (solo terreno), 1, 2, 3, 4 case e con l'albergo. */
export type Affitti = readonly [number, number, number, number, number, number];

export interface Citta extends CasellaBase {
  tipo: 'citta';
  /** Indice in `Tabellone.regioni`. */
  regione: number;
  prezzo: number;
  affitti: Affitti;
}

export interface Stazione extends CasellaBase {
  tipo: 'stazione';
  prezzo: number;
}

export interface Servizio extends CasellaBase {
  tipo: 'servizio';
  prezzo: number;
}

export interface CasellaCarta extends CasellaBase {
  tipo: 'carta';
  mazzo: NomeMazzo;
}

export interface Tassa extends CasellaBase {
  tipo: 'tassa';
  /** Percentuale del contante (es. 10) oppure importo fisso in euro. */
  tassa: { tipo: 'percentuale'; valore: number } | { tipo: 'fissa'; valore: number };
}

export interface Angolo extends CasellaBase {
  tipo: 'partenza' | 'prigione' | 'vacanza' | 'vai_in_prigione';
}

export type Proprietabile = Citta | Stazione | Servizio;
export type Casella = Proprietabile | CasellaCarta | Tassa | Angolo;
export type TipoCasella = Casella['tipo'];

export interface Regione {
  nome: string;
  costoCasa: number;
  costoAlbergo: number;
}

export type Effetto =
  /** Positivo: la banca paga. Negativo: si paga la banca. */
  | { tipo: 'soldi'; importo: number }
  /** Ogni altro giocatore paga chi pesca. */
  | { tipo: 'da_ognuno'; importo: number }
  /** Chi pesca paga ogni altro giocatore. */
  | { tipo: 'a_ognuno'; importo: number }
  /** Avanza fino alla casella indicata. */
  | { tipo: 'vai_a'; casella: number }
  /** Avanti (positivo) o indietro (negativo); indietro non passa dalla Partenza. */
  | { tipo: 'passi'; passi: number }
  /** Avanza fino alla prossima casella di quel tipo. */
  | { tipo: 'prossima'; casella: 'stazione' | 'servizio' }
  | { tipo: 'prigione' }
  /** Carta Grazia: esci gratis di prigione. */
  | { tipo: 'grazia' }
  | { tipo: 'riparazioni'; casa: number; albergo: number };

export interface Carta {
  testo: string;
  effetto: Effetto;
}

export interface Tabellone {
  id: IdMappa;
  nome: string;
  caselle: readonly Casella[];
  regioni: readonly Regione[];
  partenza: { passaggio: number; arrivo: number };
  /** Indice della casella Prigione, dove si va in cella. */
  prigione: number;
  cauzione: number;
  /** Affitto con 1, 2, 3, 4 stazioni. */
  affittiStazioni: readonly number[];
  /** Moltiplicatore dei dadi con 1, 2, 3 servizi. */
  moltiplicatoriServizi: readonly number[];
  mazzi: Readonly<Record<NomeMazzo, readonly Carta[]>>;
}

/* ------------------------------------------------------------------ */
/* Stato della partita                                                 */
/* ------------------------------------------------------------------ */

export interface Debito {
  creditore: IdGiocatore;
  importo: number;
}

export interface Eliminazione {
  /** Numero del turno in cui è uscito: serve alla classifica dei turni sopravvissuti. */
  turno: number;
  motivo: 'bancarotta';
}

export interface Giocatore {
  id: IdGiocatore;
  nome: string;
  /** Colore della pedina, 1–12. */
  colore: number;
  posizione: number;
  /** Può essere negativo: in quel caso il giocatore è in debito. */
  saldo: number;
  /**
   * Debiti verso altri giocatori, nell'ordine in cui sono nati. Ogni entrata salda prima questi.
   * La somma non supera mai la parte negativa del saldo: il resto del rosso è verso la banca.
   */
  debiti: Debito[];
  /** `null` se è libero, altrimenti quanti tiri ha già fallito in prigione (0–3). */
  prigione: number | null;
  /** Si è fermato in Vacanza e salta il prossimo turno. */
  vacanza: boolean;
  carteGrazia: NomeMazzo[];
  eliminato: Eliminazione | null;
}

export interface Proprieta {
  proprietario: IdGiocatore | null;
  /** 0 = solo terreno, 1–4 case, 5 = albergo. */
  livello: number;
  ipotecata: boolean;
}

export interface Mazzo {
  /** Ordine segreto delle carte (indici in `Tabellone.mazzi`). Non va mai mandato ai giocatori. */
  ordine: number[];
  /** Posizione in `ordine` della prossima carta da pescare. */
  prossima: number;
}

/**
 * - `lancio`: deve tirare i dadi.
 * - `prigione`: è in prigione e sceglie se tirare, pagare la cauzione o usare la Carta Grazia.
 * - `dopo_lancio`: ha tirato; può comprare, poi tira ancora (se ha fatto un doppio) o finisce il turno.
 */
export type FaseTurno = 'lancio' | 'prigione' | 'dopo_lancio';

export interface Turno {
  giocatore: IdGiocatore;
  /** Contatore dei turni giocati nella partita, dal primo (1). I turni saltati non contano. */
  numero: number;
  fase: FaseTurno;
  /** Ultimo tiro di questo turno. */
  dadi: [number, number] | null;
  /** Doppi di fila in questo turno. */
  doppi: number;
  /** Ha fatto un doppio: deve tirare ancora prima di finire il turno. */
  rilancio: boolean;
  /** Casella libera su cui si è fermato e che può comprare. */
  acquisto: number | null;
}

export interface Stato {
  mappa: IdMappa;
  impostazioni: Impostazioni;
  /** In ordine di turno. Chi è eliminato resta nella lista. */
  giocatori: Giocatore[];
  /** Una voce per casella: `null` per le caselle che non si possono comprare. */
  proprieta: (Proprieta | null)[];
  mazzi: Record<NomeMazzo, Mazzo>;
  cassaVacanza: number;
  turno: Turno;
  fase: 'in_corso' | 'finita';
  vincitore: IdGiocatore | null;
}

/* ------------------------------------------------------------------ */
/* Azioni, eventi, esiti                                               */
/* ------------------------------------------------------------------ */

/** `giocatore` è chi compie l'azione: lo imposta il server, non il browser. */
export type Azione =
  | { tipo: 'lancia'; giocatore: IdGiocatore }
  | { tipo: 'compra'; giocatore: IdGiocatore }
  | { tipo: 'fine_turno'; giocatore: IdGiocatore }
  | { tipo: 'paga_cauzione'; giocatore: IdGiocatore }
  | { tipo: 'usa_grazia'; giocatore: IdGiocatore; mazzo?: NomeMazzo }
  | { tipo: 'vendi'; giocatore: IdGiocatore; casella: number }
  | { tipo: 'bancarotta'; giocatore: IdGiocatore };

export type TipoAzione = Azione['tipo'];

export type Evento =
  | { tipo: 'inizio'; ordineCasuale: boolean }
  | { tipo: 'turno'; giocatore: IdGiocatore; numero: number }
  | { tipo: 'turno_saltato'; giocatore: IdGiocatore }
  | { tipo: 'dadi'; giocatore: IdGiocatore; dadi: [number, number] }
  /** `dadi` c'è quando lo spostamento viene da un tiro. */
  | { tipo: 'movimento'; giocatore: IdGiocatore; da: number; a: number; dadi?: [number, number] }
  | { tipo: 'partenza'; giocatore: IdGiocatore; importo: number; arrivo: boolean }
  | { tipo: 'acquisto'; giocatore: IdGiocatore; casella: number; prezzo: number }
  | { tipo: 'affitto'; da: IdGiocatore; a: IdGiocatore; casella: number; importo: number }
  | { tipo: 'tassa'; giocatore: IdGiocatore; casella: number; importo: number }
  | { tipo: 'carta'; giocatore: IdGiocatore; mazzo: NomeMazzo; carta: number; testo: string }
  | { tipo: 'prigione'; giocatore: IdGiocatore; motivo: 'casella' | 'carta' | 'tre_doppi' }
  | { tipo: 'prigione_fallita'; giocatore: IdGiocatore; tentativi: number }
  | { tipo: 'uscita_prigione'; giocatore: IdGiocatore; modo: 'doppio' | 'cauzione' | 'grazia' | 'tentativi' }
  | { tipo: 'vacanza'; giocatore: IdGiocatore; incasso: number }
  | { tipo: 'vendita'; giocatore: IdGiocatore; casella: number; importo: number }
  /** Non aveva abbastanza contante: `importo` è la parte che resta da dare. */
  | { tipo: 'debito'; da: IdGiocatore; a: IdGiocatore; importo: number }
  /** Parte di un debito saldata in automatico con un'entrata. */
  | { tipo: 'rimborso'; da: IdGiocatore; a: IdGiocatore; importo: number }
  /** `recuperi`: quanto la banca dà a ogni creditore, dal valore dei beni del fallito. */
  | { tipo: 'bancarotta'; giocatore: IdGiocatore; recuperi: Debito[] }
  | { tipo: 'fine'; vincitore: IdGiocatore | null };

export type TipoEvento = Evento['tipo'];

export type CodiceErrore =
  | 'partita_finita'
  | 'giocatore_sconosciuto'
  | 'eliminato'
  | 'non_tuo_turno'
  | 'gia_lanciato'
  | 'non_ancora_lanciato'
  | 'devi_rilanciare'
  | 'saldo_negativo'
  | 'soldi_insufficienti'
  | 'niente_da_comprare'
  | 'non_in_prigione'
  | 'niente_grazia'
  | 'non_tua'
  | 'edifici_nella_regione'
  | 'giocatori_non_validi';

export interface Errore {
  codice: CodiceErrore;
  messaggio: string;
}

export type Esito = { ok: true; stato: Stato; eventi: Evento[] } | ({ ok: false } & Errore);

/** Fonte di numeri casuali. Il server usa `crypto`, i test un generatore con seme. */
export interface Caso {
  /** Intero casuale tra 0 e `n - 1`. */
  intero(n: number): number;
}
