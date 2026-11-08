/*
 * Livello di rete: collega i comandi Socket.IO alle stanze e manda gli aggiornamenti.
 * Ogni comando riceve una risposta. Se ha cambiato la stanza, prima parte l'aggiornamento a tutti
 * (con la nuova versione) e poi la risposta a chi l'ha chiesto: quando il browser riceve "ok",
 * il suo stato è già aggiornato.
 */

import type { Server, Socket } from 'socket.io';
import {
  CHAT_MAX,
  NOME_MAX,
  type Comandi,
  type EventiClient,
  type EventiServer,
  type NomeComando,
  type Risposta,
} from '@poordown/engine';
import type { GestoreStanze } from './gestore';
import { booleano, intero, leggiAttivita, leggiImpostazioni, leggiMossa, leggiToken, testo } from './lettura';
import { no, si, type Stanza, type Token } from './stanza';

export interface DatiSocket {
  token: Token;
  /** Codice della stanza seguita. */
  stanza: string | null;
}

type ServerGioco = Server<EventiClient, EventiServer, Record<string, never>, DatiSocket>;
type SocketGioco = Socket<EventiClient, EventiServer, Record<string, never>, DatiSocket>;

const NON_VALIDA = no('richiesta_non_valida', 'Richiesta non valida.');
const FUORI_STANZA = no('fuori_stanza', 'Non sei in nessuna stanza.');

const canale = (codice: string) => `stanza:${codice}`;

export interface TempoReale {
  /** Da chiamare ogni pochi secondi: assenze in lobby, scadenze rimaste indietro e stanze abbandonate. */
  manutenzione(): void;
  /** Spegne le sveglie delle scadenze (per chiudere il server). */
  ferma(): void;
}

/**
 * @param dopoModifica chiamata dopo ogni cambiamento delle stanze (per il salvataggio su file).
 */
export function collegaTempoReale(io: ServerGioco, gestore: GestoreStanze, dopoModifica: () => void = () => {}): TempoReale {
  io.use((socket, next) => {
    const token = leggiToken((socket.handshake.auth as Record<string, unknown> | undefined)?.token);
    if (!token) {
      next(new Error('token_non_valido'));
      return;
    }
    socket.data.token = token;
    socket.data.stanza = null;
    next();
  });

  /** Una sveglia per stanza, alla prossima scadenza della partita (la fine dell'asta). */
  const sveglie = new Map<string, ReturnType<typeof setTimeout>>();

  function programmaSveglia(stanza: Stanza): void {
    clearTimeout(sveglie.get(stanza.codice));
    sveglie.delete(stanza.codice);
    const attesa = stanza.attesa();
    if (attesa === null) return;
    const sveglia = setTimeout(() => {
      sveglie.delete(stanza.codice);
      if (gestore.trova(stanza.codice) !== stanza) return;
      stanza.scadenze();
      diffondi(stanza);
    }, attesa);
    sveglia.unref();
    sveglie.set(stanza.codice, sveglia);
  }

  /** Manda a ogni scheda della stanza il nuovo stato, se è cambiato, e le attività sugli scambi. */
  function diffondi(stanza: Stanza): void {
    const voci = stanza.raccogli();
    if (voci) {
      const vista = stanza.vista();
      const adesso = stanza.orologio();
      for (const id of io.sockets.adapter.rooms.get(canale(stanza.codice)) ?? []) {
        const socket = io.sockets.sockets.get(id);
        if (socket) socket.emit('aggiornamento', { stanza: vista, io: stanza.io(socket.data.token), voci, adesso });
      }
      programmaSveglia(stanza);
      dopoModifica();
    }
    const attivita = stanza.raccogliAttivita();
    if (attivita) io.to(canale(stanza.codice)).emit('attivita', attivita);
  }

  for (const stanza of gestore.tutte()) programmaSveglia(stanza);

  function lascia(socket: SocketGioco, esplicito: boolean): void {
    const stanza = socket.data.stanza === null ? undefined : gestore.trova(socket.data.stanza);
    if (socket.data.stanza !== null) void socket.leave(canale(socket.data.stanza));
    socket.data.stanza = null;
    if (!stanza) return;
    if (esplicito) stanza.esci(socket.id);
    else stanza.scollega(socket.id);
    diffondi(stanza);
  }

  io.on('connection', (socket) => {
    const token = socket.data.token;
    const corrente = () => (socket.data.stanza === null ? undefined : gestore.trova(socket.data.stanza));

    /** Registra un comando: legge i dati, risponde sempre, non lascia mai cadere il server. */
    function comando<K extends NomeComando>(nome: K, esegui: (dati: unknown) => Risposta<Comandi[K]['risposta']>): void {
      (socket as unknown as { on(evento: string, ascolta: (...args: unknown[]) => void): void }).on(nome, (...args) => {
        const rispondi = args.at(-1);
        if (typeof rispondi !== 'function') return;
        let risposta: Risposta<Comandi[K]['risposta']>;
        try {
          risposta = esegui(args.length > 1 ? args[0] : undefined);
        } catch (errore) {
          console.error(`  Errore nel comando "${nome}":`, errore);
          risposta = no('errore_interno', 'Qualcosa è andato storto sul server.');
        }
        (rispondi as (r: unknown) => void)(risposta);
      });
    }

    /** Comando sulla stanza seguita: dopo l'esecuzione manda l'aggiornamento a tutti. */
    function comandoInStanza<K extends NomeComando>(
      nome: K,
      esegui: (stanza: Stanza, dati: unknown) => Risposta<Comandi[K]['risposta']>,
    ): void {
      comando(nome, (dati) => {
        const stanza = corrente();
        if (!stanza) return FUORI_STANZA;
        const risposta = esegui(stanza, dati);
        diffondi(stanza);
        return risposta;
      });
    }

    comando('elenco_stanze', () => si(gestore.elenco()));

    comando('crea_stanza', (dati) => {
      const privata = booleano(dati, 'privata');
      if (privata === null) return NON_VALIDA;
      const stanza = gestore.crea(privata);
      if (!stanza) return no('troppe_stanze', 'Il server ha troppe stanze aperte. Riprova più tardi.');
      dopoModifica();
      return si({ codice: stanza.codice });
    });

    comando('gioca', () => {
      const stanza = gestore.gioca();
      if (!stanza) return no('troppe_stanze', 'Il server ha troppe stanze aperte. Riprova più tardi.');
      dopoModifica();
      return si({ codice: stanza.codice });
    });

    comando('entra', (dati) => {
      const codice = testo(dati, 'codice', 20);
      if (codice === null) return NON_VALIDA;
      const stanza = gestore.trova(codice);
      if (!stanza) {
        return no('stanza_inesistente', `Non trovo la stanza ${codice.trim().toUpperCase()}: è scaduta o è stata chiusa.`);
      }
      if (socket.data.stanza !== stanza.codice) {
        lascia(socket, true);
        void socket.join(canale(stanza.codice));
        socket.data.stanza = stanza.codice;
        stanza.collega(socket.id, token);
        diffondi(stanza);
      }
      return si(stanza.istantanea(token));
    });

    comando('esci', () => {
      lascia(socket, true);
      return si(null);
    });

    comando('sincronizza', () => {
      const stanza = corrente();
      return stanza ? si(stanza.istantanea(token)) : FUORI_STANZA;
    });

    comandoInStanza('siediti', (stanza, dati) => {
      const nome = testo(dati, 'nome', NOME_MAX * 4);
      const colore = intero(dati, 'colore');
      if (nome === null || colore === null) return NON_VALIDA;
      return stanza.siediti(token, nome, colore);
    });

    comandoInStanza('cambia_colore', (stanza, dati) => {
      const colore = intero(dati, 'colore');
      return colore === null ? NON_VALIDA : stanza.cambiaColore(token, colore);
    });

    comandoInStanza('impostazioni', (stanza, dati) => {
      const modifiche = leggiImpostazioni(dati);
      return modifiche ? stanza.cambiaImpostazioni(token, modifiche) : NON_VALIDA;
    });

    comandoInStanza('espelli', (stanza, dati) => {
      const id = testo(dati, 'giocatore', 64);
      return id === null ? NON_VALIDA : stanza.espelli(token, id);
    });

    comandoInStanza('avvia', (stanza) => stanza.avvia(token));

    comandoInStanza('nuova_partita', (stanza) => stanza.nuovaPartita(token));

    comandoInStanza('mossa', (stanza, dati) => {
      const mossa = leggiMossa(dati);
      return mossa ? stanza.mossa(token, mossa) : NON_VALIDA;
    });

    comando('scrivi', (dati) => {
      const stanza = corrente();
      if (!stanza) return FUORI_STANZA;
      const contenuto = testo(dati, 'testo', CHAT_MAX * 4);
      if (contenuto === null) return NON_VALIDA;
      const esito = stanza.scrivi(token, contenuto);
      if (!esito.ok) return esito;
      io.to(canale(stanza.codice)).emit('messaggio', esito.dati);
      dopoModifica();
      return si(null);
    });

    socket.on('sta_scrivendo', () => {
      const stanza = corrente();
      const id = stanza?.io(token);
      if (stanza && id) socket.to(canale(stanza.codice)).emit('scrive', id);
    });

    socket.on('attivita', (dati: unknown) => {
      const stanza = corrente();
      const attivita = leggiAttivita(dati);
      if (!stanza || attivita === undefined) return;
      stanza.cambiaAttivita(token, attivita);
      diffondi(stanza);
    });

    socket.on('disconnect', () => lascia(socket, false));
  });

  return {
    manutenzione() {
      const { aperte, chiuse } = gestore.manutenzione();
      for (const stanza of aperte) diffondi(stanza);
      for (const stanza of chiuse) {
        for (const id of io.sockets.adapter.rooms.get(canale(stanza.codice)) ?? []) {
          const socket = io.sockets.sockets.get(id);
          if (!socket) continue;
          socket.emit('stanza_chiusa', stanza.codice);
          socket.data.stanza = null;
          void socket.leave(canale(stanza.codice));
        }
      }
      if (chiuse.length > 0) dopoModifica();
    },
    ferma() {
      for (const sveglia of sveglie.values()) clearTimeout(sveglia);
      sveglie.clear();
    },
  };
}
