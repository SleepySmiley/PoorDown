import '../stili/tavolo.css';
import { useEffect, useRef, useState, type ReactNode } from 'react';
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
import { Interruttore, Pedina, PulsanteIcona, Soldi } from '../ui/comuni';
import { iniziale } from '../ui/utili';
import { Icona, type NomeIcona } from '../ui/icone';
import { PassiDelGioco } from '../ui/Regole';
import { BollaChat, Chat } from './Chat';

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

/* ---------------- Finestra (modale) ---------------- */

export function Finestra({
  titolo,
  onChiudi,
  children,
  larga,
}: {
  titolo: string;
  onChiudi: () => void;
  children: ReactNode;
  larga?: boolean;
}): ReactNode {
  const riquadro = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onChiudi();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onChiudi]);
  // Il fuoco entra nella finestra e torna dov'era quando si chiude.
  useEffect(() => {
    const prima = document.activeElement as HTMLElement | null;
    riquadro.current?.focus();
    return () => prima?.focus();
  }, []);
  return (
    <div className="finestra" role="presentation" onClick={onChiudi}>
      <div
        ref={riquadro}
        tabIndex={-1}
        className={larga ? 'finestra__riquadro finestra__riquadro--larga' : 'finestra__riquadro'}
        role="dialog"
        aria-modal="true"
        aria-label={titolo}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="finestra__testa">
          <h2>{titolo}</h2>
          <PulsanteIcona icona="chiudi" etichetta="Chiudi" onClick={onChiudi} />
        </header>
        {children}
      </div>
    </div>
  );
}

/* ---------------- Finestra sopra il tabellone ---------------- */

/**
 * Finestra sopra il tabellone (asta, scambi), come in richup: copre solo il tabellone,
 * così chat e colonne restano usabili. Senza `onChiudi` non si chiude (l'asta finisce da sola).
 * Non ruba il fuoco a chi sta scrivendo in chat.
 */
export function RiquadroTabellone({
  titolo,
  onChiudi,
  children,
  className,
}: {
  titolo: string;
  onChiudi?: () => void;
  children: ReactNode;
  className?: string;
}): ReactNode {
  const riquadro = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!onChiudi) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onChiudi();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onChiudi]);
  useEffect(() => {
    const prima = document.activeElement;
    if (prima instanceof HTMLInputElement || prima instanceof HTMLTextAreaElement) return;
    riquadro.current?.focus();
    return () => {
      if (prima instanceof HTMLElement) prima.focus();
    };
  }, []);
  return (
    <div className="sul-tabellone" role="presentation" onClick={onChiudi}>
      <div
        ref={riquadro}
        tabIndex={-1}
        className={className ? `sul-tabellone__riquadro ${className}` : 'sul-tabellone__riquadro'}
        role="dialog"
        aria-label={titolo}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sul-tabellone__testa">
          <h2>{titolo}</h2>
          {onChiudi && <PulsanteIcona icona="chiudi" etichetta="Chiudi" onClick={onChiudi} />}
        </header>
        {children}
      </div>
    </div>
  );
}

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
      {aiuto && (
        <Finestra titolo="Come si gioca" onChiudi={() => setAiuto(false)} larga>
          <div className="finestra__scorri come-si-gioca come-si-gioca--finestra">
            <PassiDelGioco subito />
          </div>
        </Finestra>
      )}
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
}

export function RigaGiocatore({
  g,
  puoEspellere,
  onEspelli,
  onCambiaColore,
}: {
  g: DatiRiga;
  puoEspellere?: boolean;
  onEspelli?: () => void;
  onCambiaColore?: () => void;
}): ReactNode {
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
      <span className={g.prigione ? 'in-prigione' : undefined} title={g.prigione ? 'In prigione' : undefined}>
        <Pedina colore={g.colore} iniziale={iniziale(g.nome)} className="pedina--media" />
      </span>
      <span className="giocatore__dati">
        <span className="giocatore__nome">
          <span className="giocatore__testo">
            {g.nome}
            {g.tu && <span className="solo-lettori"> (tu)</span>}
          </span>
          {g.host && !mostraSaldo && (
            <span className="distintivo distintivo--host">
              <Icona nome="corona" />
              Host
            </span>
          )}
          {g.host && mostraSaldo && <Icona nome="corona" className="giocatore__segno giocatore__corona" titolo="Host" />}
          {!g.connesso && (
            <Icona nome="scollegato" className="giocatore__segno giocatore__scollegato" titolo="Non è collegato" />
          )}
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
      {g.fuori && <span className="giocatore__esito">Bancarotta</span>}
      {puoEspellere && !g.tu && <PulsanteIcona icona="chiudi" etichetta={`Espelli ${g.nome}`} onClick={onEspelli} />}
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
  { chiave: 'bot', icona: 'robot', nome: 'Bot', descrizione: 'Dei giocatori automatici occupano i posti liberi', presto: true },
  { chiave: 'mappa', icona: 'mappa', nome: 'Tabellone', descrizione: 'Caselle, città e mazzi della partita' },
  { chiave: 'timerTurno', icona: 'orologio', nome: 'Timer di turno', descrizione: 'Ogni turno ha un tempo limite', presto: true },
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
}: {
  voce: Voce;
  imp: Impostazioni;
  modificabile: boolean;
  onCambia: (modifiche: Partial<Impostazioni>) => void;
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
}): ReactNode {
  const { voce } = props;
  return (
    <li className={voce.presto ? 'impostazione impostazione--presto' : 'impostazione'}>
      <Icona nome={voce.icona} className="impostazione__icona" />
      <div className="impostazione__testo">
        <p className="impostazione__nome">
          {voce.nome}
          {voce.presto && (
            <span className="distintivo distintivo--prova" title="Arriva con un prossimo aggiornamento">
              Presto
            </span>
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
}: {
  imp: Impostazioni;
  modificabile: boolean;
  onCambia?: (modifiche: Partial<Impostazioni>) => void;
}): ReactNode {
  return (
    <>
      <ul className="impostazioni">
        {STANZA.map((voce) => (
          <RigaImpostazione key={voce.chiave} voce={voce} imp={imp} modificabile={modificabile} onCambia={onCambia} />
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
