import { describe, expect, it } from 'vitest';
import { applica, verifica } from './regole';
import { assegna, dadi, esegui, g, partitaDiProva, primaCarta, problemi } from './prove';
import type { Azione, Stato } from './tipi';

const lancia = (giocatore = 'a'): Azione => ({ tipo: 'lancia', giocatore });
const fine = (giocatore = 'a'): Azione => ({ tipo: 'fine_turno', giocatore });
const compra = (giocatore = 'a'): Azione => ({ tipo: 'compra', giocatore });

/** Parte da una partita di prova con 'a' sulla casella indicata. */
function conAIn(posizione: number, n = 2, impostazioni = {}): Stato {
  const s = partitaDiProva(n, impostazioni);
  g(s, 'a').posizione = posizione;
  return s;
}

function codiceErrore(s: Stato, azione: Azione): string | undefined {
  return verifica(s, azione)?.codice;
}

describe('dadi e movimento', () => {
  it('avanza della somma dei dadi e propone la città libera', () => {
    const { stato, eventi } = esegui(partitaDiProva(), lancia(), dadi([3, 4]));
    expect(g(stato, 'a').posizione).toBe(7);
    expect(stato.turno).toMatchObject({ fase: 'dopo_lancio', acquisto: 7, dadi: [3, 4], rilancio: false });
    expect(eventi).toContainEqual({ tipo: 'movimento', giocatore: 'a', da: 0, a: 7, dadi: [3, 4] });
  });

  it('non lascia agire chi non è di turno', () => {
    expect(codiceErrore(partitaDiProva(), lancia('b'))).toBe('non_tuo_turno');
    expect(codiceErrore(partitaDiProva(), { tipo: 'lancia', giocatore: 'zz' })).toBe('giocatore_sconosciuto');
  });

  it('non si finisce il turno prima di tirare e non si tira due volte', () => {
    const s = partitaDiProva();
    expect(codiceErrore(s, fine())).toBe('non_ancora_lanciato');
    const { stato } = esegui(s, lancia(), dadi([3, 4]));
    expect(codiceErrore(stato, lancia())).toBe('gia_lanciato');
  });

  it('dopo un doppio si deve tirare ancora', () => {
    let { stato } = esegui(partitaDiProva(), lancia(), dadi([3, 3]));
    expect(stato.turno.rilancio).toBe(true);
    expect(codiceErrore(stato, fine())).toBe('devi_rilanciare');
    ({ stato } = esegui(stato, lancia(), dadi([1, 2])));
    expect(g(stato, 'a').posizione).toBe(9);
    expect(stato.turno.rilancio).toBe(false);
    ({ stato } = esegui(stato, fine()));
    expect(stato.turno).toMatchObject({ giocatore: 'b', numero: 2, fase: 'lancio', doppi: 0 });
  });

  it('tre doppi di fila mandano in prigione senza muoversi', () => {
    let { stato } = esegui(partitaDiProva(), lancia(), dadi([3, 3]));
    ({ stato } = esegui(stato, lancia(), dadi([2, 2])));
    expect(g(stato, 'a').posizione).toBe(10);
    const ultimo = esegui(stato, lancia(), dadi([5, 5]));
    expect(g(ultimo.stato, 'a')).toMatchObject({ posizione: 10, prigione: 0 });
    expect(ultimo.eventi).toContainEqual({ tipo: 'prigione', giocatore: 'a', motivo: 'tre_doppi' });
    expect(ultimo.eventi.some((e) => e.tipo === 'movimento')).toBe(false);
    expect(ultimo.stato.turno.giocatore).toBe('b');
  });

  it('non modifica lo stato ricevuto', () => {
    const s = partitaDiProva();
    const copia = JSON.parse(JSON.stringify(s));
    esegui(s, lancia(), dadi([3, 4]));
    expect(s).toEqual(copia);
  });
});

describe('Partenza', () => {
  it('passando si ricevono 200 €', () => {
    const { stato, eventi } = esegui(conAIn(38), lancia(), dadi([1, 2]));
    expect(g(stato, 'a')).toMatchObject({ posizione: 1, saldo: 1700 });
    expect(eventi).toContainEqual({ tipo: 'partenza', giocatore: 'a', importo: 200, arrivo: false });
  });

  it('fermandosi se ne ricevono 300', () => {
    const { stato } = esegui(conAIn(35), lancia(), dadi([2, 3]));
    expect(g(stato, 'a')).toMatchObject({ posizione: 0, saldo: 1800 });
  });
});

describe('acquisto', () => {
  it('compra la città su cui si è fermato', () => {
    let { stato } = esegui(partitaDiProva(), lancia(), dadi([3, 4]));
    const acquisto = esegui(stato, compra());
    stato = acquisto.stato;
    expect(g(stato, 'a').saldo).toBe(1500 - 110);
    expect(stato.proprieta[7]!.proprietario).toBe('a');
    expect(acquisto.eventi).toEqual([{ tipo: 'acquisto', giocatore: 'a', casella: 7, prezzo: 110 }]);
    expect(codiceErrore(stato, compra())).toBe('niente_da_comprare');
  });

  it('senza soldi non compra; rinunciare lascia la città libera', () => {
    const s = partitaDiProva();
    g(s, 'a').saldo = 100;
    let { stato } = esegui(s, lancia(), dadi([3, 4]));
    expect(codiceErrore(stato, compra())).toBe('soldi_insufficienti');
    ({ stato } = esegui(stato, fine()));
    expect(stato.proprieta[7]!.proprietario).toBeNull();
  });

  it('dopo un doppio si può comprare e poi tirare ancora', () => {
    let { stato } = esegui(partitaDiProva(), lancia(), dadi([3, 3]));
    ({ stato } = esegui(stato, compra()));
    ({ stato } = esegui(stato, lancia(), dadi([1, 2])));
    expect(stato.proprieta[6]!.proprietario).toBe('a');
    expect(stato.turno.acquisto).toBe(9);
  });

  it('una proprietà altrui non si compra', () => {
    const { stato } = esegui(assegna(partitaDiProva(), 'b', 7), lancia(), dadi([3, 4]));
    expect(stato.turno.acquisto).toBeNull();
    expect(codiceErrore(stato, compra())).toBe('niente_da_comprare');
  });
});

describe('affitti', () => {
  it('città: affitto base a chi la possiede', () => {
    const { stato, eventi } = esegui(assegna(partitaDiProva(), 'b', 7), lancia(), dadi([3, 4]));
    expect(g(stato, 'a').saldo).toBe(1494);
    expect(g(stato, 'b').saldo).toBe(1506);
    expect(eventi).toContainEqual({ tipo: 'affitto', da: 'a', a: 'b', casella: 7, importo: 6 });
  });

  it('regione intera: base doppia solo con la regola attiva', () => {
    const senza = esegui(assegna(partitaDiProva(), 'b', 6, 7, 9), lancia(), dadi([3, 4]));
    expect(g(senza.stato, 'b').saldo).toBe(1506);
    const con = esegui(assegna(partitaDiProva(2, { affittoDoppioSetCompleto: true }), 'b', 6, 7, 9), lancia(), dadi([3, 4]));
    expect(g(con.stato, 'b').saldo).toBe(1512);
  });

  it('con le case vale la riga del livello, senza raddoppio', () => {
    const s = assegna(partitaDiProva(2, { affittoDoppioSetCompleto: true }), 'b', 6, 7, 9);
    s.proprieta[7]!.livello = 2;
    const { stato } = esegui(s, lancia(), dadi([3, 4]));
    expect(g(stato, 'b').saldo).toBe(1580);
  });

  it('ipotecata: niente affitto', () => {
    const s = assegna(partitaDiProva(), 'b', 7);
    s.proprieta[7]!.ipotecata = true;
    const { stato, eventi } = esegui(s, lancia(), dadi([3, 4]));
    expect(g(stato, 'a').saldo).toBe(1500);
    expect(eventi.some((e) => e.tipo === 'affitto')).toBe(false);
  });

  it('proprietario in prigione: incassa, salvo con la regola attiva', () => {
    for (const [regola, atteso] of [
      [false, 1494],
      [true, 1500],
    ] as const) {
      const s = assegna(partitaDiProva(2, { nienteAffittoInPrigione: regola }), 'b', 7);
      Object.assign(g(s, 'b'), { posizione: 10, prigione: 1 });
      const { stato } = esegui(s, lancia(), dadi([3, 4]));
      expect(g(stato, 'a').saldo).toBe(atteso);
    }
  });

  it('stazioni: 25, 50, 100, 200; quelle ipotecate non contano', () => {
    const casi: [number[], number[], number][] = [
      [[5], [], 25],
      [[5, 15], [], 50],
      [[5, 15, 25], [], 100],
      [[5, 15, 25, 35], [], 200],
      [[5, 15, 25], [25], 50],
    ];
    for (const [stazioni, ipotecate, atteso] of casi) {
      const s = assegna(partitaDiProva(), 'b', ...stazioni);
      for (const i of ipotecate) s.proprieta[i]!.ipotecata = true;
      const { stato } = esegui(s, lancia(), dadi([2, 3]));
      expect(g(stato, 'a').saldo).toBe(1500 - atteso);
    }
  });

  it('servizi: dadi × 4 con uno, × 10 con due', () => {
    const uno = esegui(assegna(conAIn(5), 'b', 12), lancia(), dadi([3, 4]));
    expect(g(uno.stato, 'a').saldo).toBe(1500 - 28);
    const due = esegui(assegna(conAIn(5), 'b', 12, 27), lancia(), dadi([3, 4]));
    expect(g(due.stato, 'a').saldo).toBe(1500 - 70);
  });

  it('sulle proprie caselle non si paga', () => {
    const { stato } = esegui(assegna(partitaDiProva(), 'a', 7), lancia(), dadi([3, 4]));
    expect(g(stato, 'a').saldo).toBe(1500);
  });
});

describe('tasse', () => {
  it('Imposta sul reddito: 10% del contante, arrotondato', () => {
    const s = partitaDiProva();
    g(s, 'a').saldo = 1285;
    const { stato, eventi } = esegui(s, lancia(), dadi([1, 3]));
    expect(eventi).toContainEqual({ tipo: 'tassa', giocatore: 'a', casella: 4, importo: 129 });
    expect(g(stato, 'a').saldo).toBe(1156);
  });

  it('Tassa di soggiorno: 75 €, nella cassa della Vacanza solo con la regola', () => {
    const senza = esegui(conAIn(35), lancia(), dadi([1, 2]));
    expect(g(senza.stato, 'a').saldo).toBe(1425);
    expect(senza.stato.cassaVacanza).toBe(0);
    const con = esegui(conAIn(35, 2, { cassaVacanza: true }), lancia(), dadi([1, 2]));
    expect(con.stato.cassaVacanza).toBe(75);
  });
});

describe('carte', () => {
  it('soldi dalla banca e alla banca (nella cassa se attiva)', () => {
    const riceve = esegui(primaCarta(conAIn(12), 'busta', 1), lancia(), dadi([2, 3]));
    expect(g(riceve.stato, 'a').saldo).toBe(1600);
    expect(riceve.eventi).toContainEqual(expect.objectContaining({ tipo: 'carta', mazzo: 'busta', carta: 1 }));
    const paga = esegui(primaCarta(conAIn(12, 2, { cassaVacanza: true }), 'busta', 8), lancia(), dadi([2, 3]));
    expect(g(paga.stato, 'a').saldo).toBe(1440);
    expect(paga.stato.cassaVacanza).toBe(60);
  });

  it('ogni giocatore ti dà / paghi ogni giocatore', () => {
    const da = esegui(primaCarta(conAIn(12, 3), 'busta', 12), lancia(), dadi([2, 3]));
    expect(da.stato.giocatori.map((x) => x.saldo)).toEqual([1520, 1490, 1490]);
    const a = esegui(primaCarta(conAIn(0, 3), 'cartolina', 14), lancia(), dadi([3, 5]));
    expect(a.stato.giocatori.map((x) => x.saldo)).toEqual([1400, 1550, 1550]);
  });

  it('vai a una città: si può comprare, e la Partenza paga solo se la si passa', () => {
    const siena = esegui(primaCarta(conAIn(0), 'cartolina', 1), lancia(), dadi([3, 5]));
    expect(g(siena.stato, 'a')).toMatchObject({ posizione: 11, saldo: 1500 });
    expect(siena.stato.turno.acquisto).toBe(11);
    const nord = esegui(primaCarta(conAIn(14), 'cartolina', 4), lancia(), dadi([3, 5]));
    expect(g(nord.stato, 'a')).toMatchObject({ posizione: 5, saldo: 1700 });
  });

  it('torna alla Partenza: conta come fermarsi (300 €)', () => {
    const { stato } = esegui(primaCarta(conAIn(12), 'busta', 0), lancia(), dadi([2, 3]));
    expect(g(stato, 'a')).toMatchObject({ posizione: 0, saldo: 1800 });
  });

  it('stazione più vicina: affitto normale, Partenza se la si passa', () => {
    const { stato } = esegui(primaCarta(assegna(conAIn(28), 'b', 5), 'cartolina', 5), lancia(), dadi([3, 5]));
    expect(g(stato, 'a')).toMatchObject({ posizione: 5, saldo: 1500 + 200 - 25 });
  });

  it('servizio più vicino: affitto con i dadi del tiro', () => {
    const { stato } = esegui(primaCarta(assegna(conAIn(0), 'b', 12), 'cartolina', 6), lancia(), dadi([3, 5]));
    expect(g(stato, 'a')).toMatchObject({ posizione: 12, saldo: 1500 - 32 });
  });

  it('indietro di 3: niente Partenza, e la casella d’arrivo vale (anche un’altra carta)', () => {
    const s = primaCarta(primaCarta(conAIn(28), 'cartolina', 7), 'busta', 1);
    const { stato, eventi } = esegui(s, lancia(), dadi([3, 5]));
    expect(g(stato, 'a')).toMatchObject({ posizione: 33, saldo: 1600 });
    expect(eventi.filter((e) => e.tipo === 'carta')).toHaveLength(2);
  });

  it('vai in prigione: il turno finisce', () => {
    const { stato } = esegui(primaCarta(conAIn(12), 'busta', 15), lancia(), dadi([2, 3]));
    expect(g(stato, 'a')).toMatchObject({ posizione: 10, prigione: 0 });
    expect(stato.turno.giocatore).toBe('b');
  });

  it('Carta Grazia: si tiene e, finché è in mano, il mazzo la salta', () => {
    const s = conAIn(12);
    s.mazzi.busta.ordine = [16, 1, ...s.mazzi.busta.ordine.filter((c) => c !== 16 && c !== 1)];
    let { stato } = esegui(s, lancia(), dadi([2, 3]));
    expect(g(stato, 'a').carteGrazia).toEqual(['busta']);
    ({ stato } = esegui(stato, fine()));
    stato.mazzi.busta.prossima = 0;
    g(stato, 'b').posizione = 12;
    const { eventi } = esegui(stato, lancia('b'), dadi([2, 3]));
    expect(eventi).toContainEqual(expect.objectContaining({ tipo: 'carta', carta: 1 }));
  });

  it('riparazioni: per casa e per albergo', () => {
    const s = assegna(primaCarta(conAIn(12), 'busta', 14), 'a', 1, 3);
    s.proprieta[1]!.livello = 2;
    s.proprieta[3]!.livello = 5;
    const { stato } = esegui(s, lancia(), dadi([2, 3]));
    expect(g(stato, 'a').saldo).toBe(1500 - (2 * 40 + 115));
  });

  it('il mazzo ricomincia dalla prima carta quando finisce', () => {
    const s = conAIn(12);
    s.mazzi.busta.prossima = 16;
    const { stato } = esegui(s, lancia(), dadi([2, 3]));
    expect(stato.mazzi.busta.prossima).toBeLessThan(2);
  });
});

describe('prigione', () => {
  it('la casella Vai in prigione chiude il turno anche dopo un doppio, senza Partenza', () => {
    const { stato } = esegui(conAIn(26), lancia(), dadi([2, 2]));
    expect(g(stato, 'a')).toMatchObject({ posizione: 10, prigione: 0, saldo: 1500 });
    expect(stato.turno.giocatore).toBe('b');
  });

  /** 'a' in prigione con `tentativi` tiri già falliti, ed è il suo turno. */
  function inPrigione(tentativi = 0): Stato {
    const s = conAIn(10);
    g(s, 'a').prigione = tentativi;
    s.turno.fase = 'prigione';
    return s;
  }

  it('senza doppio resta dentro e il turno passa', () => {
    const { stato, eventi } = esegui(inPrigione(), lancia(), dadi([1, 2]));
    expect(g(stato, 'a')).toMatchObject({ posizione: 10, prigione: 1 });
    expect(eventi).toContainEqual({ tipo: 'prigione_fallita', giocatore: 'a', tentativi: 1 });
    expect(stato.turno.giocatore).toBe('b');
  });

  it('dopo tre tiri falliti esce gratis al turno seguente e tira normalmente', () => {
    let { stato } = esegui(inPrigione(2), lancia(), dadi([1, 2]));
    expect(g(stato, 'a').prigione).toBe(3);
    ({ stato } = esegui(stato, lancia('b'), dadi([1, 2])));
    const turno = esegui(stato, fine('b'));
    expect(turno.eventi).toContainEqual({ tipo: 'uscita_prigione', giocatore: 'a', modo: 'tentativi' });
    expect(turno.stato.turno.fase).toBe('lancio');
    ({ stato } = esegui(turno.stato, lancia(), dadi([2, 4])));
    expect(g(stato, 'a')).toMatchObject({ posizione: 16, prigione: null, saldo: 1500 });
  });

  it('con un doppio esce e si muove di quel tiro, senza tirare ancora', () => {
    const { stato } = esegui(inPrigione(1), lancia(), dadi([2, 2]));
    expect(g(stato, 'a')).toMatchObject({ posizione: 14, prigione: null });
    expect(stato.turno).toMatchObject({ rilancio: false, acquisto: 14 });
    expect(verifica(stato, fine())).toBeNull();
  });

  it('pagare la cauzione fa uscire ma chiude il turno', () => {
    let { stato } = esegui(inPrigione(), { tipo: 'paga_cauzione', giocatore: 'a' });
    expect(g(stato, 'a')).toMatchObject({ posizione: 10, prigione: null, saldo: 1450 });
    expect(stato.turno.giocatore).toBe('b');
    ({ stato } = esegui(stato, lancia('b'), dadi([1, 2])));
    ({ stato } = esegui(stato, fine('b')));
    expect(stato.turno).toMatchObject({ giocatore: 'a', fase: 'lancio' });
  });

  it('la cauzione richiede 50 € e la cella', () => {
    const povero = inPrigione();
    g(povero, 'a').saldo = 40;
    expect(codiceErrore(povero, { tipo: 'paga_cauzione', giocatore: 'a' })).toBe('soldi_insufficienti');
    expect(codiceErrore(partitaDiProva(), { tipo: 'paga_cauzione', giocatore: 'a' })).toBe('non_in_prigione');
  });

  it('la Carta Grazia fa uscire, chiude il turno e torna nel mazzo', () => {
    expect(codiceErrore(inPrigione(), { tipo: 'usa_grazia', giocatore: 'a' })).toBe('niente_grazia');
    const s = inPrigione();
    g(s, 'a').carteGrazia = ['cartolina'];
    const { stato } = esegui(s, { tipo: 'usa_grazia', giocatore: 'a' });
    expect(g(stato, 'a')).toMatchObject({ prigione: null, carteGrazia: [] });
    expect(stato.turno.giocatore).toBe('b');
  });
});

describe('vacanza', () => {
  it('si salta il turno successivo, e un doppio non fa rilanciare', () => {
    let { stato } = esegui(conAIn(16), lancia(), dadi([2, 2]));
    expect(g(stato, 'a').vacanza).toBe(true);
    expect(stato.turno.giocatore).toBe('b');
    ({ stato } = esegui(stato, lancia('b'), dadi([1, 2])));
    const passa = esegui(stato, fine('b'));
    expect(passa.eventi).toContainEqual({ tipo: 'turno_saltato', giocatore: 'a' });
    expect(passa.stato.turno.giocatore).toBe('b');
    expect(g(passa.stato, 'a').vacanza).toBe(false);
  });

  it('con la regola attiva si ritira la cassa', () => {
    const s = conAIn(15, 2, { cassaVacanza: true });
    s.cassaVacanza = 225;
    const { stato, eventi } = esegui(s, lancia(), dadi([2, 3]));
    expect(eventi).toContainEqual({ tipo: 'vacanza', giocatore: 'a', incasso: 225 });
    expect(g(stato, 'a').saldo).toBe(1725);
    expect(stato.cassaVacanza).toBe(0);
  });

  it('due giocatori in vacanza saltano uno dopo l’altro', () => {
    const s = partitaDiProva(3);
    s.turno.giocatore = 'c';
    g(s, 'a').vacanza = true;
    g(s, 'b').vacanza = true;
    let { stato } = esegui(s, lancia('c'), dadi([1, 2]));
    const passa = esegui(stato, fine('c'));
    stato = passa.stato;
    expect(passa.eventi.filter((e) => e.tipo === 'turno_saltato').map((e) => e.giocatore)).toEqual(['a', 'b']);
    expect(stato.turno.giocatore).toBe('c');
  });
});

describe('debito', () => {
  /** 'a' ha 30 € e finisce su Sassari di 'b' con 3 case (affitto 220). */
  function inDebito(): Stato {
    const s = assegna(partitaDiProva(), 'b', 6, 7, 9);
    for (const n of [6, 7, 9]) s.proprieta[n]!.livello = 3;
    g(s, 'a').saldo = 30;
    return esegui(s, lancia(), dadi([3, 4])).stato;
  }

  it('l’affitto oltre il contante: il creditore incassa il disponibile, il resto è debito', () => {
    const s = inDebito();
    expect(g(s, 'a')).toMatchObject({ saldo: -190, debiti: [{ creditore: 'b', importo: 190 }] });
    expect(g(s, 'b').saldo).toBe(1530);
    expect(problemi(s)).toEqual([]);
  });

  it('con il saldo negativo non si tira e non si finisce il turno', () => {
    const s = inDebito();
    expect(codiceErrore(s, fine())).toBe('saldo_negativo');
    s.turno.rilancio = true;
    expect(codiceErrore(s, lancia())).toBe('saldo_negativo');
  });

  it('vendere alla banca salda il debito, anche a rate', () => {
    const s = assegna(inDebito(), 'a', 1, 39);
    const primaVendita = esegui(s, { tipo: 'vendi', giocatore: 'a', casella: 1 });
    let stato = primaVendita.stato;
    expect(g(stato, 'a')).toMatchObject({ saldo: -160, debiti: [{ creditore: 'b', importo: 160 }] });
    expect(primaVendita.eventi).toContainEqual({ tipo: 'rimborso', da: 'a', a: 'b', importo: 30 });
    ({ stato } = esegui(stato, { tipo: 'vendi', giocatore: 'a', casella: 39 }));
    expect(g(stato, 'a')).toMatchObject({ saldo: 40, debiti: [] });
    expect(g(stato, 'b').saldo).toBe(1720);
    expect(stato.proprieta[39]).toEqual({ proprietario: null, livello: 0, ipotecata: false });
    ({ stato } = esegui(stato, fine()));
    expect(stato.turno.giocatore).toBe('b');
  });

  it('la vendita ha i suoi limiti', () => {
    const s = assegna(partitaDiProva(), 'a', 6, 7, 9, 12);
    s.proprieta[6]!.livello = 1;
    s.proprieta[12]!.ipotecata = true;
    expect(codiceErrore(s, { tipo: 'vendi', giocatore: 'a', casella: 7 })).toBe('edifici_nella_regione');
    expect(codiceErrore(s, { tipo: 'vendi', giocatore: 'a', casella: 3 })).toBe('non_tua');
    expect(codiceErrore(s, { tipo: 'vendi', giocatore: 'b', casella: 12 })).toBe('non_tuo_turno');
    const { stato } = esegui(s, { tipo: 'vendi', giocatore: 'a', casella: 12 });
    expect(g(stato, 'a').saldo).toBe(1500);
  });

  it('il debito verso la banca non ha creditore', () => {
    const s = conAIn(35);
    g(s, 'a').saldo = 50;
    const { stato } = esegui(s, lancia(), dadi([1, 2]));
    expect(g(stato, 'a')).toMatchObject({ saldo: -25, debiti: [] });
  });

  it('chi va in rosso fuori turno non può tirare al suo turno', () => {
    const s = primaCarta(conAIn(12), 'busta', 13);
    g(s, 'b').saldo = 20;
    let { stato } = esegui(s, lancia(), dadi([2, 3]));
    expect(g(stato, 'b')).toMatchObject({ saldo: -30, debiti: [{ creditore: 'a', importo: 30 }] });
    ({ stato } = esegui(stato, fine()));
    expect(codiceErrore(stato, lancia('b'))).toBe('saldo_negativo');
  });

  it('un rimborso passa di debitore in debitore', () => {
    const s = assegna(partitaDiProva(3), 'a', 39);
    Object.assign(g(s, 'a'), { saldo: -100, debiti: [{ creditore: 'b', importo: 100 }] });
    Object.assign(g(s, 'b'), { saldo: -40, debiti: [{ creditore: 'c', importo: 40 }] });
    const { stato } = esegui(s, { tipo: 'vendi', giocatore: 'a', casella: 39 });
    expect(stato.giocatori.map((x) => x.saldo)).toEqual([100, 60, 1540]);
    expect(problemi(stato)).toEqual([]);
  });
});

describe('bancarotta', () => {
  it('fuori turno: le proprietà tornano libere e il turno resta', () => {
    const s = assegna(partitaDiProva(3), 'b', 6, 7, 9);
    s.proprieta[6]!.livello = 2;
    s.proprieta[7]!.livello = 2;
    s.proprieta[9]!.livello = 2;
    g(s, 'b').carteGrazia = ['busta'];
    const { stato, eventi } = esegui(s, { tipo: 'bancarotta', giocatore: 'b' });
    expect(g(stato, 'b')).toMatchObject({ saldo: 0, carteGrazia: [], eliminato: { turno: 1, motivo: 'bancarotta' } });
    for (const i of [6, 7, 9]) expect(stato.proprieta[i]).toEqual({ proprietario: null, livello: 0, ipotecata: false });
    expect(eventi).toEqual([{ tipo: 'bancarotta', giocatore: 'b', recuperi: [] }]);
    expect(stato.turno.giocatore).toBe('a');
    expect(codiceErrore(stato, { tipo: 'bancarotta', giocatore: 'b' })).toBe('eliminato');
  });

  it('il creditore recupera dalla banca fino al debito', () => {
    const s = assegna(partitaDiProva(3), 'a', 39);
    Object.assign(g(s, 'a'), { saldo: -190, debiti: [{ creditore: 'b', importo: 190 }] });
    const { stato, eventi } = esegui(s, { tipo: 'bancarotta', giocatore: 'a' });
    expect(eventi).toContainEqual({ tipo: 'bancarotta', giocatore: 'a', recuperi: [{ creditore: 'b', importo: 190 }] });
    expect(g(stato, 'b').saldo).toBe(1690);
    expect(stato.turno.giocatore).toBe('b');
  });

  it('il recupero si ferma al valore dei beni', () => {
    const s = assegna(partitaDiProva(3), 'a', 1);
    Object.assign(g(s, 'a'), { saldo: -500, debiti: [{ creditore: 'b', importo: 500 }], carteGrazia: ['busta'] });
    const { stato } = esegui(s, { tipo: 'bancarotta', giocatore: 'a' });
    expect(g(stato, 'b').saldo).toBe(1500 + 30 + 50);
  });

  it('i debiti verso chi fallisce si cancellano', () => {
    const s = partitaDiProva(3);
    Object.assign(g(s, 'c'), { saldo: -40, debiti: [{ creditore: 'b', importo: 40 }] });
    const { stato } = esegui(s, { tipo: 'bancarotta', giocatore: 'b' });
    expect(g(stato, 'c')).toMatchObject({ saldo: -40, debiti: [] });
  });

  it('quando resta un solo giocatore la partita finisce', () => {
    const { stato, eventi } = esegui(partitaDiProva(), { tipo: 'bancarotta', giocatore: 'a' });
    expect(stato).toMatchObject({ fase: 'finita', vincitore: 'b' });
    expect(eventi.at(-1)).toEqual({ tipo: 'fine', vincitore: 'b' });
    const dopo = applica(stato, lancia('b'), dadi([1, 2]));
    expect(dopo.ok).toBe(false);
    if (!dopo.ok) expect(dopo.codice).toBe('partita_finita');
  });
});
