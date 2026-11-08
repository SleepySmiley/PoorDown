import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applica,
  casoDaSeme,
  creaPartita,
  durataScena,
  IMPOSTAZIONI_PREDEFINITE,
  TEMPI,
  vistaPartita,
  type Evento,
  type Stato,
  type VistaStanza,
  type VoceRegistro,
} from '@poordown/engine';
import type { Collegamento, StatoCollegamento } from '../rete/collegamento';
import { Regia } from './regia';

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

    // Finito il rotolamento, la pedina comincia a camminare una casella alla volta.
    await vi.advanceTimersByTimeAsync(7 * 95 + 150 + 1);
    expect(regia.leggi().dadi).toEqual(lancio.stato.turno.dadi);
    expect(regia.leggi().posizioni.a).toEqual({ casella: 1, prigione: false });
    await vi.advanceTimersByTimeAsync(180);
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
    // Una scena con tutti i tipi di attesa: dadi, passi, una pausa, una carta, la prigione.
    const eventi: Evento[] = [
      { tipo: 'dadi', giocatore: 'a', dadi: [2, 3] },
      { tipo: 'movimento', giocatore: 'a', da: 0, a: 5, dadi: [2, 3] },
      { tipo: 'acquisto', giocatore: 'a', casella: 5, prezzo: 200 },
      { tipo: 'carta', giocatore: 'a', mazzo: 'busta', carta: 0, testo: 'Prova' },
      { tipo: 'prigione', giocatore: 'a', motivo: 'carta' },
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
