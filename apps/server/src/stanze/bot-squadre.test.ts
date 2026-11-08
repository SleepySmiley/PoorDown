import { describe, expect, it } from 'vitest';
import { IMPOSTAZIONI_PREDEFINITE } from '@poordown/engine';
import { siedi, stanzaDiProva, TOKEN } from './prove';
import { ARRIVO_BOT_MAX_MS, ARRIVO_BOT_MIN_MS, RIMPIAZZO_BOT_MS, Stanza, type DatiStanza } from './stanza';

type Prova = ReturnType<typeof stanzaDiProva>;

/** Fa passare il tempo fino alla prossima cosa da fare e la fa; `false` se non c'è niente da aspettare. */
function avanti({ stanza, amb }: Prova): boolean {
  const attesa = stanza.attesa();
  if (attesa === null) return false;
  amb.avanza(attesa);
  stanza.scadenze();
  stanza.raccogli();
  return true;
}

/** Stanza con Anna e i bot che riempiono i posti fino a `n` giocatori. */
function conBot(n: number, impostazioni = {}): Prova & { anna: string } {
  const prova = stanzaDiProva({ giocatoriMax: n, ...impostazioni });
  const [anna] = siedi(prova.stanza, 'anna');
  prova.stanza.cambiaImpostazioni(TOKEN.anna, { bot: true });
  while (prova.stanza.posti.length < n && avanti(prova));
  return { ...prova, anna: anna! };
}

describe('bot in lobby', () => {
  it('con i bot attivi entrano a ondate fino al massimo, con nome e colore liberi; non diventano mai host', () => {
    const prova = stanzaDiProva({ giocatoriMax: 4 });
    const { stanza } = prova;
    const [anna] = siedi(stanza, 'anna');
    expect(stanza.attesa()).toBeNull();
    stanza.cambiaImpostazioni(TOKEN.anna, { bot: true });
    const attesa = stanza.attesa()!;
    expect(attesa).toBeGreaterThanOrEqual(ARRIVO_BOT_MIN_MS);
    expect(attesa).toBeLessThan(ARRIVO_BOT_MAX_MS);
    avanti(prova);
    expect(stanza.vista().partecipanti).toHaveLength(2);
    while (avanti(prova));
    const vista = stanza.vista();
    expect(vista.partecipanti.map((p) => p.bot)).toEqual([false, true, true, true]);
    expect(new Set(vista.partecipanti.map((p) => p.colore)).size).toBe(4);
    expect(vista.partecipanti.every((p) => p.connesso && p.nome.length > 0)).toBe(true);
    expect(vista.host).toBe(anna);
    expect(stanza.attesa()).toBeNull();
  });

  it('un bot espulso viene rimpiazzato subito; spegnendo i bot quelli entrati restano', () => {
    const prova = conBot(3);
    const { stanza } = prova;
    const bot = stanza.posti.find((p) => p.bot)!;
    expect(stanza.espelli(TOKEN.anna, bot.id).ok).toBe(true);
    expect(stanza.attesa()).toBe(RIMPIAZZO_BOT_MS);
    avanti(prova);
    expect(stanza.posti.filter((p) => p.bot)).toHaveLength(2);
    stanza.cambiaImpostazioni(TOKEN.anna, { bot: false });
    expect(stanza.posti.filter((p) => p.bot)).toHaveLength(2);
    stanza.espelli(TOKEN.anna, stanza.posti.find((p) => p.bot)!.id);
    expect(stanza.attesa()).toBeNull();
  });

  it('chi arriva in una stanza piena prende il posto dell’ultimo bot entrato', () => {
    const prova = conBot(3);
    const { stanza } = prova;
    const ultimo = stanza.posti.at(-1)!;
    expect(ultimo.bot).toBe(true);
    // Anche il colore del bot che esce è libero.
    expect(stanza.siediti(TOKEN.bruno, 'Bruno', ultimo.colore).ok).toBe(true);
    expect(stanza.posti.map((p) => p.bot)).toEqual([false, true, false]);
    expect(stanza.registro.slice(-2).map((v) => v.evento.tipo)).toEqual(['uscita', 'ingresso']);
  });

  it('abbassando il massimo escono i bot in più; senza persone al tavolo escono tutti', () => {
    const prova = conBot(4);
    const { stanza } = prova;
    siedi(stanza, 'bruno');
    expect(stanza.posti).toHaveLength(4);
    stanza.cambiaImpostazioni(TOKEN.anna, { giocatoriMax: 2 });
    expect(stanza.posti.map((p) => p.bot)).toEqual([false, false]);
    stanza.cambiaImpostazioni(TOKEN.anna, { giocatoriMax: 3 });
    avanti(prova);
    expect(stanza.posti).toHaveLength(3);
    stanza.esci('conn-anna');
    stanza.esci('conn-bruno');
    expect(stanza.posti).toEqual([]);
    expect(stanza.host).toBeNull();
  });

  it('se l’host esce, il ruolo passa a una persona e non a un bot', () => {
    const prova = conBot(3);
    siedi(prova.stanza, 'bruno');
    prova.stanza.cambiaImpostazioni(TOKEN.anna, { giocatoriMax: 4 });
    prova.stanza.esci('conn-anna');
    expect(prova.stanza.host).toBe(prova.stanza.posti.find((p) => !p.bot)!.id);
  });
});

describe('bot in partita', () => {
  it('quando tocca a un bot, tira i dadi da solo dopo le animazioni', () => {
    const prova = conBot(2, { ordineCasuale: false });
    const { stanza, amb } = prova;
    expect(stanza.avvia(TOKEN.anna).ok).toBe(true);
    stanza.raccogli();
    expect(stanza.mossa(TOKEN.anna, { tipo: 'lancia' }).ok).toBe(true);
    const partita = () => stanza.partita!;
    if (partita().turno.giocatore === prova.anna) {
      // Doppio, compra o altro: Anna finisce il suo turno come può.
      while (partita().turno.giocatore === prova.anna && partita().fase === 'in_corso') {
        const r = stanza.mossa(TOKEN.anna, { tipo: partita().turno.rilancio ? 'lancia' : 'fine_turno' });
        if (!r.ok) stanza.mossa(TOKEN.anna, { tipo: 'bancarotta' });
      }
    }
    const bot = stanza.posti.find((p) => p.bot)!.id;
    expect(partita().turno.giocatore).toBe(bot);
    const prima = stanza.registro.length;
    const attesa = stanza.attesa()!;
    // Aspetta almeno l'animazione del tiro di Anna.
    expect(attesa).toBeGreaterThan(1_500);
    amb.avanza(attesa);
    stanza.scadenze();
    expect(stanza.registro.slice(prima).some((v) => v.evento.tipo === 'dadi' && v.evento.giocatore === bot)).toBe(true);
  });

  it('una partita di soli bot (con una persona che guarda) arriva in fondo da sola', () => {
    const prova = conBot(3, { soldiIniziali: 500 });
    const { stanza } = prova;
    stanza.avvia(TOKEN.anna);
    stanza.mossa(TOKEN.anna, { tipo: 'bancarotta' });
    for (let i = 0; i < 20_000 && stanza.fase === 'partita'; i++) if (!avanti(prova)) break;
    expect(stanza.fase).toBe('finita');
  });

  it('se nessuna persona è collegata i bot si fermano', () => {
    const prova = conBot(3);
    const { stanza } = prova;
    stanza.avvia(TOKEN.anna);
    stanza.scollega('conn-anna');
    expect(stanza.inPausa()).toBe(true);
    expect(stanza.attesa()).toBeNull();
    stanza.collega('conn-anna', TOKEN.anna);
    expect(stanza.inPausa()).toBe(false);
  });

  it('un bot risponde da solo agli scambi dopo un paio di secondi', () => {
    const prova = conBot(2, { ordineCasuale: false });
    const { stanza, amb } = prova;
    stanza.avvia(TOKEN.anna);
    const bot = stanza.posti.find((p) => p.bot)!.id;
    // Il bot ha Siena: Anna gliela compra al doppio del prezzo.
    stanza.partita!.proprieta[11]!.proprietario = bot;
    const vuoto = { soldi: 0, caselle: [], grazie: [] };
    const r = stanza.mossa(TOKEN.anna, { tipo: 'proponi', a: bot, dare: { ...vuoto, soldi: 280 }, avere: { ...vuoto, caselle: [11] }, nota: '' });
    expect(r.ok).toBe(true);
    const attesa = stanza.attesa()!;
    expect(attesa).toBeGreaterThanOrEqual(2_000);
    amb.avanza(attesa);
    stanza.scadenze();
    expect(stanza.partita!.proprieta[11]!.proprietario).toBe(prova.anna);
    expect(stanza.registro.at(-1)?.evento.tipo).toBe('scambio_accettato');
  });
});

describe('squadre in lobby', () => {
  it('accendendo le squadre chi è seduto si divide in due; chi arriva va nella più piccola', () => {
    const { stanza } = stanzaDiProva({ giocatoriMax: 6 });
    siedi(stanza, 'anna', 'bruno', 'carla');
    stanza.cambiaImpostazioni(TOKEN.anna, { squadre: true });
    expect(stanza.vista().partecipanti.map((p) => p.squadra)).toEqual([0, 1, 0]);
    siedi(stanza, 'dario');
    expect(stanza.vista().partecipanti.map((p) => p.squadra)).toEqual([0, 1, 0, 1]);
    stanza.cambiaImpostazioni(TOKEN.anna, { squadre: false });
    expect(stanza.vista().partecipanti.map((p) => p.squadra)).toEqual([null, null, null, null]);
  });

  it('ognuno sceglie la sua squadra; l’host sposta chiunque, gli altri no', () => {
    const { stanza } = stanzaDiProva({ squadre: true });
    const [anna, bruno] = siedi(stanza, 'anna', 'bruno', 'carla');
    expect(stanza.cambiaSquadra(TOKEN.bruno, 2).ok).toBe(true);
    expect(stanza.cambiaSquadra(TOKEN.bruno, 0, anna)).toMatchObject({ ok: false, codice: 'solo_host' });
    expect(stanza.cambiaSquadra(TOKEN.anna, 3, bruno).ok).toBe(true);
    expect(stanza.cambiaSquadra(TOKEN.anna, 4)).toMatchObject({ ok: false, codice: 'richiesta_non_valida' });
    expect(stanza.vista().partecipanti.map((p) => p.squadra)).toEqual([0, 3, 0]);
    const senza = stanzaDiProva().stanza;
    siedi(senza, 'anna');
    expect(senza.cambiaSquadra(TOKEN.anna, 1)).toMatchObject({ ok: false, codice: 'squadre_spente' });
  });

  it('l’host dà un nome alle squadre (al massimo 20 caratteri; vuoto torna quello di partenza)', () => {
    const { stanza } = stanzaDiProva({ squadre: true });
    siedi(stanza, 'anna', 'bruno');
    expect(stanza.rinominaSquadra(TOKEN.bruno, 0, 'Lupi')).toMatchObject({ ok: false, codice: 'solo_host' });
    stanza.rinominaSquadra(TOKEN.anna, 0, '  I Lupi   della Bassa Padana  ');
    stanza.rinominaSquadra(TOKEN.anna, 1, 'Volpi');
    stanza.rinominaSquadra(TOKEN.anna, 1, '   ');
    expect(stanza.vista().squadre).toEqual(['I Lupi della Bassa P', 'Squadra 2', 'Squadra 3', 'Squadra 4']);
  });

  it('«Mescola» rifà le squadre a sorte tenendo lo stesso numero di squadre', () => {
    const { stanza } = stanzaDiProva({ squadre: true, giocatoriMax: 6 });
    siedi(stanza, 'anna', 'bruno', 'carla', 'dario');
    stanza.cambiaSquadra(TOKEN.carla, 2);
    stanza.cambiaSquadra(TOKEN.dario, 2);
    expect(stanza.mescolaSquadre(TOKEN.anna).ok).toBe(true);
    const squadre = stanza.vista().partecipanti.map((p) => p.squadra!);
    expect(new Set(squadre)).toEqual(new Set([0, 1, 2]));
  });

  it('i bot entrano nella squadra più piccola', () => {
    const prova = stanzaDiProva({ squadre: true, giocatoriMax: 4 });
    siedi(prova.stanza, 'anna', 'bruno');
    prova.stanza.cambiaSquadra(TOKEN.bruno, 0);
    prova.stanza.cambiaImpostazioni(TOKEN.anna, { bot: true });
    while (avanti(prova));
    expect(prova.stanza.vista().partecipanti.map((p) => p.squadra)).toEqual([0, 0, 1, 1]);
  });

  it('la partita parte solo con almeno due squadre, e porta squadre e nomi', () => {
    const { stanza } = stanzaDiProva({ squadre: true, ordineCasuale: false });
    const [anna, bruno, carla] = siedi(stanza, 'anna', 'bruno', 'carla');
    stanza.cambiaSquadra(TOKEN.bruno, 0);
    expect(stanza.avvia(TOKEN.anna)).toMatchObject({ ok: false, codice: 'squadre_non_valide' });
    stanza.cambiaSquadra(TOKEN.carla, 3);
    stanza.rinominaSquadra(TOKEN.anna, 3, 'Volpi');
    expect(stanza.avvia(TOKEN.anna).ok).toBe(true);
    const p = stanza.partita!;
    expect(p.giocatori.map((g) => [g.id, g.squadra])).toEqual([
      [anna, 0],
      [carla, 3],
      [bruno, 0],
    ]);
    expect(p.squadre[3]).toBe('Volpi');
  });
});

describe('chat di squadra', () => {
  it('i messaggi di squadra li leggono solo i compagni', () => {
    const { stanza } = stanzaDiProva({ squadre: true });
    siedi(stanza, 'anna', 'bruno', 'carla');
    stanza.cambiaSquadra(TOKEN.carla, 1);
    stanza.cambiaSquadra(TOKEN.bruno, 0);
    const r = stanza.scrivi(TOKEN.anna, 'Compra Roma', true);
    if (!r.ok) throw new Error(r.messaggio);
    expect(r.dati.squadra).toBe(0);
    expect(stanza.puoLeggere(TOKEN.bruno, r.dati)).toBe(true);
    expect(stanza.puoLeggere(TOKEN.carla, r.dati)).toBe(false);
    expect(stanza.puoLeggere(TOKEN.dario, r.dati)).toBe(false);
    stanza.scrivi(TOKEN.carla, 'Ciao a tutti');
    expect(stanza.istantanea(TOKEN.carla).chat.map((m) => m.testo)).toEqual(['Ciao a tutti']);
    expect(stanza.istantanea(TOKEN.bruno).chat.map((m) => m.testo)).toEqual(['Compra Roma', 'Ciao a tutti']);
  });

  it('chi entra nella squadra dopo non legge i messaggi scritti prima, nemmeno dopo «Un’altra partita»', () => {
    const { stanza } = stanzaDiProva({ squadre: true, ordineCasuale: false });
    const [, bruno, carla] = siedi(stanza, 'anna', 'bruno', 'carla', 'dario');
    stanza.cambiaSquadra(TOKEN.bruno, 0);
    stanza.cambiaSquadra(TOKEN.carla, 1);
    stanza.cambiaSquadra(TOKEN.dario, 1);
    const r = stanza.scrivi(TOKEN.anna, 'Il piano', true);
    if (!r.ok) throw new Error(r.messaggio);
    // Carla passa nella squadra di Anna, Bruno in quella avversaria.
    stanza.cambiaSquadra(TOKEN.anna, 0, carla);
    stanza.cambiaSquadra(TOKEN.anna, 1, bruno);
    const legge = (token: string) => stanza.istantanea(token).chat.some((m) => m.testo === 'Il piano');
    expect(stanza.puoLeggere(TOKEN.carla, r.dati)).toBe(false);
    expect(legge(TOKEN.carla)).toBe(false);
    // Chi era nella squadra quando è stato scritto lo legge ancora.
    expect(legge(TOKEN.bruno)).toBe(true);
    expect(legge(TOKEN.dario)).toBe(false);

    // Lo stesso in una partita, poi rimescolando le squadre per la successiva.
    stanza.avvia(TOKEN.anna);
    stanza.scrivi(TOKEN.carla, 'Partita 1', true);
    for (const t of [TOKEN.bruno, TOKEN.dario]) stanza.mossa(t, { tipo: 'bancarotta' });
    expect(stanza.fase).toBe('finita');
    stanza.nuovaPartita(TOKEN.anna);
    stanza.cambiaSquadra(TOKEN.anna, 0, bruno);
    stanza.cambiaSquadra(TOKEN.dario, 0);
    expect(stanza.istantanea(TOKEN.dario).chat.map((m) => m.testo)).toEqual([]);
    expect(stanza.istantanea(TOKEN.anna).chat.map((m) => m.testo)).toEqual(['Il piano', 'Partita 1']);
  });

  it('chi può leggere si salva su file, ma non arriva ai browser; i salvataggi vecchi lo ricavano dalle squadre di adesso', () => {
    const { stanza, amb } = stanzaDiProva({ squadre: true });
    const [anna, bruno] = siedi(stanza, 'anna', 'bruno', 'carla');
    stanza.cambiaSquadra(TOKEN.bruno, 0);
    stanza.cambiaSquadra(TOKEN.carla, 1);
    stanza.scrivi(TOKEN.anna, 'Compra Roma', true);
    stanza.scrivi(TOKEN.anna, 'Ciao a tutti');
    expect(JSON.stringify(stanza.istantanea(TOKEN.anna))).not.toContain('lettori');
    const dati = JSON.parse(JSON.stringify(stanza.esporta())) as DatiStanza;
    expect(dati.chat[0]!.lettori).toEqual([anna, bruno]);
    expect(dati.chat[1]!.lettori).toBeUndefined();

    stanza.cambiaSquadra(TOKEN.carla, 0);
    expect(Stanza.importa(JSON.parse(JSON.stringify(stanza.esporta())), amb).istantanea(TOKEN.carla).chat).toHaveLength(1);
    // Salvataggio di prima: il messaggio di squadra non dice chi può leggerlo.
    delete dati.chat[0]!.lettori;
    const vecchia = Stanza.importa(dati, amb);
    expect(vecchia.istantanea(TOKEN.bruno).chat).toHaveLength(2);
    expect(vecchia.istantanea(TOKEN.carla).chat).toHaveLength(1);
  });

  it('senza squadre la chat di squadra non c’è', () => {
    const { stanza } = stanzaDiProva();
    siedi(stanza, 'anna');
    expect(stanza.scrivi(TOKEN.anna, 'ciao', true)).toMatchObject({ ok: false, codice: 'squadre_spente' });
  });
});

describe('stanze salvate prima della Fase 8', () => {
  it('riprendono senza bot né squadre', () => {
    const { stanza, amb } = stanzaDiProva({ ordineCasuale: false });
    siedi(stanza, 'anna', 'bruno');
    stanza.avvia(TOKEN.anna);
    // Toglie dal salvataggio tutto quello che è arrivato con la Fase 8.
    type Oggetto = Record<string, unknown>;
    const vecchia = JSON.parse(JSON.stringify(stanza.esporta())) as Oggetto & {
      impostazioni: Oggetto;
      posti: Oggetto[];
      partita: Oggetto & { giocatori: Oggetto[] };
    };
    delete vecchia.impostazioni.squadre;
    delete vecchia.nomiSquadre;
    for (const p of vecchia.posti) {
      delete p.bot;
      delete p.squadra;
    }
    delete vecchia.partita.squadre;
    delete vecchia.partita.squadraVincitrice;
    for (const g of vecchia.partita.giocatori) delete g.squadra;
    const ripresa = Stanza.importa(vecchia as unknown as DatiStanza, amb);
    expect(ripresa.impostazioni.squadre).toBe(false);
    expect(ripresa.vista().partecipanti.map((p) => [p.bot, p.squadra])).toEqual([
      [false, null],
      [false, null],
    ]);
    expect(ripresa.vista().squadre).toEqual(['Squadra 1', 'Squadra 2', 'Squadra 3', 'Squadra 4']);
    expect(ripresa.partita!.giocatori.map((g) => g.squadra)).toEqual([null, null]);
    expect(ripresa.partita!.squadre).toEqual([]);
    expect(ripresa.partita!.impostazioni).toEqual({ ...IMPOSTAZIONI_PREDEFINITE, ordineCasuale: false });
  });
});
