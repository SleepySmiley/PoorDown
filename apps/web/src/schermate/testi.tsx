/* Righe del registro con i nomi dei giocatori in grassetto e il pallino del colore di chi agisce. */

import type { ReactNode } from 'react';
import {
  descriviVoce,
  type EventoStanza,
  type IdGiocatore,
  type MotivoUscita,
  type VistaStanza,
  type VoceRegistro,
} from '@poordown/engine';
import type { RigaRegistro } from '../ui/comuni';

/** Cosa scrivere nella lista giocatori, al posto del saldo, per chi è uscito dalla partita. */
export const ESITO_USCITA: Record<MotivoUscita, string> = {
  bancarotta: 'Bancarotta',
  tempo: 'Tempo scaduto',
  assenza: 'Assenza',
  voto: 'Votazione',
  espulsione: 'Espulsione',
};

/** 2_896_000 → "48 minuti e 16 secondi"; 3_725_000 → "1 ora, 2 minuti e 5 secondi". */
export function durataInParole(ms: number): string {
  const totale = Math.round(ms / 1000);
  const ore = Math.floor(totale / 3600);
  const minuti = Math.floor((totale % 3600) / 60);
  const secondi = totale % 60;
  const parti = [
    ore > 0 ? `${ore} ${ore === 1 ? 'ora' : 'ore'}` : '',
    minuti > 0 ? `${minuti} ${minuti === 1 ? 'minuto' : 'minuti'}` : '',
    secondi > 0 || totale === 0 ? `${secondi} ${secondi === 1 ? 'secondo' : 'secondi'}` : '',
  ].filter(Boolean);
  return parti.length === 1 ? parti[0]! : `${parti.slice(0, -1).join(', ')} e ${parti.at(-1)!}`;
}

/** 1 → "una volta", 3 → "3 volte". */
export function volte(n: number): string {
  return n === 1 ? 'una volta' : `${n} volte`;
}

function protagonista(e: EventoStanza): IdGiocatore | null {
  // Lo scambio lo accetta o lo rifiuta chi l'ha ricevuto.
  if (e.tipo === 'scambio_accettato' || e.tipo === 'scambio_rifiutato') return e.a;
  if ('giocatore' in e) return e.giocatore;
  if ('da' in e) return e.da;
  return null;
}

function regex(nomi: string[]): RegExp | null {
  const unici = [...new Set(nomi)].filter(Boolean).sort((a, b) => b.length - a.length);
  if (unici.length === 0) return null;
  return new RegExp(`(${unici.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');
}

function grassetto(testo: string, cerca: RegExp | null): ReactNode {
  if (!cerca) return testo;
  return testo.split(cerca).map((pezzo, i) => (i % 2 === 1 ? <b key={i}>{pezzo}</b> : pezzo));
}

/**
 * Le righe da mostrare, dalla più recente.
 * @param fino numero dell'ultima voce già "accaduta" sullo schermo (le altre aspettano l'animazione).
 * @param prima riga fissa in fondo (es. «Sei entrato nella stanza K7Q2M»).
 */
export function righeRegistro(
  registro: readonly VoceRegistro[],
  stanza: VistaStanza,
  fino = Infinity,
  prima?: string,
): RigaRegistro[] {
  const giocatori = stanza.partita?.giocatori ?? [];
  const colori = new Map<IdGiocatore, number>();
  // Anche chi è già uscito dalla stanza tiene il suo colore nelle righe vecchie.
  for (const v of registro) if (v.evento.tipo === 'ingresso') colori.set(v.evento.giocatore, v.evento.colore);
  for (const p of stanza.partecipanti) colori.set(p.id, p.colore);
  for (const g of giocatori) colori.set(g.id, g.colore);
  const nomi = [...stanza.partecipanti.map((p) => p.nome), ...giocatori.map((g) => g.nome)];
  for (const v of registro) if ('nome' in v.evento) nomi.push(v.evento.nome);
  const cerca = regex(nomi);

  const righe: RigaRegistro[] = [];
  for (const v of registro) {
    if (v.n > fino) break;
    const testo = descriviVoce(v.evento, stanza.partita);
    if (testo === null) continue;
    const chi = protagonista(v.evento);
    const colore = v.evento.tipo === 'ingresso' ? v.evento.colore : chi ? colori.get(chi) : undefined;
    righe.push({ n: v.n, colore, testo: grassetto(testo, cerca) });
  }
  if (prima) righe.unshift({ n: 0, testo: prima });
  return righe.reverse();
}
