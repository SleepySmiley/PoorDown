import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { CHAT_MAX, type IdGiocatore, type MessaggioChat, type VistaStanza } from '@poordown/engine';
import { collegamento } from '../rete/sessione';
import { avvisa } from '../ui/avvisi';
import { Pedina, PulsanteIcona } from '../ui/comuni';
import { Icona } from '../ui/icone';

function chiScrive(stanza: VistaStanza, scrivono: IdGiocatore[], io: IdGiocatore | null): string | null {
  const nomi = scrivono
    .filter((id) => id !== io)
    .map((id) => stanza.partecipanti.find((p) => p.id === id)?.nome)
    .filter((n): n is string => Boolean(n));
  if (nomi.length === 0) return null;
  if (nomi.length === 1) return `${nomi[0]} sta scrivendo…`;
  if (nomi.length === 2) return `${nomi[0]} e ${nomi[1]} stanno scrivendo…`;
  return 'Più persone stanno scrivendo…';
}

export function Chat({
  stanza,
  io,
  messaggi,
  scrivono,
  onRiduci,
}: {
  stanza: VistaStanza;
  io: IdGiocatore | null;
  messaggi: MessaggioChat[];
  scrivono: IdGiocatore[];
  onRiduci: () => void;
}): ReactNode {
  const [testo, setTesto] = useState('');
  const [invio, setInvio] = useState(false);
  const lista = useRef<HTMLOListElement>(null);
  const ultimo = messaggi.at(-1)?.n;

  // Ogni messaggio nuovo porta in fondo alla chat.
  useLayoutEffect(() => {
    const el = lista.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [ultimo]);

  const scrive = chiScrive(stanza, scrivono, io);

  return (
    <section className="pannello chat" aria-label="Chat">
      <header className="chat__testa">
        <span className="chat__comandi">
          <PulsanteIcona icona="riduci" etichetta="Riduci la chat" onClick={onRiduci} />
        </span>
        <h2 className="chat__titolo">Chat</h2>
      </header>
      {messaggi.length === 0 ? (
        <p className="chat__vuota">Ancora nessun messaggio.</p>
      ) : (
        <ol className="chat__messaggi" ref={lista}>
          {messaggi.map((m, i) => {
            const mio = m.da === io;
            const stessoAutore = messaggi[i - 1]?.da === m.da;
            return (
              <li key={m.n} className={mio ? 'messaggio messaggio--mio' : 'messaggio'}>
                {!mio && !stessoAutore && (
                  <span className="messaggio__autore">
                    <Pedina colore={m.colore} className="pedina--mini" />
                    {m.nome}
                  </span>
                )}
                <p className="messaggio__testo">{m.testo}</p>
              </li>
            );
          })}
        </ol>
      )}
      <p className="chat__scrive" aria-live="polite">
        {scrive}
      </p>
      {io === null ? (
        <p className="chat__avviso">Solo chi gioca può scrivere in chat.</p>
      ) : (
        <form
          className="chat__scrivi"
          onSubmit={(e) => {
            e.preventDefault();
            const pulito = testo.trim();
            if (!pulito || invio) return;
            setInvio(true);
            void collegamento.comando('scrivi', { testo: pulito }).then((r) => {
              setInvio(false);
              if (r.ok) setTesto('');
              else avvisa(r.messaggio, 'errore');
            });
          }}
        >
          <label className="solo-lettori" htmlFor="chat-campo">
            Messaggio
          </label>
          <input
            id="chat-campo"
            type="text"
            placeholder="Scrivi un messaggio…"
            maxLength={CHAT_MAX}
            autoComplete="off"
            value={testo}
            onChange={(e) => {
              setTesto(e.target.value);
              if (e.target.value.trim()) collegamento.staScrivendo();
            }}
          />
          <button
            type="submit"
            className="pulsante-icona pulsante-icona--pieno"
            aria-label="Invia"
            disabled={!testo.trim() || invio}
          >
            <Icona nome="invia" />
          </button>
        </form>
      )}
    </section>
  );
}

/** Chat ridotta a una bolla: il numero conta i messaggi arrivati da quando è chiusa. */
export function BollaChat({ messaggi, onEspandi }: { messaggi: MessaggioChat[]; onEspandi: () => void }): ReactNode {
  const [visti] = useState(() => messaggi.at(-1)?.n ?? 0);
  const nuovi = messaggi.filter((m) => m.n > visti).length;
  useEffect(() => {
    document.title = nuovi > 0 ? `(${nuovi}) PoorDown` : 'PoorDown';
    return () => {
      document.title = 'PoorDown';
    };
  }, [nuovi]);
  return (
    <button
      type="button"
      className="chat-bolla"
      aria-label={nuovi > 0 ? `Espandi la chat: ${nuovi} messaggi nuovi` : 'Espandi la chat'}
      title="Espandi la chat"
      onClick={onEspandi}
    >
      <Icona nome="chat" />
      {nuovi > 0 && <span className="chat-bolla__conta">{nuovi}</span>}
    </button>
  );
}
