/* Uscita dalla partita: effetti sul turno e sul voto in corso. */

import { describe, expect, it } from 'vitest';
import { esegui, g, partitaDiProva, problemi } from './prove';
import { espelli } from './regole';
import type { Stato } from './tipi';

/** Quattro giocatori senza timer: b e c hanno votato contro a, che gioca il turno (servono 3 voti). */
function dueVotiControA(): Stato {
  let s = partitaDiProva(4, { timerTurno: false });
  s = esegui(s, { tipo: 'vota', giocatore: 'b', favorevole: true }).stato;
  s = esegui(s, { tipo: 'vota', giocatore: 'c', favorevole: true }).stato;
  expect(g(s, 'a').eliminato).toBeNull();
  return s;
}

describe('uscita durante un voto', () => {
  it('se dopo l’uscita di un altro i voti già dati bastano, chi gioca esce', () => {
    // d fa bancarotta: in tre servono 2 voti, e ci sono già.
    const r = esegui(dueVotiControA(), { tipo: 'bancarotta', giocatore: 'd' });
    expect(r.eventi.map((e) => e.tipo)).toEqual(['bancarotta', 'rimozione', 'turno']);
    expect(r.eventi).toContainEqual({ tipo: 'rimozione', giocatore: 'a', motivo: 'voto', recuperi: [] });
    expect(g(r.stato, 'a').eliminato).toMatchObject({ motivo: 'voto' });
    expect(r.stato.turno.giocatore).toBe('b');
    expect(r.stato.turno.votazione).toEqual({ voti: [], scadenza: null });
    expect(problemi(r.stato)).toEqual([]);
  });

  it('vale anche quando l’host toglie un giocatore', () => {
    const esito = espelli(dueVotiControA(), 'd', { intero: () => 0 }, 0);
    if (!esito.ok) throw new Error(esito.messaggio);
    expect(g(esito.stato, 'a').eliminato).toMatchObject({ motivo: 'voto' });
    expect(esito.stato.turno.giocatore).toBe('b');
  });

  it('se esce uno di quelli che hanno votato, il suo voto non conta più', () => {
    const r = esegui(dueVotiControA(), { tipo: 'bancarotta', giocatore: 'c' });
    expect(g(r.stato, 'a').eliminato).toBeNull();
    expect(r.stato.turno.giocatore).toBe('a');
    expect(r.stato.turno.votazione.voti).toEqual(['b']);
  });
});
