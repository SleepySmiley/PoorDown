/*
 * Tabellone "Classico" di PoorDown: città italiane, regioni dalla meno alla più popolosa.
 * Nomi e testi: docs/identita/tabellone-e-carte.md. Prezzi e affitti sono nostri (scala decisa in Fase 2).
 */

import type { Affitti, Carta, Casella, Regione, Tabellone } from '../tipi';
import { BUSTA, GRAZIA } from './mazzi';

const REGIONI: Regione[] = [
  { nome: 'Valle d’Aosta', sigla: 'VDA', colore: 1, costoCasa: 50, costoAlbergo: 50 },
  { nome: 'Sardegna', sigla: 'SAR', colore: 2, costoCasa: 50, costoAlbergo: 50 },
  { nome: 'Toscana', sigla: 'TOS', colore: 3, costoCasa: 100, costoAlbergo: 100 },
  { nome: 'Sicilia', sigla: 'SIC', colore: 4, costoCasa: 100, costoAlbergo: 100 },
  { nome: 'Veneto', sigla: 'VEN', colore: 5, costoCasa: 150, costoAlbergo: 150 },
  { nome: 'Campania', sigla: 'CAM', colore: 6, costoCasa: 150, costoAlbergo: 150 },
  { nome: 'Lazio', sigla: 'LAZ', colore: 7, costoCasa: 150, costoAlbergo: 150 },
  { nome: 'Lombardia', sigla: 'LOM', colore: 8, costoCasa: 200, costoAlbergo: 200 },
];

function citta(nome: string, regione: number, prezzo: number, affitti: Affitti): Casella {
  return { tipo: 'citta', nome, regione, prezzo, affitti };
}

const CASELLE: Casella[] = [
  { tipo: 'partenza', nome: 'Partenza' },
  citta('Courmayeur', 0, 60, [3, 10, 35, 100, 140, 170]),
  { tipo: 'carta', nome: 'Busta', mazzo: 'busta' },
  citta('Aosta', 0, 70, [4, 15, 45, 120, 170, 200]),
  { tipo: 'tassa', nome: 'Imposta sul reddito', breve: 'Imposta', tassa: { tipo: 'percentuale', valore: 10 } },
  { tipo: 'stazione', nome: 'Stazione Nord', breve: 'Nord', prezzo: 200 },
  citta('Olbia', 1, 100, [6, 25, 70, 190, 260, 320]),
  citta('Sassari', 1, 110, [6, 25, 80, 220, 290, 360]),
  { tipo: 'carta', nome: 'Cartolina', mazzo: 'cartolina' },
  citta('Cagliari', 1, 120, [7, 30, 90, 250, 330, 400]),
  { tipo: 'prigione', nome: 'Prigione' },
  citta('Siena', 2, 140, [9, 35, 110, 300, 400, 490]),
  { tipo: 'servizio', nome: 'Rete elettrica', breve: 'Luce', prezzo: 150 },
  citta('Pisa', 2, 150, [10, 40, 120, 330, 440, 530]),
  citta('Firenze', 2, 160, [11, 45, 140, 360, 480, 580]),
  { tipo: 'stazione', nome: 'Stazione Est', breve: 'Est', prezzo: 200 },
  citta('Siracusa', 3, 180, [13, 55, 160, 430, 560, 680]),
  { tipo: 'carta', nome: 'Busta', mazzo: 'busta' },
  citta('Catania', 3, 190, [14, 60, 180, 460, 600, 730]),
  citta('Palermo', 3, 200, [15, 65, 190, 500, 650, 780]),
  { tipo: 'vacanza', nome: 'Vacanza' },
  citta('Padova', 4, 220, [17, 75, 220, 570, 740, 880]),
  { tipo: 'carta', nome: 'Cartolina', mazzo: 'cartolina' },
  citta('Verona', 4, 230, [18, 80, 230, 610, 780, 940]),
  citta('Venezia', 4, 250, [21, 90, 270, 680, 880, 1050]),
  { tipo: 'stazione', nome: 'Stazione Sud', breve: 'Sud', prezzo: 200 },
  citta('Caserta', 5, 260, [22, 95, 280, 720, 920, 1100]),
  { tipo: 'servizio', nome: 'Acquedotto', breve: 'Acqua', prezzo: 150 },
  citta('Salerno', 5, 270, [24, 100, 300, 760, 970, 1150]),
  citta('Napoli', 5, 290, [26, 110, 340, 850, 1075, 1275]),
  { tipo: 'vai_in_prigione', nome: 'Vai in prigione' },
  citta('Viterbo', 6, 300, [28, 120, 360, 890, 1125, 1325]),
  citta('Latina', 6, 310, [29, 130, 380, 930, 1175, 1400]),
  { tipo: 'carta', nome: 'Busta', mazzo: 'busta' },
  citta('Roma', 6, 330, [32, 140, 420, 1025, 1275, 1500]),
  { tipo: 'stazione', nome: 'Stazione Ovest', breve: 'Ovest', prezzo: 200 },
  { tipo: 'carta', nome: 'Cartolina', mazzo: 'cartolina' },
  citta('Bergamo', 7, 360, [37, 160, 480, 1150, 1425, 1675]),
  { tipo: 'tassa', nome: 'Tassa di soggiorno', breve: 'Soggiorno', tassa: { tipo: 'fissa', valore: 75 } },
  citta('Milano', 7, 400, [44, 190, 580, 1350, 1625, 1925]),
];

/** Cartolina: soprattutto spostamenti. */
const CARTOLINA: Carta[] = [
  { testo: 'Torna alla Partenza.', effetto: { tipo: 'vai_a', casella: 0 } },
  { testo: 'Vai a Siena.', effetto: { tipo: 'vai_a', casella: 11 } },
  { testo: 'Vai a Venezia.', effetto: { tipo: 'vai_a', casella: 24 } },
  { testo: 'Vai a Milano.', effetto: { tipo: 'vai_a', casella: 39 } },
  { testo: 'Vai alla Stazione Nord.', effetto: { tipo: 'vai_a', casella: 5 } },
  { testo: 'Vai alla stazione più vicina.', effetto: { tipo: 'prossima', casella: 'stazione' } },
  { testo: 'Vai al servizio più vicino.', effetto: { tipo: 'prossima', casella: 'servizio' } },
  { testo: 'Torna indietro di 3 caselle.', effetto: { tipo: 'passi', passi: -3 } },
  { testo: 'Vai in prigione.', effetto: { tipo: 'prigione' } },
  { testo: 'Dividendi delle tue azioni. Ricevi 50 €.', effetto: { tipo: 'soldi', importo: 50 } },
  { testo: 'Borsa di studio. Ricevi 100 €.', effetto: { tipo: 'soldi', importo: 100 } },
  { testo: 'Investimento riuscito. Ricevi 150 €.', effetto: { tipo: 'soldi', importo: 150 } },
  { testo: 'Tassa sui rifiuti. Paga 25 €.', effetto: { tipo: 'soldi', importo: -25 } },
  { testo: 'Aiuti un parente. Paga 50 €.', effetto: { tipo: 'soldi', importo: -50 } },
  { testo: 'Hai perso una scommessa. Paga 50 € a ogni giocatore.', effetto: { tipo: 'a_ognuno', importo: 50 } },
  {
    testo: 'Ristrutturazione. Paga 25 € per ogni casa e 100 € per ogni albergo.',
    effetto: { tipo: 'riparazioni', casa: 25, albergo: 100 },
  },
  GRAZIA,
];

export const CLASSICO: Tabellone = {
  id: 'classica',
  nome: 'Classico',
  descrizione: '40 caselle, 8 regioni italiane: il tabellone di sempre.',
  caselle: CASELLE,
  regioni: REGIONI,
  partenza: { passaggio: 200, arrivo: 300 },
  prigione: 10,
  cauzione: 50,
  affittiStazioni: [25, 50, 100, 200],
  moltiplicatoriServizi: [4, 10, 20],
  mazzi: { busta: BUSTA, cartolina: CARTOLINA },
};
