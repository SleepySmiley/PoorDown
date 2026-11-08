/*
 * Il motore: `applica(stato, azione, caso)` controlla l'azione, la esegue su una copia dello stato
 * e restituisce il nuovo stato con gli eventi per registro e animazioni. Non modifica mai lo stato ricevuto.
 * Flusso del turno: docs/analisi/03-regole-turno.md §2.
 */

import { tiraDadi } from './caso';
import { accredita, errore, paga, pagaBanca, type Contesto } from './contesto';
import {
  affitto,
  attivi,
  edifici,
  giocatore,
  possedute,
  proprietabile,
  regioneConEdifici,
  valoreLiquidazione,
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
  verificaApertura,
  verificaCostruzione,
  verificaDemolizione,
  verificaIpoteca,
  verificaOfferta,
  verificaRiscatto,
} from './economia';
import { proponi, rispondi, verificaProposta, verificaRisposta } from './scambi';
import { tabellone } from './tabelloni';
import type { Azione, Caso, Debito, Effetto, Errore, Esito, Evento, Giocatore, IdGiocatore, NomeMazzo, Stato } from './tipi';

/** Tiri falliti dopo i quali si esce di prigione gratis, al turno successivo. */
export const TENTATIVI_PRIGIONE = 3;
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

  // Fuori turno: bancarotta, offerte all'asta e scambi.
  switch (azione.tipo) {
    case 'bancarotta':
      return null;
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

    // Controllate prima, in `verifica`.
    case 'bancarotta':
    case 'offri':
    case 'proponi':
    case 'accetta':
    case 'rifiuta':
    case 'annulla':
      return null;
  }
}

/* ------------------------------------------------------------------ */
/* Esecuzione                                                          */
/* ------------------------------------------------------------------ */

/**
 * @param adesso orologio del server in millisecondi: serve solo alle aste (scadenza).
 */
export function applica(stato: Stato, azione: Azione, caso: Caso, adesso = 0): Esito {
  const problema = verifica(stato, azione);
  if (problema) return { ok: false, ...problema };

  const s = JSON.parse(JSON.stringify(stato)) as Stato;
  const ctx: Contesto = { s, tab: tabellone(s.mappa), caso, adesso, eventi: [], turnoFinito: false };
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
      bancarotta(ctx, g);
      break;
  }
  return { ok: true, stato: s, eventi: ctx.eventi };
}

/** Quando scade la prossima cosa a tempo (l'asta), in millisecondi dell'orologio del server; `null` se niente. */
export function prossimaScadenza(stato: Stato): number | null {
  return stato.fase === 'in_corso' ? (stato.asta?.scadenza ?? null) : null;
}

/** Applica quello che è scaduto (chiude l'asta). `null` se a quest'ora non scade niente. */
export function applicaScadenze(stato: Stato, caso: Caso, adesso: number): Esito | null {
  const scadenza = prossimaScadenza(stato);
  if (scadenza === null || adesso < scadenza) return null;
  const s = JSON.parse(JSON.stringify(stato)) as Stato;
  const ctx: Contesto = { s, tab: tabellone(s.mappa), caso, adesso, eventi: [], turnoFinito: false };
  chiudiAsta(ctx);
  return { ok: true, stato: s, eventi: ctx.eventi };
}

/* ---------------------------- Turni -------------------------------- */

function corrente(s: Stato): Giocatore {
  return giocatore(s, s.turno.giocatore)!;
}

/** Inizia il turno di `g`. Chi ha già fallito 3 tiri in prigione esce gratis e tira normalmente. */
export function iniziaTurno(s: Stato, eventi: Evento[], g: Giocatore): void {
  s.turno = {
    giocatore: g.id,
    numero: s.turno.numero + 1,
    fase: 'lancio',
    dadi: null,
    doppi: 0,
    rilancio: false,
    acquisto: null,
  };
  eventi.push({ tipo: 'turno', giocatore: g.id, numero: s.turno.numero });
  if (g.prigione === null) return;
  if (g.prigione >= TENTATIVI_PRIGIONE) {
    g.prigione = null;
    eventi.push({ tipo: 'uscita_prigione', giocatore: g.id, modo: 'tentativi' });
  } else {
    s.turno.fase = 'prigione';
  }
}

/** Passa al prossimo giocatore in gioco. Chi è in vacanza salta il turno (una volta). */
function passaTurno(ctx: Contesto): void {
  const { s } = ctx;
  const n = s.giocatori.length;
  let i = s.giocatori.findIndex((g) => g.id === s.turno.giocatore);
  // Ogni salto spegne una vacanza, quindi entro due giri qualcuno gioca.
  for (let passi = 0; passi < 2 * n + 1; passi++) {
    i = (i + 1) % n;
    const g = s.giocatori[i]!;
    if (g.eliminato) continue;
    if (g.vacanza) {
      g.vacanza = false;
      ctx.eventi.push({ tipo: 'turno_saltato', giocatore: g.id });
      continue;
    }
    iniziaTurno(s, ctx.eventi, g);
    return;
  }
}

/** Chiude il turno. Con il saldo negativo il giocatore resta in gioco finché non rientra o fallisce. */
function chiudiTurno(ctx: Contesto): void {
  const t = ctx.s.turno;
  t.rilancio = false;
  t.fase = 'dopo_lancio';
  if (corrente(ctx.s).saldo < 0) return;
  passaTurno(ctx);
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

/* ---------------------- Bancarotta e fine -------------------------- */

/**
 * La banca liquida i beni del fallito e paga i suoi creditori fino al debito.
 * Le proprietà tornano libere, senza edifici né ipoteca; le Carte Grazia tornano nei mazzi.
 * I suoi scambi aperti spariscono e, se all'asta era il migliore offerente, torna buona l'offerta precedente.
 */
function bancarotta(ctx: Contesto, g: Giocatore): void {
  const { s } = ctx;
  let disponibile = valoreLiquidazione(s, g.id);
  const recuperi: Debito[] = [];
  for (const d of g.debiti) {
    const creditore = giocatore(s, d.creditore);
    if (!creditore || creditore.eliminato) continue;
    const importo = Math.min(d.importo, disponibile);
    if (importo <= 0) break;
    recuperi.push({ creditore: d.creditore, importo });
    disponibile -= importo;
  }

  for (const i of possedute(s, g.id)) s.proprieta[i] = { proprietario: null, livello: 0, ipotecata: false };
  g.saldo = 0;
  g.debiti = [];
  g.carteGrazia = [];
  g.prigione = null;
  g.vacanza = false;
  g.eliminato = { turno: s.turno.numero, motivo: 'bancarotta' };
  for (const altro of s.giocatori) altro.debiti = altro.debiti.filter((d) => d.creditore !== g.id);
  s.scambi = s.scambi.filter((x) => x.da !== g.id && x.a !== g.id);
  if (s.asta) {
    s.asta.offerte = s.asta.offerte.filter((o) => o.giocatore !== g.id);
    s.asta.migliore = s.asta.offerte[0] ?? null;
  }

  ctx.eventi.push({ tipo: 'bancarotta', giocatore: g.id, recuperi });
  for (const r of recuperi) accredita(ctx, giocatore(s, r.creditore)!, r.importo);

  const rimasti = attivi(s);
  if (rimasti.length <= 1) {
    s.fase = 'finita';
    s.vincitore = rimasti[0]?.id ?? null;
    s.asta = null;
    s.scambi = [];
    ctx.eventi.push({ tipo: 'fine', vincitore: s.vincitore });
    return;
  }
  if (s.turno.giocatore === g.id) passaTurno(ctx);
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
