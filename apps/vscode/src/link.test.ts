import { describe, expect, it } from 'vitest';
import { eInfoDiPoorDown, indirizzoPerGliAmici, leggiLink } from './link';

describe('leggiLink', () => {
  it('accetta i link online, della rete di casa e di questo PC', () => {
    expect(leggiLink('  https://parole-a-caso.trycloudflare.com/stanza/abcde ')).toEqual({
      tipo: 'valido',
      indirizzo: 'https://parole-a-caso.trycloudflare.com/stanza/abcde',
      origine: 'https://parole-a-caso.trycloudflare.com',
    });
    expect(leggiLink('http://192.168.1.23:3000/stanza/abcde')).toMatchObject({ tipo: 'valido', origine: 'http://192.168.1.23:3000' });
    expect(leggiLink('http://localhost:3000/stanza/abcde')).toMatchObject({ tipo: 'valido', origine: 'http://localhost:3000' });
    expect(leggiLink('http://127.0.0.1:3001/')).toMatchObject({ tipo: 'valido', origine: 'http://127.0.0.1:3001' });
  });

  it('indovina l’inizio che manca', () => {
    expect(leggiLink('parole-a-caso.trycloudflare.com/stanza/abcde')).toMatchObject({
      indirizzo: 'https://parole-a-caso.trycloudflare.com/stanza/abcde',
    });
    expect(leggiLink('192.168.1.23:3000/stanza/abcde')).toMatchObject({ indirizzo: 'http://192.168.1.23:3000/stanza/abcde' });
    expect(leggiLink('localhost:3000')).toMatchObject({ indirizzo: 'http://localhost:3000/' });
  });

  it('rifiuta quello che non è un link della partita', () => {
    expect(leggiLink('')).toMatchObject({ tipo: 'non-valido' });
    expect(leggiLink('file:///C:/Windows/win.ini')).toMatchObject({ tipo: 'non-valido' });
    expect(leggiLink('javascript://alert(1)')).toMatchObject({ tipo: 'non-valido' });
    expect(leggiLink('https://nome:segreto@esempio.it/')).toMatchObject({ tipo: 'non-valido' });
    expect(leggiLink('https://')).toMatchObject({ tipo: 'non-valido' });
  });
});

describe('risposte di /api/info', () => {
  const info = { nome: 'PoorDown', versione: '0.1.0', indirizzi: ['http://192.168.1.23:3000'], online: true, pubblico: null };

  it('riconosce PoorDown', () => {
    expect(eInfoDiPoorDown(info)).toBe(true);
    expect(eInfoDiPoorDown({ nome: 'Altro' })).toBe(false);
    expect(eInfoDiPoorDown('PoorDown')).toBe(false);
    expect(eInfoDiPoorDown(null)).toBe(false);
  });

  it('dà agli amici il link online, poi quello di casa, poi questo PC', () => {
    expect(indirizzoPerGliAmici({ ...info, pubblico: 'https://a-b.trycloudflare.com' }, 3000)).toBe('https://a-b.trycloudflare.com');
    expect(indirizzoPerGliAmici(info, 3000)).toBe('http://192.168.1.23:3000');
    expect(indirizzoPerGliAmici({ ...info, indirizzi: [] }, 3001)).toBe('http://localhost:3001');
  });
});
