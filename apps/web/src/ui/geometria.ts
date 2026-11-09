import type { CSSProperties } from 'react';
import { euro, proprietabile, type Tabellone } from '@poordown/engine';
import { variabili } from './utili';

/* ---------------- Geometria ----------------
   Una griglia quadrata: 11×11 per i tabelloni da 40 caselle, 13×13 per quello da 48.
   Gli angoli sono larghi `angolo` volte una casella normale (più stretti sul 13×13, così le caselle crescono).
   La griglia sta dentro una cornice (CORNICE) e le caselle sono separate da fughe (FUGA): i centri le contano.
   Partenza in alto a sinistra, si gira in senso orario. */

/** Proporzione degli angoli sul tabellone da 40 caselle. */
export const ANGOLO = 1.53;
/**
 * Sul 13×13 gli angoli sono un po' più stretti, così le caselle normali si allargano. Non di più: sotto 1,47
 * la corsia delle pedine tra il nome e il blocco del proprietario non ci sta più.
 */
const ANGOLO_13 = 1.47;
/** Larghezza del tabellone da 40 caselle, in caselle normali: serve a scalare le misure degli altri. */
const TOTALE_CLASSICO = 9 + ANGOLO * 2;

/** Una k (1 px a 820 px di lato, sul tabellone da 40 caselle) in percentuale del lato, prima della scala. */
export const K = 0.122;
/** Spessore della cornice del tabellone attorno alle caselle, in k. */
export const CORNICE = 5;
/** Fuga tra una casella e l'altra, in k. */
export const FUGA = 2.5;
/** Prigione: spessore della fascia «In visita» lungo i bordi esterni, in frazione dell'angolo. */
export const FASCIA_VISITA = 0.3;

export type Lato = 'alto' | 'destra' | 'basso' | 'sinistra' | 'angolo';

export interface Geometria {
  /** Caselle per lato, contando un angolo: 10 o 12. */
  lato: number;
  /** Quante caselle normali è largo un angolo (1,53 o 1,47). */
  angolo: number;
  /** Righe e colonne della griglia. */
  tracce: string;
  /** Una casella normale, in percentuale del tabellone (senza le fughe). */
  unita: number;
  /** Profondità delle caselle dei lati (= lato di un angolo), in percentuale del tabellone. */
  profondita: number;
  /** Cornice + profondità: dove comincia il centro, in percentuale del tabellone. */
  margine: number;
  /** Una k in percentuale del tabellone. */
  k: number;
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
  const angolo = L > 10 ? ANGOLO_13 : ANGOLO;
  const totale = L - 1 + angolo * 2;
  const scala = TOTALE_CLASSICO / totale;
  const k = K * scala;
  const cornice = CORNICE * k;
  const fuga = FUGA * k;
  // Lo spazio delle caselle, tolte cornice e fughe, diviso in parti uguali (gli angoli valgono `angolo` parti).
  const unita = (100 - 2 * cornice - L * fuga) / totale;
  const profondita = angolo * unita;

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
    if (i === 1) return cornice + profondita / 2;
    if (i === L + 1) return 100 - cornice - profondita / 2;
    return cornice + profondita + (i - 1) * fuga + (i - 2) * unita + unita / 2;
  };

  const geo: Geometria = {
    lato: L,
    angolo,
    tracce: `${angolo}fr repeat(${L - 1}, minmax(0, 1fr)) ${angolo}fr`,
    unita,
    profondita,
    margine: cornice + profondita,
    k,
    scala,
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
  return {
    classe: `scheda--popover scheda--da-${lato === 'angolo' ? 'alto' : lato}`,
    stile: variabili({ '--x': `${x}%`, '--y': `${y}%`, '--margine': `${geo.margine}%` }),
  };
}
