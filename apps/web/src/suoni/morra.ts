/*
 * I suoni della sfida a morra cinese (Giro del mondo), sintetizzati come gli altri del catalogo (catalogo.ts li unisce).
 * La campanella del passaggio a livello annuncia la sfida; nella scena le mani battono tre colpi sordi, si aprono con
 * uno schiocco e arriva l'esito: tre note che salgono a chi vince, due che scendono a chi perde, due uguali col pari.
 * I tempi dei colpi li decide la scena (schermate/sfida.ts, MOMENTI_MORRA): qui c'è un colpo solo, la regia ne suona tre.
 */

import { metallo, nota, tonfo, tono, fruscio, varia, type Uscita } from './sintesi';

type Ricetta = (u: Uscita, t: number, k: number) => void;

/** La campana del passaggio a livello: metallo chiaro, con le parziali di una campanella. */
const CAMPANA = [
  [1, 1, 1],
  [2.02, 0.42, 0.6],
  [2.93, 0.26, 0.45],
  [4.17, 0.14, 0.3],
] as const;

export const SUONI_MORRA = {
  /** La sfida è lanciata: due rintocchi della campanella del passaggio a livello, uno a sinistra e uno a destra. */
  sfida: (u, t, k) => {
    metallo(u, t, { f: 1240, parziali: CAMPANA, durata: 0.45, volume: 0.075 * k, eco: 0.3, pan: -0.3 });
    metallo(u, t + 0.2, { f: 1240, parziali: CAMPANA, durata: 0.6, volume: 0.075 * k, eco: 0.3, pan: 0.3 });
  },

  /** Un colpo delle mani che battono: il pugno che scende, sordo, con lo schiocco del palmo. */
  morraColpo: (u, t, k) => {
    tonfo(u, t, 0.2 * k);
    fruscio(u, t, { f: varia(1700, 0.08), q: 1.1, durata: 0.035, volume: 0.09 * k });
  },

  /** Le mani si aprono sui segni: un fruscio che sale e uno schiocco. */
  morraApre: (u, t, k) => {
    fruscio(u, t, { f: 800, a: 3600, q: 1.2, attacco: 0.03, durata: 0.13, volume: 0.09 * k });
    tono(u, t + 0.05, { f: 620, a: 1180, glide: 0.06, tipo: 'triangle', durata: 0.09, volume: 0.09 * k });
  },

  /** Ho vinto la morra: tre note che salgono. */
  morraVinta: (u, t, k) => {
    [659.26, 880, 1108.73].forEach((f, i) => nota(u, t + i * 0.08, { f, durata: 0.6, volume: 0.095 * k, eco: 0.35 }));
  },

  /** Ho perso la morra: due note che scendono, un po' calanti. */
  morraPersa: (u, t, k) => {
    tono(u, t, { f: 392, a: 380, tipo: 'triangle', durata: 0.18, volume: 0.085 * k });
    tono(u, t + 0.2, { f: 330, a: 300, tipo: 'triangle', durata: 0.36, volume: 0.085 * k });
  },

  /** Pari (o la morra degli altri): due note uguali. */
  morraEsito: (u, t, k) => {
    nota(u, t, { f: 783.99, durata: 0.4, volume: 0.075 * k });
    nota(u, t + 0.14, { f: 783.99, durata: 0.6, volume: 0.075 * k });
  },
} satisfies Record<string, Ricetta>;

export const DESCRIZIONI_MORRA: Record<keyof typeof SUONI_MORRA, string> = {
  sfida: 'Sfida a morra lanciata',
  morraColpo: 'Morra: un colpo delle mani',
  morraApre: 'Morra: le mani si aprono',
  morraVinta: 'Morra vinta',
  morraPersa: 'Morra persa',
  morraEsito: 'Morra pari (o degli altri)',
};

/** I suoni della morra nella pagina di prova (/suoni), nell'ordine in cui si sentono. */
export const GRUPPO_MORRA = ['sfida', 'morraColpo', 'morraApre', 'morraVinta', 'morraPersa', 'morraEsito'] as const satisfies readonly (keyof typeof SUONI_MORRA)[];
