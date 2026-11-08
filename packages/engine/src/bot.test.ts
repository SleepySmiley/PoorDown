import { describe, expect, it } from 'vitest';
import { durataScena, guadagnoScambio, mossaBot, mosseDeiBot, riserva, TURNI_TRA_PROPOSTE_BOT, valoreCasella } from './bot';
import { casoDaSeme } from './caso';
import { IMPOSTAZIONI_PREDEFINITE, SOLDI_INIZIALI_POSSIBILI } from './impostazioni';
import { creaPartita } from './partita';
import { assegna, esegui, g, ID, NOMI, partitaDiProva, problemi } from './prove';
import { applica, applicaScadenze, prossimaScadenza } from './regole';
import { TABELLONI } from './tabelloni';
import type { IdMappa, Stato, TipoEvento } from './tipi';

const PARTITE = 24;
const AZIONI_MAX = 6_000;

/** Una partita di soli bot, come la gioca il server: una mossa di un bot alla volta, le scadenze quando nessuno ha da fare. */
function partitaDiBot(seme: number) {
  const caso = casoDaSeme(seme);
  const mappe = Object.keys(TABELLONI) as IdMappa[];
  const n = 2 + caso.intero(5);
  const squadre = n >= 3 && caso.intero(2) === 0;
  const creata = creaPartita(
    ID.slice(0, n).map((id, i) => ({ id, nome: NOMI[i]!, colore: i + 1, squadra: squadre ? i % 2 : null })),
    {
      ...IMPOSTAZIONI_PREDEFINITE,
      mappa: mappe[caso.intero(mappe.length)]!,
      squadre,
      soldiIniziali: SOLDI_INIZIALI_POSSIBILI[caso.intero(SOLDI_INIZIALI_POSSIBILI.length)]!,
      aste: caso.intero(2) === 1,
      ipoteche: caso.intero(2) === 1,
      affittoDoppioSetCompleto: caso.intero(2) === 1,
      cassaVacanza: caso.intero(2) === 1,
      timerTurno: caso.intero(2) === 1,
    },
    caso,
  );
  if (!creata.ok) throw new Error(creata.messaggio);
  let s = creata.stato;
  const bot = s.giocatori.map((x) => x.id);
  // Come la stanza: un bot propone uno scambio al massimo ogni tanti turni.
  const ultimaProposta = new Map<string, number>();
  const proporre = (id: string) => s.turno.numero - (ultimaProposta.get(id) ?? -Infinity) >= TURNI_TRA_PROPOSTE_BOT;
  const visti = new Set<TipoEvento>();
  let adesso = 0;
  let azioni = 0;
  for (; azioni < AZIONI_MAX && s.fase === 'in_corso'; azioni++) {
    const mosse = mosseDeiBot(s, bot, proporre);
    let descrizione: string;
    if (mosse.length > 0) {
      const { azione } = mosse[caso.intero(mosse.length)]!;
      if (azione.tipo === 'proponi') ultimaProposta.set(azione.giocatore, s.turno.numero);
      const esito = applica(s, azione, caso, adesso);
      if (!esito.ok) throw new Error(`Seme ${seme}, azione ${azioni}: il bot ha scelto ${azione.tipo}, rifiutata (${esito.messaggio}).`);
      s = esito.stato;
      for (const e of esito.eventi) visti.add(e.tipo);
      descrizione = azione.tipo;
      adesso += 1_000;
    } else {
      // Nessun bot ha da fare: può succedere solo durante un'asta, in attesa che finisca.
      if (!s.asta) throw new Error(`Seme ${seme}, azione ${azioni}: il turno di ${s.turno.giocatore} è fermo.`);
      adesso = Math.max(adesso, prossimaScadenza(s)!);
      const esito = applicaScadenze(s, caso, adesso)!;
      if (!esito.ok) throw new Error('Scadenza rifiutata.');
      s = esito.stato;
      for (const e of esito.eventi) visti.add(e.tipo);
      descrizione = 'fine dell’asta';
    }
    const errori = problemi(s);
    if (errori.length) throw new Error(`Seme ${seme}, azione ${azioni} (${descrizione}): ${errori.join(' ')}`);
  }
  return { stato: s, azioni, visti };
}

describe('partite di soli bot', () => {
  it(`${PARTITE} partite su tutti i tabelloni: i bot non si bloccano mai e non sbagliano mosse`, { timeout: 120_000 }, () => {
    const visti = new Set<TipoEvento>();
    let finite = 0;
    const mappe = new Set<string>();
    for (let seme = 1; seme <= PARTITE; seme++) {
      const p = partitaDiBot(seme);
      for (const t of p.visti) visti.add(t);
      if (p.stato.fase === 'finita') finite++;
      mappe.add(p.stato.mappa);
      // I bot giocano in tempo: il timer non scade mai per loro.
      expect(p.visti.has('tempo_scaduto')).toBe(false);
    }
    expect(mappe.size).toBe(Object.keys(TABELLONI).length);
    expect(finite).toBeGreaterThanOrEqual(PARTITE * 0.8);
    const attesi: TipoEvento[] = [
      'acquisto', 'costruzione', 'affitto', 'bancarotta', 'fine', 'asta_vinta', 'premio', 'eredita', 'scambio_accettato',
    ];
    expect(attesi.filter((t) => !visti.has(t))).toEqual([]);
  });
});

describe('decisioni dei bot', () => {
  it('compra se resta con abbastanza contante, altrimenti no (o manda all’asta)', () => {
    const s = partitaDiProva(2);
    s.turno.fase = 'dopo_lancio';
    s.turno.acquisto = 39;
    g(s, 'a').posizione = 39;
    expect(mossaBot(s, 'a')).toEqual({ tipo: 'compra', giocatore: 'a' });
    g(s, 'a').saldo = 420;
    expect(mossaBot(s, 'a')).toEqual({ tipo: 'fine_turno', giocatore: 'a' });
    s.impostazioni.aste = true;
    expect(mossaBot(s, 'a')).toEqual({ tipo: 'asta', giocatore: 'a' });
  });

  it('compra comunque la città che gli completa la regione, se se la può permettere', () => {
    const s = assegna(partitaDiProva(2), 'a', 37);
    s.turno.fase = 'dopo_lancio';
    s.turno.acquisto = 39;
    g(s, 'a').saldo = 420;
    expect(valoreCasella(s, 'a', 39)).toBeGreaterThan(800);
    expect(mossaBot(s, 'a')).toEqual({ tipo: 'compra', giocatore: 'a' });
  });

  it('costruisce sulle regioni complete quando ha soldi in più', () => {
    const s = assegna(partitaDiProva(2), 'a', 1, 3);
    expect(mossaBot(s, 'a')).toMatchObject({ tipo: 'costruisci', giocatore: 'a' });
    g(s, 'a').saldo = 120;
    expect(mossaBot(s, 'a')).toEqual({ tipo: 'lancia', giocatore: 'a' });
  });

  it('in rosso vende prima gli edifici, poi le proprietà; senza niente fa bancarotta', () => {
    const s = assegna(partitaDiProva(2), 'a', 1, 3, 5);
    s.proprieta[1]!.livello = 1;
    s.turno.fase = 'dopo_lancio';
    g(s, 'a').saldo = -30;
    expect(mossaBot(s, 'a')).toEqual({ tipo: 'demolisci', giocatore: 'a', casella: 1 });
    s.proprieta[1]!.livello = 0;
    expect(mossaBot(s, 'a')).toMatchObject({ tipo: 'vendi', giocatore: 'a' });
    const povero = partitaDiProva(2);
    povero.turno.fase = 'dopo_lancio';
    g(povero, 'a').saldo = -30;
    expect(mossaBot(povero, 'a')).toEqual({ tipo: 'bancarotta', giocatore: 'a' });
  });

  it('all’asta rilancia fino al valore della proprietà, mai su sé stesso', () => {
    let s = partitaDiProva(2, { aste: true });
    s.turno.fase = 'dopo_lancio';
    s.turno.acquisto = 39;
    s = esegui(s, { tipo: 'asta', giocatore: 'a' }).stato;
    expect(mossaBot(s, 'b')).toEqual({ tipo: 'offri', giocatore: 'b', importo: 100 });
    s = esegui(s, { tipo: 'offri', giocatore: 'b', importo: 100 }).stato;
    expect(mossaBot(s, 'b')).toBeNull();
    s = esegui(s, { tipo: 'offri', giocatore: 'a', importo: 395 }).stato;
    expect(mossaBot(s, 'b')).toEqual({ tipo: 'offri', giocatore: 'b', importo: 397 });
    s = esegui(s, { tipo: 'offri', giocatore: 'b', importo: 397 }).stato;
    s = esegui(s, { tipo: 'offri', giocatore: 'a', importo: 400 }).stato;
    expect(mossaBot(s, 'b')).toBeNull();
  });

  it('accetta gli scambi che gli convengono e rifiuta gli altri', () => {
    const vuoto = { soldi: 0, caselle: [], grazie: [] };
    let s = assegna(partitaDiProva(2), 'b', 11);
    s = esegui(s, { tipo: 'proponi', giocatore: 'a', a: 'b', dare: { ...vuoto, soldi: 300 }, avere: { ...vuoto, caselle: [11] }, nota: '' })
      .stato;
    expect(guadagnoScambio(s, 'b', s.scambi[0]!).guadagno).toBe(160);
    expect(mossaBot(s, 'b')).toEqual({ tipo: 'accetta', giocatore: 'b', scambio: 1 });
    s = esegui(s, { tipo: 'proponi', giocatore: 'a', a: 'b', dare: { ...vuoto, soldi: 100 }, avere: { ...vuoto, caselle: [11] }, nota: '', sostituisce: 1 })
      .stato;
    expect(mossaBot(s, 'b')).toEqual({ tipo: 'rifiuta', giocatore: 'b', scambio: 2 });
  });

  it('propone di comprare l’ultima città della regione, pagandola bene, solo se la stanza lo permette', () => {
    const s = assegna(assegna(partitaDiProva(2), 'a', 37), 'b', 39);
    expect(mossaBot(s, 'a')).toEqual({ tipo: 'lancia', giocatore: 'a' });
    expect(mossaBot(s, 'a', { proporre: true })).toEqual({
      tipo: 'proponi',
      giocatore: 'a',
      a: 'b',
      dare: { soldi: 1200, caselle: [], grazie: [] },
      avere: { soldi: 0, caselle: [39], grazie: [] },
      nota: '',
    });
    g(s, 'a').saldo = 700;
    expect(mossaBot(s, 'a', { proporre: true })).toEqual({ tipo: 'lancia', giocatore: 'a' });
  });

  it('ritira la sua proposta quando non si può più fare', () => {
    const vuoto = { soldi: 0, caselle: [], grazie: [] };
    let s = assegna(assegna(partitaDiProva(2), 'a', 37), 'b', 39);
    s = esegui(s, { tipo: 'proponi', giocatore: 'a', a: 'b', dare: { ...vuoto, soldi: 600 }, avere: { ...vuoto, caselle: [39] }, nota: '' })
      .stato;
    expect(mossaBot(s, 'a')).toEqual({ tipo: 'lancia', giocatore: 'a' });
    g(s, 'a').saldo = 100;
    expect(mossaBot(s, 'a')).toEqual({ tipo: 'annulla', giocatore: 'a', scambio: 1 });
  });

  it('non cede per poco la città che completa la regione dell’avversario', () => {
    const vuoto = { soldi: 0, caselle: [], grazie: [] };
    let s = assegna(assegna(partitaDiProva(2), 'a', 37), 'b', 39);
    s = esegui(s, { tipo: 'proponi', giocatore: 'a', a: 'b', dare: { ...vuoto, soldi: 600 }, avere: { ...vuoto, caselle: [39] }, nota: '' })
      .stato;
    expect(mossaBot(s, 'b')).toEqual({ tipo: 'rifiuta', giocatore: 'b', scambio: 1 });
  });

  it('segue il voto di un altro e dà tempo a chi lo chiede', () => {
    let s: Stato = partitaDiProva(3, { timerTurno: false });
    s = esegui(s, { tipo: 'vota', giocatore: 'b', favorevole: true }).stato;
    expect(mossaBot(s, 'c')).toEqual({ tipo: 'vota', giocatore: 'c', favorevole: true });
    s = partitaDiProva(3);
    s = esegui(s, { tipo: 'chiedi_tempo', giocatore: 'a' }).stato;
    expect(mossaBot(s, 'b')).toEqual({ tipo: 'regala_tempo', giocatore: 'b' });
  });

  it('la scorta cresce con gli affitti degli avversari', () => {
    const s = partitaDiProva(2);
    expect(riserva(s, 'a')).toBe(100);
    assegna(s, 'b', 37, 39);
    s.proprieta[37]!.livello = 5;
    s.proprieta[39]!.livello = 5;
    expect(riserva(s, 'a')).toBe(600);
  });

  it('la durata della scena segue le animazioni dei browser', () => {
    const s = partitaDiProva(2);
    expect(durataScena(s, [{ tipo: 'dadi', giocatore: 'a', dadi: [3, 4] }, { tipo: 'movimento', giocatore: 'a', da: 0, a: 7, dadi: [3, 4] }])).toBe(
      820 + 7 * 180 + 200,
    );
  });
});
