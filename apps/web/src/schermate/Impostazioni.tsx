/*
 * Le impostazioni della stanza, in lobby (modificabili dall'host) e in partita (solo da leggere).
 * Ogni impostazione è una riga a griglia: icona | nome e descrizione corta | controllo a destra.
 * Le righe stanno in due gruppi con l'intestazione (Stanza, Regole di gioco); la spiegazione lunga
 * compare passando sulla riga. Chi non può cambiarle vede i controlli spenti con il lucchetto.
 */

import '../stili/lobby.css';
import type { ReactNode } from 'react';
import {
  euro,
  GIOCATORI_MAX,
  GIOCATORI_MIN,
  SOLDI_INIZIALI_POSSIBILI,
  tabellone,
  type Impostazioni,
} from '@poordown/engine';
import { Chip } from '../ui/Chip';
import { Interruttore } from '../ui/comuni';
import { Icona, type NomeIcona } from '../ui/icone';

interface Voce {
  chiave: keyof Impostazioni;
  icona: NomeIcona;
  nome: string;
  /** Una riga: si legge a colpo d'occhio. */
  breve: string;
  /** La spiegazione intera, al passaggio del mouse. */
  descrizione: string;
  /** Arriva in una fase successiva: si vede ma non si può ancora cambiare. */
  presto?: boolean;
}

const GRUPPI: { titolo: string; voci: Voce[] }[] = [
  {
    titolo: 'Stanza',
    voci: [
      {
        chiave: 'giocatoriMax',
        icona: 'persone',
        nome: 'Giocatori massimi',
        breve: 'Posti al tavolo',
        descrizione: 'Quante persone possono entrare nella partita',
      },
      {
        chiave: 'stanzaPrivata',
        icona: 'lucchetto',
        nome: 'Stanza privata',
        breve: 'Si entra solo con il link',
        descrizione: 'Non compare tra le stanze aperte: si entra solo con il link',
      },
      {
        chiave: 'bot',
        icona: 'robot',
        nome: 'Bot',
        breve: 'Occupano i posti liberi',
        descrizione: 'Dei giocatori automatici occupano i posti liberi; chi arriva dopo prende il posto di un bot',
      },
      {
        chiave: 'squadre',
        icona: 'squadre',
        nome: 'Squadre',
        breve: 'Si vince insieme',
        descrizione: 'I compagni non si pagano l’affitto, costruiscono sulle regioni della squadra e vincono insieme',
      },
      {
        chiave: 'mappa',
        icona: 'mappa',
        nome: 'Tabellone',
        breve: 'Caselle, città e mazzi',
        descrizione: 'Caselle, città e mazzi della partita',
      },
      {
        chiave: 'timerTurno',
        icona: 'orologio',
        nome: 'Timer di turno',
        breve: 'Turni a tempo',
        descrizione: 'Ogni turno ha un tempo limite: allo scadere il gioco tira i dadi e finisce il turno',
      },
    ],
  },
  {
    titolo: 'Regole di gioco',
    voci: [
      {
        chiave: 'soldiIniziali',
        icona: 'banconota',
        nome: 'Soldi iniziali',
        breve: 'Per ogni giocatore',
        descrizione: 'Con quanti soldi parte ogni giocatore',
      },
      {
        chiave: 'affittoDoppioSetCompleto',
        icona: 'monete',
        nome: 'Affitto doppio',
        breve: 'Con tutta la regione',
        descrizione: 'Chi possiede tutte le città di una regione incassa il doppio dell’affitto base',
      },
      {
        chiave: 'cassaVacanza',
        icona: 'vacanza',
        nome: 'Cassa della Vacanza',
        breve: 'Incassa tasse e multe',
        descrizione: 'Chi si ferma in Vacanza incassa le tasse e i pagamenti fatti alla banca',
      },
      {
        chiave: 'aste',
        icona: 'martelletto',
        nome: 'Aste',
        breve: 'Se nessuno compra',
        descrizione: 'Se chi si ferma su una proprietà non la compra, va all’asta',
      },
      {
        chiave: 'nienteAffittoInPrigione',
        icona: 'ribasso',
        nome: 'Prigione senza affitti',
        breve: 'In prigione non incassi',
        descrizione: 'Niente affitto dalla prigione: chi è in prigione non incassa gli affitti',
      },
      {
        chiave: 'ipoteche',
        icona: 'banca',
        nome: 'Ipoteche',
        breve: 'Metà prezzo dalla banca',
        descrizione: 'Ipoteca una proprietà per metà del suo prezzo; finché è ipotecata non incassi l’affitto',
      },
      {
        chiave: 'costruzioneUniforme',
        icona: 'uniforme',
        nome: 'Costruzione uniforme',
        breve: 'Case alla pari',
        descrizione: 'Case e alberghi si costruiscono e si vendono in modo uniforme nella regione',
      },
      {
        chiave: 'ordineCasuale',
        icona: 'mescola',
        nome: 'Ordine casuale',
        breve: 'Turni estratti a sorte',
        descrizione: 'L’ordine dei turni viene estratto a sorte all’inizio della partita',
      },
    ],
  },
];

const NUMERI_GIOCATORI = Array.from({ length: GIOCATORI_MAX - GIOCATORI_MIN + 1 }, (_, i) => i + GIOCATORI_MIN);

interface PropsRiga {
  voce: Voce;
  imp: Impostazioni;
  modificabile: boolean;
  onCambia: (modifiche: Partial<Impostazioni>) => void;
  onTabelloni?: () => void;
}

function Controllo({ voce, imp, modificabile, onCambia, onTabelloni }: PropsRiga): ReactNode {
  const attivo = modificabile && !voce.presto;
  switch (voce.chiave) {
    case 'giocatoriMax':
      return (
        <select
          className="imposta__scelta"
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
          className="imposta__scelta"
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
      // Il tabellone si sceglie nella sua finestra; anche chi non è host può aprirla per guardare.
      return onTabelloni ? (
        <button type="button" className="pulsante pulsante--piccolo pulsante--secondario imposta__tabelloni" onClick={onTabelloni}>
          {modificabile ? 'Cambia' : 'Vedi'}
        </button>
      ) : null;
    default: {
      const chiave = voce.chiave;
      return (
        <Interruttore
          acceso={imp[chiave] === true}
          disattivo={!attivo}
          etichetta={voce.nome}
          onCambia={(v) => onCambia({ [chiave]: v } as Partial<Impostazioni>)}
        />
      );
    }
  }
}

function Riga(props: PropsRiga): ReactNode {
  const { voce, imp, modificabile, onTabelloni } = props;
  // Il tabellone si può sempre aprire per guardarlo: non ha il lucchetto.
  const bloccata = (!modificabile || voce.presto === true) && !(voce.chiave === 'mappa' && onTabelloni);
  const classi = ['imposta__riga', bloccata ? 'imposta__riga--bloccata' : '', voce.presto ? 'imposta__riga--presto' : '']
    .filter(Boolean)
    .join(' ');
  return (
    <li className={classi}>
      <Icona nome={voce.icona} className="imposta__icona" />
      <div className="imposta__testo" title={voce.descrizione}>
        <p className="imposta__nome">
          {voce.nome}
          {voce.presto && (
            <Chip tono="segnale" title="Arriva con un prossimo aggiornamento">
              Presto
            </Chip>
          )}
        </p>
        <p className="imposta__breve">
          {voce.chiave === 'mappa' ? (
            <>
              <b>{tabellone(imp.mappa).nome}</b> · {tabellone(imp.mappa).caselle.length} caselle
            </>
          ) : (
            voce.breve
          )}
        </p>
      </div>
      <div className="imposta__controllo">
        {bloccata && <Icona nome="lucchetto" className="imposta__lucchetto" titolo="Bloccata" />}
        <Controllo {...props} />
      </div>
    </li>
  );
}

/**
 * Tutte le impostazioni della stanza. `modificabile`: solo l'host, in lobby.
 * `onTabelloni` apre la scelta dei tabelloni (in lobby); senza, la riga del tabellone mostra solo il nome.
 */
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
    <div className="imposta">
      {GRUPPI.map((g) => (
        <section key={g.titolo} className="imposta__gruppo" aria-label={g.titolo}>
          <h3 className="imposta__titolo">{g.titolo}</h3>
          <ul className="imposta__righe">
            {g.voci.map((voce) => (
              <Riga
                key={voce.chiave}
                voce={voce}
                imp={imp}
                modificabile={modificabile}
                onCambia={onCambia}
                onTabelloni={onTabelloni}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
