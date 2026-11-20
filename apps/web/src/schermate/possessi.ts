/*
 * Le proprietà di un giocatore, a colpo d'occhio: con il mouse sulla sua pedina nella lista dei giocatori
 * (ColonnaGioco.tsx) il tabellone lascia accese solo le caselle che possiede e spegne le altre (Tabellone.tsx,
 * stili in tabellone.css). Tolto il mouse torna tutto com'era.
 * È solo uno stato dell'interfaccia di chi guarda: non va al server né al motore.
 */

import { useEffect, useSyncExternalStore } from 'react';
import type { IdGiocatore, Stato } from '@poordown/engine';

/* ---------------- Quali caselle ---------------- */

/**
 * Le caselle che il giocatore possiede: città, stazioni e servizi, ipotecate comprese.
 * Solo le sue: quelle dei compagni di squadra no.
 * `null` se non c'è niente da evidenziare (nessuno sotto il mouse, o un giocatore che non è più in partita):
 * il tabellone resta com'è. Un insieme vuoto invece spegne tutto (il giocatore non possiede niente).
 */
export function possessiEvidenziati(partita: Stato | null, id: IdGiocatore | null): ReadonlySet<number> | null {
  if (!partita || id === null) return null;
  const g = partita.giocatori.find((x) => x.id === id);
  if (!g || g.eliminato !== null) return null;
  const sue = new Set<number>();
  partita.proprieta.forEach((p, n) => {
    if (p?.proprietario === id) sue.add(n);
  });
  return sue;
}

/* ---------------- Chi è sotto il mouse ---------------- */

let evidenziato: IdGiocatore | null = null;
const ascoltatori = new Set<() => void>();

function evidenzia(id: IdGiocatore | null): void {
  if (evidenziato === id) return;
  evidenziato = id;
  for (const fn of ascoltatori) fn();
}

/** Il giocatore con il mouse sulla pedina, o `null`. Il componente si aggiorna quando cambia. */
export function useGiocatoreEvidenziato(): IdGiocatore | null {
  return useSyncExternalStore(
    (fn) => {
      ascoltatori.add(fn);
      return () => ascoltatori.delete(fn);
    },
    () => evidenziato,
  );
}

/**
 * Per la pedina di un giocatore nella lista: entrando con il mouse accende le sue proprietà, uscendo le spegne.
 * `attiva` falso (chi è fuori dalla partita non ha proprietà): niente. Se la riga sparisce o il giocatore esce
 * mentre il mouse è lì, il tabellone torna com'era.
 */
export function usePedinaEvidenzia(
  id: IdGiocatore,
  attiva: boolean,
): { accesa: boolean; onMouseEnter?: () => void; onMouseLeave?: () => void } {
  const accesa = useGiocatoreEvidenziato() === id;
  useEffect(
    () => () => {
      if (evidenziato === id) evidenzia(null);
    },
    [id, attiva],
  );
  if (!attiva) return { accesa: false };
  return {
    accesa,
    onMouseEnter: () => evidenzia(id),
    onMouseLeave: () => {
      if (evidenziato === id) evidenzia(null);
    },
  };
}
