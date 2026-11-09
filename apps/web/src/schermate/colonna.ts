/* Stato della colonna sinistra in partita: la chat richiudibile e i messaggi non letti. */

import { useState } from 'react';
import type { IdGiocatore, MessaggioChat } from '@poordown/engine';

export interface ChatRichiudibile {
  chiusa: boolean;
  apri: () => void;
  chiudi: () => void;
  /** Messaggi degli altri arrivati da quando la chat è chiusa. */
  nuovi: number;
  /** L'ultimo di quei messaggi. */
  ultimo?: MessaggioChat;
}

/** Con la chat aperta tutto è letto; da chiusa si contano i messaggi degli altri arrivati dopo. */
export function useChatRichiudibile(chat: readonly MessaggioChat[], io: IdGiocatore | null): ChatRichiudibile {
  const [chiusaDa, setChiusaDa] = useState<number | null>(null);
  const chiusa = chiusaDa !== null;
  const arrivati = chiusa ? chat.filter((m) => m.n > chiusaDa && m.da !== io) : [];
  return {
    chiusa,
    apri: () => setChiusaDa(null),
    chiudi: () => setChiusaDa(chat.at(-1)?.n ?? 0),
    nuovi: arrivati.length,
    ultimo: arrivati.at(-1),
  };
}
