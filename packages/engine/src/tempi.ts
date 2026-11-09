/*
 * Le durate delle scene della partita, in un posto solo.
 * Le legge la regia del browser (apps/web/src/schermate/regia.ts), che mette in scena gli eventi uno dopo l'altro,
 * e le legge il server con `durataScena` (bot.ts), che fa aspettare i bot finché le animazioni non sono finite.
 * Cambiando un numero qui cambiano tutti e due: browser e bot restano sempre allineati.
 * Quello che va in parallelo (gettoni che volano, saldi, caselle che lampeggiano, cartello del turno) non ferma
 * il gioco e qui non c'è.
 */

import type { Evento } from './tipi';

export const TEMPI = {
  /** Quanto resta ogni faccia dei dadi mentre rotolano: sempre di più, come dadi che rallentano e si fermano. */
  facceDado: [50, 55, 65, 75, 90, 110, 135],
  /** Dadi fermi: atterrano, compaiono il totale (e «Doppio») e si accende la casella d'arrivo. Poi parte la pedina. */
  dadiFermi: 235,
  /** Qualche millisecondo in più che il server conta sui dadi: così il bot non anticipa mai l'animazione. */
  margineDadi: 5,
  /** I primi due e gli ultimi due passi della pedina: partenza e frenata. */
  passoLento: 190,
  /** I passi in mezzo, più svelti. */
  passoSvelto: 140,
  /** Tetto al viaggio della pedina (i passi, senza la pausa all'arrivo): oltre, i passi in mezzo accelerano. */
  viaggioMax: 2200,
  /** Pausa quando la pedina è arrivata: si schiaccia e manda un'onda del suo colore. */
  fineMovimento: 200,
  /** Il volo in prigione: la pedina trema, si solleva, vola ad arco e le sbarre scendono. */
  prigione: 1150,
  /** La carta pescata esce dalla casella e arriva al centro girandosi. */
  cartaEntra: 400,
  /** Il tempo di leggerla: tanto per carattere, tra un minimo e un massimo. */
  cartaPerCarattere: 40,
  cartaMin: 1000,
  cartaMax: 1800,
  /** Poi rimpicciolisce verso la scheda dell'ultimo evento, e parte il suo effetto. */
  cartaEsce: 200,
  /** Eventi da leggere senza soldi (prigione fallita, vacanza): una pausa breve. */
  pausa: 250,
  /** Eventi con soldi che passano di mano (affitto, tassa, acquisto…): il tempo del gettone che vola. */
  pausaSoldi: 450,
  /** Bancarotta o uscita dalla partita: il saldo diventa «Bancarotta», la pedina sprofonda, i blocchi si sfilano. */
  bancarotta: 1600,
  /** Un respiro tra l'ultima bancarotta e la schermata di fine partita. */
  fine: 500,
} as const;

/** Gli eventi che fermano la scena per `TEMPI.pausa`, giusto il tempo di leggerli. */
export const EVENTI_CON_PAUSA: ReadonlySet<Evento['tipo']> = new Set<Evento['tipo']>(['prigione_fallita', 'vacanza']);

/**
 * Gli eventi con soldi che passano di mano: fermano la scena per `TEMPI.pausaSoldi`, mentre il gettone vola.
 * La Partenza solo quando ci si ferma sopra: passandoci, il gettone parte mentre la pedina cammina.
 */
export const EVENTI_CON_SOLDI: ReadonlySet<Evento['tipo']> = new Set<Evento['tipo']>([
  'acquisto',
  'asta_vinta',
  'costruzione',
  'affitto',
  'tassa',
  'premio',
]);

/** Il rotolamento dei dadi, dal primo lancio alla pausa con i dadi fermi. */
export const DADI_MS = TEMPI.facceDado.reduce((t, ms) => t + ms, 0) + TEMPI.dadiFermi;

/**
 * Quante caselle percorre la pedina e in che verso. Le carte "Torna indietro di 3 caselle"
 * sono l'unico spostamento all'indietro.
 */
export function percorso(e: { da: number; a: number; dadi?: [number, number] }, caselle: number): { passi: number; verso: 1 | -1 } {
  const avanti = (e.a - e.da + caselle) % caselle;
  const indietro = (e.da - e.a + caselle) % caselle;
  return !e.dadi && indietro < avanti && indietro <= 3 ? { passi: indietro, verso: -1 } : { passi: avanti, verso: 1 };
}

/**
 * Quanto dura ogni passo della pedina: i primi due e gli ultimi due lenti, quelli in mezzo svelti.
 * I viaggi lunghi («Vai a Siena», 28 caselle) non superano `TEMPI.viaggioMax`: accelerano i passi in mezzo.
 */
export function passiPedina(passi: number): number[] {
  const lento = (i: number) => i < 2 || i >= passi - 2;
  const tempi = Array.from({ length: passi }, (_, i) => (lento(i) ? TEMPI.passoLento : TEMPI.passoSvelto));
  if (tempi.reduce((t, ms) => t + ms, 0) <= TEMPI.viaggioMax) return tempi;
  const inMezzo = passi - 4;
  const svelto = Math.floor((TEMPI.viaggioMax - 4 * TEMPI.passoLento) / inMezzo);
  return tempi.map((ms, i) => (lento(i) ? ms : svelto));
}

/** Quanto resta in vista la carta pescata, dall'uscita dalla casella al ritorno nella scheda dell'evento. */
export function durataCarta(testo: string): number {
  const lettura = Math.min(TEMPI.cartaMax, Math.max(TEMPI.cartaMin, testo.length * TEMPI.cartaPerCarattere));
  return TEMPI.cartaEntra + lettura + TEMPI.cartaEsce;
}

/** Quanto dura sullo schermo la scena di un evento (0 se non ne ha una che ferma il gioco). */
export function durataEvento(e: Evento, caselle: number): number {
  switch (e.tipo) {
    case 'dadi':
      return DADI_MS + TEMPI.margineDadi;
    case 'movimento':
      return passiPedina(percorso(e, caselle).passi).reduce((t, ms) => t + ms, 0) + TEMPI.fineMovimento;
    case 'prigione':
      return TEMPI.prigione;
    case 'carta':
      return durataCarta(e.testo);
    case 'partenza':
      return e.arrivo ? TEMPI.pausaSoldi : 0;
    case 'bancarotta':
    case 'rimozione':
      return TEMPI.bancarotta;
    case 'fine':
      return TEMPI.fine;
    default:
      if (EVENTI_CON_SOLDI.has(e.tipo)) return TEMPI.pausaSoldi;
      return EVENTI_CON_PAUSA.has(e.tipo) ? TEMPI.pausa : 0;
  }
}
