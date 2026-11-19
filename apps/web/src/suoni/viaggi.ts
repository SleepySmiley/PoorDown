/*
 * I suoni del Giro del mondo (catalogo.ts li unisce agli altri): il volo, le tre caselle strane, il passaporto e le carte
 * rare. Sintetizzati come tutti gli altri, con il tema del viaggio: il motore dell'aereo, le gomme sulla pista, il gorgo
 * delle Bermuda, la buca che inghiotte e risputa la pedina, le palette del calendario, il timbro della dogana.
 * I suoni che accompagnano una scena (vortice, buca, calendario) seguono i suoi tempi (TEMPI, packages/engine/src/tempi.ts):
 * la seconda metà suona quando la pedina ricompare.
 */

import { TEMPI } from '@poordown/engine';
import { fruscio, legno, metallo, nota, tonfo, tono, varia, type Uscita } from './sintesi';

type Ricetta = (u: Uscita, t: number, k: number) => void;

const E5 = 659.26;
const A5 = 880;
const Cd6 = 1108.73;
const E6 = 1318.51;

/** Una campana d'annuncio, chiara: le stesse parziali della campanella della stazione. */
const CAMPANA = [
  [1, 1, 1],
  [2.02, 0.4, 0.6],
  [2.93, 0.24, 0.45],
] as const;

export const SUONI_VIAGGI = {
  /** Il decollo: il motore che sale di giri e l'aria che passa sempre più forte, poi si allontana. */
  decollo: (u, t, k) => {
    fruscio(u, t, { f: 260, a: 2600, q: 0.8, attacco: 0.3, durata: 0.75, volume: 0.45 * k, pan: -0.2 });
    tono(u, t, { f: 120, a: 360, glide: 0.6, tipo: 'sawtooth', attacco: 0.25, durata: 0.6, volume: 0.06 * k });
    tono(u, t + 0.05, { f: 900, a: 2200, glide: 0.6, attacco: 0.3, durata: 0.5, volume: 0.054 * k, pan: 0.2 });
  },

  /** L'atterraggio: le gomme toccano la pista (due colpi con lo stridio) e il motore cala. */
  atterraggio: (u, t, k) => {
    fruscio(u, t, { f: 3200, q: 6, durata: 0.06, volume: 0.05 * k, pan: -0.15 });
    tonfo(u, t, 0.16 * k);
    fruscio(u, t + 0.08, { f: 3000, q: 6, durata: 0.05, volume: 0.04 * k, pan: 0.15 });
    tonfo(u, t + 0.08, 0.12 * k);
    fruscio(u, t + 0.04, { f: 1500, a: 300, q: 0.8, durata: 0.4, volume: 0.06 * k });
  },

  /**
   * Il Triangolo delle Bermuda: un gorgo che gira da un orecchio all'altro e scende nel grave mentre la pedina sparisce;
   * quando ricompare, una bolla che sale e una nota chiara.
   */
  vortice: (u, t, k) => {
    for (let i = 0; i < 7; i++) {
      fruscio(u, t + i * 0.08, { f: 1600 - i * 160, a: 450, q: 2.5, durata: 0.13, volume: 0.126 * k, pan: i % 2 === 0 ? -0.55 : 0.55 });
    }
    tono(u, t, { f: 640, a: 80, glide: 0.6, tipo: 'triangle', durata: 0.62, volume: 0.126 * k });
    const ricompare = t + (TEMPI.bermuda * 0.56) / 1000;
    tono(u, ricompare, { f: 180, a: 980, glide: 0.16, durata: 0.18, volume: 0.144 * k });
    nota(u, ricompare + 0.14, { f: E6, durata: 0.7, volume: 0.09 * k, eco: 0.5 });
  },

  /**
   * La Buca per l'altra parte del mondo: la pedina cade (un fischio che scende e un tonfo lontano), passa sotto il
   * tabellone e sbuca dall'altra parte con uno schiocco.
   */
  buca: (u, t, k) => {
    tono(u, t, { f: 880, a: 150, glide: 0.34, tipo: 'triangle', durata: 0.36, volume: 0.108 * k });
    fruscio(u, t, { f: 2000, a: 300, q: 1.2, attacco: 0.05, durata: 0.32, volume: 0.068 * k });
    fruscio(u, t + 0.34, { f: 260, filtro: 'lowpass', q: 0.7, durata: 0.12, volume: 0.162 * k });
    const sbuca = t + (TEMPI.antipodi * 0.64) / 1000;
    tono(u, sbuca, { f: 210, a: 1150, glide: 0.09, durata: 0.11, volume: 0.149 * k, attacco: 0.002 });
    fruscio(u, sbuca, { f: 2600, q: 2, durata: 0.04, volume: 0.095 * k });
  },

  /** La Linea del cambio di data: le palette del calendario girano di un giorno (tre scatti) e una nota leggera. */
  calendario: (u, t, k) => {
    const gira = t + 0.17;
    [0, 0.045, 0.11].forEach((d, i) => {
      legno(u, gira + d, varia(2100 - i * 200, 0.04), 0.11 * k, i % 2 === 0 ? -0.1 : 0.1);
      fruscio(u, gira + d, { f: 5200, q: 4, durata: 0.012, volume: 0.08 * k });
    });
    nota(u, gira + 0.2, { f: A5, durata: 0.6, volume: 0.1 * k, eco: 0.4 });
  },

  /** Il passaporto: due timbri secchi sul libretto, come allo sportello della dogana, e un «dlin» chiaro. */
  passaporto: (u, t, k) => {
    fruscio(u, t, { f: 2200, a: 1200, q: 1.5, durata: 0.05, volume: 0.04 * k });
    tonfo(u, t + 0.04, 0.17 * k);
    fruscio(u, t + 0.04, { f: 4800, q: 5, durata: 0.012, volume: 0.08 * k });
    tonfo(u, t + 0.17, 0.2 * k);
    fruscio(u, t + 0.17, { f: 4400, q: 5, durata: 0.012, volume: 0.09 * k });
    nota(u, t + 0.24, { f: Cd6, durata: 0.45, volume: 0.05 * k, eco: 0.3 });
  },

  /** Vita extra: la pedina rinasce sulla Partenza, un respiro che sale e tre note che si aprono. */
  rientro: (u, t, k) => {
    fruscio(u, t, { f: 500, a: 4200, q: 0.9, attacco: 0.25, durata: 0.4, volume: 0.06 * k });
    [E5, A5, E6].forEach((f, i) => nota(u, t + 0.32 + i * 0.12, { f, durata: 0.9, volume: 0.08 * k, eco: 0.5 }));
  },

  /** Reset: i blocchi dei proprietari che si sfilano dal tabellone uno dopo l'altro, sempre più radi e più gravi. */
  reset: (u, t, k) => {
    let s = 0;
    for (let i = 0; i < 9; i++) {
      legno(u, t + s, varia(1200 - i * 70, 0.05), (0.16 - i * 0.01) * k, varia(0, 0.5));
      s += 0.06 + i * 0.018;
    }
    tonfo(u, t + s, 0.18 * k);
  },

  /** Resta un solo giocatore: due rintocchi lenti della campana d'annuncio, come prima di un avviso in stazione. */
  ultimoRimasto: (u, t, k) => {
    metallo(u, t, { f: A5, parziali: CAMPANA, durata: 1, volume: 0.15 * k, eco: 0.5, pan: -0.15 });
    metallo(u, t + 0.42, { f: E5, parziali: CAMPANA, durata: 1.3, volume: 0.15 * k, eco: 0.5, pan: 0.15 });
  },
} satisfies Record<string, Ricetta>;

/** Che cosa suona, per la pagina di prova dei suoni. */
export const DESCRIZIONI_VIAGGI: Record<keyof typeof SUONI_VIAGGI, string> = {
  decollo: 'Decollo dell’aereo',
  atterraggio: 'Atterraggio dell’aereo',
  vortice: 'Triangolo delle Bermuda',
  buca: 'Buca degli Antipodi',
  calendario: 'Linea del cambio di data',
  passaporto: 'Passaporto timbrato',
  rientro: 'Vita extra: si rientra in gioco',
  reset: 'Reset: tutto torna alla banca',
  ultimoRimasto: 'Resta un solo giocatore',
};

/** I suoni del gruppo «Giro del mondo» nella pagina di prova. */
export const GRUPPO_VIAGGI = Object.keys(SUONI_VIAGGI) as (keyof typeof SUONI_VIAGGI)[];
