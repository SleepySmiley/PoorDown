import '../stili/gioco.css';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ASSENZA_MS,
  costoProssimoEdificio,
  costoRiscatto,
  euro,
  haVinto,
  LIVELLO_ALBERGO,
  possedute,
  proprietabile,
  rimborsoEdificio,
  TENTATIVI_PRIGIONE,
  tabellone,
  valoreIpoteca,
  valoreVendita,
  verifica,
  type Attivita,
  type Azione,
  type Giocatore,
  type IdGiocatore,
  type MessaggioChat,
  type Mossa,
  type Stato,
  type VistaStanza,
  type VoceRegistro,
} from '@poordown/engine';
import { collegamento } from '../rete/sessione';
import { avvisa } from '../ui/avvisi';
import { destinoDeiBeni } from '../ui/beni';
import { caselleVista } from '../ui/caselle';
import { Dado, Pedina, Registro, Stemma } from '../ui/comuni';
import { iniziale } from '../ui/utili';
import { stilePopover } from '../ui/geometria';
import { Icona, type NomeIcona } from '../ui/icone';
import { Coriandoli } from '../ui/Coriandoli';
import { SCORRE } from '../ui/movimento';
import { Pannello } from '../ui/Pannello';
import { Pulsante } from '../ui/Pulsante';
import { Asta } from './Asta';
import { ColonnaSinistra, Finestra, ListaImpostazioni, RigaGiocatore, Tavolo } from './Colonne';
import { FuoriDallaPartita, NotaVoto, PulsanteVoto } from './Moderazione';
import { useScena } from './regia';
import { FinePartita, PannelloStatistiche, StatisticheComplete } from './FinePartita';
import { EditorScambio, PannelloScambi, VediScambio, type BozzaProposta } from './Scambi';
import { SchedaProprieta, Tabellone } from './Tabellone';
import { ESITO_USCITA, righeRegistro } from './testi';
import { TimerTurno } from './Timer';

/** `null` se la mossa si può fare adesso, altrimenti il motivo (per il suggerimento del pulsante). */
function motivo(partita: Stato, io: IdGiocatore, mossa: Mossa): string | null {
  return verifica(partita, { ...mossa, giocatore: io } as Azione)?.messaggio ?? null;
}

/** Pulsante a icona sulla scheda della proprietà: il suggerimento dice cosa fa e, se è spento, perché. */
function AzioneScheda({
  icona,
  etichetta,
  blocco,
  pericolo,
  onClick,
}: {
  icona: NomeIcona;
  etichetta: string;
  blocco: string | null;
  pericolo?: boolean;
  onClick: () => void;
}): ReactNode {
  return (
    <span className="con-suggerimento con-suggerimento--righe" data-testo={blocco ? `${etichetta}\n${blocco}` : etichetta}>
      <button
        type="button"
        className={pericolo ? 'pulsante-icona pulsante-icona--azione pulsante-icona--pericolo' : 'pulsante-icona pulsante-icona--azione'}
        aria-label={etichetta}
        disabled={blocco !== null}
        onClick={onClick}
      >
        <Icona nome={icona} />
      </button>
    </span>
  );
}

/** Cosa sta facendo un giocatore, al centro del tabellone, per chi aspetta. */
function cosaFa(attivita: Attivita | undefined, assente: boolean): string {
  if (assente) return 'ha perso il collegamento: il turno passa da solo…';
  switch (attivita?.tipo) {
    case 'crea':
      return 'sta creando uno scambio…';
    case 'guarda':
      return 'sta guardando uno scambio…';
    case 'tratta':
      return 'sta preparando una controproposta…';
    default:
      return 'sta giocando…';
  }
}

/** Le finestre degli scambi: nuova proposta (o controproposta su `base`) oppure uno scambio da vedere. */
type QualeFinestra = { tipo: 'crea'; base?: number } | { tipo: 'vedi'; id: number };
/** Con il numero del turno in cui si è aperta. */
type FinestraScambio = QualeFinestra & { turno: number };

/** Dove sta la bozza di una finestra «crea»: una per la proposta nuova, una per ogni controproposta. */
function chiaveBozza(base: number | undefined): string {
  return base === undefined ? 'nuova' : `contro-${base}`;
}

function attivitaDi(f: FinestraScambio | null): Attivita | null {
  if (!f) return null;
  if (f.tipo === 'vedi') return { tipo: 'guarda', scambio: f.id };
  return f.base === undefined ? { tipo: 'crea' } : { tipo: 'tratta', scambio: f.base };
}

/** I pulsanti del turno per chi gioca adesso. */
function AzioniTurno({
  partita,
  io,
  me,
  inviando,
  onMossa,
}: {
  partita: Stato;
  io: IdGiocatore;
  me: Giocatore;
  inviando: boolean;
  onMossa: (m: Mossa) => void;
}): ReactNode {
  const tab = tabellone(partita.mappa);
  const t = partita.turno;
  const blocco = (m: Mossa) => (inviando ? 'Un attimo…' : motivo(partita, io, m));

  // Un solo pulsante ambra alla volta: è l'azione del turno che si aspetta adesso. Le alternative sono secondarie.
  if (t.fase === 'prigione') {
    const tentativo = Math.min((me.prigione ?? 0) + 1, TENTATIVI_PRIGIONE);
    return (
      <>
        <div className="centro-gioco__azioni">
          <Pulsante variante="ambra" icona="dado" blocco={blocco({ tipo: 'lancia' })} onClick={() => onMossa({ tipo: 'lancia' })}>
            Tira i dadi
          </Pulsante>
          <Pulsante icona="euro" blocco={blocco({ tipo: 'paga_cauzione' })} onClick={() => onMossa({ tipo: 'paga_cauzione' })}>
            Paga {euro(tab.cauzione)}
          </Pulsante>
          {me.carteGrazia.length > 0 && (
            <Pulsante icona="grazia" blocco={blocco({ tipo: 'usa_grazia' })} onClick={() => onMossa({ tipo: 'usa_grazia' })}>
              Usa la Carta Grazia
            </Pulsante>
          )}
        </div>
        <p className="centro-gioco__nota">
          Sei in prigione: fai un doppio per uscire (tentativo {tentativo} di {TENTATIVI_PRIGIONE}), paga la cauzione
          {me.carteGrazia.length > 0 ? ' o usa la Carta Grazia' : ''}. Pagando, ti muovi al prossimo turno.
        </p>
      </>
    );
  }

  if (t.fase === 'lancio') {
    return (
      <div className="centro-gioco__azioni">
        <Pulsante
          variante="ambra"
          misura="grande"
          icona="dado"
          blocco={blocco({ tipo: 'lancia' })}
          onClick={() => onMossa({ tipo: 'lancia' })}
        >
          Tira i dadi
        </Pulsante>
      </div>
    );
  }

  const acquisto = t.acquisto !== null ? proprietabile(tab, t.acquisto) : null;
  const libera = acquisto && t.acquisto !== null && partita.proprieta[t.acquisto]?.proprietario === null;
  // Con le aste la proprietà libera va comprata o messa all'asta: solo dopo si prosegue.
  const daDecidere = libera && partita.impostazioni.aste;
  return (
    <div className="centro-gioco__azioni">
      {daDecidere && (
        <Pulsante icona="martelletto" blocco={blocco({ tipo: 'asta' })} onClick={() => onMossa({ tipo: 'asta' })}>
          Asta
        </Pulsante>
      )}
      {libera && (
        <Pulsante variante="ambra" icona="piu" blocco={blocco({ tipo: 'compra' })} onClick={() => onMossa({ tipo: 'compra' })}>
          Compra per {euro(acquisto.prezzo)}
        </Pulsante>
      )}
      {daDecidere ? null : t.rilancio ? (
        <Pulsante
          variante={libera ? 'secondario' : 'ambra'}
          icona="dado"
          blocco={blocco({ tipo: 'lancia' })}
          onClick={() => onMossa({ tipo: 'lancia' })}
        >
          Tira ancora
        </Pulsante>
      ) : (
        <Pulsante
          variante={libera ? 'secondario' : 'ambra'}
          icona="spunta"
          blocco={blocco({ tipo: 'fine_turno' })}
          onClick={() => onMossa({ tipo: 'fine_turno' })}
        >
          Termina il turno
        </Pulsante>
      )}
    </div>
  );
}

export function Gioco({
  stanza,
  io,
  registro,
  chat,
  scrivono,
  attivita,
  onEsci,
}: {
  stanza: VistaStanza;
  io: IdGiocatore | null;
  registro: VoceRegistro[];
  chat: MessaggioChat[];
  scrivono: IdGiocatore[];
  /** Chi sta creando, guardando o trattando uno scambio. */
  attivita: Record<IdGiocatore, Attivita>;
  onEsci: () => void;
}): ReactNode {
  const scena = useScena(collegamento);
  const partita = scena.partita ?? stanza.partita!;
  const tab = tabellone(partita.mappa);
  const caselle = caselleVista(partita.mappa);
  const me = partita.giocatori.find((g) => g.id === io && !g.eliminato);
  const corrente = partita.giocatori.find((g) => g.id === partita.turno.giocatore);
  const inCorso = partita.fase === 'in_corso';
  const mioTurno = inCorso && me !== undefined && corrente?.id === me.id;

  const [inviando, setInviando] = useState(false);
  const [scheda, setScheda] = useState<number | null>(null);
  const [mia, setMia] = useState<{ n: number; top: number; right: number } | null>(null);
  const [impostazioni, setImpostazioni] = useState(false);
  const [bancarotta, setBancarotta] = useState(false);
  const [daTogliere, setDaTogliere] = useState<Giocatore | null>(null);
  const [consiglio, setConsiglio] = useState(true);
  const [finestraChiesta, setFinestraChiesta] = useState<FinestraScambio | null>(null);
  const [bozze, setBozze] = useState<Record<string, BozzaProposta>>({});
  const [uscita, setUscita] = useState(false);
  const [statistiche, setStatistiche] = useState(false);
  // I coriandoli partono solo se la fine arriva mentre si guarda, non a chi ricarica la pagina dopo.
  const [vistaInCorso] = useState(inCorso);
  const [festa, setFesta] = useState(true);

  // Asta e scambi seguono la partita aggiornata, senza aspettare le animazioni: lì conta ogni secondo.
  const vivo = stanza.partita ?? partita;
  const giocoIo = vivo.fase === 'in_corso' && vivo.giocatori.some((g) => g.id === io && !g.eliminato) ? io : null;

  const mossa = useCallback((m: Mossa, poi?: () => void) => {
    setInviando(true);
    void collegamento.comando('mossa', m).then((r) => {
      setInviando(false);
      if (!r.ok) avvisa(r.messaggio, 'errore');
      else poi?.();
    });
  }, []);

  /* ---------- Scambi ---------- */

  const apriScambio = (f: QualeFinestra | null) => setFinestraChiesta(f && { ...f, turno: vivo.turno.numero });

  // La finestra resta aperta finché ha senso: lo scambio esiste ancora, io sono ancora in gioco.
  const scambioVisto = finestraChiesta?.tipo === 'vedi' ? vivo.scambi.find((x) => x.id === finestraChiesta.id) : undefined;
  const baseTrattativa =
    finestraChiesta?.tipo === 'crea' && finestraChiesta.base !== undefined
      ? vivo.scambi.find((x) => x.id === finestraChiesta.base)
      : undefined;
  const finestraValida =
    vivo.fase === 'in_corso' &&
    (finestraChiesta?.tipo === 'vedi'
      ? scambioVisto !== undefined
      : finestraChiesta?.tipo === 'crea' && giocoIo !== null && (finestraChiesta.base === undefined || baseTrattativa !== undefined));
  const finestraAperta = finestraValida ? finestraChiesta : null;
  // Quando comincia il mio turno, la finestra aperta prima si mette da parte: i pulsanti del turno restano
  // in vista. La bozza resta salva e la finestra torna quando il turno finisce.
  const rimandata =
    finestraAperta !== null && giocoIo !== null && vivo.turno.giocatore === giocoIo && finestraAperta.turno !== vivo.turno.numero;
  const finestraScambio = rimandata ? null : finestraAperta;
  const tipoRimandata = rimandata ? finestraAperta.tipo : null;
  useEffect(() => {
    if (tipoRimandata === 'crea') avvisa('Tocca a te: la bozza dello scambio è salva e si riapre a fine turno.');
    else if (tipoRimandata === 'vedi') avvisa('Tocca a te: lo scambio si riapre a fine turno.');
  }, [tipoRimandata]);

  // Gli altri vedono se sto creando, guardando o trattando uno scambio.
  useEffect(() => collegamento.segnalaAttivita(attivitaDi(finestraScambio)), [finestraScambio]);
  useEffect(() => () => collegamento.segnalaAttivita(null), []);

  // Chi riceve una proposta la vede subito, a meno che non stia già preparando uno scambio (anche messo da parte).
  const finestraAttuale = useRef(finestraAperta);
  useEffect(() => {
    finestraAttuale.current = finestraAperta;
  }, [finestraAperta]);
  useEffect(
    () =>
      collegamento.ascoltaVoci((voci) => {
        for (const v of voci) {
          const e = v.evento;
          if (e.tipo !== 'scambio_proposto' || e.a !== io) continue;
          const partitaOra = collegamento.leggi().stanza?.partita;
          if (finestraAttuale.current?.tipo === 'crea') {
            const da = partitaOra?.giocatori.find((g) => g.id === e.da);
            avvisa(`${da?.nome ?? 'Un giocatore'} ti ha proposto uno scambio: lo trovi in «Scambi».`);
          } else {
            setFinestraChiesta({ tipo: 'vedi', id: e.scambio, turno: partitaOra?.turno.numero ?? 0 });
          }
        }
      }),
    [io],
  );

  /** Chiude l'editor e scarta la sua bozza: dopo l'invio, o se lo chiudo io. */
  const chiudiEditor = (chiave: string) => {
    setFinestraChiesta(null);
    setBozze((x) => Object.fromEntries(Object.entries(x).filter(([k]) => k !== chiave)));
  };


  /* ---------- Schede aperte ---------- */

  useEffect(() => {
    const chiudi = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('.scheda, .casella, .mie__voce')) return;
      setScheda(null);
      setMia(null);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setScheda(null);
        setMia(null);
      }
    };
    document.addEventListener('mousedown', chiudi);
    window.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', chiudi);
      window.removeEventListener('keydown', esc);
    };
  }, []);

  /* ---------- Centro del tabellone ---------- */

  // Presenze e voti seguono la partita aggiornata, come il timer.
  const vivi = new Map(vivo.giocatori.map((g) => [g.id, g]));
  const righe = righeRegistro(registro, stanza, scena.registroFino);
  let azioni: ReactNode;
  if (!inCorso) {
    azioni = null;
  } else if (mioTurno && me && io) {
    azioni = scena.occupata ? (
      <div className="centro-gioco__azioni" />
    ) : (
      <AzioniTurno partita={partita} io={io} me={me} inviando={inviando} onMossa={mossa} />
    );
  } else if (corrente) {
    azioni = (
      <div className="centro-gioco__azioni">
        <p className="sta-giocando">
          <Pedina colore={corrente.colore} className="pedina--mini" />
          <b>{corrente.nome}</b> {cosaFa(attivita[corrente.id], vivi.get(corrente.id)?.offlineDa != null)}
        </p>
      </div>
    );
  }

  const inRosso = me && me.saldo < 0 && inCorso && !scena.occupata;
  const centro = (
    <div className="centro-gioco">
      <TimerTurno partita={vivo} io={giocoIo} inviando={inviando} onMossa={mossa} />
      {inCorso ? (
        <>
          <div
            className={scena.rotola ? 'centro-gioco__dadi centro-gioco__dadi--rotola' : 'centro-gioco__dadi'}
            key={scena.lanci}
          >
            <Dado valore={scena.dadi[0]} />
            <Dado valore={scena.dadi[1]} />
          </div>
          {azioni}
          {inRosso && (
            <p className="centro-gioco__nota centro-gioco__nota--rosso">
              Hai il saldo negativo: vendi case o proprietà da «Le mie proprietà»
              {partita.impostazioni.ipoteche ? ', ipotecale' : ''} o proponi uno scambio. Altrimenti dichiara bancarotta.
            </p>
          )}
          <NotaVoto partita={vivo} io={giocoIo} />
        </>
      ) : (
        <div className="centro-gioco__dadi">
          <Dado valore={scena.dadi[0]} />
          <Dado valore={scena.dadi[1]} />
        </div>
      )}
      <Registro righe={righe} />
    </div>
  );

  /* ---------- Colonna destra ---------- */

  const connessi = new Map(stanza.partecipanti.map((p) => [p.id, p.connesso]));
  const bot = new Set(stanza.partecipanti.filter((p) => p.bot).map((p) => p.id));
  // L'host di una stanza privata, finché è in gioco, può togliere dalla partita chi non sta giocando il suo turno.
  const puoTogliere = inCorso && giocoIo !== null && stanza.host === giocoIo && stanza.impostazioni.stanzaPrivata;
  const mie = me ? possedute(partita, me.id) : [];
  const popoverBordo = scheda;
  const casellaMia = mia ? caselle[mia.n] : undefined;

  const azioniMia = (() => {
    const c = mia ? proprietabile(tab, mia.n) : null;
    const p = mia ? partita.proprieta[mia.n] : null;
    if (!mia || !io || !c || !p) return null;
    const n = mia.n;
    const occupato = scena.occupata || inviando ? 'Un attimo…' : null;
    const blocco = (m: Mossa) => occupato ?? motivo(partita, io, m);
    const vendita: Mossa = { tipo: 'vendi', casella: n };
    const importo = valoreVendita(partita, n);
    let edifici: ReactNode = null;
    if (c.tipo === 'citta') {
      const su: Mossa = { tipo: 'costruisci', casella: n };
      const giu: Mossa = { tipo: 'demolisci', casella: n };
      const costo = costoProssimoEdificio(tab, c, p.livello);
      edifici = (
        <>
          <AzioneScheda
            icona="su"
            etichetta={
              p.livello >= LIVELLO_ALBERGO
                ? 'Costruisci'
                : `Costruisci ${p.livello === LIVELLO_ALBERGO - 1 ? 'l’albergo' : 'una casa'} per ${euro(costo)}`
            }
            blocco={blocco(su)}
            onClick={() => mossa(su)}
          />
          <AzioneScheda
            icona="giu"
            etichetta={
              p.livello === 0
                ? 'Vendi una casa'
                : `Vendi ${p.livello === LIVELLO_ALBERGO ? 'l’albergo' : 'una casa'} per ${euro(rimborsoEdificio(tab, c, p.livello))}`
            }
            blocco={blocco(giu)}
            onClick={() => mossa(giu)}
          />
        </>
      );
    }
    return (
      <>
        {edifici}
        <span className="scheda__azioni-spazio" />
        <AzioneScheda
          icona="cestino"
          pericolo
          etichetta={p.ipotecata ? 'Vendi alla banca: è ipotecata, non ricevi niente' : `Vendi alla banca per ${euro(importo)}`}
          blocco={blocco(vendita)}
          onClick={() => mossa(vendita, () => setMia(null))}
        />
      </>
    );
  })();

  const ipotecaMia = (() => {
    const p = mia ? partita.proprieta[mia.n] : null;
    if (!mia || !io || !p || !partita.impostazioni.ipoteche) return null;
    const m: Mossa = p.ipotecata ? { tipo: 'riscatta', casella: mia.n } : { tipo: 'ipoteca', casella: mia.n };
    const blocco = scena.occupata || inviando ? 'Un attimo…' : motivo(partita, io, m);
    const spiegazione = p.ipotecata
      ? 'Costa il 110% di quanto hai ricevuto con l’ipoteca.'
      : `Ricevi ${euro(valoreIpoteca(tab, mia.n))} dalla banca, ma finché è ipotecata chi si ferma qui non paga l’affitto.`;
    return (
      <span className="con-suggerimento con-suggerimento--righe" data-testo={blocco ? `${spiegazione}\n${blocco}` : spiegazione}>
        <button
          type="button"
          className="pulsante pulsante--piccolo pulsante--secondario"
          disabled={blocco !== null}
          onClick={() => mossa(m)}
        >
          <Icona nome="banca" />
          {p.ipotecata ? `Togli l’ipoteca per ${euro(costoRiscatto(tab, mia.n))}` : `Ipoteca per ${euro(valoreIpoteca(tab, mia.n))}`}
        </button>
      </span>
    );
  })();

  /* ---------- Finestre sopra il tabellone ---------- */

  let finestraSopra: ReactNode = null;
  if (vivo.asta && inCorso) {
    finestraSopra = (
      <Asta key="asta" partita={vivo} io={giocoIo} inviando={inviando} onOffri={(importo) => mossa({ tipo: 'offri', importo })} />
    );
  } else if (finestraScambio?.tipo === 'vedi' && scambioVisto) {
    finestraSopra = (
      <VediScambio
        key={`vedi-${scambioVisto.id}`}
        partita={vivo}
        io={giocoIo}
        scambio={scambioVisto}
        attivita={attivita}
        inviando={inviando}
        onMossa={(m) => mossa(m, () => apriScambio(null))}
        onTratta={() => apriScambio({ tipo: 'crea', base: scambioVisto.id })}
        onChiudi={() => apriScambio(null)}
      />
    );
  } else if (finestraScambio?.tipo === 'crea' && giocoIo) {
    // La bozza vive qui, non nell'editor: un'asta o l'inizio del mio turno lo chiudono senza perderla.
    const chiave = chiaveBozza(finestraScambio.base);
    finestraSopra = (
      <EditorScambio
        key={`crea-${chiave}`}
        partita={vivo}
        io={giocoIo}
        base={baseTrattativa}
        bozza={bozze[chiave]}
        inviando={inviando}
        onBozza={(b) => setBozze((x) => ({ ...x, [chiave]: b }))}
        onInvia={(proposta) => mossa(proposta, () => chiudiEditor(chiave))}
        onChiudi={() => chiudiEditor(chiave)}
      />
    );
  }

  return (
    <>
      <Tavolo
        sinistra={
          <ColonnaSinistra
            stanza={stanza}
            io={io}
            chat={chat}
            scrivono={scrivono}
            // Chi è ancora in gioco conferma prima di uscire: i suoi turni continuano senza di lui.
            onEsci={giocoIo ? () => setUscita(true) : onEsci}
            onImpostazioni={() => setImpostazioni(true)}
          />
        }
        centro={
          <Tabellone
            mappa={partita.mappa}
            partita={partita}
            pedine={partita.giocatori
              .filter((g) => !g.eliminato)
              .map((g) => {
                const mostrata = scena.posizioni[g.id];
                return {
                  id: g.id,
                  colore: g.colore,
                  iniziale: iniziale(g.nome),
                  posizione: mostrata?.casella ?? g.posizione,
                  prigione: mostrata?.prigione ?? g.prigione !== null,
                  passo: scena.passi[g.id],
                  evidenziata: inCorso && g.id === corrente?.id,
                };
              })}
            centro={centro}
            selezionata={scheda ?? undefined}
            onApri={(n) => {
              setMia(null);
              setScheda((x) => (x === n ? null : n));
            }}
            sopra={
              <>
                <AnimatePresence>
                  {popoverBordo !== null && inCorso && (
                    <SchedaProprieta
                      key={popoverBordo}
                      animata
                      mappa={partita.mappa}
                      partita={partita}
                      n={popoverBordo}
                      onChiudi={() => setScheda(null)}
                      className={stilePopover(popoverBordo, tab.caselle.length).classe}
                      style={stilePopover(popoverBordo, tab.caselle.length).stile}
                    />
                  )}
                </AnimatePresence>
                {/* Un riquadro alla volta: il vecchio si chiude, poi si apre il nuovo. */}
                <AnimatePresence mode="wait">{finestraSopra}</AnimatePresence>
                {!inCorso && <FinePartita partita={partita} stanza={stanza} io={io} onEsci={onEsci} />}
              </>
            }
          />
        }
        destra={
          <>
            <section className="pannello pannello--scuro giocatori" aria-label="Giocatori">
              <ul>
                {partita.giocatori.map((g) => {
                  const offlineDa = vivi.get(g.id)?.offlineDa ?? null;
                  return (
                    <RigaGiocatore
                      key={g.id}
                      g={{
                        id: g.id,
                        nome: g.nome,
                        colore: g.colore,
                        host: g.id === stanza.host,
                        tu: g.id === io,
                        // Di chi è fuori dalla partita non interessa se è collegato.
                        connesso: g.eliminato !== null || (connessi.get(g.id) ?? false),
                        saldo: g.saldo,
                        turno: inCorso && g.id === corrente?.id,
                        prigione: g.prigione !== null && !g.eliminato,
                        fuori: g.eliminato !== null,
                        esito: g.eliminato ? ESITO_USCITA[g.eliminato.motivo] : undefined,
                        assenteFino: inCorso && !g.eliminato && offlineDa !== null ? offlineDa + ASSENZA_MS : undefined,
                        bot: bot.has(g.id),
                        squadra: g.squadra === null ? undefined : { indice: g.squadra, nome: partita.squadre[g.squadra] ?? '' },
                      }}
                      puoEspellere={puoTogliere}
                      etichettaEspulsione={`Togli ${g.nome} dalla partita`}
                      bloccoEspulsione={
                        g.id === vivo.turno.giocatore ? 'Non puoi togliere chi sta giocando il suo turno: aspetta che finisca.' : null
                      }
                      onEspelli={() => setDaTogliere(g)}
                    />
                  );
                })}
              </ul>
            </section>

            {me && inCorso && (
              <div className="bancarotta">
                {giocoIo && <PulsanteVoto partita={vivo} io={giocoIo} inviando={inviando} onMossa={mossa} />}
                <button
                  type="button"
                  className="pulsante pulsante--piccolo pulsante--pericolo-tenue"
                  onClick={() => setBancarotta(true)}
                >
                  <Icona nome="bandiera" />
                  Bancarotta
                </button>
              </div>
            )}

            {inCorso && (
              <PannelloScambi
                partita={vivo}
                io={giocoIo}
                attivita={attivita}
                onCrea={giocoIo ? () => apriScambio({ tipo: 'crea' }) : undefined}
                onApri={(id) => apriScambio({ tipo: 'vedi', id })}
              />
            )}

            {!inCorso ? (
              <PannelloStatistiche partita={partita} onApri={() => setStatistiche(true)} />
            ) : me ? (
              <Pannello titolo="Le mie proprietà" conta={mie.length} className="mie">
                <div className="pannello__scorri">
                  {consiglio && (
                    <div className="consiglio">
                      <p>
                        Clicca una tua proprietà per costruire, vendere{partita.impostazioni.ipoteche ? ' o ipotecare' : ''}, durante il
                        tuo turno.
                      </p>
                      <button type="button" className="consiglio__ok" onClick={() => setConsiglio(false)}>
                        <Icona nome="spunta" />
                        Ok, capito
                      </button>
                    </div>
                  )}
                  {mie.length === 0 && me.carteGrazia.length === 0 && (
                    <p className="mie__vuoto">Non hai ancora proprietà: comprale fermandoti sulle caselle libere.</p>
                  )}
                  <ul className="mie__lista">
                    {mie.map((n) => {
                      const c = caselle[n]!;
                      const p = partita.proprieta[n];
                      const livello = p?.livello ?? 0;
                      return (
                        <motion.li key={n} layout="position" transition={SCORRE}>
                          <button
                            type="button"
                            className={mia?.n === n ? 'mie__voce mie__voce--aperta' : 'mie__voce'}
                            onClick={(e) => {
                              const r = e.currentTarget.getBoundingClientRect();
                              setScheda(null);
                              setMia((x) => (x?.n === n ? null : { n, top: r.top, right: window.innerWidth - r.left + 12 }));
                            }}
                          >
                            {c.gruppo ? (
                              <Stemma regione={tab.regioni[c.gruppo - 1]} className="stemma--lista" />
                            ) : (
                              c.icona && <Icona nome={c.icona} className="mie__icona" />
                            )}
                            <span className="mie__nome">{c.nome}</span>
                            {p?.ipotecata && <Icona nome="banca" className="mie__icona" titolo="Ipotecata" />}
                            {livello > 0 && (
                              <span className="mie__case">
                                <Icona nome={livello === LIVELLO_ALBERGO ? 'albergo' : 'casa'} />
                                {livello === LIVELLO_ALBERGO ? '' : `×${livello}`}
                              </span>
                            )}
                          </button>
                        </motion.li>
                      );
                    })}
                    {me.carteGrazia.map((mazzo, i) => (
                      <motion.li key={`${mazzo}-${i}`} layout="position" transition={SCORRE}>
                        <span className="mie__voce mie__voce--grazia" title="Ti fa uscire gratis di prigione">
                          <Icona nome="grazia" className="mie__icona" />
                          <span className="mie__nome">Carta Grazia</span>
                        </span>
                      </motion.li>
                    ))}
                  </ul>
                </div>
              </Pannello>
            ) : (
              <p className="spettatore">
                <Icona nome="occhio" />
                {io && partita.giocatori.some((g) => g.id === io)
                  ? 'Sei fuori dalla partita: puoi continuare a guardarla.'
                  : 'Stai guardando la partita.'}
              </p>
            )}
          </>
        }
      />

      <AnimatePresence>
        {mia && casellaMia && inCorso && (
          <SchedaProprieta
            key={`mia-${mia.n}`}
            animata
            mappa={partita.mappa}
            partita={partita}
            n={mia.n}
            onChiudi={() => setMia(null)}
            className="scheda--mia"
            style={{ top: Math.max(16, Math.min(mia.top - 120, window.innerHeight - 520)), right: mia.right }}
            azioni={azioniMia}
            ipoteca={ipotecaMia}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {impostazioni && (
          <Finestra key="impostazioni" titolo="Impostazioni della stanza" onChiudi={() => setImpostazioni(false)} larga>
            <div className="finestra__scorri">
              <p className="impostazioni__nota">Durante la partita le impostazioni non si possono cambiare.</p>
              <ListaImpostazioni imp={partita.impostazioni} modificabile={false} />
            </div>
          </Finestra>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {uscita && giocoIo && (
          <Finestra key="uscita" titolo="Torna alla home" tono="pericolo" icona="esci" onChiudi={() => setUscita(false)}>
            <div className="finestra__corpo">
              <p>
                Sei ancora in gioco: mentre sei via i tuoi turni passano da soli e, se non rientri entro due minuti, perdi il
                posto nella partita.
              </p>
            </div>
            <div className="finestra__azioni">
              <button type="button" className="pulsante pulsante--fantasma" onClick={() => setUscita(false)}>
                Resta
              </button>
              <button
                type="button"
                className="pulsante pulsante--rosso"
                onClick={() => {
                  setUscita(false);
                  onEsci();
                }}
              >
                <Icona nome="esci" />
                Torna alla home
              </button>
            </div>
          </Finestra>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {daTogliere && inCorso && (
          <Finestra key="togli" titolo="Togli dalla partita" tono="pericolo" onChiudi={() => setDaTogliere(null)}>
            <div className="finestra__corpo">
              <p>
                Vuoi togliere <b>{daTogliere.nome}</b> dalla partita? {destinoDeiBeni(partita, daTogliere, false)} Non potrà più
                giocare né scrivere in chat. Non si può annullare.
              </p>
            </div>
            <div className="finestra__azioni">
              <button type="button" className="pulsante pulsante--fantasma" onClick={() => setDaTogliere(null)}>
                Annulla
              </button>
              <button
                type="button"
                className="pulsante pulsante--rosso"
                onClick={() => {
                  const id = daTogliere.id;
                  setDaTogliere(null);
                  void collegamento.comando('espelli', { giocatore: id }).then((r) => {
                    if (!r.ok) avvisa(r.messaggio, 'errore');
                  });
                }}
              >
                <Icona nome="chiudi" />
                Togli dalla partita
              </button>
            </div>
          </Finestra>
        )}
      </AnimatePresence>

      <FuoriDallaPartita codice={stanza.codice} partita={partita} io={io} onEsci={onEsci} />

      <AnimatePresence>
        {statistiche && !inCorso && <StatisticheComplete key="statistiche" partita={partita} onChiudi={() => setStatistiche(false)} />}
      </AnimatePresence>

      {vistaInCorso && !inCorso && festa && io !== null && haVinto(partita, io) && (
        <Coriandoli onFine={() => setFesta(false)} />
      )}

      <AnimatePresence>
        {bancarotta && inCorso && (
          <Finestra key="bancarotta" titolo="Dichiara bancarotta" tono="pericolo" icona="bandiera" onChiudi={() => setBancarotta(false)}>
            <div className="finestra__corpo">
              <p>Esci dalla partita. {me ? destinoDeiBeni(partita, me, true) : ''} Non si può annullare.</p>
            </div>
            <div className="finestra__azioni">
              <button type="button" className="pulsante pulsante--fantasma" onClick={() => setBancarotta(false)}>
                Annulla
              </button>
              <button
                type="button"
                className="pulsante pulsante--rosso"
                onClick={() => {
                  setBancarotta(false);
                  mossa({ tipo: 'bancarotta' });
                }}
              >
                <Icona nome="bandiera" />
                Dichiara bancarotta
              </button>
            </div>
          </Finestra>
        )}
      </AnimatePresence>
    </>
  );
}
