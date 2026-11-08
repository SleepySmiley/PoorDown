/*
 * Timer di turno e assenze: docs/analisi/06-architettura-realtime.md §4.3 e §5.
 * Qui ci sono solo i calcoli sull'orologio; le regole che lo usano (gioco automatico, voti, rimozioni)
 * stanno in regole.ts e moderazione.ts.
 *
 * Ogni turno ha una grazia di 20 s (60 s se chi gioca è in debito). Finita la grazia si consuma la banca
 * personale, che parte da 60 s e arriva al massimo a 3 minuti: a fine turno si ricarica di 6–20 s, di più
 * se il turno è stato veloce. Chi non è collegato ha solo la grazia, contata da quando è sparito.
 * Tutti i tempi sono millisecondi dell'orologio del server.
 */

import type { Giocatore, IdGiocatore, Stato, TempoTurno, Turno } from './tipi';

export const GRAZIA_MS = 20_000;
export const GRAZIA_DEBITO_MS = 60_000;
export const BANCA_INIZIALE_MS = 60_000;
export const BANCA_MAX_MS = 3 * 60_000;
export const RICARICA_MIN_MS = 6_000;
export const RICARICA_MAX_MS = 20_000;
/** Quanto vale un "+1 min" regalato da un altro giocatore. */
export const REGALO_MS = 60_000;
/** Tempo che un turno può ricevere in regalo, in tutto. */
export const REGALI_MAX_MS = 2 * 60_000;
/** Dopo questi turni di fila finiti in automatico, al prossimo tempo scaduto si esce dalla partita. */
export const TURNI_AUTOMATICI_MAX = 2;
/** Chi resta scollegato per questo tempo esce dalla partita. */
export const ASSENZA_MS = 2 * 60_000;
/** Senza timer di turno, il voto toglie comunque chi gioca dopo questo tempo dal primo voto. */
export const VOTO_A_TEMPO_MS = 5 * 60_000;
/** Sotto questa soglia chi gioca può chiedere tempo e gli altri possono regalarglielo. */
export const POCO_TEMPO_MS = 30_000;

function corrente(s: Stato): Giocatore | undefined {
  return s.giocatori.find((g) => g.id === s.turno.giocatore);
}

/** Il tempo di un turno che comincia adesso. Se c'è un'asta aperta, l'orologio parte fermo. */
export function tempoIniziale(s: Stato, g: Giocatore, adesso: number): TempoTurno {
  return {
    inizio: adesso,
    grazia: g.saldo < 0 ? GRAZIA_DEBITO_MS : GRAZIA_MS,
    regalato: 0,
    regali: [],
    richiesta: false,
    automatico: false,
    fermoDa: s.asta ? adesso : null,
  };
}

/** Quanto si ricarica la banca a fine turno: 20 s per un turno lampo, 6 s se si è usata tutta la grazia. */
export function ricarica(usato: number): number {
  const quota = Math.min(1, Math.max(0, usato) / GRAZIA_MS);
  return Math.round(RICARICA_MAX_MS - (RICARICA_MAX_MS - RICARICA_MIN_MS) * quota);
}

/**
 * Aggiorna la banca e il conto dei turni automatici di chi finisce il turno.
 * Il tempo usato oltre la grazia e i regali esce dalla banca; se il turno è finito in automatico non c'è ricarica.
 */
export function chiudiOrologio(s: Stato, g: Giocatore, t: Turno, adesso: number): void {
  const tempo = t.tempo;
  g.automatici = tempo.automatico ? g.automatici + 1 : 0;
  if (!s.impostazioni.timerTurno) return;
  const usato = Math.max(0, (tempo.fermoDa ?? adesso) - tempo.inizio);
  const oltre = Math.max(0, usato - tempo.grazia - tempo.regalato);
  const resto = Math.max(0, g.banca - oltre);
  g.banca = Math.min(BANCA_MAX_MS, tempo.automatico ? resto : resto + ricarica(usato));
}

/** Quando finisce il tempo del turno, anche se l'orologio è fermo per l'asta; `null` se non c'è limite. */
export function fineTurno(s: Stato): number | null {
  if (s.fase !== 'in_corso') return null;
  const g = corrente(s);
  if (!g) return null;
  const t = s.turno.tempo;
  let fine = s.impostazioni.timerTurno ? t.inizio + t.grazia + t.regalato + g.banca : null;
  if (g.offlineDa !== null) {
    const assente = Math.max(g.offlineDa, t.inizio) + GRAZIA_MS + t.regalato;
    fine = fine === null ? assente : Math.min(fine, assente);
  }
  return fine;
}

/** La scadenza del turno da far rispettare adesso: durante l'asta l'orologio è fermo. */
export function scadenzaTurno(s: Stato): number | null {
  return s.asta ? null : fineTurno(s);
}

export interface TempoMostrato {
  /** Millisecondi che restano. */
  rimasto: number;
  /** Il tempo intero del turno, per l'anello del timer. */
  totale: number;
  /** L'asta tiene fermo l'orologio. */
  fermo: boolean;
  /** Da quanto è cominciato il turno. */
  trascorso: number;
}

/** Il tempo del turno come va mostrato nel timer; `null` se il turno non ha limite. */
export function tempoTurno(s: Stato, adesso: number): TempoMostrato | null {
  const fine = fineTurno(s);
  if (fine === null) return null;
  const t = s.turno.tempo;
  const ora = t.fermoDa ?? adesso;
  return {
    rimasto: Math.max(0, fine - ora),
    totale: Math.max(1, fine - t.inizio),
    fermo: t.fermoDa !== null,
    trascorso: Math.max(0, ora - t.inizio),
  };
}

/** Si può regalare tempo solo se il turno ha un limite: timer attivo, oppure chi gioca non è collegato. */
export function turnoConLimite(s: Stato): boolean {
  return s.impostazioni.timerTurno || corrente(s)?.offlineDa != null;
}

/** Voti necessari per togliere chi gioca: la maggioranza dei giocatori in gioco, lui compreso. */
export function votiNecessari(s: Stato): number {
  return Math.ceil((s.giocatori.filter((g) => !g.eliminato).length + 1) / 2);
}

/**
 * Sposta avanti tutti gli orologi della partita (dopo una pausa in cui nessuno era collegato):
 * conti alla rovescia e assenze riprendono da dove erano.
 */
export function sposta(stato: Stato, ms: number): Stato {
  if (ms <= 0) return stato;
  const s = JSON.parse(JSON.stringify(stato)) as Stato;
  for (const g of s.giocatori) if (g.offlineDa !== null) g.offlineDa += ms;
  const t = s.turno.tempo;
  t.inizio += ms;
  if (t.fermoDa !== null) t.fermoDa += ms;
  if (s.turno.votazione.scadenza !== null) s.turno.votazione.scadenza += ms;
  if (s.asta) s.asta.scadenza += ms;
  // Il tempo in pausa non conta nella durata della partita.
  if (s.statistiche.fine === null) s.statistiche.inizio += ms;
  return s;
}

/**
 * Segna che il giocatore si è scollegato o è tornato. Restituisce lo stato com'è se non cambia niente.
 * Non produce eventi: il registro non ne parla, si vede nella lista dei giocatori.
 */
export function connessione(stato: Stato, id: IdGiocatore, collegato: boolean, adesso: number): Stato {
  const attuale = stato.giocatori.find((g) => g.id === id);
  if (!attuale || attuale.eliminato || stato.fase !== 'in_corso') return stato;
  if (collegato === (attuale.offlineDa === null)) return stato;
  const s = JSON.parse(JSON.stringify(stato)) as Stato;
  s.giocatori.find((g) => g.id === id)!.offlineDa = collegato ? null : adesso;
  return s;
}
