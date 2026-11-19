/*
 * Le bandiere dei paesi del Giro del mondo, nello stesso rettangolo 30×20 (3:2) delle altre: anche quelle che
 * dal vero hanno altre proporzioni (gli Stati Uniti, il Vaticano quadrato) qui stanno in 3:2.
 * Semplificate come le bandiere europee: le campiture e i segni che fanno riconoscere il paese (la foglia d'acero,
 * la mezzaluna, il sole di maggio, le chiavi), niente stemmi minuti.
 */

import type { ReactNode } from 'react';
import type { BandieraMondo } from '@poordown/engine';

const L = 30;
const H = 20;

/** I punti di una stella a `punte` punte, con la prima punta verso `angolo` (gradi, 0 = in alto, in senso orario). */
function stella(cx: number, cy: number, raggio: number, interno: number, punte: number, angolo = 0): string {
  const punti: string[] = [];
  for (let i = 0; i < punte * 2; i++) {
    const r = i % 2 === 0 ? raggio : interno;
    const a = ((angolo + (180 / punte) * i) * Math.PI) / 180;
    punti.push(`${(cx + r * Math.sin(a)).toFixed(2)},${(cy - r * Math.cos(a)).toFixed(2)}`);
  }
  return punti.join(' ');
}

/** Bande orizzontali dall'alto; `parti` dà l'altezza di ciascuna (di default uguali). */
function Bande({ colori, parti }: { colori: string[]; parti?: number[] }): ReactNode {
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

function Nauru(): ReactNode {
  // La riga gialla è l'equatore, la stella a dodici punte l'isola, appena sotto.
  return (
    <>
      <rect width={L} height={H} fill="#002B7F" />
      <rect y={9.2} width={L} height={1.6} fill="#FFC61E" />
      <polygon points={stella(7.5, 14.6, 2.7, 1.45, 12)} fill="#fff" />
    </>
  );
}

function Norvegia(): ReactNode {
  // Croce scandinava spostata verso l'asta: bianca, con dentro quella blu.
  return (
    <>
      <rect width={L} height={H} fill="#BA0C2F" />
      <rect x={8.2} width={5.45} height={H} fill="#fff" />
      <rect y={7.5} width={L} height={5} fill="#fff" />
      <rect x={9.55} width={2.75} height={H} fill="#00205B" />
      <rect y={8.75} width={L} height={2.5} fill="#00205B" />
    </>
  );
}

/** La foglia d'acero, centrata in 0,0 e alta poco meno di 10. */
const FOGLIA: readonly [number, number][] = [
  [0, -4.8], [0.95, -3.1], [1.9, -3.5], [1.55, -1.2], [3.2, -2.4], [2.9, -1.4], [4.3, -1.6], [3.5, 0.2], [4, 0.6],
  [1.4, 2.4], [1.6, 3.2], [0.25, 3], [0.25, 4.8], [-0.25, 4.8], [-0.25, 3], [-1.6, 3.2], [-1.4, 2.4], [-4, 0.6],
  [-3.5, 0.2], [-4.3, -1.6], [-2.9, -1.4], [-3.2, -2.4], [-1.55, -1.2], [-1.9, -3.5], [-0.95, -3.1],
];

function Canada(): ReactNode {
  const foglia = FOGLIA.map(([x, y]) => `${(15 + x * 0.9).toFixed(2)},${(9.8 + y * 0.9).toFixed(2)}`).join(' ');
  return (
    <>
      <rect width={L} height={H} fill="#fff" />
      <rect width={7.5} height={H} fill="#D80621" />
      <rect x={22.5} width={7.5} height={H} fill="#D80621" />
      <polygon points={foglia} fill="#D80621" />
    </>
  );
}

function StatiUniti(): ReactNode {
  // Tredici strisce e il cantone blu alto sette strisce; le cinquanta stelle diventano una griglia di puntini.
  const striscia = H / 13;
  const alto = striscia * 7;
  return (
    <>
      {Array.from({ length: 13 }, (_, i) => (
        <rect key={i} y={striscia * i} width={L} height={striscia + 0.01} fill={i % 2 === 0 ? '#B22234' : '#fff'} />
      ))}
      <rect width={12} height={alto} fill="#3C3B6E" />
      {Array.from({ length: 20 }, (_, i) => (
        <circle key={i} cx={1.5 + (i % 5) * 2.25} cy={1.45 + Math.floor(i / 5) * 2.6} r={0.5} fill="#fff" />
      ))}
    </>
  );
}

function Australia({ id }: { id: string }): ReactNode {
  // La Union Jack nel cantone, la grande stella del Commonwealth sotto, la Croce del Sud verso il battente.
  const blu = '#012169';
  const rosso = '#C8102E';
  return (
    <>
      <rect width={L} height={H} fill={blu} />
      <clipPath id={`${id}-cantone`}>
        <rect width={15} height={10} />
      </clipPath>
      <g clipPath={`url(#${id}-cantone)`}>
        <path d="M0 0L15 10M15 0L0 10" stroke="#fff" strokeWidth={2.2} />
        <path d="M0 0L15 10M15 0L0 10" stroke={rosso} strokeWidth={0.8} />
        <path d="M7.5 0V10M0 5H15" stroke="#fff" strokeWidth={3.2} />
        <path d="M7.5 0V10M0 5H15" stroke={rosso} strokeWidth={1.9} />
      </g>
      <polygon points={stella(7.5, 15, 2.5, 1.1, 7)} fill="#fff" />
      <polygon points={stella(22.5, 16.6, 1.25, 0.55, 7)} fill="#fff" />
      <polygon points={stella(22.5, 3.6, 1.15, 0.5, 7)} fill="#fff" />
      <polygon points={stella(18.9, 8.6, 1.1, 0.48, 7)} fill="#fff" />
      <polygon points={stella(26.4, 7.4, 1.1, 0.48, 7)} fill="#fff" />
      <polygon points={stella(24.4, 11, 0.6, 0.27, 5)} fill="#fff" />
    </>
  );
}

function Turchia(): ReactNode {
  // La mezzaluna aperta verso il battente, la stella con una punta verso la mezzaluna.
  const rosso = '#E30A17';
  return (
    <>
      <rect width={L} height={H} fill={rosso} />
      <circle cx={11.2} cy={10} r={5} fill="#fff" />
      <circle cx={12.45} cy={10} r={4} fill={rosso} />
      <polygon points={stella(17.4, 10, 2.5, 1, 5, 270)} fill="#fff" />
    </>
  );
}

function Argentina(): ReactNode {
  // Il Sole di maggio al centro della banda bianca: un disco con i raggi.
  const oro = '#F6B40E';
  const raggi = Array.from({ length: 16 }, (_, i) => {
    const a = (i * Math.PI) / 8;
    const r1 = 2.1;
    const r2 = i % 2 === 0 ? 3.4 : 2.9;
    return `M${(15 + r1 * Math.cos(a)).toFixed(2)} ${(10 + r1 * Math.sin(a)).toFixed(2)}L${(15 + r2 * Math.cos(a)).toFixed(2)} ${(10 + r2 * Math.sin(a)).toFixed(2)}`;
  }).join('');
  return (
    <>
      <Bande colori={['#74ACDF', '#fff', '#74ACDF']} />
      <path d={raggi} stroke={oro} strokeWidth={0.55} strokeLinecap="round" />
      <circle cx={15} cy={10} r={2.1} fill={oro} stroke="#843511" strokeWidth={0.3} />
    </>
  );
}

function Vaticano(): ReactNode {
  // Giallo e bianco; sul bianco le chiavi incrociate, d'oro e d'argento, sotto la tiara.
  const oro = '#E8B923';
  const argento = '#AEB4BA';
  return (
    <>
      <rect width={15} height={H} fill="#FFE000" />
      <rect x={15} width={15} height={H} fill="#fff" />
      <path d="M19.3 15.6L25.4 8.4" stroke={argento} strokeWidth={1.1} strokeLinecap="round" />
      <path d="M25.7 15.6L19.6 8.4" stroke={oro} strokeWidth={1.1} strokeLinecap="round" />
      <circle cx={19.1} cy={15.9} r={1} fill="none" stroke={oro} strokeWidth={0.8} />
      <circle cx={25.9} cy={15.9} r={1} fill="none" stroke={argento} strokeWidth={0.8} />
      <path d="M25.4 8.4l1 .9M19.6 8.4l-1 .9" stroke={oro} strokeWidth={0.9} strokeLinecap="round" />
      <path d="M21 7.4c0-2.2.7-3.6 1.5-4.1.8.5 1.5 1.9 1.5 4.1z" fill={oro} />
      <path d="M21 5.9h3M21.2 4.6h2.6" stroke="#fff" strokeWidth={0.4} />
    </>
  );
}

/** Il disegno della bandiera di un paese del Giro del mondo. `id` rende unici i ritagli nella pagina. */
export function DisegnoMondo({ paese, id }: { paese: BandieraMondo; id: string }): ReactNode {
  switch (paese) {
    case 'NR':
      return <Nauru />;
    case 'NO':
      return <Norvegia />;
    case 'CA':
      return <Canada />;
    case 'US':
      return <StatiUniti />;
    case 'AU':
      return <Australia id={id} />;
    case 'TH':
      return <Bande colori={['#A51931', '#F4F5F8', '#2D2A4A', '#F4F5F8', '#A51931']} parti={[1, 1, 2, 1, 1]} />;
    case 'BO':
      return <Bande colori={['#D52B1E', '#F9E300', '#007934']} />;
    case 'TR':
      return <Turchia />;
    case 'RU':
      return <Bande colori={['#fff', '#0039A6', '#D52B1E']} />;
    case 'AR':
      return <Argentina />;
    case 'VA':
      return <Vaticano />;
  }
}
