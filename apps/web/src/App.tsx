import { useEffect, type ReactNode } from 'react';
import { usePagina } from './navigazione';
import { collegamento, ingressi } from './rete/sessione';
import { Home } from './schermate/Home';
import { Stanza } from './schermate/Stanza';
import { Notifiche } from './ui/Notifiche';
// Dopo gli stili delle schermate, così le regole nuove possono correggerli.
import './stili/stanza.css';

/** Sceglie la pagina dall'indirizzo: "/" è la home, "/stanza/<codice>" una stanza. */
export function App(): ReactNode {
  const pagina = usePagina();

  // Tornando alla home (anche con il tasto Indietro) si smette di seguire la stanza.
  useEffect(() => {
    if (pagina.tipo !== 'home') return;
    ingressi.dimentica();
    if (collegamento.codiceSeguito() !== null) void collegamento.esci();
  }, [pagina.tipo]);

  return (
    <>
      {pagina.tipo === 'home' ? <Home /> : <Stanza key={pagina.codice} codice={pagina.codice} />}
      <Notifiche />
    </>
  );
}
