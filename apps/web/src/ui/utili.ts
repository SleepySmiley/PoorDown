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

/** Sfasatura tra le palette che girano insieme, da destra verso sinistra. */
export const SFASATURA_PALETTE_MS = 30;

/** Caratteri stampati tra le palette (punto delle migliaia, due punti dell'ora): non girano. */
export const SEPARATORE_PALETTE = /^[.:,]$/;

/**
 * Il ritardo di ogni carattere di `dopo` quando il testo a palette passa da `prima` a `dopo`.
 * I testi si allineano da destra (le cifre restano in colonna anche se il numero si allunga);
 * la prima paletta che cambia parte subito, le altre una ogni 30 ms verso sinistra.
 */
export function ritardiPalette(prima: string, dopo: string): number[] {
  const a = [...prima];
  const b = [...dopo];
  const ritardi = b.map(() => 0);
  let quante = 0;
  for (let i = b.length - 1, j = a.length - 1; i >= 0; i--, j--) {
    if (SEPARATORE_PALETTE.test(b[i]!)) continue;
    if (b[i] !== a[j]) ritardi[i] = quante++ * SFASATURA_PALETTE_MS;
  }
  return ritardi;
}
