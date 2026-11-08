import '@fontsource/barlow-condensed/500.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import './partenze.css';
import { useEffect, useState, type ReactNode } from 'react';
import { Gioco } from './Gioco';
import { Home } from './Home';
import { Lobby } from './Lobby';

type Schermata = 'home' | 'lobby' | 'lobby-ospite' | 'gioco';

const SCHERMATE: { id: Schermata; nome: string }[] = [
  { id: 'home', nome: 'Home' },
  { id: 'lobby', nome: 'Lobby (host)' },
  { id: 'lobby-ospite', nome: 'Lobby (ospite)' },
  { id: 'gioco', nome: 'Partita' },
];

function daIndirizzo(): Schermata {
  const h = window.location.hash.slice(1);
  return SCHERMATE.some((s) => s.id === h) ? (h as Schermata) : 'home';
}

/** Barra del mockup (non fa parte del gioco): passa da una schermata all'altra. */
export function Pagina(): ReactNode {
  const [schermata, setSchermata] = useState<Schermata>(daIndirizzo);

  useEffect(() => {
    const aggiorna = () => setSchermata(daIndirizzo());
    window.addEventListener('hashchange', aggiorna);
    return () => window.removeEventListener('hashchange', aggiorna);
  }, []);

  return (
    <>
      {schermata === 'home' && <Home />}
      {schermata === 'lobby' && <Lobby key="host" vista="host" />}
      {schermata === 'lobby-ospite' && <Lobby key="ospite" vista="ospite" />}
      {schermata === 'gioco' && <Gioco />}
      <nav className="mockup-barra" aria-label="Schermate del mockup">
        <span className="mockup-barra__titolo">Mockup</span>
        {SCHERMATE.map((s) => (
          <a key={s.id} href={`#${s.id}`} aria-current={s.id === schermata ? 'page' : undefined}>
            {s.nome}
          </a>
        ))}
      </nav>
    </>
  );
}
