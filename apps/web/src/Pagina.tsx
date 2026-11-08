import { lazy, Suspense } from 'react';
import { App } from './App';

const Prova = lazy(() => import('./prova/Prova').then((m) => ({ default: m.Prova })));

/** Provvisorio fino alla Fase 4: /prova apre il banco di prova delle stanze, il resto la pagina della Fase 0. */
export function Pagina() {
  if (!location.pathname.startsWith('/prova')) return <App />;
  return (
    <Suspense>
      <Prova />
    </Suspense>
  );
}
