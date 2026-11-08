/*
 * Il motore: `applica(stato, azione, caso)` controlla l'azione, la esegue su una copia dello stato
 * e restituisce il nuovo stato con gli eventi per registro e animazioni. Non modifica mai lo stato ricevuto.
 * Flusso del turno: docs/analisi/03-regole-turno.md §2.
 */

import { tiraDadi } from './caso';
import { accredita, errore, paga, pagaBanca, type Contesto } from './contesto';
import { affitto, attivi, edifici, giocatore, possedute, proprietabile, regioneConEdifici, valoreVendita } from './conti';
import {
  acquistoInSospeso,
  apriAsta,
  chiudiAsta,
  costruisci,
  demolisci,
  ipoteca,
  offri,
  RILANCI,
  riscatta,
  verificaApertura,
  verificaCostruzione,
  verificaDemolizione,
  verificaIpoteca,
  verificaOfferta,
  verificaRiscatto,
} from './economia';
import {
  chiediTempo,
  regalaTempo,
  verificaEspulsione,
  verificaRegalo,
  verificaRichiesta,
  verificaVoto,
  vota,
} from './moderazione';
import { proponi, rispondi, verificaProposta, verificaRisposta } from './scambi';
import { tabellone } from './tabelloni';
import { ASSENZA_MS, GRAZIA_DEBITO_MS, scadenzaTurno, TURNI_AUTOMATICI_MAX } from './tempo';
import { chiudiTurno, elimina } from './turni';
import type { Azione, Caso, Effetto, Errore, Esito, Evento, Giocatore, IdGiocatore, NomeMazzo, Stato } from './tipi';

export { TENTATIVI_PRIGIONE } from './turni';
const DOPPI_PER_LA_PRIGIONE = 3;

const SALDO_NEGATIVO = 'Hai il saldo negativo. Vendi qualcosa per tornare in positivo o dichiara bancarotta.';

/* ------------------------------------------------------------------ */
/* Controllo                                                           */
/* ------------------------------------------------------------------ */

/** `null` se l'azione si può fare adesso, altrimenti il motivo. Serve anche all'interfaccia per i pulsanti. */
export function verifica(stato: Stato, azione: Azione): Errore | null {
  if (stato.fase === 'finita') return errore('partita_finita', 'La partita è finita.');
  const g = giocatore(stato, azione.giocatore);
  if (!g) return errore('giocatore_sconosciuto', 'Non sei un giocatore di questa partita.');
  if (g.eliminato) return errore('eliminato', 'Sei fuori dalla partita.');

  // Fuori turno: bancarotta, offerte all'asta, scambi, tempo regalato e voto.
  switch (azione.tipo) {
    case 'bancarotta':
      return null;
    case 'regala_tempo':
      return verificaRegalo(stato, g);
    case 'vota':
      return verificaVoto(stato, g, azione.favorevole);
    case 'offri':
      return verificaOfferta(stato, g, azione.importo);
    case 'proponi':
      return verificaProposta(stato, azione);
    case 'accetta':
    case 'rifiuta':
    case 'annulla':
      return verificaRisposta(stato, azione);
    default:
      if (stato.turno.giocatore !== g.id) return errore('non_tuo_turno', 'Non è il tuo turno.');
      if (stato.asta) return errore('asta_in_corso', 'Aspetta la fine dell’asta.');
      return verificaNelTurno(stato, g, azione);
  }
}

/** Le azioni di chi è di turno, quando non c'è un'asta aperta. */
function verificaNelTurno(stato: Stato, g: Giocatore, azione: Azione): Errore | null {
  const tab = tabellone(stato.mappa);
  const t = stato.turno;
  // Con le aste attive la proprietà libera va comprata o messa all'asta prima di proseguire.
  const daDecidere = stato.impostazioni.aste && acquistoInSospeso(stato) !== null;
  const decidi = errore('decidi_acquisto', 'Prima compra la proprietà o mettila all’asta.');
  switch (azione.tipo) {
    case 'lancia':
      if (t.fase === 'dopo_lancio' && !t.rilancio) return errore('gia_lanciato', 'Hai già tirato i dadi.');
      if (daDecidere) return decidi;
      if (g.saldo < 0) return errore('saldo_negativo', SALDO_NEGATIVO);
      return null;

    case 'compra': {
      const n = acquistoInSospeso(stato);
      const c = n === null ? null : proprietabile(tab, n);
      if (!c) return errore('niente_da_comprare', 'Non c’è niente da comprare.');
      if (g.saldo < c.prezzo) return errore('soldi_insufficienti', 'Non hai abbastanza soldi.');
      return null;
    }

    case 'asta':
      return verificaApertura(stato);

    case 'fine_turno':
      if (t.fase !== 'dopo_lancio') return errore('non_ancora_lanciato', 'Prima devi tirare i dadi.');
      if (t.rilancio) return errore('devi_rilanciare', 'Hai fatto un doppio: tira ancora.');
      if (daDecidere) return decidi;
      if (g.saldo < 0) return errore('saldo_negativo', SALDO_NEGATIVO);
      return null;

    case 'paga_cauzione':
      if (t.fase !== 'prigione') return errore('non_in_prigione', 'Non sei in prigione.');
      if (g.saldo < tab.cauzione) return errore('soldi_insufficienti', 'Non hai abbastanza soldi.');
      return null;

    case 'usa_grazia':
      if (t.fase !== 'prigione') return errore('non_in_prigione', 'Non sei in prigione.');
      if (azione.mazzo ? !g.carteGrazia.includes(azione.mazzo) : g.carteGrazia.length === 0) {
        return errore('niente_grazia', 'Non hai una Carta Grazia.');
      }
      if (g.saldo < 0) return errore('saldo_negativo', SALDO_NEGATIVO);
      return null;

    case 'vendi': {
      const c = proprietabile(tab, azione.casella);
      if (!c || stato.proprieta[azione.casella]?.proprietario !== g.id) {
        return errore('non_tua', 'Questa proprietà non è tua.');
      }
      if (c.tipo === 'citta' && regioneConEdifici(stato, c.regione)) {
        return errore('edifici_nella_regione', 'Prima vendi le case e gli alberghi di questa regione.');
      }
      return null;
    }

    case 'costruisci':
      return verificaCostruzione(stato, g, azione.casella);
    case 'demolisci':
      return verificaDemolizione(stato, g, azione.casella);
    case 'ipoteca':
      return verificaIpoteca(stato, g, azione.casella);
    case 'riscatta':
      return verificaRiscatto(stato, g, azione.casella);
    case 'chiedi_tempo':
      return verificaRichiesta(stato);

    // Controllate prima, in `verifica`.
    case 'bancarotta':
    case 'offri':
    case 'proponi':
    case 'accetta':
    case 'rifiuta':
    case 'annulla':
    case 'regala_tempo':
    case 'vota':
      return null;
  }
}

/* ------------------------------------------------------------------ */
/* Esecuzione                                                          */
/* ------------------------------------------------------------------ */

function contesto(stato: Stato, caso: Caso, adesso: number): Contesto {
  const s = JSON.parse(JSON.stringify(stato)) as Stato;
  return { s, tab: tabellone(s.mappa), caso, adesso, eventi: [], turnoFinito: false };
}

/** Chi gioca ed è finito in debito ha più tempo per rimettersi in pari. */
function ritocca(ctx: Contesto): void {
  const { s } = ctx;
  if (s.fase !== 'in_corso') return;
  const g = giocatore(s, s.turno.giocatore);
  if (g && g.saldo < 0 && s.turno.tempo.grazia < GRAZIA_DEBITO_MS) s.turno.tempo.grazia = GRAZIA_DEBITO_MS;
}

/**
 * @param adesso orologio del server in millisecondi: serve alle cose a tempo (asta, timer di turno, voto).
 */
export function applica(stato: Stato, azione: Azione, caso: Caso, adesso = 0): Esito {
  const problema = verifica(stato, azione);
  if (problema) return { ok: false, ...problema };

  const ctx = contesto(stato, caso, adesso);
  const s = ctx.s;
  const g = giocatore(s, azione.giocatore)!;

  switch (azione.tipo) {
    case 'lancia':
      lancia(ctx, g);
      break;
    case 'compra':
      compra(ctx, g);
      break;
    case 'fine_turno':
      chiudiTurno(ctx);
      break;
    case 'paga_cauzione':
      pagaBanca(ctx, g, ctx.tab.cauzione, false);
      esciDiPrigione(ctx, g, 'cauzione');
      chiudiTurno(ctx);
      break;
    case 'usa_grazia': {
      const mazzo = azione.mazzo ?? g.carteGrazia[0]!;
      g.carteGrazia.splice(g.carteGrazia.indexOf(mazzo), 1);
      esciDiPrigione(ctx, g, 'grazia');
      chiudiTurno(ctx);
      break;
    }
    case 'vendi':
      vendi(ctx, g, azione.casella);
      break;
    case 'costruisci':
      costruisci(ctx, g, azione.casella);
      break;
    case 'demolisci':
      demolisci(ctx, g, azione.casella);
      break;
    case 'ipoteca':
      ipoteca(ctx, g, azione.casella);
      break;
    case 'riscatta':
      riscatta(ctx, g, azione.casella);
      break;
    case 'asta':
      apriAsta(ctx, g);
      break;
    case 'offri':
      offri(ctx, g, azione.importo);
      break;
    case 'proponi':
      proponi(ctx, azione);
      break;
    case 'accetta':
    case 'rifiuta':
    case 'annulla':
      rispondi(ctx, azione);
      break;
    case 'bancarotta':
      elimina(ctx, g, 'bancarotta');
      break;
    case 'chiedi_tempo':
      chiediTempo(ctx, g);
      break;
    case 'regala_tempo':
      regalaTempo(ctx, g);
      break;
    case 'vota':
      vota(ctx, g, azione.favorevole);
      break;
  }
  ritocca(ctx);
  return { ok: true, stato: s, eventi: ctx.eventi };
}

/**
 * L'host toglie un giocatore dalla partita (la stanza controlla che sia l'host e che la stanza sia privata).
 * Non si può togliere chi sta giocando il suo turno.
 */
export function espelli(stato: Stato, id: IdGiocatore, caso: Caso, adesso: number): Esito {
  const problema = verificaEspulsione(stato, id);
  if (problema) return { ok: false, ...problema };
  const ctx = contesto(stato, caso, adesso);
  elimina(ctx, giocatore(ctx.s, id)!, 'espulsione');
  ritocca(ctx);
  return { ok: true, stato: ctx.s, eventi: ctx.eventi };
}

/* ---------------------------- Scadenze ----------------------------- */

type Scadenza =
  | { tipo: 'asta'; quando: number }
  | { tipo: 'turno'; quando: number }
  | { tipo: 'voto'; quando: number }
  | { tipo: 'assenza'; quando: number; giocatore: IdGiocatore };

/** Tutto quello che scade nella partita, dal primo. */
function scadenze(s: Stato): Scadenza[] {
  if (s.fase !== 'in_corso') return [];
  const lista: Scadenza[] = [];
  if (s.asta) lista.push({ tipo: 'asta', quando: s.asta.scadenza });
  const turno = scadenzaTurno(s);
  if (turno !== null) lista.push({ tipo: 'turno', quando: turno });
  if (s.turno.votazione.scadenza !== null) lista.push({ tipo: 'voto', quando: s.turno.votazione.scadenza });
  for (const g of s.giocatori) {
    if (!g.eliminato && g.offlineDa !== null) lista.push({ tipo: 'assenza', quando: g.offlineDa + ASSENZA_MS, giocatore: g.id });
  }
  return lista.sort((a, b) => a.quando - b.quando);
}

/**
 * Quando scade la prossima cosa a tempo (fine dell'asta, tempo del turno, voto, assenza),
 * in millisecondi dell'orologio del server; `null` se niente.
 */
export function prossimaScadenza(stato: Stato): number | null {
  return scadenze(stato)[0]?.quando ?? null;
}

/** Scadenze applicate in un colpo al massimo: dopo una lunga pausa possono essercene diverse. */
const SCADENZE_MAX = 50;

/**
 * Applica, in ordine, tutto quello che è scaduto a quest'ora: chiude l'asta, gioca il turno di chi ha finito
 * il tempo, toglie chi è assente da troppo o chi è stato votato. `null` se non scade niente.
 */
export function applicaScadenze(stato: Stato, caso: Caso, adesso: number): Esito | null {
  let s = stato;
  const eventi: Evento[] = [];
  let cambiato = false;
  for (let i = 0; i < SCADENZE_MAX; i++) {
    const prima = scadenze(s)[0];
    if (!prima || prima.quando > adesso) break;
    const ctx = contesto(s, caso, adesso);
    switch (prima.tipo) {
      case 'asta':
        chiudiAsta(ctx);
        break;
      case 'assenza':
        elimina(ctx, giocatore(ctx.s, prima.giocatore)!, 'assenza');
        break;
      case 'voto':
        elimina(ctx, giocatore(ctx.s, ctx.s.turno.giocatore)!, 'voto');
        break;
      case 'turno':
        giocaInAutomatico(ctx);
        break;
    }
    ritocca(ctx);
    s = ctx.s;
    eventi.push(...ctx.eventi);
    cambiato = true;
  }
  return cambiato ? { ok: true, stato: s, eventi } : null;
}

/** La mossa che il gioco fa per chi ha finito il tempo: tira, manda all'asta, finisce il turno. Non compra mai. */
function mossaAutomatica(s: Stato, id: IdGiocatore): Azione {
  const t = s.turno;
  // Con le aste la proprietà libera va decisa prima di tirare ancora o di finire il turno.
  if (s.impostazioni.aste && acquistoInSospeso(s) !== null) return { tipo: 'asta', giocatore: id };
  if (t.fase !== 'dopo_lancio' || t.rilancio) return { tipo: 'lancia', giocatore: id };
  return { tipo: 'fine_turno', giocatore: id };
}

/**
 * Il tempo del turno è finito: il gioco tira i dadi e chiude il turno al posto di chi gioca.
 * In debito fa bancarotta. Con il timer, chi ha già avuto due turni di fila finiti così esce dalla partita.
 * Se il gioco apre un'asta, il turno riprende (e finisce) quando l'asta si chiude.
 */
function giocaInAutomatico(ctx: Contesto): void {
  const id = ctx.s.turno.giocatore;
  const numero = ctx.s.turno.numero;
  const g = giocatore(ctx.s, id)!;
  const tempo = ctx.s.turno.tempo;
  if (!tempo.automatico) {
    if (ctx.s.impostazioni.timerTurno && g.automatici >= TURNI_AUTOMATICI_MAX) {
      elimina(ctx, g, 'tempo');
      return;
    }
    tempo.automatico = true;
    ctx.eventi.push({ tipo: 'tempo_scaduto', giocatore: id, assente: g.offlineDa !== null });
  }
  for (let i = 0; i < 10; i++) {
    const s = ctx.s;
    if (s.fase !== 'in_corso' || s.turno.giocatore !== id || s.turno.numero !== numero || s.asta) return;
    const io = giocatore(s, id)!;
    if (io.saldo < 0) {
      elimina(ctx, io, 'bancarotta', true);
      return;
    }
    const esito = applica(s, mossaAutomatica(s, id), ctx.caso, ctx.adesso);
    if (!esito.ok) break;
    ctx.s = esito.stato;
    ctx.eventi.push(...esito.eventi);
  }
  // Non dovrebbe succedere: se il turno resta bloccato, il giocatore esce e la partita va avanti.
  const s = ctx.s;
  if (s.fase === 'in_corso' && s.turno.numero === numero && !s.asta) elimina(ctx, giocatore(s, id)!, 'tempo');
}

/* ------------------------- Dadi e movimento ------------------------ */

function lancia(ctx: Contesto, g: Giocatore): void {
  const t = ctx.s.turno;
  const dadi = tiraDadi(ctx.caso);
  const doppio = dadi[0] === dadi[1];
  const inPrigione = t.fase === 'prigione';
  t.dadi = dadi;
  t.acquisto = null;
  t.rilancio = false;
  t.fase = 'dopo_lancio';
  ctx.eventi.push({ tipo: 'dadi', giocatore: g.id, dadi });

  if (inPrigione) {
    if (!doppio) {
      g.prigione = (g.prigione ?? 0) + 1;
      ctx.eventi.push({ tipo: 'prigione_fallita', giocatore: g.id, tentativi: g.prigione });
      chiudiTurno(ctx);
      return;
    }
    // Esce con il doppio e si muove di quel tiro, senza tirare ancora.
    esciDiPrigione(ctx, g, 'doppio');
    muovi(ctx, g, dadi[0] + dadi[1], dadi);
  } else {
    if (doppio) t.doppi++;
    if (doppio && t.doppi >= DOPPI_PER_LA_PRIGIONE) {
      mandaInPrigione(ctx, g, 'tre_doppi');
    } else {
      muovi(ctx, g, dadi[0] + dadi[1], dadi);
      if (doppio && !ctx.turnoFinito) t.rilancio = true;
    }
  }
  if (ctx.turnoFinito) chiudiTurno(ctx);
}

/** Sposta la pedina e applica la casella d'arrivo. Avanzando oltre la Partenza si incassa il premio. */
function muovi(ctx: Contesto, g: Giocatore, passi: number, dadi?: [number, number]): void {
  const n = ctx.tab.caselle.length;
  const da = g.posizione;
  const a = (((da + passi) % n) + n) % n;
  g.posizione = a;
  ctx.eventi.push(dadi ? { tipo: 'movimento', giocatore: g.id, da, a, dadi } : { tipo: 'movimento', giocatore: g.id, da, a });

  if (passi > 0 && da + passi >= n) {
    const arrivo = a === 0;
    const importo = arrivo ? ctx.tab.partenza.arrivo : ctx.tab.partenza.passaggio;
    ctx.eventi.push({ tipo: 'partenza', giocatore: g.id, importo, arrivo });
    accredita(ctx, g, importo);
  }
  arriva(ctx, g);
}

function arriva(ctx: Contesto, g: Giocatore): void {
  const { s, tab } = ctx;
  const casella = g.posizione;
  const c = tab.caselle[casella]!;
  switch (c.tipo) {
    case 'citta':
    case 'stazione':
    case 'servizio': {
      const p = s.proprieta[casella]!;
      if (p.proprietario === null) {
        s.turno.acquisto = casella;
        return;
      }
      if (p.proprietario === g.id) return;
      const dadi = s.turno.dadi;
      const importo = affitto(s, casella, dadi ? dadi[0] + dadi[1] : 0);
      if (importo <= 0) return;
      ctx.eventi.push({ tipo: 'affitto', da: g.id, a: p.proprietario, casella, importo });
      paga(ctx, g, p.proprietario, importo);
      return;
    }
    case 'tassa': {
      const importo =
        c.tassa.tipo === 'fissa' ? c.tassa.valore : Math.round((Math.max(0, g.saldo) * c.tassa.valore) / 100);
      if (importo <= 0) return;
      ctx.eventi.push({ tipo: 'tassa', giocatore: g.id, casella, importo });
      pagaBanca(ctx, g, importo, true);
      return;
    }
    case 'carta':
      pesca(ctx, g, c.mazzo);
      return;
    case 'vai_in_prigione':
      mandaInPrigione(ctx, g, 'casella');
      return;
    case 'vacanza': {
      const incasso = s.impostazioni.cassaVacanza ? s.cassaVacanza : 0;
      s.cassaVacanza = 0;
      g.vacanza = true;
      ctx.eventi.push({ tipo: 'vacanza', giocatore: g.id, incasso });
      accredita(ctx, g, incasso);
      ctx.turnoFinito = true;
      return;
    }
    case 'partenza':
    case 'prigione':
      return;
  }
}

function mandaInPrigione(ctx: Contesto, g: Giocatore, motivo: 'casella' | 'carta' | 'tre_doppi'): void {
  g.posizione = ctx.tab.prigione;
  g.prigione = 0;
  ctx.eventi.push({ tipo: 'prigione', giocatore: g.id, motivo });
  ctx.turnoFinito = true;
}

function esciDiPrigione(ctx: Contesto, g: Giocatore, modo: 'doppio' | 'cauzione' | 'grazia'): void {
  g.prigione = null;
  ctx.eventi.push({ tipo: 'uscita_prigione', giocatore: g.id, modo });
}

/* ------------------------------ Carte ------------------------------ */

/** La Carta Grazia resta nel mazzo, ma si salta finché qualcuno la tiene. */
function pesca(ctx: Contesto, g: Giocatore, nome: NomeMazzo): void {
  const mazzo = ctx.s.mazzi[nome];
  const carte = ctx.tab.mazzi[nome];
  const tenuta = ctx.s.giocatori.some((x) => x.carteGrazia.includes(nome));
  for (;;) {
    const id = mazzo.ordine[mazzo.prossima]!;
    mazzo.prossima = (mazzo.prossima + 1) % mazzo.ordine.length;
    const carta = carte[id]!;
    if (carta.effetto.tipo === 'grazia' && tenuta) continue;
    ctx.eventi.push({ tipo: 'carta', giocatore: g.id, mazzo: nome, carta: id, testo: carta.testo });
    eseguiEffetto(ctx, g, carta.effetto, nome);
    return;
  }
}

function eseguiEffetto(ctx: Contesto, g: Giocatore, effetto: Effetto, mazzo: NomeMazzo): void {
  const { s, tab } = ctx;
  const n = tab.caselle.length;
  switch (effetto.tipo) {
    case 'soldi':
      if (effetto.importo >= 0) accredita(ctx, g, effetto.importo);
      else pagaBanca(ctx, g, -effetto.importo, true);
      return;
    case 'da_ognuno':
      for (const altro of attivi(s)) if (altro.id !== g.id) paga(ctx, altro, g.id, effetto.importo);
      return;
    case 'a_ognuno':
      for (const altro of attivi(s)) if (altro.id !== g.id) paga(ctx, g, altro.id, effetto.importo);
      return;
    case 'vai_a':
      muovi(ctx, g, (((effetto.casella - g.posizione) % n) + n) % n);
      return;
    case 'passi':
      muovi(ctx, g, effetto.passi);
      return;
    case 'prossima': {
      let passi = 1;
      while (passi < n && tab.caselle[(g.posizione + passi) % n]!.tipo !== effetto.casella) passi++;
      muovi(ctx, g, passi);
      return;
    }
    case 'prigione':
      mandaInPrigione(ctx, g, 'carta');
      return;
    case 'grazia':
      g.carteGrazia.push(mazzo);
      return;
    case 'riparazioni': {
      const e = edifici(s, g.id);
      pagaBanca(ctx, g, e.case * effetto.casa + e.alberghi * effetto.albergo, true);
      return;
    }
  }
}

/* ------------------------ Compravendite ---------------------------- */

function compra(ctx: Contesto, g: Giocatore): void {
  const casella = ctx.s.turno.acquisto!;
  const prezzo = proprietabile(ctx.tab, casella)!.prezzo;
  g.saldo -= prezzo;
  ctx.s.proprieta[casella]!.proprietario = g.id;
  ctx.s.turno.acquisto = null;
  ctx.eventi.push({ tipo: 'acquisto', giocatore: g.id, casella, prezzo });
}

function vendi(ctx: Contesto, g: Giocatore, casella: number): void {
  const importo = valoreVendita(ctx.s, casella);
  ctx.s.proprieta[casella] = { proprietario: null, livello: 0, ipotecata: false };
  ctx.eventi.push({ tipo: 'vendita', giocatore: g.id, casella, importo });
  accredita(ctx, g, importo);
}

/* ---------------------------- Aiuti -------------------------------- */

/**
 * Le azioni che il giocatore può fare adesso. Per l'asta propone i rilanci dei pulsanti;
 * gli scambi non ci sono, perché il loro contenuto lo sceglie il giocatore.
 */
export function azioniPossibili(stato: Stato, id: IdGiocatore): Azione[] {
  const offerta = stato.asta?.migliore?.importo ?? 0;
  const candidate: Azione[] = [
    { tipo: 'lancia', giocatore: id },
    { tipo: 'compra', giocatore: id },
    { tipo: 'asta', giocatore: id },
    { tipo: 'fine_turno', giocatore: id },
    { tipo: 'paga_cauzione', giocatore: id },
    { tipo: 'usa_grazia', giocatore: id },
    ...RILANCI.map((r): Azione => ({ tipo: 'offri', giocatore: id, importo: offerta + r })),
    ...possedute(stato, id).flatMap((casella): Azione[] =>
      (['costruisci', 'demolisci', 'ipoteca', 'riscatta', 'vendi'] as const).map((tipo) => ({ tipo, giocatore: id, casella })),
    ),
    { tipo: 'bancarotta', giocatore: id },
  ];
  return candidate.filter((a) => verifica(stato, a) === null);
}
