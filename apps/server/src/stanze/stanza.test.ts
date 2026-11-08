import { describe, expect, it } from 'vitest';
import { ambienteDiProva, siedi, stanzaDiProva, TOKEN } from './prove';
import { ATTESA_LOBBY_MS, Stanza } from './stanza';

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

  it('dopo l’avvio la lobby è chiusa: niente posti nuovi, impostazioni, colori, espulsioni', () => {
    const { stanza } = stanzaDiProva({ ordineCasuale: false });
    const [, bruno] = siedi(stanza, 'anna', 'bruno');
    stanza.avvia(TOKEN.anna);
    expect(stanza.vista().fase).toBe('partita');
    expect(stanza.siediti(TOKEN.carla, 'Carla', 3)).toMatchObject({ ok: false, codice: 'partita_iniziata' });
    expect(stanza.cambiaImpostazioni(TOKEN.anna, { aste: true })).toMatchObject({ ok: false, codice: 'partita_iniziata' });
    expect(stanza.cambiaColore(TOKEN.anna, 7)).toMatchObject({ ok: false, codice: 'partita_iniziata' });
    expect(stanza.espelli(TOKEN.anna, bruno!)).toMatchObject({ ok: false, codice: 'partita_iniziata' });
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
});
