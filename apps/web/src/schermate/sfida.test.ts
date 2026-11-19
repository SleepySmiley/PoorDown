import { describe, expect, it } from 'vitest';
import { casoDaSeme, creaPartita, IMPOSTAZIONI_PREDEFINITE, TEMPI, type Sfida, type Stato } from '@poordown/engine';
import type { MorraInScena } from './regia';
import { affittoNormale, fraseEsito, poste, quadroSfida, suonoEsitoMorra, tempiMorra, vincitore } from './sfida';

/** Giro del mondo: Anna è caduta sulla città di Bruno (Italy, 70 €), Carla guarda. */
function partita(sfida: Partial<Sfida> | null): Stato {
  const esito = creaPartita(
    [
      { id: 'a', nome: 'Anna', colore: 1 },
      { id: 'b', nome: 'Bruno', colore: 2 },
      { id: 'c', nome: 'Carla', colore: 3 },
    ],
    { ...IMPOSTAZIONI_PREDEFINITE, ordineCasuale: false, mappa: 'giro_del_mondo' },
    casoDaSeme(1),
  );
  if (!esito.ok) throw new Error(esito.messaggio);
  const s = structuredClone(esito.stato);
  s.sfida = sfida && { sfidante: 'a', proprietario: 'b', casella: 5, importo: 70, fase: 'scelta', segno: null, scadenza: 15_000, ...sfida };
  return s;
}

const nome = (id: string) => ({ a: 'Anna', b: 'Bruno', c: 'Carla' })[id] ?? '?';

function morra(esito: MorraInScena['esito'], importo: number): MorraInScena {
  return { n: 9, da: 'a', a: 'b', casella: 5, segni: ['carta', 'sasso'], esito, importo };
}

/** La regia ha finito: la pedina di Anna è ferma su Italy, la città della sfida. */
const ferma = { occupata: false, morra: null, arrivo: { casella: 5, tono: 'normale' as const } };

describe('quadroSfida', () => {
  it('la scelta (pagare o sfidare) la vede solo chi è caduto sulla città', () => {
    const s = partita({});
    expect(quadroSfida(s, s, ferma, 'a')).toEqual({ tipo: 'scelta', sfida: s.sfida });
    expect(quadroSfida(s, s, ferma, 'b')).toBeNull();
    expect(quadroSfida(s, s, ferma, 'c')).toBeNull();
    expect(quadroSfida(s, s, ferma, null)).toBeNull();
  });

  it('lanciata la sfida, tutti vedono chi sfida chi: lo sfidato per scegliere il segno', () => {
    const s = partita({ fase: 'morra' });
    expect(quadroSfida(s, s, ferma, 'b')).toMatchObject({ tipo: 'morra', ruolo: 'proprietario' });
    expect(quadroSfida(s, s, ferma, 'a')).toMatchObject({ tipo: 'morra', ruolo: 'sfidante' });
    expect(quadroSfida(s, s, ferma, 'c')).toMatchObject({ tipo: 'morra', ruolo: 'spettatore' });
    expect(quadroSfida(s, s, ferma, null)).toMatchObject({ tipo: 'morra', ruolo: 'spettatore' });
  });

  it('aspetta la pedina: niente riquadro finché la partita mostrata o la scena sono indietro', () => {
    const vivo = partita({});
    const mostrata = partita(null);
    // La pedina sta ancora camminando: la partita mostrata non ha la sfida.
    expect(quadroSfida(vivo, mostrata, { ...ferma, occupata: true }, 'a')).toBeNull();
    // La partita mostrata ce l'ha, ma una scena è ancora in corso.
    expect(quadroSfida(vivo, vivo, { ...ferma, occupata: true }, 'a')).toBeNull();
    // La sfida è chiusa (pagata o finita): sparisce subito, anche se la partita mostrata ce l'ha ancora.
    expect(quadroSfida(mostrata, vivo, ferma, 'a')).toBeNull();
  });

  it('aspetta che la pedina sia ferma sulla città della sfida (Bermuda, Antipodi, volo, carte)', () => {
    const s = partita({});
    // Nel vortice delle Bermuda (o in volo) la pedina non è ferma da nessuna parte.
    expect(quadroSfida(s, s, { ...ferma, arrivo: null }, 'a')).toBeNull();
    // Ferma sulla casella delle Bermuda: deve ancora ricomparire sulla città.
    expect(quadroSfida(s, s, { ...ferma, arrivo: { casella: 11, tono: 'normale' } }, 'a')).toBeNull();
    expect(quadroSfida(partita({ fase: 'morra' }), partita({ fase: 'morra' }), { ...ferma, arrivo: null }, 'b')).toBeNull();
    expect(quadroSfida(s, s, ferma, 'a')).toMatchObject({ tipo: 'scelta' });
  });

  it('la scena delle mani si vede per tutti, anche a sfida già chiusa, con l’affitto in gioco', () => {
    const chiusa = partita(null);
    const mostrata = partita({ fase: 'morra' });
    const m = morra('vinta', 0);
    expect(quadroSfida(chiusa, mostrata, { ...ferma, occupata: true, morra: m }, 'c')).toEqual({
      tipo: 'scena',
      morra: m,
      ruolo: 'spettatore',
      affitto: 70,
    });
    expect(quadroSfida(chiusa, mostrata, { ...ferma, occupata: true, morra: m }, 'b')).toMatchObject({ ruolo: 'proprietario' });
  });
});

describe('la scena della morra', () => {
  it('tre colpi, poi le mani si aprono e arriva l’esito, tutto dentro TEMPI.morra', () => {
    const t = tempiMorra();
    expect(t.battute[0]).toBeGreaterThan(0);
    expect(t.battute[1] - t.battute[0]).toBe(t.battute[0]);
    expect(t.battute[2]).toBeLessThan(t.apertura);
    expect(t.apertura).toBeLessThan(t.esito);
    // Dopo l'esito resta il tempo di leggerlo.
    expect(TEMPI.morra - t.esito).toBeGreaterThanOrEqual(600);
  });

  it('chi vince, e l’affitto normale anche quando chi vince non paga', () => {
    expect(vincitore(morra('vinta', 0))).toBe('a');
    expect(vincitore(morra('persa', 140))).toBe('b');
    expect(vincitore(morra('pari', 70))).toBeNull();
    const aperta = partita({ fase: 'morra' }).sfida;
    expect(affittoNormale(morra('vinta', 0), aperta)).toBe(70);
    expect(affittoNormale(morra('persa', 140), null)).toBe(70);
    expect(affittoNormale(morra('pari', 70), null)).toBe(70);
  });

  it('l’esito in parole: in seconda persona a chi gioca', () => {
    expect(fraseEsito(morra('vinta', 0), 'sfidante', nome)).toBe('Hai vinto: non paghi');
    expect(fraseEsito(morra('persa', 140), 'sfidante', nome)).toBe('Hai perso: paghi 140 €');
    expect(fraseEsito(morra('persa', 140), 'proprietario', nome)).toBe('Hai vinto: incassi 140 €');
    expect(fraseEsito(morra('vinta', 0), 'proprietario', nome)).toBe('Vince Anna: niente affitto');
    expect(fraseEsito(morra('pari', 70), 'spettatore', nome)).toBe('Pari: affitto normale');
  });

  it('festa a chi vince, delusione a chi perde, un esito neutro agli altri e col pari', () => {
    expect(suonoEsitoMorra('vinta', true, false)).toBe('morraVinta');
    expect(suonoEsitoMorra('vinta', false, true)).toBe('morraPersa');
    expect(suonoEsitoMorra('persa', true, false)).toBe('morraPersa');
    expect(suonoEsitoMorra('persa', false, true)).toBe('morraVinta');
    expect(suonoEsitoMorra('pari', true, false)).toBe('morraEsito');
    expect(suonoEsitoMorra('vinta', false, false)).toBe('morraEsito');
  });
});

describe('poste', () => {
  const sf = { sfidante: 'a', proprietario: 'b' };
  it('chi sfida rischia il doppio e può non pagare niente', () => {
    expect(poste(70, 'sfidante', nome, sf).map((p) => [p.etichetta, p.importo, p.tono])).toEqual([
      ['Vinci', 0, 'bene'],
      ['Pari', 70, 'neutro'],
      ['Perdi', 140, 'male'],
    ]);
  });

  it('allo sfidato lo stesso ordine, visto dalla sua parte', () => {
    expect(poste(70, 'proprietario', nome, sf).map((p) => [p.esito, p.etichetta, p.tono])).toEqual([
      ['vinta', 'Perdi', 'male'],
      ['pari', 'Pari', 'neutro'],
      ['persa', 'Vinci', 'bene'],
    ]);
  });

  it('per gli altri nomina chi vince', () => {
    expect(poste(70, 'spettatore', nome, sf).map((p) => p.etichetta)).toEqual(['Vince Anna', 'Pari', 'Vince Bruno']);
  });
});
