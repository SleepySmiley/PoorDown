import { describe, expect, it } from 'vitest';
import { applica, casoDaSeme, creaPartita, IMPOSTAZIONI_PREDEFINITE, type IdGiocatore, type Stato } from '@poordown/engine';
import { ricordoAsta, suonoRilancio, type RicordoAsta } from './rilanci';

/*
 * I suoni dei rilanci seguono l'offerta migliore, non la lunghezza dell'elenco delle offerte: il server ne tiene
 * solo le ultime 20, e prima dalla ventunesima i rilanci non suonavano più. Le aste qui sotto passano dal motore vero.
 */

const caso = casoDaSeme(7);

/** Una partita con un'asta aperta da Anna (prima di turno) sulla prima città del Classico. */
function astaAperta(giocatori: readonly IdGiocatore[] = ['anna', 'bruno']): Stato {
  const creata = creaPartita(
    giocatori.map((id, i) => ({ id, nome: id, colore: i + 1 })),
    { ...IMPOSTAZIONI_PREDEFINITE, aste: true, ordineCasuale: false },
    caso,
    0,
  );
  if (!creata.ok) throw new Error(creata.messaggio);
  const s = creata.stato;
  // Anna si è fermata su Courmayeur (casella 1), libera: invece di comprarla la manda all'asta.
  s.giocatori[0]!.posizione = 1;
  s.turno.fase = 'dopo_lancio';
  s.turno.acquisto = 1;
  const aperta = applica(s, { tipo: 'asta', giocatore: giocatori[0]! }, caso, 0);
  if (!aperta.ok) throw new Error(aperta.messaggio);
  return aperta.stato;
}

/** Rilanci di 2 € uno dopo l'altro, a 100 ms di distanza, da chi è indicato in `chi` a giro. Lo stato dopo ognuno. */
function rilanci(s: Stato, quanti: number, chi: readonly IdGiocatore[] = ['bruno', 'anna']): Stato[] {
  const stati: Stato[] = [];
  for (let i = 0; i < quanti; i++) {
    const importo = (s.asta?.migliore?.importo ?? 0) + 2;
    const esito = applica(s, { tipo: 'offri', giocatore: chi[i % chi.length]!, importo }, caso, 100 * (i + 1));
    if (!esito.ok) throw new Error(esito.messaggio);
    s = esito.stato;
    stati.push(s);
  }
  return stati;
}

/** I suoni che sente `io` aggiornamento per aggiornamento, come in `useSuoniAsta`. */
function suoni(iniziale: Stato, stati: readonly Stato[], io: IdGiocatore | null): (string | null)[] {
  let prima: RicordoAsta = ricordoAsta(iniziale.asta, io);
  return stati.map((s) => {
    const adesso = ricordoAsta(s.asta, io);
    const suono = suonoRilancio(prima, adesso, io);
    prima = adesso;
    return suono;
  });
}

describe('suoni dei rilanci all’asta', () => {
  it('dalla ventesima offerta l’elenco non si allunga più: per questo non si può contare la sua lunghezza', () => {
    const stati = rilanci(astaAperta(), 22);
    expect(stati[19]!.asta!.offerte).toHaveLength(20);
    expect(stati[21]!.asta!.offerte).toHaveLength(20);
  });

  it('chi guarda sente ogni rilancio, anche oltre le 20 offerte tenute in elenco', () => {
    const s = astaAperta();
    expect(suoni(s, rilanci(s, 30), null)).toEqual(Array(30).fill('offerta'));
  });

  it('chi rilancia sente il proprio rilancio e poi «superato», a ogni giro e anche dopo la ventesima offerta', () => {
    const s = astaAperta();
    // Bruno, Anna, Bruno, Anna…: per Anna il primo rilancio di Bruno è di un altro, poi ogni suo rilancio è superato.
    const attesi = Array.from({ length: 30 }, (_, i) => (i % 2 === 1 ? 'miaOfferta' : i === 0 ? 'offerta' : 'superato'));
    expect(suoni(s, rilanci(s, 30), 'anna')).toEqual(attesi);
  });

  it('finché nessuno offre, e se l’asta non cambia (il conto alla rovescia ridisegna la pagina), non suona niente', () => {
    const s = astaAperta();
    expect(suonoRilancio(ricordoAsta(null, 'anna'), ricordoAsta(s.asta, 'anna'), 'anna')).toBeNull();
    const [dopo] = rilanci(s, 1);
    const fermo = ricordoAsta(dopo!.asta, 'anna');
    expect(suonoRilancio(fermo, fermo, 'anna')).toBeNull();
  });

  it('più rilanci arrivati insieme suonano una volta, «superato» se nel frattempo ho rilanciato anch’io', () => {
    const s = astaAperta();
    // Bruno, Anna, Bruno: arriva solo l'ultimo aggiornamento.
    const ultimo = rilanci(s, 3).at(-1)!;
    expect(suoni(s, [ultimo], 'anna')).toEqual(['superato']);
    expect(suoni(s, [ultimo], 'bruno')).toEqual(['miaOfferta']);
    expect(suoni(s, [ultimo], null)).toEqual(['offerta']);
  });

  it('se l’offerta migliore torna indietro perché chi l’aveva fatta esce dalla partita, non suona niente', () => {
    const s = astaAperta(['anna', 'bruno', 'carla']);
    const [, conCarla] = rilanci(s, 2, ['bruno', 'carla']);
    const uscita = applica(conCarla!, { tipo: 'bancarotta', giocatore: 'carla' }, caso, 1_000);
    if (!uscita.ok) throw new Error(uscita.messaggio);
    expect(uscita.stato.asta?.migliore).toEqual({ giocatore: 'bruno', importo: 2 });
    expect(suoni(conCarla!, [uscita.stato], 'anna')).toEqual([null]);
  });

  it('con un’asta nuova si riparte da zero: il primo rilancio suona anche se è più basso dell’ultimo di prima', () => {
    const vecchia: RicordoAsta = { casella: 1, importo: 300, migliore: 'bruno', mia: 0 };
    const nuova: RicordoAsta = { casella: 3, importo: 2, migliore: 'bruno', mia: 0 };
    expect(suonoRilancio(vecchia, nuova, 'anna')).toBe('offerta');
    // Avere avuto la migliore nell'asta di prima non fa sentire «superato» in quella nuova.
    expect(suonoRilancio({ ...vecchia, migliore: 'anna' }, nuova, 'anna')).toBe('offerta');
  });
});
