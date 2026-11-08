import { describe, expect, it } from 'vitest';
import { ASSENZA_MS, BANCA_INIZIALE_MS, GRAZIA_MS } from '@poordown/engine';
import { ambienteDiProva, siedi, stanzaDiProva, TOKEN } from './prove';
import { ATTESA_LOBBY_MS, Stanza } from './stanza';

/** Il primo turno di una partita: grazia più banca iniziale. */
const PRIMO_TURNO_MS = GRAZIA_MS + BANCA_INIZIALE_MS;

describe('lobby', () => {
  it('il primo che si siede diventa host, gli altri entrano in ordine', () => {
    const { stanza } = stanzaDiProva();
    const [anna, bruno] = siedi(stanza, 'anna', 'bruno');
    const vista = stanza.vista();
    expect(vista.host).toBe(anna);
    expect(vista.partecipanti.map((p) => [p.id, p.nome, p.colore, p.connesso])).toEqual([
      [anna, 'Anna', 1, true],
      [bruno, 'Bruno', 2, true],
    ]);
    expect(stanza.io(TOKEN.bruno)).toBe(bruno);
    expect(stanza.io(TOKEN.carla)).toBeNull();
  });

  it('chi non scrive il nome ne riceve uno casuale; il nome viene ripulito', () => {
    const { stanza } = stanzaDiProva();
    stanza.siediti(TOKEN.anna, '   ', 1);
    stanza.siediti(TOKEN.bruno, '  Bruno   Verdi  ', 2);
    const [primo, secondo] = stanza.vista().partecipanti;
    expect(primo!.nome).toMatch(/^\p{Lu}\p{Ll}+ \p{Lu}\p{Ll}+$/u);
    expect(secondo!.nome).toBe('Bruno Verdi');
  });

  it('non si siede due volte, non prende un colore occupato, non entra in una stanza piena', () => {
    const { stanza } = stanzaDiProva({ giocatoriMax: 2 });
    siedi(stanza, 'anna');
    expect(stanza.siediti(TOKEN.anna, 'Anna', 5)).toMatchObject({ ok: false, codice: 'gia_seduto' });
    expect(stanza.siediti(TOKEN.bruno, 'Bruno', 1)).toMatchObject({ ok: false, codice: 'colore_preso' });
    expect(stanza.siediti(TOKEN.bruno, 'Bruno', 13)).toMatchObject({ ok: false, codice: 'richiesta_non_valida' });
    expect(stanza.siediti(TOKEN.bruno, 'Bruno', 2).ok).toBe(true);
    expect(stanza.siediti(TOKEN.carla, 'Carla', 3)).toMatchObject({ ok: false, codice: 'stanza_piena' });
  });

  it('cambio di colore', () => {
    const { stanza } = stanzaDiProva();
    siedi(stanza, 'anna', 'bruno');
    expect(stanza.cambiaColore(TOKEN.anna, 2)).toMatchObject({ ok: false, codice: 'colore_preso' });
    expect(stanza.cambiaColore(TOKEN.anna, 9).ok).toBe(true);
    expect(stanza.cambiaColore(TOKEN.carla, 10)).toMatchObject({ ok: false, codice: 'non_seduto' });
    expect(stanza.vista().partecipanti[0]!.colore).toBe(9);
  });

  it('solo l’host cambia le impostazioni', () => {
    const { stanza } = stanzaDiProva();
    siedi(stanza, 'anna', 'bruno');
    expect(stanza.cambiaImpostazioni(TOKEN.bruno, { soldiIniziali: 3000 })).toMatchObject({ ok: false, codice: 'solo_host' });
    expect(stanza.cambiaImpostazioni(TOKEN.anna, { soldiIniziali: 3000, aste: true }).ok).toBe(true);
    expect(stanza.vista().impostazioni).toMatchObject({ soldiIniziali: 3000, aste: true, giocatoriMax: 4 });
  });

  it('l’host espelle; chi è espulso diventa spettatore e può risedersi', () => {
    const { stanza } = stanzaDiProva();
    const [anna, bruno] = siedi(stanza, 'anna', 'bruno');
    expect(stanza.espelli(TOKEN.bruno, anna!)).toMatchObject({ ok: false, codice: 'solo_host' });
    expect(stanza.espelli(TOKEN.anna, anna!)).toMatchObject({ ok: false, codice: 'richiesta_non_valida' });
    expect(stanza.espelli(TOKEN.anna, bruno!).ok).toBe(true);
    expect(stanza.espelli(TOKEN.anna, bruno!)).toMatchObject({ ok: false, codice: 'giocatore_assente' });
    expect(stanza.vista()).toMatchObject({ spettatori: 1 });
    expect(stanza.io(TOKEN.bruno)).toBeNull();
    expect(stanza.siediti(TOKEN.bruno, 'Bruno', 2).ok).toBe(true);
  });

  it('se l’host esce il ruolo passa al primo della lista', () => {
    const { stanza } = stanzaDiProva();
    const [, bruno, carla] = siedi(stanza, 'anna', 'bruno', 'carla');
    stanza.raccogli();
    stanza.esci('conn-anna');
    expect(stanza.vista().host).toBe(bruno);
    expect(stanza.raccogli()!.map((v) => v.evento.tipo)).toEqual(['uscita', 'nuovo_host']);
    stanza.esci('conn-bruno');
    stanza.esci('conn-carla');
    expect(stanza.vista().host).toBeNull();
    expect(stanza.vista().partecipanti).toEqual([]);
    expect(carla).toBeDefined();
  });

  it('ricaricare la pagina non fa perdere il posto; dopo 2 minuti di assenza sì', () => {
    const { stanza, amb } = stanzaDiProva();
    const [anna, bruno] = siedi(stanza, 'anna', 'bruno');
    stanza.scollega('conn-anna');
    expect(stanza.vista().partecipanti[0]).toMatchObject({ id: anna, connesso: false });
    amb.avanza(ATTESA_LOBBY_MS - 1);
    stanza.manutenzione();
    stanza.collega('conn-anna-2', TOKEN.anna);
    expect(stanza.vista().partecipanti[0]).toMatchObject({ id: anna, connesso: true });
    expect(stanza.vista().host).toBe(anna);

    stanza.scollega('conn-anna-2');
    amb.avanza(ATTESA_LOBBY_MS);
    stanza.manutenzione();
    expect(stanza.vista().partecipanti.map((p) => p.id)).toEqual([bruno]);
    expect(stanza.vista().host).toBe(bruno);
    expect(stanza.registro.at(-2)!.evento).toMatchObject({ tipo: 'uscita', motivo: 'assenza' });
  });

  it('con due schede aperte, chiuderne una non fa risultare disconnessi', () => {
    const { stanza } = stanzaDiProva();
    siedi(stanza, 'anna');
    stanza.collega('seconda-scheda', TOKEN.anna);
    stanza.scollega('conn-anna');
    expect(stanza.vista().partecipanti[0]!.connesso).toBe(true);
    expect(stanza.vista().spettatori).toBe(0);
  });

  it('con due schede aperte, uscire da una non fa perdere il posto; uscire dall’ultima sì', () => {
    const { stanza } = stanzaDiProva();
    const [anna, bruno] = siedi(stanza, 'anna', 'bruno');
    stanza.collega('seconda-scheda', TOKEN.anna);
    stanza.esci('seconda-scheda');
    expect(stanza.io(TOKEN.anna)).toBe(anna);
    expect(stanza.vista().host).toBe(anna);
    stanza.esci('conn-anna');
    expect(stanza.io(TOKEN.anna)).toBeNull();
    expect(stanza.vista().host).toBe(bruno);
  });

  it('nomi, nomi di squadra e messaggi fatti solo di caratteri invisibili valgono come vuoti', () => {
    const { stanza } = stanzaDiProva({ squadre: true });
    stanza.collega('conn-anna', TOKEN.anna);
    stanza.collega('conn-bruno', TOKEN.bruno);
    expect(stanza.siediti(TOKEN.anna, '​​', 1).ok).toBe(true);
    expect(stanza.siediti(TOKEN.bruno, 'ㅤ ⠀', 2).ok).toBe(true);
    for (const p of stanza.vista().partecipanti) expect(p.nome).toMatch(/^\p{Lu}\p{Ll}+ \p{Lu}\p{Ll}+$/u);
    stanza.rinominaSquadra(TOKEN.anna, 0, '﻿­');
    expect(stanza.vista().squadre[0]).toBe('Squadra 1');
    expect(stanza.scrivi(TOKEN.anna, '​')).toMatchObject({ ok: false, codice: 'richiesta_non_valida' });
    expect(stanza.scrivi(TOKEN.anna, ' ⠀ㅤ ', true)).toMatchObject({ ok: false, codice: 'richiesta_non_valida' });
    expect(stanza.chat).toEqual([]);
  });
});

describe('avvio e partita', () => {
  it('servono almeno 2 giocatori e non più del massimo', () => {
    const { stanza } = stanzaDiProva();
    siedi(stanza, 'anna');
    expect(stanza.avvia(TOKEN.anna)).toMatchObject({ ok: false, codice: 'pochi_giocatori' });
    siedi(stanza, 'bruno', 'carla');
    stanza.cambiaImpostazioni(TOKEN.anna, { giocatoriMax: 2 });
    expect(stanza.avvia(TOKEN.anna)).toMatchObject({ ok: false, codice: 'troppi_giocatori' });
    expect(stanza.avvia(TOKEN.bruno)).toMatchObject({ ok: false, codice: 'solo_host' });
    stanza.cambiaImpostazioni(TOKEN.anna, { giocatoriMax: 3 });
    expect(stanza.avvia(TOKEN.anna).ok).toBe(true);
  });

  it('dopo l’avvio la lobby è chiusa: niente posti nuovi, impostazioni, colori', () => {
    const { stanza } = stanzaDiProva({ ordineCasuale: false });
    siedi(stanza, 'anna', 'bruno');
    stanza.avvia(TOKEN.anna);
    expect(stanza.vista().fase).toBe('partita');
    expect(stanza.siediti(TOKEN.carla, 'Carla', 3)).toMatchObject({ ok: false, codice: 'partita_iniziata' });
    expect(stanza.cambiaImpostazioni(TOKEN.anna, { aste: true })).toMatchObject({ ok: false, codice: 'partita_iniziata' });
    expect(stanza.cambiaColore(TOKEN.anna, 7)).toMatchObject({ ok: false, codice: 'partita_iniziata' });
    // In partita chi esce resta al tavolo: può tornare.
    stanza.esci('conn-bruno');
    expect(stanza.vista().partecipanti).toHaveLength(2);
  });

  it('le mosse passano dal motore con il giocatore deciso dal server', () => {
    const { stanza } = stanzaDiProva({ ordineCasuale: false });
    const [anna] = siedi(stanza, 'anna', 'bruno');
    expect(stanza.mossa(TOKEN.anna, { tipo: 'lancia' })).toMatchObject({ ok: false, codice: 'partita_non_in_corso' });
    stanza.avvia(TOKEN.anna);
    expect(stanza.mossa(TOKEN.bruno, { tipo: 'lancia' })).toMatchObject({ ok: false, codice: 'non_tuo_turno' });
    expect(stanza.mossa(TOKEN.carla, { tipo: 'lancia' })).toMatchObject({ ok: false, codice: 'non_seduto' });
    expect(stanza.mossa(TOKEN.anna, { tipo: 'lancia' }).ok).toBe(true);
    expect(stanza.vista().partita!.turno.dadi).not.toBeNull();
    expect(stanza.registro.some((v) => v.evento.tipo === 'dadi' && v.evento.giocatore === anna)).toBe(true);
  });

  it('una bancarotta a due chiude la partita', () => {
    const { stanza } = stanzaDiProva({ ordineCasuale: false });
    const [anna] = siedi(stanza, 'anna', 'bruno');
    stanza.avvia(TOKEN.anna);
    expect(stanza.mossa(TOKEN.bruno, { tipo: 'bancarotta' }).ok).toBe(true);
    expect(stanza.vista()).toMatchObject({ fase: 'finita', partita: { vincitore: anna } });
  });

  it('la vista non contiene l’ordine dei mazzi né i token', () => {
    const { stanza } = stanzaDiProva();
    siedi(stanza, 'anna', 'bruno');
    stanza.avvia(TOKEN.anna);
    const testo = JSON.stringify(stanza.istantanea(TOKEN.anna));
    expect(stanza.vista().partita!.mazzi.busta.ordine).toEqual([]);
    expect(testo).not.toContain(TOKEN.anna);
    expect(testo).not.toContain(TOKEN.bruno);
  });
});

describe('versioni e registro', () => {
  it('ogni pacchetto di modifiche alza la versione di 1, una sola volta', () => {
    const { stanza } = stanzaDiProva();
    expect(stanza.raccogli()).toBeNull();
    siedi(stanza, 'anna', 'bruno');
    expect(stanza.raccogli()!.map((v) => v.evento.tipo)).toEqual(['ingresso', 'ingresso']);
    expect(stanza.versione).toBe(1);
    expect(stanza.raccogli()).toBeNull();
    stanza.cambiaColore(TOKEN.anna, 1);
    expect(stanza.raccogli()).toBeNull();
    stanza.cambiaColore(TOKEN.anna, 8);
    expect(stanza.raccogli()).toEqual([]);
    expect(stanza.vista().versione).toBe(2);
  });

  it('il registro tiene le ultime 100 voci, numerate', () => {
    const { stanza } = stanzaDiProva({ ordineCasuale: false });
    siedi(stanza, 'anna', 'bruno');
    stanza.avvia(TOKEN.anna);
    for (let i = 0; i < 200 && stanza.fase === 'partita'; i++) {
      const turno = stanza.partita!.turno;
      const token = turno.giocatore === stanza.posti[0]!.id ? TOKEN.anna : TOKEN.bruno;
      if (!stanza.mossa(token, { tipo: 'lancia' }).ok) stanza.mossa(token, { tipo: 'fine_turno' });
    }
    expect(stanza.registro.length).toBe(100);
    const numeri = stanza.registro.map((v) => v.n);
    expect(numeri).toEqual(numeri.map((_, i) => numeri[0]! + i));
  });
});

describe('chat', () => {
  it('scrivono solo i giocatori seduti; si tengono gli ultimi 50 messaggi', () => {
    const { stanza } = stanzaDiProva();
    siedi(stanza, 'anna');
    stanza.collega('conn-bruno', TOKEN.bruno);
    expect(stanza.scrivi(TOKEN.bruno, 'ciao')).toMatchObject({ ok: false, codice: 'non_seduto' });
    expect(stanza.scrivi(TOKEN.anna, '   ')).toMatchObject({ ok: false, codice: 'richiesta_non_valida' });
    expect(stanza.scrivi(TOKEN.anna, 'x'.repeat(1001))).toMatchObject({ ok: false, codice: 'richiesta_non_valida' });
    const esito = stanza.scrivi(TOKEN.anna, '  ciao a tutti ');
    expect(esito).toMatchObject({ ok: true, dati: { nome: 'Anna', colore: 1, testo: 'ciao a tutti' } });
    for (let i = 0; i < 60; i++) stanza.scrivi(TOKEN.anna, `messaggio ${i}`);
    expect(stanza.chat).toHaveLength(50);
    expect(stanza.chat.at(-1)!.testo).toBe('messaggio 59');
    // La chat non cambia la versione della stanza.
    stanza.raccogli();
    stanza.scrivi(TOKEN.anna, 'ancora');
    expect(stanza.raccogli()).toBeNull();
  });
});

describe('salvataggio', () => {
  it('esporta e reimporta una partita in corso; al ritorno tutti risultano disconnessi', () => {
    const amb = ambienteDiProva();
    const { stanza } = stanzaDiProva({ ordineCasuale: false }, amb);
    siedi(stanza, 'anna', 'bruno');
    stanza.avvia(TOKEN.anna);
    stanza.mossa(TOKEN.anna, { tipo: 'lancia' });
    stanza.scrivi(TOKEN.anna, 'ciao');
    stanza.raccogli();

    const copia = Stanza.importa(JSON.parse(JSON.stringify(stanza.esporta())), amb);
    expect(copia.partita).toEqual(stanza.partita);
    expect(copia.versione).toBe(stanza.versione);
    expect(copia.vista().partecipanti.every((p) => !p.connesso)).toBe(true);
    copia.collega('nuova', TOKEN.anna);
    expect(copia.io(TOKEN.anna)).toBe(stanza.io(TOKEN.anna));
    // I contatori ripartono da dove erano: niente numeri doppi nel registro e nella chat.
    copia.scrivi(TOKEN.anna, 'di nuovo');
    expect(copia.chat.map((m) => m.n)).toEqual([1, 2]);
  });

  it('dati che non hanno la forma di una stanza salvata vengono rifiutati subito', () => {
    const amb = ambienteDiProva();
    const { stanza } = stanzaDiProva({ ordineCasuale: false }, amb);
    siedi(stanza, 'anna', 'bruno');
    const buona = () => JSON.parse(JSON.stringify(stanza.esporta())) as Record<string, unknown>;
    const rovinate: [string, (d: Record<string, unknown>) => void][] = [
      ['senza registro', (d) => delete d.registro],
      ['posti null', (d) => (d.posti = null)],
      ['un posto null', (d) => (d.posti = [null])],
      ['chat non lista', (d) => (d.chat = {})],
      ['fase sconosciuta', (d) => (d.fase = 'pausa')],
      ['codice numerico', (d) => (d.codice = 12345)],
      ['fase partita senza partita', (d) => (d.fase = 'partita')],
      ['senza contatori', (d) => delete d.prossimaVoce],
    ];
    for (const [nome, rovina] of rovinate) {
      const dati = buona();
      rovina(dati);
      expect(() => Stanza.importa(dati as never, amb), nome).toThrow(/non valida/);
    }
    expect(Stanza.importa(buona() as never, amb).posti).toHaveLength(2);
  });
});

describe('economia e tempo', () => {
  /** Partita a due con le aste: Anna è ferma su Courmayeur (libera) e deve decidere. */
  function astaPronta() {
    const amb = ambienteDiProva();
    const { stanza } = stanzaDiProva({ ordineCasuale: false, aste: true }, amb);
    const [anna, bruno] = siedi(stanza, 'anna', 'bruno');
    stanza.avvia(TOKEN.anna);
    const p = stanza.partita!;
    p.turno = { ...p.turno, fase: 'dopo_lancio', dadi: [1, 2], acquisto: 1 };
    p.giocatori[0]!.posizione = 1;
    return { amb, stanza, anna: anna!, bruno: bruno! };
  }

  it('l’asta usa l’orologio del server e si chiude da sola alla scadenza', () => {
    const { amb, stanza, bruno } = astaPronta();
    // Prima dell'asta l'unica scadenza è il tempo del turno.
    expect(stanza.attesa()).toBe(PRIMO_TURNO_MS);
    expect(stanza.mossa(TOKEN.anna, { tipo: 'asta' }).ok).toBe(true);
    expect(stanza.partita!.asta!.scadenza).toBe(amb.adesso() + 10_000);
    expect(stanza.attesa()).toBe(10_000);

    amb.avanza(4_000);
    expect(stanza.mossa(TOKEN.bruno, { tipo: 'offri', importo: 12 }).ok).toBe(true);
    expect(stanza.attesa()).toBe(10_000);
    amb.avanza(9_999);
    stanza.manutenzione();
    expect(stanza.partita!.asta).not.toBeNull();
    amb.avanza(1);
    stanza.manutenzione();
    expect(stanza.partita!.asta).toBeNull();
    expect(stanza.partita!.proprieta[1]!.proprietario).toBe(bruno);
    expect(stanza.registro.at(-1)!.evento).toEqual({ tipo: 'asta_vinta', giocatore: bruno, casella: 1, importo: 12 });
    // Durante l'asta il tempo del turno era fermo: riparte intero.
    expect(stanza.attesa()).toBe(PRIMO_TURNO_MS);
  });

  it('un’offerta arrivata dopo la fine dell’asta non la riapre: prima si chiude l’asta, anche senza sveglia', () => {
    const { amb, stanza, bruno } = astaPronta();
    stanza.mossa(TOKEN.anna, { tipo: 'asta' });
    expect(stanza.mossa(TOKEN.bruno, { tipo: 'offri', importo: 10 }).ok).toBe(true);
    amb.avanza(10_000);
    // Nessuna manutenzione né sveglia: arriva prima il rilancio di Anna.
    expect(stanza.mossa(TOKEN.anna, { tipo: 'offri', importo: 12 }).ok).toBe(false);
    expect(stanza.partita!.asta).toBeNull();
    expect(stanza.partita!.proprieta[1]!.proprietario).toBe(bruno);
    expect(stanza.raccogli()!.map((v) => v.evento)).toContainEqual({ tipo: 'asta_vinta', giocatore: bruno, casella: 1, importo: 10 });
  });

  it('le attività sugli scambi arrivano a tutti e spariscono con lo scambio o con il giocatore', () => {
    const { stanza, anna, bruno } = astaPronta();
    stanza.raccogliAttivita();
    stanza.cambiaAttivita(TOKEN.bruno, { tipo: 'crea' });
    expect(stanza.raccogliAttivita()).toEqual({ [bruno]: { tipo: 'crea' } });
    expect(stanza.raccogliAttivita()).toBeNull();
    // Gli spettatori non hanno attività.
    stanza.collega('conn-carla', TOKEN.carla);
    stanza.cambiaAttivita(TOKEN.carla, { tipo: 'crea' });
    expect(stanza.raccogliAttivita()).toBeNull();

    const pacchetto = { soldi: 10, caselle: [], grazie: [] };
    const vuoto = { soldi: 0, caselle: [], grazie: [] };
    expect(stanza.mossa(TOKEN.bruno, { tipo: 'proponi', a: anna, dare: pacchetto, avere: vuoto, nota: '' }).ok).toBe(true);
    const id = stanza.partita!.scambi[0]!.id;
    stanza.cambiaAttivita(TOKEN.anna, { tipo: 'guarda', scambio: id });
    stanza.cambiaAttivita(TOKEN.bruno, { tipo: 'guarda', scambio: id });
    expect(stanza.raccogliAttivita()).toEqual({ [anna]: { tipo: 'guarda', scambio: id }, [bruno]: { tipo: 'guarda', scambio: id } });
    stanza.scollega('conn-bruno');
    expect(stanza.raccogliAttivita()).toEqual({ [anna]: { tipo: 'guarda', scambio: id } });
    expect(stanza.mossa(TOKEN.anna, { tipo: 'rifiuta', scambio: id }).ok).toBe(true);
    expect(stanza.raccogliAttivita()).toEqual({});
  });

  it('le partite salvate prima delle aste e degli scambi riprendono', () => {
    const { amb, stanza } = astaPronta();
    const dati = JSON.parse(JSON.stringify(stanza.esporta())) as ReturnType<Stanza['esporta']>;
    const vecchia = dati.partita as unknown as Record<string, unknown>;
    delete vecchia.asta;
    delete vecchia.scambi;
    delete vecchia.prossimoScambio;
    const copia = Stanza.importa(dati, amb);
    expect(copia.partita).toMatchObject({ asta: null, scambi: [], prossimoScambio: 1 });
    expect(copia.mossa(TOKEN.anna, { tipo: 'compra' }).ok).toBe(true);
  });
});

describe('tempo, assenze e moderazione', () => {
  function partitaA(nomi: ('anna' | 'bruno' | 'carla')[], impostazioni = {}) {
    const amb = ambienteDiProva();
    const { stanza } = stanzaDiProva({ ordineCasuale: false, ...impostazioni }, amb);
    const id = siedi(stanza, ...nomi);
    stanza.avvia(TOKEN.anna);
    stanza.raccogli();
    return { amb, stanza, id };
  }

  const motivoUscita = (stanza: Stanza) =>
    stanza.registro.map((v) => v.evento).find((e) => e.tipo === 'rimozione');

  it('allo scadere del tempo il server gioca il turno al posto di chi non c’è', () => {
    const { amb, stanza, id } = partitaA(['anna', 'bruno']);
    amb.avanza(PRIMO_TURNO_MS);
    stanza.scadenze();
    expect(stanza.registro.some((v) => v.evento.tipo === 'tempo_scaduto')).toBe(true);
    expect(stanza.partita!.turno.giocatore).toBe(id[1]);
  });

  it('chi chiude la pagina risulta assente nella partita e dopo due minuti esce; in due la partita finisce', () => {
    const { amb, stanza, id } = partitaA(['anna', 'bruno'], { timerTurno: false });
    stanza.scollega('conn-bruno');
    expect(stanza.partita!.giocatori[1]!.offlineDa).toBe(amb.adesso());
    expect(stanza.attesa()).toBe(ASSENZA_MS);
    amb.avanza(ASSENZA_MS);
    stanza.manutenzione();
    expect(motivoUscita(stanza)).toMatchObject({ giocatore: id[1], motivo: 'assenza' });
    expect(stanza.vista()).toMatchObject({ fase: 'finita', partita: { vincitore: id[0] } });
  });

  it('chi torna prima dei due minuti riprende il suo posto', () => {
    const { amb, stanza } = partitaA(['anna', 'bruno'], { timerTurno: false });
    stanza.scollega('conn-bruno');
    amb.avanza(ASSENZA_MS - 1);
    stanza.collega('conn-bruno-2', TOKEN.bruno);
    expect(stanza.partita!.giocatori[1]!.offlineDa).toBeNull();
    amb.avanza(ASSENZA_MS);
    stanza.manutenzione();
    expect(stanza.vista().fase).toBe('partita');
  });

  it('se nessun giocatore è collegato la partita si ferma, e riparte da dove era', () => {
    const { amb, stanza } = partitaA(['anna', 'bruno']);
    amb.avanza(10_000);
    stanza.scollega('conn-bruno');
    stanza.scollega('conn-anna');
    expect(stanza.inPausa()).toBe(true);
    expect(stanza.attesa()).toBeNull();
    // Un'ora dopo non è successo niente.
    amb.avanza(60 * 60_000);
    stanza.manutenzione();
    expect(stanza.vista().fase).toBe('partita');
    expect(stanza.registro.some((v) => v.evento.tipo === 'tempo_scaduto')).toBe(false);

    // Torna Anna: il suo turno ha ancora 70 s, Bruno ha due minuti da adesso per tornare.
    stanza.collega('conn-anna-2', TOKEN.anna);
    expect(stanza.inPausa()).toBe(false);
    expect(stanza.attesa()).toBe(PRIMO_TURNO_MS - 10_000);
    expect(stanza.partita!.giocatori[1]!.offlineDa).toBe(amb.adesso());
  });

  it('dopo un riavvio la partita è in pausa dal salvataggio finché qualcuno torna', () => {
    const { amb, stanza } = partitaA(['anna', 'bruno']);
    amb.avanza(5_000);
    const dati = JSON.parse(JSON.stringify(stanza.esporta())) as ReturnType<Stanza['esporta']>;
    amb.avanza(30 * 60_000);
    const copia = Stanza.importa(dati, amb);
    expect(copia.inPausa()).toBe(true);
    copia.collega('nuova', TOKEN.anna);
    expect(copia.attesa()).toBe(PRIMO_TURNO_MS - 5_000);
  });

  it('le partite salvate prima del timer riprendono con gli orologi da capo', () => {
    const { amb, stanza } = partitaA(['anna', 'bruno']);
    const dati = JSON.parse(JSON.stringify(stanza.esporta())) as ReturnType<Stanza['esporta']>;
    const vecchia = dati.partita as unknown as { giocatori: Record<string, unknown>[]; turno: Record<string, unknown> };
    for (const g of vecchia.giocatori) {
      delete g.banca;
      delete g.automatici;
      delete g.offlineDa;
    }
    delete vecchia.turno.tempo;
    delete vecchia.turno.votazione;
    delete dati.pausaDa;
    const copia = Stanza.importa(dati, amb);
    expect(copia.partita!.giocatori[0]).toMatchObject({ banca: BANCA_INIZIALE_MS, automatici: 0, offlineDa: null });
    expect(copia.partita!.turno.votazione).toEqual({ voti: [], scadenza: null });
    copia.collega('nuova', TOKEN.anna);
    expect(copia.attesa()).toBe(GRAZIA_MS + BANCA_INIZIALE_MS);
    expect(copia.mossa(TOKEN.anna, { tipo: 'lancia' }).ok).toBe(true);
  });

  it('in una stanza privata l’host toglie un giocatore, ma non mentre gioca: perde anche il posto', () => {
    const { stanza, id } = partitaA(['anna', 'bruno', 'carla']);
    const [, bruno, carla] = id;
    expect(stanza.espelli(TOKEN.bruno, carla!)).toMatchObject({ ok: false, codice: 'solo_host' });
    // Tocca ad Anna: può togliere Carla, non sé stessa.
    expect(stanza.espelli(TOKEN.anna, id[0]!)).toMatchObject({ ok: false, codice: 'richiesta_non_valida' });
    expect(stanza.espelli(TOKEN.anna, carla!).ok).toBe(true);
    expect(motivoUscita(stanza)).toMatchObject({ giocatore: carla, motivo: 'espulsione' });
    expect(stanza.io(TOKEN.carla)).toBeNull();
    expect(stanza.scrivi(TOKEN.carla, 'ehi')).toMatchObject({ ok: false, codice: 'non_seduto' });
    expect(stanza.vista().partecipanti.map((p) => p.id)).toEqual([id[0], bruno]);
  });

  it('chi sta giocando il suo turno non si toglie; nelle stanze pubbliche l’host non toglie nessuno', () => {
    const privata = partitaA(['anna', 'bruno', 'carla'], { timerTurno: false });
    const [anna, bruno] = privata.id;
    // Anna finisce il turno: ora tocca a Bruno, che non si può togliere.
    privata.stanza.mossa(TOKEN.anna, { tipo: 'lancia' });
    if (privata.stanza.partita!.turno.giocatore === anna) privata.stanza.mossa(TOKEN.anna, { tipo: 'fine_turno' });
    expect(privata.stanza.partita!.turno.giocatore).toBe(bruno);
    expect(privata.stanza.espelli(TOKEN.anna, bruno!)).toMatchObject({ ok: false, codice: 'sta_giocando' });

    const pubblica = partitaA(['anna', 'bruno', 'carla'], { stanzaPrivata: false });
    expect(pubblica.stanza.espelli(TOKEN.anna, pubblica.id[2]!)).toMatchObject({ ok: false, codice: 'solo_host' });
  });

  it('l’host uscito dalla partita resta host finché guarda, ma non toglie più nessuno; se se ne va il ruolo passa', () => {
    const { stanza, id } = partitaA(['anna', 'bruno', 'carla']);
    const [anna, bruno, carla] = id;
    stanza.mossa(TOKEN.anna, { tipo: 'bancarotta' });
    expect(stanza.vista().host).toBe(anna);
    // Tocca a Bruno: Carla non sta giocando, ma Anna è fuori dalla partita e non può toglierla.
    expect(stanza.espelli(TOKEN.anna, carla!)).toMatchObject({ ok: false, codice: 'solo_host' });
    expect(stanza.partita!.giocatori.find((g) => g.id === carla)!.eliminato).toBeNull();
    // Ricaricando la pagina in un'altra scheda resta host.
    stanza.collega('conn-anna-2', TOKEN.anna);
    stanza.scollega('conn-anna');
    expect(stanza.vista().host).toBe(anna);
    // Chiude anche l'ultima scheda: l'host diventa la prima persona collegata ancora in gioco.
    stanza.raccogli();
    stanza.scollega('conn-anna-2');
    expect(stanza.vista().host).toBe(bruno);
    expect(stanza.raccogli()!.map((v) => v.evento)).toEqual([{ tipo: 'nuovo_host', giocatore: bruno, nome: 'Bruno' }]);
    expect(stanza.espelli(TOKEN.bruno, carla!).ok).toBe(true);
  });

  it('l’host fuori dalla partita e scollegato passa il ruolo al primo che torna, se nessuno in gioco è collegato', () => {
    const { stanza, id } = partitaA(['anna', 'bruno', 'carla']);
    stanza.scollega('conn-bruno');
    stanza.scollega('conn-carla');
    stanza.mossa(TOKEN.anna, { tipo: 'bancarotta' });
    stanza.scollega('conn-anna');
    // Nessuno in gioco è collegato: il ruolo resta ad Anna finché non torna qualcuno che gioca.
    expect(stanza.vista().host).toBe(id[0]);
    stanza.collega('conn-carla-2', TOKEN.carla);
    expect(stanza.vista().host).toBe(id[2]);
  });

  it('se l’host esce per assenza il ruolo passa al primo giocatore ancora in gioco', () => {
    const { amb, stanza, id } = partitaA(['anna', 'bruno', 'carla'], { timerTurno: false });
    // Anna finisce il turno e se ne va.
    stanza.mossa(TOKEN.anna, { tipo: 'lancia' });
    if (stanza.partita!.turno.giocatore === id[0]) stanza.mossa(TOKEN.anna, { tipo: 'fine_turno' });
    stanza.scollega('conn-anna');
    amb.avanza(ASSENZA_MS);
    stanza.manutenzione();
    expect(motivoUscita(stanza)).toMatchObject({ giocatore: id[0], motivo: 'assenza' });
    expect(stanza.vista().host).toBe(id[1]);
    expect(stanza.registro.at(-1)!.evento).toMatchObject({ tipo: 'nuovo_host', giocatore: id[1] });
  });

  it('se l’ultimo giocatore collegato esce dalla partita, la partita va in pausa (con o senza ricaricare la pagina)', () => {
    const esito = (ricarica: boolean) => {
      const { amb, stanza } = partitaA(['anna', 'bruno', 'carla'], { timerTurno: false });
      stanza.scollega('conn-bruno');
      stanza.scollega('conn-carla');
      expect(stanza.inPausa()).toBe(false);
      stanza.mossa(TOKEN.anna, { tipo: 'bancarotta' });
      if (ricarica) {
        stanza.scollega('conn-anna');
        stanza.collega('conn-anna-2', TOKEN.anna);
      }
      // Anna guarda, ma è fuori dalla partita: non conta.
      expect(stanza.inPausa()).toBe(true);
      amb.avanza(ASSENZA_MS + 1);
      stanza.manutenzione();
      return { fase: stanza.fase, usciti: stanza.partita!.giocatori.filter((g) => g.eliminato).length };
    };
    expect(esito(false)).toEqual({ fase: 'partita', usciti: 1 });
    expect(esito(true)).toEqual({ fase: 'partita', usciti: 1 });
  });

  it('chiedi tempo, +1 min e voto passano dal motore come le altre mosse', () => {
    const { stanza } = partitaA(['anna', 'bruno']);
    expect(stanza.mossa(TOKEN.anna, { tipo: 'chiedi_tempo' }).ok).toBe(true);
    expect(stanza.mossa(TOKEN.bruno, { tipo: 'regala_tempo' }).ok).toBe(true);
    expect(stanza.mossa(TOKEN.bruno, { tipo: 'vota', favorevole: true })).toMatchObject({ ok: false, codice: 'voto_non_disponibile' });
  });
});

describe('fine partita', () => {
  /** Anna, Bruno e Carla giocano con 3000 euro; Bruno e Carla fanno bancarotta e vince Anna. */
  function finita(amb = ambienteDiProva()) {
    const { stanza } = stanzaDiProva({ ordineCasuale: false, soldiIniziali: 3000 }, amb);
    const ids = siedi(stanza, 'anna', 'bruno', 'carla');
    stanza.avvia(TOKEN.anna);
    expect(stanza.nuovaPartita(TOKEN.anna)).toMatchObject({ ok: false, codice: 'partita_non_finita' });
    stanza.mossa(TOKEN.carla, { tipo: 'bancarotta' });
    stanza.mossa(TOKEN.bruno, { tipo: 'bancarotta' });
    expect(stanza.fase).toBe('finita');
    stanza.raccogli();
    return { stanza, amb, ids };
  }

  it('«Un’altra partita» riporta la stanza in lobby con le stesse impostazioni e gli stessi posti', () => {
    const { stanza, ids } = finita();
    const prima = stanza.vista().partecipanti;
    expect(stanza.nuovaPartita(TOKEN.bruno)).toMatchObject({ ok: false, codice: 'solo_host' });
    expect(stanza.nuovaPartita(TOKEN.dario)).toMatchObject({ ok: false, codice: 'non_seduto' });
    expect(stanza.nuovaPartita(TOKEN.anna).ok).toBe(true);
    const vista = stanza.vista();
    expect(vista).toMatchObject({ fase: 'lobby', partita: null, host: ids[0], impostazioni: { soldiIniziali: 3000 } });
    expect(vista.partecipanti).toEqual(prima);
    // Il registro riparte da capo.
    expect(stanza.raccogli()!.map((v) => v.evento)).toEqual([{ tipo: 'nuova_partita', giocatore: ids[0], nome: 'Anna' }]);
    expect(stanza.registro.map((v) => v.evento.tipo)).toEqual(['nuova_partita']);
    expect(stanza.avvia(TOKEN.anna).ok).toBe(true);
    expect(stanza.partita!.giocatori.map((g) => g.id)).toEqual(ids);
  });

  it('se l’host non è collegato ci pensa un altro giocatore, che diventa host; chi manca ha due minuti per tornare', () => {
    const { stanza, amb, ids } = finita();
    stanza.scollega('conn-anna');
    amb.avanza(10 * 60_000);
    expect(stanza.nuovaPartita(TOKEN.carla).ok).toBe(true);
    expect(stanza.vista().host).toBe(ids[2]);
    expect(stanza.raccogli()!.map((v) => v.evento.tipo)).toEqual(['nuova_partita', 'nuovo_host']);
    amb.avanza(ATTESA_LOBBY_MS - 1);
    stanza.manutenzione();
    expect(stanza.posti.map((p) => p.id)).toEqual(ids);
    amb.avanza(1);
    stanza.manutenzione();
    expect(stanza.posti.map((p) => p.id)).toEqual(ids.slice(1));
  });

  it('se due premono «Un’altra partita» insieme, il secondo trova la stanza già in lobby e va bene così', () => {
    const { stanza, ids } = finita();
    stanza.scollega('conn-anna');
    expect(stanza.nuovaPartita(TOKEN.bruno).ok).toBe(true);
    stanza.raccogli();
    expect(stanza.nuovaPartita(TOKEN.carla)).toEqual({ ok: true, dati: null });
    expect(stanza.raccogli()).toBeNull();
    expect(stanza.vista().host).toBe(ids[1]);
    // Chi guarda soltanto riceve sempre il rifiuto.
    expect(stanza.nuovaPartita(TOKEN.dario)).toMatchObject({ ok: false, codice: 'non_seduto' });
  });

  it('chi torna alla home a partita finita libera il posto, e l’host passa al successivo', () => {
    const { stanza, ids } = finita();
    stanza.esci('conn-anna');
    expect(stanza.posti.map((p) => p.id)).toEqual(ids.slice(1));
    expect(stanza.vista()).toMatchObject({ fase: 'finita', host: ids[1] });
    expect(stanza.raccogli()!.map((v) => v.evento.tipo)).toEqual(['uscita', 'nuovo_host']);
    expect(stanza.nuovaPartita(TOKEN.bruno).ok).toBe(true);
    expect(stanza.vista().partecipanti.map((p) => p.id)).toEqual(ids.slice(1));
  });

  it('i messaggi scritti durante la partita entrano nelle statistiche', () => {
    const { stanza } = stanzaDiProva({ ordineCasuale: false });
    siedi(stanza, 'anna', 'bruno');
    stanza.scrivi(TOKEN.anna, 'in lobby non conta');
    stanza.avvia(TOKEN.anna);
    stanza.scrivi(TOKEN.anna, 'ciao');
    stanza.scrivi(TOKEN.bruno, 'ciao a te');
    stanza.mossa(TOKEN.bruno, { tipo: 'bancarotta' });
    stanza.scrivi(TOKEN.anna, 'a partita finita non conta');
    expect(stanza.vista().partita!.statistiche).toMatchObject({ messaggi: 2, uscite: [stanza.posti[1]!.id] });
    // A partita finita i browser ricevono anche il grafico del patrimonio.
    expect(stanza.vista().partita!.statistiche.patrimonio.length).toBeGreaterThan(0);
  });

  it('le partite salvate prima delle statistiche riprendono, anche quelle già finite', () => {
    const { stanza, amb } = finita();
    const dati = JSON.parse(JSON.stringify(stanza.esporta())) as ReturnType<Stanza['esporta']>;
    delete (dati.partita as unknown as Record<string, unknown>).statistiche;
    const copia = Stanza.importa(dati, amb);
    expect(copia.partita!.statistiche).toMatchObject({ fine: amb.adesso(), patrimonio: [], messaggi: 0 });
    expect(copia.partita!.statistiche.uscite).toHaveLength(2);
    expect(copia.partita!.statistiche.visite).toHaveLength(40);
  });
});
