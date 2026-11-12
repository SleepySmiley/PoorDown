/*
 * Il volume dei suoni, da 0 a 100: una preferenza di questo browser (localStorage), uguale per tutte le schede.
 * «Muto» porta il volume a 0 e ricorda l'ultimo valore udibile, che torna con «Riattiva».
 */

import { useSyncExternalStore } from 'react';

const CHIAVE = 'poordown:volume';
const PREDEFINITO = 70;

/**
 * Il volume salvato. Tutto dentro il try, anche il solo nominare `localStorage`: in una cornice di un altro sito
 * con l'archivio bloccato già leggerlo lancia un errore (anche con `typeof`), e qui siamo all'avvio della pagina.
 * Senza archivio (o nei test) vale il predefinito.
 */
function leggiSalvato(): number {
  try {
    const salvato = localStorage.getItem(CHIAVE);
    const n = Number(salvato);
    return salvato !== null && Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : PREDEFINITO;
  } catch {
    return PREDEFINITO;
  }
}

let valore = leggiSalvato();
let udibile = valore > 0 ? valore : PREDEFINITO;
const ascoltatori = new Set<() => void>();

export const volume = {
  leggi: (): number => valore,

  imposta(nuovo: number): void {
    const v = Math.min(100, Math.max(0, Math.round(nuovo)));
    if (v === valore) return;
    valore = v;
    if (v > 0) udibile = v;
    try {
      localStorage.setItem(CHIAVE, String(v));
    } catch {
      // Archivio bloccato: il volume vale solo per questa visita.
    }
    for (const fn of ascoltatori) fn();
  },

  /** Muto se si sente, altrimenti torna all'ultimo volume udibile. */
  alterna(): void {
    volume.imposta(valore > 0 ? 0 : udibile);
  },

  ascolta(fn: () => void): () => void {
    ascoltatori.add(fn);
    return () => ascoltatori.delete(fn);
  },
};

// Un'altra scheda ha cambiato il volume.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== CHIAVE) return;
    const v = leggiSalvato();
    if (v === valore) return;
    valore = v;
    if (v > 0) udibile = v;
    for (const fn of ascoltatori) fn();
  });
}

/** Il volume attuale; il componente si aggiorna quando cambia. */
export function useVolume(): number {
  return useSyncExternalStore(volume.ascolta, volume.leggi);
}
