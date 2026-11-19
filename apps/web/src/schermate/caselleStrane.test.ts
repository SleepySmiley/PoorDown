import { describe, expect, it } from 'vitest';
import { giornoGuadagnato } from './caselleStrane';

describe('il calendario della Linea del cambio di data', () => {
  it('gira di un giorno, anche a fine mese e a fine anno', () => {
    expect(giornoGuadagnato(new Date(2026, 10, 19))).toEqual({ prima: { giorno: '19', mese: 'NOV' }, dopo: { giorno: '20', mese: 'NOV' } });
    expect(giornoGuadagnato(new Date(2026, 1, 28))).toEqual({ prima: { giorno: '28', mese: 'FEB' }, dopo: { giorno: '01', mese: 'MAR' } });
    expect(giornoGuadagnato(new Date(2026, 11, 31)).dopo).toEqual({ giorno: '01', mese: 'GEN' });
  });
});
