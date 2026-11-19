import { describe, expect, it } from 'vitest';
import {
  casoDaSeme,
  creaPartita,
  IMPOSTAZIONI_PREDEFINITE,
  tabellone,
  type Evento,
  type Stato,
  type VoceRegistro,
} from '@poordown/engine';
import { aggiornaSaldi, eventoCorrente, fraseTurno, momentoScena, saldiIniziali, titoloScheda } from './turno';

/** Anna gioca il turno, Bruno aspetta. */
function partita(modifica?: (s: Stato) => void): Stato {
  const esito = creaPartita(
    [
      { id: 'a', nome: 'Anna', colore: 1 },
      { id: 'b', nome: 'Bruno', colore: 2 },
    ],
    { ...IMPOSTAZIONI_PREDEFINITE, ordineCasuale: false },
    casoDaSeme(1),
  );
  if (!esito.ok) throw new Error(esito.messaggio);
  const s = structuredClone(esito.stato);
  modifica?.(s);
  return s;
}

function frase(s: Stato, io: string | null, extra: Partial<Parameters<typeof fraseTurno>[0]> = {}): string {
  return fraseTurno({ partita: s, io, assente: false, occupata: false, ...extra });
}

describe('momentoScena', () => {
  const vuota = { carta: null, voli: {}, rotola: false, meta: null, arrivo: null };
  it('sceglie il momento più vistoso di chi gioca', () => {
    expect(momentoScena(vuota, 'a')).toBeNull();
    expect(momentoScena({ ...vuota, rotola: true }, 'a')).toEqual({ tipo: 'dadi' });
    expect(momentoScena({ ...vuota, meta: { giocatore: 'a', casella: 7 } }, 'a')).toEqual({ tipo: 'viaggio', casella: 7 });
    // La pedina di un altro (es. mandata in prigione da una carta) non è il viaggio di chi gioca.
    expect(momentoScena({ ...vuota, meta: { giocatore: 'b', casella: 7 } }, 'a')).toBeNull();
    expect(momentoScena({ ...vuota, rotola: true, voli: { a: true } }, 'a')).toEqual({ tipo: 'prigione' });
    const carta = { n: 1, giocatore: 'a', mazzo: 'busta' as const, carta: 0, testo: '', casella: 2 };
    expect(momentoScena({ ...vuota, carta, voli: { a: true } }, 'a')).toEqual({ tipo: 'carta', mazzo: 'busta' });
    expect(momentoScena({ ...vuota, arrivo: { casella: 3, tono: 'affitto' } }, 'a')).toEqual({
      tipo: 'arrivo',
      casella: 3,
      affitto: true,
    });
  });

  it('Giro del mondo: la morra cinese di chi gioca, contro il padrone della città', () => {
    const morra = { n: 4, da: 'a', a: 'b', casella: 5, segni: ['sasso', 'carta'] as ['sasso', 'carta'], esito: 'persa' as const, importo: 140 };
    const scena = { ...vuota, arrivo: { casella: 5, tono: 'normale' as const }, morra };
    expect(momentoScena(scena, 'a')).toEqual({ tipo: 'morra', avversario: 'b' });
    // La morra non è di Bruno: per lui resta il resto della scena.
    expect(momentoScena(scena, 'b')).toEqual({ tipo: 'arrivo', casella: 5, affitto: false });
  });
});

describe('fraseTurno', () => {
  it('a me parla in seconda persona, per gli altri descrive', () => {
    const s = partita();
    expect(s.turno.giocatore).toBe('a');
    expect(frase(s, 'a')).toBe('Tira i dadi');
    expect(frase(s, 'b')).toBe('deve tirare i dadi');
    expect(frase(s, null)).toBe('deve tirare i dadi');
  });

  it('mentre i dadi rotolano non dice di tirarli', () => {
    const s = partita();
    expect(frase(s, 'a', { occupata: true })).toBe('Tiro in corso…');
    expect(frase(s, 'b', { occupata: true })).toBe('sta tirando i dadi…');
  });

  it('durante la scena racconta il momento: viaggio, carta, prigione, affitto', () => {
    const s = partita();
    const tab = tabellone(s.mappa);
    const busta = tab.caselle.findIndex((c) => c.tipo === 'carta');
    const citta = tab.caselle.findIndex((c) => c.tipo === 'citta');
    const nomeCitta = tab.caselle[citta]!.nome;
    const occupata = true;
    expect(frase(s, 'a', { occupata, momento: { tipo: 'viaggio', casella: busta } })).toBe(
      `Vai alla casella ${tab.caselle[busta]!.nome}…`,
    );
    expect(frase(s, 'b', { occupata, momento: { tipo: 'carta', mazzo: 'busta' } })).toBe('pesca una Busta');
    expect(frase(s, 'a', { occupata, momento: { tipo: 'carta', mazzo: 'cartolina' } })).toBe('Peschi una Cartolina');
    expect(frase(s, 'b', { occupata, momento: { tipo: 'prigione' } })).toBe('va in prigione');
    expect(frase(s, 'a', { occupata, momento: { tipo: 'dadi' } })).toBe('Tiro in corso…');

    const conAffitto = partita((x) => {
      x.proprieta[citta] = { proprietario: 'b', livello: 0, ipotecata: false };
    });
    expect(frase(conAffitto, 'a', { occupata, momento: { tipo: 'arrivo', casella: citta, affitto: true } })).toBe(
      'Paghi l’affitto a Bruno',
    );
    // Davanti a un nome che comincia per a, «ad» come nel registro.
    const adAnna = partita((x) => {
      x.proprieta[citta] = { proprietario: 'a', livello: 0, ipotecata: false };
      x.turno.giocatore = 'b';
    });
    expect(frase(adAnna, 'a', { occupata, momento: { tipo: 'arrivo', casella: citta, affitto: true } })).toBe(
      'paga l’affitto ad Anna',
    );
    expect(frase(s, 'b', { occupata, momento: { tipo: 'arrivo', casella: citta, affitto: false } })).toMatch(
      new RegExp(`^è ad? ${nomeCitta}$`),
    );
    // Fuori scena il momento non conta.
    expect(frase(s, 'a', { momento: { tipo: 'prigione' } })).toBe('Tira i dadi');
  });

  it('Giro del mondo: sulla città di un avversario si paga o si sfida, poi si aspetta il segno', () => {
    const conSfida = (fase: 'scelta' | 'morra') =>
      partita((x) => {
        x.turno.fase = 'dopo_lancio';
        x.sfida = { sfidante: 'a', proprietario: 'b', casella: 5, importo: 70, fase, segno: null, scadenza: 15_000 };
      });
    const scelta = conSfida('scelta');
    expect(frase(scelta, 'a')).toBe('Paga 70 € o sfida Bruno a morra');
    expect(frase(scelta, 'b')).toBe('decide se pagarti 70 € o sfidarti a morra');
    expect(frase(scelta, null)).toBe('decide se pagare 70 € o sfidare Bruno a morra');
    const morra = conSfida('morra');
    expect(frase(morra, 'a')).toBe('Hai sfidato Bruno: aspetta il suo segno');
    expect(frase(morra, 'b')).toBe('ti sfida a morra cinese: scegli il segno');
    expect(frase(morra, null)).toBe('sfida Bruno a morra cinese');
    // Mentre le mani battono il cartello racconta la morra; allo sfidato dice «con te».
    const momento = { tipo: 'morra', avversario: 'b' } as const;
    expect(frase(morra, 'a', { occupata: true, momento })).toBe('Morra cinese con Bruno…');
    expect(frase(morra, 'b', { occupata: true, momento })).toBe('gioca a morra con te…');
    expect(frase(morra, null, { occupata: true, momento })).toBe('gioca a morra con Bruno…');
  });

  it('l’arrivo parla solo finché la partita mostrata è quella di prima del tiro', () => {
    const s = partita((x) => {
      x.turno.fase = 'dopo_lancio';
    });
    const citta = tabellone(s.mappa).caselle.findIndex((c) => c.tipo === 'citta');
    const arrivo = { tipo: 'arrivo', casella: citta, affitto: false } as const;
    expect(frase(s, 'a', { occupata: true, momento: arrivo })).not.toMatch(/^Sei /);
    // Secondo tiro dopo un doppio: la partita mostrata dice ancora «tira ancora», ma la pedina è già arrivata.
    const doppio = partita((x) => {
      x.turno.fase = 'dopo_lancio';
      x.turno.dadi = [3, 3];
      x.turno.rilancio = true;
    });
    expect(frase(doppio, 'a', { occupata: true, momento: arrivo })).toMatch(/^Sei ad? /);
    expect(frase(doppio, 'a', { occupata: false, momento: arrivo })).toBe('Doppio! Tira ancora');
  });

  it('chi ha perso il collegamento', () => {
    expect(frase(partita(), 'b', { assente: true })).toContain('ha perso il collegamento');
  });

  it('in prigione dice il tentativo', () => {
    const s = partita((s) => {
      s.turno.fase = 'prigione';
      s.giocatori[0]!.prigione = 1;
    });
    expect(frase(s, 'a')).toBe('Sei in prigione: tentativo 2 di 3');
    expect(frase(s, 'b')).toBe('è in prigione: tentativo 2 di 3');
  });

  it('la decisione d’acquisto nomina la città e il prezzo', () => {
    const tab = tabellone(IMPOSTAZIONI_PREDEFINITE.mappa);
    const n = tab.caselle.findIndex((c) => c.tipo === 'citta');
    const citta = tab.caselle[n]!;
    const s = partita((s) => {
      s.turno.fase = 'dopo_lancio';
      s.turno.dadi = [1, 2];
      s.turno.acquisto = n;
    });
    expect(frase(s, 'b')).toContain(`sta decidendo se comprare ${citta.nome}`);
    expect(frase(s, 'a')).toContain(`Sei su ${citta.nome}`);
  });

  it('il debito viene prima di tutto, poi il doppio', () => {
    const debito = partita((s) => {
      s.turno.fase = 'dopo_lancio';
      s.turno.rilancio = true;
      s.giocatori[0]!.saldo = -120;
    });
    expect(frase(debito, 'a')).toBe('Sei in debito di 120 €: vendi o fai uno scambio');
    const doppio = partita((s) => {
      s.turno.fase = 'dopo_lancio';
      s.turno.dadi = [4, 4];
      s.turno.rilancio = true;
    });
    expect(frase(doppio, 'a')).toBe('Doppio! Tira ancora');
    expect(frase(doppio, 'b')).toBe('ha fatto doppio: tira ancora');
  });

  it('il tiro in più di una carta («Gravità zero») non è un doppio', () => {
    const carta = partita((s) => {
      s.turno.fase = 'dopo_lancio';
      s.turno.dadi = [2, 3];
      s.turno.rilancio = true;
    });
    expect(frase(carta, 'a')).toBe('Tira ancora i dadi');
    expect(frase(carta, 'b')).toBe('tira ancora i dadi');
  });

  it('per chi aspetta dice se sta preparando uno scambio', () => {
    expect(frase(partita(), 'b', { attivita: { tipo: 'crea' } })).toBe('sta creando uno scambio…');
  });
});

function voci(eventi: Evento[]): VoceRegistro[] {
  return eventi.map((evento, i) => ({ n: i + 1, quando: 0, evento }));
}

describe('eventoCorrente', () => {
  const registro = voci([
    { tipo: 'inizio', ordineCasuale: false },
    { tipo: 'turno', giocatore: 'a', numero: 1 },
    { tipo: 'dadi', giocatore: 'a', dadi: [3, 4] },
    { tipo: 'movimento', giocatore: 'a', da: 0, a: 7, dadi: [3, 4] },
    { tipo: 'affitto', da: 'a', a: 'b', casella: 7, importo: 44 },
    { tipo: 'turno', giocatore: 'b', numero: 2 },
    { tipo: 'dadi', giocatore: 'b', dadi: [1, 2] },
  ]);

  it('prende l’ultimo evento importante del turno prima, sbiadito, se nel turno nuovo non c’è niente', () => {
    const e = eventoCorrente(registro);
    expect(e?.voce.n).toBe(5);
    expect(e?.precedente).toBe(true);
  });

  it('nel turno in corso non è sbiadito', () => {
    expect(eventoCorrente(registro, 5)).toEqual({ voce: registro[4], precedente: false });
  });

  it('aspetta le voci non ancora comparse sullo schermo e si ferma all’inizio della partita', () => {
    expect(eventoCorrente(registro, 3)).toBeNull();
  });

  it('Giro del mondo: l’affitto che chiude una morra lo racconta la scheda della morra', () => {
    const morra = voci([
      { tipo: 'turno', giocatore: 'a', numero: 1 },
      { tipo: 'movimento', giocatore: 'a', da: 0, a: 5, dadi: [2, 3] },
      { tipo: 'sfida', da: 'a', a: 'b', casella: 5, importo: 70 },
      { tipo: 'morra', da: 'a', a: 'b', casella: 5, segni: ['carta', 'forbici'], esito: 'persa', importo: 140 },
      { tipo: 'affitto', da: 'a', a: 'b', casella: 5, importo: 140 },
    ]);
    expect(eventoCorrente(morra)?.voce.n).toBe(4);
    // Prima che le mani si aprano resta la scheda della sfida.
    expect(eventoCorrente(morra, 3)?.voce.n).toBe(3);
    // Senza morra (ha pagato subito) l'affitto ha la sua scheda.
    const pagato = voci([
      { tipo: 'turno', giocatore: 'a', numero: 1 },
      { tipo: 'affitto', da: 'a', a: 'b', casella: 5, importo: 70 },
    ]);
    expect(eventoCorrente(pagato)?.voce.n).toBe(2);
  });
});

describe('variazioni dei saldi', () => {
  it('chi cambia saldo ha una variazione nuova, gli altri tengono la loro', () => {
    const s = partita();
    let stato = saldiIniziali(s.giocatori);
    expect(stato.variazioni).toEqual({});
    s.giocatori[0]!.saldo -= 44;
    s.giocatori[1]!.saldo += 44;
    stato = aggiornaSaldi(stato, s.giocatori);
    expect(stato.variazioni).toEqual({ a: { importo: -44, n: 1 }, b: { importo: 44, n: 2 } });
    s.giocatori[0]!.saldo += 200;
    stato = aggiornaSaldi(stato, s.giocatori);
    expect(stato.variazioni.a).toEqual({ importo: 200, n: 3 });
    expect(stato.variazioni.b).toEqual({ importo: 44, n: 2 });
  });
});

describe('titoloScheda', () => {
  it('«● Tocca a te» solo se tocca a me e la finestra non è in primo piano', () => {
    expect(titoloScheda(true, true, 0)).toBe('● Tocca a te — PoorDown');
    expect(titoloScheda(true, false, 2)).toBe('(2) PoorDown');
    expect(titoloScheda(false, true, 0)).toBe('PoorDown');
  });
});

describe('Giro del mondo: le caselle strane nel cartello del turno', () => {
  const vuota = { carta: null, voli: {}, rotola: false, meta: null, arrivo: null };

  it('il momento è la casella strana di chi gioca, non quella degli altri', () => {
    const strana = { n: 3, tipo: 'bermuda' as const, giocatore: 'a' };
    const scena = { ...vuota, arrivo: { casella: 11, tono: 'normale' as const }, strana };
    expect(momentoScena(scena, 'a')).toEqual({ tipo: 'bermuda' });
    expect(momentoScena(scena, 'b')).toEqual({ tipo: 'arrivo', casella: 11, affitto: false });
    expect(momentoScena({ ...vuota, strana: { ...strana, tipo: 'antipodi' as const } }, 'a')).toEqual({ tipo: 'antipodi' });
    expect(momentoScena({ ...vuota, strana: { ...strana, tipo: 'cambio_data' as const } }, 'a')).toEqual({ tipo: 'cambio_data' });
  });

  it('racconta cosa succede, a me e agli altri', () => {
    const s = partita();
    const occupata = true;
    expect(frase(s, 'a', { occupata, momento: { tipo: 'bermuda' } })).toBe('Sparisci nel Triangolo delle Bermuda…');
    expect(frase(s, 'b', { occupata, momento: { tipo: 'bermuda' } })).toBe('sparisce nel Triangolo delle Bermuda…');
    expect(frase(s, 'a', { occupata, momento: { tipo: 'antipodi' } })).toBe('Sbuchi dall’altra parte del mondo…');
    expect(frase(s, 'b', { occupata, momento: { tipo: 'cambio_data' } })).toBe('guadagna un giorno: si muove ancora');
  });

  it('le caselle strane hanno la loro scheda', () => {
    const registro: VoceRegistro[] = [
      { n: 1, quando: 0, evento: { tipo: 'turno', giocatore: 'a', numero: 1 } },
      { n: 2, quando: 0, evento: { tipo: 'cambio_data', giocatore: 'a' } },
      { n: 3, quando: 0, evento: { tipo: 'antipodi', giocatore: 'a', da: 33, a: 9 } },
    ];
    expect(eventoCorrente(registro)?.voce.n).toBe(3);
    expect(eventoCorrente(registro, 2)?.voce.n).toBe(2);
  });
});
