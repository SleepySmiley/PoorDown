/*
 * Il cosmo delle regole folli (tabellone Sistema solare): a ogni giro un evento cosmico, il Mercato galattico
 * e un po' di soldi nel malloppo della Supernova, più la Partenza a caso. Le caselle speciali e l'affitto quantistico
 * stanno in regole.ts, dove si arriva sulle caselle.
 * Un giro comincia quando il turno torna al primo giocatore dell'ordine; il primo giro è tranquillo.
 */

import { compagni, prezzoAcquisto, proprietabile, regioneConEdifici } from './conti';
import type { Contesto } from './contesto';
import type { Cosmo, EventoCosmico, FacciaCosmica, Giocatore, IdGiocatore, Stato, Tabellone } from './tipi';

/** Il cosmo di una partita nuova, oppure `undefined` se il tabellone non ha le regole folli. */
export function cosmoIniziale(tab: Tabellone): Cosmo | undefined {
  if (!tab.follie) return undefined;
  return { giro: 1, evento: 'quiete', mercato: null, malloppo: tab.follie.malloppo, verso: 1, dado: null, faro: null };
}

/**
 * Il dado cosmico: si tira a ogni lancio, insieme ai due dadi, e la faccia vale per quel tiro (`Cosmo.dado`).
 * È truccato: ogni faccia esce secondo il suo peso. `null` sui tabelloni senza regole folli.
 */
export function tiraDadoCosmico(ctx: Contesto): FacciaCosmica | null {
  const facce = ctx.tab.follie?.dadoCosmico;
  const cosmo = ctx.s.cosmo;
  if (!facce?.length || !cosmo) return null;
  let resto = ctx.caso.intero(facce.reduce((t, f) => t + f.peso, 0));
  for (const { faccia, peso } of facce) {
    if (resto < peso) {
      cosmo.dado = faccia;
      return faccia;
    }
    resto -= peso;
  }
  return null;
}

/**
 * Gli effetti del dado cosmico prima della mossa: Bandiera (una proprietà gratis) e Faro (affitti doppi fino al prossimo
 * turno di chi l'ha acceso). Razzo e Iperspazio cambiano la mossa (regole.ts), Saldi e Scudo i conti (conti.ts, regole.ts).
 */
export function effettoDadoCosmico(ctx: Contesto, g: Giocatore, faccia: FacciaCosmica): void {
  const { s } = ctx;
  ctx.eventi.push({ tipo: 'dado_cosmico', giocatore: g.id, faccia });
  if (faccia === 'faro' && s.cosmo) s.cosmo.faro = g.id;
  if (faccia === 'bandiera') {
    const casella = piuEconomicaLibera(ctx);
    if (casella === null) return;
    s.proprieta[casella]!.proprietario = g.id;
    ctx.eventi.push({ tipo: 'bandiera', giocatore: g.id, casella });
  }
}

/** La proprietà libera che costa meno adesso (a pari prezzo la prima del tabellone), `null` se sono tutte vendute. */
function piuEconomicaLibera(ctx: Contesto): number | null {
  let migliore: number | null = null;
  ctx.tab.caselle.forEach((_, i) => {
    if (!proprietabile(ctx.tab, i) || ctx.s.proprieta[i]?.proprietario !== null) return;
    if (migliore === null || prezzoAcquisto(ctx.s, i) < prezzoAcquisto(ctx.s, migliore)) migliore = i;
  });
  return migliore;
}

/** La prossima proprietà libera da `da` nel verso di marcia, compresa quella dove si è; `null` se sono tutte vendute. */
export function prossimaLibera(ctx: Contesto, da: number, verso: 1 | -1): number | null {
  const n = ctx.tab.caselle.length;
  for (let i = 0; i < n; i++) {
    const casella = (((da + verso * i) % n) + n) % n;
    if (proprietabile(ctx.tab, casella) && ctx.s.proprieta[casella]?.proprietario === null) return casella;
  }
  return null;
}

/** Un numero a caso tra `min` e `max` a passi di `passo`. */
function aCaso(ctx: Contesto, min: number, max: number, passo: number): number {
  return min + passo * ctx.caso.intero(Math.floor((max - min) / passo) + 1);
}

/**
 * Il premio della Partenza. Con le regole folli è a caso, e con la Tempesta solare non va a chi passa
 * ma nel malloppo della Supernova (`allaStella`); altrimenti quello fisso del tabellone.
 */
export function premioPartenza(ctx: Contesto, arrivo: boolean): { importo: number; tempesta: boolean; allaStella: number } {
  const f = ctx.tab.follie;
  if (!f) return { importo: arrivo ? ctx.tab.partenza.arrivo : ctx.tab.partenza.passaggio, tempesta: false, allaStella: 0 };
  const p = f.partenza;
  const premio = aCaso(ctx, p.min, p.max, p.passo) + (arrivo ? p.arrivo : 0);
  if (ctx.s.cosmo?.evento === 'tempesta') return { importo: 0, tempesta: true, allaStella: premio };
  return { importo: premio, tempesta: false, allaStella: 0 };
}

/** Il malloppo della Supernova cresce: i soldi li mette la banca, nessuno li perde. */
export function caricaStella(
  ctx: Contesto,
  motivo: 'giro' | 'polvere' | 'tempesta',
  importo: number,
  giocatore: IdGiocatore | null = null,
): void {
  const cosmo = ctx.s.cosmo;
  if (!cosmo || importo <= 0) return;
  cosmo.malloppo += importo;
  ctx.eventi.push({ tipo: 'malloppo', motivo, importo, giocatore });
}

/** Comincia un giro nuovo: estrae l'evento cosmico e il pianeta del Mercato galattico, e applica gli eventi immediati. */
export function giroCosmico(ctx: Contesto): void {
  const { s, tab } = ctx;
  const f = tab.follie;
  const cosmo = s.cosmo;
  if (!f || !cosmo) return;
  cosmo.giro++;
  cosmo.verso = 1;
  let evento: EventoCosmico = f.eventi[ctx.caso.intero(f.eventi.length)]!;
  // Gli eventi che non trovano niente da colpire diventano quiete (niente case: niente meteoriti).
  const meteorite = evento === 'meteoriti' ? bersaglioMeteorite(ctx) : null;
  const collisione = evento === 'collisione' ? coppiaCollisione(ctx) : null;
  if ((evento === 'meteoriti' && !meteorite) || (evento === 'collisione' && !collisione)) evento = 'quiete';
  cosmo.evento = evento;
  cosmo.mercato = { regione: ctx.caso.intero(tab.regioni.length), fattore: f.mercato[ctx.caso.intero(f.mercato.length)]! };
  if (evento === 'gravita') cosmo.verso = -1;
  ctx.eventi.push({ tipo: 'cosmo', giro: cosmo.giro, evento, mercato: cosmo.mercato });

  if (meteorite !== null) {
    const p = s.proprieta[meteorite]!;
    p.livello--;
    ctx.eventi.push({ tipo: 'meteorite', giocatore: p.proprietario!, casella: meteorite, livello: p.livello });
  }
  if (collisione) {
    const [a, b] = collisione;
    const pa = s.proprieta[a]!;
    const pb = s.proprieta[b]!;
    const giocatori: [string, string] = [pa.proprietario!, pb.proprietario!];
    pa.proprietario = giocatori[1];
    pb.proprietario = giocatori[0];
    ctx.eventi.push({ tipo: 'collisione', caselle: [a, b], giocatori });
  }
  caricaStella(ctx, 'giro', f.crescitaGiro);
}

/**
 * Dove cade il meteorite: una regione a caso tra quelle con edifici, e lì la città con più edifici,
 * perché le case restino distribuite in modo uniforme (come quando si vendono).
 */
function bersaglioMeteorite(ctx: Contesto): number | null {
  const { s, tab } = ctx;
  const regioni = [...new Set(tab.caselle.flatMap((c, i) => (c.tipo === 'citta' && (s.proprieta[i]?.livello ?? 0) > 0 ? [c.regione] : [])))];
  if (regioni.length === 0) return null;
  return piuCostruita(s, tab, regioni[ctx.caso.intero(regioni.length)]!);
}

function piuCostruita(s: Stato, tab: Tabellone, regione: number): number {
  let migliore = -1;
  tab.caselle.forEach((c, i) => {
    if (c.tipo !== 'citta' || c.regione !== regione) return;
    if (migliore < 0 || (s.proprieta[i]?.livello ?? 0) > (s.proprieta[migliore]?.livello ?? 0)) migliore = i;
  });
  return migliore;
}

/**
 * Le due proprietà della Collisione planetaria: di proprietari diversi e non compagni, senza edifici nella loro regione
 * (con le case dentro le regole di vendita si incastrerebbero). `null` se non ce ne sono due così.
 */
function coppiaCollisione(ctx: Contesto): [number, number] | null {
  const { s, tab } = ctx;
  const libere = s.proprieta.flatMap((p, i) => {
    if (!p?.proprietario) return [];
    const c = proprietabile(tab, i);
    if (!c || (c.tipo === 'citta' && regioneConEdifici(s, c.regione))) return [];
    return [i];
  });
  if (libere.length < 2) return null;
  const prima = libere[ctx.caso.intero(libere.length)]!;
  const chi = s.proprieta[prima]!.proprietario!;
  const altre = libere.filter((i) => {
    const altro = s.proprieta[i]!.proprietario!;
    return altro !== chi && !compagni(s, chi, altro);
  });
  if (altre.length === 0) return null;
  return [prima, altre[ctx.caso.intero(altre.length)]!];
}
