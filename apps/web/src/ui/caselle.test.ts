import { describe, expect, it } from 'vitest';
import { caselleVista, nomeInRiga } from './caselle';

describe('nomeInRiga', () => {
  const giro = caselleVista('giro_del_mondo');

  it('al posto di un nome lunghissimo usa quello breve (Bangkok)', () => {
    const bangkok = giro.find((c) => c.breve === 'Bangkok')!;
    expect(bangkok.nome.length).toBeGreaterThan(24);
    expect(nomeInRiga(bangkok)).toBe('Bangkok');
  });

  it('i nomi che ci stanno restano interi, anche se ne hanno uno breve', () => {
    const vaticano = giro.find((c) => c.breve === 'Vaticano')!;
    expect(nomeInRiga(vaticano)).toBe('Città del Vaticano');
  });

  it('senza nome breve resta il nome', () => {
    expect(nomeInRiga({ nome: 'Un nome molto lungo senza un nome breve' })).toBe('Un nome molto lungo senza un nome breve');
  });
});
