/* Bilanciamento della Fase 9: il bonus per chi gioca dopo il primo e la durata massima della partita. */

import { describe, expect, it } from 'vitest';
import { bonusPerPosto, TURNI_A_TESTA } from './impostazioni';
import { dadi, esegui, g, partitaASquadre, partitaDiProva, problemi } from './prove';
import { classifica } from './statistiche';
import type { Stato } from './tipi';

/** Il turno di chi gioca: tira 1 e 2 (si ferma su una città libera senza comprarla) e passa la mano. */
function giocaTurno(s: Stato): ReturnType<typeof esegui> {
  const chi = s.turno.giocatore;
  const dopoLancio = esegui(s, { tipo: 'lancia', giocatore: chi }, dadi([1, 2])).stato;
  return esegui(dopoLancio, { tipo: 'fine_turno', giocatore: chi });
}

describe('bonus per chi gioca dopo il primo', () => {
  it('il 5% dei soldi iniziali per posto, il 2,5% in due, arrotondato ai 5 €', () => {
    expect(bonusPerPosto(1500, 4)).toBe(75);
    expect(bonusPerPosto(1500, 6)).toBe(75);
    expect(bonusPerPosto(1500, 2)).toBe(35);
    expect(bonusPerPosto(1000, 3)).toBe(50);
    expect(bonusPerPosto(500, 2)).toBe(10);
    expect(bonusPerPosto(3000, 8)).toBe(150);
  });
});

describe('durata massima', () => {
  it('quando mancano dieci turni a testa il registro avvisa', () => {
    const s = partitaDiProva(2);
    s.turno.numero = 2 * TURNI_A_TESTA - 20;
    const { eventi } = giocaTurno(s);
    expect(eventi).toContainEqual({ tipo: 'ultimi_turni', turni: 20 });
  });

  it('dopo l’ultimo turno vince il patrimonio più alto', () => {
    const s = partitaDiProva(3);
    s.turno.numero = 3 * TURNI_A_TESTA;
    g(s, 'b').saldo = 2400;
    g(s, 'c').saldo = 900;
    const { stato, eventi } = giocaTurno(s);
    expect(stato.fase).toBe('finita');
    expect(stato.vincitore).toBe('b');
    expect(eventi.at(-1)).toEqual({ tipo: 'fine', vincitore: 'b', durata: true });
    expect(eventi.some((e) => e.tipo === 'turno')).toBe(false);
    expect(problemi(stato)).toEqual([]);
    // In classifica chi è ancora in gioco sta davanti per patrimonio: b, poi a (1500 € e Aosta libera), poi c.
    expect(classifica(stato).map((p) => p.giocatore)).toEqual(['b', 'a', 'c']);
  });

  it('a squadre vince la squadra più ricca, anche se il giocatore più ricco è dell’altra', () => {
    // a e b insieme, c e d insieme: l'ordine dei turni è a, c, b, d.
    const s = partitaASquadre([0, 0, 1, 1]);
    s.turno.numero = 4 * TURNI_A_TESTA;
    g(s, 'c').saldo = 3000;
    g(s, 'd').saldo = 100;
    g(s, 'a').saldo = 1700;
    g(s, 'b').saldo = 1700;
    const { stato, eventi } = giocaTurno(s);
    expect(stato.squadraVincitrice).toBe(0);
    expect(eventi.at(-1)).toMatchObject({ tipo: 'fine', squadra: 0, durata: true });
    expect(problemi(stato)).toEqual([]);
  });

  it('senza la regola la partita continua', () => {
    const s = partitaDiProva(2, { durataMassima: false });
    s.turno.numero = 5 * TURNI_A_TESTA;
    const { stato, eventi } = giocaTurno(s);
    expect(stato.fase).toBe('in_corso');
    expect(eventi.some((e) => e.tipo === 'ultimi_turni')).toBe(false);
  });
});
