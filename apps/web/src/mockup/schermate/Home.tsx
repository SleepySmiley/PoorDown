import './home.css';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Dado, Palette, Pedina, PulsanteIcona, Soldi, Stemma } from './comuni';
import { variabili } from './utili';
import { NOMI_CASUALI, migliaia } from './dati';
import { Icona, type NomeIcona } from './icone';

interface Regola {
  icona: NomeIcona;
  nome: string;
  attiva: boolean;
}

interface Stanza {
  codice: string;
  colori: (number | 'ospite')[];
  max: number;
  /** Regole diverse da quelle standard. Vuoto = impostazioni standard. */
  regole: Regola[];
  soldi?: number;
}

const STANZE: Stanza[] = [
  { codice: 'K7Q2M', colori: [3, 2], max: 2, regole: [] },
  { codice: 'B4TXN', colori: [1, 'ospite'], max: 3, regole: [] },
  {
    codice: 'R9DLA',
    colori: [5],
    max: 4,
    regole: [
      { icona: 'monete', nome: 'Affitto doppio con la regione completa', attiva: true },
      { icona: 'martelletto', nome: 'Aste', attiva: true },
    ],
    soldi: 2000,
  },
  { codice: 'M2ZPE', colori: [4, 11, 9], max: 5, regole: [{ icona: 'uniforme', nome: 'Costruzione uniforme', attiva: false }] },
  { codice: 'T6WQA', colori: [7, 10, 8, 12], max: 6, regole: [] },
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

function SchedaStanza({ s }: { s: Stanza }): ReactNode {
  const standard = s.regole.length === 0 && s.soldi === undefined;
  return (
    <li>
      <button type="button" className="stanza-card">
        <span className="stanza-card__sinistra">
          <Palette testo={s.codice} />
          <span className="stanza-card__posti" aria-label={`${s.colori.length} giocatori su ${s.max}`}>
            {Array.from({ length: s.max }, (_, i) => {
              const c = s.colori[i];
              if (c === undefined) return <span key={i} className="posto-libero" />;
              if (c === 'ospite') return <Icona key={i} nome="persone" className="posto-ospite" />;
              return <Pedina key={i} colore={c} className="pedina--posto" />;
            })}
          </span>
        </span>
        <span className="stanza-card__destra">
          <span className="stanza-card__mappa">
            <Icona nome="mappa" />
            Classico
          </span>
          {standard ? (
            <span className="stanza-card__standard">Impostazioni standard</span>
          ) : (
            <span className="stanza-card__regole">
              {s.regole.map((r) => (
                <span
                  key={r.nome}
                  className={r.attiva ? 'regola-icona regola-icona--attiva' : 'regola-icona'}
                  title={`${r.nome}: ${r.attiva ? 'attiva' : 'disattivata'}`}
                >
                  <Icona nome={r.icona} />
                </span>
              ))}
              {s.soldi !== undefined && (
                <span className="regola-icona regola-icona--soldi" title="Soldi iniziali">
                  <Icona nome="banconota" />
                  {migliaia(s.soldi)}
                </span>
              )}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}

const PASSI: { testo: string; dettaglio?: string; figura: ReactNode }[] = [
  {
    testo: 'Ognuno parte con 1.500 €.',
    figura: <Soldi valore={1500} className="passo__soldi" />,
  },
  {
    testo: 'Al tuo turno tira i dadi e avanza.',
    dettaglio: 'Hai fatto un doppio? Tiri ancora.',
    figura: (
      <span className="passo__dadi">
        <Dado valore={4} />
        <Dado valore={4} />
      </span>
    ),
  },
  {
    testo: 'Compra le città dove ti fermi e fai crescere il tuo patrimonio.',
    dettaglio: 'Chi si ferma su una tua città ti paga l’affitto.',
    figura: (
      <span className="passo__citta">
        {[
          ['Padova', '220 €', 5],
          ['Verona', '220 €', 5],
          ['Venezia', '240 €', 5],
        ].map(([nome, prezzo, g]) => (
          <span key={nome} className="mini-casella" style={variabili({ '--gruppo': `var(--g${g})` })}>
            <Stemma gruppo={5} className="mini-casella__stemma" />
            <span className="mini-casella__nome">{nome}</span>
            <span className="mini-casella__prezzo">{prezzo}</span>
          </span>
        ))}
      </span>
    ),
  },
  {
    testo: 'Hai tutte le città di una regione? Costruisci case e alberghi.',
    dettaglio: 'Con le case l’affitto sale molto: con l’albergo incassi il massimo.',
    figura: (
      <span className="passo__case">
        <Icona nome="casa" />
        <Icona nome="casa" />
        <Icona nome="casa" />
        <Icona nome="albergo" />
      </span>
    ),
  },
  {
    testo: 'Diventa ricco, poi ancora più ricco. Non finire in bancarotta.',
    figura: <Icona nome="bandiera" className="passo__bandiera" />,
  },
];

function Passo({ p, i }: { p: (typeof PASSI)[number]; i: number }): ReactNode {
  const ref = useRef<HTMLLIElement>(null);
  const [visto, setVisto] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const osservatore = new IntersectionObserver(
      ([voce]) => {
        if (voce?.isIntersecting) {
          setVisto(true);
          osservatore.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    osservatore.observe(el);
    return () => osservatore.disconnect();
  }, []);
  return (
    <li ref={ref} className={visto ? 'passo passo--visto' : 'passo'}>
      <span className="passo__binario" aria-hidden="true">
        {i + 1}
      </span>
      <div className="passo__testo">
        <p>{p.testo}</p>
        {p.dettaglio && <p className="passo__dettaglio">{p.dettaglio}</p>}
      </div>
      <div className="passo__figura" aria-hidden="true">
        {visto && p.figura}
      </div>
    </li>
  );
}

export function Home(): ReactNode {
  const [nome, setNome] = useState('');
  const [giro, setGiro] = useState(0);
  const [stanze, setStanze] = useState(false);

  return (
    <div className="home">
      <header className="home__testata">
        <PulsanteIcona icona="volume" etichetta="Volume" />
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
          <h1 className="marchio__nome">PoorDown</h1>
          <p className="marchio__motto">Il gioco delle città italiane</p>
        </div>

        {!stanze ? (
          <form className="ingresso" key="ingresso" onSubmit={(e) => e.preventDefault()}>
            <div className="campo-nome">
              <label className="solo-lettori" htmlFor="nome">
                Il tuo nome
              </label>
              <input
                id="nome"
                className="campo"
                value={nome}
                maxLength={32}
                placeholder="Il tuo nome…"
                autoComplete="nickname"
                onChange={(e) => setNome(e.target.value)}
              />
              <button
                type="button"
                className="campo-nome__dado"
                onClick={() => {
                  setNome(NOMI_CASUALI[giro % NOMI_CASUALI.length] ?? '');
                  setGiro((g) => g + 1);
                }}
                aria-label="Scegli un nome a caso"
                title="Scegli un nome a caso"
              >
                <Icona nome="dado" key={giro} className={giro ? 'gira' : undefined} />
              </button>
            </div>
            <button type="submit" className="pulsante pulsante--primario pulsante--gioca">
              <Icona nome="avanti" />
              Gioca
            </button>
            <div className="ingresso__altri">
              <button type="button" className="pulsante pulsante--tenue" onClick={() => setStanze(true)}>
                <Icona nome="persone" />
                Tutte le stanze
              </button>
              <button type="button" className="pulsante pulsante--tenue">
                <Icona nome="lucchetto" />
                Crea una stanza privata
              </button>
            </div>
          </form>
        ) : (
          <section className="elenco-stanze pannello--scuro" key="stanze" aria-label="Tutte le stanze">
            <div className="elenco-stanze__barra">
              <button type="button" className="pulsante pulsante--piccolo pulsante--contorno-chiaro" onClick={() => setStanze(false)}>
                <Icona nome="partenza" />
                Indietro
              </button>
              <span className="elenco-stanze__spazio" />
              <button type="button" className="pulsante-icona pulsante-icona--contorno" aria-label="Aggiorna l’elenco" title="Aggiorna">
                <Icona nome="aggiorna" />
              </button>
              <button type="button" className="pulsante pulsante--piccolo pulsante--ambra">
                <Icona nome="piu" />
                Nuova stanza
              </button>
            </div>
            <p className="elenco-stanze__invito">Scegli la stanza in cui entrare:</p>
            <ul className="elenco-stanze__lista">
              {STANZE.map((s) => (
                <SchedaStanza key={s.codice} s={s} />
              ))}
            </ul>
            <p className="elenco-stanze__nota">
              <Icona nome="lucchetto" />
              Le stanze private non compaiono qui: si entra con il link.
            </p>
          </section>
        )}
      </main>

      <section id="come-si-gioca" className="come-si-gioca" aria-labelledby="titolo-regole">
        <h2 id="titolo-regole" className="come-si-gioca__titolo">
          Come si gioca
        </h2>
        <ol className="come-si-gioca__passi">
          {PASSI.map((p, i) => (
            <Passo key={i} p={p} i={i} />
          ))}
        </ol>
      </section>
    </div>
  );
}
