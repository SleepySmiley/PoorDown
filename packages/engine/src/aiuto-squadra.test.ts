/*
 * Squadre con i bot: il bot regala al compagno in rosso i soldi che gli servono, quando conviene alla squadra,
 * e accetta le sue richieste d'aiuto. Il gioco automatico accetta il regalo prima di una bancarotta.
 * Tabellone Classico: Courmayeur 1 (60) e Aosta 3 (70), case da 50; Olbia 6 (100), Sassari 7 (110), Cagliari 9 (120);
 * Siena 11 (140); Bergamo 37 e Milano 39, case da 200. Un passaggio dalla Partenza vale 200 €.
 */

import { describe, expect, it } from 'vitest';
import {
  aiutoPossibile,
  capacitaDiRientro,
  chiAiuta,
  massimoAiuto,
  mossaBot,
  mosseDeiBot,
  riserva,
  TURNI_TRA_PROPOSTE_BOT,
  valoreInGioco,
} from './bot';
import { casoDaSeme } from './caso';
import { compagni } from './conti';
import { IMPOSTAZIONI_PREDEFINITE } from './impostazioni';
import { creaPartita } from './partita';
import { assegna, dadi, esegui, g, ID, NOMI, partitaASquadre, partitaDiProva, problemi } from './prove';
import { applica, applicaScadenze, prossimaScadenza } from './regole';
import { pacchettoVuoto, regaloDiSquadra } from './scambi';
import { TABELLONI } from './tabelloni';
import type { Azione, IdGiocatore, IdMappa, Pacchetto, Stato } from './tipi';

const VUOTO: Pacchetto = { soldi: 0, caselle: [], grazie: [] };

/** Mette il giocatore in rosso di `rosso` €, tutti dovuti a `creditore`. */
function inRosso(s: Stato, id: IdGiocatore, rosso: number, creditore: IdGiocatore): Stato {
  g(s, id).saldo = -rosso;
  g(s, id).debiti = [{ creditore, importo: rosso }];
  return s;
}

/** Il regalo di soldi da `da` ad `a`, come lo propone il bot. */
function regalo(da: IdGiocatore, a: IdGiocatore, soldi: number, nota = ''): Azione {
  return { tipo: 'proponi', giocatore: da, a, dare: { ...VUOTO, soldi }, avere: VUOTO, nota };
}

/** a e b compagni contro c e d (turni: a, c, b, d). A 'a' mancano 300 €, dovuti a 'c': ha Olbia e Sassari. */
function compagnoInRosso(rosso = 300): Stato {
  return inRosso(assegna(partitaASquadre([0, 0, 1, 1]), 'a', 6, 7), 'a', rosso, 'c');
}

const tutti = () => true;

describe('valore del compagno per la squadra', () => {
  it('quanto incassa da solo: edifici a metà prezzo e proprietà libere da ipotecare, non quelle bloccate dalle case dei compagni', () => {
    // 'a' ha Courmayeur con due case e Olbia; Sassari è ipotecata. 'b', suo compagno, ha Aosta con due case.
    const s = assegna(assegna(partitaASquadre([0, 0, 1, 1]), 'a', 1, 6), 'b', 3);
    s.proprieta[1]!.livello = 2;
    s.proprieta[3]!.livello = 2;
    s.proprieta[7] = { proprietario: 'a', livello: 0, ipotecata: true };
    // Due case di Courmayeur (25 + 25) e Olbia (50). Courmayeur non si ipoteca finché Aosta ha le case.
    expect(capacitaDiRientro(s, 'a')).toBe(100);
    // Courmayeur con le case 160, Olbia 100, Sassari ipotecata 110 − 60 di riscatto, metà delle case di Aosta (50),
    // il posto in partita (due passaggi dalla Partenza, 400). Con 300 € di rosso la liquidazione (130) non avanza niente.
    inRosso(s, 'a', 300, 'c');
    expect(valoreInGioco(s, 'a')).toBe(160 + 100 + 50 + 50 + 400);
    // Con 100 € di rosso avanzerebbero 30 € per il compagno erede.
    inRosso(s, 'a', 100, 'c');
    expect(valoreInGioco(s, 'a')).toBe(760 - 30);
  });
});

describe('il bot offre aiuto al compagno in rosso', () => {
  it('gli regala quello che gli serve, con una nota; accettando esce dal rosso e il creditore è pagato', () => {
    const s = compagnoInRosso();
    expect(aiutoPossibile(s, 'b', 'a')).toBe(300);
    const offerta = mossaBot(s, 'b', { aiutare: tutti });
    expect(offerta).toEqual(regalo('b', 'a', 300, 'Ti passo 300 € per uscire dal rosso: siamo in squadra.'));
    // Senza il permesso della stanza non offre niente.
    expect(mossaBot(s, 'b')).toBeNull();

    let dopo = esegui(s, offerta!).stato;
    expect(regaloDiSquadra(dopo, dopo.scambi[0]!)).toBe(true);
    dopo = esegui(dopo, { tipo: 'accetta', giocatore: 'a', scambio: 1 }).stato;
    expect([g(dopo, 'a').saldo, g(dopo, 'a').debiti, g(dopo, 'b').saldo, g(dopo, 'c').saldo]).toEqual([0, [], 1200, 1800]);
    expect(problemi(dopo)).toEqual([]);
  });

  it('non aiuta senza squadre, non aiuta gli avversari né chi non è in rosso', () => {
    const libera = inRosso(partitaDiProva(3), 'a', 300, 'c');
    expect(aiutoPossibile(libera, 'b', 'a')).toBe(0);
    expect(mossaBot(libera, 'b', { aiutare: tutti })).toBeNull();

    const s = inRosso(partitaASquadre([0, 0, 1, 1]), 'c', 300, 'a');
    expect(aiutoPossibile(s, 'b', 'c')).toBe(0);
    expect(aiutoPossibile(s, 'b', 'a')).toBe(0);
    expect(mossaBot(s, 'b', { aiutare: tutti })).toBeNull();
  });

  it('tiene la sua scorta: metà se senza aiuto il compagno fallirebbe, tutta se ce la farebbe da solo', () => {
    // Bergamo e Milano degli avversari con l'albergo: la scorta del bot è di 600 €.
    const s = assegna(compagnoInRosso(), 'c', 37, 39);
    s.proprieta[37]!.livello = 5;
    s.proprieta[39]!.livello = 5;
    expect(riserva(s, 'b')).toBe(600);
    // 'a' da solo incassa 105 €: con 300 di rosso fallirebbe, e il bot scende fino a 300 € di scorta.
    g(s, 'b').saldo = 700;
    expect(aiutoPossibile(s, 'b', 'a')).toBe(300);
    // Non arriva a tutto: dà 200 €, perché i 100 che mancano 'a' li copre da solo.
    g(s, 'b').saldo = 500;
    expect(aiutoPossibile(s, 'b', 'a')).toBe(200);
    expect(mossaBot(s, 'b', { aiutare: tutti })).toMatchObject({
      dare: { soldi: 200 },
      nota: 'Ti passo 200 € per il rosso: il resto lo copri vendendo o ipotecando.',
    });
    // Con 150 € ne mancherebbero 150, più di quanto 'a' incassa da solo: i soldi andrebbero ai creditori, niente aiuto.
    g(s, 'b').saldo = 450;
    expect(aiutoPossibile(s, 'b', 'a')).toBe(0);

    // Con 100 € di rosso 'a' ce la fa da solo: il bot tiene tutta la scorta e dà solo quello che ha in più.
    inRosso(s, 'a', 100, 'c');
    g(s, 'b').saldo = 650;
    expect(aiutoPossibile(s, 'b', 'a')).toBe(50);
    g(s, 'b').saldo = 700;
    expect(aiutoPossibile(s, 'b', 'a')).toBe(100);
  });

  it('non conviene salvare chi non ha niente, se il rosso costa più del suo posto in partita', () => {
    const s = inRosso(partitaASquadre([0, 0, 1, 1]), 'a', 600, 'c');
    expect(valoreInGioco(s, 'a')).toBe(400);
    expect(aiutoPossibile(s, 'b', 'a')).toBe(0);
    inRosso(s, 'a', 300, 'c');
    expect(aiutoPossibile(s, 'b', 'a')).toBe(300);
  });

  it('aiuta un solo bot: quello che può dare di più, poi il più ricco, poi il primo nei turni', () => {
    // a, b, c compagni contro d (turni: a, d, b, c).
    const s = inRosso(assegna(partitaASquadre([0, 0, 0, 1]), 'a', 6, 7), 'a', 300, 'd');
    g(s, 'b').saldo = 800;
    expect(chiAiuta(s, 'a', ['b', 'c', 'd'])).toBe('c');
    expect(mosseDeiBot(s, ['b', 'c', 'd'], undefined, tutti)).toEqual([
      { giocatore: 'c', azione: regalo('c', 'a', 300, 'Ti passo 300 € per uscire dal rosso: siamo in squadra.') },
    ]);
    g(s, 'b').saldo = 1500;
    expect(chiAiuta(s, 'a', ['b', 'c'])).toBe('b');
    // 'b' può dare solo una parte, e non basterebbe: aiuta 'c'.
    g(s, 'b').saldo = 200;
    expect(chiAiuta(s, 'a', ['b', 'c'])).toBe('c');
    expect(chiAiuta(s, 'a', ['d'])).toBeNull();
    // La stanza non lo permette (per esempio ha già aiutato in questo turno): nessuna offerta.
    expect(mosseDeiBot(s, ['b', 'c', 'd'], undefined, () => false)).toEqual([]);
  });

  it('non aggiunge un secondo regalo e ritira il suo quando il compagno è uscito dal rosso', () => {
    const s = esegui(inRosso(assegna(partitaASquadre([0, 0, 0, 1]), 'a', 6, 7), 'a', 300, 'd'), regalo('b', 'a', 300)).stato;
    expect(mossaBot(s, 'c', { aiutare: tutti })).toBeNull();
    // Il regalo resta finché serve.
    expect(mossaBot(s, 'b', { aiutare: tutti })).toBeNull();
    g(s, 'a').saldo = 20;
    g(s, 'a').debiti = [];
    expect(mossaBot(s, 'b', { aiutare: tutti })).toEqual({ tipo: 'annulla', giocatore: 'b', scambio: 1 });
  });

  it('chi riceve l’aiuto di un altro bot aspetta il regalo prima di vendere o fallire', () => {
    // Tocca a 'b', che è in rosso di 150 € e ha solo Olbia: senza aiuto la venderebbe.
    const s = inRosso(assegna(partitaASquadre([0, 0, 1, 1]), 'b', 6), 'b', 150, 'c');
    s.turno.giocatore = 'b';
    s.turno.fase = 'dopo_lancio';
    expect(mosseDeiBot(s, ['a', 'b'])).toEqual([{ giocatore: 'b', azione: { tipo: 'vendi', giocatore: 'b', casella: 6 } }]);
    const mosse = mosseDeiBot(s, ['a', 'b'], undefined, tutti);
    expect(mosse).toEqual([{ giocatore: 'a', azione: regalo('a', 'b', 150, 'Ti passo 150 € per uscire dal rosso: siamo in squadra.') }]);
    const dopo = esegui(s, mosse[0]!.azione).stato;
    expect(mosseDeiBot(dopo, ['a', 'b'], undefined, tutti)).toEqual([
      { giocatore: 'b', azione: { tipo: 'accetta', giocatore: 'b', scambio: 1 } },
    ]);
  });
});

describe('il bot risponde alle richieste del compagno', () => {
  /** 'a', in rosso di 237 €, chiede soldi a 'b' (con `dare` offre qualcosa in cambio). */
  function richiesta(soldi: number, dare: Pacchetto = VUOTO, rosso = 237): Stato {
    const s = rosso > 0 ? compagnoInRosso(rosso) : assegna(partitaASquadre([0, 0, 1, 1]), 'a', 6, 7);
    return esegui(s, { tipo: 'proponi', giocatore: 'a', a: 'b', dare, avere: { ...VUOTO, soldi }, nota: '' }).stato;
  }

  it('dà fino al rosso arrotondato alle centinaia, se conviene', () => {
    expect(massimoAiuto(compagnoInRosso(237), 'b', 'a')).toBe(300);
    expect(mossaBot(richiesta(237), 'b')).toEqual({ tipo: 'accetta', giocatore: 'b', scambio: 1 });
    expect(mossaBot(richiesta(300), 'b')).toEqual({ tipo: 'accetta', giocatore: 'b', scambio: 1 });
    expect(mossaBot(richiesta(350), 'b')).toEqual({ tipo: 'rifiuta', giocatore: 'b', scambio: 1 });
    // Anche se in cambio offre una sua proprietà: quello che conta è la cifra.
    expect(mossaBot(richiesta(300, { ...VUOTO, caselle: [6] }), 'b')).toEqual({ tipo: 'accetta', giocatore: 'b', scambio: 1 });
    // Accettata, 'a' esce dal rosso.
    const dopo = esegui(richiesta(300), { tipo: 'accetta', giocatore: 'b', scambio: 1 }).stato;
    expect([g(dopo, 'a').saldo, g(dopo, 'b').saldo]).toEqual([63, 1200]);
  });

  it('se può coprire solo una parte, dà al più quella', () => {
    const s = compagnoInRosso();
    g(s, 'b').saldo = 250;
    // Scorta 50: può dare 200, e i 100 che restano 'a' li incassa da solo.
    expect(massimoAiuto(s, 'b', 'a')).toBe(200);
  });

  it('oltre il massimo dell’aiuto decide la regola di sempre: se in cambio offre qualcosa che vale, lo scambio resta buono', () => {
    // 320 € sono più dei 300 dell'aiuto, ma in cambio 'a' dà Olbia e Sassari (per il bot 117 + 128 €): tra compagni
    // ci rimette 75 €, meno di un quarto di quello che dà, quindi accetta come avrebbe fatto prima dell'aiuto.
    expect(mossaBot(richiesta(320, { ...VUOTO, caselle: [6, 7] }), 'b')).toEqual({ tipo: 'accetta', giocatore: 'b', scambio: 1 });
    // Solo soldi oltre il massimo: rifiuta.
    expect(mossaBot(richiesta(320), 'b')).toEqual({ tipo: 'rifiuta', giocatore: 'b', scambio: 1 });
  });

  it('fuori dal rosso, o se chiede le sue proprietà, vale la regola di sempre tra compagni', () => {
    expect(mossaBot(richiesta(300, VUOTO, 0), 'b')).toEqual({ tipo: 'rifiuta', giocatore: 'b', scambio: 1 });
    const s = assegna(compagnoInRosso(), 'b', 11);
    const chiede = esegui(s, { tipo: 'proponi', giocatore: 'a', a: 'b', dare: VUOTO, avere: { ...VUOTO, caselle: [11] }, nota: '' }).stato;
    expect(mossaBot(chiede, 'b')).toEqual({ tipo: 'rifiuta', giocatore: 'b', scambio: 1 });
  });

  it('un bot in rosso accetta il regalo di un compagno', () => {
    const s = esegui(inRosso(partitaASquadre([0, 0, 1, 1]), 'b', 200, 'c'), regalo('a', 'b', 200)).stato;
    expect(mossaBot(s, 'b')).toEqual({ tipo: 'accetta', giocatore: 'b', scambio: 1 });
  });

  it('riconosce i regali di squadra: solo soldi, a un compagno, senza chiedere niente', () => {
    const s = partitaASquadre([0, 0, 1, 1]);
    expect(regaloDiSquadra(s, { da: 'b', a: 'a', dare: { ...VUOTO, soldi: 50 }, avere: VUOTO })).toBe(true);
    expect(regaloDiSquadra(s, { da: 'c', a: 'a', dare: { ...VUOTO, soldi: 50 }, avere: VUOTO })).toBe(false);
    expect(regaloDiSquadra(s, { da: 'b', a: 'a', dare: { soldi: 50, caselle: [6], grazie: [] }, avere: VUOTO })).toBe(false);
    expect(regaloDiSquadra(s, { da: 'b', a: 'a', dare: VUOTO, avere: { ...VUOTO, soldi: 50 } })).toBe(false);
  });
});

describe('gioco automatico in rosso', () => {
  /** Tocca ad 'a', che ha già tirato ed è in rosso di 300 €; `offerta` è la proposta aperta per lui. */
  function scadeIlTempo(offerta?: Azione) {
    let s = compagnoInRosso();
    s.turno.fase = 'dopo_lancio';
    if (offerta) s = esegui(s, offerta).stato;
    const esito = applicaScadenze(s, dadi(), prossimaScadenza(s)!);
    if (!esito?.ok) throw new Error('Nessuna scadenza applicata.');
    return esito;
  }

  it('accetta il regalo del compagno che basta a uscire dal rosso, invece della bancarotta', () => {
    const { stato, eventi } = scadeIlTempo(regalo('b', 'a', 300));
    expect(g(stato, 'a').eliminato).toBeNull();
    expect(g(stato, 'a').saldo).toBe(0);
    expect(stato.turno.giocatore).toBe('c');
    expect(eventi.map((e) => e.tipo)).toEqual(expect.arrayContaining(['tempo_scaduto', 'scambio_accettato', 'turno']));
    expect(problemi(stato)).toEqual([]);
  });

  it('senza un regalo che basti, o se viene da un avversario, fa bancarotta come prima', () => {
    for (const offerta of [undefined, regalo('b', 'a', 200), regalo('c', 'a', 300)]) {
      const { stato } = scadeIlTempo(offerta);
      expect(g(stato, 'a').eliminato).toMatchObject({ motivo: 'bancarotta' });
      expect([g(stato, 'b').saldo, stato.scambi]).toEqual([1500, []]);
    }
  });
});

describe('partite a squadre di soli bot che si aiutano', () => {
  it('i bot si regalano i soldi quando conviene, senza mosse rifiutate né stati incoerenti', { timeout: 120_000 }, () => {
    let aiuti = 0;
    for (let seme = 1; seme <= 8; seme++) aiuti += partitaASquadreDiBot(seme);
    expect(aiuti).toBeGreaterThan(0);
  });
});

/**
 * Una partita a squadre di soli bot, come la gioca la stanza: una mossa alla volta, una proposta normale ogni
 * `TURNI_TRA_PROPOSTE_BOT` turni, un aiuto per compagno a turno. Restituisce quanti aiuti sono stati accettati.
 */
function partitaASquadreDiBot(seme: number): number {
  const caso = casoDaSeme(seme);
  const mappe = Object.keys(TABELLONI) as IdMappa[];
  const n = 4 + 2 * caso.intero(2);
  const creata = creaPartita(
    ID.slice(0, n).map((id, i) => ({ id, nome: NOMI[i]!, colore: i + 1, squadra: i % 2 })),
    {
      ...IMPOSTAZIONI_PREDEFINITE,
      mappa: mappe[caso.intero(mappe.length)]!,
      squadre: true,
      soldiIniziali: 500 + 500 * caso.intero(2),
      aste: caso.intero(2) === 1,
      ipoteche: caso.intero(2) === 1,
      timerTurno: false,
    },
    caso,
  );
  if (!creata.ok) throw new Error(creata.messaggio);
  let s = creata.stato;
  const bot = s.giocatori.map((x) => x.id);
  const ultimaProposta = new Map<IdGiocatore, number>();
  const ultimoAiuto = new Map<IdGiocatore, number>();
  const proporre = (id: IdGiocatore) => s.turno.numero - (ultimaProposta.get(id) ?? -Infinity) >= TURNI_TRA_PROPOSTE_BOT;
  const aiutare = (compagno: IdGiocatore) => ultimoAiuto.get(compagno) !== s.turno.numero;
  let aiuti = 0;
  let adesso = 0;
  for (let azioni = 0; azioni < 6_000 && s.fase === 'in_corso'; azioni++) {
    const mosse = s.asta && adesso >= s.asta.scadenza ? [] : mosseDeiBot(s, bot, proporre, aiutare);
    if (mosse.length > 0) {
      const { azione } = mosse[caso.intero(mosse.length)]!;
      if (azione.tipo === 'proponi') {
        const aiuto = regaloDiSquadra(s, { da: azione.giocatore, a: azione.a, dare: azione.dare, avere: azione.avere });
        (aiuto ? ultimoAiuto : ultimaProposta).set(aiuto ? azione.a : azione.giocatore, s.turno.numero);
      }
      const esito = applica(s, azione, caso, adesso);
      if (!esito.ok) throw new Error(`Seme ${seme}, azione ${azioni}: ${azione.tipo} rifiutata (${esito.messaggio}).`);
      for (const e of esito.eventi) {
        if (e.tipo === 'scambio_accettato' && compagni(s, e.da, e.a) && pacchettoVuoto(e.avere)) aiuti++;
      }
      s = esito.stato;
      adesso += 1_000;
    } else {
      if (!s.asta) throw new Error(`Seme ${seme}, azione ${azioni}: il turno di ${s.turno.giocatore} è fermo.`);
      adesso = Math.max(adesso, prossimaScadenza(s)!);
      const esito = applicaScadenze(s, caso, adesso);
      if (!esito?.ok) throw new Error('Scadenza rifiutata.');
      s = esito.stato;
    }
    const errori = problemi(s);
    if (errori.length) throw new Error(`Seme ${seme}, azione ${azioni}: ${errori.join(' ')}`);
  }
  return aiuti;
}
