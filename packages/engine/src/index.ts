export const NOME_GIOCO = 'PoorDown';
export const VERSIONE = '0.1.0';

export type * from './protocollo';
export type * from './tipi';

export { casoDaSeme, mescola, tiraDadi } from './caso';
export {
  affitto,
  attivi,
  caselleDellaRegione,
  costoProssimoEdificio,
  costoRiscatto,
  edifici,
  giocatore,
  LIVELLO_ALBERGO,
  patrimonio,
  possedute,
  possiedeRegione,
  proprietabile,
  regioneConEdifici,
  rimborsoEdificio,
  valoreIpoteca,
  valoreLiquidazione,
  valoreVendita,
  VALORE_GRAZIA,
} from './conti';
export { acquistoInSospeso, ASTA_MS, RILANCI } from './economia';
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
export { votoPossibile } from './moderazione';
export {
  applica,
  applicaScadenze,
  azioniPossibili,
  espelli,
  prossimaScadenza,
  TENTATIVI_PRIGIONE,
  verifica,
} from './regole';
export {
  caselleIpotecate,
  NOTA_MAX,
  PACCHETTO_VUOTO,
  pacchettoVuoto,
  problemiScambio,
  PROPOSTE_IN_ATTESA_MAX,
  SCAMBI_APERTI_MAX,
  type BozzaScambio,
} from './scambi';
export {
  classifica,
  contaMessaggio,
  durata,
  piuVolteInPrigione,
  proprietaPiuVisitata,
  statisticheIniziali,
  type Piazzamento,
} from './statistiche';
export { tabellone, TABELLONI } from './tabelloni';
export {
  ASSENZA_MS,
  BANCA_INIZIALE_MS,
  BANCA_MAX_MS,
  connessione,
  GRAZIA_DEBITO_MS,
  GRAZIA_MS,
  POCO_TEMPO_MS,
  REGALI_MAX_MS,
  REGALO_MS,
  sposta,
  tempoTurno,
  turnoConLimite,
  TURNI_AUTOMATICI_MAX,
  VOTO_A_TEMPO_MS,
  votiNecessari,
  type TempoMostrato,
} from './tempo';
export { comeMossa, mossePossibili, vistaPartita } from './vista';
