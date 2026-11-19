/*
 * Squadre con i bot, nella stanza: il bot compagno offre ad Anna i soldi per uscire dal rosso, una volta per turno;
 * il gioco automatico accetta l'aiuto prima della bancarotta; l'aiuto non blocca le proposte normali del bot.
 */

import { describe, expect, it } from 'vitest';
import { siedi, stanzaDiProva, TOKEN } from './prove';

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

/**
 * Anna e un bot in squadra contro Bruno (turni: Anna, Bruno, bot). Bruno ha Bergamo e Milano con l'albergo e Firenze;
 * Anna ha la Sardegna; il bot ha Siena e Pisa. Anna parte da Latina e, con i dadi decisi dal pannello, si ferma su Milano:
 * 1.925 € di affitto su 1.500 € di contante, 425 € di rosso verso Bruno.
 */
function annaInRosso() {
  const prova = stanzaDiProva({ squadre: true, giocatoriMax: 3, ordineCasuale: false });
  const { stanza } = prova;
  const [anna, bruno] = siedi(stanza, 'anna', 'bruno') as [string, string];
  stanza.cambiaImpostazioni(TOKEN.anna, { bot: true });
  while (stanza.posti.length < 3 && avanti(prova));
  const posto = stanza.posti.find((p) => p.bot)!;
  expect(posto.squadra).toBe(0);
  const bot = posto.id;
  expect(stanza.avvia(TOKEN.anna).ok).toBe(true);
  const p = stanza.partita!;
  expect(p.giocatori.map((g) => g.id)).toEqual([anna, bruno, bot]);
  for (const i of [37, 39]) p.proprieta[i] = { proprietario: bruno, livello: 5, ipotecata: false };
  for (const i of [6, 7, 9]) p.proprieta[i]!.proprietario = anna;
  for (const i of [11, 13]) p.proprieta[i]!.proprietario = bot;
  p.proprieta[14]!.proprietario = bruno;
  p.giocatori.find((g) => g.id === anna)!.posizione = 32;
  stanza.raccogli();
  expect(stanza.pannello({ tipo: 'dadi', dadi: [3, 4], giocatore: anna })).toBeNull();
  expect(stanza.mossa(TOKEN.anna, { tipo: 'lancia' }).ok).toBe(true);
  stanza.raccogli();
  const saldo = (id: string) => stanza.partita!.giocatori.find((g) => g.id === id)!.saldo;
  expect(saldo(anna)).toBe(-425);
  return { ...prova, anna, bruno, bot, saldo };
}

describe('aiuto del bot al compagno in rosso', () => {
  it('Anna riceve una sola offerta, con una nota; accettandola esce dal rosso e Bruno è pagato', () => {
    const prova = annaInRosso();
    const { stanza, anna, bot, bruno, saldo } = prova;
    expect(avanti(prova)).toBe(true);
    const offerte = stanza.partita!.scambi;
    expect(offerte).toHaveLength(1);
    expect(offerte[0]).toMatchObject({ da: bot, a: anna, dare: { soldi: 425, caselle: [], grazie: [] }, avere: { soldi: 0, caselle: [], grazie: [] } });
    expect(offerte[0]!.nota).toBe('Ti passo 425 € per uscire dal rosso: siamo in squadra.');
    // Il bot non ha altro da fare: la prossima cosa è la fine del tempo di Anna (un minuto e mezzo e più).
    expect(stanza.attesa()).toBeGreaterThan(90_000);
    expect(stanza.mossa(TOKEN.anna, { tipo: 'accetta', scambio: offerte[0]!.id }).ok).toBe(true);
    expect([saldo(anna), saldo(bot), saldo(bruno)]).toEqual([0, 1650 - 425, 1575 + 1925]);
    expect(stanza.mossa(TOKEN.anna, { tipo: 'fine_turno' }).ok).toBe(true);
  });

  it('dopo un rifiuto il bot non insiste nello stesso turno, e al turno dopo riprova', () => {
    const prova = annaInRosso();
    const { stanza, amb, anna, bruno, bot } = prova;
    avanti(prova);
    const offerta = stanza.partita!.scambi[0]!;
    expect(stanza.mossa(TOKEN.anna, { tipo: 'rifiuta', scambio: offerta.id }).ok).toBe(true);
    stanza.raccogli();
    expect(stanza.attesa()).toBeGreaterThan(90_000);
    amb.avanza(10_000);
    stanza.scadenze();
    expect(stanza.partita!.scambi).toEqual([]);
    // Il pannello passa il turno a Bruno, Anna è ancora in rosso: al turno nuovo il bot offre di nuovo.
    expect(stanza.pannello({ tipo: 'turno', giocatore: bruno })).toBeNull();
    stanza.raccogli();
    avanti(prova);
    expect(stanza.partita!.scambi).toMatchObject([{ da: bot, a: anna, dare: { soldi: 425 } }]);
  });

  it('se il tempo di Anna scade, il gioco accetta l’aiuto al posto della bancarotta', () => {
    const prova = annaInRosso();
    const { stanza, anna, bruno, saldo } = prova;
    avanti(prova);
    while (stanza.partita!.turno.giocatore === anna && avanti(prova));
    const p = stanza.partita!;
    expect(p.giocatori.find((g) => g.id === anna)!.eliminato).toBeNull();
    expect(saldo(anna)).toBe(0);
    expect(p.turno.giocatore).toBe(bruno);
    expect(stanza.registro.some((v) => v.evento.tipo === 'scambio_accettato')).toBe(true);
  });

  it('l’aiuto non consuma l’attesa delle proposte normali: al suo turno il bot propone di comprare Firenze', () => {
    const prova = annaInRosso();
    const { stanza, bruno, bot } = prova;
    avanti(prova);
    expect(stanza.mossa(TOKEN.anna, { tipo: 'accetta', scambio: stanza.partita!.scambi[0]!.id }).ok).toBe(true);
    expect(stanza.mossa(TOKEN.anna, { tipo: 'fine_turno' }).ok).toBe(true);
    // Bruno va su Aosta, libera, e finisce il turno senza comprarla.
    expect(stanza.pannello({ tipo: 'dadi', dadi: [1, 2], giocatore: bruno })).toBeNull();
    expect(stanza.mossa(TOKEN.bruno, { tipo: 'lancia' }).ok).toBe(true);
    expect(stanza.mossa(TOKEN.bruno, { tipo: 'fine_turno' }).ok).toBe(true);
    stanza.raccogli();
    expect(stanza.partita!.turno.giocatore).toBe(bot);
    avanti(prova);
    expect(stanza.partita!.scambi).toMatchObject([{ da: bot, a: bruno, avere: { caselle: [14] } }]);
  });
});
