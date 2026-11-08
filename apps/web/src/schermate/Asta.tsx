/*
 * L'asta, sopra il tabellone e uguale per tutti: offerta attuale, conto alla rovescia che riparte
 * a ogni offerta, i tre rilanci e l'elenco delle offerte; a destra la scheda della proprietà.
 * Non si chiude: finisce da sola quando il server la chiude.
 */

import '../stili/economia.css';
import type { ReactNode } from 'react';
import { ASTA_MS, euro, RILANCI, tabellone, verifica, type IdGiocatore, type Stato } from '@poordown/engine';
import { collegamento } from '../rete/sessione';
import { useBattito } from '../ui/battito';
import { caselleVista } from '../ui/caselle';
import { Pedina, Soldi, Stemma } from '../ui/comuni';
import { Icona } from '../ui/icone';
import { iniziale, variabili } from '../ui/utili';
import { RiquadroTabellone } from './Colonne';
import { SchedaProprieta } from './Tabellone';

export function Asta({
  partita,
  io,
  inviando,
  onOffri,
}: {
  /** La partita aggiornata (non quella che aspetta le animazioni): all'asta conta ogni secondo. */
  partita: Stato;
  io: IdGiocatore | null;
  inviando: boolean;
  onOffri: (importo: number) => void;
}): ReactNode {
  useBattito(200);
  const asta = partita.asta;
  if (!asta) return null;
  const tab = tabellone(partita.mappa);
  const c = caselleVista(partita.mappa)[asta.casella];
  const nome = (id: IdGiocatore) => partita.giocatori.find((g) => g.id === id);
  const migliore = asta.migliore;
  const offerente = migliore ? nome(migliore.giocatore) : undefined;
  const me = partita.giocatori.find((g) => g.id === io && !g.eliminato);
  const attuale = migliore?.importo ?? 0;
  const rilancio = migliore ? attuale - (asta.offerte[1]?.importo ?? 0) : 0;

  const restanti = Math.max(0, asta.scadenza - collegamento.orologio());
  const secondi = Math.ceil(restanti / 1000);
  const quota = Math.min(1, restanti / ASTA_MS);

  return (
    <RiquadroTabellone titolo="Asta" className="asta">
      <p className="asta__proprieta">
        {c?.gruppo !== undefined ? (
          <Stemma gruppo={c.gruppo} nome={tab.regioni[c.gruppo - 1]?.nome ?? ''} className="asta__stemma" />
        ) : (
          c?.icona && <Icona nome={c.icona} className="asta__icona" />
        )}
        {c?.nome}
      </p>
      <div className="asta__corpo">
        <div className="asta__sinistra">
          <p className="asta__etichetta">Offerta attuale</p>
          <div className="asta__attuale">
            {offerente ? (
              <Pedina colore={offerente.colore} iniziale={iniziale(offerente.nome)} className="pedina--grande" />
            ) : (
              <span className="asta__nessuno" aria-hidden="true" />
            )}
            <span className="asta__cifra">
              {migliore ? <Soldi valore={attuale} /> : <span className="asta__vuota">Nessuna offerta</span>}
              {rilancio > 0 && (
                <span key={asta.offerte.length} className="asta__bolla" aria-hidden="true">
                  +{euro(rilancio)}
                </span>
              )}
            </span>
          </div>

          <div className="asta__tempo">
            <p className={secondi <= 3 ? 'asta__scadenza asta__scadenza--poco' : 'asta__scadenza'} aria-live="off">
              {migliore ? `Aggiudicata tra ${secondi}…` : `Finisce tra ${secondi}…`}
              <Icona nome="martelletto" />
            </p>
            <div className="asta__barra" role="presentation">
              <span style={variabili({ '--quota': String(quota) })} />
            </div>
          </div>

          {me ? (
            <>
              <p className="asta__etichetta">Offro…</p>
              <div className="asta__rilanci">
                {RILANCI.map((r) => {
                  const importo = attuale + r;
                  const blocco = inviando
                    ? 'Un attimo…'
                    : (verifica(partita, { tipo: 'offri', giocatore: me.id, importo })?.messaggio ?? null);
                  return (
                    <span key={r} className="con-suggerimento" data-testo={blocco ?? undefined}>
                      <button
                        type="button"
                        className="pulsante pulsante--primario asta__rilancio"
                        disabled={blocco !== null}
                        onClick={() => onOffri(importo)}
                      >
                        <strong>{euro(importo)}</strong>
                        <small>+{euro(r)}</small>
                      </button>
                    </span>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="asta__guardi">
              <Icona nome="occhio" />
              Stai guardando l’asta.
            </p>
          )}

          <ol className="asta__elenco" aria-label="Offerte">
            {asta.offerte.map((o, i) => {
              const chi = nome(o.giocatore);
              return (
                <li key={asta.offerte.length - i} className="asta__offerta">
                  {chi && <Pedina colore={chi.colore} className="pedina--mini" />}
                  <b>{chi?.nome ?? '?'}</b> offre {euro(o.importo)}
                </li>
              );
            })}
          </ol>
        </div>
        <SchedaProprieta mappa={partita.mappa} partita={partita} n={asta.casella} className="scheda--asta" />
      </div>
    </RiquadroTabellone>
  );
}
