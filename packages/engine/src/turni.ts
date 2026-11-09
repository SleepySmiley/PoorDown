/*
 * Inizio e passaggio dei turni, uscita dalla partita (bancarotta, tempo, assenza, voto, espulsione).
 * Li usano le regole del turno, il gioco automatico e la moderazione.
 */

import { accredita, rossoVersoBanca, type Contesto } from './contesto';
import {
  attivi,
  caselleDellaRegione,
  costoEdifici,
  giocatore,
  patrimonio,
  possedute,
  possiedeRegione,
  proprietabile,
  valoreLiquidazione,
} from './conti';
import { TURNI_A_TESTA, TURNI_DI_AVVISO_A_TESTA } from './impostazioni';
import { segnaPatrimonio } from './statistiche';
import { chiudiOrologio, tempoIniziale, votiNecessari } from './tempo';
import type { Debito, Evento, Giocatore, MotivoUscita, Stato } from './tipi';

/** Tiri falliti dopo i quali si esce di prigione gratis, al turno successivo. */
export const TENTATIVI_PRIGIONE = 3;

/** Con la durata massima: il numero dell'ultimo turno della partita (cento a testa); `null` senza limite. */
export function ultimoTurno(s: Stato): number | null {
  return s.impostazioni.durataMassima ? TURNI_A_TESTA * s.giocatori.length : null;
}

/** La partita è finita per la durata massima: all'ultimo turno, con più giocatori (o squadre) ancora in gioco. */
export function finitaPerDurata(s: Stato): boolean {
  const ultimo = ultimoTurno(s);
  if (s.fase !== 'finita' || ultimo === null || s.turno.numero < ultimo) return false;
  const rimasti = attivi(s);
  return s.impostazioni.squadre ? new Set(rimasti.map((g) => g.squadra)).size > 1 : rimasti.length > 1;
}

/**
 * Inizia il turno di `g`. Chi ha già fallito 3 tiri in prigione esce gratis e tira normalmente.
 * Con la durata massima, quando mancano dieci turni a testa il registro avvisa.
 */
export function iniziaTurno(s: Stato, eventi: Evento[], g: Giocatore, adesso: number): void {
  s.turno = {
    giocatore: g.id,
    numero: s.turno.numero + 1,
    fase: 'lancio',
    dadi: null,
    doppi: 0,
    rilancio: false,
    acquisto: null,
    tempo: tempoIniziale(s, g, adesso),
    votazione: { voti: [], scadenza: null },
  };
  eventi.push({ tipo: 'turno', giocatore: g.id, numero: s.turno.numero });
  const ultimo = ultimoTurno(s);
  const avviso = TURNI_DI_AVVISO_A_TESTA * s.giocatori.length;
  if (ultimo !== null && s.turno.numero === ultimo - avviso + 1) eventi.push({ tipo: 'ultimi_turni', turni: avviso });
  if (g.prigione === null) return;
  if (g.prigione >= TENTATIVI_PRIGIONE) {
    g.prigione = null;
    eventi.push({ tipo: 'uscita_prigione', giocatore: g.id, modo: 'tentativi' });
  } else {
    s.turno.fase = 'prigione';
  }
}

/**
 * Passa al prossimo giocatore in gioco. Chi è in vacanza salta il turno (una volta).
 * Con la durata massima, dopo l'ultimo turno la partita finisce.
 */
export function passaTurno(ctx: Contesto): void {
  const { s } = ctx;
  const uscente = giocatore(s, s.turno.giocatore);
  if (uscente && !uscente.eliminato) chiudiOrologio(s, uscente, s.turno, ctx.adesso);
  const ultimo = ultimoTurno(s);
  if (ultimo !== null && s.turno.numero >= ultimo) {
    chiudiPerDurata(ctx);
    return;
  }
  segnaPatrimonio(s);
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
    iniziaTurno(s, ctx.eventi, g, ctx.adesso);
    return;
  }
}

/** Chiude il turno. Con il saldo negativo il giocatore resta in gioco finché non rientra o fallisce. */
export function chiudiTurno(ctx: Contesto): void {
  const t = ctx.s.turno;
  t.rilancio = false;
  t.fase = 'dopo_lancio';
  if (giocatore(ctx.s, t.giocatore)!.saldo < 0) return;
  passaTurno(ctx);
}

/** Il compagno che eredita i beni di `g`: il primo della sua squadra ancora in gioco, dopo di lui nell'ordine dei turni. */
function eredeDi(s: Stato, g: Giocatore): Giocatore | undefined {
  if (g.squadra === null) return undefined;
  const i = s.giocatori.indexOf(g);
  const ordine = [...s.giocatori.slice(i + 1), ...s.giocatori.slice(0, i)];
  return ordine.find((x) => !x.eliminato && x.squadra === g.squadra);
}

/**
 * A squadre, le città di chi esce tornate alla banca possono lasciare incompleta una regione in cui i compagni
 * hanno case: quegli edifici tornano alla banca a metà del loro costo, come se li vendessero.
 */
function vendiEdificiRimasti(ctx: Contesto, liberate: readonly number[]): void {
  const { s, tab } = ctx;
  const regioni = new Set(liberate.flatMap((i) => (tab.caselle[i]?.tipo === 'citta' ? [(tab.caselle[i] as { regione: number }).regione] : [])));
  for (const regione of regioni) {
    const perProprietario = new Map<string, number[]>();
    for (const i of caselleDellaRegione(tab, regione)) {
      const p = s.proprieta[i]!;
      if (p.proprietario && p.livello > 0 && !possiedeRegione(s, p.proprietario, regione)) {
        perProprietario.set(p.proprietario, [...(perProprietario.get(p.proprietario) ?? []), i]);
      }
    }
    for (const [id, caselle] of perProprietario) {
      let importo = 0;
      for (const i of caselle) {
        const c = proprietabile(tab, i);
        if (c?.tipo === 'citta') importo += Math.floor(costoEdifici(tab, c, s.proprieta[i]!.livello) / 2);
        s.proprieta[i]!.livello = 0;
      }
      const g = giocatore(s, id)!;
      ctx.eventi.push({ tipo: 'edifici_venduti', giocatore: id, caselle, importo });
      accredita(ctx, g, importo);
    }
  }
}

/**
 * I crediti verso chi esce: con un erede passano a lui (sommati a quanto il debitore gli deve già), altrimenti
 * spariscono dall'elenco dei debiti e il debitore resta in rosso verso la banca.
 */
function passaCrediti(s: Stato, g: Giocatore, erede: Giocatore | undefined): void {
  for (const altro of s.giocatori) {
    const debito = altro.debiti.find((d) => d.creditore === g.id);
    if (!debito) continue;
    const nuovo = altro === erede ? undefined : erede;
    const giaDovuto = nuovo && altro.debiti.find((d) => d.creditore === nuovo.id);
    if (nuovo && !giaDovuto) {
      // Resta al suo posto nella fila dei rimborsi.
      debito.creditore = nuovo.id;
      continue;
    }
    if (giaDovuto) giaDovuto.importo += debito.importo;
    altro.debiti = altro.debiti.filter((d) => d !== debito);
  }
}

/**
 * Il giocatore esce dalla partita. La banca liquida i suoi beni e paga i creditori fino al debito.
 * Le proprietà tornano libere, senza edifici né ipoteca; le Carte Grazia tornano nei mazzi.
 * A squadre, se resta un compagno in gioco:
 * - chi esce senza rosso lascia al compagno il contante, le proprietà (così come sono) e le Carte Grazia;
 * - chi esce in rosso passa dalla liquidazione: si pagano prima i creditori, poi il rosso verso la banca,
 *   e quello che avanza va in contanti al compagno; se così una regione dei compagni resta incompleta,
 *   i loro edifici lì tornano alla banca a metà prezzo;
 * - in tutti e due i casi, quello che gli altri gli devono lo dovranno al compagno.
 * I suoi scambi aperti spariscono e, se all'asta era il migliore offerente, torna buona l'offerta precedente.
 * Se resta un solo giocatore (a squadre: una sola squadra), la partita finisce; se toccava a lui, il turno passa.
 * Se invece giocava un altro e i voti contro di lui bastano ormai a toglierlo, esce anche lui.
 * @param automatica bancarotta decisa dal gioco perché il tempo è scaduto in debito.
 */
export function elimina(ctx: Contesto, g: Giocatore, motivo: MotivoUscita, automatica = false): void {
  const { s } = ctx;
  const erede = eredeDi(s, g);
  const rossoBanca = rossoVersoBanca(g);
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
  // Senza rosso (quindi senza debiti) il compagno prende tutto così com'è; altrimenti solo il contante avanzato
  // dopo aver pagato i creditori e la banca.
  const passaTutto = erede !== undefined && g.saldo >= 0;
  const caselle = possedute(s, g.id);
  const eredita: Extract<Evento, { tipo: 'eredita' }> | null = erede
    ? {
        tipo: 'eredita',
        da: g.id,
        a: erede.id,
        soldi: passaTutto ? g.saldo : Math.max(0, disponibile - rossoBanca),
        caselle: passaTutto ? caselle : [],
        grazie: passaTutto ? g.carteGrazia.length : 0,
      }
    : null;

  for (const i of caselle) {
    s.proprieta[i] = passaTutto ? { ...s.proprieta[i]!, proprietario: erede.id } : { proprietario: null, livello: 0, ipotecata: false };
  }
  if (passaTutto) erede.carteGrazia.push(...g.carteGrazia);
  g.saldo = 0;
  g.debiti = [];
  g.carteGrazia = [];
  g.prigione = null;
  g.vacanza = false;
  g.offlineDa = null;
  g.eliminato = { turno: s.turno.numero, motivo };
  s.statistiche.uscite.push(g.id);
  passaCrediti(s, g, erede);
  s.scambi = s.scambi.filter((x) => x.da !== g.id && x.a !== g.id);
  if (s.asta) {
    s.asta.offerte = s.asta.offerte.filter((o) => o.giocatore !== g.id);
    s.asta.migliore = s.asta.offerte[0] ?? null;
  }
  s.turno.votazione.voti = s.turno.votazione.voti.filter((id) => id !== g.id);
  if (s.turno.votazione.voti.length === 0) s.turno.votazione.scadenza = null;

  const alCompagno = passaTutto ? { erede: erede.id } : {};
  ctx.eventi.push(
    motivo === 'bancarotta'
      ? { tipo: 'bancarotta', giocatore: g.id, recuperi, ...alCompagno, ...(automatica ? { automatica: true as const } : {}) }
      : { tipo: 'rimozione', giocatore: g.id, motivo, recuperi, ...alCompagno },
  );
  for (const r of recuperi) accredita(ctx, giocatore(s, r.creditore)!, r.importo);
  if (eredita && erede) {
    ctx.eventi.push(eredita);
    accredita(ctx, erede, eredita.soldi);
  }
  if (!passaTutto) vendiEdificiRimasti(ctx, caselle);

  const rimasti = attivi(s);
  const squadre = new Set(rimasti.map((x) => x.squadra));
  if (rimasti.length <= 1 || (s.impostazioni.squadre && squadre.size <= 1)) {
    chiudiPartita(ctx, rimasti[0]);
    return;
  }
  if (s.turno.giocatore === g.id) {
    passaTurno(ctx);
    return;
  }
  // Con un giocatore in meno ne servono meno: i voti già dati possono bastare.
  const voti = s.turno.votazione.voti.length;
  if (voti > 0 && voti >= votiNecessari(s)) elimina(ctx, giocatore(s, s.turno.giocatore)!, 'voto');
}

/** La partita finisce: vince `vincitore` (a squadre, con tutta la sua squadra). `durata`: per la durata massima. */
function chiudiPartita(ctx: Contesto, vincitore: Giocatore | undefined, durata = false): void {
  const { s } = ctx;
  s.fase = 'finita';
  s.vincitore = vincitore?.id ?? null;
  s.squadraVincitrice = s.impostazioni.squadre ? (vincitore?.squadra ?? null) : null;
  s.asta = null;
  s.scambi = [];
  s.statistiche.fine = ctx.adesso;
  segnaPatrimonio(s);
  ctx.eventi.push({
    tipo: 'fine',
    vincitore: s.vincitore,
    ...(s.squadraVincitrice === null ? {} : { squadra: s.squadraVincitrice }),
    ...(durata ? { durata: true as const } : {}),
  });
}

/**
 * La durata massima è arrivata: vince il patrimonio più alto tra chi è ancora in gioco. A squadre vince la squadra
 * con il patrimonio più alto (sommando i suoi giocatori ancora in gioco). A pari merito, chi viene prima nei turni.
 */
function chiudiPerDurata(ctx: Contesto): void {
  const { s } = ctx;
  const rimasti = attivi(s);
  const valore = new Map(rimasti.map((g) => [g.id, patrimonio(s, g.id)]));
  let candidati = rimasti;
  if (s.impostazioni.squadre) {
    const somme = new Map<number | null, number>();
    for (const g of rimasti) somme.set(g.squadra, (somme.get(g.squadra) ?? 0) + valore.get(g.id)!);
    const migliore = Math.max(...somme.values());
    const squadra = rimasti.find((g) => somme.get(g.squadra) === migliore)?.squadra;
    candidati = rimasti.filter((g) => g.squadra === squadra);
  }
  const vincitore = candidati.reduce<Giocatore | undefined>(
    (meglio, g) => (meglio === undefined || valore.get(g.id)! > valore.get(meglio.id)! ? g : meglio),
    undefined,
  );
  chiudiPartita(ctx, vincitore, true);
}
