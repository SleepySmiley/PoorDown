/* Il pittogramma di ogni faccia del dado cosmico (regole folli del Sistema solare): sul terzo dado, nel suo riquadro e nelle schede. */

import type { FacciaCosmica } from '@poordown/engine';
import type { NomeIcona } from './icone';

export const ICONA_FACCIA: Record<FacciaCosmica, NomeIcona> = {
  razzo: 'razzo',
  saldi: 'percento',
  bandiera: 'bandiera',
  scudo: 'scudo',
  faro: 'faro',
  iperspazio: 'fulmine',
};
