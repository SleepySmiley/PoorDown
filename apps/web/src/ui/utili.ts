import type { CSSProperties } from 'react';

/** Passa variabili CSS personalizzate nello style di React. */
export function variabili(valori: Record<string, string>): CSSProperties {
  return valori as CSSProperties;
}

/** L'iniziale del nome per il disco della pedina (anche se il nome comincia con un'emoji). */
export function iniziale(nome: string): string {
  return Array.from(nome.trim())[0]?.toUpperCase() ?? '?';
}
