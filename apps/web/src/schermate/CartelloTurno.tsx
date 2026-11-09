/*
 * Il cartello del turno, in cima al centro del tabellone: di chi è il turno («TOCCA A TE» in ambra,
 * oppure «Tocca a Bruno»), cosa deve fare adesso e quanto tempo gli resta.
 * Chi lo usa gli dà una `key` per turno (numero e giocatore): al cambio di turno il cartello rinasce e arriva
 * come un cartello delle partenze, le lettere del titolo che girano una dopo l'altra (gioco.css); quando tocca
 * a me il bordo ambra lampeggia due volte.
 */

import type { ReactNode } from 'react';
import { aOppureAd, TENTATIVI_PRIGIONE, type Attivita, type IdGiocatore, type Mossa, type Stato } from '@poordown/engine';
import { useTicchettio } from '../suoni/richiami';
import { Pedina } from '../ui/comuni';
import { iniziale, variabili } from '../ui/utili';
import { useTempoTurno } from './tempo';
import { AzioneTempo, CifreTempo } from './Timer';
import { fraseTurno, maiuscola, type Momento } from './turno';

/** Un testo lettera per lettera: ognuna gira al suo posto poco dopo quella prima (`--i`). */
function Lettere({ testo, da = 0 }: { testo: string; da?: number }): ReactNode {
  return [...testo].map((c, i) => (
    <span key={i} className="lettera" style={variabili({ '--i': String(da + i) })} aria-hidden="true">
      {c}
    </span>
  ));
}

/** Tre pallini: i tentativi di uscire di prigione già falliti, quello che sta per fare e quelli che restano. */
function Tentativi({ falliti }: { falliti: number }): ReactNode {
  return (
    <span className="tentativi" aria-hidden="true">
      {Array.from({ length: TENTATIVI_PRIGIONE }, (_, i) => (
        <span
          key={i}
          className={i < falliti ? 'tentativi__punto tentativi__punto--fallito' : i === falliti ? 'tentativi__punto tentativi__punto--adesso' : 'tentativi__punto'}
        />
      ))}
    </span>
  );
}

export function CartelloTurno({
  partita,
  vivo,
  io,
  attivita,
  occupata,
  momento,
  inviando,
  onMossa,
}: {
  /** La partita mostrata (segue le animazioni). */
  partita: Stato;
  /** La partita aggiornata: per il tempo e i collegamenti. */
  vivo: Stato;
  /** Il mio posto, se sono ancora in gioco. */
  io: IdGiocatore | null;
  attivita: Record<IdGiocatore, Attivita>;
  /** Una scena è in corso (dadi, pedina che cammina). */
  occupata: boolean;
  /** Cosa mostra la scena in corso: il cartello lo racconta. */
  momento: Momento | null;
  inviando: boolean;
  onMossa: (m: Mossa) => void;
}): ReactNode {
  const vista = useTempoTurno(vivo);
  // Gli ultimi dieci secondi del mio turno ticchettano (il tempo vero, non quello che aspetta le animazioni).
  useTicchettio(vista && vista.corrente.id === io && !vista.tempo.fermo ? Math.ceil(vista.tempo.rimasto / 1000) : null, 10);
  const corrente = partita.giocatori.find((g) => g.id === partita.turno.giocatore);
  if (!corrente) return null;
  const mio = corrente.id === io;
  // «Tocca a Bruno», «Tocca ad Anna»: il nome va in grassetto, la preposizione resta col resto del titolo.
  const tocca = `Tocca ${aOppureAd(corrente.nome)} `;
  const assente = vivo.giocatori.find((g) => g.id === corrente.id)?.offlineDa != null;
  const fase = fraseTurno({ partita, io, attivita: attivita[corrente.id], assente, occupata, momento });
  // Il tempo è quello della partita aggiornata: si mostra solo quando parla dello stesso turno.
  const tempo = vista && vista.corrente.id === corrente.id ? vista : null;
  const inPrigione = partita.turno.fase === 'prigione' && !occupata;
  const classi = [
    'cartello-turno',
    mio ? 'cartello-turno--mio' : '',
    assente ? 'cartello-turno--assente' : '',
    tempo?.rosso ? 'cartello-turno--poco' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <section
      className={classi}
      data-giocatore={corrente.id}
      style={variabili({ '--colore': `var(--p${corrente.colore})` })}
      aria-label={mio ? `Tocca a te. ${fase}` : `${tocca}${corrente.nome}. ${maiuscola(fase)}`}
      aria-live="polite"
    >
      <span className={inPrigione ? 'cartello-turno__pedina in-prigione' : 'cartello-turno__pedina'}>
        <Pedina colore={corrente.colore} iniziale={iniziale(corrente.nome)} />
      </span>
      <div className="cartello-turno__testo">
        <p className="cartello-turno__titolo">
          {mio ? (
            <Lettere testo="Tocca a te" />
          ) : (
            <>
              <Lettere testo={tocca} />
              <b>
                <Lettere testo={corrente.nome} da={tocca.length} />
              </b>
            </>
          )}
        </p>
        <p className="cartello-turno__fase">
          {inPrigione && <Tentativi falliti={corrente.prigione ?? 0} />}
          {maiuscola(fase)}
        </p>
      </div>
      {tempo && (
        <div className="cartello-turno__tempo">
          <AzioneTempo partita={vivo} vista={tempo} io={io} inviando={inviando} onMossa={onMossa} />
          <CifreTempo vista={tempo} />
        </div>
      )}
      {tempo && (
        <span className="cartello-turno__barra" aria-hidden="true">
          <span style={variabili({ '--quota': String(tempo.quota) })} />
        </span>
      )}
    </section>
  );
}
