/*
 * I suoni che non nascono da una scena della regia: il gong del turno, i secondi che scadono, i rilanci all'asta,
 * la chat, chi entra ed esce dalla stanza, il fischio d'inizio. Le scene della partita suonano in regia.ts.
 */

import { useEffect, useRef } from 'react';
import type { Asta, IdGiocatore, MessaggioChat } from '@poordown/engine';
import { collegamento } from '../rete/sessione';
import { useSilenziati } from '../rete/silenziati';
import { suona } from './audio';

/** Con la scheda nascosta, il gong del turno si ripete ogni tanto finché tocca a me. */
const RICHIAMO_MS = 60_000;
/** Voci e messaggi più vecchi di così (arrivati dopo una riconnessione) non suonano più. */
const FRESCO_MS = 3_000;

/**
 * Il gong quando comincia il mio turno. `turno` è il numero del turno se tocca a me, `null` se no
 * (dalla partita mostrata: suona insieme al cartello «Tocca a te»). Non suona entrando in una partita già avviata.
 */
export function useGongTurno(turno: number | null): void {
  const prima = useRef(turno);
  useEffect(() => {
    const precedente = prima.current;
    prima.current = turno;
    if (turno !== null && turno !== precedente) suona('tuoTurno');
  }, [turno]);
  useEffect(() => {
    if (turno === null) return;
    const t = setInterval(() => {
      if (document.hidden) suona('tuoTurno');
    }, RICHIAMO_MS);
    return () => clearInterval(t);
  }, [turno]);
}

/** Un «tic» a ogni secondo intero da `soglia` in giù (`secondi` null: niente da contare). */
export function useTicchettio(secondi: number | null, soglia: number, forza = 1): void {
  const prima = useRef(secondi);
  useEffect(() => {
    const precedente = prima.current;
    prima.current = secondi;
    if (secondi === null || secondi === precedente || secondi < 1 || secondi > soglia) return;
    suona('tic', { forza });
  }, [secondi, soglia, forza]);
}

/** I rilanci all'asta: il mio, quello degli altri e quello che supera me. */
export function useSuoniAsta(asta: Asta | null, io: IdGiocatore | null): void {
  const offerte = asta?.offerte.length ?? 0;
  const migliore = asta?.migliore?.giocatore ?? null;
  const prima = useRef({ offerte, migliore });
  useEffect(() => {
    const p = prima.current;
    prima.current = { offerte, migliore };
    if (offerte <= p.offerte || migliore === null) return;
    if (migliore === io) suona('miaOfferta');
    else if (io !== null && p.migliore === io) suona('superato');
    else suona('offerta', { forza: 0.8 });
  }, [offerte, migliore, io]);
}

function fresco(quando: number): boolean {
  return collegamento.orologio() - quando <= FRESCO_MS;
}

/** I suoni della stanza: chi entra ed esce, il fischio d'inizio, i messaggi in chat. */
export function useSuoniStanza(codice: string, io: IdGiocatore | null, chat: readonly MessaggioChat[]): void {
  const mioPosto = useRef(io);
  useEffect(() => {
    mioPosto.current = io;
  }, [io]);

  useEffect(
    () =>
      collegamento.ascoltaVoci((voci) => {
        const me = mioPosto.current;
        for (const v of voci) {
          if (!fresco(v.quando)) continue;
          const e = v.evento;
          if (e.tipo === 'ingresso' && e.giocatore !== me) suona('ingresso', { forza: 0.8 });
          else if (e.tipo === 'uscita' && e.giocatore !== me) suona('uscita', { forza: 0.8 });
          else if (e.tipo === 'inizio') {
            suona('partenza');
            // Il gong del primo turno: la partita appena nata non passa dal cambio di turno.
            if (me !== null && collegamento.leggi().stanza?.partita?.turno.giocatore === me) suona('tuoTurno', { ritardo: 900 });
          }
        }
      }),
    [],
  );

  const silenziati = useSilenziati(codice);
  const ultimo = chat.at(-1);
  const visto = useRef(ultimo?.n ?? 0);
  useEffect(() => {
    if (!ultimo || ultimo.n <= visto.current) return;
    visto.current = ultimo.n;
    if (ultimo.da !== io && !silenziati.includes(ultimo.da) && fresco(ultimo.quando)) suona('chat');
  }, [ultimo, io, silenziati]);
}
