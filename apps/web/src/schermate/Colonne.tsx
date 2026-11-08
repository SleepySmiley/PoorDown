import '../stili/tavolo.css';
import '../stili/squadre.css';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence } from 'motion/react';
import {
  euro,
  GIOCATORI_MAX,
  GIOCATORI_MIN,
  SOLDI_INIZIALI_POSSIBILI,
  tabellone,
  type IdGiocatore,
  type Impostazioni,
  type MessaggioChat,
  type VistaStanza,
} from '@poordown/engine';
import { CodiceQr } from '../CodiceQr';
import { linkStanza, useInfoServer } from '../rete/sessione';
import { Chip } from '../ui/Chip';
import { Interruttore, Pedina, PulsanteIcona, Soldi } from '../ui/comuni';
import { Finestra } from '../ui/Finestra';
import { iniziale } from '../ui/utili';
import { Icona, type NomeIcona } from '../ui/icone';
import { PassiDelGioco } from '../ui/Regole';
import { BollaChat, Chat } from './Chat';
import { ContoAllaRovescia } from './Timer';

/* ---------------- Impaginazione a tre colonne ---------------- */

export function Tavolo({ sinistra, centro, destra }: { sinistra: ReactNode; centro: ReactNode; destra: ReactNode }): ReactNode {
  return (
    <div className="tavolo">
      <aside className="tavolo__colonna tavolo__colonna--sinistra">{sinistra}</aside>
      <main className="tavolo__centro">{centro}</main>
      <aside className="tavolo__colonna tavolo__colonna--destra">{destra}</aside>
    </div>
  );
}

/* ---------------- Finestre ---------------- */

// Finestra e RiquadroTabellone stanno in ui/Finestra.tsx: restano importabili anche da qui.
export { Finestra, RiquadroTabellone } from '../ui/Finestra';

/* ---------------- Colonna sinistra ---------------- */

/**
 * Copia negli appunti. Su http://192.168.x.x il browser non dà l'API degli appunti:
 * si seleziona il testo del campo e si usa il vecchio comando di copia.
 */
async function copia(testo: string, campo: HTMLInputElement | null): Promise<boolean> {
  try {
    if (window.isSecureContext && navigator.clipboard) {
      await navigator.clipboard.writeText(testo);
      return true;
    }
  } catch {
    // si prova con il metodo alternativo
  }
  if (!campo) return false;
  campo.focus();
  campo.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  }
}

function Condividi({ link, onImpostazioni }: { link: string; onImpostazioni?: () => void }): ReactNode {
  const [esito, setEsito] = useState<'copiato' | 'seleziona' | null>(null);
  const campo = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!esito) return;
    const t = setTimeout(() => setEsito(null), 2000);
    return () => clearTimeout(t);
  }, [esito]);
  return (
    <section className="pannello condividi" aria-labelledby="titolo-condividi">
      <h2 id="titolo-condividi" className="condividi__titolo">
        Condividi la partita
        <span
          className="suggerimento-icona"
          tabIndex={0}
          data-testo="Chi ha il link può entrare nella partita. Se è già iniziata, entra come spettatore."
        >
          <Icona nome="aiuto" titolo="Informazioni" />
        </span>
      </h2>
      <div className="condividi__riga">
        <input
          ref={campo}
          className="condividi__link"
          readOnly
          value={link}
          aria-label="Link della stanza"
          onFocus={(e) => e.currentTarget.select()}
        />
        <button
          type="button"
          className="pulsante pulsante--piccolo pulsante--primario"
          onClick={() => void copia(link, campo.current).then((ok) => setEsito(ok ? 'copiato' : 'seleziona'))}
        >
          <Icona nome={esito === 'copiato' ? 'spunta' : 'copia'} />
          {esito === 'copiato' ? 'Copiato!' : 'Copia'}
        </button>
      </div>
      {esito === 'seleziona' && <p className="condividi__nota">Il link è selezionato: copialo con Ctrl+C.</p>}
      {onImpostazioni && (
        <button
          type="button"
          className="pulsante pulsante--piccolo pulsante--secondario pulsante--largo condividi__impostazioni"
          onClick={onImpostazioni}
        >
          <Icona nome="regolazioni" />
          Impostazioni della stanza
        </button>
      )}
    </section>
  );
}

function Telefono({ link, onChiudi }: { link: string; onChiudi: () => void }): ReactNode {
  return (
    <section className="pannello telefono" aria-label="Entra dal telefono">
      <button type="button" className="telefono__chiudi" aria-label="Nascondi il codice QR" onClick={onChiudi}>
        <Icona nome="chiudi" />
      </button>
      <CodiceQr testo={link} />
      <p className="telefono__testo">
        <strong>Dal telefono</strong>
        Inquadra il codice con la fotocamera: si apre questa stanza.
      </p>
    </section>
  );
}

export function ColonnaSinistra({
  stanza,
  io,
  chat,
  scrivono,
  onEsci,
  onImpostazioni,
}: {
  stanza: VistaStanza;
  io: IdGiocatore | null;
  chat: MessaggioChat[];
  scrivono: IdGiocatore[];
  onEsci: () => void;
  onImpostazioni?: () => void;
}): ReactNode {
  const info = useInfoServer();
  const link = linkStanza(stanza.codice, info);
  const [qr, setQr] = useState(true);
  const [chatRidotta, setChatRidotta] = useState(false);
  const [aiuto, setAiuto] = useState(false);
  return (
    <>
      <div className="logo-riga">
        <a
          className="insegna insegna--grande"
          href="/"
          aria-label="PoorDown, esci dalla stanza e torna alla home"
          title="Torna alla home"
          onClick={(e) => {
            e.preventDefault();
            onEsci();
          }}
        >
          PoorDown
        </a>
        <div className="logo-riga__icone">
          <PulsanteIcona icona="aiuto" etichetta="Come si gioca" onClick={() => setAiuto(true)} />
        </div>
      </div>
      <Condividi link={link} onImpostazioni={onImpostazioni} />
      {qr && <Telefono link={link} onChiudi={() => setQr(false)} />}
      {chatRidotta ? (
        <BollaChat messaggi={chat} onEspandi={() => setChatRidotta(false)} />
      ) : (
        <Chat stanza={stanza} io={io} messaggi={chat} scrivono={scrivono} onRiduci={() => setChatRidotta(true)} />
      )}
      <AnimatePresence>
        {aiuto && (
          <Finestra key="aiuto" titolo="Come si gioca" onChiudi={() => setAiuto(false)} larga>
            <div className="finestra__scorri come-si-gioca come-si-gioca--finestra">
              <PassiDelGioco subito />
            </div>
          </Finestra>
        )}
      </AnimatePresence>
    </>
  );
}

/* ---------------- Pannello giocatori ---------------- */

export interface DatiRiga {
  id: IdGiocatore;
  nome: string;
  colore: number;
  host: boolean;
  tu: boolean;
  connesso: boolean;
  saldo?: number;
  turno?: boolean;
  prigione?: boolean;
  fuori?: boolean;
  /** Per chi è fuori: perché (al posto del saldo). */
  esito?: string;
  /** In partita, per chi ha perso il collegamento: quando perde il posto (ms del server). */
  assenteFino?: number;
  /** Giocatore automatico. */
  bot?: boolean;
  /** A squadre: numero (da 0) e nome della squadra. */
  squadra?: { indice: number; nome: string };
}

/** Il numero della squadra, come il binario sui cartelli delle partenze. */
export function Binario({ indice, nome, className }: { indice: number; nome: string; className?: string }): ReactNode {
  return (
    <span className={className ? `binario ${className}` : 'binario'} title={nome} aria-label={nome}>
      {indice + 1}
    </span>
  );
}

const SPIEGA_BOT = 'Bot: gioca da solo. Compra, costruisce, offre alle aste e risponde agli scambi; in chat non scrive.';

export function RigaGiocatore({
  g,
  puoEspellere,
  etichettaEspulsione,
  bloccoEspulsione,
  onEspelli,
  onCambiaColore,
  extra,
}: {
  g: DatiRiga;
  puoEspellere?: boolean;
  etichettaEspulsione?: string;
  /** Perché adesso non si può espellere, `null` se si può. */
  bloccoEspulsione?: string | null;
  onEspelli?: () => void;
  onCambiaColore?: () => void;
  /** Controllo in più prima della X (es. la squadra, per l'host). */
  extra?: ReactNode;
}): ReactNode {
  const etichetta = etichettaEspulsione ?? `Espelli ${g.nome}`;
  const mostraSaldo = g.saldo !== undefined;
  const classi = [
    'giocatore',
    g.turno ? 'giocatore--turno' : '',
    g.tu ? 'giocatore--tu' : '',
    g.fuori ? 'giocatore--fuori' : '',
    g.connesso ? '' : 'giocatore--assente',
  ].join(' ');
  return (
    <li className={classi} style={{ ['--colore' as string]: `var(--p${g.colore})` }}>
      <span className="giocatore__pedina">
        <span className={g.prigione ? 'in-prigione' : undefined} title={g.prigione ? 'In prigione' : undefined}>
          <Pedina colore={g.colore} iniziale={iniziale(g.nome)} className="pedina--media" />
        </span>
        {/* La squadra è un numero sulla pedina, come sulla maglia: il nome resta largo. */}
        {g.squadra && <Binario indice={g.squadra.indice} nome={g.squadra.nome} className="binario--maglia" />}
      </span>
      <span className="giocatore__dati">
        <span className="giocatore__nome">
          <span className="giocatore__testo">
            {g.nome}
            {g.tu && <span className="solo-lettori"> (tu)</span>}
          </span>
          {g.bot && (
            <span className="giocatore__bot" tabIndex={0} title={SPIEGA_BOT}>
              <Icona nome="robot" className="giocatore__segno" titolo={SPIEGA_BOT} />
            </span>
          )}
          {g.host && !mostraSaldo && (
            <Chip icona="corona" className="distintivo--host">
              Host
            </Chip>
          )}
          {g.host && mostraSaldo && <Icona nome="corona" className="giocatore__segno giocatore__corona" titolo="Host" />}
          {!g.connesso &&
            (g.assenteFino === undefined ? (
              <Icona nome="scollegato" className="giocatore__segno giocatore__scollegato" titolo="Senza collegamento" />
            ) : (
              <span
                className="giocatore__assenza"
                title="Ha perso il collegamento: i suoi turni passano da soli e allo zero perde il posto. Se sta per tornare, puoi dargli più tempo."
              >
                <Icona nome="scollegato" className="giocatore__segno giocatore__scollegato" titolo="Senza collegamento" />
                <ContoAllaRovescia fino={g.assenteFino} />
              </span>
            ))}
        </span>
        {g.tu && onCambiaColore && (
          <button type="button" className="giocatore__colore" onClick={onCambiaColore}>
            <Icona nome="regolazioni" />
            Cambia colore
          </button>
        )}
      </span>
      {g.saldo !== undefined && !g.fuori && (
        <span className={g.saldo < 0 ? 'giocatore__saldo giocatore__saldo--negativo' : 'giocatore__saldo'}>
          <Soldi valore={g.saldo} />
        </span>
      )}
      {g.fuori && <span className="giocatore__esito">{g.esito ?? 'Bancarotta'}</span>}
      {extra}
      {/* La propria riga (e chi è già fuori) tiene lo spazio della X: i saldi restano in colonna. */}
      {puoEspellere &&
        (g.tu || g.fuori ? (
          <span className="pulsante-icona giocatore__senza-x" aria-hidden="true" />
        ) : bloccoEspulsione ? (
          // La X sta sul bordo destro della colonna: il suggerimento si allinea a destra, dentro la pagina.
          <span className="con-suggerimento con-suggerimento--destra" data-testo={bloccoEspulsione}>
            <button type="button" className="pulsante-icona" aria-label={etichetta} disabled>
              <Icona nome="chiudi" />
            </button>
          </span>
        ) : (
          <PulsanteIcona icona="chiudi" etichetta={etichetta} onClick={onEspelli} />
        ))}
    </li>
  );
}

/* ---------------- Impostazioni di gioco ---------------- */

interface Voce {
  chiave: keyof Impostazioni;
  icona: NomeIcona;
  nome: string;
  descrizione: string;
  /** Arriva in una fase successiva: si vede ma non si può ancora cambiare. */
  presto?: boolean;
}

const STANZA: Voce[] = [
  { chiave: 'giocatoriMax', icona: 'persone', nome: 'Giocatori massimi', descrizione: 'Quante persone possono entrare nella partita' },
  {
    chiave: 'stanzaPrivata',
    icona: 'lucchetto',
    nome: 'Stanza privata',
    descrizione: 'Non compare tra le stanze aperte: si entra solo con il link',
  },
  {
    chiave: 'bot',
    icona: 'robot',
    nome: 'Bot',
    descrizione: 'Dei giocatori automatici occupano i posti liberi; chi arriva dopo prende il posto di un bot',
  },
  {
    chiave: 'squadre',
    icona: 'squadre',
    nome: 'Squadre',
    descrizione: 'I compagni non si pagano l’affitto, costruiscono sulle regioni della squadra e vincono insieme',
  },
  { chiave: 'mappa', icona: 'mappa', nome: 'Tabellone', descrizione: 'Caselle, città e mazzi della partita' },
  {
    chiave: 'timerTurno',
    icona: 'orologio',
    nome: 'Timer di turno',
    descrizione: 'Ogni turno ha un tempo limite: allo scadere il gioco tira i dadi e finisce il turno',
  },
];

const REGOLE: Voce[] = [
  {
    chiave: 'affittoDoppioSetCompleto',
    icona: 'monete',
    nome: 'Affitto doppio con la regione completa',
    descrizione: 'Chi possiede tutte le città di una regione incassa il doppio dell’affitto base',
  },
  {
    chiave: 'cassaVacanza',
    icona: 'vacanza',
    nome: 'Cassa della Vacanza',
    descrizione: 'Chi si ferma in Vacanza incassa le tasse e i pagamenti fatti alla banca',
  },
  {
    chiave: 'aste',
    icona: 'martelletto',
    nome: 'Aste',
    descrizione: 'Se chi si ferma su una proprietà non la compra, va all’asta',
  },
  {
    chiave: 'nienteAffittoInPrigione',
    icona: 'ribasso',
    nome: 'Niente affitto dalla prigione',
    descrizione: 'Chi è in prigione non incassa gli affitti',
  },
  {
    chiave: 'ipoteche',
    icona: 'banca',
    nome: 'Ipoteche',
    descrizione: 'Ipoteca una proprietà per metà del suo prezzo; finché è ipotecata non incassi l’affitto',
  },
  {
    chiave: 'costruzioneUniforme',
    icona: 'uniforme',
    nome: 'Costruzione uniforme',
    descrizione: 'Case e alberghi si costruiscono e si vendono in modo uniforme nella regione',
  },
  { chiave: 'soldiIniziali', icona: 'banconota', nome: 'Soldi iniziali', descrizione: 'Con quanti soldi parte ogni giocatore' },
  {
    chiave: 'ordineCasuale',
    icona: 'mescola',
    nome: 'Ordine casuale',
    descrizione: 'L’ordine dei turni viene estratto a sorte all’inizio della partita',
  },
];

const NUMERI_GIOCATORI = Array.from({ length: GIOCATORI_MAX - GIOCATORI_MIN + 1 }, (_, i) => i + GIOCATORI_MIN);

function Controllo({
  voce,
  imp,
  modificabile,
  onCambia,
  onTabelloni,
}: {
  voce: Voce;
  imp: Impostazioni;
  modificabile: boolean;
  onCambia: (modifiche: Partial<Impostazioni>) => void;
  onTabelloni?: () => void;
}): ReactNode {
  const attivo = modificabile && !voce.presto;
  switch (voce.chiave) {
    case 'giocatoriMax':
      return (
        <select
          className="scelta"
          value={imp.giocatoriMax}
          disabled={!attivo}
          aria-label={voce.nome}
          onChange={(e) => onCambia({ giocatoriMax: Number(e.target.value) })}
        >
          {NUMERI_GIOCATORI.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      );
    case 'soldiIniziali':
      return (
        <select
          className="scelta"
          value={imp.soldiIniziali}
          disabled={!attivo}
          aria-label={voce.nome}
          onChange={(e) => onCambia({ soldiIniziali: Number(e.target.value) })}
        >
          {SOLDI_INIZIALI_POSSIBILI.map((n) => (
            <option key={n} value={n}>
              {euro(n)}
            </option>
          ))}
        </select>
      );
    case 'mappa':
      return (
        <span className="impostazione__tabellone">
          <strong>{tabellone(imp.mappa).nome}</strong>
          {onTabelloni && (
            <button type="button" className="collegamento" onClick={onTabelloni}>
              {modificabile ? 'Cambia tabellone' : 'Vedi i tabelloni'}
              <Icona nome="avanti" />
            </button>
          )}
        </span>
      );
    default: {
      const chiave = voce.chiave;
      const valore = imp[chiave];
      return (
        <Interruttore
          acceso={valore === true}
          disattivo={!attivo}
          etichetta={voce.nome}
          onCambia={(v) => onCambia({ [chiave]: v } as Partial<Impostazioni>)}
        />
      );
    }
  }
}

function RigaImpostazione(props: {
  voce: Voce;
  imp: Impostazioni;
  modificabile: boolean;
  onCambia: (modifiche: Partial<Impostazioni>) => void;
  onTabelloni?: () => void;
}): ReactNode {
  const { voce } = props;
  return (
    <li className={voce.presto ? 'impostazione impostazione--presto' : 'impostazione'}>
      <Icona nome={voce.icona} className="impostazione__icona" />
      <div className="impostazione__testo">
        <p className="impostazione__nome">
          {voce.nome}
          {voce.presto && (
            <Chip tono="segnale" className="distintivo--prova" title="Arriva con un prossimo aggiornamento">
              Presto
            </Chip>
          )}
        </p>
        <p className="impostazione__descrizione">{voce.descrizione}</p>
      </div>
      <div className="impostazione__controllo">
        <Controllo {...props} />
      </div>
    </li>
  );
}

export function ListaImpostazioni({
  imp,
  modificabile,
  onCambia = () => {},
  onTabelloni,
}: {
  imp: Impostazioni;
  modificabile: boolean;
  onCambia?: (modifiche: Partial<Impostazioni>) => void;
  /** Apre la scelta dei tabelloni (in lobby). */
  onTabelloni?: () => void;
}): ReactNode {
  return (
    <>
      <ul className="impostazioni">
        {STANZA.map((voce) => (
          <RigaImpostazione
            key={voce.chiave}
            voce={voce}
            imp={imp}
            modificabile={modificabile}
            onCambia={onCambia}
            onTabelloni={onTabelloni}
          />
        ))}
      </ul>
      <h3 className="impostazioni__sezione">Regole di gioco</h3>
      <ul className="impostazioni">
        {REGOLE.map((voce) => (
          <RigaImpostazione key={voce.chiave} voce={voce} imp={imp} modificabile={modificabile} onCambia={onCambia} />
        ))}
      </ul>
    </>
  );
}
