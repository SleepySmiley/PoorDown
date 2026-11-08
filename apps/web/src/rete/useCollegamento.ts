import { useSyncExternalStore } from 'react';
import type { Collegamento, StatoCollegamento } from './collegamento';

/** Lo stato del collegamento dentro un componente React: si aggiorna da solo a ogni cambiamento. */
export function useCollegamento(collegamento: Collegamento): StatoCollegamento {
  return useSyncExternalStore(
    (avvisa) => collegamento.ascolta(avvisa),
    () => collegamento.leggi(),
  );
}
