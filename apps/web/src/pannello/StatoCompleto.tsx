/*
 * Lo stato completo della partita in JSON, da modificare a mano: per tutto quello che le altre sezioni non coprono
 * (banca del tempo, ordine dei mazzi, scambi, statistiche…). Il server lo controlla campo per campo prima di usarlo.
 */

import { useState, type ReactNode } from 'react';
import type { Stato } from '@poordown/engine';
import { Pulsante } from '../ui/Pulsante';
import { avvisa } from '../ui/avvisi';
import type { Esegui } from './Plancia';

const scrivi = (partita: Stato) => JSON.stringify(partita, null, 2);

export function StatoCompleto({ partita, esegui }: { partita: Stato; esegui: Esegui }): ReactNode {
  /** La bozza: `null` finché non si scrive, e intanto il testo segue la partita dal vivo. */
  const [bozza, setBozza] = useState<string | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const testo = bozza ?? scrivi(partita);

  const applica = async () => {
    if (bozza === null) return;
    let stato: unknown;
    try {
      stato = JSON.parse(bozza);
    } catch (e) {
      setErrore(`Il JSON non si legge: ${e instanceof Error ? e.message : 'controlla virgole e parentesi'}.`);
      return;
    }
    setErrore(null);
    if (await esegui({ tipo: 'stato', stato: stato as Stato }, 'Stato della partita sostituito.')) setBozza(null);
  };

  return (
    <section className="pc-json">
      <div className="pc-json__barra">
        <p className="pc-nota">
          {bozza === null
            ? 'Questo è lo stato della partita, aggiornato dal vivo. Modificalo e premi «Applica»: il server lo controlla prima di usarlo.'
            : 'Stai modificando: lo stato dal vivo è in pausa finché non applichi o ricarichi.'}
        </p>
        <Pulsante
          variante="fantasma"
          misura="piccolo"
          icona="aggiorna"
          disabled={bozza === null}
          onClick={() => {
            setBozza(null);
            setErrore(null);
          }}
        >
          Ricarica
        </Pulsante>
        <Pulsante variante="primario" misura="piccolo" icona="spunta" disabled={bozza === null} onClick={() => void applica()}>
          Applica
        </Pulsante>
        <Pulsante
          variante="fantasma"
          misura="piccolo"
          icona="copia"
          onClick={() =>
            void navigator.clipboard.writeText(testo).then(
              () => avvisa('Stato copiato.', 'successo'),
              () => avvisa('Non riesco a copiare.', 'errore'),
            )
          }
        >
          Copia
        </Pulsante>
      </div>
      {errore && (
        <p className="pc-json__errore" role="alert">
          {errore}
        </p>
      )}
      <textarea
        className={bozza === null ? 'pc-json__testo' : 'pc-json__testo pc-json__testo--bozza'}
        value={testo}
        spellCheck={false}
        aria-label="Stato completo della partita in JSON"
        onChange={(e) => setBozza(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            void applica();
          }
        }}
      />
    </section>
  );
}
