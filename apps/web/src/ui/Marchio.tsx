/*
 * Il marchio di PoorDown: un cartello smaltato blu con il filetto bianco e la «P» bianca sopra la barra
 * del binario, come i numeri dei binari nelle stazioni.
 * - <Marchio /> o <Marchio variante="esteso" />: l'insegna lunga della home (pittogramma + nome);
 * - <Marchio variante="piccolo" />: il solo pittogramma da 32 px, per la testata di gioco;
 * - <Pittogramma misura={…} />: il pittogramma a qualunque misura (caricamento, favicon…).
 * Il pittogramma è un SVG autosufficiente: i colori arrivano dai token (--cartello). L'insegna estesa ha le
 * sue regole in stili/home.css (sezione «Marchio»), importato qui sotto. Lo stesso disegno è in public/favicon.svg.
 */

import '../stili/home.css';
import type { ReactNode } from 'react';

/** La «P» stretta (con il suo occhiello vuoto) e la barra del binario, su una griglia di 32. */
function Segno(): ReactNode {
  return (
    <>
      <path
        fillRule="evenodd"
        d="M11.5 6h5.25a3.8 4.6 0 0 1 0 9.2h-1.45v5.4h-3.8zm3.8 3.1v3h1.45a1.2 1.5 0 0 0 0-3z"
      />
      <rect x="8" y="22.6" width="16" height="2.6" rx="0.6" />
    </>
  );
}

/**
 * Il pittogramma: il cartello quadrato smaltato. `misura` in px (32 per la testata di gioco).
 * Senza `titolo` è decorativo (nascosto ai lettori di schermo).
 */
export function Pittogramma({
  misura = 32,
  titolo,
  className,
}: {
  misura?: number | string;
  titolo?: string;
  className?: string;
}): ReactNode {
  return (
    <svg
      className={className ? `pittogramma-marchio ${className}` : 'pittogramma-marchio'}
      viewBox="0 0 32 32"
      width={misura}
      height={misura}
      role={titolo ? 'img' : undefined}
      aria-label={titolo}
      aria-hidden={titolo ? undefined : true}
    >
      <rect x="0.5" y="0.5" width="31" height="31" rx="5.5" style={{ fill: 'var(--cartello)' }} />
      <rect x="2.6" y="2.6" width="26.8" height="26.8" rx="3.6" fill="none" stroke="#fff" strokeWidth="1.5" />
      <g fill="#fff">
        <Segno />
      </g>
    </svg>
  );
}

/**
 * Il marchio. `esteso`: l'insegna della home, un solo cartello con due riquadri (la P sul binario e il nome);
 * cresce con la grandezza del testo intorno (font-size sul contenitore). `piccolo`: il pittogramma da 32 px.
 */
export function Marchio({
  variante = 'esteso',
  className,
}: {
  variante?: 'esteso' | 'piccolo';
  className?: string;
}): ReactNode {
  if (variante === 'piccolo') return <Pittogramma misura={32} titolo="PoorDown" className={className} />;
  return (
    <span className={className ? `insegna-estesa ${className}` : 'insegna-estesa'} role="img" aria-label="PoorDown">
      <svg className="insegna-estesa__segno" viewBox="5 4 22 24" aria-hidden="true">
        <g fill="currentColor">
          <Segno />
        </g>
      </svg>
      <span className="insegna-estesa__nome" aria-hidden="true">
        PoorDown
      </span>
    </span>
  );
}
