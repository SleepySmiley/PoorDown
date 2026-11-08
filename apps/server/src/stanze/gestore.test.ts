import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { Archivio } from './archivio';
import { GestoreStanze, normalizzaCodice, SCADENZA_STANZA_MS, STANZE_MAX } from './gestore';
import { leggiImpostazioni, leggiMossa, leggiToken } from './lettura';
import { ambienteDiProva, siedi, TOKEN } from './prove';

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
  it('l’elenco mostra solo le stanze pubbliche non finite, prima quelle in attesa e più piene', () => {
    const gestore = new GestoreStanze(ambienteDiProva());
    gestore.crea(true);
    const vuota = gestore.crea(false)!;
    const piena = gestore.crea(false)!;
    siedi(piena, 'anna', 'bruno');
    const inCorso = gestore.crea(false)!;
    siedi(inCorso, 'carla', 'dario');
    inCorso.avvia(TOKEN.carla);

    expect(gestore.elenco().map((s) => s.codice)).toEqual([piena.codice, vuota.codice, inCorso.codice]);
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
});

describe('pulizia', () => {
  it('chiude le stanze rimaste senza nessuno collegato per 30 minuti', () => {
    const amb = ambienteDiProva();
    const gestore = new GestoreStanze(amb);
    const abbandonata = gestore.crea(true)!;
    const viva = gestore.crea(true)!;
    viva.collega('scheda', TOKEN.anna);

    amb.avanza(SCADENZA_STANZA_MS - 1);
    expect(gestore.manutenzione().chiuse).toEqual([]);
    amb.avanza(1);
    const { chiuse } = gestore.manutenzione();
    expect(chiuse.map((s) => s.codice)).toEqual([abbandonata.codice]);
    expect(gestore.trova(abbandonata.codice)).toBeUndefined();
    expect(gestore.trova(viva.codice)).toBe(viva);
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

  it('un file mancante, rotto o di un formato vecchio vale come vuoto', () => {
    cartella = mkdtempSync(path.join(tmpdir(), 'poordown-'));
    const file = path.join(cartella, 'stanze.json');
    const gestore = new GestoreStanze(ambienteDiProva());
    expect(new Archivio(file, gestore).carica()).toBe(0);
    writeFileSync(file, '{ rotto');
    expect(new Archivio(file, gestore).carica()).toBe(0);
    writeFileSync(file, JSON.stringify({ formato: 0, stanze: [{}] }));
    expect(new Archivio(file, gestore).carica()).toBe(0);
    expect(gestore.numero).toBe(0);
    new Archivio(file, gestore).salvaOra();
    expect(JSON.parse(readFileSync(file, 'utf8'))).toMatchObject({ formato: 1, stanze: [] });
  });
});
