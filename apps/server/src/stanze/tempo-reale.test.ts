/*
 * Prove di rete: un server Socket.IO vero su una porta locale e più client, come tanti browser.
 * Il caso è ripetibile (seme fisso) e l'orologio si sposta a mano.
 */

import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Server } from 'socket.io';
import { io as apriPresa, type Socket } from 'socket.io-client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  mossePossibili,
  type Aggiornamento,
  type Attivita,
  type Comandi,
  type EventiClient,
  type EventiServer,
  type IdGiocatore,
  type Istantanea,
  type MessaggioChat,
  type Mossa,
  type NomeComando,
  type Risposta,
  type Stato,
  type VistaStanza,
} from '@poordown/engine';
import { GestoreStanze } from './gestore';
import { ambienteDiProva, TOKEN } from './prove';
import { ATTESA_LOBBY_MS } from './stanza';
import { collegaTempoReale, type DatiSocket } from './tempo-reale';

type Presa = Socket<EventiServer, EventiClient>;

/** Un browser finto: registra tutto quello che riceve. */
class Browser {
  readonly aggiornamenti: Aggiornamento[] = [];
  readonly messaggi: MessaggioChat[] = [];
  readonly scrive: IdGiocatore[] = [];
  readonly attivita: Record<IdGiocatore, Attivita>[] = [];
  /** Tutto il testo ricevuto dal server, per controllare che non contenga segreti. */
  ricevuto = '';
  stanza: VistaStanza | null = null;
  io: IdGiocatore | null = null;

  constructor(readonly presa: Presa) {
    presa.onAny((_evento, ...args: unknown[]) => {
      this.ricevuto += JSON.stringify(args);
    });
    presa.on('aggiornamento', (a) => {
      this.aggiornamenti.push(a);
      this.stanza = a.stanza;
      this.io = a.io;
    });
    presa.on('messaggio', (m) => this.messaggi.push(m));
    presa.on('scrive', (id) => this.scrive.push(id));
    presa.on('attivita', (m) => this.attivita.push(m));
  }

  async comando<K extends NomeComando>(nome: K, dati: Comandi[K]['dati']): Promise<Risposta<Comandi[K]['risposta']>> {
    const presa = this.presa.timeout(2_000) as unknown as {
      emitWithAck(nome: string, dati: unknown): Promise<Risposta<Comandi[K]['risposta']>>;
    };
    const risposta = await presa.emitWithAck(nome, dati);
    this.ricevuto += JSON.stringify(risposta);
    return risposta;
  }

  /** Esegue il comando e fallisce il test se il server lo rifiuta. */
  async ok<K extends NomeComando>(nome: K, dati: Comandi[K]['dati']): Promise<Comandi[K]['risposta']> {
    const risposta = await this.comando(nome, dati);
    if (!risposta.ok) throw new Error(`${nome} rifiutato: ${risposta.codice} – ${risposta.messaggio}`);
    return risposta.dati;
  }

  async entra(codice: string): Promise<Istantanea> {
    const istantanea = await this.ok('entra', { codice });
    this.stanza = istantanea.stanza;
    this.io = istantanea.io;
    return istantanea;
  }

  get partita(): Stato {
    if (!this.stanza?.partita) throw new Error('Nessuna partita in corso.');
    return this.stanza.partita;
  }
}

let chiudi: (() => Promise<void>) | null = null;
const prese: Presa[] = [];

afterEach(async () => {
  for (const presa of prese.splice(0)) presa.disconnect();
  await chiudi?.();
  chiudi = null;
});

async function avviaServer() {
  const http = createServer();
  const io = new Server<EventiClient, EventiServer, Record<string, never>, DatiSocket>(http, { serveClient: false });
  const amb = ambienteDiProva(42);
  const gestore = new GestoreStanze(amb);
  const tempoReale = collegaTempoReale(io, gestore);
  await new Promise<void>((pronto) => http.listen(0, '127.0.0.1', pronto));
  const url = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
  chiudi = () => {
    tempoReale.ferma();
    return new Promise<void>((fatto) => void io.close(() => fatto()));
  };

  async function browser(token: string): Promise<Browser> {
    const presa: Presa = apriPresa(url, { auth: { token }, transports: ['websocket'], forceNew: true, reconnection: false });
    prese.push(presa);
    await new Promise<void>((pronto, errore) => {
      presa.once('connect', pronto);
      presa.once('connect_error', errore);
    });
    return new Browser(presa);
  }

  return { amb, gestore, tempoReale, browser, url };
}

/** Lobby con Anna (host) e Bruno seduti; ordine dei turni fisso. */
async function lobbyADue() {
  const server = await avviaServer();
  const anna = await server.browser(TOKEN.anna);
  const bruno = await server.browser(TOKEN.bruno);
  const { codice } = await anna.ok('crea_stanza', { privata: true });
  await anna.entra(codice);
  await bruno.entra(codice.toUpperCase());
  await anna.ok('siediti', { nome: 'Anna', colore: 1 });
  await bruno.ok('siediti', { nome: 'Bruno', colore: 2 });
  await anna.ok('impostazioni', { ordineCasuale: false });
  return { ...server, anna, bruno, codice };
}

/** Un giocatore semplice: in rosso vende, altrimenti compra, costruisce, tira, chiude il turno. */
function scegliMossa(s: Stato, id: IdGiocatore): Mossa {
  const possibili = mossePossibili(s, id);
  const prima = (tipo: Mossa['tipo']) => possibili.find((m) => m.tipo === tipo);
  const io = s.giocatori.find((g) => g.id === id)!;
  const mossa =
    io.saldo < 0
      ? (prima('demolisci') ?? prima('vendi') ?? prima('bancarotta'))
      : (prima('compra') ?? prima('costruisci') ?? prima('lancia') ?? prima('fine_turno'));
  if (!mossa) throw new Error(`Nessuna mossa possibile per ${io.nome}.`);
  return mossa;
}

describe('partita completa a due', () => {
  it('Anna e Bruno giocano fino alla fine: stessi aggiornamenti, versioni senza buchi, niente segreti', async () => {
    const { anna, bruno, codice } = await lobbyADue();
    await anna.ok('avvia', {});
    expect(anna.stanza!.fase).toBe('partita');
    const versioneIniziale = anna.stanza!.versione;

    const perId = new Map([
      [anna.io!, anna],
      [bruno.io!, bruno],
    ]);
    let mosse = 0;
    for (; mosse < 3_000 && anna.stanza!.fase === 'partita'; mosse++) {
      // Dopo 40 turni chi aspetta si arrende: la prova deve finire in fretta.
      const s = anna.partita;
      if (s.turno.numero > 40) {
        const altro = s.giocatori.find((g) => g.id !== s.turno.giocatore)!;
        await perId.get(altro.id)!.ok('mossa', { tipo: 'bancarotta' });
        continue;
      }
      const chi = perId.get(s.turno.giocatore)!;
      await chi.ok('mossa', scegliMossa(chi.partita, chi.io!));
      // L'aggiornamento arriva prima della risposta: chi ha mosso è già allineato, l'altro lo aspetta.
      await vi.waitFor(() => {
        expect(anna.stanza!.versione).toBe(chi.stanza!.versione);
        expect(bruno.stanza!.versione).toBe(chi.stanza!.versione);
      });
    }

    expect(anna.stanza!.fase).toBe('finita');
    await vi.waitFor(() => expect(bruno.stanza!.versione).toBe(anna.stanza!.versione));
    expect(bruno.stanza).toEqual(anna.stanza);
    expect(anna.partita.vincitore).not.toBeNull();
    expect(mosse).toBeGreaterThan(40);

    for (const b of [anna, bruno]) {
      const versioni = b.aggiornamenti.map((a) => a.stanza.versione).filter((v) => v > versioneIniziale);
      expect(versioni).toEqual(versioni.map((_, i) => versioneIniziale + 1 + i));
      expect(b.ricevuto).not.toContain(TOKEN.anna);
      expect(b.ricevuto).not.toContain(TOKEN.bruno);
      expect(b.aggiornamenti.every((a) => a.stanza.partita === null || a.stanza.partita.mazzi.busta.ordine.length === 0)).toBe(true);
    }

    // Il registro di chi entra dopo coincide con gli ultimi eventi ricevuti dal vivo.
    const sincronizzata = await anna.ok('sincronizza', {});
    const dalVivo = anna.aggiornamenti.flatMap((a) => a.voci);
    expect(sincronizzata.registro).toEqual(dalVivo.slice(-sincronizzata.registro.length));
    expect(sincronizzata.stanza.codice).toBe(codice);
  });
});

describe('aste e scambi in rete', () => {
  it('l’asta si chiude da sola alla scadenza e tutti vedono l’ora del server', async () => {
    const { anna, bruno, amb, tempoReale } = await lobbyADue();
    await anna.ok('impostazioni', { aste: true });
    await anna.ok('avvia', {});
    expect(anna.aggiornamenti.at(-1)!.adesso).toBe(amb.adesso());

    // Si gioca finché Anna si ferma su una proprietà libera; Bruno compra sempre.
    for (let i = 0; i < 200 && !anna.partita.asta; i++) {
      const s = anna.partita;
      const chi = s.turno.giocatore === anna.io ? anna : bruno;
      const possibili = mossePossibili(chi.partita, chi.io!);
      const mossa = chi === anna ? possibili.find((m) => m.tipo === 'asta') : undefined;
      await chi.ok('mossa', mossa ?? scegliMossa(chi.partita, chi.io!));
      await vi.waitFor(() => expect(bruno.stanza!.versione).toBe(anna.stanza!.versione));
    }
    const asta = anna.partita.asta!;
    expect(asta.scadenza).toBe(amb.adesso() + 10_000);

    amb.avanza(3_000);
    await bruno.ok('mossa', { tipo: 'offri', importo: 10 });
    expect((await anna.comando('mossa', { tipo: 'offri', importo: 10 })).ok).toBe(false);
    await anna.ok('mossa', { tipo: 'offri', importo: 12 });
    await vi.waitFor(() => expect(bruno.partita.asta?.migliore).toEqual({ giocatore: anna.io, importo: 12 }));

    amb.avanza(10_000);
    tempoReale.manutenzione();
    await vi.waitFor(() => expect(bruno.partita.asta).toBeNull());
    expect(bruno.partita.proprieta[asta.casella]!.proprietario).toBe(anna.io);
    expect(bruno.aggiornamenti.at(-1)!.voci.map((v) => v.evento.tipo)).toEqual(['asta_vinta']);
  });

  it('se la sveglia dell’asta suona un attimo prima della scadenza, riprova invece di aspettare la manutenzione', async () => {
    const { anna, bruno, amb, gestore, codice, browser } = await lobbyADue();
    await anna.ok('impostazioni', { aste: true, timerTurno: false });
    await anna.ok('avvia', {});
    // Anna è ferma su Courmayeur, libera, e la manda all'asta; Bruno offre.
    const stanza = gestore.trova(codice)!;
    const p = stanza.partita!;
    p.turno = { ...p.turno, fase: 'dopo_lancio', dadi: [1, 2], acquisto: 1 };
    p.giocatori[0]!.posizione = 1;
    await anna.ok('mossa', { tipo: 'asta' });
    await bruno.ok('mossa', { tipo: 'offri', importo: 10 });

    // A 50 ms dalla fine entra uno spettatore: la sveglia si riprogramma tra 50 ms veri...
    amb.avanza(stanza.partita!.asta!.scadenza - amb.adesso() - 50);
    await (await browser(TOKEN.carla)).entra(codice);
    // ...ma quando suona l'orologio del gioco segna ancora 1 ms prima della scadenza.
    amb.avanza(49);
    await new Promise((fatto) => setTimeout(fatto, 150));
    expect(stanza.partita!.asta).not.toBeNull();
    amb.avanza(1);
    await vi.waitFor(() => expect(bruno.partita.asta).toBeNull());
    expect(bruno.partita.proprieta[1]!.proprietario).toBe(bruno.io);
  });

  it('un errore nelle scadenze di una stanza non fa cadere il server', async () => {
    const { anna, amb, gestore, codice, browser } = await lobbyADue();
    const stanza = gestore.trova(codice)!;
    await anna.ok('impostazioni', { bot: true, giocatoriMax: 4 });
    amb.avanza(stanza.attesa()! - 30);
    const errori = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(stanza, 'scadenze').mockImplementationOnce(() => {
      throw new Error('scadenza rotta');
    });
    // Lo spettatore che entra fa riprogrammare la sveglia: suona tra 30 ms.
    await (await browser(TOKEN.carla)).entra(codice);
    await vi.waitFor(() => expect(errori).toHaveBeenCalled());
    expect(String(errori.mock.calls[0]![0])).toContain(`stanza ${codice}`);
    errori.mockRestore();
    expect(await anna.ok('sincronizza', {})).toMatchObject({ stanza: { codice } });
  });

  it('chi crea o guarda uno scambio lo vedono anche gli altri', async () => {
    const { anna, bruno } = await lobbyADue();
    await anna.ok('avvia', {});
    bruno.presa.emit('attivita', { tipo: 'crea' });
    await vi.waitFor(() => expect(anna.attivita.at(-1)).toEqual({ [bruno.io!]: { tipo: 'crea' } }));
    // Dati non validi: ignorati.
    bruno.presa.emit('attivita', { tipo: 'guarda' } as unknown as Attivita);
    bruno.presa.emit('attivita', null);
    await vi.waitFor(() => expect(anna.attivita.at(-1)).toEqual({}));
    expect(anna.attivita).toHaveLength(2);
  });
});

describe('ingresso e identità', () => {
  it('senza token il server rifiuta la connessione', async () => {
    const { url } = await avviaServer();
    const presa: Presa = apriPresa(url, { transports: ['websocket'], forceNew: true, reconnection: false });
    prese.push(presa);
    const errore = await new Promise<Error>((fatto) => presa.once('connect_error', fatto));
    expect(errore.message).toBe('token_non_valido');
  });

  it('stanza inesistente: errore con il codice in maiuscolo', async () => {
    const { browser } = await avviaServer();
    const anna = await browser(TOKEN.anna);
    expect(await anna.comando('entra', { codice: 'zzzzz' })).toEqual({
      ok: false,
      codice: 'stanza_inesistente',
      messaggio: 'Non trovo la stanza ZZZZZ: è scaduta o è stata chiusa.',
    });
  });

  it('chi ricarica la pagina ritrova il suo posto, in lobby e in partita', async () => {
    const { anna, bruno, codice, browser } = await lobbyADue();
    const idBruno = bruno.io;
    bruno.presa.disconnect();
    await vi.waitFor(() => expect(anna.stanza!.partecipanti[1]!.connesso).toBe(false));

    const brunoDiNuovo = await browser(TOKEN.bruno);
    const istantanea = await brunoDiNuovo.entra(codice);
    expect(istantanea.io).toBe(idBruno);
    await vi.waitFor(() => expect(anna.stanza!.partecipanti[1]!.connesso).toBe(true));

    await anna.ok('avvia', {});
    brunoDiNuovo.presa.disconnect();
    const ancoraBruno = await browser(TOKEN.bruno);
    expect((await ancoraBruno.entra(codice)).io).toBe(idBruno);
    expect(ancoraBruno.stanza!.partita!.giocatori.map((g) => g.id)).toContain(idBruno);
  });

  it('a partita iniziata chi arriva guarda soltanto', async () => {
    const { anna, codice, browser } = await lobbyADue();
    await anna.ok('avvia', {});
    const carla = await browser(TOKEN.carla);
    const istantanea = await carla.entra(codice);
    expect(istantanea.io).toBeNull();
    expect(istantanea.stanza.spettatori).toBe(1);
    await vi.waitFor(() => expect(anna.stanza!.spettatori).toBe(1));
    expect(await carla.comando('siediti', { nome: 'Carla', colore: 3 })).toMatchObject({ codice: 'partita_iniziata' });
    expect(await carla.comando('mossa', { tipo: 'lancia' })).toMatchObject({ codice: 'non_seduto' });
    expect(await carla.comando('scrivi', { testo: 'ciao' })).toMatchObject({ codice: 'non_seduto' });
  });

  it('cambiare stanza libera il posto nella precedente', async () => {
    const { anna, bruno } = await lobbyADue();
    const { codice: altra } = await bruno.ok('crea_stanza', { privata: true });
    await bruno.entra(altra);
    await vi.waitFor(() => expect(anna.stanza!.partecipanti.map((p) => p.nome)).toEqual(['Anna']));
  });
});

describe('lobby in tempo reale', () => {
  it('l’espulso riceve l’aggiornamento senza posto e resta a guardare', async () => {
    const { anna, bruno } = await lobbyADue();
    await anna.ok('espelli', { giocatore: bruno.io! });
    await vi.waitFor(() => expect(bruno.io).toBeNull());
    expect(bruno.aggiornamenti.at(-1)!.voci.map((v) => v.evento)).toContainEqual(
      expect.objectContaining({ tipo: 'uscita', nome: 'Bruno', motivo: 'espulsione' }),
    );
    expect(bruno.stanza!.spettatori).toBe(1);
  });

  it('chi sparisce dalla lobby per 2 minuti perde il posto e l’host passa al successivo', async () => {
    const { anna, bruno, amb, tempoReale } = await lobbyADue();
    anna.presa.disconnect();
    await vi.waitFor(() => expect(bruno.stanza!.partecipanti[0]!.connesso).toBe(false));
    amb.avanza(ATTESA_LOBBY_MS);
    tempoReale.manutenzione();
    await vi.waitFor(() => expect(bruno.stanza!.host).toBe(bruno.io));
    expect(bruno.stanza!.partecipanti.map((p) => p.nome)).toEqual(['Bruno']);
  });

  it('chat e "sta scrivendo" arrivano agli altri', async () => {
    const { anna, bruno } = await lobbyADue();
    anna.presa.emit('sta_scrivendo');
    await vi.waitFor(() => expect(bruno.scrive).toEqual([anna.io]));
    await anna.ok('scrivi', { testo: 'Ciao Bruno' });
    await vi.waitFor(() => expect(bruno.messaggi.map((m) => m.testo)).toEqual(['Ciao Bruno']));
    expect(anna.scrive).toEqual([]);
    expect(anna.messaggi).toHaveLength(1);
    expect((await bruno.ok('sincronizza', {})).chat.map((m) => m.testo)).toEqual(['Ciao Bruno']);
  });

  it('nella chat di squadra «sta scrivendo» arriva solo ai compagni', async () => {
    const { anna, bruno, codice, browser, amb } = await lobbyADue();
    const carla = await browser(TOKEN.carla);
    const dario = await browser(TOKEN.dario);
    await carla.entra(codice);
    await dario.entra(codice);
    await carla.ok('siediti', { nome: 'Carla', colore: 3 });
    await anna.ok('impostazioni', { squadre: true });
    // Anna e Carla nella squadra 1, Bruno nella 2; Dario guarda.
    expect(anna.stanza!.partecipanti.map((p) => p.squadra)).toEqual([0, 1, 0]);
    anna.presa.emit('sta_scrivendo', true);
    // Il server tratta gli eventi di una scheda in ordine: dopo questa risposta ha già visto l'avviso.
    await anna.ok('sincronizza', {});
    amb.avanza(1_000);
    anna.presa.emit('sta_scrivendo');
    await vi.waitFor(() => expect(dario.scrive).toEqual([anna.io]));
    expect(bruno.scrive).toEqual([anna.io]);
    expect(carla.scrive).toEqual([anna.io, anna.io]);
  });

  it('limiti contro le raffiche: stanze create, messaggi, «sta scrivendo»', async () => {
    const { anna, bruno, amb, browser } = await lobbyADue();
    // Stanze: Anna ne ha già creata una, Carla ne crea 5, poi deve aspettare un minuto (anche con «Gioca»).
    const carla = await browser(TOKEN.carla);
    for (let i = 0; i < 5; i++) await carla.ok('crea_stanza', { privata: true });
    expect(await carla.comando('crea_stanza', { privata: true })).toMatchObject({ ok: false, codice: 'troppe_richieste' });
    expect(await carla.comando('gioca', {})).toMatchObject({ ok: false, codice: 'troppe_richieste' });
    expect((await anna.comando('crea_stanza', { privata: true })).ok).toBe(true);
    amb.avanza(60_000);
    expect((await carla.comando('crea_stanza', { privata: true })).ok).toBe(true);

    // Messaggi: al più 5 ogni 2 secondi.
    for (let i = 0; i < 5; i++) await anna.ok('scrivi', { testo: `messaggio ${i}` });
    expect(await anna.comando('scrivi', { testo: 'troppi' })).toMatchObject({ ok: false, codice: 'troppe_richieste' });
    amb.avanza(2_000);
    await anna.ok('scrivi', { testo: 'ancora' });
    await vi.waitFor(() => expect(bruno.messaggi).toHaveLength(6));

    // «Sta scrivendo»: al più uno al secondo.
    for (let i = 0; i < 3; i++) anna.presa.emit('sta_scrivendo');
    await anna.ok('sincronizza', {});
    amb.avanza(1_000);
    anna.presa.emit('sta_scrivendo');
    await vi.waitFor(() => expect(bruno.scrive).toEqual([anna.io, anna.io]));
  });

  it('le stanze pubbliche compaiono nell’elenco; "Gioca" porta nella prima con un posto', async () => {
    const { browser } = await avviaServer();
    const anna = await browser(TOKEN.anna);
    expect(await anna.ok('elenco_stanze', {})).toEqual([]);
    const { codice } = await anna.ok('gioca', {});
    await anna.entra(codice);
    await anna.ok('siediti', { nome: 'Anna', colore: 1 });
    const bruno = await browser(TOKEN.bruno);
    expect((await bruno.ok('gioca', {})).codice).toBe(codice);
    expect(await bruno.ok('elenco_stanze', {})).toMatchObject([{ codice, giocatori: [{ nome: 'Anna', colore: 1 }] }]);
  });
});

describe('robustezza', () => {
  it('dati sbagliati: risposta di errore, il server resta in piedi', async () => {
    const { anna } = await lobbyADue();
    const grezzo = anna.presa as unknown as { emitWithAck(...args: unknown[]): Promise<unknown> };
    expect(await anna.comando('mossa', { tipo: 'teletrasporto' } as unknown as Mossa)).toMatchObject({
      codice: 'richiesta_non_valida',
    });
    expect(await anna.comando('impostazioni', { giocatoriMax: 99 })).toMatchObject({ codice: 'richiesta_non_valida' });
    expect(await anna.comando('siediti', { nome: 42, colore: 'rosso' } as unknown as { nome: string; colore: number })).toMatchObject({
      codice: 'richiesta_non_valida',
    });
    // Comando senza dati, solo con la risposta.
    expect(await grezzo.emitWithAck('avvia')).toMatchObject({ ok: true });
    // Comandi senza risposta: ignorati.
    const senzaTipi = anna.presa as unknown as { emit(...args: unknown[]): void };
    senzaTipi.emit('elenco_stanze', {});
    senzaTipi.emit('comando_inventato', {});
    expect(await anna.ok('sincronizza', {})).toMatchObject({ stanza: { fase: 'partita' } });
  });

  it('fuori da una stanza i comandi di stanza rispondono "fuori_stanza"', async () => {
    const { browser } = await avviaServer();
    const anna = await browser(TOKEN.anna);
    expect(await anna.comando('avvia', {})).toMatchObject({ codice: 'fuori_stanza' });
    expect(await anna.comando('sincronizza', {})).toMatchObject({ codice: 'fuori_stanza' });
    expect(await anna.comando('esci', {})).toEqual({ ok: true, dati: null });
  });
});
