import { describe, expect, it } from 'vitest';
import { iniziali } from './utili';

const conNomi = (...nomi: string[]) => nomi.map((nome, i) => ({ id: i, nome }));

describe('iniziali distinte', () => {
  it('una lettera sola quando basta', () => {
    expect([...iniziali(conNomi('Anna', 'Bruno', 'Carla')).values()]).toEqual(['A', 'B', 'C']);
  });

  it('due lettere per chi ha la stessa iniziale, la seconda dove i nomi si distinguono', () => {
    expect([...iniziali(conNomi('Castoro Paziente', 'Cometa Audace', 'Merlo')).values()]).toEqual(['Ca', 'Co', 'M']);
    expect([...iniziali(conNomi('Marta', 'Mara')).values()]).toEqual(['Mt', 'Ma']);
  });

  it('nomi uguali: un numero', () => {
    const tutte = [...iniziali(conNomi('Lu', 'Lu')).values()];
    expect(new Set(tutte).size).toBe(2);
  });
});
