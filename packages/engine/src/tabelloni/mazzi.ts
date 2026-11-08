/*
 * Carte comuni ai tabelloni. La Busta (soprattutto soldi) è uguale dappertutto; la Cartolina (soprattutto
 * spostamenti) cambia da un tabellone all'altro, perché le sue mete sono caselle di quel tabellone.
 */

import type { Carta } from '../tipi';

export const GRAZIA: Carta = {
  testo: 'Carta Grazia. Esci gratis di prigione. Puoi tenerla o scambiarla.',
  effetto: { tipo: 'grazia' },
};

/** Busta: soprattutto soldi. */
export const BUSTA: readonly Carta[] = [
  { testo: 'Torna alla Partenza.', effetto: { tipo: 'vai_a', casella: 0 } },
  { testo: 'Rimborso delle tasse. Ricevi 100 €.', effetto: { tipo: 'soldi', importo: 100 } },
  { testo: 'Interessi sul conto di risparmio. Ricevi 50 €.', effetto: { tipo: 'soldi', importo: 50 } },
  { testo: 'Premio di un concorso. Ricevi 150 €.', effetto: { tipo: 'soldi', importo: 150 } },
  { testo: 'Eredità da un parente lontano. Ricevi 100 €.', effetto: { tipo: 'soldi', importo: 100 } },
  { testo: 'Rimborso dell’assicurazione. Ricevi 25 €.', effetto: { tipo: 'soldi', importo: 25 } },
  { testo: 'Vendi la vecchia bicicletta. Ricevi 30 €.', effetto: { tipo: 'soldi', importo: 30 } },
  { testo: 'Buono regalo. Ricevi 20 €.', effetto: { tipo: 'soldi', importo: 20 } },
  { testo: 'Bolletta della luce. Paga 60 €.', effetto: { tipo: 'soldi', importo: -60 } },
  { testo: 'Revisione dell’auto. Paga 50 €.', effetto: { tipo: 'soldi', importo: -50 } },
  { testo: 'Visita dal dentista. Paga 50 €.', effetto: { tipo: 'soldi', importo: -50 } },
  { testo: 'Multa per sosta vietata. Paga 40 €.', effetto: { tipo: 'soldi', importo: -40 } },
  { testo: 'È il tuo compleanno. Ogni giocatore ti dà 10 €.', effetto: { tipo: 'da_ognuno', importo: 10 } },
  { testo: 'Hai anticipato la cena per tutti. Ogni giocatore ti dà 50 €.', effetto: { tipo: 'da_ognuno', importo: 50 } },
  {
    testo: 'Manutenzione degli immobili. Paga 40 € per ogni casa e 115 € per ogni albergo.',
    effetto: { tipo: 'riparazioni', casa: 40, albergo: 115 },
  },
  { testo: 'Vai in prigione.', effetto: { tipo: 'prigione' } },
  GRAZIA,
];

/** «Vai a …»: una meta della Cartolina. */
export function viaggio(testo: string, casella: number): Carta {
  return { testo, effetto: { tipo: 'vai_a', casella } };
}

/**
 * Le carte della Cartolina che non dipendono dal tabellone: soldi, prigione, riparazioni, Carta Grazia.
 * Con `servizi` c'è anche «Vai al servizio più vicino» (che non ha senso senza servizi sul tabellone).
 */
export function cartolinaComune(opzioni: { servizi: boolean; indietro: number }): Carta[] {
  const passi = opzioni.indietro;
  return [
    { testo: 'Vai alla stazione più vicina.', effetto: { tipo: 'prossima', casella: 'stazione' } },
    ...(opzioni.servizi
      ? [{ testo: 'Vai al servizio più vicino.', effetto: { tipo: 'prossima', casella: 'servizio' } } satisfies Carta]
      : []),
    {
      testo: passi === 1 ? 'Torna indietro di una casella.' : `Torna indietro di ${passi} caselle.`,
      effetto: { tipo: 'passi', passi: -passi },
    },
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
}
