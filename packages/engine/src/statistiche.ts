/*
 * Statistiche della partita: si raccolgono mentre si gioca e si leggono alla fine
 * (classifica dei turni sopravvissuti, grafico del patrimonio, riepilogo). docs/analisi/04-economia-fine-partita.md §10.
 */

import { haVinto, patrimonio, proprietabile } from './conti';
import { tabellone } from './tabelloni';
import type { IdGiocatore, IdMappa, Stato, Statistiche } from './tipi';

/** Statistiche vuote per una partita che comincia adesso. */
export function statisticheIniziali(mappa: IdMappa, adesso: number): Statistiche {
  return {
    inizio: adesso,
    fine: null,
    doppi: 0,
    scambi: 0,
    messaggi: 0,
    visite: tabellone(mappa).caselle.map(() => 0),
    prigione: {},
    uscite: [],
    patrimonio: [],
  };
}

/**
 * Aggiunge al grafico il patrimonio di tutti a questo punto (fine del turno in corso, o 0 all'inizio).
 * Se c'è già un punto per lo stesso turno, lo sostituisce. Modifica lo stato ricevuto.
 */
export function segnaPatrimonio(s: Stato): void {
  const punto = {
    turno: s.turno.numero,
    valori: s.giocatori.map((g) => (g.eliminato ? null : patrimonio(s, g.id))),
  };
  const serie = s.statistiche.patrimonio;
  if (serie.at(-1)?.turno === punto.turno) serie[serie.length - 1] = punto;
  else serie.push(punto);
}

/** Un messaggio in chat durante la partita. Restituisce lo stato com'è se la partita non è in corso. */
export function contaMessaggio(stato: Stato): Stato {
  if (stato.fase !== 'in_corso') return stato;
  const s = JSON.parse(JSON.stringify(stato)) as Stato;
  s.statistiche.messaggi++;
  return s;
}

export interface Piazzamento {
  giocatore: IdGiocatore;
  /** Turni sopravvissuti: per chi è uscito, il turno in cui è uscito; per chi resta, tutti i turni della partita. */
  turni: number;
  /** Ha vinto: a squadre, tutti i giocatori della squadra vincitrice. */
  vincitore: boolean;
}

/**
 * La classifica per turni sopravvissuti: prima chi è ancora in gioco (il vincitore, a fine partita),
 * poi chi è uscito, dal più tardi al più presto. Chi esce nello stesso turno è dietro a chi esce dopo di lui.
 */
export function classifica(s: Stato): Piazzamento[] {
  const uscite = s.statistiche.uscite;
  return [...s.giocatori]
    .sort((a, b) => {
      if (!a.eliminato || !b.eliminato) return Number(a.eliminato !== null) - Number(b.eliminato !== null);
      return b.eliminato.turno - a.eliminato.turno || uscite.indexOf(b.id) - uscite.indexOf(a.id);
    })
    .map((g) => ({ giocatore: g.id, turni: g.eliminato?.turno ?? s.turno.numero, vincitore: haVinto(s, g.id) }));
}

/** La proprietà su cui ci si è fermati più volte (a pari visite, la prima del tabellone); `null` se nessuna. */
export function proprietaPiuVisitata(s: Stato): { casella: number; visite: number } | null {
  const tab = tabellone(s.mappa);
  let migliore: { casella: number; visite: number } | null = null;
  s.statistiche.visite.forEach((visite, casella) => {
    if (visite > 0 && proprietabile(tab, casella) && visite > (migliore?.visite ?? 0)) migliore = { casella, visite };
  });
  return migliore;
}

/** Chi è finito più volte in prigione (anche più giocatori, a pari merito); `null` se nessuno ci è mai andato. */
export function piuVolteInPrigione(s: Stato): { giocatori: IdGiocatore[]; volte: number } | null {
  const volte = Math.max(0, ...s.giocatori.map((g) => s.statistiche.prigione[g.id] ?? 0));
  if (volte === 0) return null;
  return { giocatori: s.giocatori.filter((g) => s.statistiche.prigione[g.id] === volte).map((g) => g.id), volte };
}

/** Quanto è durata la partita (ms), senza le pause; `null` finché è in corso. */
export function durata(s: Stato): number | null {
  return s.statistiche.fine === null ? null : Math.max(0, s.statistiche.fine - s.statistiche.inizio);
}
