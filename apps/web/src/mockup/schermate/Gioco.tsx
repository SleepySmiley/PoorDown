import './gioco.css';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ColonnaSinistra, Finestra, ListaImpostazioni, RigaGiocatore, Tavolo } from './Colonne';
import { Dado, Palette, Pedina, Registro, Stemma, type VoceRegistro } from './comuni';
import {
  CASELLE,
  CHAT_PARTITA,
  GIOCATORI,
  POSSESSI,
  affitti,
  costoCasa,
  euro,
  type Casella,
  type Giocatore,
  type Possesso,
} from './dati';
import { Icona } from './icone';
import { stilePopover } from './geometria';
import { SchedaProprieta, Tabellone } from './Tabellone';

type Fase = 'tira' | 'rotola' | 'decidi' | 'fine';

interface Stato {
  giocatori: Giocatore[];
  possessi: Record<number, Possesso>;
  turno: number;
  dadi: [number, number];
  giro: number;
  fase: Fase;
  doppio: boolean;
  registro: VoceRegistro[];
  passi: Record<number, number>;
  primoTiro: boolean;
  /** Quando è iniziato il turno (ms): il timer si calcola da qui. */
  inizioTurno: number;
}

let prossimoId = 100;

function voce(colore: number | undefined, testo: ReactNode): VoceRegistro {
  prossimoId += 1;
  return { id: prossimoId, colore, testo };
}

const REGISTRO_INIZIALE: VoceRegistro[] = [
  voce(4, <><b>Davide</b> pesca una Cartolina: «Aiuti un parente. Paga 50 €.»</>),
  voce(4, <><b>Davide</b> tira 6 e 5 e va alla Cartolina</>),
  voce(5, <><b>Sara</b> paga 75 € di affitto a <b>Giulia</b> per Aosta</>),
  voce(2, <><b>Marco</b> non fa un doppio e resta in prigione</>),
  voce(5, <><b>Sara</b> costruisce una casa a Venezia</>),
  voce(3, <><b>Giulia</b> passa dalla Partenza e ritira 200 €</>),
  voce(2, <><b>Marco</b> va in prigione</>),
];

function iniziale(): Stato {
  return {
    giocatori: GIOCATORI.map((g) => (g.tu ? { ...g, posizione: 23 } : { ...g })),
    possessi: { ...POSSESSI },
    turno: 0,
    dadi: [6, 5],
    giro: 0,
    fase: 'tira',
    doppio: false,
    registro: REGISTRO_INIZIALE,
    passi: {},
    primoTiro: true,
    inizioTurno: Date.now(),
  };
}

function affittoDovuto(c: Casella, p: Possesso, possessi: Record<number, Possesso>, somma: number): number {
  if (p.ipotecata) return 0;
  const stessi = (tipo: Casella['tipo']) =>
    CASELLE.filter((x) => x.tipo === tipo && possessi[x.n]?.proprietario === p.proprietario).length;
  if (c.tipo === 'citta') return affitti(c.prezzo ?? 0)[p.case ?? 0] ?? 0;
  if (c.tipo === 'stazione') return 25 * 2 ** (stessi('stazione') - 1);
  if (c.tipo === 'servizio') return (stessi('servizio') === 2 ? 10 : 4) * somma;
  return 0;
}

const nome = (g: Giocatore) => <b>{g.nome}</b>;

function formatoTempo(s: number): string {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function Timer({ secondi, totale }: { secondi: number; totale: number }): ReactNode {
  const r = 15;
  const giro = 2 * Math.PI * r;
  const poco = secondi <= 15;
  return (
    <div className={poco ? 'timer timer--poco' : 'timer'} aria-label={`Tempo rimasto ${formatoTempo(secondi)}`}>
      <svg viewBox="0 0 36 36" className="timer__anello" aria-hidden="true">
        <circle cx="18" cy="18" r={r} className="timer__fondo" />
        <circle
          cx="18"
          cy="18"
          r={r}
          className="timer__avanzamento"
          strokeDasharray={giro}
          strokeDashoffset={giro * (1 - secondi / totale)}
        />
      </svg>
      <Palette testo={formatoTempo(secondi)} />
    </div>
  );
}

export function Gioco(): ReactNode {
  const [s, setS] = useState<Stato>(iniziale);
  const rif = useRef(s);
  rif.current = s;
  const timer = useRef<number[]>([]);
  const [ora, setOra] = useState(() => Date.now());
  const [scheda, setScheda] = useState<number | null>(null);
  const [mia, setMia] = useState<{ n: number; top: number; right: number } | null>(null);
  const [impostazioni, setImpostazioni] = useState(false);
  const [bancarotta, setBancarotta] = useState(false);
  const [suggScambi, setSuggScambi] = useState(true);
  const [suggProprieta, setSuggProprieta] = useState(true);

  const aggiorna = useCallback((f: (s: Stato) => Stato) => {
    const nuovo = f(rif.current);
    rif.current = nuovo;
    setS(nuovo);
  }, []);

  const dopo = useCallback((ms: number, f: () => void) => {
    timer.current.push(window.setTimeout(f, ms));
  }, []);

  useEffect(() => () => timer.current.forEach((t) => clearTimeout(t)), []);

  // Orologio a scatti di un secondo: il timer del turno si calcola dall'inizio del turno.
  useEffect(() => {
    const t = window.setInterval(() => setOra(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const secondi = Math.max(0, 60 - Math.floor((ora - s.inizioTurno) / 1000));

  const corrente = s.giocatori[s.turno];
  const io = s.giocatori.find((g) => g.tu);
  const mioTurno = corrente?.tu === true;

  /* ---------- Svolgimento del turno ---------- */

  function termina() {
    aggiorna((st) => {
      const turno = (st.turno + 1) % st.giocatori.length;
      return { ...st, turno, fase: 'tira', doppio: false, inizioTurno: Date.now() };
    });
    const prossimo = rif.current.giocatori[rif.current.turno];
    if (prossimo && !prossimo.tu) dopo(900, () => tira());
  }

  function atterra(id: number, somma: number) {
      const st = rif.current;
      const g = st.giocatori.find((x) => x.id === id);
      if (!g) return;
      const c = CASELLE[g.posizione];
      if (!c) return;
      const voci: VoceRegistro[] = [];
      const soldi: Record<number, number> = {};
      const paga = (da: number, a: number | null, x: number) => {
        soldi[da] = (soldi[da] ?? 0) - x;
        if (a !== null) soldi[a] = (soldi[a] ?? 0) + x;
      };
      let fase: Fase = 'fine';
      let prigione = false;
      const p = st.possessi[c.n];

      if (c.tipo === 'citta' || c.tipo === 'stazione' || c.tipo === 'servizio') {
        if (!p) {
          fase = g.tu ? 'decidi' : 'fine';
        } else if (p.proprietario !== id) {
          const dovuto = affittoDovuto(c, p, st.possessi, somma);
          const prop = st.giocatori.find((x) => x.id === p.proprietario);
          if (dovuto > 0 && prop) {
            paga(id, prop.id, dovuto);
            voci.push(voce(g.colore, <>{nome(g)} paga {euro(dovuto)} di affitto a {nome(prop)} per {c.nome}</>));
          }
        }
      } else if (c.tipo === 'tassa') {
        const x = c.n === 4 ? Math.round(g.saldo * 0.1) : 75;
        paga(id, null, x);
        voci.push(voce(g.colore, <>{nome(g)} paga {euro(x)} di {c.nome.toLowerCase()}</>));
      } else if (c.tipo === 'carta') {
        const busta = c.nome === 'Busta';
        const x = busta ? 100 : -25;
        soldi[id] = (soldi[id] ?? 0) + x;
        voci.push(
          voce(
            g.colore,
            <>
              {nome(g)} pesca una {c.nome}: «{busta ? 'Rimborso delle tasse. Ricevi 100 €.' : 'Tassa sui rifiuti. Paga 25 €.'}»
            </>,
          ),
        );
      } else if (c.n === 30) {
        prigione = true;
        voci.push(voce(g.colore, <>{nome(g)} va in prigione</>));
      } else if (c.n === 20) {
        voci.push(voce(g.colore, <>{nome(g)} va in vacanza e salta il prossimo turno</>));
      } else if (c.n === 0) {
        soldi[id] = (soldi[id] ?? 0) + 100;
        voci.push(voce(g.colore, <>{nome(g)} si ferma sulla Partenza: 300 € invece di 200 €</>));
      }

      aggiorna((x) => ({
        ...x,
        fase,
        doppio: prigione ? false : x.doppio,
        registro: [...voci.reverse(), ...x.registro],
        giocatori: x.giocatori.map((y) => ({
          ...y,
          saldo: y.saldo + (soldi[y.id] ?? 0),
          ...(y.id === id && prigione ? { posizione: 10, prigione: true } : {}),
        })),
        passi: prigione ? { ...x.passi, [id]: (x.passi[id] ?? 0) + 1 } : x.passi,
      }));

      if (!g.tu) {
        dopo(1100, () => {
          if (rif.current.doppio && !prigione) tira();
          else termina();
        });
      }
  }

  function muovi(id: number, passi: number, somma: number) {
      for (let i = 1; i <= passi; i++) {
        dopo(i * 190, () => {
          aggiorna((x) => {
            const voci: VoceRegistro[] = [];
            const giocatori = x.giocatori.map((g) => {
              if (g.id !== id) return g;
              const posizione = (g.posizione + 1) % 40;
              let saldo = g.saldo;
              if (posizione === 0) {
                saldo += 200;
                voci.push(voce(g.colore, <>{nome(g)} passa dalla Partenza e ritira 200 €</>));
              }
              return { ...g, posizione, saldo };
            });
            return {
              ...x,
              giocatori,
              registro: [...voci, ...x.registro],
              passi: { ...x.passi, [id]: (x.passi[id] ?? 0) + 1 },
            };
          });
        });
      }
      dopo(passi * 190 + 250, () => atterra(id, somma));
  }

  function tira() {
    const st = rif.current;
    const g = st.giocatori[st.turno];
    if (!g) return;
    const lancio = (): [number, number] => [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
    const finale: [number, number] = g.tu && st.primoTiro ? [4, 2] : lancio();
    aggiorna((x) => ({ ...x, fase: 'rotola', giro: x.giro + 1, primoTiro: g.tu ? false : x.primoTiro }));
    // Durante il rotolamento le facce cambiano in fretta.
    for (let i = 1; i <= 6; i++) dopo(i * 95, () => aggiorna((x) => ({ ...x, dadi: lancio() })));
    dopo(700, () => {
      const [a, b] = finale;
      const doppio = a === b;
      const somma = a + b;
      if (g.prigione && !doppio) {
        aggiorna((x) => ({
          ...x,
          dadi: finale,
          doppio: false,
          registro: [voce(g.colore, <>{nome(g)} tira {a} e {b}: niente doppio, resta in prigione</>), ...x.registro],
        }));
        dopo(1000, termina);
        return;
      }
      const destinazione = CASELLE[(g.posizione + somma) % 40];
      aggiorna((x) => ({
        ...x,
        dadi: finale,
        doppio: doppio && !g.prigione,
        giocatori: x.giocatori.map((y) => (y.id === g.id ? { ...y, prigione: false } : y)),
        registro: [
          voce(
            g.colore,
            <>
              {nome(g)} tira {a} e {b}
              {doppio ? ' (doppio)' : ''} e va a {destinazione?.nome}
            </>,
          ),
          ...x.registro,
        ],
      }));
      muovi(g.id, somma, somma);
    });
  }

  const compra = () => {
    const st = rif.current;
    const g = st.giocatori[st.turno];
    const c = g ? CASELLE[g.posizione] : undefined;
    if (!g || !c?.prezzo) return;
    aggiorna((x) => ({
      ...x,
      fase: 'fine',
      possessi: { ...x.possessi, [c.n]: { proprietario: g.id } },
      giocatori: x.giocatori.map((y) => (y.id === g.id ? { ...y, saldo: y.saldo - (c.prezzo ?? 0) } : y)),
      registro: [voce(g.colore, <>{nome(g)} compra {c.nome} per {euro(c.prezzo ?? 0)}</>), ...x.registro],
    }));
  };

  /* ---------- Schede aperte ---------- */

  useEffect(() => {
    const chiudi = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('.scheda, .casella, .mie__voce')) return;
      setScheda(null);
      setMia(null);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setScheda(null);
        setMia(null);
      }
    };
    document.addEventListener('mousedown', chiudi);
    window.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', chiudi);
      window.removeEventListener('keydown', esc);
    };
  }, []);

  const casellaCorrente = corrente ? CASELLE[corrente.posizione] : undefined;
  const mie = CASELLE.filter((c) => io && s.possessi[c.n]?.proprietario === io.id);

  const costruisci = (n: number, delta: 1 | -1) => {
    const c = CASELLE[n];
    if (!c || !io) return;
    const costo = costoCasa(n);
    aggiorna((x) => {
      const p = x.possessi[n];
      if (!p) return x;
      const case_ = Math.min(5, Math.max(0, (p.case ?? 0) + delta));
      if (case_ === (p.case ?? 0)) return x;
      const importo = delta === 1 ? -costo : costo / 2;
      const testo =
        delta === 1 ? (
          <>{nome(io)} costruisce {case_ === 5 ? 'un albergo' : 'una casa'} a {c.nome}</>
        ) : (
          <>{nome(io)} vende una casa a {c.nome} per {euro(costo / 2)}</>
        );
      return {
        ...x,
        possessi: { ...x.possessi, [n]: { ...p, case: case_ } },
        giocatori: x.giocatori.map((y) => (y.id === io.id ? { ...y, saldo: y.saldo + importo } : y)),
        registro: [voce(io.colore, testo), ...x.registro],
      };
    });
  };

  const regioneCompleta = (c: Casella) =>
    c.gruppo !== undefined &&
    CASELLE.filter((x) => x.gruppo === c.gruppo).every((x) => io && s.possessi[x.n]?.proprietario === io.id);

  const popoverBordo = scheda !== null ? CASELLE[scheda] : undefined;
  const popoverMia = mia ? CASELLE[mia.n] : undefined;

  /* ---------- Centro del tabellone ---------- */

  const azioni = (() => {
    if (!corrente) return null;
    if (!mioTurno) {
      return (
        <p className="sta-giocando">
          <Pedina colore={corrente.colore} className="pedina--mini" />
          <b>{corrente.nome}</b> sta giocando…
        </p>
      );
    }
    if (s.fase === 'rotola') return <span className="centro-gioco__vuoto" />;
    const prosegui = s.doppio ? (
      <button type="button" className="pulsante pulsante--primario" onClick={tira}>
        <Icona nome="dado" />
        Tira ancora
      </button>
    ) : (
      <button type="button" className="pulsante pulsante--secondario" onClick={termina}>
        <Icona nome="spunta" />
        Termina il turno
      </button>
    );
    if (s.fase === 'tira') {
      return (
        <button type="button" className="pulsante pulsante--primario pulsante--grande" onClick={tira}>
          <Icona nome="dado" />
          Tira i dadi
        </button>
      );
    }
    if (s.fase === 'decidi' && casellaCorrente?.prezzo !== undefined) {
      const prezzo = casellaCorrente.prezzo;
      const nonBasta = (io?.saldo ?? 0) < prezzo;
      return (
        <>
          <button
            type="button"
            className="pulsante pulsante--primario"
            onClick={compra}
            disabled={nonBasta}
            title={nonBasta ? 'Non hai abbastanza soldi' : undefined}
          >
            <Icona nome="piu" />
            Compra per {euro(prezzo)}
          </button>
          {prosegui}
        </>
      );
    }
    return prosegui;
  })();

  const centro = (
    <div className="centro-gioco">
      <div className="centro-gioco__timer">
        <Timer secondi={secondi} totale={60} />
        {mioTurno && secondi <= 15 && (
          <button type="button" className="pulsante pulsante--piccolo pulsante--secondario">
            Chiedi tempo
          </button>
        )}
        {!mioTurno && secondi <= 15 && io?.host && (
          <button type="button" className="pulsante pulsante--piccolo pulsante--secondario">
            +1 minuto
          </button>
        )}
      </div>
      <div className={s.fase === 'rotola' ? 'centro-gioco__dadi centro-gioco__dadi--rotola' : 'centro-gioco__dadi'} key={s.giro}>
        <Dado valore={s.dadi[0]} />
        <Dado valore={s.dadi[1]} />
      </div>
      <div className="centro-gioco__azioni">{azioni}</div>
      <Registro voci={s.registro} />
    </div>
  );

  return (
    <>
      <Tavolo
        sinistra={<ColonnaSinistra messaggi={CHAT_PARTITA} inPartita onImpostazioni={() => setImpostazioni(true)} />}
        centro={
          <Tabellone
            possessi={s.possessi}
            pedine={s.giocatori.map((g) => ({
              id: g.id,
              colore: g.colore,
              iniziale: g.nome[0],
              posizione: g.posizione,
              prigione: g.prigione,
              passo: s.passi[g.id],
              evidenziata: g.id === corrente?.id,
            }))}
            centro={centro}
            selezionata={scheda ?? undefined}
            onApri={(n) => {
              setMia(null);
              setScheda((x) => (x === n ? null : n));
            }}
            sopra={
              popoverBordo && (
                <SchedaProprieta
                  key={popoverBordo.n}
                  c={popoverBordo}
                  possesso={s.possessi[popoverBordo.n]}
                  onChiudi={() => setScheda(null)}
                  className={stilePopover(popoverBordo.n).classe}
                  style={stilePopover(popoverBordo.n).stile}
                />
              )
            }
          />
        }
        destra={
          <>
            <section className="pannello pannello--scuro giocatori" aria-label="Giocatori">
              <ul>
                {s.giocatori.map((g, i) => (
                  <RigaGiocatore key={g.id} g={g} saldo={g.saldo} turno={i === s.turno} mostraSaldo />
                ))}
              </ul>
            </section>

            <div className="bancarotta">
              <button type="button" className="pulsante pulsante--piccolo pulsante--rosso" onClick={() => setBancarotta(true)}>
                <Icona nome="bandiera" />
                Bancarotta
              </button>
            </div>

            <section className="pannello scambi" aria-labelledby="titolo-scambi">
              <header className="pannello__testa pannello__testa--titolo-centro">
                <h2 id="titolo-scambi" className="pannello__titolo">
                  Scambi
                </h2>
                <button type="button" className="pulsante pulsante--piccolo pulsante--primario">
                  <Icona nome="piu" />
                  Crea
                </button>
              </header>
              {suggScambi && (
                <div className="consiglio">
                  <p>
                    Scambia proprietà, soldi e Carte Grazia con gli altri giocatori. Premi «Crea» per proporre uno scambio.
                  </p>
                  <button type="button" className="consiglio__ok" onClick={() => setSuggScambi(false)}>
                    <Icona nome="spunta" />
                    Ok, capito
                  </button>
                </div>
              )}
              <ul className="scambi__lista">
                <li>
                  <button type="button" className="scambio">
                    <Pedina colore={5} className="pedina--mini" />
                    Sara
                    <Icona nome="scambio" className="scambio__freccia" />
                    <Pedina colore={4} className="pedina--mini" />
                    Davide
                    <span className="scambio__stato">In trattativa</span>
                  </button>
                </li>
              </ul>
            </section>

            <section className="pannello mie" aria-labelledby="titolo-mie">
              <header className="pannello__testa pannello__testa--centrata">
                <h2 id="titolo-mie" className="pannello__titolo">
                  Le mie proprietà <span className="pannello__conta">({mie.length})</span>
                </h2>
              </header>
              <div className="pannello__scorri">
                {suggProprieta && (
                  <div className="consiglio">
                    <p>Clicca una proprietà per costruire, vendere o ipotecare.</p>
                    <button type="button" className="consiglio__ok" onClick={() => setSuggProprieta(false)}>
                      <Icona nome="spunta" />
                      Ok, capito
                    </button>
                  </div>
                )}
                <ul className="mie__lista">
                  {mie.map((c) => {
                    const p = s.possessi[c.n];
                    return (
                      <li key={c.n}>
                        <button
                          type="button"
                          className={mia?.n === c.n ? 'mie__voce mie__voce--aperta' : 'mie__voce'}
                          onClick={(e) => {
                            const r = e.currentTarget.getBoundingClientRect();
                            setScheda(null);
                            setMia((x) =>
                              x?.n === c.n ? null : { n: c.n, top: r.top, right: window.innerWidth - r.left + 12 },
                            );
                          }}
                        >
                          {c.gruppo ? (
                            <Stemma gruppo={c.gruppo} className="stemma--lista" />
                          ) : (
                            c.icona && <Icona nome={c.icona} className="mie__icona" />
                          )}
                          <span className="mie__nome">{c.nome}</span>
                          {(p?.case ?? 0) > 0 && (
                            <span className="mie__case">
                              <Icona nome={p?.case === 5 ? 'albergo' : 'casa'} />
                              {p?.case === 5 ? '' : `×${p?.case}`}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                  {(io?.grazia ?? 0) > 0 && (
                    <li>
                      <span className="mie__voce mie__voce--grazia">
                        <Icona nome="grazia" className="mie__icona" />
                        <span className="mie__nome">Carta Grazia</span>
                      </span>
                    </li>
                  )}
                </ul>
              </div>
            </section>
          </>
        }
      />

      {mia && popoverMia && (
        <SchedaProprieta
          key={`mia-${mia.n}`}
          c={popoverMia}
          possesso={s.possessi[mia.n]}
          onChiudi={() => setMia(null)}
          className="scheda--mia"
          style={{ top: Math.max(16, Math.min(mia.top - 120, window.innerHeight - 470)), right: mia.right }}
          azioni={
            popoverMia.tipo === 'citta' ? (
              <>
                <button
                  type="button"
                  className="pulsante-icona pulsante-icona--azione"
                  title={`Costruisci per ${euro(costoCasa(mia.n))}`}
                  aria-label={`Costruisci per ${euro(costoCasa(mia.n))}`}
                  disabled={!regioneCompleta(popoverMia) || (s.possessi[mia.n]?.case ?? 0) >= 5}
                  onClick={() => costruisci(mia.n, 1)}
                >
                  <Icona nome="su" />
                </button>
                <button
                  type="button"
                  className="pulsante-icona pulsante-icona--azione"
                  title={`Vendi una casa per ${euro(costoCasa(mia.n) / 2)}`}
                  aria-label="Vendi una casa"
                  disabled={(s.possessi[mia.n]?.case ?? 0) === 0}
                  onClick={() => costruisci(mia.n, -1)}
                >
                  <Icona nome="giu" />
                </button>
                <span className="scheda__azioni-spazio" />
                <button
                  type="button"
                  className="pulsante-icona pulsante-icona--azione pulsante-icona--pericolo"
                  title={`Vendi alla banca per ${euro((popoverMia.prezzo ?? 0) / 2)}`}
                  aria-label="Vendi alla banca"
                >
                  <Icona nome="cestino" />
                </button>
              </>
            ) : (
              <>
                <span className="scheda__azioni-spazio" />
                <button
                  type="button"
                  className="pulsante-icona pulsante-icona--azione pulsante-icona--pericolo"
                  title={`Vendi alla banca per ${euro((popoverMia.prezzo ?? 0) / 2)}`}
                  aria-label="Vendi alla banca"
                >
                  <Icona nome="cestino" />
                </button>
              </>
            )
          }
        />
      )}

      {impostazioni && (
        <Finestra titolo="Impostazioni della stanza" onChiudi={() => setImpostazioni(false)} larga>
          <div className="finestra__scorri">
            <p className="impostazioni__nota">Durante la partita le impostazioni non si possono cambiare.</p>
            <ListaImpostazioni modificabile={false} host={false} />
          </div>
        </Finestra>
      )}

      {bancarotta && (
        <Finestra titolo="Dichiara bancarotta" onChiudi={() => setBancarotta(false)}>
          <div className="finestra__corpo">
            <p>Lasci la partita e le tue proprietà tornano alla banca. Non si può annullare.</p>
          </div>
          <div className="finestra__azioni">
            <button type="button" className="pulsante pulsante--fantasma" onClick={() => setBancarotta(false)}>
              Annulla
            </button>
            <button type="button" className="pulsante pulsante--rosso" onClick={() => setBancarotta(false)}>
              <Icona nome="bandiera" />
              Dichiara bancarotta
            </button>
          </div>
        </Finestra>
      )}
    </>
  );
}
