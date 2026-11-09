/* Aiuti per i test del motore. Non fanno parte del gioco. */

import { casoDaSeme } from './caso';
import { caselleDellaRegione, giocatore, patrimonio, possiedeRegione, proprietabile, regioneIpotecata } from './conti';
import { IMPOSTAZIONI_PREDEFINITE } from './impostazioni';
import { creaPartita } from './partita';
import { applica } from './regole';
import { tabellone } from './tabelloni';
import { BANCA_MAX_MS } from './tempo';
import { finitaPerDurata } from './turni';
import type { Azione, Caso, Evento, IdGiocatore, Impostazioni, NomeMazzo, Stato } from './tipi';

export const NOMI = ['Anna', 'Bruno', 'Carla', 'Dario', 'Elena', 'Fabio', 'Gina', 'Ugo'];
/** Id dei giocatori di prova: 'a', 'b', 'c'… */
export const ID = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

/**
 * I test delle regole partono tutti con gli stessi soldi: il bonus per chi gioca dopo il primo
 * ha i suoi test in partita.test.ts.
 */
function stessiSoldi(s: Stato): Stato {
  for (const x of s.giocatori) x.saldo = s.impostazioni.soldiIniziali;
  // Il primo punto del grafico (turno 0) segue: all'inizio il patrimonio sono i soldi.
  s.statistiche.patrimonio = s.statistiche.patrimonio.map((p) => ({ ...p, valori: p.valori.map(() => s.impostazioni.soldiIniziali) }));
  return s;
}

/** Partita con `n` giocatori in ordine fisso (a, b, c…): tocca ad 'a'. Tutti con gli stessi soldi iniziali. */
export function partitaDiProva(n = 2, impostazioni: Partial<Impostazioni> = {}): Stato {
  const esito = creaPartita(
    ID.slice(0, n).map((id, i) => ({ id, nome: NOMI[i]!, colore: i + 1 })),
    { ...IMPOSTAZIONI_PREDEFINITE, ordineCasuale: false, ...impostazioni },
    casoDaSeme(1),
  );
  if (!esito.ok) throw new Error(esito.messaggio);
  return stessiSoldi(esito.stato);
}

/**
 * Partita a squadre in ordine fisso, senza alternare: i giocatori sono `squadre[i]` (es. [0, 0, 1, 1]: a e b insieme,
 * c e d insieme). L'ordine dei turni alterna le squadre: con [0, 0, 1, 1] è a, c, b, d.
 */
export function partitaASquadre(squadre: number[], impostazioni: Partial<Impostazioni> = {}): Stato {
  const esito = creaPartita(
    squadre.map((squadra, i) => ({ id: ID[i]!, nome: NOMI[i]!, colore: i + 1, squadra })),
    { ...IMPOSTAZIONI_PREDEFINITE, ordineCasuale: false, squadre: true, ...impostazioni },
    casoDaSeme(1),
  );
  if (!esito.ok) throw new Error(esito.messaggio);
  return stessiSoldi(esito.stato);
}

/** Caso che restituisce i tiri indicati, in ordine. Finiti i tiri, il test fallisce. */
export function dadi(...tiri: [number, number][]): Caso {
  const valori = tiri.flat();
  return {
    intero(n) {
      const v = valori.shift();
      if (v === undefined) throw new Error('Il test ha tirato più dadi di quelli previsti.');
      if (n !== 6) throw new Error(`Atteso un tiro di dado, chiesto un intero su ${n}.`);
      return v - 1;
    },
  };
}

/** Esegue l'azione e fallisce se il motore la rifiuta. `adesso` serve alle aste. */
export function esegui(stato: Stato, azione: Azione, caso: Caso = dadi(), adesso = 0): { stato: Stato; eventi: Evento[] } {
  const esito = applica(stato, azione, caso, adesso);
  if (!esito.ok) throw new Error(`Azione ${azione.tipo} rifiutata: ${esito.messaggio}`);
  return esito;
}

export function g(stato: Stato, id: IdGiocatore) {
  const trovato = giocatore(stato, id);
  if (!trovato) throw new Error(`Giocatore ${id} inesistente.`);
  return trovato;
}

/** Assegna le caselle al giocatore (modifica lo stato di prova). */
export function assegna(stato: Stato, id: IdGiocatore, ...caselle: number[]): Stato {
  for (const i of caselle) stato.proprieta[i]!.proprietario = id;
  return stato;
}

/** La prossima carta pescata da quel mazzo sarà `carta`. */
export function primaCarta(stato: Stato, mazzo: NomeMazzo, carta: number): Stato {
  const m = stato.mazzi[mazzo];
  m.ordine = [carta, ...m.ordine.filter((c) => c !== carta)];
  m.prossima = 0;
  return stato;
}

/** Controlla che lo stato sia coerente. Restituisce l'elenco dei problemi (vuoto se va tutto bene). */
export function problemi(s: Stato): string[] {
  const tab = tabellone(s.mappa);
  const out: string[] = [];
  const n = tab.caselle.length;

  if (s.fase === 'in_corso') {
    const c = giocatore(s, s.turno.giocatore);
    if (!c || c.eliminato) out.push('Il turno è di un giocatore che non è in gioco.');
    if (s.turno.fase === 'prigione' && c?.prigione === null) out.push('Fase prigione ma il giocatore è libero.');
  } else {
    const rimasti = s.giocatori.filter((x) => !x.eliminato);
    const aTempo = finitaPerDurata(s);
    if (aTempo) {
      // Finita per la durata massima: vince il patrimonio più alto (a squadre, la squadra più ricca).
      const valore = (chi: readonly Stato['giocatori'][number][]) => chi.reduce((t, x) => t + patrimonio(s, x.id), 0);
      const vincitore = rimasti.find((x) => x.id === s.vincitore);
      if (!vincitore) out.push('Durata massima: il vincitore non è in gioco.');
      else if (s.impostazioni.squadre) {
        const delGruppo = (q: number | null) => valore(rimasti.filter((x) => x.squadra === q));
        if (s.squadraVincitrice !== vincitore.squadra) out.push('Durata massima: squadra vincitrice sbagliata.');
        if (rimasti.some((x) => delGruppo(x.squadra) > delGruppo(vincitore.squadra))) out.push('Durata massima: vince una squadra meno ricca.');
      } else if (rimasti.some((x) => patrimonio(s, x.id) > patrimonio(s, vincitore.id))) {
        out.push('Durata massima: vince un giocatore meno ricco.');
      }
    } else if (s.impostazioni.squadre) {
      if (new Set(rimasti.map((x) => x.squadra)).size > 1) out.push('Partita finita con più di una squadra in gioco.');
      if (s.squadraVincitrice !== (rimasti[0]?.squadra ?? null)) out.push('Squadra vincitrice sbagliata.');
    } else {
      if (rimasti.length > 1) out.push('Partita finita con più di un giocatore in gioco.');
      if (s.squadraVincitrice !== null) out.push('Squadra vincitrice senza squadre.');
    }
    if (!aTempo && s.vincitore !== (rimasti[0]?.id ?? null)) out.push('Vincitore sbagliato.');
  }
  if (s.impostazioni.squadre !== (s.squadre.length > 0)) out.push('Nomi delle squadre che non tornano con l’impostazione.');

  for (const x of s.giocatori) {
    if (x.posizione < 0 || x.posizione >= n) out.push(`${x.id}: posizione fuori dal tabellone.`);
    if (x.prigione !== null && (x.prigione < 0 || x.prigione > 3)) out.push(`${x.id}: tentativi di prigione errati.`);
    if (x.prigione !== null && x.posizione !== tab.prigione) out.push(`${x.id}: in prigione ma fuori dalla cella.`);
    const totaleDebiti = x.debiti.reduce((t, d) => t + d.importo, 0);
    if (totaleDebiti > Math.max(0, -x.saldo)) out.push(`${x.id}: debiti (${totaleDebiti}) oltre il rosso (${x.saldo}).`);
    for (const d of x.debiti) {
      if (d.importo <= 0) out.push(`${x.id}: debito non positivo.`);
      const cred = giocatore(s, d.creditore);
      if (!cred || cred.eliminato) out.push(`${x.id}: debito verso chi non è in gioco.`);
      if (d.creditore === x.id) out.push(`${x.id}: debito verso sé stesso.`);
    }
    if (x.eliminato) {
      if (x.saldo !== 0 || x.debiti.length || x.carteGrazia.length) out.push(`${x.id}: eliminato con beni o debiti.`);
      if (x.offlineDa !== null) out.push(`${x.id}: eliminato ma ancora segnato come assente.`);
    }
    if (x.banca < 0 || x.banca > BANCA_MAX_MS) out.push(`${x.id}: banca di tempo fuori dai limiti (${x.banca}).`);
    if (x.automatici < 0) out.push(`${x.id}: turni automatici negativi.`);
    if (s.impostazioni.squadre ? x.squadra === null || !s.squadre[x.squadra] : x.squadra !== null) {
      out.push(`${x.id}: squadra sbagliata (${x.squadra}).`);
    }
  }

  const t = s.turno;
  if (s.fase === 'in_corso') {
    if ((t.tempo.fermoDa !== null) !== (s.asta !== null)) out.push('Orologio del turno fermo senza asta, o che scorre durante l’asta.');
    if (t.tempo.assenteDa != null && giocatore(s, t.giocatore)?.offlineDa === null) out.push('Grazia da scollegato per chi è collegato.');
    if (t.tempo.regalato !== t.tempo.regali.length * 60_000) out.push('Tempo regalato che non torna con i regali.');
    if (t.votazione.voti.includes(t.giocatore)) out.push('Voto di chi gioca contro sé stesso.');
    if (t.votazione.voti.some((id) => giocatore(s, id)?.eliminato !== null)) out.push('Voto di chi non è in gioco.');
    if (new Set(t.votazione.voti).size !== t.votazione.voti.length) out.push('Voto doppio.');
    if (t.votazione.scadenza !== null && (t.votazione.voti.length === 0 || s.impostazioni.timerTurno)) {
      out.push('Voto a tempo senza voti o con il timer attivo.');
    }
  }

  s.proprieta.forEach((p, i) => {
    const c = proprietabile(tab, i);
    if (!c !== !p) out.push(`Casella ${i}: proprietà dove non serve o mancante.`);
    if (!p || !c) return;
    if (p.proprietario === null) {
      if (p.livello !== 0 || p.ipotecata) out.push(`Casella ${i}: libera ma con edifici o ipoteca.`);
      return;
    }
    const owner = giocatore(s, p.proprietario);
    if (!owner || owner.eliminato) out.push(`Casella ${i}: proprietario non in gioco.`);
    if (p.livello < 0 || p.livello > 5) out.push(`Casella ${i}: livello ${p.livello}.`);
    if (p.livello > 0) {
      if (c.tipo !== 'citta') out.push(`Casella ${i}: edifici su una casella che non è una città.`);
      else if (!possiedeRegione(s, p.proprietario, c.regione)) out.push(`Casella ${i}: edifici senza la regione intera.`);
    }
  });

  for (const nome of ['busta', 'cartolina'] as const) {
    const m = s.mazzi[nome];
    const atteso = [...tab.mazzi[nome].keys()];
    if ([...m.ordine].sort((x, y) => x - y).join() !== atteso.join()) out.push(`Mazzo ${nome}: non è una permutazione.`);
    if (m.prossima < 0 || m.prossima >= m.ordine.length) out.push(`Mazzo ${nome}: indice fuori dal mazzo.`);
    const detentori = s.giocatori.reduce((t, x) => t + x.carteGrazia.filter((c) => c === nome).length, 0);
    if (detentori > 1) out.push(`Mazzo ${nome}: Carta Grazia in più mani.`);
  }

  tab.regioni.forEach((_, r) => {
    const caselle = caselleDellaRegione(tab, r);
    const livelli = caselle.map((i) => s.proprieta[i]!.livello);
    // Uniforme tra le città di ciascun proprietario: a squadre ognuno vende le sue case senza guardare i compagni.
    // Chi ha ereditato le città di un compagno uscito può averle a livelli diversi dalle sue.
    for (const id of new Set(caselle.map((i) => s.proprieta[i]!.proprietario))) {
      if (!s.impostazioni.costruzioneUniforme || id === null) continue;
      const squadra = giocatore(s, id)?.squadra ?? null;
      if (squadra !== null && s.giocatori.some((x) => x.squadra === squadra && x.eliminato)) continue;
      const suoi = caselle.filter((i) => s.proprieta[i]!.proprietario === id).map((i) => s.proprieta[i]!.livello);
      if (Math.max(...suoi) - Math.min(...suoi) > 1) out.push(`Regione ${r}: costruzione non uniforme per ${id} (${suoi.join(', ')}).`);
    }
    if (regioneIpotecata(s, r) && livelli.some((l) => l > 0)) out.push(`Regione ${r}: edifici con una città ipotecata.`);
  });

  const attivo = (id: string) => giocatore(s, id)?.eliminato === null;
  if (s.asta) {
    const p = s.proprieta[s.asta.casella];
    if (!p || p.proprietario !== null) out.push('Asta su una casella non libera.');
    if (JSON.stringify(s.asta.migliore) !== JSON.stringify(s.asta.offerte[0] ?? null)) {
      out.push('Asta: la migliore offerta non è l’ultima.');
    }
    if (s.asta.offerte.some((o) => !attivo(o.giocatore))) out.push('Asta: offerta di chi non è in gioco.');
  }
  for (const sc of s.scambi) {
    if (!attivo(sc.da) || !attivo(sc.a) || sc.da === sc.a) out.push(`Scambio ${sc.id}: parti non valide.`);
    if (sc.id >= s.prossimoScambio) out.push(`Scambio ${sc.id}: numero non ancora assegnato.`);
  }
  if (new Set(s.scambi.map((x) => x.id)).size !== s.scambi.length) out.push('Scambi con lo stesso numero.');
  if (s.fase === 'finita' && (s.asta || s.scambi.length)) out.push('Partita finita con un’asta o scambi aperti.');

  if (s.cassaVacanza < 0) out.push('Cassa della Vacanza negativa.');
  if (!s.impostazioni.cassaVacanza && s.cassaVacanza !== 0) out.push('Cassa della Vacanza piena con la regola spenta.');

  const st = s.statistiche;
  const fuori = s.giocatori.filter((x) => x.eliminato).map((x) => x.id);
  if ([...st.uscite].sort().join() !== fuori.sort().join()) out.push('Statistiche: le uscite non tornano con gli eliminati.');
  if ((st.fine !== null) !== (s.fase === 'finita')) out.push('Statistiche: ora della fine sbagliata.');
  if (st.visite.length !== n || st.visite.some((v) => v < 0)) out.push('Statistiche: visite alle caselle sbagliate.');
  st.patrimonio.forEach((p, i) => {
    if (p.valori.length !== s.giocatori.length) out.push(`Statistiche: punto ${i} del patrimonio senza tutti i giocatori.`);
    if (i > 0 && p.turno <= st.patrimonio[i - 1]!.turno) out.push(`Statistiche: punto ${i} del patrimonio fuori ordine.`);
    if (p.turno > t.numero) out.push(`Statistiche: punto ${i} del patrimonio nel futuro.`);
  });
  if (s.fase === 'finita' && st.patrimonio.at(-1)?.turno !== t.numero) out.push('Statistiche: manca l’ultimo punto del patrimonio.');
  return out;
}
