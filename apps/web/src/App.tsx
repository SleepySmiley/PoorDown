import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { NOME_GIOCO, VERSIONE, type EventiClient, type EventiServer, type InfoServer } from '@poordown/engine';
import { CodiceQr } from './CodiceQr';
import { tokenDelBrowser } from './rete/token';

type Collegamento = 'in-corso' | 'attivo' | 'perso';

const TESTO_COLLEGAMENTO: Record<Collegamento, string> = {
  'in-corso': 'Collegamento al server…',
  attivo: 'Collegato al server',
  perso: 'Server non raggiungibile',
};

/** Pagina provvisoria della Fase 0: controlla che server e rete locale funzionino. */
export function App() {
  const [collegamento, setCollegamento] = useState<Collegamento>('in-corso');
  const [info, setInfo] = useState<InfoServer | null>(null);

  useEffect(() => {
    const socket: Socket<EventiServer, EventiClient> = io({ auth: { token: tokenDelBrowser() } });
    socket.on('connect', () => {
      setCollegamento('attivo');
      fetch('/api/info')
        .then((risposta) => risposta.json() as Promise<InfoServer>)
        .then(setInfo)
        .catch(() => setInfo(null));
    });
    socket.on('disconnect', () => setCollegamento('perso'));
    socket.on('connect_error', () => setCollegamento('perso'));
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
        {collegamento === 'attivo' && (
          <p className="nota">
            Le stanze funzionano già: provale nel <a href="/prova">banco di prova</a>, anche da più browser insieme.
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

      <footer className="nota piede">Fase 3 · Server e stanze</footer>
    </main>
  );
}
