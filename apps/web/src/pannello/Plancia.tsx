/*
 * Dentro il pannello: a sinistra tutte le stanze del server, a destra quella scelta.
 * L'elenco si aggiorna ogni 3 secondi, la stanza scelta ogni secondo e mezzo; dopo ogni modifica si vede subito
 * la stanza come l'ha lasciata il server.
 */

import { useCallback, useRef, useState, type ReactNode } from 'react';
import { tabellone, type ComandoPannello, type DettaglioPannello, type StanzaNelPannello } from '@poordown/engine';
import { Chip } from '../ui/Chip';
import { Marchio } from '../ui/Marchio';
import { Pulsante } from '../ui/Pulsante';
import { avvisa } from '../ui/avvisi';
import { Pedina } from '../ui/comuni';
import { api, ErroreApi, messaggioErrore } from './api';
import { SchedaStanza } from './SchedaStanza';
import { useSondaggio } from './sondaggio';

/** Esegue un comando sulla stanza scelta; `fatto` è l'avviso di riuscita. Dice se è riuscito. */
export type Esegui = (comando: ComandoPannello, fatto?: string) => Promise<boolean>;

const FASI = { lobby: 'In attesa', partita: 'In partita', finita: 'Finita' } as const;

export function Plancia({ onEsci }: { onEsci: () => void }): ReactNode {
  const [stanze, setStanze] = useState<StanzaNelPannello[] | null>(null);
  const [scelta, setScelta] = useState<string | null>(null);
  const [dettaglio, setDettaglio] = useState<DettaglioPannello | null>(null);
  const [collegato, setCollegato] = useState(true);
  /** Quando è arrivata l'ultima risposta a una modifica: le letture partite prima sono vecchie e si scartano. */
  const ultimaModifica = useRef(0);

  useSondaggio(async () => {
    try {
      const elenco = await api.stanze();
      setStanze(elenco);
      setCollegato(true);
      setScelta((attuale) => (attuale && elenco.some((s) => s.codice === attuale) ? attuale : (elenco[0]?.codice ?? null)));
    } catch (e) {
      if (e instanceof ErroreApi && e.stato === 0) setCollegato(false);
    }
  }, 3_000);

  useSondaggio(
    async () => {
      if (!scelta) return;
      const partenza = performance.now();
      try {
        const d = await api.stanza(scelta);
        if (partenza >= ultimaModifica.current) setDettaglio(d);
      } catch (e) {
        if (e instanceof ErroreApi && e.stato === 404) {
          setDettaglio(null);
          setScelta(null);
        }
      }
    },
    1_500,
    scelta !== null,
    scelta,
  );

  const esegui: Esegui = useCallback(
    async (comando, fatto) => {
      if (!scelta) return false;
      try {
        const d = await api.comando(scelta, comando);
        ultimaModifica.current = performance.now();
        setDettaglio(d);
        if (fatto) avvisa(fatto, 'successo');
        return true;
      } catch (e) {
        avvisa(messaggioErrore(e), 'errore');
        return false;
      }
    },
    [scelta],
  );

  const annulla = async () => {
    if (!scelta) return;
    try {
      const d = await api.annulla(scelta);
      ultimaModifica.current = performance.now();
      setDettaglio(d);
      avvisa('Ultima modifica annullata.', 'successo');
    } catch (e) {
      avvisa(messaggioErrore(e), 'errore');
    }
  };

  const chiudi = async () => {
    if (!scelta) return;
    try {
      await api.chiudi(scelta);
      avvisa(`Stanza ${scelta.toUpperCase()} chiusa: chi c'era è tornato alla home.`, 'successo');
      setStanze((s) => s?.filter((x) => x.codice !== scelta) ?? null);
      setDettaglio(null);
      setScelta(null);
    } catch (e) {
      avvisa(messaggioErrore(e), 'errore');
    }
  };

  const mostrata = dettaglio && dettaglio.codice === scelta ? dettaglio : null;

  return (
    <div className="pc">
      <header className="pc-testa">
        <Marchio className="pc-testa__marchio" />
        <span className="pc-testa__titolo">Pannello di controllo</span>
        <span className={collegato ? 'pc-diretta' : 'pc-diretta pc-diretta--spenta'}>
          <span className="pc-diretta__luce" aria-hidden="true" />
          {collegato ? 'In diretta' : 'Server non raggiungibile'}
        </span>
        <span className="pc-testa__spazio" />
        <Pulsante variante="fantasma" misura="piccolo" icona="esci" onClick={onEsci}>
          Esci
        </Pulsante>
      </header>

      <div className="pc-corpo">
        <nav className="pc-stanze" aria-label="Stanze">
          <h2 className="pc-stanze__titolo">
            Stanze <span className="pc-stanze__conta">{stanze?.length ?? ''}</span>
          </h2>
          {stanze?.length === 0 && <p className="pc-vuoto">Nessuna stanza aperta sul server.</p>}
          {stanze?.map((s) => (
            <VoceStanza key={s.codice} stanza={s} scelta={s.codice === scelta} onScegli={() => setScelta(s.codice)} />
          ))}
        </nav>

        <main className="pc-scheda">
          {mostrata ? (
            <SchedaStanza key={mostrata.codice} d={mostrata} esegui={esegui} onAnnulla={() => void annulla()} onChiudi={() => void chiudi()} />
          ) : (
            <p className="pc-vuoto pc-vuoto--grande">
              {stanze === null ? 'Carico le stanze…' : stanze.length === 0 ? 'Quando qualcuno apre una stanza, compare qui.' : 'Carico la stanza…'}
            </p>
          )}
        </main>
      </div>
    </div>
  );
}

function VoceStanza({ stanza, scelta, onScegli }: { stanza: StanzaNelPannello; scelta: boolean; onScegli: () => void }): ReactNode {
  const persone = stanza.giocatori.filter((g) => !g.bot).length;
  return (
    <button type="button" className="pc-voce" aria-current={scelta} onClick={onScegli}>
      <span className="pc-voce__riga">
        <span className="pc-voce__codice">{stanza.codice}</span>
        <Chip tono={stanza.fase === 'partita' ? 'ambra' : stanza.fase === 'lobby' ? 'segnale' : 'neutro'}>{FASI[stanza.fase]}</Chip>
      </span>
      <span className="pc-voce__pedine" aria-hidden="true">
        {stanza.giocatori.map((g, i) => (
          <Pedina
            key={i}
            colore={g.colore}
            className={['pedina--mini', g.fuori ? 'pc-pedina--fuori' : '', !g.connesso ? 'pc-pedina--assente' : ''].join(' ')}
          />
        ))}
      </span>
      <span className="pc-voce__info">
        {stanza.fase === 'partita' && stanza.diTurno
          ? `Turno ${stanza.turno} · tocca a ${stanza.diTurno}`
          : `${persone} ${persone === 1 ? 'persona' : 'persone'}${stanza.giocatori.length > persone ? ` + ${stanza.giocatori.length - persone} bot` : ''}`}
      </span>
      <span className="pc-voce__info pc-voce__info--tenue">
        {tabellone(stanza.mappa).nome} · {stanza.privata ? 'privata' : 'pubblica'}
        {stanza.inPausa ? ' · in pausa' : ''}
      </span>
    </button>
  );
}
