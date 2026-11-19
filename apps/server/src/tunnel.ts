/*
 * Gioco online con un «tunnel rapido» di Cloudflare: gratis e senza account, porta il server di questo PC su
 * internet con un indirizzo https://<parole-a-caso>.trycloudflare.com, nuovo a ogni accensione.
 * - Il tunnel lo apre il programma cloudflared: si usa quello installato sul PC, se è almeno la versione fissata,
 *   altrimenti PoorDown scarica quella versione una volta sola dalle pubblicazioni ufficiali di Cloudflare su GitHub,
 *   nella sua cartella dei dati, e la avvia solo se la sua impronta SHA-256 è quella attesa (tunnel-verifica.ts).
 * - Il link si annuncia solo quando risponde davvero. Aperto troppo presto darebbe «sito non trovato», e il computer
 *   di chi lo apre se lo ricorderebbe per un po': per questo il controllo chiede il nome a un DNS pubblico
 *   (quello del sistema terrebbe a mente la risposta negativa).
 * - Se il tunnel non parte o cade, il gioco resta acceso per la rete di casa e si riprova da soli.
 */

import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { lookup, Resolver } from 'node:dns/promises';
import { chmodSync, existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { request } from 'node:https';
import path from 'node:path';
import readline from 'node:readline';
import {
  CLOUDFLARED,
  cercaNelPath,
  confrontaVersioni,
  fileDaScaricare,
  improntaFile,
  improntaProgramma,
  ImprontaSbagliata,
  indirizzoScaricamento,
  scaricaVerificato,
  versioneDa,
} from './tunnel-verifica';

export { fileDaScaricare } from './tunnel-verifica';

/** Quanto si aspetta che il tunnel risponda prima di rinunciare (e riprovare più tardi). */
const AVVIO_MAX_MS = 60_000;
/** Attese tra un tentativo e l'altro quando il tunnel non parte o cade: poi si resta sull'ultima. */
const RIPROVE_MS = [5_000, 15_000, 30_000, 60_000];
/** Dopo questo tempo il controllo del link usa anche il DNS del sistema (se quelli pubblici sono bloccati). */
const DNS_SISTEMA_DOPO_MS = 20_000;
/** La pagina che il controllo chiede attraverso il tunnel. */
const PAGINA_DI_PROVA = '/api/info';
/** Scaricamenti di cloudflared con l'impronta sbagliata dopo i quali, in questa accensione, il gioco online si spegne. */
const SCARICAMENTI_SBAGLIATI_MAX = 3;

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

/** La versione che il programma dichiara con `--version`; `null` se non parte o non la dice. */
function versioneDi(programma: string): Promise<string | null> {
  return new Promise((esito) => {
    execFile(programma, ['--version'], { timeout: 15_000, windowsHide: true }, (errore, uscita, errori) => {
      esito(errore ? null : versioneDa(`${uscita}\n${errori}`));
    });
  });
}

function estrai(archivio: string, cartella: string): Promise<void> {
  return new Promise((fatto, fallito) => {
    const tar = spawn('tar', ['-xzf', archivio, '-C', cartella], { stdio: 'ignore' });
    tar.on('error', fallito);
    tar.on('exit', (codice) => (codice === 0 ? fatto() : fallito(new Error('non riesco a estrarre cloudflared'))));
  });
}

/**
 * Il cloudflared da avviare, nell'ordine:
 * 1. quello installato sul PC, se è almeno la versione fissata. Di un programma installato non si conosce l'impronta,
 *    quindi si controlla la versione; lo si cerca solo nelle cartelle del PATH, mai in quella corrente;
 * 2. la copia scaricata in passato nella cartella dei dati, se la sua impronta è quella attesa. Una copia diversa
 *    (presa quando PoorDown scaricava sempre l'ultima versione, rovinata o cambiata da qualcuno) si cancella;
 * 3. una copia nuova della versione fissata, che prende il suo posto solo con l'impronta giusta.
 */
async function trovaProgramma(cartella: string, nota: (testo: string) => void): Promise<string> {
  const { versione } = CLOUDFLARED;
  const installato = cercaNelPath('cloudflared', process.env.PATH);
  const versioneInstallata = installato ? await versioneDi(installato) : null;
  if (installato && versioneInstallata && confrontaVersioni(versioneInstallata, versione) >= 0) return installato;

  const file = fileDaScaricare(process.platform, process.arch);
  if (!file) throw new Error(`Cloudflare non pubblica cloudflared per questo sistema (${process.platform} ${process.arch})`);
  const atteso = CLOUDFLARED.file[file];
  if (!atteso) throw new Error(`manca l’impronta di ${file}: non lo scarico`);
  const copia = path.join(cartella, process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared');
  const giaScaricata = existsSync(copia);
  if (giaScaricata) {
    if ((await improntaFile(copia)) === improntaProgramma(atteso)) return copia;
    rmSync(copia, { force: true });
  }

  mkdirSync(cartella, { recursive: true });
  nota(
    giaScaricata
      ? `Riscarico cloudflared ${versione}: la copia nella cartella dei dati non è quella attesa (circa 50 MB).`
      : `Scarico cloudflared ${versione}, il programma del gioco online: circa 50 MB, solo la prima volta.`,
  );
  if (file.endsWith('.tgz')) {
    // L'archivio si verifica prima di aprirlo e si apre in una cartella a parte (in quella dei dati ci sono anche le
    // partite salvate): il programma passa al suo posto solo se anche la sua impronta è quella attesa.
    const estrazione = path.join(cartella, 'cloudflared-estrazione');
    rmSync(estrazione, { recursive: true, force: true });
    mkdirSync(estrazione);
    try {
      const archivio = path.join(estrazione, file);
      await scaricaVerificato(indirizzoScaricamento(file), archivio, atteso.sha256);
      await estrai(archivio, estrazione);
      const estratto = path.join(estrazione, 'cloudflared');
      if (!existsSync(estratto) || (await improntaFile(estratto)) !== improntaProgramma(atteso)) {
        throw new ImprontaSbagliata('il cloudflared dentro l’archivio scaricato non è quello atteso: non l’ho avviato');
      }
      renameSync(estratto, copia);
    } finally {
      rmSync(estrazione, { recursive: true, force: true });
    }
  } else {
    await scaricaVerificato(indirizzoScaricamento(file), copia, atteso.sha256);
  }
  if (process.platform !== 'win32') chmodSync(copia, 0o755);
  if (!(await funziona(copia))) throw new Error('la copia scaricata di cloudflared non parte su questo PC');
  nota(`cloudflared ${versione} è pronto: è proprio quello pubblicato da Cloudflare.`);
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
  /** Copie di cloudflared scaricate in questa accensione e scartate perché l'impronta non era quella attesa. */
  private scaricamentiSbagliati = 0;
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
      // Un cloudflared che non è quello atteso non si riscarica all'infinito (50 MB a ogni tentativo): dopo qualche
      // volta il gioco online resta spento fino alla prossima accensione, e la rete di casa funziona come sempre.
      if (errore instanceof ImprontaSbagliata && ++this.scaricamentiSbagliati >= SCARICAMENTI_SBAGLIATI_MAX) {
        this.fermo = true;
        this.avvisi.nota(
          `Gioco online spento: per ${SCARICAMENTI_SBAGLIATI_MAX} volte cloudflared scaricato non era quello atteso e non l’ho avviato. ` +
            'Riaccendi PoorDown per riprovare.',
        );
        return;
      }
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
