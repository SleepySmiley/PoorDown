/*
 * Salvataggio delle stanze su file JSON, così una partita sopravvive al riavvio del server.
 * Il file sta fuori dalla cartella del progetto (che può essere sincronizzata da OneDrive o simili):
 * su Windows in %LOCALAPPDATA%\PoorDown, altrove in ~/.poordown. Si può cambiare con POORDOWN_DATI.
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import type { GestoreStanze } from './gestore';
import type { DatiStanza } from './stanza';

/** Da cambiare quando cambia la forma dello stato salvato: i file vecchi vengono ignorati. */
const FORMATO = 1;
/** Le modifiche ravvicinate finiscono in un solo salvataggio. */
const RITARDO_MS = 1_000;

interface FileStanze {
  formato: number;
  salvatoIl: string;
  stanze: DatiStanza[];
}

export function cartellaDati(): string {
  if (process.env.POORDOWN_DATI) return path.resolve(process.env.POORDOWN_DATI);
  if (process.platform === 'win32' && process.env.LOCALAPPDATA) return path.join(process.env.LOCALAPPDATA, 'PoorDown');
  return path.join(homedir(), '.poordown');
}

export class Archivio {
  private timer: NodeJS.Timeout | null = null;
  private avvisato = false;

  constructor(
    readonly file: string,
    private readonly gestore: GestoreStanze,
  ) {}

  /** Carica le stanze salvate. Restituisce quante sono. Un file mancante o illeggibile vale come vuoto. */
  carica(): number {
    let contenuto: string;
    try {
      contenuto = readFileSync(this.file, 'utf8');
    } catch {
      return 0;
    }
    try {
      const dati = JSON.parse(contenuto) as FileStanze;
      if (dati.formato !== FORMATO || !Array.isArray(dati.stanze)) return 0;
      this.gestore.importa(dati.stanze);
      return dati.stanze.length;
    } catch (errore) {
      console.warn(`  Non riesco a leggere le stanze salvate (${this.file}): riparto senza.`, errore);
      return 0;
    }
  }

  /** Salva tra poco, raccogliendo le modifiche ravvicinate. */
  programma(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.salvaOra();
    }, RITARDO_MS);
    this.timer.unref();
  }

  /** Scrive subito il file: prima uno temporaneo, poi lo sostituisce, così non resta mai a metà. */
  salvaOra(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const dati: FileStanze = { formato: FORMATO, salvatoIl: new Date().toISOString(), stanze: this.gestore.esporta() };
    const temporaneo = `${this.file}.tmp`;
    try {
      mkdirSync(path.dirname(this.file), { recursive: true });
      writeFileSync(temporaneo, JSON.stringify(dati));
      renameSync(temporaneo, this.file);
      this.avvisato = false;
    } catch (errore) {
      if (!this.avvisato) console.warn(`  Non riesco a salvare le stanze in ${this.file}:`, errore);
      this.avvisato = true;
    }
  }
}
