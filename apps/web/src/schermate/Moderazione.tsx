/*
 * Moderazione in partita: il voto per far uscire chi sta giocando (nella sua riga), l'avviso a chi è votato
 * e la finestra per chi è uscito per tempo, assenza o voto.
 */

import { useState, type ReactNode } from 'react';
import { AnimatePresence } from 'motion/react';
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
 * Il pulsante del voto, nella riga di chi gioca, per chi è in gioco e non sta giocando il turno.
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
        className={votato ? 'pulsante pulsante--piccolo pulsante--fantasma' : 'pulsante pulsante--piccolo pulsante--secondario'}
        aria-label={`${votato ? 'Ritira il voto' : 'Vota l’uscita'} di ${corrente.nome}: ${v.voti.length} voti su ${servono}`}
        disabled={blocco !== null}
        onClick={() => onMossa(mossa)}
      >
        <Icona nome="avviso" />
        {votato ? 'Ritira il voto' : 'Vota l’uscita'} ({v.voti.length}/{servono})
      </button>
    </span>
  );
}

/**
 * Nella riga di chi sta giocando il turno: il voto per farlo uscire. Chi può votare vede il pulsante (con i voti
 * già dati), gli altri solo il conto dei voti; senza timer di turno anche quanto manca all'uscita.
 * Quando il voto è sempre possibile (partita senza timer) e nessuno ha ancora votato, il pulsante compare
 * solo passando sulla riga: la classe .voto-riga--discreto.
 */
export function VotoNellaRiga({
  partita,
  io,
  inviando,
  onMossa,
}: {
  partita: Stato;
  /** Il mio posto, se sono ancora in gioco. */
  io: IdGiocatore | null;
  inviando: boolean;
  onMossa: (m: Mossa) => void;
}): ReactNode {
  const v = partita.turno.votazione;
  const corrente = partita.giocatori.find((g) => g.id === partita.turno.giocatore);
  if (partita.fase !== 'in_corso' || !corrente) return null;
  const puoVotare = io !== null && io !== corrente.id && (v.voti.includes(io) || votoPossibile(partita) === null);
  if (!puoVotare && v.voti.length === 0) return null;
  const discreto = v.voti.length === 0 && !partita.impostazioni.timerTurno;
  return (
    <div className={discreto ? 'voto-riga voto-riga--discreto' : 'voto-riga'}>
      {puoVotare && io ? (
        <PulsanteVoto partita={partita} io={io} inviando={inviando} onMossa={onMossa} />
      ) : (
        <span className="voto-riga__conta">
          Voti per l’uscita: {v.voti.length} di {votiNecessari(partita)}
        </span>
      )}
      {v.scadenza !== null && v.voti.length > 0 && (
        <span className="voto-riga__tempo">
          esce tra <ContoAllaRovescia fino={v.scadenza} />
        </span>
      )}
    </div>
  );
}

/** Al centro del tabellone, sotto i pulsanti, per chi gioca il turno: quanti hanno votato per farlo uscire. */
export function NotaVoto({ partita, io }: { partita: Stato; io: IdGiocatore | null }): ReactNode {
  const v = partita.turno.votazione;
  const corrente = partita.giocatori.find((g) => g.id === partita.turno.giocatore);
  // Gli altri vedono il voto nella riga di chi gioca (VotoNellaRiga).
  if (partita.fase !== 'in_corso' || !corrente || corrente.id !== io || v.voti.length === 0) return null;
  const servono = votiNecessari(partita);
  return (
    <p className="centro-gioco__nota centro-gioco__nota--rosso" role="alert">
      {v.voti.length} {v.voti.length === 1 ? 'giocatore ha' : 'giocatori hanno'} votato per farti uscire dalla partita (ne
      servono {servono}). Finisci il turno per azzerare il voto.
      {v.scadenza !== null && (
        <>
          {' '}
          Tra <ContoAllaRovescia fino={v.scadenza} /> esci comunque, se non hai finito il turno.
        </>
      )}
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
  let gia = false;
  try {
    gia = io !== null && sessionStorage.getItem(chiave(codice, io)) !== null;
  } catch {
    // niente: la si mostra
  }
  // Dentro AnimatePresence: quando si chiude, la finestra esce animata.
  if (!io || !me || !testi || (gia && !chiusa)) return <AnimatePresence />;
  const guarda = () => {
    try {
      sessionStorage.setItem(chiave(codice, io), '1');
    } catch {
      // niente
    }
    setChiusa(true);
  };
  return (
    <AnimatePresence>
      {!chiusa && (
        <Finestra key="fuori" titolo={testi.titolo} onChiudi={guarda}>
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
      )}
    </AnimatePresence>
  );
}
