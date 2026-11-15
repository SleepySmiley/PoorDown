import type { IdMappa, Tabellone } from '../tipi';
import { CLASSICO } from './classico';
import { EUROPA } from './europa';
import { FORTUNA } from './fortuna';
import { GRANDI_AREE } from './grandi-aree';
import { SISTEMA_SOLARE } from './sistema-solare';

/** I tabelloni nell'ordine in cui si scelgono in lobby. */
export const TABELLONI: Readonly<Record<IdMappa, Tabellone>> = {
  classica: CLASSICO,
  europa: EUROPA,
  grandi_aree: GRANDI_AREE,
  fortuna: FORTUNA,
  sistema_solare: SISTEMA_SOLARE,
};

export function tabellone(mappa: IdMappa): Tabellone {
  return TABELLONI[mappa];
}
