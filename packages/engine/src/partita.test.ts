import { describe, expect, it } from 'vitest';
import { casoDaSeme } from './caso';
import { IMPOSTAZIONI_PREDEFINITE } from './impostazioni';
import { creaPartita } from './partita';
import { ID, NOMI, problemi } from './prove';

const giocatori = (n: number) => ID.slice(0, n).map((id, i) => ({ id, nome: NOMI[i]!, colore: i + 1 }));

describe('creaPartita', () => {
  it('prepara giocatori, proprietà, mazzi e il primo turno', () => {
    const esito = creaPartita(giocatori(3), { ...IMPOSTAZIONI_PREDEFINITE, ordineCasuale: false, soldiIniziali: 2000 }, casoDaSeme(7));
    if (!esito.ok) throw new Error(esito.messaggio);
    const s = esito.stato;
    expect(s.giocatori.map((g) => g.id)).toEqual(['a', 'b', 'c']);
    // Chi gioca dopo il primo parte con il 5% dei soldi iniziali in più per ogni posto.
    expect(s.giocatori.map((g) => g.saldo)).toEqual([2000, 2100, 2200]);
    expect(s.giocatori.every((g) => g.posizione === 0)).toBe(true);
    expect(s.proprieta.filter(Boolean)).toHaveLength(28);
    expect(s.turno).toMatchObject({ giocatore: 'a', numero: 1, fase: 'lancio' });
    expect(esito.eventi).toEqual([
      { tipo: 'inizio', ordineCasuale: false, bonus: 100 },
      { tipo: 'turno', giocatore: 'a', numero: 1 },
    ]);
    expect(problemi(s)).toEqual([]);
  });

  it('con l’ordine casuale mescola i giocatori (sempre gli stessi)', () => {
    const ordini = new Set<string>();
    for (let seme = 1; seme <= 20; seme++) {
      const esito = creaPartita(giocatori(4), IMPOSTAZIONI_PREDEFINITE, casoDaSeme(seme));
      if (!esito.ok) throw new Error(esito.messaggio);
      const ids = esito.stato.giocatori.map((g) => g.id);
      expect([...ids].sort()).toEqual(['a', 'b', 'c', 'd']);
      ordini.add(ids.join());
    }
    expect(ordini.size).toBeGreaterThan(1);
  });

  it('i mazzi sono mescolati in modo diverso a ogni partita', () => {
    const a = creaPartita(giocatori(2), IMPOSTAZIONI_PREDEFINITE, casoDaSeme(1));
    const b = creaPartita(giocatori(2), IMPOSTAZIONI_PREDEFINITE, casoDaSeme(2));
    if (!a.ok || !b.ok) throw new Error('partita non creata');
    expect(a.stato.mazzi.busta.ordine).not.toEqual(b.stato.mazzi.busta.ordine);
  });

  it('rifiuta numeri di giocatori fuori misura e id doppi', () => {
    for (const lista of [giocatori(1), [...giocatori(8), { id: 'z', nome: 'Zeta', colore: 9 }]]) {
      expect(creaPartita(lista, IMPOSTAZIONI_PREDEFINITE, casoDaSeme(1))).toMatchObject({ ok: false, codice: 'giocatori_non_validi' });
    }
    const doppi = [...giocatori(2), { id: 'a', nome: 'Altra Anna', colore: 3 }];
    expect(creaPartita(doppi, IMPOSTAZIONI_PREDEFINITE, casoDaSeme(1)).ok).toBe(false);
  });
});
