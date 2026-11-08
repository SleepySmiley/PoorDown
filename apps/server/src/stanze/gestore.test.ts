import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Archivio } from './archivio';
import { GestoreStanze, normalizzaCodice, SCADENZA_STANZA_MS, SCADENZA_STANZA_VUOTA_MS, STANZE_MAX } from './gestore';
import { leggiImpostazioni, leggiMossa, leggiToken } from './lettura';
import { ambienteDiProva, siedi, TOKEN } from './prove';
import { ATTESA_LOBBY_MS, type Stanza } from './stanza';

afterEach(() => {
  vi.restoreAllMocks();
});

/** Accende i bot e aspetta che riempiano la stanza. */
function riempiDiBot(stanza: Stanza, amb: ReturnType<typeof ambienteDiProva>, host: string): void {
  stanza.cambiaImpostazioni(host, { bot: true });
  for (let attesa = stanza.attesa(); attesa !== null; attesa = stanza.attesa()) {
    amb.avanza(attesa);
    stanza.scadenze();
  }
}

describe('codici delle stanze', () => {
  it('5 caratteri senza lettere e cifre che si confondono', () => {
    const gestore = new GestoreStanze(ambienteDiProva());
    const codici = Array.from({ length: 100 }, () => gestore.crea(true)!.codice);
    expect(new Set(codici).size).toBe(100);
    for (const codice of codici) expect(codice).toMatch(/^[a-hj-km-np-z2-9]{5}$/);
  });

  it('si ritrovano anche scritti in maiuscolo o con spazi', () => {
    const gestore = new GestoreStanze(ambienteDiProva());
    const { codice } = gestore.crea(true)!;
    expect(gestore.trova(` ${codice.toUpperCase()} `)?.codice).toBe(codice);
    expect(normalizzaCodice('abc')).toBeNull();
    expect(normalizzaCodice('ab-de')).toBeNull();
    expect(gestore.trova('zzzzz')).toBeUndefined();
  });

  it('c’è un limite al numero di stanze', () => {
    const gestore = new GestoreStanze(ambienteDiProva());
    for (let i = 0; i < STANZE_MAX; i++) gestore.crea(true);
    expect(gestore.crea(true)).toBeNull();
  });
});

describe('elenco e "Gioca"', () => {
  it('l’elenco mostra solo le stanze pubbliche non finite con qualcuno seduto, prima quelle in attesa e più piene', () => {
    const gestore = new GestoreStanze(ambienteDiProva());
    gestore.crea(true);
    const vuota = gestore.crea(false)!;
    const piena = gestore.crea(false)!;
    siedi(piena, 'anna', 'bruno');
    const conUno = gestore.crea(false)!;
    siedi(conUno, 'dario');
    const inCorso = gestore.crea(false)!;
    siedi(inCorso, 'carla', 'dario');
    inCorso.avvia(TOKEN.carla);
    // Chi ha appena creato una stanza ed è entrato, ma non si è ancora seduto, non la fa comparire.
    vuota.collega('scheda', TOKEN.anna);

    expect(gestore.elenco().map((s) => s.codice)).toEqual([piena.codice, conUno.codice, inCorso.codice]);
    expect(gestore.elenco()[0]).toMatchObject({
      fase: 'lobby',
      giocatori: [
        { nome: 'Anna', colore: 1 },
        { nome: 'Bruno', colore: 2 },
      ],
      giocatoriMax: 4,
      mappa: 'classica',
    });
    expect(JSON.stringify(gestore.elenco())).not.toContain(TOKEN.anna);
  });

  it('"Gioca" sceglie la stanza pubblica in attesa più piena con un posto libero, altrimenti ne crea una', () => {
    const gestore = new GestoreStanze(ambienteDiProva());
    const privata = gestore.crea(true)!;
    siedi(privata, 'anna');
    const nuova = gestore.gioca()!;
    expect(nuova.codice).not.toBe(privata.codice);
    expect(nuova.impostazioni.stanzaPrivata).toBe(false);

    siedi(nuova, 'bruno');
    expect(gestore.gioca()!.codice).toBe(nuova.codice);
    nuova.cambiaImpostazioni(TOKEN.bruno, { giocatoriMax: 2 });
    siedi(nuova, 'carla');
    expect(gestore.gioca()!.codice).not.toBe(nuova.codice);
  });

  it('"Gioca" porta anche nelle stanze piene di bot, prima in quelle con più persone', () => {
    const amb = ambienteDiProva();
    const gestore = new GestoreStanze(amb);
    const conBot = gestore.crea(false)!;
    siedi(conBot, 'anna');
    riempiDiBot(conBot, amb, TOKEN.anna);
    expect(conBot.posti.map((p) => p.bot)).toEqual([false, true, true, true]);
    expect(gestore.gioca()).toBe(conBot);

    const conDue = gestore.crea(false)!;
    siedi(conDue, 'bruno', 'carla');
    conDue.cambiaImpostazioni(TOKEN.bruno, { giocatoriMax: 3 });
    expect(gestore.gioca()).toBe(conDue);
    siedi(conDue, 'dario');
    expect(gestore.gioca()).toBe(conBot);
  });
});

describe('pulizia', () => {
  it('chiude le stanze con giocatori ma senza nessuno collegato da 30 minuti', () => {
    const amb = ambienteDiProva();
    const gestore = new GestoreStanze(amb);
    const abbandonata = gestore.crea(true)!;
    siedi(abbandonata, 'anna', 'bruno');
    abbandonata.avvia(TOKEN.anna);
    abbandonata.scollega('conn-anna');
    abbandonata.scollega('conn-bruno');
    const viva = gestore.crea(true)!;
    viva.collega('scheda', TOKEN.carla);

    amb.avanza(SCADENZA_STANZA_MS - 1);
    expect(gestore.manutenzione().chiuse).toEqual([]);
    amb.avanza(1);
    const { chiuse } = gestore.manutenzione();
    expect(chiuse.map((s) => s.codice)).toEqual([abbandonata.codice]);
    expect(gestore.trova(abbandonata.codice)).toBeUndefined();
    expect(gestore.trova(viva.codice)).toBe(viva);
  });

  it('chiude dopo 5 minuti le stanze senza persone sedute e senza nessuno collegato', () => {
    const amb = ambienteDiProva();
    const gestore = new GestoreStanze(amb);
    const maiAperta = gestore.crea(false)!;
    const lasciata = gestore.crea(true)!;
    siedi(lasciata, 'anna');
    lasciata.scollega('conn-anna');
    const guardata = gestore.crea(true)!;
    guardata.collega('scheda', TOKEN.bruno);

    amb.avanza(SCADENZA_STANZA_VUOTA_MS - 1);
    expect(gestore.manutenzione().chiuse).toEqual([]);
    // Anna ha perso il posto dopo 2 minuti: ora anche la sua stanza è vuota.
    expect(lasciata.posti).toEqual([]);
    amb.avanza(1);
    expect(gestore.manutenzione().chiuse.map((s) => s.codice)).toEqual([maiAperta.codice, lasciata.codice]);
    expect(gestore.trova(guardata.codice)).toBe(guardata);
    // Così una raffica di stanze create e mai usate non blocca il server per mezz'ora.
    while (gestore.crea(true));
    expect(gestore.numero).toBe(STANZE_MAX);
    amb.avanza(SCADENZA_STANZA_VUOTA_MS);
    gestore.manutenzione();
    expect(gestore.crea(true)).not.toBeNull();
  });

  it('un errore in una stanza non ferma la manutenzione delle altre', () => {
    const amb = ambienteDiProva();
    const gestore = new GestoreStanze(amb);
    const rotta = gestore.crea(true)!;
    const sana = gestore.crea(true)!;
    siedi(rotta, 'anna');
    siedi(sana, 'bruno');
    sana.scollega('conn-bruno');
    vi.spyOn(rotta, 'manutenzione').mockImplementation(() => {
      throw new Error('stanza rotta');
    });
    const errori = vi.spyOn(console, 'error').mockImplementation(() => {});
    amb.avanza(ATTESA_LOBBY_MS);
    expect(() => gestore.manutenzione()).not.toThrow();
    expect(errori).toHaveBeenCalledOnce();
    expect(sana.posti).toEqual([]);
  });
});

describe('lettura dei dati dei browser', () => {
  it('impostazioni: solo campi noti e valori nei limiti', () => {
    expect(leggiImpostazioni({ giocatoriMax: 8, aste: true, soldiIniziali: 2500 })).toEqual({
      giocatoriMax: 8,
      aste: true,
      soldiIniziali: 2500,
    });
    expect(leggiImpostazioni({})).toEqual({});
    expect(leggiImpostazioni({ giocatoriMax: 9 })).toBeNull();
    expect(leggiImpostazioni({ giocatoriMax: 2.5 })).toBeNull();
    expect(leggiImpostazioni({ soldiIniziali: 1234 })).toBeNull();
    expect(leggiImpostazioni({ mappa: 'luna' })).toBeNull();
    expect(leggiImpostazioni({ mappa: 'toString' })).toBeNull();
    expect(leggiImpostazioni({ aste: 'sì' })).toBeNull();
    expect(leggiImpostazioni({ __proto__: { aste: true } })).toEqual({});
    expect(leggiImpostazioni({ admin: true })).toBeNull();
    expect(leggiImpostazioni(null)).toBeNull();
    expect(leggiImpostazioni([1])).toBeNull();
  });

  it('mosse: si costruisce un oggetto nuovo, senza campi in più', () => {
    expect(leggiMossa({ tipo: 'lancia', giocatore: 'qualcun altro' })).toEqual({ tipo: 'lancia' });
    expect(leggiMossa({ tipo: 'vendi', casella: 3 })).toEqual({ tipo: 'vendi', casella: 3 });
    expect(leggiMossa({ tipo: 'vendi', casella: '3' })).toBeNull();
    expect(leggiMossa({ tipo: 'usa_grazia' })).toEqual({ tipo: 'usa_grazia' });
    expect(leggiMossa({ tipo: 'usa_grazia', mazzo: 'busta' })).toEqual({ tipo: 'usa_grazia', mazzo: 'busta' });
    expect(leggiMossa({ tipo: 'usa_grazia', mazzo: 'jolly' })).toBeNull();
    expect(leggiMossa({ tipo: 'teletrasporto' })).toBeNull();
    expect(leggiMossa('lancia')).toBeNull();
  });

  it('token: lungo almeno 16 caratteri sicuri', () => {
    expect(leggiToken('abcdefghijklmnop')).toBe('abcdefghijklmnop');
    expect(leggiToken('corto')).toBeNull();
    expect(leggiToken('a'.repeat(129))).toBeNull();
    expect(leggiToken('token con spazi dentro')).toBeNull();
    expect(leggiToken(1234567890123456)).toBeNull();
  });
});

describe('archivio su file', () => {
  let cartella: string | null = null;
  afterEach(() => {
    if (cartella) rmSync(cartella, { recursive: true, force: true });
    cartella = null;
  });

  it('salva le stanze e le ritrova dopo un riavvio', () => {
    cartella = mkdtempSync(path.join(tmpdir(), 'poordown-'));
    const file = path.join(cartella, 'sotto', 'stanze.json');
    const amb = ambienteDiProva();
    const prima = new GestoreStanze(amb);
    const stanza = prima.crea(true)!;
    siedi(stanza, 'anna', 'bruno');
    stanza.avvia(TOKEN.anna);
    new Archivio(file, prima).salvaOra();

    const dopo = new GestoreStanze(amb);
    expect(new Archivio(file, dopo).carica()).toBe(1);
    expect(dopo.trova(stanza.codice)!.partita).toEqual(stanza.partita);
  });

  it('una stanza rovinata nel file si salta, le altre riprendono e il file com’era resta da parte', () => {
    cartella = mkdtempSync(path.join(tmpdir(), 'poordown-'));
    const file = path.join(cartella, 'stanze.json');
    const amb = ambienteDiProva();
    const prima = new GestoreStanze(amb);
    const codici = Array.from({ length: 4 }, () => {
      const s = prima.crea(true)!;
      siedi(s, 'anna', 'bruno');
      return s.codice;
    });
    new Archivio(file, prima).salvaOra();
    const salvato = JSON.parse(readFileSync(file, 'utf8')) as { stanze: Record<string, unknown>[] };
    delete salvato.stanze[0]!.registro;
    salvato.stanze[1]!.posti = null;
    writeFileSync(file, JSON.stringify(salvato));

    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const dopo = new GestoreStanze(amb);
    expect(new Archivio(file, dopo).carica()).toBe(2);
    expect(dopo.tutte().map((s) => s.codice)).toEqual(codici.slice(2));
    const copie = readdirSync(cartella).filter((f) => f.startsWith('stanze.json.rotto-'));
    expect(copie).toHaveLength(1);
    expect(readFileSync(path.join(cartella, copie[0]!), 'utf8')).toBe(JSON.stringify(salvato));
    // Le stanze riprese vanno avanti: chi era in lobby perde il posto dopo 2 minuti, senza errori.
    amb.avanza(ATTESA_LOBBY_MS);
    expect(() => dopo.manutenzione()).not.toThrow();
    expect(dopo.tutte().every((s) => s.posti.length === 0)).toBe(true);
  });

  it('un file mancante, rotto o di un formato vecchio vale come vuoto', () => {
    cartella = mkdtempSync(path.join(tmpdir(), 'poordown-'));
    const file = path.join(cartella, 'stanze.json');
    const gestore = new GestoreStanze(ambienteDiProva());
    expect(new Archivio(file, gestore).carica()).toBe(0);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    writeFileSync(file, '{ rotto');
    expect(new Archivio(file, gestore).carica()).toBe(0);
    writeFileSync(file, JSON.stringify({ formato: 0, stanze: [{}] }));
    expect(new Archivio(file, gestore).carica()).toBe(0);
    expect(gestore.numero).toBe(0);
    new Archivio(file, gestore).salvaOra();
    expect(JSON.parse(readFileSync(file, 'utf8'))).toMatchObject({ formato: 1, stanze: [] });
    // Del file rotto e di quello di un altro formato resta una copia.
    expect(readdirSync(cartella).filter((f) => f.startsWith('stanze.json.rotto-')).length).toBeGreaterThan(0);
  });
});
