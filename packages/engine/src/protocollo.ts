/** Risposta di GET /api/info. */
export interface InfoServer {
  nome: string;
  versione: string;
  /** Indirizzi da dare agli amici, il più probabile per primo (es. "http://192.168.1.23:3000"). */
  indirizzi: string[];
}

/** Eventi che il server invia ai browser. */
export interface EventiServer {
  /** Quanti browser sono collegati in questo momento. */
  presenze: (browser: number) => void;
}

/** Eventi che i browser inviano al server. */
export type EventiClient = Record<string, never>;
