/* I giocatori della partita: nome, soldi, casella, prigione, vacanza, carte Grazia, turno e uscita. */

import type { ReactNode } from 'react';
import { euro, patrimonio, tabellone, type DettaglioPannello, type Giocatore, type NomeMazzo, type Stato } from '@poordown/engine';
import { Chip } from '../ui/Chip';
import { Pulsante } from '../ui/Pulsante';
import { Interruttore, Pedina } from '../ui/comuni';
import { CampoNome, CampoNumero, PulsanteConferma } from './campi';
import type { Esegui } from './Plancia';

const MOTIVI = {
  bancarotta: 'bancarotta',
  tempo: 'tempo scaduto',
  assenza: 'assenza',
  voto: 'voto',
  espulsione: 'tolto',
} as const;

/** Di quanto cambiano il saldo i tasti rapidi. */
const PASSI = [-500, -100, 100, 500] as const;

export function GiocatoriPartita({ d, partita, esegui }: { d: DettaglioPannello; partita: Stato; esegui: Esegui }): ReactNode {
  const tab = tabellone(partita.mappa);
  const inCorso = partita.fase === 'in_corso' && d.fase === 'partita';
  const blocco = inCorso ? undefined : true;
  return (
    <div className="pc-tabella-scorre">
      <table className="pc-tabella pc-giocatori">
        <thead>
          <tr>
            <th scope="col">Giocatore</th>
            <th scope="col">Saldo</th>
            <th scope="col">Casella</th>
            <th scope="col">Prigione</th>
            <th scope="col">Vacanza</th>
            <th scope="col">Carte Grazia</th>
            <th scope="col">
              <span className="solo-lettori">Azioni</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {partita.giocatori.map((g) => {
            const posto = d.posti.find((p) => p.id === g.id);
            const diTurno = partita.turno.giocatore === g.id && inCorso;
            if (g.eliminato) {
              return (
                <tr key={g.id} className="pc-giocatore pc-giocatore--fuori">
                  <td>
                    <span className="pc-giocatore__chi">
                      <Pedina colore={g.colore} className="pedina--media" />
                      <span className="pc-giocatore__nome-fisso">{g.nome}</span>
                    </span>
                  </td>
                  <td colSpan={6} className="pc-giocatore__fuori">
                    Fuori dalla partita al turno {g.eliminato.turno} ({MOTIVI[g.eliminato.motivo]})
                  </td>
                </tr>
              );
            }
            return (
              <tr key={g.id} className={diTurno ? 'pc-giocatore pc-giocatore--turno' : 'pc-giocatore'}>
                <td>
                  <span className="pc-giocatore__chi">
                    <Pedina colore={g.colore} className="pedina--media" />
                    <span className="pc-giocatore__testo">
                      <CampoNome
                        valore={g.nome}
                        etichetta={`Nome di ${g.nome}`}
                        onSalva={(nome) => esegui({ tipo: 'nome', giocatore: g.id, nome }, `Ora si chiama ${nome}.`)}
                      />
                      <span className="pc-giocatore__chip">
                        {diTurno && <Chip tono="ambra">Di turno</Chip>}
                        {g.id === d.host && <Chip tono="segnale">Host</Chip>}
                        {posto?.bot && <Chip icona="robot">Bot</Chip>}
                        {posto && !posto.bot && !posto.connesso && <Chip tono="rosso">Scollegato</Chip>}
                      </span>
                      <span className="pc-giocatore__nota">Patrimonio {euro(patrimonio(partita, g.id))}</span>
                    </span>
                  </span>
                </td>
                <td>
                  <span className="pc-saldo">
                    <CampoNumero
                      valore={g.saldo}
                      etichetta={`Saldo di ${g.nome}`}
                      disattivo={blocco}
                      onSalva={(saldo) => esegui({ tipo: 'saldo', giocatore: g.id, saldo }, `Saldo di ${g.nome}: ${euro(saldo)}.`)}
                    />
                    <span className="pc-saldo__passi">
                      {PASSI.map((passo) => (
                        <button
                          key={passo}
                          type="button"
                          className="pc-passo"
                          disabled={blocco}
                          onClick={() => void esegui({ tipo: 'saldo', giocatore: g.id, saldo: g.saldo + passo })}
                        >
                          {passo > 0 ? `+${passo}` : `−${-passo}`}
                        </button>
                      ))}
                    </span>
                    {g.debiti.length > 0 && <Debiti g={g} partita={partita} />}
                  </span>
                </td>
                <td>
                  <select
                    className="campo pc-scelta"
                    aria-label={`Casella di ${g.nome}`}
                    value={g.posizione}
                    disabled={blocco}
                    onChange={(e) => void esegui({ tipo: 'posizione', giocatore: g.id, casella: Number(e.target.value) })}
                  >
                    {tab.caselle.map((c, i) => (
                      <option key={i} value={i}>
                        {i} · {c.nome}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <span className="pc-cella-interruttore">
                    <Interruttore
                      acceso={g.prigione !== null}
                      disattivo={blocco}
                      etichetta={`${g.nome} in prigione`}
                      onCambia={(dentro) =>
                        void esegui({ tipo: 'prigione', giocatore: g.id, dentro }, dentro ? `${g.nome} va in prigione.` : `${g.nome} esce di prigione.`)
                      }
                    />
                    {g.prigione !== null && g.prigione > 0 && <span className="pc-giocatore__nota">{g.prigione} tiri falliti</span>}
                  </span>
                </td>
                <td>
                  <Interruttore
                    acceso={g.vacanza}
                    disattivo={blocco}
                    etichetta={`${g.nome} in vacanza`}
                    onCambia={(vacanza) => void esegui({ tipo: 'vacanza', giocatore: g.id, vacanza })}
                  />
                </td>
                <td>
                  <Grazie g={g} esegui={esegui} disattivo={blocco} />
                </td>
                <td>
                  <span className="pc-giocatore__azioni">
                    <Pulsante
                      misura="piccolo"
                      disabled={blocco}
                      onClick={() => void esegui({ tipo: 'turno', giocatore: g.id }, `Ora tocca a ${g.nome}.`)}
                    >
                      {diTurno ? 'Rifai il turno' : 'Dai il turno'}
                    </Pulsante>
                    <PulsanteConferma
                      disattivo={blocco}
                      conferma="Lo tolgo?"
                      onConferma={() => void esegui({ tipo: 'elimina', giocatore: g.id }, `${g.nome} è fuori dalla partita.`)}
                    >
                      Togli
                    </PulsanteConferma>
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Debiti({ g, partita }: { g: Giocatore; partita: Stato }): ReactNode {
  const nome = (id: string) => partita.giocatori.find((x) => x.id === id)?.nome ?? '?';
  return (
    <span className="pc-giocatore__nota pc-giocatore__nota--rossa">
      Deve {g.debiti.map((x) => `${euro(x.importo)} a ${nome(x.creditore)}`).join(', ')}
    </span>
  );
}

const MAZZI: { mazzo: NomeMazzo; nome: string }[] = [
  { mazzo: 'busta', nome: 'Busta' },
  { mazzo: 'cartolina', nome: 'Cartolina' },
];

/** Le carte Grazia: una per mazzo, accese o spente. */
function Grazie({ g, esegui, disattivo }: { g: Giocatore; esegui: Esegui; disattivo?: boolean }): ReactNode {
  return (
    <span className="pc-segmenti" role="group" aria-label={`Carte Grazia di ${g.nome}`}>
      {MAZZI.map(({ mazzo, nome }) => {
        const ha = g.carteGrazia.includes(mazzo);
        return (
          <button
            key={mazzo}
            type="button"
            className="pc-segmenti__tasto"
            aria-pressed={ha}
            disabled={disattivo}
            onClick={() =>
              void esegui({
                tipo: 'grazie',
                giocatore: g.id,
                carte: ha ? g.carteGrazia.filter((c) => c !== mazzo) : [...g.carteGrazia, mazzo],
              })
            }
          >
            {nome}
          </button>
        );
      })}
    </span>
  );
}
