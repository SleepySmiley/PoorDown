/*
 * Scambi: il pannello nella colonna destra, la finestra per proporre uno scambio (o una controproposta)
 * e quella per vederlo e rispondere. Impaginazione come richup: due colonne, chi propone a sinistra,
 * le frecce in mezzo, i pulsanti sotto. Le regole (e i motivi per cui uno scambio non si può fare)
 * sono quelle del motore.
 */

import '../stili/economia.css';
import { useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import {
  euro,
  NOTA_MAX,
  PACCHETTO_VUOTO,
  possedute,
  problemiScambio,
  proprietabile,
  regioneConEdifici,
  SCAMBI_APERTI_MAX,
  tabellone,
  verifica,
  type Attivita,
  type Azione,
  type Giocatore,
  type IdGiocatore,
  type Mossa,
  type NomeMazzo,
  type Pacchetto,
  type Scambio,
  type Stato,
} from '@poordown/engine';
import { caselleVista } from '../ui/caselle';
import { Pedina, Soldi, Stemma } from '../ui/comuni';
import { Icona } from '../ui/icone';
import { SCORRE } from '../ui/movimento';
import { iniziale } from '../ui/utili';
import { RiquadroTabellone } from './Colonne';

export type Proposta = Extract<Mossa, { tipo: 'proponi' }>;

const VUOTO = 'Lo scambio è vuoto.';

function trova(partita: Stato, id: IdGiocatore): Giocatore | undefined {
  return partita.giocatori.find((g) => g.id === id);
}

/** Chi, oltre a me, sta guardando o trattando questo scambio. */
function osservatori(partita: Stato, attivita: Record<IdGiocatore, Attivita>, scambio: number, io: IdGiocatore | null): Giocatore[] {
  return Object.entries(attivita)
    .filter(([id, a]) => id !== io && a.tipo !== 'crea' && a.scambio === scambio)
    .flatMap(([id]) => trova(partita, id) ?? []);
}

function elencoNomi(nomi: string[]): string {
  return nomi.length <= 1 ? (nomi[0] ?? '') : `${nomi.slice(0, -1).join(', ')} e ${nomi.at(-1)!}`;
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
    <section className="pannello scambi" aria-labelledby="titolo-scambi">
      <header className="pannello__testa pannello__testa--titolo-centro">
        <h2 id="titolo-scambi" className="pannello__titolo">
          Scambi
        </h2>
        {onCrea && (
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
        )}
      </header>
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
          <Icona nome="matita" />
          {elencoNomi(creano.map((g) => g.nome))} {creano.length === 1 ? 'sta creando' : 'stanno creando'} uno scambio…
        </p>
      )}
      {partita.scambi.length > 0 && (
        <ul className="scambi__lista">
          {partita.scambi.map((sc) => {
            const da = trova(partita, sc.da);
            const a = trova(partita, sc.a);
            if (!da || !a) return null;
            const occhi = osservatori(partita, attivita, sc.id, io);
            let stato = '';
            if (problemiScambio(partita, sc).length > 0) stato = 'Non valido';
            else if (sc.a === io) stato = 'Per te';
            else if (sc.da === io) stato = 'In attesa';
            return (
              <motion.li key={sc.id} layout="position" transition={SCORRE}>
                <button
                  type="button"
                  className={sc.a === io ? 'scambio scambio--per-me' : 'scambio'}
                  onClick={() => onApri(sc.id)}
                  aria-label={`Scambio tra ${da.nome} e ${a.nome}${stato ? `, ${stato.toLowerCase()}` : ''}`}
                >
                  <Pedina colore={da.colore} className="pedina--mini" />
                  <span className="scambio__nome">{da.nome}</span>
                  <Icona nome="scambio" className="scambio__freccia" />
                  <Pedina colore={a.colore} className="pedina--mini" />
                  <span className="scambio__nome">{a.nome}</span>
                  {occhi.length > 0 && (
                    <span className="scambio__occhi" title={`Lo guarda ${elencoNomi(occhi.map((g) => g.nome))}`}>
                      <Icona nome="occhio" />
                      {occhi.length}
                    </span>
                  )}
                  {stato && <span className="scambio__stato">{stato}</span>}
                </button>
              </motion.li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ---------------- Una parte dello scambio ---------------- */

/**
 * Cosa mette sul tavolo un giocatore. Con `onCambia` si sceglie (soldi, proprietà, Carte Grazia);
 * senza, mostra solo quello che c'è nello scambio.
 */
function Parte({
  partita,
  g,
  io,
  p,
  verbo,
  onCambia,
  extra,
}: {
  partita: Stato;
  g: Giocatore;
  io: IdGiocatore | null;
  p: Pacchetto;
  verbo: string;
  onCambia?: (p: Pacchetto) => void;
  extra?: ReactNode;
}): ReactNode {
  const tab = tabellone(partita.mappa);
  const caselle = caselleVista(partita.mappa);
  const elenco = onCambia ? possedute(partita, g.id) : p.caselle;
  const grazie = onCambia ? g.carteGrazia : p.grazie;
  const massimo = Math.max(0, g.saldo);
  const niente = p.soldi === 0 && elenco.length === 0 && grazie.length === 0;

  const soldi = (valore: number) => onCambia?.({ ...p, soldi: Math.max(0, Math.min(massimo, Math.floor(valore) || 0)) });
  const casella = (n: number) =>
    onCambia?.({ ...p, caselle: p.caselle.includes(n) ? p.caselle.filter((x) => x !== n) : [...p.caselle, n].sort((x, y) => x - y) });
  const grazia = (mazzo: NomeMazzo) =>
    onCambia?.({ ...p, grazie: p.grazie.includes(mazzo) ? p.grazie.filter((x) => x !== mazzo) : [...p.grazie, mazzo] });

  return (
    <div className="parte">
      <p className="parte__chi">
        <Pedina colore={g.colore} iniziale={iniziale(g.nome)} className="pedina--media" />
        <span className="parte__nome">
          <b>
            {g.nome}
            {g.id === io && <span className="parte__tu"> (tu)</span>}
          </b>
          <small>{verbo}</small>
        </span>
        {extra}
      </p>

      {onCambia ? (
        <div className="parte__soldi">
          <input
            type="range"
            min={0}
            max={massimo}
            step={1}
            value={Math.min(p.soldi, massimo)}
            disabled={massimo === 0}
            aria-label={`Soldi di ${g.nome} nello scambio`}
            onChange={(e) => soldi(Number(e.target.value))}
          />
          <div className="parte__righello">
            <span>0</span>
            <label className="parte__importo">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={massimo}
                step={1}
                value={p.soldi}
                disabled={massimo === 0}
                aria-label={`Soldi di ${g.nome}, in euro`}
                onChange={(e) => soldi(Number(e.target.value))}
                onFocus={(e) => e.currentTarget.select()}
              />
              €
            </label>
            <span>{euro(massimo)}</span>
          </div>
        </div>
      ) : (
        p.soldi > 0 && (
          <p className="parte__contanti">
            <Soldi valore={p.soldi} />
          </p>
        )
      )}

      <ul className="parte__lista">
        {elenco.map((n) => {
          const c = caselle[n];
          const prop = proprietabile(tab, n);
          if (!c || !prop) return null;
          const scelta = p.caselle.includes(n);
          const ipotecata = partita.proprieta[n]?.ipotecata === true;
          const edifici = prop.tipo === 'citta' && regioneConEdifici(partita, prop.regione);
          const corpo = (
            <>
              {c.gruppo !== undefined ? (
                <Stemma regione={tab.regioni[c.gruppo - 1]} className="stemma--lista" />
              ) : (
                c.icona && <Icona nome={c.icona} className="voce-scambio__icona" />
              )}
              <span className="voce-scambio__nome">{c.nome}</span>
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
                <span className="voce-scambio voce-scambio--scelta">{corpo}</span>
              )}
            </li>
          );
        })}
        {grazie.map((mazzo) => {
          const corpo = (
            <>
              <Icona nome="grazia" className="voce-scambio__icona" />
              <span className="voce-scambio__nome">Carta Grazia</span>
            </>
          );
          return (
            <li key={mazzo}>
              {onCambia ? (
                <button type="button" className="voce-scambio" aria-pressed={p.grazie.includes(mazzo)} onClick={() => grazia(mazzo)}>
                  {corpo}
                </button>
              ) : (
                <span className="voce-scambio voce-scambio--scelta">{corpo}</span>
              )}
            </li>
          );
        })}
      </ul>
      {niente && <p className="parte__niente">{onCambia ? 'Niente da scambiare' : 'Niente'}</p>}
    </div>
  );
}

function Problemi({ elenco, titolo }: { elenco: string[]; titolo?: string }): ReactNode {
  if (elenco.length === 0) return null;
  return (
    <div className="scambio-finestra__problemi" role="status">
      <Icona nome="avviso" />
      <div>
        {titolo && <p>{titolo}</p>}
        <ul>
          {elenco.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </div>
    </div>
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

/** La bozza di partenza: vuota, oppure lo scambio a cui si risponde visto dalla mia parte. */
function bozzaIniziale(partita: Stato, io: IdGiocatore, base?: Scambio): BozzaProposta {
  if (base) {
    const mio = base.da === io;
    return { con: mio ? base.a : base.da, dare: mio ? base.dare : base.avere, avere: mio ? base.avere : base.dare, nota: null };
  }
  const altri = partita.giocatori.filter((g) => !g.eliminato && g.id !== io);
  return { con: altri.length === 1 ? altri[0]!.id : null, dare: PACCHETTO_VUOTO, avere: PACCHETTO_VUOTO, nota: null };
}

export function EditorScambio({
  partita,
  io,
  base,
  bozza,
  inviando,
  onBozza,
  onInvia,
  onChiudi,
}: {
  partita: Stato;
  io: IdGiocatore;
  /** Lo scambio a cui si risponde con una controproposta. */
  base?: Scambio;
  /** La bozza salvata; senza, si parte da capo. */
  bozza?: BozzaProposta;
  inviando: boolean;
  onBozza: (bozza: BozzaProposta) => void;
  onInvia: (proposta: Proposta) => void;
  onChiudi: () => void;
}): ReactNode {
  const altri = partita.giocatori.filter((g) => !g.eliminato && g.id !== io);
  const attuale = bozza ?? bozzaIniziale(partita, io, base);
  const { con, dare, avere, nota } = attuale;
  const cambia = (modifiche: Partial<BozzaProposta>) => onBozza({ ...attuale, ...modifiche });
  const titolo = base ? 'Controproposta' : 'Crea uno scambio';
  // Il fuoco va sulla nota solo quando la si aggiunge, non quando la finestra si riapre con la bozza.
  const [notaNuova, setNotaNuova] = useState(false);

  const me = trova(partita, io);
  // Chi nel frattempo è uscito dalla partita non si può più scegliere.
  const lui = con ? altri.find((g) => g.id === con) : undefined;

  if (!me || !lui) {
    return (
      <RiquadroTabellone titolo={titolo} onChiudi={onChiudi} className="scambio-finestra">
        <div className="scambio-finestra__scegli">
          <p>Con chi vuoi fare lo scambio?</p>
          <ul>
            {altri.map((g) => (
              <li key={g.id}>
                <button
                  type="button"
                  className="scambio-finestra__giocatore"
                  onClick={() => cambia(g.id === con ? { con: g.id } : { con: g.id, avere: PACCHETTO_VUOTO })}
                >
                  <Pedina colore={g.colore} iniziale={iniziale(g.nome)} className="pedina--media" />
                  <b>{g.nome}</b>
                  <Soldi valore={g.saldo} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </RiquadroTabellone>
    );
  }

  const proposta: Proposta = {
    tipo: 'proponi',
    a: lui.id,
    dare,
    avere,
    nota: nota ?? '',
    ...(base ? { sostituisce: base.id } : {}),
  };
  const blocco = inviando ? 'Un attimo…' : (verifica(partita, { ...proposta, giocatore: io } as Azione)?.messaggio ?? null);
  const problemi = problemiScambio(partita, { da: io, a: lui.id, dare, avere }).filter((x) => x !== VUOTO);
  const cambiaGiocatore =
    !base && altri.length > 1 ? (
      <button type="button" className="parte__cambia" onClick={() => cambia({ con: null, avere: PACCHETTO_VUOTO })}>
        Cambia
      </button>
    ) : undefined;

  return (
    <RiquadroTabellone titolo={titolo} onChiudi={onChiudi} className="scambio-finestra">
      <div className="scambio-finestra__parti">
        <Parte partita={partita} g={me} io={io} p={dare} verbo="dai" onCambia={(p) => cambia({ dare: p })} />
        <div className="scambio-finestra__freccia" aria-hidden="true">
          <Icona nome="scambio" />
        </div>
        <Parte
          partita={partita}
          g={lui}
          io={io}
          p={avere}
          verbo="chiedi"
          onCambia={(p) => cambia({ avere: p })}
          extra={cambiaGiocatore}
        />
      </div>

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
              <button type="button" className="parte__cambia" onClick={() => cambia({ nota: null })}>
                Togli la nota
              </button>
            </div>
          </>
        )}
      </div>

      <Problemi elenco={problemi} />

      <div className="finestra__azioni">
        <button type="button" className="pulsante pulsante--fantasma" onClick={onChiudi}>
          Annulla
        </button>
        <span className="con-suggerimento" data-testo={blocco ?? undefined}>
          <button type="button" className="pulsante pulsante--primario" disabled={blocco !== null} onClick={() => onInvia(proposta)}>
            <Icona nome="invia" />
            {base ? 'Invia la controproposta' : 'Proponi lo scambio'}
          </button>
        </span>
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
  onTratta: () => void;
  onChiudi: () => void;
}): ReactNode {
  const da = trova(partita, scambio.da);
  const a = trova(partita, scambio.a);
  if (!da || !a) return null;
  const problemi = problemiScambio(partita, scambio);
  const occhi = osservatori(partita, attivita, scambio.id, io);
  const titolo = scambio.trattativa > 0 ? `Scambio (controproposta n. ${scambio.trattativa})` : 'Scambio';
  const blocco = (m: Mossa) =>
    inviando ? 'Un attimo…' : io ? (verifica(partita, { ...m, giocatore: io } as Azione)?.messaggio ?? null) : '';
  const accetta: Mossa = { tipo: 'accetta', scambio: scambio.id };
  const bloccoAccetta = problemi.length > 0 ? 'Questo scambio non si può fare.' : blocco(accetta);

  return (
    <RiquadroTabellone titolo={titolo} onChiudi={onChiudi} className="scambio-finestra">
      <div className="scambio-finestra__parti">
        <Parte partita={partita} g={da} io={io} p={scambio.dare} verbo={da.id === io ? 'dai' : 'dà'} />
        <div className="scambio-finestra__freccia" aria-hidden="true">
          <Icona nome="scambio" />
        </div>
        <Parte partita={partita} g={a} io={io} p={scambio.avere} verbo={a.id === io ? 'dai' : 'dà'} />
      </div>

      {scambio.nota && (
        <blockquote className="scambio-finestra__nota">
          <Icona nome="nota" />
          <p>
            <b>{da.nome}:</b> {scambio.nota}
          </p>
        </blockquote>
      )}

      <Problemi elenco={problemi} titolo="Questo scambio non si può fare:" />

      {occhi.length > 0 && (
        <p className="scambio-finestra__occhi">
          <Icona nome="occhio" />
          Lo {occhi.length === 1 ? 'sta' : 'stanno'} guardando {elencoNomi(occhi.map((g) => g.nome))}.
        </p>
      )}

      {a.id === io && (
        <div className="finestra__azioni scambio-finestra__risposta">
          <span className="con-suggerimento" data-testo={bloccoAccetta ?? undefined}>
            <button type="button" className="pulsante pulsante--verde" disabled={bloccoAccetta !== null} onClick={() => onMossa(accetta)}>
              <Icona nome="spunta" />
              Accetta
            </button>
          </span>
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
        </div>
      )}
      {da.id === io && (
        <div className="finestra__azioni scambio-finestra__risposta">
          <p className="scambio-finestra__attesa">Aspetti la risposta di {a.nome}.</p>
          <button
            type="button"
            className="pulsante pulsante--pericolo-tenue"
            disabled={inviando}
            onClick={() => onMossa({ tipo: 'annulla', scambio: scambio.id })}
          >
            <Icona nome="cestino" />
            Ritira lo scambio
          </button>
        </div>
      )}
    </RiquadroTabellone>
  );
}
