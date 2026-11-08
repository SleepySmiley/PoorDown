/*
 * Partite intere giocate a caso, con seme fisso. Dopo ogni azione lo stato deve restare coerente
 * e il giocatore di turno deve avere sempre qualcosa da fare.
 * I giocatori comprano, costruiscono, ipotecano, fanno aste e scambi; le regole facoltative
 * cambiano da una partita all'altra.
 */

import { describe, expect, it } from 'vitest';
import { casoDaSeme } from './caso';
import { possedute } from './conti';
import { IMPOSTAZIONI_PREDEFINITE, SOLDI_INIZIALI_POSSIBILI } from './impostazioni';
import { creaPartita } from './partita';
import { ID, NOMI, problemi } from './prove';
import { applica, applicaScadenze, azioniPossibili, verifica } from './regole';
import type { Azione, Caso, Esito, Giocatore, Pacchetto, Stato, TipoEvento } from './tipi';

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

function giocaPartita(seme: number) {
  const caso = casoDaSeme(seme);
  const n = 2 + caso.intero(7);
  const creata = creaPartita(
    ID.slice(0, n).map((id, i) => ({ id, nome: NOMI[i]!, colore: i + 1 })),
    {
      ...IMPOSTAZIONI_PREDEFINITE,
      soldiIniziali: scegli(SOLDI_INIZIALI_POSSIBILI, caso)!,
      cassaVacanza: caso.intero(2) === 1,
      affittoDoppioSetCompleto: caso.intero(2) === 1,
      nienteAffittoInPrigione: caso.intero(2) === 1,
      aste: caso.intero(2) === 1,
      ipoteche: caso.intero(2) === 1,
      costruzioneUniforme: caso.intero(3) > 0,
      stanzaPrivata: caso.intero(2) === 1,
    },
    caso,
  );
  if (!creata.ok) throw new Error(creata.messaggio);

  let s = creata.stato;
  let adesso = 0;
  const visti = new Set<TipoEvento>(creata.eventi.map((e) => e.tipo));
  let azioni = 0;
  for (; azioni < AZIONI_MAX && s.fase === 'in_corso'; azioni++) {
    adesso += PASSO_MS;
    let esito: Esito;
    let descrizione: string;
    const fuoriTurno = s.giocatori.filter((g) => !g.eliminato && g.id !== s.turno.giocatore);
    const scambio = caso.intero(25) === 0 ? scambioCasuale(s, caso) : null;
    if (caso.intero(azioni > PAZIENZA ? 200 : 2000) === 0 && fuoriTurno.length) {
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
    for (const e of esito.eventi) visti.add(e.tipo);
    const errori = problemi(s);
    if (errori.length) throw new Error(`Seme ${seme}, azione ${azioni} (${descrizione}): ${errori.join(' ')}`);
  }
  return { stato: s, azioni, visti };
}

describe('simulazione di partite intere', () => {
  it(`${PARTITE} partite arrivano alla fine senza errori né stati incoerenti`, { timeout: 60_000 }, () => {
    const visti = new Set<TipoEvento>();
    let finite = 0;
    for (let seme = 1; seme <= PARTITE; seme++) {
      const partita = giocaPartita(seme);
      for (const t of partita.visti) visti.add(t);
      if (partita.stato.fase === 'finita') finite++;
    }
    expect(finite).toBe(PARTITE);
    // Ogni regola è stata usata almeno una volta.
    const tutti: TipoEvento[] = [
      'inizio', 'turno', 'turno_saltato', 'dadi', 'movimento', 'partenza', 'acquisto', 'affitto', 'tassa', 'carta',
      'prigione', 'prigione_fallita', 'uscita_prigione', 'vacanza', 'vendita', 'debito', 'rimborso', 'bancarotta', 'fine',
      'costruzione', 'demolizione', 'ipoteca', 'riscatto', 'asta', 'asta_vinta', 'asta_deserta',
      'scambio_proposto', 'scambio_accettato', 'scambio_rifiutato', 'scambio_annullato',
    ];
    expect(tutti.filter((t) => !visti.has(t))).toEqual([]);
  });

  it('stesso seme, stessa partita', () => {
    expect(giocaPartita(42).stato).toEqual(giocaPartita(42).stato);
  });
});
