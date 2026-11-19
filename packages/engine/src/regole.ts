/*
 * Il motore: `applica(stato, azione, caso)` controlla l'azione, la esegue su una copia dello stato
 * e restituisce il nuovo stato con gli eventi per registro e animazioni. Non modifica mai lo stato ricevuto.
 * Flusso del turno: docs/analisi/03-regole-turno.md §2.
 */

import { tiraDadi } from './caso';
import { caricaStella, effettoDadoCosmico, premioPartenza, prossimaLibera, tiraDadoCosmico } from './cosmo';
import { accredita, errore, paga, pagaBanca, segnaTrasferimento, type Contesto } from './contesto';
import {
  affitto,
  alleati,
  attivi,
  compagni,
  edifici,
  giocatore,
  possedute,
  prezzoAcquisto,
  proprietabile,
  regioneConEdifici,
  valoreVendita,
} from './conti';
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
  verificaOffertaInTempo,
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
import {
  apriSfida,
  biglietto,
  chiudiSfida,
  giocaMorra,
  lanciaSfida,
  scadenzaSfida,
  verificaMeta,
  verificaSfida,
} from './viaggi';

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
    // La sfida a morra: lo sfidante (di turno) decide, il proprietario (fuori turno) risponde.
    case 'paga_affitto':
      return verificaSfida(stato, g, azione.tipo);
    case 'sfida':
    case 'morra':
      return verificaSfida(stato, g, azione.tipo, azione.segno);
    default:
      if (stato.turno.giocatore !== g.id) return errore('non_tuo_turno', 'Non è il tuo turno.');
      if (stato.asta) return errore('asta_in_corso', 'Aspetta la fine dell’asta.');
      if (stato.sfida) return errore('sfida_in_corso', 'Prima paga l’affitto o finisci la sfida a morra.');
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

    // Il volo prende il posto del tiro: si può quando si potrebbe tirare, ma non dalla prigione.
    case 'vola':
      if (!tab.viaggi) return errore('niente_voli', 'Su questo tabellone non si vola.');
      if (t.fase === 'prigione') return errore('niente_voli', 'Dalla prigione non si vola: prima devi uscire.');
      if (t.fase === 'dopo_lancio' && !t.rilancio) return errore('gia_lanciato', 'In questo turno ti sei già mosso.');
      if (daDecidere) return decidi;
      if (g.saldo < 0) return errore('saldo_negativo', SALDO_NEGATIVO);
      return verificaMeta(stato, g, azione.casella);

    case 'compra': {
      const n = acquistoInSospeso(stato);
      const c = n === null ? null : proprietabile(tab, n);
      if (!c) return errore('niente_da_comprare', 'Non c’è niente da comprare.');
      if (g.saldo < prezzoAcquisto(stato, n!)) return errore('soldi_insufficienti', 'Non hai abbastanza soldi.');
      return null;
    }

    case 'asta':
      return verificaApertura(stato);

    case 'fine_turno':
      if (t.fase !== 'dopo_lancio') return errore('non_ancora_lanciato', 'Prima devi tirare i dadi.');
      if (t.rilancio) return errore('devi_rilanciare', 'Devi tirare ancora i dadi.');
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
    case 'paga_affitto':
    case 'sfida':
    case 'morra':
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
  const problema = verifica(stato, azione) ?? (azione.tipo === 'offri' ? verificaOffertaInTempo(stato, adesso) : null);
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
    case 'vola':
      vola(ctx, g, azione.casella);
      break;
    case 'paga_affitto':
      chiudiSfida(ctx, s.sfida!.importo);
      break;
    case 'sfida':
      lanciaSfida(ctx, azione.segno);
      break;
    case 'morra':
      giocaMorra(ctx, azione.segno);
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
  | { tipo: 'sfida'; quando: number }
  | { tipo: 'turno'; quando: number }
  | { tipo: 'voto'; quando: number }
  | { tipo: 'assenza'; quando: number; giocatore: IdGiocatore };

/** Tutto quello che scade nella partita, dal primo. */
function scadenze(s: Stato): Scadenza[] {
  if (s.fase !== 'in_corso') return [];
  const lista: Scadenza[] = [];
  if (s.asta) lista.push({ tipo: 'asta', quando: s.asta.scadenza });
  if (s.sfida) lista.push({ tipo: 'sfida', quando: s.sfida.scadenza });
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
      case 'sfida':
        scadenzaSfida(ctx);
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
 * Se il gioco apre un'asta (o finisce sulla proprietà di un avversario, con la sfida a morra), il turno riprende
 * (e finisce) quando l'asta o la sfida si chiude.
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
    if (s.fase !== 'in_corso' || s.turno.giocatore !== id || s.turno.numero !== numero || s.asta || s.sfida) return;
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
  if (s.fase === 'in_corso' && s.turno.numero === numero && !s.asta && !s.sfida) elimina(ctx, giocatore(s, id)!, 'tempo');
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
  // Chi aveva il Biglietto omaggio e tira i dadi invece di volare, lo perde.
  delete t.voloOmaggio;
  if (doppio) ctx.s.statistiche.doppi++;
  // Con le regole folli, il dado cosmico rotola insieme ai due dadi.
  const cosmico = tiraDadoCosmico(ctx);
  ctx.eventi.push({ tipo: 'dadi', giocatore: g.id, dadi, ...(cosmico ? { cosmico } : {}) });
  if (cosmico) effettoDadoCosmico(ctx, g, cosmico);

  if (inPrigione) {
    if (!doppio) {
      g.prigione = (g.prigione ?? 0) + 1;
      ctx.eventi.push({ tipo: 'prigione_fallita', giocatore: g.id, tentativi: g.prigione });
      chiudiTurno(ctx);
      return;
    }
    // Esce con il doppio e si muove di quel tiro, senza tirare ancora.
    esciDiPrigione(ctx, g, 'doppio');
    muoviConIDadi(ctx, g, dadi[0] + dadi[1], dadi);
  } else {
    if (doppio) t.doppi++;
    if (doppio && t.doppi >= DOPPI_PER_LA_PRIGIONE) {
      mandaInPrigione(ctx, g, 'tre_doppi');
    } else {
      muoviConIDadi(ctx, g, dadi[0] + dadi[1], dadi);
      if (doppio && !ctx.turnoFinito) t.rilancio = true;
    }
  }
  if (ctx.turnoFinito) chiudiTurno(ctx);
}

/**
 * Il volo del Giro del mondo, al posto del tiro: si paga il biglietto all'aeroporto del lato (o alla banca), la pedina
 * vola sulla meta senza passare dalla Partenza e la casella d'arrivo fa effetto. Niente dadi, quindi niente doppio.
 */
function vola(ctx: Contesto, g: Giocatore, casella: number): void {
  const t = ctx.s.turno;
  const b = biglietto(ctx.s, g.id, casella)!;
  t.dadi = null;
  t.acquisto = null;
  t.rilancio = false;
  t.fase = 'dopo_lancio';
  delete t.voloOmaggio;
  ctx.eventi.push({ tipo: 'volo', giocatore: g.id, da: g.posizione, a: casella, prezzo: b.prezzo, aeroporto: b.aeroporto, incassa: b.incassa });
  if (b.incassa) paga(ctx, g, b.incassa, b.prezzo);
  else pagaBanca(ctx, g, b.prezzo, true);
  g.posizione = casella;
  arriva(ctx, g);
  if (ctx.turnoFinito) chiudiTurno(ctx);
}

/**
 * Lo spostamento di un tiro: con la gravità invertita (regole folli) all'indietro, e la Partenza paga anche così.
 * Il dado cosmico può raddoppiarlo (Iperspazio) o allungarlo con il volo del Razzo fino alla prossima proprietà libera:
 * il razzo parte prima che la casella dei dadi faccia effetto.
 */
function muoviConIDadi(ctx: Contesto, g: Giocatore, passi: number, dadi: [number, number]): void {
  const verso = ctx.s.cosmo?.verso ?? 1;
  const dado = ctx.s.cosmo?.dado ?? null;
  const lunghezza = dado === 'iperspazio' ? 2 * passi : passi;
  if (dado !== 'razzo') {
    muovi(ctx, g, verso * lunghezza, dadi, verso === -1);
    return;
  }
  muovi(ctx, g, verso * passi, dadi, verso === -1, { fermati: false });
  const meta = prossimaLibera(ctx, g.posizione, verso);
  if (meta === null || meta === g.posizione) {
    arriva(ctx, g);
    return;
  }
  const n = ctx.tab.caselle.length;
  // Il razzo che parte dalla Supernova ci passa sopra senza fermarsi: polvere di stelle.
  if (ctx.tab.caselle[g.posizione]!.tipo === 'supernova') caricaStella(ctx, 'polvere', ctx.tab.follie?.polvere ?? 0, g.id);
  ctx.eventi.push({ tipo: 'razzo', giocatore: g.id, da: g.posizione, a: meta });
  const volo = verso === 1 ? (meta - g.posizione + n) % n : -((g.posizione - meta + n) % n);
  muovi(ctx, g, volo, undefined, verso === -1, { razzo: true });
}

/**
 * Sposta la pedina e applica la casella d'arrivo. Avanzando oltre la Partenza si incassa il premio;
 * all'indietro solo con `indietroPaga` (gravità invertita), non con «Torna indietro di 3 caselle».
 * `fermati: false`: la casella d'arrivo non fa effetto (riparte subito, con il razzo); `razzo`: è il volo del razzo.
 */
function muovi(
  ctx: Contesto,
  g: Giocatore,
  passi: number,
  dadi?: [number, number],
  indietroPaga = false,
  { fermati = true, razzo = false }: { fermati?: boolean; razzo?: boolean } = {},
): void {
  const n = ctx.tab.caselle.length;
  const da = g.posizione;
  const a = (((da + passi) % n) + n) % n;
  g.posizione = a;
  ctx.eventi.push({
    tipo: 'movimento',
    giocatore: g.id,
    da,
    a,
    ...(dadi ? { dadi } : {}),
    ...(passi < 0 ? { verso: -1 as const } : {}),
    ...(razzo ? { razzo: true as const } : {}),
  });

  const avanti = passi > 0 && da + passi >= n;
  const indietro = passi < 0 && indietroPaga && da > 0 && da + passi <= 0;
  if (avanti || indietro) {
    const arrivo = a === 0;
    const { importo, tempesta, allaStella } = premioPartenza(ctx, arrivo);
    ctx.eventi.push({ tipo: 'partenza', giocatore: g.id, importo, arrivo, ...(tempesta ? { tempesta: true as const } : {}) });
    accredita(ctx, g, importo);
    caricaStella(ctx, 'tempesta', allaStella, g.id);
  }
  polvereDiStelle(ctx, g, da, passi);
  if (fermati) arriva(ctx, g);
}

/**
 * L'avversario con meno contante (a pari contante il primo nell'ordine dei turni): riceve quello che la Supernova
 * darebbe oltre il tetto. Niente compagni di squadra, se no il tetto non servirebbe. `undefined` se non c'è nessuno.
 */
function piuPovero(s: Stato, g: Giocatore): Giocatore | undefined {
  let povero: Giocatore | undefined;
  for (const x of attivi(s)) {
    if (x.id === g.id || compagni(s, g.id, x.id)) continue;
    if (!povero || x.saldo < povero.saldo) povero = x;
  }
  return povero;
}

/**
 * Polvere di stelle (regole folli): chi passa sopra la Supernova senza fermarsi, in avanti o all'indietro,
 * fa crescere il malloppo. I soldi li mette la banca.
 */
function polvereDiStelle(ctx: Contesto, g: Giocatore, da: number, passi: number): void {
  const polvere = ctx.tab.follie?.polvere ?? 0;
  if (polvere <= 0) return;
  const n = ctx.tab.caselle.length;
  const verso = Math.sign(passi);
  for (let i = 1; i < Math.abs(passi); i++) {
    const casella = (((da + verso * i) % n) + n) % n;
    if (ctx.tab.caselle[casella]!.tipo === 'supernova') caricaStella(ctx, 'polvere', polvere, g.id);
  }
}

function arriva(ctx: Contesto, g: Giocatore): void {
  const { s, tab } = ctx;
  const casella = g.posizione;
  const c = tab.caselle[casella]!;
  s.statistiche.visite[casella] = (s.statistiche.visite[casella] ?? 0) + 1;
  switch (c.tipo) {
    case 'citta':
    case 'stazione':
    case 'servizio': {
      const p = s.proprieta[casella]!;
      if (p.proprietario === null) {
        s.turno.acquisto = casella;
        return;
      }
      // Sulle proprie caselle, e a squadre su quelle dei compagni, non si paga.
      if (alleati(s, p.proprietario, g.id)) return;
      // Senza dadi (si è arrivati in volo) i servizi contano 7, il tiro più probabile.
      const dadi = s.turno.dadi;
      let importo = affitto(s, casella, dadi ? dadi[0] + dadi[1] : 7);
      if (importo <= 0) return;
      // Scudo (dado cosmico): chi gioca non paga affitti in questo tiro.
      if (s.cosmo?.dado === 'scudo' && g.id === s.turno.giocatore) {
        ctx.eventi.push({ tipo: 'scudo', giocatore: g.id, casella, importo });
        return;
      }
      // Affitto quantistico (regole folli): un dado moltiplica l'affitto, anche per zero.
      const quantico = tab.follie?.quantico;
      if (quantico) {
        const faccia = ctx.caso.intero(quantico.length) + 1;
        const fattore = quantico[faccia - 1]!;
        ctx.eventi.push({ tipo: 'quantico', giocatore: g.id, casella, faccia, fattore });
        importo = Math.round(importo * fattore);
        if (importo <= 0) return;
      }
      // Giro del mondo: chi gioca può pagare o sfidare il proprietario a morra cinese.
      if (tab.viaggi?.sfida && g.id === s.turno.giocatore) {
        apriSfida(ctx, g, p.proprietario, casella, importo);
        return;
      }
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
    case 'premio':
      ctx.eventi.push({ tipo: 'premio', giocatore: g.id, casella, importo: c.importo });
      accredita(ctx, g, c.importo);
      return;
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
    case 'fionda': {
      // Riparte della stessa somma dei dadi, nel verso di marcia del giro (la gravità invertita vale anche qui).
      const verso = s.cosmo?.verso ?? 1;
      const dadi = s.turno.dadi;
      const passi = verso * (dadi ? dadi[0] + dadi[1] : 7);
      ctx.eventi.push({ tipo: 'fionda', giocatore: g.id, passi });
      muovi(ctx, g, passi, undefined, verso === -1);
      return;
    }
    case 'wormhole': {
      // Mai su un altro wormhole: niente catene infinite.
      const mete = tab.caselle.flatMap((x, i) => (x.tipo === 'wormhole' ? [] : [i]));
      teletrasporta(ctx, g, mete[ctx.caso.intero(mete.length)]!);
      arriva(ctx, g);
      return;
    }
    case 'buco_nero': {
      const importo = Math.floor((Math.max(0, g.saldo) * (tab.follie?.bucoNero ?? 0)) / 100);
      if (importo <= 0 || !s.cosmo) return;
      ctx.eventi.push({ tipo: 'buco_nero', giocatore: g.id, casella, importo });
      pagaBanca(ctx, g, importo, false);
      s.cosmo.malloppo += importo;
      return;
    }
    case 'supernova': {
      const cosmo = s.cosmo;
      const f = tab.follie;
      if (!cosmo || !f || cosmo.malloppo <= 0) return;
      // Il dado della Supernova moltiplica il malloppo: sopra ×1 la differenza la mette la banca.
      const faccia = ctx.caso.intero(f.supernova.length) + 1;
      const fattore = f.supernova[faccia - 1]!;
      const malloppo = cosmo.malloppo;
      const vincita = Math.floor(malloppo * fattore);
      // Sotto ×1 il resto rimane nella stella; e la banca la riporta al malloppo di partenza: non resta mai vuota.
      const resta = Math.max(f.malloppo, malloppo - vincita);
      cosmo.malloppo = resta;
      // Il tetto: chi vince arriva al massimo a `f.tetto` di contante, il resto va all'avversario più povero.
      const importo = Math.min(vincita, Math.max(0, f.tetto - g.saldo));
      const povero = importo < vincita ? piuPovero(s, g) : undefined;
      const alPovero = povero ? { giocatore: povero.id, importo: vincita - importo } : null;
      ctx.eventi.push({ tipo: 'supernova', giocatore: g.id, casella, malloppo, faccia, fattore, importo, resta, alPovero });
      accredita(ctx, g, importo);
      if (povero && alPovero) accredita(ctx, povero, alPovero.importo);
      return;
    }
    case 'roulette': {
      const spicchi = tab.follie?.roulette ?? [];
      if (spicchi.length === 0) return;
      const spicchio = ctx.caso.intero(spicchi.length);
      const uscito = spicchi[spicchio]!;
      ctx.eventi.push({ tipo: 'roulette', giocatore: g.id, spicchio, testo: uscito.testo });
      eseguiEffetto(ctx, g, uscito.effetto, 'cartolina');
      return;
    }
    case 'bermuda': {
      // Si sparisce e si ricompare su una casella a caso, mai su un altro Triangolo: niente catene infinite.
      const mete = tab.caselle.flatMap((x, i) => (x.tipo === 'bermuda' ? [] : [i]));
      const a = mete[ctx.caso.intero(mete.length)]!;
      ctx.eventi.push({ tipo: 'bermuda', giocatore: g.id, da: casella, a });
      g.posizione = a;
      arriva(ctx, g);
      return;
    }
    case 'antipodi': {
      // Si sbuca dall'altra parte del mondo: il lato opposto del tabellone, senza passare dalla Partenza.
      const a = (casella + tab.caselle.length / 2) % tab.caselle.length;
      ctx.eventi.push({ tipo: 'antipodi', giocatore: g.id, da: casella, a });
      g.posizione = a;
      arriva(ctx, g);
      return;
    }
    case 'cambio_data':
      // Si guadagna un giorno: ci si muove ancora (dadi o volo), come dopo un doppio.
      ctx.eventi.push({ tipo: 'cambio_data', giocatore: g.id });
      if (!ctx.turnoFinito) s.turno.rilancio = true;
      return;
    case 'partenza':
    case 'prigione':
      return;
  }
}

function mandaInPrigione(ctx: Contesto, g: Giocatore, motivo: 'casella' | 'carta' | 'tre_doppi'): void {
  incarcera(ctx, g, motivo);
  ctx.turnoFinito = true;
}

/**
 * Mette in cella senza toccare il turno: serve anche per gli avversari (carta del buco nero).
 * Spegne la vacanza, così nessuno salta un turno e poi si ritrova anche in prigione.
 */
function incarcera(ctx: Contesto, g: Giocatore, motivo: 'casella' | 'carta' | 'tre_doppi'): void {
  g.posizione = ctx.tab.prigione;
  g.prigione = 0;
  g.vacanza = false;
  ctx.s.statistiche.prigione[g.id] = (ctx.s.statistiche.prigione[g.id] ?? 0) + 1;
  ctx.eventi.push({ tipo: 'prigione', giocatore: g.id, motivo });
}

/** Sposta la pedina con un salto (carte folli): niente passi, niente Partenza, niente effetto della casella. */
function teletrasporta(ctx: Contesto, g: Giocatore, a: number): void {
  const da = g.posizione;
  g.posizione = a;
  ctx.eventi.push({ tipo: 'teletrasporto', giocatore: g.id, da, a });
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
    // Il trasferimento si segna prima del pagamento: se il contante non basta, il debito arriva subito dopo.
    case 'soldi':
      if (effetto.importo >= 0) {
        segnaTrasferimento(ctx, null, g.id, effetto.importo);
        accredita(ctx, g, effetto.importo);
      } else {
        segnaTrasferimento(ctx, g.id, null, -effetto.importo);
        pagaBanca(ctx, g, -effetto.importo, true);
      }
      return;
    // Tra compagni di squadra non si paga: la carta riguarda solo gli avversari.
    case 'da_ognuno':
      for (const altro of attivi(s)) {
        if (altro.id === g.id || compagni(s, g.id, altro.id)) continue;
        segnaTrasferimento(ctx, altro.id, g.id, effetto.importo);
        paga(ctx, altro, g.id, effetto.importo);
      }
      return;
    case 'a_ognuno':
      for (const altro of attivi(s)) {
        if (altro.id === g.id || compagni(s, g.id, altro.id)) continue;
        segnaTrasferimento(ctx, g.id, altro.id, effetto.importo);
        paga(ctx, g, altro.id, effetto.importo);
      }
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
      const importo = e.case * effetto.casa + e.alberghi * effetto.albergo;
      segnaTrasferimento(ctx, g.id, null, importo);
      pagaBanca(ctx, g, importo, true);
      return;
    }
    case 'casuale': {
      const a = (g.posizione + 1 + ctx.caso.intero(n - 1)) % n;
      teletrasporta(ctx, g, a);
      arriva(ctx, g);
      return;
    }
    case 'scambia_posto': {
      const avversari = attivi(s).filter(
        (x) => x.id !== g.id && !compagni(s, g.id, x.id) && x.prigione === null && x.posizione !== g.posizione,
      );
      if (avversari.length === 0) return;
      const altro = avversari[ctx.caso.intero(avversari.length)]!;
      const mia = g.posizione;
      teletrasporta(ctx, g, altro.posizione);
      teletrasporta(ctx, altro, mia);
      arriva(ctx, g);
      return;
    }
    case 'robin_hood': {
      // A pari contante vince il primo nell'ordine dei turni. Il ricco dà al massimo quello che ha.
      let ricco: Giocatore | undefined;
      let povero: Giocatore | undefined;
      for (const x of attivi(s)) {
        if (!ricco || x.saldo > ricco.saldo) ricco = x;
        if (!povero || x.saldo < povero.saldo) povero = x;
      }
      if (!ricco || !povero || ricco.id === povero.id || compagni(s, ricco.id, povero.id)) return;
      const importo = Math.min(effetto.importo, ricco.saldo);
      if (importo <= 0) return;
      ctx.eventi.push({ tipo: 'robin_hood', da: ricco.id, a: povero.id, importo });
      paga(ctx, ricco, povero.id, importo);
      return;
    }
    case 'avversari_in_prigione':
      for (const altro of attivi(s)) {
        if (altro.id === g.id || compagni(s, g.id, altro.id) || altro.prigione !== null) continue;
        incarcera(ctx, altro, 'carta');
      }
      return;
    case 'moneta': {
      const testa = ctx.caso.intero(2) === 0;
      ctx.eventi.push({ tipo: 'moneta', giocatore: g.id, testa, importo: effetto.importo });
      if (testa) accredita(ctx, g, effetto.importo);
      else pagaBanca(ctx, g, effetto.importo, true);
      return;
    }
    case 'tutti_soldi':
      for (const x of attivi(s)) {
        if (effetto.importo >= 0) {
          segnaTrasferimento(ctx, null, x.id, effetto.importo);
          accredita(ctx, x, effetto.importo);
        } else {
          segnaTrasferimento(ctx, x.id, null, -effetto.importo);
          pagaBanca(ctx, x, -effetto.importo, true);
        }
      }
      return;
    case 'rilancia':
      if (!ctx.turnoFinito) s.turno.rilancio = true;
      return;
    case 'meta_contante': {
      const importo = Math.min(effetto.massimo, Math.floor(Math.max(0, g.saldo) / 2));
      segnaTrasferimento(ctx, g.id, null, importo);
      pagaBanca(ctx, g, importo, true);
      return;
    }
    case 'inverti':
      if (!s.cosmo) return;
      s.cosmo.verso = -1;
      ctx.eventi.push({ tipo: 'gravita_invertita', giocatore: g.id });
      return;
    case 'volo_omaggio':
      // Ci si muove ancora; se si vola, il biglietto è gratis (vale fino alla fine del turno).
      if (ctx.turnoFinito || g.id !== s.turno.giocatore) return;
      s.turno.rilancio = true;
      s.turno.voloOmaggio = true;
      return;
  }
}

/* ------------------------ Compravendite ---------------------------- */

function compra(ctx: Contesto, g: Giocatore): void {
  const casella = ctx.s.turno.acquisto!;
  const prezzo = prezzoAcquisto(ctx.s, casella);
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
 * Le azioni che il giocatore può fare adesso. Per l'asta propone i rilanci dei pulsanti; la sfida e la morra
 * sono senza segno (a caso). Non ci sono gli scambi e i voli, perché il contenuto e la meta li sceglie il giocatore.
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
    { tipo: 'paga_affitto', giocatore: id },
    { tipo: 'sfida', giocatore: id },
    { tipo: 'morra', giocatore: id },
    ...RILANCI.map((r): Azione => ({ tipo: 'offri', giocatore: id, importo: offerta + r })),
    ...possedute(stato, id).flatMap((casella): Azione[] =>
      (['costruisci', 'demolisci', 'ipoteca', 'riscatta', 'vendi'] as const).map((tipo) => ({ tipo, giocatore: id, casella })),
    ),
    { tipo: 'bancarotta', giocatore: id },
  ];
  return candidate.filter((a) => verifica(stato, a) === null);
}
