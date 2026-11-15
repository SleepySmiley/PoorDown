/*
 * Tabellone "Sistema solare": 48 caselle (12 per lato), con la struttura di Europa (stessi prezzi, stesse posizioni,
 * stessa economia) ma pianeti, lune e asteroidi al posto dei paesi. I nomi delle caselle sono posti veri:
 * crateri, vulcani, lune.
 * Quello che lo rende folle sono i mazzi: Busta e Cartolina sono solo sue, con le carte che esistono solo qui
 * (wormhole, scambio di posto, Robin Hood, buco nero, testa o croce, pioggia per tutti, tira di nuovo).
 * Affitti dalla scala del Classico (scala.ts).
 */

import type { Carta, Casella, Regione, Tabellone } from '../tipi';
import { viaggio } from './mazzi';
import { affittiPerPrezzo } from './scala';

const REGIONI: Regione[] = [
  { nome: 'Luna', sigla: 'LUN', colore: 1, bandiera: 'luna', costoCasa: 50, costoAlbergo: 50 },
  { nome: 'Mercurio', sigla: 'MER', colore: 2, bandiera: 'mercurio', costoCasa: 50, costoAlbergo: 50 },
  { nome: 'Venere', sigla: 'VEN', colore: 3, bandiera: 'venere', costoCasa: 100, costoAlbergo: 100 },
  { nome: 'Marte', sigla: 'MAR', colore: 4, bandiera: 'marte', costoCasa: 100, costoAlbergo: 100 },
  { nome: 'Fascia degli asteroidi', sigla: 'AST', colore: 5, bandiera: 'asteroidi', costoCasa: 100, costoAlbergo: 100 },
  { nome: 'Giove', sigla: 'GIO', colore: 6, bandiera: 'giove', costoCasa: 150, costoAlbergo: 150 },
  { nome: 'Saturno', sigla: 'SAT', colore: 7, bandiera: 'saturno', costoCasa: 200, costoAlbergo: 200 },
  { nome: 'Urano', sigla: 'URA', colore: 8, bandiera: 'urano', costoCasa: 150, costoAlbergo: 150 },
  { nome: 'Nettuno', sigla: 'NET', colore: 9, bandiera: 'nettuno', costoCasa: 200, costoAlbergo: 200 },
  { nome: 'Plutone', sigla: 'PLU', colore: 10, bandiera: 'plutone', costoCasa: 200, costoAlbergo: 200 },
];

function citta(nome: string, regione: number, prezzo: number, breve?: string): Casella {
  return { tipo: 'citta', nome, regione, prezzo, affitti: affittiPerPrezzo(prezzo), ...(breve ? { breve } : {}) };
}

const BUSTA_CASELLA: Casella = { tipo: 'carta', nome: 'Busta', mazzo: 'busta' };
const CARTOLINA_CASELLA: Casella = { tipo: 'carta', nome: 'Cartolina', mazzo: 'cartolina' };

const CASELLE: Casella[] = [
  { tipo: 'partenza', nome: 'Partenza' },
  citta('Tycho', 0, 60),
  BUSTA_CASELLA,
  citta('Copernico', 0, 70),
  { tipo: 'tassa', nome: 'Dogana galattica', breve: 'Dogana', tassa: { tipo: 'percentuale', valore: 10 } },
  citta('Caloris', 1, 100),
  { tipo: 'stazione', nome: 'Navetta', prezzo: 200 },
  citta('Beethoven', 1, 100),
  CARTOLINA_CASELLA,
  citta('Rembrandt', 1, 120),
  citta('Cleopatra', 2, 130),
  citta('Maxwell Montes', 2, 140, 'Maxwell'),
  { tipo: 'prigione', nome: 'Prigione' },
  citta('Jezero', 3, 150),
  citta('Valles Marineris', 3, 150, 'Marineris'),
  { tipo: 'servizio', nome: 'Ossigeno', prezzo: 150 },
  citta('Olympus Mons', 3, 170, 'Olympus'),
  BUSTA_CASELLA,
  { tipo: 'stazione', nome: 'Capsula', prezzo: 200 },
  citta('Igea', 4, 180),
  citta('Pallade', 4, 180),
  { tipo: 'servizio', nome: 'Gravità artificiale', breve: 'Gravità', prezzo: 150 },
  citta('Vesta', 4, 190),
  citta('Cerere', 4, 200),
  { tipo: 'vacanza', nome: 'Vacanza' },
  citta('Callisto', 5, 220),
  CARTOLINA_CASELLA,
  citta('Ganimede', 5, 220),
  citta('Io', 5, 240),
  citta('Encelado', 6, 260),
  { tipo: 'stazione', nome: 'Astronave', prezzo: 200 },
  citta('Titano', 6, 270),
  { tipo: 'servizio', nome: 'Rete Wi-Fi galattica', breve: 'Wi-Fi', prezzo: 150 },
  citta('Ariel', 7, 280),
  citta('Miranda', 7, 280),
  citta('Titania', 7, 300),
  { tipo: 'vai_in_prigione', nome: 'Vai in prigione' },
  citta('Proteo', 8, 310),
  citta('Nereide', 8, 320),
  BUSTA_CASELLA,
  citta('Tritone', 8, 340),
  CARTOLINA_CASELLA,
  { tipo: 'stazione', nome: 'Sonda', prezzo: 200 },
  citta('Idra', 9, 350),
  citta('Caronte', 9, 360),
  BUSTA_CASELLA,
  { tipo: 'tassa', nome: 'Autovelox della luce', breve: 'Autovelox', tassa: { tipo: 'fissa', valore: 75 } },
  citta('Sputnik Planitia', 9, 400, 'Sputnik'),
];

/** Busta: soprattutto soldi, con le carte folli che fanno girare il contante tra tutti. */
const BUSTA: Carta[] = [
  viaggio('Ti manca la mamma: torni sulla Terra. Vai alla Partenza.', 0),
  { testo: 'Vendi a un giornale il selfie con un alieno. Ricevi 150 €.', effetto: { tipo: 'soldi', importo: 150 } },
  { testo: 'Il tuo robot vince MasterChef Marte. Ricevi 100 €.', effetto: { tipo: 'soldi', importo: 100 } },
  { testo: 'Rimborso per il razzo arrivato con tre secoli di ritardo. Ricevi 75 €.', effetto: { tipo: 'soldi', importo: 75 } },
  { testo: 'Trovi un portafoglio che galleggia nello spazio. Ricevi 50 €.', effetto: { tipo: 'soldi', importo: 50 } },
  { testo: 'Pioggia di meteoriti d’oro: tutti i giocatori ricevono 50 €.', effetto: { tipo: 'tutti_soldi', importo: 50 } },
  { testo: 'Tassa galattica sull’ossigeno: tutti i giocatori pagano 50 €.', effetto: { tipo: 'tutti_soldi', importo: -50 } },
  { testo: 'Robin Hood spaziale: chi ha più contante dà 150 € a chi ne ha meno.', effetto: { tipo: 'robin_hood', importo: 150 } },
  {
    testo: 'Lanci una moneta in assenza di gravità. Testa: ricevi 200 €. Croce: paghi 200 €.',
    effetto: { tipo: 'moneta', importo: 200 },
  },
  { testo: 'Parcheggi l’astronave in doppia orbita. Paga 50 € di multa.', effetto: { tipo: 'soldi', importo: -50 } },
  { testo: 'Il gatto ha ordinato 300 kg di croccantini liofilizzati. Paga 100 €.', effetto: { tipo: 'soldi', importo: -100 } },
  { testo: 'Lavaggio a secco della tuta spaziale. Paga 40 €.', effetto: { tipo: 'soldi', importo: -40 } },
  {
    testo: 'È il tuo compleanno su Venere, dove un anno dura 225 giorni. Ogni giocatore ti dà 20 €.',
    effetto: { tipo: 'da_ognuno', importo: 20 },
  },
  {
    testo: 'Perdi a briscola contro un marziano che bara con sei braccia. Paga 30 € a ogni giocatore.',
    effetto: { tipo: 'a_ognuno', importo: 30 },
  },
  {
    testo: 'I topi lunari ti hanno rosicchiato i muri. Paga 40 € per ogni casa e 115 € per ogni albergo.',
    effetto: { tipo: 'riparazioni', casa: 40, albergo: 115 },
  },
  { testo: 'Ti risucchia un buco nero. Vai in prigione.', effetto: { tipo: 'prigione' } },
  {
    testo: 'Carta Grazia: un alieno corrompe le guardie per te. Esci gratis di prigione. Puoi tenerla o scambiarla.',
    effetto: { tipo: 'grazia' },
  },
];

/** Cartolina: soprattutto spostamenti, con wormhole, scambi di posto e il buco nero che si mangia gli avversari. */
const CARTOLINA: Carta[] = [
  viaggio('Torna sulla Terra: vai alla Partenza.', 0),
  viaggio('Gita in giornata sulla Luna. Vai a Copernico.', 3),
  viaggio('Vai a scalare l’Olympus Mons, il vulcano più alto del Sistema solare.', 16),
  viaggio('Vai a fare il bagno nei geyser di Encelado.', 29),
  viaggio('Vai a Sputnik Planitia, il cuore di Plutone.', 47),
  { testo: 'Autostop spaziale: vai al prossimo mezzo di trasporto.', effetto: { tipo: 'prossima', casella: 'stazione' } },
  { testo: 'Ti si scarica il telefono: vai al prossimo servizio.', effetto: { tipo: 'prossima', casella: 'servizio' } },
  { testo: 'Wormhole! Ti teletrasporti su una casella a caso.', effetto: { tipo: 'casuale' } },
  { testo: 'Starnutisci dentro il teletrasporto: finisci su una casella a caso.', effetto: { tipo: 'casuale' } },
  { testo: 'Scambio quantico: scambi il posto con un avversario a caso.', effetto: { tipo: 'scambia_posto' } },
  { testo: 'Buco nero! Tutti gli avversari vengono risucchiati in prigione.', effetto: { tipo: 'avversari_in_prigione' } },
  { testo: 'Gravità zero: tira di nuovo i dadi.', effetto: { tipo: 'rilancia' } },
  { testo: 'Retromarcia nell’iperspazio: torna indietro di 3 caselle.', effetto: { tipo: 'passi', passi: -3 } },
  { testo: 'Ti rapiscono gli alieni. Vai in prigione.', effetto: { tipo: 'prigione' } },
  { testo: 'Gli alieni ti riportano a casa e si scusano con 100 €.', effetto: { tipo: 'soldi', importo: 100 } },
  {
    testo: 'Testa o croce con un marziano. Testa: ricevi 100 €. Croce: paghi 100 €.',
    effetto: { tipo: 'moneta', importo: 100 },
  },
  { testo: 'Offri un giro di frullati di stelle. Paga 50 € a ogni giocatore.', effetto: { tipo: 'a_ognuno', importo: 50 } },
  {
    testo: 'Pioggia di asteroidi sui tetti. Paga 25 € per ogni casa e 100 € per ogni albergo.',
    effetto: { tipo: 'riparazioni', casa: 25, albergo: 100 },
  },
  {
    testo: 'Carta Grazia: il tuo avvocato è un ologramma bravissimo. Esci gratis di prigione. Puoi tenerla o scambiarla.',
    effetto: { tipo: 'grazia' },
  },
];

export const SISTEMA_SOLARE: Tabellone = {
  id: 'sistema_solare',
  nome: 'Sistema solare',
  descrizione:
    '48 caselle tra pianeti, lune e asteroidi, con carte folli: wormhole, scambi di posto, Robin Hood e buchi neri che risucchiano tutti.',
  caselle: CASELLE,
  regioni: REGIONI,
  partenza: { passaggio: 200, arrivo: 300 },
  prigione: 12,
  cauzione: 50,
  affittiStazioni: [25, 50, 100, 200],
  moltiplicatoriServizi: [4, 10, 20],
  mazzi: { busta: BUSTA, cartolina: CARTOLINA },
};
