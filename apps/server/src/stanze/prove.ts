/* Aiuti per i test delle stanze. Non fanno parte del server. */

import { casoDaSeme, IMPOSTAZIONI_PREDEFINITE, type Impostazioni } from '@poordown/engine';
import type { Ambiente } from './ambiente';
import { Stanza } from './stanza';

/** Ambiente con orologio manuale e caso ripetibile. */
export function ambienteDiProva(seme = 1): Ambiente & { avanza(ms: number): void } {
  let adesso = 1_000_000;
  return {
    adesso: () => adesso,
    caso: casoDaSeme(seme),
    avanza(ms) {
      adesso += ms;
    },
  };
}

/** Token finti, abbastanza lunghi da passare il controllo del server. */
export const TOKEN = {
  anna: 'token-di-anna-0000000001',
  bruno: 'token-di-bruno-000000002',
  carla: 'token-di-carla-000000003',
  dario: 'token-di-dario-000000004',
} as const;

export function stanzaDiProva(impostazioni: Partial<Impostazioni> = {}, amb = ambienteDiProva()) {
  const stanza = new Stanza('abcde', amb, { ...IMPOSTAZIONI_PREDEFINITE, ...impostazioni });
  return { stanza, amb };
}

const COLORE = { anna: 1, bruno: 2, carla: 3, dario: 4 } as const;

/** Collega e fa sedere i giocatori indicati, nell'ordine (Anna con il colore 1, Bruno 2…). Restituisce i loro id. */
export function siedi(stanza: Stanza, ...chi: (keyof typeof TOKEN)[]): string[] {
  return chi.map((nome) => {
    stanza.collega(`conn-${nome}`, TOKEN[nome]);
    const esito = stanza.siediti(TOKEN[nome], nome[0]!.toUpperCase() + nome.slice(1), COLORE[nome]);
    if (!esito.ok) throw new Error(esito.messaggio);
    return esito.dati.io;
  });
}
