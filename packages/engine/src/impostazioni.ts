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

/** Valori di una stanza nuova, come su richup, più il timer di turno (attivo). Le squadre partono spente. */
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
  squadre: false,
});
