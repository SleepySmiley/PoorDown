/*
 * Case e alberghi, ipoteche e aste: docs/analisi/04-economia-fine-partita.md §3, §5, §6.
 * Ogni regola ha il suo controllo (`verifica…`, che restituisce il motivo del rifiuto) e la sua esecuzione.
 * I controlli comuni (partita in corso, turno, asta già aperta) li fa `verifica` in regole.ts.
 */

import { accredita, errore, type Contesto } from './contesto';
import {
  caselleDellaRegione,
  costoProssimoEdificio,
  costoRiscatto,
  giocatore,
  LIVELLO_ALBERGO,
  possiedeRegione,
  proprietabile,
  regioneConEdifici,
  regioneIpotecata,
  rimborsoEdificio,
  valoreIpoteca,
} from './conti';
import { tabellone } from './tabelloni';
import type { Citta, Errore, Giocatore, Stato } from './tipi';

/** Quanto dura un'asta, e quanto tempo resta dopo ogni offerta. */
export const ASTA_MS = 10_000;
/** I rilanci proposti dai pulsanti dell'asta. */
export const RILANCI = [2, 10, 100] as const;
/** Offerte conservate per l'elenco dell'asta. */
const OFFERTE_MOSTRATE = 20;

const NON_TUA = errore('non_tua', 'Questa proprietà non è tua.');

/** La città del giocatore, oppure il motivo per cui non lo è. */
function cittaMia(stato: Stato, g: Giocatore, casella: number): Citta | Errore {
  const c = proprietabile(tabellone(stato.mappa), casella);
  if (!c || stato.proprieta[casella]?.proprietario !== g.id) return NON_TUA;
  if (c.tipo !== 'citta') return errore('non_costruibile', 'Case e alberghi si costruiscono solo sulle città.');
  return c;
}

/** Livelli delle altre città della stessa regione. */
function altriLivelli(stato: Stato, c: Citta, casella: number): number[] {
  return caselleDellaRegione(tabellone(stato.mappa), c.regione)
    .filter((i) => i !== casella)
    .map((i) => stato.proprieta[i]?.livello ?? 0);
}

/* ------------------------ Case e alberghi -------------------------- */

export function verificaCostruzione(stato: Stato, g: Giocatore, casella: number): Errore | null {
  const c = cittaMia(stato, g, casella);
  if ('codice' in c) return c;
  const livello = stato.proprieta[casella]!.livello;
  if (!possiedeRegione(stato, g.id, c.regione)) {
    return errore('regione_incompleta', 'Per costruire devi avere tutte le città della regione.');
  }
  if (regioneIpotecata(stato, c.regione)) {
    return errore('regione_ipotecata', 'Non puoi costruire in una regione con una città ipotecata.');
  }
  if (livello >= LIVELLO_ALBERGO) return errore('livello_massimo', 'Questa città ha già l’albergo.');
  if (stato.impostazioni.costruzioneUniforme && altriLivelli(stato, c, casella).some((l) => l < livello)) {
    return errore(
      'costruzione_uniforme',
      'Costruzione uniforme: prima porta le altre città della regione allo stesso numero di case.',
    );
  }
  if (g.saldo < costoProssimoEdificio(tabellone(stato.mappa), c, livello)) {
    return errore('soldi_insufficienti', 'Non hai abbastanza soldi.');
  }
  return null;
}

export function costruisci(ctx: Contesto, g: Giocatore, casella: number): void {
  const p = ctx.s.proprieta[casella]!;
  const c = proprietabile(ctx.tab, casella) as Citta;
  const costo = costoProssimoEdificio(ctx.tab, c, p.livello);
  g.saldo -= costo;
  p.livello++;
  ctx.eventi.push({ tipo: 'costruzione', giocatore: g.id, casella, livello: p.livello, costo });
}

export function verificaDemolizione(stato: Stato, g: Giocatore, casella: number): Errore | null {
  const c = cittaMia(stato, g, casella);
  if ('codice' in c) return c;
  const livello = stato.proprieta[casella]!.livello;
  if (livello === 0) return errore('livello_minimo', 'Su questa città non ci sono edifici da vendere.');
  if (stato.impostazioni.costruzioneUniforme && altriLivelli(stato, c, casella).some((l) => l > livello)) {
    return errore(
      'costruzione_uniforme',
      'Costruzione uniforme: prima vendi gli edifici delle città della regione che ne hanno di più.',
    );
  }
  return null;
}

/** L'albergo torna a quattro case; ogni edificio venduto rende metà del suo costo. */
export function demolisci(ctx: Contesto, g: Giocatore, casella: number): void {
  const p = ctx.s.proprieta[casella]!;
  const c = proprietabile(ctx.tab, casella) as Citta;
  const importo = rimborsoEdificio(ctx.tab, c, p.livello);
  p.livello--;
  ctx.eventi.push({ tipo: 'demolizione', giocatore: g.id, casella, livello: p.livello, importo });
  accredita(ctx, g, importo);
}

/* ---------------------------- Ipoteche ----------------------------- */

export function verificaIpoteca(stato: Stato, g: Giocatore, casella: number): Errore | null {
  if (!stato.impostazioni.ipoteche) {
    return errore('ipoteche_disattivate', 'In questa partita le ipoteche non sono attive.');
  }
  const c = proprietabile(tabellone(stato.mappa), casella);
  const p = stato.proprieta[casella];
  if (!c || p?.proprietario !== g.id) return NON_TUA;
  if (p.ipotecata) return errore('gia_ipotecata', 'Questa proprietà è già ipotecata.');
  if (c.tipo === 'citta' && regioneConEdifici(stato, c.regione)) {
    return errore('edifici_nella_regione', 'Prima vendi le case e gli alberghi di questa regione.');
  }
  return null;
}

export function ipoteca(ctx: Contesto, g: Giocatore, casella: number): void {
  const importo = valoreIpoteca(ctx.tab, casella);
  ctx.s.proprieta[casella]!.ipotecata = true;
  ctx.eventi.push({ tipo: 'ipoteca', giocatore: g.id, casella, importo });
  accredita(ctx, g, importo);
}

export function verificaRiscatto(stato: Stato, g: Giocatore, casella: number): Errore | null {
  const tab = tabellone(stato.mappa);
  const p = stato.proprieta[casella];
  if (!proprietabile(tab, casella) || p?.proprietario !== g.id) return NON_TUA;
  if (!p.ipotecata) return errore('non_ipotecata', 'Questa proprietà non è ipotecata.');
  if (g.saldo < costoRiscatto(tab, casella)) {
    return errore('soldi_insufficienti', 'Non hai abbastanza soldi per togliere l’ipoteca.');
  }
  return null;
}

export function riscatta(ctx: Contesto, g: Giocatore, casella: number): void {
  const importo = costoRiscatto(ctx.tab, casella);
  g.saldo -= importo;
  ctx.s.proprieta[casella]!.ipotecata = false;
  ctx.eventi.push({ tipo: 'riscatto', giocatore: g.id, casella, importo });
}

/* ------------------------------ Aste ------------------------------- */

/** La casella libera su cui il giocatore di turno si è fermato e che non ha ancora comprato. */
export function acquistoInSospeso(stato: Stato): number | null {
  const n = stato.turno.acquisto;
  return n !== null && stato.proprieta[n]?.proprietario === null ? n : null;
}

export function verificaApertura(stato: Stato): Errore | null {
  if (!stato.impostazioni.aste) return errore('aste_disattivate', 'In questa partita le aste non sono attive.');
  if (acquistoInSospeso(stato) === null) return errore('niente_da_comprare', 'Non c’è niente da mettere all’asta.');
  return null;
}

export function apriAsta(ctx: Contesto, g: Giocatore): void {
  const casella = acquistoInSospeso(ctx.s)!;
  ctx.s.turno.acquisto = null;
  ctx.s.asta = { casella, giocatore: g.id, migliore: null, offerte: [], scadenza: ctx.adesso + ASTA_MS };
  // Durante l'asta l'orologio del turno è fermo.
  ctx.s.turno.tempo.fermoDa ??= ctx.adesso;
  ctx.eventi.push({ tipo: 'asta', giocatore: g.id, casella });
}

/** Chiunque sia ancora in gioco può offrire, anche fuori turno e anche chi ha aperto l'asta. */
export function verificaOfferta(stato: Stato, g: Giocatore, importo: number): Errore | null {
  const asta = stato.asta;
  if (!asta) return errore('niente_asta', 'Non c’è nessuna asta in corso.');
  if (asta.migliore?.giocatore === g.id) return errore('offerta_tua', 'La tua è già l’offerta più alta.');
  if (!Number.isInteger(importo) || importo <= (asta.migliore?.importo ?? 0)) {
    return errore('offerta_bassa', 'Qualcuno ha appena offerto di più: rilancia.');
  }
  if (g.saldo < importo) return errore('soldi_insufficienti', 'Non hai abbastanza soldi.');
  return null;
}

/** Ogni offerta riporta il conto alla rovescia a 10 secondi. */
export function offri(ctx: Contesto, g: Giocatore, importo: number): void {
  const asta = ctx.s.asta!;
  asta.migliore = { giocatore: g.id, importo };
  asta.offerte = [{ giocatore: g.id, importo }, ...asta.offerte].slice(0, OFFERTE_MOSTRATE);
  asta.scadenza = ctx.adesso + ASTA_MS;
}

/**
 * Chiude l'asta: chi ha offerto di più compra, se è ancora in gioco e ha ancora i soldi
 * (nel frattempo può averli spesi in uno scambio). Altrimenti la proprietà resta libera.
 */
export function chiudiAsta(ctx: Contesto): void {
  const { s } = ctx;
  const asta = s.asta;
  if (!asta) return;
  s.asta = null;
  // L'orologio del turno riparte da dove si era fermato.
  const tempo = s.turno.tempo;
  if (tempo.fermoDa !== null) {
    tempo.inizio += Math.max(0, ctx.adesso - tempo.fermoDa);
    tempo.fermoDa = null;
  }
  const migliore = asta.migliore;
  const vincitore = migliore ? giocatore(s, migliore.giocatore) : undefined;
  const p = s.proprieta[asta.casella]!;
  if (migliore && vincitore && !vincitore.eliminato && vincitore.saldo >= migliore.importo && p.proprietario === null) {
    vincitore.saldo -= migliore.importo;
    p.proprietario = vincitore.id;
    ctx.eventi.push({ tipo: 'asta_vinta', giocatore: vincitore.id, casella: asta.casella, importo: migliore.importo });
  } else {
    ctx.eventi.push({ tipo: 'asta_deserta', casella: asta.casella, offerente: migliore?.giocatore ?? null });
  }
}
