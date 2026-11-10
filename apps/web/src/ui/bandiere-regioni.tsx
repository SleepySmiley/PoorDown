/*
 * Le bandiere ufficiali delle venti regioni italiane, nel rettangolo 30×20 delle bandiere dei paesi.
 * Ridisegnate dai drappi veri (Wikimedia Commons) e semplificate per restare leggibili a pochi pixel:
 * restano campiture, scudi e figure; le scritte («Regione Lazio») diventano una riga tratteggiata.
 * Contorno, riflesso e filo li aggiunge lo Stemma (ui/comuni.tsx).
 */

import type { ReactNode } from 'react';
import type { BandieraRegione } from '@poordown/engine';

const L = 30;
const H = 20;

/** Uno scudo «sannitico» (lati dritti, punta in basso) nel riquadro dato. */
function scudo(x: number, y: number, w: number, h: number): string {
  const fondo = y + h;
  const fianco = y + h * 0.6;
  return `M${x} ${y}H${x + w}V${fianco}C${x + w} ${fondo - h * 0.12} ${x + w * 0.62} ${fondo - h * 0.05} ${x + w / 2} ${fondo}C${x + w * 0.38} ${fondo - h * 0.05} ${x} ${fondo - h * 0.12} ${x} ${fianco}Z`;
}

/** Un'aquila araldica ad ali spiegate nel riquadro 10×10, da posare con translate e scale. */
const AQUILA =
  'M5 0.8L5.9 1.8L5.6 3L9.4 1.6L8.8 4.4L6.2 5.2L6.6 6.6L8.2 8.6L5.6 7.8L5 9.4L4.4 7.8L1.8 8.6L3.4 6.6L3.8 5.2L1.2 4.4L0.6 1.6L4.4 3L4.1 1.8Z';

/** Una scritta lontana: una riga tratteggiata del colore delle lettere. */
function Scritta({ d, colore, spessore }: { d: string; colore: string; spessore: number }): ReactNode {
  return <path d={d} fill="none" stroke={colore} strokeWidth={spessore} strokeDasharray="0.55 0.3" />;
}

function ValleAosta(): ReactNode {
  return (
    <>
      <rect width={L / 2} height={H} fill="#000" />
      <rect x={L / 2} width={L / 2} height={H} fill="#C8102E" />
    </>
  );
}

/** Una testa di moro di profilo, rivolta verso il battente, con la benda bianca sulla fronte. */
function Moro({ x, y }: { x: number; y: number }): ReactNode {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path
        d="M-2.2-2.4C-.8-3.6 1.8-3.4 2.2-1.4L2.6-.2 2.1.2 2.3 1 1.8 1.4 1.7 2.2C1 2.6.2 2.5-.2 2.3L-.4 3.2-1.8 3.2-1.8 1.6C-2.8.6-3-1.4-2.2-2.4Z"
        fill="#000"
      />
      <path d="M-2.7-1.2C-1-2 1-2 2.3-1.6M-2.6-1.2-3.3-.3" fill="none" stroke="#fff" strokeWidth={0.75} strokeLinecap="round" />
    </g>
  );
}

function Sardegna(): ReactNode {
  return (
    <>
      <rect width={L} height={H} fill="#fff" />
      <rect x={14.1} width={1.8} height={H} fill="#D7141A" />
      <rect y={9.1} width={L} height={1.8} fill="#D7141A" />
      <Moro x={7.2} y={4.8} />
      <Moro x={22.8} y={4.8} />
      <Moro x={7.2} y={15} />
      <Moro x={22.8} y={15} />
    </>
  );
}

function Toscana(): ReactNode {
  const grigio = '#8F9194';
  return (
    <>
      <rect width={L} height={H} fill="#fff" />
      <rect y={2.6} width={L} height={2} fill="#E30613" />
      <rect y={15.4} width={L} height={2} fill="#E30613" />
      {/* Il Pegaso d'argento, impennato verso il battente. */}
      <g fill={grigio} stroke={grigio} strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx={15} cy={10.6} rx={2.7} ry={1.25} transform="rotate(-25 15 10.6)" stroke="none" />
        <path d="M16.4 9.8L17.4 7.3 18.9 7.6 18.4 8.3 17.9 8.5 17.5 10Z" strokeWidth={0.3} />
        <path d="M14.4 9.6L12.4 6.3 14 7.1 13.7 5.9 15.3 7.3 15.4 6.5 16.1 8.7Z" strokeWidth={0.2} />
        <path d="M16.7 10.3L18.1 11 18.5 12M16.1 11 16.9 12.1 16.6 13M13.3 11.6 12.7 13.8M13.9 11.9 14.1 14M12.6 10.9Q11.3 11 11.5 12.6" fill="none" strokeWidth={0.55} />
      </g>
    </>
  );
}

function Sicilia(): ReactNode {
  const pelle = '#F5C49C';
  const centro = { x: 15, y: 10 };
  const gambe = [-90, 30, 150].map((gradi) => {
    const a = (gradi * Math.PI) / 180;
    const b = ((gradi + 115) * Math.PI) / 180;
    const ginocchio = { x: centro.x + 5.6 * Math.cos(a), y: centro.y + 5.6 * Math.sin(a) };
    const piede = { x: ginocchio.x + 3.4 * Math.cos(b), y: ginocchio.y + 3.4 * Math.sin(b) };
    return `M${centro.x} ${centro.y}L${ginocchio.x.toFixed(2)} ${ginocchio.y.toFixed(2)}L${piede.x.toFixed(2)} ${piede.y.toFixed(2)}`;
  });
  return (
    <>
      <rect width={L} height={H} fill="#E30613" />
      <path d={`M0 0L${L} ${H}H0Z`} fill="#FCDD09" />
      {/* La Trinacria: tre gambe piegate attorno alla testa di Medusa. */}
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {gambe.map((d) => (
          <path key={d} d={d} stroke="#7A4A2A" strokeWidth={2.1} />
        ))}
        {gambe.map((d) => (
          <path key={d} d={d} stroke={pelle} strokeWidth={1.5} />
        ))}
      </g>
      <circle cx={centro.x} cy={centro.y} r={2.4} fill="#D9A21B" stroke="#7A4A2A" strokeWidth={0.3} />
      <circle cx={centro.x} cy={centro.y} r={1.35} fill={pelle} />
    </>
  );
}

function Veneto(): ReactNode {
  const oro = '#E2B04A';
  const code = Array.from({ length: 7 }, (_, i) => 1 + (18 / 7) * i);
  return (
    <>
      <rect width={L} height={H} fill="#C7463A" />
      <rect x={0.8} y={0.8} width={28.4} height={18.4} fill="none" stroke={oro} strokeWidth={0.4} />
      {/* Le sette code delle province, verso il battente. */}
      {code.map((y) => (
        <g key={y}>
          <rect x={19.4} y={y} width={9.8} height={18 / 7} fill="#C7463A" stroke="#3A1712" strokeWidth={0.3} />
          <circle cx={27.6} cy={y + 9 / 7} r={0.55} fill="#F4F1E6" />
        </g>
      ))}
      {/* Il riquadro blu con il leone di San Marco. */}
      <rect x={3} y={3} width={14} height={14} fill="#15264A" stroke={oro} strokeWidth={0.5} />
      <rect x={3.5} y={14.2} width={13} height={2.3} fill="#B9862C" />
      <circle cx={7.4} cy={8.4} r={1.9} fill="#F0C04A" />
      <path d="M9.6 10C10.6 7.4 13 6 15.6 5.6 14.6 7 13.6 8.4 11.6 10Z" fill="#EDEDED" />
      <path
        d="M7 10.4C9 9.6 12.6 9.8 14 10.6L14.4 13.8 13.4 13.8 13.2 11.8 10 12 9.4 13.9 8.4 13.9 8.6 11.6C7.6 11.4 7 11 7 10.4Z"
        fill="#C68F42"
      />
      <circle cx={7.6} cy={8.6} r={1.3} fill="#C68F42" />
      <rect x={4.8} y={11.2} width={2.2} height={2.5} fill="#F4F1E6" />
    </>
  );
}

function Campania({ id }: { id: string }): ReactNode {
  const forma = scudo(10.2, 4, 9.6, 11.8);
  return (
    <>
      <rect width={L} height={H} fill="#22318C" />
      <clipPath id={`${id}-campania`}>
        <path d={forma} />
      </clipPath>
      <path d={forma} fill="#fff" />
      <path d="M9.4 3L20.6 15" stroke="#D7141A" strokeWidth={2.4} clipPath={`url(#${id}-campania)`} />
      <path d={forma} fill="none" stroke="#C9A54A" strokeWidth={0.3} />
    </>
  );
}

function ottagono(cx: number, cy: number, r: number): string {
  return Array.from({ length: 8 }, (_, i) => {
    const a = ((22.5 + 45 * i) * Math.PI) / 180;
    return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
  }).join(' ');
}

function Lazio({ id }: { id: string }): ReactNode {
  const oro = '#F7C600';
  const c = { x: 15, y: 8.8 };
  const forma = ottagono(c.x, c.y, 4.3);
  return (
    <>
      <rect width={L} height={H} fill="#0072C6" />
      {/* La corona sopra lo stemma. */}
      <rect x={12} y={1.8} width={6} height={1.2} fill={oro} />
      {[12.4, 13.7, 15, 16.3, 17.6].map((x) => (
        <circle key={x} cx={x} cy={1.6} r={0.5} fill={oro} />
      ))}
      {/* Le fronde di quercia e d'alloro ai lati. */}
      <path d="M10.4 13.2C9 11.2 9 8.4 10.2 6.2M19.6 13.2C21 11.2 21 8.4 19.8 6.2" fill="none" stroke={oro} strokeWidth={0.9} strokeDasharray="0.9 0.35" />
      {/* Lo stemma ottagonale con le cinque province, diviso dalla croce di Sant'Andrea. */}
      <clipPath id={`${id}-lazio`}>
        <polygon points={forma} />
      </clipPath>
      <g clipPath={`url(#${id}-lazio)`}>
        <rect x={10} y={4} width={10} height={10} fill="#1E7B34" />
        <path d={`M${c.x} ${c.y}L10 4V14Z`} fill="#D52B1E" />
        <path d={`M${c.x} ${c.y}L20 4V14Z`} fill="#fff" />
        <path d={`M${c.x} ${c.y}L10 14H20Z`} fill="#D52B1E" />
        <path d={`M10 4L20 14M20 4L10 14`} stroke="#fff" strokeWidth={0.7} />
      </g>
      <polygon points={forma} fill="none" stroke={oro} strokeWidth={0.55} />
      <circle cx={c.x} cy={c.y} r={1} fill="#fff" stroke={oro} strokeWidth={0.3} />
      <Scritta d="M4 16.9H14.2M15.8 16.9H26" colore={oro} spessore={2.1} />
    </>
  );
}

function Lombardia(): ReactNode {
  // La rosa camuna: quattro lobi tondi girati attorno al centro.
  const centro = { x: 16.2, y: 10.4 };
  const lobi = [
    { x: 18, y: 3.4 },
    { x: 23.4, y: 12 },
    { x: 13.8, y: 16.6 },
    { x: 9.4, y: 8.6 },
  ];
  return (
    <>
      <rect width={L} height={H} fill="#009A44" />
      {/* I bracci sono larghi quasi quanto i lobi e piegati, come una girandola. */}
      <g fill="none" stroke="#fff" strokeLinecap="round" strokeWidth={3.3}>
        {lobi.map((l) => (
          <path key={`${l.x}`} d={`M${centro.x} ${centro.y}Q${(centro.x + l.x) / 2 + (l.y - centro.y) * 0.22} ${(centro.y + l.y) / 2 - (l.x - centro.x) * 0.22} ${l.x} ${l.y}`} />
        ))}
      </g>
      <g fill="#fff">
        {lobi.map((l) => (
          <circle key={`o${l.x}`} cx={l.x} cy={l.y} r={2.5} />
        ))}
        <circle cx={centro.x} cy={centro.y} r={2.6} />
      </g>
    </>
  );
}

function Puglia(): ReactNode {
  const oro = '#D8B23A';
  return (
    <>
      <rect width={L} height={H} fill="#fff" />
      <rect x={6} width={1.8} height={H} fill="#009246" />
      <rect x={22.2} width={1.8} height={H} fill="#E4251B" />
      <Scritta d="M10.2 1.6H19.8" colore={oro} spessore={0.9} />
      {/* La corona e lo stemma: il castello ottagonale rosso con l'ulivo. */}
      <path d="M11.8 5.8H18.2L17.8 4.4 16.6 5.1 15 3.9 13.4 5.1 12.2 4.4Z" fill={oro} />
      <path d={scudo(11.6, 6.2, 6.8, 9.6)} fill="#0098D8" />
      <rect x={11.6} y={6.2} width={6.8} height={1.3} fill={oro} />
      <polygon points={ottagono(15, 11.4, 3.1)} fill="#E4251B" />
      <polygon points={ottagono(15, 11.4, 2.2)} fill="#fff" />
      <path d="M15 13.2V11.4" stroke="#6B4A2A" strokeWidth={0.5} />
      <circle cx={15} cy={10.9} r={1.1} fill="#3A8A3A" />
    </>
  );
}

function Piemonte(): ReactNode {
  const blu = '#0039A6';
  return (
    <>
      <rect width={L} height={H} fill={blu} />
      <rect x={1.2} y={1.2} width={27.6} height={17.6} fill="#D7141A" />
      <rect x={12.9} y={1.2} width={4.2} height={17.6} fill="#fff" />
      <rect x={1.2} y={8} width={27.6} height={4} fill="#fff" />
      {/* Il lambello azzurro dei Savoia-Acaja. */}
      <rect x={8.1} y={2.8} width={13.8} height={0.8} fill={blu} />
      {[9.6, 15, 20.4].map((x) => (
        <path key={x} d={`M${x - 0.5} 3.6H${x + 0.5}L${x + 1.2} 5H${x - 1.2}Z`} fill={blu} />
      ))}
    </>
  );
}

function Liguria(): ReactNode {
  return (
    <>
      <rect width={10} height={H} fill="#009246" />
      <rect x={10} width={10} height={H} fill="#F0001B" />
      <rect x={20} width={10} height={H} fill="#009FDA" />
      {/* Lo scudo con la croce di San Giorgio e le stelle, sopra la mezzaluna grigia. */}
      <path d="M10.4 11.2A4.6 4.4 0 0 0 19.6 11.2H17.6A2.6 2.4 0 0 1 12.4 11.2Z" fill="#9C9C9C" stroke="#222" strokeWidth={0.25} />
      <rect x={10.8} y={4} width={8.4} height={7.6} rx={0.6} fill="#fff" stroke="#222" strokeWidth={0.25} />
      <rect x={14.4} y={4} width={1.2} height={7.6} fill="#E4002B" />
      <rect x={10.8} y={7.2} width={8.4} height={1.2} fill="#E4002B" />
      {[
        [12.6, 5.6],
        [17.4, 5.6],
        [12.6, 9.9],
        [17.4, 9.9],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={0.65} fill="#8A8A8A" />
      ))}
    </>
  );
}

function TrentinoAltoAdige({ id }: { id: string }): ReactNode {
  const forma = 'M10 4H20V11C20 14.2 17.6 16.2 15 16.2 12.4 16.2 10 14.2 10 11Z';
  const aquile: [number, number, string][] = [
    [10.5, 4.5, '#111'],
    [15.5, 4.5, '#D7141A'],
    [10.5, 10.4, '#D7141A'],
    [15.5, 10.4, '#111'],
  ];
  return (
    <>
      <rect width={L} height={9.6} fill="#fff" />
      <rect y={9.6} width={L} height={10.4} fill="#1347A4" />
      <clipPath id={`${id}-trentino`}>
        <path d={forma} />
      </clipPath>
      <path d={forma} fill="#fff" />
      {/* Le aquile di Trento (nere) e del Tirolo (rosse), inquartate. */}
      <g clipPath={`url(#${id}-trentino)`}>
        {aquile.map(([x, y, colore]) => (
          <path key={`${x}-${y}`} d={AQUILA} fill={colore} transform={`translate(${x} ${y}) scale(0.4)`} />
        ))}
        <path d="M15 4V16.2M10 10.1H20" stroke="#222" strokeWidth={0.3} />
      </g>
      <path d={forma} fill="none" stroke="#222" strokeWidth={0.3} />
    </>
  );
}

/** Una stella a `punte` punte, con il raggio interno a metà di quello esterno. */
function stella(cx: number, cy: number, r: number, punte: number): string {
  return Array.from({ length: punte * 2 }, (_, i) => {
    const a = (Math.PI * i) / punte - Math.PI / 2;
    const raggio = i % 2 === 0 ? r : r * 0.5;
    return `${(cx + raggio * Math.cos(a)).toFixed(2)},${(cy + raggio * Math.sin(a)).toFixed(2)}`;
  }).join(' ');
}

function Molise({ id }: { id: string }): ReactNode {
  const forma = scudo(10.6, 3.6, 8.8, 10.4);
  return (
    <>
      <rect width={L} height={H} fill="#0082CA" />
      <clipPath id={`${id}-molise`}>
        <path d={forma} />
      </clipPath>
      <path d={forma} fill="#D7141A" />
      <path d="M10 14.6L20.4 3" stroke="#C4C4C4" strokeWidth={1.9} clipPath={`url(#${id}-molise)`} />
      <path d={forma} fill="none" stroke="#C4C4C4" strokeWidth={0.7} />
      <polygon points={stella(13.1, 5.9, 1.1, 8)} fill="#fff" />
      <Scritta d="M10.4 14.6Q15 19.2 19.6 14.6" colore="#fff" spessore={0.9} />
    </>
  );
}

function Basilicata(): ReactNode {
  const blu = '#2B4A7C';
  const onde = [8.8, 9.9, 11, 12.1].map((y) => {
    let d = `M10.6 ${y}`;
    for (let x = 10.6; x < 19.4; x += 2.2) d += `q.55-.45 1.1 0t1.1 0`;
    return d;
  });
  return (
    <>
      <rect width={L} height={H} fill={blu} />
      <path d="M10.6 4.2H19.4V15.2H15.6L15 15.8 14.4 15.2H10.6Z" fill="#C4C4C4" />
      {/* I quattro fiumi della regione. */}
      {onde.map((d) => (
        <path key={d} d={d} fill="none" stroke={blu} strokeWidth={0.55} />
      ))}
    </>
  );
}

function Calabria({ id }: { id: string }): ReactNode {
  const oro = '#E2B300';
  const c = { x: 15, y: 10.4 };
  const r = 4.2;
  return (
    <>
      <rect width={L} height={H} fill="#1048A6" />
      <Scritta d="M11.4 3.8H18.6" colore={oro} spessore={1.2} />
      <Scritta d="M10.2 17H19.8" colore={oro} spessore={1.4} />
      {/* Lo scudo tondo inquartato: d'oro sopra e sotto (pino e colonna), d'argento ai lati con le croci. */}
      <clipPath id={`${id}-calabria`}>
        <circle cx={c.x} cy={c.y} r={r} />
      </clipPath>
      <circle cx={c.x} cy={c.y} r={r} fill="#D8D8D8" />
      <g clipPath={`url(#${id}-calabria)`}>
        <path d={`M${c.x} ${c.y}L${c.x - r} ${c.y - r}H${c.x + r}Z`} fill={oro} />
        <path d={`M${c.x} ${c.y}L${c.x - r} ${c.y + r}H${c.x + r}Z`} fill={oro} />
      </g>
      <path d={`M${c.x} ${c.y - 3.6}L${c.x + 0.8} ${c.y - 1.4}H${c.x - 0.8}Z`} fill="#2E7D32" />
      <rect x={c.x - 0.6} y={c.y + 1.2} width={1.2} height={2.4} fill="#2A7BC4" />
      <path d={`M${c.x - 2.8} ${c.y - 0.8}V${c.y + 0.8}M${c.x - 3.6} ${c.y}H${c.x - 2}M${c.x + 2.8} ${c.y - 0.8}V${c.y + 0.8}M${c.x + 2} ${c.y}H${c.x + 3.6}`} stroke="#111" strokeWidth={0.45} />
    </>
  );
}

function Abruzzo({ id }: { id: string }): ReactNode {
  const forma = scudo(10.8, 3.6, 8.4, 11.6);
  return (
    <>
      <rect width={L} height={H} fill="#DE0B42" />
      <clipPath id={`${id}-abruzzo`}>
        <path d={forma} />
      </clipPath>
      {/* Bianco, verde e azzurro in diagonale: le cime innevate, le colline, il mare. */}
      <g clipPath={`url(#${id}-abruzzo)`}>
        <rect x={10} y={3} width={10} height={13} fill="#fff" />
        <path d="M10 12.2L19 3H20.4V8.2L12.4 16.2H10Z" fill="#007A3D" />
        <path d="M12.4 16.2L20.4 8.2V16.2Z" fill="#2C7BC4" />
      </g>
      <path d={forma} fill="none" stroke="#B8A16B" strokeWidth={0.35} />
      <path d="M11.4 16.1Q15 17.3 18.6 16.1" fill="none" stroke="#fff" strokeWidth={0.8} />
    </>
  );
}

function Umbria(): ReactNode {
  return (
    <>
      <rect width={L} height={H} fill="#00923F" />
      <rect x={11.1} y={4} width={7.8} height={12} fill="#A7A9AC" stroke="#fff" strokeWidth={0.3} />
      {/* I tre ceri di Gubbio. */}
      {[12.8, 15, 17.2].map((x) => (
        <g key={x} fill="#C1272D">
          <rect x={x - 0.55} y={4.3} width={1.1} height={11.4} />
          <ellipse cx={x} cy={6.6} rx={0.85} ry={1.1} />
          <ellipse cx={x} cy={10} rx={0.85} ry={1.1} />
          <ellipse cx={x} cy={13.4} rx={0.85} ry={1.1} />
        </g>
      ))}
      <path d="M11.1 8.3H18.9M11.1 11.7H18.9" stroke="#fff" strokeWidth={0.25} />
    </>
  );
}

function Marche(): ReactNode {
  return (
    <>
      <rect width={L} height={H} fill="#fff" />
      <path d="M10.3 4.3H19.3V11.2C19.3 14.2 17.2 15.9 14.8 15.9 12.4 15.9 10.3 14.2 10.3 11.2Z" fill="none" stroke="#00753A" strokeWidth={1.1} />
      {/* Il picchio stilizzato che forma la M. */}
      <path d="M14.4 13.2V8.6L16.3 11 18.2 8.6V13.2" fill="none" stroke="#111" strokeWidth={1.2} strokeLinejoin="round" />
      <circle cx={12.4} cy={8.3} r={0.9} fill="none" stroke="#111" strokeWidth={0.5} />
      <path d="M11.5 8.1L10.6 8.5 11.5 8.8M12.6 9.2C12.4 11 12.9 12.4 14.4 13.2" fill="none" stroke="#111" strokeWidth={0.5} />
    </>
  );
}

function FriuliVeneziaGiulia(): ReactNode {
  const oro = '#F5C400';
  return (
    <>
      <rect width={L} height={H} fill="#0060E0" />
      {/* L'aquila d'oro di Aquileia, ad ali alzate, sopra le mura. */}
      <path d="M12.2 15H17.8V17.2H12.2ZM12.2 14.2H13.2V15H12.2ZM14.5 14.2H15.5V15H14.5ZM16.8 14.2H17.8V15H16.8Z" fill="#9A9A9A" />
      <g fill={oro} stroke="#8C6A00" strokeWidth={0.2} strokeLinejoin="round">
        <path d="M13.8 8.2L9.6 2.6 10.2 5.8 9.4 6.8 10.8 8.2 10.2 9.6 13.6 10.8ZM16.2 8.2L20.4 2.6 19.8 5.8 20.6 6.8 19.2 8.2 19.8 9.6 16.4 10.8Z" />
        <path d="M14 12.6L15 15 16 12.6Z" />
        <ellipse cx={15} cy={10} rx={1.7} ry={3} />
        <circle cx={14.8} cy={6.4} r={1.15} />
        <path d="M13.8 6.3L12.9 6.9 13.9 7Z" />
      </g>
    </>
  );
}

function EmiliaRomagna(): ReactNode {
  const verde = '#009246';
  return (
    <>
      <rect width={L} height={H} fill="#fff" />
      <rect x={9} y={2.6} width={12} height={12.4} fill={verde} />
      {/* Il marchio: un'onda bianca in alto e un triangolo bianco in basso. */}
      <path d="M10 3.8H20V6.2C17.6 5 14.6 6.8 10 6Z" fill="#fff" />
      <path d="M10 8.8L20 14H10Z" fill="#fff" />
      <rect x={9} y={15.4} width={12} height={0.35} fill="#E4251B" />
      <rect x={9} y={15.9} width={12} height={0.35} fill={verde} />
      <Scritta d="M9.4 17.6H20.6" colore={verde} spessore={0.9} />
    </>
  );
}

/** Il disegno di una bandiera regionale. `id` rende unici i ritagli (clipPath) di ogni bandiera nella pagina. */
export function DisegnoRegione({ regione, id }: { regione: BandieraRegione; id: string }): ReactNode {
  switch (regione) {
    case 'valle-aosta':
      return <ValleAosta />;
    case 'sardegna':
      return <Sardegna />;
    case 'toscana':
      return <Toscana />;
    case 'sicilia':
      return <Sicilia />;
    case 'veneto':
      return <Veneto />;
    case 'campania':
      return <Campania id={id} />;
    case 'lazio':
      return <Lazio id={id} />;
    case 'lombardia':
      return <Lombardia />;
    case 'puglia':
      return <Puglia />;
    case 'piemonte':
      return <Piemonte />;
    case 'liguria':
      return <Liguria />;
    case 'trentino':
      return <TrentinoAltoAdige id={id} />;
    case 'molise':
      return <Molise id={id} />;
    case 'basilicata':
      return <Basilicata />;
    case 'calabria':
      return <Calabria id={id} />;
    case 'abruzzo':
      return <Abruzzo id={id} />;
    case 'umbria':
      return <Umbria />;
    case 'marche':
      return <Marche />;
    case 'friuli':
      return <FriuliVeneziaGiulia />;
    case 'emilia-romagna':
      return <EmiliaRomagna />;
  }
}
