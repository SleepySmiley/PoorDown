/*
 * Accesso al pannello di controllo: nome e password scelti da chi gestisce il server con `npm run pannello`.
 * - Il file delle credenziali sta nella cartella dei dati di PoorDown su questo PC (mai nel progetto, che finisce su
 *   GitHub) e non contiene né il nome né la password: solo un'impronta scrypt dei due insieme, con il suo sale.
 * - Il file si rilegge a ogni tentativo: le credenziali nuove valgono subito, anche con il server acceso.
 * - Troppi tentativi sbagliati bloccano l'accesso per un po' (per chi li fa e, oltre un limite, per tutti).
 * - Chi entra riceve una sessione casuale che vale qualche ora; si perde quando il server si spegne.
 */

import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { cartellaPredefinita } from '../stanze/archivio';

/** Costo di scrypt: circa un decimo di secondo e 32 MB per tentativo. */
const PARAMETRI = { N: 2 ** 15, r: 8, p: 1 } as const;
const LUNGHEZZA_IMPRONTA = 64;

/** Tentativi sbagliati da uno stesso indirizzo, dentro la finestra, prima del blocco. */
export const TENTATIVI_MAX = 5;
/** Tentativi sbagliati da tutti insieme prima di bloccare l'accesso a chiunque. */
export const TENTATIVI_TOTALI_MAX = 20;
export const FINESTRA_MS = 15 * 60_000;
export const BLOCCO_MS = 15 * 60_000;
/** Quanto vale una sessione. */
export const SESSIONE_MS = 12 * 60 * 60_000;
const SESSIONI_MAX = 20;
/** Verifiche scrypt contemporanee: oltre si risponde «riprova», per non intasare il server. */
const VERIFICHE_INSIEME_MAX = 2;
export const PASSWORD_MIN = 8;

export interface Credenziali {
  formato: 1;
  /** Sale casuale, in base64. */
  sale: string;
  /** scrypt(nome + "\n" + password), in base64. */
  impronta: string;
  parametri: { N: number; r: number; p: number };
  createIl: string;
}

/** Il file delle credenziali: nella cartella dei dati di questo PC, o dove dice POORDOWN_PANNELLO. */
export function fileCredenziali(): string {
  return process.env.POORDOWN_PANNELLO ? path.resolve(process.env.POORDOWN_PANNELLO) : path.join(cartellaPredefinita(), 'pannello.json');
}

function calcola(nome: string, password: string, sale: Buffer, parametri: Credenziali['parametri']): Promise<Buffer> {
  // maxmem: scrypt usa 128 * N * r byte; il limite predefinito (32 MB) è troppo stretto per N = 2^15.
  const opzioni: ScryptOptions = { ...parametri, maxmem: 256 * parametri.N * parametri.r };
  return new Promise((risolvi, rifiuta) => {
    scrypt(`${nome}\n${password}`, sale, LUNGHEZZA_IMPRONTA, opzioni, (errore, chiave) => (errore ? rifiuta(errore) : risolvi(chiave)));
  });
}

/** Il nome si confronta senza gli spazi ai lati; la password così com'è. */
export function normalizzaNome(nome: string): string {
  return nome.normalize('NFC').trim();
}

export async function creaCredenziali(nome: string, password: string): Promise<Credenziali> {
  const sale = randomBytes(16);
  const impronta = await calcola(normalizzaNome(nome), password, sale, PARAMETRI);
  return {
    formato: 1,
    sale: sale.toString('base64'),
    impronta: impronta.toString('base64'),
    parametri: { ...PARAMETRI },
    createIl: new Date().toISOString(),
  };
}

export async function credenzialiGiuste(c: Credenziali, nome: string, password: string): Promise<boolean> {
  const attesa = Buffer.from(c.impronta, 'base64');
  const calcolata = await calcola(normalizzaNome(nome), password, Buffer.from(c.sale, 'base64'), c.parametri);
  return attesa.length === calcolata.length && timingSafeEqual(attesa, calcolata);
}

function credenzialiValide(x: unknown): x is Credenziali {
  if (typeof x !== 'object' || x === null) return false;
  const c = x as Record<string, unknown>;
  const p = c.parametri as Record<string, unknown> | undefined;
  return (
    c.formato === 1 &&
    typeof c.sale === 'string' &&
    typeof c.impronta === 'string' &&
    typeof p === 'object' &&
    p !== null &&
    [p.N, p.r, p.p].every((v) => typeof v === 'number' && Number.isInteger(v) && v > 0) &&
    (p.N as number) <= 2 ** 20 &&
    (p.r as number) <= 16 &&
    (p.p as number) <= 4
  );
}

/** Le credenziali salvate; `null` se il pannello non è stato impostato (o il file è rovinato: lo dice nel registro). */
export function leggiCredenziali(file = fileCredenziali()): Credenziali | null {
  let testo: string;
  try {
    testo = readFileSync(file, 'utf8');
  } catch {
    return null;
  }
  try {
    const dati: unknown = JSON.parse(testo);
    if (credenzialiValide(dati)) return dati;
  } catch {
    // Sotto: lo stesso avviso del file con la forma sbagliata.
  }
  console.warn(`  Pannello: il file ${file} è rovinato. Rifai l'accesso con "npm run pannello".`);
  return null;
}

export function scriviCredenziali(c: Credenziali, file = fileCredenziali()): void {
  mkdirSync(path.dirname(file), { recursive: true });
  const temporaneo = `${file}.tmp`;
  writeFileSync(temporaneo, `${JSON.stringify(c, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporaneo, file);
}

export function togliCredenziali(file = fileCredenziali()): void {
  rmSync(file, { force: true });
}

export type EsitoAccesso =
  | { ok: true; sessione: string }
  | { ok: false; motivo: 'spento' | 'sbagliate' | 'occupato' }
  | { ok: false; motivo: 'bloccato'; attesaMs: number };

/** Tentativi, blocchi e sessioni del pannello. `adesso` è finto nei test. */
export class Accessi {
  private readonly sbagliati = new Map<string, number[]>();
  private tuttiSbagliati: number[] = [];
  private bloccatiFinoA = new Map<string, number>();
  private tuttiBloccatiFinoA = 0;
  private readonly sessioni = new Map<string, number>();
  private verifiche = 0;

  constructor(
    private readonly file = fileCredenziali(),
    private readonly adesso: () => number = Date.now,
  ) {}

  /** Il pannello è stato impostato su questo PC. */
  attivo(): boolean {
    return leggiCredenziali(this.file) !== null;
  }

  /** `chi`: l'indirizzo da cui arriva il tentativo. */
  async entra(nome: string, password: string, chi: string): Promise<EsitoAccesso> {
    const ora = this.adesso();
    const blocco = Math.max(this.bloccatiFinoA.get(chi) ?? 0, this.tuttiBloccatiFinoA);
    if (blocco > ora) return { ok: false, motivo: 'bloccato', attesaMs: blocco - ora };
    const credenziali = leggiCredenziali(this.file);
    if (!credenziali) return { ok: false, motivo: 'spento' };
    if (this.verifiche >= VERIFICHE_INSIEME_MAX) return { ok: false, motivo: 'occupato' };

    this.verifiche++;
    let giuste: boolean;
    try {
      giuste = await credenzialiGiuste(credenziali, nome, password);
    } finally {
      this.verifiche--;
    }
    if (!giuste) {
      this.segnaSbagliato(chi);
      return { ok: false, motivo: 'sbagliate' };
    }
    this.sbagliati.delete(chi);
    return { ok: true, sessione: this.nuovaSessione() };
  }

  /** La sessione esiste e non è scaduta. */
  valida(sessione: string | undefined): boolean {
    if (!sessione) return false;
    const scadenza = this.sessioni.get(sessione);
    if (scadenza === undefined) return false;
    if (scadenza <= this.adesso()) {
      this.sessioni.delete(sessione);
      return false;
    }
    return true;
  }

  esci(sessione: string | undefined): void {
    if (sessione) this.sessioni.delete(sessione);
  }

  /** Chiude tutte le sessioni (per esempio quando cambiano le credenziali). */
  esciTutti(): void {
    this.sessioni.clear();
  }

  private nuovaSessione(): string {
    const sessione = randomBytes(32).toString('base64url');
    this.sessioni.set(sessione, this.adesso() + SESSIONE_MS);
    // Le più vecchie escono per prime (la Map tiene l'ordine di inserimento).
    while (this.sessioni.size > SESSIONI_MAX) this.sessioni.delete(this.sessioni.keys().next().value!);
    return sessione;
  }

  private segnaSbagliato(chi: string): void {
    const ora = this.adesso();
    const recenti = (this.sbagliati.get(chi) ?? []).filter((t) => ora - t < FINESTRA_MS);
    recenti.push(ora);
    this.sbagliati.set(chi, recenti);
    this.tuttiSbagliati = this.tuttiSbagliati.filter((t) => ora - t < FINESTRA_MS);
    this.tuttiSbagliati.push(ora);
    if (recenti.length >= TENTATIVI_MAX) {
      this.bloccatiFinoA.set(chi, ora + BLOCCO_MS);
      this.sbagliati.delete(chi);
    }
    if (this.tuttiSbagliati.length >= TENTATIVI_TOTALI_MAX) {
      this.tuttiBloccatiFinoA = ora + BLOCCO_MS;
      this.tuttiSbagliati = [];
    }
    // Pulizia: i blocchi scaduti non servono più.
    for (const [chiave, fine] of this.bloccatiFinoA) if (fine <= ora) this.bloccatiFinoA.delete(chiave);
  }
}
