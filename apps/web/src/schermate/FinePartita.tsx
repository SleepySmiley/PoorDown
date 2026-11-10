/*
 * Fine della partita come un tabellone degli arrivi:
 * - un velo su tutta la pagina con «Partita finita!», la classifica a palette (le righe arrivano dall'ultimo
 *   al primo, il vincitore per ultimo con la corona), «Un'altra partita», «Torna alla home», le statistiche;
 *   «Guarda il tabellone» chiude il velo e sul tabellone resta una striscia per riaprirlo;
 * - nella colonna destra la classifica in breve, con «Rivedi gli arrivi» e «Tutte le statistiche»;
 * - la finestra con tutte le statistiche, a celle come un tabellone, e il grafico del patrimonio.
 * Il velo è disegnato in document.body (portale): il tabellone ha il suo contenitore e non lo lascerebbe uscire.
 */

import '../stili/fine.css';
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useIsPresent } from 'motion/react';
import {
  classifica,
  durata,
  euro,
  finitaPerDurata,
  patrimonio,
  piuVolteInPrigione,
  proprietaPiuVisitata,
  tabellone,
  type Giocatore,
  type IdGiocatore,
  type Stato,
  type VistaStanza,
} from '@poordown/engine';
import { collegamento } from '../rete/sessione';
import { avvisa } from '../ui/avvisi';
import { caselleVista } from '../ui/caselle';
import { Chip } from '../ui/Chip';
import { Palette, Pedina, Soldi, Stemma } from '../ui/comuni';
import { Icona } from '../ui/icone';
import { Pittogramma } from '../ui/Marchio';
import { COMPARSA, CURVA, DURATA, VELO } from '../ui/movimento';
import { iniziale } from '../ui/utili';
import { Binario } from './Colonne';
import { GraficoPatrimonio } from './Grafico';
import { durataInParole, ESITO_USCITA, volte } from './testi';

/* ---------------- Dati comuni ---------------- */

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

/** 5_000 → "0:05"; 2_896_000 → "48:16"; 3_725_000 → "1:02:05". Per le cifre a palette. */
function orologio(ms: number): string {
  const totale = Math.round(ms / 1000);
  const ore = Math.floor(totale / 3600);
  const minuti = Math.floor((totale % 3600) / 60);
  const secondi = String(totale % 60).padStart(2, '0');
  return ore > 0 ? `${ore}:${String(minuti).padStart(2, '0')}:${secondi}` : `${minuti}:${secondi}`;
}

function pocoMovimento(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

interface Arrivo {
  g: Giocatore;
  posto: number;
  vincitore: boolean;
  turni: number;
  /** `null` per chi è uscito. */
  valore: number | null;
  esito: string | null;
}

function arrivi(partita: Stato): Arrivo[] {
  return classifica(partita).map((p, i) => {
    const g = partita.giocatori.find((x) => x.id === p.giocatore)!;
    return {
      g,
      posto: i + 1,
      vincitore: p.vincitore,
      turni: p.turni,
      valore: g.eliminato ? null : patrimonio(partita, g.id),
      esito: g.eliminato ? ESITO_USCITA[g.eliminato.motivo] : null,
    };
  });
}

interface GruppoArrivi {
  /** A squadre: la squadra del gruppo; senza squadre `null` (un gruppo per giocatore). */
  /** `valore`: il patrimonio dei giocatori ancora in gioco; `null` se sono usciti tutti. */
  squadra: { indice: number; nome: string; posto: number; vince: boolean; valore: number | null } | null;
  righe: Arrivo[];
}

/** Senza squadre ogni giocatore è un gruppo; a squadre i giocatori stanno con la loro squadra, nell'ordine della classifica. */
function gruppi(partita: Stato, righe: Arrivo[]): GruppoArrivi[] {
  if (partita.squadre.length === 0 || righe.every((r) => r.g.squadra === null)) {
    return righe.map((r) => ({ squadra: null, righe: [r] }));
  }
  const ordine: number[] = [];
  for (const r of righe) if (r.g.squadra !== null && !ordine.includes(r.g.squadra)) ordine.push(r.g.squadra);
  return ordine.map((t, i) => {
    const membri = righe.filter((r) => r.g.squadra === t);
    return {
      squadra: {
        indice: t,
        nome: partita.squadre[t] ?? `Squadra ${t + 1}`,
        posto: i + 1,
        vince: partita.squadraVincitrice === t,
        valore: membri.every((r) => r.valore === null) ? null : membri.reduce((somma, r) => somma + (r.valore ?? 0), 0),
      },
      righe: membri,
    };
  });
}

/* ---------------- Il velo: aperto o chiuso, per questa partita ---------------- */

/**
 * «Guarda il tabellone» chiude il velo, «Rivedi gli arrivi» lo riapre: lo stato è condiviso tra il velo
 * e la classifica della colonna destra. Vale per la partita (il suo inizio), così la prossima riparte aperta.
 * `rivelata`: la classifica è già arrivata tutta una volta, riaprendo non si rifà l'animazione.
 */
const velo = { chiuso: null as number | null, rivelata: null as number | null, ascoltatori: new Set<() => void>() };

function cambiaVelo(chiuso: number | null): void {
  velo.chiuso = chiuso;
  // Chi chiude il velo ha già visto gli arrivi (anche se non erano finiti): riaprendo sono già tutti lì.
  if (chiuso !== null) velo.rivelata = chiuso;
  for (const fn of velo.ascoltatori) fn();
}

function useVeloAperto(inizio: number): boolean {
  const chiuso = useSyncExternalStore(
    (fn) => {
      velo.ascoltatori.add(fn);
      return () => velo.ascoltatori.delete(fn);
    },
    () => velo.chiuso,
  );
  return chiuso !== inizio;
}

/* ---------------- Il tabellone degli arrivi ---------------- */

function RigaArrivo({ r, io, squadre }: { r: Arrivo; io: IdGiocatore | null; squadre: boolean }): ReactNode {
  const classi = ['arrivo', r.vincitore ? 'arrivo--vincitore' : '', r.esito ? 'arrivo--fuori' : ''].filter(Boolean).join(' ');
  return (
    <div className={classi}>
      <span className="arrivo__posto">{squadre ? '' : r.posto}</span>
      <span className="arrivo__chi">
        <Pedina colore={r.g.colore} iniziale={iniziale(r.g.nome)} className="pedina--media" />
        <span className="arrivo__nome">{r.g.nome}</span>
        {r.vincitore && !squadre && <Icona nome="corona" className="arrivo__corona" titolo="Vincitore" />}
        {r.g.id === io && <Chip>Tu</Chip>}
      </span>
      <span className="arrivo__turni">{r.turni}</span>
      <span className="arrivo__valore">
        {r.valore === null ? (
          <span className="arrivo__esito">{r.esito}</span>
        ) : (
          <Soldi valore={r.valore} misura={r.vincitore && !squadre ? 'l' : 'm'} />
        )}
      </span>
    </div>
  );
}

function TestaSquadra({ s }: { s: NonNullable<GruppoArrivi['squadra']> }): ReactNode {
  return (
    <div className={s.vince ? 'arrivo arrivo--squadra arrivo--vincitore' : 'arrivo arrivo--squadra'}>
      <span className="arrivo__posto">{s.posto}</span>
      <span className="arrivo__chi">
        <Binario indice={s.indice} nome={s.nome} />
        <span className="arrivo__nome">{s.nome}</span>
        {s.vince && <Icona nome="corona" className="arrivo__corona" titolo="Squadra vincitrice" />}
      </span>
      <span className="arrivo__turni" />
      <span className="arrivo__valore">
        {s.valore === null ? (
          <span className="arrivo__esito">Fuori</span>
        ) : (
          <Soldi valore={s.valore} misura={s.vince ? 'l' : 'm'} />
        )}
      </span>
    </div>
  );
}

const ENTRA_RIGA = {
  initial: { opacity: 0, rotateX: -70, y: -8 },
  animate: { opacity: 1, rotateX: 0, y: 0, transition: { duration: DURATA.lenta, ease: CURVA.arrivo } },
} as const;

function Arrivi({
  partita,
  stanza,
  io,
  onEsci,
  onStatistiche,
}: {
  partita: Stato;
  stanza: VistaStanza;
  io: IdGiocatore | null;
  onEsci: () => void;
  onStatistiche: () => void;
}): ReactNode {
  const inizio = partita.statistiche.inizio;
  const righe = arrivi(partita);
  const elenco = gruppi(partita, righe);
  const aSquadre = elenco.some((x) => x.squadra !== null);
  const n = elenco.length;
  const vincitore = partita.giocatori.find((g) => g.id === partita.vincitore);
  const squadra = squadraVincitrice(partita);
  const ms = durata(partita);
  const seduto = io !== null && stanza.partecipanti.some((p) => p.id === io);
  const comando = puoRicominciare(stanza, io);
  const [attesa, setAttesa] = useState(false);
  const [inviando, setInviando] = useState(false);

  // Le righe arrivano dall'ultima alla prima: `arrivate` conta quante sono già sul tabellone.
  const [arrivate, setArrivate] = useState(() => (velo.rivelata === inizio || pocoMovimento() ? n : 0));
  useEffect(() => {
    if (arrivate >= n) {
      velo.rivelata = inizio;
      return;
    }
    const passo = Math.min(650, Math.max(380, 2600 / n));
    const t = setTimeout(() => setArrivate((x) => x + 1), arrivate === 0 ? 650 : passo);
    return () => clearTimeout(t);
  }, [arrivate, n, inizio]);
  const finito = arrivate >= n;

  const riquadro = useRef<HTMLDivElement>(null);
  useEffect(() => {
    riquadro.current?.focus({ preventScroll: true });
  }, []);

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
    <motion.div
      ref={riquadro}
      tabIndex={-1}
      className="arrivi pannello--scuro"
      role="dialog"
      aria-labelledby="titolo-fine"
      onClick={(e) => e.stopPropagation()}
      {...COMPARSA}
    >
      <header className="arrivi__testa">
        <span className="arrivi__insegna">
          <Pittogramma misura="1.75rem" />
          Arrivi
        </span>
        <span className="arrivi__dati">
          <span>
            Stanza <Palette testo={stanza.codice.toUpperCase()} misura="s" />
          </span>
          <span>{tabellone(partita.mappa).nome}</span>
          <span>{partita.turno.numero} turni</span>
        </span>
        {ms !== null && (
          <span className="arrivi__durata" title={durataInParole(ms)}>
            <span className="arrivi__etichetta">Durata</span>
            <Palette testo={orologio(ms)} misura="m" />
          </span>
        )}
      </header>

      <div className="arrivi__annuncio">
        <h2 id="titolo-fine" className="arrivi__titolo">
          Partita finita!
        </h2>
        <p className={finito ? 'arrivi__vince arrivi__vince--visibile' : 'arrivi__vince'} aria-live="polite">
          {finito &&
            (squadra ? (
              <>
                Vince la squadra
                <Binario indice={squadra.indice} nome={squadra.nome} />
                <b>{squadra.nome}</b>
                <Icona nome="corona" className="arrivi__corona" />
              </>
            ) : vincitore ? (
              <>
                Vince
                <Pedina colore={vincitore.colore} iniziale={iniziale(vincitore.nome)} className="pedina--media" />
                <b>{vincitore.nome}</b>
                <Icona nome="corona" className="arrivi__corona" />
              </>
            ) : (
              'Nessun vincitore'
            ))}
        </p>
        {finitaPerDurata(partita) && (
          <p className="arrivi__motivo">
            <Icona nome="coppa" />
            È arrivata la durata massima: vince il patrimonio più alto.
          </p>
        )}
      </div>

      <div className="arrivi__colonne" aria-hidden="true">
        <span>Pos.</span>
        <span>{aSquadre ? 'Squadra e giocatori' : 'Giocatore'}</span>
        <span>Turni</span>
        <span>Patrimonio</span>
      </div>
      <ol className="arrivi__righe" aria-label="Classifica">
        {elenco.map((x, i) => {
          // L'ultimo arriva per primo, il primo per ultimo.
          const arrivato = n - i <= arrivate;
          const chiave = x.squadra ? `s${x.squadra.indice}` : x.righe[0]!.g.id;
          return (
            <li key={chiave} className={x.squadra ? 'arrivi__gruppo arrivi__gruppo--squadra' : 'arrivi__gruppo'}>
              {arrivato ? (
                <motion.div className="arrivi__blocco" {...ENTRA_RIGA} style={{ transformPerspective: 700 }}>
                  {x.squadra && <TestaSquadra s={x.squadra} />}
                  {x.righe.map((r) => (
                    <RigaArrivo key={r.g.id} r={r} io={io} squadre={x.squadra !== null} />
                  ))}
                </motion.div>
              ) : (
                <div className="arrivi__blocco arrivi__blocco--attesa" aria-hidden="true">
                  {x.squadra && <div className="arrivo arrivo--vuoto" />}
                  {x.righe.map((r) => (
                    <div key={r.g.id} className="arrivo arrivo--vuoto" />
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <footer className="arrivi__azioni">
        {seduto && (
          <button type="button" className="pulsante pulsante--primario" disabled={inviando || (attesa && !comando)} onClick={ancora}>
            <Icona nome="aggiorna" />
            {attesa && !comando ? 'In attesa dell’host…' : 'Un’altra partita'}
          </button>
        )}
        <button type="button" className="pulsante pulsante--secondario" onClick={onEsci}>
          <Icona nome="partenza" />
          Torna alla home
        </button>
        <span className="arrivi__spazio" />
        <button type="button" className="pulsante pulsante--sul-quadro" onClick={onStatistiche}>
          <Icona nome="grafico" />
          Statistiche
        </button>
        <button type="button" className="pulsante pulsante--fantasma arrivi__guarda" onClick={() => cambiaVelo(inizio)}>
          <Icona nome="occhio" />
          Guarda il tabellone
        </button>
      </footer>
      {attesa && !comando && (
        <p className="arrivi__nota" role="status">
          Quando l’host prepara un’altra partita, torni in lobby con lo stesso colore.
        </p>
      )}
    </motion.div>
  );
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
  const inizio = partita.statistiche.inizio;
  const aperto = useVeloAperto(inizio);
  const [statistiche, setStatistiche] = useState(false);
  const vincitore = partita.giocatori.find((g) => g.id === partita.vincitore);
  const squadra = squadraVincitrice(partita);

  // Esc chiude il velo (non mentre sono aperte le statistiche: chiude prima quelle).
  useEffect(() => {
    if (!aperto || statistiche) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && cambiaVelo(inizio);
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [aperto, statistiche, inizio]);

  return (
    <>
      {/* Con il velo chiuso, sul tabellone resta una striscia per riaprirlo. */}
      <AnimatePresence>
        {!aperto && (
          <motion.div key="striscia" className="fine-striscia" {...COMPARSA}>
            <span className="fine-striscia__titolo">Partita finita</span>
            <span className="fine-striscia__chi">
              {squadra ? (
                <>
                  Vince <Binario indice={squadra.indice} nome={squadra.nome} className="binario--riga" /> <b>{squadra.nome}</b>
                </>
              ) : vincitore ? (
                <>
                  Vince <Pedina colore={vincitore.colore} className="pedina--mini" /> <b>{vincitore.nome}</b>
                </>
              ) : (
                'Nessun vincitore'
              )}
            </span>
            <button type="button" className="pulsante pulsante--piccolo pulsante--secondario" onClick={() => cambiaVelo(null)}>
              <Icona nome="su" />
              Classifica
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      {createPortal(
        <>
          <AnimatePresence>
            {aperto && (
              <motion.section
                key="arrivi"
                className="fine-partita"
                aria-label="Fine della partita"
                onClick={() => cambiaVelo(inizio)}
                {...VELO}
              >
                <Arrivi partita={partita} stanza={stanza} io={io} onEsci={onEsci} onStatistiche={() => setStatistiche(true)} />
              </motion.section>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {statistiche && <StatisticheComplete key="statistiche" partita={partita} onChiudi={() => setStatistiche(false)} />}
          </AnimatePresence>
        </>,
        document.body,
      )}
    </>
  );
}

/* ---------------- Colonna destra ---------------- */

export function PannelloStatistiche({ partita, onApri }: { partita: Stato; onApri: () => void }): ReactNode {
  const righe = arrivi(partita);
  const aSquadre = partita.squadre.length > 0;
  return (
    <section className="pannello pannello--scuro classifica-fine" aria-labelledby="titolo-classifica">
      <header className="pannello__testa">
        <h2 id="titolo-classifica" className="pannello__titolo">
          Classifica
        </h2>
        <span className="pannello__conta">{partita.turno.numero} turni</span>
      </header>
      <ol className="classifica-fine__righe">
        {righe.map((r) => (
          <li key={r.g.id} className={r.vincitore ? 'classifica-fine__riga classifica-fine__riga--vincitore' : 'classifica-fine__riga'}>
            <span className="classifica-fine__posto">{r.posto}</span>
            {aSquadre && r.g.squadra !== null && (
              <Binario indice={r.g.squadra} nome={partita.squadre[r.g.squadra] ?? ''} className="binario--riga" />
            )}
            <Pedina colore={r.g.colore} iniziale={iniziale(r.g.nome)} />
            <span className="classifica-fine__nome">{r.g.nome}</span>
            <span className="classifica-fine__valore">
              {r.valore === null ? (
                <span className="classifica-fine__esito" title={`Uscito al turno ${r.turni}`}>
                  {r.esito}
                </span>
              ) : (
                <Soldi valore={r.valore} misura="s" />
              )}
            </span>
          </li>
        ))}
      </ol>
      <div className="classifica-fine__azioni">
        <button type="button" className="pulsante pulsante--piccolo pulsante--sul-quadro pulsante--largo" onClick={() => cambiaVelo(null)}>
          <Icona nome="coppa" />
          Rivedi gli arrivi
        </button>
        <button type="button" className="pulsante pulsante--piccolo pulsante--primario pulsante--largo" onClick={onApri}>
          <Icona nome="grafico" />
          Tutte le statistiche
        </button>
      </div>
    </section>
  );
}

/* ---------------- Tutte le statistiche ---------------- */

function Cella({ etichetta, children, nota }: { etichetta: string; children: ReactNode; nota?: string }): ReactNode {
  return (
    <div className="cella">
      <dt className="cella__etichetta">{etichetta}</dt>
      <dd className="cella__valore">{children}</dd>
      {nota && <dd className="cella__nota">{nota}</dd>}
    </div>
  );
}

export function StatisticheComplete({ partita, onChiudi }: { partita: Stato; onChiudi: () => void }): ReactNode {
  const riquadro = useRef<HTMLDivElement>(null);
  const presente = useIsPresent();
  useEffect(() => {
    if (!presente) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onChiudi();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onChiudi, presente]);
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
  const valoreVincitore = vincitore && !vincitore.eliminato ? patrimonio(partita, vincitore.id) : null;

  return (
    <motion.div
      className="statistiche"
      role="presentation"
      onClick={onChiudi}
      style={presente ? undefined : { pointerEvents: 'none' }}
      {...VELO}
    >
      <motion.div
        ref={riquadro}
        tabIndex={-1}
        className="statistiche__griglia"
        role="dialog"
        aria-modal="true"
        aria-labelledby="titolo-statistiche"
        onClick={(e) => e.stopPropagation()}
        {...COMPARSA}
      >
        <header className="statistiche__testa">
          <h2 id="titolo-statistiche" className="statistiche__titolo">
            Statistiche della partita
          </h2>
          <button type="button" className="pulsante pulsante--secondario statistiche__chiudi" onClick={onChiudi}>
            <Icona nome="chiudi" />
            Chiudi
          </button>
        </header>

        <dl className="statistiche__numeri" aria-label="Numeri della partita">
          <Cella etichetta="Durata" nota={ms === null ? undefined : durataInParole(ms)}>
            {ms === null ? '—' : <Palette testo={orologio(ms)} misura="l" />}
          </Cella>
          <Cella etichetta="Turni">
            <Palette testo={String(partita.turno.numero)} misura="l" />
          </Cella>
          <Cella etichetta="Doppi">
            <Palette testo={String(st.doppi)} misura="l" />
          </Cella>
          <Cella etichetta="Scambi">
            <Palette testo={String(st.scambi)} misura="l" />
          </Cella>
          <Cella etichetta="Messaggi in chat">
            <Palette testo={String(st.messaggi)} misura="l" />
          </Cella>
        </dl>

        <section className="cella cella--grafico" aria-labelledby="titolo-grafico">
          <h3 id="titolo-grafico" className="cella__etichetta">
            Patrimonio nel tempo
          </h3>
          <GraficoPatrimonio partita={partita} />
        </section>

        <dl className="statistiche__fatti">
          <div className="cella cella--vincitore">
            <dt className="cella__etichetta">{squadra ? 'Squadra vincitrice' : 'Vincitore'}</dt>
            <dd className="cella__chi cella__chi--grande">
              {squadra ? (
                <>
                  <Binario indice={squadra.indice} nome={squadra.nome} />
                  {squadra.nome}
                  <Icona nome="corona" className="cella__corona" />
                </>
              ) : vincitore ? (
                <>
                  <Pedina colore={vincitore.colore} iniziale={iniziale(vincitore.nome)} className="pedina--media" />
                  {vincitore.nome}
                  <Icona nome="corona" className="cella__corona" />
                </>
              ) : (
                'Nessuno'
              )}
            </dd>
            {squadra ? (
              <dd className="cella__nota">{squadra.membri.map((g) => g.nome).join(', ')}</dd>
            ) : (
              valoreVincitore !== null && <dd className="cella__nota">Patrimonio finale {euro(valoreVincitore)}</dd>
            )}
          </div>
          <div className="cella">
            <dt className="cella__etichetta">Proprietà più visitata</dt>
            <dd className="cella__chi">
              {visitata && casella ? (
                <>
                  {casella.gruppo ? (
                    <Stemma regione={tab.regioni[casella.gruppo - 1]} bandiera={casella.bandiera} className="stemma--lista" />
                  ) : (
                    casella.icona && <Icona nome={casella.icona} className="cella__icona" />
                  )}
                  {casella.nome}
                </>
              ) : (
                'Nessuna'
              )}
            </dd>
            {visitata && <dd className="cella__nota">Ci si è fermati {volte(visitata.visite)}</dd>}
          </div>
          <div className="cella">
            <dt className="cella__etichetta">Più volte in prigione</dt>
            <dd className="cella__chi">
              {prigione
                ? carcerati.map((g, i) => (
                    <span key={g.id} className="cella__persona">
                      <Pedina colore={g.colore} className="pedina--mini" />
                      {g.nome}
                      {i < carcerati.length - 1 ? ',' : ''}
                    </span>
                  ))
                : 'Nessuno'}
            </dd>
            {prigione && <dd className="cella__nota">In cella {volte(prigione.volte)}</dd>}
          </div>
        </dl>
      </motion.div>
    </motion.div>
  );
}
