/*
 * Tabellone "Giro del mondo": 48 caselle (12 per lato) di posti veri ma assurdi, scelti per il nome o per una stranezza.
 * - I paesi sono sparpagliati: le loro città stanno su lati diversi, e per completarne uno conviene volare.
 * - Gruppi da 1 a 4 città, prezzi a casaccio: Å costa 1 € (una lettera), Bangkok col nome completo 168 € (un euro
 *   a lettera), Hell 666 €, Yaren 10 € (è la capitale di un paese che per legge non ne ha), il Vaticano 500 €.
 * - Regole sue (`viaggi`): invece di tirare i dadi si può comprare un biglietto e volare dove si vuole; chi cade
 *   sulla proprietà di un avversario può sfidarlo a morra cinese invece di pagare.
 * - Tre caselle strane: il Triangolo delle Bermuda, la Linea del cambio di data, la Buca per l'altra parte del mondo.
 * - Il passaporto: si vola solo dopo essere passati dalla Partenza, così al primo turno nessuno fa la corsa ai paesi
 *   da una città sola (con la corsa, chi giocava per terzo prendeva Bangkok e vinceva il 40% delle partite).
 * - Servizi con il moltiplicatore doppio: chi vola li evita.
 * Equilibrio misurato con 800 partite di 4 bot: vittorie per posto 26 · 21 · 27 · 27%, come su Europa.
 * - Busta e Cartolina solo sue, con testi comici come sul Sistema solare.
 * - Tre carte rare che escono al posto di Busta e Cartolina: Bancarotta, Vita extra e Reset. Con loro l'ultimo rimasto
 *   non vince subito: deve giocare ancora qualche turno, perché chi è in bancarotta può rientrare.
 */

import type { Affitti, Carta, CarteRare, Casella, Regione, Tabellone, Viaggi } from '../tipi';
import { viaggio } from './mazzi';
import { affittiPerPrezzo } from './scala';

const REGIONI: Regione[] = [
  { nome: 'Nauru', sigla: 'NRU', colore: 1, bandiera: 'NR', costoCasa: 10, costoAlbergo: 10 },
  { nome: 'Norvegia', sigla: 'NOR', colore: 2, bandiera: 'NO', costoCasa: 150, costoAlbergo: 150 },
  { nome: 'Canada', sigla: 'CAN', colore: 3, bandiera: 'CA', costoCasa: 50, costoAlbergo: 50 },
  // L'Italia d'America: quattro paesi veri con il nome di una città italiana, uno per lato.
  { nome: 'Stati Uniti', sigla: 'USA', colore: 4, bandiera: 'US', costoCasa: 100, costoAlbergo: 100 },
  { nome: 'Australia', sigla: 'AUS', colore: 5, bandiera: 'AU', costoCasa: 100, costoAlbergo: 100 },
  { nome: 'Thailandia', sigla: 'THA', colore: 6, bandiera: 'TH', costoCasa: 100, costoAlbergo: 100 },
  { nome: 'Bolivia', sigla: 'BOL', colore: 7, bandiera: 'BO', costoCasa: 150, costoAlbergo: 150 },
  { nome: 'Turchia', sigla: 'TUR', colore: 8, bandiera: 'TR', costoCasa: 150, costoAlbergo: 150 },
  { nome: 'Russia', sigla: 'RUS', colore: 9, bandiera: 'RU', costoCasa: 200, costoAlbergo: 200 },
  { nome: 'Argentina', sigla: 'ARG', colore: 10, bandiera: 'AR', costoCasa: 200, costoAlbergo: 200 },
  { nome: 'Vaticano', sigla: 'VAT', colore: 11, bandiera: 'VA', costoCasa: 300, costoAlbergo: 300 },
];

/** Città con gli affitti della scala del Classico, oppure con affitti scritti a mano (fuori scala: Å, Hell, Yaren, Vaticano). */
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

function aeroporto(nome: string): Casella {
  return { tipo: 'stazione', nome: `Aeroporto di ${nome}`, breve: nome, prezzo: 200 };
}

const BUSTA_CASELLA: Casella = { tipo: 'carta', nome: 'Busta', mazzo: 'busta' };
const CARTOLINA_CASELLA: Casella = { tipo: 'carta', nome: 'Cartolina', mazzo: 'cartolina' };

/** Il nome cerimoniale di Bangkok: 168 lettere, il nome di città più lungo del mondo. Costa un euro a lettera. */
const BANGKOK =
  'Krung Thep Maha Nakhon Amon Rattanakosin Mahinthara Ayuthaya Mahadilok Phop Noppharat Ratchathani Burirom ' +
  'Udomratchaniwet Mahasathan Amon Piman Awatan Sathit Sakkathattiya Witsanukam Prasit';
const LETTERE_BANGKOK = BANGKOK.replace(/ /g, '').length;

const CASELLE: Casella[] = [
  { tipo: 'partenza', nome: 'Partenza' },
  // Lo Stato più piccolo del mondo, ma subito dopo la Partenza e carissimo.
  citta('Città del Vaticano', 10, 500, { breve: 'Vaticano', affitti: [60, 260, 780, 1800, 2150, 2550] }),
  BUSTA_CASELLA,
  // Il nome più corto del mondo: una lettera, un euro.
  citta('Å', 1, 1, { affitti: [1, 3, 9, 27, 50, 80] }),
  { tipo: 'tassa', nome: 'Imposta sul reddito', breve: 'Imposta', tassa: { tipo: 'percentuale', valore: 10 } },
  citta('Italy', 3, 100),
  aeroporto('Barra'),
  // Le due capitali della Bolivia stanno una di fronte all'altra: 24 caselle di distanza.
  citta('Sucre', 6, 220),
  CARTOLINA_CASELLA,
  // Batman esiste davvero, in Turchia. È anche dove sbuca chi scava la Buca per l'altra parte del mondo.
  citta('Batman', 7, 280),
  citta('Wagga Wagga', 4, 160),
  { tipo: 'bermuda', nome: 'Triangolo delle Bermuda', breve: 'Bermuda' },
  { tipo: 'prigione', nome: 'Prigione' },
  citta('Saint-Louis-du-Ha! Ha!', 2, 120, { breve: 'Ha! Ha!' }),
  citta('Rome', 3, 140),
  { tipo: 'servizio', nome: 'Adattatore universale', breve: 'Adattatore', prezzo: 150 },
  // Il paese abitato più freddo del mondo.
  citta('Ojmjakon', 8, 300),
  BUSTA_CASELLA,
  aeroporto('Lukla'),
  citta(BANGKOK, 5, LETTERE_BANGKOK, { breve: 'Bangkok' }),
  citta('Flin Flon', 2, 100),
  { tipo: 'cambio_data', nome: 'Linea del cambio di data', breve: 'Cambio data' },
  CARTOLINA_CASELLA,
  citta('Woolloomooloo', 4, 200),
  { tipo: 'vacanza', nome: 'Vacanza' },
  // Su due continenti.
  citta('Istanbul', 7, 260),
  BUSTA_CASELLA,
  CARTOLINA_CASELLA,
  citta('Moose Jaw', 2, 140),
  // Il pezzo di Russia fuori dalla Russia.
  citta('Kaliningrad', 8, 320),
  aeroporto('Gibilterra'),
  citta('La Paz', 6, 220),
  CARTOLINA_CASELLA,
  { tipo: 'antipodi', nome: 'Buca per l’altra parte del mondo', breve: 'Antipodi' },
  citta('Venice', 3, 160),
  // L'inferno costa 666 €, ed è subito prima di Vai in prigione.
  citta('Hell', 1, 666, { affitti: [66, 266, 666, 1466, 1766, 2066] }),
  { tipo: 'vai_in_prigione', nome: 'Vai in prigione' },
  // Dove è vietato morire: nel permafrost non si seppellisce nessuno.
  citta('Longyearbyen', 1, 150),
  BUSTA_CASELLA,
  // La città costruita sottoterra.
  citta('Coober Pedy', 4, 220),
  { tipo: 'servizio', nome: 'Rete Wi-Fi di bordo', breve: 'Wi-Fi', prezzo: 150 },
  citta('Milan', 3, 180),
  aeroporto('Saba'),
  CARTOLINA_CASELLA,
  { tipo: 'tassa', nome: 'Supplemento bagaglio', breve: 'Bagaglio', tassa: { tipo: 'fissa', valore: 75 } },
  // La capitale che per legge non esiste: Nauru non ne ha una ufficiale.
  citta('Yaren', 0, 10, { affitti: [1, 5, 15, 40, 70, 100] }),
  BUSTA_CASELLA,
  // La fine del mondo, l'ultima casella prima della Partenza.
  citta('Ushuaia', 9, 400),
];

/** Busta: soprattutto soldi. */
const BUSTA: Carta[] = [
  viaggio('Ti scade il passaporto: torna alla Partenza a rifarlo.', 0),
  {
    testo: 'La compagnia aerea ti risarcisce la valigia finita in Nuova Zelanda. Ricevi 150 €.',
    effetto: { tipo: 'soldi', importo: 150 },
  },
  { testo: 'Vendi a un giornale il selfie con un canguro. Ricevi 100 €.', effetto: { tipo: 'soldi', importo: 100 } },
  { testo: 'Rimborso per il volo con 14 ore di ritardo. Ricevi 75 €.', effetto: { tipo: 'soldi', importo: 75 } },
  { testo: 'Per una volta il cambio della valuta ti va bene. Ricevi 50 €.', effetto: { tipo: 'soldi', importo: 50 } },
  { testo: 'Viaggio premio per tutti: ogni giocatore riceve 50 €.', effetto: { tipo: 'tutti_soldi', importo: 50 } },
  { testo: 'Il kebab di Istanbul era troppo buono: ne compri altri dieci. Paga 40 €.', effetto: { tipo: 'soldi', importo: -40 } },
  {
    testo: 'Supplemento per il bagaglio a mano: pesava 11 chili invece di 10. Paga 50 €.',
    effetto: { tipo: 'soldi', importo: -50 },
  },
  { testo: 'Hai lasciato il roaming acceso in Antartide. Paga 100 €.', effetto: { tipo: 'soldi', importo: -100 } },
  { testo: 'Compri un cappello da cowboy a Italy, in Texas. Paga 30 €.', effetto: { tipo: 'soldi', importo: -30 } },
  {
    testo: 'Festeggi il compleanno a Kiribati, dove il giorno nuovo arriva prima che altrove. Ogni giocatore ti dà 20 €.',
    effetto: { tipo: 'da_ognuno', importo: 20 },
  },
  {
    testo: 'Perdi a morra cinese contro un monaco di Bangkok. Paga 30 € a ogni giocatore.',
    effetto: { tipo: 'a_ognuno', importo: 30 },
  },
  {
    testo: 'Robin Hood del jet lag: chi ha più contante dà 150 € a chi ne ha meno.',
    effetto: { tipo: 'robin_hood', importo: 150 },
  },
  {
    testo: 'Testa o croce con il pilota. Testa: ricevi 200 €. Croce: paghi 200 €.',
    effetto: { tipo: 'moneta', importo: 200 },
  },
  {
    testo: 'Le termiti australiane si mangiano i tetti. Paga 40 € per ogni casa e 115 € per ogni albergo.',
    effetto: { tipo: 'riparazioni', casa: 40, albergo: 115 },
  },
  { testo: 'Il cane antidroga trova il salame in valigia. Vai in prigione.', effetto: { tipo: 'prigione' } },
  {
    testo: 'Carta Grazia: il console è tuo cugino. Esci gratis di prigione. Puoi tenerla o scambiarla.',
    effetto: { tipo: 'grazia' },
  },
];

/** Cartolina: soprattutto spostamenti, con il Biglietto omaggio che esiste solo qui. */
const CARTOLINA: Carta[] = [
  viaggio('Ti scade il visto: torna alla Partenza.', 0),
  viaggio('Pellegrinaggio: vai alla Città del Vaticano.', 1),
  viaggio('Hai prenotato il volo sbagliato: vai a Batman.', 9),
  viaggio('Ti dicono che a Hell fa caldo. Vai a Hell.', 35),
  viaggio('Vai a vivere sottoterra a Coober Pedy.', 39),
  viaggio('Vai alla fine del mondo: Ushuaia.', 47),
  viaggio('Coincidenza stretta: corri all’Aeroporto di Lukla.', 18),
  { testo: 'Fai l’autostop fino all’aeroporto più vicino.', effetto: { tipo: 'prossima', casella: 'stazione' } },
  { testo: 'Ti si scarica il telefono: vai al servizio più vicino.', effetto: { tipo: 'prossima', casella: 'servizio' } },
  { testo: 'Il pilota sbaglia rotta: atterri su una casella a caso.', effetto: { tipo: 'casuale' } },
  {
    testo: 'Scambio di valigie al nastro bagagli: scambi il posto con un avversario a caso.',
    effetto: { tipo: 'scambia_posto' },
  },
  { testo: 'Biglietto omaggio! Ti muovi ancora, e se voli non paghi il biglietto.', effetto: { tipo: 'volo_omaggio' } },
  { testo: 'Hai scordato il passaporto in albergo: torna indietro di 3 caselle.', effetto: { tipo: 'passi', passi: -3 } },
  { testo: 'Il cane antidroga annusa il tuo panino. Vai in prigione.', effetto: { tipo: 'prigione' } },
  { testo: 'Vinci la lotteria del duty free. Ricevi 150 €.', effetto: { tipo: 'soldi', importo: 150 } },
  { testo: 'Offri il pranzo a tutta la comitiva. Paga 50 € a ogni giocatore.', effetto: { tipo: 'a_ognuno', importo: 50 } },
  {
    testo: 'Un uragano ti spettina i tetti. Paga 25 € per ogni casa e 100 € per ogni albergo.',
    effetto: { tipo: 'riparazioni', casa: 25, albergo: 100 },
  },
  {
    testo: 'Carta Grazia: un diplomatico garantisce per te. Esci gratis di prigione. Puoi tenerla o scambiarla.',
    effetto: { tipo: 'grazia' },
  },
];

const VIAGGI: Viaggi = {
  // Corto, medio e lungo raggio. Prezzi provvisori, da tarare con le partite dei bot.
  fasce: [
    { fino: 12, prezzo: 50 },
    { fino: 24, prezzo: 100 },
    { fino: 48, prezzo: 150 },
  ],
  sfida: true,
  passaporto: true,
};

/**
 * Le carte rare, con quante volte escono su 10.000 pescate (quando possono uscire: vedi `CartaRara`).
 * Tarate perché in una partita da 4 escano più o meno: Bancarotta 1 partita su 5, Vita extra 1 su 3, Reset 1 su 6.
 */
const RARE: CarteRare = {
  carte: [
    {
      carta: {
        testo: 'Bancarotta! Hai puntato tutto in un casinò di Macao e hai perso. Sei fuori dalla partita.',
        effetto: { tipo: 'bancarotta' },
      },
      su10000: 35,
    },
    {
      carta: {
        testo: 'Vita extra! Un monaco tibetano insegna la reincarnazione: uno a caso tra chi è in bancarotta torna in partita.',
        effetto: { tipo: 'vita_extra' },
      },
      su10000: 120,
    },
    {
      carta: {
        testo: 'Reset! Il catasto mondiale va in tilt: tutte le proprietà tornano alla banca. I soldi restano a chi li ha.',
        effetto: { tipo: 'reset' },
      },
      su10000: 40,
    },
  ],
  ultimiTurni: 3,
};

export const GIRO_DEL_MONDO: Tabellone = {
  id: 'giro_del_mondo',
  nome: 'Giro del mondo',
  descrizione:
    'Posti veri e assurdi, paesi sparpagliati e prezzi a casaccio. Al posto dei dadi puoi comprare un biglietto e volare dove vuoi; a chi ti chiede l’affitto puoi rispondere con una sfida a morra cinese.',
  caselle: CASELLE,
  regioni: REGIONI,
  partenza: { passaggio: 200, arrivo: 300 },
  prigione: 12,
  cauzione: 50,
  affittiStazioni: [25, 50, 100, 200],
  // Il doppio degli altri tabelloni: chi vola li evita, e con ×4 e ×10 non rendevano quasi niente.
  moltiplicatoriServizi: [8, 20],
  mazzi: { busta: BUSTA, cartolina: CARTOLINA },
  viaggi: VIAGGI,
  rare: RARE,
};
