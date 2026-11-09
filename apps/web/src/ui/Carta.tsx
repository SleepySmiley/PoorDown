import '../stili/carte.css';
import { useEffect, useId, useState, type CSSProperties, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { TEMPI } from '@poordown/engine';
import { CURVA } from './movimento';
import { variabili } from './utili';

/**
 * Una carta pescata, Busta o Cartolina, con le due facce:
 * - Busta: davanti la lettera crema con il testo, che esce dalla busta di carta da pacchi; dietro la busta chiusa con il sigillo di ceralacca.
 * - Cartolina: davanti il lato del messaggio (testo a sinistra, francobollo e annullo a destra); dietro il lato della «foto».
 * Le misure sono in --carta-u (di serie una k del tabellone, 1 px fuori): 260 × 170. Cambiando `lato` la carta si gira (transizione CSS);
 * per un volo o un giro diverso basta animare l'elemento esterno o .carta__giro.
 */
export function Carta({
  mazzo,
  testo,
  regione,
  lato = 'fronte',
  className,
  style,
}: {
  mazzo: 'busta' | 'cartolina';
  testo: string;
  /** Cartolina: la regione di destinazione (1–10, come --g1…--g10) colora il francobollo e la foto. */
  regione?: number;
  /** 'fronte' mostra il testo, 'dorso' la carta chiusa. */
  lato?: 'fronte' | 'dorso';
  className?: string;
  style?: CSSProperties;
}): ReactNode {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const classi = ['carta', `carta--${mazzo}`, lato === 'dorso' ? 'carta--dorso' : '', className ?? ''].filter(Boolean).join(' ');
  const stile = { ...(regione ? variabili({ '--francobollo': `var(--g${regione})` }) : {}), ...style };
  const nome = mazzo === 'busta' ? 'Busta' : 'Cartolina';
  return (
    <div className={classi} style={stile} role="img" aria-label={`${nome}: ${testo}`}>
      <div className="carta__giro">
        <div className="carta__faccia carta__fronte" aria-hidden="true">
          {mazzo === 'busta' ? <FronteBusta testo={testo} /> : <FronteCartolina testo={testo} id={id} />}
        </div>
        <div className="carta__faccia carta__dorso" aria-hidden="true">
          {mazzo === 'busta' ? <DorsoBusta /> : <DorsoCartolina id={id} />}
        </div>
      </div>
    </div>
  );
}

/** Il sigillo di ceralacca con la P di PoorDown. */
function Sigillo({ className }: { className: string }): ReactNode {
  return (
    <span className={`sigillo ${className}`}>
      <span className="sigillo__lettera">P</span>
    </span>
  );
}

function FronteBusta({ testo }: { testo: string }): ReactNode {
  return (
    <>
      <span className="busta__fondo" />
      <span className="busta__lettera">
        <span className="carta__intestazione">
          <Sigillo className="sigillo--piccolo" />
          Busta
        </span>
        <span className="carta__testo">{testo}</span>
      </span>
      <span className="busta__tasca" />
    </>
  );
}

function DorsoBusta(): ReactNode {
  return (
    <>
      <span className="busta__pieghe" />
      <span className="busta__linguetta" />
      <Sigillo className="sigillo--grande" />
      <span className="busta__timbro">Busta</span>
    </>
  );
}

/** L'annullo postale tondo, con la scritta sul bordo e le onde. */
function Annullo({ id }: { id: string }): ReactNode {
  const cerchio = `annullo-${id}`;
  return (
    <svg className="annullo" viewBox="0 0 120 64" aria-hidden="true">
      <defs>
        <path id={cerchio} d="M32 32m-21 0a21 21 0 1 1 42 0a21 21 0 1 1 -42 0" />
      </defs>
      <circle cx="32" cy="32" r="28" />
      <circle cx="32" cy="32" r="15" />
      <text className="annullo__giro">
        <textPath href={`#${cerchio}`} startOffset="0">
          POORDOWN · POSTE ·
        </textPath>
      </text>
      <text className="annullo__centro" x="32" y="35" textAnchor="middle">
        2026
      </text>
      <path d="M62 20q7-5 14 0t14 0 14 0 14 0M62 32q7-5 14 0t14 0 14 0 14 0M62 44q7-5 14 0t14 0 14 0 14 0" />
    </svg>
  );
}

function FronteCartolina({ testo, id }: { testo: string; id: string }): ReactNode {
  return (
    <>
      <span className="cartolina__messaggio">
        <span className="carta__intestazione">Cartolina</span>
        <span className="carta__testo">{testo}</span>
      </span>
      <span className="cartolina__indirizzo">
        <span className="francobollo">
          <span className="francobollo__immagine">
            <span className="francobollo__sole" />
            <span className="francobollo__colle" />
          </span>
        </span>
        <Annullo id={id} />
        <span className="cartolina__righe" />
      </span>
    </>
  );
}

function DorsoCartolina({ id }: { id: string }): ReactNode {
  return (
    <span className="cartolina__foto">
      <svg className="cartolina__paesaggio" viewBox="0 0 260 170" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <linearGradient id={`cielo-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop className="cartolina__cielo-alto" offset="0" />
            <stop className="cartolina__cielo" offset="0.55" />
            <stop className="cartolina__cielo-basso" offset="1" />
          </linearGradient>
        </defs>
        <rect width="260" height="170" fill={`url(#cielo-${id})`} />
        <circle className="cartolina__sole" cx="188" cy="62" r="26" />
        <path className="cartolina__monti" d="M0 118 46 78l30 24 42-46 50 52 30-22 62 40v44H0z" />
        <path className="cartolina__colline" d="M0 134c40-18 78-20 120-8s90 6 140-10v54H0z" />
        <path className="cartolina__mare" d="M0 150c60-10 120-6 170 2s70 2 90-2v20H0z" />
      </svg>
      <span className="cartolina__saluti">
        <small>Saluti da</small>
        PoorDown
      </span>
    </span>
  );
}

/**
 * La carta appena pescata, sul tabellone: esce chiusa dalla casella, vola al centro girandosi e resta lì il tempo
 * di leggerla; poi rimpicciolisce verso la scheda dell'ultimo evento (uscita con AnimatePresence).
 * Va nel livello sopra il tabellone; `da` è il centro della casella, in percentuale del tabellone.
 * I tempi sono quelli della scena (TEMPI.cartaEntra, TEMPI.cartaEsce): la regia aspetta esattamente questi.
 */
export function CartaPescata({
  mazzo,
  testo,
  regione,
  da,
  didascalia,
}: {
  mazzo: 'busta' | 'cartolina';
  testo: string;
  regione?: number;
  da: { x: number; y: number };
  /** Sotto la carta: chi l'ha pescata. */
  didascalia?: ReactNode;
}): ReactNode {
  // Parte chiusa e si gira mentre vola (la rotazione è la transizione CSS di .carta__giro, lunga quanto il volo).
  const [lato, setLato] = useState<'dorso' | 'fronte'>('dorso');
  useEffect(() => {
    const giro = requestAnimationFrame(() => setLato('fronte'));
    return () => cancelAnimationFrame(giro);
  }, []);
  return (
    <motion.div
      className="carta-pescata"
      initial={{ left: `${da.x}%`, top: `${da.y}%`, scale: 0.28, rotate: -10, opacity: 0.6 }}
      animate={{
        left: '50%',
        top: '46%',
        scale: 1,
        rotate: 0,
        opacity: 1,
        transition: { duration: TEMPI.cartaEntra / 1000, ease: CURVA.arrivo },
      }}
      exit={{ top: '80%', scale: 0.32, opacity: 0, transition: { duration: TEMPI.cartaEsce / 1000, ease: CURVA.partenza } }}
    >
      <Carta mazzo={mazzo} testo={testo} regione={regione} lato={lato} />
      {didascalia && <p className="carta-pescata__chi">{didascalia}</p>}
    </motion.div>
  );
}
