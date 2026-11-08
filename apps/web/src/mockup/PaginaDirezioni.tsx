import { useState, type CSSProperties, type ReactNode } from 'react';
import '@fontsource/young-serif/400.css';
import '@fontsource-variable/figtree/index.css';
import '@fontsource/barlow-condensed/500.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/600.css';
import '@fontsource-variable/bodoni-moda/index.css';
import '@fontsource-variable/instrument-sans/index.css';
import { Icona, type NomeIcona } from './icone';
import './direzioni.css';

type Direzione = 'maiolica' | 'partenze' | 'francobollo';

interface Colore {
  nome: string;
  hex: string;
}

interface InfoDirezione {
  id: Direzione;
  lettera: string;
  nome: string;
  idea: string;
  titoli: string;
  testo: string;
  base: Colore[];
  gruppi: string[];
  pedine: string[];
}

const REGIONI = ['Valle d’Aosta', 'Sardegna', 'Toscana', 'Sicilia', 'Veneto', 'Campania', 'Lazio', 'Lombardia'];

const DIREZIONI: InfoDirezione[] = [
  {
    id: 'maiolica',
    lettera: 'A',
    nome: 'Maiolica',
    idea: 'Le caselle sono piastrelle smaltate, come le ceramiche di Vietri e Caltagirone: bianco smalto, blu cobalto, giallo limone. Le pedine sono gettoni di ceramica lucida.',
    titoli: 'Young Serif',
    testo: 'Figtree',
    base: [
      { nome: 'Smalto', hex: '#FAFAF6' },
      { nome: 'Fuga', hex: '#D3DADF' },
      { nome: 'Cobalto', hex: '#1F4E9C' },
      { nome: 'Limone', hex: '#F2C12E' },
      { nome: 'Ramina', hex: '#2A8C6E' },
      { nome: 'Manganese', hex: '#4A3128' },
    ],
    gruppi: ['#9B6A4F', '#5DA9D6', '#2A8C6E', '#E8862F', '#7A4F9E', '#D1432F', '#E9B824', '#1F4E9C'],
    pedine: ['#1F4E9C', '#D1432F', '#2A8C6E', '#E9B824', '#7A4F9E', '#E8862F'],
  },
  {
    id: 'partenze',
    lettera: 'B',
    nome: 'Partenze',
    idea: 'Il tabellone come un cartello di stazione: blu della segnaletica ferroviaria, smalto bianco e le cifre a palette dei vecchi tabelloni delle partenze, che girano quando cambiano.',
    titoli: 'Barlow Condensed',
    testo: 'Barlow',
    base: [
      { nome: 'Segnale', hex: '#14427F' },
      { nome: 'Cemento', hex: '#DCE0E5' },
      { nome: 'Smalto', hex: '#FFFFFF' },
      { nome: 'Palette', hex: '#1D2026' },
      { nome: 'Ambra', hex: '#FFB81C' },
      { nome: 'Testo', hex: '#14243D' },
    ],
    gruppi: ['#8C5A3C', '#3DB2E8', '#00965E', '#F08C00', '#8E44AD', '#E2231A', '#F5C400', '#14427F'],
    pedine: ['#E2231A', '#00965E', '#F08C00', '#3DB2E8', '#8E44AD', '#F5C400'],
  },
  {
    id: 'francobollo',
    lettera: 'C',
    nome: 'Francobollo',
    idea: 'Le proprietà sono francobolli dentellati su carta da pacchi; chi compra mette il suo timbro postale. Le pedine sono sigilli di ceralacca, i due mazzi una busta e una cartolina.',
    titoli: 'Bodoni Moda',
    testo: 'Instrument Sans',
    base: [
      { nome: 'Kraft', hex: '#CDB28A' },
      { nome: 'Carta', hex: '#FBF7EE' },
      { nome: 'Inchiostro', hex: '#2D2734' },
      { nome: 'Timbro', hex: '#4E3F7A' },
      { nome: 'Posta rossa', hex: '#C4342D' },
      { nome: 'Posta blu', hex: '#22428F' },
    ],
    gruppi: ['#7B4B2A', '#3E7CB1', '#2F6B4F', '#C46A1B', '#6A3F7F', '#B3262D', '#B08A12', '#22428F'],
    pedine: ['#B3262D', '#22428F', '#2F6B4F', '#B08A12', '#6A3F7F', '#C46A1B'],
  },
];

interface Giocatore {
  nome: string;
  colore: number;
  saldo: string;
  turno?: boolean;
  host?: boolean;
  prigione?: boolean;
  debito?: boolean;
}

const GIOCATORI: Giocatore[] = [
  { nome: 'Giulia', colore: 0, saldo: '1.340 €', turno: true, host: true },
  { nome: 'Marco', colore: 1, saldo: '860 €', prigione: true },
  { nome: 'Sara', colore: 2, saldo: '−45 €', debito: true },
];

interface DatiCasella {
  tipo: 'citta' | 'stazione' | 'tassa' | 'carta' | 'angolo';
  nome: string;
  prezzo?: string;
  gruppo?: number;
  icona?: NomeIcona;
  proprietario?: number;
  case?: number;
  pedine?: number[];
}

/** L'angolo in basso a destra del tabellone: dalla Stazione Nord (5) alla Partenza (0). */
const STRISCIA: DatiCasella[] = [
  { tipo: 'stazione', nome: 'Stazione Nord', prezzo: '200 €', icona: 'treno' },
  { tipo: 'tassa', nome: 'Imposta sul reddito', prezzo: '10%', icona: 'percento' },
  { tipo: 'citta', nome: 'Aosta', prezzo: '60 €', gruppo: 1, proprietario: 0, case: 2, pedine: [0] },
  { tipo: 'carta', nome: 'Busta', icona: 'busta' },
  { tipo: 'citta', nome: 'Courmayeur', prezzo: '60 €', gruppo: 1 },
  { tipo: 'angolo', nome: 'Partenza', prezzo: '+200 €', icona: 'freccia', pedine: [2] },
];

const AFFITTI_NAPOLI: [string, string][] = [
  ['Affitto', '24 €'],
  ['Con 1 casa', '120 €'],
  ['Con 2 case', '360 €'],
  ['Con 3 case', '850 €'],
  ['Con 4 case', '1.025 €'],
  ['Con l’albergo', '1.200 €'],
];

const REGISTRO: [string, string][] = [
  ['21:42', 'Giulia ha comprato Aosta per 60 €.'],
  ['21:41', 'Giulia ha tirato 4 e 2.'],
  ['21:40', 'Marco è andato in prigione.'],
];

const SIGILLO =
  'M50 4c9 0 14 6 22 8s16 6 18 15-2 14 1 22 6 16 1 24-14 10-20 15-12 9-22 8-14-6-22-9S10 82 7 74s1-15-1-23-5-16 1-23 14-8 21-13S41 4 50 4z';

function variabili(valori: Record<string, string>): CSSProperties {
  return valori as CSSProperties;
}

/** Cifre a palette nella direzione Partenze, testo normale nelle altre. */
function Valore({ dir, testo }: { dir: Direzione; testo: string }) {
  if (dir !== 'partenze') return <>{testo}</>;
  // Solo le cifre girano: l'unità (€) resta stampata accanto.
  const parti = /^([−+-]?[\d.,]+%?)\s*(.*)$/.exec(testo);
  const cifre = parti?.[1] ?? testo;
  const unita = parti?.[2] ?? '';
  return (
    <span className="palette">
      <span className="solo-lettori">{testo}</span>
      {[...cifre].map((carattere, i) => (
        <span key={i} className="paletta" style={variabili({ '--i': String(i) })} aria-hidden="true">
          {carattere}
        </span>
      ))}
      {unita && (
        <span className="palette__unita" aria-hidden="true">
          {unita}
        </span>
      )}
    </span>
  );
}

function Pedina({ dir, colore, iniziale }: { dir: Direzione; colore: number; iniziale?: string }) {
  const stile = variabili({ '--colore': `var(--p${colore + 1})` });
  if (dir === 'francobollo') {
    return (
      <svg className="pedina pedina--sigillo" viewBox="0 0 100 100" style={stile} aria-hidden="true">
        <path d={SIGILLO} fill="var(--colore)" />
        <circle cx="50" cy="50" r="29" fill="none" stroke="rgba(0,0,0,.28)" strokeWidth="4" />
        <circle cx="50" cy="50" r="29" fill="none" stroke="rgba(255,255,255,.22)" strokeWidth="2" transform="translate(-1.5 -1.5)" />
        {iniziale && (
          <text x="50" y="63" textAnchor="middle">
            {iniziale}
          </text>
        )}
      </svg>
    );
  }
  return (
    <span className="pedina" style={stile} aria-hidden="true">
      {iniziale}
    </span>
  );
}

function Timbro({ colore, testo }: { colore: number; testo: string }) {
  return (
    <svg className="timbro" viewBox="0 0 120 70" style={variabili({ '--colore': `var(--p${colore + 1})` })} aria-hidden="true">
      <circle cx="35" cy="35" r="30" />
      <circle cx="35" cy="35" r="22" strokeWidth="1.2" />
      <text x="35" y="39" textAnchor="middle">
        {testo}
      </text>
      <path d="M68 22q7-5 14 0t14 0t14 0M68 35q7-5 14 0t14 0t14 0M68 48q7-5 14 0t14 0t14 0" />
    </svg>
  );
}

function Casella({ dir, c }: { dir: Direzione; c: DatiCasella }) {
  const posseduta = c.proprietario !== undefined;
  const classi = ['casella', `casella--${c.tipo}`, posseduta ? 'casella--posseduta' : ''].join(' ');
  return (
    <div className={classi} style={c.gruppo ? variabili({ '--gruppo': `var(--g${c.gruppo})` }) : undefined}>
      {c.gruppo && <div className="casella__fascia" />}
      {c.icona && <Icona nome={c.icona} className="casella__icona" />}
      <div className={/^\S{10,}$/.test(c.nome) ? 'casella__nome casella__nome--lunga' : 'casella__nome'}>{c.nome}</div>
      {posseduta ? (
        <div className="casella__possesso" style={variabili({ '--proprietario': `var(--p${(c.proprietario ?? 0) + 1})` })}>
          {Array.from({ length: c.case ?? 0 }, (_, i) => (
            <Icona key={i} nome="casa" className="casella__casa" />
          ))}
        </div>
      ) : (
        c.prezzo && (
          <div className="casella__prezzo">
            <Valore dir={dir} testo={c.prezzo} />
          </div>
        )
      )}
      {dir === 'francobollo' && posseduta && <Timbro colore={c.proprietario ?? 0} testo="G" />}
      {c.pedine && (
        <div className="casella__pedine">
          {c.pedine.map((p) => (
            <Pedina key={p} dir={dir} colore={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function Dado({ valore }: { valore: 1 | 2 | 3 | 4 | 5 | 6 }) {
  const punti: Record<number, number[]> = {
    1: [5],
    2: [1, 9],
    3: [1, 5, 9],
    4: [1, 3, 7, 9],
    5: [1, 3, 5, 7, 9],
    6: [1, 3, 4, 6, 7, 9],
  };
  return (
    <div className="dado" role="img" aria-label={`Dado: ${valore}`}>
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={punti[valore]?.includes(i + 1) ? 'punto' : undefined} />
      ))}
    </div>
  );
}

function Scheda({ dir }: { dir: Direzione }) {
  return (
    <article className="scheda" style={variabili({ '--gruppo': 'var(--g6)' })} aria-label="Scheda di Napoli">
      <header className="scheda__testa">
        <p className="scheda__regione">Campania</p>
        <h3 className="scheda__citta">Napoli</h3>
        {dir === 'francobollo' && (
          <p className="scheda__valore">
            280<span>€</span>
          </p>
        )}
      </header>
      <table className="scheda__affitti">
        <tbody>
          {AFFITTI_NAPOLI.map(([voce, importo]) => (
            <tr key={voce}>
              <th scope="row">{voce}</th>
              <td>
                <Valore dir={dir} testo={importo} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="scheda__piede">
        <div>
          <dt>Prezzo</dt>
          <dd>280 €</dd>
        </div>
        <div>
          <dt>Casa</dt>
          <dd>150 €</dd>
        </div>
        <div>
          <dt>Albergo</dt>
          <dd>150 €</dd>
        </div>
      </dl>
    </article>
  );
}

function Tavolo({ dir }: { dir: Direzione }) {
  return (
    <div className="tavolo">
      <div className="pannello-giocatori">
        <ul className="giocatori">
          {GIOCATORI.map((g) => (
            <li
              key={g.nome}
              className={['giocatore', g.turno ? 'giocatore--turno' : '', g.debito ? 'giocatore--debito' : ''].join(' ')}
            >
              <span className={g.prigione ? 'avatar avatar--prigione' : 'avatar'}>
                <Pedina dir={dir} colore={g.colore} iniziale={g.nome[0]} />
              </span>
              <span className="giocatore__nome">
                <span className="giocatore__testo">{g.nome}</span>
                {g.host && <Icona nome="corona" className="giocatore__corona" />}
                {g.prigione && <span className="giocatore__stato">In prigione</span>}
                {g.turno && <span className="giocatore__stato">Di turno</span>}
              </span>
              <span className="giocatore__saldo">
                <Valore dir={dir} testo={g.saldo} />
              </span>
            </li>
          ))}
        </ul>
        <ol className="registro" aria-label="Ultimi eventi">
          {REGISTRO.map(([ora, testo]) => (
            <li key={ora}>
              {dir === 'partenze' && <span className="registro__ora">{ora}</span>}
              {testo}
            </li>
          ))}
        </ol>
      </div>
      <div className="turno">
        <div className="dadi">
          <Dado valore={4} />
          <Dado valore={2} />
        </div>
        <div className="azioni">
          <button type="button" className="pulsante pulsante--primario">
            Tira i dadi
          </button>
          <button type="button" className="pulsante pulsante--secondario">
            Termina il turno
          </button>
          <button type="button" className="pulsante pulsante--pericolo">
            Bancarotta
          </button>
        </div>
      </div>
    </div>
  );
}

function Campionario({ info }: { info: InfoDirezione }) {
  return (
    <aside className="campionario" aria-label={`Colori e caratteri di ${info.nome}`}>
      <div className="campionario__blocco">
        <h4>Colori</h4>
        <ul className="colori">
          {info.base.map((c) => (
            <li key={c.nome} className="colore">
              <span className="colore__tinta" style={{ background: c.hex }} />
              <span>{c.nome}</span>
              <code>{c.hex}</code>
            </li>
          ))}
        </ul>
      </div>
      <div className="campionario__blocco">
        <h4>Regioni</h4>
        <ul className="gruppi">
          {REGIONI.map((regione, i) => (
            <li key={regione}>
              <span className="gruppi__tinta" style={{ background: info.gruppi[i] }} />
              {regione}
            </li>
          ))}
        </ul>
      </div>
      <div className="campionario__blocco">
        <h4>Caratteri</h4>
        <p className="caratteri__titolo">Milano 400 €</p>
        <p className="caratteri__nota">{info.titoli}, per nomi e cifre</p>
        <p className="caratteri__testo">Giulia ha comprato Aosta per 60 €.</p>
        <p className="caratteri__nota">{info.testo}, per l’interfaccia</p>
      </div>
      <div className="campionario__blocco">
        <h4>Pedine</h4>
        <div className="pedine-grandi">
          {info.pedine.map((_, i) => (
            <Pedina key={i} dir={info.id} colore={i} />
          ))}
        </div>
      </div>
    </aside>
  );
}

function SezioneDirezione({ info }: { info: InfoDirezione }) {
  const [giro, setGiro] = useState(0);
  const colori: Record<string, string> = {};
  info.gruppi.forEach((hex, i) => (colori[`--g${i + 1}`] = hex));
  info.pedine.forEach((hex, i) => (colori[`--p${i + 1}`] = hex));

  return (
    <section id={info.id} className={`direzione dir-${info.id}`} style={variabili(colori)}>
      <div className="direzione__dentro" key={giro}>
        <header className="direzione__testa">
          <span className="direzione__lettera" aria-hidden="true">
            {info.lettera}
          </span>
          <h2 className="direzione__nome">{info.nome}</h2>
          <p className="direzione__idea">{info.idea}</p>
        </header>

        <div className="striscia" role="img" aria-label="Angolo del tabellone, dalla Stazione Nord alla Partenza">
          {STRISCIA.map((c) => (
            <Casella key={c.nome} dir={info.id} c={c} />
          ))}
        </div>

        {info.id === 'partenze' && (
          <button type="button" className="pulsante pulsante--secondario rigira" onClick={() => setGiro((g) => g + 1)}>
            Fai girare le palette
          </button>
        )}

        <div className="pannelli">
          <Scheda dir={info.id} />
          <Tavolo dir={info.id} />
          <Campionario info={info} />
        </div>
      </div>
    </section>
  );
}

export function Pagina(): ReactNode {
  return (
    <>
      <header className="cornice">
        <h1>Tre stili per PoorDown</h1>
        <p>Stesse caselle, stessa scheda e stessi giocatori, disegnati in tre modi. I prezzi sono di esempio.</p>
        <nav aria-label="Direzioni">
          {DIREZIONI.map((d) => (
            <a key={d.id} href={`#${d.id}`}>
              {d.lettera} · {d.nome}
            </a>
          ))}
        </nav>
      </header>
      <main>
        {DIREZIONI.map((d) => (
          <SezioneDirezione key={d.id} info={d} />
        ))}
      </main>
    </>
  );
}
