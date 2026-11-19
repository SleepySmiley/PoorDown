import { describe, expect, it } from 'vitest';
import { casoDaSeme, creaPartita, IMPOSTAZIONI_PREDEFINITE, type Impostazioni, type Stato } from '@poordown/engine';
import { cittaDelCompagno, colorePedina, coloreSquadra, tintaProprietario } from './squadre';

/** Anna e Bruno nella squadra 0, Carla e Dario nella 1 (oppure tutti senza squadra). */
function partita(impostazioni: Partial<Impostazioni>): Stato {
  const esito = creaPartita(
    [
      { id: 'a', nome: 'Anna', colore: 5, squadra: 0 },
      { id: 'b', nome: 'Bruno', colore: 7, squadra: 0 },
      { id: 'c', nome: 'Carla', colore: 2, squadra: 1 },
      { id: 'd', nome: 'Dario', colore: 9, squadra: 1 },
    ],
    { ...IMPOSTAZIONI_PREDEFINITE, ordineCasuale: false, ...impostazioni },
    casoDaSeme(1),
  );
  if (!esito.ok) throw new Error(esito.messaggio);
  return esito.stato;
}

function giocatore(s: Stato, id: string) {
  return s.giocatori.find((g) => g.id === id)!;
}

describe('colori delle squadre', () => {
  it('le variabili CSS: --sq1…--sq4 per le squadre, --p1…--p12 per le pedine', () => {
    expect(coloreSquadra(0)).toBe('var(--sq1)');
    expect(coloreSquadra(3)).toBe('var(--sq4)');
    expect(colorePedina(12)).toBe('var(--p12)');
  });

  it('a squadre le proprietà prendono il colore della squadra, se chi guarda lo vuole', () => {
    const s = partita({ squadre: true });
    expect(tintaProprietario(s, giocatore(s, 'b'), true)).toBe('var(--sq1)');
    expect(tintaProprietario(s, giocatore(s, 'd'), true)).toBe('var(--sq2)');
    // Chi guarda ha scelto i colori dei giocatori.
    expect(tintaProprietario(s, giocatore(s, 'b'), false)).toBe('var(--p7)');
  });

  it('senza squadre resta sempre il colore della pedina', () => {
    const s = partita({ squadre: false });
    expect(tintaProprietario(s, giocatore(s, 'a'), true)).toBe('var(--p5)');
  });
});

describe('città dei compagni su cui costruire', () => {
  // Classico: Courmayeur (1) e Aosta (3) sono città, la Stazione Nord (5) no.
  function conPossessi(impostazioni: Partial<Impostazioni>): Stato {
    const s = partita(impostazioni);
    s.proprieta[1]!.proprietario = 'a';
    s.proprieta[3]!.proprietario = 'b';
    s.proprieta[5]!.proprietario = 'b';
    s.proprieta[6]!.proprietario = 'c';
    return s;
  }

  it('solo con la costruzione di squadra, solo le città dei compagni', () => {
    const s = conPossessi({ squadre: true, costruzioneDiSquadra: true });
    expect(cittaDelCompagno(s, 'a', 3)).toBe(true);
    // La propria città si costruisce dalla lista «Le mie proprietà».
    expect(cittaDelCompagno(s, 'a', 1)).toBe(false);
    expect(cittaDelCompagno(s, 'a', 5)).toBe(false);
    expect(cittaDelCompagno(s, 'a', 6)).toBe(false);
    expect(cittaDelCompagno(s, 'a', 9)).toBe(false);
  });

  it('senza la regola, o senza squadre, mai', () => {
    expect(cittaDelCompagno(conPossessi({ squadre: true }), 'a', 3)).toBe(false);
    expect(cittaDelCompagno(conPossessi({ squadre: false, costruzioneDiSquadra: true }), 'a', 3)).toBe(false);
  });
});
