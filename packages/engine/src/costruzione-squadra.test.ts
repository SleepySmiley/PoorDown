/*
 * Costruzione di squadra (regola facoltativa delle partite a squadre): i compagni costruiscono anche sulle città
 * degli altri giocatori della squadra, pagando di tasca loro. Gli edifici li vende chi possiede la città.
 */

import { describe, expect, it } from 'vitest';
import { mossaBot, mosseDeiBot } from './bot';
import { casoDaSeme } from './caso';
import { costruzioneDiSquadra, puoCostruireSu } from './conti';
import { descrivi } from './descrivi';
import { modificaPartita } from './pannello';
import { assegna, esegui, g, partitaASquadre, partitaDiProva, problemi } from './prove';
import { applica, azioniPossibili, verifica } from './regole';
import type { Azione, IdGiocatore, Stato } from './tipi';

/** Classico: la Valle d'Aosta ha Courmayeur (60 €) e Aosta (70 €), case da 50 €. */
const COURMAYEUR = 1;
const AOSTA = 3;
/** La Toscana: Siena, Pisa, Firenze. */
const TOSCANA = [11, 13, 14];

const DI_SQUADRA = { costruzioneDiSquadra: true };

/**
 * a e b nella squadra 0, c e d nella squadra 1 (turni: a, c, b, d; tocca ad a).
 * Anna ha Courmayeur, Bruno Aosta: la Valle d'Aosta è tutta della squadra 0.
 */
function valle(impostazioni = {}): Stato {
  return assegna(assegna(partitaASquadre([0, 0, 1, 1], impostazioni), 'a', COURMAYEUR), 'b', AOSTA);
}

function costruisci(giocatore: IdGiocatore, casella: number): Azione {
  return { tipo: 'costruisci', giocatore, casella };
}

function codice(s: Stato, azione: Azione) {
  return verifica(s, azione)?.codice ?? null;
}

describe('costruzione di squadra: la regola', () => {
  it('senza la regola sulla città del compagno costruisce solo lui', () => {
    const s = valle();
    expect(costruzioneDiSquadra(s)).toBe(false);
    expect(codice(s, costruisci('a', AOSTA))).toBe('non_tua');
    expect(codice(s, costruisci('a', COURMAYEUR))).toBeNull();
    expect(azioniPossibili(s, 'a')).not.toContainEqual(costruisci('a', AOSTA));
  });

  it('con la regola si costruisce sulla città del compagno: paga chi costruisce, la città resta sua', () => {
    const s = valle(DI_SQUADRA);
    expect(costruzioneDiSquadra(s)).toBe(true);
    expect(puoCostruireSu(s, 'a', AOSTA)).toBe(true);
    const r = esegui(s, costruisci('a', AOSTA));
    expect(g(r.stato, 'a').saldo).toBe(g(s, 'a').saldo - 50);
    expect(g(r.stato, 'b').saldo).toBe(g(s, 'b').saldo);
    expect(r.stato.proprieta[AOSTA]).toEqual({ proprietario: 'b', livello: 1, ipotecata: false });
    expect(r.eventi).toEqual([{ tipo: 'costruzione', giocatore: 'a', casella: AOSTA, livello: 1, costo: 50, proprietario: 'b' }]);
    expect(problemi(r.stato)).toEqual([]);
  });

  it('sulle proprie città l’evento non nomina il proprietario', () => {
    const r = esegui(valle(DI_SQUADRA), costruisci('a', COURMAYEUR));
    expect(r.eventi).toEqual([{ tipo: 'costruzione', giocatore: 'a', casella: COURMAYEUR, livello: 1, costo: 50 }]);
  });

  it('con la costruzione uniforme la regione della squadra sale tutta insieme', () => {
    let s = esegui(valle(DI_SQUADRA), costruisci('a', AOSTA)).stato;
    expect(codice(s, costruisci('a', AOSTA))).toBe('costruzione_uniforme');
    s = esegui(s, costruisci('a', COURMAYEUR)).stato;
    s = esegui(s, costruisci('a', AOSTA)).stato;
    expect(s.proprieta[AOSTA]!.livello).toBe(2);
    expect(s.proprieta[COURMAYEUR]!.livello).toBe(1);
    expect(problemi(s)).toEqual([]);
  });

  it('niente sulle città degli avversari, anche con la loro regione completa', () => {
    let s = valle(DI_SQUADRA);
    s = assegna(assegna(s, 'c', TOSCANA[0]!, TOSCANA[1]!), 'd', TOSCANA[2]!);
    expect(puoCostruireSu(s, 'a', TOSCANA[0]!)).toBe(false);
    expect(codice(s, costruisci('a', TOSCANA[0]!))).toBe('non_tua');
    expect(azioniPossibili(s, 'a').filter((x) => x.tipo === 'costruisci' && TOSCANA.includes(x.casella))).toEqual([]);
  });

  it('restano le regole di sempre: regione completa, niente ipoteche, soldi di chi costruisce, il proprio turno', () => {
    const incompleta = assegna(partitaASquadre([0, 0, 1, 1], DI_SQUADRA), 'b', AOSTA);
    expect(codice(incompleta, costruisci('a', AOSTA))).toBe('regione_incompleta');

    const ipotecata = valle({ ...DI_SQUADRA, ipoteche: true });
    ipotecata.proprieta[COURMAYEUR]!.ipotecata = true;
    expect(codice(ipotecata, costruisci('a', AOSTA))).toBe('regione_ipotecata');

    // Il proprietario è ricco, ma paga chi costruisce.
    const povero = valle(DI_SQUADRA);
    g(povero, 'a').saldo = 40;
    expect(codice(povero, costruisci('a', AOSTA))).toBe('soldi_insufficienti');

    // Tocca ad Anna: Bruno non costruisce, neanche sulla città della compagna.
    expect(codice(valle(DI_SQUADRA), costruisci('b', COURMAYEUR))).toBe('non_tuo_turno');
  });

  it('vale solo a squadre', () => {
    const s = assegna(assegna(partitaDiProva(2, DI_SQUADRA), 'a', COURMAYEUR), 'b', AOSTA);
    expect(costruzioneDiSquadra(s)).toBe(false);
    expect(puoCostruireSu(s, 'a', AOSTA)).toBe(false);
    expect(codice(s, costruisci('a', AOSTA))).toBe('non_tua');
  });

  it('`azioniPossibili` propone le città dei compagni, ma solo per costruire', () => {
    const azioni = azioniPossibili(valle({ ...DI_SQUADRA, ipoteche: true }), 'a');
    expect(azioni).toContainEqual(costruisci('a', AOSTA));
    expect(azioni.filter((x) => 'casella' in x && x.casella === AOSTA).map((x) => x.tipo)).toEqual(['costruisci']);
  });
});

describe('costruzione di squadra: gli edifici li vende chi possiede la città', () => {
  it('chi ha costruito sulla città del compagno non può venderne gli edifici; il proprietario sì, e incassa lui', () => {
    const s = esegui(valle(DI_SQUADRA), costruisci('a', AOSTA)).stato;
    expect(codice(s, { tipo: 'demolisci', giocatore: 'a', casella: AOSTA })).toBe('non_tua');
    // Tocca a Bruno, il proprietario.
    s.turno.giocatore = 'b';
    const saldoA = g(s, 'a').saldo;
    const saldoB = g(s, 'b').saldo;
    const r = esegui(s, { tipo: 'demolisci', giocatore: 'b', casella: AOSTA });
    expect(g(r.stato, 'b').saldo).toBe(saldoB + 25);
    expect(g(r.stato, 'a').saldo).toBe(saldoA);
    expect(r.stato.proprieta[AOSTA]!.livello).toBe(0);
    expect(problemi(r.stato)).toEqual([]);
  });
});

describe('costruzione di squadra: registro, bot e pannello', () => {
  it('il registro dice di chi è la città', () => {
    const s = valle(DI_SQUADRA);
    const r = esegui(s, costruisci('a', AOSTA));
    expect(descrivi(r.eventi[0]!, r.stato)).toBe('Anna costruisce una casa ad Aosta, di Bruno, per 50 €.');
    const mia = esegui(s, costruisci('a', COURMAYEUR));
    expect(descrivi(mia.eventi[0]!, mia.stato)).toBe('Anna costruisce una casa a Courmayeur per 50 €.');
  });

  it('un bot costruisce anche sulle città dei compagni (prima sulla più cara)', () => {
    expect(mossaBot(valle(DI_SQUADRA), 'a')).toEqual(costruisci('a', AOSTA));
    expect(mossaBot(valle(), 'a')).toEqual(costruisci('a', COURMAYEUR));
  });

  it('il pannello di controllo accende la regola a partita in corso', () => {
    const s = valle();
    const esito = modificaPartita(s, { tipo: 'regole', regole: { costruzioneDiSquadra: true } }, casoDaSeme(1), 0);
    if (!esito.ok) throw new Error(esito.messaggio);
    expect(esito.stato.impostazioni.costruzioneDiSquadra).toBe(true);
    expect(codice(esito.stato, costruisci('a', AOSTA))).toBeNull();
  });

  it('una partita salvata prima della regola (senza la chiave) continua senza', () => {
    const s = valle();
    delete (s.impostazioni as Partial<Stato['impostazioni']>).costruzioneDiSquadra;
    expect(costruzioneDiSquadra(s)).toBe(false);
    expect(codice(s, costruisci('a', AOSTA))).toBe('non_tua');
  });
});

describe('costruzione di squadra: partite intere', () => {
  it('partite a caso restano coerenti, e i compagni costruiscono l’uno sulle città dell’altro', () => {
    let perIlCompagno = 0;
    for (let seme = 1; seme <= 8; seme++) {
      const caso = casoDaSeme(seme);
      let s = partitaASquadre([0, 0, 1, 1], { ...DI_SQUADRA, timerTurno: false, soldiIniziali: 2000 });
      for (let passo = 0; passo < 3000 && s.fase === 'in_corso'; passo++) {
        const id = s.turno.giocatore;
        const possibili = azioniPossibili(s, id);
        const di = (tipo: Azione['tipo']) => possibili.filter((a) => a.tipo === tipo);
        let azione: Azione | undefined;
        if (g(s, id).saldo < 0) {
          azione = [...di('demolisci'), ...di('vendi')][0] ?? di('bancarotta')[0];
        } else {
          // Prima le case sulle città dei compagni, se restano soldi; poi si compra, si tira, si finisce il turno.
          const ricco = g(s, id).saldo > 400;
          const costruzioni = possibili.filter((a): a is Extract<Azione, { tipo: 'costruisci' }> => ricco && a.tipo === 'costruisci');
          const delCompagno = costruzioni.find((a) => s.proprieta[a.casella]?.proprietario !== id);
          const mia = caso.intero(2) === 0 ? costruzioni[0] : undefined;
          azione = delCompagno ?? mia ?? di('compra')[0] ?? di('lancia')[0] ?? di('fine_turno')[0];
        }
        azione ??= possibili[0]!;
        const esito = applica(s, azione, caso, passo * 1000);
        if (!esito.ok) throw new Error(`Seme ${seme}, passo ${passo}: ${azione.tipo} rifiutata (${esito.messaggio}).`);
        if (esito.eventi.some((e) => e.tipo === 'costruzione' && e.proprietario !== undefined)) perIlCompagno++;
        s = esito.stato;
        const guasti = problemi(s);
        if (guasti.length > 0) throw new Error(`Seme ${seme}, passo ${passo}: ${guasti.join(' ')}`);
      }
    }
    expect(perIlCompagno).toBeGreaterThan(0);
  });

  it('partite di soli bot a squadre con la regola finiscono senza mosse rifiutate', () => {
    for (let seme = 1; seme <= 4; seme++) {
      const caso = casoDaSeme(100 + seme);
      let s = partitaASquadre([0, 0, 1, 1], { ...DI_SQUADRA, timerTurno: false });
      const bot = s.giocatori.map((x) => x.id);
      for (let i = 0; i < 6000 && s.fase === 'in_corso'; i++) {
        const mosse = mosseDeiBot(s, bot);
        if (mosse.length === 0) throw new Error(`Seme ${seme}: il turno di ${s.turno.giocatore} è fermo.`);
        const { azione } = mosse[caso.intero(mosse.length)]!;
        const esito = applica(s, azione, caso, i * 1000);
        if (!esito.ok) throw new Error(`Seme ${seme}: il bot ha scelto ${azione.tipo}, rifiutata (${esito.messaggio}).`);
        s = esito.stato;
      }
      expect(s.fase).toBe('finita');
      expect(problemi(s)).toEqual([]);
    }
  });
});
