import { useSyncExternalStore, type ReactNode } from 'react';
import { ascoltaAvvisi, chiudiAvviso, leggiAvvisi } from './avvisi';
import { Icona } from './icone';

/** Gli avvisi a comparsa in basso al centro della pagina. */
export function Notifiche(): ReactNode {
  const lista = useSyncExternalStore(ascoltaAvvisi, leggiAvvisi);
  return (
    <section className="avvisi" aria-label="Notifiche" aria-live="polite">
      {lista.map((a) => (
        <p key={a.id} className={`avviso avviso--${a.tipo}`} role={a.tipo === 'errore' ? 'alert' : 'status'}>
          <Icona nome={a.tipo === 'errore' ? 'avviso' : 'info'} className="avviso__icona" />
          <span className="avviso__testo">{a.testo}</span>
          <button type="button" className="avviso__chiudi" aria-label="Chiudi" onClick={() => chiudiAvviso(a.id)}>
            <Icona nome="chiudi" />
          </button>
        </p>
      ))}
    </section>
  );
}
