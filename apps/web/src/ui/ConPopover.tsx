import { useEffect, useRef, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CURVA, DURATA } from './movimento';

/** Il popover scende di 4 px dal suo pulsante. */
const SCENDE = {
  initial: { opacity: 0, y: -4 },
  animate: { opacity: 1, y: 0, transition: { duration: DURATA.entrata, ease: CURVA.arrivo } },
  exit: { opacity: 0, y: -4, transition: { duration: DURATA.uscita, ease: CURVA.partenza } },
} as const;

/**
 * Un pulsante con il suo popover sotto (testata di gioco, volume): si chiude con Esc o con un clic fuori.
 * Stili in partenze.css (.con-popover, .popover--testata).
 */
export function ConPopover({
  aperto,
  onChiudi,
  pulsante,
  lato = 'sinistra',
  className,
  children,
}: {
  aperto: boolean;
  onChiudi: () => void;
  pulsante: ReactNode;
  /** Da che lato del pulsante si allinea il popover. */
  lato?: 'sinistra' | 'destra';
  className?: string;
  children: ReactNode;
}): ReactNode {
  const ancora = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aperto) return;
    const fuori = (e: MouseEvent) => {
      if (!ancora.current?.contains(e.target as Node)) onChiudi();
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onChiudi();
    document.addEventListener('mousedown', fuori);
    window.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', fuori);
      window.removeEventListener('keydown', esc);
    };
  }, [aperto, onChiudi]);
  return (
    <div className="con-popover" ref={ancora}>
      {pulsante}
      <AnimatePresence>
        {aperto && (
          <motion.div
            key="popover"
            className={['popover', 'popover--testata', `popover--${lato}`, className ?? ''].filter(Boolean).join(' ')}
            {...SCENDE}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
