/*
 * I giocatori silenziati in chat: i loro messaggi non si vedono più in questo browser.
 * Vale per una stanza e resta anche ricaricando la pagina (localStorage, con il profilo di prova se c'è).
 */

import { useSyncExternalStore } from 'react';
import type { IdGiocatore } from '@poordown/engine';

const profilo = new URLSearchParams(location.search).get('profilo') ?? '';
const ascoltatori = new Set<() => void>();
const letti = new Map<string, readonly IdGiocatore[]>();
const NESSUNO: readonly IdGiocatore[] = [];

function chiave(codice: string): string {
  return profilo ? `poordown:silenziati:${profilo}:${codice}` : `poordown:silenziati:${codice}`;
}

function leggi(codice: string): readonly IdGiocatore[] {
  const gia = letti.get(codice);
  if (gia) return gia;
  let lista: readonly IdGiocatore[] = NESSUNO;
  try {
    const valore: unknown = JSON.parse(localStorage.getItem(chiave(codice)) ?? '[]');
    if (Array.isArray(valore)) lista = valore.filter((x): x is string => typeof x === 'string');
  } catch {
    // Archivio bloccato o rovinato: nessuno silenziato.
  }
  letti.set(codice, lista);
  return lista;
}

/** Silenzia o riattiva un giocatore in chat. */
export function silenzia(codice: string, id: IdGiocatore, muto: boolean): void {
  const prima = leggi(codice);
  const lista = muto ? [...new Set([...prima, id])] : prima.filter((x) => x !== id);
  letti.set(codice, lista);
  try {
    localStorage.setItem(chiave(codice), JSON.stringify(lista));
  } catch {
    // Vale solo per questa visita.
  }
  for (const fn of ascoltatori) fn();
}

/** I giocatori silenziati in questa stanza; il componente si aggiorna quando cambiano. */
export function useSilenziati(codice: string): readonly IdGiocatore[] {
  return useSyncExternalStore(
    (fn) => {
      ascoltatori.add(fn);
      return () => ascoltatori.delete(fn);
    },
    () => leggi(codice),
  );
}
