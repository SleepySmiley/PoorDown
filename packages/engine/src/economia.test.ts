/* Case e alberghi, ipoteche e aste: docs/analisi/04-economia-fine-partita.md §3, §5, §6. */

import { describe, expect, it } from 'vitest';
import { ASTA_MS } from './economia';
import { assegna, dadi, esegui, g, partitaDiProva, problemi } from './prove';
import { applica, applicaScadenze, verifica } from './regole';
import type { Azione, Impostazioni, Stato } from './tipi';

/* Toscana (regione 2): Siena 11 (140 €), Pisa 13, Firenze 14. Case e alberghi a 100 €. */
const SIENA = 11;
const PISA = 13;
const FIRENZE = 14;
const TOSCANA = [SIENA, PISA, FIRENZE];
const STAZIONE_NORD = 5;
const STAZIONE_EST = 15;

const azione = (tipo: 'costruisci' | 'demolisci' | 'ipoteca' | 'riscatta' | 'vendi', casella: number, giocatore = 'a'): Azione => ({
  tipo,
  giocatore,
  casella,
});

function codice(s: Stato, a: Azione): string | undefined {
  return verifica(s, a)?.codice;
}

/** Partita a due con la Toscana intera di 'a'. */
function conToscana(impostazioni: Partial<Impostazioni> = {}): Stato {
  return assegna(partitaDiProva(2, impostazioni), 'a', ...TOSCANA);
}

function costruisciTante(s: Stato, ...caselle: number[]): Stato {
  for (const n of caselle) s = esegui(s, azione('costruisci', n)).stato;
  return s;
}

describe('case e alberghi', () => {
  it('si costruisce solo con tutta la regione, nel proprio turno, anche prima di tirare', () => {
    const s = assegna(partitaDiProva(), 'a', SIENA, PISA);
    expect(codice(s, azione('costruisci', SIENA))).toBe('regione_incompleta');
    assegna(s, 'a', FIRENZE);
    expect(s.turno.fase).toBe('lancio');
    const { stato, eventi } = esegui(s, azione('costruisci', SIENA));
    expect(stato.proprieta[SIENA]!.livello).toBe(1);
    expect(g(stato, 'a').saldo).toBe(1500 - 100);
    expect(eventi).toEqual([{ tipo: 'costruzione', giocatore: 'a', casella: SIENA, livello: 1, costo: 100 }]);
    expect(codice(assegna(partitaDiProva(), 'b', ...TOSCANA), azione('costruisci', SIENA, 'b'))).toBe('non_tuo_turno');
  });

  it('non si costruisce su stazioni e servizi né sulle proprietà degli altri', () => {
    const s = assegna(conToscana(), 'a', STAZIONE_NORD);
    expect(codice(s, azione('costruisci', STAZIONE_NORD))).toBe('non_costruibile');
    assegna(s, 'b', FIRENZE);
    expect(codice(s, azione('costruisci', FIRENZE))).toBe('non_tua');
  });

  it('con la costruzione uniforme le città della regione salgono insieme', () => {
    let s = costruisciTante(conToscana(), SIENA);
    expect(codice(s, azione('costruisci', SIENA))).toBe('costruzione_uniforme');
    s = costruisciTante(s, PISA, FIRENZE, SIENA);
    expect(TOSCANA.map((n) => s.proprieta[n]!.livello)).toEqual([2, 1, 1]);
    // Si vende dalla città più alta.
    expect(codice(s, azione('demolisci', PISA))).toBe('costruzione_uniforme');
    expect(codice(s, azione('demolisci', SIENA))).toBeUndefined();
  });

  it('senza costruzione uniforme si costruisce dove si vuole', () => {
    const s = costruisciTante(conToscana({ costruzioneUniforme: false }), SIENA, SIENA, SIENA);
    expect(s.proprieta[SIENA]!.livello).toBe(3);
    expect(codice(s, azione('demolisci', PISA))).toBe('livello_minimo');
  });

  it('l’albergo va sopra quattro case e torna a quattro case quando si vende', () => {
    let s = conToscana({ costruzioneUniforme: false, soldiIniziali: 3000 });
    s = costruisciTante(s, SIENA, SIENA, SIENA, SIENA);
    const albergo = esegui(s, azione('costruisci', SIENA));
    expect(albergo.eventi).toEqual([{ tipo: 'costruzione', giocatore: 'a', casella: SIENA, livello: 5, costo: 100 }]);
    s = albergo.stato;
    expect(codice(s, azione('costruisci', SIENA))).toBe('livello_massimo');
    const venduto = esegui(s, azione('demolisci', SIENA));
    expect(venduto.stato.proprieta[SIENA]!.livello).toBe(4);
    expect(venduto.eventi).toEqual([{ tipo: 'demolizione', giocatore: 'a', casella: SIENA, livello: 4, importo: 50 }]);
    expect(g(venduto.stato, 'a').saldo).toBe(3000 - 500 + 50);
  });

  it('servono i soldi per costruire', () => {
    const s = conToscana();
    g(s, 'a').saldo = 99;
    expect(codice(s, azione('costruisci', SIENA))).toBe('soldi_insufficienti');
  });

  it('l’affitto segue il numero di case', () => {
    let s = costruisciTante(conToscana(), SIENA, PISA, FIRENZE, SIENA);
    s = esegui(s, { tipo: 'lancia', giocatore: 'a' }, dadi([1, 2])).stato;
    s = esegui(s, { tipo: 'fine_turno', giocatore: 'a' }).stato;
    g(s, 'b').posizione = 5;
    const { stato, eventi } = esegui(s, { tipo: 'lancia', giocatore: 'b' }, dadi([2, 4]));
    expect(eventi).toContainEqual({ tipo: 'affitto', da: 'b', a: 'a', casella: SIENA, importo: 110 });
    expect(g(stato, 'b').saldo).toBe(1500 - 110);
  });

  it('chi è in debito può vendere le case: il ricavato va prima al creditore', () => {
    const s = costruisciTante(conToscana(), SIENA);
    g(s, 'a').saldo = -20;
    g(s, 'a').debiti = [{ creditore: 'b', importo: 20 }];
    const { stato } = esegui(s, azione('demolisci', SIENA));
    expect(g(stato, 'a')).toMatchObject({ saldo: 30, debiti: [] });
    expect(g(stato, 'b').saldo).toBe(1520);
  });
});

describe('ipoteche', () => {
  it('senza la regola non si ipoteca', () => {
    expect(codice(conToscana(), azione('ipoteca', SIENA))).toBe('ipoteche_disattivate');
  });

  it('l’ipoteca dà metà del prezzo e toglie l’affitto; il riscatto costa il 110%', () => {
    let s = conToscana({ ipoteche: true });
    const ipotecata = esegui(s, azione('ipoteca', SIENA));
    expect(ipotecata.eventi).toEqual([{ tipo: 'ipoteca', giocatore: 'a', casella: SIENA, importo: 70 }]);
    s = ipotecata.stato;
    expect(s.proprieta[SIENA]!.ipotecata).toBe(true);
    expect(g(s, 'a').saldo).toBe(1570);
    expect(codice(s, azione('ipoteca', SIENA))).toBe('gia_ipotecata');
    // Nella regione con una città ipotecata non si costruisce.
    expect(codice(s, azione('costruisci', PISA))).toBe('regione_ipotecata');

    // Chi si ferma non paga.
    s = esegui(s, { tipo: 'lancia', giocatore: 'a' }, dadi([1, 2])).stato;
    s = esegui(s, { tipo: 'fine_turno', giocatore: 'a' }).stato;
    g(s, 'b').posizione = 5;
    const fermata = esegui(s, { tipo: 'lancia', giocatore: 'b' }, dadi([2, 4]));
    expect(fermata.eventi.some((e) => e.tipo === 'affitto')).toBe(false);

    // Il riscatto nel turno successivo di 'a'.
    s = esegui(fermata.stato, { tipo: 'fine_turno', giocatore: 'b' }).stato;
    g(s, 'a').saldo = 76;
    expect(codice(s, azione('riscatta', SIENA))).toBe('soldi_insufficienti');
    g(s, 'a').saldo = 100;
    const riscattata = esegui(s, azione('riscatta', SIENA));
    expect(riscattata.eventi).toEqual([{ tipo: 'riscatto', giocatore: 'a', casella: SIENA, importo: 77 }]);
    expect(riscattata.stato.proprieta[SIENA]!.ipotecata).toBe(false);
    expect(g(riscattata.stato, 'a').saldo).toBe(23);
    expect(codice(riscattata.stato, azione('riscatta', SIENA))).toBe('non_ipotecata');
  });

  it('non si ipoteca in una regione con edifici', () => {
    const s = costruisciTante(conToscana({ ipoteche: true }), SIENA);
    expect(codice(s, azione('ipoteca', PISA))).toBe('edifici_nella_regione');
  });

  it('le stazioni ipotecate non contano per l’affitto delle altre', () => {
    let s = assegna(partitaDiProva(2, { ipoteche: true }), 'a', STAZIONE_NORD, STAZIONE_EST);
    s = esegui(s, azione('ipoteca', STAZIONE_NORD)).stato;
    s = esegui(s, { tipo: 'lancia', giocatore: 'a' }, dadi([1, 2])).stato;
    s = esegui(s, { tipo: 'fine_turno', giocatore: 'a' }).stato;
    g(s, 'b').posizione = 10;
    const { eventi } = esegui(s, { tipo: 'lancia', giocatore: 'b' }, dadi([2, 3]));
    expect(eventi).toContainEqual({ tipo: 'affitto', da: 'b', a: 'a', casella: STAZIONE_EST, importo: 25 });
  });

  it('vendendo una proprietà ipotecata non si incassa niente e torna libera', () => {
    const s = esegui(conToscana({ ipoteche: true }), azione('ipoteca', SIENA)).stato;
    const { stato, eventi } = esegui(s, azione('vendi', SIENA));
    expect(eventi).toEqual([{ tipo: 'vendita', giocatore: 'a', casella: SIENA, importo: 0 }]);
    expect(stato.proprieta[SIENA]).toEqual({ proprietario: null, livello: 0, ipotecata: false });
  });
});

describe('aste', () => {
  const T0 = 1_000_000;

  /** 'a' si ferma su Siena (libera): tocca a lui decidere. */
  function suSiena(impostazioni: Partial<Impostazioni> = {}, tiro: [number, number] = [5, 6]): Stato {
    return esegui(partitaDiProva(3, { aste: true, ...impostazioni }), { tipo: 'lancia', giocatore: 'a' }, dadi(tiro)).stato;
  }

  it('senza aste si può lasciare la proprietà e finire il turno', () => {
    const s = esegui(partitaDiProva(), { tipo: 'lancia', giocatore: 'a' }, dadi([5, 6])).stato;
    expect(codice(s, { tipo: 'asta', giocatore: 'a' })).toBe('aste_disattivate');
    expect(codice(s, { tipo: 'fine_turno', giocatore: 'a' })).toBeUndefined();
  });

  it('con le aste bisogna comprare o mettere all’asta prima di proseguire', () => {
    const s = suSiena();
    expect(codice(s, { tipo: 'fine_turno', giocatore: 'a' })).toBe('decidi_acquisto');
    expect(codice(s, { tipo: 'compra', giocatore: 'a' })).toBeUndefined();
    expect(codice(s, { tipo: 'asta', giocatore: 'a' })).toBeUndefined();
    expect(codice(s, { tipo: 'asta', giocatore: 'b' })).toBe('non_tuo_turno');
  });

  it('dopo un doppio su una proprietà libera si decide prima di tirare ancora', () => {
    const s = esegui(partitaDiProva(2, { aste: true }), { tipo: 'lancia', giocatore: 'a' }, dadi([3, 3])).stato;
    expect(s.turno).toMatchObject({ acquisto: 6, rilancio: true });
    expect(codice(s, { tipo: 'lancia', giocatore: 'a' })).toBe('decidi_acquisto');
  });

  it('l’asta dura 10 secondi, ogni offerta la riporta a 10 e vince l’offerta più alta', () => {
    let s = suSiena();
    const aperta = esegui(s, { tipo: 'asta', giocatore: 'a' }, dadi(), T0);
    expect(aperta.eventi).toEqual([{ tipo: 'asta', giocatore: 'a', casella: SIENA }]);
    s = aperta.stato;
    expect(s.asta).toMatchObject({ casella: SIENA, migliore: null, scadenza: T0 + ASTA_MS });
    expect(s.turno.acquisto).toBeNull();
    // Durante l'asta il turno è fermo.
    expect(codice(s, { tipo: 'fine_turno', giocatore: 'a' })).toBe('asta_in_corso');

    s = esegui(s, { tipo: 'offri', giocatore: 'b', importo: 2 }, dadi(), T0 + 4_000).stato;
    expect(s.asta!.scadenza).toBe(T0 + 4_000 + ASTA_MS);
    expect(codice(s, { tipo: 'offri', giocatore: 'b', importo: 12 })).toBe('offerta_tua');
    s = esegui(s, { tipo: 'offri', giocatore: 'c', importo: 12 }, dadi(), T0 + 5_000).stato;
    expect(codice(s, { tipo: 'offri', giocatore: 'a', importo: 12 })).toBe('offerta_bassa');
    g(s, 'a').saldo = 50;
    expect(codice(s, { tipo: 'offri', giocatore: 'a', importo: 112 })).toBe('soldi_insufficienti');
    g(s, 'a').saldo = 1500;
    s = esegui(s, { tipo: 'offri', giocatore: 'a', importo: 22 }, dadi(), T0 + 6_000).stato;
    expect(s.asta!.offerte.map((o) => o.importo)).toEqual([22, 12, 2]);

    expect(applicaScadenze(s, dadi(), T0 + 6_000 + ASTA_MS - 1)).toBeNull();
    const chiusa = applicaScadenze(s, dadi(), T0 + 6_000 + ASTA_MS)!;
    expect(chiusa.ok).toBe(true);
    if (!chiusa.ok) return;
    expect(chiusa.eventi).toEqual([{ tipo: 'asta_vinta', giocatore: 'a', casella: SIENA, importo: 22 }]);
    expect(chiusa.stato.asta).toBeNull();
    expect(chiusa.stato.proprieta[SIENA]!.proprietario).toBe('a');
    expect(g(chiusa.stato, 'a').saldo).toBe(1478);
    expect(codice(chiusa.stato, { tipo: 'fine_turno', giocatore: 'a' })).toBeUndefined();
    expect(problemi(chiusa.stato)).toEqual([]);
  });

  it('senza offerte la proprietà resta alla banca', () => {
    const s = esegui(suSiena(), { tipo: 'asta', giocatore: 'a' }, dadi(), T0).stato;
    const chiusa = applicaScadenze(s, dadi(), T0 + ASTA_MS)!;
    if (!chiusa.ok) throw new Error('attesa la chiusura');
    expect(chiusa.eventi).toEqual([{ tipo: 'asta_deserta', casella: SIENA, offerente: null }]);
    expect(chiusa.stato.proprieta[SIENA]!.proprietario).toBeNull();
  });

  it('se chi vince non ha più i soldi, la proprietà resta alla banca', () => {
    let s = esegui(suSiena(), { tipo: 'asta', giocatore: 'a' }, dadi(), T0).stato;
    s = esegui(s, { tipo: 'offri', giocatore: 'b', importo: 100 }, dadi(), T0).stato;
    g(s, 'b').saldo = 40;
    const chiusa = applicaScadenze(s, dadi(), T0 + ASTA_MS)!;
    if (!chiusa.ok) throw new Error('attesa la chiusura');
    expect(chiusa.eventi).toEqual([{ tipo: 'asta_deserta', casella: SIENA, offerente: 'b' }]);
  });

  it('se il migliore offerente fallisce, torna buona l’offerta precedente', () => {
    let s = esegui(suSiena(), { tipo: 'asta', giocatore: 'a' }, dadi(), T0).stato;
    s = esegui(s, { tipo: 'offri', giocatore: 'c', importo: 10 }, dadi(), T0).stato;
    s = esegui(s, { tipo: 'offri', giocatore: 'b', importo: 20 }, dadi(), T0).stato;
    s = esegui(s, { tipo: 'bancarotta', giocatore: 'b' }).stato;
    expect(s.asta!.migliore).toEqual({ giocatore: 'c', importo: 10 });
    expect(codice(s, { tipo: 'offri', giocatore: 'b', importo: 30 })).toBe('eliminato');
  });

  it('chi non è in gioco non offre e senza asta non si offre', () => {
    expect(codice(suSiena(), { tipo: 'offri', giocatore: 'b', importo: 2 })).toBe('niente_asta');
    expect(applica(suSiena(), { tipo: 'offri', giocatore: 'zz', importo: 2 }, dadi()).ok).toBe(false);
  });
});
