/* Statistiche e classifica di fine partita: docs/analisi/04-economia-fine-partita.md §10. */

import { describe, expect, it } from 'vitest';
import { casoDaSeme } from './caso';
import { IMPOSTAZIONI_PREDEFINITE } from './impostazioni';
import { creaPartita } from './partita';
import { assegna, dadi, esegui, g, ID, NOMI, partitaASquadre, partitaDiProva } from './prove';
import { applica, applicaScadenze } from './regole';
import { classifica, contaMessaggio, durata, piuVolteInPrigione, proprietaPiuVisitata } from './statistiche';
import { connessione, sposta } from './tempo';
import type { Azione, Stato } from './tipi';
import { vistaPartita } from './vista';

const lancia = (giocatore = 'a'): Azione => ({ tipo: 'lancia', giocatore });
const fine = (giocatore = 'a'): Azione => ({ tipo: 'fine_turno', giocatore });
const bancarotta = (giocatore: string): Azione => ({ tipo: 'bancarotta', giocatore });

const SIENA = 11;
const PISA = 13;
const OLBIA = 6;
const CAGLIARI = 9;

function partitaAlle(adesso: number, n = 2): Stato {
  const esito = creaPartita(
    ID.slice(0, n).map((id, i) => ({ id, nome: NOMI[i]!, colore: i + 1 })),
    { ...IMPOSTAZIONI_PREDEFINITE, ordineCasuale: false },
    casoDaSeme(1),
    adesso,
  );
  if (!esito.ok) throw new Error(esito.messaggio);
  return esito.stato;
}

describe('raccolta durante la partita', () => {
  it('parte vuota, con il patrimonio iniziale di tutti al turno 0', () => {
    const s = partitaAlle(5_000, 3);
    expect(s.statistiche).toMatchObject({ inizio: 5_000, fine: null, doppi: 0, scambi: 0, messaggi: 0, prigione: {}, uscite: [] });
    expect(s.statistiche.visite).toHaveLength(40);
    expect(s.statistiche.visite.every((v) => v === 0)).toBe(true);
    // Chi gioca dopo il primo parte con 75 € in più per ogni posto.
    expect(s.statistiche.patrimonio).toEqual([{ turno: 0, valori: [1500, 1575, 1650] }]);
  });

  it('conta i doppi e le caselle su cui ci si ferma', () => {
    let { stato } = esegui(partitaDiProva(), lancia(), dadi([3, 3]));
    ({ stato } = esegui(stato, lancia(), dadi([1, 2])));
    expect(stato.statistiche.doppi).toBe(1);
    expect(stato.statistiche.visite[OLBIA]).toBe(1);
    expect(stato.statistiche.visite[CAGLIARI]).toBe(1);
    expect(stato.statistiche.visite.reduce((t, v) => t + v, 0)).toBe(2);
  });

  it('a fine turno segna il patrimonio di tutti', () => {
    let { stato } = esegui(partitaDiProva(), lancia(), dadi([3, 4]));
    ({ stato } = esegui(stato, { tipo: 'compra', giocatore: 'a' }));
    ({ stato } = esegui(stato, fine()));
    // Sassari costa 110: il contante scende, ma la proprietà conta nel patrimonio al prezzo pieno.
    expect(g(stato, 'a').saldo).toBe(1390);
    expect(stato.statistiche.patrimonio).toEqual([
      { turno: 0, valori: [1500, 1500] },
      { turno: 1, valori: [1500, 1500] },
    ]);
  });

  it('conta le volte in prigione di ogni giocatore', () => {
    const s = partitaDiProva();
    g(s, 'a').posizione = 25;
    const { stato } = esegui(s, lancia(), dadi([2, 3]));
    expect(g(stato, 'a').prigione).toBe(0);
    expect(stato.statistiche.prigione).toEqual({ a: 1 });
    expect(stato.statistiche.visite[30]).toBe(1);
  });

  it('conta solo gli scambi accettati', () => {
    const s = assegna(assegna(partitaDiProva(), 'a', SIENA), 'b', PISA);
    const proposta = (scambio: number): Azione => ({
      tipo: 'proponi',
      giocatore: 'a',
      a: 'b',
      dare: { soldi: 0, caselle: [SIENA], grazie: [] },
      avere: { soldi: 0, caselle: [PISA], grazie: [] },
      nota: String(scambio),
    });
    let { stato } = esegui(s, proposta(1));
    ({ stato } = esegui(stato, { tipo: 'rifiuta', giocatore: 'b', scambio: 1 }));
    expect(stato.statistiche.scambi).toBe(0);
    ({ stato } = esegui(stato, proposta(2)));
    ({ stato } = esegui(stato, { tipo: 'accetta', giocatore: 'b', scambio: 2 }));
    expect(stato.statistiche.scambi).toBe(1);
  });

  it('conta i messaggi solo mentre la partita è in corso, senza toccare lo stato ricevuto', () => {
    const s = partitaDiProva();
    const dopo = contaMessaggio(contaMessaggio(s));
    expect(dopo.statistiche.messaggi).toBe(2);
    expect(s.statistiche.messaggi).toBe(0);
    const finita = esegui(s, bancarotta('b')).stato;
    expect(contaMessaggio(finita)).toBe(finita);
  });
});

describe('fine della partita', () => {
  it('segna l’ora della fine, l’ultimo punto del grafico e l’ordine delle uscite', () => {
    const s = esegui(partitaAlle(1_000, 3), bancarotta('b'), casoDaSeme(2), 4_000).stato;
    expect(s.statistiche.uscite).toEqual(['b']);
    const esito = applica(s, bancarotta('a'), casoDaSeme(2), 61_000);
    if (!esito.ok) throw new Error(esito.messaggio);
    const finita = esito.stato;
    expect(finita.fase).toBe('finita');
    expect(finita.statistiche.uscite).toEqual(['b', 'a']);
    expect(finita.statistiche.fine).toBe(61_000);
    expect(durata(finita)).toBe(60_000);
    expect(finita.statistiche.patrimonio.at(-1)).toEqual({ turno: 1, valori: [null, null, 1650] });
    // Il punto del turno 1 c'è una volta sola, anche se il turno è passato da 'a' a 'c' prima della fine.
    expect(finita.statistiche.patrimonio.filter((p) => p.turno === 1)).toHaveLength(1);
  });

  it('la durata non conta le pause', () => {
    const s = partitaAlle(1_000);
    const ripresa = sposta(s, 30_000);
    expect(ripresa.statistiche.inizio).toBe(31_000);
    const esito = applica(ripresa, bancarotta('b'), casoDaSeme(2), 91_000);
    if (!esito.ok) throw new Error(esito.messaggio);
    expect(durata(esito.stato)).toBe(60_000);
    expect(durata(s)).toBeNull();
  });

  it('il grafico arriva ai browser solo a partita finita', () => {
    let { stato } = esegui(partitaDiProva(), lancia(), dadi([3, 4]));
    ({ stato } = esegui(stato, fine()));
    expect(stato.statistiche.patrimonio).toHaveLength(2);
    expect(vistaPartita(stato).statistiche.patrimonio).toEqual([]);
    const finita = esegui(stato, bancarotta('a')).stato;
    expect(vistaPartita(finita).statistiche.patrimonio).toEqual(finita.statistiche.patrimonio);
  });
});

describe('classifica e riepilogo', () => {
  it('vincitore primo, poi chi è uscito più tardi', () => {
    let s = partitaDiProva(4);
    s = esegui(s, bancarotta('c')).stato;
    s.turno.numero = 7;
    // 'd' e 'b' escono nello stesso turno: 'b' dopo, quindi è davanti.
    s = esegui(s, bancarotta('d')).stato;
    s = esegui(s, bancarotta('b')).stato;
    expect(s.vincitore).toBe('a');
    expect(classifica(s)).toEqual([
      { giocatore: 'a', turni: 7, vincitore: true },
      { giocatore: 'b', turni: 7, vincitore: false },
      { giocatore: 'd', turni: 7, vincitore: false },
      { giocatore: 'c', turni: 1, vincitore: false },
    ]);
  });

  it('a squadre tutta la squadra vincitrice sta davanti, anche chi è uscito per primo', () => {
    // a e b nella squadra 0, c e d nella squadra 1; turni a, c, b, d.
    let s = partitaASquadre([0, 0, 1, 1]);
    s = esegui(s, bancarotta('b')).stato;
    s.turno.numero = 10;
    s = esegui(s, bancarotta('d')).stato;
    s.turno.numero = 20;
    s = esegui(s, bancarotta('c')).stato;
    expect(s.squadraVincitrice).toBe(0);
    expect(classifica(s)).toEqual([
      { giocatore: 'a', turni: 20, vincitore: true },
      { giocatore: 'b', turni: 1, vincitore: true },
      { giocatore: 'c', turni: 20, vincitore: false },
      { giocatore: 'd', turni: 10, vincitore: false },
    ]);
  });

  it('chi esce per assenza o tempo conta come chi fa bancarotta', () => {
    const s0 = connessione(partitaAlle(0, 3), 'c', false, 0);
    const esito = applicaScadenze(s0, casoDaSeme(3), 10 * 60_000);
    if (!esito?.ok) throw new Error('Nessuna scadenza');
    const s = esito.stato;
    expect(g(s, 'c').eliminato?.motivo).toBe('assenza');
    expect(classifica(s).at(-1)).toMatchObject({ giocatore: 'c', vincitore: false });
  });

  it('proprietà più visitata: solo le proprietà, a pari visite la prima del tabellone', () => {
    const s = partitaDiProva();
    expect(proprietaPiuVisitata(s)).toBeNull();
    s.statistiche.visite[10] = 9; // la Prigione non è una proprietà
    s.statistiche.visite[PISA] = 3;
    s.statistiche.visite[SIENA] = 3;
    expect(proprietaPiuVisitata(s)).toEqual({ casella: SIENA, visite: 3 });
  });

  it('più volte in prigione: tutti quelli a pari merito', () => {
    const s = partitaDiProva(3);
    expect(piuVolteInPrigione(s)).toBeNull();
    s.statistiche.prigione = { a: 2, b: 1, c: 2 };
    expect(piuVolteInPrigione(s)).toEqual({ giocatori: ['a', 'c'], volte: 2 });
  });
});
