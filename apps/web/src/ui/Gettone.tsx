/*
 * I gettoni che volano da chi paga a chi incassa: dal saldo nella riga del giocatore al saldo dell'altro,
 * oppure da e verso la banca (la casella che c'entra, o il centro del tabellone). Li decide la regia
 * (Scena.gettoni): qui si disegnano soltanto, in un livello sopra tutta la pagina che non blocca i clic.
 * Il volo è un arco: da una riga all'altra piega verso il tabellone, negli altri casi sale.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { animate, motion, useMotionValue, useTransform } from 'motion/react';
import { euro, type IdGiocatore } from '@poordown/engine';
import { CURVA, DURATA } from './movimento';

export interface VoloSoldi {
  id: number;
  /** Chi paga; `null` è la banca. */
  da: IdGiocatore | null;
  /** Chi incassa; `null` è la banca. */
  a: IdGiocatore | null;
  importo: number;
  /** La casella dalla parte della banca (acquisto, tassa, Partenza…). */
  casella?: number;
}

interface Punto {
  x: number;
  y: number;
}

function centro(el: Element | null): Punto | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/** Un capo del volo: il saldo nella riga del giocatore (o la riga, se è uscito), oppure la casella o il centro del tabellone. */
function capo(chi: IdGiocatore | null, casella: number | undefined): Punto | null {
  if (chi !== null) {
    const riga = document.querySelector(`.riga-giocatore[data-giocatore="${CSS.escape(chi)}"]`);
    return centro(riga?.querySelector('.riga-giocatore__soldi') ?? riga ?? null);
  }
  const suCasella = casella !== undefined ? document.querySelector(`.tabellone [data-casella="${casella}"]`) : null;
  return centro(suCasella ?? document.querySelector('.tabellone__centro'));
}

/** Il punto di controllo dell'arco: da riga a riga piega a destra (verso il tabellone), altrimenti sale. */
function controllo(a: Punto, b: Punto): Punto {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lungo = Math.hypot(dx, dy) || 1;
  // Le due perpendicolari: si sceglie quella che sale, o quella verso destra se il volo è quasi verticale.
  let nx = dy / lungo;
  let ny = -dx / lungo;
  if (Math.abs(dx) >= Math.abs(dy) ? ny > 0 : nx < 0) {
    nx = -nx;
    ny = -ny;
  }
  const curva = Math.max(48, lungo * 0.28);
  return { x: (a.x + b.x) / 2 + nx * curva, y: (a.y + b.y) / 2 + ny * curva };
}

function bezier(a: number, c: number, b: number, t: number): number {
  const u = 1 - t;
  return u * u * a + 2 * u * t * c + t * t * b;
}

function VoloGettone({ g }: { g: VoloSoldi }): ReactNode {
  // Le posizioni si leggono una volta, quando il gettone parte.
  const [tratto] = useState(() => {
    const a = capo(g.da, g.casella);
    const b = capo(g.a, g.casella);
    return a && b ? { a, b, c: controllo(a, b) } : null;
  });
  const t = useMotionValue(0);
  const x = useTransform(t, (v) => (tratto ? bezier(tratto.a.x, tratto.c.x, tratto.b.x, v) : -999));
  const y = useTransform(t, (v) => (tratto ? bezier(tratto.a.y, tratto.c.y, tratto.b.y, v) : -999));
  const scala = useTransform(t, [0, 0.18, 0.82, 1], [0.55, 1.08, 1, 0.75]);
  const opacita = useTransform(t, [0, 0.12, 0.86, 1], [0, 1, 1, 0]);
  useEffect(() => {
    const volo = animate(t, 1, { duration: DURATA.viaggio, ease: CURVA.viaggio });
    return () => volo.stop();
  }, [t]);
  if (!tratto) return null;
  return (
    <motion.div className="gettone-volo" style={{ x, y, opacity: opacita }}>
      <motion.span className="gettone" style={{ scale: scala }}>
        {euro(g.importo)}
      </motion.span>
    </motion.div>
  );
}

/** Tutti i gettoni in volo adesso. */
export function VoliGettoni({ gettoni }: { gettoni: readonly VoloSoldi[] }): ReactNode {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="gettoni" aria-hidden="true">
      {gettoni.map((g) => (
        <VoloGettone key={g.id} g={g} />
      ))}
    </div>,
    document.body,
  );
}
