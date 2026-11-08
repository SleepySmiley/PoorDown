/* Righe del registro con i nomi dei giocatori in grassetto e il pallino del colore di chi agisce. */

import type { ReactNode } from 'react';
import { descriviVoce, type EventoStanza, type IdGiocatore, type VistaStanza, type VoceRegistro } from '@poordown/engine';
import type { RigaRegistro } from '../ui/comuni';

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
