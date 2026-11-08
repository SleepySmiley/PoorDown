/* Avvisi a comparsa in basso al centro: errori dei comandi, stanza non trovata, espulsione… */

export type TipoAvviso = 'info' | 'errore';

export interface Avviso {
  id: number;
  testo: string;
  tipo: TipoAvviso;
}

const DURATA_MS = 5_000;

let avvisi: Avviso[] = [];
let prossimo = 1;
const ascoltatori = new Set<() => void>();

function cambia(nuovi: Avviso[]): void {
  avvisi = nuovi;
  for (const fn of ascoltatori) fn();
}

export function chiudiAvviso(id: number): void {
  cambia(avvisi.filter((a) => a.id !== id));
}

/** Mostra un avviso per qualche secondo. Lo stesso testo non compare due volte insieme. */
export function avvisa(testo: string, tipo: TipoAvviso = 'info'): void {
  const id = prossimo++;
  cambia([...avvisi.filter((a) => a.testo !== testo), { id, testo, tipo }].slice(-3));
  setTimeout(() => chiudiAvviso(id), tipo === 'errore' ? DURATA_MS + 1_500 : DURATA_MS);
}

export function ascoltaAvvisi(fn: () => void): () => void {
  ascoltatori.add(fn);
  return () => ascoltatori.delete(fn);
}

export function leggiAvvisi(): readonly Avviso[] {
  return avvisi;
}
