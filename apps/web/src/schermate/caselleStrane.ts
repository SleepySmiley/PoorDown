/*
 * Giro del mondo: le tre caselle strane in scena. La regia (regia.ts) mette in `Scena.strana` quella che sta
 * succedendo, con la durata del motore (TEMPI.bermuda, TEMPI.antipodi, TEMPI.cambioData), e il tabellone la disegna
 * sulla pedina (SegniStrani.tsx):
 * - Triangolo delle Bermuda: la pedina gira nel vortice, sparisce e ricompare sulla casella a caso;
 * - Buca per l'altra parte del mondo: la pedina sprofonda, passa sotto il tabellone e sbuca sul lato opposto;
 * - Linea del cambio di data: sopra la pedina il calendario a palette gira di un giorno (poi si muove ancora).
 */

import type { IdGiocatore } from '@poordown/engine';

export type TipoStrano = 'bermuda' | 'antipodi' | 'cambio_data';

export interface CasellaStrana {
  /** La voce del registro: a ogni casella strana la scena rinasce. */
  n: number;
  tipo: TipoStrano;
  giocatore: IdGiocatore;
}

/** La classe della pedina sul tabellone durante la scena (i movimenti stanno in viaggi.css). */
export function classeStrana(tipo: TipoStrano): string {
  return `segnaposto--${tipo === 'cambio_data' ? 'cambio-data' : tipo}`;
}

const MESI = ['GEN', 'FEB', 'MAR', 'APR', 'MAG', 'GIU', 'LUG', 'AGO', 'SET', 'OTT', 'NOV', 'DIC'] as const;

export interface Data {
  /** Il giorno su due cifre, come sulle palette: «09». */
  giorno: string;
  mese: (typeof MESI)[number];
}

function data(d: Date): Data {
  return { giorno: String(d.getDate()).padStart(2, '0'), mese: MESI[d.getMonth()]! };
}

/** Il calendario della Linea del cambio di data: la data di oggi e quella di domani (anche a fine mese e a fine anno). */
export function giornoGuadagnato(oggi: Date): { prima: Data; dopo: Data } {
  const domani = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate() + 1);
  return { prima: data(oggi), dopo: data(domani) };
}
