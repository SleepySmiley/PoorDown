import type { Impostazioni } from './tipi';

export const GIOCATORI_MIN = 2;
export const GIOCATORI_MAX = 8;
export const SOLDI_INIZIALI_POSSIBILI = [500, 1000, 1500, 2000, 2500, 3000] as const;

/** Valori di una stanza nuova, come su richup, più il timer di turno (attivo). */
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
});
