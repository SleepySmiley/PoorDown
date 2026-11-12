/*
 * Il server del gioco acceso dall'estensione. Gira in un processo a parte (il Node.js che VS Code ha dentro, quindi
 * sul PC non serve installarlo): se qualcosa va storto non trascina giù VS Code, e un processo suo ha la sua porta, il
 * suo tunnel e il suo salvataggio come con il doppio clic. Parla con l'estensione sul canale IPC (apps/server/src/genitore.ts).
 * Se sulla porta risponde già un PoorDown (un'altra finestra di VS Code o il doppio clic) si usa quello.
 */

import { fork, type ChildProcess } from 'node:child_process';
import readline from 'node:readline';
import type { InfoServer } from '@poordown/engine';
import type { MessaggioAlGenitore, MessaggioDalGenitore } from '../../server/src/genitore';
import { eInfoDiPoorDown } from './link';

export type StatoServer =
  | { tipo: 'spento' }
  | { tipo: 'avvio'; online: boolean; porta: number }
  /** Acceso da questa finestra. `pubblico` è il link online, quando c'è. */
  | { tipo: 'acceso'; online: boolean; porta: number; indirizzi: string[]; pubblico: string | null }
  /** Acceso da un'altra parte (un'altra finestra di VS Code, il doppio clic): si usa, ma non si spegne da qui. */
  | { tipo: 'altrove'; porta: number };

export interface AvvisiServer {
  /** Una riga scritta dal server (le stesse della finestra nera). */
  riga(testo: string): void;
  cambiato(stato: StatoServer): void;
  online(indirizzo: string, cambiato: boolean): void;
  problemaOnline(motivo: string): void;
  /** Il server si è spento senza che nessuno lo chiedesse. */
  spentoDaSolo(codice: number | null): void;
}

export class PortaOccupata extends Error {
  constructor(readonly porta: number) {
    super(`La porta ${porta} è già usata da un altro programma.`);
  }
}

/** Quanto si aspetta che il server si accenda. */
const AVVIO_MAX_MS = 60_000;
/** Quanto si aspetta che salvi e si spenga prima di chiuderlo a forza. */
const SPEGNIMENTO_MAX_MS = 5_000;
/** Le ultime righe scritte dal server, per spiegare un avvio non riuscito. */
const RIGHE_TENUTE = 20;

/** Il PoorDown che risponde su questa porta di questo PC, se c'è. */
export async function infoServer(porta: number): Promise<InfoServer | null> {
  try {
    const risposta = await fetch(`http://localhost:${porta}/api/info`, { signal: AbortSignal.timeout(1_500) });
    const dati: unknown = await risposta.json();
    return eInfoDiPoorDown(dati) ? dati : null;
  } catch {
    return null;
  }
}

export class ServerLocale {
  private _stato: StatoServer = { tipo: 'spento' };
  private processo: ChildProcess | null = null;
  private accensione: Promise<StatoServer> | null = null;
  private spegnendo = false;
  private ultimeRighe: string[] = [];

  constructor(
    /** Il server compilato (dist/server.mjs). */
    private readonly fileServer: string,
    /** Il sito compilato (dist/web). */
    private readonly cartellaSito: string,
    private readonly avvisi: AvvisiServer,
  ) {}

  get stato(): StatoServer {
    return this._stato;
  }

  private cambia(stato: StatoServer): void {
    this._stato = stato;
    this.avvisi.cambiato(stato);
  }

  /** Accende il server (o trova quello già acceso). Rifiuta con `PortaOccupata` se la porta è di un altro programma. */
  accendi(porta: number, online: boolean): Promise<StatoServer> {
    if (this.accensione) return this.accensione;
    if (this._stato.tipo === 'acceso' || this._stato.tipo === 'altrove') return Promise.resolve(this._stato);
    this.accensione = this.avvia(porta, online).finally(() => {
      this.accensione = null;
    });
    return this.accensione;
  }

  private async avvia(porta: number, online: boolean): Promise<StatoServer> {
    this.cambia({ tipo: 'avvio', online, porta });
    if (await infoServer(porta)) {
      this.cambia({ tipo: 'altrove', porta });
      return this._stato;
    }
    try {
      await this.lancia(porta, online);
    } catch (errore) {
      this.cambia({ tipo: 'spento' });
      throw errore;
    }
    return this._stato;
  }

  private lancia(porta: number, online: boolean): Promise<void> {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      // Il Node.js di VS Code: l'eseguibile di VS Code con questa variabile si comporta come node.
      ELECTRON_RUN_AS_NODE: '1',
      PORT: String(porta),
      POORDOWN_SITO: this.cartellaSito,
      POORDOWN_GENITORE: 'vscode',
    };
    // Questa è per il doppio clic (apre il browser): qui il gioco si apre in VS Code.
    delete env.POORDOWN_APRI;
    this.spegnendo = false;
    this.ultimeRighe = [];
    const processo = fork(this.fileServer, online ? ['--online'] : [], {
      env,
      execArgv: [],
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    });
    this.processo = processo;
    for (const flusso of [processo.stdout, processo.stderr]) {
      if (!flusso) continue;
      readline.createInterface({ input: flusso }).on('line', (riga) => {
        this.ultimeRighe = [...this.ultimeRighe, riga].slice(-RIGHE_TENUTE);
        this.avvisi.riga(riga);
      });
    }

    return new Promise((acceso, fallito) => {
      let avviato = false;
      const scadenza = setTimeout(() => {
        fallito(new Error('Il server non si è acceso entro un minuto.'));
        processo.kill();
      }, AVVIO_MAX_MS);

      processo.on('message', (dati: MessaggioAlGenitore) => {
        switch (dati.tipo) {
          case 'acceso':
            avviato = true;
            clearTimeout(scadenza);
            this.cambia({ tipo: 'acceso', online, porta, indirizzi: dati.indirizzi, pubblico: null });
            acceso();
            break;
          case 'online': {
            if (this._stato.tipo !== 'acceso') break;
            const prima = this._stato.pubblico;
            this.cambia({ ...this._stato, pubblico: dati.indirizzo });
            if (prima !== dati.indirizzo) this.avvisi.online(dati.indirizzo, prima !== null);
            break;
          }
          case 'problema-online':
            this.avvisi.problemaOnline(dati.motivo);
            break;
          case 'porta-occupata':
            clearTimeout(scadenza);
            fallito(new PortaOccupata(dati.porta));
            break;
        }
      });

      processo.on('error', (errore) => {
        clearTimeout(scadenza);
        if (!avviato) fallito(errore);
      });

      processo.on('exit', (codice) => {
        clearTimeout(scadenza);
        if (this.processo === processo) this.processo = null;
        if (!avviato) {
          const dettagli = this.ultimeRighe.map((r) => r.trim()).filter(Boolean).slice(-3).join(' ');
          fallito(new Error(`Il server non si è acceso${dettagli ? `: ${dettagli}` : '.'}`));
          return;
        }
        const daSolo = !this.spegnendo;
        this.cambia({ tipo: 'spento' });
        if (daSolo) this.avvisi.spentoDaSolo(codice);
      });
    });
  }

  /** Spegne il server di questa finestra, che prima salva le partite. Quello acceso altrove si lascia stare. */
  async spegni(): Promise<void> {
    const processo = this.processo;
    if (!processo) {
      if (this._stato.tipo === 'altrove') this.cambia({ tipo: 'spento' });
      return;
    }
    this.spegnendo = true;
    const spento = new Promise<void>((fatto) => processo.once('exit', () => fatto()));
    const messaggio: MessaggioDalGenitore = { tipo: 'spegni' };
    if (processo.connected) processo.send(messaggio);
    else processo.kill();
    const scadenza = new Promise<'scaduto'>((fatto) => setTimeout(() => fatto('scaduto'), SPEGNIMENTO_MAX_MS).unref());
    if ((await Promise.race([spento, scadenza])) === 'scaduto') {
      processo.kill();
      await spento;
    }
  }
}
