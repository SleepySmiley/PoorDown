/*
 * Il volume dei suoni: l'altoparlante apre un popover con il cursore (0–100, a passi di 5) e il pulsante del muto.
 * Muovendo il cursore si sente una moneta al nuovo volume. Il valore resta salvato in questo browser.
 */

import '../stili/suoni.css';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { Palette } from '../ui/comuni';
import { ConPopover } from '../ui/ConPopover';
import { Icona } from '../ui/icone';
import { variabili } from '../ui/utili';
import { suona } from './audio';
import { useVolume, volume } from './livello';

/** La moneta di prova non riparte prima di così, mentre si trascina il cursore. */
const PROVA_MS = 180;

export function Volume({
  misura = 'normale',
  lato = 'destra',
  className,
}: {
  misura?: 'normale' | 'piccolo';
  lato?: 'sinistra' | 'destra';
  /** Classi in più per il pulsante (es. quello della home). */
  className?: string;
}): ReactNode {
  const v = useVolume();
  const [aperto, setAperto] = useState(false);
  const chiudi = useCallback(() => setAperto(false), []);
  const ultimaProva = useRef(0);
  const prova = () => {
    const ora = performance.now();
    if (ora - ultimaProva.current < PROVA_MS) return;
    ultimaProva.current = ora;
    suona('incasso');
  };
  const muto = v === 0;
  const stato = muto ? 'Suoni spenti' : `Volume ${v}%`;
  const classi = ['pulsante-icona', misura === 'piccolo' ? 'pulsante-icona--piccolo' : '', className ?? '']
    .filter(Boolean)
    .join(' ');
  return (
    <ConPopover
      aperto={aperto}
      onChiudi={chiudi}
      lato={lato}
      className="volume"
      pulsante={
        <button
          type="button"
          className={classi}
          aria-label={`Suoni: ${stato.toLowerCase()}`}
          title={stato}
          aria-expanded={aperto}
          onClick={() => setAperto((a) => !a)}
        >
          <Icona nome={muto ? 'muto' : 'volume'} />
        </button>
      }
    >
      <div className="volume__pannello">
        <p className="volume__testa">
          <span className="volume__titolo">Suoni</span>
          {muto ? <span className="volume__spenti">Spenti</span> : <Palette testo={String(v)} unita="%" misura="s" />}
        </p>
        <div className="volume__riga">
          <button
            type="button"
            className="pulsante-icona pulsante-icona--piccolo volume__muto"
            aria-label={muto ? 'Riaccendi i suoni' : 'Spegni i suoni'}
            title={muto ? 'Riaccendi i suoni' : 'Spegni i suoni'}
            aria-pressed={muto}
            onClick={() => {
              volume.alterna();
              if (muto) prova();
            }}
          >
            <Icona nome={muto ? 'muto' : 'volume'} />
          </button>
          <input
            type="range"
            className="volume__cursore"
            min={0}
            max={100}
            step={5}
            value={v}
            aria-label="Volume dei suoni"
            aria-valuetext={stato}
            style={variabili({ '--quota': `${v}%` })}
            onChange={(e) => {
              volume.imposta(Number(e.target.value));
              prova();
            }}
          />
        </div>
      </div>
    </ConPopover>
  );
}
