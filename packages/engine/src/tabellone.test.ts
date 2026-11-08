import { describe, expect, it } from 'vitest';
import { caselleDellaRegione } from './conti';
import { CLASSICO } from './tabelloni/classico';

const tab = CLASSICO;
const conta = (tipo: string) => tab.caselle.filter((c) => c.tipo === tipo).length;

describe('tabellone Classico', () => {
  it('ha la struttura di richup: 40 caselle, angoli a 0/10/20/30', () => {
    expect(tab.caselle).toHaveLength(40);
    expect([0, 10, 20, 30].map((i) => tab.caselle[i]!.tipo)).toEqual(['partenza', 'prigione', 'vacanza', 'vai_in_prigione']);
    expect(tab.prigione).toBe(10);
    expect([conta('citta'), conta('stazione'), conta('servizio'), conta('carta'), conta('tassa')]).toEqual([22, 4, 2, 6, 2]);
    expect(tab.regioni.map((_, r) => caselleDellaRegione(tab, r).length)).toEqual([2, 3, 3, 3, 3, 3, 3, 2]);
  });

  it('prezzi e affitti crescono lungo il tabellone e con i livelli', () => {
    let prezzoPrima = 0;
    for (const c of tab.caselle) {
      if (c.tipo !== 'citta') continue;
      expect(c.prezzo).toBeGreaterThan(prezzoPrima);
      prezzoPrima = c.prezzo;
      for (let l = 1; l < 6; l++) expect(c.affitti[l]).toBeGreaterThan(c.affitti[l - 1]!);
    }
    expect(Math.min(...tab.regioni.map((r) => r.costoCasa))).toBe(50);
    expect(Math.max(...tab.regioni.map((r) => r.costoCasa))).toBe(200);
  });

  it('ogni mazzo ha 17 carte e una sola Carta Grazia', () => {
    for (const carte of Object.values(tab.mazzi)) {
      expect(carte).toHaveLength(17);
      expect(carte.filter((c) => c.effetto.tipo === 'grazia')).toHaveLength(1);
    }
  });

  it('le carte “Vai a…” portano davvero alla casella che nominano', () => {
    for (const carte of Object.values(tab.mazzi)) {
      for (const carta of carte) {
        if (carta.effetto.tipo !== 'vai_a') continue;
        expect(carta.testo).toContain(tab.caselle[carta.effetto.casella]!.nome);
      }
    }
  });

  it('le caselle Busta e Cartolina sono dove le vuole il tabellone', () => {
    const posizioni = (mazzo: string) =>
      tab.caselle.flatMap((c, i) => (c.tipo === 'carta' && c.mazzo === mazzo ? [i] : []));
    expect(posizioni('busta')).toEqual([2, 17, 33]);
    expect(posizioni('cartolina')).toEqual([8, 22, 36]);
  });
});
