import { describe, expect, it } from 'vitest';
import { casoDaSeme } from './caso';
import { affitto, haVinto } from './conti';
import { IMPOSTAZIONI_PREDEFINITE } from './impostazioni';
import { creaPartita } from './partita';
import { assegna, dadi, esegui, g, ID, NOMI, partitaASquadre, primaCarta, problemi } from './prove';
import { verifica } from './regole';
import { problemiScambio } from './scambi';
import { classifica } from './statistiche';

/** a e b nella squadra 0, c e d nella squadra 1. L'ordine dei turni è a, c, b, d. */
const quattro = (impostazioni = {}) => partitaASquadre([0, 0, 1, 1], impostazioni);

describe('squadre: preparazione', () => {
  it('i turni si alternano tra le squadre e ognuno ha la sua squadra', () => {
    const s = quattro();
    expect(s.giocatori.map((x) => x.id)).toEqual(['a', 'c', 'b', 'd']);
    expect(s.giocatori.map((x) => x.squadra)).toEqual([0, 1, 0, 1]);
    expect(s.squadre).toEqual(['Squadra 1', 'Squadra 2', 'Squadra 3', 'Squadra 4']);
    expect(problemi(s)).toEqual([]);
  });

  it('con l’ordine casuale le squadre si alternano comunque', () => {
    const esito = creaPartita(
      [0, 0, 0, 1, 1, 1].map((squadra, i) => ({ id: ID[i]!, nome: NOMI[i]!, colore: i + 1, squadra })),
      { ...IMPOSTAZIONI_PREDEFINITE, squadre: true },
      casoDaSeme(7),
      0,
      ['Lupi', 'Volpi'],
    );
    if (!esito.ok) throw new Error(esito.messaggio);
    const squadre = esito.stato.giocatori.map((x) => x.squadra);
    for (let i = 1; i < squadre.length; i++) expect(squadre[i]).not.toBe(squadre[i - 1]);
    expect(esito.stato.squadre.slice(0, 2)).toEqual(['Lupi', 'Volpi']);
  });

  it('servono almeno due squadre e tutti in una squadra', () => {
    const imp = { ...IMPOSTAZIONI_PREDEFINITE, squadre: true };
    const una = creaPartita([{ id: 'a', nome: 'A', colore: 1, squadra: 0 }, { id: 'b', nome: 'B', colore: 2, squadra: 0 }], imp, casoDaSeme(1));
    expect(una).toMatchObject({ ok: false, codice: 'squadre_non_valide' });
    const senza = creaPartita([{ id: 'a', nome: 'A', colore: 1, squadra: 0 }, { id: 'b', nome: 'B', colore: 2 }], imp, casoDaSeme(1));
    expect(senza).toMatchObject({ ok: false, codice: 'squadre_non_valide' });
  });

  it('senza squadre nessuno ha una squadra', () => {
    const esito = creaPartita([{ id: 'a', nome: 'A', colore: 1, squadra: 0 }, { id: 'b', nome: 'B', colore: 2, squadra: 0 }], IMPOSTAZIONI_PREDEFINITE, casoDaSeme(1));
    if (!esito.ok) throw new Error(esito.messaggio);
    expect(esito.stato.giocatori.map((x) => x.squadra)).toEqual([null, null]);
    expect(esito.stato.squadre).toEqual([]);
  });
});

describe('squadre: regole', () => {
  it('tra compagni non si paga l’affitto, gli avversari sì', () => {
    let s = assegna(quattro(), 'b', 3);
    const saldoA = g(s, 'a').saldo;
    let r = esegui(s, { tipo: 'lancia', giocatore: 'a' }, dadi([1, 2]));
    expect(r.eventi.some((e) => e.tipo === 'affitto')).toBe(false);
    expect(g(r.stato, 'a').saldo).toBe(saldoA);
    s = esegui(r.stato, { tipo: 'fine_turno', giocatore: 'a' }).stato;
    r = esegui(s, { tipo: 'lancia', giocatore: 'c' }, dadi([1, 2]));
    expect(r.eventi).toContainEqual({ tipo: 'affitto', da: 'c', a: 'b', casella: 3, importo: 4 });
  });

  it('la regione si completa con le città dei compagni: si costruisce e l’affitto raddoppia', () => {
    const s = assegna(assegna(quattro({ affittoDoppioSetCompleto: true }), 'a', 1), 'b', 3);
    expect(verifica(s, { tipo: 'costruisci', giocatore: 'a', casella: 1 })).toBeNull();
    // Sulle città del compagno costruisce lui.
    expect(verifica(s, { tipo: 'costruisci', giocatore: 'a', casella: 3 })?.codice).toBe('non_tua');
    expect(affitto(s, 1, 0)).toBe(6);
    const r = esegui(s, { tipo: 'costruisci', giocatore: 'a', casella: 1 });
    // Costruzione uniforme: prima il compagno costruisce su Aosta.
    expect(verifica(r.stato, { tipo: 'costruisci', giocatore: 'a', casella: 1 })?.codice).toBe('costruzione_uniforme');
  });

  it('stazioni e servizi si contano con quelli dei compagni', () => {
    const s = assegna(assegna(quattro(), 'a', 5, 12), 'b', 15, 27);
    expect(affitto(s, 5, 0)).toBe(50);
    expect(affitto(s, 12, 7)).toBe(70);
  });

  it('le carte "ogni giocatore" riguardano solo gli avversari', () => {
    const s = primaCarta(quattro(), 'busta', 12);
    const prima = Object.fromEntries(s.giocatori.map((x) => [x.id, x.saldo]));
    const r = esegui(s, { tipo: 'lancia', giocatore: 'a' }, dadi([1, 1]));
    expect(g(r.stato, 'a').saldo).toBe(prima.a! + 20);
    expect(g(r.stato, 'b').saldo).toBe(prima.b!);
    expect(g(r.stato, 'c').saldo).toBe(prima.c! - 10);
    expect(g(r.stato, 'd').saldo).toBe(prima.d! - 10);
  });

  it('tra compagni gli scambi non hanno le regole di equità', () => {
    const s = assegna(quattro({ stanzaPrivata: false }), 'a', 37, 39);
    const tutto = { soldi: g(s, 'a').saldo, caselle: [37, 39], grazie: [] };
    const vuoto = { soldi: 0, caselle: [], grazie: [] };
    expect(problemiScambio(s, { da: 'a', a: 'b', dare: tutto, avere: vuoto })).toEqual([]);
    expect(problemiScambio(s, { da: 'a', a: 'c', dare: tutto, avere: vuoto })).toEqual(['Questo scambio è troppo sbilanciato.']);
  });
});

describe('squadre: bancarotta ed eredità', () => {
  it('senza debiti il compagno eredita contante, proprietà così come sono e Carte Grazia', () => {
    const s = assegna(quattro(), 'a', 1, 3, 5);
    s.proprieta[1]!.livello = 1;
    s.proprieta[3]!.livello = 1;
    s.proprieta[5]!.ipotecata = true;
    g(s, 'a').saldo = 300;
    g(s, 'a').carteGrazia = ['busta'];
    const saldoB = g(s, 'b').saldo;
    const r = esegui(s, { tipo: 'bancarotta', giocatore: 'a' });
    expect(r.eventi).toContainEqual({ tipo: 'bancarotta', giocatore: 'a', recuperi: [], erede: 'b' });
    expect(r.eventi).toContainEqual({ tipo: 'eredita', da: 'a', a: 'b', soldi: 300, caselle: [1, 3, 5], grazie: 1 });
    expect(g(r.stato, 'b').saldo).toBe(saldoB + 300);
    expect(g(r.stato, 'b').carteGrazia).toEqual(['busta']);
    expect(r.stato.proprieta[1]).toEqual({ proprietario: 'b', livello: 1, ipotecata: false });
    expect(r.stato.proprieta[5]).toEqual({ proprietario: 'b', livello: 0, ipotecata: true });
    expect(r.stato.turno.giocatore).toBe('c');
    expect(r.stato.fase).toBe('in_corso');
    expect(problemi(r.stato)).toEqual([]);
  });

  it('con un debito il creditore è pagato dalla liquidazione e il resto va in contanti al compagno', () => {
    const s = assegna(quattro(), 'a', 37, 39);
    g(s, 'a').saldo = -200;
    g(s, 'a').debiti = [{ creditore: 'c', importo: 200 }];
    const saldoB = g(s, 'b').saldo;
    const saldoC = g(s, 'c').saldo;
    const r = esegui(s, { tipo: 'bancarotta', giocatore: 'a' });
    // Liquidazione: 180 (Bergamo) + 200 (Milano) = 380. Al creditore 200, al compagno 180.
    expect(r.eventi).toContainEqual({ tipo: 'bancarotta', giocatore: 'a', recuperi: [{ creditore: 'c', importo: 200 }] });
    expect(r.eventi).toContainEqual({ tipo: 'eredita', da: 'a', a: 'b', soldi: 180, caselle: [], grazie: 0 });
    expect(g(r.stato, 'c').saldo).toBe(saldoC + 200);
    expect(g(r.stato, 'b').saldo).toBe(saldoB + 180);
    expect(r.stato.proprieta[39]!.proprietario).toBeNull();
    expect(problemi(r.stato)).toEqual([]);
  });

  it('la partita finisce quando resta una sola squadra, e vince tutta la squadra', () => {
    let s = esegui(quattro(), { tipo: 'bancarotta', giocatore: 'a' }).stato;
    expect(s.fase).toBe('in_corso');
    s = esegui(s, { tipo: 'bancarotta', giocatore: 'c' }).stato;
    expect(s.fase).toBe('in_corso');
    const r = esegui(s, { tipo: 'bancarotta', giocatore: 'd' });
    expect(r.stato.fase).toBe('finita');
    expect(r.stato.squadraVincitrice).toBe(0);
    expect(r.stato.vincitore).toBe('b');
    expect(r.eventi.at(-1)).toEqual({ tipo: 'fine', vincitore: 'b', squadra: 0 });
    expect(haVinto(r.stato, 'a')).toBe(true);
    expect(haVinto(r.stato, 'c')).toBe(false);
    expect(classifica(r.stato).filter((p) => p.vincitore).map((p) => p.giocatore).sort()).toEqual(['a', 'b']);
    expect(problemi(r.stato)).toEqual([]);
  });
});
