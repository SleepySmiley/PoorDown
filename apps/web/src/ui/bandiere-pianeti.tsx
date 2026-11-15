/*
 * I gruppi del tabellone Sistema solare: al posto della bandiera, il pianeta su un pezzo di cielo.
 * Stesso riquadro 30×20 delle bandiere (ui/bandiere.tsx), così lo Stemma aggiunge contorno, riflesso e filo uguali.
 * Il disco è grande (alto quasi quanto il riquadro): sotto le città la sfocatura deve lasciare il colore del pianeta.
 * Ogni pianeta si riconosce da un segno solo: gli anelli di Saturno, la macchia rossa di Giove, il cuore di Plutone,
 * la calotta polare di Marte.
 */

import type { ReactNode } from 'react';
import type { BandieraPianeta } from '@poordown/engine';

const CX = 15;
const CY = 10;
const R = 8.4;

/** Il cielo: blu notte con qualche stella. */
function Cielo(): ReactNode {
  return (
    <>
      <rect width={30} height={20} fill="#0B1024" />
      {[
        [2.6, 3.4, 0.45],
        [27.2, 2.8, 0.4],
        [4.2, 16.4, 0.35],
        [26.4, 15.6, 0.5],
        [24.2, 8.6, 0.3],
        [6.4, 8.2, 0.3],
      ].map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="#fff" opacity={0.85} />
      ))}
    </>
  );
}

/**
 * Il disco del pianeta: colore pieno, i segni ritagliati dentro il disco, poi la luce da sinistra in alto
 * e l'ombra in basso a destra, che lo fanno sembrare una sfera.
 */
function Disco({ colore, id, r = R, children }: { colore: string; id: string; r?: number; children?: ReactNode }): ReactNode {
  const taglio = `pianeta-taglio-${id}`;
  const luce = `pianeta-luce-${id}`;
  return (
    <>
      <defs>
        <clipPath id={taglio}>
          <circle cx={CX} cy={CY} r={r} />
        </clipPath>
        <radialGradient id={luce} cx="0.34" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#fff" stopOpacity="0.32" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.8" stopColor="#000" stopOpacity="0.22" />
          <stop offset="1" stopColor="#000" stopOpacity="0.5" />
        </radialGradient>
      </defs>
      <circle cx={CX} cy={CY} r={r} fill={colore} />
      <g clipPath={`url(#${taglio})`}>{children}</g>
      <circle cx={CX} cy={CY} r={r} fill={`url(#${luce})`} />
    </>
  );
}

/** Crateri: cerchi più scuri con un filo chiaro sul bordo in alto. */
function Crateri({ crateri, colore }: { crateri: readonly (readonly [number, number, number])[]; colore: string }): ReactNode {
  return crateri.map(([x, y, r], i) => (
    <g key={i}>
      <circle cx={x} cy={y} r={r} fill={colore} />
      <path d={`M${x - r * 0.8} ${y - r * 0.4}a${r} ${r} 0 0 1 ${r * 1.6} 0`} fill="none" stroke="#fff" strokeOpacity={0.28} strokeWidth={0.35} />
    </g>
  ));
}

/** Bande orizzontali dentro il disco (Giove, Saturno, Venere): [y, altezza, colore]. */
function Bande({ bande, r = R }: { bande: readonly (readonly [number, number, string])[]; r?: number }): ReactNode {
  return bande.map(([y, alto, colore], i) => <rect key={i} x={CX - r} y={y} width={r * 2} height={alto} fill={colore} />);
}

function Saturno({ id }: { id: string }): ReactNode {
  const r = 6;
  return (
    <g transform={`rotate(-16 ${CX} ${CY})`}>
      {/* La metà dietro degli anelli passa sotto il pianeta, quella davanti sopra. */}
      <path d="M1.6 10A13.4 3.6 0 0 1 28.4 10" fill="none" stroke="#B89A5E" strokeWidth={1.7} />
      <path d="M3.6 10A11.4 2.7 0 0 1 26.4 10" fill="none" stroke="#E6D3A3" strokeWidth={0.7} />
      <Disco colore="#E2C27E" id={id} r={r}>
        <Bande
          r={r}
          bande={[
            [5.2, 1.2, '#CFAA63'],
            [8.2, 1.4, '#F0DBA8'],
            [11.6, 1.6, '#C79D57'],
          ]}
        />
      </Disco>
      <path d="M1.6 10A13.4 3.6 0 0 0 28.4 10" fill="none" stroke="#B89A5E" strokeWidth={1.7} />
      <path d="M3.6 10A11.4 2.7 0 0 0 26.4 10" fill="none" stroke="#E6D3A3" strokeWidth={0.7} />
    </g>
  );
}

function Asteroidi(): ReactNode {
  // Tre sassi storti, uno grande e due piccoli, con la luce da sinistra.
  return (
    <>
      <path d="M9.4 6.2l4.6-2.6 5.4 1 3.2 4.4-.8 5.4-4.6 3-5.8-.6-3-4.2z" fill="#8F7D6A" />
      <path d="M9.4 6.2l4.6-2.6 5.4 1-2.4 2.2-4.8.6-1.6 3.4-1.6.2z" fill="#B5A28C" />
      <path d="M22.4 14.2l1.4 4.2-3.6.4-1.6-2.6z" fill="#000" opacity={0.25} />
      <circle cx={16.4} cy={11.6} r={1.3} fill="#6E5E4E" />
      <circle cx={13} cy={14.6} r={0.8} fill="#6E5E4E" />
      <circle cx={19.6} cy={8.4} r={0.7} fill="#6E5E4E" />
      <path d="M3.2 4.6l2.2-1 1.6 1.4-.6 2-2.2.4z" fill="#9C8A76" />
      <path d="M24.2 13.4l2.6-.6 1.4 1.8-1.2 2-2.4-.4z" fill="#7F6E5C" />
    </>
  );
}

/**
 * Il disegno di un pianeta, da mettere dentro un <svg viewBox="0 0 30 20">.
 * `id` rende unici nella pagina i ritagli e le sfumature.
 */
export function DisegnoPianeta({ pianeta, id }: { pianeta: BandieraPianeta; id: string }): ReactNode {
  return (
    <>
      <Cielo />
      <Pianeta pianeta={pianeta} id={id} />
    </>
  );
}

function Pianeta({ pianeta, id }: { pianeta: BandieraPianeta; id: string }): ReactNode {
  switch (pianeta) {
    case 'luna':
      return (
        <Disco colore="#C4C4BC" id={id}>
          <ellipse cx={12.6} cy={8.2} rx={3.6} ry={2.6} fill="#9D9D96" />
          <ellipse cx={17.4} cy={12.8} rx={2.8} ry={2} fill="#A5A59E" />
          <Crateri
            colore="#8E8E87"
            crateri={[
              [18.6, 6.4, 1.2],
              [11.6, 13.4, 1.4],
              [15.4, 16, 0.8],
              [20.6, 10.4, 0.7],
            ]}
          />
        </Disco>
      );
    case 'mercurio':
      return (
        <Disco colore="#A08C78" id={id}>
          <Crateri
            colore="#7E6C5A"
            crateri={[
              [12, 6.6, 1.6],
              [18.2, 8.2, 1.1],
              [14.6, 12.4, 2.2],
              [10.2, 12, 0.8],
              [19.6, 13.6, 0.9],
              [16.2, 4.4, 0.6],
            ]}
          />
        </Disco>
      );
    case 'venere':
      return (
        <Disco colore="#E2B866" id={id}>
          <path d="M6 6.4c3-1.4 6 .8 9-.2s5.6-1.6 9 .4v1.8c-3.4-1.6-6-.6-9 .4s-6-1.4-9 .2z" fill="#F2D79B" />
          <path d="M6 10.6c3.4-1 6.2 1 9.4 0s5.2-1.2 8.6.4v2c-3-1.4-5.6-.6-8.6.4s-6.2-1.2-9.4-.4z" fill="#C99540" />
          <path d="M7 14.6c2.8-.8 5.4.6 8 0s5-.8 7.6.4v1.6c-2.6-1-5-.4-7.6.2s-5.2-.8-8-.4z" fill="#EDCE86" />
        </Disco>
      );
    case 'marte':
      return (
        <Disco colore="#C4532D" id={id}>
          <path d="M9 9.4c1.6-1.6 3.4-.4 4.6-1.6 1.4-1.4 3.4-.6 4 .8.6 1.6-1 2.4-2.6 2.6-1.8.2-2.4 1.8-4 1.8S7.6 10.8 9 9.4z" fill="#8E3418" />
          <path d="M17.6 13.6c1.2-.6 2.8 0 3.4 1s-.6 1.6-1.8 1.4-2.6-1.8-1.6-2.4z" fill="#9A3B1C" />
          <ellipse cx={CX} cy={2.2} rx={3.8} ry={1.6} fill="#F4EEE6" />
        </Disco>
      );
    case 'asteroidi':
      return <Asteroidi />;
    case 'giove':
      return (
        <Disco colore="#D8B489" id={id}>
          <Bande
            bande={[
              [2.4, 1.6, '#B98A60'],
              [4.8, 1.6, '#EFDDBF'],
              [7, 2.2, '#B07A4F'],
              [9.8, 1.4, '#F2E2C6'],
              [11.8, 2, '#A86F45'],
              [14.6, 1.4, '#E8D2AE'],
              [16.6, 1.6, '#B98A60'],
            ]}
          />
          <ellipse cx={18.6} cy={12.8} rx={2} ry={1.2} fill="#C2452A" />
          <ellipse cx={18.6} cy={12.8} rx={2} ry={1.2} fill="none" stroke="#F2E2C6" strokeWidth={0.4} />
        </Disco>
      );
    case 'saturno':
      return <Saturno id={id} />;
    case 'urano':
      return (
        <>
          <Disco colore="#94DCE2" id={id}>
            <Bande
              bande={[
                [4, 2, '#A9E7EB'],
                [13.4, 2.4, '#82CED6'],
              ]}
            />
          </Disco>
          {/* Urano gira coricato: anche i suoi anelli, sottili, stanno quasi in verticale. */}
          <ellipse cx={CX} cy={CY} rx={2.4} ry={9.6} fill="none" stroke="#E6FAFC" strokeOpacity={0.6} strokeWidth={0.5} />
        </>
      );
    case 'nettuno':
      return (
        <Disco colore="#3D63D6" id={id}>
          <Bande
            bande={[
              [4.6, 1.4, '#5A80E8'],
              [14.4, 1.6, '#3254BE'],
            ]}
          />
          <ellipse cx={12.4} cy={10.6} rx={2.4} ry={1.4} fill="#1D368A" />
          <path d="M15.4 12.6c1.4-.6 3-.6 4.2 0" fill="none" stroke="#EAF1FF" strokeWidth={0.7} strokeLinecap="round" />
        </Disco>
      );
    case 'plutone':
      return (
        <Disco colore="#C29A76" id={id}>
          <path d="M6.6 8c2.2-1.4 3.6 1 3.4 3.2s-1.2 4.4-3.4 4.8z" fill="#7C5638" />
          {/* Il cuore: la pianura chiara di ghiaccio che ha fatto innamorare tutti di Plutone. */}
          <path d="M17 16.2c-2.6-1.8-4.6-3.4-4.6-5.6 0-1.4 1-2.4 2.3-2.4 1 0 1.8.6 2.3 1.4.5-.8 1.3-1.4 2.3-1.4 1.3 0 2.3 1 2.3 2.4 0 2.2-2 3.8-4.6 5.6z" fill="#F3E6D2" />
        </Disco>
      );
  }
}
