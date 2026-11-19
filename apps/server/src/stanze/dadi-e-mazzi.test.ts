/*
 * I dadi decisi dal pannello e il rimescolamento del mazzo nello stesso tiro: i due dadi escono come li ha scelti il
 * pannello (si consumano per primi), il mazzo finito si rimescola con il caso vero della stanza.
 */

import { describe, expect, it } from 'vitest';
import { siedi, stanzaDiProva, TOKEN } from './prove';

describe('dadi decisi dal pannello e mazzo che finisce', () => {
  it('i dadi escono come scelti, il mazzo si rimescola e la scelta si consuma', () => {
    const { stanza } = stanzaDiProva({ ordineCasuale: false });
    const [anna] = siedi(stanza, 'anna', 'bruno');
    expect(stanza.avvia(TOKEN.anna).ok).toBe(true);
    const partita = stanza.partita!;
    expect(partita.turno.giocatore).toBe(anna);
    // Anna parte dalla casella 12: con 2 + 3 si ferma sulla Busta (17), che è all'ultima carta del giro.
    partita.giocatori.find((x) => x.id === anna)!.posizione = 12;
    const prima = [...partita.mazzi.busta.ordine];
    partita.mazzi.busta.prossima = prima.length - 1;

    expect(stanza.pannello({ tipo: 'dadi', dadi: [2, 3], giocatore: null })).toBeNull();
    expect(stanza.mossa(TOKEN.anna, { tipo: 'lancia' }).ok).toBe(true);

    const eventi = stanza.registro.map((v) => v.evento);
    expect(eventi).toContainEqual({ tipo: 'dadi', giocatore: anna, dadi: [2, 3] });
    expect(eventi).toContainEqual(expect.objectContaining({ tipo: 'carta', mazzo: 'busta', carta: prima.at(-1) }));
    const busta = stanza.partita!.mazzi.busta;
    expect(busta.prossima).toBe(0);
    expect([...busta.ordine].sort((x, y) => x - y)).toEqual([...prima].sort((x, y) => x - y));
    expect(busta.ordine).not.toEqual(prima);
    expect(stanza.dettaglioPannello().dadi).toBeNull();
  });
});
