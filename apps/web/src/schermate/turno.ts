/*
 * Chiarezza del turno: le frasi del cartello al centro del tabellone, l'evento da mettere in evidenza,
 * le variazioni dei saldi nella lista dei giocatori e il titolo della scheda del browser.
 * Funzioni pure (provate in turno.test.ts) più due piccoli hook.
 */

import { useEffect, useState } from 'react';
import {
  acquistoInSospeso,
  euro,
  proprietabile,
  tabellone,
  TENTATIVI_PRIGIONE,
  type Attivita,
  type Giocatore,
  type IdGiocatore,
  type Stato,
  type VoceRegistro,
} from '@poordown/engine';

/** «sta decidendo…» → «Sta decidendo…». */
export function maiuscola(testo: string): string {
  return testo.charAt(0).toUpperCase() + testo.slice(1);
}

/** Cosa sta facendo con gli scambi chi gioca, per chi aspetta. */
export function cosaFa(attivita: Attivita | undefined): string | null {
  switch (attivita?.tipo) {
    case 'crea':
      return 'sta creando uno scambio…';
    case 'guarda':
      return 'sta guardando uno scambio…';
    case 'tratta':
      return 'sta preparando una controproposta…';
    default:
      return null;
  }
}

/** Il tentativo di uscire di prigione che sta per fare (da 1 a 3). */
export function tentativoPrigione(g: Giocatore): number {
  return Math.min((g.prigione ?? 0) + 1, TENTATIVI_PRIGIONE);
}

/**
 * La seconda riga del cartello del turno: cosa deve fare adesso chi gioca.
 * A me parla in seconda persona («Tira i dadi»), per gli altri descrive («deve tirare i dadi»).
 * @param assente chi gioca ha perso il collegamento.
 * @param occupata una scena è in corso (dadi che rotolano, pedina che cammina): la partita mostrata è ancora quella di prima.
 */
export function fraseTurno({
  partita,
  io,
  attivita,
  assente,
  occupata,
}: {
  partita: Stato;
  io: IdGiocatore | null;
  attivita?: Attivita;
  assente: boolean;
  occupata: boolean;
}): string {
  const t = partita.turno;
  const g = partita.giocatori.find((x) => x.id === t.giocatore);
  if (!g) return '';
  const mio = g.id === io;
  if (assente && !mio) return 'ha perso il collegamento: il turno passa da solo';
  if (occupata && (t.fase === 'lancio' || t.fase === 'prigione')) return mio ? 'Tiro in corso…' : 'sta tirando i dadi…';

  if (t.fase === 'prigione') {
    const n = tentativoPrigione(g);
    return mio
      ? `Sei in prigione: tentativo ${n} di ${TENTATIVI_PRIGIONE}`
      : `è in prigione: tentativo ${n} di ${TENTATIVI_PRIGIONE}`;
  }

  const scambio = mio ? null : cosaFa(attivita);
  if (t.fase === 'lancio') return scambio ?? (mio ? 'Tira i dadi' : 'deve tirare i dadi');

  // Dopo il tiro: prima il debito, poi la decisione d'acquisto, poi il doppio.
  if (g.saldo < 0) {
    const debito = euro(-g.saldo);
    return mio ? `Sei in debito di ${debito}: vendi o fai uno scambio` : `è in debito di ${debito}: deve vendere o fare bancarotta`;
  }
  const libera = acquistoInSospeso(partita);
  const casella = libera === null ? null : proprietabile(tabellone(partita.mappa), libera);
  if (casella) {
    if (!mio) return `sta decidendo se comprare ${casella.nome} (${euro(casella.prezzo)})`;
    return partita.impostazioni.aste
      ? `Sei su ${casella.nome}: comprala o mettila all’asta`
      : `Sei su ${casella.nome}: puoi comprarla per ${euro(casella.prezzo)}`;
  }
  if (t.rilancio) return mio ? 'Doppio! Tira ancora' : 'ha fatto doppio: tira ancora';
  if (g.vacanza) return mio ? 'Sei in vacanza: salterai il prossimo turno' : 'va in vacanza: salta il prossimo turno';
  return scambio ?? (mio ? 'Puoi costruire, scambiare o finire il turno' : 'può costruire, scambiare o finire il turno');
}

/* ------------------------------------------------------------------ */
/* L'ultimo evento importante                                          */
/* ------------------------------------------------------------------ */

/** Gli eventi che meritano la scheda tra i pulsanti e il registro. */
const IMPORTANTI = new Set<string>([
  'affitto',
  'carta',
  'acquisto',
  'asta_vinta',
  'asta_deserta',
  'partenza',
  'tassa',
  'premio',
  'prigione',
  'prigione_fallita',
  'uscita_prigione',
  'vacanza',
  'turno_saltato',
  'costruzione',
  'demolizione',
  'vendita',
  'ipoteca',
  'riscatto',
  'debito',
  'bancarotta',
  'rimozione',
  'scambio_accettato',
  'tempo_scaduto',
]);

export interface EventoInVista {
  voce: VoceRegistro;
  /** Viene dal turno prima: si mostra sbiadito. */
  precedente: boolean;
}

/**
 * L'ultimo evento importante già comparso sullo schermo (fino alla voce `fino`): del turno in corso,
 * altrimenti di quello prima. `null` se non ce n'è.
 */
export function eventoCorrente(registro: readonly VoceRegistro[], fino = Infinity): EventoInVista | null {
  let turni = 0;
  for (let i = registro.length - 1; i >= 0; i--) {
    const v = registro[i]!;
    if (v.n > fino) continue;
    const tipo = v.evento.tipo;
    if (tipo === 'inizio' || tipo === 'nuova_partita') return null;
    if (tipo === 'turno') {
      turni++;
      if (turni > 1) return null;
      continue;
    }
    if (IMPORTANTI.has(tipo)) return { voce: v, precedente: turni > 0 };
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Variazioni dei saldi                                                */
/* ------------------------------------------------------------------ */

export interface Variazione {
  importo: number;
  /** Cresce a ogni variazione: fa da `key`, così l'etichetta e la tinta della riga ripartono. */
  n: number;
}

export interface StatoSaldi {
  firma: string;
  saldi: Record<IdGiocatore, number>;
  variazioni: Record<IdGiocatore, Variazione>;
  conta: number;
}

function firmaSaldi(giocatori: readonly Giocatore[]): string {
  return giocatori.map((g) => `${g.id}=${g.saldo}`).join(',');
}

export function saldiIniziali(giocatori: readonly Giocatore[]): StatoSaldi {
  return {
    firma: firmaSaldi(giocatori),
    saldi: Object.fromEntries(giocatori.map((g) => [g.id, g.saldo])),
    variazioni: {},
    conta: 0,
  };
}

/** Confronta i saldi nuovi con quelli visti: chi è cambiato ha una variazione nuova, gli altri tengono la loro. */
export function aggiornaSaldi(prima: StatoSaldi, giocatori: readonly Giocatore[]): StatoSaldi {
  const variazioni = { ...prima.variazioni };
  let conta = prima.conta;
  for (const g of giocatori) {
    const vecchio = prima.saldi[g.id];
    if (vecchio !== undefined && vecchio !== g.saldo) variazioni[g.id] = { importo: g.saldo - vecchio, n: ++conta };
  }
  return { ...saldiIniziali(giocatori), variazioni, conta };
}

/**
 * L'ultima variazione del saldo di ogni giocatore (dall'arrivo sulla pagina in poi). La lista dei giocatori
 * la mostra accanto al saldo per un attimo e tinge la riga: rossa chi paga, verde chi incassa.
 */
export function useVariazioniSaldo(giocatori: readonly Giocatore[]): Record<IdGiocatore, Variazione> {
  const [stato, setStato] = useState(() => saldiIniziali(giocatori));
  if (stato.firma !== firmaSaldi(giocatori)) setStato(aggiornaSaldi(stato, giocatori));
  return stato.variazioni;
}

/* ------------------------------------------------------------------ */
/* Titolo della scheda                                                 */
/* ------------------------------------------------------------------ */

export function titoloScheda(mioTurno: boolean, fuoriVista: boolean, nuovi: number): string {
  if (mioTurno && fuoriVista) return '● Tocca a te — PoorDown';
  return nuovi > 0 ? `(${nuovi}) PoorDown` : 'PoorDown';
}

/**
 * Il titolo della scheda del browser: «● Tocca a te — PoorDown» quando tocca a me e la finestra non è in primo piano,
 * altrimenti i messaggi nuovi della chat chiusa.
 */
export function useTitoloScheda(mioTurno: boolean, nuovi: number): void {
  useEffect(() => {
    const aggiorna = () => {
      document.title = titoloScheda(mioTurno, document.hidden || !document.hasFocus(), nuovi);
    };
    aggiorna();
    window.addEventListener('focus', aggiorna);
    window.addEventListener('blur', aggiorna);
    document.addEventListener('visibilitychange', aggiorna);
    return () => {
      window.removeEventListener('focus', aggiorna);
      window.removeEventListener('blur', aggiorna);
      document.removeEventListener('visibilitychange', aggiorna);
      document.title = 'PoorDown';
    };
  }, [mioTurno, nuovi]);
}
