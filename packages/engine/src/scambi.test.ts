/* Scambi tra giocatori: docs/analisi/04-economia-fine-partita.md §4. */

import { describe, expect, it } from 'vitest';
import { assegna, esegui, g, partitaDiProva, problemi } from './prove';
import { PROPOSTE_IN_ATTESA_MAX, problemiScambio, SCAMBI_APERTI_MAX } from './scambi';
import { verifica } from './regole';
import type { Azione, IdGiocatore, Impostazioni, Pacchetto, Stato } from './tipi';

const SIENA = 11;
const PISA = 13;
const FIRENZE = 14;
const ROMA = 34;
const STAZIONE_NORD = 5;

function pacchetto(p: Partial<Pacchetto> = {}): Pacchetto {
  return { soldi: 0, caselle: [], grazie: [], ...p };
}

function proposta(
  da: IdGiocatore,
  a: IdGiocatore,
  dare: Partial<Pacchetto>,
  avere: Partial<Pacchetto>,
  altro: { nota?: string; sostituisce?: number } = {},
): Azione {
  return { tipo: 'proponi', giocatore: da, a, dare: pacchetto(dare), avere: pacchetto(avere), nota: altro.nota ?? '', ...altro };
}

function codice(s: Stato, a: Azione): string | undefined {
  return verifica(s, a)?.codice;
}

function messaggio(s: Stato, a: Azione): string | undefined {
  return verifica(s, a)?.messaggio;
}

/** 'a' ha Siena, 'b' ha Pisa; tocca ad 'a'. */
function partita(n = 2, impostazioni: Partial<Impostazioni> = {}): Stato {
  return assegna(assegna(partitaDiProva(n, impostazioni), 'a', SIENA), 'b', PISA);
}

describe('proporre e rispondere', () => {
  it('si propone anche fuori turno e chi riceve può accettare', () => {
    const s0 = partita();
    expect(s0.turno.giocatore).toBe('a');
    const proposto = esegui(s0, proposta('b', 'a', { caselle: [PISA] }, { caselle: [SIENA], soldi: 30 }, { nota: '  Affare?  ' }));
    expect(proposto.eventi).toEqual([{ tipo: 'scambio_proposto', scambio: 1, da: 'b', a: 'a', trattativa: 0 }]);
    const s1 = proposto.stato;
    expect(s1.scambi).toEqual([
      {
        id: 1,
        da: 'b',
        a: 'a',
        dare: pacchetto({ caselle: [PISA] }),
        avere: pacchetto({ caselle: [SIENA], soldi: 30 }),
        nota: 'Affare?',
        trattativa: 0,
        ipotecate: [],
      },
    ]);

    expect(codice(s1, { tipo: 'accetta', giocatore: 'b', scambio: 1 })).toBe('non_tuo_scambio');
    const accettato = esegui(s1, { tipo: 'accetta', giocatore: 'a', scambio: 1 });
    const s2 = accettato.stato;
    expect(accettato.eventi[0]).toMatchObject({ tipo: 'scambio_accettato', scambio: 1, da: 'b', a: 'a' });
    expect(s2.scambi).toEqual([]);
    expect(s2.proprieta[PISA]!.proprietario).toBe('a');
    expect(s2.proprieta[SIENA]!.proprietario).toBe('b');
    expect(g(s2, 'a').saldo).toBe(1470);
    expect(g(s2, 'b').saldo).toBe(1530);
    expect(problemi(s2)).toEqual([]);
  });

  it('chi riceve può rifiutare, chi propone può ritirare', () => {
    const s = esegui(partita(), proposta('a', 'b', { soldi: 10 }, { caselle: [PISA] })).stato;
    expect(codice(s, { tipo: 'rifiuta', giocatore: 'a', scambio: 1 })).toBe('non_tuo_scambio');
    expect(codice(s, { tipo: 'annulla', giocatore: 'b', scambio: 1 })).toBe('non_tuo_scambio');
    const rifiutato = esegui(s, { tipo: 'rifiuta', giocatore: 'b', scambio: 1 });
    expect(rifiutato.eventi).toEqual([{ tipo: 'scambio_rifiutato', scambio: 1, da: 'a', a: 'b' }]);
    expect(rifiutato.stato.scambi).toEqual([]);
    const ritirato = esegui(s, { tipo: 'annulla', giocatore: 'a', scambio: 1 });
    expect(ritirato.eventi).toEqual([{ tipo: 'scambio_annullato', scambio: 1, da: 'a', a: 'b' }]);
    expect(codice(ritirato.stato, { tipo: 'accetta', giocatore: 'b', scambio: 1 })).toBe('scambio_inesistente');
  });

  it('la controproposta sostituisce lo scambio e conta le trattative', () => {
    let s = esegui(partita(3), proposta('a', 'b', { soldi: 10 }, { caselle: [PISA] })).stato;
    expect(codice(s, proposta('c', 'a', { soldi: 1 }, {}, { sostituisce: 1 }))).toBe('non_tuo_scambio');
    expect(codice(s, proposta('b', 'c', { soldi: 1 }, {}, { sostituisce: 1 }))).toBe('scambio_non_valido');
    const contro = esegui(s, proposta('b', 'a', { caselle: [PISA] }, { soldi: 100 }, { sostituisce: 1 }));
    expect(contro.eventi).toEqual([{ tipo: 'scambio_proposto', scambio: 2, da: 'b', a: 'a', trattativa: 1 }]);
    s = contro.stato;
    expect(s.scambi.map((x) => [x.id, x.da, x.a, x.trattativa])).toEqual([[2, 'b', 'a', 1]]);
    s = esegui(s, proposta('a', 'b', { soldi: 50 }, { caselle: [PISA] }, { sostituisce: 2 })).stato;
    expect(s.scambi.map((x) => [x.id, x.trattativa])).toEqual([[3, 2]]);
  });

  it('passano anche le Carte Grazia e le proprietà ipotecate, che restano ipotecate', () => {
    const s = partita(2, { ipoteche: true });
    g(s, 'a').carteGrazia = ['busta'];
    s.proprieta[SIENA]!.ipotecata = true;
    let t = esegui(s, proposta('a', 'b', { caselle: [SIENA], grazie: ['busta'] }, { soldi: 80 })).stato;
    expect(t.scambi[0]!.ipotecate).toEqual([SIENA]);
    t = esegui(t, { tipo: 'accetta', giocatore: 'b', scambio: 1 }).stato;
    expect(t.proprieta[SIENA]).toEqual({ proprietario: 'b', livello: 0, ipotecata: true });
    expect(g(t, 'b').carteGrazia).toEqual(['busta']);
    expect(g(t, 'a').carteGrazia).toEqual([]);
  });

  it('i soldi ricevuti da chi è in debito vanno prima al creditore', () => {
    const s = partita(3);
    g(s, 'a').saldo = -40;
    g(s, 'a').debiti = [{ creditore: 'c', importo: 40 }];
    let t = esegui(s, proposta('a', 'b', { caselle: [SIENA] }, { soldi: 100 })).stato;
    t = esegui(t, { tipo: 'accetta', giocatore: 'b', scambio: 1 }).stato;
    expect(g(t, 'a')).toMatchObject({ saldo: 60, debiti: [] });
    expect(g(t, 'c').saldo).toBe(1540);
  });
});

describe('validità', () => {
  it('scambi vuoti, con sé stessi o con chi è fuori non si fanno', () => {
    const s = partita(3);
    expect(messaggio(s, proposta('a', 'b', {}, {}))).toBe('Lo scambio è vuoto.');
    expect(codice(s, proposta('a', 'a', { soldi: 1 }, {}))).toBe('scambio_non_valido');
    const t = esegui(s, { tipo: 'bancarotta', giocatore: 'c' }).stato;
    expect(messaggio(t, proposta('a', 'c', { soldi: 1 }, {}))).toMatch(/non partecipa più/);
    expect(codice(t, proposta('c', 'a', { soldi: 1 }, {}))).toBe('eliminato');
  });

  it('servono i soldi e le proprietà offerte', () => {
    const s = partita();
    expect(messaggio(s, proposta('a', 'b', { soldi: 1501 }, {}))).toMatch(/Anna non ha abbastanza soldi/);
    expect(messaggio(s, proposta('a', 'b', { caselle: [PISA] }, {}))).toMatch(/Anna non possiede più/);
    expect(messaggio(s, proposta('a', 'b', { caselle: [2] }, {}))).toMatch(/non si possono scambiare/);
    expect(messaggio(s, proposta('a', 'b', { grazie: ['cartolina'] }, {}))).toMatch(/Carta Grazia/);
    expect(messaggio(s, proposta('a', 'b', { soldi: -5 }, { caselle: [PISA] }))).toMatch(/cifra non valida/);
  });

  it('chi è in negativo non può offrire soldi', () => {
    const s = partita();
    g(s, 'a').saldo = -10;
    expect(messaggio(s, proposta('a', 'b', { soldi: 5 }, { caselle: [PISA] }))).toMatch(/non ha abbastanza soldi/);
  });

  it('le città di una regione con case non si scambiano', () => {
    const s = assegna(partita(), 'a', PISA, FIRENZE);
    s.proprieta[FIRENZE]!.livello = 1;
    expect(messaggio(s, proposta('a', 'b', { caselle: [SIENA] }, { soldi: 10 }))).toMatch(/case o alberghi/);
  });

  it('uno scambio diventato impossibile non si può più accettare', () => {
    let s = esegui(partita(), proposta('b', 'a', { caselle: [PISA] }, { soldi: 10 })).stato;
    // 'b' vende Pisa alla banca nel suo turno.
    s.turno.giocatore = 'b';
    s = esegui(s, { tipo: 'vendi', giocatore: 'b', casella: PISA }).stato;
    expect(codice(s, { tipo: 'accetta', giocatore: 'a', scambio: 1 })).toBe('scambio_non_valido');
    expect(problemiScambio(s, s.scambi[0]!)).toEqual(['Bruno non possiede più tutte le proprietà scelte.']);
  });

  it('un’ipoteca fatta dopo la proposta rende lo scambio non valido', () => {
    let s = esegui(partita(2, { ipoteche: true }), proposta('b', 'a', { soldi: 50 }, { caselle: [SIENA] })).stato;
    s = esegui(s, { tipo: 'ipoteca', giocatore: 'a', casella: SIENA }).stato;
    expect(messaggio(s, { tipo: 'accetta', giocatore: 'a', scambio: 1 })).toMatch(/ha ipotecato/);
  });

  it('la nota ha al massimo 200 caratteri', () => {
    expect(codice(partita(), proposta('a', 'b', { soldi: 1 }, {}, { nota: 'x'.repeat(201) }))).toBe('scambio_non_valido');
    expect(codice(partita(), proposta('a', 'b', { soldi: 1 }, {}, { nota: 'x'.repeat(200) }))).toBeUndefined();
  });
});

describe('limiti', () => {
  it(`al massimo ${PROPOSTE_IN_ATTESA_MAX} proposte verso lo stesso giocatore e ${SCAMBI_APERTI_MAX} aperte in tutto`, () => {
    let s = partitaDiProva(4);
    for (let i = 0; i < PROPOSTE_IN_ATTESA_MAX; i++) s = esegui(s, proposta('a', 'b', { soldi: 1 }, {})).stato;
    expect(messaggio(s, proposta('a', 'b', { soldi: 1 }, {}))).toMatch(/aspetta che risponda/);
    for (let i = 0; i < SCAMBI_APERTI_MAX - PROPOSTE_IN_ATTESA_MAX; i++) s = esegui(s, proposta('a', 'c', { soldi: 1 }, {})).stato;
    expect(codice(s, proposta('a', 'd', { soldi: 1 }, {}))).toBe('troppi_scambi');
    // Le proposte ricevute non contano, e una controproposta prende il posto di quella vecchia.
    expect(codice(s, proposta('d', 'a', { soldi: 1 }, {}))).toBeUndefined();
    expect(codice(s, proposta('a', 'b', { soldi: 2 }, {}, { sostituisce: 1 }))).toBeUndefined();
  });
});

describe('regole di equità', () => {
  it('chi è in debito non può ridurre quello che potrà restituire', () => {
    const s = assegna(partita(3), 'a', ROMA);
    g(s, 'a').saldo = -100;
    g(s, 'a').debiti = [{ creditore: 'c', importo: 100 }];
    // Regala Roma a 'b': il creditore 'c' perderebbe la garanzia.
    expect(messaggio(s, proposta('a', 'b', { caselle: [ROMA] }, {}))).toMatch(/Anna è in debito/);
    // Vendere a buon prezzo va bene: i soldi vanno al creditore.
    expect(codice(s, proposta('a', 'b', { caselle: [ROMA] }, { soldi: 165 }))).toBeUndefined();
    // Con il proprio creditore si può.
    expect(codice(s, proposta('a', 'c', { caselle: [ROMA] }, {}))).toBeUndefined();
    // Ricevere un regalo va sempre bene.
    expect(codice(s, proposta('b', 'a', { soldi: 30 }, {}))).toBeUndefined();
  });

  it('per la regola del debito conta solo quello che si deve agli altri giocatori, non il rosso verso la banca', () => {
    // 'a' è a −1000: 10 € li deve a 'c', il resto alla banca. Vende Roma (liquidazione 165) a 'b' per 150 €:
    // 'c' incassa subito tutto quello che gli spetta.
    const s = assegna(partita(3), 'a', ROMA);
    g(s, 'a').saldo = -1000;
    g(s, 'a').debiti = [{ creditore: 'c', importo: 10 }];
    const vendita = proposta('a', 'b', { caselle: [ROMA] }, { soldi: 150 });
    expect(codice(s, vendita)).toBeUndefined();
    // Solo rosso verso la banca: nessun creditore da proteggere.
    g(s, 'a').debiti = [];
    expect(codice(s, proposta('a', 'b', { caselle: [ROMA] }, {}))).toBeUndefined();
    // Con 300 € dovuti a 'c' la stessa vendita gli toglie garanzia: prima poteva recuperare 235 € (Siena e Roma),
    // dopo 150 subito più i 70 di Siena.
    g(s, 'a').debiti = [{ creditore: 'c', importo: 300 }];
    expect(messaggio(s, vendita)).toMatch(/Anna è in debito/);
  });

  it('nelle stanze pubbliche non si regala quasi tutto; nelle private sì', () => {
    const pubblica = assegna(partita(2, { stanzaPrivata: false }), 'a', ROMA, STAZIONE_NORD);
    g(pubblica, 'a').saldo = 100;
    const regalo = proposta('a', 'b', { caselle: [SIENA, ROMA, STAZIONE_NORD], soldi: 100 }, {});
    expect(messaggio(pubblica, regalo)).toBe('Questo scambio è troppo sbilanciato.');
    // Un regalo piccolo va bene anche lì.
    expect(codice(pubblica, proposta('a', 'b', { soldi: 50 }, {}))).toBeUndefined();

    const privata = assegna(partita(2, { stanzaPrivata: true }), 'a', ROMA, STAZIONE_NORD);
    g(privata, 'a').saldo = 100;
    expect(codice(privata, regalo)).toBeUndefined();
  });
});

describe('scambi e bancarotta', () => {
  it('gli scambi aperti di chi fallisce spariscono', () => {
    let s = esegui(partita(3), proposta('a', 'b', { soldi: 10 }, {})).stato;
    s = esegui(s, proposta('c', 'a', { soldi: 10 }, {})).stato;
    s = esegui(s, proposta('b', 'c', { soldi: 10 }, {})).stato;
    s = esegui(s, { tipo: 'bancarotta', giocatore: 'b' }).stato;
    expect(s.scambi.map((x) => x.id)).toEqual([2]);
  });
});
