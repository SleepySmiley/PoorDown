import type { IdMappa, Tabellone } from '../tipi';
import { CLASSICO } from './classico';

export const TABELLONI: Readonly<Record<IdMappa, Tabellone>> = { classica: CLASSICO };

export function tabellone(mappa: IdMappa): Tabellone {
  return TABELLONI[mappa];
}
