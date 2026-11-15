import { describe, expect, it } from 'vitest';
import { affitto, prezzoAcquisto } from './conti';
import { assegna, esegui, g, partitaDiProva, primaCarta, problemi } from './prove';
import { SISTEMA_SOLARE } from './tabelloni/sistema-solare';
import type { Caso, Stato } from './tipi';

/*
 * Le regole e le caselle folli del Sistema solare. Caselle usate: Tycho 1, Roulette 2 e 26, Copernico 3, Wormhole 4 e 29,
 * Cartolina 8, Fionda 14 e 38, Busta 17, Jezero 19, Buco nero 22, Io 39, Supernova 41, Plutone 47.
 */

/** Caso che restituisce i valori in ordine (dadi: valore del dado meno uno). */
function caso(...valori: number[]): Caso {
  return {
    intero(n) {
      const v = valori.shift();
      if (v === undefined) throw new Error('Il test ha chiesto più numeri a caso di quelli previsti.');
      if (v >= n) throw new Error(`Valore ${v} fuori da 0–${n - 1}.`);
      return v;
    },
  };
}

function solare(n = 2): Stato {
  return partitaDiProva(n, { mappa: 'sistema_solare' });
}

function conAIn(posizione: number, s = solare()): Stato {
  g(s, 'a').posizione = posizione;
  return s;
}

const lancia = { tipo: 'lancia', giocatore: 'a' } as const;

describe('regole folli', () => {
  it('la partita nasce con il cosmo: primo giro tranquillo, malloppo iniziale', () => {
    expect(solare().cosmo).toEqual({ giro: 1, evento: 'quiete', mercato: null, malloppo: 100, verso: 1 });
    expect(partitaDiProva(2).cosmo).toBeUndefined();
  });

  it('affitto quantistico: un dado moltiplica l’affitto', () => {
    const s = assegna(conAIn(0), 'b', 3);
    // Copernico (70 €) senza case: 4 €. Faccia 5 → ×2.
    const { stato, eventi } = esegui(s, lancia, caso(0, 1, 4));
    expect(eventi).toContainEqual({ tipo: 'quantico', giocatore: 'a', casella: 3, faccia: 5, fattore: 2 });
    expect(eventi).toContainEqual({ tipo: 'affitto', da: 'a', a: 'b', casella: 3, importo: 8 });
    expect(g(stato, 'b').saldo).toBe(1508);
  });

  it('affitto quantistico ×0: gratis', () => {
    const s = assegna(conAIn(0), 'b', 3);
    const { stato, eventi } = esegui(s, lancia, caso(0, 1, 0));
    expect(eventi.some((e) => e.tipo === 'affitto')).toBe(false);
    expect(g(stato, 'a').saldo).toBe(1500);
  });

  it('Partenza a caso: da 0 a 400 € a passi di 50', () => {
    // Da 46 con 1 e 2: passa la Partenza e arriva su Tycho. Il tiro della Partenza: 4 → 200 €.
    const { stato, eventi } = esegui(conAIn(46), lancia, caso(0, 1, 4));
    expect(eventi).toContainEqual({ tipo: 'partenza', giocatore: 'a', importo: 200, arrivo: false });
    expect(g(stato, 'a').saldo).toBe(1700);
    const zero = esegui(conAIn(46), lancia, caso(0, 1, 0));
    expect(g(zero.stato, 'a').saldo).toBe(1500);
  });

  it('Tempesta solare: la Partenza non paga', () => {
    const s = conAIn(46);
    s.cosmo!.evento = 'tempesta';
    const { stato, eventi } = esegui(s, lancia, caso(0, 1));
    expect(eventi).toContainEqual({ tipo: 'partenza', giocatore: 'a', importo: 0, arrivo: false, tempesta: true });
    expect(g(stato, 'a').saldo).toBe(1500);
  });

  it('gravità invertita: i dadi portano indietro, e passando la Partenza si incassa lo stesso', () => {
    const s = conAIn(10);
    s.cosmo!.verso = -1;
    const avanti = esegui(s, lancia, caso(0, 1));
    expect(avanti.eventi).toContainEqual({ tipo: 'movimento', giocatore: 'a', da: 10, a: 7, dadi: [1, 2], verso: -1 });
    const t = conAIn(4);
    t.cosmo!.verso = -1;
    // Da 4 con 2 e 3: indietro di 5, fino a Plutone (47), passando dalla Partenza: 300 €.
    const { stato, eventi } = esegui(t, lancia, caso(1, 2, 6));
    expect(g(stato, 'a')).toMatchObject({ posizione: 47, saldo: 1800 });
    expect(eventi).toContainEqual({ tipo: 'partenza', giocatore: 'a', importo: 300, arrivo: false });
  });

  it('il primo turno non conosce Mercato né eventi: prezzi normali', () => {
    expect(prezzoAcquisto(solare(), 39)).toBe(450);
  });
});

describe('caselle folli', () => {
  it('fionda gravitazionale: riparte della stessa somma dei dadi', () => {
    // Da 9 con 2 e 3: Fionda (14), poi altri 5 fino a Jezero (19).
    const { stato, eventi } = esegui(conAIn(9), lancia, caso(1, 2));
    expect(eventi).toContainEqual({ tipo: 'fionda', giocatore: 'a', passi: 5 });
    expect(eventi).toContainEqual({ tipo: 'movimento', giocatore: 'a', da: 14, a: 19 });
    expect(stato.turno.acquisto).toBe(19);
  });

  it('wormhole: su una casella a caso, mai su un altro wormhole', () => {
    // Da 1 con 1 e 2: Wormhole (4). Le mete saltano i due wormhole: la meta 15 è Psiche (16).
    const { stato, eventi } = esegui(conAIn(1), lancia, caso(0, 1, 15));
    expect(eventi).toContainEqual({ tipo: 'teletrasporto', giocatore: 'a', da: 4, a: 16 });
    expect(stato.turno.acquisto).toBe(16);
  });

  it('Buco nero e Supernova: il 20% del contante nel malloppo, poi chi arriva sulla Supernova se lo prende', () => {
    // Da 19 con 1 e 2: Buco nero (22).
    const buco = esegui(conAIn(19), lancia, caso(0, 1));
    expect(g(buco.stato, 'a').saldo).toBe(1200);
    expect(buco.stato.cosmo!.malloppo).toBe(400);
    expect(buco.eventi).toContainEqual({ tipo: 'buco_nero', giocatore: 'a', casella: 22, importo: 300 });
    // Da 38 con 1 e 2: Supernova (41).
    const s = conAIn(38);
    s.cosmo!.malloppo = 400;
    const { stato, eventi } = esegui(s, lancia, caso(0, 1));
    expect(g(stato, 'a').saldo).toBe(1900);
    expect(stato.cosmo!.malloppo).toBe(100);
    expect(eventi).toContainEqual({ tipo: 'supernova', giocatore: 'a', casella: 41, importo: 400 });
    expect(problemi(stato)).toEqual([]);
  });

  it('Roulette cosmica: lo spicchio uscito fa il suo effetto', () => {
    // Da 23 con 1 e 2: Roulette (26). Spicchio 0: Jackpot da 300 €.
    const jackpot = esegui(conAIn(23), lancia, caso(0, 1, 0));
    expect(jackpot.eventi).toContainEqual(expect.objectContaining({ tipo: 'roulette', giocatore: 'a', spicchio: 0 }));
    expect(g(jackpot.stato, 'a').saldo).toBe(1800);
    // Spicchio 1: metà del contante, al massimo 500 €.
    const buco = esegui(conAIn(23), lancia, caso(0, 1, 1));
    expect(g(buco.stato, 'a').saldo).toBe(1000);
    // Spicchio 7: dritto alla Supernova.
    const nova = esegui(conAIn(23), lancia, caso(0, 1, 7));
    expect(g(nova.stato, 'a').posizione).toBe(41);
    expect(g(nova.stato, 'a').saldo).toBe(1600);
  });

  it('la carta della gravità invertita vale fino alla fine del giro', () => {
    const indice = SISTEMA_SOLARE.mazzi.cartolina.findIndex((c) => c.effetto.tipo === 'inverti');
    const s = primaCarta(conAIn(3), 'cartolina', indice);
    const { stato, eventi } = esegui(s, lancia, caso(1, 2));
    expect(stato.cosmo!.verso).toBe(-1);
    expect(eventi).toContainEqual({ tipo: 'gravita_invertita', giocatore: 'a' });
  });
});

describe('eventi cosmici a ogni giro', () => {
  /** Tocca a b, l'ultimo dell'ordine: finendo il turno comincia il giro 2. */
  function fineGiro(s = solare()): Stato {
    s.turno.giocatore = 'b';
    s.turno.fase = 'dopo_lancio';
    s.turno.dadi = [1, 2];
    return s;
  }
  const fine = { tipo: 'fine_turno', giocatore: 'b' } as const;

  it('Allineamento e Mercato galattico: affitti e prezzi del giro', () => {
    const s = assegna(fineGiro(), 'a', 39);
    // Evento 1 (allineamento), pianeta 8 (Giove), fattore 1 (×2).
    const { stato, eventi } = esegui(s, fine, caso(1, 8, 1));
    expect(eventi).toContainEqual({ tipo: 'cosmo', giro: 2, evento: 'allineamento', mercato: { regione: 8, fattore: 2 } });
    expect(stato.cosmo).toMatchObject({ giro: 2, evento: 'allineamento', verso: 1 });
    // Io: 50 € × 2 (allineamento) × 2 (mercato).
    expect(affitto(stato, 39, 0)).toBe(200);
    expect(prezzoAcquisto(stato, 40)).toBe(960);
    expect(stato.turno.giocatore).toBe('a');
  });

  it('Pioggia di meteoriti: crolla una casa sulla città più costruita', () => {
    const s = assegna(fineGiro(), 'a', 1, 3);
    s.proprieta[1]!.livello = 2;
    s.proprieta[3]!.livello = 1;
    // Evento 4 (meteoriti), regione colpita 0 (l'unica con case), poi il mercato.
    const { stato, eventi } = esegui(s, fine, caso(4, 0, 0, 0));
    expect(eventi).toContainEqual({ tipo: 'meteorite', giocatore: 'a', casella: 1, livello: 1 });
    expect(stato.proprieta[1]!.livello).toBe(1);
  });

  it('Pioggia di meteoriti senza case: diventa quiete', () => {
    const { stato } = esegui(fineGiro(), fine, caso(4, 0, 0));
    expect(stato.cosmo!.evento).toBe('quiete');
  });

  it('Collisione planetaria: due proprietà di giocatori diversi si scambiano', () => {
    const s = assegna(assegna(fineGiro(), 'a', 1), 'b', 6);
    // Evento 6 (collisione), prima Tycho (1), poi l'unica altra: la Navetta (6); poi il mercato.
    const { stato, eventi } = esegui(s, fine, caso(6, 0, 0, 0, 0));
    expect(eventi).toContainEqual({ tipo: 'collisione', caselle: [1, 6], giocatori: ['a', 'b'] });
    expect(stato.proprieta[1]!.proprietario).toBe('b');
    expect(stato.proprieta[6]!.proprietario).toBe('a');
  });

  it('Gravità invertita per il giro, e il giro dopo si torna avanti', () => {
    const { stato } = esegui(fineGiro(), fine, caso(5, 0, 0));
    expect(stato.cosmo!.verso).toBe(-1);
    const dopo = esegui(fineGiro(stato), fine, caso(0, 0, 0));
    expect(dopo.stato.cosmo).toMatchObject({ giro: 3, evento: 'quiete', verso: 1 });
  });
});
