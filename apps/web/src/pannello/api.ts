/*
 * Le chiamate del pannello di controllo al server (/api/pannello). La sessione resta in sessionStorage:
 * vale per questa scheda del browser e sparisce quando la si chiude.
 */

import type { ComandoPannello, DettaglioPannello, StanzaNelPannello, StatoAccessoPannello } from '@poordown/engine';

const CHIAVE = 'poordown:pannello';

/** Errore di una chiamata: `stato` è il codice HTTP, 0 se il server non risponde. */
export class ErroreApi extends Error {
  constructor(
    messaggio: string,
    readonly stato: number,
  ) {
    super(messaggio);
  }
}

export function messaggioErrore(errore: unknown): string {
  return errore instanceof Error ? errore.message : 'Qualcosa è andato storto.';
}

function sessione(): string | null {
  try {
    return sessionStorage.getItem(CHIAVE);
  } catch {
    return null;
  }
}

function ricordaSessione(valore: string | null): void {
  try {
    if (valore === null) sessionStorage.removeItem(CHIAVE);
    else sessionStorage.setItem(CHIAVE, valore);
  } catch {
    // Senza sessionStorage (alcune finestre private) la sessione non si ricorda: il pannello chiede di rientrare.
  }
}

const ascoltatoriUscita = new Set<() => void>();

/** Avvisa quando il server non riconosce più la sessione (scaduta, server riacceso). */
export function quandoScade(fn: () => void): () => void {
  ascoltatoriUscita.add(fn);
  return () => ascoltatoriUscita.delete(fn);
}

async function chiama<T>(metodo: 'GET' | 'POST', percorso: string, corpo?: unknown): Promise<T> {
  const intestazioni: Record<string, string> = {};
  const s = sessione();
  if (s) intestazioni.Authorization = `Bearer ${s}`;
  if (corpo !== undefined) intestazioni['Content-Type'] = 'application/json';
  let risposta: Response;
  try {
    risposta = await fetch(`/api/pannello${percorso}`, {
      method: metodo,
      headers: intestazioni,
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
      cache: 'no-store',
    });
  } catch {
    throw new ErroreApi('Il server non risponde: è ancora acceso?', 0);
  }
  const dati: unknown = await risposta.json().catch(() => null);
  if (!risposta.ok) {
    const messaggio =
      typeof dati === 'object' && dati !== null && 'messaggio' in dati && typeof dati.messaggio === 'string'
        ? dati.messaggio
        : 'Qualcosa è andato storto.';
    if (risposta.status === 401 && percorso !== '/entra') {
      ricordaSessione(null);
      for (const fn of ascoltatoriUscita) fn();
    }
    throw new ErroreApi(messaggio, risposta.status);
  }
  return dati as T;
}

export const api = {
  stato: () => chiama<StatoAccessoPannello>('GET', '/stato'),
  async entra(nome: string, password: string): Promise<void> {
    const { sessione: nuova } = await chiama<{ sessione: string }>('POST', '/entra', { nome, password });
    ricordaSessione(nuova);
  },
  async esci(): Promise<void> {
    await chiama('POST', '/esci').catch(() => {});
    ricordaSessione(null);
  },
  stanze: () => chiama<StanzaNelPannello[]>('GET', '/stanze'),
  stanza: (codice: string) => chiama<DettaglioPannello>('GET', `/stanze/${codice}`),
  comando: (codice: string, comando: ComandoPannello) => chiama<DettaglioPannello>('POST', `/stanze/${codice}/comando`, comando),
  annulla: (codice: string) => chiama<DettaglioPannello>('POST', `/stanze/${codice}/annulla`),
  chiudi: (codice: string) => chiama<{ ok: true }>('POST', `/stanze/${codice}/chiudi`),
};
