import '../stili/tabellone.css';
import type { CSSProperties, ReactNode } from 'react';
import {
  euro,
  LIVELLO_ALBERGO,
  proprietabile,
  tabellone,
  type Giocatore,
  type IdGiocatore,
  type IdMappa,
  type Proprieta,
  type Regione,
  type Stato,
} from '@poordown/engine';
import { caselleVista, type CasellaVista } from '../ui/caselle';
import { Pedina, Stemma } from '../ui/comuni';
import { ANGOLO, geometria, righeAffitto, type Geometria } from '../ui/geometria';
import { Icona, IconaCasella } from '../ui/icone';
import { variabili } from '../ui/utili';

/** Chi possiede la casella, con edifici e ipoteca. */
interface Possesso {
  proprietario: Giocatore;
  livello: number;
  ipotecata: boolean;
}

function possesso(partita: Stato | null, n: number): Possesso | undefined {
  const p: Proprieta | null | undefined = partita?.proprieta[n];
  if (!p?.proprietario) return undefined;
  const proprietario = partita?.giocatori.find((g) => g.id === p.proprietario);
  return proprietario ? { proprietario, livello: p.livello, ipotecata: p.ipotecata } : undefined;
}

/* ---------------- Scheda della proprietà ---------------- */

export function SchedaProprieta({
  mappa,
  partita,
  n,
  azioni,
  ipoteca,
  onChiudi,
  className,
  style,
}: {
  mappa: IdMappa;
  partita: Stato | null;
  n: number;
  /** Pulsanti sotto la tabella degli affitti (costruisci, vendi). */
  azioni?: ReactNode;
  /** Pulsante dell'ipoteca, in alto sotto il nome. */
  ipoteca?: ReactNode;
  onChiudi?: () => void;
  className?: string;
  style?: CSSProperties;
}): ReactNode {
  const tab = tabellone(mappa);
  const c = caselleVista(mappa)[n];
  const prop = proprietabile(tab, n);
  if (!c || !prop) return null;
  const p = possesso(partita, n);
  const righe = righeAffitto(tab, n);
  const regione = prop.tipo === 'citta' ? tab.regioni[prop.regione] : undefined;
  // Ipotecata non riscuote: nessuna riga di affitto evidenziata.
  const livello = prop.tipo === 'citta' && p && !p.ipotecata ? p.livello : -1;
  return (
    <article
      className={className ? `scheda ${className}` : 'scheda'}
      style={{ ...style, ...(c.tinta ? variabili({ '--gruppo': `var(--g${c.tinta})` }) : {}) }}
      aria-label={`Scheda di ${c.nome}`}
    >
      <header className={regione ? 'scheda__testa' : 'scheda__testa scheda__testa--senza-regione'}>
        {regione ? (
          <p className="scheda__regione">{regione.nome}</p>
        ) : (
          c.icona && <Icona nome={c.icona} className="scheda__icona" />
        )}
        <h3 className="scheda__nome">{c.nome}</h3>
        {onChiudi && (
          <button type="button" className="scheda__chiudi" aria-label="Chiudi la scheda" onClick={onChiudi}>
            <Icona nome="chiudi" />
          </button>
        )}
      </header>
      {p?.ipotecata && <p className="scheda__ipoteca">Ipotecata: non riscuote affitti</p>}
      {ipoteca && <div className="scheda__ipoteca-azione">{ipoteca}</div>}
      <table className="scheda__affitti">
        <thead>
          <tr>
            <th scope="col">Quando</th>
            <th scope="col">Incassi</th>
          </tr>
        </thead>
        <tbody>
          {righe.map(([voce, importo], i) => (
            <tr key={voce} className={i === livello ? 'scheda__attuale' : undefined}>
              <th scope="row">{voce}</th>
              <td>{importo}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {azioni && <div className="scheda__azioni">{azioni}</div>}
      <p className="scheda__proprietario">
        <span>Proprietario</span>
        {p ? (
          <strong>
            <Pedina colore={p.proprietario.colore} className="pedina--mini" />
            {p.proprietario.nome}
          </strong>
        ) : (
          <strong>Nessuno</strong>
        )}
      </p>
      <dl className="scheda__piede">
        <div>
          <dt>Prezzo</dt>
          <dd>{euro(prop.prezzo)}</dd>
        </div>
        {regione && (
          <>
            <div>
              <dt>
                <Icona nome="casa" titolo="Casa" />
              </dt>
              <dd>{euro(regione.costoCasa)}</dd>
            </div>
            <div>
              <dt>
                <Icona nome="albergo" titolo="Albergo" />
              </dt>
              <dd>{euro(regione.costoAlbergo)}</dd>
            </div>
          </>
        )}
      </dl>
    </article>
  );
}

/* ---------------- Caselle ---------------- */

function descriviEdifici(p: Possesso): string {
  if (p.livello === LIVELLO_ALBERGO) return ', con l’albergo';
  if (p.livello === 1) return ', con 1 casa';
  return p.livello > 1 ? `, con ${p.livello} case` : '';
}

/**
 * Chi possiede la casella: un blocco pieno del suo colore sul bordo esterno, al posto
 * del prezzo. È l'unico colore pieno della casella (la regione sta solo nello stemma).
 * Dentro: una casa con «×N», l'albergo, oppure la banca se è ipotecata.
 */
function Blocco({ p }: { p: Possesso }): ReactNode {
  let edifici: ReactNode = null;
  if (p.ipotecata) {
    edifici = <Icona nome="banca" className="casella__edificio casella__edificio--ipoteca" />;
  } else if (p.livello === LIVELLO_ALBERGO) {
    edifici = <Icona nome="albergo" className="casella__edificio casella__edificio--albergo" />;
  } else if (p.livello > 0) {
    edifici = (
      <>
        <Icona nome="casa" className="casella__edificio" />
        <span className="casella__case">×{p.livello}</span>
      </>
    );
  }
  return (
    <span
      className={p.ipotecata ? 'casella__blocco casella__blocco--ipotecata' : 'casella__blocco'}
      title={`${p.ipotecata ? 'Ipotecata, di' : 'Di'} ${p.proprietario.nome}${descriviEdifici(p)}`}
    >
      {edifici}
    </span>
  );
}

/** Nomi lunghi: carattere più piccolo; con due parole possono andare su due righe. M e W contano una lettera e mezza. */
function classeNome(nome: string): string {
  if (/\s/.test(nome) && nome.length >= 11) return 'casella__nome casella__nome--due-righe';
  const larghezza = nome.length + (nome.match(/[mwMW]/g)?.length ?? 0) / 2;
  if (larghezza >= 10) return 'casella__nome casella__nome--lunga';
  return 'casella__nome';
}

function CasellaTabellone({
  c,
  geo,
  regione,
  p,
  selezionata,
  onApri,
}: {
  c: CasellaVista;
  geo: Geometria;
  regione: Regione | undefined;
  p?: Possesso;
  selezionata: boolean;
  onApri?: (n: number) => void;
}): ReactNode {
  const { riga, colonna, lato } = geo.posto(c.n);
  const proprieta = c.tipo === 'citta' || c.tipo === 'stazione' || c.tipo === 'servizio';
  const nome = c.breve ?? c.nome;
  const classi = [
    'casella',
    `casella--${lato}`,
    `casella--${c.tipo}`,
    c.tipo === 'angolo' ? `casella--angolo-${c.angolo}` : '',
    p ? 'casella--posseduta' : '',
    selezionata ? 'casella--selezionata' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const stile = {
    gridRow: riga,
    gridColumn: colonna,
    ...(p ? variabili({ '--proprietario': `var(--p${p.proprietario.colore})` }) : {}),
  };

  // Dal bordo interno verso quello esterno, uguale sui quattro lati:
  // stemma o icona, nome, poi prezzo o blocco del proprietario.
  const corpo =
    c.tipo === 'angolo' ? (
      <span className="casella__corpo">
        {c.sotto ? (
          <>
            <span className="casella__cella" aria-hidden="true" />
            <span className="casella__nome">{c.nome}</span>
            <span className="casella__sotto">{c.sotto}</span>
          </>
        ) : (
          <>
            {c.icona && <Icona nome={c.icona} className="casella__pittogramma" />}
            <span className="casella__nome">{c.nome}</span>
          </>
        )}
      </span>
    ) : (
      <span className="casella__corpo">
        {c.gruppo !== undefined && <Stemma regione={regione} className="casella__stemma" />}
        {c.icona && <IconaCasella nome={c.icona} className="casella__icona" />}
        {c.importo && <span className="casella__importo">{c.importo}</span>}
        <span className={classeNome(nome)}>{nome}</span>
        {p ? <Blocco p={p} /> : c.prezzo !== undefined && <span className="casella__prezzo">{euro(c.prezzo)}</span>}
      </span>
    );

  if (!proprieta) {
    return (
      <div className={classi} style={stile} title={c.breve ? c.nome : undefined}>
        {corpo}
      </div>
    );
  }
  const stato = p
    ? `, di ${p.proprietario.nome}${p.ipotecata ? ', ipotecata' : descriviEdifici(p)}`
    : `, ${euro(c.prezzo ?? 0)}`;
  return (
    <button
      type="button"
      className={classi}
      style={stile}
      onClick={() => onApri?.(c.n)}
      aria-label={`${c.nome}${stato}`}
      aria-expanded={selezionata}
    >
      {corpo}
    </button>
  );
}

/* ---------------- Pedine ---------------- */

export interface Segnaposto {
  id: IdGiocatore;
  colore: number;
  /** Iniziale del nome, come nel disco della lista dei giocatori. */
  iniziale?: string;
  posizione: number;
  prigione?: boolean;
  /** Cambia a ogni passo: fa saltellare la pedina. */
  passo?: number;
  evidenziata?: boolean;
}

/** Una k (1 px a 820 px di lato, sul tabellone da 40 caselle) in percentuale del tabellone. */
const K = 0.122;
/** Diametro del disco della pedina, in k. */
const DISCO = 30;

/** Più pedine sulla stessa casella: in griglia e più piccole, sempre dentro la casella. */
function disposizione(quante: number, dove: 'lato' | 'angolo' | 'colonna'): { colonne: number; scala: number } {
  // In visita: in colonna sulla striscia a destra della cella.
  if (dove === 'colonna') return { colonne: quante <= 4 ? 1 : 2, scala: quante <= 2 ? 1 : 0.7 };
  // Gli angoli sono larghi: fino a quattro pedine in fila sulla metà libera.
  if (dove === 'angolo') {
    if (quante <= 3) return { colonne: Math.max(1, quante), scala: 1 };
    return { colonne: 4, scala: quante === 4 ? 0.75 : 0.7 };
  }
  if (quante <= 1) return { colonne: 1, scala: 1 };
  if (quante === 2) return { colonne: 2, scala: 1 };
  if (quante <= 4) return { colonne: 2, scala: 0.8 };
  if (quante <= 6) return { colonne: 3, scala: 0.66 };
  return { colonne: 4, scala: 0.54 };
}

function coordinatePedine(
  pedine: Segnaposto[],
  caselle: CasellaVista[],
  prigione: number,
  geo: Geometria,
): Map<IdGiocatore, { x: number; y: number; scala: number }> {
  const gruppi = new Map<string, Segnaposto[]>();
  for (const p of pedine) {
    const chiave = `${p.posizione}${p.prigione ? 'p' : ''}`;
    gruppi.set(chiave, [...(gruppi.get(chiave) ?? []), p]);
  }
  const profondita = ANGOLO * geo.unita;
  const k = K * geo.scala;
  const risultato = new Map<IdGiocatore, { x: number; y: number; scala: number }>();
  for (const lista of gruppi.values()) {
    const primo = lista[0];
    if (!primo) continue;
    const n = primo.posizione;
    const lato = geo.posto(n).lato;
    const tipo = caselle[n]?.tipo;
    const casellaPrigione = n === prigione;
    const angolo = lato === 'angolo' && !casellaPrigione;
    const inVisita = casellaPrigione && !primo.prigione;
    const { colonne, scala } = disposizione(lista.length, inVisita ? 'colonna' : angolo ? 'angolo' : 'lato');
    const righe = Math.ceil(lista.length / colonne);
    const passo = (DISCO * scala + 3) * k;
    let { x, y } = geo.centro(n);

    // Sui lati la pedina sta tra il nome e il bordo esterno; su carte e tasse il bordo
    // esterno ha solo il nome, quindi può scendere un po' di più.
    const spinta = (tipo === 'carta' || tipo === 'tassa' ? 0.1 : 0.06) * profondita;
    if (lato === 'basso') y += spinta;
    if (lato === 'alto') y -= spinta;
    if (lato === 'sinistra') x -= spinta;
    if (lato === 'destra') x += spinta;
    // Partenza: testo in alto, pedine in basso. Vacanza e Vai in prigione: il contrario.
    if (angolo) y += (n === 0 ? 1 : -1) * (0.33 * profondita - ((righe - 1) * passo) / 2);
    // Prigione: nella cella (in basso a sinistra) o in visita (sulla striscia a destra).
    if (casellaPrigione) {
      x += (primo.prigione ? -0.17 : 0.33) * profondita;
      y += (primo.prigione ? 0.1 : 0.08) * profondita;
    }

    lista.forEach((p, i) => {
      const r = Math.floor(i / colonne);
      const nellaRiga = r === righe - 1 ? lista.length - r * colonne : colonne;
      // a: lungo la larghezza della casella; b: lungo la profondità.
      const a = ((i % colonne) - (nellaRiga - 1) / 2) * passo;
      const b = (r - (righe - 1) / 2) * passo;
      const inColonna = lato === 'sinistra' || lato === 'destra' || inVisita;
      risultato.set(p.id, inColonna ? { x: x + b, y: y + a, scala } : { x: x + a, y: y + b, scala });
    });
  }
  return risultato;
}

/* ---------------- Tabellone ---------------- */

export function Tabellone({
  mappa,
  partita,
  pedine,
  centro,
  sopra,
  sfocato,
  selezionata,
  onApri,
}: {
  mappa: IdMappa;
  /** Per i proprietari delle caselle; `null` in lobby. */
  partita: Stato | null;
  pedine: Segnaposto[];
  /** Contenuto al centro del tabellone (dadi, pulsanti, registro). */
  centro?: ReactNode;
  /** Livello sopra al tabellone (scheda aperta). */
  sopra?: ReactNode;
  sfocato?: boolean;
  selezionata?: number;
  onApri?: (n: number) => void;
}): ReactNode {
  const tab = tabellone(mappa);
  const caselle = caselleVista(mappa);
  const geo = geometria(caselle.length);
  const coordinate = coordinatePedine(pedine, caselle, tab.prigione, geo);
  const interno = `2 / ${geo.lato + 1}`;
  return (
    <div className="tabellone" style={variabili({ '--scala': String(geo.scala) })}>
      <div
        className={sfocato ? 'tabellone__griglia tabellone__griglia--sfocata' : 'tabellone__griglia'}
        style={{ gridTemplateColumns: geo.tracce, gridTemplateRows: geo.tracce }}
      >
        {caselle.map((c) => (
          <CasellaTabellone
            key={c.n}
            c={c}
            geo={geo}
            regione={c.gruppo ? tab.regioni[c.gruppo - 1] : undefined}
            p={possesso(partita, c.n)}
            selezionata={selezionata === c.n}
            onApri={onApri}
          />
        ))}
        <div className="tabellone__centro" style={{ gridRow: interno, gridColumn: interno }}>
          {!sfocato && centro}
        </div>
        <div className="tabellone__pedine" aria-hidden="true">
          {pedine.map((p) => {
            const xy = coordinate.get(p.id) ?? { x: 0, y: 0, scala: 1 };
            return (
              <span
                key={p.id}
                className={p.evidenziata ? 'segnaposto segnaposto--turno' : 'segnaposto'}
                style={variabili({ '--x': `${xy.x}%`, '--y': `${xy.y}%`, '--s': String(xy.scala) })}
              >
                <span className="segnaposto__salto" key={p.passo ?? 0}>
                  {/* In prigione le sbarre stanno sopra la pedina, come nella lista dei giocatori. */}
                  <span className={p.prigione ? 'segnaposto__disco in-prigione' : 'segnaposto__disco'}>
                    <Pedina colore={p.colore} iniziale={p.iniziale} className="pedina--tabellone" />
                  </span>
                </span>
              </span>
            );
          })}
        </div>
      </div>
      {sfocato && <div className="tabellone__velo">{centro}</div>}
      {sopra}
    </div>
  );
}
