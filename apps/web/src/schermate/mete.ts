/*
 * Giro del mondo: dove può volare adesso chi gioca, con il biglietto di ogni meta (per il tabellone e la carta d'imbarco).
 */

import { biglietto, tabellone, verifica, type Biglietto, type IdGiocatore, type Stato, type Tabellone } from '@poordown/engine';

/** Una meta raggiungibile: il biglietto e la fascia di prezzo (1 vicino, 2 medio, 3 lontano). */
export interface MetaVolo extends Biglietto {
  fascia: number;
}

/** La fascia del biglietto per quella distanza: la prima con `fino` almeno uguale (come il prezzo nel motore). */
function fasciaDi(tab: Tabellone, distanza: number): number {
  const fasce = tab.viaggi?.fasce ?? [];
  const i = fasce.findIndex((f) => f.fino >= distanza);
  return (i < 0 ? fasce.length - 1 : i) + 1;
}

/** Le caselle su cui `io` può volare adesso (vuota se adesso non può volare), con il biglietto di ognuna. */
export function meteVolo(partita: Stato, io: IdGiocatore): Map<number, MetaVolo> {
  const tab = tabellone(partita.mappa);
  const mete = new Map<number, MetaVolo>();
  if (!tab.viaggi) return mete;
  for (let n = 0; n < tab.caselle.length; n++) {
    if (verifica(partita, { tipo: 'vola', giocatore: io, casella: n })) continue;
    const b = biglietto(partita, io, n);
    if (b) mete.set(n, { ...b, fascia: fasciaDi(tab, b.distanza) });
  }
  return mete;
}

/** Perché adesso non si può volare (per il suggerimento del pulsante spento); `null` se si può. */
export function bloccoVolo(partita: Stato, io: IdGiocatore, mete: ReadonlyMap<number, MetaVolo>): string | null {
  if (mete.size > 0) return null;
  const tab = tabellone(partita.mappa);
  const qui = partita.giocatori.find((g) => g.id === io)?.posizione ?? 0;
  // Una meta qualunque diversa da dove si è: il motore dice il primo motivo (passaporto, soldi, momento del turno).
  const prova = (qui + 1) % tab.caselle.length;
  return verifica(partita, { tipo: 'vola', giocatore: io, casella: prova })?.messaggio ?? 'Adesso non puoi volare.';
}
