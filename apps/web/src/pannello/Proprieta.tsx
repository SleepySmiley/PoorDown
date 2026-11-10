/* Le proprietà del tabellone, regione per regione: proprietario, case e ipoteca. */

import type { ReactNode } from 'react';
import { euro, tabellone, type Proprietabile, type Stato } from '@poordown/engine';
import { Icona } from '../ui/icone';
import { Interruttore, Stemma } from '../ui/comuni';
import { variabili } from '../ui/utili';
import { Segmenti } from './campi';
import type { Esegui } from './Plancia';

const LIVELLI = [
  { valore: 0, testo: '—', titolo: 'Solo terreno' },
  { valore: 1, testo: '1', titolo: 'Una casa' },
  { valore: 2, testo: '2', titolo: 'Due case' },
  { valore: 3, testo: '3', titolo: 'Tre case' },
  { valore: 4, testo: '4', titolo: 'Quattro case' },
  { valore: 5, testo: 'A', titolo: 'Albergo' },
] as const;

interface Gruppo {
  titolo: string;
  regione: number | null;
  caselle: number[];
}

export function Proprieta({ partita, esegui }: { partita: Stato; esegui: Esegui }): ReactNode {
  const tab = tabellone(partita.mappa);
  const indici = tab.caselle.flatMap((c, i) => (c.tipo === 'citta' || c.tipo === 'stazione' || c.tipo === 'servizio' ? [i] : []));
  const gruppi: Gruppo[] = [
    ...tab.regioni.map((r, ri) => ({
      titolo: r.nome,
      regione: ri,
      caselle: indici.filter((i) => {
        const c = tab.caselle[i];
        return c?.tipo === 'citta' && c.regione === ri;
      }),
    })),
    { titolo: 'Stazioni', regione: null, caselle: indici.filter((i) => tab.caselle[i]?.tipo === 'stazione') },
    { titolo: 'Servizi', regione: null, caselle: indici.filter((i) => tab.caselle[i]?.tipo === 'servizio') },
  ].filter((g) => g.caselle.length > 0);

  const inGioco = partita.giocatori.filter((g) => !g.eliminato);
  const modificabile = partita.fase === 'in_corso';
  const blocco = modificabile ? undefined : true;

  return (
    <div className="pc-proprieta">
      {gruppi.map((gruppo) => (
        <section key={gruppo.titolo} className="pc-gruppo">
          <h3 className="pc-gruppo__titolo">
            {gruppo.regione !== null ? <Stemma regione={tab.regioni[gruppo.regione]} className="pc-gruppo__stemma" /> : null}
            {gruppo.titolo}
          </h3>
          <ul className="pc-gruppo__righe">
            {gruppo.caselle.map((i) => {
              const casella = tab.caselle[i] as Proprietabile;
              const p = partita.proprieta[i];
              if (!p) return null;
              const proprietario = partita.giocatori.find((g) => g.id === p.proprietario);
              const cambia = (nuovo: { proprietario?: string | null; livello?: number; ipotecata?: boolean }) => {
                const chi = nuovo.proprietario === undefined ? p.proprietario : nuovo.proprietario;
                void esegui({
                  tipo: 'proprieta',
                  casella: i,
                  proprietario: chi,
                  livello: chi === null ? 0 : (nuovo.livello ?? p.livello),
                  ipotecata: chi === null ? false : (nuovo.ipotecata ?? p.ipotecata),
                });
              };
              return (
                <li
                  key={i}
                  className={proprietario ? 'pc-casella pc-casella--posseduta' : 'pc-casella'}
                  style={proprietario ? variabili({ '--colore': `var(--p${proprietario.colore})` }) : undefined}
                >
                  <span className="pc-casella__nome">
                    {casella.tipo === 'stazione' && <Icona nome="treno" />}
                    {casella.tipo === 'servizio' && <Icona nome="fulmine" />}
                    <span>
                      {casella.nome}
                      <span className="pc-casella__prezzo">{euro(casella.prezzo)}</span>
                    </span>
                  </span>
                  <select
                    className="campo pc-scelta"
                    aria-label={`Proprietario di ${casella.nome}`}
                    value={p.proprietario ?? ''}
                    disabled={blocco}
                    onChange={(e) => cambia({ proprietario: e.target.value === '' ? null : e.target.value })}
                  >
                    <option value="">Banca (libera)</option>
                    {inGioco.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.nome}
                      </option>
                    ))}
                  </select>
                  {casella.tipo === 'citta' ? (
                    <Segmenti
                      valori={LIVELLI}
                      attuale={p.livello}
                      etichetta={`Case su ${casella.nome}`}
                      disattivo={blocco ?? (p.proprietario === null || p.ipotecata)}
                      onScegli={(livello) => cambia({ livello })}
                    />
                  ) : (
                    <span className="pc-casella__vuoto" />
                  )}
                  <span className="pc-casella__ipoteca">
                    <span className="pc-casella__etichetta">Ipoteca</span>
                    <Interruttore
                      acceso={p.ipotecata}
                      etichetta={`${casella.nome} ipotecata`}
                      disattivo={blocco ?? (p.proprietario === null || p.livello > 0)}
                      onCambia={(ipotecata) => cambia({ ipotecata })}
                    />
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
