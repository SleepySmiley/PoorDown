/* "Come si gioca": i cinque passi della home, usati anche nella finestra di aiuto della stanza. */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { euro, IMPOSTAZIONI_PREDEFINITE, tabellone } from '@poordown/engine';
import { Dado, Soldi, Stemma } from './comuni';
import { Icona } from './icone';
import { variabili } from './utili';

const TAB = tabellone('classica');
/** Il terzo passo mostra le tre città del Veneto, con i prezzi veri. */
const VENETO = TAB.caselle.flatMap((c) => (c.tipo === 'citta' && c.regione === 4 ? [c] : []));

const PASSI: { testo: string; dettaglio?: string; figura: ReactNode }[] = [
  {
    testo: `Ognuno parte con ${euro(IMPOSTAZIONI_PREDEFINITE.soldiIniziali)}.`,
    dettaglio: 'L’host della stanza può cambiare la cifra di partenza.',
    figura: <Soldi valore={IMPOSTAZIONI_PREDEFINITE.soldiIniziali} className="passo__soldi" />,
  },
  {
    testo: 'Al tuo turno tira i dadi e avanza.',
    dettaglio: 'Hai fatto un doppio? Tiri ancora.',
    figura: (
      <span className="passo__dadi">
        <Dado valore={4} />
        <Dado valore={4} />
      </span>
    ),
  },
  {
    testo: 'Compra le città dove ti fermi e fai crescere il tuo patrimonio.',
    dettaglio: 'Chi si ferma su una tua città ti paga l’affitto.',
    figura: (
      <span className="passo__citta">
        {VENETO.map((c) => (
          <span key={c.nome} className="mini-casella" style={variabili({ '--gruppo': 'var(--g5)' })}>
            <Stemma regione={TAB.regioni[4]} className="mini-casella__stemma" />
            <span className="mini-casella__nome">{c.nome}</span>
            <span className="mini-casella__prezzo">{euro(c.prezzo)}</span>
          </span>
        ))}
      </span>
    ),
  },
  {
    testo: 'Hai tutte le città di una regione? Costruisci case e alberghi.',
    dettaglio: 'Con le case l’affitto sale molto: con l’albergo incassi il massimo.',
    figura: (
      <span className="passo__case">
        <Icona nome="casa" />
        <Icona nome="casa" />
        <Icona nome="casa" />
        <Icona nome="albergo" />
      </span>
    ),
  },
  {
    testo: 'Diventa ricco, poi ancora più ricco. Non finire in bancarotta.',
    figura: <Icona nome="bandiera" className="passo__bandiera" />,
  },
];

function Passo({ p, i, subito }: { p: (typeof PASSI)[number]; i: number; subito: boolean }): ReactNode {
  const ref = useRef<HTMLLIElement>(null);
  const [visto, setVisto] = useState(subito);
  useEffect(() => {
    const el = ref.current;
    if (!el || subito) return;
    const osservatore = new IntersectionObserver(
      ([voce]) => {
        if (voce?.isIntersecting) {
          setVisto(true);
          osservatore.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    osservatore.observe(el);
    return () => osservatore.disconnect();
  }, [subito]);
  return (
    <li ref={ref} className={visto ? 'passo passo--visto' : 'passo'}>
      <span className="passo__binario" aria-hidden="true">
        {i + 1}
      </span>
      <div className="passo__testo">
        <p>{p.testo}</p>
        {p.dettaglio && <p className="passo__dettaglio">{p.dettaglio}</p>}
      </div>
      <div className="passo__figura" aria-hidden="true">
        {visto && p.figura}
      </div>
    </li>
  );
}

/** @param subito le figure compaiono subito, senza aspettare che il passo entri nello schermo. */
export function PassiDelGioco({ subito = false }: { subito?: boolean }): ReactNode {
  return (
    <ol className="come-si-gioca__passi">
      {PASSI.map((p, i) => (
        <Passo key={i} p={p} i={i} subito={subito} />
      ))}
    </ol>
  );
}
