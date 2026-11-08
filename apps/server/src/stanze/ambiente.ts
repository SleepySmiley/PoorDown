import { randomBytes, randomInt } from 'node:crypto';
import type { Caso } from '@poordown/engine';

/** Orologio e caso: quelli veri sul server, finti nei test. */
export interface Ambiente {
  adesso(): number;
  caso: Caso;
}

export const AMBIENTE_REALE: Ambiente = {
  adesso: () => Date.now(),
  caso: { intero: (n) => randomInt(n) },
};

/** Identificativo pubblico di un giocatore (8 caratteri). Diverso dal token, che resta segreto. */
export function nuovoId(): string {
  return randomBytes(6).toString('base64url');
}
