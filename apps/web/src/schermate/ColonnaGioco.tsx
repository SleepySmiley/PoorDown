/*
 * La colonna sinistra della partita:
 * - TestataGioco: marchio, codice della stanza (apre «Invita»: link, Copia, QR), Impostazioni, Regole e il menu «⋯»
 *   con «Torna alla home» e «Dichiara bancarotta»;
 * - PannelloGiocatori: una riga su due linee per giocatore (nome intero; saldo a palette e stati scritti),
 *   la riga di chi gioca accesa d'ambra.
 * La chat sotto è quella di Chat.tsx, richiudibile (useChatRichiudibile in colonna.ts).
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { euro, type IdGiocatore, type VistaStanza } from '@poordown/engine';
import { CodiceQr } from '../CodiceQr';
import { linkStanza, useInfoServer } from '../rete/sessione';
import { copia } from '../ui/appunti';
import { Chip } from '../ui/Chip';
import { Palette, Pedina, PulsanteIcona, Soldi } from '../ui/comuni';
import { Finestra } from '../ui/Finestra';
import { Icona } from '../ui/icone';
import { Marchio } from '../ui/Marchio';
import { CURVA, DURATA } from '../ui/movimento';
import { Pulsante } from '../ui/Pulsante';
import { PassiDelGioco } from '../ui/Regole';
import { iniziale, variabili } from '../ui/utili';
import { Binario } from './Colonne';
import { ContoAllaRovescia } from './Timer';
import type { Variazione } from './turno';

/* ---------------- Popover della testata ---------------- */

/** Il popover scende di 4 px dal suo pulsante. */
const SCENDE = {
  initial: { opacity: 0, y: -4 },
  animate: { opacity: 1, y: 0, transition: { duration: DURATA.entrata, ease: CURVA.arrivo } },
  exit: { opacity: 0, y: -4, transition: { duration: DURATA.uscita, ease: CURVA.partenza } },
} as const;

/** Un pulsante con il suo popover sotto: si chiude con Esc o con un clic fuori. */
function ConPopover({
  aperto,
  onChiudi,
  pulsante,
  lato = 'sinistra',
  className,
  children,
}: {
  aperto: boolean;
  onChiudi: () => void;
  pulsante: ReactNode;
  /** Da che lato del pulsante si allinea il popover. */
  lato?: 'sinistra' | 'destra';
  className?: string;
  children: ReactNode;
}): ReactNode {
  const ancora = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aperto) return;
    const fuori = (e: MouseEvent) => {
      if (!ancora.current?.contains(e.target as Node)) onChiudi();
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onChiudi();
    document.addEventListener('mousedown', fuori);
    window.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', fuori);
      window.removeEventListener('keydown', esc);
    };
  }, [aperto, onChiudi]);
  return (
    <div className="con-popover" ref={ancora}>
      {pulsante}
      <AnimatePresence>
        {aperto && (
          <motion.div
            key="popover"
            className={['popover', 'popover--testata', `popover--${lato}`, className ?? ''].filter(Boolean).join(' ')}
            {...SCENDE}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Tre puntini: il menu con le altre azioni. */
function IconaAltro(): ReactNode {
  return (
    <svg className="icona" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <circle cx="5.5" cy="12" r="1.9" />
      <circle cx="12" cy="12" r="1.9" />
      <circle cx="18.5" cy="12" r="1.9" />
    </svg>
  );
}

function Invito({ link }: { link: string }): ReactNode {
  const [esito, setEsito] = useState<'copiato' | 'seleziona' | null>(null);
  const campo = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!esito) return;
    const t = setTimeout(() => setEsito(null), 2000);
    return () => clearTimeout(t);
  }, [esito]);
  return (
    <div className="invito">
      <p className="invito__titolo">Invita gli amici</p>
      <p className="invito__testo">Chi apre il link entra nella stanza: a partita iniziata, come spettatore.</p>
      <div className="invito__riga">
        <input
          ref={campo}
          className="invito__link"
          readOnly
          value={link}
          aria-label="Link della stanza"
          onFocus={(e) => e.currentTarget.select()}
        />
        <Pulsante
          variante="primario"
          misura="piccolo"
          icona={esito === 'copiato' ? 'spunta' : 'copia'}
          onClick={() => void copia(link, campo.current).then((ok) => setEsito(ok ? 'copiato' : 'seleziona'))}
        >
          {esito === 'copiato' ? 'Copiato!' : 'Copia'}
        </Pulsante>
      </div>
      {esito === 'seleziona' && <p className="invito__nota">Il link è selezionato: copialo con Ctrl+C.</p>}
      <div className="invito__telefono">
        <CodiceQr testo={link} />
        <p>
          <strong>Dal telefono</strong>
          Inquadra il codice con la fotocamera: si apre questa stanza.
        </p>
      </div>
    </div>
  );
}

/* ---------------- Testata ---------------- */

export function TestataGioco({
  stanza,
  onEsci,
  onImpostazioni,
  onBancarotta,
}: {
  stanza: VistaStanza;
  /** Torna alla home (chi è in gioco conferma prima). */
  onEsci: () => void;
  onImpostazioni: () => void;
  /** Solo per chi è ancora in gioco. */
  onBancarotta?: () => void;
}): ReactNode {
  const info = useInfoServer();
  const link = linkStanza(stanza.codice, info);
  const [aperto, setAperto] = useState<'invita' | 'menu' | null>(null);
  const [aiuto, setAiuto] = useState(false);
  const chiudi = () => setAperto(null);
  const codice = stanza.codice.toUpperCase();
  return (
    <header className="testata-gioco">
      <a
        className="testata-gioco__insegna"
        href="/"
        aria-label="PoorDown, esci dalla stanza e torna alla home"
        title="Torna alla home"
        onClick={(e) => {
          e.preventDefault();
          onEsci();
        }}
      >
        <Marchio variante="piccolo" />
      </a>
      <ConPopover
        aperto={aperto === 'invita'}
        onChiudi={chiudi}
        pulsante={
          <button
            type="button"
            className="testata-gioco__codice"
            aria-label={`Stanza ${codice}: invita gli amici`}
            title="Invita gli amici: link e codice QR"
            aria-expanded={aperto === 'invita'}
            onClick={() => setAperto((x) => (x === 'invita' ? null : 'invita'))}
          >
            <Palette testo={codice} />
          </button>
        }
      >
        <Invito link={link} />
      </ConPopover>
      <span className="testata-gioco__icone">
        <PulsanteIcona icona="regolazioni" misura="piccolo" etichetta="Impostazioni della stanza" onClick={onImpostazioni} />
        <PulsanteIcona icona="aiuto" misura="piccolo" etichetta="Come si gioca" onClick={() => setAiuto(true)} />
        <ConPopover
          aperto={aperto === 'menu'}
          onChiudi={chiudi}
          lato="destra"
          pulsante={
            <button
              type="button"
              className="pulsante-icona pulsante-icona--piccolo"
              aria-label="Altro"
              title="Altro"
              aria-expanded={aperto === 'menu'}
              aria-haspopup="menu"
              onClick={() => setAperto((x) => (x === 'menu' ? null : 'menu'))}
            >
              <IconaAltro />
            </button>
          }
        >
          <div className="menu-testata" role="menu">
            <button
              type="button"
              role="menuitem"
              className="menu-testata__voce"
              onClick={() => {
                chiudi();
                onEsci();
              }}
            >
              <Icona nome="esci" />
              Torna alla home
            </button>
            {onBancarotta && (
              <button
                type="button"
                role="menuitem"
                className="menu-testata__voce menu-testata__voce--pericolo"
                onClick={() => {
                  chiudi();
                  onBancarotta();
                }}
              >
                <Icona nome="bandiera" />
                Dichiara bancarotta
              </button>
            )}
          </div>
        </ConPopover>
      </span>
      <AnimatePresence>
        {aiuto && (
          <Finestra key="aiuto" titolo="Come si gioca" onChiudi={() => setAiuto(false)} larga>
            <div className="finestra__scorri come-si-gioca come-si-gioca--finestra">
              <PassiDelGioco subito />
            </div>
          </Finestra>
        )}
      </AnimatePresence>
    </header>
  );
}

/* ---------------- Giocatori ---------------- */

export interface DatiGiocatore {
  id: IdGiocatore;
  nome: string;
  colore: number;
  host: boolean;
  tu: boolean;
  bot: boolean;
  /** Di chi è fuori dalla partita non interessa se è collegato. */
  connesso: boolean;
  saldo: number;
  /** Sta giocando il turno. */
  turno: boolean;
  /** In prigione: il tentativo che sta per fare (1–3); `null` se è libero. */
  prigione: number | null;
  vacanza: boolean;
  fuori: boolean;
  /** Per chi è fuori: perché (al posto del saldo). */
  esito?: string;
  /** Per chi ha perso il collegamento: quando perde il posto (ms del server). */
  assenteFino?: number;
  squadra?: { indice: number; nome: string };
  /** L'ultimo cambio del saldo. */
  variazione?: Variazione;
  /** Sta facendo bancarotta adesso: la riga trema e il saldo gira in «Bancarotta». */
  bancarotta?: boolean;
}

const SPIEGA_BOT = 'Bot: gioca da solo. Compra, costruisce, offre alle aste e risponde agli scambi; in chat non scrive.';
const SPIEGA_ASSENZA =
  'Ha perso il collegamento: i suoi turni passano da soli e allo zero perde il posto. Se sta per tornare, puoi dargli più tempo.';

/** «−44 €» / «+44 €». */
function conSegno(importo: number): string {
  return `${importo < 0 ? '−' : '+'}${euro(Math.abs(importo))}`;
}

export function RigaGiocatoreGioco({
  g,
  puoTogliere,
  bloccoTogli,
  onTogli,
  voto,
}: {
  g: DatiGiocatore;
  /** L'host può togliere gli altri dalla partita: la X compare passando sulla riga. */
  puoTogliere: boolean;
  /** Perché adesso non si può togliere, `null` se si può. */
  bloccoTogli: string | null;
  onTogli: () => void;
  /** Il voto per farlo uscire (solo nella riga di chi gioca). */
  voto?: ReactNode;
}): ReactNode {
  const v = g.variazione;
  const verso = v ? (v.importo < 0 ? 'paga' : 'incassa') : null;
  const classi = [
    'riga-giocatore',
    g.turno ? 'riga-giocatore--turno' : '',
    g.tu ? 'riga-giocatore--tu' : '',
    g.fuori ? 'riga-giocatore--fuori' : '',
    g.connesso ? '' : 'riga-giocatore--assente',
    g.bancarotta ? 'riga-giocatore--bancarotta' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const etichettaTogli = `Togli ${g.nome} dalla partita`;
  return (
    // data-giocatore: la regia trova qui la riga da cui partono (o a cui arrivano) i soldi.
    <li className={classi} data-giocatore={g.id} style={variabili({ '--colore': `var(--p${g.colore})` })}>
      {/* La tinta della riga a ogni cambio di saldo: rinasce con la variazione (key), poi sfuma. */}
      {v && !g.fuori && <span key={`tinta-${v.n}`} className={`riga-giocatore__tinta riga-giocatore__tinta--${verso}`} aria-hidden="true" />}
      <span className="riga-giocatore__pedina">
        <span className={g.prigione !== null && !g.fuori ? 'in-prigione' : undefined}>
          <Pedina colore={g.colore} iniziale={iniziale(g.nome)} className="pedina--grande" />
        </span>
        {g.squadra && <Binario indice={g.squadra.indice} nome={g.squadra.nome} className="binario--maglia" />}
      </span>
      <p className="riga-giocatore__chi">
        <span className="riga-giocatore__nome">
          {g.nome}
          {g.tu && <span className="solo-lettori"> (tu)</span>}
        </span>
        {g.tu && <Chip tono="segnale">Tu</Chip>}
        {g.bot && (
          <Chip icona="robot" title={SPIEGA_BOT}>
            Bot
          </Chip>
        )}
        {g.host && (
          <Chip icona="corona" className="distintivo--host">
            Host
          </Chip>
        )}
      </p>
      <div className="riga-giocatore__stato">
        {g.fuori ? (
          <span className="riga-giocatore__esito">{g.esito ?? 'Bancarotta'}</span>
        ) : g.bancarotta ? (
          <span className="riga-giocatore__soldi riga-giocatore__soldi--rosso riga-giocatore__soldi--bancarotta">
            <Palette testo="BANCAROTTA" />
          </span>
        ) : (
          <span className={g.saldo < 0 ? 'riga-giocatore__soldi riga-giocatore__soldi--rosso' : 'riga-giocatore__soldi'}>
            <Soldi valore={g.saldo} />
            {v && (
              <span key={`var-${v.n}`} className={`riga-giocatore__variazione riga-giocatore__variazione--${verso}`}>
                {conSegno(v.importo)}
              </span>
            )}
          </span>
        )}
        {!g.fuori && g.saldo < 0 && <Chip tono="rosso">In debito</Chip>}
        {!g.fuori && g.prigione !== null && (
          <Chip icona="prigione" className="chip--stato">
            In prigione {g.prigione}/3
          </Chip>
        )}
        {!g.fuori && g.vacanza && (
          <Chip icona="vacanza" className="chip--stato">
            In vacanza
          </Chip>
        )}
        {!g.connesso && (
          <Chip tono="rosso" icona="scollegato" title={g.assenteFino !== undefined ? SPIEGA_ASSENZA : 'Senza collegamento'}>
            Scollegato
            {g.assenteFino !== undefined && <ContoAllaRovescia fino={g.assenteFino} className="riga-giocatore__conto" />}
          </Chip>
        )}
      </div>
      {voto && <div className="riga-giocatore__voto">{voto}</div>}
      {puoTogliere && !g.tu && !g.fuori && (
        <span className="riga-giocatore__togli">
          {bloccoTogli ? (
            <span className="con-suggerimento con-suggerimento--destra" data-testo={bloccoTogli}>
              <button type="button" className="pulsante-icona pulsante-icona--piccolo" aria-label={etichettaTogli} disabled>
                <Icona nome="chiudi" />
              </button>
            </span>
          ) : (
            <PulsanteIcona icona="chiudi" misura="piccolo" etichetta={etichettaTogli} onClick={onTogli} />
          )}
        </span>
      )}
    </li>
  );
}
