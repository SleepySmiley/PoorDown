/*
 * Il collegamento con il server e le preferenze di questo browser (nome, colore), condivisi da tutte le pagine.
 * Con ?profilo=nome nell'indirizzo si ha un'identità diversa nello stesso browser: serve per provare
 * una partita da due schede.
 */

import { useEffect, useState, useSyncExternalStore } from 'react';
import { ASSENZA_MS, COLORI, type InfoServer } from '@poordown/engine';
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

/*
 * Il posto lasciato in una partita in corso. Uscendo dalla stanza il posto resta: i turni passano da soli e,
 * dopo due minuti senza nessuna scheda aperta (ASSENZA_MS), si perde. Se intanto nessun'altra persona in gioco
 * è collegata la partita si ferma e il posto aspetta. Intanto la home offre di rientrare.
 * Vale per la scheda (sessionStorage), come gli ingressi.
 */
export interface PostoTenuto {
  codice: string;
  /** Fin quando resta il posto (orologio di questo browser); `null` se la partita si è fermata ad aspettare. */
  fino: number | null;
}

const POSTO = chiave('posto');

function leggiPosto(): PostoTenuto | null {
  try {
    const dati: unknown = JSON.parse(sessionStorage.getItem(POSTO) ?? 'null');
    if (typeof dati !== 'object' || dati === null) return null;
    const { codice, fino } = dati as Record<string, unknown>;
    return typeof codice === 'string' && (fino === null || typeof fino === 'number') ? { codice, fino } : null;
  } catch {
    return null;
  }
}

let posto = leggiPosto();
const ascoltatoriPosto = new Set<() => void>();

function cambiaPosto(nuovo: PostoTenuto | null): void {
  posto = nuovo;
  try {
    if (nuovo) sessionStorage.setItem(POSTO, JSON.stringify(nuovo));
    else sessionStorage.removeItem(POSTO);
  } catch {
    // niente: vale finché la pagina resta aperta
  }
  for (const fn of ascoltatoriPosto) fn();
}

/** Il mio posto nella stanza seguita, se uscendo adesso resterebbe tenuto. */
function postoDaTenere(codice: string): PostoTenuto | null {
  const { stanza, io } = collegamento.leggi();
  const partita = stanza?.partita;
  if (!stanza || stanza.codice !== codice || !io || stanza.fase !== 'partita' || partita?.fase !== 'in_corso') return null;
  const me = partita.giocatori.find((g) => g.id === io);
  if (!me || me.eliminato) return null;
  const persone = new Set(stanza.partecipanti.filter((p) => !p.bot && p.connesso).map((p) => p.id));
  const altri = partita.giocatori.some((g) => g.id !== io && !g.eliminato && persone.has(g.id));
  if (!altri) return { codice, fino: null };
  const adesso = collegamento.orologio();
  return { codice, fino: Date.now() + (me.offlineDa ?? adesso) + ASSENZA_MS - adesso };
}

export const postoTenuto = {
  /** Da chiamare uscendo dalla stanza `codice`, prima di smettere di seguirla. */
  ricorda(codice: string): void {
    const nuovo = postoDaTenere(codice);
    if (nuovo) cambiaPosto(nuovo);
    else if (posto?.codice === codice) cambiaPosto(null);
  },
  /** Rientrando nella stanza il ricordo non serve più. */
  dimentica(codice: string): void {
    if (posto?.codice === codice) cambiaPosto(null);
  },
  /**
   * Chiede al server se questo browser tiene ancora un posto in una partita in corso: dopo una scheda chiusa
   * il ricordo della scheda non c'è più, ma il posto (legato al token del browser) sì.
   */
  async cerca(): Promise<void> {
    if (posto) return;
    const r = await collegamento.comando('posto_tenuto', {});
    if (!r.ok || !r.dati || posto) return;
    const { codice, resta } = r.dati;
    cambiaPosto({ codice, fino: resta === null ? null : Date.now() + resta });
  },
  leggi(): PostoTenuto | null {
    return posto;
  },
  ascolta(fn: () => void): () => void {
    ascoltatoriPosto.add(fn);
    return () => ascoltatoriPosto.delete(fn);
  },
};

/** Il posto tenuto, per un componente React: si aggiorna quando cambia. */
export function usePostoTenuto(): PostoTenuto | null {
  return useSyncExternalStore(
    (fn) => postoTenuto.ascolta(fn),
    () => postoTenuto.leggi(),
  );
}

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
