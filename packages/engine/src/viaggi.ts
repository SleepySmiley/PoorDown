/*
 * Le regole del Giro del mondo: il biglietto aereo e la sfida a morra cinese.
 * - Il volo: invece di tirare i dadi si compra un biglietto per la casella che si vuole. Il prezzo va a fasce di
 *   distanza; il volo parte dall'aeroporto del lato, e se è di un avversario il biglietto lo incassa lui.
 *   In volo non si passa dalla Partenza, e sulla Partenza e su Vai in prigione non si atterra.
 * - La sfida: chi cade sulla proprietà di un avversario può pagare o sfidarlo a morra cinese. Vince: non paga.
 *   Perde: affitto doppio. Pareggio: affitto normale. Di media pagare e sfidare si equivalgono.
 * Il volo vero e proprio (spostamento e casella d'arrivo) lo esegue regole.ts, che conosce le caselle.
 */

import { errore, paga, type Contesto } from './contesto';
import { affitto, alleati, giocatore } from './conti';
import { tabellone } from './tabelloni';
import { fermaOrologio, riprendiOrologio } from './tempo';
import type { Errore, Giocatore, IdGiocatore, Segno, Stato, Tabellone } from './tipi';

/** Quanto ha lo sfidante per decidere se pagare o sfidare (conta anche il tempo dell'arrivo della pedina). */
export const SCELTA_MS = 15_000;
/** Quanto ha il proprietario per scegliere il suo segno. */
export const MORRA_MS = 10_000;

export const SEGNI: readonly Segno[] = ['sasso', 'carta', 'forbici'];

/** Il sasso spezza le forbici, le forbici tagliano la carta, la carta avvolge il sasso. */
const BATTE: Record<Segno, Segno> = { sasso: 'forbici', forbici: 'carta', carta: 'sasso' };

/** Com'è andata per chi ha lanciato la sfida (`mio`) contro il segno del proprietario (`suo`). */
export function esitoMorra(mio: Segno, suo: Segno): 'vinta' | 'persa' | 'pari' {
  if (mio === suo) return 'pari';
  return BATTE[mio] === suo ? 'vinta' : 'persa';
}

/* ------------------------------------------------------------------ */
/* Il biglietto                                                        */
/* ------------------------------------------------------------------ */

export interface Biglietto {
  prezzo: number;
  /** Caselle contate in avanti, da dove si è alla meta. */
  distanza: number;
  /** L'aeroporto del lato da cui si parte; `null` se su quel lato non ce n'è. */
  aeroporto: number | null;
  /** Chi incassa il biglietto: il proprietario dell'aeroporto, se è un avversario e l'aeroporto rende. `null` la banca. */
  incassa: IdGiocatore | null;
}

/** L'aeroporto del lato su cui si trova la casella: il volo parte da lì. `null` se su quel lato non ce n'è. */
export function aeroportoDelLato(tab: Tabellone, casella: number): number | null {
  const lato = tab.caselle.length / 4;
  const inizio = Math.floor(casella / lato) * lato;
  for (let i = inizio; i < inizio + lato; i++) if (tab.caselle[i]?.tipo === 'stazione') return i;
  return null;
}

/**
 * Il biglietto per volare da dove si trova `id` fino a `casella`; `null` sui tabelloni senza voli.
 * Con l'aeroporto proprio (o di un compagno) costa la metà; con il Biglietto omaggio è gratis.
 */
export function biglietto(s: Stato, id: IdGiocatore, casella: number): Biglietto | null {
  const tab = tabellone(s.mappa);
  const g = giocatore(s, id);
  if (!tab.viaggi || !g) return null;
  const n = tab.caselle.length;
  const distanza = (((casella - g.posizione) % n) + n) % n;
  const fasce = tab.viaggi.fasce;
  let prezzo = (fasce.find((f) => f.fino >= distanza) ?? fasce.at(-1)!).prezzo;
  let incassa: IdGiocatore | null = null;
  const aeroporto = aeroportoDelLato(tab, g.posizione);
  const proprietario = aeroporto === null ? null : (s.proprieta[aeroporto]?.proprietario ?? null);
  if (aeroporto !== null && proprietario !== null) {
    if (alleati(s, proprietario, id)) prezzo = Math.floor(prezzo / 2);
    // Come l'affitto: niente se l'aeroporto è ipotecato o il proprietario è in prigione con la regola attiva.
    else if (affitto(s, aeroporto, 0) > 0) incassa = proprietario;
  }
  if (s.turno.voloOmaggio && s.turno.giocatore === id) return { prezzo: 0, distanza, aeroporto, incassa: null };
  return { prezzo, distanza, aeroporto, incassa };
}

/** Si può volare su `casella` adesso? Controlla solo la meta e il prezzo: il momento del turno lo controlla regole.ts. */
export function verificaMeta(s: Stato, g: Giocatore, casella: number): Errore | null {
  const tab = tabellone(s.mappa);
  if (!Number.isInteger(casella) || casella < 0 || casella >= tab.caselle.length) {
    return errore('meta_non_valida', 'Questa casella non esiste.');
  }
  if (casella === g.posizione) return errore('meta_non_valida', 'Sei già qui.');
  const tipo = tab.caselle[casella]!.tipo;
  if (tipo === 'partenza' || tipo === 'vai_in_prigione') {
    return errore('meta_non_valida', 'Sulla Partenza e su Vai in prigione non si atterra.');
  }
  const b = biglietto(s, g.id, casella);
  if (!b) return errore('niente_voli', 'Su questo tabellone non si vola.');
  if (g.saldo < b.prezzo) return errore('soldi_insufficienti', 'Non hai abbastanza soldi per il biglietto.');
  return null;
}

/* ------------------------------------------------------------------ */
/* La sfida a morra cinese                                             */
/* ------------------------------------------------------------------ */

/** Chi gioca è caduto sulla proprietà di un avversario: invece di pagare subito, decide se pagare o sfidarlo. */
export function apriSfida(ctx: Contesto, g: Giocatore, proprietario: IdGiocatore, casella: number, importo: number): void {
  ctx.s.sfida = { sfidante: g.id, proprietario, casella, importo, fase: 'scelta', segno: null, scadenza: ctx.adesso + SCELTA_MS };
  // Come all'asta, intanto l'orologio del turno è fermo.
  fermaOrologio(ctx.s, ctx.adesso);
}

/** Le azioni della sfida: pagare o sfidare tocca allo sfidante, il segno di risposta al proprietario. */
export function verificaSfida(s: Stato, g: Giocatore, tipo: 'paga_affitto' | 'sfida' | 'morra', segno?: Segno): Errore | null {
  const sf = s.sfida;
  if (!sf) return errore('niente_sfida', 'Non c’è nessun affitto da decidere.');
  if (segno !== undefined && !SEGNI.includes(segno)) return errore('segno_non_valido', 'Si gioca con sasso, carta o forbici.');
  if (tipo === 'morra') {
    return sf.fase === 'morra' && sf.proprietario === g.id ? null : errore('non_tua_sfida', 'Non tocca a te scegliere il segno.');
  }
  return sf.fase === 'scelta' && sf.sfidante === g.id ? null : errore('non_tua_sfida', 'Non tocca a te decidere.');
}

function segnoACaso(ctx: Contesto): Segno {
  return SEGNI[ctx.caso.intero(SEGNI.length)]!;
}

/** Lo sfidante lancia la sfida con il suo segno (a caso se non lo dice). Ora tocca al proprietario. */
export function lanciaSfida(ctx: Contesto, segno?: Segno): void {
  const sf = ctx.s.sfida!;
  sf.fase = 'morra';
  sf.segno = segno ?? segnoACaso(ctx);
  sf.scadenza = ctx.adesso + MORRA_MS;
  ctx.eventi.push({ tipo: 'sfida', da: sf.sfidante, a: sf.proprietario, casella: sf.casella, importo: sf.importo });
}

/**
 * Il proprietario risponde (a caso se non dice il segno, o se è scaduto il tempo: `scaduta`) e la morra si chiude:
 * vince lo sfidante e non paga, perde e paga il doppio, pareggia e paga l'affitto normale.
 */
export function giocaMorra(ctx: Contesto, segno?: Segno, scaduta = false): void {
  const sf = ctx.s.sfida!;
  const mio = sf.segno!;
  const suo = segno ?? segnoACaso(ctx);
  const esito = esitoMorra(mio, suo);
  const importo = esito === 'vinta' ? 0 : esito === 'persa' ? 2 * sf.importo : sf.importo;
  ctx.eventi.push({
    tipo: 'morra',
    da: sf.sfidante,
    a: sf.proprietario,
    casella: sf.casella,
    segni: [mio, suo],
    esito,
    importo,
    ...(scaduta ? { aCaso: sf.proprietario } : {}),
  });
  chiudiSfida(ctx, importo);
}

/** Chiude la sfida e lo sfidante paga `importo` al proprietario (se sono ancora in gioco tutti e due). */
export function chiudiSfida(ctx: Contesto, importo: number): void {
  const sf = ctx.s.sfida;
  if (!sf) return;
  ctx.s.sfida = null;
  riprendiOrologio(ctx.s, ctx.adesso);
  const da = giocatore(ctx.s, sf.sfidante);
  const a = giocatore(ctx.s, sf.proprietario);
  if (importo <= 0 || !da || da.eliminato || !a || a.eliminato) return;
  ctx.eventi.push({ tipo: 'affitto', da: da.id, a: a.id, casella: sf.casella, importo });
  paga(ctx, da, a.id, importo);
}

/** È scaduto il tempo: chi doveva decidere paga l'affitto normale; il proprietario che non ha scelto gioca a caso. */
export function scadenzaSfida(ctx: Contesto): void {
  const sf = ctx.s.sfida;
  if (!sf) return;
  if (sf.fase === 'scelta') chiudiSfida(ctx, sf.importo);
  else giocaMorra(ctx, undefined, true);
}

/** Chi esce dalla partita durante una sfida (da sfidante o da sfidato): la sfida si chiude e nessuno paga. */
export function annullaSfida(s: Stato, id: IdGiocatore, adesso: number): void {
  if (!s.sfida || (s.sfida.sfidante !== id && s.sfida.proprietario !== id)) return;
  s.sfida = null;
  riprendiOrologio(s, adesso);
}
