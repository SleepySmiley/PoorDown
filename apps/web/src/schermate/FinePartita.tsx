/*
 * Fine della partita, come in richup (docs/analisi/04-economia-fine-partita.md §10):
 * - sopra il tabellone «Partita finita!» con il vincitore, «Un'altra partita» e «Torna alla home»;
 * - nella colonna destra la classifica per turni sopravvissuti e «Vedi tutte le statistiche»;
 * - la finestra con tutte le statistiche e il grafico del patrimonio.
 */

import '../stili/fine.css';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  classifica,
  durata,
  piuVolteInPrigione,
  proprietaPiuVisitata,
  tabellone,
  type IdGiocatore,
  type Stato,
  type VistaStanza,
} from '@poordown/engine';
import { collegamento } from '../rete/sessione';
import { avvisa } from '../ui/avvisi';
import { caselleVista } from '../ui/caselle';
import { Dado, Pedina, Stemma } from '../ui/comuni';
import { Icona, type NomeIcona } from '../ui/icone';
import { iniziale, variabili } from '../ui/utili';
import { Binario } from './Colonne';
import { GraficoPatrimonio } from './Grafico';
import { durataInParole, volte } from './testi';

/* ---------------- Sopra il tabellone ---------------- */

/** A squadre: la squadra vincitrice, con nome e giocatori; altrimenti `null`. */
function squadraVincitrice(partita: Stato): { indice: number; nome: string; membri: Stato['giocatori'] } | null {
  const indice = partita.squadraVincitrice;
  if (indice === null) return null;
  return {
    indice,
    nome: partita.squadre[indice] ?? `Squadra ${indice + 1}`,
    membri: partita.giocatori.filter((g) => g.squadra === indice),
  };
}

/** Chi può riportare la stanza in lobby: l'host, o chiunque sia seduto se l'host non è collegato. */
function puoRicominciare(stanza: VistaStanza, io: IdGiocatore | null): boolean {
  if (!io || !stanza.partecipanti.some((p) => p.id === io)) return false;
  if (stanza.host === io) return true;
  return !stanza.partecipanti.some((p) => p.id === stanza.host && p.connesso);
}

export function FinePartita({
  partita,
  stanza,
  io,
  onEsci,
}: {
  partita: Stato;
  stanza: VistaStanza;
  io: IdGiocatore | null;
  onEsci: () => void;
}): ReactNode {
  const [attesa, setAttesa] = useState(false);
  const [inviando, setInviando] = useState(false);
  const vincitore = partita.giocatori.find((g) => g.id === partita.vincitore);
  const squadra = squadraVincitrice(partita);
  const seduto = io !== null && stanza.partecipanti.some((p) => p.id === io);
  const comando = puoRicominciare(stanza, io);

  const ancora = () => {
    if (!comando) {
      setAttesa(true);
      return;
    }
    setInviando(true);
    void collegamento.comando('nuova_partita', {}).then((r) => {
      setInviando(false);
      if (!r.ok) avvisa(r.messaggio, 'errore');
    });
  };

  return (
    <section className="fine-partita" aria-labelledby="titolo-fine">
      <div className="fine-partita__contenuto">
        <div className="fine-partita__dadi" aria-hidden="true">
          <Dado valore={6} />
          <Dado valore={3} />
        </div>
        <h2 id="titolo-fine" className="fine-partita__titolo">
          Partita finita!
        </h2>
        {squadra ? (
          <>
            <p className="fine-partita__annuncio">e la squadra vincitrice è…</p>
            <p className="fine-partita__vincitore">
              <Binario indice={squadra.indice} nome={squadra.nome} className="binario--vincitore" />
              <span>{squadra.nome}</span>
            </p>
            <p className="fine-partita__squadra">
              {squadra.membri.map((g) => (
                <span key={g.id} className="fine-partita__compagno">
                  <Pedina colore={g.colore} iniziale={iniziale(g.nome)} className="pedina--mini" />
                  {g.nome}
                </span>
              ))}
            </p>
          </>
        ) : vincitore ? (
          <>
            <p className="fine-partita__annuncio">e il vincitore è…</p>
            <p className="fine-partita__vincitore">
              <Pedina colore={vincitore.colore} iniziale={iniziale(vincitore.nome)} className="pedina--vincitore" />
              <span>{vincitore.nome}</span>
            </p>
          </>
        ) : (
          <p className="fine-partita__annuncio">Nessun vincitore.</p>
        )}
        <div className="fine-partita__azioni">
          {seduto && (
            <button
              type="button"
              className="pulsante pulsante--primario"
              disabled={inviando || (attesa && !comando)}
              onClick={ancora}
            >
              <Icona nome="aggiorna" />
              {attesa && !comando ? 'In attesa dell’host…' : 'Un’altra partita'}
            </button>
          )}
          <button type="button" className="pulsante pulsante--secondario" onClick={onEsci}>
            <Icona nome="partenza" />
            Torna alla home
          </button>
        </div>
        {attesa && !comando && (
          <p className="fine-partita__nota" role="status">
            Quando l’host prepara un’altra partita, torni in lobby con lo stesso colore.
          </p>
        )}
      </div>
    </section>
  );
}

/* ---------------- Colonna destra ---------------- */

export function PannelloStatistiche({ partita, onApri }: { partita: Stato; onApri: () => void }): ReactNode {
  const totale = Math.max(1, partita.turno.numero);
  return (
    <section className="pannello statistiche-fine" aria-labelledby="titolo-statistiche">
      <header className="pannello__testa pannello__testa--centrata">
        <h2 id="titolo-statistiche" className="pannello__titolo">
          Statistiche della partita
        </h2>
      </header>
      <div className="statistiche-fine__corpo">
        <table className="classifica">
          <caption>Classifica</caption>
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Giocatore</th>
              <th scope="col">Turni sopravvissuti</th>
            </tr>
          </thead>
          <tbody>
            {classifica(partita).map((p, i) => {
              const g = partita.giocatori.find((x) => x.id === p.giocatore)!;
              return (
                <tr key={p.giocatore}>
                  <td className="classifica__posto">{i + 1}</td>
                  <th scope="row" className="classifica__nome">
                    {g.squadra !== null && (
                      <Binario indice={g.squadra} nome={partita.squadre[g.squadra] ?? ''} className="binario--riga" />
                    )}
                    <Pedina colore={g.colore} className="pedina--mini" />
                    <span>{g.nome}</span>
                  </th>
                  <td>
                    <span
                      className="classifica__barra"
                      style={variabili({
                        '--colore': `var(--p${g.colore})`,
                        '--quota': `${p.vincitore ? 100 : Math.max(16, (p.turni / totale) * 100)}%`,
                      })}
                    >
                      {p.vincitore ? 'vincitore' : p.turni}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <button type="button" className="pulsante pulsante--primario pulsante--largo" onClick={onApri}>
          <Icona nome="grafico" />
          Vedi tutte le statistiche
        </button>
      </div>
    </section>
  );
}

/* ---------------- Tutte le statistiche ---------------- */

function Numero({ icona, etichetta, children }: { icona: NomeIcona; etichetta: string; children: ReactNode }): ReactNode {
  return (
    <div className="numero">
      <Icona nome={icona} className="numero__icona" />
      <dt>{etichetta}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function StatisticheComplete({ partita, onChiudi }: { partita: Stato; onChiudi: () => void }): ReactNode {
  const riquadro = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onChiudi();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onChiudi]);
  useEffect(() => {
    const prima = document.activeElement as HTMLElement | null;
    riquadro.current?.focus();
    return () => prima?.focus();
  }, []);

  const st = partita.statistiche;
  const tab = tabellone(partita.mappa);
  const vincitore = partita.giocatori.find((g) => g.id === partita.vincitore);
  const squadra = squadraVincitrice(partita);
  const ms = durata(partita);
  const visitata = proprietaPiuVisitata(partita);
  const casella = visitata ? caselleVista(partita.mappa)[visitata.casella] : undefined;
  const prigione = piuVolteInPrigione(partita);
  const carcerati = prigione ? partita.giocatori.filter((g) => prigione.giocatori.includes(g.id)) : [];

  return (
    <div className="statistiche" role="presentation" onClick={onChiudi}>
      <div
        ref={riquadro}
        tabIndex={-1}
        className="statistiche__griglia"
        role="dialog"
        aria-modal="true"
        aria-label="Statistiche della partita"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="pulsante pulsante--primario statistiche__chiudi" onClick={onChiudi}>
          <Icona nome="chiudi" />
          Torna al tabellone
        </button>

        <section className="scheda-stat scheda-stat--vincitore">
          <Icona nome="coppa" className="scheda-stat__coppa" />
          <div>
            <h3 className="scheda-stat__etichetta">{squadra ? 'Squadra vincitrice' : 'Vincitore'}</h3>
            {squadra ? (
              <p className="scheda-stat__chi scheda-stat__chi--grande">
                <Binario indice={squadra.indice} nome={squadra.nome} />
                {squadra.nome}
              </p>
            ) : vincitore ? (
              <p className="scheda-stat__chi scheda-stat__chi--grande">
                <Pedina colore={vincitore.colore} iniziale={iniziale(vincitore.nome)} />
                {vincitore.nome}
              </p>
            ) : (
              <p className="scheda-stat__chi">Nessuno</p>
            )}
          </div>
        </section>

        <section className="scheda-stat scheda-stat--numeri" aria-label="Numeri della partita">
          <dl className="numeri">
            <Numero icona="orologio" etichetta="Durata">
              {ms === null ? '—' : durataInParole(ms)}
            </Numero>
            <Numero icona="aggiorna" etichetta="Turni">
              {partita.turno.numero}
            </Numero>
            <Numero icona="dado" etichetta="Doppi">
              {st.doppi}
            </Numero>
            <Numero icona="scambio" etichetta="Scambi">
              {st.scambi}
            </Numero>
            <Numero icona="chat" etichetta="Messaggi in chat">
              {st.messaggi}
            </Numero>
          </dl>
        </section>

        <section className="scheda-stat scheda-stat--grafico" aria-labelledby="titolo-grafico">
          <h3 id="titolo-grafico" className="scheda-stat__titolo">
            Patrimonio nel tempo
          </h3>
          <GraficoPatrimonio partita={partita} />
        </section>

        <section className="scheda-stat scheda-stat--riga scheda-stat--visitata">
          <Icona nome="segnaposto" className="scheda-stat__icona" />
          <div>
            <h3 className="scheda-stat__etichetta">Proprietà più visitata</h3>
            {visitata && casella ? (
              <p className="scheda-stat__chi">
                {casella.gruppo ? (
                  <Stemma regione={tab.regioni[casella.gruppo - 1]} className="stemma--lista" />
                ) : (
                  casella.icona && <Icona nome={casella.icona} className="scheda-stat__piccola" />
                )}
                {casella.nome}
                <small>({volte(visitata.visite)})</small>
              </p>
            ) : (
              <p className="scheda-stat__chi">Nessuna</p>
            )}
          </div>
        </section>

        <section className="scheda-stat scheda-stat--riga scheda-stat--prigione">
          <Icona nome="prigione" className="scheda-stat__icona" />
          <div>
            <h3 className="scheda-stat__etichetta">Più volte in prigione</h3>
            {prigione ? (
              <p className="scheda-stat__chi">
                {carcerati.map((g, i) => (
                  <span key={g.id} className="scheda-stat__persona">
                    <Pedina colore={g.colore} className="pedina--mini" />
                    {g.nome}
                    {i < carcerati.length - 1 ? ',' : ''}
                  </span>
                ))}
                <small>({volte(prigione.volte)})</small>
              </p>
            ) : (
              <p className="scheda-stat__chi">Nessuno</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
