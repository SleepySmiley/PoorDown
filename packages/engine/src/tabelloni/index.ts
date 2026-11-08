import type { IdMappa, Tabellone } from '../tipi';
import { CLASSICO } from './classico';
import { EUROPA } from './europa';
import { FORTUNA } from './fortuna';
import { GRANDI_AREE } from './grandi-aree';

/** I tabelloni nell'ordine in cui si scelgono in lobby. */
export const TABELLONI: Readonly<Record<IdMappa, Tabellone>> = {
  classica: CLASSICO,
  europa: EUROPA,
  grandi_aree: GRANDI_AREE,
  fortuna: FORTUNA,
};

export function tabellone(mappa: IdMappa): Tabellone {
  return TABELLONI[mappa];
}
