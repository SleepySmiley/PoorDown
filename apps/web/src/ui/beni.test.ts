import { describe, expect, it } from 'vitest';
import { applica, casoDaSeme, creaPartita, IMPOSTAZIONI_PREDEFINITE, type Stato, type VoceRegistro } from '@poordown/engine';
import { destinoDeiBeni, destinoDeiMieiBeni, erede } from './beni';

/** Anna e Bruno nella squadra 0, Carla e Dario nella 1 (oppure tutti senza squadra). */
function partita(squadre: boolean): Stato {
  const esito = creaPartita(
    [
      { id: 'a', nome: 'Anna', colore: 1, squadra: 0 },
      { id: 'b', nome: 'Bruno', colore: 2, squadra: 0 },
      { id: 'c', nome: 'Carla', colore: 3, squadra: 1 },
      { id: 'd', nome: 'Dario', colore: 4, squadra: 1 },
    ],
    { ...IMPOSTAZIONI_PREDEFINITE, squadre, ordineCasuale: false },
    casoDaSeme(1),
  );
  if (!esito.ok) throw new Error(esito.messaggio);
  return esito.stato;
}

function giocatore(s: Stato, id: string) {
  return s.giocatori.find((g) => g.id === id)!;
}

/** Anna dichiara bancarotta: la partita dopo e le voci del registro nate così. */
function bancarottaDiAnna(s: Stato): { stato: Stato; registro: VoceRegistro[] } {
  const esito = applica(s, { tipo: 'bancarotta', giocatore: 'a' }, casoDaSeme(2));
  if (!esito.ok) throw new Error(esito.messaggio);
  return { stato: esito.stato, registro: esito.eventi.map((evento, i) => ({ n: i + 1, quando: 0, evento })) };
}

describe('beni di chi esce', () => {
  it('a squadre li raccoglie il primo compagno ancora in gioco', () => {
    const s = partita(true);
    expect(erede(s, giocatore(s, 'a'))?.id).toBe('b');
    expect(destinoDeiBeni(s, giocatore(s, 'a'), true)).toBe('Contanti, proprietà e Carte Grazia passano a Bruno, tuo compagno di squadra.');
    giocatore(s, 'b').eliminato = { turno: 1, motivo: 'bancarotta' };
    expect(erede(s, giocatore(s, 'a'))).toBeUndefined();
    expect(destinoDeiBeni(s, giocatore(s, 'a'), false)).toBe('Le sue proprietà tornano alla banca.');
    expect(erede(partita(false), giocatore(partita(false), 'a'))).toBeUndefined();
  });

  it('al passato, dal registro: tutto al compagno', () => {
    const { stato, registro } = bancarottaDiAnna(partita(true));
    expect(destinoDeiMieiBeni(stato, giocatore(stato, 'a'), registro)).toBe(
      'Contanti, proprietà e Carte Grazia sono passati a Bruno, tuo compagno di squadra.',
    );
  });

  it('al passato, dal registro: con i debiti al compagno va solo il contante avanzato', () => {
    const s = partita(true);
    s.proprieta[39] = { proprietario: 'a', livello: 0, ipotecata: false };
    giocatore(s, 'a').saldo = -100;
    giocatore(s, 'a').debiti = [{ creditore: 'c', importo: 100 }];
    const { stato, registro } = bancarottaDiAnna(s);
    expect(registro.map((v) => v.evento)).toContainEqual(expect.objectContaining({ tipo: 'eredita', a: 'b', caselle: [] }));
    expect(destinoDeiMieiBeni(stato, giocatore(stato, 'a'), registro)).toBe(
      'I tuoi beni hanno pagato i debiti, quello che avanzava è andato in contanti a Bruno e le tue proprietà sono tornate alla banca.',
    );
  });

  it('al passato, senza squadre o senza registro', () => {
    const senza = bancarottaDiAnna(partita(false));
    expect(destinoDeiMieiBeni(senza.stato, giocatore(senza.stato, 'a'), senza.registro)).toBe(
      'Le tue proprietà sono tornate alla banca.',
    );
    const squadre = bancarottaDiAnna(partita(true));
    expect(destinoDeiMieiBeni(squadre.stato, giocatore(squadre.stato, 'a'), [])).toBe(
      'Le tue proprietà sono passate a Bruno, tuo compagno di squadra.',
    );
  });
});
