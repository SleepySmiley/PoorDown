/*
 * Tabellone "Colpo di fortuna": 40 caselle, località turistiche italiane solo su due lati (8 zone da 2).
 * Gli altri due lati sono quasi solo carte e tasse, più una casella Rimborso; niente servizi.
 * Nomi e struttura: docs/identita/tabelloni-alternativi.md. Affitti dalla scala del Classico (scala.ts).
 */

import type { Casella, Regione, Tabellone } from '../tipi';
import { BUSTA, cartolinaComune, viaggio } from './mazzi';
import { affittiPerPrezzo } from './scala';

const REGIONI: Regione[] = [
  { nome: 'Salento', sigla: 'SAL', colore: 1, bandiera: 'puglia', costoCasa: 50, costoAlbergo: 50 },
  { nome: 'Langhe', sigla: 'LAN', colore: 2, bandiera: 'piemonte', costoCasa: 50, costoAlbergo: 50 },
  { nome: 'Cinque Terre', sigla: 'CTE', colore: 3, bandiera: 'liguria', costoCasa: 100, costoAlbergo: 100 },
  { nome: 'Lago di Garda', sigla: 'GAR', colore: 4, bandiera: 'veneto', costoCasa: 100, costoAlbergo: 100 },
  { nome: 'Lago di Como', sigla: 'COM', colore: 5, bandiera: 'lombardia', costoCasa: 150, costoAlbergo: 150 },
  { nome: 'Costiera amalfitana', sigla: 'AMA', colore: 6, bandiera: 'campania', costoCasa: 150, costoAlbergo: 150 },
  { nome: 'Dolomiti', sigla: 'DOL', colore: 7, bandiera: 'trentino', costoCasa: 200, costoAlbergo: 200 },
  { nome: 'Costa Smeralda', sigla: 'SME', colore: 8, bandiera: 'sardegna', costoCasa: 200, costoAlbergo: 200 },
];

function citta(nome: string, regione: number, prezzo: number, breve?: string): Casella {
  return { tipo: 'citta', nome, regione, prezzo, affitti: affittiPerPrezzo(prezzo), ...(breve ? { breve } : {}) };
}

const BUSTA_CASELLA: Casella = { tipo: 'carta', nome: 'Busta', mazzo: 'busta' };
const CARTOLINA_CASELLA: Casella = { tipo: 'carta', nome: 'Cartolina', mazzo: 'cartolina' };

const CASELLE: Casella[] = [
  { tipo: 'partenza', nome: 'Partenza' },
  citta('Gallipoli', 0, 60),
  citta('Otranto', 0, 80),
  citta('Barolo', 1, 100),
  citta('Alba', 1, 120),
  { tipo: 'stazione', nome: 'Stazione Nord', breve: 'Nord', prezzo: 200 },
  citta('Vernazza', 2, 140),
  citta('Monterosso', 2, 160),
  citta('Bardolino', 3, 180),
  citta('Malcesine', 3, 200),
  { tipo: 'prigione', nome: 'Prigione' },
  BUSTA_CASELLA,
  CARTOLINA_CASELLA,
  { tipo: 'tassa', nome: 'Imposta sul reddito', breve: 'Imposta', tassa: { tipo: 'percentuale', valore: 10 } },
  BUSTA_CASELLA,
  { tipo: 'stazione', nome: 'Stazione Est', breve: 'Est', prezzo: 200 },
  CARTOLINA_CASELLA,
  { tipo: 'tassa', nome: 'Tassa di soggiorno', breve: 'Soggiorno', tassa: { tipo: 'fissa', valore: 75 } },
  BUSTA_CASELLA,
  CARTOLINA_CASELLA,
  { tipo: 'vacanza', nome: 'Vacanza' },
  citta('Varenna', 4, 220),
  citta('Bellagio', 4, 240),
  citta('Amalfi', 5, 260),
  citta('Positano', 5, 280),
  { tipo: 'stazione', nome: 'Stazione Sud', breve: 'Sud', prezzo: 200 },
  citta('Ortisei', 6, 300),
  citta('Canazei', 6, 320),
  citta('Arzachena', 7, 350),
  citta('Porto Cervo', 7, 400),
  { tipo: 'vai_in_prigione', nome: 'Vai in prigione' },
  CARTOLINA_CASELLA,
  BUSTA_CASELLA,
  { tipo: 'tassa', nome: 'Pedaggio', tassa: { tipo: 'fissa', valore: 50 } },
  CARTOLINA_CASELLA,
  { tipo: 'stazione', nome: 'Stazione Ovest', breve: 'Ovest', prezzo: 200 },
  BUSTA_CASELLA,
  { tipo: 'premio', nome: 'Rimborso', importo: 50 },
  CARTOLINA_CASELLA,
  BUSTA_CASELLA,
];

/** Più mete delle altre Cartoline: su questo tabellone il caso conta di più. */
const CARTOLINA = [
  viaggio('Torna alla Partenza.', 0),
  viaggio('Vai a Otranto.', 2),
  viaggio('Vai ad Alba.', 4),
  viaggio('Vai a Monterosso.', 7),
  viaggio('Vai a Malcesine.', 9),
  viaggio('Vai a Bellagio.', 22),
  viaggio('Vai a Positano.', 24),
  viaggio('Vai a Canazei.', 27),
  viaggio('Vai a Porto Cervo.', 29),
  ...cartolinaComune({ servizi: false, indietro: 1 }),
];

export const FORTUNA: Tabellone = {
  id: 'fortuna',
  nome: 'Colpo di fortuna',
  descrizione: 'Località di vacanza solo su due lati; gli altri due sono carte, tasse e un Rimborso. Conta molto la fortuna.',
  caselle: CASELLE,
  regioni: REGIONI,
  partenza: { passaggio: 200, arrivo: 300 },
  prigione: 10,
  cauzione: 50,
  affittiStazioni: [40, 80, 160, 280],
  moltiplicatoriServizi: [4, 10, 20],
  mazzi: { busta: BUSTA, cartolina: CARTOLINA },
};
