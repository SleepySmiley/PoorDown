/*
 * La scala degli affitti di PoorDown, ricavata dal tabellone Classico: per ogni prezzo, gli affitti si
 * interpolano tra le due città del Classico più vicine per prezzo. Così i tabelloni alternativi hanno
 * la stessa economia senza riscrivere sei numeri per città. Base all'euro, case e albergo ai 5 €.
 */

import type { Affitti } from '../tipi';

/** Prezzo → affitti (terreno, 1–4 case, albergo) delle città del Classico. */
const PUNTI: readonly (readonly [number, Affitti])[] = [
  [60, [3, 10, 35, 100, 140, 170]],
  [70, [4, 15, 45, 120, 170, 200]],
  [100, [6, 25, 70, 190, 260, 320]],
  [110, [6, 25, 80, 220, 290, 360]],
  [120, [7, 30, 90, 250, 330, 400]],
  [140, [9, 35, 110, 300, 400, 490]],
  [150, [10, 40, 120, 330, 440, 530]],
  [160, [11, 45, 140, 360, 480, 580]],
  [180, [13, 55, 160, 430, 560, 680]],
  [190, [14, 60, 180, 460, 600, 730]],
  [200, [15, 65, 190, 500, 650, 780]],
  [220, [17, 75, 220, 570, 740, 880]],
  [230, [18, 80, 230, 610, 780, 940]],
  [250, [21, 90, 270, 680, 880, 1050]],
  [260, [22, 95, 280, 720, 920, 1100]],
  [270, [24, 100, 300, 760, 970, 1150]],
  [290, [26, 110, 340, 850, 1075, 1275]],
  [300, [28, 120, 360, 890, 1125, 1325]],
  [310, [29, 130, 380, 930, 1175, 1400]],
  [330, [32, 140, 420, 1025, 1275, 1500]],
  [360, [37, 160, 480, 1150, 1425, 1675]],
  [400, [44, 190, 580, 1350, 1625, 1925]],
];

export const PREZZO_MIN = PUNTI[0]![0];
export const PREZZO_MAX = PUNTI.at(-1)![0];

/** Gli affitti di una città che costa `prezzo` (tra 60 e 400 €). */
export function affittiPerPrezzo(prezzo: number): Affitti {
  if (prezzo < PREZZO_MIN || prezzo > PREZZO_MAX) throw new Error(`Prezzo fuori scala: ${prezzo}`);
  const i = PUNTI.findIndex(([p]) => p >= prezzo);
  const [p1, a1] = PUNTI[i]!;
  const [p0, a0] = PUNTI[Math.max(0, i - 1)]!;
  const t = p1 === p0 ? 1 : (prezzo - p0) / (p1 - p0);
  return a1.map((v, livello) => {
    const x = a0[livello]! + (v - a0[livello]!) * t;
    return livello === 0 ? Math.round(x) : Math.round(x / 5) * 5;
  }) as unknown as Affitti;
}
