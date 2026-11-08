/*
 * I bot: giocatori automatici che occupano i posti liberi. Docs/analisi/02-lobby-impostazioni.md §8.
 * Comprano, costruiscono, offrono alle aste e rispondono agli scambi. Ne propongono solo uno, ogni tanto: comprare
 * l'ultima città che manca a una loro regione, pagandola bene. In chat non scrivono.
 *
 * `mossaBot` guarda la partita e dice la prossima azione del bot, oppure `null` se per ora non ha niente da fare.
 * Non usa il caso: a parità di partita decide sempre allo stesso modo. Il ritmo (quanto aspettare tra una mossa
 * e l'altra, perché gli altri vedano le animazioni) lo decide la stanza con `pausaDopo`.
 */

import {
  affitto,
  alleati,
  attivi,
  caselleDellaRegione,
  compagni,
  costoProssimoEdificio,
  costoRiscatto,
  giocatore,
  proprietabile,
  rimborsoEdificio,
  valoreIpoteca,
  VALORE_GRAZIA,
} from './conti';
import { RILANCI } from './economia';
import { azioniPossibili, verifica } from './regole';
import { problemiScambio } from './scambi';
import { tabellone } from './tabelloni';
import type { Azione, Citta, Evento, Giocatore, IdGiocatore, Pacchetto, Scambio, Stato } from './tipi';

/* ------------------------------------------------------------------ */
/* Valutazioni                                                         */
/* ------------------------------------------------------------------ */

/**
 * Il contante da tenere da parte per non finire in rosso al primo affitto:
 * più alto quando gli avversari hanno caselle che fanno pagare molto.
 */
export function riserva(s: Stato, id: IdGiocatore): number {
  let pericolo = 0;
  s.proprieta.forEach((p, i) => {
    if (!p?.proprietario || alleati(s, p.proprietario, id)) return;
    pericolo = Math.max(pericolo, affitto(s, i, 7));
  });
  return Math.min(600, Math.max(100, Math.round(pericolo * 0.6)));
}

/** Quante città della regione hanno il bot (con i compagni) e gli avversari. */
function contaRegione(s: Stato, id: IdGiocatore, c: Citta): { mie: number; loro: number; totale: number } {
  const caselle = caselleDellaRegione(tabellone(s.mappa), c.regione);
  let mie = 0;
  let loro = 0;
  for (const i of caselle) {
    const proprietario = s.proprieta[i]?.proprietario;
    if (!proprietario) continue;
    if (alleati(s, proprietario, id)) mie++;
    else loro++;
  }
  return { mie, loro, totale: caselle.length };
}

/** Quanto vale per il bot avere la casella (che ancora non ha): il prezzo, di più se gli completa una regione. */
export function valoreCasella(s: Stato, id: IdGiocatore, casella: number): number {
  const tab = tabellone(s.mappa);
  const c = proprietabile(tab, casella);
  if (!c) return 0;
  const tipo = c.tipo;
  const mieDelTipo = (t: 'stazione' | 'servizio') =>
    s.proprieta.filter((p, i) => p?.proprietario && alleati(s, p.proprietario, id) && tab.caselle[i]?.tipo === t && i !== casella)
      .length;
  switch (tipo) {
    case 'stazione':
      return Math.round(c.prezzo * (1 + 0.2 * mieDelTipo('stazione')));
    case 'servizio':
      return Math.round(c.prezzo * (0.85 + 0.25 * mieDelTipo('servizio')));
    case 'citta': {
      const giaMia = s.proprieta[casella]?.proprietario;
      const { mie, loro, totale } = contaRegione(s, id, c);
      const mieSenza = giaMia && alleati(s, giaMia, id) ? mie - 1 : mie;
      const loroSenza = giaMia && !alleati(s, giaMia, id) ? loro - 1 : loro;
      if (mieSenza + 1 === totale) return Math.round(c.prezzo * 2.2);
      if (loroSenza === 0) return Math.round(c.prezzo * (1 + (0.5 * mieSenza) / totale));
      // Bloccare la regione a chi ne ha già quasi tutta vale qualcosa.
      if (loroSenza === totale - 1) return Math.round(c.prezzo * 1.3);
      return Math.round(c.prezzo * 0.85);
    }
  }
}

/** Le caselle di un avversario (`altro`) a cui il bot regalerebbe una regione completa cedendo `casella`. */
function completaAvversario(s: Stato, altro: IdGiocatore, casella: number): boolean {
  const c = proprietabile(tabellone(s.mappa), casella);
  if (c?.tipo !== 'citta') return false;
  return caselleDellaRegione(tabellone(s.mappa), c.regione).every(
    (i) => i === casella || (s.proprieta[i]?.proprietario != null && alleati(s, s.proprieta[i]!.proprietario!, altro)),
  );
}

/**
 * Quanto guadagna il bot da uno scambio che gli è stato proposto: quello che riceve meno quello che dà,
 * contando che cedere una città che completa la regione dell'avversario costa molto di più del suo prezzo.
 */
export function guadagnoScambio(s: Stato, id: IdGiocatore, sc: Scambio): { guadagno: number; dato: number } {
  const ricevo: Pacchetto = sc.dare;
  const cedo: Pacchetto = sc.avere;
  const tab = tabellone(s.mappa);
  let ricevuto = ricevo.soldi + ricevo.grazie.length * VALORE_GRAZIA;
  for (const i of ricevo.caselle) {
    const valore = valoreCasella(s, id, i);
    ricevuto += s.proprieta[i]?.ipotecata ? valore - costoRiscatto(tab, i) : valore;
  }
  let dato = cedo.soldi + cedo.grazie.length * VALORE_GRAZIA;
  for (const i of cedo.caselle) {
    const c = proprietabile(tab, i);
    if (!c) continue;
    const ipotecata = s.proprieta[i]?.ipotecata === true;
    const base = ipotecata ? c.prezzo / 2 : c.prezzo;
    const mia = c.tipo === 'citta' && contaRegione(s, id, c).mie === caselleDellaRegione(tab, c.regione).length;
    dato += mia ? base * 2.5 : base;
    if (!compagni(s, id, sc.da) && completaAvversario(s, sc.da, i)) dato += c.prezzo * 1.2;
  }
  return { guadagno: Math.round(ricevuto - dato), dato: Math.round(dato) };
}

/* ------------------------------------------------------------------ */
/* Decisioni                                                           */
/* ------------------------------------------------------------------ */

const ok = (s: Stato, a: Azione) => verifica(s, a) === null;

/** Il rilancio all'asta, oppure `null` se il bot non vuole (o non può) offrire di più. */
function offertaAsta(s: Stato, g: Giocatore): Azione | null {
  const asta = s.asta!;
  const migliore = asta.migliore;
  // Non si rilancia su sé stessi né su un compagno di squadra.
  if (migliore && alleati(s, migliore.giocatore, g.id)) return null;
  const attuale = migliore?.importo ?? 0;
  const limite = Math.floor(Math.min(valoreCasella(s, g.id, asta.casella), g.saldo - riserva(s, g.id) / 2));
  const margine = limite - attuale;
  if (margine < RILANCI[0]) return null;
  const rilancio = margine >= 200 ? RILANCI[2] : margine >= 20 ? RILANCI[1] : RILANCI[0];
  const azione: Azione = { tipo: 'offri', giocatore: g.id, importo: attuale + rilancio };
  return ok(s, azione) ? azione : null;
}

/** Risposta a uno scambio proposto al bot. */
function rispostaScambio(s: Stato, g: Giocatore, sc: Scambio): Azione {
  const accetta: Azione = { tipo: 'accetta', giocatore: g.id, scambio: sc.id };
  const rifiuta: Azione = { tipo: 'rifiuta', giocatore: g.id, scambio: sc.id };
  if (!ok(s, accetta)) return rifiuta;
  const { guadagno, dato } = guadagnoScambio(s, g.id, sc);
  // Con un compagno basta non rimetterci troppo: si vince insieme.
  if (compagni(s, g.id, sc.da)) return guadagno >= -dato * 0.25 && g.saldo - sc.avere.soldi >= 0 ? accetta : rifiuta;
  return guadagno >= Math.max(20, dato * 0.1) ? accetta : rifiuta;
}

/** In rosso: vende edifici, poi ipoteca, poi vende proprietà, sempre la cosa che pesa meno; se non resta niente, bancarotta. */
function rientra(s: Stato, g: Giocatore, possibili: Azione[]): Azione {
  const tab = tabellone(s.mappa);
  const di = <T extends Azione['tipo']>(tipo: T) => possibili.filter((a): a is Extract<Azione, { tipo: T }> => a.tipo === tipo);
  const demolizioni = di('demolisci');
  if (demolizioni.length) {
    const rimborso = (a: (typeof demolizioni)[number]) =>
      rimborsoEdificio(tab, proprietabile(tab, a.casella) as Citta, s.proprieta[a.casella]!.livello);
    return demolizioni.sort((x, y) => rimborso(y) - rimborso(x))[0]!;
  }
  const valore = (casella: number) => valoreCasella(s, g.id, casella);
  const ipoteche = di('ipoteca');
  if (ipoteche.length) return ipoteche.sort((x, y) => valore(x.casella) - valore(y.casella) || valoreIpoteca(tab, y.casella) - valoreIpoteca(tab, x.casella))[0]!;
  const vendite = di('vendi').filter((a) => s.proprieta[a.casella]?.ipotecata === false);
  if (vendite.length) return vendite.sort((x, y) => valore(x.casella) - valore(y.casella))[0]!;
  return { tipo: 'bancarotta', giocatore: g.id };
}

/** Quanto offre un bot per l'ultima città che gli manca in una regione, rispetto al suo prezzo. */
const OFFERTA_REGIONE = 3;

/**
 * Proposta per completare una regione: il bot ha tutte le città tranne una, che è di un avversario,
 * e gliela chiede in cambio di soldi (fino a tre volte il prezzo, senza intaccare la scorta).
 */
function propostaBot(s: Stato, g: Giocatore, scorta: number): Azione | null {
  const tab = tabellone(s.mappa);
  const regioni = tab.regioni.map((_, r) => r).reverse();
  for (const r of regioni) {
    const mancanti = caselleDellaRegione(tab, r).filter((i) => {
      const proprietario = s.proprieta[i]?.proprietario;
      return !proprietario || !alleati(s, proprietario, g.id);
    });
    if (mancanti.length !== 1) continue;
    const casella = mancanti[0]!;
    const proprietario = s.proprieta[casella]?.proprietario;
    if (!proprietario) continue;
    const prezzo = proprietabile(tab, casella)!.prezzo;
    const offerta = Math.min(prezzo * OFFERTA_REGIONE, g.saldo - scorta);
    if (offerta < prezzo * 2) continue;
    const azione: Azione = {
      tipo: 'proponi',
      giocatore: g.id,
      a: proprietario,
      dare: { soldi: offerta, caselle: [], grazie: [] },
      avere: { soldi: 0, caselle: [casella], grazie: [] },
      nota: '',
    };
    if (ok(s, azione)) return azione;
  }
  return null;
}

/** Cosa la stanza permette al bot in questo momento. */
export interface OpzioniBot {
  /** Può proporre uno scambio: la stanza lo concede di rado, perché non insista con le stesse proposte. */
  proporre?: boolean;
}

/** Il bot è di turno e non c'è un'asta aperta. */
function mossaDelTurno(s: Stato, g: Giocatore, opzioni: OpzioniBot): Azione {
  const tab = tabellone(s.mappa);
  const t = s.turno;
  const possibili = azioniPossibili(s, g.id);
  const di = <T extends Azione['tipo']>(tipo: T) => possibili.filter((a): a is Extract<Azione, { tipo: T }> => a.tipo === tipo);
  const scorta = riserva(s, g.id);

  if (g.saldo < 0) return rientra(s, g, possibili);

  if (t.fase === 'prigione') {
    // Finché ci sono proprietà libere conviene girare; dopo, la prigione ripara dagli affitti.
    const libere = s.proprieta.filter((p) => p && p.proprietario === null).length;
    const grazia = di('usa_grazia')[0];
    if (grazia && libere >= 6) return grazia;
    const cauzione = di('paga_cauzione')[0];
    if (cauzione && libere >= 6 && g.saldo - tab.cauzione >= scorta) return cauzione;
    return di('lancia')[0] ?? possibili[0]!;
  }

  // Proprietà libera su cui si è fermato: la compra se resta con abbastanza contante, altrimenti asta.
  const compra = di('compra')[0];
  if (compra && t.acquisto !== null) {
    const c = proprietabile(tab, t.acquisto)!;
    const completa = valoreCasella(s, g.id, t.acquisto) >= c.prezzo * 2;
    if (g.saldo - c.prezzo >= (completa ? 0 : scorta)) return compra;
  }
  const asta = di('asta')[0];
  if (asta) return asta;

  // Case: sulla città più cara tra quelle dove si può, se resta la scorta.
  const costruzioni = di('costruisci').filter((a) => {
    const c = proprietabile(tab, a.casella) as Citta;
    return g.saldo - costoProssimoEdificio(tab, c, s.proprieta[a.casella]!.livello) >= scorta;
  });
  if (costruzioni.length) return costruzioni.sort((x, y) => proprietabile(tab, y.casella)!.prezzo - proprietabile(tab, x.casella)!.prezzo)[0]!;

  // Ipoteche da togliere, quando il bot è ricco.
  const riscatto = di('riscatta').find((a) => g.saldo - costoRiscatto(tab, a.casella) >= scorta * 2);
  if (riscatto) return riscatto;

  // Prima di tirare, ogni tanto, una proposta per completare una regione (una sola aperta alla volta).
  if (opzioni.proporre && t.fase === 'lancio' && !s.scambi.some((x) => x.da === g.id)) {
    const proposta = propostaBot(s, g, scorta);
    if (proposta) return proposta;
  }

  return di('lancia')[0] ?? di('fine_turno')[0] ?? possibili.find((a) => a.tipo !== 'bancarotta') ?? possibili[0]!;
}

/**
 * La prossima azione del bot `id`, oppure `null` se adesso non ha niente da fare.
 * In ordine: offerte all'asta, risposte agli scambi, ritiro delle sue proposte non più valide, voto (segue chi ha già
 * votato), tempo a chi lo chiede, il suo turno.
 */
export function mossaBot(s: Stato, id: IdGiocatore, opzioni: OpzioniBot = {}): Azione | null {
  if (s.fase !== 'in_corso') return null;
  const g = giocatore(s, id);
  if (!g || g.eliminato) return null;

  if (s.asta) {
    const offerta = offertaAsta(s, g);
    if (offerta) return offerta;
  }

  const proposta = s.scambi.find((x) => x.a === id);
  if (proposta) return rispostaScambio(s, g, proposta);

  // Le sue proposte che nel frattempo non si possono più fare, le ritira.
  const superata = s.scambi.find((x) => x.da === id && problemiScambio(s, x).length > 0);
  if (superata) return { tipo: 'annulla', giocatore: id, scambio: superata.id };

  const t = s.turno;
  if (t.giocatore !== id) {
    // Il voto lo comincia una persona; i bot la seguono, ma mai contro un compagno.
    const voto: Azione = { tipo: 'vota', giocatore: id, favorevole: true };
    if (t.votazione.voti.length > 0 && !compagni(s, id, t.giocatore) && ok(s, voto)) return voto;
    const regalo: Azione = { tipo: 'regala_tempo', giocatore: id };
    if (t.tempo.richiesta && ok(s, regalo)) return regalo;
    return null;
  }
  if (s.asta) return null;
  return mossaDelTurno(s, g, opzioni);
}

/**
 * I bot ancora in gioco che adesso hanno qualcosa da fare, con la loro mossa.
 * @param proporre quali bot possono proporre uno scambio adesso.
 */
export function mosseDeiBot(
  s: Stato,
  bot: readonly IdGiocatore[],
  proporre: (id: IdGiocatore) => boolean = () => false,
): { giocatore: IdGiocatore; azione: Azione }[] {
  const vivi = new Set(attivi(s).map((g) => g.id));
  return bot.flatMap((id) => {
    if (!vivi.has(id)) return [];
    const azione = mossaBot(s, id, { proporre: proporre(id) });
    return azione ? [{ giocatore: id, azione }] : [];
  });
}

/* ------------------------------------------------------------------ */
/* Ritmo                                                               */
/* ------------------------------------------------------------------ */

/** Quanto dura nei browser la scena di questi eventi (dadi che rotolano, pedine che avanzano): vedi regia.ts. */
export function durataScena(s: Stato, eventi: readonly Evento[]): number {
  const n = tabellone(s.mappa).caselle.length;
  let ms = 0;
  for (const e of eventi) {
    switch (e.tipo) {
      case 'dadi':
        ms += 820;
        break;
      case 'movimento': {
        const avanti = (e.a - e.da + n) % n;
        const indietro = (e.da - e.a + n) % n;
        ms += (!e.dadi && indietro < avanti && indietro <= 3 ? indietro : avanti) * 180 + 200;
        break;
      }
      case 'prigione':
        ms += 450;
        break;
      case 'carta':
        ms += 600;
        break;
      case 'acquisto':
      case 'asta_vinta':
      case 'costruzione':
      case 'affitto':
      case 'tassa':
      case 'premio':
      case 'partenza':
      case 'prigione_fallita':
      case 'vacanza':
        ms += 250;
        break;
      default:
        break;
    }
  }
  return ms;
}

/** Il tempo di "pensare" di un bot prima della prossima mossa, oltre alla scena. */
export const PENSIERO_BOT_MS = 900;

/** Turni di partita che un bot lascia passare tra una proposta di scambio e la successiva. */
export const TURNI_TRA_PROPOSTE_BOT = 8;
