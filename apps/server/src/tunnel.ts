/*
 * Gioco online con un «tunnel rapido» di Cloudflare: gratis e senza account, porta il server di questo PC su
 * internet con un indirizzo https://<parole-a-caso>.trycloudflare.com, nuovo a ogni accensione.
 * - Il tunnel lo apre il programma cloudflared: si usa quello installato sul PC, se c'è, altrimenti PoorDown lo
 *   scarica una volta sola dalle pubblicazioni ufficiali di Cloudflare su GitHub, nella sua cartella dei dati.
 * - Il link si annuncia solo quando risponde davvero. Aperto troppo presto darebbe «sito non trovato», e il computer
 *   di chi lo apre se lo ricorderebbe per un po': per questo il controllo chiede il nome a un DNS pubblico
 *   (quello del sistema terrebbe a mente la risposta negativa).
 * - Se il tunnel non parte o cade, il gioco resta acceso per la rete di casa e si riprova da soli.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { lookup, Resolver } from 'node:dns/promises';
import { chmodSync, createWriteStream, existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { request } from 'node:https';
import path from 'node:path';
import readline from 'node:readline';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream } from 'node:stream/web';

const PUBBLICAZIONI = 'https://github.com/cloudflare/cloudflared/releases/latest/download';
/** Quanto si aspetta che il tunnel risponda prima di rinunciare (e riprovare più tardi). */
const AVVIO_MAX_MS = 60_000;
/** Attese tra un tentativo e l'altro quando il tunnel non parte o cade: poi si resta sull'ultima. */
const RIPROVE_MS = [5_000, 15_000, 30_000, 60_000];
/** Dopo questo tempo il controllo del link usa anche il DNS del sistema (se quelli pubblici sono bloccati). */
const DNS_SISTEMA_DOPO_MS = 20_000;
/** La pagina che il controllo chiede attraverso il tunnel. */
const PAGINA_DI_PROVA = '/api/info';

/** Il file di cloudflared per ogni sistema, tra quelli pubblicati da Cloudflare. */
const FILE_PER_SISTEMA: Record<string, string> = {
  'win32-x64': 'cloudflared-windows-amd64.exe',
  // Windows su ARM esegue i programmi x64.
  'win32-arm64': 'cloudflared-windows-amd64.exe',
  'win32-ia32': 'cloudflared-windows-386.exe',
  'linux-x64': 'cloudflared-linux-amd64',
  'linux-arm64': 'cloudflared-linux-arm64',
  'linux-arm': 'cloudflared-linux-arm',
  'linux-ia32': 'cloudflared-linux-386',
  'darwin-x64': 'cloudflared-darwin-amd64.tgz',
  'darwin-arm64': 'cloudflared-darwin-arm64.tgz',
};

/** Il file da scaricare per questo sistema; `null` se Cloudflare non ne pubblica uno. */
export function fileDaScaricare(sistema: string, architettura: string): string | null {
  return FILE_PER_SISTEMA[`${sistema}-${architettura}`] ?? null;
}

/** Almeno due parole con il trattino: così non si confonde con api.trycloudflare.com, che compare negli errori. */
const INDIRIZZO_TUNNEL = /https:\/\/[a-z0-9]+(?:-[a-z0-9]+)+\.trycloudflare\.com/;

/** L'indirizzo del tunnel scritto in una riga di cloudflared, se c'è. */
export function indirizzoTunnel(riga: string): string | null {
  return INDIRIZZO_TUNNEL.exec(riga)?.[0] ?? null;
}

/** cloudflared scrive così ogni collegamento riuscito con Cloudflare. */
export function tunnelCollegato(riga: string): boolean {
  return riga.includes('Registered tunnel connection');
}

/** Un motivo comprensibile per un tunnel che non è partito, dalle ultime righe di cloudflared. */
export function motivoGuasto(righe: readonly string[]): string {
  const errore = [...righe].reverse().find((r) => /\b(ERR|FTL)\b/.test(r));
  if (!errore) return 'il tunnel non è partito';
  if (/429|Too Many Requests/i.test(errore)) return 'Cloudflare ha ricevuto troppe richieste, riprovo tra poco';
  if (/quick Tunnel|trycloudflare/i.test(errore)) return 'Cloudflare non ha dato un indirizzo: forse manca internet';
  if (/dial|lookup|timeout|connection refused|no such host/i.test(errore)) return 'non riesco a raggiungere Cloudflare: forse manca internet';
  // Senza data e livello: "2026-11-09T19:15:28Z ERR qualcosa" → "qualcosa".
  return errore.replace(/^\S+\s+(ERR|FTL)\s+/, '').slice(0, 160);
}

/** Il programma risponde a `--version`? */
function funziona(programma: string): Promise<boolean> {
  return new Promise((esito) => {
    const prova = spawn(programma, ['--version'], { stdio: 'ignore', windowsHide: true, timeout: 15_000 });
    prova.on('error', () => esito(false));
    prova.on('exit', (codice) => esito(codice === 0));
  });
}

async function scarica(indirizzo: string, destinazione: string): Promise<void> {
  const risposta = await fetch(indirizzo, { signal: AbortSignal.timeout(10 * 60_000) });
  if (!risposta.ok || !risposta.body) throw new Error(`lo scaricamento di cloudflared non è riuscito (HTTP ${risposta.status})`);
  const parziale = `${destinazione}.parziale`;
  try {
    await pipeline(Readable.fromWeb(risposta.body as ReadableStream<Uint8Array>), createWriteStream(parziale));
    renameSync(parziale, destinazione);
  } finally {
    rmSync(parziale, { force: true });
  }
}

function estrai(archivio: string, cartella: string): Promise<void> {
  return new Promise((fatto, fallito) => {
    const tar = spawn('tar', ['-xzf', archivio, '-C', cartella], { stdio: 'ignore' });
    tar.on('error', fallito);
    tar.on('exit', (codice) => (codice === 0 ? fatto() : fallito(new Error('non riesco a estrarre cloudflared'))));
  });
}

/** cloudflared già installato sul PC, la copia scaricata in passato, oppure una nuova copia da scaricare adesso. */
async function trovaProgramma(cartella: string, nota: (testo: string) => void): Promise<string> {
  if (await funziona('cloudflared')) return 'cloudflared';
  const copia = path.join(cartella, process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared');
  if (existsSync(copia) && (await funziona(copia))) return copia;

  const file = fileDaScaricare(process.platform, process.arch);
  if (!file) throw new Error(`Cloudflare non pubblica cloudflared per questo sistema (${process.platform} ${process.arch})`);
  mkdirSync(cartella, { recursive: true });
  nota('Scarico cloudflared, il programma del gioco online: circa 50 MB, solo la prima volta.');
  if (file.endsWith('.tgz')) {
    const archivio = path.join(cartella, file);
    await scarica(`${PUBBLICAZIONI}/${file}`, archivio);
    await estrai(archivio, cartella);
    rmSync(archivio, { force: true });
  } else {
    await scarica(`${PUBBLICAZIONI}/${file}`, copia);
  }
  if (process.platform !== 'win32') chmodSync(copia, 0o755);
  if (!(await funziona(copia))) throw new Error('la copia scaricata di cloudflared non funziona');
  nota('cloudflared è pronto.');
  return copia;
}

const dnsPubblico = new Resolver({ timeout: 3_000, tries: 1 });
dnsPubblico.setServers(['1.1.1.1', '8.8.8.8']);

/** GET su `indirizzo` + `PAGINA_DI_PROVA` collegandosi a `ip`: risponde con successo? */
function chiedi(indirizzo: string, ip: string): Promise<boolean> {
  const { hostname } = new URL(indirizzo);
  return new Promise((esito) => {
    const richiesta = request(
      {
        host: hostname,
        path: PAGINA_DI_PROVA,
        servername: hostname,
        timeout: 5_000,
        // Il nome è già risolto: niente domande al DNS del sistema.
        lookup: (_nome, opzioni, risposta) => {
          if (opzioni.all) risposta(null, [{ address: ip, family: 4 }]);
          else risposta(null, ip, 4);
        },
      },
      (res) => {
        res.resume();
        esito((res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300);
      },
    );
    richiesta.on('error', () => esito(false));
    richiesta.on('timeout', () => richiesta.destroy());
    richiesta.end();
  });
}

/** Aspetta che il link risponda da internet. `false` se non succede entro `maxMs` o se `ancora()` diventa falso. */
async function aspettaRisposta(indirizzo: string, maxMs: number, ancora: () => boolean): Promise<boolean> {
  const { hostname } = new URL(indirizzo);
  const inizio = Date.now();
  while (ancora() && Date.now() - inizio < maxMs) {
    try {
      const ip =
        Date.now() - inizio < DNS_SISTEMA_DOPO_MS
          ? (await dnsPubblico.resolve4(hostname))[0]
          : (await lookup(hostname, { family: 4 })).address;
      if (ip && (await chiedi(indirizzo, ip))) return true;
    } catch {
      // Il nome non c'è ancora: si riprova.
    }
    await new Promise((dopo) => setTimeout(dopo, 1_000));
  }
  return false;
}

export interface AvvisiTunnel {
  /** Il link online funziona. Dopo una caduta arriva di nuovo, con un link nuovo. */
  pronto(indirizzo: string): void;
  /** Il tunnel non è partito o è caduto: si riprova da soli. Arriva una volta sola finché non torna pronto. */
  problema(motivo: string): void;
  /** Avanzamento (lo scaricamento di cloudflared). */
  nota(testo: string): void;
}

export class Tunnel {
  /** Il link online che funziona adesso, o `null`. */
  indirizzo: string | null = null;
  private programma: string | null = null;
  private processo: ChildProcess | null = null;
  private fermo = false;
  private tentativi = 0;
  private problemaDetto = false;
  private sveglia: NodeJS.Timeout | undefined;

  /**
   * @param porta la porta del server su questo PC
   * @param cartella dove tenere cloudflared scaricato e il suo file di configurazione
   */
  constructor(
    private readonly porta: number,
    private readonly cartella: string,
    private readonly avvisi: AvvisiTunnel,
  ) {}

  avvia(): void {
    void this.prova();
  }

  ferma(): void {
    this.fermo = true;
    clearTimeout(this.sveglia);
    this.processo?.kill();
    this.processo = null;
    this.indirizzo = null;
  }

  private async prova(): Promise<void> {
    try {
      this.programma ??= await trovaProgramma(this.cartella, (t) => this.avvisi.nota(t));
      if (!this.fermo) this.lancia(this.programma);
    } catch (errore) {
      this.riprova(errore instanceof Error ? errore.message : String(errore));
    }
  }

  private lancia(programma: string): void {
    mkdirSync(this.cartella, { recursive: true });
    // Una configurazione nostra: quella di chi ha già un tunnel suo sul PC impedirebbe il tunnel rapido.
    const configurazione = path.join(this.cartella, 'cloudflared.yml');
    writeFileSync(configurazione, 'no-autoupdate: true\n');
    const processo = spawn(
      programma,
      ['tunnel', '--no-autoupdate', '--config', configurazione, '--url', `http://127.0.0.1:${this.porta}`],
      { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
    );
    this.processo = processo;
    const ultime: string[] = [];
    let candidato: string | null = null;
    let controllo = false;
    let finito = false;
    /** Perché lo si è chiuso da qui, prima che fosse pronto. */
    let chiusoPerche: string | null = null;
    const chiudi = (perche: string) => {
      chiusoPerche = perche;
      processo.kill();
    };
    const scadenza = setTimeout(() => chiudi('Cloudflare non ha risposto in tempo'), AVVIO_MAX_MS + 10_000);

    const leggi = (riga: string) => {
      ultime.push(riga);
      if (ultime.length > 12) ultime.shift();
      candidato ??= indirizzoTunnel(riga);
      if (!candidato || controllo || !tunnelCollegato(riga)) return;
      controllo = true;
      const indirizzo = candidato;
      void aspettaRisposta(indirizzo, AVVIO_MAX_MS, () => this.processo === processo).then((risponde) => {
        if (this.processo !== processo) return;
        if (!risponde) {
          chiudi('il link non risponde da internet');
          return;
        }
        clearTimeout(scadenza);
        this.indirizzo = indirizzo;
        this.tentativi = 0;
        this.problemaDetto = false;
        this.avvisi.pronto(indirizzo);
      });
    };
    for (const flusso of [processo.stdout, processo.stderr]) readline.createInterface({ input: flusso }).on('line', leggi);

    const fine = (motivo: string | null) => {
      if (finito) return;
      finito = true;
      clearTimeout(scadenza);
      if (this.processo !== processo) return;
      this.processo = null;
      const eraPronto = this.indirizzo !== null;
      this.indirizzo = null;
      this.riprova(motivo ?? chiusoPerche ?? (eraPronto ? 'il tunnel si è chiuso' : motivoGuasto(ultime)));
    };
    processo.on('error', (errore) => {
      // Il programma non c'è più (o non parte): al prossimo tentativo lo si cerca di nuovo.
      this.programma = null;
      fine(`cloudflared non parte (${errore.message})`);
    });
    processo.on('close', () => fine(null));
  }

  private riprova(motivo: string): void {
    if (this.fermo) return;
    if (!this.problemaDetto) {
      this.problemaDetto = true;
      this.avvisi.problema(motivo);
    }
    const attesa = RIPROVE_MS[Math.min(this.tentativi, RIPROVE_MS.length - 1)]!;
    this.tentativi += 1;
    this.sveglia = setTimeout(() => void this.prova(), attesa);
    this.sveglia.unref();
  }
}
