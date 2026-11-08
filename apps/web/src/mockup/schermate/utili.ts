import type { CSSProperties } from 'react';

/** Passa variabili CSS personalizzate nello style di React. */
export function variabili(valori: Record<string, string>): CSSProperties {
  return valori as CSSProperties;
}
