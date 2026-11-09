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
  tabellone,
  TEMPI,
  valoreIpoteca,
  valoreVendita,
  verifica,
  type Attivita,
  type Azione,
  type Evento,
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
import { CartaPescata } from '../ui/Carta';
import { Dado, Palette, Pedina, Stemma } from '../ui/comuni';
import { VoliGettoni } from '../ui/Gettone';
import { iniziale, variabili } from '../ui/utili';
import { geometria, stilePopover } from '../ui/geometria';
import { Icona, type NomeIcona } from '../ui/icone';
import { Coriandoli } from '../ui/Coriandoli';
import { DURATA, SCORRE, VELO } from '../ui/movimento';
import { Pannello } from '../ui/Pannello';
import { Pulsante } from '../ui/Pulsante';
import { Asta } from './Asta';
import { CartelloTurno } from './CartelloTurno';
import { Chat, ChatChiusa } from './Chat';
import { RigaGiocatoreGioco, TestataGioco } from './ColonnaGioco';
import { Finestra, Tavolo } from './Colonne';
import { ListaImpostazioni } from './Impostazioni';
import { useChatRichiudibile } from './colonna';
import { Cronologia, EventoCorrente, RegistroCorto } from './EventoCorrente';
import { FuoriDallaPartita, NotaVoto, VotoNellaRiga } from './Moderazione';
import { useScena } from './regia';
import { FinePartita, PannelloStatistiche, StatisticheComplete } from './FinePartita';
import {
  BigliettoProposta,
  EditorScambio,
  esitoScambio,
  PannelloScambi,
  TimbroScambio,
  VediScambio,
  type BozzaProposta,
  type RichiestaScambio,
} from './Scambi';
import { SchedaProprieta, Tabellone } from './Tabellone';
import { ESITO_USCITA, righeRegistro } from './testi';
import { eventoCorrente, tentativoPrigione, useTitoloScheda, useVariazioniSaldo } from './turno';

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

/**
 * Le finestre degli scambi: nuova proposta (o controproposta su `base`, o già pronta con `iniziale` da «Chiedila a…»)
 * oppure uno scambio da vedere.
 */
type QualeFinestra = { tipo: 'crea'; base?: number; iniziale?: RichiestaScambio } | { tipo: 'vedi'; id: number };
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

/** I coriandoli partono quando il titolo della fine partita ha finito di timbrarsi, non prima. */
const RITARDO_CORIANDOLI_MS = (DURATA.viaggio + DURATA.timbro / 2) * 1000;
/** Il rotolamento dei dadi (le facce sempre più lente): l'animazione CSS dura quanto la scena. */
const ROTOLA_MS = TEMPI.facceDado.reduce((t, ms) => t + ms, 0);

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
    const grazia = me.carteGrazia.length > 0;
    return (
      <>
        <div className="centro-gioco__azioni">
          <Pulsante variante="ambra" icona="dado" blocco={blocco({ tipo: 'lancia' })} onClick={() => onMossa({ tipo: 'lancia' })}>
            Tenta il doppio
          </Pulsante>
          <Pulsante icona="euro" blocco={blocco({ tipo: 'paga_cauzione' })} onClick={() => onMossa({ tipo: 'paga_cauzione' })}>
            Paga {euro(tab.cauzione)} ed esci
          </Pulsante>
          {grazia && (
            <Pulsante icona="grazia" blocco={blocco({ tipo: 'usa_grazia' })} onClick={() => onMossa({ tipo: 'usa_grazia' })}>
              Usa la Carta Grazia
            </Pulsante>
          )}
        </div>
        <p className="centro-gioco__nota">
          Con il doppio esci e ti muovi subito. Pagando{grazia ? ' o con la Carta Grazia' : ''} esci adesso, ma ti muovi al
          prossimo turno.
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
  const [cronologia, setCronologia] = useState(false);
  // I coriandoli partono solo se la fine arriva mentre si guarda, non a chi ricarica la pagina dopo,
  // e solo quando il titolo della fine partita è arrivato.
  const [vistaInCorso] = useState(inCorso);
  const [festa, setFesta] = useState(true);
  const [festaPronta, setFestaPronta] = useState(false);
  useEffect(() => {
    if (!vistaInCorso || inCorso) return;
    const t = setTimeout(() => setFestaPronta(true), RITARDO_CORIANDOLI_MS);
    return () => clearTimeout(t);
  }, [vistaInCorso, inCorso]);
  // Le proposte arrivate mentre era il mio turno (o avevo un'altra finestra aperta): il biglietto in cima al tabellone.
  const [biglietti, setBiglietti] = useState<number[]>([]);

  // Asta e scambi seguono la partita aggiornata, senza aspettare le animazioni: lì conta ogni secondo.
  const vivo = stanza.partita ?? partita;
  const giocoIo = vivo.fase === 'in_corso' && vivo.giocatori.some((g) => g.id === io && !g.eliminato) ? io : null;

  const chatRichiusa = useChatRichiudibile(chat, io);
  // «● Tocca a te» nel titolo della scheda appena tocca a me, senza aspettare le animazioni.
  useTitoloScheda(giocoIo !== null && vivo.turno.giocatore === giocoIo, chatRichiusa.nuovi);
  // I saldi cambiano a fine scena, insieme al resto della partita mostrata.
  const variazioni = useVariazioniSaldo(partita.giocatori);

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

  // Chi riceve una proposta la vede subito, ma solo se non è il suo turno e non ha altre finestre aperte (anche messe
  // da parte): altrimenti arriva il biglietto, che non copre i pulsanti del turno.
  const finestraAttuale = useRef<FinestraScambio | null>(finestraAperta);
  const altraFinestra = useRef(false);
  useEffect(() => {
    finestraAttuale.current = finestraAperta;
    altraFinestra.current = cronologia || vivo.asta !== null;
  }, [finestraAperta, cronologia, vivo.asta]);
  useEffect(
    () =>
      collegamento.ascoltaVoci((voci) => {
        const partitaOra = collegamento.leggi().stanza?.partita;
        for (const v of voci) {
          const e = v.evento;
          if (e.tipo === 'scambio_proposto' && e.a === io) {
            const mioTurno = partitaOra?.turno.giocatore === io;
            if (!mioTurno && finestraAttuale.current === null && !altraFinestra.current) {
              setFinestraChiesta({ tipo: 'vedi', id: e.scambio, turno: partitaOra?.turno.numero ?? 0 });
            } else {
              setBiglietti((x) => [...x.filter((id) => id !== e.scambio), e.scambio]);
            }
            continue;
          }
          // Accettato, rifiutato, ritirato: lo dice un avviso a chi è coinvolto (le controproposte le mostra il biglietto).
          const esito = partitaOra ? esitoScambio(partitaOra, io, e as Evento) : null;
          if (esito) avvisa(esito.testo, esito.tipo);
        }
      }),
    [io],
  );
  const daVedere = giocoIo ? biglietti.flatMap((id) => vivo.scambi.filter((x) => x.id === id && x.a === giocoIo)) : [];

  /** Chiude l'editor e scarta la sua bozza: dopo l'invio, o se lo chiudo io. */
  const chiudiEditor = (chiave: string) => {
    setFinestraChiesta(null);
    setBozze((x) => Object.fromEntries(Object.entries(x).filter(([k]) => k !== chiave)));
  };

  /** «Chiedila a <nome>» dalla scheda di una proprietà altrui: l'editor si apre con lui e la proprietà in «Ricevi». */
  const chiedi = (n: number, con: IdGiocatore) => {
    setScheda(null);
    setBozze((x) => Object.fromEntries(Object.entries(x).filter(([k]) => k !== 'nuova')));
    apriScambio({ tipo: 'crea', iniziale: { con, caselle: [n] } });
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
  // La scheda dell'evento compare quando il suo evento va in scena (l'affitto mentre il gettone vola), non dopo;
  // la carta no: è già grande al centro del tabellone.
  const voceInCorso = scena.inCorso !== null ? registro.find((v) => v.n === scena.inCorso) : undefined;
  const subito = voceInCorso && !['carta', 'dadi', 'movimento'].includes(voceInCorso.evento.tipo);
  const evento = inCorso ? eventoCorrente(registro, subito ? voceInCorso.n : scena.registroFino) : null;
  const azioni =
    mioTurno && me && io && !scena.occupata ? (
      <AzioniTurno partita={partita} io={io} me={me} inviando={inviando} onMossa={mossa} />
    ) : null;

  // I dadi restano spenti finché chi gioca non ha tirato: mostrano il tiro di prima, non il suo.
  const spenti = inCorso && !scena.occupata && partita.turno.dadi === null;
  const fermi = inCorso && !spenti && !scena.rotola;
  const doppio = fermi && scena.dadi[0] === scena.dadi[1];
  const classiDadi = [
    'centro-gioco__dadi',
    scena.rotola ? 'centro-gioco__dadi--rotola' : '',
    spenti ? 'centro-gioco__dadi--spenti' : '',
    fermi && scena.lanci > 0 ? 'centro-gioco__dadi--atterra' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const inRosso = me && me.saldo < 0 && inCorso && !scena.occupata;
  const centro = (
    <div className="centro-gioco">
      {inCorso && corrente && (
        <CartelloTurno
          key={`${partita.turno.numero}-${corrente.id}`}
          partita={partita}
          vivo={vivo}
          io={giocoIo}
          attivita={attivita}
          occupata={scena.occupata}
          inviando={inviando}
          onMossa={mossa}
        />
      )}
      <div className="centro-gioco__lancio">
        {doppio && (
          <span className="centro-gioco__doppio" key={`doppio-${scena.lanci}`}>
            Doppio
          </span>
        )}
        <div className={classiDadi} key={scena.lanci} style={variabili({ '--rotola': `${ROTOLA_MS}ms` })}>
          <Dado valore={scena.dadi[0]} doppio={doppio} />
          <Dado valore={scena.dadi[1]} doppio={doppio} />
        </div>
        {/* Il totale a palette, appena i dadi si fermano. */}
        {fermi && (
          <span className={doppio ? 'centro-gioco__totale centro-gioco__totale--doppio' : 'centro-gioco__totale'} key={`totale-${scena.lanci}`}>
            <Palette testo={String(scena.dadi[0] + scena.dadi[1])} />
          </span>
        )}
      </div>
      {azioni}
      {inRosso && (
        <p className="centro-gioco__nota centro-gioco__nota--rosso">
          Hai il saldo negativo: vendi case o proprietà da «Le mie proprietà»
          {partita.impostazioni.ipoteche ? ', ipotecale' : ''} o proponi uno scambio. Altrimenti dichiara bancarotta dal menu «⋯».
        </p>
      )}
      {inCorso && <NotaVoto partita={vivo} io={giocoIo} />}
      {inCorso && (
        <div className="centro-gioco__accaduto">
          {evento && <EventoCorrente key={evento.voce.n} evento={evento} partita={partita} io={io} />}
          <RegistroCorto righe={righe} esclusa={evento?.voce.n} onTutto={() => setCronologia(true)} />
        </div>
      )}
    </div>
  );

  /* ---------- Colonne ---------- */

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
        iniziale={finestraScambio.iniziale}
        inviando={inviando}
        onBozza={(b) => setBozze((x) => ({ ...x, [chiave]: b }))}
        onInvia={(proposta) => mossa(proposta, () => chiudiEditor(chiave))}
        onChiudi={() => chiudiEditor(chiave)}
      />
    );
  } else if (cronologia) {
    finestraSopra = <Cronologia key="cronologia" righe={righe} onChiudi={() => setCronologia(false)} />;
  }

  /* ---------- Effetti della regia sul tabellone ---------- */

  const proprietarioScheda = (() => {
    if (popoverBordo === null || !giocoIo) return null;
    const di = partita.proprieta[popoverBordo]?.proprietario ?? null;
    // Si chiede solo a chi è ancora in gioco, e non a se stessi.
    return di && di !== giocoIo && vivo.giocatori.some((g) => g.id === di && !g.eliminato) ? di : null;
  })();
  const coloreDi = (id: IdGiocatore) => partita.giocatori.find((g) => g.id === id)?.colore ?? 1;
  const metaDadi = inCorso && scena.meta ? { n: scena.meta.casella, colore: coloreDi(scena.meta.giocatore) } : undefined;
  const cartaInScena = inCorso ? scena.carta : null;
  const chiPesca = cartaInScena ? partita.giocatori.find((g) => g.id === cartaInScena.giocatore) : undefined;
  // La Cartolina che manda in una città ha il francobollo del colore della sua regione.
  const regioneCarta = (() => {
    if (!cartaInScena) return undefined;
    const effetto = tab.mazzi[cartaInScena.mazzo][cartaInScena.carta]?.effetto;
    const meta = effetto?.tipo === 'vai_a' ? tab.caselle[effetto.casella] : undefined;
    return meta?.tipo === 'citta' ? tab.regioni[meta.regione]?.colore : undefined;
  })();
  const timbro = scena.timbro && (scena.timbro.tipo === 'accettato' || scena.timbro.da === io) ? scena.timbro : null;

  return (
    <>
      <Tavolo
        className="tavolo--partita"
        sinistra={
          <>
            <TestataGioco
              stanza={stanza}
              // Chi è ancora in gioco conferma prima di uscire: i suoi turni continuano senza di lui.
              onEsci={giocoIo ? () => setUscita(true) : onEsci}
              onImpostazioni={() => setImpostazioni(true)}
              onBancarotta={me && inCorso ? () => setBancarotta(true) : undefined}
            />
            <section className="pannello pannello--scuro pannello-giocatori" aria-label="Giocatori">
              <ul>
                {partita.giocatori.map((g) => {
                  const offlineDa = vivi.get(g.id)?.offlineDa ?? null;
                  const turno = inCorso && g.id === corrente?.id;
                  return (
                    <RigaGiocatoreGioco
                      key={g.id}
                      g={{
                        id: g.id,
                        nome: g.nome,
                        colore: g.colore,
                        host: g.id === stanza.host,
                        tu: g.id === io,
                        bot: bot.has(g.id),
                        // Di chi è fuori dalla partita non interessa se è collegato.
                        connesso: g.eliminato !== null || (connessi.get(g.id) ?? false),
                        saldo: g.saldo,
                        turno,
                        prigione: g.prigione !== null ? tentativoPrigione(g) : null,
                        vacanza: g.vacanza,
                        fuori: g.eliminato !== null,
                        esito: g.eliminato ? ESITO_USCITA[g.eliminato.motivo] : undefined,
                        assenteFino: inCorso && !g.eliminato && offlineDa !== null ? offlineDa + ASSENZA_MS : undefined,
                        squadra: g.squadra === null ? undefined : { indice: g.squadra, nome: partita.squadre[g.squadra] ?? '' },
                        variazione: variazioni[g.id],
                        bancarotta: scena.bancarotta?.giocatore === g.id,
                      }}
                      puoTogliere={puoTogliere}
                      bloccoTogli={
                        g.id === vivo.turno.giocatore ? 'Non puoi togliere chi sta giocando il suo turno: aspetta che finisca.' : null
                      }
                      onTogli={() => setDaTogliere(g)}
                      voto={
                        inCorso && g.id === vivo.turno.giocatore ? (
                          <VotoNellaRiga partita={vivo} io={giocoIo} inviando={inviando} onMossa={mossa} />
                        ) : undefined
                      }
                    />
                  );
                })}
              </ul>
            </section>
            {chatRichiusa.chiusa ? (
              <ChatChiusa nuovi={chatRichiusa.nuovi} ultimo={chatRichiusa.ultimo} onApri={chatRichiusa.apri} />
            ) : (
              <Chat stanza={stanza} io={io} messaggi={chat} scrivono={scrivono} onRiduci={chatRichiusa.chiudi} />
            )}
          </>
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
                  passoMs: scena.passoMs[g.id],
                  arrivi: scena.arrivi[g.id],
                  volo: scena.voli[g.id],
                  sprofonda: scena.bancarotta?.giocatore === g.id,
                  evidenziata: inCorso && g.id === corrente?.id,
                };
              })}
            centro={centro}
            selezionata={scheda ?? undefined}
            arrivo={inCorso && scena.arrivo ? { n: scena.arrivo.casella, tono: scena.arrivo.tono } : undefined}
            meta={metaDadi}
            lampeggia={scena.lampeggia}
            sbarre={scena.sbarre}
            sfila={scena.bancarotta?.caselle}
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
                      onChiedi={
                        proprietarioScheda ? () => chiedi(popoverBordo, proprietarioScheda) : undefined
                      }
                      className={stilePopover(popoverBordo, tab.caselle.length).classe}
                      style={stilePopover(popoverBordo, tab.caselle.length).stile}
                    />
                  )}
                </AnimatePresence>
                {/* La carta pescata: esce dalla casella, si legge al centro, torna nella scheda dell'evento. */}
                <AnimatePresence>
                  {cartaInScena && <motion.div key={`velo-${cartaInScena.n}`} className="carta-velo" {...VELO} />}
                  {cartaInScena && (
                    <CartaPescata
                      key={`carta-${cartaInScena.n}`}
                      mazzo={cartaInScena.mazzo}
                      testo={cartaInScena.testo}
                      regione={regioneCarta}
                      da={geometria(tab.caselle.length).centro(cartaInScena.casella)}
                      didascalia={
                        chiPesca && (
                          <>
                            <Pedina colore={chiPesca.colore} className="pedina--mini" />
                            {chiPesca.id === io ? 'Peschi' : `${chiPesca.nome} pesca`} {cartaInScena.mazzo === 'busta' ? 'una Busta' : 'una Cartolina'}
                          </>
                        )
                      }
                    />
                  )}
                </AnimatePresence>
                {/* Tocca a me: il bordo del tabellone si accende d'ambra per un attimo. */}
                {mioTurno && <span key={`alone-${partita.turno.numero}`} className="alone-turno" aria-hidden="true" />}
                {/* L'esito di uno scambio: accettato lo vedono tutti, rifiutato solo chi l'aveva proposto. */}
                <AnimatePresence>
                  {timbro && (
                    <TimbroScambio key={`timbro-${timbro.n}`} partita={vivo} io={io} tipo={timbro.tipo} da={timbro.da} a={timbro.a} />
                  )}
                </AnimatePresence>
                {/* Le proposte arrivate quando non potevano aprirsi da sole (dopo il timbro di un esito: una cosa alla volta). */}
                <AnimatePresence>
                  {giocoIo && daVedere.length > 0 && !finestraScambio && !timbro && (
                    <BigliettoProposta
                      key="biglietto"
                      partita={vivo}
                      io={giocoIo}
                      scambi={daVedere}
                      onVedi={(id) => {
                        setBiglietti((x) => x.filter((y) => y !== id));
                        apriScambio({ tipo: 'vedi', id });
                      }}
                      onDopo={() => setBiglietti([])}
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

      {vistaInCorso && !inCorso && festa && festaPronta && io !== null && haVinto(partita, io) && (
        <Coriandoli onFine={() => setFesta(false)} />
      )}

      <VoliGettoni gettoni={scena.gettoni} />

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
