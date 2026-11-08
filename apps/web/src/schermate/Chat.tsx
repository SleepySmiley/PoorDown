import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { CHAT_MAX, type IdGiocatore, type MessaggioChat, type VistaStanza } from '@poordown/engine';
import { collegamento } from '../rete/sessione';
import { silenzia, useSilenziati } from '../rete/silenziati';
import { avvisa } from '../ui/avvisi';
import { Pedina, PulsanteIcona } from '../ui/comuni';
import { Icona } from '../ui/icone';
import { Binario } from './Colonne';

function chiScrive(
  stanza: VistaStanza,
  scrivono: IdGiocatore[],
  io: IdGiocatore | null,
  silenziati: readonly IdGiocatore[],
): string | null {
  const nomi = scrivono
    .filter((id) => id !== io && !silenziati.includes(id))
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
  // A squadre si scrive a tutti o solo alla propria squadra.
  const [aSquadra, setASquadra] = useState(false);
  const mia = stanza.partecipanti.find((p) => p.id === io)?.squadra ?? null;
  const conSquadra = stanza.impostazioni.squadre && mia !== null;
  const nomeSquadra = mia === null ? '' : (stanza.squadre[mia] ?? `Squadra ${mia + 1}`);
  const soloSquadra = conSquadra && aSquadra;
  const lista = useRef<HTMLOListElement>(null);
  const silenziati = useSilenziati(stanza.codice);
  // I messaggi di chi ho silenziato non si vedono (i miei sì, sempre).
  const visibili = messaggi.filter((m) => m.da === io || !silenziati.includes(m.da));
  const ultimo = visibili.at(-1)?.n;
  // Il nome di chi ho silenziato, dalla stanza o dall'ultimo suo messaggio.
  const nomeDi = (id: IdGiocatore) =>
    stanza.partecipanti.find((p) => p.id === id)?.nome ?? messaggi.findLast((m) => m.da === id)?.nome;
  const muti = silenziati
    .map((id) => ({ id, nome: nomeDi(id) }))
    .filter((x): x is { id: IdGiocatore; nome: string } => x.nome !== undefined);

  // Ogni messaggio nuovo porta in fondo alla chat.
  useLayoutEffect(() => {
    const el = lista.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [ultimo]);

  const scrive = chiScrive(stanza, scrivono, io, silenziati);

  return (
    <section className="pannello chat" aria-label="Chat">
      <header className="chat__testa">
        <span className="chat__comandi">
          <PulsanteIcona icona="riduci" etichetta="Riduci la chat" onClick={onRiduci} />
        </span>
        <h2 className="chat__titolo">Chat</h2>
      </header>
      {conSquadra && (
        <div className="chat__canali" role="group" aria-label="A chi scrivi">
          <button
            type="button"
            className={soloSquadra ? 'chat__canale' : 'chat__canale chat__canale--attivo'}
            aria-pressed={!soloSquadra}
            onClick={() => setASquadra(false)}
          >
            Tutti
          </button>
          <button
            type="button"
            className={soloSquadra ? 'chat__canale chat__canale--attivo' : 'chat__canale'}
            aria-pressed={soloSquadra}
            onClick={() => setASquadra(true)}
          >
            <Binario indice={mia} nome={nomeSquadra} className="binario--riga" />
            Squadra
          </button>
        </div>
      )}
      {visibili.length === 0 ? (
        <p className="chat__vuota">
          {messaggi.length > 0 ? 'I messaggi di chi hai silenziato sono nascosti.' : 'Ancora nessun messaggio.'}
        </p>
      ) : (
        <ol className="chat__messaggi" ref={lista}>
          {visibili.map((m, i) => {
            const mio = m.da === io;
            const stessoAutore = visibili[i - 1]?.da === m.da;
            return (
              <li
                key={m.n}
                className={['messaggio', mio ? 'messaggio--mio' : '', m.squadra !== undefined ? 'messaggio--squadra' : ''].join(' ')}
              >
                {!mio && !stessoAutore && (
                  <span className="messaggio__autore">
                    <Pedina colore={m.colore} className="pedina--mini" />
                    {m.nome}
                    <button
                      type="button"
                      className="messaggio__silenzia"
                      aria-label={`Silenzia ${m.nome} in chat`}
                      title={`Silenzia ${m.nome}: non vedrai più i suoi messaggi`}
                      onClick={() => silenzia(stanza.codice, m.da, true)}
                    >
                      <Icona nome="muto" />
                    </button>
                  </span>
                )}
                <p className="messaggio__testo">
                  {m.squadra !== undefined && <span className="messaggio__canale">Squadra</span>}
                  {m.testo}
                </p>
              </li>
            );
          })}
        </ol>
      )}
      {muti.length > 0 && (
        <p className="chat__silenziati">
          <Icona nome="muto" titolo="Silenziati" />
          <span>Non vedi i messaggi di</span>
          {muti.map((x) => (
            <button
              key={x.id}
              type="button"
              className="chat__riattiva"
              title={`Riattiva ${x.nome}: torni a vedere i suoi messaggi`}
              onClick={() => silenzia(stanza.codice, x.id, false)}
            >
              {x.nome}
              <Icona nome="chiudi" />
            </button>
          ))}
        </p>
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
            void collegamento.comando('scrivi', soloSquadra ? { testo: pulito, squadra: true } : { testo: pulito }).then((r) => {
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
            placeholder={soloSquadra ? `Scrivi a ${nomeSquadra}…` : 'Scrivi un messaggio…'}
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
