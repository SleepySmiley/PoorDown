/*
 * Navigazione tra le pagine senza ricaricare: "/" è la home, "/stanza/<codice>" una stanza.
 * Il parametro ?profilo= (identità diversa per le prove nello stesso browser) segue la navigazione.
 */

import { useSyncExternalStore } from 'react';

export interface StatoNavigazione {
  /** Arrivati alla stanza dalla home (Gioca, Crea, elenco): si salta la pagina di ingresso. */
  dallaHome?: boolean;
}

/** «suoni»: la pagina di prova dei suoni, solo con il server di sviluppo. «pannello»: il pannello di controllo. */
export type Pagina = { tipo: 'home' } | { tipo: 'stanza'; codice: string } | { tipo: 'suoni' } | { tipo: 'pannello' };

const ascoltatori = new Set<() => void>();

function avvisa(): void {
  for (const fn of ascoltatori) fn();
}

window.addEventListener('popstate', avvisa);

/** Va a un'altra pagina. `sostituisci` non aggiunge un passo alla cronologia (il tasto Indietro lo salta). */
export function vai(percorso: string, stato: StatoNavigazione = {}, sostituisci = false): void {
  const indirizzo = percorso + location.search;
  if (sostituisci) history.replaceState(stato, '', indirizzo);
  else history.pushState(stato, '', indirizzo);
  avvisa();
}

export function vaiAllaStanza(codice: string, stato: StatoNavigazione = {}): void {
  vai(`/stanza/${codice}`, stato);
}

export function vaiAllaHome(): void {
  vai('/');
}

function leggi(): string {
  return location.pathname;
}

function pagina(percorso: string): Pagina {
  const stanza = /^\/stanza\/([a-z0-9]{5})\/?$/i.exec(percorso);
  if (stanza?.[1]) return { tipo: 'stanza', codice: stanza[1].toLowerCase() };
  if (import.meta.env.DEV && /^\/suoni\/?$/.test(percorso)) return { tipo: 'suoni' };
  if (/^\/pannello\/?$/.test(percorso)) return { tipo: 'pannello' };
  return { tipo: 'home' };
}

/** La pagina da mostrare: si aggiorna con i clic interni e con i tasti Avanti/Indietro del browser. */
export function usePagina(): Pagina {
  const percorso = useSyncExternalStore((fn) => {
    ascoltatori.add(fn);
    return () => ascoltatori.delete(fn);
  }, leggi);
  return pagina(percorso);
}

export function statoNavigazione(): StatoNavigazione {
  const stato: unknown = history.state;
  return typeof stato === 'object' && stato !== null ? (stato as StatoNavigazione) : {};
}
