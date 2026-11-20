import { describe, expect, it } from 'vitest';
import { casoDaSeme, creaPartita, IMPOSTAZIONI_PREDEFINITE, tabellone, type Stato } from '@poordown/engine';
import { possessiEvidenziati } from './possessi';

/** Anna e Bruno nella squadra 0, Carla nella 1. */
function partita(): Stato {
  const esito = creaPartita(
    [
      { id: 'a', nome: 'Anna', colore: 1, squadra: 0 },
      { id: 'b', nome: 'Bruno', colore: 2, squadra: 0 },
      { id: 'c', nome: 'Carla', colore: 3, squadra: 1 },
    ],
    { ...IMPOSTAZIONI_PREDEFINITE, squadre: true, ordineCasuale: false },
    casoDaSeme(1),
  );
  if (!esito.ok) throw new Error(esito.messaggio);
  return esito.stato;
}

/** Le prime caselle del tipo dato sul tabellone della partita. */
function caselle(s: Stato, tipo: 'citta' | 'stazione' | 'servizio', quante: number): number[] {
  return tabellone(s.mappa)
    .caselle.map((c, n) => (c.tipo === tipo ? n : -1))
    .filter((n) => n >= 0)
    .slice(0, quante);
}

function dai(s: Stato, n: number, id: string, extra: { livello?: number; ipotecata?: boolean } = {}): void {
  s.proprieta[n] = { proprietario: id, livello: extra.livello ?? 0, ipotecata: extra.ipotecata ?? false };
}

describe('le proprietà di chi ha il mouse sulla pedina', () => {
  it('nessuno sotto il mouse, o niente partita: il tabellone resta com’è', () => {
    expect(possessiEvidenziati(partita(), null)).toBeNull();
    expect(possessiEvidenziati(null, 'a')).toBeNull();
  });

  it('città, stazioni e servizi, anche ipotecati e con le case', () => {
    const s = partita();
    const [roma, milano] = caselle(s, 'citta', 2);
    const [stazione] = caselle(s, 'stazione', 1);
    const [servizio] = caselle(s, 'servizio', 1);
    dai(s, roma!, 'a', { livello: 3 });
    dai(s, milano!, 'a', { ipotecata: true });
    dai(s, stazione!, 'a');
    dai(s, servizio!, 'a', { ipotecata: true });
    expect([...possessiEvidenziati(s, 'a')!].sort((x, y) => x - y)).toEqual([roma, milano, stazione, servizio].sort((x, y) => x! - y!));
  });

  it('solo le sue: non quelle del compagno di squadra né degli altri', () => {
    const s = partita();
    const [una, due, tre] = caselle(s, 'citta', 3);
    dai(s, una!, 'a');
    dai(s, due!, 'b');
    dai(s, tre!, 'c');
    expect([...possessiEvidenziati(s, 'a')!]).toEqual([una]);
    expect([...possessiEvidenziati(s, 'b')!]).toEqual([due]);
  });

  it('chi non possiede niente spegne tutto: un insieme vuoto, non null', () => {
    const s = partita();
    dai(s, caselle(s, 'citta', 1)[0]!, 'a');
    expect(possessiEvidenziati(s, 'c')?.size).toBe(0);
  });

  it('chi è fuori dalla partita, o non c’è più, non accende niente', () => {
    const s = partita();
    dai(s, caselle(s, 'citta', 1)[0]!, 'c');
    s.giocatori.find((g) => g.id === 'c')!.eliminato = { turno: 3, motivo: 'bancarotta' };
    expect(possessiEvidenziati(s, 'c')).toBeNull();
    expect(possessiEvidenziati(s, 'zeta')).toBeNull();
  });
});
