/*
 * Giro del mondo: il passaporto appuntato alla pedina nella riga di chi ce l'ha (si vola solo con il passaporto).
 * Quando lo ritira (evento `passaporto`, che la regia mette in scena mentre la pedina passa dalla Partenza) il libretto
 * cade come un timbro e lascia un anello d'inchiostro. Non ferma il gioco: niente attese nella regia.
 */

import '../stili/viaggi.css';
import { useState, type ReactNode } from 'react';
import { Icona } from '../ui/icone';

/** @param timbro compare adesso, con la riga già sullo schermo: cade come un timbro (all'apertura della pagina no). */
export function PassaportoRiga({ timbro }: { timbro: boolean }): ReactNode {
  const [cade] = useState(timbro);
  return (
    <span className={cade ? 'passaporto-riga passaporto-riga--timbro' : 'passaporto-riga'} title="Ha il passaporto: può volare.">
      <Icona nome="passaporto" titolo="Con il passaporto" />
      {cade && <span className="passaporto-riga__inchiostro" aria-hidden="true" />}
    </span>
  );
}
