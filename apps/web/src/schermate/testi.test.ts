import { isValidElement, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { IMPOSTAZIONI_PREDEFINITE, type VistaStanza, type VoceRegistro } from '@poordown/engine';
import { righeRegistro } from './testi';

/** Il testo di una riga e i pezzi in grassetto. */
function leggi(nodo: ReactNode): { testo: string; grassetto: string[] } {
  const pezzi = Array.isArray(nodo) ? nodo : [nodo];
  let testo = '';
  const grassetto: string[] = [];
  for (const p of pezzi) {
    if (typeof p === 'string') testo += p;
    else if (isValidElement<{ children: string }>(p)) {
      testo += p.props.children;
      grassetto.push(p.props.children);
    }
  }
  return { testo, grassetto };
}

const STANZA: VistaStanza = {
  codice: 'abcde',
  fase: 'lobby',
  versione: 3,
  host: 'a',
  impostazioni: { ...IMPOSTAZIONI_PREDEFINITE },
  partecipanti: [{ id: 'a', nome: 'Anna', colore: 3, connesso: true }],
  spettatori: 0,
  partita: null,
};

const REGISTRO: VoceRegistro[] = [
  { n: 1, quando: 0, evento: { tipo: 'ingresso', giocatore: 'a', nome: 'Anna', colore: 3 } },
  { n: 2, quando: 0, evento: { tipo: 'ingresso', giocatore: 'b', nome: 'Bruno', colore: 5 } },
  { n: 3, quando: 0, evento: { tipo: 'uscita', giocatore: 'b', nome: 'Bruno', motivo: 'espulsione' } },
];

describe('righeRegistro', () => {
  it('mette la riga più recente in alto e i nomi in grassetto', () => {
    const righe = righeRegistro(REGISTRO, STANZA, Infinity, 'Sei entrato nella stanza ABCDE.');
    expect(righe.map((r) => leggi(r.testo).testo)).toEqual([
      'Espulsione: Bruno lascia la stanza.',
      'Bruno entra nella partita.',
      'Anna entra nella partita.',
      'Sei entrato nella stanza ABCDE.',
    ]);
    expect(leggi(righe[0]!.testo).grassetto).toEqual(['Bruno']);
  });

  it('dà a chi è già uscito il colore che aveva', () => {
    const righe = righeRegistro(REGISTRO, STANZA);
    expect(righe.map((r) => r.colore)).toEqual([5, 5, 3]);
  });

  it('mostra solo le voci già accadute sullo schermo', () => {
    expect(righeRegistro(REGISTRO, STANZA, 2)).toHaveLength(2);
  });
});
