export const NOME_GIOCO = 'PoorDown';
export const VERSIONE = '0.1.0';

export type * from './protocollo';
export type * from './tipi';

export {
  durataScena,
  guadagnoScambio,
  mossaBot,
  mosseDeiBot,
  PENSIERO_BOT_MS,
  riserva,
  TURNI_TRA_PROPOSTE_BOT,
  valoreCasella,
  type OpzioniBot,
} from './bot';
export { casoDaSeme, mescola, tiraDadi } from './caso';
export {
  affitto,
  alleati,
  attivi,
  compagni,
  caselleDellaRegione,
  costoProssimoEdificio,
  costoRiscatto,
  edifici,
  giocatore,
  haVinto,
  LIVELLO_ALBERGO,
  patrimonio,
  possedute,
  possiedeRegione,
  proprietabile,
  regioneConEdifici,
  rimborsoEdificio,
  squadraDi,
  valoreIpoteca,
  valoreLiquidazione,
  valoreVendita,
  VALORE_GRAZIA,
} from './conti';
export { acquistoInSospeso, ASTA_MS, RILANCI } from './economia';
export { aOppureAd, descrivi, descriviVoce, destinazione, euro, preposizioneA } from './descrivi';
export {
  bonusPerPosto,
  GIOCATORI_MAX,
  GIOCATORI_MIN,
  IMPOSTAZIONI_PREDEFINITE,
  NOME_SQUADRA_MAX,
  NOMI_SQUADRE_PREDEFINITI,
  SOLDI_INIZIALI_POSSIBILI,
  SQUADRE_MAX,
  TURNI_A_TESTA,
} from './impostazioni';
export { finitaPerDurata, ultimoTurno } from './turni';
export { nomeCasuale, pulisciNome } from './nomi';
export {
  GRAZIE_MAX,
  modificaPartita,
  problemaStato,
  REGOLE_MODIFICABILI,
  SOLDI_MAX_PANNELLO,
  type ComandoPannello,
  type DadiDecisi,
  type DettaglioPannello,
  type EsitoModifica,
  type ModificaPartita,
  type RegolaModificabile,
  type StanzaNelPannello,
  type StatoAccessoPannello,
  type TipoComandoPannello,
} from './pannello';
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
  effettiScambio,
  NOTA_MAX,
  PACCHETTO_VUOTO,
  pacchettoVuoto,
  problemiScambio,
  PROPOSTE_IN_ATTESA_MAX,
  SCAMBI_APERTI_MAX,
  valorePacchetto,
  type BozzaScambio,
  type EffettoScambio,
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
export { DADI_MS, durataCarta, durataEvento, EVENTI_CON_PAUSA, EVENTI_CON_SOLDI, passiPedina, percorso, TEMPI } from './tempi';
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
