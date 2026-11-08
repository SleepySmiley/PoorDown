/*
 * Il collegamento con il server e le preferenze di questo browser (nome, colore), condivisi da tutte le pagine.
 * Con ?profilo=nome nell'indirizzo si ha un'identità diversa nello stesso browser: serve per provare
 * una partita da due schede.
 */

import { useEffect, useState } from 'react';
import { COLORI, type InfoServer } from '@poordown/engine';
import { apriCollegamento } from './collegamento';
import { tokenDelBrowser } from './token';

const profilo = new URLSearchParams(location.search).get('profilo') ?? '';

export const collegamento = apriCollegamento(tokenDelBrowser(profilo));

function chiave(nome: string): string {
  return profilo ? `poordown:${nome}:${profilo}` : `poordown:${nome}`;
}

function leggi(nome: string): string | null {
  try {
    return localStorage.getItem(chiave(nome));
  } catch {
    return null;
  }
}

function scrivi(nome: string, valore: string): void {
  try {
    localStorage.setItem(chiave(nome), valore);
  } catch {
    // Archivio bloccato: la preferenza vale solo per questa visita.
  }
}

export const preferenze = {
  nome: (): string => leggi('nome') ?? '',
  salvaNome: (nome: string): void => scrivi('nome', nome),
  /** L'ultimo colore scelto, se valido. */
  colore: (): number | null => {
    const n = Number(leggi('colore'));
    return Number.isInteger(n) && n >= 1 && n <= COLORI ? n : null;
  },
  salvaColore: (colore: number): void => scrivi('colore', String(colore)),
};

/*
 * Le stanze in cui questa scheda è già entrata: ricaricando si torna dentro senza ripassare
 * dalla pagina di ingresso. Vale solo per la scheda (sessionStorage), come richiesto per un nuovo link.
 */
const DENTRO = chiave('dentro');

export const ingressi = {
  segna(codice: string): void {
    try {
      sessionStorage.setItem(DENTRO, codice);
    } catch {
      // niente
    }
  },
  dimentica(): void {
    try {
      sessionStorage.removeItem(DENTRO);
    } catch {
      // niente
    }
  },
  dentro(codice: string): boolean {
    try {
      return sessionStorage.getItem(DENTRO) === codice;
    } catch {
      return false;
    }
  },
};

let info: Promise<InfoServer | null> | null = null;

/** Nome, versione e indirizzi di rete del server (chiesti una volta sola). */
export function useInfoServer(): InfoServer | null {
  const [dati, setDati] = useState<InfoServer | null>(null);
  useEffect(() => {
    info ??= fetch('/api/info')
      .then((r) => (r.ok ? (r.json() as Promise<InfoServer>) : null))
      .catch(() => null);
    let attivo = true;
    void info.then((d) => {
      if (attivo) setDati(d);
    });
    return () => {
      attivo = false;
    };
  }, []);
  return dati;
}

/** Il link da dare agli amici: se questo PC apre il gioco come "localhost", si usa l'indirizzo di rete. */
export function linkStanza(codice: string, infoServer: InfoServer | null): string {
  const locale = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const origine = locale && infoServer?.indirizzi[0] ? infoServer.indirizzi[0] : location.origin;
  return `${origine}/stanza/${codice}`;
}
