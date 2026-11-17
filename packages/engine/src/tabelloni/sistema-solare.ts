/*
 * Tabellone "Sistema solare": 48 caselle (12 per lato) di caos, diverso apposta da tutti gli altri.
 * - Equilibrio sballato: gruppi da 1 a 5 caselle, Plutone (declassato) costa 10 €, le lune di Giove una follia,
 *   negli asteroidi c'è Psiche, il sasso di metallo che costa come tutti gli altri insieme.
 * - Caselle folli: fionde gravitazionali, wormhole, Buco nero e Supernova (il malloppo, con il suo dado), Roulette cosmica.
 * - Regole folli (`follie`): affitto quantistico, Partenza a caso, un evento cosmico a ogni giro, Mercato galattico.
 * - Busta e Cartolina solo sue, con le carte che esistono solo qui.
 * I nomi delle caselle sono posti veri: crateri, vulcani, lune, asteroidi.
 */

import type { Affitti, Carta, Casella, Follie, Regione, Tabellone } from '../tipi';
import { viaggio } from './mazzi';
import { affittiPerPrezzo } from './scala';

const REGIONI: Regione[] = [
  { nome: 'Luna', sigla: 'LUN', colore: 1, bandiera: 'luna', costoCasa: 50, costoAlbergo: 50 },
  { nome: 'Mercurio', sigla: 'MER', colore: 2, bandiera: 'mercurio', costoCasa: 100, costoAlbergo: 100 },
  { nome: 'Venere', sigla: 'VEN', colore: 3, bandiera: 'venere', costoCasa: 100, costoAlbergo: 100 },
  // Cinque asteroidi con le case a 50 €, Psiche compresa: chi li prende tutti fa il colpo della partita.
  { nome: 'Fascia degli asteroidi', sigla: 'AST', colore: 5, bandiera: 'asteroidi', costoCasa: 50, costoAlbergo: 50 },
  { nome: 'Marte', sigla: 'MAR', colore: 4, bandiera: 'marte', costoCasa: 100, costoAlbergo: 100 },
  { nome: 'Urano', sigla: 'URA', colore: 8, bandiera: 'urano', costoCasa: 150, costoAlbergo: 150 },
  { nome: 'Saturno', sigla: 'SAT', colore: 7, bandiera: 'saturno', costoCasa: 200, costoAlbergo: 200 },
  { nome: 'Nettuno', sigla: 'NET', colore: 9, bandiera: 'nettuno', costoCasa: 200, costoAlbergo: 200 },
  { nome: 'Giove', sigla: 'GIO', colore: 6, bandiera: 'giove', costoCasa: 300, costoAlbergo: 300 },
  { nome: 'Plutone', sigla: 'PLU', colore: 10, bandiera: 'plutone', costoCasa: 10, costoAlbergo: 10 },
];

/** Città con gli affitti della scala del Classico, oppure con affitti scritti a mano (fuori scala: Giove, Plutone). */
function citta(nome: string, regione: number, prezzo: number, opzioni: { breve?: string; affitti?: Affitti } = {}): Casella {
  return {
    tipo: 'citta',
    nome,
    regione,
    prezzo,
    affitti: opzioni.affitti ?? affittiPerPrezzo(prezzo),
    ...(opzioni.breve ? { breve: opzioni.breve } : {}),
  };
}

const BUSTA_CASELLA: Casella = { tipo: 'carta', nome: 'Busta', mazzo: 'busta' };
const CARTOLINA_CASELLA: Casella = { tipo: 'carta', nome: 'Cartolina', mazzo: 'cartolina' };
const ROULETTE: Casella = { tipo: 'roulette', nome: 'Roulette cosmica', breve: 'Roulette' };
const WORMHOLE: Casella = { tipo: 'wormhole', nome: 'Wormhole' };
const FIONDA: Casella = { tipo: 'fionda', nome: 'Fionda gravitazionale', breve: 'Fionda' };

/** Indici delle caselle a cui portano carte e spicchi. */
const SUPERNOVA = 41;

const CASELLE: Casella[] = [
  { tipo: 'partenza', nome: 'Partenza' },
  citta('Tycho', 0, 60),
  ROULETTE,
  citta('Copernico', 0, 70),
  WORMHOLE,
  citta('Bacino Caloris', 1, 150, { breve: 'Caloris' }),
  { tipo: 'stazione', nome: 'Navetta', prezzo: 200 },
  citta('Cleopatra', 2, 120),
  CARTOLINA_CASELLA,
  citta('Maxwell Montes', 2, 140, { breve: 'Maxwell' }),
  citta('Igea', 3, 80),
  citta('Pallade', 3, 80),
  { tipo: 'prigione', nome: 'Prigione' },
  citta('Vesta', 3, 90),
  FIONDA,
  citta('Cerere', 3, 100),
  citta('Psiche', 3, 350),
  BUSTA_CASELLA,
  { tipo: 'stazione', nome: 'Capsula', prezzo: 200 },
  citta('Jezero', 4, 160),
  { tipo: 'servizio', nome: 'Ossigeno', prezzo: 150 },
  citta('Valles Marineris', 4, 170, { breve: 'Marineris' }),
  { tipo: 'buco_nero', nome: 'Buco nero' },
  citta('Olympus Mons', 4, 200, { breve: 'Olympus' }),
  { tipo: 'vacanza', nome: 'Vacanza' },
  citta('Ariel', 5, 220),
  ROULETTE,
  citta('Miranda', 5, 240),
  citta('Encelado', 6, 260),
  WORMHOLE,
  { tipo: 'stazione', nome: 'Astronave', prezzo: 200 },
  citta('Titano', 6, 280),
  citta('Anelli di Saturno', 6, 300, { breve: 'Anelli' }),
  CARTOLINA_CASELLA,
  citta('Proteo', 7, 300),
  citta('Nereide', 7, 310),
  { tipo: 'vai_in_prigione', nome: 'Vai in prigione' },
  citta('Tritone', 7, 340),
  FIONDA,
  citta('Io', 8, 450, { affitti: [50, 220, 650, 1500, 1850, 2200] }),
  citta('Europa', 8, 480, { affitti: [55, 240, 700, 1600, 1950, 2300] }),
  { tipo: 'supernova', nome: 'Supernova' },
  { tipo: 'stazione', nome: 'Sonda', prezzo: 200 },
  citta('Ganimede', 8, 520, { affitti: [65, 260, 780, 1800, 2150, 2550] }),
  { tipo: 'servizio', nome: 'Rete Wi-Fi galattica', breve: 'Wi-Fi', prezzo: 150 },
  citta('Callisto', 8, 500, { affitti: [60, 250, 750, 1700, 2050, 2400] }),
  BUSTA_CASELLA,
  // Declassato a pianeta nano: costa 10 €, e anche le sue case.
  citta('Plutone', 9, 10, { affitti: [1, 5, 15, 40, 70, 100] }),
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

/** Cartolina: soprattutto spostamenti, con wormhole, scambi di posto, gravità invertita e il buco nero sugli avversari. */
const CARTOLINA: Carta[] = [
  viaggio('Torna sulla Terra: vai alla Partenza.', 0),
  viaggio('Gita in giornata sulla Luna. Vai a Copernico.', 3),
  viaggio('Vai a scalare l’Olympus Mons, il vulcano più alto del Sistema solare.', 23),
  viaggio('Vai a fare il bagno nei geyser di Encelado.', 28),
  viaggio('Vai a Plutone: tanto costa 10 €.', 47),
  viaggio('Vai alla Supernova a prenderti il malloppo.', SUPERNOVA),
  { testo: 'Autostop spaziale: vai al prossimo mezzo di trasporto.', effetto: { tipo: 'prossima', casella: 'stazione' } },
  { testo: 'Ti si scarica il telefono: vai al prossimo servizio.', effetto: { tipo: 'prossima', casella: 'servizio' } },
  { testo: 'Wormhole! Ti teletrasporti su una casella a caso.', effetto: { tipo: 'casuale' } },
  { testo: 'Starnutisci dentro il teletrasporto: finisci su una casella a caso.', effetto: { tipo: 'casuale' } },
  { testo: 'Scambio quantico: scambi il posto con un avversario a caso.', effetto: { tipo: 'scambia_posto' } },
  { testo: 'Buco nero! Tutti gli avversari vengono risucchiati in prigione.', effetto: { tipo: 'avversari_in_prigione' } },
  { testo: 'Inverti la gravità: fino alla fine del giro tutti camminano al contrario.', effetto: { tipo: 'inverti' } },
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

const FOLLIE: Follie = {
  // Da gratis a ×3: in media un affitto vale un quarto in più, ma nessuno è sicuro.
  quantico: [0, 0.5, 1, 1, 2, 3],
  // Da 0 a 400 € a passi di 50: in media 200 €, come sugli altri tabelloni; fermandosi sopra, 100 € in più.
  partenza: { min: 0, max: 400, passo: 50, arrivo: 100 },
  eventi: ['quiete', 'allineamento', 'eclissi', 'tempesta', 'meteoriti', 'gravita', 'collisione'],
  mercato: [0.5, 2],
  bucoNero: 20,
  // La Supernova parte da 100 € e cresce anche senza buchi neri: 50 € a ogni giro, 25 € a ogni pedina che ci passa sopra.
  malloppo: 100,
  crescitaGiro: 50,
  polvere: 25,
  // Il suo dado: da ×½ (metà del malloppo, il resto aspetta il prossimo) a ×2. In media ×1,4.
  // Niente ×3: a fine partita, con i buchi neri sui contanti grossi, regalava colpi da quasi 30.000 €.
  supernova: [0.5, 1, 1, 2, 2, 2],
  // Con la Supernova nessuno supera 4.000 € di contante: il resto va all'avversario più povero.
  tetto: 4000,
  // Il dado cosmico, tirato a ogni lancio con i due dadi: sei facce tutte diverse, ma truccato.
  // Il Razzo esce una volta su tre (5 su 15), le altre facce 2 volte su 15 ciascuna.
  dadoCosmico: [
    { faccia: 'razzo', peso: 5 },
    { faccia: 'saldi', peso: 2 },
    { faccia: 'bandiera', peso: 2 },
    { faccia: 'scudo', peso: 2 },
    { faccia: 'faro', peso: 2 },
    { faccia: 'iperspazio', peso: 2 },
  ],
  // Otto spicchi, come le fette della ruota.
  roulette: [
    { testo: 'Jackpot cosmico! Ricevi 300 €.', effetto: { tipo: 'soldi', importo: 300 } },
    { testo: 'Buco nel portafoglio: perdi metà del contante (al massimo 500 €).', effetto: { tipo: 'meta_contante', massimo: 500 } },
    { testo: 'Fan club alieno: ogni giocatore ti dà 50 €.', effetto: { tipo: 'da_ognuno', importo: 50 } },
    { testo: 'Offri da bere a tutta la galassia: paga 50 € a ogni giocatore.', effetto: { tipo: 'a_ognuno', importo: 50 } },
    { testo: 'Wormhole! Ti teletrasporti su una casella a caso.', effetto: { tipo: 'casuale' } },
    { testo: 'Eccesso di velocità della luce: vai in prigione.', effetto: { tipo: 'prigione' } },
    { testo: 'Gravità invertita: fino alla fine del giro tutti camminano al contrario.', effetto: { tipo: 'inverti' } },
    { testo: 'Dritto alla Supernova a prenderti il malloppo!', effetto: { tipo: 'vai_a', casella: SUPERNOVA } },
  ],
};

export const SISTEMA_SOLARE: Tabellone = {
  id: 'sistema_solare',
  nome: 'Sistema solare',
  descrizione:
    'Caos puro: affitti quantistici, Partenza a caso, un evento cosmico a ogni giro, wormhole, fionde, roulette e un buco nero. Prezzi sballati apposta.',
  caselle: CASELLE,
  regioni: REGIONI,
  partenza: { passaggio: 200, arrivo: 300 },
  prigione: 12,
  cauzione: 50,
  affittiStazioni: [25, 50, 100, 200],
  moltiplicatoriServizi: [4, 10],
  mazzi: { busta: BUSTA, cartolina: CARTOLINA },
  follie: FOLLIE,
};
