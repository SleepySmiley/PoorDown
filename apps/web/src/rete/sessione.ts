/*
 * Il collegamento con il server e le preferenze di questo browser (nome, colore), condivisi da tutte le pagine.
 * Con ?profilo=nome nell'indirizzo si ha un'identità diversa nello stesso browser: serve per provare
 * una partita da due schede.
 */

import { useSyncExternalStore } from 'react';
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

/** Ogni quanto si richiedono le informazioni mentre il link online è in preparazione. */
const ATTESA_LINK_ONLINE_MS = 3_000;
/** Ogni quanto si ricontrolla il link online quando c'è: dopo una caduta il tunnel ne ha uno nuovo. */
const CONTROLLO_LINK_ONLINE_MS = 30_000;

/**
 * Nome, versione e indirizzi del server. Si chiedono quando una pagina comincia a usarli e quando si torna sulla
 * scheda; con il gioco online anche ogni tanto (ogni pochi secondi mentre il link è in preparazione).
 */
const infoServer = (() => {
  let dati: InfoServer | null = null;
  let inCorso = false;
  let attesa: ReturnType<typeof setTimeout> | undefined;
  const ascoltatori = new Set<() => void>();

  function chiedi(): void {
    if (inCorso) return;
    inCorso = true;
    clearTimeout(attesa);
    void fetch('/api/info')
      .then((r) => (r.ok ? (r.json() as Promise<InfoServer>) : null))
      .catch(() => null)
      .then((nuovi) => {
        inCorso = false;
        // Se non è cambiato niente le pagine non si ridisegnano.
        if (nuovi && JSON.stringify(nuovi) !== JSON.stringify(dati)) {
          dati = nuovi;
          for (const fn of ascoltatori) fn();
        }
        if (dati?.online && ascoltatori.size > 0) {
          attesa = setTimeout(chiedi, dati.pubblico ? CONTROLLO_LINK_ONLINE_MS : ATTESA_LINK_ONLINE_MS);
        }
      });
  }

  return {
    leggi: () => dati,
    ascolta(fn: () => void): () => void {
      ascoltatori.add(fn);
      if (ascoltatori.size === 1) {
        chiedi();
        window.addEventListener('focus', chiedi);
      }
      return () => {
        ascoltatori.delete(fn);
        if (ascoltatori.size > 0) return;
        window.removeEventListener('focus', chiedi);
        clearTimeout(attesa);
      };
    },
  };
})();

export function useInfoServer(): InfoServer | null {
  return useSyncExternalStore(
    (fn) => infoServer.ascolta(fn),
    () => infoServer.leggi(),
  );
}

/**
 * Il link da dare agli amici: quello online se c'è, perché funziona da qualunque posto; altrimenti, se questo PC
 * apre il gioco come "localhost", l'indirizzo della rete di casa.
 */
export function linkStanza(codice: string, info: InfoServer | null): string {
  if (info?.pubblico) return `${info.pubblico}/stanza/${codice}`;
  const locale = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const origine = locale && info?.indirizzi[0] ? info.indirizzi[0] : location.origin;
  return `${origine}/stanza/${codice}`;
}
