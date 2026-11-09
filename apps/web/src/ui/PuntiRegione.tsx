/*
 * I puntini di una regione accanto al nome di una città: uno per ogni città della regione, in ordine di
 * tabellone, nel colore di chi la possiede (cerchio vuoto se è libera). Il puntino della città stessa ha
 * l'anello: si vede subito quante città della regione ha già ognuno (●●○).
 */

import '../stili/economia.css';
import type { ReactNode } from 'react';
import { caselleDellaRegione, proprietabile, tabellone, type Stato } from '@poordown/engine';
import { variabili } from './utili';

export function PuntiRegione({ partita, casella, className }: { partita: Stato; casella: number; className?: string }): ReactNode {
  const tab = tabellone(partita.mappa);
  const c = proprietabile(tab, casella);
  if (c?.tipo !== 'citta') return null;
  const regione = tab.regioni[c.regione];
  const punti = caselleDellaRegione(tab, c.regione).map((n) => {
    const id = partita.proprieta[n]?.proprietario ?? null;
    return { n, nome: tab.caselle[n]?.nome ?? '', g: id === null ? undefined : partita.giocatori.find((x) => x.id === id) };
  });
  const descrizione = `${regione?.nome ?? 'Regione'}: ${punti.map((p) => `${p.nome} ${p.g ? `di ${p.g.nome}` : 'libera'}`).join(', ')}`;
  return (
    <span className={className ? `punti-regione ${className}` : 'punti-regione'} role="img" aria-label={descrizione} title={descrizione}>
      {punti.map((p) => (
        <span
          key={p.n}
          className={[
            'punti-regione__punto',
            p.g ? '' : 'punti-regione__punto--libero',
            p.n === casella ? 'punti-regione__punto--questa' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          style={p.g ? variabili({ '--colore': `var(--p${p.g.colore})` }) : undefined}
        />
      ))}
    </span>
  );
}
