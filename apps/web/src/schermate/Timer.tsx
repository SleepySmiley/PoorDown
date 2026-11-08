/*
 * Il timer del turno sopra i dadi, uguale per tutti: anello e cifre a palette.
 * Come in richup resta nascosto nei primi 10 secondi del turno e diventa rosso negli ultimi 15.
 * Sotto i 30 secondi chi gioca può chiedere tempo e gli altri possono regalargli un minuto;
 * a chi non è collegato il minuto si può regalare sempre, nel caso stia per tornare.
 */

import type { ReactNode } from 'react';
import {
  POCO_TEMPO_MS,
  tempoTurno,
  verifica,
  type Azione,
  type Giocatore,
  type IdGiocatore,
  type Mossa,
  type Stato,
} from '@poordown/engine';
import { collegamento } from '../rete/sessione';
import { useBattito } from '../ui/battito';
import { Palette } from '../ui/comuni';
import { Icona } from '../ui/icone';
import { minutiSecondi } from '../ui/utili';

/** Nei primi secondi del turno il timer non si vede: non serve mettere fretta a chi ha appena cominciato. */
const NASCOSTO_MS = 10_000;
/** Sotto questa soglia il timer diventa rosso. */
const ROSSO_MS = 15_000;

/** Un conto alla rovescia verso un'ora del server, aggiornato ogni secondo. */
export function ContoAllaRovescia({ fino, className }: { fino: number; className?: string }): ReactNode {
  useBattito(1000);
  return <span className={className}>{minutiSecondi(fino - collegamento.orologio())}</span>;
}

function Anello({ rimasto, totale }: { rimasto: number; totale: number }): ReactNode {
  const r = 15;
  const giro = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 36 36" className="timer__anello" aria-hidden="true">
      <circle cx="18" cy="18" r={r} className="timer__fondo" />
      <circle
        cx="18"
        cy="18"
        r={r}
        className="timer__avanzamento"
        strokeDasharray={giro}
        strokeDashoffset={giro * (1 - Math.min(1, rimasto / totale))}
      />
    </svg>
  );
}

export function TimerTurno({
  partita,
  io,
  inviando,
  onMossa,
}: {
  /** La partita aggiornata (non quella che aspetta le animazioni): il tempo scorre comunque. */
  partita: Stato;
  /** Il mio posto, se sono ancora in gioco. */
  io: IdGiocatore | null;
  inviando: boolean;
  onMossa: (m: Mossa) => void;
}): ReactNode {
  useBattito(250);
  const tempo = partita.fase === 'in_corso' ? tempoTurno(partita, collegamento.orologio()) : null;
  const corrente: Giocatore | undefined = partita.giocatori.find((g) => g.id === partita.turno.giocatore);
  if (!tempo || !corrente) return <div className="centro-gioco__timer" />;

  const assente = corrente.offlineDa !== null;
  const t = partita.turno.tempo;
  const mioTurno = io === corrente.id;
  const poco = tempo.rimasto <= POCO_TEMPO_MS;
  const visibile = tempo.trascorso >= NASCOSTO_MS || poco || assente;
  const blocco = (m: Mossa): string | null => {
    if (inviando) return 'Un attimo…';
    if (!io) return 'Stai solo guardando.';
    return verifica(partita, { ...m, giocatore: io } as Azione)?.messaggio ?? null;
  };

  let azione: ReactNode = null;
  if (mioTurno && partita.impostazioni.timerTurno) {
    if (t.richiesta) {
      azione = (
        <button type="button" className="pulsante pulsante--piccolo pulsante--secondario" disabled>
          <Icona nome="tempo" />
          In attesa di tempo…
        </button>
      );
    } else if (poco && !tempo.fermo) {
      azione = (
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
  } else if (io && !mioTurno && (poco || t.richiesta || assente) && blocco({ tipo: 'regala_tempo' }) === null) {
    azione = (
      <button
        type="button"
        className={
          t.richiesta
            ? 'pulsante pulsante--piccolo pulsante--ambra timer__regalo'
            : 'pulsante pulsante--piccolo pulsante--secondario timer__regalo'
        }
        title={`Dai a ${corrente.nome} un minuto in più`}
        onClick={() => onMossa({ tipo: 'regala_tempo' })}
      >
        <Icona nome="piu" />1 min
      </button>
    );
  }

  const classi = ['timer', tempo.rimasto <= ROSSO_MS && !tempo.fermo ? 'timer--poco' : '', tempo.fermo ? 'timer--fermo' : '']
    .filter(Boolean)
    .join(' ');
  const descrizione = tempo.fermo
    ? `Tempo del turno fermo durante l’asta: ${minutiSecondi(tempo.rimasto)}`
    : assente
      ? `${corrente.nome} ha perso il collegamento: il turno passa tra ${minutiSecondi(tempo.rimasto)}`
      : `Tempo rimasto a ${corrente.nome}: ${minutiSecondi(tempo.rimasto)}`;

  return (
    <div className="centro-gioco__timer">
      {visibile && (
        <div className={classi} role="timer" aria-label={descrizione} title={descrizione}>
          <Anello rimasto={tempo.rimasto} totale={tempo.totale} />
          {assente && <Icona nome="scollegato" className="timer__assente" />}
          <Palette testo={minutiSecondi(tempo.rimasto)} />
        </div>
      )}
      {azione}
    </div>
  );
}
