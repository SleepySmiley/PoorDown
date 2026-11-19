import { chmodSync, existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  CLOUDFLARED,
  cercaNelPath,
  confrontaVersioni,
  ESTENSIONI_PROGRAMMA,
  FILE_PER_SISTEMA,
  improntaFile,
  improntaProgramma,
  ImprontaSbagliata,
  indirizzoScaricamento,
  scaricaVerificato,
  versioneDa,
} from './tunnel-verifica';

/** SHA-256 di «abc»: il vettore di prova dello standard (FIPS 180-2). */
const IMPRONTA_ABC = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';

const cartelle: string[] = [];

function cartellaTemporanea(): string {
  const cartella = mkdtempSync(path.join(os.tmpdir(), 'poordown-tunnel-'));
  cartelle.push(cartella);
  return cartella;
}

afterEach(() => {
  for (const cartella of cartelle.splice(0)) rmSync(cartella, { recursive: true, force: true });
});

/** Un `fetch` finto: risponde sempre con questi byte (o con questo stato), senza rete. */
function rispondeCon(contenuto: string, stato = 200): typeof fetch {
  return async () => new Response(new TextEncoder().encode(contenuto), { status: stato });
}

describe('versione fissata e impronte', () => {
  it('la versione ha la forma anno.mese.numero', () => {
    expect(CLOUDFLARED.versione).toMatch(/^\d{4}\.\d{1,2}\.\d+$/);
  });

  it('ogni file scaricabile ha la sua impronta SHA-256, e gli archivi anche quella del programma dentro', () => {
    for (const file of new Set(Object.values(FILE_PER_SISTEMA))) {
      const atteso = CLOUDFLARED.file[file];
      expect(atteso, file).toBeDefined();
      expect(atteso?.sha256, file).toMatch(/^[0-9a-f]{64}$/);
      if (file.endsWith('.tgz')) expect(atteso?.programma, file).toMatch(/^[0-9a-f]{64}$/);
      else expect(atteso?.programma, file).toBeUndefined();
    }
  });

  it('la tabella non ha file che nessun sistema scarica', () => {
    const usati = new Set(Object.values(FILE_PER_SISTEMA));
    expect(Object.keys(CLOUDFLARED.file).filter((file) => !usati.has(file))).toEqual([]);
  });

  it('il programma pronto da eseguire: per gli archivi quello estratto, altrimenti il file scaricato', () => {
    expect(improntaProgramma({ sha256: 'a'.repeat(64) })).toBe('a'.repeat(64));
    expect(improntaProgramma({ sha256: 'a'.repeat(64), programma: 'b'.repeat(64) })).toBe('b'.repeat(64));
  });
});

describe('indirizzoScaricamento', () => {
  it('scarica la versione fissata, mai l’ultima pubblicata', () => {
    const indirizzo = indirizzoScaricamento('cloudflared-windows-amd64.exe');
    expect(indirizzo).toBe(
      `https://github.com/cloudflare/cloudflared/releases/download/${CLOUDFLARED.versione}/cloudflared-windows-amd64.exe`,
    );
    expect(indirizzo).not.toContain('latest');
  });
});

describe('versioneDa', () => {
  it('legge la versione da cloudflared --version', () => {
    expect(versioneDa('cloudflared version 2026.11.1 (built 2026-11-17-1500 UTC)')).toBe('2026.11.1');
    expect(versioneDa('2026-11-19T10:00:00Z INF\ncloudflared version 2023.7.3 (built 2023-07-25-1236 UTC)\n')).toBe('2023.7.3');
  });

  it('senza un numero di versione non inventa niente', () => {
    expect(versioneDa('cloudflared version DEV (built unknown)')).toBeNull();
    expect(versioneDa('')).toBeNull();
  });
});

describe('confrontaVersioni', () => {
  it('confronta numero per numero, non lettera per lettera', () => {
    expect(confrontaVersioni('2026.9.0', '2026.11.1')).toBeLessThan(0);
    expect(confrontaVersioni('2026.11.1', '2026.11.1')).toBe(0);
    expect(confrontaVersioni('2026.11.2', '2026.11.1')).toBeGreaterThan(0);
    expect(confrontaVersioni('2027.1.0', '2026.11.1')).toBeGreaterThan(0);
  });

  it('i numeri che mancano valgono zero', () => {
    expect(confrontaVersioni('2026.11', '2026.11.0')).toBe(0);
    expect(confrontaVersioni('2026.11', '2026.11.1')).toBeLessThan(0);
  });
});

describe('improntaFile', () => {
  it('calcola lo SHA-256 del contenuto', async () => {
    const file = path.join(cartellaTemporanea(), 'prova.txt');
    writeFileSync(file, 'abc');
    expect(await improntaFile(file)).toBe(IMPRONTA_ABC);
  });

  it('va bene anche per i file vuoti', async () => {
    const file = path.join(cartellaTemporanea(), 'vuoto');
    writeFileSync(file, '');
    expect(await improntaFile(file)).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
});

describe('scaricaVerificato', () => {
  it('con l’impronta giusta il file prende il suo nome', async () => {
    const cartella = cartellaTemporanea();
    const destinazione = path.join(cartella, 'cloudflared.exe');
    await scaricaVerificato('https://esempio.invalid/cloudflared', destinazione, IMPRONTA_ABC, rispondeCon('abc'));
    expect(await improntaFile(destinazione)).toBe(IMPRONTA_ABC);
    expect(readdirSync(cartella)).toEqual(['cloudflared.exe']);
  });

  it('con l’impronta sbagliata cancella tutto: non resta niente da eseguire', async () => {
    const cartella = cartellaTemporanea();
    const destinazione = path.join(cartella, 'cloudflared.exe');
    await expect(
      scaricaVerificato('https://esempio.invalid/cloudflared', destinazione, IMPRONTA_ABC, rispondeCon('manomesso')),
    ).rejects.toBeInstanceOf(ImprontaSbagliata);
    expect(existsSync(destinazione)).toBe(false);
    expect(readdirSync(cartella)).toEqual([]);
  });

  it('una risposta di errore non lascia file e non è scambiata per un file manomesso', async () => {
    const cartella = cartellaTemporanea();
    const destinazione = path.join(cartella, 'cloudflared.exe');
    const scaricamento = scaricaVerificato('https://esempio.invalid/cloudflared', destinazione, IMPRONTA_ABC, rispondeCon('', 404));
    await expect(scaricamento).rejects.toThrow('HTTP 404');
    await expect(scaricamento).rejects.not.toBeInstanceOf(ImprontaSbagliata);
    expect(readdirSync(cartella)).toEqual([]);
  });
});

describe('cercaNelPath', () => {
  /** Un finto cloudflared, con l'estensione dei programmi di questo sistema. */
  function finto(cartella: string): string {
    const file = path.join(cartella, `cloudflared${ESTENSIONI_PROGRAMMA[0]}`);
    writeFileSync(file, '');
    chmodSync(file, 0o755);
    return file;
  }

  it('trova il programma nella prima cartella del PATH che lo contiene', () => {
    const vuota = cartellaTemporanea();
    const prima = cartellaTemporanea();
    const seconda = cartellaTemporanea();
    const atteso = finto(prima);
    finto(seconda);
    expect(cercaNelPath('cloudflared', [vuota, prima, seconda].join(path.delimiter))).toBe(atteso);
  });

  it('senza il programma nel PATH restituisce null', () => {
    expect(cercaNelPath('cloudflared', [cartellaTemporanea()].join(path.delimiter))).toBeNull();
    expect(cercaNelPath('cloudflared', undefined)).toBeNull();
  });

  it('accetta le cartelle tra virgolette, come a volte nel PATH di Windows', () => {
    const cartella = cartellaTemporanea();
    const atteso = finto(cartella);
    expect(cercaNelPath('cloudflared', `"${cartella}"`)).toBe(atteso);
  });

  it('non guarda mai nella cartella corrente: salta le voci vuote e relative del PATH', () => {
    const guardati: string[] = [];
    const sempre = (file: string) => {
      guardati.push(file);
      return true;
    };
    expect(cercaNelPath('cloudflared', ['', '.', 'bin', `.${path.sep}strumenti`].join(path.delimiter), ['.exe', ''], sempre)).toBeNull();
    expect(guardati).toEqual([]);
  });

  it('prova le estensioni nell’ordine, una cartella alla volta', () => {
    const cartella = cartellaTemporanea();
    const guardati: string[] = [];
    const mai = (file: string) => {
      guardati.push(file);
      return false;
    };
    expect(cercaNelPath('cloudflared', cartella, ['.exe', ''], mai)).toBeNull();
    expect(guardati).toEqual([path.join(cartella, 'cloudflared.exe'), path.join(cartella, 'cloudflared')]);
  });
});
