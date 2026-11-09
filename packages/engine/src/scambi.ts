/*
 * Scambi tra giocatori: docs/analisi/04-economia-fine-partita.md §4.
 * Si scambiano soldi, proprietà (anche ipotecate, che restano tali) e Carte Grazia, in qualunque momento,
 * anche fuori turno. Lo stesso controllo serve quando si propone, quando si accetta e all'interfaccia,
 * che mostra i motivi per cui uno scambio non si può fare.
 */

import { accredita, errore, type Contesto } from './contesto';
import {
  compagni,
  giocatore,
  patrimonio,
  possiedeRegione,
  proprietabile,
  regioneConEdifici,
  valoreLiquidazione,
  VALORE_GRAZIA,
} from './conti';
import { tabellone } from './tabelloni';
import type { Azione, Errore, Giocatore, IdGiocatore, Pacchetto, Scambio, Stato } from './tipi';

/** Scambi aperti che ognuno può aver proposto nello stesso momento. */
export const SCAMBI_APERTI_MAX = 10;
/** Proposte in attesa verso lo stesso giocatore. */
export const PROPOSTE_IN_ATTESA_MAX = 5;
export const NOTA_MAX = 200;
/** Stanze pubbliche: nessuno può cedere, al netto, più del 90% di quello che ha. */
const SBILANCIO_MAX = 0.9;

export const PACCHETTO_VUOTO: Readonly<Pacchetto> = Object.freeze({ soldi: 0, caselle: [], grazie: [] });

/** Lo scambio da controllare: proposto (con le ipoteche di quel momento) o ancora da proporre. */
export type BozzaScambio = Pick<Scambio, 'da' | 'a' | 'dare' | 'avere'> & { ipotecate?: number[] };

export function pacchettoVuoto(p: Pacchetto): boolean {
  return p.soldi === 0 && p.caselle.length === 0 && p.grazie.length === 0;
}

/** Le caselle dello scambio che adesso sono ipotecate. */
export function caselleIpotecate(stato: Stato, bozza: BozzaScambio): number[] {
  return [...bozza.dare.caselle, ...bozza.avere.caselle].filter((i) => stato.proprieta[i]?.ipotecata === true).sort((x, y) => x - y);
}

/**
 * Valore di un pacchetto a prezzo di listino: soldi, prezzo delle proprietà non ipotecate, Carte Grazia.
 * Serve alla regola sugli scambi sbilanciati e al riepilogo dell'interfaccia.
 */
export function valorePacchetto(stato: Stato, p: Pacchetto): number {
  const tab = tabellone(stato.mappa);
  let totale = p.soldi + p.grazie.length * VALORE_GRAZIA;
  for (const i of p.caselle) if (!stato.proprieta[i]?.ipotecata) totale += proprietabile(tab, i)?.prezzo ?? 0;
  return totale;
}

/** Quanto il giocatore deve agli altri giocatori. Il rosso verso la banca non conta: non lo incassa nessuno. */
function debito(stato: Stato, id: IdGiocatore): number {
  return giocatore(stato, id)!.debiti.reduce((t, d) => t + d.importo, 0);
}

/** Quello che il giocatore potrebbe restituire ai creditori se fallisse: il debito, fino al valore dei suoi beni. */
function restituibile(stato: Stato, id: IdGiocatore): number {
  return Math.min(debito(stato, id), valoreLiquidazione(stato, id));
}

/**
 * Lo scambio non toglie niente ai creditori: quello che incassano subito (il debito che scende)
 * più quello che potrebbero recuperare dopo non è meno di quello che potevano recuperare prima.
 */
function riduceRestituibile(prima: Stato, dopo: Stato, id: IdGiocatore): boolean {
  const incassato = debito(prima, id) - debito(dopo, id);
  return incassato + restituibile(dopo, id) < restituibile(prima, id);
}

/** Problemi di una delle due parti: `chi` dà `p`. */
function problemiParte(stato: Stato, chi: Giocatore | undefined, id: IdGiocatore, p: Pacchetto, ipotecate?: number[]): string[] {
  if (!chi || chi.eliminato) return [`${chi?.nome ?? 'Un giocatore'} non partecipa più alla partita.`];
  const tab = tabellone(stato.mappa);
  const out: string[] = [];
  if (!Number.isInteger(p.soldi) || p.soldi < 0) out.push(`${chi.nome} ha offerto una cifra non valida.`);
  else if (p.soldi > 0 && chi.saldo < p.soldi) out.push(`${chi.nome} non ha abbastanza soldi per questo scambio.`);

  if (new Set(p.caselle).size !== p.caselle.length || p.caselle.some((i) => !proprietabile(tab, i))) {
    out.push(`Alcune proprietà scelte per ${chi.nome} non si possono scambiare.`);
  } else {
    if (p.caselle.some((i) => stato.proprieta[i]?.proprietario !== id)) {
      out.push(`${chi.nome} non possiede più tutte le proprietà scelte.`);
    }
    const regioni = new Set(p.caselle.map((i) => proprietabile(tab, i)).flatMap((c) => (c?.tipo === 'citta' ? [c.regione] : [])));
    if ([...regioni].some((r) => regioneConEdifici(stato, r))) {
      out.push(`${chi.nome} vuole scambiare città di una regione con case o alberghi: prima vanno vendute.`);
    }
    if (ipotecate && p.caselle.some((i) => stato.proprieta[i]?.ipotecata && !ipotecate.includes(i))) {
      out.push(`Nel frattempo ${chi.nome} ha ipotecato una delle proprietà dello scambio.`);
    }
  }

  const tenute = [...chi.carteGrazia];
  for (const mazzo of p.grazie) {
    const i = tenute.indexOf(mazzo);
    if (i === -1) {
      out.push(`${chi.nome} non ha più la Carta Grazia scelta.`);
      break;
    }
    tenute.splice(i, 1);
  }
  return out;
}

/**
 * Perché lo scambio non si può fare, in frasi da mostrare. Elenco vuoto: si può fare.
 * Oltre alle regole di base valgono due regole di equità, che non contano tra compagni di squadra:
 * - chi è in debito verso altri giocatori non può ridurre quello che potrebbe restituire loro (salvo scambiando
 *   con un suo creditore); il rosso verso la banca da solo non blocca niente;
 * - nelle stanze pubbliche nessuno può cedere, al netto, più del 90% di quello che ha.
 */
export function problemiScambio(stato: Stato, bozza: BozzaScambio): string[] {
  if (bozza.da === bozza.a) return ['Non puoi fare uno scambio con te stesso.'];
  const da = giocatore(stato, bozza.da);
  const a = giocatore(stato, bozza.a);
  const out = [
    ...problemiParte(stato, da, bozza.da, bozza.dare, bozza.ipotecate),
    ...problemiParte(stato, a, bozza.a, bozza.avere, bozza.ipotecate),
  ];
  if (pacchettoVuoto(bozza.dare) && pacchettoVuoto(bozza.avere)) out.push('Lo scambio è vuoto.');
  if (out.length > 0 || !da || !a) return out;

  if (compagni(stato, da.id, a.id)) return out;
  const dopo = simula(stato, bozza);
  for (const [chi, altro] of [
    [da, a],
    [a, da],
  ] as const) {
    if (chi.debiti.length === 0 || chi.debiti.some((d) => d.creditore === altro.id)) continue;
    if (riduceRestituibile(stato, dopo, chi.id)) {
      out.push(`${chi.nome} è in debito: uno scambio non può ridurre quello che potrà restituire.`);
    }
  }

  if (!stato.impostazioni.stanzaPrivata) {
    for (const [chi, dato, ricevuto] of [
      [da, bozza.dare, bozza.avere],
      [a, bozza.avere, bozza.dare],
    ] as const) {
      const ceduto = valorePacchetto(stato, dato) - valorePacchetto(stato, ricevuto);
      if (ceduto > SBILANCIO_MAX * (patrimonio(stato, chi.id) + Math.max(0, -chi.saldo))) {
        out.push('Questo scambio è troppo sbilanciato.');
        break;
      }
    }
  }
  return out;
}

/** Lo stato dopo lo scambio, su una copia: serve alle regole di equità. */
function simula(stato: Stato, bozza: BozzaScambio): Stato {
  const s = JSON.parse(JSON.stringify(stato)) as Stato;
  const ctx: Contesto = { s, tab: tabellone(s.mappa), caso: { intero: () => 0 }, adesso: 0, eventi: [], turnoFinito: false };
  trasferisci(ctx, bozza);
  return s;
}

/** Passano i soldi nei due versi (chi è in debito paga prima i creditori), le proprietà e le Carte Grazia. */
function trasferisci(ctx: Contesto, bozza: BozzaScambio): void {
  const da = giocatore(ctx.s, bozza.da)!;
  const a = giocatore(ctx.s, bozza.a)!;
  da.saldo -= bozza.dare.soldi;
  a.saldo -= bozza.avere.soldi;
  accredita(ctx, a, bozza.dare.soldi);
  accredita(ctx, da, bozza.avere.soldi);
  for (const [chi, verso, p] of [
    [da, a, bozza.dare],
    [a, da, bozza.avere],
  ] as const) {
    for (const i of p.caselle) ctx.s.proprieta[i]!.proprietario = verso.id;
    for (const mazzo of p.grazie) {
      chi.carteGrazia.splice(chi.carteGrazia.indexOf(mazzo), 1);
      verso.carteGrazia.push(mazzo);
    }
  }
}

/* ---------------------------- Effetti ------------------------------ */

/**
 * Che cosa cambia nel gioco se lo scambio va in porto:
 * - `completa`: dopo lo scambio il giocatore (con i compagni di squadra) ha tutte le città della regione, prima no;
 * - `rompe`: prima le aveva tutte, dopo no;
 * - `stazioni`, `servizi`: quante ne ha il giocatore prima e dopo, solo se il numero cambia.
 * `regione` è l'indice in `tabellone.regioni`.
 */
export type EffettoScambio =
  | { tipo: 'completa' | 'rompe'; giocatore: IdGiocatore; regione: number }
  | { tipo: 'stazioni' | 'servizi'; giocatore: IdGiocatore; prima: number; dopo: number };

const ORDINE_EFFETTI: Record<EffettoScambio['tipo'], number> = { completa: 0, rompe: 1, stazioni: 2, servizi: 3 };

/**
 * Gli effetti dello scambio sulle regioni, le stazioni e i servizi delle due parti, per l'interfaccia.
 * In ordine di importanza: regioni completate, regioni rotte, stazioni, servizi; a parità prima chi propone.
 * Guarda solo i possessi: che lo scambio si possa fare lo dice `problemiScambio`.
 */
export function effettiScambio(stato: Stato, bozza: BozzaScambio): EffettoScambio[] {
  const tab = tabellone(stato.mappa);
  // Basta copiare i possessi: gli effetti non dipendono dai soldi.
  const dopo: Stato = { ...stato, proprieta: stato.proprieta.map((p) => (p ? { ...p } : p)) };
  for (const [p, verso] of [
    [bozza.dare, bozza.a],
    [bozza.avere, bozza.da],
  ] as const) {
    for (const i of p.caselle) {
      const proprieta = dopo.proprieta[i];
      if (proprieta) proprieta.proprietario = verso;
    }
  }

  const regioni = new Set<number>();
  for (const i of [...bozza.dare.caselle, ...bozza.avere.caselle]) {
    const c = proprietabile(tab, i);
    if (c?.tipo === 'citta') regioni.add(c.regione);
  }
  const quante = (s: Stato, id: IdGiocatore, tipo: 'stazione' | 'servizio') =>
    s.proprieta.filter((p, i) => p?.proprietario === id && tab.caselle[i]?.tipo === tipo).length;

  const out: EffettoScambio[] = [];
  for (const id of [bozza.da, bozza.a]) {
    for (const regione of [...regioni].sort((x, y) => x - y)) {
      const prima = possiedeRegione(stato, id, regione);
      const poi = possiedeRegione(dopo, id, regione);
      if (!prima && poi) out.push({ tipo: 'completa', giocatore: id, regione });
      else if (prima && !poi) out.push({ tipo: 'rompe', giocatore: id, regione });
    }
    for (const [tipo, casella] of [
      ['stazioni', 'stazione'],
      ['servizi', 'servizio'],
    ] as const) {
      const prima = quante(stato, id, casella);
      const poi = quante(dopo, id, casella);
      if (prima !== poi) out.push({ tipo, giocatore: id, prima, dopo: poi });
    }
  }
  // L'ordinamento è stabile: a parità di tipo resta prima chi propone.
  return out.sort((x, y) => ORDINE_EFFETTI[x.tipo] - ORDINE_EFFETTI[y.tipo]);
}

/* --------------------------- Controlli ----------------------------- */

function trova(stato: Stato, id: number): Scambio | undefined {
  return stato.scambi.find((x) => x.id === id);
}

const INESISTENTE = errore('scambio_inesistente', 'Questo scambio non c’è più.');

export function verificaProposta(stato: Stato, azione: Extract<Azione, { tipo: 'proponi' }>): Errore | null {
  let sostituito: Scambio | undefined;
  if (azione.sostituisce !== undefined) {
    sostituito = trova(stato, azione.sostituisce);
    if (!sostituito) return INESISTENTE;
    if (sostituito.da !== azione.giocatore && sostituito.a !== azione.giocatore) {
      return errore('non_tuo_scambio', 'Puoi fare una controproposta solo agli scambi in cui sei coinvolto.');
    }
    const altro = sostituito.da === azione.giocatore ? sostituito.a : sostituito.da;
    if (azione.a !== altro) {
      return errore('scambio_non_valido', 'La controproposta va fatta all’altro giocatore dello scambio.');
    }
  }
  if (Array.from(azione.nota).length > NOTA_MAX) {
    return errore('scambio_non_valido', `La nota supera i ${NOTA_MAX} caratteri.`);
  }

  const aperti = stato.scambi.filter((x) => x !== sostituito && x.da === azione.giocatore);
  if (aperti.length >= SCAMBI_APERTI_MAX) {
    return errore('troppi_scambi', `Non puoi avere più di ${SCAMBI_APERTI_MAX} scambi aperti proposti da te.`);
  }
  if (aperti.filter((x) => x.a === azione.a).length >= PROPOSTE_IN_ATTESA_MAX) {
    return errore(
      'troppi_scambi',
      `${giocatore(stato, azione.a)?.nome ?? 'Quel giocatore'} ha già ${PROPOSTE_IN_ATTESA_MAX} tue proposte in attesa: aspetta che risponda.`,
    );
  }

  const problemi = problemiScambio(stato, { da: azione.giocatore, a: azione.a, dare: azione.dare, avere: azione.avere });
  return problemi.length > 0 ? errore('scambio_non_valido', problemi.join(' ')) : null;
}

export function verificaRisposta(
  stato: Stato,
  azione: Extract<Azione, { tipo: 'accetta' | 'rifiuta' | 'annulla' }>,
): Errore | null {
  const sc = trova(stato, azione.scambio);
  if (!sc) return INESISTENTE;
  if (azione.tipo === 'annulla') {
    return sc.da === azione.giocatore
      ? null
      : errore('non_tuo_scambio', 'Solo chi ha proposto lo scambio può ritirarlo.');
  }
  if (sc.a !== azione.giocatore) {
    return errore('non_tuo_scambio', 'Solo chi ha ricevuto lo scambio può rispondere.');
  }
  if (azione.tipo === 'accetta') {
    const problemi = problemiScambio(stato, sc);
    if (problemi.length > 0) return errore('scambio_non_valido', `Questo scambio non si può fare. ${problemi.join(' ')}`);
  }
  return null;
}

/* --------------------------- Esecuzione ---------------------------- */

function ordina(p: Pacchetto): Pacchetto {
  return { soldi: p.soldi, caselle: [...p.caselle].sort((x, y) => x - y), grazie: [...p.grazie].sort() };
}

export function proponi(ctx: Contesto, azione: Extract<Azione, { tipo: 'proponi' }>): void {
  const { s } = ctx;
  const sostituito = azione.sostituisce === undefined ? undefined : trova(s, azione.sostituisce);
  const bozza: BozzaScambio = { da: azione.giocatore, a: azione.a, dare: ordina(azione.dare), avere: ordina(azione.avere) };
  const scambio: Scambio = {
    id: s.prossimoScambio++,
    ...bozza,
    nota: azione.nota.trim(),
    trattativa: sostituito ? sostituito.trattativa + 1 : 0,
    ipotecate: caselleIpotecate(s, bozza),
  };
  // La versione di prima, girata nel verso di questa: se risponde l'altro, quello che dava ora lo chiede.
  if (sostituito) {
    const stessoVerso = sostituito.da === azione.giocatore;
    scambio.precedente = {
      dare: stessoVerso ? sostituito.dare : sostituito.avere,
      avere: stessoVerso ? sostituito.avere : sostituito.dare,
    };
  }
  s.scambi = [...s.scambi.filter((x) => x !== sostituito), scambio];
  ctx.eventi.push({ tipo: 'scambio_proposto', scambio: scambio.id, da: scambio.da, a: scambio.a, trattativa: scambio.trattativa });
}

export function rispondi(ctx: Contesto, azione: Extract<Azione, { tipo: 'accetta' | 'rifiuta' | 'annulla' }>): void {
  const { s } = ctx;
  const sc = trova(s, azione.scambio)!;
  s.scambi = s.scambi.filter((x) => x !== sc);
  const chi = { scambio: sc.id, da: sc.da, a: sc.a };
  switch (azione.tipo) {
    case 'accetta':
      ctx.eventi.push({ tipo: 'scambio_accettato', ...chi, dare: sc.dare, avere: sc.avere });
      s.statistiche.scambi++;
      trasferisci(ctx, sc);
      return;
    case 'rifiuta':
      ctx.eventi.push({ tipo: 'scambio_rifiutato', ...chi });
      return;
    case 'annulla':
      ctx.eventi.push({ tipo: 'scambio_annullato', ...chi });
      return;
  }
}
