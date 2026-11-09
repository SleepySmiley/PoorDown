import { describe, expect, it } from 'vitest';
import { caselleDellaRegione } from './conti';
import { TABELLONI } from './tabelloni';
import { CLASSICO } from './tabelloni/classico';
import { EUROPA } from './tabelloni/europa';
import { FORTUNA } from './tabelloni/fortuna';
import { GRANDI_AREE } from './tabelloni/grandi-aree';
import { affittiPerPrezzo } from './tabelloni/scala';
import type { Tabellone } from './tipi';

const conta = (tab: Tabellone, tipo: string) => tab.caselle.filter((c) => c.tipo === tipo).length;
const posizioni = (tab: Tabellone, mazzo: string) =>
  tab.caselle.flatMap((c, i) => (c.tipo === 'carta' && c.mazzo === mazzo ? [i] : []));
const gruppi = (tab: Tabellone) => tab.regioni.map((_, r) => caselleDellaRegione(tab, r).length);

describe('tabellone Classico', () => {
  const tab = CLASSICO;

  it('ha la struttura di richup: 40 caselle, angoli a 0/10/20/30', () => {
    expect(tab.caselle).toHaveLength(40);
    expect(tab.prigione).toBe(10);
    expect([conta(tab, 'citta'), conta(tab, 'stazione'), conta(tab, 'servizio'), conta(tab, 'carta'), conta(tab, 'tassa')]).toEqual([
      22, 4, 2, 6, 2,
    ]);
    expect(gruppi(tab)).toEqual([2, 3, 3, 3, 3, 3, 3, 2]);
  });

  it('ogni mazzo ha 17 carte', () => {
    for (const carte of Object.values(tab.mazzi)) expect(carte).toHaveLength(17);
  });

  it('le caselle Busta e Cartolina sono dove le vuole il tabellone', () => {
    expect(posizioni(tab, 'busta')).toEqual([2, 17, 33]);
    expect(posizioni(tab, 'cartolina')).toEqual([8, 22, 36]);
  });

  it('la scala degli affitti ridà esattamente gli affitti del Classico', () => {
    for (const c of tab.caselle) if (c.tipo === 'citta') expect(affittiPerPrezzo(c.prezzo)).toEqual(c.affitti);
  });
});

describe('tabelloni alternativi', () => {
  it('Europa: 48 caselle, 10 paesi, 3 servizi, prigione a 12', () => {
    const tab = EUROPA;
    expect(tab.caselle).toHaveLength(48);
    expect(tab.prigione).toBe(12);
    expect([conta(tab, 'citta'), conta(tab, 'stazione'), conta(tab, 'servizio'), conta(tab, 'carta'), conta(tab, 'tassa')]).toEqual([
      28, 4, 3, 7, 2,
    ]);
    expect(gruppi(tab)).toEqual([2, 3, 2, 3, 4, 3, 2, 3, 3, 3]);
    expect(posizioni(tab, 'busta')).toEqual([2, 17, 39, 45]);
    expect(posizioni(tab, 'cartolina')).toEqual([8, 26, 41]);
  });

  it('Grandi aree: una sola area per lato, da 5 o 6 città', () => {
    const tab = GRANDI_AREE;
    expect(tab.caselle).toHaveLength(40);
    expect(gruppi(tab)).toEqual([5, 6, 6, 5]);
    tab.regioni.forEach((_, r) => {
      const lati = new Set(caselleDellaRegione(tab, r).map((i) => Math.floor(i / 10)));
      expect([...lati]).toEqual([r]);
    });
  });

  it('Colpo di fortuna: città solo sui lati 1 e 3, niente servizi, un Rimborso', () => {
    const tab = FORTUNA;
    expect(tab.caselle).toHaveLength(40);
    expect(conta(tab, 'servizio')).toBe(0);
    expect(conta(tab, 'premio')).toBe(1);
    expect(gruppi(tab)).toEqual([2, 2, 2, 2, 2, 2, 2, 2]);
    const lati = new Set(tab.caselle.flatMap((c, i) => (c.tipo === 'citta' ? [Math.floor(i / 10)] : [])));
    expect([...lati].sort()).toEqual([0, 2]);
    expect([conta(tab, 'carta'), conta(tab, 'tassa')]).toEqual([12, 3]);
    expect(tab.mazzi.cartolina).toHaveLength(20);
  });
});

describe.each(Object.values(TABELLONI).map((tab) => [tab.nome, tab] as const))('%s', (_, tab) => {
  const n = tab.caselle.length;

  it('ha gli angoli al loro posto e la prigione nell’angolo giusto', () => {
    expect(n % 4).toBe(0);
    expect([0, n / 4, n / 2, (3 * n) / 4].map((i) => tab.caselle[i]!.tipo)).toEqual([
      'partenza',
      'prigione',
      'vacanza',
      'vai_in_prigione',
    ]);
    expect(tab.prigione).toBe(n / 4);
    // Nessun angolo in mezzo ai lati.
    const angoli = tab.caselle.flatMap((c, i) =>
      ['partenza', 'prigione', 'vacanza', 'vai_in_prigione'].includes(c.tipo) ? [i] : [],
    );
    expect(angoli).toEqual([0, n / 4, n / 2, (3 * n) / 4]);
  });

  it('prezzi e affitti crescono lungo il tabellone e con i livelli', () => {
    let prezzoPrima = 0;
    for (const c of tab.caselle) {
      if (c.tipo !== 'citta') continue;
      expect(c.prezzo).toBeGreaterThanOrEqual(prezzoPrima);
      prezzoPrima = c.prezzo;
      for (let l = 1; l < 6; l++) expect(c.affitti[l]).toBeGreaterThan(c.affitti[l - 1]!);
    }
    expect(Math.min(...tab.regioni.map((r) => r.costoCasa))).toBe(50);
    // Al massimo 200 €: su Grandi aree il Nord costa 150 € (bilanciamento della Fase 9).
    expect(Math.max(...tab.regioni.map((r) => r.costoCasa))).toBeLessThanOrEqual(200);
  });

  it('le regioni hanno sigla e colore, e almeno due città', () => {
    for (const [r, regione] of tab.regioni.entries()) {
      expect(regione.sigla).toMatch(/^[A-Z]{3}$/);
      expect(regione.colore).toBeGreaterThanOrEqual(1);
      expect(regione.colore).toBeLessThanOrEqual(10);
      expect(caselleDellaRegione(tab, r).length).toBeGreaterThanOrEqual(2);
    }
    expect(new Set(tab.regioni.map((r) => r.colore)).size).toBe(tab.regioni.length);
    expect(new Set(tab.caselle.filter((c) => c.tipo === 'citta').map((c) => c.nome)).size).toBe(conta(tab, 'citta'));
  });

  it('ogni mazzo ha una sola Carta Grazia e nessuna carta che porti dove non si può', () => {
    const servizi = conta(tab, 'servizio');
    for (const carte of Object.values(tab.mazzi)) {
      expect(carte.filter((c) => c.effetto.tipo === 'grazia')).toHaveLength(1);
      for (const carta of carte) {
        const e = carta.effetto;
        if (e.tipo === 'vai_a') expect(carta.testo).toContain(tab.caselle[e.casella]!.nome);
        if (e.tipo === 'prossima' && e.casella === 'servizio') expect(servizi).toBeGreaterThan(0);
      }
    }
    expect(tab.moltiplicatoriServizi.length).toBeGreaterThanOrEqual(servizi);
  });

  it('ha la descrizione per la lobby', () => {
    expect(tab.descrizione.length).toBeGreaterThan(20);
  });
});
