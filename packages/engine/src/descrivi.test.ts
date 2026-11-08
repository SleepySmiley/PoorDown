import { describe, expect, it } from 'vitest';
import { descrivi, euro } from './descrivi';
import { dadi, esegui, partitaDiProva, primaCarta } from './prove';

describe('descrivi', () => {
  it('formatta gli euro all’italiana', () => {
    expect(euro(1500)).toBe('1.500 €');
    expect(euro(75)).toBe('75 €');
    expect(euro(-190)).toBe('−190 €');
  });

  it('scrive le righe del registro', () => {
    const s = partitaDiProva();
    s.giocatori[1]!.posizione = 3;
    s.proprieta[7]!.proprietario = 'b';
    const { stato, eventi } = esegui(s, { tipo: 'lancia', giocatore: 'a' }, dadi([3, 4]));
    expect(eventi.map((e) => descrivi(e, stato)).filter(Boolean)).toEqual([
      'Anna tira 3 e 4 e va a Sassari.',
      'Anna paga 6 € di affitto a Bruno per Sassari.',
    ]);
  });

  it('usa “ad”, “all’” e “alla casella” dove serve', () => {
    const verso = (a: number) => descrivi({ tipo: 'movimento', giocatore: 'a', da: 0, a }, partitaDiProva());
    expect(verso(3)).toBe('Anna va ad Aosta.');
    expect(verso(27)).toBe('Anna va all’Acquedotto.');
    expect(verso(5)).toBe('Anna va alla Stazione Nord.');
    expect(verso(8)).toBe('Anna va alla casella Cartolina.');
    expect(verso(10)).toBe('Anna va in visita alla Prigione.');
  });

  it('riporta il testo della carta', () => {
    const s = primaCarta(partitaDiProva(), 'cartolina', 13);
    const { stato, eventi } = esegui(s, { tipo: 'lancia', giocatore: 'a' }, dadi([3, 5]));
    expect(eventi.map((e) => descrivi(e, stato))).toContain('Anna pesca una Cartolina: «Aiuti un parente. Paga 50 €.»');
  });
});
