import type { CSSProperties } from 'react';
import { euro, proprietabile, type Tabellone } from '@poordown/engine';
import { variabili } from './utili';

/* ---------------- Geometria ----------------
   Una griglia quadrata: 11×11 per i tabelloni da 40 caselle, 13×13 per quello da 48.
   Gli angoli sono larghi ANGOLO volte una casella normale.
   Partenza in alto a sinistra, si gira in senso orario. */

/** Unica fonte della proporzione: la griglia del tabellone la riceve da qui. */
export const ANGOLO = 1.53;
/** Larghezza del tabellone da 40 caselle, in caselle normali: serve a scalare le misure degli altri. */
const TOTALE_CLASSICO = 9 + ANGOLO * 2;

export type Lato = 'alto' | 'destra' | 'basso' | 'sinistra' | 'angolo';

export interface Geometria {
  /** Caselle per lato, contando un angolo: 10 o 12. */
  lato: number;
  /** Righe e colonne della griglia. */
  tracce: string;
  /** Una casella normale, in percentuale del tabellone. */
  unita: number;
  /** Quanto sono piccole le caselle rispetto al tabellone da 40 (1 per quello): le misure interne si scalano così. */
  scala: number;
  /** Riga e colonna della casella nella griglia (da 1), e il lato su cui sta. */
  posto(n: number): { riga: number; colonna: number; lato: Lato };
  /** Centro della casella, in percentuale del tabellone. */
  centro(n: number): { x: number; y: number };
}

const CACHE = new Map<number, Geometria>();

/** La geometria di un tabellone con `caselle` caselle (un multiplo di 4). */
export function geometria(caselle: number): Geometria {
  const salvata = CACHE.get(caselle);
  if (salvata) return salvata;
  const L = caselle / 4;
  const totale = L - 1 + ANGOLO * 2;

  const posto = (n: number): { riga: number; colonna: number; lato: Lato } => {
    if (n === 0) return { riga: 1, colonna: 1, lato: 'angolo' };
    if (n < L) return { riga: 1, colonna: n + 1, lato: 'alto' };
    if (n === L) return { riga: 1, colonna: L + 1, lato: 'angolo' };
    if (n < 2 * L) return { riga: n - L + 1, colonna: L + 1, lato: 'destra' };
    if (n === 2 * L) return { riga: L + 1, colonna: L + 1, lato: 'angolo' };
    if (n < 3 * L) return { riga: L + 1, colonna: L + 1 - (n - 2 * L), lato: 'basso' };
    if (n === 3 * L) return { riga: L + 1, colonna: 1, lato: 'angolo' };
    return { riga: L + 1 - (n - 3 * L), colonna: 1, lato: 'sinistra' };
  };

  /** Centro di una riga o colonna della griglia, in percentuale del tabellone. */
  const centroTraccia = (i: number): number => {
    if (i === 1) return (ANGOLO / 2 / totale) * 100;
    if (i === L + 1) return ((totale - ANGOLO / 2) / totale) * 100;
    return ((ANGOLO + i - 1.5) / totale) * 100;
  };

  const geo: Geometria = {
    lato: L,
    tracce: `${ANGOLO}fr repeat(${L - 1}, minmax(0, 1fr)) ${ANGOLO}fr`,
    unita: 100 / totale,
    scala: TOTALE_CLASSICO / totale,
    posto,
    centro(n) {
      const { riga, colonna } = posto(n);
      return { x: centroTraccia(colonna), y: centroTraccia(riga) };
    },
  };
  CACHE.set(caselle, geo);
  return geo;
}

const NOMI_LIVELLI = ['Affitto', 'Con 1 casa', 'Con 2 case', 'Con 3 case', 'Con 4 case', 'Con l’albergo'];

/** Righe "Quando / Incassi" della scheda di una proprietà. */
export function righeAffitto(tab: Tabellone, n: number): [string, string][] {
  const c = proprietabile(tab, n);
  if (!c) return [];
  switch (c.tipo) {
    case 'citta':
      return c.affitti.map((v, i): [string, string] => [NOMI_LIVELLI[i] ?? '', euro(v)]);
    case 'stazione':
      return tab.affittiStazioni.map((v, i): [string, string] => [
        i === 0 ? 'Con 1 stazione' : `Con ${i + 1} stazioni`,
        euro(v),
      ]);
    case 'servizio':
      return tab.moltiplicatoriServizi
        .slice(0, tab.caselle.filter((x) => x.tipo === 'servizio').length)
        .map((m, i): [string, string] => [i === 0 ? 'Con 1 servizio' : `Con ${i + 1} servizi`, `${m} × dadi`]);
  }
}

/** Posizione della scheda aperta accanto alla casella, verso il centro del tabellone. */
export function stilePopover(n: number, caselle: number): { classe: string; stile: CSSProperties } {
  const geo = geometria(caselle);
  const { lato } = geo.posto(n);
  const { x, y } = geo.centro(n);
  const bordo = `${ANGOLO * geo.unita}%`;
  return {
    classe: `scheda--popover scheda--da-${lato === 'angolo' ? 'alto' : lato}`,
    stile: variabili({ '--x': `${x}%`, '--y': `${y}%`, '--margine': bordo }),
  };
}
