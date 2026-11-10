import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { MotionConfig } from 'motion/react';
import { usePagina } from './navigazione';
import { collegamento, ingressi, postoTenuto } from './rete/sessione';
import { Home } from './schermate/Home';
import { Stanza } from './schermate/Stanza';
import { Notifiche } from './ui/Notifiche';
// Dopo gli stili delle schermate, così le regole nuove possono correggerli.
import './stili/stanza.css';

/** La pagina di prova dei suoni (/suoni): solo con il server di sviluppo, non entra nella versione compilata. */
const PaginaSuoni = import.meta.env.DEV ? lazy(() => import('./suoni/PaginaSuoni')) : null;
/** Il pannello di controllo (/pannello): si scarica a parte, solo da chi lo apre. */
const PaginaPannello = lazy(() => import('./pannello/PaginaPannello'));

/** Sceglie la pagina dall'indirizzo: "/" è la home, "/stanza/<codice>" una stanza. */
export function App(): ReactNode {
  const pagina = usePagina();

  // Tornando alla home (anche con il tasto Indietro) si smette di seguire la stanza.
  // Se in partita il posto resta, la home offre di rientrare.
  useEffect(() => {
    if (pagina.tipo === 'stanza') return;
    ingressi.dimentica();
    const seguita = collegamento.codiceSeguito();
    if (seguita === null) return;
    postoTenuto.ricorda(seguita);
    void collegamento.esci();
  }, [pagina.tipo]);

  // Motion rispetta la preferenza di sistema «meno movimento», come le animazioni CSS.
  return (
    <MotionConfig reducedMotion="user">
      {pagina.tipo === 'stanza' ? (
        <Stanza key={pagina.codice} codice={pagina.codice} />
      ) : pagina.tipo === 'suoni' && PaginaSuoni ? (
        <Suspense>
          <PaginaSuoni />
        </Suspense>
      ) : pagina.tipo === 'pannello' ? (
        <Suspense>
          <PaginaPannello />
        </Suspense>
      ) : (
        <Home />
      )}
      <Notifiche />
    </MotionConfig>
  );
}
