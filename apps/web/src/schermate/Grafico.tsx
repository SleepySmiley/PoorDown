/*
 * Grafico del patrimonio nel tempo, a fine partita: una linea a gradini per giocatore, nel colore della sua pedina.
 * I colori delle pedine sono scelti dai giocatori e possono somigliarsi: per questo ogni linea finisce con la pedina
 * e l'iniziale, c'è sempre la legenda, il passaggio del mouse mostra i valori di tutti e c'è una tabella nascosta
 * per chi usa un lettore di schermo.
 */

import { useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { euro, type IdGiocatore, type Stato } from '@poordown/engine';
import { Pedina } from '../ui/comuni';
import { iniziale } from '../ui/utili';

const L = 560;
const A = 360;
const MARGINE = { sinistra: 66, destra: 18, alto: 14, basso: 46 };

/** Passo "tondo" (1, 2, 2,5, 5 × 10ⁿ) per avere al massimo `quanti` intervalli su `ampiezza`. */
function passoTondo(ampiezza: number, quanti: number): number {
  if (ampiezza <= 0) return 1;
  const grezzo = ampiezza / quanti;
  const base = 10 ** Math.floor(Math.log10(grezzo));
  for (const m of [1, 2, 2.5, 5, 10]) if (base * m >= grezzo) return base * m;
  return base * 10;
}

function tacche(min: number, max: number, passo: number): number[] {
  const out: number[] = [];
  for (let v = min; v <= max + passo / 1000; v += passo) out.push(Math.round(v * 1000) / 1000);
  return out;
}

interface Serie {
  id: IdGiocatore;
  nome: string;
  colore: number;
  punti: { turno: number; valore: number }[];
}

export function GraficoPatrimonio({ partita }: { partita: Stato }): ReactNode {
  const dati = partita.statistiche.patrimonio;
  const [indice, setIndice] = useState<number | null>(null);
  const [evidenziato, setEvidenziato] = useState<IdGiocatore | null>(null);
  const area = useRef<SVGSVGElement>(null);

  if (dati.length < 2) {
    return <p className="grafico__vuoto">Non ci sono abbastanza dati per disegnare il grafico.</p>;
  }

  const serie: Serie[] = partita.giocatori.map((g, i) => ({
    id: g.id,
    nome: g.nome,
    colore: g.colore,
    punti: dati.flatMap((p) => (p.valori[i] == null ? [] : [{ turno: p.turno, valore: p.valori[i]! }])),
  }));

  const valori = serie.flatMap((s) => s.punti.map((p) => p.valore));
  const passoY = passoTondo(Math.max(...valori) - Math.min(0, ...valori), 5);
  const minY = Math.floor(Math.min(0, ...valori) / passoY) * passoY;
  const maxY = Math.max(minY + passoY, Math.ceil(Math.max(...valori) / passoY) * passoY);
  const ultimoTurno = Math.max(1, dati.at(-1)!.turno);
  const passoX = Math.max(1, passoTondo(ultimoTurno, 6));

  const x = (turno: number) => MARGINE.sinistra + (turno / ultimoTurno) * (L - MARGINE.sinistra - MARGINE.destra);
  const y = (v: number) => MARGINE.alto + ((maxY - v) / (maxY - minY)) * (A - MARGINE.alto - MARGINE.basso);

  /** Linea a gradini: il valore resta fino al punto successivo. */
  const tracciato = (s: Serie) =>
    s.punti.map((p, i) => (i === 0 ? `M${x(p.turno)} ${y(p.valore)}` : `H${x(p.turno)} V${y(p.valore)}`)).join(' ');

  const muovi = (e: PointerEvent<SVGRectElement>) => {
    const r = area.current?.getBoundingClientRect();
    if (!r) return;
    const turno = (((e.clientX - r.left) / r.width) * L - MARGINE.sinistra) / (L - MARGINE.sinistra - MARGINE.destra) * ultimoTurno;
    let migliore = 0;
    dati.forEach((p, i) => {
      if (Math.abs(p.turno - turno) < Math.abs(dati[migliore]!.turno - turno)) migliore = i;
    });
    setIndice(migliore);
  };

  const scelto = indice === null ? null : dati[indice]!;
  const righeSuggerimento = scelto
    ? serie
        .map((s, i) => ({ s, valore: scelto.valori[i] ?? null }))
        .sort((a, b) => (b.valore ?? -Infinity) - (a.valore ?? -Infinity))
    : [];
  const aDestra = scelto ? x(scelto.turno) < L * 0.6 : true;

  return (
    <div className="grafico">
      <div className="grafico__area">
        <svg
          ref={area}
          viewBox={`0 0 ${L} ${A}`}
          className="grafico__svg"
          role="img"
          aria-label="Patrimonio di ogni giocatore, turno per turno"
        >
          {tacche(minY, maxY, passoY).map((v) => (
            <g key={`y${v}`}>
              <line className={v === 0 ? 'grafico__zero' : 'grafico__griglia'} x1={MARGINE.sinistra} x2={L - MARGINE.destra} y1={y(v)} y2={y(v)} />
              <text className="grafico__tacca" x={MARGINE.sinistra - 8} y={y(v)} textAnchor="end" dominantBaseline="middle">
                {euro(v)}
              </text>
            </g>
          ))}
          {tacche(0, ultimoTurno, passoX).map((t) => (
            <text key={`x${t}`} className="grafico__tacca" x={x(t)} y={A - MARGINE.basso + 18} textAnchor="middle">
              {t}
            </text>
          ))}
          <text className="grafico__asse" x={L - MARGINE.destra} y={A - 6} textAnchor="end">
            Turno
          </text>

          {scelto && <line className="grafico__mirino" x1={x(scelto.turno)} x2={x(scelto.turno)} y1={MARGINE.alto} y2={A - MARGINE.basso} />}

          {serie.map((s) => {
            const fine = s.punti.at(-1);
            const spenta = evidenziato !== null && evidenziato !== s.id;
            return (
              <g key={s.id} className={spenta ? 'grafico__serie grafico__serie--spenta' : 'grafico__serie'} style={{ color: `var(--p${s.colore})` }}>
                <path className="grafico__linea" d={tracciato(s)} />
                {fine && (
                  <g transform={`translate(${x(fine.turno)} ${y(fine.valore)})`}>
                    <circle className="grafico__fine" r="9" />
                    <text className="grafico__iniziale" textAnchor="middle" dominantBaseline="central">
                      {iniziale(s.nome)}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {scelto &&
            serie.map((s, i) => {
              const v = scelto.valori[i];
              if (v == null) return null;
              return <circle key={s.id} className="grafico__punto" style={{ color: `var(--p${s.colore})` }} cx={x(scelto.turno)} cy={y(v)} r="4.5" />;
            })}

          <rect
            className="grafico__presa"
            x={MARGINE.sinistra}
            y={MARGINE.alto}
            width={L - MARGINE.sinistra - MARGINE.destra}
            height={A - MARGINE.alto - MARGINE.basso}
            onPointerMove={muovi}
            onPointerDown={muovi}
            onPointerLeave={() => setIndice(null)}
          />
        </svg>

        {scelto && (
          <div
            className="grafico__suggerimento"
            style={{
              left: `${(x(scelto.turno) / L) * 100}%`,
              transform: aDestra ? 'translateX(14px)' : 'translateX(calc(-100% - 14px))',
            }}
          >
            <p className="grafico__turno">{scelto.turno === 0 ? 'Inizio' : `Turno ${scelto.turno}`}</p>
            <ul>
              {righeSuggerimento.map(({ s, valore }) => (
                <li key={s.id} className={valore === null ? 'grafico__fuori' : undefined}>
                  <Pedina colore={s.colore} className="pedina--mini" />
                  <span className="grafico__nome">{s.nome}</span>
                  <b>{valore === null ? 'fuori' : euro(valore)}</b>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <ul className="grafico__legenda" aria-label="Legenda">
        {serie.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              className="grafico__voce"
              onPointerEnter={() => setEvidenziato(s.id)}
              onPointerLeave={() => setEvidenziato(null)}
              onFocus={() => setEvidenziato(s.id)}
              onBlur={() => setEvidenziato(null)}
            >
              <Pedina colore={s.colore} iniziale={iniziale(s.nome)} className="pedina--legenda" />
              {s.nome}
            </button>
          </li>
        ))}
      </ul>

      <table className="nascosto">
        <caption>Patrimonio dei giocatori</caption>
        <thead>
          <tr>
            <th scope="col">Giocatore</th>
            <th scope="col">All’inizio</th>
            <th scope="col">Massimo</th>
            <th scope="col">Alla fine o all’uscita</th>
          </tr>
        </thead>
        <tbody>
          {serie.map((s) => {
            const massimo = s.punti.reduce((m, p) => (p.valore > m.valore ? p : m), s.punti[0] ?? { turno: 0, valore: 0 });
            return (
              <tr key={s.id}>
                <th scope="row">{s.nome}</th>
                <td>{euro(s.punti[0]?.valore ?? 0)}</td>
                <td>
                  {euro(massimo.valore)} (turno {massimo.turno})
                </td>
                <td>
                  {euro(s.punti.at(-1)?.valore ?? 0)} (turno {s.punti.at(-1)?.turno ?? 0})
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
