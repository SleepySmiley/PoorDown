import { describe, expect, it } from 'vitest';
import { mossaBot } from './bot';
import { caselleDellaRegione } from './conti';
import { descrivi } from './descrivi';
import { assegna, dadi, esegui, g, partitaASquadre, partitaDiProva, primaCarta, problemi } from './prove';
import { applica, applicaScadenze, verifica } from './regole';
import { TABELLONI } from './tabelloni';
import { GIRO_DEL_MONDO } from './tabelloni/giro-del-mondo';
import { vistaPartita } from './vista';
import { biglietto, MORRA_MS, SCELTA_MS } from './viaggi';
import type { Azione, Caso, Stato } from './tipi';

/*
 * Il Giro del mondo: il tabellone, il biglietto aereo, la sfida a morra cinese e le tre caselle strane.
 * Caselle usate: Å (3), Italy (5, Stati Uniti), Aeroporto di Barra (6), Cartolina (8), Batman (9), Triangolo delle
 * Bermuda (11), Prigione (12), Adattatore universale (15), Lukla (18), Cambio di data (21), Moose Jaw (28),
 * Buca per gli antipodi (33), Vai in prigione (36), Ushuaia (47).
 */

const MONDO = { mappa: 'giro_del_mondo' } as const;
const tab = GIRO_DEL_MONDO;

/** Partita sul Giro del mondo; di solito tutti hanno già il passaporto, per volare subito. */
function partita(n = 2, passaporti = true): Stato {
  const s = partitaDiProva(n, MONDO);
  if (passaporti) for (const x of s.giocatori) x.passaporto = true;
  return s;
}

/** Caso che restituisce i valori in ordine, qualunque sia il massimo chiesto (per i dadi: il valore meno uno). */
function caso(...valori: number[]): Caso {
  return {
    intero(n) {
      const v = valori.shift();
      if (v === undefined) throw new Error('Il test ha chiesto più numeri a caso di quelli previsti.');
      if (v >= n) throw new Error(`Valore ${v} fuori da 0–${n - 1}.`);
      return v;
    },
  };
}

const vola = (casella: number, giocatore = 'a'): Azione => ({ tipo: 'vola', giocatore, casella });
const lancia: Azione = { tipo: 'lancia', giocatore: 'a' };
const indice = (nome: string) => tab.caselle.findIndex((c) => c.nome === nome);

describe('Giro del mondo: il tabellone', () => {
  it('48 caselle, 11 paesi da 1 a 4 città, le tre caselle strane', () => {
    expect(tab.caselle).toHaveLength(48);
    expect(tab.regioni.map((_, r) => caselleDellaRegione(tab, r).length)).toEqual([1, 3, 3, 4, 3, 1, 2, 2, 2, 1, 1]);
    for (const tipo of ['bermuda', 'cambio_data', 'antipodi']) expect(tab.caselle.filter((c) => c.tipo === tipo)).toHaveLength(1);
    expect(tab.caselle.filter((c) => c.tipo === 'stazione').map((c) => c.breve)).toEqual(['Barra', 'Lukla', 'Gibilterra', 'Saba']);
  });

  it('i paesi sono sparpagliati: gli Stati Uniti uno per lato, la Bolivia da una parte all’altra', () => {
    const lati = (r: number) => new Set(caselleDellaRegione(tab, r).map((i) => Math.floor(i / 12)));
    const regione = (nome: string) => tab.regioni.findIndex((r) => r.nome === nome);
    expect([...lati(regione('Stati Uniti'))].sort()).toEqual([0, 1, 2, 3]);
    const [sucre, laPaz] = caselleDellaRegione(tab, regione('Bolivia'));
    expect(laPaz! - sucre!).toBe(24);
    // Ogni paese con più di una città ne ha su almeno due lati.
    tab.regioni.forEach((_, r) => {
      if (caselleDellaRegione(tab, r).length > 1) expect(lati(r).size).toBeGreaterThan(1);
    });
  });

  it('i prezzi assurdi: Å 1 €, Bangkok un euro a lettera, Hell 666 €, Yaren 10 €', () => {
    const prezzo = (i: number) => (tab.caselle[i] as { prezzo: number }).prezzo;
    expect(prezzo(indice('Å'))).toBe(1);
    expect(prezzo(indice('Hell'))).toBe(666);
    expect(prezzo(indice('Yaren'))).toBe(10);
    const bangkok = tab.caselle.find((c) => c.breve === 'Bangkok')!;
    expect(prezzo(tab.caselle.indexOf(bangkok))).toBe(bangkok.nome.replace(/ /g, '').length);
    expect(prezzo(tab.caselle.indexOf(bangkok))).toBe(168);
  });

  it('la Buca per l’altra parte del mondo sbuca a Batman, e le Cartoline portano dove dicono', () => {
    expect((indice('Buca per l’altra parte del mondo') + 24) % 48).toBe(indice('Batman'));
    expect(tab.mazzi.cartolina.filter((c) => c.effetto.tipo === 'volo_omaggio')).toHaveLength(1);
  });

  it('solo il Giro del mondo ha voli e sfide', () => {
    expect(Object.values(TABELLONI).filter((t) => t.viaggi).map((t) => t.id)).toEqual(['giro_del_mondo']);
  });
});

describe('il biglietto aereo', () => {
  it('vola dove vuole: paga la fascia alla banca, atterra e può comprare', () => {
    const { stato, eventi } = esegui(partita(), vola(3));
    expect(g(stato, 'a').posizione).toBe(3);
    expect(g(stato, 'a').saldo).toBe(1500 - 50);
    expect(eventi[0]).toEqual({ tipo: 'volo', giocatore: 'a', da: 0, a: 3, prezzo: 50, aeroporto: 6, incassa: null });
    expect(stato.turno.acquisto).toBe(3);
    expect(stato.turno.fase).toBe('dopo_lancio');
    expect(verifica(stato, lancia)?.codice).toBe('gia_lanciato');
    expect(problemi(stato)).toEqual([]);
  });

  it('il prezzo va a fasce di distanza: corto, medio, lungo raggio', () => {
    const s = partita();
    expect(biglietto(s, 'a', 12)!.prezzo).toBe(50);
    expect(biglietto(s, 'a', 13)!.prezzo).toBe(100);
    expect(biglietto(s, 'a', 24)!.prezzo).toBe(100);
    expect(biglietto(s, 'a', 25)!.prezzo).toBe(150);
    expect(biglietto(s, 'a', 47)!.prezzo).toBe(150);
  });

  it('in volo non si passa dalla Partenza', () => {
    const s = partita();
    g(s, 'a').posizione = 40;
    const { stato, eventi } = esegui(s, vola(5));
    expect(g(stato, 'a').posizione).toBe(5);
    expect(eventi.some((e) => e.tipo === 'partenza')).toBe(false);
    expect(g(stato, 'a').saldo).toBe(1500 - 100);
  });

  it('l’aeroporto del lato: se è di un avversario incassa lui, se è proprio si paga metà', () => {
    const s = assegna(partita(), 'b', 6);
    const { stato, eventi } = esegui(s, vola(10));
    expect(eventi[0]).toMatchObject({ tipo: 'volo', prezzo: 50, aeroporto: 6, incassa: 'b' });
    expect(g(stato, 'b').saldo).toBe(1550);
    expect(biglietto(assegna(partita(), 'a', 6), 'a', 30)!.prezzo).toBe(75);
    // Ipotecato non rende: il biglietto va alla banca.
    const ipotecato = assegna(partita(), 'b', 6);
    ipotecato.proprieta[6]!.ipotecata = true;
    expect(biglietto(ipotecato, 'a', 10)!.incassa).toBeNull();
  });

  it('non si atterra sulla Partenza, su Vai in prigione né dove si è già', () => {
    const s = partita();
    g(s, 'a').posizione = 3;
    for (const casella of [0, 36, 3, 48, -1]) expect(verifica(s, vola(casella))?.codice).toBe('meta_non_valida');
  });

  it('non si vola dalla prigione, in rosso, dopo aver tirato, né sugli altri tabelloni', () => {
    const prigione = partita();
    g(prigione, 'a').prigione = 0;
    g(prigione, 'a').posizione = 12;
    prigione.turno.fase = 'prigione';
    expect(verifica(prigione, vola(20))?.codice).toBe('niente_voli');
    const rosso = partita();
    g(rosso, 'a').saldo = -10;
    expect(verifica(rosso, vola(5))?.codice).toBe('saldo_negativo');
    const povero = partita();
    g(povero, 'a').saldo = 40;
    expect(verifica(povero, vola(5))?.codice).toBe('soldi_insufficienti');
    const tirato = esegui(partita(), lancia, dadi([1, 2])).stato;
    expect(verifica(tirato, vola(20))?.codice).toBe('gia_lanciato');
    expect(verifica(partitaDiProva(2), vola(5))?.codice).toBe('niente_voli');
  });

  it('dopo un doppio si può volare invece di tirare ancora, e il volo non è un doppio', () => {
    // Un doppio di 3: si arriva all'Aeroporto di Barra (6), libero.
    const { stato } = esegui(partita(), lancia, dadi([3, 3]));
    expect(stato.turno.rilancio).toBe(true);
    const dopo = esegui(stato, vola(30)).stato;
    expect(dopo.turno.rilancio).toBe(false);
    expect(verifica(dopo, { tipo: 'fine_turno', giocatore: 'a' })).toBeNull();
  });

  it('sui servizi, arrivando in volo, l’affitto conta i dadi come un 7', () => {
    const s = assegna(partita(), 'b', 15);
    const { stato } = esegui(s, vola(15));
    // Con un servizio il moltiplicatore è 8, il doppio degli altri tabelloni.
    expect(stato.sfida).toMatchObject({ casella: 15, importo: 56 });
  });

  it('il passaporto si ritira alla Partenza: prima si gira con i dadi', () => {
    const s = partita(2, false);
    expect(verifica(s, vola(5))?.codice).toBe('niente_voli');
    g(s, 'a').posizione = 44;
    const { stato, eventi } = esegui(s, lancia, dadi([2, 3]));
    expect(eventi).toContainEqual({ tipo: 'passaporto', giocatore: 'a' });
    expect(g(stato, 'a').passaporto).toBe(true);
    expect(descrivi({ tipo: 'passaporto', giocatore: 'a' }, stato)).toBe('Anna ritira il passaporto: da adesso può volare.');
    // Il secondo giro non lo ridà.
    g(stato, 'a').posizione = 44;
    stato.turno = { ...stato.turno, giocatore: 'a', fase: 'lancio', rilancio: false };
    expect(esegui(stato, lancia, dadi([2, 3])).eventi.some((e) => e.tipo === 'passaporto')).toBe(false);
  });

  it('Biglietto omaggio: ci si muove ancora e il volo è gratis', () => {
    const omaggio = tab.mazzi.cartolina.findIndex((c) => c.effetto.tipo === 'volo_omaggio');
    const s = primaCarta(partita(), 'cartolina', omaggio);
    const { stato } = esegui(s, lancia, dadi([3, 5]));
    expect(g(stato, 'a').posizione).toBe(8);
    expect(stato.turno.rilancio).toBe(true);
    expect(biglietto(stato, 'a', 47)!.prezzo).toBe(0);
    const { stato: dopo, eventi } = esegui(stato, vola(47));
    expect(eventi[0]).toMatchObject({ tipo: 'volo', prezzo: 0, incassa: null });
    expect(g(dopo, 'a').saldo).toBe(1500);
    expect(dopo.turno.voloOmaggio).toBeUndefined();
    expect(descrivi(eventi[0]!, dopo)).toBe('Anna usa il Biglietto omaggio e vola a Ushuaia.');
  });

  it('con il Biglietto omaggio arriva anche il passaporto', () => {
    const omaggio = tab.mazzi.cartolina.findIndex((c) => c.effetto.tipo === 'volo_omaggio');
    const { stato, eventi } = esegui(primaCarta(partita(2, false), 'cartolina', omaggio), lancia, dadi([3, 5]));
    expect(eventi).toContainEqual({ tipo: 'passaporto', giocatore: 'a' });
    expect(verifica(stato, vola(47))).toBeNull();
  });
});

describe('la sfida a morra cinese', () => {
  /** 'b' ha Italy (5, 6 € di affitto) e 'a' ci vola sopra: la sfida è aperta, all'ora 1000. */
  function sullaCittaDiBruno(): Stato {
    const s = assegna(partita(3), 'b', 5);
    return esegui(s, vola(5), dadi(), 1000).stato;
  }

  it('sulla proprietà di un avversario non si paga subito: si decide, con l’orologio fermo', () => {
    const s = sullaCittaDiBruno();
    expect(s.sfida).toEqual({
      sfidante: 'a',
      proprietario: 'b',
      casella: 5,
      importo: 6,
      fase: 'scelta',
      segno: null,
      scadenza: 1000 + SCELTA_MS,
    });
    expect(g(s, 'a').saldo).toBe(1450);
    expect(s.turno.tempo.fermoDa).toBe(1000);
    expect(verifica(s, { tipo: 'fine_turno', giocatore: 'a' })?.codice).toBe('sfida_in_corso');
    expect(verifica(s, { tipo: 'morra', giocatore: 'b' })?.codice).toBe('non_tua_sfida');
    expect(verifica(s, { tipo: 'sfida', giocatore: 'c' })?.codice).toBe('non_tua_sfida');
    expect(problemi(s)).toEqual([]);
  });

  it('pagare chiude la sfida e fa ripartire l’orologio', () => {
    const { stato, eventi } = esegui(sullaCittaDiBruno(), { tipo: 'paga_affitto', giocatore: 'a' }, dadi(), 4000);
    expect(eventi).toEqual([{ tipo: 'affitto', da: 'a', a: 'b', casella: 5, importo: 6 }]);
    expect(stato.sfida).toBeNull();
    expect(stato.turno.tempo.fermoDa).toBeNull();
    expect(stato.turno.tempo.inizio).toBe(3000);
    expect(g(stato, 'b').saldo).toBe(1506);
  });

  it.each([
    ['forbici', 'vinta', 0],
    ['carta', 'persa', 12],
    ['sasso', 'pari', 6],
  ] as const)('sasso contro %s: %s, paga %i €', (suo, esito, importo) => {
    const sfidata = esegui(sullaCittaDiBruno(), { tipo: 'sfida', giocatore: 'a', segno: 'sasso' }, dadi(), 2000).stato;
    expect(sfidata.sfida).toMatchObject({ fase: 'morra', segno: 'sasso', scadenza: 2000 + MORRA_MS });
    expect(vistaPartita(sfidata).sfida!.segno).toBeNull();
    expect(verifica(sfidata, { tipo: 'paga_affitto', giocatore: 'a' })?.codice).toBe('non_tua_sfida');
    const { stato, eventi } = esegui(sfidata, { tipo: 'morra', giocatore: 'b', segno: suo }, dadi(), 3000);
    expect(eventi[0]).toEqual({ tipo: 'morra', da: 'a', a: 'b', casella: 5, segni: ['sasso', suo], esito, importo });
    expect(g(stato, 'a').saldo).toBe(1450 - importo);
    expect(g(stato, 'b').saldo).toBe(1500 + importo);
    expect(stato.sfida).toBeNull();
    expect(problemi(stato)).toEqual([]);
  });

  it('allo scadere della scelta si paga; allo scadere della morra il proprietario gioca a caso', () => {
    const pagato = applicaScadenze(sullaCittaDiBruno(), dadi(), 1000 + SCELTA_MS)!;
    expect(pagato.ok && pagato.eventi).toEqual([{ tipo: 'affitto', da: 'a', a: 'b', casella: 5, importo: 6 }]);
    const sfidata = esegui(sullaCittaDiBruno(), { tipo: 'sfida', giocatore: 'a', segno: 'carta' }, dadi(), 2000).stato;
    // A caso esce il secondo segno: carta contro carta, pareggio.
    const scaduta = applicaScadenze(sfidata, caso(1), 2000 + MORRA_MS)!;
    if (!scaduta.ok) throw new Error(scaduta.messaggio);
    expect(scaduta.eventi[0]).toMatchObject({ tipo: 'morra', segni: ['carta', 'carta'], esito: 'pari', importo: 6, aCaso: 'b' });
    expect(descrivi(scaduta.eventi[0]!, scaduta.stato)).toBe(
      'Morra cinese: Anna fa carta, Bruno fa carta. Bruno non sceglie in tempo e gioca a caso. Pareggio: si paga l’affitto normale.',
    );
  });

  it('se uno dei due esce dalla partita, la sfida si chiude e nessuno paga', () => {
    const { stato } = esegui(sullaCittaDiBruno(), { tipo: 'bancarotta', giocatore: 'b' }, dadi(), 5000);
    expect(stato.sfida).toBeNull();
    expect(stato.turno.tempo.fermoDa).toBeNull();
    expect(g(stato, 'a').saldo).toBe(1450);
    expect(problemi(stato)).toEqual([]);
  });

  it('niente sfida tra compagni di squadra, né sulle proprietà ipotecate', () => {
    const squadre = assegna(partitaASquadre([0, 1, 0], MONDO), 'c', 5);
    g(squadre, 'a').passaporto = true;
    expect(esegui(squadre, vola(5)).stato.sfida).toBeNull();
    const ipotecata = assegna(partita(), 'b', 5);
    ipotecata.proprieta[5]!.ipotecata = true;
    expect(esegui(ipotecata, vola(5)).stato.sfida).toBeNull();
  });

  it('il registro racconta la sfida e la vittoria', () => {
    const sfidata = esegui(sullaCittaDiBruno(), { tipo: 'sfida', giocatore: 'a', segno: 'forbici' }, dadi(), 2000);
    expect(descrivi(sfidata.eventi[0]!, sfidata.stato)).toBe('Anna non vuole pagare 6 € per Italy e sfida Bruno a morra cinese.');
    const fine = esegui(sfidata.stato, { tipo: 'morra', giocatore: 'b', segno: 'carta' }, dadi(), 3000);
    expect(descrivi(fine.eventi[0]!, fine.stato)).toBe('Morra cinese: Anna fa forbici, Bruno fa carta. Vince Anna: niente affitto.');
  });
});

describe('le caselle strane', () => {
  it('Triangolo delle Bermuda: si ricompare su una casella a caso, e la casella vale', () => {
    const s = partita();
    g(s, 'a').posizione = 5;
    // Dadi 2 e 4: si arriva al Triangolo (11); poi la meta numero 3 tra le altre 47 caselle, cioè Å.
    const { stato, eventi } = esegui(s, lancia, caso(1, 3, 3));
    expect(eventi).toContainEqual({ tipo: 'bermuda', giocatore: 'a', da: 11, a: 3 });
    expect(g(stato, 'a').posizione).toBe(3);
    expect(stato.turno.acquisto).toBe(3);
  });

  it('Buca per l’altra parte del mondo: si sbuca sul lato opposto, a Batman', () => {
    const s = partita();
    g(s, 'a').posizione = 30;
    const { stato, eventi } = esegui(s, lancia, dadi([1, 2]));
    expect(eventi).toContainEqual({ tipo: 'antipodi', giocatore: 'a', da: 33, a: 9 });
    expect(g(stato, 'a').posizione).toBe(9);
    expect(stato.turno.acquisto).toBe(9);
    expect(eventi.some((e) => e.tipo === 'partenza')).toBe(false);
  });

  it('Linea del cambio di data: si guadagna un giorno e ci si muove ancora', () => {
    const s = partita();
    g(s, 'a').posizione = 18;
    const { stato, eventi } = esegui(s, lancia, dadi([1, 2]));
    expect(eventi).toContainEqual({ tipo: 'cambio_data', giocatore: 'a' });
    expect(stato.turno.rilancio).toBe(true);
    expect(verifica(stato, vola(40))).toBeNull();
  });

  it('in volo la Linea del cambio di data si sorvola e basta: niente giorno in più', () => {
    const { stato, eventi } = esegui(partita(), vola(21));
    expect(eventi.some((e) => e.tipo === 'cambio_data')).toBe(false);
    expect(stato.turno.rilancio).toBe(false);
  });
});

describe('i bot sul Giro del mondo', () => {
  it('il proprietario sfidato risponde, lo sfidante paga gli affitti piccoli e sfida quelli che fanno male', () => {
    const s = assegna(partita(), 'b', 5);
    const aperta = esegui(s, vola(5)).stato;
    expect(mossaBot(aperta, 'a')).toEqual({ tipo: 'paga_affitto', giocatore: 'a' });
    expect(mossaBot(aperta, 'b')).toBeNull();
    aperta.sfida!.importo = 600;
    expect(mossaBot(aperta, 'a')).toEqual({ tipo: 'sfida', giocatore: 'a' });
    const sfidata = esegui(aperta, { tipo: 'sfida', giocatore: 'a' }, caso(0)).stato;
    expect(mossaBot(sfidata, 'b')).toEqual({ tipo: 'morra', giocatore: 'b' });
    expect(mossaBot(sfidata, 'a')).toBeNull();
  });

  it('vola a comprare la città che gli completa un paese', () => {
    // Il Canada: Saint-Louis-du-Ha! Ha! (13) e Flin Flon (20) sono di 'a', manca Moose Jaw (28).
    // Il Vaticano (1) e Ushuaia (47), paesi da una città sola che varrebbero di più, sono già di 'b'.
    const s = assegna(assegna(partita(), 'a', 13, 20), 'b', 1, 47);
    g(s, 'a').posizione = 20;
    expect(mossaBot(s, 'a')).toEqual(vola(28));
  });

  it('senza passaporto tira i dadi; con il passaporto vola a prendersi il Vaticano, un paese intero in una casella', () => {
    expect(mossaBot(partita(2, false), 'a')).toEqual(lancia);
    expect(mossaBot(partita(), 'a')).toEqual(vola(1));
    const povero = partita();
    g(povero, 'a').saldo = 200;
    expect(mossaBot(povero, 'a')).toEqual(lancia);
  });

  it('una partita tra soli bot arriva alla fine, con voli e sfide', () => {
    let s = partitaDiProva(4, { ...MONDO, timerTurno: false });
    let adesso = 0;
    const visti = new Set<string>();
    const random = (() => {
      let x = 12345;
      return { intero: (n: number) => ((x = (x * 1103515245 + 12345) % 2147483648), x % n) };
    })();
    for (let i = 0; i < 30_000 && s.fase === 'in_corso'; i++) {
      adesso += 1000;
      const scaduto = applicaScadenze(s, random, adesso);
      if (scaduto?.ok) s = scaduto.stato;
      const mossa = s.giocatori.map((x) => ({ id: x.id, azione: mossaBot(s, x.id) })).find((m) => m.azione);
      if (!mossa) continue;
      const esito = applica(s, mossa.azione!, random, adesso);
      if (!esito.ok) throw new Error(`${mossa.azione!.tipo}: ${esito.messaggio}`);
      s = esito.stato;
      for (const e of esito.eventi) visti.add(e.tipo);
      expect(problemi(s)).toEqual([]);
    }
    expect(s.fase).toBe('finita');
    for (const tipo of ['volo', 'sfida', 'morra']) expect(visti).toContain(tipo);
  });
});
