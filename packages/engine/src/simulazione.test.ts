/*
 * Partite intere giocate a caso, con seme fisso. Dopo ogni azione lo stato deve restare coerente
 * e il giocatore di turno deve avere sempre qualcosa da fare.
 * Le case non si costruiscono ancora (Fase 5): la simulazione le aggiunge a mano sulle regioni complete,
 * così gli affitti salgono e le partite arrivano alla fine.
 */

import { describe, expect, it } from 'vitest';
import { casoDaSeme } from './caso';
import { IMPOSTAZIONI_PREDEFINITE, SOLDI_INIZIALI_POSSIBILI } from './impostazioni';
import { creaPartita } from './partita';
import { costruisciSuRegione, ID, NOMI, problemi } from './prove';
import { applica, azioniPossibili } from './regole';
import { tabellone } from './tabelloni';
import type { Azione, Caso, Stato, TipoEvento } from './tipi';

const PARTITE = 80;
const AZIONI_MAX = 20_000;
/** Dopo tante azioni i giocatori si stancano: senza scambi (Fase 5) le regioni restano spezzate. */
const PAZIENZA = 3_000;

function scegli<T>(lista: readonly T[], caso: Caso): T {
  return lista[caso.intero(lista.length)]!;
}

/** Un giocatore qualunque: compra spesso, esce di prigione a volte, vende se è in rosso. */
function decidi(s: Stato, caso: Caso): Azione {
  const id = s.turno.giocatore;
  const possibili = azioniPossibili(s, id);
  const di = (tipo: Azione['tipo']) => possibili.filter((a) => a.tipo === tipo);
  const saldo = s.giocatori.find((g) => g.id === id)!.saldo;

  if (saldo < 0) return scegli(di('vendi'), caso) ?? di('bancarotta')[0]!;
  if (di('compra').length && caso.intero(10) < 8) return di('compra')[0]!;
  const uscite = [...di('paga_cauzione'), ...di('usa_grazia')];
  if (uscite.length && caso.intero(10) < 3) return scegli(uscite, caso);
  return di('lancia')[0] ?? di('fine_turno')[0] ?? possibili[0]!;
}

function giocaPartita(seme: number) {
  const caso = casoDaSeme(seme);
  const n = 2 + caso.intero(7);
  const creata = creaPartita(
    ID.slice(0, n).map((id, i) => ({ id, nome: NOMI[i]!, colore: i + 1 })),
    {
      ...IMPOSTAZIONI_PREDEFINITE,
      soldiIniziali: scegli(SOLDI_INIZIALI_POSSIBILI, caso),
      cassaVacanza: caso.intero(2) === 1,
      affittoDoppioSetCompleto: caso.intero(2) === 1,
      nienteAffittoInPrigione: caso.intero(2) === 1,
    },
    caso,
  );
  if (!creata.ok) throw new Error(creata.messaggio);

  let s = creata.stato;
  const visti = new Set<TipoEvento>(creata.eventi.map((e) => e.tipo));
  const regioni = tabellone(s.mappa).regioni.length;
  let azioni = 0;
  for (; azioni < AZIONI_MAX && s.fase === 'in_corso'; azioni++) {
    // Ogni tanto qualcuno fuori turno si arrende, più spesso se la partita si allunga.
    const fuoriTurno = s.giocatori.filter((g) => !g.eliminato && g.id !== s.turno.giocatore);
    const azione: Azione =
      caso.intero(azioni > PAZIENZA ? 200 : 2000) === 0 && fuoriTurno.length
        ? { tipo: 'bancarotta', giocatore: scegli(fuoriTurno, caso).id }
        : decidi(s, caso);

    const esito = applica(s, azione, caso);
    if (!esito.ok) throw new Error(`Seme ${seme}, azione ${azioni}: ${azione.tipo} rifiutata (${esito.messaggio}).`);
    s = esito.stato;
    for (const e of esito.eventi) visti.add(e.tipo);

    if (caso.intero(20) === 0) costruisciSuRegione(s, caso.intero(regioni));
    const errori = problemi(s);
    if (errori.length) throw new Error(`Seme ${seme}, azione ${azioni} (${azione.tipo}): ${errori.join(' ')}`);
  }
  return { stato: s, azioni, visti };
}

describe('simulazione di partite intere', () => {
  it(`${PARTITE} partite arrivano alla fine senza errori né stati incoerenti`, { timeout: 30_000 }, () => {
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
    ];
    expect(tutti.filter((t) => !visti.has(t))).toEqual([]);
  });

  it('stesso seme, stessa partita', () => {
    expect(giocaPartita(42).stato).toEqual(giocaPartita(42).stato);
  });
});
