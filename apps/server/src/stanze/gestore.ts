/* Tutte le stanze del server: creazione con codice, ricerca, elenco pubblico, "Gioca", pulizia. */

import {
  IMPOSTAZIONI_PREDEFINITE,
  LUNGHEZZA_CODICE,
  type PostoInPartita,
  type StanzaInElenco,
  type StanzaNelPannello,
} from '@poordown/engine';
import type { Ambiente } from './ambiente';
import { Stanza, type DatiStanza, type Token } from './stanza';

/** Niente 0/o, 1/l/i: il codice si detta a voce senza equivoci. */
const ALFABETO = 'abcdefghjkmnpqrstuvwxyz23456789';
/** Limite di sicurezza: tra amici non si arriva mai a tanto. */
export const STANZE_MAX = 200;
/** Una stanza senza nessuno collegato per questo tempo viene chiusa. */
export const SCADENZA_STANZA_MS = 30 * 60_000;
/** Prima, se non c'è nemmeno una persona seduta (stanze create e mai usate, lobby abbandonate). */
export const SCADENZA_STANZA_VUOTA_MS = 5 * 60_000;

/** "K7Q2M " → "k7q2m". `null` se non ha la forma di un codice. */
export function normalizzaCodice(testo: string): string | null {
  const codice = testo.trim().toLowerCase();
  return new RegExp(`^[a-z0-9]{${LUNGHEZZA_CODICE}}$`).test(codice) ? codice : null;
}

export class GestoreStanze {
  private readonly stanze = new Map<string, Stanza>();

  constructor(private readonly amb: Ambiente) {}

  get numero(): number {
    return this.stanze.size;
  }

  tutte(): Stanza[] {
    return [...this.stanze.values()];
  }

  /** L'orologio delle stanze (quello vero sul server, finto nei test). */
  adesso(): number {
    return this.amb.adesso();
  }

  /** `null` se il server ha già troppe stanze. */
  crea(privata: boolean): Stanza | null {
    if (this.stanze.size >= STANZE_MAX) return null;
    const stanza = new Stanza(this.codiceLibero(), this.amb, { ...IMPOSTAZIONI_PREDEFINITE, stanzaPrivata: privata });
    this.stanze.set(stanza.codice, stanza);
    return stanza;
  }

  trova(codice: string): Stanza | undefined {
    const normale = normalizzaCodice(codice);
    return normale ? this.stanze.get(normale) : undefined;
  }

  /** Il posto di `token` in una partita in corso, se lo tiene ancora (vedi `Stanza.postoTenuto`). */
  postoTenuto(token: Token): PostoInPartita | null {
    for (const stanza of this.stanze.values()) {
      const posto = stanza.postoTenuto(token);
      if (posto) return posto;
    }
    return null;
  }

  /** Stanze pubbliche non finite con almeno una persona seduta: prima quelle in attesa, e tra queste le più piene. */
  elenco(): StanzaInElenco[] {
    return this.tutte()
      .filter((s) => !s.impostazioni.stanzaPrivata && s.fase !== 'finita' && !s.senzaPersone())
      .sort((a, b) => Number(a.fase !== 'lobby') - Number(b.fase !== 'lobby') || b.posti.length - a.posti.length)
      .map((s) => ({
        codice: s.codice,
        fase: s.fase,
        giocatori: s.posti.map(({ nome, colore, bot }) => ({ nome, colore, bot })),
        giocatoriMax: s.impostazioni.giocatoriMax,
        mappa: s.impostazioni.mappa,
        impostazioni: { ...s.impostazioni },
      }));
  }

  /**
   * "Gioca": una stanza pubblica in attesa con un posto libero, o con un bot che lascia il posto a chi arriva;
   * prima quelle con più persone, poi le più piene. Se non ce ne sono, una nuova stanza pubblica.
   */
  gioca(): Stanza | null {
    const persone = (s: Stanza) => s.posti.filter((p) => !p.bot).length;
    const libera = this.tutte()
      .filter(
        (s) =>
          !s.impostazioni.stanzaPrivata &&
          s.fase === 'lobby' &&
          (s.posti.length < s.impostazioni.giocatoriMax || s.posti.some((p) => p.bot)),
      )
      .sort((a, b) => persone(b) - persone(a) || b.posti.length - a.posti.length)[0];
    return libera ?? this.crea(false);
  }

  /**
   * Toglie dalle lobby chi è sparito e chiude le stanze abbandonate: senza nessuno collegato da 30 minuti, o da
   * 5 minuti se non c'è nemmeno una persona seduta. Restituisce le stanze ancora aperte (da aggiornare se sono
   * cambiate) e quelle chiuse. Un errore in una stanza non ferma le altre.
   */
  manutenzione(): { aperte: Stanza[]; chiuse: Stanza[] } {
    const adesso = this.amb.adesso();
    const aperte: Stanza[] = [];
    const chiuse: Stanza[] = [];
    for (const stanza of this.stanze.values()) {
      const scadenza = stanza.senzaPersone() ? SCADENZA_STANZA_VUOTA_MS : SCADENZA_STANZA_MS;
      if (stanza.nessunoCollegato() && adesso - stanza.ultimaPresenza >= scadenza) {
        this.stanze.delete(stanza.codice);
        chiuse.push(stanza);
        continue;
      }
      try {
        stanza.manutenzione();
      } catch (errore) {
        console.error(`  Errore nella manutenzione della stanza ${stanza.codice}:`, errore);
      }
      aperte.push(stanza);
    }
    return { aperte, chiuse };
  }

  /** Chiude subito la stanza (dal pannello). Restituisce la stanza chiusa, se c'era. */
  chiudi(codice: string): Stanza | undefined {
    const stanza = this.trova(codice);
    if (stanza) this.stanze.delete(stanza.codice);
    return stanza;
  }

  /** Tutte le stanze per il pannello: prima le partite in corso, poi le lobby, poi quelle finite. */
  elencoPannello(): StanzaNelPannello[] {
    const ordine = { partita: 0, lobby: 1, finita: 2 } as const;
    return this.tutte()
      .sort((a, b) => ordine[a.fase] - ordine[b.fase] || a.codice.localeCompare(b.codice))
      .map((s) => s.vocePannello());
  }

  esporta(): DatiStanza[] {
    return this.tutte().map((s) => s.esporta());
  }

  /**
   * Riprende le stanze salvate. Quelle rovinate (dati che non hanno la forma di una stanza) si saltano con un avviso,
   * senza fermare le altre. Restituisce quante stanze sono state riprese e quante scartate.
   */
  importa(dati: readonly DatiStanza[]): { riprese: number; scartate: number } {
    let riprese = 0;
    let scartate = 0;
    for (const d of dati) {
      try {
        const stanza = Stanza.importa(d, this.amb);
        this.stanze.set(stanza.codice, stanza);
        riprese++;
      } catch (errore) {
        scartate++;
        const codice = typeof d === 'object' && d !== null && typeof d.codice === 'string' ? d.codice : '?';
        console.warn(`  Salto la stanza salvata ${codice}: ${errore instanceof Error ? errore.message : String(errore)}`);
      }
    }
    return { riprese, scartate };
  }

  private codiceLibero(): string {
    for (;;) {
      let codice = '';
      for (let i = 0; i < LUNGHEZZA_CODICE; i++) codice += ALFABETO[this.amb.caso.intero(ALFABETO.length)];
      if (!this.stanze.has(codice)) return codice;
    }
  }
}
