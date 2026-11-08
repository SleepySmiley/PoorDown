import type { Caso } from './tipi';

/**
 * Generatore ripetibile (mulberry32): stesso seme, stessa partita.
 * Va bene per test e simulazioni, non per le partite vere: lì il server usa `crypto`.
 */
export function casoDaSeme(seme: number): Caso {
  let a = seme >>> 0;
  return {
    intero(n) {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      const x = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      return Math.floor(x * n);
    },
  };
}

export function tiraDadi(caso: Caso): [number, number] {
  return [caso.intero(6) + 1, caso.intero(6) + 1];
}

/** Copia mescolata (Fisher–Yates). */
export function mescola<T>(elementi: readonly T[], caso: Caso): T[] {
  const copia = [...elementi];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = caso.intero(i + 1);
    [copia[i], copia[j]] = [copia[j]!, copia[i]!];
  }
  return copia;
}
