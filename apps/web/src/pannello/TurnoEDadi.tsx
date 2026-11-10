/* Il turno in corso, il passaggio del turno a chi si vuole e il prossimo tiro dei dadi deciso in anticipo. */

import { useState, type ReactNode } from 'react';
import { euro, tabellone, type DettaglioPannello, type Stato } from '@poordown/engine';
import { Pulsante } from '../ui/Pulsante';
import { Dado, Pedina } from '../ui/comuni';
import type { Esegui } from './Plancia';

const FASI = {
  lancio: 'Deve tirare i dadi',
  prigione: 'È in prigione: tira, paga la cauzione o usa la Grazia',
  dopo_lancio: 'Ha tirato: può comprare, costruire o finire il turno',
} as const;

const FACCE = [1, 2, 3, 4, 5, 6] as const;

export function TurnoEDadi({ d, partita, esegui }: { d: DettaglioPannello; partita: Stato; esegui: Esegui }): ReactNode {
  const tab = tabellone(partita.mappa);
  const t = partita.turno;
  const diTurno = partita.giocatori.find((g) => g.id === t.giocatore);
  const inGioco = partita.giocatori.filter((g) => !g.eliminato);
  const inCorso = partita.fase === 'in_corso' && d.fase === 'partita';
  const [aChi, setAChi] = useState('');
  const [dadi, setDadi] = useState<[number, number]>(d.dadi?.dadi ?? [3, 4]);
  const [perChi, setPerChi] = useState('');
  const nome = (id: string | null) => (id === null ? 'chiunque' : (partita.giocatori.find((g) => g.id === id)?.nome ?? '?'));
  const destinatario = aChi || (inGioco.find((g) => g.id !== t.giocatore)?.id ?? '');
  const migliore = partita.asta?.migliore;

  return (
    <div className="pc-griglia">
      <section className="pc-riquadro">
        <h3 className="pc-riquadro__titolo">Adesso</h3>
        {diTurno && (
          <div className="pc-turno">
            <Pedina colore={diTurno.colore} className="pedina--grande" />
            <div>
              <p className="pc-turno__chi">
                Turno {t.numero} · {diTurno.nome}
              </p>
              <p className="pc-turno__fase">{inCorso ? FASI[t.fase] : 'La partita è finita'}</p>
              {t.dadi && (
                <p className="pc-turno__dadi">
                  <Dado valore={t.dadi[0]} doppio={t.dadi[0] === t.dadi[1]} />
                  <Dado valore={t.dadi[1]} doppio={t.dadi[0] === t.dadi[1]} />
                  {t.doppi > 0 && <span className="pc-giocatore__nota">{t.doppi} doppi di fila</span>}
                </p>
              )}
              {t.acquisto !== null && <p className="pc-giocatore__nota">Può comprare {tab.caselle[t.acquisto]?.nome}</p>}
              {partita.asta && (
                <p className="pc-giocatore__nota">
                  Asta su {tab.caselle[partita.asta.casella]?.nome}
                  {migliore ? `: ${euro(migliore.importo)} da ${nome(migliore.giocatore)}` : ': nessuna offerta'}
                </p>
              )}
            </div>
          </div>
        )}
        <div className="pc-modulo">
          <label className="pc-modulo__campo">
            <span className="etichetta">Passa il turno a</span>
            <select className="campo pc-scelta" value={destinatario} disabled={!inCorso} onChange={(e) => setAChi(e.target.value)}>
              {inGioco.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nome}
                  {g.id === t.giocatore ? ' (rifà il turno)' : ''}
                </option>
              ))}
            </select>
          </label>
          <Pulsante
            variante="primario"
            disabled={!inCorso || !destinatario}
            onClick={() => void esegui({ tipo: 'turno', giocatore: destinatario }, `Ora tocca a ${nome(destinatario)}.`)}
          >
            Passa il turno
          </Pulsante>
        </div>
        <p className="pc-nota">Chi riceve il turno comincia da capo: tira i dadi (o sceglie come uscire di prigione).</p>
      </section>

      <section className="pc-riquadro">
        <h3 className="pc-riquadro__titolo">Prossimo tiro</h3>
        {d.dadi ? (
          <div className="pc-deciso">
            <span className="pc-turno__dadi">
              <Dado valore={d.dadi.dadi[0]} doppio={d.dadi.dadi[0] === d.dadi.dadi[1]} />
              <Dado valore={d.dadi.dadi[1]} doppio={d.dadi.dadi[0] === d.dadi.dadi[1]} />
            </span>
            <span>
              Deciso: <strong>{d.dadi.dadi[0] + d.dadi.dadi[1]}</strong> per il prossimo tiro di {nome(d.dadi.giocatore)}
            </span>
            <Pulsante
              variante="fantasma"
              misura="piccolo"
              onClick={() => void esegui({ tipo: 'dadi', dadi: null, giocatore: null }, 'I dadi tornano liberi.')}
            >
              Togli
            </Pulsante>
          </div>
        ) : (
          <p className="pc-nota">I dadi sono liberi.</p>
        )}
        {[0, 1].map((quale) => (
          <div key={quale} className="pc-facce" role="group" aria-label={quale === 0 ? 'Primo dado' : 'Secondo dado'}>
            {FACCE.map((f) => (
              <button
                key={f}
                type="button"
                className="pc-faccia"
                aria-pressed={dadi[quale] === f}
                aria-label={String(f)}
                disabled={!inCorso}
                onClick={() => setDadi((prima) => (quale === 0 ? [f, prima[1]] : [prima[0], f]))}
              >
                <Dado valore={f} />
              </button>
            ))}
          </div>
        ))}
        <div className="pc-modulo">
          <label className="pc-modulo__campo">
            <span className="etichetta">Vale per</span>
            <select className="campo pc-scelta" value={perChi} disabled={!inCorso} onChange={(e) => setPerChi(e.target.value)}>
              <option value="">Il prossimo tiro di chiunque</option>
              {inGioco.map((g) => (
                <option key={g.id} value={g.id}>
                  Il prossimo tiro di {g.nome}
                </option>
              ))}
            </select>
          </label>
          <Pulsante
            variante="primario"
            disabled={!inCorso}
            onClick={() =>
              void esegui(
                { tipo: 'dadi', dadi, giocatore: perChi || null },
                `Prossimo tiro di ${nome(perChi || null)}: ${dadi[0]} e ${dadi[1]}.`,
              )
            }
          >
            Decidi il tiro ({dadi[0] + dadi[1]})
          </Pulsante>
        </div>
        <p className="pc-nota">
          Vale per un tiro solo, fatto da una persona o da un bot. I tiri che il gioco fa da solo (tempo scaduto) restano
          casuali.
        </p>
      </section>
    </div>
  );
}
