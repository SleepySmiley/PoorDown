/*
 * Squadre in lobby: i giocatori divisi per squadra. Ognuno entra nella squadra che vuole («Entra»);
 * l'host può rinominare le squadre, spostare chiunque (bot compresi) con il menu «⋯» della riga
 * e rifarle a sorte con «Mescola». Si vedono le squadre in uso più una vuota da aprire, fino a quattro.
 * I nomi restano interi: i comandi della riga stanno tutti nel menu.
 */

import '../stili/squadre.css';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { NOME_SQUADRA_MAX, SQUADRE_MAX, type IdGiocatore, type Partecipante, type VistaStanza } from '@poordown/engine';
import { collegamento } from '../rete/sessione';
import { avvisa } from '../ui/avvisi';
import { Chip } from '../ui/Chip';
import { Pedina, PulsanteIcona } from '../ui/comuni';
import { Icona, type NomeIcona } from '../ui/icone';
import { COMPARSA } from '../ui/movimento';
import { iniziale } from '../ui/utili';
import { Binario } from './Colonne';

const TUTTE = Array.from({ length: SQUADRE_MAX }, (_, i) => i);

const SPIEGA_BOT = 'Bot: gioca da solo. Compra, costruisce, offre alle aste e risponde agli scambi; in chat non scrive.';

function esegui(promessa: Promise<{ ok: boolean; messaggio?: string }>): void {
  void promessa.then((r) => {
    if (!r.ok && r.messaggio) avvisa(r.messaggio, 'errore');
  });
}

/** Le squadre da mostrare: quelle in uso, più la prima libera (per aprirne una nuova), e sempre almeno due. */
function squadreDaMostrare(partecipanti: readonly Partecipante[]): number[] {
  const usate = TUTTE.filter((t) => partecipanti.some((p) => p.squadra === t));
  const mostrate = [...usate];
  for (const t of TUTTE) {
    if (mostrate.length >= Math.max(2, usate.length + 1)) break;
    if (!mostrate.includes(t)) mostrate.push(t);
  }
  return mostrate.sort((a, b) => a - b);
}

function NomeSquadra({
  indice,
  nome,
  modificabile,
}: {
  indice: number;
  nome: string;
  modificabile: boolean;
}): ReactNode {
  const [testo, setTesto] = useState<string | null>(null);
  if (testo === null) {
    return (
      <>
        <h3 className="squadra__nome">{nome}</h3>
        {modificabile && (
          <PulsanteIcona icona="matita" etichetta={`Rinomina ${nome}`} misura="piccolo" onClick={() => setTesto(nome)} />
        )}
      </>
    );
  }
  const salva = () => {
    if (testo.trim() !== nome) esegui(collegamento.comando('nome_squadra', { squadra: indice, nome: testo }));
    setTesto(null);
  };
  return (
    <form
      className="squadra__rinomina"
      onSubmit={(e) => {
        e.preventDefault();
        salva();
      }}
    >
      <label className="solo-lettori" htmlFor={`nome-squadra-${indice}`}>
        Nome della squadra {indice + 1}
      </label>
      <input
        id={`nome-squadra-${indice}`}
        value={testo}
        maxLength={NOME_SQUADRA_MAX}
        autoFocus
        autoComplete="off"
        onChange={(e) => setTesto(e.target.value)}
        onBlur={salva}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            setTesto(null);
          }
        }}
      />
    </form>
  );
}

/* ---------------- Menu della riga ---------------- */

interface VoceMenu {
  chiave: string;
  testo: string;
  icona?: NomeIcona;
  /** Al posto dell'icona: il numero della squadra. */
  squadra?: number;
  pericolo?: boolean;
  onScegli: () => void;
}

/** Il menu «⋯» di una riga: si chiude scegliendo, con Esc o cliccando fuori. */
function MenuRiga({ etichetta, gruppi }: { etichetta: string; gruppi: { titolo?: string; voci: VoceMenu[] }[] }): ReactNode {
  const [aperto, setAperto] = useState(false);
  const contenitore = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!aperto) return;
    const fuori = (e: PointerEvent) => {
      if (!contenitore.current?.contains(e.target as Node)) setAperto(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setAperto(false);
      }
    };
    document.addEventListener('pointerdown', fuori);
    window.addEventListener('keydown', esc, true);
    return () => {
      document.removeEventListener('pointerdown', fuori);
      window.removeEventListener('keydown', esc, true);
    };
  }, [aperto]);
  return (
    <span className="menu-riga" ref={contenitore}>
      <button
        type="button"
        className="pulsante-icona pulsante-icona--piccolo menu-riga__apri"
        aria-label={etichetta}
        title={etichetta}
        aria-haspopup="menu"
        aria-expanded={aperto}
        onClick={() => setAperto((x) => !x)}
      >
        <svg className="icona" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
          <circle cx="5.5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="18.5" cy="12" r="1.8" />
        </svg>
      </button>
      <AnimatePresence>
        {aperto && (
          <motion.div key="menu" className="menu-riga__elenco popover" role="menu" aria-label={etichetta} {...COMPARSA}>
            {gruppi.map((g, i) => (
              <div key={i} className="menu-riga__gruppo" role="group" aria-label={g.titolo}>
                {g.titolo && <p className="menu-riga__titolo">{g.titolo}</p>}
                {g.voci.map((v) => (
                  <button
                    key={v.chiave}
                    type="button"
                    role="menuitem"
                    className={v.pericolo ? 'menu-riga__voce menu-riga__voce--pericolo' : 'menu-riga__voce'}
                    onClick={() => {
                      setAperto(false);
                      v.onScegli();
                    }}
                  >
                    {v.squadra !== undefined ? (
                      <Binario indice={v.squadra} nome={v.testo} className="binario--riga" />
                    ) : (
                      v.icona && <Icona nome={v.icona} />
                    )}
                    <span>{v.testo}</span>
                  </button>
                ))}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}

/* ---------------- Un giocatore della squadra ---------------- */

function Membro({
  p,
  stanza,
  io,
  mostrate,
  onEspelli,
  onCambiaColore,
}: {
  p: Partecipante;
  stanza: VistaStanza;
  io: IdGiocatore | null;
  mostrate: number[];
  onEspelli: (p: Partecipante) => void;
  onCambiaColore: () => void;
}): ReactNode {
  const sonoHost = io !== null && io === stanza.host;
  const tu = p.id === io;
  const host = p.id === stanza.host;
  const gruppi: { titolo?: string; voci: VoceMenu[] }[] = [];
  if (sonoHost && !tu) {
    gruppi.push({
      titolo: 'Sposta in squadra',
      voci: mostrate
        .filter((t) => t !== p.squadra)
        .map((t) => ({
          chiave: `squadra-${t}`,
          testo: stanza.squadre[t] ?? `Squadra ${t + 1}`,
          squadra: t,
          onScegli: () => esegui(collegamento.comando('squadra', { squadra: t, giocatore: p.id })),
        })),
    });
  }
  if (tu) gruppi.push({ voci: [{ chiave: 'colore', testo: 'Cambia colore', icona: 'regolazioni', onScegli: onCambiaColore }] });
  if (sonoHost && !tu) {
    gruppi.push({
      voci: [{ chiave: 'espelli', testo: `Espelli ${p.bot ? 'il bot' : p.nome}`, icona: 'chiudi', pericolo: true, onScegli: () => onEspelli(p) }],
    });
  }
  const classi = ['membro', tu ? 'membro--tu' : '', p.connesso ? '' : 'membro--assente'].filter(Boolean).join(' ');
  return (
    <li className={classi}>
      <Pedina colore={p.colore} iniziale={iniziale(p.nome)} className="pedina--media" />
      <span className="membro__dati">
        <span className="membro__nome">
          {p.nome}
          {tu && <span className="solo-lettori"> (tu)</span>}
        </span>
        {(host || tu || p.bot || !p.connesso) && (
          <span className="membro__chip">
            {host && (
              <Chip icona="corona" className="membro__host">
                Host
              </Chip>
            )}
            {tu && <Chip>Tu</Chip>}
            {p.bot && (
              <Chip icona="robot" title={SPIEGA_BOT}>
                Bot
              </Chip>
            )}
            {!p.connesso && !p.bot && (
              <Chip tono="rosso" icona="scollegato">
                Assente
              </Chip>
            )}
          </span>
        )}
      </span>
      {gruppi.length > 0 && <MenuRiga etichetta={tu ? 'Le tue opzioni' : `Opzioni per ${p.nome}`} gruppi={gruppi} />}
    </li>
  );
}

/* ---------------- Il pannello ---------------- */

export function PannelloSquadre({
  stanza,
  io,
  onEspelli,
  onCambiaColore,
}: {
  stanza: VistaStanza;
  io: IdGiocatore | null;
  onEspelli: (p: Partecipante) => void;
  onCambiaColore: () => void;
}): ReactNode {
  const sonoHost = io !== null && io === stanza.host;
  const mia = stanza.partecipanti.find((p) => p.id === io)?.squadra ?? null;
  const mostrate = squadreDaMostrare(stanza.partecipanti);
  return (
    <div className="squadre">
      <ol className="squadre__elenco">
        {mostrate.map((t) => {
          const nome = stanza.squadre[t] ?? `Squadra ${t + 1}`;
          const membri = stanza.partecipanti.filter((p) => p.squadra === t);
          return (
            <li key={t} className={mia === t ? 'squadra squadra--mia' : 'squadra'}>
              <header className="squadra__testa">
                <Binario indice={t} nome={nome} />
                <NomeSquadra key={nome} indice={t} nome={nome} modificabile={sonoHost} />
                {io !== null && mia !== t && (
                  <button
                    type="button"
                    className="pulsante pulsante--piccolo pulsante--secondario squadra__entra"
                    onClick={() => esegui(collegamento.comando('squadra', { squadra: t }))}
                  >
                    Entra
                  </button>
                )}
              </header>
              {membri.length === 0 ? (
                <p className="squadra__vuota">Nessuno, per ora.</p>
              ) : (
                <ul className="squadra__membri">
                  {membri.map((p) => (
                    <Membro
                      key={p.id}
                      p={p}
                      stanza={stanza}
                      io={io}
                      mostrate={mostrate}
                      onEspelli={onEspelli}
                      onCambiaColore={onCambiaColore}
                    />
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
      {sonoHost && (
        <button
          type="button"
          className="pulsante pulsante--piccolo pulsante--sul-quadro squadre__mescola"
          onClick={() => esegui(collegamento.comando('mescola_squadre', {}))}
        >
          <Icona nome="mescola" />
          Mescola le squadre
        </button>
      )}
    </div>
  );
}
