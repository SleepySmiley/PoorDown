/*
 * Il pannello di controllo: chi gestisce il server cambia la partita a mano (soldi, posizioni, proprietà, turno…).
 * Le modifiche non passano dalle regole del turno, ma lasciano lo stato coerente: dopo ognuna la partita continua
 * come se niente fosse. Qui ci sono anche i tipi che il pannello nel browser scambia con il server.
 */

import { giocatore } from './conti';
import type { Contesto } from './contesto';
import { GIOCATORI_MAX } from './impostazioni';
import type { FaseStanza, VoceRegistro } from './protocollo';
import { tabellone } from './tabelloni';
import { chiudiOrologio, tempoIniziale } from './tempo';
import { chiudiPartita, chiudiPerDurata, elimina, iniziaTurno } from './turni';
import type { Caso, Evento, Giocatore, IdGiocatore, IdMappa, Impostazioni, NomeMazzo, Stato } from './tipi';

/** Le regole che si possono accendere e spegnere a partita in corso. */
export const REGOLE_MODIFICABILI = [
  'affittoDoppioSetCompleto',
  'cassaVacanza',
  'aste',
  'nienteAffittoInPrigione',
  'ipoteche',
  'costruzioneUniforme',
  'timerTurno',
  'durataMassima',
] as const satisfies readonly (keyof Impostazioni)[];

export type RegolaModificabile = (typeof REGOLE_MODIFICABILI)[number];

/** Il limite dei soldi che il pannello accetta (saldo, cassa), in più e in meno. */
export const SOLDI_MAX_PANNELLO = 10_000_000;
/** Carte Grazia che un giocatore può tenere: una per mazzo, più qualcuna regalata dal pannello. */
export const GRAZIE_MAX = 4;
/** Il livello più alto di una città: l'albergo. */
const ALBERGO = 5;

/** Una modifica della partita in corso. */
export type ModificaPartita =
  | { tipo: 'saldo'; giocatore: IdGiocatore; saldo: number }
  /** Sposta la pedina senza effetti: niente Partenza, affitti o carte. Chi era in prigione ne esce. */
  | { tipo: 'posizione'; giocatore: IdGiocatore; casella: number }
  | { tipo: 'prigione'; giocatore: IdGiocatore; dentro: boolean }
  | { tipo: 'vacanza'; giocatore: IdGiocatore; vacanza: boolean }
  | { tipo: 'grazie'; giocatore: IdGiocatore; carte: NomeMazzo[] }
  /** Proprietario (`null` = banca), case (0–4, 5 = albergo, solo per le città) e ipoteca. */
  | { tipo: 'proprieta'; casella: number; proprietario: IdGiocatore | null; livello: number; ipotecata: boolean }
  /** Il turno passa a `giocatore`, che comincia da capo (anche se toccava già a lui). */
  | { tipo: 'turno'; giocatore: IdGiocatore }
  | { tipo: 'cassa'; importo: number }
  | { tipo: 'regole'; regole: Partial<Pick<Impostazioni, RegolaModificabile>> }
  /** Toglie il giocatore dalla partita, anche se sta giocando: i suoi beni vanno come in una bancarotta. */
  | { tipo: 'elimina'; giocatore: IdGiocatore }
  /** Chiude la partita: vince `vincitore`, oppure (con `null`) il patrimonio più alto. */
  | { tipo: 'fine'; vincitore: IdGiocatore | null }
  /** Sostituisce tutto lo stato della partita (l'editor JSON). */
  | { tipo: 'stato'; stato: Stato };

/** Tutto quello che il pannello può chiedere al server su una stanza. */
export type ComandoPannello =
  | ModificaPartita
  | { tipo: 'nome'; giocatore: IdGiocatore; nome: string }
  /** Il prossimo tiro di `giocatore` (o di chiunque, con `null`) farà questi dadi. `dadi: null` toglie la scelta. */
  | { tipo: 'dadi'; dadi: [number, number] | null; giocatore: IdGiocatore | null }
  | { tipo: 'host'; giocatore: IdGiocatore }
  /** In lobby: libera il posto del giocatore. */
  | { tipo: 'espelli'; giocatore: IdGiocatore };

export type TipoComandoPannello = ComandoPannello['tipo'];

/** Una stanza nell'elenco del pannello. */
export interface StanzaNelPannello {
  codice: string;
  fase: FaseStanza;
  privata: boolean;
  mappa: IdMappa;
  giocatori: { nome: string; colore: number; bot: boolean; connesso: boolean; fuori: boolean }[];
  /** Il numero del turno, in partita. */
  turno: number | null;
  /** Il nome di chi sta giocando il turno, in partita. */
  diTurno: string | null;
  spettatori: number;
  inPausa: boolean;
}

/** Il prossimo tiro deciso dal pannello. */
export interface DadiDecisi {
  dadi: [number, number];
  /** Vale solo per il tiro di questo giocatore; `null`: per il prossimo tiro di chiunque. */
  giocatore: IdGiocatore | null;
}

/** Una stanza vista dal pannello: tutto, compreso l'ordine segreto dei mazzi. Mai i token dei giocatori. */
export interface DettaglioPannello {
  codice: string;
  fase: FaseStanza;
  versione: number;
  host: IdGiocatore | null;
  impostazioni: Impostazioni;
  posti: { id: IdGiocatore; nome: string; colore: number; bot: boolean; connesso: boolean; squadra: number | null }[];
  nomiSquadre: string[];
  spettatori: number;
  partita: Stato | null;
  /** Le ultime voci del registro, dalla più vecchia. */
  registro: VoceRegistro[];
  dadi: DadiDecisi | null;
  /** L'ultima modifica del pannello si può ancora annullare (nessuno ha giocato da allora). */
  annullabile: boolean;
  inPausa: boolean;
  /** Orologio del server (ms). */
  adesso: number;
}

/** Stato del pannello per la pagina: se è acceso (ci sono le credenziali) e se la sessione vale ancora. */
export interface StatoAccessoPannello {
  attivo: boolean;
  dentro: boolean;
}

export type EsitoModifica = { ok: true; stato: Stato; eventi: Evento[] } | { ok: false; messaggio: string };

const no = (messaggio: string): EsitoModifica => ({ ok: false, messaggio });

const MAZZI: readonly NomeMazzo[] = ['busta', 'cartolina'];

/**
 * Applica una modifica del pannello. Lavora su una copia: lo stato ricevuto non cambia.
 * `caso` e `adesso` servono alle conseguenze (il turno che passa, la fine della partita).
 */
export function modificaPartita(stato: Stato, modifica: ModificaPartita, caso: Caso, adesso: number): EsitoModifica {
  if (modifica.tipo === 'stato') return sostituisciStato(stato, modifica.stato);
  const s = JSON.parse(JSON.stringify(stato)) as Stato;
  const ctx: Contesto = { s, tab: tabellone(s.mappa), caso, adesso, eventi: [], turnoFinito: false };
  const problema = applicaModifica(ctx, modifica);
  if (problema) return no(problema);
  return { ok: true, stato: s, eventi: ctx.eventi };
}

/** Il giocatore in gioco con questo id, oppure il messaggio che spiega cosa non va. */
function inGioco(s: Stato, id: IdGiocatore): Giocatore | string {
  const g = giocatore(s, id);
  if (!g) return 'Questo giocatore non è nella partita.';
  if (g.eliminato) return `${g.nome} è già fuori dalla partita.`;
  return g;
}

function soldiValidi(valore: number): boolean {
  return Number.isInteger(valore) && Math.abs(valore) <= SOLDI_MAX_PANNELLO;
}

/** Applica la modifica allo stato del contesto; restituisce un messaggio se non si può fare. */
function applicaModifica(ctx: Contesto, m: Exclude<ModificaPartita, { tipo: 'stato' }>): string | null {
  const { s, tab } = ctx;
  if (s.fase !== 'in_corso') return 'La partita è finita: si può cambiare solo dallo stato completo (JSON).';
  const t = s.turno;

  switch (m.tipo) {
    case 'saldo': {
      const g = inGioco(s, m.giocatore);
      if (typeof g === 'string') return g;
      if (!soldiValidi(m.saldo)) return `Il saldo deve essere un numero intero tra −${SOLDI_MAX_PANNELLO} e ${SOLDI_MAX_PANNELLO}.`;
      g.saldo = m.saldo;
      // I debiti verso gli altri non superano mai il rosso: con il saldo positivo spariscono, altrimenti si accorciano.
      let rosso = Math.max(0, -m.saldo);
      g.debiti = g.debiti.flatMap((d) => {
        const importo = Math.min(d.importo, rosso);
        rosso -= importo;
        return importo > 0 ? [{ ...d, importo }] : [];
      });
      return null;
    }

    case 'posizione': {
      const g = inGioco(s, m.giocatore);
      if (typeof g === 'string') return g;
      if (!Number.isInteger(m.casella) || m.casella < 0 || m.casella >= tab.caselle.length) return 'Casella sconosciuta.';
      g.posizione = m.casella;
      g.prigione = null;
      if (t.giocatore === g.id) {
        if (t.fase === 'prigione') t.fase = 'lancio';
        // La casella che poteva comprare non è più quella dove si trova.
        t.acquisto = null;
      }
      return null;
    }

    case 'prigione': {
      const g = inGioco(s, m.giocatore);
      if (typeof g === 'string') return g;
      if (m.dentro) {
        g.posizione = tab.prigione;
        g.prigione ??= 0;
        if (t.giocatore === g.id) {
          if (t.fase === 'lancio') t.fase = 'prigione';
          t.acquisto = null;
          t.rilancio = false;
        }
      } else {
        g.prigione = null;
        if (t.giocatore === g.id && t.fase === 'prigione') t.fase = 'lancio';
      }
      return null;
    }

    case 'vacanza': {
      const g = inGioco(s, m.giocatore);
      if (typeof g === 'string') return g;
      g.vacanza = m.vacanza;
      return null;
    }

    case 'grazie': {
      const g = inGioco(s, m.giocatore);
      if (typeof g === 'string') return g;
      if (m.carte.length > GRAZIE_MAX || !m.carte.every((c) => MAZZI.includes(c))) return 'Carte Grazia non valide.';
      g.carteGrazia = [...m.carte];
      return null;
    }

    case 'proprieta': {
      const c = m.casella;
      const casella = Number.isInteger(c) ? tab.caselle[c] : undefined;
      const prima = Number.isInteger(c) ? s.proprieta[c] : undefined;
      if (!casella || !prima) return 'Questa casella non si può possedere.';
      if (s.asta?.casella === c) return 'C’è un’asta in corso su questa casella: aspetta che finisca.';
      if (m.proprietario !== null) {
        const g = inGioco(s, m.proprietario);
        if (typeof g === 'string') return g;
      }
      if (!Number.isInteger(m.livello) || m.livello < 0 || m.livello > ALBERGO) return 'Il livello va da 0 (terreno) a 5 (albergo).';
      if (m.livello > 0 && casella.tipo !== 'citta') return 'Si costruisce solo sulle città.';
      if (m.proprietario === null && (m.livello > 0 || m.ipotecata)) return 'Una casella della banca non ha case né ipoteche.';
      if (m.ipotecata && m.livello > 0) return 'Una proprietà ipotecata non può avere case: toglile prima.';
      s.proprieta[c] = { proprietario: m.proprietario, livello: m.livello, ipotecata: m.ipotecata };
      if (prima.proprietario !== m.proprietario) {
        // Gli scambi che contavano su questa casella non valgono più.
        s.scambi = s.scambi.filter((x) => !x.dare.caselle.includes(c) && !x.avere.caselle.includes(c));
        if (t.acquisto === c && m.proprietario !== null) t.acquisto = null;
      }
      return null;
    }

    case 'turno': {
      const g = inGioco(s, m.giocatore);
      if (typeof g === 'string') return g;
      if (s.asta) return 'C’è un’asta in corso: aspetta che finisca prima di passare il turno.';
      const uscente = giocatore(s, t.giocatore);
      if (uscente && !uscente.eliminato) chiudiOrologio(s, uscente, t, ctx.adesso);
      iniziaTurno(s, ctx.eventi, g, ctx.adesso);
      return null;
    }

    case 'cassa': {
      if (!soldiValidi(m.importo) || m.importo < 0) return `La cassa va da 0 a ${SOLDI_MAX_PANNELLO}.`;
      s.cassaVacanza = m.importo;
      return null;
    }

    case 'regole': {
      for (const [chiave, valore] of Object.entries(m.regole)) {
        if (!(REGOLE_MODIFICABILI as readonly string[]).includes(chiave) || typeof valore !== 'boolean') {
          return 'Regola sconosciuta.';
        }
      }
      const timerPrima = s.impostazioni.timerTurno;
      s.impostazioni = { ...s.impostazioni, ...m.regole };
      // Il timer che si accende parte adesso, non dall'inizio del turno (che può essere di minuti fa).
      if (s.impostazioni.timerTurno !== timerPrima) {
        const g = giocatore(s, t.giocatore);
        if (g) t.tempo = tempoIniziale(s, g, ctx.adesso);
      }
      return null;
    }

    case 'elimina': {
      const g = inGioco(s, m.giocatore);
      if (typeof g === 'string') return g;
      elimina(ctx, g, 'espulsione');
      return null;
    }

    case 'fine': {
      if (m.vincitore === null) {
        chiudiPerDurata(ctx);
        return null;
      }
      const g = inGioco(s, m.vincitore);
      if (typeof g === 'string') return g;
      chiudiPartita(ctx, g);
      return null;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Stato completo (editor JSON)                                        */
/* ------------------------------------------------------------------ */

type Oggetto = Record<string, unknown>;

const oggetto = (x: unknown): x is Oggetto => typeof x === 'object' && x !== null && !Array.isArray(x);
const intero = (x: unknown, min = -Infinity, max = Infinity): x is number =>
  typeof x === 'number' && Number.isInteger(x) && x >= min && x <= max;
const numero = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const numeroONull = (x: unknown) => x === null || numero(x);
const booleano = (x: unknown): x is boolean => typeof x === 'boolean';
const MOTIVI: readonly unknown[] = ['bancarotta', 'tempo', 'assenza', 'voto', 'espulsione'];
const FASI_TURNO: readonly unknown[] = ['lancio', 'prigione', 'dopo_lancio'];

/**
 * Controlla lo stato scritto a mano nell'editor e, se va bene, lo prende al posto di quello attuale.
 * Non si possono cambiare il tabellone né i giocatori (chi c'è e in che ordine): solo i loro dati.
 */
function sostituisciStato(attuale: Stato, nuovo: unknown): EsitoModifica {
  const problema = problemaStato(attuale, nuovo);
  if (problema) return no(problema);
  return { ok: true, stato: JSON.parse(JSON.stringify(nuovo)) as Stato, eventi: [] };
}

/** Cosa non va nello stato `nuovo` rispetto a quello `attuale`, oppure `null`. I messaggi indicano il campo. */
export function problemaStato(attuale: Stato, nuovo: unknown): string | null {
  if (!oggetto(nuovo)) return 'Lo stato deve essere un oggetto JSON.';
  if (nuovo.mappa !== attuale.mappa) return `mappa: il tabellone non si cambia (resta "${attuale.mappa}").`;
  const tab = tabellone(attuale.mappa);
  const n = tab.caselle.length;
  const ids = attuale.giocatori.map((g) => g.id);
  const idValido = (x: unknown) => typeof x === 'string' && ids.includes(x);

  // Impostazioni: le stesse chiavi, con lo stesso tipo di valore.
  if (!oggetto(nuovo.impostazioni)) return 'impostazioni: deve essere un oggetto.';
  for (const [chiave, valore] of Object.entries(attuale.impostazioni)) {
    if (typeof nuovo.impostazioni[chiave] !== typeof valore) return `impostazioni.${chiave}: tipo sbagliato.`;
  }
  if (nuovo.impostazioni.mappa !== attuale.mappa) return 'impostazioni.mappa: deve restare uguale a mappa.';
  if (!intero(nuovo.impostazioni.giocatoriMax, 2, GIOCATORI_MAX)) return 'impostazioni.giocatoriMax: numero non valido.';

  // Giocatori: stessi id, stesso ordine.
  if (!Array.isArray(nuovo.giocatori) || nuovo.giocatori.length !== ids.length) {
    return `giocatori: devono restare ${ids.length}, nello stesso ordine.`;
  }
  for (const [i, g] of (nuovo.giocatori as unknown[]).entries()) {
    const dove = `giocatori[${i}]`;
    if (!oggetto(g)) return `${dove}: deve essere un oggetto.`;
    if (g.id !== ids[i]) return `${dove}.id: i giocatori non si aggiungono, non si tolgono e non si spostano.`;
    if (typeof g.nome !== 'string' || g.nome.trim() === '' || g.nome.length > 40) return `${dove}.nome: testo da 1 a 40 caratteri.`;
    if (!intero(g.colore, 1, 12)) return `${dove}.colore: da 1 a 12.`;
    if (!intero(g.posizione, 0, n - 1)) return `${dove}.posizione: da 0 a ${n - 1}.`;
    if (!intero(g.saldo, -SOLDI_MAX_PANNELLO, SOLDI_MAX_PANNELLO)) return `${dove}.saldo: numero intero.`;
    if (!Array.isArray(g.debiti) || !g.debiti.every((d) => oggetto(d) && idValido(d.creditore) && intero(d.importo, 1))) {
      return `${dove}.debiti: elenco di { creditore, importo }.`;
    }
    if (g.prigione !== null && !intero(g.prigione, 0, 3)) return `${dove}.prigione: null oppure da 0 a 3.`;
    if (!booleano(g.vacanza)) return `${dove}.vacanza: true o false.`;
    if (!Array.isArray(g.carteGrazia) || g.carteGrazia.length > GRAZIE_MAX || !g.carteGrazia.every((c) => MAZZI.includes(c as NomeMazzo))) {
      return `${dove}.carteGrazia: elenco di "busta" e "cartolina".`;
    }
    if (g.eliminato !== null && !(oggetto(g.eliminato) && intero(g.eliminato.turno, 0) && MOTIVI.includes(g.eliminato.motivo))) {
      return `${dove}.eliminato: null oppure { turno, motivo }.`;
    }
    if (!numero(g.banca) || g.banca < 0) return `${dove}.banca: millisecondi (0 o più).`;
    if (!intero(g.automatici, 0)) return `${dove}.automatici: numero intero.`;
    if (!numeroONull(g.offlineDa)) return `${dove}.offlineDa: null oppure un numero.`;
    if (g.squadra !== null && !intero(g.squadra, 0, 3)) return `${dove}.squadra: null oppure da 0 a 3.`;
  }
  const fuori = new Set(
    (nuovo.giocatori as Oggetto[]).filter((g) => g.eliminato !== null).map((g) => g.id as string),
  );

  // Proprietà: una voce per casella, `null` dove non si compra.
  if (!Array.isArray(nuovo.proprieta) || nuovo.proprieta.length !== n) return `proprieta: devono essere ${n} voci.`;
  for (const [i, p] of (nuovo.proprieta as unknown[]).entries()) {
    const dove = `proprieta[${i}]`;
    if (attuale.proprieta[i] === null) {
      if (p !== null) return `${dove}: questa casella non si compra, deve restare null.`;
      continue;
    }
    if (!oggetto(p)) return `${dove}: deve essere { proprietario, livello, ipotecata }.`;
    if (p.proprietario !== null && !idValido(p.proprietario)) return `${dove}.proprietario: null oppure l'id di un giocatore.`;
    if (typeof p.proprietario === 'string' && fuori.has(p.proprietario)) return `${dove}.proprietario: quel giocatore è fuori.`;
    const max = tab.caselle[i]?.tipo === 'citta' ? ALBERGO : 0;
    if (!intero(p.livello, 0, max)) return `${dove}.livello: da 0 a ${max}.`;
    if (!booleano(p.ipotecata)) return `${dove}.ipotecata: true o false.`;
    if (p.proprietario === null && (p.livello !== 0 || p.ipotecata)) return `${dove}: della banca, senza case né ipoteca.`;
    if (p.ipotecata && p.livello !== 0) return `${dove}: ipotecata, quindi senza case.`;
  }

  // Mazzi: l'ordine è un rimescolamento di tutte le carte.
  if (!oggetto(nuovo.mazzi)) return 'mazzi: deve essere un oggetto.';
  for (const nome of MAZZI) {
    const m = nuovo.mazzi[nome];
    const carte = tab.mazzi[nome].length;
    if (!oggetto(m) || !Array.isArray(m.ordine) || !intero(m.prossima, 0, carte - 1)) return `mazzi.${nome}: { ordine, prossima }.`;
    const ordinate = [...(m.ordine as unknown[])].sort((a, b) => Number(a) - Number(b));
    if (ordinate.length !== carte || !ordinate.every((x, i) => x === i)) {
      return `mazzi.${nome}.ordine: ogni carta da 0 a ${carte - 1}, una volta sola.`;
    }
  }

  if (!intero(nuovo.cassaVacanza, 0, SOLDI_MAX_PANNELLO)) return 'cassaVacanza: numero intero, 0 o più.';
  if (nuovo.fase !== 'in_corso' && nuovo.fase !== 'finita') return 'fase: "in_corso" oppure "finita".';
  if (nuovo.vincitore !== null && !idValido(nuovo.vincitore)) return 'vincitore: null oppure l\'id di un giocatore.';
  if (!Array.isArray(nuovo.squadre) || !nuovo.squadre.every((x) => typeof x === 'string')) return 'squadre: elenco di nomi.';
  if (nuovo.squadraVincitrice !== null && !intero(nuovo.squadraVincitrice, 0, 3)) return 'squadraVincitrice: null oppure da 0 a 3.';

  // Turno.
  const t = nuovo.turno;
  if (!oggetto(t)) return 'turno: deve essere un oggetto.';
  if (!idValido(t.giocatore)) return 'turno.giocatore: l\'id di un giocatore.';
  if (nuovo.fase === 'in_corso' && fuori.has(t.giocatore as string)) return 'turno.giocatore: quel giocatore è fuori.';
  if (!intero(t.numero, 1)) return 'turno.numero: 1 o più.';
  if (!FASI_TURNO.includes(t.fase)) return 'turno.fase: "lancio", "prigione" o "dopo_lancio".';
  if (t.dadi !== null && !(Array.isArray(t.dadi) && t.dadi.length === 2 && t.dadi.every((d) => intero(d, 1, 6)))) {
    return 'turno.dadi: null oppure [da 1 a 6, da 1 a 6].';
  }
  if (!intero(t.doppi, 0, 3)) return 'turno.doppi: da 0 a 3.';
  if (!booleano(t.rilancio)) return 'turno.rilancio: true o false.';
  if (t.acquisto !== null && !(intero(t.acquisto, 0, n - 1) && attuale.proprieta[t.acquisto] !== null)) {
    return 'turno.acquisto: null oppure una casella che si compra.';
  }
  const tempo = t.tempo;
  if (
    !oggetto(tempo) ||
    !['inizio', 'grazia', 'regalato'].every((k) => numero(tempo[k])) ||
    !Array.isArray(tempo.regali) ||
    !booleano(tempo.richiesta) ||
    !booleano(tempo.automatico) ||
    !numeroONull(tempo.fermoDa) ||
    !(tempo.assenteDa === undefined || numeroONull(tempo.assenteDa))
  ) {
    return 'turno.tempo: { inizio, grazia, regalato, regali, richiesta, automatico, fermoDa }.';
  }
  const voto = t.votazione;
  if (!oggetto(voto) || !Array.isArray(voto.voti) || !voto.voti.every(idValido) || !numeroONull(voto.scadenza)) {
    return 'turno.votazione: { voti, scadenza }.';
  }

  // Asta e scambi.
  const asta = nuovo.asta;
  if (asta !== null) {
    if (!oggetto(asta) || !intero(asta.casella, 0, n - 1) || attuale.proprieta[asta.casella] === null) {
      return 'asta: null oppure { casella, giocatore, migliore, offerte, scadenza }.';
    }
    const offerta = (o: unknown) => oggetto(o) && idValido(o.giocatore) && intero(o.importo, 1);
    if (!idValido(asta.giocatore) || !numero(asta.scadenza) || !Array.isArray(asta.offerte) || !asta.offerte.every(offerta)) {
      return 'asta: giocatore, offerte o scadenza non validi.';
    }
    if (asta.migliore !== null && !offerta(asta.migliore)) return 'asta.migliore: null oppure { giocatore, importo }.';
  }
  const pacchetto = (p: unknown) =>
    oggetto(p) &&
    intero(p.soldi, 0) &&
    Array.isArray(p.caselle) &&
    p.caselle.every((c) => intero(c, 0, n - 1)) &&
    Array.isArray(p.grazie) &&
    p.grazie.every((c) => MAZZI.includes(c as NomeMazzo));
  if (
    !Array.isArray(nuovo.scambi) ||
    !nuovo.scambi.every(
      (x) =>
        oggetto(x) &&
        intero(x.id, 1) &&
        idValido(x.da) &&
        idValido(x.a) &&
        pacchetto(x.dare) &&
        pacchetto(x.avere) &&
        typeof x.nota === 'string' &&
        intero(x.trattativa, 0) &&
        Array.isArray(x.ipotecate),
    )
  ) {
    return 'scambi: uno scambio non ha la forma giusta (più semplice svuotare l\'elenco: []).';
  }
  if (!intero(nuovo.prossimoScambio, 1)) return 'prossimoScambio: 1 o più.';

  // Statistiche.
  const st = nuovo.statistiche;
  if (
    !oggetto(st) ||
    !numero(st.inizio) ||
    !numeroONull(st.fine) ||
    !['doppi', 'scambi', 'messaggi'].every((k) => intero(st[k], 0)) ||
    !Array.isArray(st.visite) ||
    st.visite.length !== n ||
    !st.visite.every((v) => intero(v, 0)) ||
    !oggetto(st.prigione) ||
    !Array.isArray(st.uscite) ||
    !Array.isArray(st.patrimonio)
  ) {
    return 'statistiche: forma non valida (meglio non toccarle).';
  }
  return null;
}
