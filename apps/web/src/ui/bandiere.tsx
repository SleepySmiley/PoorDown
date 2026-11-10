/*
 * Le bandiere dei gruppi del tabellone: i paesi del tabellone Europa qui, le regioni italiane in bandiere-regioni.tsx.
 * Disegnate a mano in un rettangolo 30×20 (3:2).
 * Semplificate per restare leggibili a pochi pixel: niente stemmi minuti, solo le campiture
 * e i segni che fanno riconoscere il paese (la croce svizzera, la sfera del Portogallo).
 * Contorno, riflesso e filo li aggiunge lo Stemma (ui/comuni.tsx), uguali per tutte.
 */

import type { ReactNode } from 'react';
import type { Bandiera } from '@poordown/engine';
import { DisegnoRegione } from './bandiere-regioni';

const L = 30;
const H = 20;

/** Tre bande verticali, da sinistra. */
function Verticale({ colori }: { colori: [string, string, string] }): ReactNode {
  return colori.map((colore, i) => <rect key={i} x={(L / 3) * i} width={L / 3 + 0.01} height={H} fill={colore} />);
}

/** Bande orizzontali dall'alto; `parti` dà l'altezza di ciascuna (di default uguali). */
function Orizzontale({ colori, parti }: { colori: string[]; parti?: number[] }): ReactNode {
  const pesi = parti ?? colori.map(() => 1);
  const totale = pesi.reduce((a, b) => a + b, 0);
  let y = 0;
  return colori.map((colore, i) => {
    const alto = (H * (pesi[i] ?? 1)) / totale;
    const banda = <rect key={i} y={y} width={L} height={alto + 0.01} fill={colore} />;
    y += alto;
    return banda;
  });
}

function Grecia(): ReactNode {
  const blu = '#0D5EAF';
  const passo = H / 9;
  const lato = passo * 5;
  return (
    <>
      <rect width={L} height={H} fill="#fff" />
      {[0, 2, 4, 6, 8].map((i) => (
        <rect key={i} y={passo * i} width={L} height={passo} fill={blu} />
      ))}
      <rect width={lato} height={lato} fill={blu} />
      <rect x={passo * 2} width={passo} height={lato} fill="#fff" />
      <rect y={passo * 2} width={lato} height={passo} fill="#fff" />
    </>
  );
}

function Svizzera(): ReactNode {
  // Bracci 7/6 più lunghi che larghi, la croce alta due terzi della bandiera.
  return (
    <>
      <rect width={L} height={H} fill="#DA291C" />
      <rect x={13} y={3.4} width={4} height={13.2} fill="#fff" />
      <rect x={8.4} y={8} width={13.2} height={4} fill="#fff" />
    </>
  );
}

function Portogallo(): ReactNode {
  // Verde per due quinti, rosso per il resto; sulla linea di confine la sfera armillare con lo scudo.
  return (
    <>
      <rect width={12} height={H} fill="#046A38" />
      <rect x={12} width={18} height={H} fill="#DA291C" />
      <circle cx={12} cy={10} r={4.4} fill="none" stroke="#FFE000" strokeWidth={1.4} />
      <path d="M10.2 7.6h3.6v2.9c0 1.3-.9 2.1-1.8 2.5-.9-.4-1.8-1.2-1.8-2.5z" fill="#fff" stroke="#DA291C" strokeWidth={0.8} />
    </>
  );
}

/**
 * Il disegno di una bandiera, da mettere dentro un <svg viewBox="0 0 30 20">: i paesi qui, le regioni italiane
 * in bandiere-regioni.tsx. `id` rende unici nella pagina i ritagli delle bandiere che ne usano.
 */
export function DisegnoBandiera({ paese, id }: { paese: Bandiera; id: string }): ReactNode {
  switch (paese) {
    case 'IE':
      return <Verticale colori={['#169B62', '#fff', '#FF883E']} />;
    case 'FR':
      return <Verticale colori={['#002395', '#fff', '#ED2939']} />;
    case 'AT':
      return <Orizzontale colori={['#C8102E', '#fff', '#C8102E']} />;
    case 'NL':
      return <Orizzontale colori={['#AE1C28', '#fff', '#21468B']} />;
    case 'PL':
      return <Orizzontale colori={['#fff', '#DC143C']} />;
    case 'DE':
      return <Orizzontale colori={['#000', '#DD0000', '#FFCE00']} />;
    case 'ES':
      return <Orizzontale colori={['#AA151B', '#F1BF00', '#AA151B']} parti={[1, 2, 1]} />;
    case 'GR':
      return <Grecia />;
    case 'CH':
      return <Svizzera />;
    case 'PT':
      return <Portogallo />;
    default:
      return <DisegnoRegione regione={paese} id={id} />;
  }
}
