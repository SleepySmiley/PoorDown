import { useState, type ReactNode } from 'react';
import { GIOCATORI, REGIONI, SIGLE, euro } from './dati';
import { Icona, type NomeIcona } from './icone';
import { variabili } from './utili';

/**
 * Caratteri a palette, come nei tabelloni delle partenze. Girano quando compaiono;
 * quando il testo cambia gira solo il carattere diverso (la chiave conta da destra,
 * così le cifre restano allineate anche se il numero cambia lunghezza).
 */
export function Palette({ testo, unita, className }: { testo: string; unita?: string; className?: string }): ReactNode {
  const caratteri = [...testo];
  return (
    <span className={className ? `palette ${className}` : 'palette'}>
      <span className="solo-lettori">
        {testo}
        {unita ? ` ${unita}` : ''}
      </span>
      {caratteri.map((carattere, i) =>
        /[.:,]/.test(carattere) ? (
          <span key={`${caratteri.length - i}-sep`} className="palette__separatore" aria-hidden="true">
            {carattere}
          </span>
        ) : (
          <span
            key={`${caratteri.length - i}-${carattere}`}
            className="paletta"
            style={variabili({ '--i': String(i) })}
            aria-hidden="true"
          >
            {carattere}
          </span>
        ),
      )}
      {unita && (
        <span className="palette__unita" aria-hidden="true">
          {unita}
        </span>
      )}
    </span>
  );
}

/** Un importo in euro a palette: le cifre girano, il simbolo resta stampato. */
export function Soldi({ valore, className }: { valore: number; className?: string }): ReactNode {
  const testo = euro(valore).replace(' €', '');
  return <Palette testo={testo} unita="€" className={className} />;
}

export function Pedina({
  colore,
  iniziale,
  className,
}: {
  colore: number;
  iniziale?: string;
  className?: string;
}): ReactNode {
  return (
    <span
      className={className ? `pedina ${className}` : 'pedina'}
      style={variabili({ '--colore': `var(--p${colore})` })}
      aria-hidden="true"
    >
      {iniziale}
    </span>
  );
}

/** Scudo della regione con la sigla: forma diversa dalle pedine, così non si confondono. */
export function Stemma({ gruppo, className }: { gruppo: number; className?: string }): ReactNode {
  return (
    <svg
      className={className ? `stemma ${className}` : 'stemma'}
      viewBox="0 0 26 30"
      role="img"
      aria-label={REGIONI[gruppo - 1]}
    >
      <path
        d="M3.5 2h19A1.5 1.5 0 0 1 24 3.5V13c0 7.4-5.2 12-11 14.8C7.2 25 2 20.4 2 13V3.5A1.5 1.5 0 0 1 3.5 2z"
        style={{ fill: `var(--g${gruppo})` }}
        stroke="#fff"
        strokeWidth="2"
      />
      <text x="13" y="14.5" textAnchor="middle" dominantBaseline="middle" style={{ fill: `var(--su-g${gruppo}, #fff)` }}>
        {SIGLE[gruppo - 1]}
      </text>
    </svg>
  );
}

const PUNTI: Record<number, number[]> = {
  1: [5],
  2: [1, 9],
  3: [1, 5, 9],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9],
};

export function Dado({ valore }: { valore: number }): ReactNode {
  return (
    <div className="dado" role="img" aria-label={`Dado: ${valore}`}>
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={PUNTI[valore]?.includes(i + 1) ? 'punto' : undefined} />
      ))}
    </div>
  );
}

export interface VoceRegistro {
  id: number;
  colore?: number;
  testo: ReactNode;
}

/** Registro eventi al centro del tabellone: il più recente in alto, gli altri sbiadiscono. */
export function Registro({ voci }: { voci: VoceRegistro[] }): ReactNode {
  return (
    <ol className="registro" aria-label="Ultimi eventi" aria-live="polite">
      {voci.slice(0, 50).map((v, i) => (
        <li key={v.id} className="registro__voce" style={variabili({ '--eta': String(Math.min(i, 9)) })}>
          {v.colore !== undefined && <Pedina colore={v.colore} className="pedina--mini" />}
          <span>{v.testo}</span>
        </li>
      ))}
    </ol>
  );
}

export function PulsanteIcona({
  icona,
  etichetta,
  onClick,
  pressato,
}: {
  icona: NomeIcona;
  etichetta: string;
  onClick?: () => void;
  pressato?: boolean;
}): ReactNode {
  return (
    <button
      type="button"
      className="pulsante-icona"
      aria-label={etichetta}
      title={etichetta}
      onClick={onClick}
      aria-pressed={pressato}
    >
      <Icona nome={icona} />
    </button>
  );
}

export function Interruttore({
  acceso,
  onCambia,
  disattivo,
  etichetta,
}: {
  acceso: boolean;
  onCambia?: (v: boolean) => void;
  disattivo?: boolean;
  etichetta: string;
}): ReactNode {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={acceso}
      aria-label={etichetta}
      disabled={disattivo}
      className="interruttore"
      onClick={() => onCambia?.(!acceso)}
    >
      <span className="interruttore__testo" aria-hidden="true">
        {acceso ? 'Sì' : 'No'}
      </span>
      <span className="interruttore__leva" aria-hidden="true" />
    </button>
  );
}

export interface Messaggio {
  autore: number;
  testo: string;
}

export function Chat({
  messaggi,
  sola_lettura,
  className,
  onRiduci,
}: {
  messaggi: Messaggio[];
  sola_lettura?: boolean;
  className?: string;
  onRiduci?: () => void;
}): ReactNode {
  const [muta, setMuta] = useState(false);
  return (
    <section className={className ? `pannello chat ${className}` : 'pannello chat'} aria-label="Chat">
      <header className="chat__testa">
        <span className="chat__comandi">
          <PulsanteIcona
            icona={muta ? 'muto' : 'volume'}
            etichetta={muta ? 'Riattiva la chat' : 'Silenzia la chat'}
            onClick={() => setMuta((m) => !m)}
            pressato={muta}
          />
          <PulsanteIcona icona="riduci" etichetta="Riduci la chat" onClick={onRiduci} />
        </span>
        <h2 className="chat__titolo">Chat</h2>
      </header>
      {messaggi.length === 0 ? (
        <p className="chat__vuota">Ancora nessun messaggio.</p>
      ) : (
        <ol className="chat__messaggi">
          {messaggi.map((m, i) => {
            const g = GIOCATORI[m.autore];
            const mio = g?.tu;
            const precedente = messaggi[i - 1];
            const stessoAutore = precedente?.autore === m.autore;
            return (
              <li key={i} className={mio ? 'messaggio messaggio--mio' : 'messaggio'}>
                {!mio && !stessoAutore && g && (
                  <span className="messaggio__autore">
                    <Pedina colore={g.colore} className="pedina--mini" />
                    {g.nome}
                  </span>
                )}
                <p className="messaggio__testo">{m.testo}</p>
              </li>
            );
          })}
        </ol>
      )}
      {sola_lettura ? (
        <p className="chat__avviso">Solo chi gioca può scrivere in chat.</p>
      ) : (
        <form className="chat__scrivi" onSubmit={(e) => e.preventDefault()}>
          <label className="solo-lettori" htmlFor="chat-campo">
            Messaggio
          </label>
          <input id="chat-campo" type="text" placeholder="Scrivi un messaggio…" maxLength={1000} autoComplete="off" />
          <button type="submit" className="pulsante-icona pulsante-icona--pieno" aria-label="Invia">
            <Icona nome="invia" />
          </button>
        </form>
      )}
    </section>
  );
}
