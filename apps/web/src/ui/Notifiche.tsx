import { useSyncExternalStore, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ascoltaAvvisi, chiudiAvviso, leggiAvvisi, type TipoAvviso } from './avvisi';
import { Icona, type NomeIcona } from './icone';
import { COMPARSA, SCORRE } from './movimento';

const ICONA: Record<TipoAvviso, NomeIcona> = {
  info: 'info',
  errore: 'avviso',
  successo: 'spunta',
  attenzione: 'avviso',
};

/**
 * Gli avvisi a comparsa in basso al centro della pagina. La barra a sinistra ha il colore del tono;
 * entrano e escono con Motion e, quando uno se ne va, gli altri scorrono al loro posto.
 */
export function Notifiche(): ReactNode {
  const lista = useSyncExternalStore(ascoltaAvvisi, leggiAvvisi);
  return (
    <section className="avvisi" aria-label="Notifiche" aria-live="polite">
      <AnimatePresence initial={false}>
        {lista.map((a) => (
          <motion.p
            key={a.id}
            layout
            className={`avviso avviso--${a.tipo}`}
            role={a.tipo === 'errore' ? 'alert' : 'status'}
            {...COMPARSA}
            transition={SCORRE}
          >
            <Icona nome={ICONA[a.tipo]} className="avviso__icona" />
            <span className="avviso__testo">{a.testo}</span>
            <button type="button" className="avviso__chiudi" aria-label="Chiudi" onClick={() => chiudiAvviso(a.id)}>
              <Icona nome="chiudi" />
            </button>
          </motion.p>
        ))}
      </AnimatePresence>
    </section>
  );
}
