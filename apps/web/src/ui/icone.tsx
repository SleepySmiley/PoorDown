import type { ReactNode } from 'react';

/** Icone lineari 24×24 dello stile Partenze, disegnate apposta (nessuna libreria esterna). */
const TRACCIATI = {
  treno: (
    <>
      <rect x="5" y="3" width="14" height="14" rx="3" />
      <path d="M5 10h14M8 17l-2 4M16 17l2 4" />
      <path d="M9 13.5h0M15 13.5h0" />
    </>
  ),
  busta: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="1.5" />
      <path d="m3.5 6 8.5 7 8.5-7" />
    </>
  ),
  cartolina: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="1.5" />
      <path d="M13 8v8M5 10h5M5 13h5" />
      <rect x="15.5" y="7.5" width="3.5" height="4" />
    </>
  ),
  percento: (
    <>
      <path d="M19 5 5 19" />
      <circle cx="7" cy="7" r="2.5" />
      <circle cx="17" cy="17" r="2.5" />
    </>
  ),
  euro: <path d="M17.5 6.2A7 7 0 1 0 17.5 17.8M4 10.5h9M4 13.5h9" />,
  partenza: <path d="M20 12H4m6-6-6 6 6 6" />,
  casa: <path d="M4 11 12 4l8 7v9H4z" />,
  albergo: <path d="M5 21V4h14v17M3 21h18M9 8h2M13 8h2M9 12h2M13 12h2M10 21v-4.5h4V21" />,
  corona: <path d="m3 8 4.5 4L12 5l4.5 7L21 8l-2 11H5z" />,
  dado: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3.5" />
      <path d="M8.5 8.5h0M15.5 15.5h0M12 12h0M15.5 8.5h0M8.5 15.5h0" strokeWidth="2.6" />
    </>
  ),
  chiudi: <path d="M6 6l12 12M18 6 6 18" />,
  copia: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8" />
    </>
  ),
  aggiorna: <path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6" />,
  invia: <path d="M21 3 10 14M21 3l-7 18-4-7-7-4z" />,
  volume: (
    <>
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
      <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
    </>
  ),
  muto: (
    <>
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
      <path d="m16 9.5 5 5M21 9.5l-5 5" />
    </>
  ),
  aiuto: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h0" />
    </>
  ),
  regolazioni: (
    <>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </>
  ),
  robot: (
    <>
      <rect x="5" y="8" width="14" height="11" rx="2.5" />
      <path d="M12 8V5.5M9.5 13h0M14.5 13h0M3 12.5v3M21 12.5v3" />
      <circle cx="12" cy="4.5" r="1" />
    </>
  ),
  scambio: <path d="M4 8h15l-3.5-3.5M20 16H5l3.5 3.5" />,
  fulmine: <path d="M13 3 5 13.5h6L10 21l8-10.5h-6z" />,
  goccia: <path d="M12 3.5s6 6.4 6 10.5a6 6 0 0 1-12 0c0-4.1 6-10.5 6-10.5z" />,
  fiamma: <path d="M12 21a6 6 0 0 0 6-6c0-4-3-6.5-4-10-2.5 2-3.2 4.3-3 6.5-1.2-.6-2-1.8-2.2-3C7.2 10.3 6 12.6 6 15a6 6 0 0 0 6 6z" />,
  squadre: (
    <>
      <circle cx="7.5" cy="8.5" r="2.6" />
      <circle cx="16.5" cy="8.5" r="2.6" />
      <path d="M2.5 19c0-2.9 2.2-5 5-5s5 2.1 5 5M11.5 19c0-2.9 2.2-5 5-5s5 2.1 5 5" />
    </>
  ),
  prigione: (
    <>
      <rect x="4" y="3.5" width="16" height="17" rx="1.5" />
      <path d="M8.5 3.5v17M12 3.5v17M15.5 3.5v17" />
    </>
  ),
  vacanza: (
    <>
      <path d="M3.5 11a8.5 8.5 0 0 1 17 0z" />
      <path d="M12 11v9.5M8 20.5h8" />
    </>
  ),
  vaiprigione: (
    <>
      <rect x="11.5" y="4" width="9" height="16" rx="1" />
      <path d="M14.5 4v16M17.5 4v16M3 12h6.5M7 9.5 9.5 12 7 14.5" />
    </>
  ),
  persone: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.6 2.7-6 6-6s6 2.4 6 6M15.5 4.8a3.2 3.2 0 0 1 0 6.4M17.5 14.3c2 .7 3.5 2.6 3.5 5.7" />
    </>
  ),
  lucchetto: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </>
  ),
  mappa: <path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20zM9 4v13.5M15 6.5V20" />,
  monete: (
    <>
      <ellipse cx="12" cy="6.5" rx="7" ry="2.8" />
      <path d="M5 6.5v5c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-5M5 11.5v5c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-5" />
    </>
  ),
  martelletto: (
    <>
      <rect x="11" y="2.5" width="5" height="10" rx="1" transform="rotate(-45 13.5 7.5)" />
      <path d="M11.5 10.5 4 18M3 21h9" />
    </>
  ),
  ribasso: <path d="m3 6 6.5 6.5 4-4L21 16M21 10.5V16h-5.5" />,
  banca: <path d="M3 9.5 12 4l9 5.5M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20.5h18" />,
  uniforme: <path d="M4 11 12 4l8 7v9H4zM9.5 14h5M9.5 17h5" />,
  banconota: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="1.5" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M6 9.5v5M18 9.5v5" />
    </>
  ),
  mescola: (
    <path d="M3 7h3.5c4 0 6 10 10 10H21M3 17h3.5c1.6 0 2.8-1.6 3.8-3.6M13.7 9.6c1-2 2.2-3.6 3.8-3.6H21M18.5 3.5 21 6l-2.5 2.5M18.5 14.5 21 17l-2.5 2.5" />
  ),
  orologio: (
    <>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2.5M9.5 2.5h5" />
    </>
  ),
  occhio: (
    <>
      <path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  cestino: <path d="M4 7h16M9.5 7V4.5h5V7M6 7l1 13h10l1-13M10 11v5.5M14 11v5.5" />,
  su: <path d="M12 19V5M6 11l6-6 6 6" />,
  giu: <path d="M12 5v14M6 13l6 6 6-6" />,
  piu: <path d="M12 5v14M5 12h14" />,
  esci: <path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10" />,
  bandiera: <path d="M5 21V4M5 4.5h12l-2.5 4 2.5 4H5" />,
  chat: <path d="M4 5.5h16v11H10l-4.5 3.5v-3.5H4z" />,
  spunta: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  collegamento: (
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  ),
  riduci: <path d="M5 12h14" />,
  grazia: (
    <>
      <path d="M3 8.5V6h18v2.5a2.5 2.5 0 0 0 0 5V18H3v-4.5a2.5 2.5 0 0 0 0-5z" />
      <path d="M14.5 6.5v11" strokeDasharray="2 2" />
    </>
  ),
  avanti: <path d="M5 12h14m-6-6 6 6-6 6" />,
  tempo: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  avviso: (
    <>
      <path d="M12 3.5 2.5 20h19z" />
      <path d="M12 10v4.5M12 17.4h0" strokeWidth="2.4" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5M12 7.8h0" strokeWidth="2.2" />
    </>
  ),
  scollegato: <path d="M2.5 8.5a14 14 0 0 1 5.2-3.2M12 4.5a14 14 0 0 1 9.5 4M5.8 12.2a9 9 0 0 1 4.4-2.3M15.8 10.6a9 9 0 0 1 2.4 1.6M9.2 15.8a4.5 4.5 0 0 1 5.6 0M12 19.5h0M3.5 3.5l17 17" />,
  matita: <path d="M4 20h4.5L19.5 9 15 4.5 4 15.5zM12.5 7l4.5 4.5" />,
  nota: <path d="M5 4h14v16H5zM8.5 9h7M8.5 12.5h7M8.5 16h4" />,
  coppa: (
    <path d="M7 4h10v5a5 5 0 0 1-10 0zM7 6H4.5v1a3.5 3.5 0 0 0 3 3.4M17 6h2.5v1a3.5 3.5 0 0 1-3 3.4M12 14v4M8 20.5h8M9.5 18h5" />
  ),
  segnaposto: (
    <>
      <path d="M12 21s-6.5-6.2-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.8" r="2.4" />
    </>
  ),
  grafico: <path d="M4 4v16h16M7.5 15.5l3.5-4.5 3 2.5 5-6.5" />,
} as const;

export type NomeIcona = keyof typeof TRACCIATI;

/** I dettagli "bucati" prendono il colore della casella sotto l'icona (variabile --buco). */
const BUCO = { fill: 'none', stroke: 'var(--buco, #2a2e37)', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

/** Icone piene delle caselle del tabellone: si leggono da lontano, come i pittogrammi dei cartelli. */
const PIENE = {
  treno: (
    <>
      <path
        fillRule="evenodd"
        d="M8 2.5h8A3.5 3.5 0 0 1 19.5 6v9a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3V6A3.5 3.5 0 0 1 8 2.5zM7.5 6.5v4h9v-4zM8.8 13a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6zm6.4 0a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6z"
      />
      <path d="M8.5 18.8 6.5 21.5M15.5 18.8l2 2.7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  fulmine: <path d="M13.8 2 4.5 13.6h6.6L9.8 22l9.7-12.4h-6.4z" />,
  goccia: <path d="M12 2.5s7 7.2 7 12a7 7 0 0 1-14 0c0-4.8 7-12 7-12z" />,
  fiamma: <path d="M12 22a7 7 0 0 0 7-7c0-4.6-3.5-7.6-4.7-12-2.9 2.3-3.8 5-3.5 7.6-1.4-.7-2.4-2.1-2.6-3.6C6.4 9.6 5 12.2 5 15a7 7 0 0 0 7 7z" />,
  // Busta chiusa: la linguetta e il sigillo di ceralacca sulla punta.
  busta: (
    <>
      <rect x="2" y="5" width="20" height="14.5" rx="2" />
      <path d="m3.4 6.4 8.6 6.6 8.6-6.6" style={BUCO} />
      <circle cx="12" cy="13" r="3.4" style={{ fill: 'var(--buco, #2a2e37)' }} />
      <circle cx="12" cy="13" r="2.3" />
    </>
  ),
  // Cartolina: righe del messaggio a sinistra, francobollo dentellato in alto a destra con l'annullo sopra.
  cartolina: (
    <>
      <rect x="1.5" y="4.5" width="21" height="15" rx="2" />
      <path d="M4.3 10h6.2M4.3 13h6.2M4.3 16h4" style={BUCO} />
      <rect x="15" y="7" width="5" height="6" rx="0.3" style={{ ...BUCO, strokeWidth: 1.3, strokeDasharray: '1.05 0.75', strokeLinecap: 'butt' }} />
      <circle cx="14.6" cy="13.2" r="2.7" style={{ ...BUCO, strokeWidth: 1.1 }} />
      <path d="M12.6 16.6c.9-.5 1.6-.5 2.4 0s1.6.5 2.4 0" style={{ ...BUCO, strokeWidth: 1.1 }} />
    </>
  ),
  percento: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M15.5 8.5l-7 7" style={BUCO} />
      <circle cx="9" cy="9" r="1.7" style={{ fill: 'var(--buco, #2a2e37)' }} />
      <circle cx="15" cy="15" r="1.7" style={{ fill: 'var(--buco, #2a2e37)' }} />
    </>
  ),
  euro: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M15.6 8.3a4.6 4.6 0 1 0 0 7.4M7 10.7h6M7 13.3h6" style={BUCO} />
    </>
  ),
} as const;

/** Icona di una casella: la versione piena se c'è, altrimenti quella lineare. */
export function IconaCasella({ nome, className }: { nome: NomeIcona; className?: string }): ReactNode {
  if (!(nome in PIENE)) return <Icona nome={nome} className={className} />;
  return (
    <svg className={className ? `icona ${className}` : 'icona'} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      {PIENE[nome as keyof typeof PIENE]}
    </svg>
  );
}

export function Icona({ nome, className, titolo }: { nome: NomeIcona; className?: string; titolo?: string }): ReactNode {
  return (
    <svg
      className={className ? `icona ${className}` : 'icona'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={titolo ? undefined : true}
      role={titolo ? 'img' : undefined}
      aria-label={titolo}
    >
      {TRACCIATI[nome]}
    </svg>
  );
}
