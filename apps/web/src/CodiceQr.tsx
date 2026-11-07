import { useMemo } from 'react';
import QRCode from 'qrcode';

const MARGINE = 2;

/** Codice QR disegnato in SVG, sempre scuro su bianco perché i telefoni lo leggano. */
export function CodiceQr({ testo }: { testo: string }) {
  const { lato, tracciato } = useMemo(() => {
    const { modules } = QRCode.create(testo, { errorCorrectionLevel: 'M' });
    let d = '';
    for (let riga = 0; riga < modules.size; riga++) {
      for (let colonna = 0; colonna < modules.size; colonna++) {
        if (modules.get(riga, colonna)) d += `M${colonna} ${riga}h1v1h-1z`;
      }
    }
    return { lato: modules.size, tracciato: d };
  }, [testo]);

  const totale = lato + MARGINE * 2;
  return (
    <svg
      className="qr"
      viewBox={`${-MARGINE} ${-MARGINE} ${totale} ${totale}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={`Codice QR per aprire ${testo}`}
    >
      <rect x={-MARGINE} y={-MARGINE} width={totale} height={totale} fill="#ffffff" />
      <path d={tracciato} fill="#16161a" />
    </svg>
  );
}
