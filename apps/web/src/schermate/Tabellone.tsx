import '../stili/tabellone.css';
import { useState, type CSSProperties, type ReactNode } from 'react';
import { motion } from 'motion/react';
import {
  affitto,
  alleati,
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
import { Pedina, Soldi, Stemma } from '../ui/comuni';
import { CORNICE, FASCIA_VISITA, FUGA, geometria, righeAffitto, type Geometria } from '../ui/geometria';
import { Icona, IconaCasella } from '../ui/icone';
import { COMPARSA } from '../ui/movimento';
import { iniziali, variabili } from '../ui/utili';

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

/**
 * Affitti della scheda calcolati dal motore, come se il proprietario non fosse in prigione e la casella
 * non fosse ipotecata: così con «Affitto doppio» la riga senza case mostra il doppio.
 * Per le città una riga per livello; per stazioni e servizi `undefined` (la tabella fissa va bene).
 */
function affittiCitta(partita: Stato, n: number): number[] | undefined {
  const tab = tabellone(partita.mappa);
  const p = partita.proprieta[n];
  if (tab.caselle[n]?.tipo !== 'citta' || !p?.proprietario) return undefined;
  return Array.from({ length: LIVELLO_ALBERGO + 1 }, (_, livello) =>
    affitto(
      {
        ...partita,
        impostazioni: { ...partita.impostazioni, nienteAffittoInPrigione: false },
        proprieta: partita.proprieta.map((x, i) => (i === n && x ? { ...x, livello, ipotecata: false } : x)),
      },
      n,
      0,
    ),
  );
}

/** La riga della tabella che vale adesso: livello della città, o quante stazioni/servizi ha il proprietario. -1 se nessuna. */
function rigaAttuale(partita: Stato, n: number): number {
  const tab = tabellone(partita.mappa);
  const c = tab.caselle[n];
  const p = partita.proprieta[n];
  // Ipotecata non riscuote: nessuna riga evidenziata.
  if (!c || !p?.proprietario || p.ipotecata) return -1;
  if (c.tipo === 'citta') return p.livello;
  if (c.tipo !== 'stazione' && c.tipo !== 'servizio') return -1;
  // Come il motore: contano anche quelle dei compagni di squadra, non quelle ipotecate.
  const proprietario = p.proprietario;
  const quante = partita.proprieta.filter(
    (x, i) => x?.proprietario != null && !x.ipotecata && tab.caselle[i]?.tipo === c.tipo && alleati(partita, x.proprietario, proprietario),
  ).length;
  return quante - 1;
}

/** Le case da contare (1–4) o la piastrina dell'albergo: le stesse sul tabellone e nella scheda. */
function Edifici({ livello, className }: { livello: number; className: string }): ReactNode {
  if (livello === LIVELLO_ALBERGO) return <span className={`${className} edifici edifici--albergo`}>Hotel</span>;
  if (livello <= 0) return null;
  return (
    <span className={`${className} edifici`}>
      {Array.from({ length: livello }, (_, i) => (
        <i key={i} className="edifici__casa" />
      ))}
    </span>
  );
}

/* ---------------- Scheda della proprietà ---------------- */

/**
 * La scheda di una proprietà, come un biglietto: testata del colore della regione con lo stemma,
 * affitti con le case da contare, piede a matrice con il prezzo a palette.
 * `onChiedi`: se c'è e la proprietà ha un proprietario, mostra «Chiedila a <nome>» (va passato solo per le proprietà degli altri).
 */
export function SchedaProprieta({
  mappa,
  partita,
  n,
  azioni,
  ipoteca,
  onChiudi,
  onChiedi,
  className,
  style,
  animata,
}: {
  mappa: IdMappa;
  partita: Stato | null;
  n: number;
  /** Pulsanti sotto la tabella degli affitti (costruisci, vendi). */
  azioni?: ReactNode;
  /** Pulsante dell'ipoteca, in alto sotto il nome. */
  ipoteca?: ReactNode;
  onChiudi?: () => void;
  /** Proprietà di un altro giocatore: apre uno scambio per chiedergliela. */
  onChiedi?: () => void;
  className?: string;
  style?: CSSProperties;
  /** Popover che si apre e si chiude con Motion (mettila dentro un AnimatePresence). */
  animata?: boolean;
}): ReactNode {
  const tab = tabellone(mappa);
  const c = caselleVista(mappa)[n];
  const prop = proprietabile(tab, n);
  if (!c || !prop) return null;
  const p = possesso(partita, n);
  const veri = partita ? affittiCitta(partita, n) : undefined;
  // Con la regione completa e la regola «Affitto doppio» la riga senza case raddoppia.
  const doppio = prop.tipo === 'citta' && (veri?.[0] ?? 0) > prop.affitti[0];
  const righe = righeAffitto(tab, n).map(([voce, importo], i): [string, string] => {
    const vero = veri?.[i];
    return [i === 0 && doppio ? 'Affitto doppio' : voce, vero === undefined ? importo : euro(vero)];
  });
  const regione = prop.tipo === 'citta' ? tab.regioni[prop.regione] : undefined;
  // Con «Niente affitto dalla prigione» il proprietario in prigione non incassa: nessuna riga evidenziata.
  const inPrigione = partita !== null && p !== undefined && partita.impostazioni.nienteAffittoInPrigione && p.proprietario.prigione !== null;
  const livello = partita && !inPrigione ? rigaAttuale(partita, n) : -1;
  const sigle = partita ? iniziali(partita.giocatori) : undefined;
  // La testata ha il colore della regione, con il testo scuro sulle regioni chiare.
  const stile = {
    ...style,
    ...(c.tinta ? variabili({ '--gruppo': `var(--g${c.tinta})`, '--su-gruppo': `var(--su-g${c.tinta}, #fff)` }) : {}),
  };
  const Contenitore = animata ? motion.article : 'article';
  const classi = ['scheda', p?.ipotecata ? 'scheda--ipotecata' : '', className ?? ''].filter(Boolean).join(' ');
  return (
    <Contenitore className={classi} style={stile} aria-label={`Scheda di ${c.nome}`} {...(animata ? COMPARSA : {})}>
      <header className={regione ? 'scheda__testa' : 'scheda__testa scheda__testa--senza-regione'}>
        {regione ? (
          <Stemma regione={regione} className="scheda__stemma" />
        ) : (
          c.icona && (
            <span className="scheda__pittogramma">
              <IconaCasella nome={c.icona} className="scheda__icona" />
            </span>
          )
        )}
        <div className="scheda__titolo">
          <p className="scheda__regione">{regione ? regione.nome : c.tipo === 'stazione' ? 'Stazione' : 'Servizio'}</p>
          <h3 className="scheda__nome">{c.nome}</h3>
        </div>
        {onChiudi && (
          <button type="button" className="scheda__chiudi" aria-label="Chiudi la scheda" onClick={onChiudi}>
            <Icona nome="chiudi" />
          </button>
        )}
      </header>
      <div className="scheda__corpo">
        {p?.ipotecata && <p className="scheda__ipoteca">Ipotecata: non riscuote affitti</p>}
        {inPrigione && !p?.ipotecata && <p className="scheda__ipoteca">Il proprietario è in prigione: adesso l’affitto è 0 €</p>}
        {ipoteca && <div className="scheda__ipoteca-azione">{ipoteca}</div>}
        <div className="scheda__tabella">
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
                  <th scope="row">
                    {/* Le città contano le case come sul tabellone; il testo resta per chi legge con la sintesi vocale. */}
                    {prop.tipo === 'citta' && i > 0 ? (
                      <>
                        <span className="solo-lettori">{voce}</span>
                        <Edifici livello={i} className="scheda__edifici" />
                      </>
                    ) : (
                      voce
                    )}
                  </th>
                  <td>{importo}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {p?.ipotecata && (
            <span className="scheda__timbro" aria-hidden="true">
              Ipotecata
            </span>
          )}
        </div>
        {azioni && <div className="scheda__azioni">{azioni}</div>}
        <div className="scheda__proprietario">
          <span>Proprietario</span>
          {p ? (
            <strong>
              <Pedina
                colore={p.proprietario.colore}
                iniziale={sigle?.get(p.proprietario.id) ?? p.proprietario.nome.slice(0, 1).toUpperCase()}
                className="pedina--scheda"
              />
              {p.proprietario.nome}
            </strong>
          ) : (
            <strong className="scheda__libera">Libera</strong>
          )}
        </div>
        {onChiedi && p && (
          <button type="button" className="pulsante pulsante--piccolo pulsante--secondario pulsante--largo scheda__chiedi" onClick={onChiedi}>
            <Icona nome="scambio" />
            Chiedila a {p.proprietario.nome}
          </button>
        )}
      </div>
      <dl className="scheda__piede">
        <div className="scheda__prezzo">
          <dt>Prezzo</dt>
          <dd>
            <Soldi valore={prop.prezzo} />
          </dd>
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
    </Contenitore>
  );
}

/* ---------------- Caselle ---------------- */

function descriviEdifici(p: Possesso): string {
  if (p.livello === LIVELLO_ALBERGO) return ', con l’albergo';
  if (p.livello === 1) return ', con 1 casa';
  return p.livello > 1 ? `, con ${p.livello} case` : '';
}

/**
 * Chi possiede la casella e quanto ha costruito: un blocco smaltato del suo colore sul bordo esterno, al posto
 * del prezzo, con la sua iniziale e le case da contare (o la piastrina HOTEL). Ipotecata: il blocco si spegne.
 */
function Blocco({ p, iniziale }: { p: Possesso; iniziale: string }): ReactNode {
  return (
    <span
      className={p.ipotecata ? 'casella__blocco casella__blocco--ipotecata' : 'casella__blocco'}
      title={`${p.ipotecata ? 'Ipotecata, di' : 'Di'} ${p.proprietario.nome}${descriviEdifici(p)}`}
    >
      {p.ipotecata ? (
        <span className="casella__ipotecata">Ipotecata</span>
      ) : (
        <>
          <span className="casella__iniziale">{iniziale}</span>
          <Edifici livello={p.livello} className="casella__edifici" />
        </>
      )}
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

/** Come si mostra la casella in questo momento. */
interface StatoCasella {
  p?: Possesso;
  iniziale?: string;
  selezionata: boolean;
  arrivo?: 'normale' | 'affitto';
  lampeggia: boolean;
  /** Il mouse è su una città: quelle della stessa regione restano accese, le altre si spengono. */
  regione?: 'accesa' | 'spenta';
  /** Angoli: l'importo sotto il cartello (Partenza: quanto si incassa passando; Vacanza: la cassa). */
  valore?: { segno?: string; etichetta?: string; importo: number };
}

function CasellaTabellone({
  c,
  geo,
  regione,
  stato,
  onApri,
  onRegione,
}: {
  c: CasellaVista;
  geo: Geometria;
  regione: Regione | undefined;
  stato: StatoCasella;
  onApri?: (n: number) => void;
  onRegione: (gruppo: number | null) => void;
}): ReactNode {
  const { p } = stato;
  const { riga, colonna, lato } = geo.posto(c.n);
  const proprieta = c.tipo === 'citta' || c.tipo === 'stazione' || c.tipo === 'servizio';
  const nome = c.breve ?? c.nome;
  const classi = [
    'casella',
    `casella--${lato}`,
    `casella--${c.tipo}`,
    c.tipo === 'angolo' ? `casella--angolo-${c.angolo}` : '',
    p ? 'casella--posseduta' : '',
    p?.ipotecata ? 'casella--ipotecata' : '',
    stato.selezionata ? 'casella--selezionata' : '',
    stato.arrivo ? `casella--arrivo casella--arrivo-${stato.arrivo}` : '',
    stato.lampeggia ? 'casella--lampeggia' : '',
    stato.regione ? `casella--${stato.regione}` : '',
  ]
    .filter(Boolean)
    .join(' ');
  const stile = {
    gridRow: riga,
    gridColumn: colonna,
    ...(p ? variabili({ '--proprietario': `var(--p${p.proprietario.colore})` }) : {}),
  };

  let corpo: ReactNode;
  if (c.tipo === 'angolo' && c.angolo === 1) {
    // Prigione: la fascia «In visita» lungo i bordi esterni, la cella verso il centro (le sbarre stanno sopra le pedine).
    corpo = (
      <span className="casella__corpo">
        <span className="casella__visita">{c.sotto}</span>
        <span className="casella__cella">
          <span className="casella__finestra" aria-hidden="true" />
          <span className="casella__targa">{c.nome}</span>
        </span>
      </span>
    );
  } else if (c.tipo === 'angolo') {
    // Partenza, Vacanza, Vai in prigione: un cartello stradale blu (pittogramma e nome) sul bordo esterno,
    // sotto l'importo a palette; l'altra metà della casella resta alle pedine.
    corpo = (
      <span className="casella__corpo">
        <span className="casella__cartello">
          {c.icona && <Icona nome={c.icona} className="casella__pittogramma" />}
          <span className="casella__nome">{c.nome}</span>
        </span>
        {stato.valore && (
          <span className="casella__valore">
            {stato.valore.etichetta && <span className="casella__etichetta">{stato.valore.etichetta}</span>}
            {stato.valore.segno && <span className="casella__segno">{stato.valore.segno}</span>}
            <Soldi valore={stato.valore.importo} />
          </span>
        )}
      </span>
    );
  } else {
    // Dal bordo interno verso quello esterno, uguale sui quattro lati: stemma o icona e nome,
    // la corsia delle pedine, poi prezzo o blocco del proprietario (carte e tasse: il nome).
    corpo = (
      <span className="casella__corpo">
        {c.gruppo !== undefined && <Stemma regione={regione} className="casella__stemma" />}
        {(c.icona || c.importo) && (
          <span className="casella__segnale">
            {c.icona && <IconaCasella nome={c.icona} className="casella__icona" />}
            {c.importo && <span className="casella__importo">{c.importo}</span>}
          </span>
        )}
        <span className={classeNome(nome)}>{nome}</span>
        {p ? (
          <Blocco p={p} iniziale={stato.iniziale ?? ''} />
        ) : (
          c.prezzo !== undefined && <span className="casella__prezzo">{euro(c.prezzo)}</span>
        )}
      </span>
    );
  }

  if (!proprieta) {
    return (
      <div className={classi} style={stile} title={c.breve ? c.nome : undefined}>
        {corpo}
      </div>
    );
  }
  const descrizione = p
    ? `, di ${p.proprietario.nome}${p.ipotecata ? ', ipotecata' : descriviEdifici(p)}`
    : `, ${euro(c.prezzo ?? 0)}`;
  return (
    <button
      type="button"
      className={classi}
      style={stile}
      onClick={() => onApri?.(c.n)}
      onMouseEnter={c.gruppo !== undefined ? () => onRegione(c.gruppo ?? null) : undefined}
      onMouseLeave={c.gruppo !== undefined ? () => onRegione(null) : undefined}
      aria-label={`${c.nome}${descrizione}`}
      aria-expanded={stato.selezionata}
    >
      {corpo}
    </button>
  );
}

/* ---------------- Pedine ---------------- */

export interface Segnaposto {
  id: IdGiocatore;
  colore: number;
  /** Iniziale del nome, come nel disco della lista dei giocatori. In partita il tabellone usa quelle distinte («Ca», «Co»). */
  iniziale?: string;
  posizione: number;
  prigione?: boolean;
  /** Cambia a ogni passo: fa saltellare la pedina. */
  passo?: number;
  evidenziata?: boolean;
}

/** Dove sta una pedina, in percentuale del tabellone, quanto è grande e quanto sta sopra le altre. */
export interface Posa {
  x: number;
  y: number;
  scala: number;
  strato: number;
}

/** Diametro della pedina, in k. */
const DISCO = 30;
/** Le pedine non scendono sotto questa scala finché sono al massimo quattro sulla stessa casella. */
const SCALA_MINIMA = 0.85;
/**
 * Centro della corsia delle pedine, in frazione della profondità della casella dal bordo interno (corsia 40–75%):
 * tra il nome e il blocco del proprietario, o tra il pittogramma e il nome per carte e tasse (il nome sta fuori).
 */
const CORSIA: Partial<Record<CasellaVista['tipo'], number>> = { stazione: 0.61, servizio: 0.61, carta: 0.6, tassa: 0.55, premio: 0.55 };
const CORSIA_CITTA = 0.58;
/** Altezza della targa «Prigione» sotto la cella, in k. */
const TARGA = 17;

/**
 * Pedine in fila sovrapposte come monete (al più `perRiga` per fila, poi una seconda fila sfalsata).
 * Restituisce gli scostamenti lungo la fila (a) e verso l'esterno (b), in percentuale del tabellone.
 */
function monete(
  quante: number,
  diametro: number,
  spazio: number,
  perRiga: number,
  sovrapposizione: number,
): { a: number; b: number }[] {
  const righe = Math.ceil(quante / perRiga);
  const inFila = Math.ceil(quante / righe);
  const passo = inFila > 1 ? Math.min(diametro * (1 - sovrapposizione), (spazio - diametro) / (inFila - 1)) : 0;
  const profondo = diametro * 0.5;
  return Array.from({ length: quante }, (_, i) => {
    const r = Math.floor(i / inFila);
    const nellaRiga = r === righe - 1 ? quante - r * inFila : inFila;
    const sfalsa = righe > 1 && r % 2 === 1 ? passo / 2 : 0;
    return {
      a: ((i % inFila) - (nellaRiga - 1) / 2) * passo + sfalsa,
      b: (r - (righe - 1) / 2) * profondo,
    };
  });
}

function coordinatePedine(pedine: Segnaposto[], caselle: CasellaVista[], prigione: number, geo: Geometria): Map<IdGiocatore, Posa> {
  const gruppi = new Map<string, Segnaposto[]>();
  for (const p of pedine) {
    const chiave = `${p.posizione}${p.prigione ? 'p' : ''}`;
    gruppi.set(chiave, [...(gruppi.get(chiave) ?? []), p]);
  }
  const D = geo.profondita;
  const W = geo.unita;
  const risultato = new Map<IdGiocatore, Posa>();
  for (const gruppo of gruppi.values()) {
    // Quella di turno sta sopra le altre.
    const lista = [...gruppo].sort((a, b) => Number(a.evidenziata ?? false) - Number(b.evidenziata ?? false));
    const primo = lista[0];
    if (!primo) continue;
    const n = primo.posizione;
    const quante = lista.length;
    const { lato } = geo.posto(n);
    const { x: cx, y: cy } = geo.centro(n);
    const metti = (scala: number, punti: { x: number; y: number }[]) =>
      lista.forEach((p, i) => {
        const punto = punti[i] ?? { x: cx, y: cy };
        risultato.set(p.id, { ...punto, scala, strato: i + 1 });
      });

    if (n === prigione && primo.prigione) {
      // In cella: dietro le sbarre, in una griglia.
      const scala = quante === 1 ? 1 : quante <= 4 ? SCALA_MINIMA : 0.7;
      const d = DISCO * scala * geo.k;
      const latoCella = (1 - FASCIA_VISITA) * D;
      const centroX = cx - D / 2 + latoCella / 2;
      const centroY = cy - D / 2 + FASCIA_VISITA * D + (latoCella - TARGA * geo.k) / 2;
      const colonne = quante <= 1 ? 1 : quante <= 4 ? 2 : 3;
      const righe = Math.ceil(quante / colonne);
      const passo = d * 1.02;
      metti(
        scala,
        lista.map((_, i) => {
          const r = Math.floor(i / colonne);
          const nellaRiga = r === righe - 1 ? quante - r * colonne : colonne;
          return { x: centroX + ((i % colonne) - (nellaRiga - 1) / 2) * passo, y: centroY + (r - (righe - 1) / 2) * passo };
        }),
      );
    } else if (n === prigione) {
      // In visita: in colonna sulla fascia a destra della cella.
      const scala = SCALA_MINIMA;
      const d = DISCO * scala * geo.k;
      const altezza = (1 - FASCIA_VISITA) * D;
      const posti = monete(quante, d, altezza * 0.95, 8, 0.25);
      const x = cx + D / 2 - (FASCIA_VISITA * D) / 2;
      const y = cy + (FASCIA_VISITA * D) / 2;
      metti(scala, posti.map(({ a }) => ({ x, y: y + a })));
    } else if (lato === 'angolo') {
      // Partenza: cartello in alto, pedine in basso. Vacanza e Vai in prigione: il contrario.
      // Le pedine stanno contro il bordo interno, sotto (o sopra) il cartello e l'importo; da cinque in su in due file.
      const scala = quante <= 2 ? 1 : quante <= 4 ? SCALA_MINIMA : 0.74;
      const d = DISCO * scala * geo.k;
      const posti = monete(quante, d, D * 0.9, 4, 0.2);
      const righe = Math.ceil(quante / 4);
      const altezza = d + (righe - 1) * d * 0.5;
      const verso = n === 0 ? 1 : -1;
      const y = cy + verso * (D / 2 - 5 * geo.k - altezza / 2);
      metti(scala, posti.map(({ a, b }) => ({ x: cx + a, y: y + verso * b })));
    } else {
      // Sui lati: nella corsia tra il nome e il bordo esterno, così non coprono niente.
      const scala = quante <= 2 ? 1 : quante <= 4 ? SCALA_MINIMA : 0.75;
      const d = DISCO * scala * geo.k;
      const posti = monete(quante, d, W * 0.94, 3, quante === 2 ? 0.2 : 0.3);
      const spinta = ((CORSIA[caselle[n]?.tipo ?? 'citta'] ?? CORSIA_CITTA) - 0.5) * D;
      metti(
        scala,
        posti.map(({ a, b }) => {
          const fuori = spinta + b;
          if (lato === 'basso') return { x: cx + a, y: cy + fuori };
          if (lato === 'alto') return { x: cx + a, y: cy - fuori };
          if (lato === 'sinistra') return { x: cx - fuori, y: cy + a };
          return { x: cx + fuori, y: cy + a };
        }),
      );
    }
  }
  return risultato;
}

/* ---------------- Tabellone ---------------- */

/**
 * Il tabellone: una lastra con le caselle smaltate attorno al centro incassato.
 * - `arrivo`: la casella dove si è fermato chi gioca, con il contorno ambra (rosso se lì si paga l'affitto), fino a fine turno.
 * - `lampeggia`: caselle che pulsano nel colore del proprietario (per esempio quelle di uno scambio).
 */
export function Tabellone({
  mappa,
  partita,
  pedine,
  centro,
  sopra,
  sfocato,
  selezionata,
  arrivo,
  lampeggia,
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
  /** Casella d'arrivo del turno: contorno ambra, rosso (`tono: 'affitto'`) se si paga l'affitto. */
  arrivo?: { n: number; tono: 'normale' | 'affitto' };
  /** Caselle da far lampeggiare nel colore del proprietario. */
  lampeggia?: number[];
  onApri?: (n: number) => void;
}): ReactNode {
  const [regioneAccesa, setRegioneAccesa] = useState<number | null>(null);
  const tab = tabellone(mappa);
  const caselle = caselleVista(mappa);
  const geo = geometria(caselle.length);
  const coordinate = coordinatePedine(pedine, caselle, tab.prigione, geo);
  const sigle = partita ? iniziali(partita.giocatori) : undefined;
  const interno = `2 / ${geo.lato + 1}`;
  const cassa = partita?.impostazioni.cassaVacanza ? partita.cassaVacanza : undefined;

  const valoreAngolo = (c: CasellaVista): StatoCasella['valore'] => {
    if (c.tipo !== 'angolo') return undefined;
    if (c.angolo === 0) return { segno: '+', importo: tab.partenza.passaggio };
    if (tab.caselle[c.n]?.tipo === 'vacanza' && cassa !== undefined) return { etichetta: 'Cassa', importo: cassa };
    return undefined;
  };

  // Le sbarre della prigione stanno sopra le pedine dei prigionieri: si disegnano nel livello delle pedine.
  const cella = ((): CSSProperties => {
    const { x, y } = geo.centro(tab.prigione);
    const lato = (1 - FASCIA_VISITA) * geo.profondita;
    return {
      left: `${x - geo.profondita / 2}%`,
      top: `${y - geo.profondita / 2 + FASCIA_VISITA * geo.profondita}%`,
      width: `${lato}%`,
      height: `${lato - TARGA * geo.k}%`,
    };
  })();

  const classiGriglia = [
    'tabellone__griglia',
    sfocato ? 'tabellone__griglia--sfocata' : '',
    regioneAccesa !== null ? 'tabellone__griglia--regione' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={geo.lato > 10 ? 'tabellone tabellone--13' : 'tabellone'}
      style={variabili({
        '--scala': String(geo.scala),
        '--cornice': String(CORNICE),
        '--fuga': String(FUGA),
        '--fascia': String(FASCIA_VISITA),
        '--targa': String(TARGA),
      })}
    >
      <div className={classiGriglia} style={{ gridTemplateColumns: geo.tracce, gridTemplateRows: geo.tracce }}>
        {caselle.map((c) => {
          const p = possesso(partita, c.n);
          return (
            <CasellaTabellone
              key={c.n}
              c={c}
              geo={geo}
              regione={c.gruppo ? tab.regioni[c.gruppo - 1] : undefined}
              stato={{
                p,
                iniziale: p ? (sigle?.get(p.proprietario.id) ?? p.proprietario.nome.slice(0, 1).toUpperCase()) : undefined,
                selezionata: selezionata === c.n,
                arrivo: arrivo?.n === c.n ? arrivo.tono : undefined,
                lampeggia: lampeggia?.includes(c.n) ?? false,
                regione: regioneAccesa === null ? undefined : c.gruppo === regioneAccesa ? 'accesa' : 'spenta',
                valore: valoreAngolo(c),
              }}
              onApri={onApri}
              onRegione={setRegioneAccesa}
            />
          );
        })}
        <div className="tabellone__centro" style={{ gridRow: interno, gridColumn: interno }}>
          {!sfocato && centro}
        </div>
        <div className="tabellone__pedine" aria-hidden="true">
          {pedine.map((p) => {
            const posa = coordinate.get(p.id) ?? { x: 0, y: 0, scala: 1, strato: 1 };
            return (
              <span
                key={p.id}
                className={p.evidenziata ? 'segnaposto segnaposto--turno' : 'segnaposto'}
                style={{
                  ...variabili({ '--x': `${posa.x}%`, '--y': `${posa.y}%`, '--s': String(posa.scala) }),
                  zIndex: p.evidenziata ? 20 : posa.strato,
                }}
              >
                <span className="segnaposto__salto" key={p.passo ?? 0}>
                  <span className={p.prigione ? 'segnaposto__disco segnaposto__disco--prigione' : 'segnaposto__disco'}>
                    <Pedina colore={p.colore} iniziale={sigle?.get(p.id) ?? p.iniziale} className="pedina--tabellone" />
                  </span>
                </span>
              </span>
            );
          })}
          <span className="tabellone__sbarre" style={cella} />
        </div>
      </div>
      {sfocato && <div className="tabellone__velo">{centro}</div>}
      {sopra}
    </div>
  );
}
