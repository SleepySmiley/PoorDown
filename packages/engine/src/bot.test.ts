import { describe, expect, it } from 'vitest';
import { DADI_MS, TEMPI } from './tempi';
import { durataScena, guadagnoScambio, mossaBot, mosseDeiBot, riserva, TURNI_TRA_PROPOSTE_BOT, valoreCasella } from './bot';
import { casoDaSeme } from './caso';
import { IMPOSTAZIONI_PREDEFINITE, SOLDI_INIZIALI_POSSIBILI } from './impostazioni';
import { creaPartita } from './partita';
import { assegna, esegui, g, ID, NOMI, partitaASquadre, partitaDiProva, problemi } from './prove';
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
    // Come la stanza: un'asta già scaduta si chiude prima della prossima mossa (dopo la scadenza non si offre).
    const mosse = s.asta && adesso >= s.asta.scadenza ? [] : mosseDeiBot(s, bot, proporre);
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
    // Finiscono tutte, anche sui tabelloni con regioni grandi: i bot si scambiano le città per completarle.
    expect(finite).toBe(PARTITE);
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

  it('a squadre, in rosso, vende le sue case anche se il compagno ne ha di più', () => {
    // a e b compagni: Courmayeur (1) di a con una casa, Aosta (3) di b con due.
    const s = assegna(assegna(partitaASquadre([0, 0, 1, 1]), 'a', 1), 'b', 3);
    s.proprieta[1]!.livello = 1;
    s.proprieta[3]!.livello = 2;
    s.turno.fase = 'dopo_lancio';
    g(s, 'a').saldo = -40;
    g(s, 'a').debiti = [{ creditore: 'c', importo: 40 }];
    expect(mossaBot(s, 'a')).toEqual({ tipo: 'demolisci', giocatore: 'a', casella: 1 });
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

  it('propone di comprare anche le due città che gli mancano, se sono dello stesso avversario', () => {
    // 'a' ha Siena; Pisa (150) e Firenze (160) sono di 'b'. Offre tre volte il prezzo, e a un bot conviene accettare.
    const s = assegna(assegna(partitaDiProva(3), 'a', 11), 'b', 13, 14);
    const proposta = mossaBot(s, 'a', { proporre: true });
    expect(proposta).toEqual({
      tipo: 'proponi',
      giocatore: 'a',
      a: 'b',
      dare: { soldi: 930, caselle: [], grazie: [] },
      avere: { soldi: 0, caselle: [13, 14], grazie: [] },
      nota: '',
    });
    expect(mossaBot(esegui(s, proposta!).stato, 'b')).toMatchObject({ tipo: 'accetta' });
    // Se le due città sono di avversari diversi, niente.
    assegna(s, 'c', 14);
    expect(mossaBot(s, 'a', { proporre: true })).toEqual({ tipo: 'lancia', giocatore: 'a' });
  });

  it('senza i soldi per comprarla, offre in cambio una sua città: tutte e due le parti completano una regione', () => {
    // 'a' ha Olbia e Sassari (Sardegna) e Siena; 'b' ha Cagliari, Pisa e Firenze. 'a' ha pochi soldi.
    const s = assegna(assegna(partitaDiProva(2), 'a', 6, 7, 11), 'b', 9, 13, 14);
    g(s, 'a').saldo = 150;
    const proposta = mossaBot(s, 'a', { proporre: true });
    expect(proposta).toEqual({
      tipo: 'proponi',
      giocatore: 'a',
      a: 'b',
      dare: { soldi: 0, caselle: [11], grazie: [] },
      avere: { soldi: 0, caselle: [9], grazie: [] },
      nota: '',
    });
    expect(mossaBot(esegui(s, proposta!).stato, 'b')).toMatchObject({ tipo: 'accetta' });
  });

  it('nelle regioni grandi e divise compra una città alla volta da chi ne ha di meno', () => {
    // Grandi aree, Nord: Udine 31, Trento 32, Genova 34, Bologna 37, Torino 39 (400 €).
    const nord = (c: number[], d: number[]) => assegna(assegna(assegna(assegna(partitaDiProva(4, { mappa: 'grandi_aree' }), 'a', 31, 32), 'b', 34), 'c', ...c), 'd', ...d);
    // 'a' ne ha due, gli altri una a testa: chiede la più cara, pagandola quanto basta perché un bot accetti.
    const s = nord([37], [39]);
    const proposta = mossaBot(s, 'a', { proporre: true });
    expect(proposta).toEqual({
      tipo: 'proponi',
      giocatore: 'a',
      a: 'd',
      dare: { soldi: 440, caselle: [], grazie: [] },
      avere: { soldi: 0, caselle: [39], grazie: [] },
      nota: '',
    });
    expect(mossaBot(esegui(s, proposta!).stato, 'd')).toMatchObject({ tipo: 'accetta' });
    // Prima a chi ne ha di meno.
    expect(mossaBot(nord([37, 39], []), 'a', { proporre: true })).toMatchObject({ a: 'b', avere: { caselle: [34] } });
    // Se un altro ne ha di più, o la regione non è ancora tutta comprata, niente.
    expect(mossaBot(nord([34, 37, 39], []), 'a', { proporre: true })).toEqual({ tipo: 'lancia', giocatore: 'a' });
    expect(mossaBot(nord([37], []), 'a', { proporre: true })).toEqual({ tipo: 'lancia', giocatore: 'a' });

    // Centro diviso a metà tra due: chi propone per primo compra, e dopo l'altro non può più chiedere indietro.
    let pari = assegna(assegna(partitaDiProva(2, { mappa: 'grandi_aree' }), 'a', 21, 23, 24), 'b', 26, 28, 29);
    const prima = mossaBot(pari, 'a', { proporre: true });
    expect(prima).toMatchObject({ a: 'b', dare: { soldi: 308 }, avere: { caselle: [29] } });
    pari = esegui(pari, prima!).stato;
    pari = esegui(pari, mossaBot(pari, 'b')!).stato;
    expect(pari.proprieta[29]!.proprietario).toBe('a');
    pari.turno.giocatore = 'b';
    expect(mossaBot(pari, 'b', { proporre: true })).toEqual({ tipo: 'lancia', giocatore: 'b' });
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

  it('valuta insieme le città dello scambio, sulla partita come sarà dopo', () => {
    const vuoto = { soldi: 0, caselle: [], grazie: [] };
    const risposta = (s: Stato, dare: number[], soldiDare: number, avere: number[], soldiAvere: number) => {
      const r = esegui(s, {
        tipo: 'proponi',
        giocatore: 'a',
        a: 'b',
        dare: { ...vuoto, soldi: soldiDare, caselle: dare },
        avere: { ...vuoto, soldi: soldiAvere, caselle: avere },
        nota: '',
      }).stato;
      return mossaBot(r, 'b')?.tipo;
    };
    // Toscana: Siena 11 (140), Pisa 13 (150), Firenze 14 (160). 'a' ha Siena e chiede Pisa e Firenze insieme:
    // nessuna delle due da sola gli completa la regione, ma insieme sì.
    expect(risposta(assegna(assegna(partitaDiProva(2), 'a', 11), 'b', 13, 14), [], 345, [13, 14], 0)).toBe('rifiuta');
    // Grandi aree, Nord: 'a' ha Udine e Trento e chiede le altre tre città per poco più del loro prezzo (1090).
    const nord = assegna(assegna(partitaDiProva(2, { mappa: 'grandi_aree' }), 'a', 31, 32), 'b', 34, 37, 39);
    expect(risposta(nord, [], 1200, [34, 37, 39], 0)).toBe('rifiuta');
    // Al contrario: il bot ha Siena, e Pisa con Firenze gli completano la Toscana. Le paga volentieri più del prezzo.
    expect(risposta(assegna(assegna(partitaDiProva(2), 'b', 11), 'a', 13, 14), [13, 14], 0, [], 560)).toBe('accetta');
  });

  it('non cede per poco la città che completa la regione dell’avversario', () => {
    const vuoto = { soldi: 0, caselle: [], grazie: [] };
    let s = assegna(assegna(partitaDiProva(2), 'a', 37), 'b', 39);
    s = esegui(s, { tipo: 'proponi', giocatore: 'a', a: 'b', dare: { ...vuoto, soldi: 600 }, avere: { ...vuoto, caselle: [39] }, nota: '' })
      .stato;
    expect(mossaBot(s, 'b')).toEqual({ tipo: 'rifiuta', giocatore: 'b', scambio: 1 });
  });

  it('segue il voto solo contro chi è assente, e dà tempo a chi lo chiede', () => {
    let s: Stato = partitaDiProva(3, { timerTurno: false });
    s = esegui(s, { tipo: 'vota', giocatore: 'b', favorevole: true }).stato;
    // Chi gioca è collegato e non ha mai finito il tempo: il bot non lo vota.
    expect(mossaBot(s, 'c')).toBeNull();
    // Scollegato: il bot si unisce al voto.
    s.giocatori[0]!.offlineDa = 0;
    expect(mossaBot(s, 'c')).toEqual({ tipo: 'vota', giocatore: 'c', favorevole: true });
    // Collegato ma con l'ultimo turno giocato in automatico perché ha finito il tempo: anche.
    s.giocatori[0]!.offlineDa = null;
    s.giocatori[0]!.automatici = 1;
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
      DADI_MS + TEMPI.margineDadi + 7 * TEMPI.passo + TEMPI.fineMovimento,
    );
  });
});
