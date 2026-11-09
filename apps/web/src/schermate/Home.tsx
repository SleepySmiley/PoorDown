import '../stili/home.css';
import '../stili/sincronia.css';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
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
import { Palette, Pedina, PulsanteIcona } from '../ui/comuni';
import { Icona, type NomeIcona } from '../ui/icone';
import { Marchio, Pittogramma } from '../ui/Marchio';
import { Pulsante } from '../ui/Pulsante';
import { PassiDelGioco } from '../ui/Regole';
import { minutiSecondi, variabili } from '../ui/utili';

const CASO = { intero: (n: number) => Math.floor(Math.random() * n) };

/** Ogni quanto si rilegge l'elenco delle stanze aperte (il server non lo manda da solo). */
const AGGIORNA_ELENCO_MS = 5_000;
/** Righe del tabellone delle partenze: quelle vuote restano disegnate, come sui tabelloni veri. */
const RIGHE_TABELLONE = 6;

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

/** Pochi pittogrammi sparsi ai bordi e in fondo, come cartelli di stazione: mai sopra i comandi. */
const CARTELLI: { icona: NomeIcona; x: number; y: number; r: number; d: number }[] = [
  { icona: 'treno', x: 7, y: 90, r: -8, d: 0.95 },
  { icona: 'casa', x: 93, y: 88, r: 10, d: 0.8 },
  { icona: 'fulmine', x: 17, y: 96, r: 7, d: 0.55 },
  { icona: 'busta', x: 84, y: 97, r: -6, d: 0.55 },
  { icona: 'euro', x: 3.5, y: 72, r: -12, d: 0.42 },
];

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

/* ---------------- Rientro nella partita lasciata ---------------- */

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
    <div className="rientro" role="status">
      <div className="rientro__testa">
        <span className="rientro__etichetta">Partita in corso</span>
        <Palette testo={posto.codice.toUpperCase()} misura="s" />
        {resta !== null && (
          <span className="rientro__tempo" title="Il tuo posto resta libero ancora per">
            <Icona nome="orologio" />
            <Palette testo={minutiSecondi(resta)} misura="s" />
          </span>
        )}
      </div>
      <p className="rientro__nota">
        {resta === null
          ? 'Il tuo posto ti aspetta: la partita resta ferma finché qualcuno non torna.'
          : 'Il tuo posto ti aspetta. Intanto i tuoi turni passano da soli.'}
      </p>
      <button
        type="button"
        className="pulsante pulsante--ambra pulsante--largo rientro__pulsante"
        onClick={() => vaiAllaStanza(posto.codice, { dallaHome: true })}
      >
        <Icona nome="avanti" />
        Rientra nella stanza
      </button>
    </div>
  );
}

/* ---------------- Tabellone delle partenze ---------------- */

/** L'ora a palette, che gira allo scoccare del minuto. */
function Orologio(): ReactNode {
  const [adesso, setAdesso] = useState(() => new Date());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const prossimo = () => {
      const d = new Date();
      timer = setTimeout(
        () => {
          setAdesso(new Date());
          prossimo();
        },
        60_000 - (d.getSeconds() * 1000 + d.getMilliseconds()) + 50,
      );
    };
    prossimo();
    return () => clearTimeout(timer);
  }, []);
  const ora = `${String(adesso.getHours()).padStart(2, '0')}:${String(adesso.getMinutes()).padStart(2, '0')}`;
  return (
    <span className="partenze__ora" title="Ora">
      <Palette testo={ora} misura="m" />
    </span>
  );
}

function statoStanza(s: StanzaInElenco): { testo: string; azione: string; tono: 'attesa' | 'piena' | 'partita' } {
  if (s.fase === 'partita') return { testo: 'In partita', azione: 'Guarda', tono: 'partita' };
  const conBot = s.giocatori.some((g) => g.bot);
  if (s.giocatori.length >= s.giocatoriMax && !conBot) return { testo: 'Piena', azione: 'Guarda', tono: 'piena' };
  return { testo: 'In attesa', azione: 'Entra', tono: 'attesa' };
}

function RigaPartenza({ s, onEntra }: { s: StanzaInElenco; onEntra: () => void }): ReactNode {
  const diverse = REGOLE.filter((r) => s.impostazioni[r.chiave] !== IMPOSTAZIONI_PREDEFINITE[r.chiave]);
  const soldi = s.impostazioni.soldiIniziali !== IMPOSTAZIONI_PREDEFINITE.soldiIniziali;
  const posti = Math.max(s.giocatoriMax, s.giocatori.length);
  const stato = statoStanza(s);
  const persone = s.giocatori.filter((g) => !g.bot).length;
  return (
    <li className="partenze__voce">
      <button
        type="button"
        className="partenza"
        onClick={onEntra}
        aria-label={`${stato.azione} nella stanza ${s.codice.toUpperCase()}: ${tabellone(s.mappa).nome}, ${s.giocatori.length} giocatori su ${s.giocatoriMax}, ${stato.testo.toLowerCase()}`}
      >
        <span className="partenza__codice">
          <Palette testo={s.codice.toUpperCase()} misura="m" />
        </span>
        <span className="partenza__tabellone">
          <span className="partenza__mappa">{tabellone(s.mappa).nome}</span>
          {diverse.length === 0 && !soldi ? (
            <span className="partenza__standard">Regole standard</span>
          ) : (
            <span className="partenza__regole">
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
        <span className="partenza__posti">
          <span className="partenza__pedine" aria-hidden="true">
            {Array.from({ length: posti }, (_, i) => {
              const g = s.giocatori[i];
              if (!g) return <span key={i} className="partenza__libero" />;
              return (
                <span key={i} title={g.bot ? `${g.nome} (bot)` : g.nome}>
                  <Pedina colore={g.colore} className={g.bot ? 'pedina--posto pedina--bot' : 'pedina--posto'} />
                </span>
              );
            })}
          </span>
          <span className="partenza__conta" title={persone < s.giocatori.length ? `${persone} persone e ${s.giocatori.length - persone} bot` : undefined}>
            {s.giocatori.length}/{s.giocatoriMax}
          </span>
        </span>
        <span className={`partenza__stato partenza__stato--${stato.tono}`}>
          <span className="partenza__testo-stato">{stato.testo}</span>
          <span className="partenza__entra" aria-hidden="true">
            {stato.azione}
            <Icona nome="avanti" />
          </span>
        </span>
      </button>
    </li>
  );
}

function TabellonePartenze(): ReactNode {
  const [stanze, setStanze] = useState<StanzaInElenco[] | null>(null);
  const [carica, setCarica] = useState(0);
  // Gli errori si mostrano solo a chi ha chiesto di aggiornare, non a ogni giro automatico.
  const manuale = useRef(false);
  const { occupato, esegui } = useVaiInStanza();

  useEffect(() => {
    let attivo = true;
    const chiesto = manuale.current;
    manuale.current = false;
    void collegamento.comando('elenco_stanze', {}).then((r) => {
      if (!attivo) return;
      if (r.ok) setStanze(r.dati);
      else {
        setStanze((prima) => prima ?? []);
        if (chiesto) avvisa(r.messaggio, 'errore');
      }
    });
    // Il tabellone si aggiorna da solo, come quelli veri; solo mentre la pagina è in vista.
    const t = setTimeout(() => {
      if (attivo && document.visibilityState === 'visible') setCarica((c) => c + 1);
    }, AGGIORNA_ELENCO_MS);
    return () => {
      attivo = false;
      clearTimeout(t);
    };
  }, [carica]);

  // Tornando sulla pagina riparte subito.
  useEffect(() => {
    const torna = () => {
      if (document.visibilityState === 'visible') setCarica((c) => c + 1);
    };
    document.addEventListener('visibilitychange', torna);
    return () => document.removeEventListener('visibilitychange', torna);
  }, []);

  // Prima le stanze dove ci si può sedere, poi quelle piene, poi le partite in corso.
  const ORDINE = { attesa: 0, piena: 1, partita: 2 } as const;
  const ordinate = stanze ? [...stanze].sort((a, b) => ORDINE[statoStanza(a).tono] - ORDINE[statoStanza(b).tono]) : [];
  const vuote = Math.max(0, RIGHE_TABELLONE - ordinate.length);

  return (
    <section className="partenze" aria-labelledby="titolo-partenze">
      <header className="partenze__testa">
        <div className="partenze__titoli">
          <h2 id="titolo-partenze" className="partenze__titolo">
            Partenze
          </h2>
          <p className="partenze__sottotitolo">Stanze aperte</p>
        </div>
        <Orologio />
      </header>

      <div className="partenze__colonne" aria-hidden="true">
        <span>Stanza</span>
        <span>Tabellone</span>
        <span>Giocatori</span>
        <span>Stato</span>
      </div>

      <div className="partenze__corpo">
        {stanze === null ? (
          <p className="partenze__messaggio" role="status">
            Cerco le stanze aperte…
          </p>
        ) : ordinate.length === 0 ? (
          <div className="partenze__vuoto" role="status">
            <Palette testo="NESSUNA PARTENZA" misura="m" className="partenze__palette-vuota" />
            <p>
              Non c’è nessuna stanza aperta. Premi <b>Gioca</b>: ne apri una tu, e chi arriva dopo la trova qui.
            </p>
          </div>
        ) : null}
        <ul className="partenze__lista">
          {ordinate.map((s) => (
            <RigaPartenza key={s.codice} s={s} onEntra={() => vaiAllaStanza(s.codice, { dallaHome: true })} />
          ))}
          {Array.from({ length: vuote }, (_, i) => (
            <li key={`vuota-${i}`} className="partenze__voce partenze__voce--vuota" aria-hidden="true" />
          ))}
        </ul>
      </div>

      <footer className="partenze__piede">
        <p className="partenze__nota">
          <Icona nome="lucchetto" />
          Le stanze private non compaiono qui: si entra con il link.
        </p>
        <PulsanteIcona
          icona="aggiorna"
          etichetta="Aggiorna l’elenco"
          misura="piccolo"
          onClick={() => {
            manuale.current = true;
            setCarica((c) => c + 1);
          }}
        />
        <button
          type="button"
          className="pulsante pulsante--piccolo pulsante--sul-quadro"
          disabled={occupato !== null}
          onClick={() => void esegui('nuova', () => collegamento.comando('crea_stanza', { privata: false }))}
        >
          <Icona nome="piu" />
          Nuova stanza
        </button>
      </footer>
    </section>
  );
}

/* ---------------- Invito ---------------- */

/** Chi arriva da un link vede, al posto delle partenze, il biglietto della stanza in cui è invitato. */
function Biglietto({ codice }: { codice: string }): ReactNode {
  return (
    <section className="biglietto" aria-labelledby="titolo-biglietto">
      <header className="biglietto__testa">
        <h2 id="titolo-biglietto" className="biglietto__titolo">
          Invito
        </h2>
        <Pittogramma misura="2rem" />
      </header>
      <div className="biglietto__corpo">
        <p className="biglietto__etichetta">Stanza</p>
        <Palette testo={codice.toUpperCase()} misura="l" />
        <p className="biglietto__testo">
          Ti hanno invitato a questo tavolo. Scrivi il tuo nome e premi <b>Entra nella partita</b>: poi scegli il colore
          della pedina e ti siedi.
        </p>
      </div>
      <p className="biglietto__piede">
        <Icona nome="info" />
        Se la partita è già iniziata, entri come spettatore.
      </p>
    </section>
  );
}

/* ---------------- La home ---------------- */

/**
 * La home: a sinistra l'insegna e l'ingresso (nome, Gioca, stanza privata), a destra il tabellone delle partenze
 * con le stanze aperte. Con `invito` (codice della stanza) è la pagina di ingresso di chi arriva da un link:
 * il pulsante principale diventa «Entra nella partita» e a destra c'è il biglietto della stanza.
 */
export function Home({ invito, onEntra }: { invito?: string; onEntra?: () => void }): ReactNode {
  const [nome, setNome] = useState(preferenze.nome);
  const [giro, setGiro] = useState(0);
  const { occupato, esegui } = useVaiInStanza();
  const posto = usePostoTenuto();

  const cambiaNome = (valore: string) => {
    setNome(valore);
    preferenze.salvaNome(valore);
  };

  return (
    <div className="home">
      <header className="home__testata">
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

      <main className="home__palco">
        <div className="home__ingresso">
          <h1 className="home__insegna">
            {invito ? (
              <a
                href="/"
                className="home__insegna-link"
                title="Torna alla home"
                onClick={(e) => {
                  e.preventDefault();
                  vai('/');
                }}
              >
                <Marchio />
              </a>
            ) : (
              <Marchio />
            )}
          </h1>
          <p className="home__motto">Il gioco delle città italiane, da giocare con gli amici.</p>

          <form
            className="ingresso"
            onSubmit={(e) => {
              e.preventDefault();
              if (invito) onEntra?.();
              else void esegui('gioca', () => collegamento.comando('gioca', {}));
            }}
          >
            {!invito && posto && <Rientro key={posto.codice} posto={posto} />}
            <label className="ingresso__etichetta" htmlFor="nome">
              Il tuo nome
            </label>
            <div className="campo-nome">
              <input
                id="nome"
                className="campo"
                value={nome}
                maxLength={NOME_MAX}
                placeholder="Come ti chiami?"
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
            <Pulsante
              type="submit"
              variante="primario"
              misura="grande"
              largo
              icona="avanti"
              className="pulsante--gioca"
              disabled={occupato !== null}
            >
              {invito ? 'Entra nella partita' : occupato === 'gioca' ? 'Cerco una stanza…' : 'Gioca'}
            </Pulsante>
            <p className="ingresso__spiega">
              {invito
                ? 'Entri nella stanza a cui ti hanno invitato.'
                : 'Ti siedi nella prima stanza aperta con un posto libero, o ne apri una nuova.'}
            </p>
            <div className="ingresso__altri">
              <Pulsante
                variante="secondario"
                icona="lucchetto"
                disabled={occupato !== null}
                onClick={() => void esegui('privata', () => collegamento.comando('crea_stanza', { privata: true }))}
              >
                {occupato === 'privata' ? 'Preparo la stanza…' : 'Crea una stanza privata'}
              </Pulsante>
              <span className="ingresso__spiega-privata">Solo per chi riceve il link.</span>
            </div>
          </form>
        </div>

        {invito ? <Biglietto codice={invito} /> : <TabellonePartenze />}
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
