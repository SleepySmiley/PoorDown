import { describe, expect, it } from 'vitest';
import { descrivi, descriviVoce, euro } from './descrivi';
import { dadi, esegui, partitaASquadre, partitaDiProva, primaCarta } from './prove';

describe('descrivi', () => {
  it('formatta gli euro all’italiana', () => {
    expect(euro(1500)).toBe('1.500 €');
    expect(euro(75)).toBe('75 €');
    expect(euro(-190)).toBe('−190 €');
  });

  it('scrive le righe del registro', () => {
    const s = partitaDiProva();
    s.giocatori[1]!.posizione = 3;
    s.proprieta[7]!.proprietario = 'b';
    const { stato, eventi } = esegui(s, { tipo: 'lancia', giocatore: 'a' }, dadi([3, 4]));
    expect(eventi.map((e) => descrivi(e, stato)).filter(Boolean)).toEqual([
      'Anna tira 3 e 4 e va a Sassari.',
      'Anna paga 6 € di affitto a Bruno per Sassari.',
    ]);
  });

  it('usa “ad”, “all’” e “alla casella” dove serve', () => {
    const verso = (a: number) => descrivi({ tipo: 'movimento', giocatore: 'a', da: 0, a }, partitaDiProva());
    expect(verso(3)).toBe('Anna va ad Aosta.');
    expect(verso(27)).toBe('Anna va all’Acquedotto.');
    expect(verso(5)).toBe('Anna va alla Stazione Nord.');
    expect(verso(8)).toBe('Anna va alla casella Cartolina.');
    expect(verso(10)).toBe('Anna va in visita alla Prigione.');
  });

  it('riporta il testo della carta', () => {
    const s = primaCarta(partitaDiProva(), 'cartolina', 13);
    const { stato, eventi } = esegui(s, { tipo: 'lancia', giocatore: 'a' }, dadi([3, 5]));
    expect(eventi.map((e) => descrivi(e, stato))).toContain('Anna pesca una Cartolina: «Aiuti un parente. Paga 50 €.»');
  });

  it('scrive case, ipoteche, aste e scambi', () => {
    const s = partitaDiProva();
    const testo = (e: Parameters<typeof descrivi>[0]) => descrivi(e, s);
    expect(testo({ tipo: 'costruzione', giocatore: 'a', casella: 3, livello: 1, costo: 50 })).toBe(
      'Anna costruisce una casa ad Aosta per 50 €.',
    );
    expect(testo({ tipo: 'costruzione', giocatore: 'a', casella: 11, livello: 5, costo: 100 })).toBe(
      'Anna costruisce un albergo a Siena per 100 €.',
    );
    expect(testo({ tipo: 'demolizione', giocatore: 'a', casella: 11, livello: 4, importo: 50 })).toBe(
      'Anna vende alla banca l’albergo di Siena per 50 €.',
    );
    expect(testo({ tipo: 'ipoteca', giocatore: 'a', casella: 11, importo: 70 })).toBe('Anna ipoteca Siena e riceve 70 €.');
    expect(testo({ tipo: 'riscatto', giocatore: 'a', casella: 11, importo: 77 })).toBe('Anna toglie l’ipoteca da Siena per 77 €.');
    expect(testo({ tipo: 'asta', giocatore: 'a', casella: 11 })).toBe('Anna mette all’asta Siena.');
    expect(testo({ tipo: 'asta_vinta', giocatore: 'b', casella: 11, importo: 1200 })).toBe(
      'Bruno vince l’asta e compra Siena per 1.200 €.',
    );
    expect(testo({ tipo: 'asta_deserta', casella: 11, offerente: null })).toBe('Nessuna offerta: Siena resta alla banca.');
    expect(testo({ tipo: 'scambio_proposto', scambio: 1, da: 'a', a: 'b', trattativa: 0 })).toBe(
      'Anna propone uno scambio a Bruno.',
    );
    expect(testo({ tipo: 'scambio_proposto', scambio: 2, da: 'b', a: 'a', trattativa: 1 })).toBe(
      'Bruno fa una controproposta ad Anna.',
    );
    expect(
      testo({
        tipo: 'scambio_accettato',
        scambio: 2,
        da: 'a',
        a: 'b',
        dare: { soldi: 100, caselle: [11, 13], grazie: ['busta'] },
        avere: { soldi: 0, caselle: [], grazie: [] },
      }),
    ).toBe('Bruno accetta lo scambio proposto da Anna. Anna dà Siena, Pisa, la Carta Grazia e 100 €; Bruno non dà niente.');
    expect(testo({ tipo: 'scambio_rifiutato', scambio: 1, da: 'a', a: 'b' })).toBe('Bruno rifiuta lo scambio proposto da Anna.');
    expect(testo({ tipo: 'scambio_annullato', scambio: 1, da: 'a', a: 'b' })).toBe('Anna ritira lo scambio proposto a Bruno.');
  });

  it('a squadre scrive «Vince Squadra 1» ma «Vince la squadra Volpi»', () => {
    const s = partitaASquadre([0, 1]);
    const fine = { tipo: 'fine', vincitore: 'a', squadra: 0 } as const;
    expect(descrivi(fine, s)).toBe('Partita finita. Vince Squadra 1.');
    s.squadre[0] = 'Volpi';
    expect(descrivi(fine, s)).toBe('Partita finita. Vince la squadra Volpi.');
  });

  it('scrive anche i fatti della lobby', () => {
    expect(descriviVoce({ tipo: 'ingresso', giocatore: 'x', nome: 'Sara', colore: 5 }, null)).toBe('Sara entra nella partita.');
    expect(descriviVoce({ tipo: 'uscita', giocatore: 'x', nome: 'Sara', motivo: 'volontaria' }, null)).toBe('Sara lascia la stanza.');
    expect(descriviVoce({ tipo: 'uscita', giocatore: 'x', nome: 'Sara', motivo: 'espulsione' }, null)).toBe(
      'Espulsione: Sara lascia la stanza.',
    );
    expect(descriviVoce({ tipo: 'nuovo_host', giocatore: 'y', nome: 'Luca' }, null)).toBe('Luca ora è l’host della stanza.');
    expect(descriviVoce({ tipo: 'inizio', ordineCasuale: false }, partitaDiProva())).toBe('La partita comincia.');
  });
});
