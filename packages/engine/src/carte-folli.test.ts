import { describe, expect, it } from 'vitest';
import { verifica } from './regole';
import { esegui, g, partitaASquadre, partitaDiProva, primaCarta, problemi } from './prove';
import { SISTEMA_SOLARE } from './tabelloni/sistema-solare';
import type { Caso, Effetto, NomeMazzo, Stato } from './tipi';

/*
 * Le carte folli del Sistema solare. Le caselle usate: Cartolina a 8, Busta a 17, Prigione a 12,
 * Igea (città libera) a 19, Astronave (stazione libera) a 30.
 */

const SOLARE = { mappa: 'sistema_solare' } as const;

/** Caso che restituisce i valori in ordine, qualunque sia il massimo chiesto (dadi: valore del dado meno uno). */
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

/** Indice della prima carta del mazzo con quell'effetto. */
function carta(mazzo: NomeMazzo, tipo: Effetto['tipo'], filtro: (e: Effetto) => boolean = () => true): number {
  const i = SISTEMA_SOLARE.mazzi[mazzo].findIndex((c) => c.effetto.tipo === tipo && filtro(c.effetto));
  if (i < 0) throw new Error(`Nessuna carta ${tipo} nella ${mazzo}.`);
  return i;
}

/** Partita sul Sistema solare con 'a' pronto a pescare la carta: con 2 e 3 arriva sulla Cartolina (8) o sulla Busta (17). */
function pronta(mazzo: NomeMazzo, indice: number, s: Stato = partitaDiProva(3, SOLARE)): Stato {
  g(s, 'a').posizione = mazzo === 'cartolina' ? 3 : 12;
  return primaCarta(s, mazzo, indice);
}

const lancia = { tipo: 'lancia', giocatore: 'a' } as const;
/** I dadi 2 e 3 (valori 1 e 2 del caso). */
const DUE_E_TRE = [1, 2];

describe('carte folli del Sistema solare', () => {
  it('ci sono tutte, e solo sul Sistema solare', () => {
    const tipi = new Set(Object.values(SISTEMA_SOLARE.mazzi).flatMap((m) => m.map((c) => c.effetto.tipo)));
    for (const t of ['casuale', 'scambia_posto', 'robin_hood', 'avversari_in_prigione', 'moneta', 'tutti_soldi', 'rilancia']) {
      expect(tipi).toContain(t);
    }
  });

  it('wormhole: salta su una casella a caso, senza Partenza, e la casella vale', () => {
    const s = pronta('cartolina', carta('cartolina', 'casuale'));
    // Dalla Cartolina (8): 8 + 1 + 10 = 19, Igea, città libera.
    const { stato, eventi } = esegui(s, lancia, caso(...DUE_E_TRE, 10));
    expect(g(stato, 'a').posizione).toBe(19);
    expect(eventi).toContainEqual({ tipo: 'teletrasporto', giocatore: 'a', da: 8, a: 19 });
    expect(eventi.some((e) => e.tipo === 'partenza')).toBe(false);
    expect(stato.turno.acquisto).toBe(19);
    expect(problemi(stato)).toEqual([]);
  });

  it('wormhole oltre la Partenza: niente premio', () => {
    const s = pronta('cartolina', carta('cartolina', 'casuale'));
    // 8 + 1 + 45 = 54 → casella 6 (Navetta), passando sopra la Partenza.
    const { stato, eventi } = esegui(s, lancia, caso(...DUE_E_TRE, 45));
    expect(g(stato, 'a')).toMatchObject({ posizione: 6, saldo: 1500 });
    expect(eventi.some((e) => e.tipo === 'partenza')).toBe(false);
  });

  it('scambio quantico: le due pedine si scambiano e per chi pesca vale la casella', () => {
    const s = pronta('cartolina', carta('cartolina', 'scambia_posto'));
    g(s, 'b').posizione = 30;
    g(s, 'c').prigione = 0;
    g(s, 'c').posizione = 12;
    // C'è solo b tra cui scegliere (c è in prigione): intero(1) = 0.
    const { stato, eventi } = esegui(s, lancia, caso(...DUE_E_TRE, 0));
    expect(g(stato, 'a').posizione).toBe(30);
    expect(g(stato, 'b').posizione).toBe(8);
    expect(eventi.filter((e) => e.tipo === 'teletrasporto')).toEqual([
      { tipo: 'teletrasporto', giocatore: 'a', da: 8, a: 30 },
      { tipo: 'teletrasporto', giocatore: 'b', da: 30, a: 8 },
    ]);
    expect(stato.turno.acquisto).toBe(30);
    expect(problemi(stato)).toEqual([]);
  });

  it('scambio quantico senza nessuno con cui scambiarsi: non succede niente', () => {
    const s = pronta('cartolina', carta('cartolina', 'scambia_posto'), partitaDiProva(2, SOLARE));
    g(s, 'b').prigione = 0;
    g(s, 'b').posizione = 12;
    const { stato, eventi } = esegui(s, lancia, caso(...DUE_E_TRE));
    expect(g(stato, 'a').posizione).toBe(8);
    expect(eventi.some((e) => e.tipo === 'teletrasporto')).toBe(false);
  });

  it('Robin Hood: chi ha più contante dà a chi ne ha meno', () => {
    const s = pronta('busta', carta('busta', 'robin_hood'));
    g(s, 'b').saldo = 3000;
    g(s, 'c').saldo = 100;
    const { stato, eventi } = esegui(s, lancia, caso(...DUE_E_TRE));
    expect(eventi).toContainEqual({ tipo: 'robin_hood', da: 'b', a: 'c', importo: 150 });
    expect([g(stato, 'a').saldo, g(stato, 'b').saldo, g(stato, 'c').saldo]).toEqual([1500, 2850, 250]);
  });

  it('Robin Hood tra compagni di squadra non fa niente', () => {
    // Turni a, c, b, d; a e b insieme.
    const s = pronta('busta', carta('busta', 'robin_hood'), partitaASquadre([0, 0, 1, 1], SOLARE));
    g(s, 'a').saldo = 3000;
    g(s, 'b').saldo = 50;
    const { stato, eventi } = esegui(s, lancia, caso(...DUE_E_TRE));
    expect(eventi.some((e) => e.tipo === 'robin_hood')).toBe(false);
    expect(g(stato, 'b').saldo).toBe(50);
  });

  it('buco nero: tutti gli avversari in prigione, il turno di chi pesca continua', () => {
    const s = pronta('cartolina', carta('cartolina', 'avversari_in_prigione'));
    g(s, 'b').posizione = 30;
    g(s, 'c').vacanza = true;
    const { stato, eventi } = esegui(s, lancia, caso(...DUE_E_TRE));
    expect(g(stato, 'b')).toMatchObject({ posizione: 12, prigione: 0 });
    expect(g(stato, 'c')).toMatchObject({ posizione: 12, prigione: 0, vacanza: false });
    expect(g(stato, 'a')).toMatchObject({ posizione: 8, prigione: null });
    expect(eventi.filter((e) => e.tipo === 'prigione')).toHaveLength(2);
    expect(stato.turno).toMatchObject({ giocatore: 'a', fase: 'dopo_lancio' });
    expect(verifica(stato, { tipo: 'fine_turno', giocatore: 'a' })).toBeNull();
  });

  it('buco nero a squadre: il compagno resta fuori', () => {
    const s = pronta('cartolina', carta('cartolina', 'avversari_in_prigione'), partitaASquadre([0, 0, 1, 1], SOLARE));
    const { stato } = esegui(s, lancia, caso(...DUE_E_TRE));
    expect(g(stato, 'b').prigione).toBeNull();
    expect(g(stato, 'c').prigione).toBe(0);
    expect(g(stato, 'd').prigione).toBe(0);
  });

  it('testa o croce: testa si incassa, croce si paga', () => {
    const indice = carta('busta', 'moneta');
    const testa = esegui(pronta('busta', indice), lancia, caso(...DUE_E_TRE, 0));
    expect(g(testa.stato, 'a').saldo).toBe(1700);
    expect(testa.eventi).toContainEqual({ tipo: 'moneta', giocatore: 'a', testa: true, importo: 200 });
    const croce = esegui(pronta('busta', indice), lancia, caso(...DUE_E_TRE, 1));
    expect(g(croce.stato, 'a').saldo).toBe(1300);
  });

  it('pioggia e tassa per tutti: ognuno riceve o paga, anche chi pesca', () => {
    const pioggia = esegui(pronta('busta', carta('busta', 'tutti_soldi', (e) => e.tipo === 'tutti_soldi' && e.importo > 0)), lancia, caso(...DUE_E_TRE));
    expect(pioggia.stato.giocatori.map((x) => x.saldo)).toEqual([1550, 1550, 1550]);
    const tassa = esegui(pronta('busta', carta('busta', 'tutti_soldi', (e) => e.tipo === 'tutti_soldi' && e.importo < 0)), lancia, caso(...DUE_E_TRE));
    expect(tassa.stato.giocatori.map((x) => x.saldo)).toEqual([1450, 1450, 1450]);
  });

  it('gravità zero: si tira di nuovo, e finché non si tira il turno non finisce', () => {
    const { stato } = esegui(pronta('cartolina', carta('cartolina', 'rilancia')), lancia, caso(...DUE_E_TRE));
    expect(stato.turno.rilancio).toBe(true);
    expect(verifica(stato, { tipo: 'fine_turno', giocatore: 'a' })?.codice).toBe('devi_rilanciare');
    const dopo = esegui(stato, lancia, caso(0, 1));
    expect(g(dopo.stato, 'a').posizione).toBe(11);
    expect(dopo.stato.turno.rilancio).toBe(false);
  });
});
