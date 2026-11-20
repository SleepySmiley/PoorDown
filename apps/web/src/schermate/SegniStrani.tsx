/*
 * Giro del mondo: quello che si vede sulla pedina mentre è su una casella strana (caselleStrane.ts).
 * - Bermuda: la spirale della casella si anima in un vortice sotto la pedina, che ci gira dentro e sparisce;
 *   ricompare girando, con il vortice, sulla casella a caso.
 * - Antipodi: si apre la buca, la pedina ci cade, il dosso della «talpa» (chiaro, del colore della pedina) attraversa il
 *   tabellone sopra di lei e la pedina sbuca dalla buca sul lato opposto.
 * - Cambio di data: sopra la pedina il calendario a palette gira di un giorno.
 * I movimenti della pedina stanno in viaggi.css (classe `segnaposto--…` data da Tabellone.tsx); qui solo i segni in più.
 */

import '../stili/viaggi.css';
import { useEffect, useState, type ReactNode } from 'react';
import { Palette } from '../ui/comuni';
import { Icona } from '../ui/icone';
import { giornoGuadagnato, type TipoStrano } from './caselleStrane';

/** Quando girano le palette del calendario: appena è comparso sopra la pedina. */
const GIRA_MS = 170;

/**
 * Il calendario della Linea del cambio di data: il mese stampato sulla fascia blu, il giorno a palette che gira a
 * domani. Le palette compaiono ferme su oggi (niente giro d'apertura): l'unico giro è quello del giorno guadagnato.
 */
function Calendario(): ReactNode {
  const [date] = useState(() => giornoGuadagnato(new Date()));
  const [girato, setGirato] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setGirato(true), GIRA_MS);
    return () => clearTimeout(t);
  }, []);
  const d = girato ? date.dopo : date.prima;
  return (
    <span className={girato ? 'calendario-strano' : 'calendario-strano calendario-strano--fermo'}>
      <span className="calendario-strano__mese">{d.mese}</span>
      <Palette testo={d.giorno} className="calendario-strano__giorno" />
    </span>
  );
}

export function SegniStrani({ tipo }: { tipo: TipoStrano }): ReactNode {
  switch (tipo) {
    case 'bermuda':
      return (
        <span className="vortice-strano" aria-hidden="true">
          <Icona nome="spirale" />
          <Icona nome="spirale" />
        </span>
      );
    case 'antipodi':
      return (
        <>
          <span className="buca-strana" aria-hidden="true" />
          <span className="talpa-strana" aria-hidden="true" />
        </>
      );
    case 'cambio_data':
      return <Calendario />;
  }
}
