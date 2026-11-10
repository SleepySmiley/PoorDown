/*
 * Scambi: il pannello nella colonna destra, la finestra per proporre uno scambio (anche una controproposta
 * o la modifica della propria proposta), quella per vederlo e rispondere, il biglietto che annuncia una
 * proposta e i testi degli esiti per chi ha proposto.
 * Lo scambio si legge sempre dalla propria parte: a sinistra «Dai» (io), a destra «Ricevi» (l'altro);
 * chi guarda soltanto vede a sinistra chi propone. Le regole (e i motivi per cui uno scambio non si può
 * fare) sono quelle del motore.
 */

import '../stili/economia.css';
import { useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  effettiScambio,
  euro,
  NOTA_MAX,
  PACCHETTO_VUOTO,
  pacchettoVuoto,
  possedute,
  preposizioneA,
  problemiScambio,
  proprietabile,
  regioneConEdifici,
  SCAMBI_APERTI_MAX,
  tabellone,
  valorePacchetto,
  verifica,
  type Attivita,
  type Azione,
  type Bandiera,
  type BozzaScambio,
  type EffettoScambio,
  type Evento,
  type Giocatore,
  type IdGiocatore,
  type Mossa,
  type NomeMazzo,
  type Pacchetto,
  type Regione,
  type Scambio,
  type Stato,
} from '@poordown/engine';
import { caselleVista } from '../ui/caselle';
import { Chip } from '../ui/Chip';
import { Palette, Pedina, Soldi, Stemma } from '../ui/comuni';
import { Icona, type NomeIcona } from '../ui/icone';
import { CURVA, DURATA, SCORRE } from '../ui/movimento';
import { Pannello } from '../ui/Pannello';
import { PuntiRegione } from '../ui/PuntiRegione';
import { iniziale as inizialeNome } from '../ui/utili';
import { RiquadroTabellone } from './Colonne';

export type Proposta = Extract<Mossa, { tipo: 'proponi' }>;

const VUOTO = 'Lo scambio è vuoto.';
/** I tasti che aggiungono soldi allo scambio. */
const AGGIUNTE = [10, 50, 100, 500];

function trova(partita: Stato, id: IdGiocatore): Giocatore | undefined {
  return partita.giocatori.find((g) => g.id === id);
}

function nomeDi(partita: Stato, id: IdGiocatore): string {
  return trova(partita, id)?.nome ?? 'Un giocatore';
}

/** Chi, oltre a me, sta guardando lo scambio (`guarda`) o preparando una nuova versione (`tratta`). */
function presenti(
  partita: Stato,
  attivita: Record<IdGiocatore, Attivita>,
  scambio: number,
  io: IdGiocatore | null,
  tipo: 'guarda' | 'tratta',
): Giocatore[] {
  return Object.entries(attivita)
    .filter(([id, a]) => id !== io && a.tipo !== 'crea' && a.tipo === tipo && a.scambio === scambio)
    .flatMap(([id]) => trova(partita, id) ?? []);
}

function elenco(parti: string[]): string {
  return parti.length <= 1 ? (parti[0] ?? '') : `${parti.slice(0, -1).join(', ')} e ${parti.at(-1)!}`;
}

/* ---------------- Lo scambio dalla mia parte ---------------- */

interface ParteScambio {
  g: Giocatore;
  p: Pacchetto;
  /** Lo stesso pacchetto nella versione di prima, se lo scambio è una controproposta. */
  prima?: Pacchetto;
}

/** Le due parti dello scambio: io a sinistra (quello che do), l'altro a destra; chi guarda vede a sinistra chi propone. */
function lati(partita: Stato, sc: Scambio, io: IdGiocatore | null): { sinistra: ParteScambio; destra: ParteScambio; mio: boolean } | null {
  const da = trova(partita, sc.da);
  const a = trova(partita, sc.a);
  if (!da || !a) return null;
  const parteDa = { g: da, p: sc.dare, prima: sc.precedente?.dare };
  const parteA = { g: a, p: sc.avere, prima: sc.precedente?.avere };
  return sc.a === io ? { sinistra: parteA, destra: parteDa, mio: true } : { sinistra: parteDa, destra: parteA, mio: sc.da === io };
}

/**
 * Il titolo dello scambio per chi lo guarda: «Bruno ti propone uno scambio», «Controproposta di Bruno · 2ª»,
 * «Proposta modificata da Bruno · 2ª» (se l'ha cambiata chi l'aveva fatta)…
 */
function titoloScambio(partita: Stato, sc: Scambio, io: IdGiocatore | null): string {
  const da = nomeDi(partita, sc.da);
  const a = nomeDi(partita, sc.a);
  const n = sc.trattativa;
  if (sc.modifica) {
    if (sc.a === io) return `Proposta modificata da ${da} · ${n}ª`;
    if (sc.da === io) return `La tua proposta modificata ${preposizioneA(a)} · ${n}ª`;
    return `Proposta modificata da ${da} ${preposizioneA(a)} · ${n}ª`;
  }
  if (sc.a === io) return n > 0 ? `Controproposta di ${da} · ${n}ª` : `${da} ti propone uno scambio`;
  if (sc.da === io) return n > 0 ? `La tua controproposta ${preposizioneA(a)} · ${n}ª` : `La tua proposta ${preposizioneA(a)}`;
  return n > 0 ? `Controproposta di ${da} ${preposizioneA(a)} · ${n}ª` : `${da} propone ${preposizioneA(a)}`;
}

/** Una voce di un pacchetto nei riassunti. */
interface Voce {
  chiave: string;
  testo: string;
  regione?: Regione;
  /** La bandiera della città, se diversa da quella del gruppo (Grandi aree). */
  bandiera?: Bandiera;
  /** Prezzo di listino (0 se ipotecata); manca per soldi e Carte Grazia. */
  prezzo?: number;
}

function voci(partita: Stato, p: Pacchetto): Voce[] {
  const tab = tabellone(partita.mappa);
  const out: Voce[] = [];
  if (p.soldi > 0) out.push({ chiave: 'soldi', testo: euro(p.soldi) });
  for (const n of p.caselle) {
    const c = proprietabile(tab, n);
    if (!c) continue;
    out.push({
      chiave: `c${n}`,
      testo: c.nome,
      regione: c.tipo === 'citta' ? tab.regioni[c.regione] : undefined,
      bandiera: c.tipo === 'citta' ? c.bandiera : undefined,
      prezzo: partita.proprieta[n]?.ipotecata ? 0 : c.prezzo,
    });
  }
  if (p.grazie.length > 0) out.push({ chiave: 'grazie', testo: p.grazie.length === 1 ? 'una Carta Grazia' : `${p.grazie.length} Carte Grazia` });
  return out;
}

/** «300 €, Napoli e una Carta Grazia», oppure «niente». */
function descriviPacchetto(partita: Stato, p: Pacchetto): string {
  const v = voci(partita, p);
  return v.length === 0 ? 'niente' : elenco(v.map((x) => x.testo));
}

/** Riassunto in una riga, con i piccoli stemmi: le prime `max` voci, poi «+2». */
function Riassunto({ partita, p, max = 2 }: { partita: Stato; p: Pacchetto; max?: number }): ReactNode {
  const v = voci(partita, p);
  if (v.length === 0) return <span className="riassunto riassunto--niente">niente</span>;
  return (
    <span className="riassunto">
      {v.slice(0, max).map((x) => (
        <span key={x.chiave} className="riassunto__voce">
          {x.regione && <Stemma regione={x.regione} bandiera={x.bandiera} className="stemma--mini" />}
          {x.testo}
        </span>
      ))}
      {v.length > max && <span className="riassunto__altre">+{v.length - max}</span>}
    </span>
  );
}

/* ---------------- Effetti: cosa cambia davvero ---------------- */

interface Frase {
  chiave: string;
  tono: 'verde' | 'rosso' | 'neutro';
  testo: ReactNode;
}

const ICONA_TONO: Record<Frase['tono'], NomeIcona> = { verde: 'spunta', rosso: 'avviso', neutro: 'info' };
const PESO_EFFETTO: Record<EffettoScambio['tipo'], number> = { completa: 0, rompe: 1, stazioni: 2, servizi: 3 };
/** Le frasi degli effetti che si mostrano al massimo. */
const FRASI_MAX = 3;

function contaCaselle(tipo: 'stazioni' | 'servizi', n: number): string {
  if (tipo === 'stazioni') return n === 1 ? '1 stazione' : `${n} stazioni`;
  return n === 1 ? '1 servizio' : `${n} servizi`;
}

/** Le frasi degli effetti dalla mia parte: prima le mie, poi quelle dell'altro; al massimo tre. */
function frasiEffetti(partita: Stato, bozza: BozzaScambio, io: IdGiocatore | null): Frase[] {
  const tab = tabellone(partita.mappa);
  const coinvolto = io === bozza.da || io === bozza.a;
  const frasi = effettiScambio(partita, bozza).map((e) => {
    const mio = e.giocatore === io;
    const nome = nomeDi(partita, e.giocatore);
    const peso = PESO_EFFETTO[e.tipo] * 2 + (mio ? 0 : 1);
    if ('regione' in e) {
      const regione = tab.regioni[e.regione];
      const chiave = `${e.tipo}-${e.giocatore}-${e.regione}`;
      const r = (
        <span className="effetti-scambio__regione">
          <Stemma regione={regione} className="stemma--mini" />
          {regione?.nome}
        </span>
      );
      if (e.tipo === 'completa') {
        const vantaggio = partita.impostazioni.affittoDoppioSetCompleto ? 'affitto doppio e puoi costruire' : 'puoi costruire';
        const frase: Frase = mio
          ? { chiave, tono: 'verde', testo: <>Completi la regione {r}: {vantaggio}</> }
          : { chiave, tono: coinvolto ? 'rosso' : 'neutro', testo: <>{nome} completa la regione {r}</> };
        return { ...frase, peso };
      }
      const frase: Frase = mio
        ? { chiave, tono: 'rosso', testo: <>Non avrai più tutta la regione {r}</> }
        : { chiave, tono: 'neutro', testo: <>{nome} non avrà più tutta la regione {r}</> };
      return { ...frase, peso };
    }
    const cresce = e.dopo > e.prima;
    const quante = contaCaselle(e.tipo, e.dopo);
    const resta = e.dopo === 1 ? 'resterà' : 'resteranno';
    let testo: string;
    if (cresce) testo = mio ? `Avrai ${quante}` : `${nome} avrà ${quante}`;
    else if (e.dopo === 0) testo = mio ? `Non avrai più ${e.tipo}` : `${nome} non avrà più ${e.tipo}`;
    else testo = mio ? `Ti ${resta} ${quante}` : `A ${nome} ${resta} ${quante}`;
    const frase: Frase = { chiave: `${e.tipo}-${e.giocatore}`, tono: mio && cresce ? 'verde' : 'neutro', testo };
    return { ...frase, peso };
  });
  return frasi.sort((x, y) => x.peso - y.peso).slice(0, FRASI_MAX);
}

function Effetti({ partita, bozza, io }: { partita: Stato; bozza: BozzaScambio; io: IdGiocatore | null }): ReactNode {
  const frasi = frasiEffetti(partita, bozza, io);
  if (frasi.length === 0) return null;
  return (
    <div className="effetti-scambio">
      <span className="effetti-scambio__titolo etichetta">Effetti</span>
      <ul>
        {frasi.map((f) => (
          <li key={f.chiave} className={`effetti-scambio__frase effetti-scambio__frase--${f.tono}`}>
            <Icona nome={ICONA_TONO[f.tono]} />
            <span>{f.testo}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------------- Riepilogo ---------------- */

/** «Dai 60 € più del prezzo di listino», «Alla pari»… */
function bilancio(partita: Stato, dai: Pacchetto, ricevi: Pacchetto): string {
  const differenza = valorePacchetto(partita, dai) - valorePacchetto(partita, ricevi);
  if (differenza > 0) return `Dai ${euro(differenza)} più del prezzo di listino`;
  if (differenza < 0) return `Ricevi ${euro(-differenza)} più del prezzo di listino`;
  return 'Alla pari, a prezzo di listino';
}

function descrizioneRiepilogo(partita: Stato, p: Pacchetto): string {
  const v = voci(partita, p);
  if (v.length === 0) return 'niente';
  return v
    .map((x) => {
      if (x.prezzo === undefined) return x.testo;
      return x.prezzo > 0 ? `${x.testo} (${euro(x.prezzo)})` : `${x.testo} (con ipoteca)`;
    })
    .join(', ');
}

/** La riga in fondo: cosa do, cosa ricevo e la differenza a prezzo di listino. Con `breve` solo la differenza. */
function Riepilogo({ partita, dai, ricevi, breve }: { partita: Stato; dai: Pacchetto; ricevi: Pacchetto; breve?: boolean }): ReactNode {
  return (
    <div className="riepilogo-scambio">
      {!breve && (
        <p className="riepilogo-scambio__righe">
          <span className="riepilogo-scambio__parte">
            <b className="etichetta riepilogo-scambio__dai">Dai</b> {descrizioneRiepilogo(partita, dai)}
          </span>
          <span className="riepilogo-scambio__parte">
            <b className="etichetta riepilogo-scambio__ricevi">Ricevi</b> {descrizioneRiepilogo(partita, ricevi)}
          </span>
        </p>
      )}
      <p className="riepilogo-scambio__bilancio">
        <Icona nome="euro" />
        {bilancio(partita, dai, ricevi)}
      </p>
    </div>
  );
}

/* ---------------- Una parte dello scambio ---------------- */

/** Quello che c'è adesso più quello che c'era nella versione di prima. */
function unisci<T>(adesso: T[], prima: T[] | undefined): T[] {
  return [...adesso, ...(prima ?? []).filter((x) => !adesso.includes(x))];
}

/**
 * Il campo dei soldi a palette: si scrive con la tastiera (frecce su e giù: 10 € alla volta), le cifre girano.
 * Il campo vero è trasparente sopra le palette.
 */
function CampoSoldi({
  valore,
  massimo,
  etichetta,
  onCambia,
}: {
  valore: number;
  massimo: number;
  etichetta: string;
  onCambia: (valore: number) => void;
}): ReactNode {
  const spento = massimo <= 0;
  return (
    <label className={spento ? 'campo-soldi campo-soldi--spento' : 'campo-soldi'}>
      <Palette testo={euro(valore).replace(' €', '')} misura="m" />
      <span className="campo-soldi__cursore" aria-hidden="true" />
      <span className="campo-soldi__unita" aria-hidden="true">
        €
      </span>
      <input
        className="campo-soldi__input"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={String(valore)}
        disabled={spento}
        aria-label={etichetta}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => onCambia(Number(e.target.value.replace(/\D/g, '').slice(0, 7)) || 0)}
        onKeyDown={(e) => {
          if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
          e.preventDefault();
          onCambia(valore + (e.key === 'ArrowUp' ? 10 : -10));
        }}
      />
    </label>
  );
}

/**
 * Cosa mette sul tavolo un giocatore: in alto «Dai» o «Ricevi» con il suo nome, sotto soldi, proprietà
 * e Carte Grazia. Con `onCambia` si sceglie; senza, mostra quello che c'è nello scambio e, con `prima`,
 * cosa è cambiato rispetto alla versione precedente (aggiunte «Nuova», tolte barrate, soldi di prima barrati).
 */
function Lato({
  partita,
  g,
  io,
  p,
  verbo,
  tono,
  prima,
  onCambia,
}: {
  partita: Stato;
  g: Giocatore;
  io: IdGiocatore | null;
  p: Pacchetto;
  verbo: string;
  tono: 'dai' | 'ricevi' | 'neutro';
  prima?: Pacchetto;
  onCambia?: (p: Pacchetto) => void;
}): ReactNode {
  const tab = tabellone(partita.mappa);
  const caselle = caselleVista(partita.mappa);
  const elencoCaselle = onCambia ? possedute(partita, g.id) : unisci(p.caselle, prima?.caselle).sort((x, y) => x - y);
  const elencoGrazie: NomeMazzo[] = onCambia ? g.carteGrazia : unisci(p.grazie, prima?.grazie);
  const massimo = Math.max(0, g.saldo);
  const soldiCambiati = prima !== undefined && prima.soldi !== p.soldi;
  const niente = elencoCaselle.length === 0 && elencoGrazie.length === 0 && (onCambia !== undefined || (p.soldi === 0 && !soldiCambiati));
  const mio = g.id === io;

  const soldi = (valore: number) => onCambia?.({ ...p, soldi: Math.max(0, Math.min(massimo, Math.floor(valore) || 0)) });
  const casella = (n: number) =>
    onCambia?.({ ...p, caselle: p.caselle.includes(n) ? p.caselle.filter((x) => x !== n) : [...p.caselle, n].sort((x, y) => x - y) });
  const grazia = (mazzo: NomeMazzo) =>
    onCambia?.({ ...p, grazie: p.grazie.includes(mazzo) ? p.grazie.filter((x) => x !== mazzo) : [...p.grazie, mazzo] });

  /** In lettura: «nuova» se è stata aggiunta in questa versione, «tolta» se c'era nella precedente. */
  const cambio = <T,>(x: T, adesso: T[], allora: T[] | undefined): '' | 'nuova' | 'tolta' => {
    if (onCambia || !allora) return '';
    if (!adesso.includes(x)) return 'tolta';
    return allora.includes(x) ? '' : 'nuova';
  };

  return (
    <section className="lato" aria-label={`${verbo}: ${mio ? 'tu' : g.nome}`}>
      <header className={`lato__testa lato__testa--${tono}`}>
        <span className="lato__verbo">{verbo}</span>
        <span className="lato__chi">
          <Pedina colore={g.colore} iniziale={inizialeNome(g.nome)} className="pedina--media" />
          <b>{g.nome}</b>
          {mio && <span className="lato__tu">(tu)</span>}
        </span>
      </header>

      <div className="lato__corpo">
        {onCambia ? (
          <div className="lato__soldi-campo">
            <div className="lato__soldi-riga">
              <CampoSoldi
                valore={p.soldi}
                massimo={massimo}
                etichetta={mio ? 'Soldi che dai, in euro' : `Soldi che chiedi ${preposizioneA(g.nome)}, in euro`}
                onCambia={soldi}
              />
              <span className="lato__saldo">
                {g.saldo > 0 ? (
                  <>
                    {mio ? 'Hai' : 'Ha'} <b>{euro(g.saldo)}</b>
                  </>
                ) : (
                  `${mio ? 'Hai' : 'Ha'} il saldo negativo`
                )}
              </span>
            </div>
            <div className="lato__tasti">
              {AGGIUNTE.map((n) => (
                <button
                  key={n}
                  type="button"
                  className="pulsante pulsante--piccolo pulsante--secondario lato__tasto"
                  disabled={p.soldi >= massimo}
                  onClick={() => soldi(p.soldi + n)}
                >
                  +{n}
                </button>
              ))}
              <button
                type="button"
                className="pulsante pulsante--piccolo pulsante--fantasma lato__tasto"
                disabled={p.soldi === 0}
                onClick={() => soldi(0)}
              >
                Azzera
              </button>
            </div>
          </div>
        ) : (
          (p.soldi > 0 || soldiCambiati) && (
            <p className={soldiCambiati ? 'lato__soldi lato__soldi--cambiati' : 'lato__soldi'}>
              <Soldi valore={p.soldi} misura="m" />
              {soldiCambiati && (
                <>
                  <s className="lato__prima" aria-label={`prima ${euro(prima.soldi)}`}>
                    {euro(prima.soldi)}
                  </s>
                  <Chip tono="ambra">
                    {p.soldi > prima.soldi ? '+' : '−'}
                    {euro(Math.abs(p.soldi - prima.soldi))}
                  </Chip>
                </>
              )}
            </p>
          )
        )}

        {(elencoCaselle.length > 0 || elencoGrazie.length > 0) && (
          <ul className="lato__lista">
            {elencoCaselle.map((n) => {
              const c = caselle[n];
              const prop = proprietabile(tab, n);
              if (!c || !prop) return null;
              const scelta = p.caselle.includes(n);
              const ipotecata = partita.proprieta[n]?.ipotecata === true;
              const edifici = prop.tipo === 'citta' && regioneConEdifici(partita, prop.regione);
              const stato = cambio(n, p.caselle, prima?.caselle);
              const corpo = (
                <>
                  {c.gruppo !== undefined ? (
                    <Stemma regione={tab.regioni[c.gruppo - 1]} bandiera={c.bandiera} className="stemma--lista" />
                  ) : (
                    c.icona && <Icona nome={c.icona} className="voce-scambio__icona" />
                  )}
                  <span className="voce-scambio__nome">{c.nome}</span>
                  {stato === 'nuova' && <Chip tono="ambra">Nuova</Chip>}
                  {prop.tipo === 'citta' && <PuntiRegione partita={partita} casella={n} />}
                  {ipotecata && <Icona nome="banca" className="voce-scambio__icona" titolo="Ipotecata" />}
                  {edifici && <Icona nome="casa" className="voce-scambio__icona" titolo="Nella regione ci sono case" />}
                  <span className="voce-scambio__prezzo">{euro(prop.prezzo)}</span>
                </>
              );
              return (
                <li key={n}>
                  {onCambia ? (
                    <button
                      type="button"
                      className="voce-scambio"
                      aria-pressed={scelta}
                      disabled={edifici && !scelta}
                      title={edifici ? 'Prima vanno vendute le case e gli alberghi della regione' : undefined}
                      onClick={() => casella(n)}
                    >
                      {corpo}
                    </button>
                  ) : (
                    <span className={stato ? `voce-scambio voce-scambio--${stato}` : 'voce-scambio'}>{corpo}</span>
                  )}
                </li>
              );
            })}
            {elencoGrazie.map((mazzo) => {
              const stato = cambio(mazzo, p.grazie, prima?.grazie);
              const corpo = (
                <>
                  <Icona nome="grazia" className="voce-scambio__icona" />
                  <span className="voce-scambio__nome">Carta Grazia</span>
                  {stato === 'nuova' && <Chip tono="ambra">Nuova</Chip>}
                </>
              );
              return (
                <li key={mazzo}>
                  {onCambia ? (
                    <button type="button" className="voce-scambio" aria-pressed={p.grazie.includes(mazzo)} onClick={() => grazia(mazzo)}>
                      {corpo}
                    </button>
                  ) : (
                    <span className={stato ? `voce-scambio voce-scambio--${stato}` : 'voce-scambio'}>{corpo}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {niente && (
          <p className="lato__niente">{onCambia ? `${mio ? 'Non hai' : 'Non ha'} proprietà né Carte Grazia` : 'Niente'}</p>
        )}
      </div>
    </section>
  );
}

function Freccia(): ReactNode {
  return (
    <div className="scambio-finestra__freccia" aria-hidden="true">
      <Icona nome="scambio" />
    </div>
  );
}

function Problemi({ elenco: righe, titolo }: { elenco: string[]; titolo?: string }): ReactNode {
  if (righe.length === 0) return null;
  return (
    <div className="scambio-finestra__problemi" role="status">
      <Icona nome="avviso" />
      <div>
        {titolo && <p>{titolo}</p>}
        <ul>
          {righe.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ---------------- Pannello nella colonna destra ---------------- */

export function PannelloScambi({
  partita,
  io,
  attivita,
  onCrea,
  onApri,
}: {
  partita: Stato;
  io: IdGiocatore | null;
  attivita: Record<IdGiocatore, Attivita>;
  /** Assente per chi guarda soltanto o è uscito dalla partita. */
  onCrea?: () => void;
  onApri: (scambio: number) => void;
}): ReactNode {
  const [consiglio, setConsiglio] = useState(true);
  const creano = Object.entries(attivita)
    .filter(([id, a]) => a.tipo === 'crea' && id !== io)
    .flatMap(([id]) => trova(partita, id) ?? []);
  const miei = partita.scambi.filter((x) => x.da === io).length;
  const bloccoCrea = miei >= SCAMBI_APERTI_MAX ? `Non puoi avere più di ${SCAMBI_APERTI_MAX} scambi aperti proposti da te.` : null;

  return (
    <Pannello
      titolo="Scambi"
      conta={partita.scambi.length > 0 ? partita.scambi.length : undefined}
      className="scambi"
      azioni={
        onCrea && (
          <span className="con-suggerimento scambi__crea" data-testo={bloccoCrea ?? undefined}>
            <button
              type="button"
              className="pulsante pulsante--piccolo pulsante--primario"
              disabled={bloccoCrea !== null}
              onClick={onCrea}
            >
              <Icona nome="piu" />
              Crea
            </button>
          </span>
        )
      }
    >
      {consiglio && onCrea && (
        <div className="consiglio">
          <p>Scambia proprietà, soldi e Carte Grazia con gli altri giocatori, anche fuori dal tuo turno. Premi «Crea» per proporre uno scambio.</p>
          <button type="button" className="consiglio__ok" onClick={() => setConsiglio(false)}>
            <Icona nome="spunta" />
            Ok, capito
          </button>
        </div>
      )}
      {creano.length > 0 && (
        <p className="scambi__creano">
          <Icona nome="matita" className="matita-che-scrive" />
          {elenco(creano.map((g) => g.nome))} {creano.length === 1 ? 'sta creando' : 'stanno creando'} uno scambio…
        </p>
      )}
      {partita.scambi.length > 0 && (
        <ul className="scambi__lista">
          <AnimatePresence initial={false}>
            {partita.scambi.map((sc) => (
              <RigaScambio key={sc.id} partita={partita} io={io} sc={sc} attivita={attivita} onApri={onApri} />
            ))}
          </AnimatePresence>
        </ul>
      )}
    </Pannello>
  );
}

/** Una riga del pannello: chi propone a chi e in che stato, sotto cosa c'è dentro, chi lo sta guardando o trattando. */
function RigaScambio({
  partita,
  io,
  sc,
  attivita,
  onApri,
}: {
  partita: Stato;
  io: IdGiocatore | null;
  sc: Scambio;
  attivita: Record<IdGiocatore, Attivita>;
  onApri: (scambio: number) => void;
}): ReactNode {
  const parti = lati(partita, sc, io);
  if (!parti) return null;
  const da = trova(partita, sc.da)!;
  const a = trova(partita, sc.a)!;
  const guardano = presenti(partita, attivita, sc.id, io, 'guarda');
  const trattano = presenti(partita, attivita, sc.id, io, 'tratta');
  const nonValido = problemiScambio(partita, sc).length > 0;
  const perMe = sc.a === io;
  let stato: ReactNode = null;
  if (nonValido) stato = <Chip tono="rosso">Non valido</Chip>;
  else if (perMe) stato = <Chip tono="ambra">Per te</Chip>;
  else if (sc.da === io) stato = <Chip>In attesa</Chip>;
  const chi = perMe ? (
    <>
      <b>{da.nome}</b> → te
    </>
  ) : sc.da === io ? (
    <>
      Tu → <b>{a.nome}</b>
    </>
  ) : (
    <>
      <b>{da.nome}</b> → <b>{a.nome}</b>
    </>
  );

  return (
    <motion.li
      layout="position"
      transition={SCORRE}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0, transition: { duration: DURATA.entrata, ease: CURVA.arrivo } }}
      exit={{ opacity: 0, transition: { duration: DURATA.uscita, ease: CURVA.partenza } }}
    >
      <button
        type="button"
        className={perMe ? 'scambio-riga scambio-riga--per-me' : 'scambio-riga'}
        onClick={() => onApri(sc.id)}
        aria-label={`${titoloScambio(partita, sc, io)}. ${parti.mio ? 'Dai' : `${parti.sinistra.g.nome} dà`} ${descriviPacchetto(partita, parti.sinistra.p)}, ${parti.mio ? 'ricevi' : 'chiede'} ${descriviPacchetto(partita, parti.destra.p)}${nonValido ? '. Non valido' : ''}`}
      >
        <span className="scambio-riga__testa">
          <Pedina colore={da.colore} className="pedina--mini" />
          <span className="scambio-riga__chi">{chi}</span>
          {sc.trattativa > 0 && <span className="scambio-riga__versione">{sc.trattativa}ª</span>}
          {stato}
        </span>
        <span className="scambio-riga__contenuto">
          <span className="scambio-riga__parte">
            <span className="scambio-riga__verbo">{parti.mio ? 'Dai' : 'Dà'}</span>
            <Riassunto partita={partita} p={parti.sinistra.p} />
          </span>
          <span className="scambio-riga__parte">
            <span className="scambio-riga__verbo">{parti.mio ? 'Ricevi' : 'Chiede'}</span>
            <Riassunto partita={partita} p={parti.destra.p} />
          </span>
        </span>
        {(trattano.length > 0 || guardano.length > 0) && (
          <span className="scambio-riga__piede">
            {trattano.length > 0 && (
              <span className="scambio-riga__attivita">
                <Icona nome="matita" className="matita-che-scrive" />
                {elenco(trattano.map((g) => g.nome))} {trattano.some((g) => g.id === sc.da) ? 'sta modificando la proposta…' : 'sta scrivendo una controproposta…'}
              </span>
            )}
            {guardano.length > 0 && (
              <span className="scambio-riga__occhi" title={`Lo guarda ${elenco(guardano.map((g) => g.nome))}`}>
                <Icona nome="occhio" />
                {guardano.map((g) => (
                  <Pedina key={g.id} colore={g.colore} className="pedina--mini" />
                ))}
              </span>
            )}
          </span>
        )}
      </button>
    </motion.li>
  );
}

/* ---------------- Proporre ---------------- */

/**
 * Lo scambio che si sta preparando. Lo tiene la schermata di gioco, così non si perde quando la finestra
 * si chiude da sola (un'asta, l'inizio del proprio turno).
 */
export interface BozzaProposta {
  con: IdGiocatore | null;
  dare: Pacchetto;
  avere: Pacchetto;
  /** `null` finché non si aggiunge una nota. */
  nota: string | null;
}

/** L'editor già pronto, per esempio da «Chiedila a Bruno»: con chi e le proprietà da chiedergli. */
export interface RichiestaScambio {
  con: IdGiocatore;
  /** Proprietà di `con` da mettere subito in «Ricevi». */
  caselle?: number[];
}

/**
 * La bozza di partenza: lo scambio a cui si risponde (o che si modifica) visto dalla mia parte, la richiesta
 * con cui si apre l'editor, oppure vuota.
 */
function bozzaIniziale(partita: Stato, io: IdGiocatore, base?: Scambio, richiesta?: RichiestaScambio): BozzaProposta {
  if (base) {
    const mio = base.da === io;
    return { con: mio ? base.a : base.da, dare: mio ? base.dare : base.avere, avere: mio ? base.avere : base.dare, nota: null };
  }
  if (richiesta) {
    const sue = (richiesta.caselle ?? []).filter((n) => partita.proprieta[n]?.proprietario === richiesta.con).sort((x, y) => x - y);
    return { con: richiesta.con, dare: PACCHETTO_VUOTO, avere: { ...PACCHETTO_VUOTO, caselle: sue }, nota: null };
  }
  const altri = partita.giocatori.filter((g) => !g.eliminato && g.id !== io);
  return { con: altri.length === 1 ? altri[0]!.id : null, dare: PACCHETTO_VUOTO, avere: PACCHETTO_VUOTO, nota: null };
}

export function EditorScambio({
  partita,
  io,
  base,
  iniziale: richiesta,
  bozza,
  inviando,
  onBozza,
  onInvia,
  onChiudi,
}: {
  partita: Stato;
  io: IdGiocatore;
  /** Lo scambio a cui si risponde con una controproposta, o la propria proposta da modificare. */
  base?: Scambio;
  /** Come aprire l'editor quando non c'è ancora una bozza: giocatore scelto e proprietà già in «Ricevi». */
  iniziale?: RichiestaScambio;
  /** La bozza salvata; senza, si parte da `base`, da `iniziale` o da capo. */
  bozza?: BozzaProposta;
  inviando: boolean;
  onBozza: (bozza: BozzaProposta) => void;
  onInvia: (proposta: Proposta) => void;
  onChiudi: () => void;
}): ReactNode {
  const altri = partita.giocatori.filter((g) => !g.eliminato && g.id !== io);
  const attuale = bozza ?? bozzaIniziale(partita, io, base, richiesta);
  const { con, dare, avere, nota } = attuale;
  const cambia = (modifiche: Partial<BozzaProposta>) => onBozza({ ...attuale, ...modifiche });
  // Il fuoco va sulla nota solo quando la si aggiunge, non quando la finestra si riapre con la bozza.
  const [notaNuova, setNotaNuova] = useState(false);

  const me = trova(partita, io);
  // Chi nel frattempo è uscito dalla partita non si può più scegliere.
  const lui = con ? altri.find((g) => g.id === con) : undefined;
  const modifica = base !== undefined && base.da === io;
  const titolo = !base
    ? 'Nuovo scambio'
    : modifica
      ? `Modifica la proposta ${preposizioneA(lui?.nome ?? '')}`
      : `Controproposta ${preposizioneA(lui?.nome ?? '')}`;
  if (!me) return null;

  const proposta: Proposta | null = lui
    ? { tipo: 'proponi', a: lui.id, dare, avere, nota: nota ?? '', ...(base ? { sostituisce: base.id } : {}) }
    : null;
  const vuoto = pacchettoVuoto(dare) && pacchettoVuoto(avere);
  // Al posto del pulsante spento, una frase che dice cosa manca.
  const suggerimento = !lui ? 'Scegli con chi fare lo scambio' : vuoto ? 'Scegli cosa dai o cosa chiedi' : null;
  const blocco = inviando ? 'Un attimo…' : proposta ? (verifica(partita, { ...proposta, giocatore: io } as Azione)?.messaggio ?? null) : null;
  const problemi = lui ? problemiScambio(partita, { da: io, a: lui.id, dare, avere }).filter((x) => x !== VUOTO) : [];
  const conta = (g: Giocatore) => possedute(partita, g.id).length;

  return (
    <RiquadroTabellone titolo={titolo} onChiudi={onChiudi} className="scambio-finestra scambio-finestra--editor">
      {!base && altri.length > 1 && (
        <div className="scambio-finestra__con" role="group" aria-label="Con chi fai lo scambio">
          {altri.map((g) => (
            <button
              key={g.id}
              type="button"
              className="pastiglia-giocatore"
              aria-pressed={g.id === con}
              onClick={() => g.id !== con && cambia({ con: g.id, avere: PACCHETTO_VUOTO })}
            >
              <Pedina colore={g.colore} iniziale={inizialeNome(g.nome)} className="pedina--media" />
              <span className="pastiglia-giocatore__testo">
                <b>{g.nome}</b>
                <small>
                  <Soldi valore={g.saldo} misura="s" />
                  <span>· {conta(g)} proprietà</span>
                </small>
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="scambio-finestra__parti">
        <Lato partita={partita} g={me} io={io} p={dare} verbo="Dai" tono="dai" onCambia={(p) => cambia({ dare: p })} />
        <Freccia />
        {lui ? (
          <Lato partita={partita} g={lui} io={io} p={avere} verbo="Ricevi" tono="ricevi" onCambia={(p) => cambia({ avere: p })} />
        ) : (
          <section className="lato lato--vuoto">
            <header className="lato__testa lato__testa--ricevi">
              <span className="lato__verbo">Ricevi</span>
            </header>
            <p className="lato__scegli">
              <Icona nome="su" />
              Scegli con chi scambiare
            </p>
          </section>
        )}
      </div>

      {lui && <Effetti partita={partita} bozza={{ da: io, a: lui.id, dare, avere }} io={io} />}

      <div className="scambio-finestra__nota-campo">
        {nota === null ? (
          <button
            type="button"
            className="pulsante pulsante--fantasma pulsante--piccolo"
            onClick={() => {
              setNotaNuova(true);
              cambia({ nota: '' });
            }}
          >
            <Icona nome="nota" />
            Aggiungi una nota
          </button>
        ) : (
          <>
            <textarea
              className="campo"
              rows={2}
              maxLength={NOTA_MAX}
              placeholder="Scrivi qualcosa…"
              aria-label="Nota per lo scambio"
              value={nota}
              autoFocus={notaNuova}
              onChange={(e) => cambia({ nota: e.target.value })}
            />
            <div className="scambio-finestra__nota-piede">
              <span>
                {Array.from(nota).length}/{NOTA_MAX}
              </span>
              <button type="button" className="scambio-finestra__collegamento" onClick={() => cambia({ nota: null })}>
                Togli la nota
              </button>
            </div>
          </>
        )}
      </div>

      {lui && !vuoto && <Riepilogo partita={partita} dai={dare} ricevi={avere} />}

      <Problemi elenco={problemi} />

      <div className="finestra__azioni scambio-finestra__azioni">
        {suggerimento && <p className="scambio-finestra__suggerimento">{suggerimento}</p>}
        <button type="button" className="pulsante pulsante--fantasma" onClick={onChiudi}>
          Annulla
        </button>
        {!suggerimento && proposta && (
          <span className="con-suggerimento" data-testo={blocco ?? undefined}>
            <button type="button" className="pulsante pulsante--primario" disabled={blocco !== null} onClick={() => onInvia(proposta)}>
              <Icona nome="invia" />
              {!base ? 'Proponi lo scambio' : modifica ? 'Invia la modifica' : 'Invia la controproposta'}
            </button>
          </span>
        )}
      </div>
    </RiquadroTabellone>
  );
}

/* ---------------- Vedere e rispondere ---------------- */

export function VediScambio({
  partita,
  io,
  scambio,
  attivita,
  inviando,
  onMossa,
  onTratta,
  onChiudi,
}: {
  partita: Stato;
  io: IdGiocatore | null;
  scambio: Scambio;
  attivita: Record<IdGiocatore, Attivita>;
  inviando: boolean;
  onMossa: (m: Mossa) => void;
  /** Apre l'editor su questo scambio: controproposta per chi lo riceve, modifica per chi l'ha proposto. */
  onTratta: () => void;
  onChiudi: () => void;
}): ReactNode {
  const parti = lati(partita, scambio, io);
  if (!parti) return null;
  const { sinistra, destra, mio } = parti;
  const da = sinistra.g.id === scambio.da ? sinistra.g : destra.g;
  const a = da === sinistra.g ? destra.g : sinistra.g;
  const problemi = problemiScambio(partita, scambio);
  const guardano = presenti(partita, attivita, scambio.id, io, 'guarda');
  const trattano = presenti(partita, attivita, scambio.id, io, 'tratta');
  const blocco = (m: Mossa) =>
    inviando ? 'Un attimo…' : io ? (verifica(partita, { ...m, giocatore: io } as Azione)?.messaggio ?? null) : '';
  const accetta: Mossa = { tipo: 'accetta', scambio: scambio.id };
  const bloccoAccetta = problemi.length > 0 ? 'Questo scambio non si può fare.' : blocco(accetta);

  return (
    <RiquadroTabellone titolo={titoloScambio(partita, scambio, io)} onChiudi={onChiudi} className="scambio-finestra scambio-finestra--vedi">
      <div className="scambio-finestra__parti">
        <Lato
          partita={partita}
          g={sinistra.g}
          io={io}
          p={sinistra.p}
          prima={sinistra.prima}
          verbo={mio ? 'Dai' : 'Dà'}
          tono={mio ? 'dai' : 'neutro'}
        />
        <Freccia />
        <Lato
          partita={partita}
          g={destra.g}
          io={io}
          p={destra.p}
          prima={destra.prima}
          verbo={mio ? 'Ricevi' : 'Dà'}
          tono={mio ? 'ricevi' : 'neutro'}
        />
      </div>

      <Effetti partita={partita} bozza={scambio} io={io} />

      {scambio.nota && (
        <blockquote className="scambio-finestra__nota">
          <Icona nome="nota" />
          <p>
            <b>{da.nome}:</b> {scambio.nota}
          </p>
        </blockquote>
      )}

      {mio && <Riepilogo partita={partita} dai={sinistra.p} ricevi={destra.p} breve />}

      <Problemi elenco={problemi} titolo="Questo scambio non si può fare:" />

      {guardano.length > 0 && (
        <p className="scambio-finestra__occhi">
          <Icona nome="occhio" />
          Lo {guardano.length === 1 ? 'sta' : 'stanno'} guardando {elenco(guardano.map((g) => g.nome))}.
        </p>
      )}

      {a.id === io && (
        <div className="finestra__azioni scambio-finestra__azioni">
          <button
            type="button"
            className="pulsante pulsante--pericolo-tenue"
            disabled={inviando}
            onClick={() => onMossa({ tipo: 'rifiuta', scambio: scambio.id })}
          >
            <Icona nome="chiudi" />
            Rifiuta
          </button>
          <button type="button" className="pulsante pulsante--secondario" disabled={inviando} onClick={onTratta}>
            <Icona nome="matita" />
            Controproposta
          </button>
          <span className="con-suggerimento" data-testo={bloccoAccetta ?? undefined}>
            <button
              type="button"
              className="pulsante pulsante--verde scambio-finestra__accetta"
              disabled={bloccoAccetta !== null}
              onClick={() => onMossa(accetta)}
            >
              <Icona nome="spunta" />
              Accetta
            </button>
          </span>
        </div>
      )}
      {da.id === io && (
        <div className="finestra__azioni scambio-finestra__azioni">
          <p className="scambio-finestra__attesa">
            {trattano.length > 0 ? (
              <>
                <Icona nome="matita" className="matita-che-scrive" />
                {a.nome} sta scrivendo una controproposta…
              </>
            ) : (
              `Aspetti la risposta di ${a.nome}.`
            )}
          </p>
          <button
            type="button"
            className="pulsante pulsante--pericolo-tenue"
            disabled={inviando}
            onClick={() => onMossa({ tipo: 'annulla', scambio: scambio.id })}
          >
            <Icona nome="cestino" />
            Ritira
          </button>
          <button type="button" className="pulsante pulsante--secondario" disabled={inviando} onClick={onTratta}>
            <Icona nome="matita" />
            Modifica
          </button>
        </div>
      )}
    </RiquadroTabellone>
  );
}

/* ---------------- Notifiche ---------------- */

/**
 * Il biglietto che scende dall'alto del tabellone quando arriva una proposta: chi la manda, cosa c'è dentro,
 * «Vedi» e «Dopo». Con più proposte si mostra l'ultima arrivata e si contano le altre.
 * Va nel livello sopra il tabellone (prop `sopra` di Tabellone), dentro un <AnimatePresence>.
 */
export function BigliettoProposta({
  partita,
  io,
  scambi,
  onVedi,
  onDopo,
}: {
  partita: Stato;
  io: IdGiocatore;
  /** Le proposte per me ancora da vedere, dalla più vecchia alla più recente. */
  scambi: Scambio[];
  onVedi: (scambio: number) => void;
  /** Mette via il biglietto: le proposte restano nel pannello «Scambi». */
  onDopo: () => void;
}): ReactNode {
  const sc = scambi.at(-1);
  const parti = sc ? lati(partita, sc, io) : null;
  if (!sc || !parti) return null;
  const da = parti.destra.g;
  return (
    <motion.aside
      className={scambi.length > 1 ? 'biglietto-proposta biglietto-proposta--pila' : 'biglietto-proposta'}
      aria-live="polite"
      aria-label="Proposta di scambio"
      initial={{ opacity: 0, y: -40 }}
      animate={{ opacity: 1, y: 0, transition: { duration: DURATA.lenta, ease: CURVA.molla } }}
      exit={{ opacity: 0, y: -24, transition: { duration: DURATA.uscita, ease: CURVA.partenza } }}
    >
      <Pedina colore={da.colore} iniziale={inizialeNome(da.nome)} className="pedina--grande" />
      <div className="biglietto-proposta__testo">
        <p className="biglietto-proposta__titolo">
          <b>{da.nome}</b>{' '}
          {sc.modifica ? 'ha modificato la sua proposta' : sc.trattativa > 0 ? 'ti fa una controproposta' : 'ti propone uno scambio'}
        </p>
        <p className="biglietto-proposta__riassunto">
          <span className="biglietto-proposta__parte">
            <span className="biglietto-proposta__verbo biglietto-proposta__verbo--ricevi">Ricevi</span>
            <Riassunto partita={partita} p={parti.destra.p} />
          </span>
          <span className="biglietto-proposta__parte">
            <span className="biglietto-proposta__verbo biglietto-proposta__verbo--dai">Dai</span>
            <Riassunto partita={partita} p={parti.sinistra.p} />
          </span>
        </p>
      </div>
      <div className="biglietto-proposta__azioni">
        <button type="button" className="pulsante pulsante--piccolo pulsante--fantasma" onClick={onDopo}>
          Dopo
        </button>
        <button type="button" className="pulsante pulsante--piccolo pulsante--primario" onClick={() => onVedi(sc.id)}>
          <Icona nome="occhio" />
          Vedi
        </button>
      </div>
      {scambi.length > 1 && (
        <Chip tono="ambra" className="biglietto-proposta__conta">
          {scambi.length} proposte
        </Chip>
      )}
    </motion.aside>
  );
}

/** Il testo da mostrare (con `avvisa(testo, tipo)`) quando uno scambio si chiude o torna indietro con una controproposta. */
export interface EsitoScambio {
  testo: string;
  tipo: 'successo' | 'errore' | 'attenzione' | 'info';
  /** Lo scambio da aprire con «Vedi», per la controproposta. */
  scambio?: number;
}

/**
 * Gli esiti per chi ha proposto: accettato (verde), rifiutato (rosso); per chi riceve: controproposta
 * (ambra, con lo scambio da vedere) e scambio ritirato. `null` per tutti gli altri eventi e per chi guarda.
 */
// eslint-disable-next-line react-refresh/only-export-components -- testi legati ai componenti di questo file
export function esitoScambio(partita: Stato, io: IdGiocatore | null, evento: Evento): EsitoScambio | null {
  if (!io) return null;
  switch (evento.tipo) {
    case 'scambio_accettato':
      if (evento.da !== io) return null;
      return {
        tipo: 'successo',
        testo: pacchettoVuoto(evento.avere)
          ? `${nomeDi(partita, evento.a)} ha accettato il tuo scambio.`
          : `${nomeDi(partita, evento.a)} ha accettato lo scambio: ricevi ${descriviPacchetto(partita, evento.avere)}.`,
      };
    case 'scambio_rifiutato':
      return evento.da === io ? { tipo: 'errore', testo: `${nomeDi(partita, evento.a)} ha rifiutato il tuo scambio.` } : null;
    case 'scambio_proposto':
      if (evento.a !== io || evento.trattativa === 0) return null;
      return {
        tipo: 'attenzione',
        testo: evento.modifica
          ? `${nomeDi(partita, evento.da)} ha modificato la sua proposta.`
          : `${nomeDi(partita, evento.da)} ti fa una controproposta.`,
        scambio: evento.scambio,
      };
    case 'scambio_annullato':
      return evento.a === io ? { tipo: 'info', testo: `${nomeDi(partita, evento.da)} ha ritirato lo scambio.` } : null;
    default:
      return null;
  }
}

/**
 * L'esito di uno scambio timbrato sul tabellone, per un attimo e senza bloccare niente: le due pedine, chi con chi,
 * e il timbro «Accettato» (verde) o «Rifiutato» (rosso) che cade con un colpo. Lo decide la regia (Scena.timbro):
 * va nel livello sopra il tabellone, dentro un <AnimatePresence>.
 */
export function TimbroScambio({
  partita,
  io,
  tipo,
  da,
  a,
}: {
  partita: Stato;
  io: IdGiocatore | null;
  tipo: 'accettato' | 'rifiutato';
  da: IdGiocatore;
  a: IdGiocatore;
}): ReactNode {
  const chiPropone = trova(partita, da);
  const chiRisponde = trova(partita, a);
  if (!chiPropone || !chiRisponde) return null;
  const nome = (g: Giocatore) => (g.id === io ? 'te' : g.nome);
  const titolo =
    tipo === 'accettato'
      ? `Scambio tra ${chiPropone.id === io ? 'te' : chiPropone.nome} e ${nome(chiRisponde)}`
      : `${chiRisponde.id === io ? 'Hai rifiutato' : `${chiRisponde.nome} ha rifiutato`} lo scambio`;
  return (
    <motion.aside
      className={`timbro-scambio timbro-scambio--${tipo}`}
      aria-live="polite"
      initial={{ opacity: 0, scale: 0.94, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0, transition: { duration: DURATA.entrata, ease: CURVA.arrivo } }}
      exit={{ opacity: 0, scale: 0.97, y: 6, transition: { duration: DURATA.uscita, ease: CURVA.partenza } }}
    >
      <span className="timbro-scambio__coppia" aria-hidden="true">
        <Pedina colore={chiPropone.colore} iniziale={inizialeNome(chiPropone.nome)} className="pedina--media" />
        <Icona nome="scambio" className="timbro-scambio__freccia" />
        <Pedina colore={chiRisponde.colore} iniziale={inizialeNome(chiRisponde.nome)} className="pedina--media" />
      </span>
      <p className="timbro-scambio__titolo">{titolo}</p>
      <motion.span
        className="timbro-scambio__timbro"
        initial={{ opacity: 0, scale: 1.7, rotate: -6 }}
        animate={{ opacity: 1, scale: 1, rotate: -6, transition: { duration: DURATA.timbro, ease: CURVA.timbro, delay: DURATA.entrata } }}
      >
        {tipo === 'accettato' ? 'Accettato' : 'Rifiutato'}
      </motion.span>
    </motion.aside>
  );
}
