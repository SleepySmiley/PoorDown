import '../stili/lobby.css';
import { useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  COLORI,
  GIOCATORI_MIN,
  type IdGiocatore,
  type Impostazioni,
  type MessaggioChat,
  type Partecipante,
  type VistaStanza,
  type VoceRegistro,
} from '@poordown/engine';
import { collegamento, preferenze } from '../rete/sessione';
import { avvisa } from '../ui/avvisi';
import { Chip } from '../ui/Chip';
import { Dado, Pedina, Registro } from '../ui/comuni';
import { Icona } from '../ui/icone';
import { COMPARSA } from '../ui/movimento';
import { Pannello } from '../ui/Pannello';
import { variabili, iniziale } from '../ui/utili';
import { ColonnaSinistra, Finestra, RigaGiocatore, Tavolo } from './Colonne';
import { ListaImpostazioni } from './Impostazioni';
import { PannelloSquadre } from './Squadre';
import { Tabellone } from './Tabellone';
import { SceltaTabellone } from './Tabelloni';
import { righeRegistro } from './testi';

const TUTTI_I_COLORI = Array.from({ length: COLORI }, (_, i) => i + 1);

function SceltaColore({
  presi,
  scelto,
  onScegli,
}: {
  presi: number[];
  scelto: number | null;
  onScegli: (c: number) => void;
}): ReactNode {
  return (
    <div className="scelta-colore__griglia" role="radiogroup" aria-label="Colore della pedina">
      {TUTTI_I_COLORI.map((c) => {
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

/** Il colore proposto a chi arriva: l'ultimo usato se è libero, altrimenti il primo libero. */
function colorePreferito(presi: number[]): number | null {
  const ultimo = preferenze.colore();
  if (ultimo !== null && !presi.includes(ultimo)) return ultimo;
  return TUTTI_I_COLORI.find((c) => !presi.includes(c)) ?? null;
}

/** Chi è appena arrivato sceglie il colore e si siede al tavolo. */
function Ingresso({ stanza }: { stanza: VistaStanza }): ReactNode {
  const presi = stanza.partecipanti.map((p) => p.colore);
  const [scelta, setScelta] = useState<number | null>(() => colorePreferito(presi));
  const [invio, setInvio] = useState(false);
  const colorePreso = scelta !== null && presi.includes(scelta);
  // Se qualcuno si siede con il colore che stavo scegliendo, se ne propone un altro.
  const scelto = colorePreso ? colorePreferito(presi) : scelta;

  useEffect(() => {
    if (colorePreso) avvisa('Un altro giocatore ha appena preso il colore che avevi scelto: scegline un altro.');
  }, [colorePreso]);

  return (
    <form
      className="scelta-colore"
      onSubmit={(e) => {
        e.preventDefault();
        if (scelto === null || invio) return;
        setInvio(true);
        preferenze.salvaColore(scelto);
        void collegamento.comando('siediti', { nome: preferenze.nome(), colore: scelto }).then((r) => {
          setInvio(false);
          if (!r.ok) avvisa(r.messaggio, 'errore');
        });
      }}
    >
      <p className="scelta-colore__titolo">Scegli il colore della pedina:</p>
      <SceltaColore presi={presi} scelto={scelto} onScegli={setScelta} />
      <button type="submit" className="pulsante pulsante--primario" disabled={scelto === null || invio}>
        Entra nella partita
        <Icona nome="avanti" />
      </button>
    </form>
  );
}

function motivoBlocco(stanza: VistaStanza): string | null {
  const n = stanza.partecipanti.length;
  if (n < GIOCATORI_MIN) return 'Servono almeno due giocatori per iniziare.';
  if (n > stanza.impostazioni.giocatoriMax) {
    return 'Ci sono più giocatori del massimo scelto: alza «Giocatori massimi» o espelli qualcuno.';
  }
  if (stanza.impostazioni.squadre && new Set(stanza.partecipanti.map((p) => p.squadra)).size < 2) {
    return 'Servono almeno due squadre con almeno un giocatore ciascuna.';
  }
  return null;
}

export function Lobby({
  stanza,
  io,
  registro,
  chat,
  scrivono,
  onEsci,
}: {
  stanza: VistaStanza;
  io: IdGiocatore | null;
  registro: VoceRegistro[];
  chat: MessaggioChat[];
  scrivono: IdGiocatore[];
  onEsci: () => void;
}): ReactNode {
  const seduto = io !== null;
  const sonoHost = seduto && io === stanza.host;
  const [daEspellere, setDaEspellere] = useState<Partecipante | null>(null);
  const [popoverColore, setPopoverColore] = useState(false);
  const [avvio, setAvvio] = useState(false);
  const [tabelloni, setTabelloni] = useState(false);
  const nomeHost = stanza.partecipanti.find((p) => p.id === stanza.host)?.nome;
  const presiDaAltri = stanza.partecipanti.filter((p) => p.id !== io).map((p) => p.colore);
  const mioColore = stanza.partecipanti.find((p) => p.id === io)?.colore ?? null;
  const blocco = motivoBlocco(stanza);
  const righe = righeRegistro(registro, stanza, Infinity, `Sei entrato nella stanza ${stanza.codice.toUpperCase()}.`);

  const comando = (promessa: Promise<{ ok: boolean; messaggio?: string }>) =>
    void promessa.then((r) => {
      if (!r.ok && r.messaggio) avvisa(r.messaggio, 'errore');
    });

  const cambiaImpostazioni = (modifiche: Partial<Impostazioni>) =>
    comando(collegamento.comando('impostazioni', modifiche));

  const dadi = (
    <div className="centro-lobby__dadi">
      <Dado valore={5} />
      <Dado valore={2} />
    </div>
  );

  const centro = !seduto ? (
    <Ingresso stanza={stanza} />
  ) : sonoHost ? (
    <div className="centro-lobby">
      {dadi}
      <span className="con-suggerimento" data-testo={blocco ?? undefined}>
        <button
          type="button"
          className="pulsante pulsante--primario pulsante--grande"
          disabled={blocco !== null || avvio}
          onClick={() => {
            setAvvio(true);
            void collegamento.comando('avvia', {}).then((r) => {
              setAvvio(false);
              if (!r.ok) avvisa(r.messaggio, 'errore');
            });
          }}
        >
          <Icona nome="avanti" />
          Inizia la partita
        </button>
      </span>
      {blocco && <p className="centro-lobby__avviso">{blocco}</p>}
      <Registro righe={righe} />
    </div>
  ) : (
    <div className="centro-lobby">
      {dadi}
      <p className="centro-lobby__attesa">
        In attesa che <b>{nomeHost ?? 'l’host'}</b> inizi la partita…
      </p>
      <Registro righe={righe} />
    </div>
  );

  // Chi guarda una stanza piena vede il tabellone senza velo, con il registro.
  // Se al tavolo ci sono bot non è piena: chi arriva prende il posto di un bot.
  const piena = stanza.partecipanti.length >= stanza.impostazioni.giocatoriMax && !stanza.partecipanti.some((p) => p.bot);

  return (
    <>
      <Tavolo
        sinistra={<ColonnaSinistra stanza={stanza} io={io} chat={chat} scrivono={scrivono} onEsci={onEsci} />}
        centro={
          <Tabellone
            mappa={stanza.impostazioni.mappa}
            partita={null}
            pedine={stanza.partecipanti.map((p) => ({ id: p.id, colore: p.colore, iniziale: iniziale(p.nome), posizione: 0 }))}
            centro={
              !seduto && piena ? (
                <SpettatoreLobby stanza={stanza} righe={righe} onEsci={onEsci} />
              ) : (
                centro
              )
            }
            sfocato={!seduto && !piena}
          />
        }
        destra={
          <>
            <section className="pannello pannello--scuro giocatori" aria-label="Giocatori">
              {stanza.partecipanti.length === 0 ? (
                <div className="lobby-vuota" role="status">
                  <Icona nome="persone" />
                  <p>
                    <b>Nessuno al tavolo, per ora</b>
                    Chi apre il link della stanza si siede qui.
                  </p>
                </div>
              ) : stanza.impostazioni.squadre ? (
                <PannelloSquadre
                  stanza={stanza}
                  io={io}
                  onEspelli={setDaEspellere}
                  onCambiaColore={() => setPopoverColore((x) => !x)}
                />
              ) : (
                <ul>
                  {stanza.partecipanti.map((p) => (
                    <RigaGiocatore
                      key={p.id}
                      g={{
                        id: p.id,
                        nome: p.nome,
                        colore: p.colore,
                        connesso: p.connesso,
                        bot: p.bot,
                        host: p.id === stanza.host,
                        tu: p.id === io,
                      }}
                      puoEspellere={sonoHost}
                      onEspelli={() => setDaEspellere(p)}
                      onCambiaColore={() => setPopoverColore((x) => !x)}
                    />
                  ))}
                </ul>
              )}
              <AnimatePresence>
                {popoverColore && seduto && (
                  <motion.div key="colori" className="popover-colori" {...COMPARSA}>
                    <p>Cambia colore</p>
                    <SceltaColore
                      presi={presiDaAltri}
                      scelto={mioColore}
                      onScegli={(c) => {
                        setPopoverColore(false);
                        preferenze.salvaColore(c);
                        comando(collegamento.comando('cambia_colore', { colore: c }));
                      }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
            <Pannello titolo="Impostazioni di gioco" className="pannello--impostazioni">
              <div className="pannello__scorri">
                {!sonoHost && (
                  <p className="impostazioni__blocco">
                    <Chip icona="lucchetto" title={nomeHost ? `L’host della stanza è ${nomeHost}` : undefined}>
                      Solo l’host può cambiarle
                    </Chip>
                  </p>
                )}
                <ListaImpostazioni
                  imp={stanza.impostazioni}
                  modificabile={sonoHost}
                  onCambia={cambiaImpostazioni}
                  onTabelloni={() => setTabelloni(true)}
                />
              </div>
            </Pannello>
          </>
        }
      />
      <AnimatePresence>
        {tabelloni && (
          <SceltaTabellone
            key="tabelloni"
            attuale={stanza.impostazioni.mappa}
            modificabile={sonoHost}
            onScegli={(mappa) => {
              cambiaImpostazioni({ mappa });
              setTabelloni(false);
            }}
            onChiudi={() => setTabelloni(false)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {daEspellere && (
          <Finestra key="espelli" titolo="Espelli giocatore" tono="pericolo" onChiudi={() => setDaEspellere(null)}>
            <div className="finestra__corpo">
              <p className="espelli">
                <Pedina colore={daEspellere.colore} iniziale={iniziale(daEspellere.nome)} className="pedina--media" />
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
                  comando(collegamento.comando('espelli', { giocatore: daEspellere.id }));
                  setDaEspellere(null);
                }}
              >
                Espelli
              </button>
            </div>
          </Finestra>
        )}
      </AnimatePresence>
    </>
  );
}

/** Stanza piena: chi non è seduto può scegliere di guardare, poi vede il registro della lobby. */
function SpettatoreLobby({
  stanza,
  righe,
  onEsci,
}: {
  stanza: VistaStanza;
  righe: ReturnType<typeof righeRegistro>;
  onEsci: () => void;
}): ReactNode {
  const [guarda, setGuarda] = useState(false);
  if (!guarda) {
    return (
      <div className="stanza-piena">
        <p className="stanza-piena__titolo">La stanza è piena.</p>
        <p className="stanza-piena__testo">Puoi guardare la partita, oppure tornare alla home e cercarne un’altra.</p>
        <div className="stanza-piena__azioni">
          <button type="button" className="pulsante pulsante--primario" onClick={() => setGuarda(true)}>
            <Icona nome="occhio" />
            Guarda la partita
          </button>
          <button type="button" className="pulsante pulsante--secondario" onClick={onEsci}>
            <Icona nome="partenza" />
            Torna alla home
          </button>
        </div>
      </div>
    );
  }
  const nomeHost = stanza.partecipanti.find((p) => p.id === stanza.host)?.nome;
  return (
    <div className="centro-lobby">
      <div className="centro-lobby__dadi">
        <Dado valore={5} />
        <Dado valore={2} />
      </div>
      <p className="centro-lobby__attesa">
        Stai guardando. In attesa che <b>{nomeHost ?? 'l’host'}</b> inizi la partita…
      </p>
      <Registro righe={righe} />
    </div>
  );
}
