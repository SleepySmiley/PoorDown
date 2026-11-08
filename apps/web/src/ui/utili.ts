import type { CSSProperties } from 'react';

/** Passa variabili CSS personalizzate nello style di React. */
export function variabili(valori: Record<string, string>): CSSProperties {
  return valori as CSSProperties;
}

/** L'iniziale del nome per il disco della pedina (anche se il nome comincia con un'emoji). */
export function iniziale(nome: string): string {
  return Array.from(nome.trim())[0]?.toUpperCase() ?? '?';
}

/** 75000 → "1:15" (secondi arrotondati per eccesso, come in un conto alla rovescia). */
export function minutiSecondi(ms: number): string {
  const s = Math.ceil(Math.max(0, ms) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
