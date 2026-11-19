/*
 * Quale suono fa un rilancio all'asta. Funzioni pure, senza Web Audio: le usa `useSuoniAsta` (richiami.ts) e si provano
 * con Vitest.
 *
 * Non si guarda quante offerte ci sono nell'elenco: il server ne tiene al massimo 20 (economia.ts), quindi dalla
 * ventunesima la lunghezza non cresce più e i rilanci veloci smettevano di suonare. Conta l'offerta migliore: dentro
 * un'asta ogni rilancio deve superarla, quindi il suo importo cresce sempre.
 */

import type { Asta, IdGiocatore } from '@poordown/engine';
import type { NomeSuono } from './catalogo';

/** Quello che serve ricordare dell'asta tra un aggiornamento e l'altro. */
export interface RicordoAsta {
  /** La casella all'asta; `null` se non c'è un'asta. */
  casella: number | null;
  /** L'importo dell'offerta migliore; 0 se nessuno ha ancora offerto. */
  importo: number;
  /** Chi ha l'offerta migliore; `null` se nessuno. */
  migliore: IdGiocatore | null;
  /** La mia offerta più alta tra quelle dell'elenco; 0 se non ne ho fatte (o se guardo soltanto). */
  mia: number;
}

export function ricordoAsta(asta: Asta | null, io: IdGiocatore | null): RicordoAsta {
  let mia = 0;
  if (asta && io !== null) for (const o of asta.offerte) if (o.giocatore === io && o.importo > mia) mia = o.importo;
  return {
    casella: asta?.casella ?? null,
    importo: asta?.migliore?.importo ?? 0,
    migliore: asta?.migliore?.giocatore ?? null,
    mia,
  };
}

/**
 * Il suono del rilancio arrivato tra `prima` e `adesso`, oppure `null` se non ce n'è uno nuovo.
 * - Il rilancio è nuovo se l'offerta migliore è salita; con un'altra asta si riparte da zero. Se scende (chi l'aveva
 *   fatta è uscito dalla partita e torna buona quella di prima) non suona niente.
 * - Se più rilanci arrivano insieme suona una volta sola, quello che conta per me: il mio rilancio, oppure «superato»
 *   se avevo io l'offerta migliore o se ho rilanciato e qualcuno mi ha già superato.
 */
export function suonoRilancio(prima: RicordoAsta, adesso: RicordoAsta, io: IdGiocatore | null): NomeSuono | null {
  if (adesso.casella === null || adesso.migliore === null) return null;
  const stessaAsta = prima.casella === adesso.casella;
  const base = stessaAsta ? prima.importo : 0;
  if (adesso.importo <= base) return null;
  if (adesso.migliore === io) return 'miaOfferta';
  const avevoLaMigliore = stessaAsta && prima.migliore === io;
  if (io !== null && (avevoLaMigliore || adesso.mia > base)) return 'superato';
  return 'offerta';
}
