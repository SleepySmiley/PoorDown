/*
 * Lettura dei dati che arrivano dai browser. Non ci si fida di niente: ogni campo viene controllato
 * e si costruisce un oggetto nuovo, così i campi in più non passano.
 */

import {
  GIOCATORI_MAX,
  GIOCATORI_MIN,
  SOLDI_INIZIALI_POSSIBILI,
  TABELLONI,
  type Impostazioni,
  type Mossa,
  type NomeMazzo,
} from '@poordown/engine';

type Oggetto = Record<string, unknown>;

export function oggetto(dati: unknown): Oggetto | null {
  return typeof dati === 'object' && dati !== null && !Array.isArray(dati) ? (dati as Oggetto) : null;
}

export function testo(dati: unknown, campo: string, max: number): string | null {
  const valore = oggetto(dati)?.[campo];
  return typeof valore === 'string' && valore.length <= max ? valore : null;
}

export function intero(dati: unknown, campo: string): number | null {
  const valore = oggetto(dati)?.[campo];
  return typeof valore === 'number' && Number.isInteger(valore) ? valore : null;
}

export function booleano(dati: unknown, campo: string): boolean | null {
  const valore = oggetto(dati)?.[campo];
  return typeof valore === 'boolean' ? valore : null;
}

/** Token del browser: lungo abbastanza da non essere indovinato, corto abbastanza da non pesare. */
export function leggiToken(valore: unknown): string | null {
  return typeof valore === 'string' && /^[A-Za-z0-9_-]{16,128}$/.test(valore) ? valore : null;
}

const CONTROLLI_IMPOSTAZIONI: { [K in keyof Impostazioni]: (v: unknown) => boolean } = {
  giocatoriMax: (v) => typeof v === 'number' && Number.isInteger(v) && v >= GIOCATORI_MIN && v <= GIOCATORI_MAX,
  stanzaPrivata: (v) => typeof v === 'boolean',
  bot: (v) => typeof v === 'boolean',
  mappa: (v) => typeof v === 'string' && Object.hasOwn(TABELLONI, v),
  affittoDoppioSetCompleto: (v) => typeof v === 'boolean',
  cassaVacanza: (v) => typeof v === 'boolean',
  aste: (v) => typeof v === 'boolean',
  nienteAffittoInPrigione: (v) => typeof v === 'boolean',
  ipoteche: (v) => typeof v === 'boolean',
  costruzioneUniforme: (v) => typeof v === 'boolean',
  soldiIniziali: (v) => (SOLDI_INIZIALI_POSSIBILI as readonly unknown[]).includes(v),
  timerTurno: (v) => typeof v === 'boolean',
  ordineCasuale: (v) => typeof v === 'boolean',
};

/** Modifiche parziali alle impostazioni. `null` se c'è un campo sconosciuto o un valore fuori dai limiti. */
export function leggiImpostazioni(dati: unknown): Partial<Impostazioni> | null {
  const o = oggetto(dati);
  if (!o) return null;
  const risultato: Record<string, unknown> = {};
  for (const [campo, valore] of Object.entries(o)) {
    if (!Object.hasOwn(CONTROLLI_IMPOSTAZIONI, campo)) return null;
    if (!CONTROLLI_IMPOSTAZIONI[campo as keyof Impostazioni](valore)) return null;
    risultato[campo] = valore;
  }
  return risultato as Partial<Impostazioni>;
}

const MAZZI: readonly NomeMazzo[] = ['busta', 'cartolina'];

/** Azione di gioco. Che sia permessa adesso lo decide il motore. */
export function leggiMossa(dati: unknown): Mossa | null {
  const tipo = oggetto(dati)?.tipo;
  switch (tipo) {
    case 'lancia':
    case 'compra':
    case 'fine_turno':
    case 'paga_cauzione':
    case 'bancarotta':
      return { tipo };
    case 'usa_grazia': {
      const mazzo = oggetto(dati)?.mazzo;
      if (mazzo === undefined) return { tipo };
      return MAZZI.includes(mazzo as NomeMazzo) ? { tipo, mazzo: mazzo as NomeMazzo } : null;
    }
    case 'vendi': {
      const casella = intero(dati, 'casella');
      return casella === null ? null : { tipo, casella };
    }
    default:
      return null;
  }
}
