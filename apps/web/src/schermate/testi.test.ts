import { isValidElement, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { casoDaSeme, creaPartita, IMPOSTAZIONI_PREDEFINITE, type VistaStanza, type VoceRegistro } from '@poordown/engine';
import { durataInParole, righeRegistro, volte } from './testi';

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
  partecipanti: [{ id: 'a', nome: 'Anna', colore: 3, connesso: true, bot: false, squadra: null }],
  squadre: [],
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

  it('Giro del mondo: la sfida e la morra hanno il colore di chi sfida e i due nomi in grassetto', () => {
    const creata = creaPartita(
      [
        { id: 'a', nome: 'Anna', colore: 3 },
        { id: 'b', nome: 'Bruno', colore: 5 },
      ],
      { ...IMPOSTAZIONI_PREDEFINITE, ordineCasuale: false, mappa: 'giro_del_mondo' },
      casoDaSeme(1),
    );
    if (!creata.ok) throw new Error(creata.messaggio);
    const stanza: VistaStanza = { ...STANZA, fase: 'partita', partita: creata.stato };
    const registro: VoceRegistro[] = [
      { n: 1, quando: 0, evento: { tipo: 'sfida', da: 'a', a: 'b', casella: 5, importo: 70 } },
      {
        n: 2,
        quando: 0,
        evento: { tipo: 'morra', da: 'a', a: 'b', casella: 5, segni: ['sasso', 'carta'], esito: 'persa', importo: 140, aCaso: 'b' },
      },
    ];
    const [morra, sfida] = righeRegistro(registro, stanza);
    expect(sfida!.colore).toBe(3);
    expect(leggi(sfida!.testo).testo).toMatch(/^Anna non vuole pagare 70 € per .+ e sfida Bruno a morra cinese\.$/);
    expect(leggi(sfida!.testo).grassetto).toEqual(['Anna', 'Bruno']);
    expect(morra!.colore).toBe(3);
    expect(leggi(morra!.testo).testo).toContain('Bruno non sceglie in tempo e gioca a caso.');
    expect(leggi(morra!.testo).testo).toContain('affitto doppio, 140 €');
  });
});

describe('durata e volte', () => {
  it('scrive la durata in parole', () => {
    expect(durataInParole(2_896_000)).toBe('48 minuti e 16 secondi');
    expect(durataInParole(3_725_000)).toBe('1 ora, 2 minuti e 5 secondi');
    expect(durataInParole(7_200_000)).toBe('2 ore');
    expect(durataInParole(61_000)).toBe('1 minuto e 1 secondo');
    expect(durataInParole(400)).toBe('0 secondi');
  });

  it('una volta, più volte', () => {
    expect(volte(1)).toBe('una volta');
    expect(volte(4)).toBe('4 volte');
  });
});

describe('Giro del mondo: le caselle strane nel registro', () => {
  it('hanno il colore di chi ci finisce, il suo nome in grassetto e dove ricompare', () => {
    const creata = creaPartita(
      [
        { id: 'a', nome: 'Anna', colore: 3 },
        { id: 'b', nome: 'Bruno', colore: 5 },
      ],
      { ...IMPOSTAZIONI_PREDEFINITE, ordineCasuale: false, mappa: 'giro_del_mondo' },
      casoDaSeme(1),
    );
    if (!creata.ok) throw new Error(creata.messaggio);
    const stanza: VistaStanza = { ...STANZA, fase: 'partita', partita: creata.stato };
    const registro: VoceRegistro[] = [
      { n: 1, quando: 0, evento: { tipo: 'bermuda', giocatore: 'b', da: 11, a: 35 } },
      { n: 2, quando: 0, evento: { tipo: 'antipodi', giocatore: 'b', da: 33, a: 9 } },
      { n: 3, quando: 0, evento: { tipo: 'cambio_data', giocatore: 'b' } },
      { n: 4, quando: 0, evento: { tipo: 'passaporto', giocatore: 'b' } },
    ];
    const [passaporto, cambio, antipodi, bermuda] = righeRegistro(registro, stanza);
    for (const riga of [passaporto, cambio, antipodi, bermuda]) {
      expect(riga!.colore).toBe(5);
      expect(leggi(riga!.testo).grassetto).toEqual(['Bruno']);
    }
    expect(leggi(bermuda!.testo).testo).toBe('Bruno sparisce nel Triangolo delle Bermuda e ricompare a Hell.');
    expect(leggi(antipodi!.testo).testo).toBe('Bruno scava una buca per l’altra parte del mondo e sbuca a Batman.');
    expect(leggi(cambio!.testo).testo).toContain('guadagna un giorno');
    expect(leggi(passaporto!.testo).testo).toBe('Bruno ritira il passaporto: da adesso può volare.');
  });
});
