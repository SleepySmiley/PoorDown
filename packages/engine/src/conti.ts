/* Calcoli che non cambiano lo stato: affitti, valori, possessi. Li usano il motore e l'interfaccia. */

import { tabellone } from './tabelloni';
import type { Citta, Giocatore, IdGiocatore, Proprietabile, Stato, Tabellone } from './tipi';

/** Valore di una Carta Grazia nel patrimonio e nella liquidazione. */
export const VALORE_GRAZIA = 50;
export const LIVELLO_ALBERGO = 5;

export function giocatore(stato: Stato, id: IdGiocatore): Giocatore | undefined {
  return stato.giocatori.find((g) => g.id === id);
}

export function attivi(stato: Stato): Giocatore[] {
  return stato.giocatori.filter((g) => !g.eliminato);
}

export function proprietabile(tab: Tabellone, casella: number): Proprietabile | null {
  const c = tab.caselle[casella];
  return c && (c.tipo === 'citta' || c.tipo === 'stazione' || c.tipo === 'servizio') ? c : null;
}

/** Caselle possedute dal giocatore, in ordine di tabellone. */
export function possedute(stato: Stato, id: IdGiocatore): number[] {
  const risultato: number[] = [];
  stato.proprieta.forEach((p, i) => {
    if (p?.proprietario === id) risultato.push(i);
  });
  return risultato;
}

export function caselleDellaRegione(tab: Tabellone, regione: number): number[] {
  const risultato: number[] = [];
  tab.caselle.forEach((c, i) => {
    if (c.tipo === 'citta' && c.regione === regione) risultato.push(i);
  });
  return risultato;
}

/** Il giocatore possiede tutte le città della regione (ipotecate comprese). */
export function possiedeRegione(stato: Stato, id: IdGiocatore, regione: number): boolean {
  return caselleDellaRegione(tabellone(stato.mappa), regione).every((i) => stato.proprieta[i]?.proprietario === id);
}

/** Nella regione c'è almeno una casa o un albergo. */
export function regioneConEdifici(stato: Stato, regione: number): boolean {
  return caselleDellaRegione(tabellone(stato.mappa), regione).some((i) => (stato.proprieta[i]?.livello ?? 0) > 0);
}

/** Quante caselle dello stesso tipo possiede il proprietario, senza contare quelle ipotecate. */
function contaNonIpotecate(stato: Stato, id: IdGiocatore, tipo: 'stazione' | 'servizio'): number {
  const tab = tabellone(stato.mappa);
  return stato.proprieta.filter((p, i) => p?.proprietario === id && !p.ipotecata && tab.caselle[i]?.tipo === tipo).length;
}

/**
 * Affitto che paga chi si ferma sulla casella. 0 se è libera, ipotecata o se il proprietario
 * è in prigione con la regola attiva. Per i servizi serve la somma dei dadi.
 */
export function affitto(stato: Stato, casella: number, sommaDadi: number): number {
  const tab = tabellone(stato.mappa);
  const c = proprietabile(tab, casella);
  const p = stato.proprieta[casella];
  if (!c || !p || p.proprietario === null || p.ipotecata) return 0;
  const proprietario = giocatore(stato, p.proprietario);
  if (!proprietario) return 0;
  if (stato.impostazioni.nienteAffittoInPrigione && proprietario.prigione !== null) return 0;

  switch (c.tipo) {
    case 'citta': {
      const base = c.affitti[p.livello] ?? 0;
      const doppio =
        p.livello === 0 && stato.impostazioni.affittoDoppioSetCompleto && possiedeRegione(stato, proprietario.id, c.regione);
      return doppio ? base * 2 : base;
    }
    case 'stazione':
      return tab.affittiStazioni[contaNonIpotecate(stato, proprietario.id, 'stazione') - 1] ?? 0;
    case 'servizio':
      return (tab.moltiplicatoriServizi[contaNonIpotecate(stato, proprietario.id, 'servizio') - 1] ?? 0) * sommaDadi;
  }
}

/** Case e alberghi di un giocatore (un albergo non conta anche come 4 case). */
export function edifici(stato: Stato, id: IdGiocatore): { case: number; alberghi: number } {
  let nCase = 0;
  let alberghi = 0;
  for (const i of possedute(stato, id)) {
    const livello = stato.proprieta[i]!.livello;
    if (livello === LIVELLO_ALBERGO) alberghi++;
    else nCase += livello;
  }
  return { case: nCase, alberghi };
}

/** Quanto è costato costruire su una città fino al suo livello attuale. */
export function costoEdifici(tab: Tabellone, c: Citta, livello: number): number {
  const regione = tab.regioni[c.regione]!;
  if (livello === LIVELLO_ALBERGO) return 4 * regione.costoCasa + regione.costoAlbergo;
  return livello * regione.costoCasa;
}

/** Contante + prezzo delle proprietà non ipotecate + costo degli edifici + Carte Grazia. */
export function patrimonio(stato: Stato, id: IdGiocatore): number {
  const g = giocatore(stato, id);
  if (!g || g.eliminato) return 0;
  const tab = tabellone(stato.mappa);
  let totale = g.saldo + g.carteGrazia.length * VALORE_GRAZIA;
  for (const i of possedute(stato, id)) {
    const c = proprietabile(tab, i)!;
    const p = stato.proprieta[i]!;
    if (!p.ipotecata) totale += c.prezzo;
    if (c.tipo === 'citta') totale += costoEdifici(tab, c, p.livello);
  }
  return totale;
}

/**
 * Quanto ricava la banca dai beni di chi fa bancarotta, per pagarne i creditori:
 * metà prezzo delle proprietà non ipotecate, metà del costo degli edifici, 50 € per Carta Grazia.
 */
export function valoreLiquidazione(stato: Stato, id: IdGiocatore): number {
  const g = giocatore(stato, id);
  if (!g) return 0;
  const tab = tabellone(stato.mappa);
  let totale = g.carteGrazia.length * VALORE_GRAZIA;
  for (const i of possedute(stato, id)) {
    const c = proprietabile(tab, i)!;
    const p = stato.proprieta[i]!;
    if (!p.ipotecata) totale += Math.floor(c.prezzo / 2);
    if (c.tipo === 'citta') totale += Math.floor(costoEdifici(tab, c, p.livello) / 2);
  }
  return totale;
}

/** Quanto si ricava vendendo la proprietà alla banca: metà prezzo, niente se è ipotecata. */
export function valoreVendita(stato: Stato, casella: number): number {
  const c = proprietabile(tabellone(stato.mappa), casella);
  const p = stato.proprieta[casella];
  if (!c || !p || p.ipotecata) return 0;
  return Math.floor(c.prezzo / 2);
}
