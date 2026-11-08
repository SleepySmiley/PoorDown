import type { CSSProperties } from 'react';
import { affitti, euro, type Casella } from './dati';
import { variabili } from './utili';

/* ---------------- Geometria ----------------
   11×11 caselle: angoli larghi ANGOLO volte una casella normale.
   Partenza in alto a sinistra, si gira in senso orario. */

/** Unica fonte della proporzione: la griglia del tabellone la riceve da qui. */
export const ANGOLO = 1.53;
const TOTALE = 9 + ANGOLO * 2;

export type Lato = 'alto' | 'destra' | 'basso' | 'sinistra' | 'angolo';

export function posto(n: number): { riga: number; colonna: number; lato: Lato } {
  if (n === 0) return { riga: 1, colonna: 1, lato: 'angolo' };
  if (n < 10) return { riga: 1, colonna: n + 1, lato: 'alto' };
  if (n === 10) return { riga: 1, colonna: 11, lato: 'angolo' };
  if (n < 20) return { riga: n - 9, colonna: 11, lato: 'destra' };
  if (n === 20) return { riga: 11, colonna: 11, lato: 'angolo' };
  if (n < 30) return { riga: 11, colonna: 11 - (n - 20), lato: 'basso' };
  if (n === 30) return { riga: 11, colonna: 1, lato: 'angolo' };
  return { riga: 11 - (n - 30), colonna: 1, lato: 'sinistra' };
}

/** Centro di una riga o colonna della griglia, in percentuale del tabellone. */
function centroTraccia(i: number): number {
  if (i === 1) return (ANGOLO / 2 / TOTALE) * 100;
  if (i === 11) return ((TOTALE - ANGOLO / 2) / TOTALE) * 100;
  return ((ANGOLO + i - 1.5) / TOTALE) * 100;
}

export function centroCasella(n: number): { x: number; y: number } {
  const { riga, colonna } = posto(n);
  return { x: centroTraccia(colonna), y: centroTraccia(riga) };
}

export const UNITA = 100 / TOTALE;

export function righeAffitto(c: Casella): [string, string][] {
  if (c.tipo === 'stazione') {
    return [
      ['Con 1 stazione', euro(25)],
      ['Con 2 stazioni', euro(50)],
      ['Con 3 stazioni', euro(100)],
      ['Con 4 stazioni', euro(200)],
    ];
  }
  if (c.tipo === 'servizio') {
    return [
      ['Con 1 servizio', '4 × dadi'],
      ['Con 2 servizi', '10 × dadi'],
    ];
  }
  const [base = 0, ...case_] = affitti(c.prezzo ?? 0);
  const nomi = ['Con 1 casa', 'Con 2 case', 'Con 3 case', 'Con 4 case', 'Con l’albergo'];
  return [['Affitto', euro(base)], ...case_.map((v, i): [string, string] => [nomi[i] ?? '', euro(v)])];
}

/** Posizione della scheda aperta accanto alla casella, verso il centro del tabellone. */
export function stilePopover(n: number): { classe: string; stile: CSSProperties } {
  const { lato } = posto(n);
  const { x, y } = centroCasella(n);
  const bordo = `${(ANGOLO / TOTALE) * 100}%`;
  return {
    classe: `scheda--popover scheda--da-${lato === 'angolo' ? 'alto' : lato}`,
    stile: variabili({ '--x': `${x}%`, '--y': `${y}%`, '--bordo': bordo }),
  };
}
