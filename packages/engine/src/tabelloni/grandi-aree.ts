/*
 * Tabellone "Grandi aree": 40 caselle, quattro gruppi enormi, uno per lato (Isole, Sud, Centro, Nord).
 * Completare un'area è difficile, ma chi ci riesce domina un lato intero.
 * Nomi e struttura: docs/identita/tabelloni-alternativi.md. Affitti dalla scala del Classico (scala.ts).
 */

import type { Casella, Regione, Tabellone } from '../tipi';
import { BUSTA, cartolinaComune, viaggio } from './mazzi';
import { affittiPerPrezzo } from './scala';

const REGIONI: Regione[] = [
  { nome: 'Isole', sigla: 'ISO', colore: 2, costoCasa: 50, costoAlbergo: 50 },
  { nome: 'Sud', sigla: 'SUD', colore: 4, costoCasa: 100, costoAlbergo: 100 },
  { nome: 'Centro', sigla: 'CEN', colore: 3, costoCasa: 150, costoAlbergo: 150 },
  { nome: 'Nord', sigla: 'NOR', colore: 8, costoCasa: 200, costoAlbergo: 200 },
];

function citta(nome: string, regione: number, prezzo: number, breve?: string): Casella {
  return { tipo: 'citta', nome, regione, prezzo, affitti: affittiPerPrezzo(prezzo), ...(breve ? { breve } : {}) };
}

const CASELLE: Casella[] = [
  { tipo: 'partenza', nome: 'Partenza' },
  citta('Oristano', 0, 60),
  { tipo: 'carta', nome: 'Busta', mazzo: 'busta' },
  citta('Nuoro', 0, 70),
  { tipo: 'tassa', nome: 'Imposta sul reddito', breve: 'Imposta', tassa: { tipo: 'percentuale', valore: 10 } },
  { tipo: 'stazione', nome: 'Stazione Nord', breve: 'Nord', prezzo: 200 },
  citta('Agrigento', 0, 100),
  citta('Trapani', 0, 110),
  { tipo: 'carta', nome: 'Cartolina', mazzo: 'cartolina' },
  citta('Messina', 0, 120),
  { tipo: 'prigione', nome: 'Prigione' },
  citta('Campobasso', 1, 140),
  { tipo: 'servizio', nome: 'Rete elettrica', breve: 'Luce', prezzo: 150 },
  citta('Potenza', 1, 150),
  citta('Cosenza', 1, 160),
  { tipo: 'stazione', nome: 'Stazione Est', breve: 'Est', prezzo: 200 },
  citta('Pescara', 1, 170),
  { tipo: 'carta', nome: 'Busta', mazzo: 'busta' },
  citta('Reggio Calabria', 1, 180, 'Reggio C.'),
  citta('Bari', 1, 200),
  { tipo: 'vacanza', nome: 'Vacanza' },
  citta('Rieti', 2, 220),
  { tipo: 'carta', nome: 'Cartolina', mazzo: 'cartolina' },
  citta('Arezzo', 2, 230),
  citta('Terni', 2, 240),
  { tipo: 'stazione', nome: 'Stazione Sud', breve: 'Sud', prezzo: 200 },
  citta('Lucca', 2, 250),
  { tipo: 'servizio', nome: 'Acquedotto', breve: 'Acqua', prezzo: 150 },
  citta('Ancona', 2, 260),
  citta('Perugia', 2, 280),
  { tipo: 'vai_in_prigione', nome: 'Vai in prigione' },
  citta('Udine', 3, 300),
  citta('Trento', 3, 310),
  { tipo: 'carta', nome: 'Busta', mazzo: 'busta' },
  citta('Genova', 3, 330),
  { tipo: 'stazione', nome: 'Stazione Ovest', breve: 'Ovest', prezzo: 200 },
  { tipo: 'carta', nome: 'Cartolina', mazzo: 'cartolina' },
  citta('Bologna', 3, 360),
  { tipo: 'tassa', nome: 'Tassa di soggiorno', breve: 'Soggiorno', tassa: { tipo: 'fissa', valore: 75 } },
  citta('Torino', 3, 400),
];

const CARTOLINA = [
  viaggio('Torna alla Partenza.', 0),
  viaggio('Vai a Campobasso.', 11),
  viaggio('Vai a Terni.', 24),
  viaggio('Vai a Torino.', 39),
  viaggio('Vai alla Stazione Nord.', 5),
  ...cartolinaComune({ servizi: true, indietro: 3 }),
];

export const GRANDI_AREE: Tabellone = {
  id: 'grandi_aree',
  nome: 'Grandi aree',
  descrizione: 'Ogni lato è una sola area d’Italia, da 5 o 6 città: completarla è difficile, ma vale un lato intero.',
  caselle: CASELLE,
  regioni: REGIONI,
  partenza: { passaggio: 200, arrivo: 300 },
  prigione: 10,
  cauzione: 50,
  affittiStazioni: [25, 50, 100, 200],
  moltiplicatoriServizi: [4, 10, 20],
  mazzi: { busta: BUSTA, cartolina: CARTOLINA },
};
