import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  IMPOSTAZIONI_PREDEFINITE,
  type Aggiornamento,
  type Istantanea,
  type MessaggioChat,
  type VistaStanza,
  type VoceRegistro,
} from '@poordown/engine';
import { Collegamento, type PresaGioco } from './collegamento';

type Ascolta = (...args: unknown[]) => void;

/** Finta presa Socket.IO: i comandi vanno alle funzioni in `server`, gli eventi si fanno arrivare con `arriva`. */
class PresaFinta {
  connected = true;
  readonly inviati: { nome: string; dati: unknown }[] = [];
  readonly server: Record<string, (dati: unknown) => unknown> = {};
  private readonly ascoltatori = new Map<string, Ascolta[]>();

  on(evento: string, fn: Ascolta) {
    this.ascoltatori.set(evento, [...(this.ascoltatori.get(evento) ?? []), fn]);
    return this;
  }

  emit(nome: string, dati?: unknown) {
    this.inviati.push({ nome, dati });
  }

  timeout() {
    return {
      emitWithAck: async (nome: string, dati: unknown) => {
        this.inviati.push({ nome, dati });
        const risponde = this.server[nome];
        if (!risponde) throw new Error('operation has timed out');
        return risponde(dati);
      },
    };
  }

  disconnect() {
    this.connected = false;
  }

  arriva(evento: string, ...args: unknown[]) {
    for (const fn of this.ascoltatori.get(evento) ?? []) fn(...args);
  }

  comandi() {
    return this.inviati.map((i) => i.nome);
  }
}

function vista(versione: number, codice = 'abcde'): VistaStanza {
  return {
    codice,
    fase: 'lobby',
    versione,
    host: null,
    impostazioni: { ...IMPOSTAZIONI_PREDEFINITE },
    partecipanti: [],
    spettatori: 0,
    partita: null,
  };
}

function voce(n: number): VoceRegistro {
  return { n, quando: n, evento: { tipo: 'ingresso', giocatore: `g${n}`, nome: `G${n}`, colore: n } };
}

function istantanea(versione: number, extra: Partial<Istantanea> = {}): Istantanea {
  return { stanza: vista(versione), io: null, registro: [], chat: [], ...extra };
}

function aggiornamento(versione: number, ...voci: VoceRegistro[]): Aggiornamento {
  return { stanza: vista(versione), io: 'io', voci };
}

function prepara(versioneIniziale = 5) {
  const presa = new PresaFinta();
  presa.server.entra = () => ({ ok: true, dati: istantanea(versioneIniziale, { registro: [voce(1)] }) });
  const collegamento = new Collegamento(presa as unknown as PresaGioco);
  return { presa, collegamento };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('Collegamento', () => {
  it('entra, poi applica gli aggiornamenti in ordine e ignora quelli vecchi', async () => {
    const { presa, collegamento } = prepara();
    const voci: VoceRegistro[][] = [];
    collegamento.ascoltaVoci((v) => voci.push(v));
    await collegamento.entra('abcde');
    expect(collegamento.leggi().stanza!.versione).toBe(5);

    presa.arriva('aggiornamento', aggiornamento(6, voce(2)));
    presa.arriva('aggiornamento', aggiornamento(4));
    presa.arriva('aggiornamento', aggiornamento(6));
    presa.arriva('aggiornamento', { ...aggiornamento(7), stanza: vista(7, 'altra') });

    const stato = collegamento.leggi();
    expect(stato.stanza!.versione).toBe(6);
    expect(stato.io).toBe('io');
    expect(stato.registro.map((v) => v.n)).toEqual([1, 2]);
    expect(voci).toEqual([[voce(2)]]);
    expect(presa.comandi()).toEqual(['entra']);
  });

  it('se manca una versione chiede l’istantanea completa', async () => {
    const { presa, collegamento } = prepara();
    await collegamento.entra('abcde');
    presa.server.sincronizza = () => ({ ok: true, dati: istantanea(9, { registro: [voce(1), voce(2), voce(3)] }) });
    presa.arriva('aggiornamento', aggiornamento(8));
    await vi.waitFor(() => expect(collegamento.leggi().stanza!.versione).toBe(9));
    expect(collegamento.leggi().registro).toHaveLength(3);
    expect(presa.comandi()).toEqual(['entra', 'sincronizza']);
  });

  it('gli aggiornamenti arrivati mentre aspetta l’istantanea vengono ripresi dopo', async () => {
    const { presa, collegamento } = prepara();
    let rispondi: (r: unknown) => void = () => {};
    presa.server.entra = () => new Promise((r) => (rispondi = r));
    const ingresso = collegamento.entra('abcde');
    presa.arriva('aggiornamento', aggiornamento(5));
    presa.arriva('aggiornamento', aggiornamento(6, voce(6)));
    rispondi({ ok: true, dati: istantanea(5) });
    await ingresso;
    expect(collegamento.leggi().stanza!.versione).toBe(6);
    expect(collegamento.leggi().registro.map((v) => v.n)).toEqual([6]);
  });

  it('dopo una disconnessione rientra da solo nella stanza', async () => {
    const { presa, collegamento } = prepara();
    await collegamento.entra('abcde');
    presa.arriva('disconnect');
    expect(collegamento.leggi().rete).toBe('perso');
    presa.server.entra = () => ({ ok: true, dati: istantanea(12, { io: 'io' }) });
    presa.arriva('connect');
    await vi.waitFor(() => expect(collegamento.leggi().stanza!.versione).toBe(12));
    expect(collegamento.leggi()).toMatchObject({ rete: 'attivo', io: 'io' });
    expect(presa.inviati.at(-1)).toEqual({ nome: 'entra', dati: { codice: 'abcde' } });
  });

  it('se la stanza non esiste più smette di seguirla e lo dice', async () => {
    const { presa, collegamento } = prepara();
    presa.server.entra = () => ({ ok: false, codice: 'stanza_inesistente', messaggio: 'Non trovo la stanza ABCDE.' });
    const risposta = await collegamento.entra('abcde');
    expect(risposta.ok).toBe(false);
    expect(collegamento.leggi()).toMatchObject({ stanza: null, avviso: 'Non trovo la stanza ABCDE.' });
    presa.arriva('connect');
    expect(presa.comandi()).toEqual(['entra']);
  });

  it('senza rete o senza risposta il comando fallisce con "senza_risposta"', async () => {
    const { presa, collegamento } = prepara();
    expect(await collegamento.comando('avvia', {})).toMatchObject({ ok: false, codice: 'senza_risposta' });
    presa.connected = false;
    expect(await collegamento.comando('elenco_stanze', {})).toMatchObject({ ok: false, codice: 'senza_risposta' });
    expect(presa.comandi()).toEqual(['avvia']);
  });

  it('chat e "sta scrivendo"', async () => {
    vi.useFakeTimers();
    const { presa, collegamento } = prepara();
    await collegamento.entra('abcde');
    presa.arriva('scrive', 'bruno');
    expect(collegamento.leggi().scrivono).toEqual(['bruno']);
    vi.advanceTimersByTime(3_000);
    expect(collegamento.leggi().scrivono).toEqual([]);

    presa.arriva('scrive', 'bruno');
    const messaggio: MessaggioChat = { n: 1, quando: 0, da: 'bruno', nome: 'Bruno', colore: 2, testo: 'ciao' };
    presa.arriva('messaggio', messaggio);
    expect(collegamento.leggi()).toMatchObject({ chat: [messaggio], scrivono: [] });
  });

  it('esci dimentica la stanza e lo dice al server', async () => {
    const { presa, collegamento } = prepara();
    presa.server.esci = () => ({ ok: true, dati: null });
    await collegamento.entra('abcde');
    await collegamento.esci();
    expect(collegamento.leggi()).toMatchObject({ stanza: null, io: null, registro: [] });
    presa.arriva('aggiornamento', aggiornamento(6));
    expect(collegamento.leggi().stanza).toBeNull();
    expect(presa.comandi()).toEqual(['entra', 'esci']);
  });
});
