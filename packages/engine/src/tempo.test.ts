import { describe, expect, it } from 'vitest';
import { ASTA_MS } from './economia';
import { assegna, dadi, esegui, g, partitaDiProva, problemi } from './prove';
import { applica, applicaScadenze, espelli, prossimaScadenza } from './regole';
import {
  ASSENZA_MS,
  BANCA_INIZIALE_MS,
  BANCA_MAX_MS,
  connessione,
  GRAZIA_DEBITO_MS,
  GRAZIA_MS,
  REGALO_MS,
  ricarica,
  sposta,
  tempoTurno,
  VOTO_A_TEMPO_MS,
} from './tempo';
import type { Azione, Caso, Esito, Stato } from './tipi';

const AOSTA = 3;
const OLBIA = 6;
/** Primo turno: grazia più banca iniziale. */
const PRIMA_SCADENZA = GRAZIA_MS + BANCA_INIZIALE_MS;

function scade(s: Stato, adesso: number, caso: Caso = dadi()): Extract<Esito, { ok: true }> {
  const esito = applicaScadenze(s, caso, adesso);
  if (!esito?.ok) throw new Error(`A ${adesso} ms non scade niente.`);
  return esito;
}

function codice(s: Stato, azione: Azione, adesso = 0): string | null {
  const esito = applica(s, azione, dadi(), adesso);
  return esito.ok ? null : esito.codice;
}

/** 'a' tira 1+2 (Aosta, libera) e finisce il turno all'istante `quando`. */
function turnoVeloce(s: Stato, id: string, quando: number, tiro: [number, number] = [1, 2]): Stato {
  const lancio = esegui(s, { tipo: 'lancia', giocatore: id }, dadi(tiro), quando).stato;
  return esegui(lancio, { tipo: 'fine_turno', giocatore: id }, dadi(), quando).stato;
}

describe('timer di turno', () => {
  it('il primo turno dura grazia più banca; allo scadere il gioco tira e finisce il turno senza comprare', () => {
    const s = partitaDiProva(2);
    expect(prossimaScadenza(s)).toBe(PRIMA_SCADENZA);
    expect(applicaScadenze(s, dadi(), PRIMA_SCADENZA - 1)).toBeNull();

    const { stato, eventi } = scade(s, PRIMA_SCADENZA, dadi([1, 2]));
    expect(eventi.map((e) => e.tipo)).toEqual(['tempo_scaduto', 'dadi', 'movimento', 'turno']);
    expect(eventi[0]).toEqual({ tipo: 'tempo_scaduto', giocatore: 'a', assente: false });
    expect(stato.proprieta[AOSTA]!.proprietario).toBeNull();
    expect(g(stato, 'a')).toMatchObject({ posizione: AOSTA, automatici: 1, banca: 0 });
    // Il turno di 'b' parte da qui.
    expect(stato.turno).toMatchObject({ giocatore: 'b', tempo: { inizio: PRIMA_SCADENZA, automatico: false } });
    expect(problemi(stato)).toEqual([]);
  });

  it('a fine turno la banca perde il tempo usato oltre la grazia e si ricarica di più se il turno è veloce', () => {
    expect(ricarica(0)).toBe(20_000);
    expect(ricarica(GRAZIA_MS / 2)).toBe(13_000);
    expect(ricarica(GRAZIA_MS)).toBe(6_000);
    expect(ricarica(GRAZIA_MS * 3)).toBe(6_000);

    const veloce = turnoVeloce(partitaDiProva(2), 'a', 5_000);
    expect(g(veloce, 'a')).toMatchObject({ banca: BANCA_INIZIALE_MS + ricarica(5_000), automatici: 0 });

    // 50 s: 30 s oltre la grazia escono dalla banca, poi la ricarica minima.
    const lento = turnoVeloce(partitaDiProva(2), 'a', 50_000);
    expect(g(lento, 'a').banca).toBe(BANCA_INIZIALE_MS - 30_000 + 6_000);

    const piena = partitaDiProva(2);
    g(piena, 'a').banca = BANCA_MAX_MS;
    expect(g(turnoVeloce(piena, 'a', 1_000), 'a').banca).toBe(BANCA_MAX_MS);
  });

  it('senza timer il turno non ha limite finché chi gioca è collegato', () => {
    const s = partitaDiProva(2, { timerTurno: false });
    expect(prossimaScadenza(s)).toBeNull();
    expect(applicaScadenze(s, dadi(), 10 * 60_000)).toBeNull();
    expect(tempoTurno(s, 0)).toBeNull();
  });

  it('chi è in debito ha 60 s di grazia, e allo scadere fa bancarotta da solo', () => {
    const s = partitaDiProva(3);
    // 'a' finisce in rosso con la tassa: la grazia si allunga subito.
    g(s, 'a').saldo = -100;
    const inRosso = esegui(s, { tipo: 'chiedi_tempo', giocatore: 'a' }, dadi(), 1_000).stato;
    expect(inRosso.turno.tempo.grazia).toBe(GRAZIA_DEBITO_MS);
    expect(prossimaScadenza(inRosso)).toBe(GRAZIA_DEBITO_MS + BANCA_INIZIALE_MS);

    const { stato, eventi } = scade(inRosso, GRAZIA_DEBITO_MS + BANCA_INIZIALE_MS);
    expect(eventi.find((e) => e.tipo === 'bancarotta')).toEqual({ tipo: 'bancarotta', giocatore: 'a', recuperi: [], automatica: true });
    expect(g(stato, 'a').eliminato).toMatchObject({ motivo: 'bancarotta' });
    expect(stato.turno.giocatore).toBe('b');
  });

  it('il turno che comincia in debito ha già la grazia lunga', () => {
    const s = partitaDiProva(2);
    g(s, 'b').saldo = -10;
    const dopo = turnoVeloce(s, 'a', 2_000);
    expect(dopo.turno).toMatchObject({ giocatore: 'b', tempo: { grazia: GRAZIA_DEBITO_MS, inizio: 2_000 } });
  });

  it('dopo due turni finiti in automatico, al terzo tempo scaduto si esce dalla partita', () => {
    let s = partitaDiProva(3);
    // Tre giri: 'a' non gioca mai, 'b' e 'c' giocano subito.
    for (let giro = 1; giro <= 2; giro++) {
      const adesso = prossimaScadenza(s)!;
      s = scade(s, adesso, dadi([1, 2])).stato;
      expect(g(s, 'a').automatici).toBe(giro);
      s = turnoVeloce(s, 'b', adesso + 1_000);
      s = turnoVeloce(s, 'c', adesso + 2_000);
    }
    expect(s.turno.giocatore).toBe('a');
    const { stato, eventi } = scade(s, prossimaScadenza(s)!);
    expect(eventi.map((e) => e.tipo)).toEqual(['rimozione', 'turno']);
    expect(eventi[0]).toMatchObject({ tipo: 'rimozione', giocatore: 'a', motivo: 'tempo' });
    expect(g(stato, 'a').eliminato).toMatchObject({ motivo: 'tempo' });
    expect(problemi(stato)).toEqual([]);
  });

  it('un turno giocato di persona azzera il conto dei turni automatici', () => {
    let s = partitaDiProva(2);
    s = scade(s, PRIMA_SCADENZA, dadi([1, 2])).stato;
    s = turnoVeloce(s, 'b', PRIMA_SCADENZA + 1_000);
    expect(g(s, 'a').automatici).toBe(1);
    s = turnoVeloce(s, 'a', PRIMA_SCADENZA + 2_000);
    expect(g(s, 'a').automatici).toBe(0);
  });

  it('con un doppio il gioco tira ancora; con le aste manda all’asta e il turno finisce dopo l’asta', () => {
    const s = partitaDiProva(2, { aste: true });
    // Doppio (Olbia, libera): il gioco la manda all'asta. L'orologio si ferma.
    const aperta = scade(s, PRIMA_SCADENZA, dadi([3, 3]));
    expect(aperta.eventi.map((e) => e.tipo)).toEqual(['tempo_scaduto', 'dadi', 'movimento', 'asta']);
    expect(aperta.stato.asta).toMatchObject({ casella: OLBIA });
    expect(aperta.stato.turno.tempo).toMatchObject({ automatico: true, fermoDa: PRIMA_SCADENZA });

    // Finita l'asta, il turno riprende già scaduto: il gioco tira ancora (era un doppio, va in visita
    // alla Prigione) e chiude.
    const chiusa = scade(aperta.stato, PRIMA_SCADENZA + ASTA_MS, dadi([1, 3]));
    expect(chiusa.eventi.map((e) => e.tipo)).toEqual(['asta_deserta', 'dadi', 'movimento', 'turno']);
    expect(chiusa.eventi.some((e) => e.tipo === 'tempo_scaduto')).toBe(false);
    expect(g(chiusa.stato, 'a')).toMatchObject({ posizione: OLBIA + 4, automatici: 1 });
  });

  it('durante l’asta l’orologio del turno è fermo', () => {
    let s = partitaDiProva(2, { aste: true });
    s = esegui(s, { tipo: 'lancia', giocatore: 'a' }, dadi([1, 2]), 5_000).stato;
    s = esegui(s, { tipo: 'asta', giocatore: 'a' }, dadi(), 10_000).stato;
    expect(prossimaScadenza(s)).toBe(10_000 + ASTA_MS);
    expect(tempoTurno(s, 15_000)).toMatchObject({ rimasto: PRIMA_SCADENZA - 10_000, fermo: true });
    s = scade(s, 10_000 + ASTA_MS).stato;
    // Il turno ha perso i 10 s dell'asta: la scadenza si sposta avanti di tanto.
    expect(s.turno.tempo).toMatchObject({ inizio: ASTA_MS, fermoDa: null });
    expect(prossimaScadenza(s)).toBe(PRIMA_SCADENZA + ASTA_MS);
  });
});

describe('tempo chiesto e regalato', () => {
  it('chi gioca chiede tempo una volta; un altro gli regala un minuto e la richiesta si chiude', () => {
    let s = partitaDiProva(3);
    s = esegui(s, { tipo: 'chiedi_tempo', giocatore: 'a' }, dadi(), 60_000).stato;
    expect(s.turno.tempo.richiesta).toBe(true);
    expect(codice(s, { tipo: 'chiedi_tempo', giocatore: 'a' })).toBe('gia_chiesto');
    expect(codice(s, { tipo: 'chiedi_tempo', giocatore: 'b' })).toBe('non_tuo_turno');

    const regalo = esegui(s, { tipo: 'regala_tempo', giocatore: 'b' }, dadi(), 65_000);
    expect(regalo.eventi).toEqual([{ tipo: 'tempo_regalato', da: 'b', a: 'a', ms: REGALO_MS }]);
    s = regalo.stato;
    expect(s.turno.tempo).toMatchObject({ regalato: REGALO_MS, regali: ['b'], richiesta: false });
    expect(prossimaScadenza(s)).toBe(PRIMA_SCADENZA + REGALO_MS);
  });

  it('un regalo a testa, al massimo due minuti a turno, mai a sé stessi né durante l’asta', () => {
    let s = partitaDiProva(4);
    expect(codice(s, { tipo: 'regala_tempo', giocatore: 'a' })).toBe('non_tuo_turno');
    s = esegui(s, { tipo: 'regala_tempo', giocatore: 'b' }).stato;
    expect(codice(s, { tipo: 'regala_tempo', giocatore: 'b' })).toBe('gia_regalato');
    s = esegui(s, { tipo: 'regala_tempo', giocatore: 'c' }).stato;
    expect(codice(s, { tipo: 'regala_tempo', giocatore: 'd' })).toBe('regali_esauriti');

    let asta = partitaDiProva(2, { aste: true });
    asta = esegui(asta, { tipo: 'lancia', giocatore: 'a' }, dadi([1, 2])).stato;
    asta = esegui(asta, { tipo: 'asta', giocatore: 'a' }).stato;
    expect(codice(asta, { tipo: 'regala_tempo', giocatore: 'b' })).toBe('asta_in_corso');
  });

  it('senza timer non si chiede né si regala tempo, tranne a chi non è collegato', () => {
    const s = partitaDiProva(2, { timerTurno: false });
    expect(codice(s, { tipo: 'chiedi_tempo', giocatore: 'a' })).toBe('timer_spento');
    expect(codice(s, { tipo: 'regala_tempo', giocatore: 'b' })).toBe('timer_spento');
    const via = connessione(s, 'a', false, 1_000);
    expect(codice(via, { tipo: 'regala_tempo', giocatore: 'b' })).toBeNull();
  });
});

describe('assenze', () => {
  it('chi si scollega durante il suo turno ha solo la grazia, contata da quando è sparito', () => {
    const s = connessione(partitaDiProva(2), 'a', false, 5_000);
    expect(g(s, 'a').offlineDa).toBe(5_000);
    expect(prossimaScadenza(s)).toBe(5_000 + GRAZIA_MS);
    const { stato, eventi } = scade(s, 5_000 + GRAZIA_MS, dadi([1, 2]));
    expect(eventi[0]).toEqual({ tipo: 'tempo_scaduto', giocatore: 'a', assente: true });
    expect(stato.turno.giocatore).toBe('b');
    // Il turno è durato 25 s: i 5 s oltre la grazia escono dalla banca, e non c'è ricarica.
    expect(g(stato, 'a').banca).toBe(BANCA_INIZIALE_MS - 5_000);
  });

  it('l’asta non consuma la grazia di chi è scollegato: dopo l’asta ha ancora quella che gli restava', () => {
    // 'a' tira a 2 s e apre l'asta a 10 s; si scollega a metà asta, che si chiude a 20 s.
    let s = partitaDiProva(3, { aste: true });
    s = esegui(s, { tipo: 'lancia', giocatore: 'a' }, dadi([1, 2]), 2_000).stato;
    s = esegui(s, { tipo: 'asta', giocatore: 'a' }, dadi(), 10_000).stato;
    s = connessione(s, 'a', false, 15_000);
    expect(tempoTurno(s, 15_000)).toMatchObject({ rimasto: GRAZIA_MS, fermo: true });
    const chiusa = scade(s, 10_000 + ASTA_MS).stato;
    expect(prossimaScadenza(chiusa)).toBe(10_000 + ASTA_MS + GRAZIA_MS);
    expect(problemi(chiusa)).toEqual([]);

    // Scollegato prima dell'asta: i secondi già passati contano, quelli dell'asta no.
    let prima = partitaDiProva(3, { aste: true });
    prima = connessione(prima, 'a', false, 1_000);
    prima = esegui(prima, { tipo: 'lancia', giocatore: 'a' }, dadi([1, 2]), 2_000).stato;
    prima = esegui(prima, { tipo: 'asta', giocatore: 'a' }, dadi(), 10_000).stato;
    // Una pausa senza nessuno collegato sposta tutto, grazia compresa.
    prima = sposta(prima, 5_000);
    const dopo = scade(prima, 15_000 + ASTA_MS).stato;
    expect(prossimaScadenza(dopo)).toBe(15_000 + ASTA_MS + GRAZIA_MS - 9_000);
    expect(problemi(dopo)).toEqual([]);
  });

  it('chi torna in tempo riprende il turno con il suo tempo intero', () => {
    const via = connessione(partitaDiProva(2), 'a', false, 5_000);
    const tornato = connessione(via, 'a', true, 10_000);
    expect(g(tornato, 'a').offlineDa).toBeNull();
    expect(prossimaScadenza(tornato)).toBe(PRIMA_SCADENZA);
    expect(connessione(tornato, 'a', true, 11_000)).toBe(tornato);
  });

  it('anche senza timer il turno di chi è scollegato passa da solo', () => {
    const s = connessione(partitaDiProva(2, { timerTurno: false }), 'a', false, 0);
    expect(prossimaScadenza(s)).toBe(GRAZIA_MS);
    expect(scade(s, GRAZIA_MS, dadi([1, 2])).stato.turno.giocatore).toBe('b');
  });

  it('dopo due minuti scollegato si esce dalla partita; in due la partita finisce', () => {
    // Senza timer il turno di 'b', che è collegato, non scade: scade l'assenza di 'a'.
    const s = connessione(turnoVeloce(partitaDiProva(2, { timerTurno: false }), 'a', 1_000), 'a', false, 2_000);
    const { stato, eventi } = scade(s, 2_000 + ASSENZA_MS);
    expect(eventi).toEqual([
      { tipo: 'rimozione', giocatore: 'a', motivo: 'assenza', recuperi: [] },
      { tipo: 'fine', vincitore: 'b' },
    ]);
    expect(stato).toMatchObject({ fase: 'finita', vincitore: 'b' });
  });

  it('chi esce lascia i beni alla banca e paga i creditori come in una bancarotta', () => {
    let s = assegna(partitaDiProva(3, { timerTurno: false }), 'c', AOSTA);
    g(s, 'c').debiti = [{ creditore: 'b', importo: 50 }];
    g(s, 'c').saldo = -50;
    s = connessione(s, 'c', false, 0);
    const { stato, eventi } = scade(s, ASSENZA_MS);
    expect(eventi[0]).toMatchObject({ tipo: 'rimozione', giocatore: 'c', motivo: 'assenza', recuperi: [{ creditore: 'b', importo: 35 }] });
    expect(stato.proprieta[AOSTA]!.proprietario).toBeNull();
    expect(problemi(stato)).toEqual([]);
  });

  it('dopo una pausa gli orologi riprendono da dove erano', () => {
    let s = partitaDiProva(2, { aste: true });
    s = connessione(s, 'b', false, 1_000);
    s = esegui(s, { tipo: 'lancia', giocatore: 'a' }, dadi([1, 2]), 2_000).stato;
    s = esegui(s, { tipo: 'asta', giocatore: 'a' }, dadi(), 3_000).stato;
    const spostata = sposta(s, 60_000);
    expect(g(spostata, 'b').offlineDa).toBe(61_000);
    expect(spostata.asta!.scadenza).toBe(s.asta!.scadenza + 60_000);
    expect(spostata.turno.tempo).toMatchObject({ inizio: 60_000, fermoDa: 63_000 });
    expect(sposta(s, 0)).toBe(s);
  });
});

describe('voto per togliere chi gioca', () => {
  it('con il timer si vota solo dopo un turno finito in automatico, e mai in due', () => {
    const dueSoli = scade(partitaDiProva(2), PRIMA_SCADENZA, dadi([1, 2])).stato;
    const ancoraA = turnoVeloce(dueSoli, 'b', PRIMA_SCADENZA + 1_000);
    expect(codice(ancoraA, { tipo: 'vota', giocatore: 'b', favorevole: true })).toBe('voto_non_disponibile');

    const s = partitaDiProva(3);
    expect(codice(s, { tipo: 'vota', giocatore: 'b', favorevole: true })).toBe('voto_non_disponibile');
  });

  it('con la maggioranza chi gioca esce subito; il voto si può ritirare e si azzera a ogni turno', () => {
    let s = scade(partitaDiProva(3), PRIMA_SCADENZA, dadi([1, 2])).stato;
    s = turnoVeloce(s, 'b', PRIMA_SCADENZA + 1_000);
    s = turnoVeloce(s, 'c', PRIMA_SCADENZA + 2_000);
    expect(s.turno.giocatore).toBe('a');
    expect(codice(s, { tipo: 'vota', giocatore: 'a', favorevole: true })).toBe('voto_non_disponibile');
    expect(codice(s, { tipo: 'vota', giocatore: 'b', favorevole: false })).toBe('non_votato');

    const primo = esegui(s, { tipo: 'vota', giocatore: 'b', favorevole: true });
    expect(primo.eventi).toEqual([{ tipo: 'voto', da: 'b', contro: 'a', favorevole: true, voti: 1, servono: 2 }]);
    expect(codice(primo.stato, { tipo: 'vota', giocatore: 'b', favorevole: true })).toBe('gia_votato');
    // Con il timer non c'è il voto a tempo.
    expect(primo.stato.turno.votazione).toEqual({ voti: ['b'], scadenza: null });

    const ritirato = esegui(primo.stato, { tipo: 'vota', giocatore: 'b', favorevole: false }).stato;
    expect(ritirato.turno.votazione.voti).toEqual([]);

    // Il voto non sopravvive al turno.
    const dopo = turnoVeloce(primo.stato, 'a', PRIMA_SCADENZA + 3_000, [1, 3]);
    expect(dopo.turno.votazione.voti).toEqual([]);

    const fuori = esegui(esegui(s, { tipo: 'vota', giocatore: 'b', favorevole: true }).stato, {
      tipo: 'vota',
      giocatore: 'c',
      favorevole: true,
    });
    expect(fuori.eventi.map((e) => e.tipo)).toEqual(['voto', 'rimozione', 'turno']);
    expect(g(fuori.stato, 'a').eliminato).toMatchObject({ motivo: 'voto' });
    expect(fuori.stato.turno.giocatore).toBe('b');
  });

  it('senza timer il primo voto fa partire cinque minuti: se il turno non finisce, chi gioca esce', () => {
    let s = partitaDiProva(2, { timerTurno: false });
    s = esegui(s, { tipo: 'vota', giocatore: 'b', favorevole: true }, dadi(), 10_000).stato;
    expect(s.turno.votazione).toEqual({ voti: ['b'], scadenza: 10_000 + VOTO_A_TEMPO_MS });
    expect(prossimaScadenza(s)).toBe(10_000 + VOTO_A_TEMPO_MS);

    const { stato, eventi } = scade(s, 10_000 + VOTO_A_TEMPO_MS);
    expect(eventi[0]).toMatchObject({ tipo: 'rimozione', giocatore: 'a', motivo: 'voto' });
    expect(stato).toMatchObject({ fase: 'finita', vincitore: 'b' });

    // Se nel frattempo finisce il turno, il voto si spegne.
    const salvato = turnoVeloce(s, 'a', 20_000);
    expect(salvato.turno.votazione).toEqual({ voti: [], scadenza: null });
    expect(prossimaScadenza(salvato)).toBeNull();
  });
});

describe('espulsione decisa dall’host', () => {
  it('toglie un giocatore, ma non mentre gioca il suo turno', () => {
    const s = partitaDiProva(3);
    expect(espelli(s, 'a', dadi(), 0)).toMatchObject({ ok: false, codice: 'sta_giocando' });
    expect(espelli(s, 'z', dadi(), 0)).toMatchObject({ ok: false, codice: 'giocatore_sconosciuto' });
    const esito = espelli(s, 'c', dadi(), 0);
    if (!esito.ok) throw new Error(esito.messaggio);
    expect(esito.eventi).toEqual([{ tipo: 'rimozione', giocatore: 'c', motivo: 'espulsione', recuperi: [] }]);
    expect(espelli(esito.stato, 'c', dadi(), 0)).toMatchObject({ ok: false, codice: 'eliminato' });
  });
});
