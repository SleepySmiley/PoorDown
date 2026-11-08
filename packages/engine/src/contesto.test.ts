/* Movimenti di denaro: entrate, debiti, pagamenti alla banca e cassa della Vacanza. */

import { describe, expect, it } from 'vitest';
import { assegna, dadi, esegui, g, partitaDiProva, problemi } from './prove';
import type { Stato } from './tipi';

const MILANO = 39;

/** 'a' ha 10 € e Milano, ed è a tre passi dalla Tassa di soggiorno (75 €). */
function aConDieciEuro(): Stato {
  const s = assegna(partitaDiProva(3, { cassaVacanza: true }), 'a', MILANO);
  g(s, 'a').posizione = 35;
  g(s, 'a').saldo = 10;
  return s;
}

describe('cassa della Vacanza', () => {
  it('della tassa entra subito solo il contante; il resto quando il rosso si rimborsa', () => {
    let r = esegui(aConDieciEuro(), { tipo: 'lancia', giocatore: 'a' }, dadi([1, 2]));
    expect(g(r.stato, 'a').saldo).toBe(-65);
    expect(r.stato.cassaVacanza).toBe(10);
    // Vende Milano per 200: 65 rimborsano la banca e vanno in cassa.
    r = esegui(r.stato, { tipo: 'vendi', giocatore: 'a', casella: MILANO });
    expect(g(r.stato, 'a').saldo).toBe(135);
    expect(r.stato.cassaVacanza).toBe(75);
    expect(problemi(r.stato)).toEqual([]);
  });

  it('chi fallisce senza rimborsare lascia in cassa solo quello che ha pagato', () => {
    let s = esegui(aConDieciEuro(), { tipo: 'lancia', giocatore: 'a' }, dadi([1, 2])).stato;
    s = esegui(s, { tipo: 'bancarotta', giocatore: 'a' }).stato;
    expect(s.cassaVacanza).toBe(10);
    expect(problemi(s)).toEqual([]);
  });

  it('un’entrata salda prima i debiti verso i giocatori, poi il rosso verso la banca', () => {
    const s = aConDieciEuro();
    // 165 di rosso: 100 dovuti a b, 65 alla banca.
    g(s, 'a').saldo = -165;
    g(s, 'a').debiti = [{ creditore: 'b', importo: 100 }];
    const saldoB = g(s, 'b').saldo;
    const r = esegui(s, { tipo: 'vendi', giocatore: 'a', casella: MILANO });
    expect(r.eventi).toContainEqual({ tipo: 'rimborso', da: 'a', a: 'b', importo: 100 });
    expect(g(r.stato, 'b').saldo).toBe(saldoB + 100);
    expect(g(r.stato, 'a').saldo).toBe(35);
    expect(r.stato.cassaVacanza).toBe(65);
  });

  it('senza la regola la cassa resta vuota anche quando il rosso si rimborsa', () => {
    const s = aConDieciEuro();
    s.impostazioni.cassaVacanza = false;
    let r = esegui(s, { tipo: 'lancia', giocatore: 'a' }, dadi([1, 2]));
    r = esegui(r.stato, { tipo: 'vendi', giocatore: 'a', casella: MILANO });
    expect(g(r.stato, 'a').saldo).toBe(135);
    expect(r.stato.cassaVacanza).toBe(0);
  });
});
