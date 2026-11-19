/* Costruzione di squadra lato server: lettura dell'impostazione, partita vera in una stanza, stanze salvate prima. */

import { describe, expect, it } from 'vitest';
import { leggiImpostazioni } from './lettura';
import { siedi, stanzaDiProva, TOKEN } from './prove';
import { Stanza } from './stanza';

const COURMAYEUR = 1;
const AOSTA = 3;

describe('costruzione di squadra: lettura dell’impostazione', () => {
  it('accetta solo un sì o un no', () => {
    expect(leggiImpostazioni({ costruzioneDiSquadra: true })).toEqual({ costruzioneDiSquadra: true });
    expect(leggiImpostazioni({ squadre: true, costruzioneDiSquadra: false })).toEqual({ squadre: true, costruzioneDiSquadra: false });
    expect(leggiImpostazioni({ costruzioneDiSquadra: 'si' })).toBeNull();
    expect(leggiImpostazioni({ costruzioneDiSquadra: 1 })).toBeNull();
    expect(leggiImpostazioni({ costruzioneDiSquadra: null })).toBeNull();
  });
});

/**
 * Quattro persone; accendendo le squadre si dividono così: Anna e Carla nella squadra 0, Bruno e Dario nella 1.
 * Turni alternati tra le squadre: Anna, Bruno, Carla, Dario. Anna (l'host) ha Courmayeur, Carla Aosta.
 */
function partitaASquadre(costruzioneDiSquadra: boolean) {
  const { stanza, amb } = stanzaDiProva({ ordineCasuale: false });
  const [anna, , carla] = siedi(stanza, 'anna', 'bruno', 'carla', 'dario');
  expect(stanza.cambiaImpostazioni(TOKEN.anna, { squadre: true, costruzioneDiSquadra })).toEqual({ ok: true, dati: null });
  expect(stanza.avvia(TOKEN.anna).ok).toBe(true);
  expect(stanza.pannello({ tipo: 'proprieta', casella: COURMAYEUR, proprietario: anna!, livello: 0, ipotecata: false })).toBeNull();
  expect(stanza.pannello({ tipo: 'proprieta', casella: AOSTA, proprietario: carla!, livello: 0, ipotecata: false })).toBeNull();
  return { stanza, amb, anna: anna!, carla: carla! };
}

describe('costruzione di squadra in una stanza', () => {
  it('con la regola Anna costruisce sulla città di Carla e paga lei', () => {
    const { stanza, anna, carla } = partitaASquadre(true);
    const partita = stanza.partita!;
    expect(partita.impostazioni.costruzioneDiSquadra).toBe(true);
    expect(partita.turno.giocatore).toBe(anna);
    const saldo = (id: string) => stanza.partita!.giocatori.find((g) => g.id === id)!.saldo;
    const prima = { anna: saldo(anna), carla: saldo(carla) };
    expect(stanza.mossa(TOKEN.anna, { tipo: 'costruisci', casella: AOSTA })).toEqual({ ok: true, dati: null });
    expect(stanza.partita!.proprieta[AOSTA]).toEqual({ proprietario: carla, livello: 1, ipotecata: false });
    expect(saldo(anna)).toBe(prima.anna - 50);
    expect(saldo(carla)).toBe(prima.carla);
    expect(stanza.registro.at(-1)?.evento).toEqual({ tipo: 'costruzione', giocatore: anna, casella: AOSTA, livello: 1, costo: 50, proprietario: carla });
  });

  it('senza la regola la città della compagna resta sua', () => {
    const { stanza } = partitaASquadre(false);
    expect(stanza.mossa(TOKEN.anna, { tipo: 'costruisci', casella: AOSTA })).toMatchObject({ ok: false, codice: 'non_tua' });
    expect(stanza.mossa(TOKEN.anna, { tipo: 'costruisci', casella: COURMAYEUR }).ok).toBe(true);
  });

  it('le stanze e le partite salvate prima della regola riprendono con la regola spenta', () => {
    const { stanza, amb } = partitaASquadre(true);
    const dati = JSON.parse(JSON.stringify(stanza.esporta())) as ReturnType<Stanza['esporta']>;
    delete (dati.impostazioni as Partial<typeof dati.impostazioni>).costruzioneDiSquadra;
    delete (dati.partita!.impostazioni as Partial<typeof dati.impostazioni>).costruzioneDiSquadra;
    const copia = Stanza.importa(dati, amb);
    expect(copia.impostazioni.costruzioneDiSquadra).toBe(false);
    expect(copia.partita!.impostazioni.costruzioneDiSquadra).toBe(false);
    copia.collega('nuova', TOKEN.anna);
    expect(copia.mossa(TOKEN.anna, { tipo: 'costruisci', casella: AOSTA })).toMatchObject({ ok: false, codice: 'non_tua' });
  });
});
