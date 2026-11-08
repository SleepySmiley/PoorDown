/*
 * Partite intere giocate a caso, con seme fisso. Dopo ogni azione lo stato deve restare coerente
 * e il giocatore di turno deve avere sempre qualcosa da fare.
 * I giocatori comprano, costruiscono, ipotecano, fanno aste e scambi; ogni tanto qualcuno si scollega,
 * si distrae fino allo scadere del tempo, chiede o regala tempo, vota o viene espulso.
 * Le regole facoltative, il tabellone e la modalità squadre cambiano da una partita all'altra.
 */

import { describe, expect, it } from 'vitest';
import { casoDaSeme } from './caso';
import { possedute } from './conti';
import { IMPOSTAZIONI_PREDEFINITE, SOLDI_INIZIALI_POSSIBILI } from './impostazioni';
import { creaPartita } from './partita';
import { ID, NOMI, problemi } from './prove';
import { applica, applicaScadenze, azioniPossibili, espelli, prossimaScadenza, verifica } from './regole';
import { TABELLONI } from './tabelloni';
import { connessione, sposta } from './tempo';
import type { Azione, Caso, Esito, Giocatore, IdMappa, Pacchetto, Stato, TipoEvento } from './tipi';

const PARTITE = 80;
const AZIONI_MAX = 20_000;
/** Dopo tante azioni i giocatori si stancano e qualcuno si arrende più spesso. */
const PAZIENZA = 3_000;
/** Tempo che passa tra un'azione e l'altra, in millisecondi. */
const PASSO_MS = 1_000;

function scegli<T>(lista: readonly T[], caso: Caso): T | undefined {
  return lista.length ? lista[caso.intero(lista.length)] : undefined;
}

function probabile(caso: Caso, su10: number): boolean {
  return caso.intero(10) < su10;
}

/** Un giocatore qualunque: compra spesso, costruisce a volte, in rosso vende o ipoteca. */
function decidi(s: Stato, caso: Caso): Azione {
  const id = s.turno.giocatore;
  const possibili = azioniPossibili(s, id);
  const di = (tipo: Azione['tipo']) => possibili.filter((a) => a.tipo === tipo);
  const saldo = s.giocatori.find((g) => g.id === id)!.saldo;

  if (saldo < 0) {
    return scegli([...di('demolisci'), ...di('ipoteca'), ...di('vendi')], caso) ?? di('bancarotta')[0]!;
  }
  if (di('compra').length && probabile(caso, 7)) return di('compra')[0]!;
  if (di('asta').length) return di('asta')[0]!;
  if (di('costruisci').length && probabile(caso, 4)) return scegli(di('costruisci'), caso)!;
  if (di('riscatta').length && probabile(caso, 2)) return scegli(di('riscatta'), caso)!;
  if (di('ipoteca').length && probabile(caso, 1) && caso.intero(5) === 0) return scegli(di('ipoteca'), caso)!;
  const uscite = [...di('paga_cauzione'), ...di('usa_grazia')];
  if (uscite.length && probabile(caso, 3)) return scegli(uscite, caso)!;
  return di('lancia')[0] ?? di('fine_turno')[0] ?? possibili[0]!;
}

/** Una parte casuale dei beni del giocatore. */
function pacchettoCasuale(s: Stato, g: Giocatore, caso: Caso): Pacchetto {
  const caselle = possedute(s, g.id).filter(() => caso.intero(4) === 0);
  return {
    soldi: g.saldo > 0 && probabile(caso, 4) ? caso.intero(Math.floor(g.saldo / 3) + 1) : 0,
    caselle,
    grazie: g.carteGrazia.filter(() => probabile(caso, 3)),
  };
}

/** Uno scambio a caso: proposta nuova, controproposta o risposta. `null` se non viene fuori niente di valido. */
function scambioCasuale(s: Stato, caso: Caso): Azione | null {
  const vivi = s.giocatori.filter((g) => !g.eliminato);
  const aperto = scegli(s.scambi, caso);
  if (aperto && probabile(caso, 7)) {
    const tipo = scegli(['accetta', 'accetta', 'rifiuta', 'annulla'] as const, caso)!;
    const azione: Azione = { tipo, giocatore: tipo === 'annulla' ? aperto.da : aperto.a, scambio: aperto.id };
    return verifica(s, azione) === null ? azione : { tipo: 'rifiuta', giocatore: aperto.a, scambio: aperto.id };
  }
  const da = scegli(vivi, caso)!;
  const a = scegli(
    vivi.filter((g) => g.id !== da.id),
    caso,
  );
  if (!a) return null;
  const sostituisce = aperto && aperto.a === da.id && aperto.da === a.id && probabile(caso, 5) ? aperto.id : undefined;
  const azione: Azione = {
    tipo: 'proponi',
    giocatore: da.id,
    a: a.id,
    dare: pacchettoCasuale(s, da, caso),
    avere: pacchettoCasuale(s, a, caso),
    nota: '',
    ...(sostituisce === undefined ? {} : { sostituisce }),
  };
  return verifica(s, azione) === null ? azione : null;
}

/** All'asta offre un giocatore a caso, oppure si aspetta la fine. */
function mossaAsta(s: Stato, caso: Caso, adesso: number): { azione: Azione } | { scadenza: number } {
  if (probabile(caso, 6)) {
    const g = scegli(
      s.giocatori.filter((x) => !x.eliminato),
      caso,
    )!;
    const offerta = scegli(
      azioniPossibili(s, g.id).filter((x) => x.tipo === 'offri'),
      caso,
    );
    if (offerta) return { azione: offerta };
  }
  return { scadenza: Math.max(adesso, s.asta!.scadenza) };
}

/** Qualcuno chiede, regala tempo o vota; `null` se in questo momento non si può. */
function mossaDiTempo(s: Stato, caso: Caso): Azione | null {
  const vivi = s.giocatori.filter((g) => !g.eliminato);
  const altro = scegli(
    vivi.filter((g) => g.id !== s.turno.giocatore),
    caso,
  );
  if (!altro) return null;
  const azioni: Azione[] = [
    { tipo: 'chiedi_tempo', giocatore: s.turno.giocatore },
    { tipo: 'regala_tempo', giocatore: altro.id },
    { tipo: 'vota', giocatore: altro.id, favorevole: true },
    { tipo: 'vota', giocatore: altro.id, favorevole: false },
  ];
  const azione = scegli(azioni, caso)!;
  return verifica(s, azione) === null ? azione : null;
}

/** Cose che succedono intorno alla partita: tempo che scade, connessioni, pause, espulsioni. */
function imprevisto(s: Stato, caso: Caso, adesso: number): { esito: Esito; adesso: number; descrizione: string } | null {
  const vivi = s.giocatori.filter((g) => !g.eliminato);
  switch (caso.intero(4)) {
    case 0: {
      // Nessuno fa niente fino alla prossima scadenza.
      const scadenza = prossimaScadenza(s);
      if (scadenza === null) return null;
      const quando = Math.max(adesso, scadenza);
      return { esito: applicaScadenze(s, caso, quando)!, adesso: quando, descrizione: 'scadenza' };
    }
    case 1: {
      const g = scegli(vivi, caso)!;
      const stato = connessione(s, g.id, g.offlineDa !== null, adesso);
      return { esito: { ok: true, stato, eventi: [] }, adesso, descrizione: 'connessione' };
    }
    case 2: {
      // Pausa: nessuno è collegato e gli orologi si fermano.
      return { esito: { ok: true, stato: sposta(s, 1 + caso.intero(600_000)), eventi: [] }, adesso, descrizione: 'pausa' };
    }
    default: {
      const bersaglio = scegli(
        vivi.filter((g) => g.id !== s.turno.giocatore),
        caso,
      );
      return bersaglio ? { esito: espelli(s, bersaglio.id, caso, adesso), adesso, descrizione: 'espulsione' } : null;
    }
  }
}

function giocaPartita(seme: number) {
  const caso = casoDaSeme(seme);
  const n = 2 + caso.intero(7);
  const mappe = Object.keys(TABELLONI) as IdMappa[];
  // A squadre in un terzo delle partite (servono almeno 3 giocatori), con 2 o 3 squadre.
  const squadre = n >= 3 && caso.intero(3) === 0 ? 2 + caso.intero(Math.min(2, n - 2)) : 0;
  const creata = creaPartita(
    ID.slice(0, n).map((id, i) => ({ id, nome: NOMI[i]!, colore: i + 1, squadra: squadre ? i % squadre : null })),
    {
      ...IMPOSTAZIONI_PREDEFINITE,
      mappa: mappe[caso.intero(mappe.length)]!,
      squadre: squadre > 0,
      soldiIniziali: scegli(SOLDI_INIZIALI_POSSIBILI, caso)!,
      cassaVacanza: caso.intero(2) === 1,
      affittoDoppioSetCompleto: caso.intero(2) === 1,
      nienteAffittoInPrigione: caso.intero(2) === 1,
      aste: caso.intero(2) === 1,
      ipoteche: caso.intero(2) === 1,
      costruzioneUniforme: caso.intero(3) > 0,
      stanzaPrivata: caso.intero(2) === 1,
      timerTurno: caso.intero(3) > 0,
    },
    caso,
  );
  if (!creata.ok) throw new Error(creata.messaggio);

  let s = creata.stato;
  let adesso = 0;
  // In metà delle partite c'è un distratto: nel suo turno lascia scadere il tempo, e gli altri lo votano.
  const distratto = caso.intero(2) === 0 ? scegli(s.giocatori, caso)!.id : null;
  const visti = new Set<TipoEvento>(creata.eventi.map((e) => e.tipo));
  const uscite = new Set<string>();
  let azioni = 0;
  for (; azioni < AZIONI_MAX && s.fase === 'in_corso'; azioni++) {
    adesso += PASSO_MS;
    let esito: Esito;
    let descrizione: string;
    const fuoriTurno = s.giocatori.filter((g) => !g.eliminato && g.id !== s.turno.giocatore);
    const scambio = caso.intero(25) === 0 ? scambioCasuale(s, caso) : null;
    const tempo = caso.intero(40) === 0 ? mossaDiTempo(s, caso) : null;
    const fuori = caso.intero(azioni > PAZIENZA ? 20 : 150) === 0 ? imprevisto(s, caso, adesso) : null;
    const scadenza = prossimaScadenza(s);
    if (s.turno.giocatore === distratto && !s.asta && scadenza !== null && !fuori) {
      const voto: Azione | undefined = scegli(
        s.giocatori
          .filter((g) => !g.eliminato && g.id !== distratto)
          .map((g): Azione => ({ tipo: 'vota', giocatore: g.id, favorevole: true }))
          .filter((a) => verifica(s, a) === null),
        caso,
      );
      if (voto && probabile(caso, 5)) {
        esito = applica(s, voto, caso, adesso);
        descrizione = 'voto contro il distratto';
      } else {
        adesso = Math.max(adesso, scadenza);
        esito = applicaScadenze(s, caso, adesso)!;
        descrizione = 'tempo scaduto al distratto';
      }
    } else if (fuori) {
      esito = fuori.esito;
      adesso = fuori.adesso;
      descrizione = fuori.descrizione;
    } else if (tempo) {
      esito = applica(s, tempo, caso, adesso);
      descrizione = tempo.tipo;
    } else if (caso.intero(azioni > PAZIENZA ? 200 : 2000) === 0 && fuoriTurno.length) {
      // Ogni tanto qualcuno fuori turno si arrende, più spesso se la partita si allunga.
      const azione: Azione = { tipo: 'bancarotta', giocatore: scegli(fuoriTurno, caso)!.id };
      esito = applica(s, azione, caso, adesso);
      descrizione = azione.tipo;
    } else if (scambio) {
      esito = applica(s, scambio, caso, adesso);
      descrizione = scambio.tipo;
    } else if (s.asta) {
      const mossa = mossaAsta(s, caso, adesso);
      if ('azione' in mossa) {
        esito = applica(s, mossa.azione, caso, adesso);
        descrizione = 'offri';
      } else {
        adesso = mossa.scadenza;
        esito = applicaScadenze(s, caso, adesso)!;
        descrizione = 'fine dell’asta';
      }
    } else {
      const azione = decidi(s, caso);
      esito = applica(s, azione, caso, adesso);
      descrizione = azione.tipo;
    }

    if (!esito.ok) throw new Error(`Seme ${seme}, azione ${azioni}: ${descrizione} rifiutata (${esito.messaggio}).`);
    s = esito.stato;
    for (const e of esito.eventi) {
      visti.add(e.tipo);
      if (e.tipo === 'rimozione') uscite.add(e.motivo);
      if (e.tipo === 'bancarotta') uscite.add(e.automatica ? 'bancarotta automatica' : 'bancarotta');
    }
    const errori = problemi(s);
    if (errori.length) throw new Error(`Seme ${seme}, azione ${azioni} (${descrizione}): ${errori.join(' ')}`);
  }
  return { stato: s, azioni, visti, uscite };
}

describe('simulazione di partite intere', () => {
  it(`${PARTITE} partite arrivano alla fine senza errori né stati incoerenti`, { timeout: 60_000 }, () => {
    const visti = new Set<TipoEvento>();
    const uscite = new Set<string>();
    let finite = 0;
    for (let seme = 1; seme <= PARTITE; seme++) {
      const partita = giocaPartita(seme);
      for (const t of partita.visti) visti.add(t);
      for (const u of partita.uscite) uscite.add(u);
      if (partita.stato.fase === 'finita') finite++;
    }
    expect(finite).toBe(PARTITE);
    // Ogni regola è stata usata almeno una volta.
    const tutti: TipoEvento[] = [
      'inizio', 'turno', 'turno_saltato', 'dadi', 'movimento', 'partenza', 'acquisto', 'affitto', 'tassa', 'premio', 'carta',
      'prigione', 'prigione_fallita', 'uscita_prigione', 'vacanza', 'vendita', 'debito', 'rimborso', 'bancarotta', 'fine',
      'costruzione', 'demolizione', 'ipoteca', 'riscatto', 'asta', 'asta_vinta', 'asta_deserta',
      'scambio_proposto', 'scambio_accettato', 'scambio_rifiutato', 'scambio_annullato',
      'tempo_scaduto', 'tempo_chiesto', 'tempo_regalato', 'voto', 'rimozione', 'eredita',
    ];
    expect(tutti.filter((t) => !visti.has(t))).toEqual([]);
    // E ogni modo di uscire dalla partita.
    expect([...uscite].sort()).toEqual(
      ['assenza', 'bancarotta', 'bancarotta automatica', 'espulsione', 'tempo', 'voto'].sort(),
    );
  });

  it('stesso seme, stessa partita', () => {
    expect(giocaPartita(42).stato).toEqual(giocaPartita(42).stato);
  });
});
