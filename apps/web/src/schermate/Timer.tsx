/*
 * Il tempo del turno, uguale per tutti: sta dentro il cartello del turno (CartelloTurno), con le cifre ferme
 * a palette e la barra del colore del giocatore, rossa negli ultimi 15 secondi.
 * Sotto i 30 secondi chi gioca può chiedere tempo e gli altri possono regalargli un minuto;
 * a chi non è collegato il minuto si può regalare sempre, nel caso stia per tornare.
 */

import type { ReactNode } from 'react';
import { verifica, type Azione, type IdGiocatore, type Mossa, type Stato } from '@poordown/engine';
import { collegamento } from '../rete/sessione';
import { useBattito } from '../ui/battito';
import { Palette } from '../ui/comuni';
import { Icona } from '../ui/icone';
import { minutiSecondi } from '../ui/utili';
import type { TempoDelTurno } from './tempo';

/** Un conto alla rovescia verso un'ora del server, aggiornato ogni secondo. */
export function ContoAllaRovescia({ fino, className }: { fino: number; className?: string }): ReactNode {
  useBattito(1000);
  return <span className={className}>{minutiSecondi(fino - collegamento.orologio())}</span>;
}

/** Le cifre del tempo che resta, a palette ferme (non girano a ogni secondo). */
export function CifreTempo({ vista }: { vista: TempoDelTurno }): ReactNode {
  const { tempo, assente, corrente } = vista;
  const descrizione = tempo.fermo
    ? `Tempo del turno fermo durante l’asta: ${minutiSecondi(tempo.rimasto)}`
    : assente
      ? `${corrente.nome} ha perso il collegamento: il turno passa tra ${minutiSecondi(tempo.rimasto)}`
      : `Tempo rimasto a ${corrente.nome}: ${minutiSecondi(tempo.rimasto)}`;
  const classi = ['cifre-tempo', vista.rosso ? 'cifre-tempo--poco' : '', tempo.fermo ? 'cifre-tempo--fermo' : '']
    .filter(Boolean)
    .join(' ');
  return (
    <span className={classi} role="timer" aria-label={descrizione} title={descrizione}>
      {assente && <Icona nome="scollegato" className="cifre-tempo__assente" />}
      <Palette testo={minutiSecondi(tempo.rimasto)} />
    </span>
  );
}

/** «Chiedi tempo» per chi gioca, «+1 min» per gli altri: compaiono solo quando servono. */
export function AzioneTempo({
  partita,
  vista,
  io,
  inviando,
  onMossa,
}: {
  partita: Stato;
  vista: TempoDelTurno;
  /** Il mio posto, se sono ancora in gioco. */
  io: IdGiocatore | null;
  inviando: boolean;
  onMossa: (m: Mossa) => void;
}): ReactNode {
  const { corrente, poco, assente, tempo } = vista;
  const t = partita.turno.tempo;
  const mioTurno = io === corrente.id;
  const blocco = (m: Mossa): string | null => {
    if (inviando) return 'Un attimo…';
    if (!io) return 'Stai solo guardando.';
    return verifica(partita, { ...m, giocatore: io } as Azione)?.messaggio ?? null;
  };

  if (mioTurno && partita.impostazioni.timerTurno) {
    if (t.richiesta) {
      return (
        <button type="button" className="pulsante pulsante--piccolo pulsante--secondario" disabled>
          <Icona nome="tempo" />
          In attesa di tempo…
        </button>
      );
    }
    if (poco && !tempo.fermo) {
      return (
        <button
          type="button"
          className="pulsante pulsante--piccolo pulsante--secondario"
          disabled={blocco({ tipo: 'chiedi_tempo' }) !== null}
          title="Chiedi agli altri giocatori un minuto in più"
          onClick={() => onMossa({ tipo: 'chiedi_tempo' })}
        >
          <Icona nome="tempo" />
          Chiedi tempo
        </button>
      );
    }
    return null;
  }
  if (io && !mioTurno && (poco || t.richiesta || assente) && blocco({ tipo: 'regala_tempo' }) === null) {
    return (
      <button
        type="button"
        className={t.richiesta ? 'pulsante pulsante--piccolo pulsante--ambra' : 'pulsante pulsante--piccolo pulsante--secondario'}
        title={`Dai a ${corrente.nome} un minuto in più`}
        onClick={() => onMossa({ tipo: 'regala_tempo' })}
      >
        <Icona nome="piu" />1 min
      </button>
    );
  }
  return null;
}
