/*
 * Tempo chiesto e regalato, voto per togliere chi gioca, espulsione decisa dall'host.
 * docs/analisi/06-architettura-realtime.md §5.4 e docs/analisi/03-regole-turno.md §3.11.
 *
 * Il voto riguarda sempre chi sta giocando il turno e si azzera a ogni turno. Servono i voti della
 * maggioranza dei giocatori in gioco (`votiNecessari`).
 * - Con il timer di turno si vota solo dopo che il gioco ha già dovuto finire un turno al posto suo,
 *   e mai in due: il timer toglie da solo chi è assente.
 * - Senza timer si può votare sempre; il primo voto fa partire 5 minuti, scaduti i quali chi gioca
 *   esce comunque se non ha finito il turno.
 */

import { errore, type Contesto } from './contesto';
import { attivi, giocatore } from './conti';
import { REGALI_MAX_MS, REGALO_MS, turnoConLimite, VOTO_A_TEMPO_MS, votiNecessari } from './tempo';
import { elimina } from './turni';
import type { Errore, Giocatore, IdGiocatore, Stato } from './tipi';

/* ------------------------- Tempo del turno ------------------------- */

/** `g` è chi gioca il turno; i controlli comuni (turno, asta) li fa `verifica`. */
export function verificaRichiesta(stato: Stato): Errore | null {
  if (!stato.impostazioni.timerTurno) return errore('timer_spento', 'In questa partita il timer di turno non è attivo.');
  if (stato.turno.tempo.richiesta) return errore('gia_chiesto', 'Hai già chiesto più tempo: aspetta che qualcuno te lo dia.');
  return null;
}

export function chiediTempo(ctx: Contesto, g: Giocatore): void {
  ctx.s.turno.tempo.richiesta = true;
  ctx.eventi.push({ tipo: 'tempo_chiesto', giocatore: g.id });
}

/** `g` regala tempo a chi sta giocando il turno. */
export function verificaRegalo(stato: Stato, g: Giocatore): Errore | null {
  const t = stato.turno.tempo;
  if (stato.turno.giocatore === g.id) return errore('non_tuo_turno', 'Non puoi regalare tempo a te stesso.');
  if (stato.asta) return errore('asta_in_corso', 'Durante l’asta l’orologio è fermo: non serve regalare tempo.');
  if (!turnoConLimite(stato)) return errore('timer_spento', 'In questa partita il timer di turno non è attivo.');
  if (t.regali.includes(g.id)) return errore('gia_regalato', 'In questo turno hai già regalato del tempo.');
  if (t.regalato + REGALO_MS > REGALI_MAX_MS) {
    return errore('regali_esauriti', 'In questo turno ha già ricevuto tutto il tempo in più possibile.');
  }
  return null;
}

export function regalaTempo(ctx: Contesto, g: Giocatore): void {
  const t = ctx.s.turno.tempo;
  t.regalato += REGALO_MS;
  t.regali.push(g.id);
  t.richiesta = false;
  ctx.eventi.push({ tipo: 'tempo_regalato', da: g.id, a: ctx.s.turno.giocatore, ms: REGALO_MS });
}

/* ------------------------------ Voto ------------------------------- */

/** Si può votare contro chi gioca adesso? `null` se sì, altrimenti il motivo. Non guarda chi vota. */
export function votoPossibile(stato: Stato): Errore | null {
  const bersaglio = giocatore(stato, stato.turno.giocatore);
  if (!bersaglio || stato.fase !== 'in_corso') return errore('voto_non_disponibile', 'Adesso non c’è nessuno da votare.');
  if (!stato.impostazioni.timerTurno) return null;
  if (attivi(stato).length < 3) {
    return errore('voto_non_disponibile', 'In due il voto non serve: il timer toglie da solo chi è assente.');
  }
  if (bersaglio.automatici === 0 && !stato.turno.tempo.automatico) {
    return errore('voto_non_disponibile', 'Si può votare solo dopo che il timer ha finito un turno al posto suo.');
  }
  return null;
}

export function verificaVoto(stato: Stato, g: Giocatore, favorevole: boolean): Errore | null {
  if (stato.turno.giocatore === g.id) return errore('voto_non_disponibile', 'Non puoi votare contro te stesso.');
  const voti = stato.turno.votazione.voti;
  if (!favorevole) return voti.includes(g.id) ? null : errore('non_votato', 'Non hai votato in questo turno.');
  if (voti.includes(g.id)) return errore('gia_votato', 'Hai già votato in questo turno.');
  return votoPossibile(stato);
}

export function vota(ctx: Contesto, g: Giocatore, favorevole: boolean): void {
  const { s } = ctx;
  const v = s.turno.votazione;
  const contro = s.turno.giocatore;
  v.voti = favorevole ? [...v.voti, g.id] : v.voti.filter((id) => id !== g.id);
  const servono = votiNecessari(s);
  ctx.eventi.push({ tipo: 'voto', da: g.id, contro, favorevole, voti: v.voti.length, servono });
  if (v.voti.length >= servono) {
    elimina(ctx, giocatore(s, contro)!, 'voto');
    return;
  }
  if (v.voti.length === 0) v.scadenza = null;
  else if (!s.impostazioni.timerTurno) v.scadenza ??= ctx.adesso + VOTO_A_TEMPO_MS;
}

/* --------------------------- Espulsione ---------------------------- */

/** L'host toglie un giocatore dalla partita. Chi può farlo lo decide la stanza; qui si controlla il bersaglio. */
export function verificaEspulsione(stato: Stato, id: IdGiocatore): Errore | null {
  if (stato.fase !== 'in_corso') return errore('partita_finita', 'La partita è finita.');
  const g = giocatore(stato, id);
  if (!g) return errore('giocatore_sconosciuto', 'Questo giocatore non è nella partita.');
  if (g.eliminato) return errore('eliminato', 'Questo giocatore è già fuori dalla partita.');
  if (stato.turno.giocatore === id) {
    return errore('sta_giocando', 'Non puoi togliere chi sta giocando il suo turno: aspetta che finisca.');
  }
  return null;
}
