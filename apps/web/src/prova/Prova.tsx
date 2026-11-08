/*
 * Banco di prova della Fase 3: stanze, lobby, partita e chat senza grafica, per provare il server
 * con più browser. Sparisce quando arrivano le schermate vere (Fase 4).
 * Con ?profilo=nome si ha un'identità diversa nello stesso browser (per giocare da due schede).
 */

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  COLORI,
  descriviVoce,
  euro,
  GIOCATORI_MAX,
  GIOCATORI_MIN,
  mossePossibili,
  NOME_MAX,
  possedute,
  proprietabile,
  SOLDI_INIZIALI_POSSIBILI,
  tabellone,
  valoreVendita,
  type IdGiocatore,
  type Impostazioni,
  type Mossa,
  type Risposta,
  type Stato,
  type StanzaInElenco,
  type VistaStanza,
} from '@poordown/engine';
import { apriCollegamento } from '../rete/collegamento';
import { tokenDelBrowser } from '../rete/token';
import { useCollegamento } from '../rete/useCollegamento';
import './prova.css';

const profilo = new URLSearchParams(location.search).get('profilo') ?? '';
const collegamento = apriCollegamento(tokenDelBrowser(profilo));
const COLORE_PEDINA = ['#ff8f80', '#7ee0ae', '#ffb47a', '#8cb4ff', '#cfa2ff', '#f0e27a', '#ff9fd0', '#74e0e4', '#c9a37e', '#bfe86e', '#ff6b9a', '#c9d1db'];
const NOME_KEY = 'poordown:nome';

/** Tiene l'indirizzo allineato alla stanza seguita, così ricaricando si rientra. */
function indirizzo(codice: string | null): void {
  const cerca = profilo ? `?profilo=${encodeURIComponent(profilo)}` : '';
  history.replaceState(null, '', `/prova${codice ? `/${codice}` : ''}${cerca}`);
}

function codiceDallIndirizzo(): string | null {
  return /^\/prova\/([a-z0-9]{5})$/i.exec(location.pathname)?.[1] ?? null;
}

/** Esegue un comando e mostra l'eventuale errore. */
function useComando() {
  const [errore, setErrore] = useState<string | null>(null);
  const esegui = useCallback(async <T,>(promessa: Promise<Risposta<T>>): Promise<Risposta<T>> => {
    const risposta = await promessa;
    setErrore(risposta.ok ? null : risposta.messaggio);
    return risposta;
  }, []);
  return { errore, esegui };
}

export function Prova() {
  const stato = useCollegamento(collegamento);
  const { errore, esegui } = useComando();

  useEffect(() => {
    const codice = codiceDallIndirizzo();
    if (codice) void collegamento.entra(codice);
  }, []);

  useEffect(() => indirizzo(stato.stanza?.codice ?? null), [stato.stanza?.codice]);

  return (
    <main className="prova">
      <header className="prova__testa">
        <h1>PoorDown · banco di prova</h1>
        <p className="prova__nota">
          Pagina provvisoria della Fase 3 per provare stanze e partite.{' '}
          <span className={`prova__rete prova__rete--${stato.rete}`}>
            {stato.rete === 'attivo' ? 'Collegato' : stato.rete === 'perso' ? 'Collegamento perso' : 'Collegamento…'}
          </span>
          {profilo && <> · profilo «{profilo}»</>}
        </p>
      </header>

      {stato.avviso && <p className="prova__errore">{stato.avviso}</p>}
      {errore && <p className="prova__errore" data-prova="errore">{errore}</p>}

      {stato.stanza ? (
        <Stanza stanza={stato.stanza} io={stato.io} esegui={esegui} />
      ) : (
        <Ingresso esegui={esegui} />
      )}
    </main>
  );
}

type Esegui = ReturnType<typeof useComando>['esegui'];

/* ------------------------------------------------------------------ */
/* Ingresso                                                            */
/* ------------------------------------------------------------------ */

function Ingresso({ esegui }: { esegui: Esegui }) {
  const [codice, setCodice] = useState('');
  const [stanze, setStanze] = useState<StanzaInElenco[] | null>(null);

  async function vai(promessa: Promise<Risposta<{ codice: string }>>) {
    const risposta = await esegui(promessa);
    if (risposta.ok) await esegui(collegamento.entra(risposta.dati.codice));
  }

  async function aggiorna() {
    const risposta = await esegui(collegamento.comando('elenco_stanze', {}));
    if (risposta.ok) setStanze(risposta.dati);
  }

  return (
    <section className="prova__riquadro">
      <h2>Entra in una stanza</h2>
      <div className="prova__fila">
        <button type="button" onClick={() => void vai(collegamento.comando('crea_stanza', { privata: true }))}>
          Crea stanza privata
        </button>
        <button type="button" onClick={() => void vai(collegamento.comando('crea_stanza', { privata: false }))}>
          Crea stanza pubblica
        </button>
        <button type="button" onClick={() => void vai(collegamento.comando('gioca', {}))}>
          Gioca
        </button>
      </div>
      <form
        className="prova__fila"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          void esegui(collegamento.entra(codice.trim().toLowerCase()));
        }}
      >
        <input value={codice} onChange={(e) => setCodice(e.target.value)} placeholder="Codice (es. K7Q2M)" maxLength={5} />
        <button type="submit" disabled={codice.trim().length !== 5}>
          Entra
        </button>
      </form>
      <div className="prova__fila">
        <button type="button" onClick={() => void aggiorna()}>
          Stanze pubbliche
        </button>
      </div>
      {stanze && (
        <ul className="prova__elenco">
          {stanze.length === 0 && <li>Nessuna stanza pubblica aperta.</li>}
          {stanze.map((s) => (
            <li key={s.codice}>
              <button type="button" onClick={() => void esegui(collegamento.entra(s.codice))}>
                {s.codice.toUpperCase()}
              </button>{' '}
              {s.fase === 'lobby' ? 'in attesa' : 'in partita'} · {s.giocatori.length}/{s.giocatoriMax} ·{' '}
              {s.giocatori.map((g) => g.nome).join(', ') || 'vuota'}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Stanza                                                              */
/* ------------------------------------------------------------------ */

function Stanza({ stanza, io, esegui }: { stanza: VistaStanza; io: IdGiocatore | null; esegui: Esegui }) {
  const sonoHost = io !== null && io === stanza.host;
  const FASE = { lobby: 'lobby', partita: 'partita in corso', finita: 'partita finita' } as const;

  return (
    <div className="prova__griglia">
      <section className="prova__riquadro prova__riquadro--largo">
        <div className="prova__fila prova__fila--spazio">
          <h2>
            Stanza <span data-prova="codice">{stanza.codice.toUpperCase()}</span>
          </h2>
          <button type="button" onClick={() => void collegamento.esci()}>
            Esci
          </button>
        </div>
        <p className="prova__nota">
          <span data-prova="fase">{FASE[stanza.fase]}</span> · versione {stanza.versione} · {stanza.spettatori}{' '}
          {stanza.spettatori === 1 ? 'spettatore' : 'spettatori'} ·{' '}
          {stanza.impostazioni.stanzaPrivata ? 'privata' : 'pubblica'} · link: {location.origin}/prova/{stanza.codice}
        </p>
      </section>

      <Giocatori stanza={stanza} io={io} sonoHost={sonoHost} esegui={esegui} />

      {stanza.fase === 'lobby' && (
        <>
          {io === null && <Siediti stanza={stanza} esegui={esegui} />}
          <ImpostazioniProva stanza={stanza} sonoHost={sonoHost} esegui={esegui} />
        </>
      )}
      {stanza.partita && <Partita partita={stanza.partita} io={io} esegui={esegui} />}

      <Registro stanza={stanza} />
      <Chat io={io} esegui={esegui} />
    </div>
  );
}

function Pallino({ colore }: { colore: number }) {
  return <span className="prova__pallino" style={{ background: COLORE_PEDINA[colore - 1] }} />;
}

function Giocatori({ stanza, io, sonoHost, esegui }: { stanza: VistaStanza; io: IdGiocatore | null; sonoHost: boolean; esegui: Esegui }) {
  const presi = new Set(stanza.partecipanti.filter((p) => p.id !== io).map((p) => p.colore));
  return (
    <section className="prova__riquadro">
      <h2>Giocatori</h2>
      {stanza.partecipanti.length === 0 && <p className="prova__nota">In attesa di giocatori…</p>}
      <ul className="prova__elenco" data-prova="giocatori">
        {stanza.partecipanti.map((p) => (
          <li key={p.id}>
            <Pallino colore={p.colore} /> <b>{p.nome}</b>
            {p.id === stanza.host && ' · host'}
            {p.id === io && ' · tu'}
            {!p.connesso && ' · non collegato'}
            {sonoHost && p.id !== io && stanza.fase === 'lobby' && (
              <>
                {' '}
                <button type="button" onClick={() => void esegui(collegamento.comando('espelli', { giocatore: p.id }))}>
                  Espelli
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
      {io && stanza.fase === 'lobby' && (
        <label className="prova__fila">
          Cambia colore
          <select
            value={stanza.partecipanti.find((p) => p.id === io)?.colore}
            onChange={(e) => void esegui(collegamento.comando('cambia_colore', { colore: Number(e.target.value) }))}
          >
            {Array.from({ length: COLORI }, (_, i) => i + 1).map((c) => (
              <option key={c} value={c} disabled={presi.has(c)}>
                Colore {c}
              </option>
            ))}
          </select>
        </label>
      )}
      {sonoHost && stanza.fase === 'lobby' && (
        <button type="button" className="prova__principale" onClick={() => void esegui(collegamento.comando('avvia', {}))}>
          Avvia la partita
        </button>
      )}
      {!sonoHost && stanza.fase === 'lobby' && io && (
        <p className="prova__nota">In attesa che l’host avvii la partita…</p>
      )}
    </section>
  );
}

function Siediti({ stanza, esegui }: { stanza: VistaStanza; esegui: Esegui }) {
  const presi = new Set(stanza.partecipanti.map((p) => p.colore));
  const liberi = Array.from({ length: COLORI }, (_, i) => i + 1).filter((c) => !presi.has(c));
  const [nome, setNome] = useState(() => localStorage.getItem(`${NOME_KEY}:${profilo}`) ?? '');
  const [colore, setColore] = useState<number | null>(null);
  const scelto = colore !== null && !presi.has(colore) ? colore : liberi[0];
  const piena = stanza.partecipanti.length >= stanza.impostazioni.giocatoriMax;

  return (
    <section className="prova__riquadro">
      <h2>Siediti al tavolo</h2>
      {piena ? (
        <p className="prova__nota">La stanza è piena: puoi guardare la partita.</p>
      ) : (
        <form
          className="prova__colonna"
          onSubmit={(e) => {
            e.preventDefault();
            if (scelto === undefined) return;
            localStorage.setItem(`${NOME_KEY}:${profilo}`, nome);
            void esegui(collegamento.comando('siediti', { nome, colore: scelto }));
          }}
        >
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Il tuo nickname…" maxLength={NOME_MAX} />
          <select value={scelto} onChange={(e) => setColore(Number(e.target.value))}>
            {liberi.map((c) => (
              <option key={c} value={c}>
                Colore {c}
              </option>
            ))}
          </select>
          <button type="submit" className="prova__principale">
            Siediti
          </button>
        </form>
      )}
    </section>
  );
}

function ImpostazioniProva({ stanza, sonoHost, esegui }: { stanza: VistaStanza; sonoHost: boolean; esegui: Esegui }) {
  const imp = stanza.impostazioni;
  const cambia = (modifiche: Partial<Impostazioni>) => void esegui(collegamento.comando('impostazioni', modifiche));
  const interruttore = (chiave: keyof Impostazioni, valore: boolean) => cambia({ [chiave]: valore } as Partial<Impostazioni>);
  const INTERRUTTORI: [keyof Impostazioni, string][] = [
    ['stanzaPrivata', 'Stanza privata'],
    ['ordineCasuale', 'Ordine casuale dei giocatori'],
    ['affittoDoppioSetCompleto', 'Affitto x2 con la regione completa'],
    ['cassaVacanza', 'Cassa della Vacanza'],
    ['nienteAffittoInPrigione', 'Niente affitto se il proprietario è in prigione'],
  ];
  return (
    <section className="prova__riquadro">
      <h2>Impostazioni</h2>
      {!sonoHost && <p className="prova__nota">Solo l’host può cambiarle.</p>}
      <fieldset disabled={!sonoHost} className="prova__colonna">
        <label className="prova__fila">
          Giocatori massimi
          <select value={imp.giocatoriMax} onChange={(e) => cambia({ giocatoriMax: Number(e.target.value) })}>
            {Array.from({ length: GIOCATORI_MAX - GIOCATORI_MIN + 1 }, (_, i) => i + GIOCATORI_MIN).map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <label className="prova__fila">
          Soldi iniziali
          <select value={imp.soldiIniziali} onChange={(e) => cambia({ soldiIniziali: Number(e.target.value) })}>
            {SOLDI_INIZIALI_POSSIBILI.map((n) => (
              <option key={n} value={n}>
                {euro(n)}
              </option>
            ))}
          </select>
        </label>
        {INTERRUTTORI.map(([chiave, testo]) => (
          <label key={chiave} className="prova__fila">
            <input type="checkbox" checked={imp[chiave] as boolean} onChange={(e) => interruttore(chiave, e.target.checked)} />
            {testo}
          </label>
        ))}
      </fieldset>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Partita                                                             */
/* ------------------------------------------------------------------ */

function etichetta(m: Mossa, s: Stato): string {
  const tab = tabellone(s.mappa);
  switch (m.tipo) {
    case 'lancia':
      return s.turno.rilancio ? 'Tira ancora' : 'Tira i dadi';
    case 'compra': {
      const c = proprietabile(tab, s.turno.acquisto!)!;
      return `Compra ${c.nome} (${euro(c.prezzo)})`;
    }
    case 'fine_turno':
      return 'Fine turno';
    case 'paga_cauzione':
      return `Paga la cauzione (${euro(tab.cauzione)})`;
    case 'usa_grazia':
      return 'Usa la Carta Grazia';
    case 'vendi':
      return `Vendi ${tab.caselle[m.casella]!.nome} (+${euro(valoreVendita(s, m.casella))})`;
    case 'bancarotta':
      return 'Dichiara bancarotta';
  }
}

/** Mossa scelta da "Gioca da solo": vende se è in rosso, compra se può, tira, chiude il turno. */
function mossaAutomatica(s: Stato, io: IdGiocatore): Mossa | null {
  const possibili = mossePossibili(s, io);
  const prima = (tipo: Mossa['tipo']) => possibili.find((m) => m.tipo === tipo);
  const saldo = s.giocatori.find((g) => g.id === io)?.saldo ?? 0;
  if (saldo < 0) return prima('vendi') ?? null;
  return prima('compra') ?? prima('lancia') ?? prima('fine_turno') ?? null;
}

function Partita({ partita: s, io, esegui }: { partita: Stato; io: IdGiocatore | null; esegui: Esegui }) {
  const tab = tabellone(s.mappa);
  const [automatico, setAutomatico] = useState(false);
  /** Una mossa automatica è in viaggio: non se ne manda un'altra. */
  const occupato = useRef(false);
  /** Cresce a ogni mossa automatica finita, così si riprova anche se il server l'ha rifiutata. */
  const [giro, setGiro] = useState(0);
  const mosse = io ? mossePossibili(s, io) : [];
  const diTurno = s.giocatori.find((g) => g.id === s.turno.giocatore);
  const vincitore = s.giocatori.find((g) => g.id === s.vincitore);

  useEffect(() => {
    if (!automatico || !io || s.fase !== 'in_corso') return;
    const mossa = mossaAutomatica(s, io);
    if (!mossa) return;
    const timer = setTimeout(() => {
      if (occupato.current) return;
      occupato.current = true;
      void esegui(collegamento.comando('mossa', mossa)).finally(() => {
        occupato.current = false;
        setGiro((g) => g + 1);
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [automatico, io, s, esegui, giro]);

  return (
    <section className="prova__riquadro prova__riquadro--largo" data-prova="partita">
      <h2>Partita</h2>
      {s.fase === 'finita' ? (
        <p className="prova__esito" data-prova="esito">
          Partita finita. {vincitore ? `Vince ${vincitore.nome}.` : ''}
        </p>
      ) : (
        <p data-prova="turno">
          Turno {s.turno.numero} · di turno: <b>{diTurno?.nome}</b>
          {s.turno.dadi && ` · dadi ${s.turno.dadi[0]} e ${s.turno.dadi[1]}`}
          {s.impostazioni.cassaVacanza && ` · cassa Vacanza ${euro(s.cassaVacanza)}`}
        </p>
      )}

      <table className="prova__tabella">
        <thead>
          <tr>
            <th>Giocatore</th>
            <th>Saldo</th>
            <th>Casella</th>
            <th>Proprietà</th>
          </tr>
        </thead>
        <tbody>
          {s.giocatori.map((g) => (
            <tr key={g.id} className={s.fase === 'in_corso' && g.id === s.turno.giocatore ? 'prova__di-turno' : undefined}>
              <td>
                <Pallino colore={g.colore} /> {g.nome}
                {g.id === io && ' (tu)'}
                {g.eliminato && ' · fuori'}
                {g.prigione !== null && ' · in prigione'}
                {g.vacanza && ' · in vacanza'}
                {g.carteGrazia.length > 0 && ' · Carta Grazia'}
              </td>
              <td className={g.saldo < 0 ? 'prova__rosso' : undefined}>{euro(g.saldo)}</td>
              <td>{tab.caselle[g.posizione]!.nome}</td>
              <td>{possedute(s, g.id).map((i) => tab.caselle[i]!.breve ?? tab.caselle[i]!.nome).join(', ')}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {io && s.fase === 'in_corso' && (
        <>
          <div className="prova__fila prova__mosse" data-prova="mosse">
            {mosse.map((m) => (
              <button
                key={JSON.stringify(m)}
                type="button"
                className={m.tipo === 'bancarotta' ? 'prova__pericolo' : undefined}
                onClick={() => void esegui(collegamento.comando('mossa', m))}
              >
                {etichetta(m, s)}
              </button>
            ))}
          </div>
          <label className="prova__fila">
            <input type="checkbox" checked={automatico} onChange={(e) => setAutomatico(e.target.checked)} data-prova="automatico" />
            Gioca da solo (tira, compra e chiude il turno al posto tuo)
          </label>
        </>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Registro e chat                                                     */
/* ------------------------------------------------------------------ */

function Registro({ stanza }: { stanza: VistaStanza }) {
  const { registro } = useCollegamento(collegamento);
  const righe = registro
    .map((v) => ({ n: v.n, testo: descriviVoce(v.evento, stanza.partita) }))
    .filter((r): r is { n: number; testo: string } => r.testo !== null)
    .reverse()
    .slice(0, 40);
  return (
    <section className="prova__riquadro">
      <h2>Registro</h2>
      <ol className="prova__registro" data-prova="registro">
        {righe.map((r) => (
          <li key={r.n}>{r.testo}</li>
        ))}
      </ol>
    </section>
  );
}

function Chat({ io, esegui }: { io: IdGiocatore | null; esegui: Esegui }) {
  const { chat, scrivono, stanza } = useCollegamento(collegamento);
  const [testo, setTesto] = useState('');
  const nomi = scrivono.map((id) => stanza?.partecipanti.find((p) => p.id === id)?.nome).filter(Boolean);
  return (
    <section className="prova__riquadro">
      <h2>Chat</h2>
      <ul className="prova__chat">
        {chat.length === 0 && <li className="prova__nota">Ancora nessun messaggio.</li>}
        {chat.map((m) => (
          <li key={m.n}>
            <Pallino colore={m.colore} /> <b>{m.nome}</b>: {m.testo}
          </li>
        ))}
      </ul>
      {nomi.length > 0 && <p className="prova__nota">{nomi.join(', ')} sta scrivendo…</p>}
      {io ? (
        <form
          className="prova__fila"
          onSubmit={(e) => {
            e.preventDefault();
            void esegui(collegamento.comando('scrivi', { testo })).then((r) => r.ok && setTesto(''));
          }}
        >
          <input
            value={testo}
            maxLength={1000}
            onChange={(e) => {
              setTesto(e.target.value);
              collegamento.staScrivendo();
            }}
            placeholder="Scrivi qualcosa…"
          />
          <button type="submit" disabled={!testo.trim()}>
            Invia
          </button>
        </form>
      ) : (
        <p className="prova__nota">Solo i giocatori possono scrivere in chat.</p>
      )}
    </section>
  );
}
