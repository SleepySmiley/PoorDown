/*
 * /suoni: tutti i suoni del gioco da ascoltare uno per uno, per sceglierli e regolarli.
 * Esiste solo con il server di sviluppo (npm run dev).
 */

import '../stili/suoni.css';
import type { ReactNode } from 'react';
import { vaiAllaHome } from '../navigazione';
import { Icona } from '../ui/icone';
import { suona, type NomeSuono } from './audio';
import { DESCRIZIONI } from './catalogo';
import { Volume } from './Volume';

const GRUPPI: readonly { titolo: string; suoni: readonly NomeSuono[] }[] = [
  { titolo: 'Dadi e pedine', suoni: ['dadi', 'doppio', 'passo', 'arrivo'] },
  { titolo: 'Soldi', suoni: ['incasso', 'pagamento', 'moneta'] },
  { titolo: 'Proprietà', suoni: ['timbro', 'casa', 'albergo', 'smonta', 'ipoteca', 'riscatto'] },
  { titolo: 'Carte e prigione', suoni: ['carta', 'prigione', 'liberato'] },
  { titolo: 'Turno e partita', suoni: ['partenza', 'tuoTurno', 'tic', 'bancarotta', 'vittoria', 'fine'] },
  { titolo: 'Aste', suoni: ['martelletto', 'offerta', 'miaOfferta', 'superato', 'aggiudicato'] },
  { titolo: 'Scambi', suoni: ['proposta', 'scambioFatto', 'scambioRifiutato', 'timbroLieve'] },
  { titolo: 'Stanza, tempo e voti', suoni: ['chat', 'ingresso', 'uscita', 'tempoChiesto', 'tempoRicevuto', 'votoContro', 'voto'] },
];

export default function PaginaSuoni(): ReactNode {
  return (
    <div className="prova-suoni">
      <header className="prova-suoni__testa">
        <h1>Suoni di PoorDown</h1>
        <p>Tutti sintetizzati nel browser, niente file. Premi un suono per sentirlo.</p>
        <span className="prova-suoni__comandi">
          <Volume />
          <button type="button" className="pulsante pulsante--piccolo pulsante--secondario" onClick={vaiAllaHome}>
            <Icona nome="esci" />
            Home
          </button>
        </span>
      </header>
      {GRUPPI.map((g) => (
        <section key={g.titolo} className="prova-suoni__gruppo">
          <h2>{g.titolo}</h2>
          <div className="prova-suoni__griglia">
            {g.suoni.map((nome) => (
              <button key={nome} type="button" className="prova-suoni__suono" onClick={() => suona(nome)}>
                <Icona nome="volume" />
                <span>
                  <b>{DESCRIZIONI[nome]}</b>
                  <code>{nome}</code>
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
