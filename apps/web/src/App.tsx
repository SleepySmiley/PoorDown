import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { NOME_GIOCO, VERSIONE, type EventiClient, type EventiServer, type InfoServer } from '@poordown/engine';
import { CodiceQr } from './CodiceQr';

type Collegamento = 'in-corso' | 'attivo' | 'perso';

const TESTO_COLLEGAMENTO: Record<Collegamento, string> = {
  'in-corso': 'Collegamento al server…',
  attivo: 'Collegato al server',
  perso: 'Server non raggiungibile',
};

/** Pagina provvisoria della Fase 0: controlla che server e rete locale funzionino. */
export function App() {
  const [collegamento, setCollegamento] = useState<Collegamento>('in-corso');
  const [browser, setBrowser] = useState<number | null>(null);
  const [info, setInfo] = useState<InfoServer | null>(null);

  useEffect(() => {
    const socket: Socket<EventiServer, EventiClient> = io();
    socket.on('connect', () => {
      setCollegamento('attivo');
      fetch('/api/info')
        .then((risposta) => risposta.json() as Promise<InfoServer>)
        .then(setInfo)
        .catch(() => setInfo(null));
    });
    socket.on('disconnect', () => setCollegamento('perso'));
    socket.on('connect_error', () => setCollegamento('perso'));
    socket.on('presenze', setBrowser);
    return () => {
      socket.disconnect();
    };
  }, []);

  const [indirizzo, ...altriIndirizzi] = info?.indirizzi ?? [];

  return (
    <main className="pagina">
      <header className="intestazione">
        <p className="etichetta">Versione {VERSIONE} · lavori in corso</p>
        <h1 className="marchio">{NOME_GIOCO}</h1>
        <p className="introduzione">
          Il tavolo è ancora in montaggio. Questa pagina serve a controllare che il server sia acceso e che gli
          amici lo raggiungano dalla rete di casa.
        </p>
      </header>

      <section className="scheda" aria-live="polite">
        <h2>Server</h2>
        <p className="stato" data-collegamento={collegamento}>
          <span className="pallino" aria-hidden="true" />
          {TESTO_COLLEGAMENTO[collegamento]}
        </p>
        {collegamento === 'attivo' && browser !== null && (
          <p className="nota">
            {browser === 1 ? 'C’è 1 browser collegato: questo.' : `Ci sono ${browser} browser collegati.`}
          </p>
        )}
        {collegamento === 'perso' && (
          <p className="nota">Controlla che la finestra del server sia ancora aperta sul PC.</p>
        )}
      </section>

      <section className="scheda">
        <h2>Invita gli amici</h2>
        {indirizzo ? (
          <div className="invito">
            <CodiceQr testo={indirizzo} />
            <div className="invito-testo">
              <p>Inquadra il codice con il telefono, oppure apri questo indirizzo nel browser:</p>
              <p className="indirizzo">{indirizzo}</p>
              <p className="nota">Il dispositivo deve essere collegato alla stessa rete del PC che fa da server.</p>
            </div>
          </div>
        ) : (
          <p className="nota">
            {info
              ? 'Il PC non risulta collegato a una rete locale: collegalo al Wi-Fi o al cavo e riavvia PoorDown.'
              : 'Cerco l’indirizzo del server…'}
          </p>
        )}
        {altriIndirizzi.length > 0 && (
          <p className="nota altri">
            Se non funziona, prova: <span className="indirizzo">{altriIndirizzi.join(' · ')}</span>
          </p>
        )}
      </section>

      <footer className="nota piede">Fase 0 · Fondamenta</footer>
    </main>
  );
}
