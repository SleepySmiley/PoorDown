export const NOME_GIOCO = 'PoorDown';
export const VERSIONE = '0.1.0';

export type * from './protocollo';
export type * from './tipi';

export { casoDaSeme, mescola, tiraDadi } from './caso';
export {
  affitto,
  attivi,
  caselleDellaRegione,
  edifici,
  giocatore,
  LIVELLO_ALBERGO,
  patrimonio,
  possedute,
  possiedeRegione,
  proprietabile,
  valoreLiquidazione,
  valoreVendita,
  VALORE_GRAZIA,
} from './conti';
export { descrivi, descriviVoce, euro } from './descrivi';
export { GIOCATORI_MAX, GIOCATORI_MIN, IMPOSTAZIONI_PREDEFINITE, SOLDI_INIZIALI_POSSIBILI } from './impostazioni';
export { nomeCasuale, pulisciNome } from './nomi';
export { creaPartita, type NuovoGiocatore } from './partita';
export {
  ATTESA_RISPOSTA_MS,
  CHAT_CRONOLOGIA,
  CHAT_MAX,
  COLORI,
  LUNGHEZZA_CODICE,
  NOME_MAX,
  REGISTRO_MAX,
} from './protocollo';
export { applica, azioniPossibili, TENTATIVI_PRIGIONE, verifica } from './regole';
export { tabellone, TABELLONI } from './tabelloni';
export { comeMossa, mossePossibili, vistaPartita } from './vista';
