/*
 * I mazzi si rimescolano a ogni giro: quando esce l'ultima carta, tutte le carte tornano nel mazzo in un ordine nuovo,
 * deciso dal caso della partita. Così l'ordine non si ricostruisce dalle carte già uscite.
 * Le pescate usano la Busta del Classico: 'a' parte dalla casella 12 e con 2 + 3 si ferma sulla Busta (17).
 */

import { describe, expect, it } from 'vitest';
import { casoDaSeme } from './caso';
import { problemaStato } from './pannello';
import { dadiPoi, esegui, g, partitaDiProva, problemi } from './prove';
import { tabellone } from './tabelloni';
import { vistaPartita } from './vista';
import type { Caso, IdGiocatore, Mazzo, Stato } from './tipi';

const BUSTA = tabellone('classica').mazzi.busta;
const CARTE = BUSTA.length;
const GRAZIA = BUSTA.findIndex((c) => c.effetto.tipo === 'grazia');
const TUTTE = [...BUSTA.keys()];

const ordinate = (carte: readonly number[]) => [...carte].sort((x, y) => x - y);

/**
 * Una pescata dalla Busta. Lo stato riparte ogni volta da una partita nuova con il mazzo indicato, così gli effetti
 * delle carte non contano. `grazia`: chi tiene in mano la Carta Grazia della Busta.
 */
function pesca(mazzo: Mazzo, caso: Caso, grazia?: IdGiocatore): { carta: number; stato: Stato } {
  const s = partitaDiProva();
  g(s, 'a').posizione = 12;
  s.mazzi.busta = { ordine: [...mazzo.ordine], prossima: mazzo.prossima };
  if (grazia) g(s, grazia).carteGrazia = ['busta'];
  const { stato, eventi } = esegui(s, { tipo: 'lancia', giocatore: 'a' }, dadiPoi(caso, [2, 3]));
  const carte = eventi.flatMap((e) => (e.tipo === 'carta' && e.mazzo === 'busta' ? [e.carta] : []));
  expect(carte).toHaveLength(1);
  return { carta: carte[0]!, stato };
}

/** `volte` pescate una dopo l'altra, dal mazzo di una partita nuova. Restituisce le carte uscite e l'ultimo stato. */
function pescate(volte: number, caso: Caso, grazia?: IdGiocatore): { carte: number[]; stato: Stato } {
  let stato = partitaDiProva();
  const carte: number[] = [];
  for (let i = 0; i < volte; i++) {
    const pescata = pesca(stato.mazzi.busta, caso, grazia);
    carte.push(pescata.carta);
    stato = pescata.stato;
  }
  return { carte, stato };
}

/** Le carte divise a gruppi di `quante`. */
function aGiri(carte: readonly number[], quante: number): number[][] {
  return Array.from({ length: Math.ceil(carte.length / quante) }, (_, i) => carte.slice(i * quante, (i + 1) * quante));
}

describe('mazzi rimescolati a ogni giro', () => {
  it('il primo giro segue l’ordine iniziale; dopo l’ultima carta il mazzo si rimescola e riparte da 0', () => {
    const caso = casoDaSeme(11);
    const iniziale = partitaDiProva().mazzi.busta;
    let mazzo = iniziale;
    const primoGiro: number[] = [];
    for (let i = 0; i < CARTE; i++) {
      const { carta, stato } = pesca(mazzo, caso);
      primoGiro.push(carta);
      mazzo = stato.mazzi.busta;
      // Durante il giro l'ordine resta quello: cambia solo la prossima carta.
      if (i < CARTE - 1) expect(mazzo).toEqual({ ordine: iniziale.ordine, prossima: i + 1 });
    }
    expect(primoGiro).toEqual(iniziale.ordine);
    expect(mazzo.prossima).toBe(0);
    expect(ordinate(mazzo.ordine)).toEqual(TUTTE);
    expect(mazzo.ordine).not.toEqual(iniziale.ordine);

    // Il secondo giro segue l'ordine nuovo.
    const nuovo = mazzo.ordine;
    const secondoGiro: number[] = [];
    for (let i = 0; i < CARTE; i++) {
      const { carta, stato } = pesca(mazzo, caso);
      secondoGiro.push(carta);
      mazzo = stato.mazzi.busta;
    }
    expect(secondoGiro).toEqual(nuovo);
  });

  it('ogni giro contiene ogni carta una volta, e l’ordine non si ripete da un giro all’altro', () => {
    const giri = 10;
    const { carte } = pescate(giri * CARTE, casoDaSeme(3));
    const gruppi = aGiri(carte, CARTE);
    for (const giro of gruppi) expect(ordinate(giro)).toEqual(TUTTE);
    expect(new Set(gruppi.map((giro) => giro.join())).size).toBe(giri);
  });

  it('il rimescolamento usa il caso della partita: stesso seme, stesse carte; seme diverso, giro nuovo diverso', () => {
    const stesse = pescate(3 * CARTE, casoDaSeme(21)).carte;
    expect(pescate(3 * CARTE, casoDaSeme(21)).carte).toEqual(stesse);
    // Il primo giro è quello della partita (uguale per tutti e due); dal secondo decide il caso.
    const altre = pescate(3 * CARTE, casoDaSeme(22)).carte;
    expect(altre.slice(0, CARTE)).toEqual(stesse.slice(0, CARTE));
    expect(altre.slice(CARTE)).not.toEqual(stesse.slice(CARTE));
  });

  it('la Carta Grazia tenuta si salta anche dopo i rimescolamenti', () => {
    const altre = TUTTE.filter((c) => c !== GRAZIA);
    const giri = 6;
    const { carte } = pescate(giri * altre.length, casoDaSeme(5), 'b');
    expect(carte).not.toContain(GRAZIA);
    // Senza la Grazia un giro è di una carta in meno, e contiene tutte le altre una volta.
    for (const giro of aGiri(carte, altre.length)) expect(ordinate(giro)).toEqual(altre);
  });

  it('la Grazia tenuta come ultima carta del giro: si salta, il mazzo si rimescola e si pesca dal giro nuovo', () => {
    const altre = TUTTE.filter((c) => c !== GRAZIA);
    const mazzo: Mazzo = { ordine: [...altre, GRAZIA], prossima: CARTE - 1 };
    const { carta, stato } = pesca(mazzo, casoDaSeme(8), 'b');
    const nuovo = stato.mazzi.busta.ordine;
    const attesa = nuovo.find((c) => c !== GRAZIA)!;
    expect(ordinate(nuovo)).toEqual(TUTTE);
    expect(carta).toBe(attesa);
    expect(stato.mazzi.busta.prossima).toBe(nuovo.indexOf(attesa) + 1);
  });

  it('lo stato resta coerente: indice dentro il mazzo, controlli dei test e del pannello d’accordo', () => {
    const { stato } = pescate(3 * CARTE + 5, casoDaSeme(9));
    expect(stato.mazzi.busta.prossima).toBe(5);
    expect(problemi(stato)).toEqual([]);
    expect(problemaStato(stato, stato)).toBeNull();
  });

  it('la vista dei browser non contiene l’ordine, neanche dopo un rimescolamento', () => {
    const { stato } = pescate(CARTE, casoDaSeme(4));
    expect(stato.mazzi.busta.ordine).toHaveLength(CARTE);
    const vista = vistaPartita(stato);
    expect(vista.mazzi).toEqual({ busta: { ordine: [], prossima: 0 }, cartolina: { ordine: [], prossima: 0 } });
  });
});
