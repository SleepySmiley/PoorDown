/* Cassa della Vacanza, regole della partita in corso e fine della partita. */

import { useState, type ReactNode } from 'react';
import { euro, patrimonio, REGOLE_MODIFICABILI, type RegolaModificabile, type Stato } from '@poordown/engine';
import { Interruttore } from '../ui/comuni';
import { CampoNumero, PulsanteConferma } from './campi';
import type { Esegui } from './Plancia';

const REGOLE: Record<RegolaModificabile, { nome: string; descrizione: string }> = {
  affittoDoppioSetCompleto: { nome: 'Affitto doppio', descrizione: 'Con tutta la regione l’affitto base raddoppia' },
  cassaVacanza: { nome: 'Cassa della Vacanza', descrizione: 'Chi si ferma in Vacanza incassa tasse e multe' },
  aste: { nome: 'Aste', descrizione: 'Se nessuno compra, la proprietà va all’asta' },
  nienteAffittoInPrigione: { nome: 'Prigione senza affitti', descrizione: 'Chi è in prigione non incassa' },
  ipoteche: { nome: 'Ipoteche', descrizione: 'Metà prezzo dalla banca' },
  costruzioneUniforme: { nome: 'Costruzione uniforme', descrizione: 'Case alla pari nella regione' },
  timerTurno: { nome: 'Timer del turno', descrizione: 'Riaccendendolo, il tempo del turno riparte da adesso' },
  durataMassima: { nome: 'Durata massima', descrizione: '100 turni a testa, poi vince il patrimonio più alto' },
};

export function Partita({ partita, esegui }: { partita: Stato; esegui: Esegui }): ReactNode {
  const inCorso = partita.fase === 'in_corso';
  const blocco = inCorso ? undefined : true;
  const inGioco = partita.giocatori.filter((g) => !g.eliminato);
  const [vincitore, setVincitore] = useState('');
  const primo = [...inGioco].sort((a, b) => patrimonio(partita, b.id) - patrimonio(partita, a.id))[0];

  return (
    <div className="pc-griglia">
      <section className="pc-riquadro">
        <h3 className="pc-riquadro__titolo">Regole</h3>
        <ul className="pc-regole">
          {REGOLE_MODIFICABILI.map((chiave) => (
            <li key={chiave} className="pc-regola">
              <span>
                <span className="pc-regola__nome">{REGOLE[chiave].nome}</span>
                <span className="pc-regola__descrizione">{REGOLE[chiave].descrizione}</span>
              </span>
              <Interruttore
                acceso={partita.impostazioni[chiave]}
                etichetta={REGOLE[chiave].nome}
                disattivo={blocco}
                onCambia={(v) =>
                  void esegui({ tipo: 'regole', regole: { [chiave]: v } }, `${REGOLE[chiave].nome}: ${v ? 'accesa' : 'spenta'}.`)
                }
              />
            </li>
          ))}
        </ul>
      </section>

      <div className="pc-colonna">
        <section className="pc-riquadro">
          <h3 className="pc-riquadro__titolo">Cassa della Vacanza</h3>
          <div className="pc-modulo">
            <CampoNumero
              valore={partita.cassaVacanza}
              etichetta="Soldi nella cassa della Vacanza"
              disattivo={blocco}
              onSalva={(importo) => esegui({ tipo: 'cassa', importo }, `Cassa della Vacanza: ${euro(importo)}.`)}
            />
          </div>
          {!partita.impostazioni.cassaVacanza && <p className="pc-nota">La regola è spenta: la cassa non incassa e non paga.</p>}
        </section>

        <section className="pc-riquadro pc-riquadro--pericolo">
          <h3 className="pc-riquadro__titolo">Fine della partita</h3>
          <div className="pc-modulo">
            <label className="pc-modulo__campo">
              <span className="etichetta">Vince</span>
              <select className="campo pc-scelta" value={vincitore} disabled={blocco} onChange={(e) => setVincitore(e.target.value)}>
                <option value="">Il patrimonio più alto{primo ? ` (oggi ${primo.nome})` : ''}</option>
                {inGioco.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nome}
                  </option>
                ))}
              </select>
            </label>
            <PulsanteConferma
              misura="normale"
              disattivo={blocco}
              conferma="Finisco la partita?"
              onConferma={() => void esegui({ tipo: 'fine', vincitore: vincitore || null }, 'Partita finita.')}
            >
              Finisci la partita
            </PulsanteConferma>
          </div>
          <p className="pc-nota">Tutti vedono subito la classifica finale. Con «Annulla l’ultima modifica» si torna a giocare.</p>
        </section>
      </div>
    </div>
  );
}
