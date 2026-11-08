/*
 * Inizio e passaggio dei turni, uscita dalla partita (bancarotta, tempo, assenza, voto, espulsione).
 * Li usano le regole del turno, il gioco automatico e la moderazione.
 */

import { accredita, type Contesto } from './contesto';
import { attivi, giocatore, possedute, valoreLiquidazione } from './conti';
import { segnaPatrimonio } from './statistiche';
import { chiudiOrologio, tempoIniziale } from './tempo';
import type { Debito, Evento, Giocatore, MotivoUscita, Stato } from './tipi';

/** Tiri falliti dopo i quali si esce di prigione gratis, al turno successivo. */
export const TENTATIVI_PRIGIONE = 3;

/** Inizia il turno di `g`. Chi ha già fallito 3 tiri in prigione esce gratis e tira normalmente. */
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
  if (g.prigione === null) return;
  if (g.prigione >= TENTATIVI_PRIGIONE) {
    g.prigione = null;
    eventi.push({ tipo: 'uscita_prigione', giocatore: g.id, modo: 'tentativi' });
  } else {
    s.turno.fase = 'prigione';
  }
}

/** Passa al prossimo giocatore in gioco. Chi è in vacanza salta il turno (una volta). */
export function passaTurno(ctx: Contesto): void {
  const { s } = ctx;
  const uscente = giocatore(s, s.turno.giocatore);
  if (uscente && !uscente.eliminato) chiudiOrologio(s, uscente, s.turno, ctx.adesso);
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

/**
 * Il giocatore esce dalla partita. La banca liquida i suoi beni e paga i creditori fino al debito.
 * Le proprietà tornano libere, senza edifici né ipoteca; le Carte Grazia tornano nei mazzi.
 * I suoi scambi aperti spariscono e, se all'asta era il migliore offerente, torna buona l'offerta precedente.
 * Se resta un solo giocatore, la partita finisce; se toccava a lui, il turno passa.
 * @param automatica bancarotta decisa dal gioco perché il tempo è scaduto in debito.
 */
export function elimina(ctx: Contesto, g: Giocatore, motivo: MotivoUscita, automatica = false): void {
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
  g.offlineDa = null;
  g.eliminato = { turno: s.turno.numero, motivo };
  s.statistiche.uscite.push(g.id);
  for (const altro of s.giocatori) altro.debiti = altro.debiti.filter((d) => d.creditore !== g.id);
  s.scambi = s.scambi.filter((x) => x.da !== g.id && x.a !== g.id);
  if (s.asta) {
    s.asta.offerte = s.asta.offerte.filter((o) => o.giocatore !== g.id);
    s.asta.migliore = s.asta.offerte[0] ?? null;
  }
  s.turno.votazione.voti = s.turno.votazione.voti.filter((id) => id !== g.id);
  if (s.turno.votazione.voti.length === 0) s.turno.votazione.scadenza = null;

  ctx.eventi.push(
    motivo === 'bancarotta'
      ? { tipo: 'bancarotta', giocatore: g.id, recuperi, ...(automatica ? { automatica: true as const } : {}) }
      : { tipo: 'rimozione', giocatore: g.id, motivo, recuperi },
  );
  for (const r of recuperi) accredita(ctx, giocatore(s, r.creditore)!, r.importo);

  const rimasti = attivi(s);
  if (rimasti.length <= 1) {
    s.fase = 'finita';
    s.vincitore = rimasti[0]?.id ?? null;
    s.asta = null;
    s.scambi = [];
    s.statistiche.fine = ctx.adesso;
    segnaPatrimonio(s);
    ctx.eventi.push({ tipo: 'fine', vincitore: s.vincitore });
    return;
  }
  if (s.turno.giocatore === g.id) passaTurno(ctx);
}
