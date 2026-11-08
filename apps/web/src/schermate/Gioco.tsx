import '../stili/gioco.css';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  costoProssimoEdificio,
  costoRiscatto,
  euro,
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
import { caselleVista } from '../ui/caselle';
import { Dado, Pedina, Registro, Stemma } from '../ui/comuni';
import { iniziale } from '../ui/utili';
import { stilePopover } from '../ui/geometria';
import { Icona, type NomeIcona } from '../ui/icone';
import { Asta } from './Asta';
import { ColonnaSinistra, Finestra, ListaImpostazioni, RigaGiocatore, Tavolo } from './Colonne';
import { useScena } from './regia';
import { EditorScambio, PannelloScambi, VediScambio } from './Scambi';
import { SchedaProprieta, Tabellone } from './Tabellone';
import { righeRegistro } from './testi';

/** `null` se la mossa si può fare adesso, altrimenti il motivo (per il suggerimento del pulsante). */
function motivo(partita: Stato, io: IdGiocatore, mossa: Mossa): string | null {
  return verifica(partita, { ...mossa, giocatore: io } as Azione)?.messaggio ?? null;
}

function Pulsante({
  testo,
  icona,
  stile = 'primario',
  grande,
  blocco,
  onClick,
}: {
  testo: string;
  icona: Parameters<typeof Icona>[0]['nome'];
  stile?: 'primario' | 'secondario';
  grande?: boolean;
  /** Perché non si può premere, `null` se si può. */
  blocco: string | null;
  onClick: () => void;
}): ReactNode {
  const pulsante = (
    <button
      type="button"
      className={`pulsante pulsante--${stile}${grande ? ' pulsante--grande' : ''}`}
      disabled={blocco !== null}
      onClick={onClick}
    >
      <Icona nome={icona} />
      {testo}
    </button>
  );
  // Un pulsante disattivato non riceve il passaggio del mouse: il suggerimento sta sul contenitore.
  return blocco ? (
    <span className="con-suggerimento" data-testo={blocco}>
      {pulsante}
    </span>
  ) : (
    pulsante
  );
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
function cosaFa(attivita: Attivita | undefined): string {
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
type FinestraScambio = { tipo: 'crea'; base?: number } | { tipo: 'vedi'; id: number };

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

  if (t.fase === 'prigione') {
    const tentativo = Math.min((me.prigione ?? 0) + 1, TENTATIVI_PRIGIONE);
    return (
      <>
        <div className="centro-gioco__azioni">
          <Pulsante testo="Tira i dadi" icona="dado" blocco={blocco({ tipo: 'lancia' })} onClick={() => onMossa({ tipo: 'lancia' })} />
          <Pulsante
            testo={`Paga ${euro(tab.cauzione)}`}
            icona="euro"
            stile="secondario"
            blocco={blocco({ tipo: 'paga_cauzione' })}
            onClick={() => onMossa({ tipo: 'paga_cauzione' })}
          />
          {me.carteGrazia.length > 0 && (
            <Pulsante
              testo="Usa la Carta Grazia"
              icona="grazia"
              stile="secondario"
              blocco={blocco({ tipo: 'usa_grazia' })}
              onClick={() => onMossa({ tipo: 'usa_grazia' })}
            />
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
        <Pulsante testo="Tira i dadi" icona="dado" grande blocco={blocco({ tipo: 'lancia' })} onClick={() => onMossa({ tipo: 'lancia' })} />
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
        <Pulsante
          testo="Asta"
          icona="martelletto"
          stile="secondario"
          blocco={blocco({ tipo: 'asta' })}
          onClick={() => onMossa({ tipo: 'asta' })}
        />
      )}
      {libera && (
        <Pulsante
          testo={`Compra per ${euro(acquisto.prezzo)}`}
          icona="piu"
          blocco={blocco({ tipo: 'compra' })}
          onClick={() => onMossa({ tipo: 'compra' })}
        />
      )}
      {daDecidere ? null : t.rilancio ? (
        <Pulsante testo="Tira ancora" icona="dado" blocco={blocco({ tipo: 'lancia' })} onClick={() => onMossa({ tipo: 'lancia' })} />
      ) : (
        <Pulsante
          testo="Termina il turno"
          icona="spunta"
          stile={libera ? 'secondario' : 'primario'}
          blocco={blocco({ tipo: 'fine_turno' })}
          onClick={() => onMossa({ tipo: 'fine_turno' })}
        />
      )}
    </div>
  );
}

function FinePartita({ partita, onEsci }: { partita: Stato; onEsci: () => void }): ReactNode {
  const vincitore = partita.giocatori.find((g) => g.id === partita.vincitore);
  return (
    <div className="fine-partita">
      <p className="fine-partita__titolo">Partita finita!</p>
      {vincitore && (
        <p className="fine-partita__vincitore">
          <Pedina colore={vincitore.colore} iniziale={iniziale(vincitore.nome)} className="pedina--grande" />
          <span>
            Vince <b>{vincitore.nome}</b>
          </span>
        </p>
      )}
      <button type="button" className="pulsante pulsante--primario" onClick={onEsci}>
        <Icona nome="partenza" />
        Torna alla home
      </button>
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
  const [consiglio, setConsiglio] = useState(true);
  const [finestraChiesta, setFinestraScambio] = useState<FinestraScambio | null>(null);

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
  const finestraScambio = finestraValida ? finestraChiesta : null;

  // Gli altri vedono se sto creando, guardando o trattando uno scambio.
  useEffect(() => collegamento.segnalaAttivita(attivitaDi(finestraScambio)), [finestraScambio]);
  useEffect(() => () => collegamento.segnalaAttivita(null), []);

  // Chi riceve una proposta la vede subito, a meno che non stia già preparando uno scambio.
  const finestraAttuale = useRef(finestraScambio);
  useEffect(() => {
    finestraAttuale.current = finestraScambio;
  }, [finestraScambio]);
  useEffect(
    () =>
      collegamento.ascoltaVoci((voci) => {
        for (const v of voci) {
          const e = v.evento;
          if (e.tipo !== 'scambio_proposto' || e.a !== io) continue;
          if (finestraAttuale.current?.tipo === 'crea') {
            const da = collegamento.leggi().stanza?.partita?.giocatori.find((g) => g.id === e.da);
            avvisa(`${da?.nome ?? 'Un giocatore'} ti ha proposto uno scambio: lo trovi in «Scambi».`);
          } else {
            setFinestraScambio({ tipo: 'vedi', id: e.scambio });
          }
        }
      }),
    [io],
  );



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
          <b>{corrente.nome}</b> {cosaFa(attivita[corrente.id])}
        </p>
      </div>
    );
  }

  const inRosso = me && me.saldo < 0 && inCorso && !scena.occupata;
  const centro = (
    <div className="centro-gioco">
      <div className="centro-gioco__timer" />
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
        </>
      ) : (
        <FinePartita partita={partita} onEsci={onEsci} />
      )}
      <Registro righe={righe} />
    </div>
  );

  /* ---------- Colonna destra ---------- */

  const connessi = new Map(stanza.partecipanti.map((p) => [p.id, p.connesso]));
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
          className={`pulsante pulsante--piccolo ${p.ipotecata ? 'pulsante--secondario' : 'pulsante--ambra'}`}
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
    finestraSopra = <Asta partita={vivo} io={giocoIo} inviando={inviando} onOffri={(importo) => mossa({ tipo: 'offri', importo })} />;
  } else if (finestraScambio?.tipo === 'vedi' && scambioVisto) {
    finestraSopra = (
      <VediScambio
        key={scambioVisto.id}
        partita={vivo}
        io={giocoIo}
        scambio={scambioVisto}
        attivita={attivita}
        inviando={inviando}
        onMossa={(m) => mossa(m, () => setFinestraScambio(null))}
        onTratta={() => setFinestraScambio({ tipo: 'crea', base: scambioVisto.id })}
        onChiudi={() => setFinestraScambio(null)}
      />
    );
  } else if (finestraScambio?.tipo === 'crea' && giocoIo) {
    finestraSopra = (
      <EditorScambio
        key={finestraScambio.base ?? 'nuovo'}
        partita={vivo}
        io={giocoIo}
        base={baseTrattativa}
        inviando={inviando}
        onInvia={(proposta) => mossa(proposta, () => setFinestraScambio(null))}
        onChiudi={() => setFinestraScambio(null)}
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
            onEsci={onEsci}
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
                {popoverBordo !== null && (
                  <SchedaProprieta
                    key={popoverBordo}
                    mappa={partita.mappa}
                    partita={partita}
                    n={popoverBordo}
                    onChiudi={() => setScheda(null)}
                    className={stilePopover(popoverBordo).classe}
                    style={stilePopover(popoverBordo).stile}
                  />
                )}
                {finestraSopra}
              </>
            }
          />
        }
        destra={
          <>
            <section className="pannello pannello--scuro giocatori" aria-label="Giocatori">
              <ul>
                {partita.giocatori.map((g) => (
                  <RigaGiocatore
                    key={g.id}
                    g={{
                      id: g.id,
                      nome: g.nome,
                      colore: g.colore,
                      host: g.id === stanza.host,
                      tu: g.id === io,
                      connesso: connessi.get(g.id) ?? false,
                      saldo: g.saldo,
                      turno: inCorso && g.id === corrente?.id,
                      prigione: g.prigione !== null && !g.eliminato,
                      fuori: g.eliminato !== null,
                    }}
                  />
                ))}
              </ul>
            </section>

            {me && inCorso && (
              <div className="bancarotta">
                <button
                  type="button"
                  className="pulsante pulsante--piccolo pulsante--rosso"
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
                onCrea={giocoIo ? () => setFinestraScambio({ tipo: 'crea' }) : undefined}
                onApri={(id) => setFinestraScambio({ tipo: 'vedi', id })}
              />
            )}

            {me ? (
              <section className="pannello mie" aria-labelledby="titolo-mie">
                <header className="pannello__testa pannello__testa--centrata">
                  <h2 id="titolo-mie" className="pannello__titolo">
                    Le mie proprietà <span className="pannello__conta">({mie.length})</span>
                  </h2>
                </header>
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
                        <li key={n}>
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
                              <Stemma gruppo={c.gruppo} nome={tab.regioni[c.gruppo - 1]?.nome ?? ''} className="stemma--lista" />
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
                        </li>
                      );
                    })}
                    {me.carteGrazia.map((mazzo, i) => (
                      <li key={`${mazzo}-${i}`}>
                        <span className="mie__voce mie__voce--grazia" title="Ti fa uscire gratis di prigione">
                          <Icona nome="grazia" className="mie__icona" />
                          <span className="mie__nome">Carta Grazia</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
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

      {mia && casellaMia && (
        <SchedaProprieta
          key={`mia-${mia.n}`}
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

      {impostazioni && (
        <Finestra titolo="Impostazioni della stanza" onChiudi={() => setImpostazioni(false)} larga>
          <div className="finestra__scorri">
            <p className="impostazioni__nota">Durante la partita le impostazioni non si possono cambiare.</p>
            <ListaImpostazioni imp={partita.impostazioni} modificabile={false} />
          </div>
        </Finestra>
      )}

      {bancarotta && (
        <Finestra titolo="Dichiara bancarotta" onChiudi={() => setBancarotta(false)}>
          <div className="finestra__corpo">
            <p>Esci dalla partita e le tue proprietà tornano alla banca. Non si può annullare.</p>
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
    </>
  );
}
