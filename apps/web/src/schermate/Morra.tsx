/*
 * Giro del mondo, la sfida a morra cinese: il riquadro sopra il tabellone (come l'asta).
 * - Scelta: chi è caduto sulla città di un avversario paga l'affitto oppure lo sfida scegliendo il segno.
 * - Morra: la sfida è lanciata; lo sfidato sceglie il suo segno entro il tempo (poi a caso), gli altri guardano.
 * - Scena: le due mani battono tre volte («sasso, carta, forbici!»), si aprono sui segni e sotto arriva il verdetto;
 *   poi si accende la posta uscita. Un momento per volta, e metà scena per leggere.
 * Il titolo del riquadro dice chi sfida chi; scelta e morra hanno la stessa altezza, così il riquadro non salta.
 * Cosa mostrare e quando lo decide sfida.ts (`quadroSfida`); la scena la tiene la regia (`scena.morra`), che dura
 * esattamente TEMPI.morra come aspettano i bot. Il tempo che resta si conta con l'orologio del server, come all'asta.
 */

import '../stili/morra.css';
import type { ReactNode } from 'react';
import { MORRA_MS, SCELTA_MS, SEGNI, tabellone, verifica, type Azione, type IdGiocatore, type Mossa, type Segno, type Sfida, type Stato } from '@poordown/engine';
import { collegamento } from '../rete/sessione';
import { useTicchettio } from '../suoni/richiami';
import { useBattito } from '../ui/battito';
import { caselleVista, nomeInRiga } from '../ui/caselle';
import { Pedina, Soldi, Stemma } from '../ui/comuni';
import { RiquadroTabellone } from '../ui/Finestra';
import { Icona } from '../ui/icone';
import { iniziale, variabili } from '../ui/utili';
import type { MorraInScena } from './regia';
import { NOME_SEGNO, poste, ruolo, tempiMorra, vincitore, type QuadroSfida, type Ruolo } from './sfida';

/**
 * Il segno che ho lanciato: la vista dei browser lo toglie dalla sfida finché la morra non si chiude, quindi lo
 * ricorda il browser (anche se il riquadro rinasce). Vale solo per la sfida dello stesso turno sulla stessa casella.
 */
let mioSegno: { chiave: string; segno: Segno } | null = null;

function chiaveSfida(partita: Stato, sf: Pick<Sfida, 'casella' | 'sfidante'>): string {
  return `${partita.turno.numero}:${sf.sfidante}:${sf.casella}`;
}

export function Morra({
  quadro,
  partita,
  io,
  inviando,
  onMossa,
}: {
  quadro: QuadroSfida;
  /** La partita aggiornata (non quella che aspetta le animazioni): il tempo della sfida conta ogni secondo. */
  partita: Stato;
  io: IdGiocatore | null;
  inviando: boolean;
  onMossa: (m: Mossa) => void;
}): ReactNode {
  useBattito(200);
  const sf = quadro.tipo === 'scena' ? null : quadro.sfida;
  const restanti = sf ? Math.max(0, sf.scadenza - collegamento.orologio()) : 0;
  const secondi = Math.ceil(restanti / 1000);
  // Chi deve decidere sente gli ultimi tre secondi.
  const decido = quadro.tipo === 'scelta' || (quadro.tipo === 'morra' && quadro.ruolo === 'proprietario');
  useTicchettio(decido && restanti > 0 ? secondi : null, 3, 0.8);

  const nome = (id: IdGiocatore) => partita.giocatori.find((g) => g.id === id)?.nome ?? '?';
  const blocco = (m: Mossa): string | null => {
    if (inviando) return 'Un attimo…';
    if (restanti <= 0) return 'Tempo scaduto.';
    if (io === null) return 'Stai guardando la partita.';
    return verifica(partita, { ...m, giocatore: io } as Azione)?.messaggio ?? null;
  };

  if (quadro.tipo === 'scelta') {
    const sfida = quadro.sfida;
    const lancia = (segno: Segno) => {
      mioSegno = { chiave: chiaveSfida(partita, sfida), segno };
      onMossa({ tipo: 'sfida', segno });
    };
    return (
      <RiquadroTabellone titolo="Paga o sfida" className="morra">
        <div className="morra__corpo morra__corpo--scelta">
          <Citta partita={partita} sfida={sfida} />
          <div className="morra__scelte">
            <section className="morra__paga" aria-label="Paga l’affitto">
              <p className="morra__voce">Paga l’affitto</p>
              <Soldi valore={sfida.importo} misura="l" className="morra__affitto" />
              {/* Quanto si paga lo dice già la cifra grande qui sopra. */}
              <PulsanteMorra blocco={blocco({ tipo: 'paga_affitto' })} className="morra__pagamento" onClick={() => onMossa({ tipo: 'paga_affitto' })}>
                <Icona nome="monete" />
                Paga
              </PulsanteMorra>
            </section>
            <p className="morra__oppure">oppure</p>
            <section className="morra__sfida" aria-label="Sfida a morra cinese">
              <p className="morra__voce">Sfida {nome(sfida.proprietario)} a morra</p>
              <Segni blocco={(segno) => blocco({ tipo: 'sfida', segno })} onScegli={lancia} />
              <Poste affitto={sfida.importo} r="sfidante" sfida={sfida} nome={nome} />
            </section>
          </div>
          <Tempo
            quota={Math.min(1, restanti / SCELTA_MS)}
            secondi={secondi}
            testo={restanti > 0 ? `Tra ${secondi} s paghi l’affitto` : 'Tempo scaduto: paghi l’affitto'}
          />
        </div>
      </RiquadroTabellone>
    );
  }

  // Morra lanciata (o in scena): le due mani, chi sfida a sinistra e chi è sfidato a destra.
  const { scena, da, a, casella, affitto } =
    quadro.tipo === 'scena'
      ? { scena: quadro.morra, da: quadro.morra.da, a: quadro.morra.a, casella: quadro.morra.casella, affitto: quadro.affitto }
      : { scena: null, da: quadro.sfida.sfidante, a: quadro.sfida.proprietario, casella: quadro.sfida.casella, affitto: quadro.sfida.importo };
  const r: Ruolo = quadro.ruolo;
  const chiave = chiaveSfida(partita, { sfidante: da, casella });
  const ricordato = mioSegno?.chiave === chiave ? mioSegno.segno : null;
  const vince = scena ? vincitore(scena) : null;
  // Il verdetto: a chi gioca ambra se vince (il colore del vincitore) e rosso pieno se perde, così non si confonde
  // con le pedine, che sono tutte chiare; per gli altri il colore di chi vince. Il pari resta chiaro.
  const coloreVerdetto =
    vince === null ? null : r === 'spettatore' ? coloreDi(partita, vince) : vince === io ? 'var(--ambra)' : 'var(--rosso)';
  // Il titolo del riquadro dice chi sfida chi, dal punto di vista di chi guarda.
  const titolo = r === 'proprietario' ? `${nome(da)} ti sfida!` : r === 'sfidante' ? `Hai sfidato ${nome(a)}` : `${nome(da)} sfida ${nome(a)}`;
  const t = tempiMorra();

  // Sotto le mani: i segni per lo sfidato, il segno lanciato per chi ha sfidato, l'attesa per gli altri; in scena il
  // verdetto (quanto passa di mano lo dice la posta che si accende).
  let sotto: ReactNode;
  if (scena) {
    sotto = (
      <p className="morra__verdetto" style={coloreVerdetto ? variabili({ '--colore': coloreVerdetto }) : undefined}>
        {verdetto(scena, r, nome)}
      </p>
    );
  } else if (r === 'proprietario') {
    sotto = <Segni blocco={(segno) => blocco({ tipo: 'morra', segno })} onScegli={(segno) => onMossa({ tipo: 'morra', segno })} />;
  } else if (r === 'sfidante') {
    sotto = (
      <p className="morra__stato">
        {ricordato ? (
          <>
            Hai lanciato
            <span className="morra__lanciato">
              <Icona nome={ricordato} />
              {NOME_SEGNO[ricordato]}
            </span>
          </>
        ) : (
          'Hai lanciato il tuo segno'
        )}
      </p>
    );
  } else {
    sotto = <p className="morra__stato">{nome(a)} sta scegliendo il segno…</p>;
  }

  return (
    <RiquadroTabellone titolo={titolo} className="morra">
      <div
        className="morra__corpo"
        style={variabili({
          '--morra-battuta': `${t.battute[0]}ms`,
          '--morra-apertura': `${t.apertura}ms`,
          '--morra-esito': `${t.esito}ms`,
        })}
      >
        <Citta partita={partita} sfida={{ casella, proprietario: a }} breve />
        <div className={scena ? 'morra-palco morra-palco--scena' : 'morra-palco'}>
          <Lato partita={partita} id={da} segno={scena?.segni[0] ?? null} esito={latoEsito(vince, da)} />
          <div className="morra-palco__centro" aria-hidden={scena ? true : undefined}>
            {scena ? (
              <>
                <span className="morra-palco__parola morra-palco__parola--1">Sasso</span>
                <span className="morra-palco__parola morra-palco__parola--2">carta</span>
                <span className="morra-palco__parola morra-palco__parola--3">forbici!</span>
              </>
            ) : (
              <span className="morra-palco__contro">contro</span>
            )}
          </div>
          <Lato partita={partita} id={a} segno={scena?.segni[1] ?? null} esito={latoEsito(vince, a)} destra />
        </div>
        <div className="morra__sotto" aria-live="polite">
          {sotto}
        </div>
        <Poste affitto={affitto} r={r} sfida={{ sfidante: da, proprietario: a }} nome={nome} uscita={scena?.esito} />
        {quadro.tipo === 'morra' ? (
          <Tempo
            quota={Math.min(1, restanti / MORRA_MS)}
            secondi={secondi}
            testo={
              restanti <= 0
                ? 'Tempo scaduto: un segno a caso'
                : r === 'proprietario'
                  ? `Scegli entro ${secondi} s, poi un segno a caso`
                  : `${nome(a)} ha ${secondi} s per scegliere`
            }
          />
        ) : (
          // In scena il tempo non c'è più, ma lo spazio resta: il riquadro non salta.
          <Tempo quota={0} secondi={0} testo="" nascosto />
        )}
      </div>
    </RiquadroTabellone>
  );
}

/* ------------------------------------------------------------------ */

/** La città della sfida: stemma (o bandiera) e nome; per intero anche il padrone. */
function Citta({ partita, sfida, breve }: { partita: Stato; sfida: Pick<Sfida, 'casella' | 'proprietario'>; breve?: boolean }): ReactNode {
  const tab = tabellone(partita.mappa);
  const c = caselleVista(partita.mappa)[sfida.casella];
  const padrone = partita.giocatori.find((g) => g.id === sfida.proprietario);
  return (
    <p className={breve ? 'morra__citta morra__citta--breve' : 'morra__citta'}>
      {c?.gruppo !== undefined ? (
        <Stemma regione={tab.regioni[c.gruppo - 1]} className="morra__stemma" />
      ) : (
        c?.icona && <Icona nome={c.icona} className="morra__icona" />
      )}
      <span>
        {breve ? 'Per l’affitto di ' : ''}
        <b>{c && nomeInRiga(c)}</b>
      </span>
      {!breve && padrone && (
        <span className="morra__padrone">
          di
          <Pedina colore={padrone.colore} className="pedina--mini" />
          {padrone.nome}
        </span>
      )}
    </p>
  );
}

/**
 * Un lato del palco: il pugno d'attesa, tenue e senza colore (non è ancora una mossa), che si apre sul segno nel
 * colore del giocatore; sotto il nome.
 */
function Lato({
  partita,
  id,
  segno,
  esito,
  destra,
}: {
  partita: Stato;
  id: IdGiocatore;
  /** Il segno da mostrare quando la mano si apre (solo in scena). */
  segno: Segno | null;
  esito: 'vince' | 'perde' | null;
  destra?: boolean;
}): ReactNode {
  const g = partita.giocatori.find((x) => x.id === id);
  const classi = ['morra-palco__lato', destra ? 'morra-palco__lato--destra' : '', esito ? `morra-palco__lato--${esito}` : '']
    .filter(Boolean)
    .join(' ');
  return (
    <div className={classi} style={variabili({ '--colore': coloreDi(partita, id) })}>
      <span className="morra-mano" aria-hidden="true">
        <span className="morra-mano__pugno">
          <Icona nome="sasso" />
        </span>
        {segno && (
          <span className="morra-mano__segno">
            <Icona nome={segno} />
          </span>
        )}
      </span>
      <p className="morra-palco__chi">
        {g && <Pedina colore={g.colore} iniziale={iniziale(g.nome)} className="morra-palco__pedina" />}
        <span>{g?.nome ?? '?'}</span>
      </p>
      {/* Il nome del segno compare quando la mano si apre; la riga c'è sempre, così il palco non cresce. */}
      <p className="morra-palco__segno">{segno ? NOME_SEGNO[segno] : ' '}</p>
    </div>
  );
}

/** I tre segni da scegliere: scegliere il segno è già la mossa (lancia la sfida o risponde). */
function Segni({ blocco, onScegli }: { blocco: (segno: Segno) => string | null; onScegli: (segno: Segno) => void }): ReactNode {
  return (
    <div className="morra__segni" role="group" aria-label="Scegli il segno">
      {SEGNI.map((segno) => (
        <PulsanteMorra key={segno} blocco={blocco(segno)} className="morra__segno" onClick={() => onScegli(segno)}>
          <Icona nome={segno} />
          {NOME_SEGNO[segno]}
        </PulsanteMorra>
      ))}
    </div>
  );
}

/** Un pulsante del riquadro, con il suggerimento che dice perché è spento (come i rilanci dell'asta). */
function PulsanteMorra({
  blocco,
  className,
  onClick,
  children,
}: {
  blocco: string | null;
  className: string;
  onClick: () => void;
  children: ReactNode;
}): ReactNode {
  return (
    <span className="con-suggerimento" data-testo={blocco ?? undefined}>
      <button type="button" className={`pulsante pulsante--secondario ${className}`} disabled={blocco !== null} onClick={onClick}>
        {children}
      </button>
    </span>
  );
}

/** Cosa c'è in gioco: i tre esiti con i soldi. In scena si accende quello uscito. */
function Poste({
  affitto,
  r,
  sfida,
  nome,
  uscita,
}: {
  affitto: number;
  r: Ruolo;
  sfida: Pick<Sfida, 'sfidante' | 'proprietario'>;
  nome: (id: IdGiocatore) => string;
  uscita?: MorraInScena['esito'];
}): ReactNode {
  return (
    <ul className={uscita ? 'morra__poste morra__poste--esito' : 'morra__poste'} aria-label="Cosa c’è in gioco">
      {poste(affitto, r, nome, sfida).map((p) => (
        <li
          key={p.esito}
          className={['morra__posta', `morra__posta--${p.tono}`, uscita === p.esito ? 'morra__posta--uscita' : ''].filter(Boolean).join(' ')}
        >
          <span className="morra__esito">{p.etichetta}</span>
          <Soldi valore={p.importo} misura="s" />
        </li>
      ))}
    </ul>
  );
}

function Tempo({ quota, secondi, testo, nascosto }: { quota: number; secondi: number; testo: string; nascosto?: boolean }): ReactNode {
  return (
    <div className={nascosto ? 'morra__tempo morra__tempo--nascosto' : 'morra__tempo'} aria-hidden={nascosto || undefined}>
      <div className="morra__barra" role="presentation">
        <span style={variabili({ '--quota': String(quota) })} />
      </div>
      <p className={secondi <= 3 && !nascosto ? 'morra__scadenza morra__scadenza--poco' : 'morra__scadenza'}>{testo}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function coloreDi(partita: Stato, id: IdGiocatore): string {
  return `var(--p${partita.giocatori.find((g) => g.id === id)?.colore ?? 1})`;
}

function latoEsito(vince: IdGiocatore | null, id: IdGiocatore): 'vince' | 'perde' | null {
  if (vince === null) return null;
  return vince === id ? 'vince' : 'perde';
}

/** La parola grande sotto le mani, quando si sono aperte: a chi gioca parla in seconda persona. */
function verdetto(m: MorraInScena, r: Ruolo, nome: (id: IdGiocatore) => string): string {
  if (m.esito === 'pari') return 'Pari';
  const vince = vincitore(m)!;
  if (r === 'spettatore') return `Vince ${nome(vince)}`;
  return ruolo(vince, m.da, m.a) === r ? 'Hai vinto' : 'Hai perso';
}
