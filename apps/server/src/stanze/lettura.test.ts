import { describe, expect, it } from 'vitest';
import { leggiAttivita, leggiMossa, leggiPacchetto } from './lettura';

const vuoto = { soldi: 0, caselle: [], grazie: [] };

describe('lettura dei comandi di gioco', () => {
  it('case, ipoteche e aste', () => {
    expect(leggiMossa({ tipo: 'costruisci', casella: 11 })).toEqual({ tipo: 'costruisci', casella: 11 });
    expect(leggiMossa({ tipo: 'riscatta', casella: '11' })).toBeNull();
    expect(leggiMossa({ tipo: 'asta', extra: 1 })).toEqual({ tipo: 'asta' });
    expect(leggiMossa({ tipo: 'offri', importo: 12 })).toEqual({ tipo: 'offri', importo: 12 });
    expect(leggiMossa({ tipo: 'offri', importo: 0 })).toBeNull();
    expect(leggiMossa({ tipo: 'offri', importo: 2.5 })).toBeNull();
  });

  it('scambi: si costruisce un oggetto nuovo, con le caselle senza ripetizioni', () => {
    const letta = leggiMossa({
      tipo: 'proponi',
      a: 'xyz',
      dare: { soldi: 100, caselle: [11, 11, 13], grazie: ['busta'], segreto: 1 },
      avere: vuoto,
      nota: 'ciao',
      altro: true,
    });
    expect(letta).toEqual({
      tipo: 'proponi',
      a: 'xyz',
      dare: { soldi: 100, caselle: [11, 13], grazie: ['busta'] },
      avere: vuoto,
      nota: 'ciao',
    });
    expect(leggiMossa({ tipo: 'proponi', a: 'xyz', dare: vuoto, avere: vuoto, sostituisce: 4 })).toEqual({
      tipo: 'proponi',
      a: 'xyz',
      dare: vuoto,
      avere: vuoto,
      nota: '',
      sostituisce: 4,
    });
    expect(leggiMossa({ tipo: 'accetta', scambio: 3 })).toEqual({ tipo: 'accetta', scambio: 3 });
    expect(leggiMossa({ tipo: 'annulla' })).toBeNull();
  });

  it('pacchetti non validi', () => {
    expect(leggiPacchetto({ soldi: -1, caselle: [], grazie: [] })).toBeNull();
    expect(leggiPacchetto({ soldi: 0, caselle: [-1], grazie: [] })).toBeNull();
    expect(leggiPacchetto({ soldi: 0, caselle: [], grazie: ['jolly'] })).toBeNull();
    expect(leggiPacchetto({ soldi: 0, caselle: 'tutte', grazie: [] })).toBeNull();
    expect(leggiPacchetto({ soldi: 0, caselle: Array.from({ length: 65 }, () => 1), grazie: [] })).toBeNull();
    expect(leggiPacchetto(null)).toBeNull();
  });

  it('attività sugli scambi', () => {
    expect(leggiAttivita(null)).toBeNull();
    expect(leggiAttivita({ tipo: 'crea' })).toEqual({ tipo: 'crea' });
    expect(leggiAttivita({ tipo: 'guarda', scambio: 2 })).toEqual({ tipo: 'guarda', scambio: 2 });
    expect(leggiAttivita({ tipo: 'tratta' })).toBeUndefined();
    expect(leggiAttivita('crea')).toBeUndefined();
  });
});
