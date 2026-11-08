/*
 * Squadre in lobby: i giocatori divisi per squadra. Ognuno entra nella squadra che vuole («Entra»);
 * l'host può rinominare le squadre, spostare chiunque (bot compresi) e rifarle a sorte con «Mescola».
 * Si vedono le squadre in uso più una vuota da aprire, fino a quattro.
 */

import '../stili/squadre.css';
import { useState, type ReactNode } from 'react';
import { NOME_SQUADRA_MAX, SQUADRE_MAX, type IdGiocatore, type Partecipante, type VistaStanza } from '@poordown/engine';
import { collegamento } from '../rete/sessione';
import { avvisa } from '../ui/avvisi';
import { PulsanteIcona } from '../ui/comuni';
import { Icona } from '../ui/icone';
import { Binario, RigaGiocatore } from './Colonne';

const TUTTE = Array.from({ length: SQUADRE_MAX }, (_, i) => i);

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
        {modificabile && <PulsanteIcona icona="matita" etichetta={`Rinomina ${nome}`} onClick={() => setTesto(nome)} />}
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
            <li key={t} className="squadra">
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
                <p className="squadra__vuota">Ancora nessuno: entra per aprire questa squadra.</p>
              ) : (
                <ul>
                  {membri.map((p) => (
                    <RigaGiocatore
                      key={p.id}
                      g={{ id: p.id, nome: p.nome, colore: p.colore, connesso: p.connesso, bot: p.bot, host: p.id === stanza.host, tu: p.id === io }}
                      puoEspellere={sonoHost}
                      onEspelli={() => onEspelli(p)}
                      onCambiaColore={onCambiaColore}
                      extra={
                        sonoHost && (
                          <span className="squadra__sposta" role="group" aria-label={`Sposta ${p.nome} in un’altra squadra`}>
                            {mostrate
                              .filter((x) => x !== t)
                              .map((x) => {
                                const etichetta = `Sposta ${p.nome} in ${stanza.squadre[x] ?? `Squadra ${x + 1}`}`;
                                return (
                                  <button
                                    key={x}
                                    type="button"
                                    className="binario binario--riga binario--azione"
                                    title={etichetta}
                                    aria-label={etichetta}
                                    onClick={() => esegui(collegamento.comando('squadra', { squadra: x, giocatore: p.id }))}
                                  >
                                    {x + 1}
                                  </button>
                                );
                              })}
                          </span>
                        )
                      }
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
          className="pulsante pulsante--piccolo pulsante--secondario squadre__mescola"
          onClick={() => esegui(collegamento.comando('mescola_squadre', {}))}
        >
          <Icona nome="mescola" />
          Mescola le squadre
        </button>
      )}
    </div>
  );
}
