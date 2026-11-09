/* Il tempo del turno come lo mostra il cartello (le cifre e i pulsanti del tempo sono in Timer.tsx). */

import { POCO_TEMPO_MS, tempoTurno, type Giocatore, type Stato, type TempoMostrato } from '@poordown/engine';
import { collegamento } from '../rete/sessione';
import { useBattito } from '../ui/battito';

/** Sotto questa soglia il tempo diventa rosso. */
const ROSSO_MS = 15_000;

export interface TempoDelTurno {
  tempo: TempoMostrato;
  /** Chi sta giocando il turno (nella partita aggiornata). */
  corrente: Giocatore;
  /** Chi gioca non è collegato: il turno passa da solo allo zero. */
  assente: boolean;
  /** Restano meno di 30 secondi: si può chiedere o regalare tempo. */
  poco: boolean;
  /** Ultimi 15 secondi (e l'orologio non è fermo per l'asta). */
  rosso: boolean;
  /** Quanto resta, da 0 a 1, per la barra. */
  quota: number;
}

/**
 * Il tempo del turno della partita aggiornata (non quella che aspetta le animazioni: il tempo scorre comunque),
 * ricalcolato quattro volte al secondo. `null` se il turno non ha limite.
 */
export function useTempoTurno(partita: Stato): TempoDelTurno | null {
  useBattito(250);
  const tempo = partita.fase === 'in_corso' ? tempoTurno(partita, collegamento.orologio()) : null;
  const corrente = partita.giocatori.find((g) => g.id === partita.turno.giocatore);
  if (!tempo || !corrente) return null;
  return {
    tempo,
    corrente,
    assente: corrente.offlineDa !== null,
    poco: tempo.rimasto <= POCO_TEMPO_MS,
    rosso: tempo.rimasto <= ROSSO_MS && !tempo.fermo,
    quota: Math.min(1, tempo.rimasto / tempo.totale),
  };
}
