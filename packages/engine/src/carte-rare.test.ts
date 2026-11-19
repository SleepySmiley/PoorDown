import { describe, expect, it } from 'vitest';
import { assegna, esegui, g, partitaDiProva, primaCarta, problemi } from './prove';
import { espelli } from './regole';
import { GIRO_DEL_MONDO } from './tabelloni/giro-del-mondo';
import type { Azione, Caso, Effetto, Scambio, Stato } from './tipi';

/*
 * Le carte rare del Giro del mondo: Bancarotta, Vita extra, Reset, e la regola dell'ultimo rimasto.
 * Le caselle usate: Cartolina a 8 (da 5 con i dadi 1 e 2), Vaticano a 1 (paese da una città sola), città a 13.
 * Il caso dà i valori in ordine: prima i dadi (valore meno uno), poi il tiro su 10.000 delle carte rare, poi gli altri.
 */

const MONDO = { mappa: 'giro_del_mondo' } as const;
const tab = GIRO_DEL_MONDO;

function partita(n: number): Stato {
  const s = partitaDiProva(n, MONDO);
  for (const x of s.giocatori) x.passaporto = true;
  return s;
}

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

const lancia = (giocatore = 'a'): Azione => ({ tipo: 'lancia', giocatore });
const fine = (giocatore = 'a'): Azione => ({ tipo: 'fine_turno', giocatore });
/** I dadi 1 e 2: da 5 si arriva sulla Cartolina a 8. */
const SULLA_CARTOLINA = [0, 1];

function rara(tipo: Effetto['tipo']): number {
  const i = tab.rare!.carte.findIndex((r) => r.carta.effetto.tipo === tipo);
  if (i < 0) throw new Error(`Nessuna carta rara ${tipo}.`);
  return i;
}

/** «Vinci la lotteria del duty free»: la Cartolina da 150 €, che non chiede altri numeri a caso. */
const LOTTERIA = tab.mazzi.cartolina.findIndex((c) => c.effetto.tipo === 'soldi' && c.effetto.importo === 150);

/** `a` sta per finire sulla Cartolina; il turno numero `numero` (con 3 giocatori, oltre 6 si è al terzo giro). */
function pronta(n: number, numero: number): Stato {
  const s = partita(n);
  s.turno.numero = numero;
  g(s, 'a').posizione = 5;
  return primaCarta(s, 'cartolina', LOTTERIA);
}

function scambio(id: number, caselle: number[]): Scambio {
  return {
    id,
    da: 'a',
    a: 'b',
    dare: { soldi: 0, caselle, grazie: [] },
    avere: { soldi: 50, caselle: [], grazie: [] },
    nota: '',
    trattativa: 0,
    ipotecate: [],
  };
}

describe('carte rare del Giro del mondo', () => {
  it('ci sono solo sul Giro del mondo', () => {
    expect(tab.rare!.carte.map((r) => r.carta.effetto.tipo)).toEqual(['bancarotta', 'vita_extra', 'reset']);
    expect(tab.rare!.ultimiTurni).toBe(3);
  });

  it('Bancarotta: chi pesca esce, le proprietà tornano alla banca e il turno passa', () => {
    const s = assegna(pronta(3, 10), 'a', 1, 3);
    const { stato, eventi } = esegui(s, lancia(), caso(...SULLA_CARTOLINA, 0));
    expect(eventi).toContainEqual(expect.objectContaining({ tipo: 'carta', giocatore: 'a', rara: true, carta: rara('bancarotta') }));
    expect(eventi).toContainEqual(expect.objectContaining({ tipo: 'bancarotta', giocatore: 'a' }));
    expect(g(stato, 'a').eliminato).toEqual({ turno: 10, motivo: 'bancarotta' });
    expect(stato.proprieta[1]!.proprietario).toBeNull();
    expect(stato.proprieta[3]!.proprietario).toBeNull();
    expect(stato.turno).toMatchObject({ giocatore: 'b', fase: 'lancio', rilancio: false, numero: 11 });
    // La carta del mazzo non è stata pescata: resta in cima per la prossima volta.
    expect(stato.mazzi.cartolina.prossima).toBe(0);
    expect(problemi(stato)).toEqual([]);
  });

  it('Bancarotta con un doppio: il tiro in più non passa a chi gioca dopo', () => {
    const s = pronta(3, 10);
    g(s, 'a').posizione = 2;
    // I dadi 3 e 3: da 2 si arriva sulla Cartolina a 8.
    const { stato } = esegui(s, lancia(), caso(2, 2, 0));
    expect(g(stato, 'a').eliminato?.motivo).toBe('bancarotta');
    expect(stato.turno).toMatchObject({ giocatore: 'b', fase: 'lancio', rilancio: false, doppi: 0 });
    expect(problemi(stato)).toEqual([]);
  });

  it('nei primi due giri non si tira nemmeno per le carte rare: esce la carta del mazzo', () => {
    // Con 3 giocatori i primi due giri sono i turni 1–6.
    const s = pronta(3, 6);
    const saldo = g(s, 'a').saldo;
    const { stato, eventi } = esegui(s, lancia(), caso(...SULLA_CARTOLINA));
    expect(eventi).toContainEqual(expect.objectContaining({ tipo: 'carta', carta: LOTTERIA }));
    expect(eventi.some((e) => e.tipo === 'carta' && e.rara)).toBe(false);
    expect(g(stato, 'a').saldo).toBe(saldo + 150);
  });

  it('tiro sopra la soglia: esce la carta del mazzo', () => {
    const s = pronta(3, 10);
    const { eventi } = esegui(s, lancia(), caso(...SULLA_CARTOLINA, 9_999));
    expect(eventi).toContainEqual(expect.objectContaining({ tipo: 'carta', carta: LOTTERIA }));
  });

  it('ultimo rimasto: non vince subito, ma dopo tre turni suoi senza che nessuno rientri', () => {
    const r = esegui(pronta(2, 10), lancia(), caso(...SULLA_CARTOLINA, 0));
    expect(r.eventi).toContainEqual({ tipo: 'ultimo_rimasto', giocatore: 'b', turni: 3 });
    let s = r.stato;
    expect(s.fase).toBe('in_corso');
    expect(s.turno.giocatore).toBe('b');
    for (let i = 0; i < 3; i++) {
      expect(s.fase).toBe('in_corso');
      // b arriva ogni volta su una sua città (da 10 a 13).
      g(s, 'b').posizione = 10;
      assegna(s, 'b', 13);
      s = esegui(s, lancia('b'), caso(0, 1)).stato;
      const finito = esegui(s, fine('b'));
      s = finito.stato;
      if (i === 2) expect(finito.eventi).toContainEqual({ tipo: 'fine', vincitore: 'b' });
    }
    expect(s).toMatchObject({ fase: 'finita', vincitore: 'b' });
    expect(problemi(s)).toEqual([]);
  });

  it('se l’ultimo rimasto fallisce durante il conto alla rovescia vince lui, che è durato di più', () => {
    const s = partita(2);
    Object.assign(g(s, 'b'), { eliminato: { turno: 8, motivo: 'bancarotta' }, saldo: 0 });
    s.statistiche.uscite = ['b'];
    s.ultimoRimasto = { turni: 2 };
    const { stato } = esegui(s, { tipo: 'bancarotta', giocatore: 'a' });
    expect(stato).toMatchObject({ fase: 'finita', vincitore: 'a', ultimoRimasto: null });
    expect(problemi(stato)).toEqual([]);
  });

  it('ultimo rimasto senza nessuno che possa rientrare: vince subito', () => {
    const s = partita(3);
    g(s, 'c').eliminato = { turno: 1, motivo: 'assenza' };
    // L'host toglie b: resta solo a, e nessuno è uscito per bancarotta.
    const esito = espelli(s, 'b', caso(), 0);
    if (!esito.ok) throw new Error(esito.messaggio);
    expect(esito.eventi.some((e) => e.tipo === 'ultimo_rimasto')).toBe(false);
    expect(esito.stato).toMatchObject({ fase: 'finita', vincitore: 'a' });
  });

  it('Vita extra: rientra uno a caso tra chi è in bancarotta, dalla Partenza con i soldi iniziali', () => {
    const s = pronta(3, 4);
    Object.assign(g(s, 'b'), { eliminato: { turno: 2, motivo: 'bancarotta' }, saldo: 0, posizione: 30 });
    Object.assign(g(s, 'c'), { eliminato: { turno: 3, motivo: 'assenza' }, saldo: 0, posizione: 31 });
    s.statistiche.uscite = ['b', 'c'];
    s.ultimoRimasto = { turni: 2 };
    // Tiro 0: Vita extra (la Bancarotta non può uscire al turno 4); poi tra i falliti (solo b) il primo.
    const { stato, eventi } = esegui(s, lancia(), caso(...SULLA_CARTOLINA, 0, 0));
    const soldi = s.impostazioni.soldiIniziali;
    expect(eventi).toContainEqual(expect.objectContaining({ tipo: 'carta', rara: true, carta: rara('vita_extra') }));
    expect(eventi).toContainEqual({ tipo: 'rientro', giocatore: 'b', da: 'a', soldi });
    expect(g(stato, 'b')).toMatchObject({ eliminato: null, posizione: 0, saldo: soldi, prigione: null, debiti: [] });
    expect(g(stato, 'b').passaporto).toBeUndefined();
    // Chi è uscito per assenza resta fuori.
    expect(g(stato, 'c').eliminato?.motivo).toBe('assenza');
    expect(stato.statistiche.uscite).toEqual(['c']);
    // Il conto alla rovescia si ferma, e dopo a tocca a b.
    expect(stato.ultimoRimasto).toBeNull();
    expect(esegui(stato, fine()).stato.turno.giocatore).toBe('b');
    expect(problemi(stato)).toEqual([]);
  });

  it('Vita extra durante il conto alla rovescia; la Bancarotta all’ultimo rimasto non esce mai', () => {
    const s = pronta(2, 10);
    Object.assign(g(s, 'b'), { eliminato: { turno: 8, motivo: 'bancarotta' }, saldo: 0 });
    s.ultimoRimasto = { turni: 1 };
    // Con il tiro 0 uscirebbe la Bancarotta, la prima delle carte, se potesse uscire: invece esce la Vita extra.
    const { stato, eventi } = esegui(s, lancia(), caso(...SULLA_CARTOLINA, 0, 0));
    expect(eventi).toContainEqual(expect.objectContaining({ tipo: 'carta', rara: true, carta: rara('vita_extra') }));
    expect(g(stato, 'b').eliminato).toBeNull();
    expect(stato.ultimoRimasto).toBeNull();
    expect(stato.fase).toBe('in_corso');
  });

  it('Reset: tutte le proprietà alla banca, i soldi restano, spariscono gli scambi con proprietà', () => {
    const s = pronta(2, 1);
    const tutte = s.proprieta.flatMap((p, i) => (p ? [i] : []));
    assegna(s, 'a', ...tutte.slice(0, 10));
    assegna(s, 'b', ...tutte.slice(10, 15));
    // Il Vaticano (1) è un paese da una città sola: può avere le case.
    s.proprieta[1]!.livello = 3;
    s.proprieta[tutte[12]!]!.ipotecata = true;
    s.scambi = [scambio(1, [3]), scambio(2, [])];
    s.prossimoScambio = 3;
    const saldi = s.giocatori.map((x) => x.saldo);
    const { stato, eventi } = esegui(s, lancia(), caso(...SULLA_CARTOLINA, 0));
    expect(eventi).toContainEqual(expect.objectContaining({ tipo: 'carta', rara: true, carta: rara('reset') }));
    expect(eventi).toContainEqual({ tipo: 'reset', giocatore: 'a', caselle: tutte.slice(0, 15) });
    for (const p of stato.proprieta) if (p) expect(p).toEqual({ proprietario: null, livello: 0, ipotecata: false });
    expect(stato.giocatori.map((x) => x.saldo)).toEqual(saldi);
    expect(stato.scambi.map((x) => x.id)).toEqual([2]);
    expect(stato.resettata).toBe(true);
    expect(problemi(stato)).toEqual([]);
  });

  it('Reset: solo con almeno metà delle proprietà vendute, e una volta sola', () => {
    const tutte = partita(2).proprieta.flatMap((p, i) => (p ? [i] : []));
    // 14 su 29: meno della metà, e nessun'altra carta rara può uscire: niente tiro.
    const poche = assegna(pronta(2, 1), 'b', ...tutte.slice(0, 14));
    expect(esegui(poche, lancia(), caso(...SULLA_CARTOLINA)).eventi).toContainEqual(expect.objectContaining({ tipo: 'carta', carta: LOTTERIA }));
    // Già uscito una volta: niente tiro.
    const gia = assegna(pronta(2, 1), 'b', ...tutte.slice(0, 20));
    gia.resettata = true;
    expect(esegui(gia, lancia(), caso(...SULLA_CARTOLINA)).eventi).toContainEqual(expect.objectContaining({ tipo: 'carta', carta: LOTTERIA }));
  });

  it('sugli altri tabelloni non ci sono carte rare né conto alla rovescia', () => {
    const s = partitaDiProva(2);
    const { stato, eventi } = esegui(s, { tipo: 'bancarotta', giocatore: 'a' });
    expect(eventi.some((e) => e.tipo === 'ultimo_rimasto')).toBe(false);
    expect(stato).toMatchObject({ fase: 'finita', vincitore: 'b' });
  });
});
