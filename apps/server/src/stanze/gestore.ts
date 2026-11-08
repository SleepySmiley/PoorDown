/* Tutte le stanze del server: creazione con codice, ricerca, elenco pubblico, "Gioca", pulizia. */

import {
  IMPOSTAZIONI_PREDEFINITE,
  LUNGHEZZA_CODICE,
  type StanzaInElenco,
} from '@poordown/engine';
import type { Ambiente } from './ambiente';
import { Stanza, type DatiStanza } from './stanza';

/** Niente 0/o, 1/l/i: il codice si detta a voce senza equivoci. */
const ALFABETO = 'abcdefghjkmnpqrstuvwxyz23456789';
/** Limite di sicurezza: tra amici non si arriva mai a tanto. */
export const STANZE_MAX = 200;
/** Una stanza senza nessuno collegato per questo tempo viene chiusa. */
export const SCADENZA_STANZA_MS = 30 * 60_000;

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

  /** Stanze pubbliche non finite: prima quelle in attesa, e tra queste le più piene. */
  elenco(): StanzaInElenco[] {
    return this.tutte()
      .filter((s) => !s.impostazioni.stanzaPrivata && s.fase !== 'finita')
      .sort((a, b) => Number(a.fase !== 'lobby') - Number(b.fase !== 'lobby') || b.posti.length - a.posti.length)
      .map((s) => ({
        codice: s.codice,
        fase: s.fase,
        giocatori: s.posti.map(({ nome, colore }) => ({ nome, colore })),
        giocatoriMax: s.impostazioni.giocatoriMax,
        mappa: s.impostazioni.mappa,
        impostazioni: { ...s.impostazioni },
      }));
  }

  /** "Gioca": la stanza pubblica in attesa più piena con un posto libero, oppure una nuova stanza pubblica. */
  gioca(): Stanza | null {
    const libera = this.tutte()
      .filter((s) => !s.impostazioni.stanzaPrivata && s.fase === 'lobby' && s.posti.length < s.impostazioni.giocatoriMax)
      .sort((a, b) => b.posti.length - a.posti.length)[0];
    return libera ?? this.crea(false);
  }

  /**
   * Toglie dalle lobby chi è sparito e chiude le stanze abbandonate.
   * Restituisce le stanze ancora aperte (da aggiornare se sono cambiate) e quelle chiuse.
   */
  manutenzione(): { aperte: Stanza[]; chiuse: Stanza[] } {
    const adesso = this.amb.adesso();
    const aperte: Stanza[] = [];
    const chiuse: Stanza[] = [];
    for (const stanza of this.stanze.values()) {
      if (stanza.nessunoCollegato() && adesso - stanza.ultimaPresenza >= SCADENZA_STANZA_MS) {
        this.stanze.delete(stanza.codice);
        chiuse.push(stanza);
      } else {
        stanza.manutenzione();
        aperte.push(stanza);
      }
    }
    return { aperte, chiuse };
  }

  esporta(): DatiStanza[] {
    return this.tutte().map((s) => s.esporta());
  }

  importa(dati: readonly DatiStanza[]): void {
    for (const d of dati) this.stanze.set(d.codice, Stanza.importa(d, this.amb));
  }

  private codiceLibero(): string {
    for (;;) {
      let codice = '';
      for (let i = 0; i < LUNGHEZZA_CODICE; i++) codice += ALFABETO[this.amb.caso.intero(ALFABETO.length)];
      if (!this.stanze.has(codice)) return codice;
    }
  }
}
