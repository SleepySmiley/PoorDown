/*
 * Gli indirizzi del gioco: il link di un amico da aprire nel riquadro e le risposte di /api/info.
 * Qui niente `vscode`: si prova con Vitest.
 */

import type { InfoServer } from '@poordown/engine';
import { NOME_GIOCO } from '@poordown/engine';

export type EsitoLink = { tipo: 'valido'; indirizzo: string; origine: string } | { tipo: 'non-valido'; motivo: string };

export const QUESTO_PC = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Legge il link incollato da chi vuole entrare in una partita: quello online (https) o quello della rete di casa
 * (http://192.168…), che dentro VS Code si aprono entrambi. Senza http(s):// davanti si prova a indovinare.
 */
export function leggiLink(testo: string): EsitoLink {
  let scritto = testo.trim();
  if (!scritto) return { tipo: 'non-valido', motivo: 'Incolla il link che ti hanno mandato.' };
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(scritto)) {
    // «192.168.1.23:3000/stanza/abcde» o «localhost:3000» sono in http; il resto (trycloudflare.com…) in https.
    scritto = (/^(localhost|\d{1,3}(\.\d{1,3}){3})(:\d+)?(\/|$)/i.test(scritto) ? 'http://' : 'https://') + scritto;
  }
  let url: URL;
  try {
    url = new URL(scritto);
  } catch {
    return { tipo: 'non-valido', motivo: 'Questo non sembra un link: dovrebbe iniziare con https://' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { tipo: 'non-valido', motivo: 'Il link della partita inizia con https:// (o http:// in casa).' };
  }
  if (url.username || url.password) return { tipo: 'non-valido', motivo: 'Questo link contiene un nome o una password: non lo apro.' };
  return { tipo: 'valido', indirizzo: url.href, origine: url.origin };
}

/** La risposta di /api/info viene da PoorDown? */
export function eInfoDiPoorDown(dati: unknown): dati is InfoServer {
  return typeof dati === 'object' && dati !== null && (dati as { nome?: unknown }).nome === NOME_GIOCO;
}

/** L'indirizzo da dare agli amici: quello online se c'è, poi quello della rete di casa, poi questo PC. */
export function indirizzoPerGliAmici(info: InfoServer, porta: number): string {
  return info.pubblico ?? info.indirizzi[0] ?? `http://localhost:${porta}`;
}
