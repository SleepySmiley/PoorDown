/*
 * Nelle partite a squadre le proprietà si colorano con il colore della squadra di chi le possiede (ui/squadre.ts).
 * Chi guarda può tornare ai colori dei singoli giocatori: è una sua preferenza, salvata in questo browser
 * (localStorage, con il profilo di prova se c'è) e valida per tutte le partite a squadre.
 */

import { useSyncExternalStore } from 'react';

const profilo = new URLSearchParams(location.search).get('profilo') ?? '';
const CHIAVE = profilo ? `poordown:colori-proprieta:${profilo}` : 'poordown:colori-proprieta';
/** Il valore salvato quando si sceglie il colore dei giocatori; senza niente valgono i colori di squadra. */
const GIOCATORI = 'giocatori';

const ascoltatori = new Set<() => void>();

function leggi(): boolean {
  try {
    return localStorage.getItem(CHIAVE) !== GIOCATORI;
  } catch {
    // Archivio bloccato: i colori di squadra.
    return true;
  }
}

let perSquadra = leggi();

/** Sceglie i colori di squadra (`true`) o quelli dei giocatori (`false`) per le proprietà. */
export function scegliColoriDiSquadra(si: boolean): void {
  perSquadra = si;
  try {
    if (si) localStorage.removeItem(CHIAVE);
    else localStorage.setItem(CHIAVE, GIOCATORI);
  } catch {
    // Vale solo per questa visita.
  }
  for (const fn of ascoltatori) fn();
}

/** Le proprietà vanno colorate per squadra (nelle partite a squadre)? Il componente si aggiorna quando cambia. */
export function useColoriDiSquadra(): boolean {
  return useSyncExternalStore(
    (fn) => {
      ascoltatori.add(fn);
      return () => ascoltatori.delete(fn);
    },
    () => perSquadra,
  );
}
