/*
 * Moderazione in partita: il voto per far uscire chi sta giocando, l'avviso del voto al centro del tabellone
 * e la finestra per chi è uscito per tempo, assenza o voto.
 */

import { useState, type ReactNode } from 'react';
import {
  verifica,
  votiNecessari,
  votoPossibile,
  type Azione,
  type IdGiocatore,
  type MotivoUscita,
  type Mossa,
  type Stato,
} from '@poordown/engine';
import { collegamento } from '../rete/sessione';
import { useCollegamento } from '../rete/useCollegamento';
import { destinoDeiMieiBeni } from '../ui/beni';
import { Icona } from '../ui/icone';
import { Finestra } from './Colonne';
import { ContoAllaRovescia } from './Timer';

/**
 * Il pulsante del voto, accanto a «Bancarotta», per chi è in gioco e non sta giocando il turno.
 * Compare quando il voto è possibile, oppure quando ho già votato (per ritirare il voto).
 */
export function PulsanteVoto({
  partita,
  io,
  inviando,
  onMossa,
}: {
  partita: Stato;
  io: IdGiocatore;
  inviando: boolean;
  onMossa: (m: Mossa) => void;
}): ReactNode {
  const v = partita.turno.votazione;
  const corrente = partita.giocatori.find((g) => g.id === partita.turno.giocatore);
  if (partita.fase !== 'in_corso' || !corrente || corrente.id === io) return null;
  const votato = v.voti.includes(io);
  if (!votato && votoPossibile(partita) !== null) return null;

  const mossa: Mossa = { tipo: 'vota', favorevole: !votato };
  const blocco = inviando ? 'Un attimo…' : (verifica(partita, { ...mossa, giocatore: io } as Azione)?.messaggio ?? null);
  const servono = votiNecessari(partita);
  const spiegazione = [
    `Vota per far uscire ${corrente.nome} dalla partita: servono ${servono} voti.`,
    partita.impostazioni.timerTurno ? '' : 'Al primo voto partono 5 minuti: se intanto non finisce il turno, esce comunque.',
    'Il voto si azzera quando finisce il turno.',
  ]
    .filter(Boolean)
    .join('\n');
  return (
    <span className="con-suggerimento con-suggerimento--righe" data-testo={blocco ? `${spiegazione}\n${blocco}` : spiegazione}>
      <button
        type="button"
        className={votato ? 'pulsante pulsante--piccolo pulsante--secondario' : 'pulsante pulsante--piccolo pulsante--ambra'}
        disabled={blocco !== null}
        onClick={() => onMossa(mossa)}
      >
        <Icona nome="avviso" />
        {votato ? 'Ritira il voto' : 'Vota l’uscita'} ({v.voti.length}/{servono})
      </button>
    </span>
  );
}

/** Al centro del tabellone, sotto i pulsanti: a che punto è il voto contro chi gioca. */
export function NotaVoto({ partita, io }: { partita: Stato; io: IdGiocatore | null }): ReactNode {
  const v = partita.turno.votazione;
  const corrente = partita.giocatori.find((g) => g.id === partita.turno.giocatore);
  if (partita.fase !== 'in_corso' || !corrente || v.voti.length === 0) return null;
  const servono = votiNecessari(partita);
  const mio = corrente.id === io;
  const tempo = v.scadenza !== null && (
    <>
      {' '}
      Tra <ContoAllaRovescia fino={v.scadenza} /> {mio ? 'esci comunque, se non hai finito il turno.' : 'esce comunque, se il turno non è finito.'}
    </>
  );
  return mio ? (
    <p className="centro-gioco__nota centro-gioco__nota--rosso" role="alert">
      {v.voti.length} {v.voti.length === 1 ? 'giocatore ha' : 'giocatori hanno'} votato per farti uscire dalla partita (ne
      servono {servono}). Finisci il turno per azzerare il voto.{tempo}
    </p>
  ) : (
    <p className="centro-gioco__nota">
      Voto per far uscire <b>{corrente.nome}</b>: {v.voti.length} di {servono}.{tempo}
    </p>
  );
}

const USCITA: Partial<Record<MotivoUscita, { titolo: string; testo: string }>> = {
  tempo: {
    titolo: 'Hai finito il tempo',
    testo: 'Il tempo del turno è scaduto troppe volte di fila, quindi la partita va avanti senza di te.',
  },
  assenza: {
    titolo: 'Hai perso il posto',
    testo: 'Il collegamento si è interrotto per più di due minuti, quindi il tuo posto è stato tolto.',
  },
  voto: {
    titolo: 'Fuori dalla partita',
    testo: 'La maggioranza dei giocatori ha votato per farti uscire.',
  },
  // Niente per l'espulsione: chi è tolto dall'host perde anche il posto (non è più `io`) e torna alla home
  // con un avviso, anche se è successo mentre era scollegato (vedi Stanza).
};

function chiave(codice: string, io: IdGiocatore): string {
  return `poordown:fuori:${codice}:${io}`;
}

/**
 * La finestra per chi è uscito per tempo, assenza o voto: può restare a guardare o tornare alla home.
 * Dice anche dove sono finiti i suoi beni (a squadre, al compagno). Si mostra una volta sola per scheda.
 */
export function FuoriDallaPartita({
  codice,
  partita,
  io,
  onEsci,
}: {
  codice: string;
  partita: Stato;
  io: IdGiocatore | null;
  onEsci: () => void;
}): ReactNode {
  const [chiusa, setChiusa] = useState(false);
  const { registro } = useCollegamento(collegamento);
  const me = partita.giocatori.find((g) => g.id === io);
  const testi = me?.eliminato ? USCITA[me.eliminato.motivo] : undefined;
  if (!io || !me || !testi || chiusa) return null;
  try {
    if (sessionStorage.getItem(chiave(codice, io))) return null;
  } catch {
    // niente: la si mostra
  }
  const guarda = () => {
    try {
      sessionStorage.setItem(chiave(codice, io), '1');
    } catch {
      // niente
    }
    setChiusa(true);
  };
  return (
    <Finestra titolo={testi.titolo} onChiudi={guarda}>
      <div className="finestra__corpo">
        <p>
          {testi.testo} {destinoDeiMieiBeni(partita, me, registro)}
        </p>
        <p>
          {partita.fase === 'finita'
            ? 'Intanto la partita è finita.'
            : 'Puoi restare a guardare come finisce o tornare alla home.'}
        </p>
      </div>
      <div className="finestra__azioni">
        <button type="button" className="pulsante pulsante--fantasma" onClick={onEsci}>
          <Icona nome="partenza" />
          Torna alla home
        </button>
        <button type="button" className="pulsante pulsante--primario" onClick={guarda}>
          <Icona nome="occhio" />
          Continua a guardare
        </button>
      </div>
    </Finestra>
  );
}
