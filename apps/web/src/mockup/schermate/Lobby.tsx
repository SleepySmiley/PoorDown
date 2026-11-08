import './lobby.css';
import { useState, type ReactNode } from 'react';
import { ColonnaSinistra, Finestra, ListaImpostazioni, RigaGiocatore, Tavolo } from './Colonne';
import { Dado, Pedina, Registro, type Messaggio, type VoceRegistro } from './comuni';
import { variabili } from './utili';
import { GIOCATORI, type Giocatore } from './dati';
import { Icona } from './icone';
import { Tabellone } from './Tabellone';

const COLORI = Array.from({ length: 12 }, (_, i) => i + 1);

const CHAT_LOBBY: Messaggio[] = [
  { autore: 1, testo: 'Ci sono' },
  { autore: 2, testo: 'Anch’io, partiamo?' },
  { autore: 0, testo: 'Aspettiamo ancora un minuto Davide' },
];

function SceltaColore({
  presi,
  scelto,
  onScegli,
}: {
  presi: number[];
  scelto: number;
  onScegli: (c: number) => void;
}): ReactNode {
  return (
    <div className="scelta-colore__griglia" role="radiogroup" aria-label="Colore della pedina">
      {COLORI.map((c) => {
        const preso = presi.includes(c);
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={c === scelto}
            aria-label={preso ? `Colore ${c}, già preso` : `Colore ${c}`}
            disabled={preso}
            className="colore-pedina"
            style={variabili({ '--colore': `var(--p${c})` })}
            onClick={() => onScegli(c)}
          />
        );
      })}
    </div>
  );
}

export function Lobby({ vista }: { vista: 'host' | 'ospite' }): ReactNode {
  const host = vista === 'host';
  const [giocatori, setGiocatori] = useState<Giocatore[]>(() =>
    GIOCATORI.slice(0, 3).map((g) => ({ ...g, tu: host && g.tu, prigione: false })),
  );
  const [entrato, setEntrato] = useState(host);
  const [colore, setColore] = useState(7);
  const [daEspellere, setDaEspellere] = useState<Giocatore | null>(null);
  const [popoverColore, setPopoverColore] = useState(false);
  const [registro, setRegistro] = useState<VoceRegistro[]>([
    { id: 3, colore: 5, testo: <><b>Sara</b> entra nella partita</> },
    { id: 2, colore: 2, testo: <><b>Marco</b> entra nella partita</> },
    { id: 1, testo: 'Ingresso nella stanza K7Q2M' },
  ]);

  const aggiungi = (v: Omit<VoceRegistro, 'id'>) => setRegistro((r) => [{ ...v, id: Date.now() }, ...r]);
  const presi = giocatori.filter((g) => !g.tu).map((g) => g.colore);
  const pochi = giocatori.length < 2;

  const entra = () => {
    setEntrato(true);
    setGiocatori((gs) => [...gs, { id: 9, nome: 'Luca', colore, saldo: 1500, posizione: 0, tu: true }]);
    aggiungi({ colore, testo: <><b>Luca</b> entra nella partita</> });
  };

  const centroHost = (
    <div className="centro-lobby">
      <div className="centro-lobby__dadi">
        <Dado valore={5} />
        <Dado valore={2} />
      </div>
      <button type="button" className="pulsante pulsante--primario pulsante--grande" disabled={pochi}>
        <Icona nome="avanti" />
        Inizia la partita
      </button>
      {pochi && <p className="centro-lobby__avviso">Servono almeno due giocatori per iniziare.</p>}
      <Registro voci={registro} />
    </div>
  );

  const nomeHost = giocatori.find((g) => g.host)?.nome ?? 'l’host';
  const centroOspite = entrato ? (
    <div className="centro-lobby">
      <div className="centro-lobby__dadi">
        <Dado valore={5} />
        <Dado valore={2} />
      </div>
      <p className="centro-lobby__attesa">
        In attesa che <b>{nomeHost}</b> inizi la partita…
      </p>
      <Registro voci={registro} />
    </div>
  ) : (
    <div className="scelta-colore">
      <p className="scelta-colore__titolo">Scegli il colore della pedina:</p>
      <SceltaColore presi={presi} scelto={colore} onScegli={setColore} />
      <button type="button" className="pulsante pulsante--primario" onClick={entra}>
        Entra nella partita
        <Icona nome="avanti" />
      </button>
    </div>
  );

  return (
    <>
      <Tavolo
        sinistra={<ColonnaSinistra messaggi={CHAT_LOBBY} chatSolaLettura={!entrato} />}
        centro={
          <Tabellone
            possessi={{}}
            pedine={giocatori.map((g) => ({ id: g.id, colore: g.colore, iniziale: g.nome[0], posizione: 0 }))}
            centro={host ? centroHost : centroOspite}
            sfocato={!entrato}
          />
        }
        destra={
          <>
            <section className="pannello pannello--scuro giocatori" aria-label="Giocatori">
              {giocatori.length === 0 ? (
                <p className="giocatori__vuoto">In attesa di giocatori…</p>
              ) : (
                <ul>
                  {giocatori.map((g) => (
                    <RigaGiocatore
                      key={g.id}
                      g={g}
                      puoEspellere={host}
                      onEspelli={() => setDaEspellere(g)}
                      onCambiaColore={() => setPopoverColore((p) => !p)}
                    />
                  ))}
                </ul>
              )}
              {popoverColore && (
                <div className="popover-colori">
                  <p>Cambia colore</p>
                  <SceltaColore
                    presi={presi}
                    scelto={giocatori.find((g) => g.tu)?.colore ?? 0}
                    onScegli={(c) => {
                      setGiocatori((gs) => gs.map((g) => (g.tu ? { ...g, colore: c } : g)));
                      setPopoverColore(false);
                    }}
                  />
                </div>
              )}
            </section>
            <section className="pannello pannello--impostazioni" aria-labelledby="titolo-impostazioni">
              <header className="pannello__testa pannello__testa--centrata">
                <h2 id="titolo-impostazioni" className="pannello__titolo">
                  Impostazioni di gioco
                </h2>
              </header>
              <div className="pannello__scorri">
                {!host && <p className="impostazioni__nota">Solo {nomeHost}, che ha creato la stanza, può cambiarle.</p>}
                <ListaImpostazioni modificabile={host} host={host} />
              </div>
            </section>
          </>
        }
      />
      {daEspellere && (
        <Finestra titolo="Espelli giocatore" onChiudi={() => setDaEspellere(null)}>
          <div className="finestra__corpo">
            <p className="espelli">
              <Pedina colore={daEspellere.colore} iniziale={daEspellere.nome[0]} className="pedina--media" />
              <span>
                Vuoi davvero espellere <b>{daEspellere.nome}</b>? Non si può annullare.
              </span>
            </p>
          </div>
          <div className="finestra__azioni">
            <button type="button" className="pulsante pulsante--fantasma" onClick={() => setDaEspellere(null)}>
              Annulla
            </button>
            <button
              type="button"
              className="pulsante pulsante--rosso"
              onClick={() => {
                const g = daEspellere;
                setGiocatori((gs) => gs.filter((x) => x.id !== g.id));
                aggiungi({ colore: g.colore, testo: <>Espulsione: <b>{g.nome}</b> lascia la stanza</> });
                setDaEspellere(null);
              }}
            >
              Espelli
            </button>
          </div>
        </Finestra>
      )}
    </>
  );
}
