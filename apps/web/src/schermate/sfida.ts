/*
 * Giro del mondo, la sfida a morra cinese nel browser: quando si apre il riquadro sopra il tabellone, cosa mostra
 * a chi, e con quali parole. Funzioni pure, provate in sfida.test.ts.
 * Il riquadro è in Morra.tsx; la scena delle mani la mette in scena il regista (regia.ts, `scena.morra`).
 */

import { euro, TEMPI, type IdGiocatore, type Segno, type Sfida, type Stato } from '@poordown/engine';
import type { NomeSuono } from '../suoni/audio';
import type { MorraInScena, Scena } from './regia';

/** Chi guarda la sfida: chi l'ha lanciata, chi è sfidato o un altro giocatore (anche uno spettatore). */
export type Ruolo = 'sfidante' | 'proprietario' | 'spettatore';

export function ruolo(io: IdGiocatore | null, sfidante: IdGiocatore, proprietario: IdGiocatore): Ruolo {
  if (io !== null && io === sfidante) return 'sfidante';
  if (io !== null && io === proprietario) return 'proprietario';
  return 'spettatore';
}

/**
 * Cosa mostra il riquadro della sfida:
 * - `scelta`: chi è caduto sulla città decide se pagare o sfidare (solo lui la vede);
 * - `morra`: la sfida è lanciata, il proprietario sceglie il segno (gli altri aspettano e guardano chi sfida chi);
 * - `scena`: le mani battono e si aprono, per tutti.
 */
export type QuadroSfida =
  | { tipo: 'scelta'; sfida: Sfida }
  | { tipo: 'morra'; sfida: Sfida; ruolo: Ruolo }
  | { tipo: 'scena'; morra: MorraInScena; ruolo: Ruolo; affitto: number };

/**
 * Il riquadro della sfida, oppure `null` se adesso non c'è.
 * La sfida si legge dalla partita aggiornata (`vivo`, con la fase e il tempo che resta), ma il riquadro aspetta la
 * pedina. Compare solo quando:
 * - la regia ha finito tutte le scene (dadi, passi, volo, Bermuda, Antipodi, cambio di data, carte…);
 * - la partita mostrata, che resta indietro finché le animazioni non sono finite, ha anche lei la sfida;
 * - la pedina di chi gioca si è fermata, sullo schermo, proprio sulla città della sfida (`scena.arrivo`): se le voci
 *   del registro arrivano dopo lo stato, o una scena le sta ancora recitando, la pedina non c'è ancora e si aspetta.
 * Quando la sfida si chiude sparisce subito, tranne che per la scena delle mani, che ha il suo tempo.
 */
export function quadroSfida(
  vivo: Stato,
  mostrata: Stato,
  scena: Pick<Scena, 'occupata' | 'arrivo'> & { morra?: MorraInScena | null },
  io: IdGiocatore | null,
): QuadroSfida | null {
  if (scena.morra) {
    const m = scena.morra;
    return { tipo: 'scena', morra: m, ruolo: ruolo(io, m.da, m.a), affitto: affittoNormale(m, mostrata.sfida) };
  }
  const sf = vivo.sfida;
  if (!sf || !mostrata.sfida || scena.occupata || vivo.fase !== 'in_corso') return null;
  if (scena.arrivo?.casella !== sf.casella) return null;
  if (sf.fase === 'scelta') return sf.sfidante === io ? { tipo: 'scelta', sfida: sf } : null;
  return { tipo: 'morra', sfida: sf, ruolo: ruolo(io, sf.sfidante, sf.proprietario) };
}

/**
 * L'affitto normale in gioco nella morra in scena. Chi vince non paga niente, quindi l'evento non lo dice: lo sa la
 * sfida della partita mostrata, che resta aperta finché la scena non è finita. Senza, si ricava da quanto si paga.
 */
export function affittoNormale(m: Pick<MorraInScena, 'casella' | 'esito' | 'importo'>, sfida: Sfida | null | undefined): number {
  if (sfida && sfida.casella === m.casella) return sfida.importo;
  return m.esito === 'persa' ? m.importo / 2 : m.importo;
}

/* ------------------------------------------------------------------ */
/* La scena delle mani                                                 */
/* ------------------------------------------------------------------ */

/**
 * I momenti della scena, in frazioni di TEMPI.morra: le mani battono tre volte (a 1, 2 e 3 volte `battuta`),
 * si aprono sui segni (`apertura`) e poi arriva l'esito (`esito`). Li usano le animazioni (Morra.tsx) e i suoni
 * (regia.ts), così mani e colpi vanno insieme.
 */
export const MOMENTI_MORRA = { battuta: 0.14, apertura: 0.5, esito: 0.6 } as const;

/** I momenti della scena in millisecondi: i tre colpi, l'apertura delle mani e l'esito. */
export function tempiMorra(durata = TEMPI.morra): { battute: [number, number, number]; apertura: number; esito: number } {
  const b = MOMENTI_MORRA.battuta * durata;
  return {
    battute: [Math.round(b), Math.round(2 * b), Math.round(3 * b)],
    apertura: Math.round(MOMENTI_MORRA.apertura * durata),
    esito: Math.round(MOMENTI_MORRA.esito * durata),
  };
}

/** Chi ha vinto la morra: lo sfidante, il proprietario o nessuno (pari). */
export function vincitore(m: Pick<MorraInScena, 'da' | 'a' | 'esito'>): IdGiocatore | null {
  if (m.esito === 'vinta') return m.da;
  if (m.esito === 'persa') return m.a;
  return null;
}

/** Il suono dell'esito: festa a chi ha vinto, delusione a chi ha perso; agli altri (e col pari) un esito neutro. */
export function suonoEsitoMorra(esito: MorraInScena['esito'], sonoSfidante: boolean, sonoSfidato: boolean): NomeSuono {
  if (esito === 'pari' || (!sonoSfidante && !sonoSfidato)) return 'morraEsito';
  return (esito === 'vinta') === sonoSfidante ? 'morraVinta' : 'morraPersa';
}

/** Il nome dei segni, con la maiuscola: «Sasso», «Carta», «Forbici». */
export const NOME_SEGNO: Record<Segno, string> = { sasso: 'Sasso', carta: 'Carta', forbici: 'Forbici' };

/** L'esito in una riga, dal punto di vista di chi guarda: a chi ha sfidato e allo sfidato parla in seconda persona. */
export function fraseEsito(m: Pick<MorraInScena, 'da' | 'a' | 'esito' | 'importo'>, r: Ruolo, nome: (id: IdGiocatore) => string): string {
  const soldi = euro(m.importo);
  if (r === 'sfidante') {
    if (m.esito === 'vinta') return 'Hai vinto: non paghi';
    if (m.esito === 'persa') return `Hai perso: paghi ${soldi}`;
    return `Pari: paghi ${soldi}`;
  }
  if (r === 'proprietario') {
    if (m.esito === 'vinta') return `Vince ${nome(m.da)}: niente affitto`;
    if (m.esito === 'persa') return `Hai vinto: incassi ${soldi}`;
    return `Pari: incassi ${soldi}`;
  }
  if (m.esito === 'vinta') return `Vince ${nome(m.da)}: niente affitto`;
  if (m.esito === 'persa') return `Vince ${nome(m.a)}: affitto doppio`;
  return 'Pari: affitto normale';
}

/* ------------------------------------------------------------------ */
/* Cosa c'è in gioco                                                   */
/* ------------------------------------------------------------------ */

export interface Posta {
  /** L'esito per chi ha sfidato. */
  esito: 'vinta' | 'pari' | 'persa';
  etichetta: string;
  importo: number;
  /** Verde se a chi guarda va bene, rosso se va male; neutro per chi non c'entra. */
  tono: 'bene' | 'male' | 'neutro';
}

/**
 * I tre esiti possibili e quanto passa di mano con ognuno, dal punto di vista di chi guarda.
 * Sempre nello stesso ordine: vince chi ha sfidato, pari, vince il proprietario.
 */
export function poste(affitto: number, r: Ruolo, nome: (id: IdGiocatore) => string, sf: Pick<Sfida, 'sfidante' | 'proprietario'>): Posta[] {
  const doppio = 2 * affitto;
  if (r === 'sfidante') {
    return [
      { esito: 'vinta', etichetta: 'Vinci', importo: 0, tono: 'bene' },
      { esito: 'pari', etichetta: 'Pari', importo: affitto, tono: 'neutro' },
      { esito: 'persa', etichetta: 'Perdi', importo: doppio, tono: 'male' },
    ];
  }
  if (r === 'proprietario') {
    return [
      { esito: 'vinta', etichetta: 'Perdi', importo: 0, tono: 'male' },
      { esito: 'pari', etichetta: 'Pari', importo: affitto, tono: 'neutro' },
      { esito: 'persa', etichetta: 'Vinci', importo: doppio, tono: 'bene' },
    ];
  }
  return [
    { esito: 'vinta', etichetta: `Vince ${nome(sf.sfidante)}`, importo: 0, tono: 'neutro' },
    { esito: 'pari', etichetta: 'Pari', importo: affitto, tono: 'neutro' },
    { esito: 'persa', etichetta: `Vince ${nome(sf.proprietario)}`, importo: doppio, tono: 'neutro' },
  ];
}
