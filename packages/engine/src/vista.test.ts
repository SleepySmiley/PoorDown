import { describe, expect, it } from 'vitest';
import { casoDaSeme } from './caso';
import { AGGETTIVI, nomeCasuale, pulisciNome, SOSTANTIVI } from './nomi';
import { partitaDiProva } from './prove';
import { azioniPossibili } from './regole';
import { mossePossibili, vistaPartita } from './vista';

describe('vistaPartita', () => {
  it('nasconde l’ordine dei mazzi e lascia intatto lo stato originale', () => {
    const stato = partitaDiProva(3);
    const ordine = [...stato.mazzi.busta.ordine];
    const vista = vistaPartita(stato);
    expect(vista.mazzi).toEqual({ busta: { ordine: [], prossima: 0 }, cartolina: { ordine: [], prossima: 0 } });
    expect(JSON.stringify(vista)).not.toContain(JSON.stringify(ordine));
    expect(stato.mazzi.busta.ordine).toEqual(ordine);
    expect(vista.giocatori).toEqual(stato.giocatori);
  });

  it('basta all’interfaccia per sapere quali pulsanti mostrare', () => {
    const stato = partitaDiProva(2);
    expect(azioniPossibili(vistaPartita(stato), 'a')).toEqual(azioniPossibili(stato, 'a'));
    expect(mossePossibili(vistaPartita(stato), 'a')).toEqual([{ tipo: 'lancia' }, { tipo: 'bancarotta' }]);
  });
});

describe('nomi', () => {
  it('genera nomi "Sostantivo Aggettivo" diversi', () => {
    const caso = casoDaSeme(7);
    const nomi = new Set(Array.from({ length: 30 }, () => nomeCasuale(caso)));
    expect(nomi.size).toBeGreaterThan(20);
    for (const nome of nomi) {
      const [sostantivo, aggettivo] = nome.split(' ');
      expect(SOSTANTIVI).toContain(sostantivo);
      expect(AGGETTIVI).toContain(aggettivo);
    }
  });

  it('pulisce il nickname', () => {
    expect(pulisciNome('  Anna   Bianchi ')).toBe('Anna Bianchi');
    expect(pulisciNome('Anna\tBianchi\n')).toBe('Anna Bianchi');
    expect(pulisciNome('Ugo\u0000\u202E')).toBe('Ugo');
    expect(pulisciNome('   ')).toBe('');
    expect(pulisciNome('x'.repeat(40))).toHaveLength(32);
    // Le emoji contano un carattere e non vengono spezzate a metà.
    expect(Array.from(pulisciNome('😀'.repeat(40)))).toHaveLength(32);
  });
});
