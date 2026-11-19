/*
 * Scelta del tabellone in lobby: i tabelloni con la miniatura, la descrizione, i numeri principali e le regioni.
 * L'host sceglie; gli altri guardano. Il tabellone scelto compare subito al centro della lobby,
 * dove si può aprire ogni casella.
 */

import '../stili/squadre.css';
import type { ReactNode } from 'react';
import { TABELLONI, type IdMappa, type Tabellone } from '@poordown/engine';
import { caselleVista } from '../ui/caselle';
import { Chip } from '../ui/Chip';
import { geometria } from '../ui/geometria';
import { Finestra } from './Colonne';

/** La forma del tabellone: un quadratino per casella, colorato con la regione per le città. */
function Miniatura({ mappa }: { mappa: IdMappa }): ReactNode {
  const caselle = caselleVista(mappa);
  const geo = geometria(caselle.length);
  const lato = geo.lato + 1;
  const passo = 10;
  return (
    <svg className="miniatura" viewBox={`0 0 ${lato * passo} ${lato * passo}`} aria-hidden="true">
      {caselle.map((c) => {
        const { riga, colonna } = geo.posto(c.n);
        const colore =
          c.tipo === 'citta'
            ? `var(--g${c.tinta})`
            : c.tipo === 'angolo'
              ? 'var(--cartello)'
              : c.tipo === 'carta' || c.tipo === 'premio'
                ? 'var(--quadro-tenue)'
                : 'var(--quadro-anello)';
        return (
          <rect
            key={c.n}
            x={(colonna - 1) * passo + 0.8}
            y={(riga - 1) * passo + 0.8}
            width={passo - 1.6}
            height={passo - 1.6}
            rx={1.5}
            style={{ fill: colore }}
          />
        );
      })}
    </svg>
  );
}

function Numeri({ tab }: { tab: Tabellone }): ReactNode {
  const servizi = tab.caselle.filter((c) => c.tipo === 'servizio').length;
  const dati: [number, string, string][] = [
    [tab.caselle.length, 'casella', 'caselle'],
    [tab.regioni.length, 'regione', 'regioni'],
    [servizi, 'servizio', 'servizi'],
  ];
  return (
    <p className="tabelloni__numeri">
      {dati.map(([n, uno, tanti]) => (
        <span key={tanti}>
          <b>{n === 0 ? 'Nessun' : n}</b> {n === 1 || n === 0 ? uno : tanti}
        </span>
      ))}
    </p>
  );
}

export function SceltaTabellone({
  attuale,
  modificabile,
  onScegli,
  onChiudi,
}: {
  attuale: IdMappa;
  modificabile: boolean;
  onScegli: (mappa: IdMappa) => void;
  onChiudi: () => void;
}): ReactNode {
  return (
    <Finestra titolo="Tabelloni" icona="mappa" onChiudi={onChiudi} larga>
      <div className="finestra__scorri tabelloni">
        {!modificabile && (
          <p className="tabelloni__blocco">
            <Chip icona="lucchetto">Solo l’host può cambiare il tabellone</Chip>
          </p>
        )}
        <ul className="tabelloni__lista">
          {Object.values(TABELLONI).map((tab) => {
            const scelto = tab.id === attuale;
            return (
              <li key={tab.id} className={scelto ? 'tabelloni__voce tabelloni__voce--scelta' : 'tabelloni__voce'}>
                <span className="tabelloni__quadro">
                  <Miniatura mappa={tab.id} />
                </span>
                <div className="tabelloni__testo">
                  <h3 className="tabelloni__nome">
                    {tab.nome}
                    {scelto && (
                      <Chip tono="segnale" icona="spunta">
                        In uso
                      </Chip>
                    )}
                  </h3>
                  <p className="tabelloni__descrizione">{tab.descrizione}</p>
                  <Numeri tab={tab} />
                  <ul className="tabelloni__regioni" aria-label="Regioni">
                    {tab.regioni.map((r) => (
                      <li key={r.nome} title={r.nome} style={{ background: `var(--g${r.colore})` }}>
                        <span className="solo-lettori">{r.nome}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                {modificabile && !scelto && (
                  <button
                    type="button"
                    className="pulsante pulsante--piccolo pulsante--primario tabelloni__scegli"
                    onClick={() => onScegli(tab.id)}
                    aria-label={`Scegli ${tab.nome}`}
                  >
                    Scegli
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </Finestra>
  );
}
