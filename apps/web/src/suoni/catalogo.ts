/*
 * Tutti i suoni del gioco, sintetizzati (niente file, niente diritti): ogni voce programma le sue note a partire
 * dall'istante `t`. `k` (0–1) è la forza: i suoni che riguardano altri giocatori suonano più piano.
 * Tema: la stazione. Il gong degli annunci per il turno, l'obliteratrice per gli acquisti, il fischietto del
 * capotreno per la partenza, le sbarre di ferro della prigione, le monete sul banco della biglietteria.
 */

import { TEMPI } from '@poordown/engine';
import { fischio, fruscio, legno, metallo, nota, tintinnio, tonfo, tono, varia, type Uscita } from './sintesi';

type Ricetta = (u: Uscita, t: number, k: number) => void;

const NOTE = {
  A3: 220,
  C4: 261.63,
  E4: 329.63,
  A4: 440,
  B4: 493.88,
  Cd5: 554.37,
  D5: 587.33,
  E5: 659.26,
  G5: 783.99,
  A5: 880,
  B5: 987.77,
  C6: 1046.5,
  Cd6: 1108.73,
  E6: 1318.51,
  G6: 1567.98,
  A6: 1760,
  B6: 1975.53,
} as const;

/** Il gong del turno: tre note che salgono, come prima di un annuncio. */
const GONG = [NOTE.E5, NOTE.A5, NOTE.Cd6];

export const CATALOGO = {
  /* ---------------- Dadi e pedine ---------------- */

  /** I dadi rotolano (un colpetto per dado a ogni faccia, sempre più radi come in TEMPI.facceDado) e atterrano. */
  dadi: (u, t, k) => {
    let s = 0;
    for (const ms of TEMPI.facceDado) {
      for (const lato of [-0.35, 0.35]) {
        const tt = t + s / 1000 + Math.random() * 0.014;
        fruscio(u, tt, { f: varia(3300, 0.25), q: 4, durata: 0.016, volume: 0.2 * k, pan: lato });
        tono(u, tt, { f: varia(1200, 0.2), a: 700, glide: 0.03, durata: 0.028, volume: 0.06 * k, pan: lato });
      }
      s += ms;
    }
    for (const [i, lato] of [
      [0, -0.3],
      [1, 0.3],
    ] as const) {
      const tt = t + s / 1000 + i * 0.03;
      fruscio(u, tt, { f: 900, filtro: 'lowpass', q: 0.7, durata: 0.07, volume: 0.3 * k, pan: lato });
      tono(u, tt, { f: varia(220, 0.1), a: 120, glide: 0.08, durata: 0.09, volume: 0.26 * k, pan: lato });
    }
  },

  /** Doppio: due note chiare quando i dadi si fermano uguali. */
  doppio: (u, t, k) => {
    nota(u, t, { f: NOTE.E6, durata: 0.5, volume: 0.11 * k, eco: 0.4 });
    nota(u, t + 0.085, { f: NOTE.B6, durata: 0.7, volume: 0.1 * k, eco: 0.4 });
  },

  /** Un passo della pedina: un tocco di legno leggero. */
  passo: (u, t, k) => {
    const f = varia(820, 0.07);
    tono(u, t, { f, a: f * 0.62, glide: 0.035, durata: 0.045, volume: 0.11 * k, attacco: 0.001 });
    fruscio(u, t, { f: 2400, q: 3, durata: 0.012, volume: 0.06 * k });
  },

  /** La pedina arriva e si schiaccia. */
  arrivo: (u, t, k) => {
    tono(u, t, { f: 260, a: 150, glide: 0.1, durata: 0.14, volume: 0.13 * k, attacco: 0.002 });
    fruscio(u, t, { f: 700, filtro: 'lowpass', durata: 0.06, volume: 0.06 * k });
  },

  /* ---------------- Soldi ---------------- */

  /** Un gettone che arriva a qualcun altro (o alla banca). */
  moneta: (u, t, k) => tintinnio(u, t, varia(2300, 0.05), 0.06 * k, varia(0, 0.3)),

  /** Soldi che arrivano a me: due monete che cadono una sull'altra. */
  incasso: (u, t, k) => {
    tintinnio(u, t, varia(2100, 0.03), 0.14 * k, -0.1);
    tintinnio(u, t + 0.065, varia(2700, 0.03), 0.13 * k, 0.1);
  },

  /** Soldi che escono da me: due monete che scendono. */
  pagamento: (u, t, k) => {
    fruscio(u, t, { f: 3000, a: 900, q: 1.2, durata: 0.12, volume: 0.04 * k });
    tintinnio(u, t + 0.02, varia(1900, 0.03), 0.07 * k);
    tintinnio(u, t + 0.09, varia(1450, 0.03), 0.06 * k);
  },

  /* ---------------- Proprietà ---------------- */

  /** Acquisto: l'obliteratrice carica e timbra il biglietto, poi un piccolo «dlin». */
  timbro: (u, t, k) => {
    fruscio(u, t, { f: 1800, a: 900, q: 2, durata: 0.07, volume: 0.05 * k });
    const c = t + 0.075;
    fruscio(u, c, { f: 1400, filtro: 'lowpass', q: 0.8, durata: 0.09, volume: 0.3 * k });
    tono(u, c, { f: 170, a: 75, glide: 0.09, durata: 0.12, volume: 0.3 * k, attacco: 0.002 });
    fruscio(u, c, { f: 4200, q: 5, durata: 0.014, volume: 0.12 * k });
    nota(u, c + 0.07, { f: NOTE.C6, durata: 0.5, volume: 0.06 * k, eco: 0.3 });
  },

  /** Una casa: due colpi di legno che salgono. */
  casa: (u, t, k) => {
    legno(u, t, 880, 0.27 * k, -0.1);
    legno(u, t + 0.11, 1175, 0.27 * k, 0.1);
  },

  /** L'albergo: tre colpi che salgono e un campanello. */
  albergo: (u, t, k) => {
    legno(u, t, 880, 0.16 * k, -0.15);
    legno(u, t + 0.1, 1175, 0.16 * k, 0);
    legno(u, t + 0.2, 1568, 0.16 * k, 0.15);
    nota(u, t + 0.31, { f: NOTE.E6, durata: 0.8, volume: 0.08 * k, eco: 0.4 });
  },

  /** Case vendute o proprietà ridata alla banca: due colpi che scendono. */
  smonta: (u, t, k) => {
    legno(u, t, 1175, 0.24 * k, 0.1);
    legno(u, t + 0.11, 784, 0.24 * k, -0.1);
  },

  /** Ipoteca: il timbro sul banco e due note che scendono. */
  ipoteca: (u, t, k) => {
    tonfo(u, t, 0.24 * k);
    nota(u, t + 0.08, { f: NOTE.E5, durata: 0.35, volume: 0.09 * k });
    nota(u, t + 0.2, { f: NOTE.B4, durata: 0.55, volume: 0.09 * k });
  },

  /** Riscatto: il timbro e due note che salgono. */
  riscatto: (u, t, k) => {
    tonfo(u, t, 0.24 * k);
    nota(u, t + 0.08, { f: NOTE.B4, durata: 0.35, volume: 0.09 * k });
    nota(u, t + 0.2, { f: NOTE.E5, durata: 0.55, volume: 0.09 * k });
  },

  /* ---------------- Carte e prigione ---------------- */

  /** La carta esce dalla casella e si gira al centro. */
  carta: (u, t, k) => {
    fruscio(u, t, { f: 1200, a: 4800, q: 0.9, attacco: 0.06, durata: 0.2, volume: 0.45 * k, pan: -0.15 });
    fruscio(u, t + 0.25, { f: 3000, q: 1.5, durata: 0.05, volume: 0.28 * k, pan: 0.1 });
  },

  /** In prigione: il volo, poi le sbarre di ferro che scendono e sbattono. */
  prigione: (u, t, k) => {
    fruscio(u, t + 0.33, { f: 500, a: 2200, q: 1.2, attacco: 0.15, durata: 0.35, volume: 0.06 * k });
    const c = t + 0.97;
    const sbarre = [
      [1, 1, 1],
      [2.02, 0.55, 0.8],
      [2.76, 0.5, 0.7],
      [4.07, 0.3, 0.5],
      [5.4, 0.22, 0.4],
      [8.93, 0.1, 0.25],
    ] as const;
    metallo(u, c, { f: 196, parziali: sbarre, durata: 1.1, volume: 0.13 * k, eco: 0.35, pan: -0.15 });
    metallo(u, c + 0.014, { f: 207, parziali: sbarre, durata: 0.9, volume: 0.1 * k, eco: 0.35, pan: 0.15 });
    fruscio(u, c, { f: 2500, q: 0.8, durata: 0.08, volume: 0.1 * k });
  },

  /** Fuori di prigione: le sbarre risalgono strisciando e due note leggere. */
  liberato: (u, t, k) => {
    fruscio(u, t, { f: 800, a: 3200, q: 4, attacco: 0.05, durata: 0.28, volume: 0.04 * k });
    nota(u, t + 0.12, { f: NOTE.E5, durata: 0.4, volume: 0.08 * k });
    nota(u, t + 0.24, { f: NOTE.A5, durata: 0.7, volume: 0.08 * k });
  },

  /* ---------------- Turno e partita ---------------- */

  /** Tocca a te: il gong degli annunci, nell'atrio. */
  tuoTurno: (u, t, k) => {
    GONG.forEach((f, i) => nota(u, t + i * 0.28, { f, durata: 1.5, volume: 0.15 * k, eco: 0.55 }));
  },

  /** La partita parte: il fischietto del capotreno. */
  partenza: (u, t, k) => {
    fischio(u, t, 0.16, 0.045 * k);
    fischio(u, t + 0.24, 0.5, 0.05 * k);
  },

  /** Un secondo che passa (ultimi secondi del turno o dell'asta). */
  tic: (u, t, k) => {
    fruscio(u, t, { f: 3600, q: 6, durata: 0.014, volume: 0.4 * k });
    tono(u, t, { f: 1900, durata: 0.02, volume: 0.1 * k, attacco: 0.001 });
  },

  /** Bancarotta: un colpo sordo e tre note gravi che scendono. */
  bancarotta: (u, t, k) => {
    tonfo(u, t, 0.22 * k);
    nota(u, t + 0.05, { f: NOTE.E4, durata: 1.1, volume: 0.13 * k, eco: 0.5 });
    nota(u, t + 0.33, { f: NOTE.C4, durata: 1.1, volume: 0.13 * k, eco: 0.5 });
    nota(u, t + 0.61, { f: NOTE.A3, durata: 1.6, volume: 0.14 * k, eco: 0.5 });
  },

  /** Vittoria: l'arpeggio che sale, l'accordo finale e qualche scintilla, come i coriandoli. */
  vittoria: (u, t, k) => {
    [NOTE.E5, NOTE.A5, NOTE.Cd6, NOTE.E6].forEach((f, i) => nota(u, t + i * 0.1, { f, durata: 0.6, volume: 0.12 * k, eco: 0.5 }));
    for (const f of [NOTE.A5, NOTE.Cd6, NOTE.E6]) nota(u, t + 0.48, { f, durata: 2.2, volume: 0.09 * k, eco: 0.6 });
    const scintille = [NOTE.A6, NOTE.E6, NOTE.B6, NOTE.Cd6, NOTE.A6, NOTE.E6];
    scintille.forEach((f, i) => nota(u, t + 0.7 + i * 0.17 + Math.random() * 0.05, { f, durata: 0.4, volume: 0.035 * k, eco: 0.6, pan: varia(0, 0.6) }));
  },

  /** Fine partita per chi non ha vinto: il gong che scende, come all'arrivo del treno. */
  fine: (u, t, k) => {
    [...GONG].reverse().forEach((f, i) => nota(u, t + i * 0.3, { f, durata: 1.6, volume: 0.13 * k, eco: 0.55 }));
  },

  /* ---------------- Aste ---------------- */

  /** Si apre l'asta: un colpo di martelletto. */
  martelletto: (u, t, k) => {
    legno(u, t, 520, 0.24 * k);
    tonfo(u, t, 0.14 * k);
  },

  /** Aggiudicata: uno, due, tre colpi di martelletto. */
  aggiudicato: (u, t, k) => {
    legno(u, t, 560, 0.13 * k);
    legno(u, t + 0.17, 560, 0.15 * k);
    legno(u, t + 0.4, 500, 0.24 * k);
    tonfo(u, t + 0.4, 0.18 * k);
  },

  /** Qualcuno rilancia. */
  offerta: (u, t, k) => tono(u, t, { f: 1320, a: 1500, glide: 0.04, tipo: 'triangle', durata: 0.08, volume: 0.12 * k }),

  /** Il mio rilancio. */
  miaOfferta: (u, t, k) => tono(u, t, { f: 990, tipo: 'triangle', durata: 0.07, volume: 0.09 * k }),

  /** Ero il migliore offerente e qualcuno mi ha superato. */
  superato: (u, t, k) => {
    tono(u, t, { f: 1175, tipo: 'triangle', durata: 0.07, volume: 0.1 * k });
    tono(u, t + 0.09, { f: 880, tipo: 'triangle', durata: 0.12, volume: 0.1 * k });
  },

  /* ---------------- Scambi ---------------- */

  /** Mi arriva una proposta: un foglio sul banco e due note. */
  proposta: (u, t, k) => {
    fruscio(u, t, { f: 1500, a: 4000, q: 0.9, attacco: 0.04, durata: 0.14, volume: 0.07 * k });
    nota(u, t + 0.12, { f: NOTE.D5, durata: 0.5, volume: 0.1 * k });
    nota(u, t + 0.26, { f: NOTE.A5, durata: 0.8, volume: 0.1 * k });
  },

  /** Il mio scambio è fatto: il timbro e tre note che salgono. */
  scambioFatto: (u, t, k) => {
    tonfo(u, t, 0.22 * k);
    [NOTE.Cd5, NOTE.E5, NOTE.A5].forEach((f, i) => nota(u, t + 0.06 + i * 0.075, { f, durata: 0.6, volume: 0.09 * k }));
  },

  /** Il mio scambio è rifiutato: il timbro e due note gravi. */
  scambioRifiutato: (u, t, k) => {
    tonfo(u, t, 0.22 * k);
    tono(u, t + 0.07, { f: NOTE.E4, tipo: 'triangle', durata: 0.18, volume: 0.07 * k });
    tono(u, t + 0.2, { f: NOTE.C4, tipo: 'triangle', durata: 0.3, volume: 0.07 * k });
  },

  /** Lo scambio degli altri, timbrato sul tabellone. */
  timbroLieve: (u, t, k) => tonfo(u, t, 0.14 * k),

  /* ---------------- Stanza ---------------- */

  /** Un messaggio in chat: una bollicina. */
  chat: (u, t, k) => tono(u, t, { f: 520, a: 1040, glide: 0.05, durata: 0.08, volume: 0.08 * k, attacco: 0.003 }),

  /** Qualcuno entra nella stanza. */
  ingresso: (u, t, k) => {
    nota(u, t, { f: NOTE.G5, durata: 0.5, volume: 0.07 * k });
    nota(u, t + 0.11, { f: NOTE.C6, durata: 0.7, volume: 0.07 * k });
  },

  /** Qualcuno esce dalla stanza. */
  uscita: (u, t, k) => {
    nota(u, t, { f: NOTE.C6, durata: 0.4, volume: 0.055 * k });
    nota(u, t + 0.11, { f: NOTE.G5, durata: 0.6, volume: 0.055 * k });
  },

  /* ---------------- Tempo e voti ---------------- */

  /** Un voto contro di me: due colpi bassi di avviso. */
  votoContro: (u, t, k) => {
    tono(u, t, { f: 330, tipo: 'triangle', durata: 0.12, volume: 0.14 * k });
    tono(u, t + 0.17, { f: 330, tipo: 'triangle', durata: 0.16, volume: 0.14 * k });
  },

  /** Un voto, a qualcun altro. */
  voto: (u, t, k) => legno(u, t, 700, 0.1 * k),

  /** Qualcuno mi regala un minuto. */
  tempoRicevuto: (u, t, k) => {
    nota(u, t, { f: NOTE.E6, durata: 0.4, volume: 0.08 * k });
    nota(u, t + 0.08, { f: NOTE.A6, durata: 0.6, volume: 0.08 * k });
  },

  /** Chi gioca chiede tempo agli altri. */
  tempoChiesto: (u, t, k) => nota(u, t, { f: NOTE.A5, durata: 0.6, volume: 0.08 * k }),
} satisfies Record<string, Ricetta>;

export type NomeSuono = keyof typeof CATALOGO;

/** Che cosa suona, per la pagina di prova dei suoni. */
export const DESCRIZIONI: Record<NomeSuono, string> = {
  dadi: 'Dadi che rotolano',
  doppio: 'Doppio',
  passo: 'Passo della pedina',
  arrivo: 'Pedina arrivata',
  moneta: 'Gettone a un altro giocatore',
  incasso: 'Soldi che arrivano a me',
  pagamento: 'Soldi che escono da me',
  timbro: 'Acquisto',
  casa: 'Casa costruita',
  albergo: 'Albergo costruito',
  smonta: 'Casa o proprietà venduta',
  ipoteca: 'Ipoteca',
  riscatto: 'Riscatto',
  carta: 'Carta pescata',
  prigione: 'In prigione',
  liberato: 'Fuori di prigione',
  tuoTurno: 'Tocca a te',
  partenza: 'Inizio della partita',
  tic: 'Ultimi secondi',
  bancarotta: 'Bancarotta',
  vittoria: 'Vittoria',
  fine: 'Fine partita (chi non vince)',
  martelletto: 'Si apre l’asta',
  aggiudicato: 'Asta aggiudicata',
  offerta: 'Rilancio di un altro',
  miaOfferta: 'Il mio rilancio',
  superato: 'La mia offerta è superata',
  proposta: 'Proposta di scambio ricevuta',
  scambioFatto: 'Il mio scambio è fatto',
  scambioRifiutato: 'Il mio scambio è rifiutato',
  timbroLieve: 'Scambio tra altri',
  chat: 'Messaggio in chat',
  ingresso: 'Qualcuno entra nella stanza',
  uscita: 'Qualcuno esce dalla stanza',
  votoContro: 'Voto contro di me',
  voto: 'Voto contro un altro',
  tempoRicevuto: 'Mi regalano un minuto',
  tempoChiesto: 'Chi gioca chiede tempo',
};
