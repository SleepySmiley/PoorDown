/*
 * Movimento: gli stessi tempi e le stesse curve dei token CSS (token.css), pronti per Motion (`motion/react`).
 * Regole: entrate lente, uscite rapide; le animazioni semplici restano in CSS. Motion serve per
 * - le uscite (AnimatePresence attorno a ciò che compare e scompare: finestre, riquadri, popover, avvisi);
 * - le liste che non saltano (prop `layout` sulle righe);
 * - i voli da un punto all'altro (`animate`): i gettoni dei soldi (Gettone.tsx), la carta pescata (Carta.tsx).
 * Le durate delle scene di gioco (dadi, passi, pause) non stanno qui: sono nel motore, in TEMPI (packages/engine/src/tempi.ts).
 */

import type { Transition } from 'motion/react';

/** In secondi, come vuole Motion. Gli stessi valori di --d-* in token.css. */
export const DURATA = {
  /** Passaggio del mouse, pressione. */
  rapida: 0.12,
  /** Chiusure. */
  uscita: 0.16,
  /** Righe che scorrono, veli. */
  lista: 0.2,
  /** Aperture. */
  entrata: 0.22,
  /** Timbri, comparse con rimbalzo. */
  timbro: 0.3,
  lenta: 0.4,
  /** Oggetti che viaggiano da un punto all'altro. */
  viaggio: 0.5,
} as const;

type Curva = [number, number, number, number];

/** Le curve di --c-* in token.css. */
export const CURVA: Record<'arrivo' | 'partenza' | 'viaggio' | 'molla' | 'timbro', Curva> = {
  /** Rallenta alla fine: per le entrate. */
  arrivo: [0.2, 0.8, 0.2, 1],
  /** Accelera: per le uscite. */
  partenza: [0.4, 0, 1, 1],
  /** Parte e arriva piano. */
  viaggio: [0.65, 0, 0.35, 1],
  /** Supera di poco e torna. */
  molla: [0.3, 0.7, 0.3, 1.25],
  /** Colpo deciso con rimbalzo. */
  timbro: [0.3, 1.5, 0.5, 1],
};

/**
 * Un riquadro che compare e scompare (finestre, riquadri sopra il tabellone, popover, avvisi):
 * si apre in 220 ms e si chiude in 160 ms, con dissolvenza, scala 0,97 e 6 px di discesa.
 * Si usa così: `<motion.div {...COMPARSA}>`, dentro un `<AnimatePresence>`.
 */
export const COMPARSA = {
  initial: { opacity: 0, scale: 0.97, y: 6 },
  animate: { opacity: 1, scale: 1, y: 0, transition: { duration: DURATA.entrata, ease: CURVA.arrivo } },
  exit: { opacity: 0, scale: 0.97, y: 6, transition: { duration: DURATA.uscita, ease: CURVA.partenza } },
} as const;

/** Il velo scuro sotto finestre e riquadri: solo dissolvenza. */
export const VELO = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: DURATA.lista, ease: CURVA.arrivo } },
  exit: { opacity: 0, transition: { duration: DURATA.uscita, ease: CURVA.partenza } },
} as const;

/** Righe di liste e registro: quando la lista cambia scorrono al loro posto invece di saltare. Con `layout`. */
export const SCORRE: Transition = { layout: { duration: DURATA.lista, ease: CURVA.arrivo } };
