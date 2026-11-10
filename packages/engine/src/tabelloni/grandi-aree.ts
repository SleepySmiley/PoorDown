/*
 * Tabellone "Grandi aree": 40 caselle, quattro gruppi enormi, uno per lato (Isole, Sud, Centro, Nord).
 * Completare un'area è difficile, ma chi ci riesce domina un lato intero.
 * Nomi e struttura: docs/identita/tabelloni-alternativi.md. Affitti dalla scala del Classico (scala.ts).
 */

import type { Bandiera, Casella, Regione, Tabellone } from '../tipi';
import { BUSTA, cartolinaComune, viaggio } from './mazzi';
import { affittiPerPrezzo } from './scala';

const REGIONI: Regione[] = [
  { nome: 'Isole', sigla: 'ISO', colore: 2, costoCasa: 50, costoAlbergo: 50 },
  { nome: 'Sud', sigla: 'SUD', colore: 4, costoCasa: 125, costoAlbergo: 125 },
  { nome: 'Centro', sigla: 'CEN', colore: 3, costoCasa: 150, costoAlbergo: 150 },
  { nome: 'Nord', sigla: 'NOR', colore: 8, costoCasa: 150, costoAlbergo: 150 },
];

/** Le aree non hanno una bandiera: ogni città porta quella della sua regione. */
function citta(nome: string, regione: number, bandiera: Bandiera, prezzo: number, breve?: string): Casella {
  return { tipo: 'citta', nome, regione, bandiera, prezzo, affitti: affittiPerPrezzo(prezzo), ...(breve ? { breve } : {}) };
}

const CASELLE: Casella[] = [
  { tipo: 'partenza', nome: 'Partenza' },
  citta('Oristano', 0, 'sardegna', 60),
  { tipo: 'carta', nome: 'Busta', mazzo: 'busta' },
  citta('Nuoro', 0, 'sardegna', 70),
  { tipo: 'tassa', nome: 'Imposta sul reddito', breve: 'Imposta', tassa: { tipo: 'percentuale', valore: 10 } },
  { tipo: 'stazione', nome: 'Stazione Nord', breve: 'Nord', prezzo: 200 },
  citta('Agrigento', 0, 'sicilia', 100),
  citta('Trapani', 0, 'sicilia', 110),
  { tipo: 'carta', nome: 'Cartolina', mazzo: 'cartolina' },
  citta('Messina', 0, 'sicilia', 120),
  { tipo: 'prigione', nome: 'Prigione' },
  citta('Campobasso', 1, 'molise', 140),
  { tipo: 'servizio', nome: 'Rete elettrica', breve: 'Luce', prezzo: 150 },
  citta('Potenza', 1, 'basilicata', 150),
  citta('Cosenza', 1, 'calabria', 160),
  { tipo: 'stazione', nome: 'Stazione Est', breve: 'Est', prezzo: 200 },
  citta('Pescara', 1, 'abruzzo', 170),
  { tipo: 'carta', nome: 'Busta', mazzo: 'busta' },
  citta('Reggio Calabria', 1, 'calabria', 180, 'Reggio C.'),
  citta('Bari', 1, 'puglia', 200),
  { tipo: 'vacanza', nome: 'Vacanza' },
  citta('Rieti', 2, 'lazio', 220),
  { tipo: 'carta', nome: 'Cartolina', mazzo: 'cartolina' },
  citta('Arezzo', 2, 'toscana', 230),
  citta('Terni', 2, 'umbria', 240),
  { tipo: 'stazione', nome: 'Stazione Sud', breve: 'Sud', prezzo: 200 },
  citta('Lucca', 2, 'toscana', 250),
  { tipo: 'servizio', nome: 'Acquedotto', breve: 'Acqua', prezzo: 150 },
  citta('Ancona', 2, 'marche', 260),
  citta('Perugia', 2, 'umbria', 280),
  { tipo: 'vai_in_prigione', nome: 'Vai in prigione' },
  citta('Udine', 3, 'friuli', 300),
  citta('Trento', 3, 'trentino', 310),
  { tipo: 'carta', nome: 'Busta', mazzo: 'busta' },
  citta('Genova', 3, 'liguria', 330),
  { tipo: 'stazione', nome: 'Stazione Ovest', breve: 'Ovest', prezzo: 200 },
  { tipo: 'carta', nome: 'Cartolina', mazzo: 'cartolina' },
  citta('Bologna', 3, 'emilia-romagna', 360),
  { tipo: 'tassa', nome: 'Tassa di soggiorno', breve: 'Soggiorno', tassa: { tipo: 'fissa', valore: 75 } },
  citta('Torino', 3, 'piemonte', 400),
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
