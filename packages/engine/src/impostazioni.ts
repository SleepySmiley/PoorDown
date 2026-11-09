import type { Impostazioni } from './tipi';

export const GIOCATORI_MIN = 2;
export const GIOCATORI_MAX = 8;
export const SOLDI_INIZIALI_POSSIBILI = [500, 1000, 1500, 2000, 2500, 3000] as const;
/** Modalità squadre: al massimo 4 squadre, con un nome di al massimo 20 caratteri. */
export const SQUADRE_MAX = 4;
export const NOME_SQUADRA_MAX = 20;
export const NOMI_SQUADRE_PREDEFINITI: readonly string[] = Object.freeze(
  Array.from({ length: SQUADRE_MAX }, (_, i) => `Squadra ${i + 1}`),
);

/** Con la durata massima: la partita finisce dopo tanti turni per ogni giocatore seduto all'inizio. */
export const TURNI_A_TESTA = 100;
/** Con la durata massima: quando mancano tanti turni a testa il registro avvisa. */
export const TURNI_DI_AVVISO_A_TESTA = 10;

/**
 * Chi gioca dopo il primo parte con un po' di soldi in più, per ogni posto: il 5% dei soldi iniziali
 * (il 2,5% in due), arrotondato ai 5 €. Con 1500 € e quattro giocatori: 0, +75, +150, +225.
 * Senza, chi tira per primo vince il 29% delle partite e il quarto il 21% (simulazione di 8000 partite di bot).
 */
export function bonusPerPosto(soldiIniziali: number, giocatori: number): number {
  const quota = giocatori === 2 ? 0.025 : 0.05;
  return Math.floor((soldiIniziali * quota) / 5) * 5;
}

/** Valori di una stanza nuova, come su richup, più il timer di turno e la durata massima (attivi). Le squadre partono spente. */
export const IMPOSTAZIONI_PREDEFINITE: Readonly<Impostazioni> = Object.freeze({
  giocatoriMax: 4,
  stanzaPrivata: true,
  bot: false,
  mappa: 'classica',
  affittoDoppioSetCompleto: false,
  cassaVacanza: false,
  aste: false,
  nienteAffittoInPrigione: false,
  ipoteche: false,
  costruzioneUniforme: true,
  soldiIniziali: 1500,
  ordineCasuale: true,
  timerTurno: true,
  durataMassima: true,
  squadre: false,
});
