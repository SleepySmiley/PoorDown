import { describe, expect, it } from 'vitest';
import { ritardiPalette } from './utili';

describe('Palette', () => {
  it('la prima che cambia parte subito, le altre ogni 30 ms verso sinistra', () => {
    expect(ritardiPalette('1.554', '1.528')).toEqual([0, 0, 0, 30, 0]);
    expect(ritardiPalette('0:58', '0:57')).toEqual([0, 0, 0, 0]);
    expect(ritardiPalette('1:00', '0:59')).toEqual([60, 0, 30, 0]);
  });

  it('se cambia solo una cifra in mezzo parte subito', () => {
    expect(ritardiPalette('1.554', '1.354')).toEqual([0, 0, 0, 0, 0]);
  });

  it('il numero che si allunga resta allineato a destra', () => {
    expect(ritardiPalette('999', '1.000')).toEqual([90, 0, 60, 30, 0]);
  });

  it('alla prima comparsa girano tutte, da destra', () => {
    expect(ritardiPalette('', 'AB7')).toEqual([60, 30, 0]);
  });
});
