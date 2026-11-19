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
  /** Il teletrasporto delle carte folli: la pedina sparisce in un lampo e ricompare sulla casella d'arrivo. */
  teletrasporto: 950,
  /* Giro del mondo. */
  /** Il volo: la pedina decolla, vola ad arco sopra il tabellone con l'aereo e atterra sulla meta. */
  volo: 1400,
  /** Il Triangolo delle Bermuda: la pedina gira in un vortice, sparisce e ricompare altrove. */
  bermuda: 1300,
  /** La Buca per l'altra parte del mondo: la pedina sprofonda e sbuca sul lato opposto. */
  antipodi: 1100,
  /** La Linea del cambio di data: il calendario gira di un giorno. */
  cambioData: 700,
  /** La morra cinese: le due mani battono tre volte («sasso, carta, forbici!») e si aprono. */
  morra: 1800,
  /* Regole folli del Sistema solare. */
  /** Inizio di un giro: il riquadro dell'evento cosmico entra, si legge, poi si rimpicciolisce. */
  cosmo: 2600,
  /** Affitto quantistico: il dado quantico rotola e si ferma sul fattore. */
  quantico: 1100,
  /** La fionda gravitazionale si carica, poi la pedina riparte. */
  fionda: 500,
  /** Il dado cosmico, appena fermi i dadi: il riquadro con la faccia uscita e cosa fa. */
  dadoCosmico: 1000,
  /** Il razzo si accende, poi la pedina vola alla proprietà libera. */
  razzo: 500,
  /** La bandiera si pianta sulla proprietà regalata, che lampeggia nel colore del nuovo proprietario. */
  bandiera: 700,
  /** La Roulette cosmica gira e rallenta fino allo spicchio; poi resta il tempo di leggerlo (come le carte). */
  rouletteGira: 1700,
  /** Un meteorite cade su una casa. */
  meteorite: 1100,
  /** Due proprietà si scontrano e si scambiano il colore del proprietario. */
  collisione: 1300,
  /** Una carta inverte la gravità: il tabellone fa un mezzo giro e torna. */
  gravita: 900,
  /** La Supernova: il suo dado entra e si ferma sul moltiplicatore, poi la stella esplode e regala il malloppo. */
  supernova: 1700,
  /** Quando, dentro la scena della Supernova, il dado è fermo: esplode e parte il gettone del malloppo. */
  supernovaEsplode: 550,
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
export const EVENTI_CON_PAUSA: ReadonlySet<Evento['tipo']> = new Set<Evento['tipo']>(['prigione_fallita', 'vacanza', 'scudo']);

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
  'robin_hood',
  'moneta',
  'buco_nero',
]);

/** Il rotolamento dei dadi, dal primo lancio alla pausa con i dadi fermi. */
export const DADI_MS = TEMPI.facceDado.reduce((t, ms) => t + ms, 0) + TEMPI.dadiFermi;

/**
 * Quante caselle percorre la pedina e in che verso. Le carte "Torna indietro di 3 caselle"
 * sono l'unico spostamento all'indietro.
 */
export function percorso(
  e: { da: number; a: number; dadi?: [number, number]; verso?: -1; razzo?: true },
  caselle: number,
): { passi: number; verso: 1 | -1 } {
  const avanti = (e.a - e.da + caselle) % caselle;
  const indietro = (e.da - e.a + caselle) % caselle;
  // Con la gravità invertita (regole folli) anche i dadi e la fionda portano indietro: lo dice l'evento.
  if (e.verso === -1) return { passi: indietro, verso: -1 };
  // Il volo del razzo va sempre avanti, anche lungo.
  if (e.razzo) return { passi: avanti, verso: 1 };
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

/** Il tempo per leggere il testo di una carta (o di uno spicchio della Roulette): tanto per carattere, tra un minimo e un massimo. */
function lettura(testo: string): number {
  return Math.min(TEMPI.cartaMax, Math.max(TEMPI.cartaMin, testo.length * TEMPI.cartaPerCarattere));
}

/** Quanto resta in vista la carta pescata, dall'uscita dalla casella al ritorno nella scheda dell'evento. */
export function durataCarta(testo: string): number {
  return TEMPI.cartaEntra + lettura(testo) + TEMPI.cartaEsce;
}

/** Quanto dura la Roulette cosmica: la ruota che gira, il tempo di leggere lo spicchio, l'uscita. */
export function durataRoulette(testo: string): number {
  return TEMPI.rouletteGira + lettura(testo) + TEMPI.cartaEsce;
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
    case 'teletrasporto':
      return TEMPI.teletrasporto;
    case 'volo':
      return TEMPI.volo;
    case 'bermuda':
      return TEMPI.bermuda;
    case 'antipodi':
      return TEMPI.antipodi;
    case 'cambio_data':
      return TEMPI.cambioData;
    case 'morra':
      return TEMPI.morra;
    case 'cosmo':
      return TEMPI.cosmo;
    case 'quantico':
      return TEMPI.quantico;
    case 'fionda':
      return TEMPI.fionda;
    case 'dado_cosmico':
      return TEMPI.dadoCosmico;
    case 'razzo':
      return TEMPI.razzo;
    case 'bandiera':
      return TEMPI.bandiera;
    case 'roulette':
      return durataRoulette(e.testo);
    case 'meteorite':
      return TEMPI.meteorite;
    case 'collisione':
      return TEMPI.collisione;
    case 'gravita_invertita':
      return TEMPI.gravita;
    case 'supernova':
      return TEMPI.supernova;
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
