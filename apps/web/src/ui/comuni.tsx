import { useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { euro, type Regione } from '@poordown/engine';
import { Icona, type NomeIcona } from './icone';
import { SCORRE } from './movimento';
import { ritardiPalette, SEPARATORE_PALETTE, variabili } from './utili';

/**
 * Una paletta del tabellone delle partenze. Quando il carattere cambia, la metà alta vecchia cade
 * e poi la metà bassa nuova si apre: la cifra vecchia resta visibile finché la nuova non la copre.
 * La prima volta che compare gira partendo da una paletta vuota.
 */
function Paletta({ carattere, ritardo }: { carattere: string; ritardo: number }): ReactNode {
  const [stato, setStato] = useState({ attuale: carattere, precedente: '', giro: 0 });
  if (stato.attuale !== carattere) setStato({ attuale: carattere, precedente: stato.attuale, giro: stato.giro + 1 });
  const { attuale, precedente, giro } = stato;
  return (
    <span className="paletta" style={variabili({ '--ritardo': `${ritardo}ms` })} aria-hidden="true">
      <span className="paletta__meta paletta__meta--alta">
        <span className="paletta__carattere">{attuale}</span>
      </span>
      <span className="paletta__meta paletta__meta--bassa">
        <span className="paletta__carattere">{precedente}</span>
      </span>
      {/* Le due metà che girano rinascono a ogni cambio, così l'animazione riparte. */}
      <span key={`cade-${giro}`} className="paletta__lembo paletta__lembo--cade">
        <span className="paletta__carattere">{precedente}</span>
      </span>
      <span key={`apre-${giro}`} className="paletta__lembo paletta__lembo--apre">
        <span className="paletta__carattere">{attuale}</span>
      </span>
    </span>
  );
}

/**
 * Caratteri a palette, come nei tabelloni delle partenze: larghezze fisse, cifre tabellari, separatori
 * stampati su mezze palette ferme. Quando il testo cambia girano solo le palette diverse, da destra
 * verso sinistra (la prima subito, poi una ogni 30 ms); le posizioni contano da destra, così le cifre
 * restano in colonna anche se il numero si allunga. Misure: s (16 px), m (22), l (36); senza misura
 * prende la grandezza del testo intorno.
 */
export function Palette({
  testo,
  unita,
  misura,
  className,
}: {
  testo: string;
  unita?: string;
  misura?: 's' | 'm' | 'l';
  className?: string;
}): ReactNode {
  const [visto, setVisto] = useState(() => ({ testo, ritardi: ritardiPalette('', testo) }));
  if (visto.testo !== testo) setVisto({ testo, ritardi: ritardiPalette(visto.testo, testo) });
  const caratteri = [...testo];
  const n = caratteri.length;
  const classi = ['palette', misura ? `palette--${misura}` : '', className ?? ''].filter(Boolean).join(' ');
  return (
    <span className={classi}>
      <span className="solo-lettori">
        {testo}
        {unita ? ` ${unita}` : ''}
      </span>
      {caratteri.map((carattere, i) =>
        SEPARATORE_PALETTE.test(carattere) ? (
          <span key={`s${n - i}`} className="palette__separatore" aria-hidden="true">
            {carattere}
          </span>
        ) : (
          <Paletta key={`p${n - i}`} carattere={carattere} ritardo={visto.ritardi[i] ?? 0} />
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
export function Soldi({ valore, misura, className }: { valore: number; misura?: 's' | 'm' | 'l'; className?: string }): ReactNode {
  const testo = euro(valore).replace(' €', '');
  return <Palette testo={testo} unita="€" misura={misura} className={className} />;
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
export function Stemma({ regione, className }: { regione: Regione | undefined; className?: string }): ReactNode {
  if (!regione) return null;
  const tinta = regione.colore;
  return (
    <svg className={className ? `stemma ${className}` : 'stemma'} viewBox="0 0 26 30" role="img" aria-label={regione.nome}>
      <path
        d="M3.5 2h19A1.5 1.5 0 0 1 24 3.5V13c0 7.4-5.2 12-11 14.8C7.2 25 2 20.4 2 13V3.5A1.5 1.5 0 0 1 3.5 2z"
        style={{ fill: `var(--g${tinta})` }}
        stroke="#fff"
        strokeWidth="2"
      />
      <text x="13" y="14.5" textAnchor="middle" dominantBaseline="middle" style={{ fill: `var(--su-g${tinta}, #fff)` }}>
        {regione.sigla}
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

export interface RigaRegistro {
  n: number;
  colore?: number;
  testo: ReactNode;
}

/** Le righe del registro che si vedono (le altre sono sotto la sfumatura): solo queste scorrono con Motion. */
const REGISTRO_VISIBILI = 12;

/**
 * Registro eventi al centro del tabellone: il più recente in alto, gli altri sbiadiscono.
 * Quando arriva una voce nuova le altre scendono al loro posto, senza saltare.
 */
export function Registro({ righe }: { righe: RigaRegistro[] }): ReactNode {
  return (
    <ol className="registro" aria-label="Ultimi eventi" aria-live="polite">
      {righe.slice(0, 50).map((v, i) => (
        <motion.li
          key={v.n}
          layout={i < REGISTRO_VISIBILI ? 'position' : false}
          transition={SCORRE}
          className="registro__voce"
          style={variabili({ '--eta': String(Math.min(i, 9)) })}
        >
          {v.colore !== undefined && <Pedina colore={v.colore} className="pedina--mini" />}
          <span>{v.testo}</span>
        </motion.li>
      ))}
    </ol>
  );
}

/**
 * Pulsante con la sola icona (36 px, piccolo 32). Varianti: normale (trasparente), pieno (blu),
 * secondario (con l'anello), pericolo (anello rosso). L'etichetta è anche il suggerimento.
 */
export function PulsanteIcona({
  icona,
  etichetta,
  onClick,
  pressato,
  variante = 'normale',
  misura = 'normale',
  disattivo,
  className,
}: {
  icona: NomeIcona;
  etichetta: string;
  onClick?: () => void;
  pressato?: boolean;
  variante?: 'normale' | 'pieno' | 'secondario' | 'pericolo';
  misura?: 'normale' | 'piccolo';
  disattivo?: boolean;
  className?: string;
}): ReactNode {
  const classi = [
    'pulsante-icona',
    variante === 'normale' ? '' : `pulsante-icona--${variante}`,
    misura === 'piccolo' ? 'pulsante-icona--piccolo' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button
      type="button"
      className={classi}
      aria-label={etichetta}
      title={etichetta}
      onClick={onClick}
      aria-pressed={pressato}
      disabled={disattivo}
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
