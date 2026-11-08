import '../stili/home.css';
import '../stili/sincronia.css';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  IMPOSTAZIONI_PREDEFINITE,
  NOME_MAX,
  nomeCasuale,
  tabellone,
  type Impostazioni,
  type Risposta,
  type StanzaInElenco,
} from '@poordown/engine';
import { vai, vaiAllaStanza } from '../navigazione';
import { collegamento, preferenze, usePostoTenuto, type PostoTenuto } from '../rete/sessione';
import { avvisa } from '../ui/avvisi';
import { Dado, Palette, Pedina } from '../ui/comuni';
import { Icona, type NomeIcona } from '../ui/icone';
import { PassiDelGioco } from '../ui/Regole';
import { minutiSecondi, variabili } from '../ui/utili';

const CASO = { intero: (n: number) => Math.floor(Math.random() * n) };

/** Regole che possono essere diverse da quelle standard, con l'icona della scheda della stanza. */
const REGOLE: { chiave: keyof Impostazioni; icona: NomeIcona; nome: string }[] = [
  { chiave: 'affittoDoppioSetCompleto', icona: 'monete', nome: 'Affitto doppio con la regione completa' },
  { chiave: 'cassaVacanza', icona: 'vacanza', nome: 'Cassa della Vacanza' },
  { chiave: 'aste', icona: 'martelletto', nome: 'Aste' },
  { chiave: 'nienteAffittoInPrigione', icona: 'ribasso', nome: 'Niente affitto dalla prigione' },
  { chiave: 'ipoteche', icona: 'banca', nome: 'Ipoteche' },
  { chiave: 'costruzioneUniforme', icona: 'uniforme', nome: 'Costruzione uniforme' },
  { chiave: 'timerTurno', icona: 'orologio', nome: 'Timer di turno' },
];

/** Pittogrammi sparsi in fondo alla home, come cartelli di stazione. */
const CARTELLI: { icona: NomeIcona; x: number; y: number; r: number; d: number }[] = [
  { icona: 'treno', x: 46, y: 90, r: -8, d: 1 },
  { icona: 'fulmine', x: 54.5, y: 86, r: 6, d: 1 },
  { icona: 'busta', x: 39, y: 82, r: 10, d: 0.8 },
  { icona: 'casa', x: 62, y: 81, r: -12, d: 0.8 },
  { icona: 'cartolina', x: 60, y: 96, r: -6, d: 0.9 },
  { icona: 'albergo', x: 31, y: 92, r: 8, d: 0.65 },
  { icona: 'goccia', x: 70, y: 90, r: -4, d: 0.6 },
  { icona: 'euro', x: 26, y: 72, r: -10, d: 0.45 },
  { icona: 'prigione', x: 74, y: 70, r: 12, d: 0.45 },
  { icona: 'vacanza', x: 19, y: 86, r: 5, d: 0.35 },
  { icona: 'percento', x: 81, y: 84, r: -8, d: 0.35 },
  { icona: 'grazia', x: 33, y: 76, r: 14, d: 0.5 },
  { icona: 'lucchetto', x: 67, y: 75, r: -14, d: 0.5 },
];

function DadoGrande(): ReactNode {
  const [valore, setValore] = useState(6);
  const [giro, setGiro] = useState(0);
  return (
    <button
      type="button"
      className="dado-home"
      aria-label="Tira il dado"
      onClick={() => {
        setGiro((g) => g + 1);
        setValore(1 + Math.floor(Math.random() * 6));
      }}
    >
      <span className={giro ? 'dado-home__corpo dado-home__corpo--rotola' : 'dado-home__corpo'} key={giro}>
        <Dado valore={valore} />
      </span>
    </button>
  );
}

function SchedaStanza({ s, onEntra }: { s: StanzaInElenco; onEntra: () => void }): ReactNode {
  const diverse = REGOLE.filter((r) => s.impostazioni[r.chiave] !== IMPOSTAZIONI_PREDEFINITE[r.chiave]);
  const soldi = s.impostazioni.soldiIniziali !== IMPOSTAZIONI_PREDEFINITE.soldiIniziali;
  const posti = Math.max(s.giocatoriMax, s.giocatori.length);
  return (
    <li>
      <button type="button" className="stanza-card" onClick={onEntra}>
        <span className="stanza-card__sinistra">
          <span className="stanza-card__codice">
            <Palette testo={s.codice.toUpperCase()} />
            {s.fase === 'partita' && <span className="stanza-card__fase">In partita</span>}
          </span>
          <span className="stanza-card__posti" aria-label={`${s.giocatori.length} giocatori su ${s.giocatoriMax}`}>
            {Array.from({ length: posti }, (_, i) => {
              const g = s.giocatori[i];
              if (!g) return <span key={i} className="posto-libero" />;
              return (
                <span key={i} title={g.nome}>
                  <Pedina colore={g.colore} className="pedina--posto" />
                </span>
              );
            })}
          </span>
        </span>
        <span className="stanza-card__destra">
          <span className="stanza-card__mappa">
            <Icona nome="mappa" />
            {tabellone(s.mappa).nome}
          </span>
          {diverse.length === 0 && !soldi ? (
            <span className="stanza-card__standard">Impostazioni standard</span>
          ) : (
            <span className="stanza-card__regole">
              {diverse.map((r) => {
                const attiva = s.impostazioni[r.chiave] === true;
                return (
                  <span
                    key={r.chiave}
                    className={attiva ? 'regola-icona regola-icona--attiva' : 'regola-icona'}
                    title={`${r.nome}: ${attiva ? 'attiva' : 'disattivata'}`}
                  >
                    <Icona nome={r.icona} />
                  </span>
                );
              })}
              {soldi && (
                <span className="regola-icona regola-icona--soldi" title="Soldi iniziali">
                  <Icona nome="banconota" />
                  {s.impostazioni.soldiIniziali.toLocaleString('it-IT')}
                </span>
              )}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}

/** Per chi ha lasciato una partita in corso: il suo posto resta ancora per un po', si può rientrare. */
function Rientro({ posto }: { posto: PostoTenuto }): ReactNode {
  const [adesso, setAdesso] = useState(() => Date.now());
  useEffect(() => {
    if (posto.fino === null) return;
    const t = setInterval(() => setAdesso(Date.now()), 1000);
    return () => clearInterval(t);
  }, [posto.fino]);
  const resta = posto.fino === null ? null : posto.fino - adesso;
  if (resta !== null && resta <= 0) return null;
  return (
    <div className="rientro">
      <button
        type="button"
        className="pulsante pulsante--ambra rientro__pulsante"
        onClick={() => vaiAllaStanza(posto.codice, { dallaHome: true })}
      >
        <Icona nome="avanti" />
        Rientra nella stanza
        <Palette testo={posto.codice.toUpperCase()} />
      </button>
      <p className="rientro__nota">
        {resta === null
          ? 'Il tuo posto ti aspetta: la partita resta ferma finché qualcuno non torna.'
          : `Il tuo posto ti aspetta ancora per ${minutiSecondi(resta)}. Intanto i tuoi turni passano da soli.`}
      </p>
    </div>
  );
}

/** Esegue un comando che porta in una stanza (Gioca, Crea) e ci entra. */
function useVaiInStanza() {
  const [occupato, setOccupato] = useState<string | null>(null);
  const esegui = useCallback(async (quale: string, promessa: () => Promise<Risposta<{ codice: string }>>) => {
    setOccupato(quale);
    const risposta = await promessa();
    setOccupato(null);
    if (risposta.ok) vaiAllaStanza(risposta.dati.codice, { dallaHome: true });
    else avvisa(risposta.messaggio, 'errore');
  }, []);
  return { occupato, esegui };
}

function ElencoStanze({ onIndietro }: { onIndietro: () => void }): ReactNode {
  const [stanze, setStanze] = useState<StanzaInElenco[] | null>(null);
  const [carica, setCarica] = useState(0);
  const { occupato, esegui } = useVaiInStanza();

  useEffect(() => {
    let attivo = true;
    void collegamento.comando('elenco_stanze', {}).then((r) => {
      if (!attivo) return;
      if (r.ok) setStanze(r.dati);
      else {
        setStanze([]);
        avvisa(r.messaggio, 'errore');
      }
    });
    return () => {
      attivo = false;
    };
  }, [carica]);

  return (
    <section className="elenco-stanze pannello--scuro" aria-label="Tutte le stanze">
      <div className="elenco-stanze__barra">
        <button type="button" className="pulsante pulsante--piccolo pulsante--contorno-chiaro" onClick={onIndietro}>
          <Icona nome="partenza" />
          Indietro
        </button>
        <span className="elenco-stanze__spazio" />
        <button
          type="button"
          className="pulsante-icona pulsante-icona--contorno"
          aria-label="Aggiorna l’elenco"
          title="Aggiorna"
          onClick={() => setCarica((c) => c + 1)}
        >
          <Icona nome="aggiorna" />
        </button>
        <button
          type="button"
          className="pulsante pulsante--piccolo pulsante--ambra"
          disabled={occupato !== null}
          onClick={() => void esegui('nuova', () => collegamento.comando('crea_stanza', { privata: false }))}
        >
          <Icona nome="piu" />
          Nuova stanza
        </button>
      </div>
      {stanze === null ? (
        <p className="elenco-stanze__invito">Cerco le stanze aperte…</p>
      ) : stanze.length === 0 ? (
        <p className="elenco-stanze__invito elenco-stanze__vuoto">
          Non c’è nessuna stanza aperta in questo momento. Creane una con «Nuova stanza».
        </p>
      ) : (
        <>
          <p className="elenco-stanze__invito">Scegli la stanza in cui entrare:</p>
          <ul className="elenco-stanze__lista">
            {stanze.map((s) => (
              <SchedaStanza key={s.codice} s={s} onEntra={() => vaiAllaStanza(s.codice, { dallaHome: true })} />
            ))}
          </ul>
        </>
      )}
      <p className="elenco-stanze__nota">
        <Icona nome="lucchetto" />
        Le stanze private non compaiono qui: si entra con il link.
      </p>
    </section>
  );
}

/**
 * La home. Con `invito` (codice della stanza) è la pagina di ingresso di chi arriva da un link:
 * il pulsante principale diventa «Entra nella partita».
 */
export function Home({ invito, onEntra }: { invito?: string; onEntra?: () => void }): ReactNode {
  const [nome, setNome] = useState(preferenze.nome);
  const [giro, setGiro] = useState(0);
  const [stanze, setStanze] = useState(false);
  const { occupato, esegui } = useVaiInStanza();
  const posto = usePostoTenuto();

  const cambiaNome = (valore: string) => {
    setNome(valore);
    preferenze.salvaNome(valore);
  };

  return (
    <div className="home">
      <header className="home__testata">
        <span />
        <a href="#come-si-gioca" className="home__link">
          <Icona nome="aiuto" />
          Come si gioca
        </a>
      </header>

      <div className="home__sfondo" aria-hidden="true">
        {CARTELLI.map((c, i) => (
          <span
            key={i}
            className="cartello"
            style={variabili({
              '--x': `${c.x}%`,
              '--y': `${c.y}%`,
              '--r': `${c.r}deg`,
              '--d': String(c.d),
              '--i': String(i),
            })}
          >
            <Icona nome={c.icona} />
          </span>
        ))}
      </div>

      <main className={stanze ? 'home__centro home__centro--stanze' : 'home__centro'}>
        <div className="marchio">
          <DadoGrande />
          <h1 className="marchio__nome">
            {invito ? (
              <a
                href="/"
                className="marchio__collegamento"
                onClick={(e) => {
                  e.preventDefault();
                  vai('/');
                }}
              >
                PoorDown
              </a>
            ) : (
              'PoorDown'
            )}
          </h1>
          <p className="marchio__motto">Il gioco delle città italiane</p>
        </div>

        {!stanze ? (
          <form
            className="ingresso"
            key="ingresso"
            onSubmit={(e) => {
              e.preventDefault();
              if (invito) onEntra?.();
              else void esegui('gioca', () => collegamento.comando('gioca', {}));
            }}
          >
            {invito && (
              <p className="ingresso__invito">
                Sei stato invitato nella stanza <Palette testo={invito.toUpperCase()} />
              </p>
            )}
            {!invito && posto && <Rientro key={posto.codice} posto={posto} />}
            <div className="campo-nome">
              <label className="solo-lettori" htmlFor="nome">
                Il tuo nome
              </label>
              <input
                id="nome"
                className="campo"
                value={nome}
                maxLength={NOME_MAX}
                placeholder="Il tuo nome…"
                autoComplete="nickname"
                onChange={(e) => cambiaNome(e.target.value)}
              />
              <button
                type="button"
                className="campo-nome__dado"
                onClick={() => {
                  cambiaNome(nomeCasuale(CASO));
                  setGiro((g) => g + 1);
                }}
                aria-label="Scegli un nome a caso"
                title="Scegli un nome a caso"
              >
                <Icona nome="dado" key={giro} className={giro ? 'gira' : undefined} />
              </button>
            </div>
            <button type="submit" className="pulsante pulsante--primario pulsante--gioca" disabled={occupato !== null}>
              <Icona nome="avanti" />
              {invito ? 'Entra nella partita' : occupato === 'gioca' ? 'Cerco una stanza…' : 'Gioca'}
            </button>
            <div className="ingresso__altri">
              <button type="button" className="pulsante pulsante--tenue" onClick={() => setStanze(true)}>
                <Icona nome="persone" />
                Tutte le stanze
              </button>
              <button
                type="button"
                className="pulsante pulsante--tenue"
                disabled={occupato !== null}
                onClick={() => void esegui('privata', () => collegamento.comando('crea_stanza', { privata: true }))}
              >
                <Icona nome="lucchetto" />
                Crea una stanza privata
              </button>
            </div>
          </form>
        ) : (
          <ElencoStanze key="stanze" onIndietro={() => setStanze(false)} />
        )}
      </main>

      <section id="come-si-gioca" className="come-si-gioca" aria-labelledby="titolo-regole">
        <h2 id="titolo-regole" className="come-si-gioca__titolo">
          Come si gioca
        </h2>
        <PassiDelGioco />
      </section>
    </div>
  );
}
