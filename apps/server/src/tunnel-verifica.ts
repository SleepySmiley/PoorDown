/*
 * La copia di cloudflared che PoorDown scarica per il gioco online: versione fissata, impronte SHA-256 e i controlli
 * da fare prima di eseguirla (li usa tunnel.ts).
 * Un cloudflared scaricato si avvia solo se la sua impronta è quella scritta qui: se dalla rete arrivasse un file diverso
 * (manomesso, rovinato o di un'altra versione) si cancella senza eseguirlo. Mai «latest»: la versione nuova si sceglie
 * a mano, insieme alle sue impronte.
 *
 * Per passare a una versione nuova di cloudflared:
 * 1. leggi il numero della versione su https://github.com/cloudflare/cloudflared/releases (oppure il campo `tag_name`
 *    di https://api.github.com/repos/cloudflare/cloudflared/releases/latest);
 * 2. per ogni file di FILE_PER_SISTEMA copia in `sha256` il campo `digest` dell'asset nell'API (lo calcola GitHub sui
 *    byte pubblicati) e controllalo con l'elenco «SHA256 Checksums» nel testo della release. Attenzione agli archivi
 *    .tgz di macOS: in quell'elenco c'è l'impronta del programma che contengono, che va in `programma`;
 * 3. scarica almeno il file del tuo sistema, senza eseguirlo, e confrontane l'impronta con la tabella
 *    (`certutil -hashfile <file> SHA256` su Windows, `sha256sum <file>` altrove; per un .tgz anche il cloudflared estratto);
 * 4. aggiorna `versione` e le impronte, poi `npm test`.
 * Le copie della versione vecchia già scaricate sui PC si riconoscono dall'impronta e si riscaricano da sole.
 */

import { createHash } from 'node:crypto';
import { accessSync, constants, createReadStream, createWriteStream, renameSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream } from 'node:stream/web';

/** Un file pubblicato da Cloudflare per la versione fissata. */
export interface FileCloudflared {
  /** SHA-256 del file come si scarica (per macOS l'archivio .tgz), in esadecimale minuscolo. */
  sha256: string;
  /** Solo per gli archivi: SHA-256 del cloudflared che contengono, per riconoscere la copia già estratta. */
  programma?: string;
}

export interface VersioneCloudflared {
  /** La versione da scaricare, come la scrive Cloudflare (anno.mese.numero). */
  versione: string;
  /** Le impronte di ogni file di FILE_PER_SISTEMA. */
  file: Readonly<Record<string, FileCloudflared>>;
}

/**
 * cloudflared 2026.11.1, pubblicato il 17 novembre 2026. Impronte dal campo `digest` dell'API di GitHub, uguali a quelle
 * del testo della release; per i .tgz `programma` è quella del testo della release, controllata estraendo gli archivi.
 */
export const CLOUDFLARED: Readonly<VersioneCloudflared> = Object.freeze({
  versione: '2026.11.1',
  file: Object.freeze({
    'cloudflared-windows-amd64.exe': { sha256: '341deda3db5ec498a0482254d6c38c0b7cf01a30c37bb5dd95d2216d08955e35' },
    'cloudflared-windows-386.exe': { sha256: '060868e138e638237e33329315c3e374e0156a2fb18879e571dbc0d506060df3' },
    'cloudflared-linux-amd64': { sha256: '97bb3b02d23a5980fc9c15a1a270e692da1923f103f920d5b16d4931d5ab55e7' },
    'cloudflared-linux-arm64': { sha256: 'b155cec3e48e489cfb8e5c602769fb8c771083018d8881d68b4d18a791567c5a' },
    'cloudflared-linux-arm': { sha256: '0196274a8237660991a27211d7423d1c2fdcb6be56fcae473dd330479d4692fb' },
    'cloudflared-linux-386': { sha256: '757c510745a9884f39e1a99d19c1e18bd5e0012b3368455a958471c71d875530' },
    'cloudflared-darwin-amd64.tgz': {
      sha256: '5e0403b188dfee71fbd9b995e7dc9910d61b661c52371935ab6475d41185632f',
      programma: '52686df40889be19803c368470bd46d5228737462f10a40380bedb6af8ed49a2',
    },
    'cloudflared-darwin-arm64.tgz': {
      sha256: '02fe4bcf08f2c09699cff30658228a739a0c47fb75f3653d1b8772a27ade4462',
      programma: '1cd7041838e5b0943378763ca86ddc0af896d1727875f36b29f5cc35eb2c4df7',
    },
  }),
});

/** Il file di cloudflared per ogni sistema, tra quelli pubblicati da Cloudflare. */
export const FILE_PER_SISTEMA: Readonly<Record<string, string>> = Object.freeze({
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
});

/** Il file da scaricare per questo sistema; `null` se Cloudflare non ne pubblica uno. */
export function fileDaScaricare(sistema: string, architettura: string): string | null {
  return FILE_PER_SISTEMA[`${sistema}-${architettura}`] ?? null;
}

/** Dove si scarica `file` della versione fissata: sempre quella delle impronte, mai «latest». */
export function indirizzoScaricamento(file: string, versione = CLOUDFLARED.versione): string {
  return `https://github.com/cloudflare/cloudflared/releases/download/${versione}/${file}`;
}

/** L'impronta che deve avere il cloudflared pronto da eseguire: per gli archivi, quella del programma che contengono. */
export function improntaProgramma(file: FileCloudflared): string {
  return file.programma ?? file.sha256;
}

/** La versione scritta da `cloudflared --version` («cloudflared version 2026.11.1 (built …)»); `null` se non c'è. */
export function versioneDa(testo: string): string | null {
  return /\bversion\s+v?(\d+(?:\.\d+)+)\b/i.exec(testo)?.[1] ?? null;
}

/**
 * Confronta due versioni a numeri separati da punti (le dà `versioneDa`), numero per numero: negativo se `a` è più
 * vecchia di `b`, zero se sono uguali, positivo se è più nuova. I numeri che mancano valgono zero.
 */
export function confrontaVersioni(a: string, b: string): number {
  const na = a.split('.').map(Number);
  const nb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(na.length, nb.length); i++) {
    const differenza = (na[i] ?? 0) - (nb[i] ?? 0);
    if (differenza !== 0) return Math.sign(differenza);
  }
  return 0;
}

/** SHA-256 del file, in esadecimale minuscolo. Lo legge a pezzi: va bene anche per i 50 MB di cloudflared. */
export async function improntaFile(percorso: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const pezzo of createReadStream(percorso)) hash.update(pezzo as Buffer);
  return hash.digest('hex');
}

function eseguibile(file: string): boolean {
  try {
    if (!statSync(file).isFile()) return false;
    accessSync(file, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/** Su Windows `spawn` senza shell avvia solo gli .exe; altrove il programma non ha estensione. */
export const ESTENSIONI_PROGRAMMA: readonly string[] = process.platform === 'win32' ? ['.exe'] : [''];

/**
 * Il percorso assoluto del programma `nome` nelle cartelle di `percorsi` (il PATH), nell'ordine; `null` se non c'è.
 * Le voci vuote o relative del PATH (come «.») si saltano: un programma lasciato nella cartella corrente non deve passare
 * per quello installato. Per lo stesso motivo la ricerca non si lascia a `spawn`, che su Windows guarda prima lì.
 */
export function cercaNelPath(
  nome: string,
  percorsi: string | undefined,
  estensioni: readonly string[] = ESTENSIONI_PROGRAMMA,
  trovato: (file: string) => boolean = eseguibile,
): string | null {
  for (const voce of (percorsi ?? '').split(path.delimiter)) {
    // Su Windows le cartelle con gli spazi possono stare tra virgolette.
    const cartella = voce.trim().replace(/^"(.*)"$/, '$1');
    if (!cartella || !path.isAbsolute(cartella)) continue;
    for (const estensione of estensioni) {
      const file = path.join(cartella, `${nome}${estensione}`);
      if (trovato(file)) return file;
    }
  }
  return null;
}

/** Il file scaricato non ha l'impronta attesa: è già stato cancellato, senza eseguirlo. */
export class ImprontaSbagliata extends Error {}

/** Quanto si aspetta lo scaricamento di cloudflared (circa 50 MB) prima di rinunciare. */
const SCARICAMENTO_MAX_MS = 10 * 60_000;

/**
 * Scarica `indirizzo` in `destinazione` passando da un file parziale, che prende il suo nome solo se la sua impronta
 * SHA-256 è `attesa`. Altrimenti il parziale si cancella e la funzione lancia `ImprontaSbagliata`: nessuno l'ha mai
 * eseguito. `richiedi` è `fetch` (finto nei test).
 */
export async function scaricaVerificato(
  indirizzo: string,
  destinazione: string,
  attesa: string,
  richiedi: typeof fetch = fetch,
): Promise<void> {
  const risposta = await richiedi(indirizzo, { signal: AbortSignal.timeout(SCARICAMENTO_MAX_MS) });
  if (!risposta.ok || !risposta.body) throw new Error(`lo scaricamento di cloudflared non è riuscito (HTTP ${risposta.status})`);
  const parziale = `${destinazione}.parziale`;
  try {
    await pipeline(Readable.fromWeb(risposta.body as ReadableStream<Uint8Array>), createWriteStream(parziale));
    if ((await improntaFile(parziale)) !== attesa) {
      throw new ImprontaSbagliata('cloudflared scaricato non è quello atteso, l’impronta SHA-256 non coincide: l’ho cancellato senza avviarlo');
    }
    renameSync(parziale, destinazione);
  } finally {
    rmSync(parziale, { force: true });
  }
}
