import './tavolo.css';
import { useEffect, useState, type ReactNode } from 'react';
import { CodiceQr } from '../../CodiceQr';
import { Chat, Interruttore, Pedina, PulsanteIcona, Soldi, type Messaggio } from './comuni';
import type { Giocatore } from './dati';
import { Icona, type NomeIcona } from './icone';

const INDIRIZZO = 'http://192.168.1.23:3000/stanza/k7q2m';

/* ---------------- Impaginazione a tre colonne ---------------- */

export function Tavolo({
  sinistra,
  centro,
  destra,
}: {
  sinistra: ReactNode;
  centro: ReactNode;
  destra: ReactNode;
}): ReactNode {
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
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onChiudi();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onChiudi]);
  return (
    <div className="finestra" role="presentation" onClick={onChiudi}>
      <div
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

/* ---------------- Colonna sinistra ---------------- */

function Volume(): ReactNode {
  const [aperto, setAperto] = useState(false);
  const [valore, setValore] = useState(80);
  return (
    <div className="volume">
      <PulsanteIcona
        icona={valore === 0 ? 'muto' : 'volume'}
        etichetta={`Volume ${valore}%`}
        onClick={() => setAperto((a) => !a)}
        pressato={aperto}
      />
      {aperto && (
        <div className="volume__pannello">
          <label className="solo-lettori" htmlFor="volume">
            Volume
          </label>
          <input
            id="volume"
            type="range"
            min={0}
            max={100}
            value={valore}
            onChange={(e) => setValore(Number(e.target.value))}
          />
          <span className="volume__valore">{valore}%</span>
        </div>
      )}
    </div>
  );
}

function Condividi({ inPartita, onImpostazioni }: { inPartita?: boolean; onImpostazioni?: () => void }): ReactNode {
  const [copiato, setCopiato] = useState(false);
  useEffect(() => {
    if (!copiato) return;
    const t = setTimeout(() => setCopiato(false), 1600);
    return () => clearTimeout(t);
  }, [copiato]);
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
        <input className="condividi__link" readOnly value={INDIRIZZO} aria-label="Link della stanza" />
        <button type="button" className="pulsante pulsante--piccolo pulsante--primario" onClick={() => setCopiato(true)}>
          <Icona nome={copiato ? 'spunta' : 'copia'} />
          {copiato ? 'Copiato!' : 'Copia'}
        </button>
      </div>
      {inPartita && (
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

function Telefono({ onChiudi }: { onChiudi: () => void }): ReactNode {
  return (
    <section className="pannello telefono" aria-label="Entra dal telefono">
      <button type="button" className="telefono__chiudi" aria-label="Nascondi il codice QR" onClick={onChiudi}>
        <Icona nome="chiudi" />
      </button>
      <CodiceQr testo={INDIRIZZO} />
      <p className="telefono__testo">
        <strong>Dal telefono</strong>
        Inquadra il codice con la fotocamera: si apre questa stanza.
      </p>
    </section>
  );
}

export function ColonnaSinistra({
  messaggi,
  chatSolaLettura,
  inPartita,
  onImpostazioni,
}: {
  messaggi: Messaggio[];
  chatSolaLettura?: boolean;
  inPartita?: boolean;
  onImpostazioni?: () => void;
}): ReactNode {
  const [qr, setQr] = useState(true);
  const [chatRidotta, setChatRidotta] = useState(false);
  return (
    <>
      <div className="logo-riga">
        <a className="insegna insegna--grande" href="#home" aria-label="PoorDown, torna alla home">
          PoorDown
        </a>
        <div className="logo-riga__icone">
          <PulsanteIcona icona="aiuto" etichetta="Come si gioca" />
          <Volume />
        </div>
      </div>
      <Condividi inPartita={inPartita} onImpostazioni={onImpostazioni} />
      {qr && <Telefono onChiudi={() => setQr(false)} />}
      {chatRidotta ? (
        <button type="button" className="chat-bolla" aria-label="Espandi la chat" onClick={() => setChatRidotta(false)}>
          <Icona nome="chat" />
          <span className="chat-bolla__conta">{messaggi.length}</span>
        </button>
      ) : (
        <Chat messaggi={messaggi} sola_lettura={chatSolaLettura} onRiduci={() => setChatRidotta(true)} />
      )}
    </>
  );
}

/* ---------------- Pannello giocatori ---------------- */

export function RigaGiocatore({
  g,
  saldo,
  turno,
  mostraSaldo,
  puoEspellere,
  onEspelli,
  onCambiaColore,
  inBancarotta,
}: {
  g: Giocatore;
  saldo?: number;
  turno?: boolean;
  mostraSaldo?: boolean;
  puoEspellere?: boolean;
  onEspelli?: () => void;
  onCambiaColore?: () => void;
  inBancarotta?: boolean;
}): ReactNode {
  const classi = [
    'giocatore',
    turno ? 'giocatore--turno' : '',
    g.tu ? 'giocatore--tu' : '',
    inBancarotta ? 'giocatore--fuori' : '',
  ].join(' ');
  return (
    <li className={classi} style={{ ['--colore' as string]: `var(--p${g.colore})` }}>
      <span className={g.prigione ? 'in-prigione' : undefined}>
        <Pedina colore={g.colore} iniziale={g.nome[0]} className="pedina--media" />
      </span>
      <span className="giocatore__dati">
        <span className="giocatore__nome">
          <span className="giocatore__testo">{g.nome}</span>
          {g.bot && <Icona nome="robot" className="giocatore__segno" titolo="Bot" />}
          {g.host && !mostraSaldo && (
            <span className="distintivo distintivo--host">
              <Icona nome="corona" />
              Host
            </span>
          )}
          {g.host && mostraSaldo && <Icona nome="corona" className="giocatore__segno giocatore__corona" titolo="Host" />}
        </span>
        {g.tu && onCambiaColore && (
          <button type="button" className="giocatore__colore" onClick={onCambiaColore}>
            <Icona nome="regolazioni" />
            Cambia colore
          </button>
        )}
      </span>
      {mostraSaldo && saldo !== undefined && (
        <span className={saldo < 0 ? 'giocatore__saldo giocatore__saldo--negativo' : 'giocatore__saldo'}>
          <Soldi valore={saldo} />
        </span>
      )}
      {puoEspellere && !g.tu && (
        <PulsanteIcona icona="chiudi" etichetta={`Espelli ${g.nome}`} onClick={onEspelli} />
      )}
    </li>
  );
}

/* ---------------- Impostazioni di gioco ---------------- */

interface Impostazione {
  id: string;
  icona: NomeIcona;
  nome: string;
  descrizione: string;
  tipo: 'si-no' | 'scelta' | 'tabellone';
  valore: boolean | string;
  valori?: string[];
  nuova?: boolean;
}

const IMPOSTAZIONI_STANZA: Impostazione[] = [
  {
    id: 'max',
    icona: 'persone',
    nome: 'Giocatori massimi',
    descrizione: 'Quante persone possono entrare nella partita',
    tipo: 'scelta',
    valore: '4',
    valori: ['2', '3', '4', '5', '6', '7', '8'],
  },
  {
    id: 'privata',
    icona: 'lucchetto',
    nome: 'Stanza privata',
    descrizione: 'Non compare tra le stanze aperte: si entra solo con il link',
    tipo: 'si-no',
    valore: true,
  },
  {
    id: 'bot',
    icona: 'robot',
    nome: 'Bot',
    descrizione: 'Dei giocatori automatici occupano i posti liberi',
    tipo: 'si-no',
    valore: false,
    nuova: true,
  },
  {
    id: 'tabellone',
    icona: 'mappa',
    nome: 'Tabellone',
    descrizione: 'Caselle, città e mazzi della partita',
    tipo: 'tabellone',
    valore: 'Classico',
  },
  {
    id: 'timer',
    icona: 'orologio',
    nome: 'Timer di turno',
    descrizione: 'Ogni turno ha un tempo limite',
    tipo: 'si-no',
    valore: true,
  },
];

const REGOLE: Impostazione[] = [
  {
    id: 'doppio',
    icona: 'monete',
    nome: 'Affitto doppio con la regione completa',
    descrizione: 'Chi possiede tutte le città di una regione incassa il doppio dell’affitto base',
    tipo: 'si-no',
    valore: false,
  },
  {
    id: 'cassa',
    icona: 'vacanza',
    nome: 'Cassa della Vacanza',
    descrizione: 'Chi si ferma in Vacanza incassa le tasse e i pagamenti fatti alla banca',
    tipo: 'si-no',
    valore: false,
  },
  {
    id: 'aste',
    icona: 'martelletto',
    nome: 'Aste',
    descrizione: 'Se chi si ferma su una proprietà non la compra, va all’asta',
    tipo: 'si-no',
    valore: false,
  },
  {
    id: 'prigione',
    icona: 'ribasso',
    nome: 'Niente affitto dalla prigione',
    descrizione: 'Chi è in prigione non incassa gli affitti',
    tipo: 'si-no',
    valore: false,
  },
  {
    id: 'ipoteche',
    icona: 'banca',
    nome: 'Ipoteche',
    descrizione: 'Ipoteca una proprietà per metà del suo prezzo; finché è ipotecata non incassi l’affitto',
    tipo: 'si-no',
    valore: false,
  },
  {
    id: 'uniforme',
    icona: 'uniforme',
    nome: 'Costruzione uniforme',
    descrizione: 'Case e alberghi si costruiscono e si vendono in modo uniforme nella regione',
    tipo: 'si-no',
    valore: true,
  },
  {
    id: 'soldi',
    icona: 'banconota',
    nome: 'Soldi iniziali',
    descrizione: 'Con quanti soldi parte ogni giocatore',
    tipo: 'scelta',
    valore: '1.500 €',
    valori: ['500 €', '1.000 €', '1.500 €', '2.000 €', '2.500 €', '3.000 €'],
  },
  {
    id: 'ordine',
    icona: 'mescola',
    nome: 'Ordine casuale',
    descrizione: 'L’ordine dei turni viene mescolato all’inizio della partita',
    tipo: 'si-no',
    valore: true,
  },
];

function RigaImpostazione({
  imp,
  modificabile,
  host,
}: {
  imp: Impostazione;
  modificabile: boolean;
  host: boolean;
}): ReactNode {
  const [valore, setValore] = useState(imp.valore);
  return (
    <li className="impostazione">
      <Icona nome={imp.icona} className="impostazione__icona" />
      <div className="impostazione__testo">
        <p className="impostazione__nome">
          {imp.nome}
          {imp.nuova && <span className="distintivo distintivo--prova">Prova</span>}
        </p>
        <p className="impostazione__descrizione">{imp.descrizione}</p>
      </div>
      <div className="impostazione__controllo">
        {imp.tipo === 'si-no' && (
          <Interruttore
            acceso={valore === true}
            disattivo={!modificabile}
            etichetta={imp.nome}
            onCambia={(v) => setValore(v)}
          />
        )}
        {imp.tipo === 'scelta' && (
          <select
            className="scelta"
            value={String(valore)}
            disabled={!modificabile}
            aria-label={imp.nome}
            onChange={(e) => setValore(e.target.value)}
          >
            {imp.valori?.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        )}
        {imp.tipo === 'tabellone' && (
          <span className="impostazione__tabellone">
            <strong>{String(valore)}</strong>
            <button type="button" className="collegamento">
              {host && modificabile ? 'Cambia tabellone' : 'Vedi i tabelloni'}
              <Icona nome="avanti" />
            </button>
          </span>
        )}
      </div>
    </li>
  );
}

export function ListaImpostazioni({ modificabile, host }: { modificabile: boolean; host: boolean }): ReactNode {
  return (
    <>
      <ul className="impostazioni">
        {IMPOSTAZIONI_STANZA.map((imp) => (
          <RigaImpostazione key={imp.id} imp={imp} modificabile={modificabile} host={host} />
        ))}
      </ul>
      <h3 className="impostazioni__sezione">Regole di gioco</h3>
      <ul className="impostazioni">
        {REGOLE.map((imp) => (
          <RigaImpostazione key={imp.id} imp={imp} modificabile={modificabile} host={host} />
        ))}
      </ul>
    </>
  );
}
