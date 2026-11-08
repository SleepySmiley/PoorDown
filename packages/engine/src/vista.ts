/* Aiuti per il lato browser: cosa può vedere e cosa può fare chi gioca. */

import type { Mossa } from './protocollo';
import { azioniPossibili } from './regole';
import type { Azione, IdGiocatore, Stato } from './tipi';

/**
 * Lo stato come lo ricevono i browser: senza l'ordine dei mazzi, così nessuno può prevedere la prossima carta,
 * e senza il grafico del patrimonio finché la partita è in corso.
 * Resta un `Stato`, quindi l'interfaccia può usare `verifica`, `azioniPossibili`, `affitto` e gli altri calcoli;
 * solo `applica` non va usato sulla vista, perché senza mazzi non saprebbe pescare.
 */
export function vistaPartita(stato: Stato): Stato {
  const copia = JSON.parse(JSON.stringify(stato)) as Stato;
  copia.mazzi = { busta: { ordine: [], prossima: 0 }, cartolina: { ordine: [], prossima: 0 } };
  // Il grafico del patrimonio serve solo a fine partita: intanto gli aggiornamenti restano leggeri.
  if (copia.fase === 'in_corso') copia.statistiche.patrimonio = [];
  return copia;
}

/** L'azione nella forma da mandare al server, che aggiunge da sé chi la compie. */
export function comeMossa(azione: Azione): Mossa {
  const copia: Partial<Azione> = { ...azione };
  delete copia.giocatore;
  return copia as Mossa;
}

/** Le mosse che il giocatore può fare adesso: servono a decidere quali pulsanti mostrare. */
export function mossePossibili(stato: Stato, id: IdGiocatore): Mossa[] {
  return azioniPossibili(stato, id).map(comeMossa);
}
