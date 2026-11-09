/*
 * Lettura dei dati che arrivano dai browser. Non ci si fida di niente: ogni campo viene controllato
 * e si costruisce un oggetto nuovo, così i campi in più non passano.
 */

import {
  GIOCATORI_MAX,
  GIOCATORI_MIN,
  NOTA_MAX,
  SOLDI_INIZIALI_POSSIBILI,
  TABELLONI,
  type Attivita,
  type Impostazioni,
  type Mossa,
  type NomeMazzo,
  type Pacchetto,
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
  durataMassima: (v) => typeof v === 'boolean',
  ordineCasuale: (v) => typeof v === 'boolean',
  squadre: (v) => typeof v === 'boolean',
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
/** Più di quanto serva in qualunque partita: tiene lontani i numeri assurdi. */
const SOLDI_MAX = 10_000_000;
const CASELLE_MAX = 64;

function interoTra(valore: unknown, min: number, max: number): valore is number {
  return typeof valore === 'number' && Number.isInteger(valore) && valore >= min && valore <= max;
}

/** Una parte di uno scambio. Le caselle ripetute si contano una volta sola. */
export function leggiPacchetto(dati: unknown): Pacchetto | null {
  const o = oggetto(dati);
  if (!o) return null;
  const { soldi, caselle, grazie } = o;
  if (!interoTra(soldi, 0, SOLDI_MAX)) return null;
  if (!Array.isArray(caselle) || caselle.length > CASELLE_MAX || !caselle.every((c) => interoTra(c, 0, CASELLE_MAX))) {
    return null;
  }
  if (!Array.isArray(grazie) || grazie.length > MAZZI.length || !grazie.every((m) => MAZZI.includes(m as NomeMazzo))) {
    return null;
  }
  return { soldi, caselle: [...new Set(caselle as number[])], grazie: grazie as NomeMazzo[] };
}

/** Azione di gioco. Che sia permessa adesso lo decide il motore. */
export function leggiMossa(dati: unknown): Mossa | null {
  const o = oggetto(dati);
  const tipo = o?.tipo;
  switch (tipo) {
    case 'lancia':
    case 'compra':
    case 'fine_turno':
    case 'paga_cauzione':
    case 'asta':
    case 'bancarotta':
    case 'chiedi_tempo':
    case 'regala_tempo':
      return { tipo };
    case 'vota': {
      const favorevole = booleano(dati, 'favorevole');
      return favorevole === null ? null : { tipo, favorevole };
    }
    case 'usa_grazia': {
      const mazzo = o?.mazzo;
      if (mazzo === undefined) return { tipo };
      return MAZZI.includes(mazzo as NomeMazzo) ? { tipo, mazzo: mazzo as NomeMazzo } : null;
    }
    case 'vendi':
    case 'costruisci':
    case 'demolisci':
    case 'ipoteca':
    case 'riscatta': {
      const casella = intero(dati, 'casella');
      return casella === null ? null : { tipo, casella };
    }
    case 'offri': {
      const importo = o?.importo;
      return interoTra(importo, 1, SOLDI_MAX) ? { tipo, importo } : null;
    }
    case 'accetta':
    case 'rifiuta':
    case 'annulla': {
      const scambio = intero(dati, 'scambio');
      return scambio === null ? null : { tipo, scambio };
    }
    case 'proponi': {
      const a = testo(dati, 'a', 64);
      const nota = o?.nota === undefined ? '' : testo(dati, 'nota', NOTA_MAX * 4);
      const dare = leggiPacchetto(o?.dare);
      const avere = leggiPacchetto(o?.avere);
      const sostituisce = o?.sostituisce;
      if (a === null || nota === null || !dare || !avere) return null;
      if (sostituisce === undefined) return { tipo, a, dare, avere, nota };
      return interoTra(sostituisce, 0, Number.MAX_SAFE_INTEGER) ? { tipo, a, dare, avere, nota, sostituisce } : null;
    }
    default:
      return null;
  }
}

/** Cosa sta facendo il giocatore con gli scambi; `undefined` se i dati non sono validi. */
export function leggiAttivita(dati: unknown): Attivita | null | undefined {
  if (dati === null) return null;
  const o = oggetto(dati);
  switch (o?.tipo) {
    case 'crea':
      return { tipo: 'crea' };
    case 'guarda':
    case 'tratta': {
      const scambio = intero(dati, 'scambio');
      return scambio === null ? undefined : { tipo: o.tipo, scambio };
    }
    default:
      return undefined;
  }
}
