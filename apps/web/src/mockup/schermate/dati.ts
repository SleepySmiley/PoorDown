/* Dati di esempio dei mockup. Prezzi e affitti sono provvisori: si decidono nella Fase 2. */

import type { NomeIcona } from './icone';

export const REGIONI = [
  'Valle d’Aosta',
  'Sardegna',
  'Toscana',
  'Sicilia',
  'Veneto',
  'Campania',
  'Lazio',
  'Lombardia',
] as const;

/** Sigle delle regioni negli stemmi del tabellone. */
export const SIGLE = ['VDA', 'SAR', 'TOS', 'SIC', 'VEN', 'CAM', 'LAZ', 'LOM'] as const;

export type TipoCasella = 'citta' | 'stazione' | 'servizio' | 'carta' | 'tassa' | 'angolo';

export interface Casella {
  n: number;
  tipo: TipoCasella;
  nome: string;
  /** Nome corto sul tabellone, per stare su una riga. Il nome intero resta nella scheda. */
  breve?: string;
  /** Riga breve sotto il nome (solo la Prigione: «In visita»). */
  sotto?: string;
  prezzo?: number;
  /** Testo al posto del prezzo (tasse). */
  importo?: string;
  gruppo?: number;
  icona?: NomeIcona;
}

const c = (n: number, nome: string, prezzo: number, gruppo: number): Casella => ({ n, tipo: 'citta', nome, prezzo, gruppo });

export const CASELLE: Casella[] = [
  { n: 0, tipo: 'angolo', nome: 'Partenza', icona: 'avanti' },
  c(1, 'Courmayeur', 60, 1),
  { n: 2, tipo: 'carta', nome: 'Busta', icona: 'busta' },
  c(3, 'Aosta', 60, 1),
  { n: 4, tipo: 'tassa', nome: 'Imposta sul reddito', breve: 'Imposta', importo: '10%', icona: 'percento' },
  { n: 5, tipo: 'stazione', nome: 'Stazione Nord', breve: 'Nord', prezzo: 200, icona: 'treno' },
  c(6, 'Olbia', 100, 2),
  c(7, 'Sassari', 100, 2),
  { n: 8, tipo: 'carta', nome: 'Cartolina', icona: 'cartolina' },
  c(9, 'Cagliari', 120, 2),
  { n: 10, tipo: 'angolo', nome: 'Prigione', sotto: 'In visita', icona: 'prigione' },
  c(11, 'Siena', 140, 3),
  { n: 12, tipo: 'servizio', nome: 'Rete elettrica', breve: 'Luce', prezzo: 150, icona: 'fulmine' },
  c(13, 'Pisa', 140, 3),
  c(14, 'Firenze', 160, 3),
  { n: 15, tipo: 'stazione', nome: 'Stazione Est', breve: 'Est', prezzo: 200, icona: 'treno' },
  c(16, 'Siracusa', 180, 4),
  { n: 17, tipo: 'carta', nome: 'Busta', icona: 'busta' },
  c(18, 'Catania', 180, 4),
  c(19, 'Palermo', 200, 4),
  { n: 20, tipo: 'angolo', nome: 'Vacanza', icona: 'vacanza' },
  c(21, 'Padova', 220, 5),
  { n: 22, tipo: 'carta', nome: 'Cartolina', icona: 'cartolina' },
  c(23, 'Verona', 220, 5),
  c(24, 'Venezia', 240, 5),
  { n: 25, tipo: 'stazione', nome: 'Stazione Sud', breve: 'Sud', prezzo: 200, icona: 'treno' },
  c(26, 'Caserta', 260, 6),
  { n: 27, tipo: 'servizio', nome: 'Acquedotto', breve: 'Acqua', prezzo: 150, icona: 'goccia' },
  c(28, 'Salerno', 260, 6),
  c(29, 'Napoli', 280, 6),
  { n: 30, tipo: 'angolo', nome: 'Vai in prigione', icona: 'vaiprigione' },
  c(31, 'Viterbo', 300, 7),
  c(32, 'Latina', 300, 7),
  { n: 33, tipo: 'carta', nome: 'Busta', icona: 'busta' },
  c(34, 'Roma', 320, 7),
  { n: 35, tipo: 'stazione', nome: 'Stazione Ovest', breve: 'Ovest', prezzo: 200, icona: 'treno' },
  { n: 36, tipo: 'carta', nome: 'Cartolina', icona: 'cartolina' },
  c(37, 'Bergamo', 350, 8),
  { n: 38, tipo: 'tassa', nome: 'Tassa di soggiorno', breve: 'Soggiorno', importo: '75 €', icona: 'euro' },
  c(39, 'Milano', 400, 8),
];

/** Costo di una casa (e dell'albergo) per lato del tabellone. */
export function costoCasa(n: number): number {
  return [50, 100, 150, 200][Math.floor(n / 10)] ?? 200;
}

function arrotonda5(x: number): number {
  return Math.round(x / 5) * 5;
}

/** Affitti di esempio: base, 1–4 case, albergo. */
export function affitti(prezzo: number): number[] {
  const base = Math.round(prezzo * 0.085);
  return [base, ...[5, 15, 35, 43, 51].map((m) => arrotonda5(base * m))];
}

/** 1500 → "1.500": in italiano il punto delle migliaia si mette anche sotto i 10.000. */
export function migliaia(x: number): string {
  return String(Math.round(Math.abs(x))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function euro(x: number): string {
  return `${x < 0 ? '−' : ''}${migliaia(x)} €`;
}

/* ---------------- Giocatori e partita di esempio ---------------- */

export interface Giocatore {
  id: number;
  nome: string;
  /** Indice del colore della pedina (1–12). */
  colore: number;
  saldo: number;
  posizione: number;
  host?: boolean;
  tu?: boolean;
  prigione?: boolean;
  bot?: boolean;
  grazia?: number;
}

export const GIOCATORI: Giocatore[] = [
  { id: 0, nome: 'Giulia', colore: 3, saldo: 1340, posizione: 29, host: true, tu: true, grazia: 1 },
  { id: 1, nome: 'Marco', colore: 2, saldo: 860, posizione: 10, prigione: true },
  { id: 2, nome: 'Sara', colore: 5, saldo: 1115, posizione: 24 },
  { id: 3, nome: 'Davide', colore: 4, saldo: 412, posizione: 36 },
];

export interface Possesso {
  proprietario: number;
  case?: number;
  ipotecata?: boolean;
}

export const POSSESSI: Record<number, Possesso> = {
  1: { proprietario: 0, case: 2 },
  3: { proprietario: 0, case: 2 },
  5: { proprietario: 0 },
  13: { proprietario: 0 },
  11: { proprietario: 1 },
  14: { proprietario: 1 },
  12: { proprietario: 1 },
  15: { proprietario: 1 },
  21: { proprietario: 2, case: 1 },
  23: { proprietario: 2, case: 1 },
  24: { proprietario: 2, case: 1 },
  25: { proprietario: 2 },
  34: { proprietario: 2, ipotecata: true },
  6: { proprietario: 3 },
  9: { proprietario: 3 },
  19: { proprietario: 3 },
  27: { proprietario: 3 },
  37: { proprietario: 3 },
};

export const REGISTRO_PARTITA: { ora: string; testo: string }[] = [
  { ora: '21:42', testo: 'Giulia tira 4 e 2 e va a Napoli.' },
  { ora: '21:41', testo: 'Davide pesca una Cartolina: «Aiuti un parente. Paga 50 €.»' },
  { ora: '21:41', testo: 'Davide tira 6 e 5 e va alla casella Cartolina.' },
  { ora: '21:40', testo: 'Sara paga 75 € di affitto a Giulia per Aosta.' },
  { ora: '21:39', testo: 'Marco non fa un doppio e resta in prigione.' },
  { ora: '21:38', testo: 'Sara costruisce una casa a Venezia.' },
];

export const CHAT_PARTITA: { autore: number; testo: string }[] = [
  { autore: 1, testo: 'Qualcuno mi vende Pisa?' },
  { autore: 0, testo: 'Dipende da cosa offri' },
  { autore: 2, testo: 'Davide, ti ho mandato uno scambio' },
  { autore: 3, testo: 'Lo guardo dopo il turno' },
];

/** I nomi casuali "Sostantivo Aggettivo" del dado in home. */
export const NOMI_CASUALI = [
  'Volpe Distratta',
  'Gatto Prudente',
  'Riccio Elegante',
  'Tasso Puntuale',
  'Gufo Generoso',
  'Merlo Paziente',
  'Lupo Gentile',
  'Airone Curioso',
];
