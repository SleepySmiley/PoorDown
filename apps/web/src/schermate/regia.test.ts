import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applica,
  casoDaSeme,
  creaPartita,
  IMPOSTAZIONI_PREDEFINITE,
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
  private readonly ascoltatori = new Set<() => void>();

  constructor(stanza: VistaStanza, registro: VoceRegistro[]) {
    this.stato = { rete: 'attivo', stanza, io: 'a', registro, chat: [], scrivono: [], attivita: {}, avviso: null };
  }

  leggi = () => this.stato;

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
    partecipanti: partita.giocatori.map((g) => ({ id: g.id, nome: g.nome, colore: g.colore, connesso: true })),
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
});
