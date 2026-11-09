/*
 * Tabellone "Europa": 48 caselle (12 per lato), 10 paesi europei, 4 stazioni e 3 servizi.
 * Il giro è più lungo: si passa dalla Partenza meno spesso e l'economia è più tirata.
 * Nomi e struttura: docs/identita/tabelloni-alternativi.md. Affitti dalla scala del Classico (scala.ts).
 */

import type { Casella, Regione, Tabellone } from '../tipi';
import { BUSTA, cartolinaComune, viaggio } from './mazzi';
import { affittiPerPrezzo } from './scala';

const REGIONI: Regione[] = [
  { nome: 'Irlanda', sigla: 'IRL', colore: 1, costoCasa: 50, costoAlbergo: 50 },
  { nome: 'Svizzera', sigla: 'CHE', colore: 2, costoCasa: 50, costoAlbergo: 50 },
  { nome: 'Austria', sigla: 'AUT', colore: 3, costoCasa: 100, costoAlbergo: 100 },
  { nome: 'Grecia', sigla: 'GRC', colore: 4, costoCasa: 100, costoAlbergo: 100 },
  { nome: 'Portogallo', sigla: 'PRT', colore: 5, costoCasa: 100, costoAlbergo: 100 },
  { nome: 'Paesi Bassi', sigla: 'NLD', colore: 6, costoCasa: 150, costoAlbergo: 150 },
  { nome: 'Polonia', sigla: 'POL', colore: 7, costoCasa: 200, costoAlbergo: 200 },
  { nome: 'Spagna', sigla: 'ESP', colore: 8, costoCasa: 150, costoAlbergo: 150 },
  { nome: 'Francia', sigla: 'FRA', colore: 9, costoCasa: 200, costoAlbergo: 200 },
  { nome: 'Germania', sigla: 'DEU', colore: 10, costoCasa: 200, costoAlbergo: 200 },
];

function citta(nome: string, regione: number, prezzo: number, breve?: string): Casella {
  return { tipo: 'citta', nome, regione, prezzo, affitti: affittiPerPrezzo(prezzo), ...(breve ? { breve } : {}) };
}

const BUSTA_CASELLA: Casella = { tipo: 'carta', nome: 'Busta', mazzo: 'busta' };
const CARTOLINA_CASELLA: Casella = { tipo: 'carta', nome: 'Cartolina', mazzo: 'cartolina' };

const CASELLE: Casella[] = [
  { tipo: 'partenza', nome: 'Partenza' },
  citta('Galway', 0, 60),
  BUSTA_CASELLA,
  citta('Dublino', 0, 70),
  { tipo: 'tassa', nome: 'Imposta sul reddito', breve: 'Imposta', tassa: { tipo: 'percentuale', valore: 10 } },
  citta('Basilea', 1, 100),
  { tipo: 'stazione', nome: 'Stazione Nord', breve: 'Nord', prezzo: 200 },
  citta('Ginevra', 1, 100),
  CARTOLINA_CASELLA,
  citta('Zurigo', 1, 120),
  citta('Salisburgo', 2, 130),
  citta('Vienna', 2, 140),
  { tipo: 'prigione', nome: 'Prigione' },
  citta('Patrasso', 3, 150),
  citta('Salonicco', 3, 150),
  { tipo: 'servizio', nome: 'Rete elettrica', breve: 'Luce', prezzo: 150 },
  citta('Atene', 3, 170),
  BUSTA_CASELLA,
  { tipo: 'stazione', nome: 'Stazione Est', breve: 'Est', prezzo: 200 },
  citta('Braga', 4, 180),
  citta('Coimbra', 4, 180),
  { tipo: 'servizio', nome: 'Rete del gas', breve: 'Gas', prezzo: 150 },
  citta('Porto', 4, 190),
  citta('Lisbona', 4, 200),
  { tipo: 'vacanza', nome: 'Vacanza' },
  citta('Utrecht', 5, 220),
  CARTOLINA_CASELLA,
  citta('Rotterdam', 5, 220),
  citta('Amsterdam', 5, 240),
  citta('Cracovia', 6, 260),
  { tipo: 'stazione', nome: 'Stazione Sud', breve: 'Sud', prezzo: 200 },
  citta('Varsavia', 6, 270),
  { tipo: 'servizio', nome: 'Acquedotto', breve: 'Acqua', prezzo: 150 },
  citta('Siviglia', 7, 280),
  citta('Barcellona', 7, 280),
  citta('Madrid', 7, 300),
  { tipo: 'vai_in_prigione', nome: 'Vai in prigione' },
  citta('Lione', 8, 310),
  citta('Marsiglia', 8, 320),
  BUSTA_CASELLA,
  citta('Parigi', 8, 340),
  CARTOLINA_CASELLA,
  { tipo: 'stazione', nome: 'Stazione Ovest', breve: 'Ovest', prezzo: 200 },
  citta('Amburgo', 9, 350),
  citta('Monaco di Baviera', 9, 360, 'Monaco'),
  BUSTA_CASELLA,
  { tipo: 'tassa', nome: 'Tassa di soggiorno', breve: 'Soggiorno', tassa: { tipo: 'fissa', valore: 75 } },
  citta('Berlino', 9, 400),
];

const CARTOLINA = [
  viaggio('Torna alla Partenza.', 0),
  viaggio('Vai a Ginevra.', 7),
  viaggio('Vai a Lisbona.', 23),
  viaggio('Vai a Berlino.', 47),
  viaggio('Vai alla Stazione Nord.', 6),
  ...cartolinaComune({ servizi: true, indietro: 3 }),
];

export const EUROPA: Tabellone = {
  id: 'europa',
  nome: 'Europa',
  descrizione: '48 caselle e 10 paesi europei, con tre servizi: il giro è più lungo e si passa meno spesso dalla Partenza.',
  caselle: CASELLE,
  regioni: REGIONI,
  partenza: { passaggio: 200, arrivo: 300 },
  prigione: 12,
  cauzione: 50,
  affittiStazioni: [25, 50, 100, 200],
  moltiplicatoriServizi: [4, 10, 20],
  mazzi: { busta: BUSTA, cartolina: CARTOLINA },
};
