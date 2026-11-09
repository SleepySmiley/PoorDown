import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applica,
  casoDaSeme,
  creaPartita,
  DADI_MS,
  durataCarta,
  durataScena,
  IMPOSTAZIONI_PREDEFINITE,
  mosseDeiBot,
  TEMPI,
  vistaPartita,
  type Evento,
  type Stato,
  type VistaStanza,
  type VoceRegistro,
} from '@poordown/engine';
import type { Collegamento, StatoCollegamento } from '../rete/collegamento';
import { arrivoDelTurno, movimentiSoldi, Regia, VOLO_GETTONE_MS } from './regia';

/** Finto collegamento: basta leggere lo stato e avvisare chi ascolta. */
class CollegamentoFinto {
  stato: StatoCollegamento;
  /** L'ora del server: le voci di prova nascono a 0, quindi arrivano senza ritardo. */
  adesso = 0;
  private readonly ascoltatori = new Set<() => void>();

  constructor(stanza: VistaStanza, registro: VoceRegistro[]) {
    this.stato = { rete: 'attivo', stanza, io: 'a', registro, chat: [], scrivono: [], attivita: {}, avviso: null };
  }

  leggi = () => this.stato;

  orologio = () => this.adesso;

  ascolta(fn: () => void) {
    this.ascoltatori.add(fn);
    return () => this.ascoltatori.delete(fn);
  }

  cambia(parziale: Partial<StatoCollegamento>) {
    this.stato = { ...this.stato, ...parziale };
    for (const fn of this.ascoltatori) fn();
  }
}

function stanzaCon(partita: Stato, versione: number): VistaStanza {
  return {
    codice: 'abcde',
    fase: 'partita',
    versione,
    host: 'a',
    impostazioni: partita.impostazioni,
    partecipanti: partita.giocatori.map((g) => ({ id: g.id, nome: g.nome, colore: g.colore, connesso: true, bot: false, squadra: null })),
    squadre: [],
    spettatori: 0,
    partita: vistaPartita(partita),
  };
}

function voci(eventi: Evento[], da: number): VoceRegistro[] {
  return eventi.map((evento, i) => ({ n: da + i, quando: 0, evento }));
}

function partitaIniziale(): Stato {
  const esito = creaPartita(
    [
      { id: 'a', nome: 'Anna', colore: 1 },
      { id: 'b', nome: 'Bruno', colore: 2 },
    ],
    { ...IMPOSTAZIONI_PREDEFINITE, ordineCasuale: false },
    casoDaSeme(1),
  );
  if (!esito.ok) throw new Error(esito.messaggio);
  return esito.stato;
}

describe('Regia della partita', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('anima dadi e pedina, poi mostra la partita nuova', async () => {
    const prima = partitaIniziale();
    const lancio = applica(prima, { tipo: 'lancia', giocatore: 'a' }, casoDaSeme(7));
    if (!lancio.ok) throw new Error(lancio.messaggio);
    const movimento = lancio.eventi.find((e) => e.tipo === 'movimento');
    if (movimento?.tipo !== 'movimento') throw new Error('manca il movimento');

    const coll = new CollegamentoFinto(stanzaCon(prima, 1), voci([{ tipo: 'inizio', ordineCasuale: false }], 1));
    const regia = new Regia(coll as unknown as Collegamento);
    regia.avvia();
    expect(regia.leggi()).toMatchObject({ occupata: false, registroFino: 1 });

    const nuove = voci(lancio.eventi, 2);
    coll.cambia({ stanza: stanzaCon(lancio.stato, 2), registro: [...coll.stato.registro, ...nuove] });

    // Subito: la scena parte, ma saldi, posizioni e registro restano quelli di prima.
    expect(regia.leggi().occupata).toBe(true);
    expect(regia.leggi().rotola).toBe(true);
    expect(regia.leggi().registroFino).toBe(1);
    expect(regia.leggi().partita?.giocatori[0]?.posizione).toBe(0);

    // I dadi si fermano: la casella d'arrivo si accende prima che la pedina parta.
    await vi.advanceTimersByTimeAsync(DADI_MS - TEMPI.dadiFermi + 1);
    expect(regia.leggi()).toMatchObject({ rotola: false, meta: { giocatore: 'a', casella: movimento.a } });
    expect(regia.leggi().dadi).toEqual(lancio.stato.turno.dadi);
    // Poi la pedina comincia a camminare una casella alla volta.
    await vi.advanceTimersByTimeAsync(TEMPI.dadiFermi);
    expect(regia.leggi().posizioni.a).toEqual({ casella: 1, prigione: false });
    expect(regia.leggi().passoMs.a).toBe(TEMPI.passoLento);
    await vi.advanceTimersByTimeAsync(TEMPI.passoLento);
    expect(regia.leggi().posizioni.a).toEqual({ casella: 2, prigione: false });

    // A fine scena si vede la partita nuova e il registro completo.
    await vi.advanceTimersByTimeAsync(10_000);
    expect(regia.leggi()).toMatchObject({ occupata: false, posizioni: {}, registroFino: nuove.at(-1)!.n });
    expect(regia.leggi().partita?.giocatori[0]?.posizione).toBe(lancio.stato.giocatori[0]?.posizione);
    expect(movimento.a).toBeGreaterThanOrEqual(2);
    expect(regia.leggi().passi.a).toBeGreaterThanOrEqual(2);
    regia.ferma();
  });

  it('con molti eventi insieme salta le animazioni', () => {
    const prima = partitaIniziale();
    const coll = new CollegamentoFinto(stanzaCon(prima, 1), []);
    const regia = new Regia(coll as unknown as Collegamento);
    regia.avvia();
    const tanti = voci(
      Array.from({ length: 30 }, () => ({ tipo: 'dadi', giocatore: 'a', dadi: [1, 2] }) as Evento),
      1,
    );
    coll.cambia({ registro: tanti });
    expect(regia.leggi()).toMatchObject({ occupata: false, registroFino: 30 });
    regia.ferma();
  });

  it('gli eventi arrivati in ritardo (dopo una disconnessione) non si rimettono in scena', () => {
    const prima = partitaIniziale();
    const lancio = applica(prima, { tipo: 'lancia', giocatore: 'a' }, casoDaSeme(7));
    if (!lancio.ok) throw new Error(lancio.messaggio);
    const coll = new CollegamentoFinto(stanzaCon(prima, 1), []);
    const regia = new Regia(coll as unknown as Collegamento);
    regia.avvia();
    coll.adesso = 25_000;
    const nuove = voci(lancio.eventi, 1);
    coll.cambia({ stanza: stanzaCon(lancio.stato, 2), registro: nuove });
    expect(regia.leggi()).toMatchObject({ occupata: false, rotola: false, registroFino: nuove.at(-1)!.n });
    expect(regia.leggi().partita?.giocatori[0]?.posizione).toBe(lancio.stato.giocatori[0]?.posizione);
    expect(regia.leggi().dadi).toEqual(lancio.stato.turno.dadi);
    regia.ferma();
  });

  it('gli eventi senza animazione non fermano i pulsanti del turno', () => {
    const prima = partitaIniziale();
    const coll = new CollegamentoFinto(stanzaCon(prima, 1), []);
    const regia = new Regia(coll as unknown as Collegamento);
    regia.avvia();
    const occupata: boolean[] = [];
    regia.iscrivi(() => occupata.push(regia.leggi().occupata));
    coll.cambia({ stanza: stanzaCon(prima, 2), registro: voci([{ tipo: 'tempo_chiesto', giocatore: 'a' }], 1) });
    expect(occupata).not.toContain(true);
    expect(regia.leggi()).toMatchObject({ occupata: false, registroFino: 1 });
    regia.ferma();
  });

  it('una scena interrotta non rimette i dadi del lancio vecchio', async () => {
    const prima = partitaIniziale();
    const lancio = applica(prima, { tipo: 'lancia', giocatore: 'a' }, casoDaSeme(7));
    if (!lancio.ok) throw new Error(lancio.messaggio);
    const coll = new CollegamentoFinto(stanzaCon(prima, 1), []);
    const regia = new Regia(coll as unknown as Collegamento);
    regia.avvia();
    const nuove = voci(lancio.eventi, 1);
    coll.cambia({ stanza: stanzaCon(lancio.stato, 2), registro: nuove });
    await vi.advanceTimersByTimeAsync(200);
    expect(regia.leggi().rotola).toBe(true);

    // A metà del rotolamento arriva un'altra partita, con tanti eventi insieme: si salta allo stato nuovo.
    const dopo = structuredClone(lancio.stato);
    dopo.turno.dadi = lancio.stato.turno.dadi?.[0] === 6 ? [1, 2] : [6, 5];
    const tanti = voci(
      Array.from({ length: 30 }, () => ({ tipo: 'tempo_chiesto', giocatore: 'b' }) as Evento),
      nuove.length + 1,
    );
    coll.cambia({ stanza: stanzaCon(dopo, 3), registro: [...nuove, ...tanti] });
    expect(regia.leggi()).toMatchObject({ occupata: false, rotola: false, dadi: dopo.turno.dadi });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(regia.leggi()).toMatchObject({ occupata: false, rotola: false, dadi: dopo.turno.dadi });
    regia.ferma();
  });

  it('quando la scheda si nasconde la scena si chiude subito', async () => {
    let fn: (() => void) | null = null;
    const documento = {
      hidden: false,
      addEventListener: (_: string, f: () => void) => (fn = f),
      removeEventListener: () => (fn = null),
    };
    vi.stubGlobal('document', documento);
    try {
      const prima = partitaIniziale();
      const lancio = applica(prima, { tipo: 'lancia', giocatore: 'a' }, casoDaSeme(7));
      if (!lancio.ok) throw new Error(lancio.messaggio);
      const coll = new CollegamentoFinto(stanzaCon(prima, 1), []);
      const regia = new Regia(coll as unknown as Collegamento);
      regia.avvia();
      expect(fn).not.toBeNull();
      const nuove = voci(lancio.eventi, 1);
      coll.cambia({ stanza: stanzaCon(lancio.stato, 2), registro: nuove });
      await vi.advanceTimersByTimeAsync(200);
      expect(regia.leggi().occupata).toBe(true);

      documento.hidden = true;
      fn!();
      expect(regia.leggi()).toMatchObject({ occupata: false, rotola: false, registroFino: nuove.at(-1)!.n });
      expect(regia.leggi().dadi).toEqual(lancio.stato.turno.dadi);
      await vi.advanceTimersByTimeAsync(10_000);
      expect(regia.leggi()).toMatchObject({ occupata: false, rotola: false, dadi: lancio.stato.turno.dadi });
      regia.ferma();
      expect(fn).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('i messaggi di chat durante una scena non la interrompono', async () => {
    const prima = partitaIniziale();
    const lancio = applica(prima, { tipo: 'lancia', giocatore: 'a' }, casoDaSeme(7));
    if (!lancio.ok) throw new Error(lancio.messaggio);
    const coll = new CollegamentoFinto(stanzaCon(prima, 1), []);
    const regia = new Regia(coll as unknown as Collegamento);
    regia.avvia();
    coll.cambia({ stanza: stanzaCon(lancio.stato, 2), registro: voci(lancio.eventi, 1) });
    coll.cambia({ scrivono: ['b'] });
    expect(regia.leggi().occupata).toBe(true);
    expect(regia.leggi().partita?.giocatori[0]?.posizione).toBe(0);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(regia.leggi().occupata).toBe(false);
    regia.ferma();
  });

  it('la scena dura quanto dice durataScena: browser e bot leggono gli stessi tempi', async () => {
    const prima = partitaIniziale();
    // Una scena con tutti i tipi di attesa: dadi, passi (anche oltre la Partenza, con il gettone che parte
    // durante i passi), una pausa con soldi, una carta con il suo trasferimento, la prigione, la bancarotta e la fine.
    const eventi: Evento[] = [
      { tipo: 'dadi', giocatore: 'a', dadi: [5, 6] },
      { tipo: 'movimento', giocatore: 'a', da: 35, a: 6, dadi: [5, 6] },
      { tipo: 'partenza', giocatore: 'a', importo: 200, arrivo: false },
      { tipo: 'acquisto', giocatore: 'a', casella: 6, prezzo: 100 },
      { tipo: 'carta', giocatore: 'a', mazzo: 'busta', carta: 0, testo: 'Prova' },
      { tipo: 'trasferimento', da: 'a', a: null, importo: 50 },
      { tipo: 'prigione', giocatore: 'a', motivo: 'carta' },
      { tipo: 'vacanza', giocatore: 'b', incasso: 0 },
      { tipo: 'bancarotta', giocatore: 'b', recuperi: [] },
      { tipo: 'fine', vincitore: 'a' },
    ];
    const coll = new CollegamentoFinto(stanzaCon(prima, 1), []);
    const regia = new Regia(coll as unknown as Collegamento);
    regia.avvia();
    coll.cambia({ stanza: stanzaCon(prima, 2), registro: voci(eventi, 1) });
    expect(regia.leggi().occupata).toBe(true);

    // Il server conta un piccolo margine in più per ogni lancio: il bot non anticipa mai l'animazione.
    const durata = durataScena(prima, eventi) - TEMPI.margineDadi;
    await vi.advanceTimersByTimeAsync(durata - 1);
    expect(regia.leggi().occupata).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    expect(regia.leggi().occupata).toBe(false);
    regia.ferma();
  });
});

/** Partite intere tra bot, una mossa alla volta, con lo stato prima e dopo e gli eventi di ogni mossa. */
function* partiteTraBot(): Generator<{ prima: Stato; dopo: Stato; eventi: Evento[] }> {
  const prove: { squadre: boolean; seme: number }[] = [
    { squadre: false, seme: 1 },
    { squadre: false, seme: 2 },
    { squadre: false, seme: 3 },
    { squadre: true, seme: 4 },
    { squadre: true, seme: 5 },
  ];
  for (const { squadre, seme } of prove) {
    const caso = casoDaSeme(seme);
    const giocatori = ['a', 'b', 'c', 'd'].map((id, i) => ({ id, nome: `Bot ${id}`, colore: i + 1, ...(squadre ? { squadra: i % 2 } : {}) }));
    const creata = creaPartita(
      giocatori,
      {
        ...IMPOSTAZIONI_PREDEFINITE,
        soldiIniziali: 500,
        cassaVacanza: true,
        ipoteche: true,
        affittoDoppioSetCompleto: true,
        squadre,
        timerTurno: false,
      },
      caso,
    );
    if (!creata.ok) throw new Error(creata.messaggio);
    let s = creata.stato;
    for (let passo = 0; passo < 3000 && s.fase === 'in_corso'; passo++) {
      const mosse = mosseDeiBot(
        s,
        giocatori.map((g) => g.id),
        () => passo % 7 === 0,
      );
      const m = mosse[passo % Math.max(1, mosse.length)];
      if (!m) break;
      const r = applica(s, m.azione, caso, 0);
      if (!r.ok) break;
      yield { prima: s, dopo: r.stato, eventi: r.eventi };
      s = r.stato;
    }
  }
}

describe('soldi che passano di mano', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('i movimenti degli eventi spiegano ogni cambio dei saldi (tranne quello di chi esce)', () => {
    const visti = new Set<string>();
    let mosse = 0;
    for (const { prima, dopo, eventi } of partiteTraBot()) {
      mosse++;
      const atteso = new Map(prima.giocatori.map((g) => [g.id, g.saldo]));
      for (const e of eventi) {
        for (const m of movimentiSoldi(e, prima)) {
          visti.add(e.tipo);
          if (m.da !== null && m.addebita) atteso.set(m.da, atteso.get(m.da)! - m.importo);
          if (m.a !== null && m.gettone) atteso.set(m.a, atteso.get(m.a)! + m.importo);
        }
      }
      for (const g of dopo.giocatori) {
        if (g.eliminato) continue;
        expect({ giocatore: g.id, saldo: atteso.get(g.id), eventi: eventi.map((e) => e.tipo) }).toEqual({
          giocatore: g.id,
          saldo: g.saldo,
          eventi: eventi.map((e) => e.tipo),
        });
      }
    }
    expect(mosse).toBeGreaterThan(500);
    // Le partite di prova passano davvero dai casi interessanti.
    for (const tipo of ['affitto', 'acquisto', 'partenza', 'trasferimento', 'debito', 'rimborso', 'scambio_accettato', 'ipoteca']) {
      expect(visti).toContain(tipo);
    }
  });

  it('nella scena chi paga scende subito, chi incassa sale quando arriva il gettone', async () => {
    const prima = partitaIniziale();
    const dopo = structuredClone(prima);
    dopo.giocatori[0]!.saldo -= 28;
    dopo.giocatori[1]!.saldo += 28;
    const coll = new CollegamentoFinto(stanzaCon(prima, 1), []);
    const regia = new Regia(coll as unknown as Collegamento);
    regia.avvia();
    const saldo = (id: string) => regia.leggi().partita!.giocatori.find((g) => g.id === id)!.saldo;
    coll.cambia({
      stanza: stanzaCon(dopo, 2),
      registro: voci([{ tipo: 'affitto', da: 'a', a: 'b', casella: 1, importo: 28 }], 1),
    });
    expect(regia.leggi().occupata).toBe(true);
    expect(saldo('a')).toBe(prima.giocatori[0]!.saldo - 28);
    expect(saldo('b')).toBe(prima.giocatori[1]!.saldo);
    expect(regia.leggi().gettoni).toMatchObject([{ da: 'a', a: 'b', importo: 28 }]);
    // La pausa dell'affitto finisce prima che il gettone arrivi: la partita si allinea, ma Bruno aspetta il gettone.
    await vi.advanceTimersByTimeAsync(TEMPI.pausaSoldi);
    expect(regia.leggi().occupata).toBe(false);
    expect(saldo('b')).toBe(prima.giocatori[1]!.saldo);
    await vi.advanceTimersByTimeAsync(VOLO_GETTONE_MS - TEMPI.pausaSoldi);
    expect(saldo('b')).toBe(dopo.giocatori[1]!.saldo);
    expect(saldo('a')).toBe(dopo.giocatori[0]!.saldo);
    expect(regia.leggi().gettoni).toEqual([]);
    regia.ferma();
  });

  it('fuori scena (uno scambio) il saldo di chi incassa resta indietro finché il gettone non arriva', async () => {
    const prima = partitaIniziale();
    const dopo = structuredClone(prima);
    dopo.giocatori[0]!.saldo -= 100;
    dopo.giocatori[1]!.saldo += 100;
    const coll = new CollegamentoFinto(stanzaCon(prima, 1), []);
    const regia = new Regia(coll as unknown as Collegamento);
    regia.avvia();
    const saldo = (id: string) => regia.leggi().partita!.giocatori.find((g) => g.id === id)!.saldo;
    const vuoto = { soldi: 0, caselle: [], grazie: [] };
    coll.cambia({
      stanza: stanzaCon(dopo, 2),
      registro: voci([{ tipo: 'scambio_accettato', scambio: 1, da: 'a', a: 'b', dare: { ...vuoto, soldi: 100 }, avere: vuoto }], 1),
    });
    expect(regia.leggi()).toMatchObject({ occupata: false, timbro: { tipo: 'accettato', da: 'a', a: 'b' } });
    expect(saldo('a')).toBe(dopo.giocatori[0]!.saldo);
    expect(saldo('b')).toBe(prima.giocatori[1]!.saldo);
    await vi.advanceTimersByTimeAsync(VOLO_GETTONE_MS);
    expect(saldo('b')).toBe(dopo.giocatori[1]!.saldo);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(regia.leggi()).toMatchObject({ gettoni: [], timbro: null, lampeggia: [] });
    regia.ferma();
  });

  it('il debito: chi aspettava i soldi non vede mai il saldo scendere', async () => {
    const prima = partitaIniziale();
    const dopo = structuredClone(prima);
    dopo.giocatori[0]!.saldo -= 50;
    dopo.giocatori[1]!.saldo += 20;
    const coll = new CollegamentoFinto(stanzaCon(prima, 1), []);
    const regia = new Regia(coll as unknown as Collegamento);
    regia.avvia();
    const visti: number[] = [];
    regia.iscrivi(() => visti.push(regia.leggi().partita!.giocatori[1]!.saldo));
    coll.cambia({
      stanza: stanzaCon(dopo, 2),
      registro: voci(
        [
          { tipo: 'affitto', da: 'a', a: 'b', casella: 1, importo: 50 },
          { tipo: 'debito', da: 'a', a: 'b', importo: 30 },
        ],
        1,
      ),
    });
    await vi.advanceTimersByTimeAsync(5_000);
    expect(Math.min(...visti)).toBe(prima.giocatori[1]!.saldo);
    expect(visti.at(-1)).toBe(dopo.giocatori[1]!.saldo);
    regia.ferma();
  });

  it('passando dalla Partenza il gettone parte durante i passi, senza pause in più', async () => {
    const prima = partitaIniziale();
    const coll = new CollegamentoFinto(stanzaCon(prima, 1), []);
    const regia = new Regia(coll as unknown as Collegamento);
    regia.avvia();
    coll.cambia({
      stanza: stanzaCon(prima, 2),
      registro: voci(
        [
          { tipo: 'movimento', giocatore: 'a', da: 38, a: 3 },
          { tipo: 'partenza', giocatore: 'a', importo: 200, arrivo: false },
        ],
        1,
      ),
    });
    // Due passi (38 → 39 → 0): il gettone della Partenza è già in volo.
    await vi.advanceTimersByTimeAsync(2 * TEMPI.passoLento - 1);
    expect(regia.leggi().posizioni.a?.casella).toBe(0);
    expect(regia.leggi().gettoni).toMatchObject([{ da: null, a: 'a', importo: 200, casella: 0 }]);
    regia.ferma();
  });

  it('la carta resta al centro il tempo di leggerla, poi lascia il posto al suo effetto', async () => {
    const prima = partitaIniziale();
    const coll = new CollegamentoFinto(stanzaCon(prima, 1), []);
    const regia = new Regia(coll as unknown as Collegamento);
    regia.avvia();
    const testo = 'Aiuti un parente. Paga 50 €.';
    coll.cambia({
      stanza: stanzaCon(prima, 2),
      registro: voci(
        [
          { tipo: 'carta', giocatore: 'a', mazzo: 'cartolina', carta: 13, testo },
          { tipo: 'trasferimento', da: 'a', a: null, importo: 50 },
        ],
        1,
      ),
    });
    expect(regia.leggi().carta).toMatchObject({ giocatore: 'a', mazzo: 'cartolina', testo });
    await vi.advanceTimersByTimeAsync(durataCarta(testo) - TEMPI.cartaEsce);
    expect(regia.leggi().carta).toBeNull();
    expect(regia.leggi().gettoni).toEqual([]);
    await vi.advanceTimersByTimeAsync(TEMPI.cartaEsce);
    expect(regia.leggi().gettoni).toMatchObject([{ da: 'a', a: null, importo: 50 }]);
    regia.ferma();
  });
});

describe('casella d’arrivo', () => {
  const voce = (n: number, evento: Evento): VoceRegistro => ({ n, quando: 0, evento });
  const registro = [
    voce(1, { tipo: 'turno', giocatore: 'a', numero: 1 }),
    voce(2, { tipo: 'dadi', giocatore: 'a', dadi: [3, 4] }),
    voce(3, { tipo: 'movimento', giocatore: 'a', da: 0, a: 7, dadi: [3, 4] }),
    voce(4, { tipo: 'affitto', da: 'a', a: 'b', casella: 7, importo: 6 }),
  ];

  it('è dove si è fermato chi gioca, rossa se lì ha pagato l’affitto', () => {
    expect(arrivoDelTurno(registro)).toEqual({ casella: 7, tono: 'affitto' });
    expect(arrivoDelTurno(registro, 3)).toEqual({ casella: 7, tono: 'normale' });
    expect(arrivoDelTurno(registro, 2)).toBeNull();
  });

  it('sparisce al turno dopo e quando si finisce in prigione', () => {
    expect(arrivoDelTurno([...registro, voce(5, { tipo: 'turno', giocatore: 'b', numero: 2 })])).toBeNull();
    expect(arrivoDelTurno([...registro, voce(5, { tipo: 'prigione', giocatore: 'a', motivo: 'casella' })])).toBeNull();
  });
});
