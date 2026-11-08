/*
 * Scelta del tabellone in lobby, come la finestra "Board maps" di richup: i quattro tabelloni con una miniatura,
 * la descrizione e i numeri principali. L'host sceglie; gli altri guardano.
 * Il tabellone scelto compare subito al centro della lobby, dove si può aprire ogni casella.
 */

import '../stili/squadre.css';
import type { ReactNode } from 'react';
import { TABELLONI, type IdMappa, type Tabellone } from '@poordown/engine';
import { caselleVista } from '../ui/caselle';
import { geometria } from '../ui/geometria';
import { Icona } from '../ui/icone';
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
              ? 'var(--segnale)'
              : c.tipo === 'carta' || c.tipo === 'premio'
                ? 'var(--ambra)'
                : '#5a6273';
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

function numeri(tab: Tabellone): string {
  const conta = (tipo: string) => tab.caselle.filter((c) => c.tipo === tipo).length;
  const servizi = conta('servizio');
  return [
    `${tab.caselle.length} caselle`,
    `${tab.regioni.length} gruppi di città`,
    servizi === 0 ? 'nessun servizio' : servizi === 1 ? '1 servizio' : `${servizi} servizi`,
  ].join(' · ');
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
    <Finestra titolo="Tabelloni" onChiudi={onChiudi} larga>
      <div className="finestra__scorri tabelloni">
        {!modificabile && <p className="impostazioni__nota">Solo l’host della stanza può cambiare il tabellone.</p>}
        <ul className="tabelloni__lista">
          {Object.values(TABELLONI).map((tab) => {
            const scelto = tab.id === attuale;
            return (
              <li key={tab.id} className={scelto ? 'tabelloni__voce tabelloni__voce--scelta' : 'tabelloni__voce'}>
                <Miniatura mappa={tab.id} />
                <div className="tabelloni__testo">
                  <h3 className="tabelloni__nome">{tab.nome}</h3>
                  <p className="tabelloni__descrizione">{tab.descrizione}</p>
                  <p className="tabelloni__numeri">{numeri(tab)}</p>
                  <p className="tabelloni__regioni">{tab.regioni.map((r) => r.nome).join(', ')}</p>
                </div>
                <div className="tabelloni__azione">
                  {scelto ? (
                    <span className="distintivo tabelloni__in-uso">
                      <Icona nome="spunta" />
                      In uso
                    </span>
                  ) : (
                    modificabile && (
                      <button type="button" className="pulsante pulsante--piccolo pulsante--primario" onClick={() => onScegli(tab.id)}>
                        Scegli
                      </button>
                    )
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </Finestra>
  );
}
