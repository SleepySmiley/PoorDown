import type { CSSProperties } from 'react';

/** Passa variabili CSS personalizzate nello style di React. */
export function variabili(valori: Record<string, string>): CSSProperties {
  return valori as CSSProperties;
}

/** L'iniziale del nome per il disco della pedina (anche se il nome comincia con un'emoji). */
export function iniziale(nome: string): string {
  return Array.from(nome.trim())[0]?.toUpperCase() ?? '?';
}

/**
 * Le iniziali di tutti i giocatori, distinte: chi ha la stessa iniziale di un altro prende anche la prima
 * lettera del nome che lo distingue (Carlo e Cosimo → «Ca» e «Co»; Carla e Carlo → «Ca» e «Co»… se serve
 * si va avanti nel nome: Marta e Mara → «Mt» e «Ma»). Se due nomi non si distinguono, un numero.
 * Va calcolata su tutti i giocatori della partita, anche quelli usciti, così le iniziali non cambiano.
 */
export function iniziali<Id>(giocatori: readonly { id: Id; nome: string }[]): Map<Id, string> {
  const gruppi = new Map<string, { id: Id; lettere: string[] }[]>();
  for (const g of giocatori) {
    const lettere = Array.from(g.nome.trim()).filter((c) => !/[\s\p{P}]/u.test(c));
    const prima = iniziale(g.nome);
    gruppi.set(prima, [...(gruppi.get(prima) ?? []), { id: g.id, lettere }]);
  }
  const risultato = new Map<Id, string>();
  for (const [prima, gruppo] of gruppi) {
    if (gruppo.length === 1) {
      risultato.set(gruppo[0]!.id, prima);
      continue;
    }
    const usate = new Set<string>();
    gruppo.forEach((g, indice) => {
      const altre = gruppo.filter((x) => x !== g);
      const candidate = g.lettere.slice(1).map((c, i) => ({ coppia: prima + c.toLowerCase(), posto: i + 1 }));
      // La prima lettera che gli altri non hanno nello stesso posto del nome, poi una qualsiasi ancora libera.
      const scelta =
        candidate.find(
          ({ coppia, posto }) =>
            !usate.has(coppia) && !altre.some((x) => x.lettere[posto]?.toLowerCase() === coppia.slice(prima.length)),
        )?.coppia ??
        candidate.find(({ coppia }) => !usate.has(coppia))?.coppia ??
        `${prima}${indice + 1}`;
      usate.add(scelta);
      risultato.set(g.id, scelta);
    });
  }
  return risultato;
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
