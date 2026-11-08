/*
 * Le durate delle scene della partita, in un posto solo.
 * Le legge la regia del browser (apps/web/src/schermate/regia.ts), che mette in scena gli eventi uno dopo l'altro,
 * e le legge il server con `durataScena` (bot.ts), che fa aspettare i bot finché le animazioni non sono finite.
 * Cambiando un numero qui cambiano tutti e due: browser e bot restano sempre allineati.
 */

import type { Evento } from './tipi';

export const TEMPI = {
  /** Quanto resta una faccia dei dadi mentre rotolano. */
  facciaDado: 95,
  /** Quante facce mostrano i dadi prima di fermarsi. */
  facceDado: 7,
  /** Pausa con i dadi fermi, prima che la pedina parta. */
  dadiFermi: 150,
  /** Qualche millisecondo in più che il server conta sui dadi: così il bot non anticipa mai l'animazione. */
  margineDadi: 5,
  /** Un passo della pedina, da una casella alla successiva. */
  passo: 180,
  /** Pausa quando la pedina è arrivata. */
  fineMovimento: 200,
  /** Salto in prigione. */
  prigione: 450,
  /** Carta pescata: il tempo di leggerla. */
  carta: 600,
  /** Acquisti, affitti, tasse e gli altri eventi da leggere: una pausa breve. */
  pausa: 250,
} as const;

/** Gli eventi che fermano la scena per `TEMPI.pausa`, giusto il tempo di leggerli. */
export const EVENTI_CON_PAUSA: ReadonlySet<Evento['tipo']> = new Set<Evento['tipo']>([
  'acquisto',
  'asta_vinta',
  'costruzione',
  'affitto',
  'tassa',
  'premio',
  'partenza',
  'prigione_fallita',
  'vacanza',
]);

/** Il rotolamento dei dadi, dal primo lancio alla pausa con i dadi fermi. */
export const DADI_MS = TEMPI.facceDado * TEMPI.facciaDado + TEMPI.dadiFermi;

/**
 * Quante caselle percorre la pedina e in che verso. Le carte "Torna indietro di 3 caselle"
 * sono l'unico spostamento all'indietro.
 */
export function percorso(e: { da: number; a: number; dadi?: [number, number] }, caselle: number): { passi: number; verso: 1 | -1 } {
  const avanti = (e.a - e.da + caselle) % caselle;
  const indietro = (e.da - e.a + caselle) % caselle;
  return !e.dadi && indietro < avanti && indietro <= 3 ? { passi: indietro, verso: -1 } : { passi: avanti, verso: 1 };
}

/** Quanto dura sullo schermo la scena di un evento (0 se non ne ha una che ferma il gioco). */
export function durataEvento(e: Evento, caselle: number): number {
  switch (e.tipo) {
    case 'dadi':
      return DADI_MS + TEMPI.margineDadi;
    case 'movimento':
      return percorso(e, caselle).passi * TEMPI.passo + TEMPI.fineMovimento;
    case 'prigione':
      return TEMPI.prigione;
    case 'carta':
      return TEMPI.carta;
    default:
      return EVENTI_CON_PAUSA.has(e.tipo) ? TEMPI.pausa : 0;
  }
}
