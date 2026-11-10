/*
 * Tabellone "Grandi aree": 40 caselle, quattro gruppi enormi, uno per lato: una regione intera ciascuno,
 * con la sua bandiera (Sicilia, Puglia, Toscana, Veneto). Completarne una è difficile, ma chi ci riesce
 * domina un lato intero.
 * Nomi e struttura: docs/identita/tabelloni-alternativi.md. Affitti dalla scala del Classico (scala.ts).
 */

import type { Casella, Regione, Tabellone } from '../tipi';
import { BUSTA, cartolinaComune, viaggio } from './mazzi';
import { affittiPerPrezzo } from './scala';

const REGIONI: Regione[] = [
  { nome: 'Sicilia', sigla: 'SIC', colore: 2, bandiera: 'sicilia', costoCasa: 50, costoAlbergo: 50 },
  { nome: 'Puglia', sigla: 'PUG', colore: 4, bandiera: 'puglia', costoCasa: 125, costoAlbergo: 125 },
  { nome: 'Toscana', sigla: 'TOS', colore: 3, bandiera: 'toscana', costoCasa: 150, costoAlbergo: 150 },
  { nome: 'Veneto', sigla: 'VEN', colore: 8, bandiera: 'veneto', costoCasa: 150, costoAlbergo: 150 },
];

function citta(nome: string, regione: number, prezzo: number, breve?: string): Casella {
  return { tipo: 'citta', nome, regione, prezzo, affitti: affittiPerPrezzo(prezzo), ...(breve ? { breve } : {}) };
}

const CASELLE: Casella[] = [
  { tipo: 'partenza', nome: 'Partenza' },
  citta('Trapani', 0, 60),
  { tipo: 'carta', nome: 'Busta', mazzo: 'busta' },
  citta('Agrigento', 0, 70),
  { tipo: 'tassa', nome: 'Imposta sul reddito', breve: 'Imposta', tassa: { tipo: 'percentuale', valore: 10 } },
  { tipo: 'stazione', nome: 'Stazione Nord', breve: 'Nord', prezzo: 200 },
  citta('Messina', 0, 100),
  citta('Catania', 0, 110),
  { tipo: 'carta', nome: 'Cartolina', mazzo: 'cartolina' },
  citta('Palermo', 0, 120),
  { tipo: 'prigione', nome: 'Prigione' },
  citta('Foggia', 1, 140),
  { tipo: 'servizio', nome: 'Rete elettrica', breve: 'Luce', prezzo: 150 },
  citta('Brindisi', 1, 150),
  citta('Taranto', 1, 160),
  { tipo: 'stazione', nome: 'Stazione Est', breve: 'Est', prezzo: 200 },
  citta('Lecce', 1, 170),
  { tipo: 'carta', nome: 'Busta', mazzo: 'busta' },
  citta('Barletta', 1, 180),
  citta('Bari', 1, 200),
  { tipo: 'vacanza', nome: 'Vacanza' },
  citta('Arezzo', 2, 220),
  { tipo: 'carta', nome: 'Cartolina', mazzo: 'cartolina' },
  citta('Pisa', 2, 230),
  citta('Livorno', 2, 240),
  { tipo: 'stazione', nome: 'Stazione Sud', breve: 'Sud', prezzo: 200 },
  citta('Lucca', 2, 250),
  { tipo: 'servizio', nome: 'Acquedotto', breve: 'Acqua', prezzo: 150 },
  citta('Siena', 2, 260),
  citta('Firenze', 2, 280),
  { tipo: 'vai_in_prigione', nome: 'Vai in prigione' },
  citta('Casalserugo', 3, 300),
  citta('San Pietro Viminario', 3, 310),
  { tipo: 'carta', nome: 'Busta', mazzo: 'busta' },
  citta('Abano Terme', 3, 330),
  { tipo: 'stazione', nome: 'Stazione Ovest', breve: 'Ovest', prezzo: 200 },
  { tipo: 'carta', nome: 'Cartolina', mazzo: 'cartolina' },
  citta('Vigodarzere', 3, 360),
  { tipo: 'tassa', nome: 'Tassa di soggiorno', breve: 'Soggiorno', tassa: { tipo: 'fissa', valore: 75 } },
  citta('Mestrino', 3, 400),
];

const CARTOLINA = [
  viaggio('Torna alla Partenza.', 0),
  viaggio('Vai a Foggia.', 11),
  viaggio('Vai a Livorno.', 24),
  viaggio('Vai a Mestrino.', 39),
  viaggio('Vai alla Stazione Nord.', 5),
  ...cartolinaComune({ servizi: true, indietro: 3 }),
];

export const GRANDI_AREE: Tabellone = {
  id: 'grandi_aree',
  nome: 'Grandi aree',
  descrizione: 'Ogni lato è una sola regione d’Italia, da 5 o 6 città: completarla è difficile, ma vale un lato intero.',
  caselle: CASELLE,
  regioni: REGIONI,
  partenza: { passaggio: 200, arrivo: 300 },
  prigione: 10,
  cauzione: 50,
  affittiStazioni: [25, 50, 100, 200],
  moltiplicatoriServizi: [4, 10, 20],
  mazzi: { busta: BUSTA, cartolina: CARTOLINA },
};
