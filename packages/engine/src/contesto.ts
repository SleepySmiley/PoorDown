/*
 * Il contesto di un'azione in esecuzione e i movimenti di denaro, usati da tutte le regole.
 * Lavorano sulla copia dello stato che `applica` restituirà: qui si può modificare.
 */

import { giocatore } from './conti';
import type { Caso, Errore, CodiceErrore, Evento, Giocatore, IdGiocatore, Stato, Tabellone } from './tipi';

export interface Contesto {
  s: Stato;
  tab: Tabellone;
  caso: Caso;
  /** Orologio del server in millisecondi: serve alle scadenze (aste). */
  adesso: number;
  eventi: Evento[];
  /** Una regola ha chiuso il turno (prigione, vacanza): niente rilancio. */
  turnoFinito: boolean;
}

export function errore(codice: CodiceErrore, messaggio: string): Errore {
  return { codice, messaggio };
}

/** La parte del rosso che non è dovuta ad altri giocatori: quella verso la banca. */
export function rossoVersoBanca(g: Giocatore): number {
  return Math.max(0, -g.saldo - g.debiti.reduce((t, d) => t + d.importo, 0));
}

/**
 * Entrata di denaro. Se il giocatore ha debiti verso altri giocatori, l'entrata va prima a loro,
 * nell'ordine in cui i debiti sono nati. Il saldo aumenta comunque dell'intero importo,
 * perché il debito era già contato nel rosso.
 * Poi si rimborsa il rosso verso la banca: con la regola attiva, la parte rimborsata va nella cassa della Vacanza.
 * Quel rosso nasce da tasse, carte e riparazioni (gli altri pagamenti alla banca chiedono il contante),
 * oppure da un debito verso chi è uscito senza compagni che lo ereditino.
 */
export function accredita(ctx: Contesto, g: Giocatore, importo: number): void {
  if (importo <= 0) return;
  const rossoPrima = rossoVersoBanca(g);
  g.saldo += importo;
  let resto = importo;
  while (resto > 0 && g.debiti.length > 0) {
    const debito = g.debiti[0]!;
    const creditore = giocatore(ctx.s, debito.creditore);
    if (!creditore || creditore.eliminato) {
      g.debiti.shift();
      continue;
    }
    const quota = Math.min(resto, debito.importo);
    debito.importo -= quota;
    resto -= quota;
    if (debito.importo === 0) g.debiti.shift();
    ctx.eventi.push({ tipo: 'rimborso', da: g.id, a: creditore.id, importo: quota });
    accredita(ctx, creditore, quota);
  }
  const rimborsato = rossoPrima - rossoVersoBanca(g);
  if (rimborsato > 0 && ctx.s.impostazioni.cassaVacanza) ctx.s.cassaVacanza += rimborsato;
}

/**
 * Pagamento a un altro giocatore. Chi riceve incassa subito solo il contante disponibile; il resto
 * diventa un debito che si salda da solo con le entrate successive di chi paga.
 */
export function paga(ctx: Contesto, da: Giocatore, a: IdGiocatore, importo: number): void {
  if (importo <= 0) return;
  const creditore = giocatore(ctx.s, a)!;
  const quota = Math.min(importo, Math.max(0, da.saldo));
  da.saldo -= importo;
  const resto = importo - quota;
  if (resto > 0) {
    const esistente = da.debiti.find((d) => d.creditore === a);
    if (esistente) esistente.importo += resto;
    else da.debiti.push({ creditore: a, importo: resto });
    ctx.eventi.push({ tipo: 'debito', da: da.id, a, importo: resto });
  }
  accredita(ctx, creditore, quota);
}

/**
 * Pagamento alla banca. Tasse, carte e riparazioni vanno nella cassa della Vacanza, se la regola è attiva:
 * subito solo il contante disponibile, il resto quando il rosso si rimborsa (`accredita`).
 */
export function pagaBanca(ctx: Contesto, g: Giocatore, importo: number, inCassa: boolean): void {
  if (importo <= 0) return;
  const quota = Math.min(importo, Math.max(0, g.saldo));
  g.saldo -= importo;
  if (inCassa && ctx.s.impostazioni.cassaVacanza) ctx.s.cassaVacanza += quota;
}
