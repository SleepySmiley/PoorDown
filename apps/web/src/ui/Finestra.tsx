/*
 * Finestre del sistema: la finestra modale (Finestra) e il riquadro sopra il tabellone (RiquadroTabellone).
 * Si aprono e si chiudono con Motion: per vedere la chiusura, chi le mostra le mette dentro un
 * <AnimatePresence> con una `key`, per esempio
 *   <AnimatePresence>{aperta && <Finestra key="esci" titolo="…" onChiudi={…}>…</Finestra>}</AnimatePresence>
 * Senza AnimatePresence funzionano lo stesso: si aprono animate e si chiudono di colpo.
 * Il contenuto usa le classi .finestra__corpo, .finestra__scorri e .finestra__azioni (pulsanti in basso a destra).
 */

import { useEffect, useRef, type ReactNode } from 'react';
import { motion, useIsPresent } from 'motion/react';
import { PulsanteIcona } from './comuni';
import { Icona, type NomeIcona } from './icone';
import { COMPARSA, VELO } from './movimento';

/** Esc chiude la finestra, ma non mentre si sta già chiudendo. */
function useEsc(onChiudi: (() => void) | undefined, presente: boolean): void {
  useEffect(() => {
    if (!onChiudi || !presente) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onChiudi();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onChiudi, presente]);
}

export function Finestra({
  titolo,
  onChiudi,
  children,
  larghezza,
  larga,
  tono = 'normale',
  icona,
}: {
  titolo: string;
  onChiudi: () => void;
  children: ReactNode;
  /** 480 px (normale), 640 (larga), 880 (ampia), a 1440. */
  larghezza?: 'normale' | 'larga' | 'ampia';
  /** Come `larghezza="larga"` (il vecchio modo di dirlo). */
  larga?: boolean;
  /** Pericolo: pittogramma rosso accanto al titolo, per ciò che non si annulla. */
  tono?: 'normale' | 'pericolo';
  /** Pittogramma accanto al titolo. Con il tono pericolo, se manca, è il triangolo di avviso. */
  icona?: NomeIcona;
}): ReactNode {
  const riquadro = useRef<HTMLDivElement>(null);
  const presente = useIsPresent();
  useEsc(onChiudi, presente);
  // Il fuoco entra nella finestra e torna dov'era quando si chiude.
  useEffect(() => {
    const prima = document.activeElement as HTMLElement | null;
    riquadro.current?.focus();
    return () => prima?.focus();
  }, []);
  const misura = larghezza ?? (larga ? 'larga' : 'normale');
  const pittogramma = icona ?? (tono === 'pericolo' ? 'avviso' : undefined);
  return (
    <motion.div
      className={tono === 'pericolo' ? 'finestra finestra--pericolo' : 'finestra'}
      role="presentation"
      onClick={onChiudi}
      // Mentre si chiude non blocca i clic su ciò che c'è sotto.
      style={presente ? undefined : { pointerEvents: 'none' }}
      {...VELO}
    >
      <motion.div
        ref={riquadro}
        tabIndex={-1}
        className={misura === 'normale' ? 'finestra__riquadro' : `finestra__riquadro finestra__riquadro--${misura}`}
        role="dialog"
        aria-modal="true"
        aria-label={titolo}
        onClick={(e) => e.stopPropagation()}
        {...COMPARSA}
      >
        <header className="finestra__testa">
          {pittogramma && (
            <span className="finestra__pittogramma" aria-hidden="true">
              <Icona nome={pittogramma} />
            </span>
          )}
          <h2>{titolo}</h2>
          <PulsanteIcona icona="chiudi" etichetta="Chiudi" onClick={onChiudi} />
        </header>
        {children}
      </motion.div>
    </motion.div>
  );
}

/**
 * Finestra sopra il tabellone (asta, scambi), come in richup: copre solo il tabellone,
 * così chat e colonne restano usabili. Senza `onChiudi` non si chiude (l'asta finisce da sola).
 * Non ruba il fuoco a chi sta scrivendo in chat.
 */
export function RiquadroTabellone({
  titolo,
  onChiudi,
  children,
  className,
}: {
  titolo: string;
  onChiudi?: () => void;
  children: ReactNode;
  className?: string;
}): ReactNode {
  const riquadro = useRef<HTMLDivElement>(null);
  const presente = useIsPresent();
  useEsc(onChiudi, presente);
  useEffect(() => {
    const prima = document.activeElement;
    if (prima instanceof HTMLInputElement || prima instanceof HTMLTextAreaElement) return;
    riquadro.current?.focus();
    return () => {
      if (prima instanceof HTMLElement) prima.focus();
    };
  }, []);
  return (
    <motion.div
      className="sul-tabellone"
      role="presentation"
      onClick={onChiudi}
      style={presente ? undefined : { pointerEvents: 'none' }}
      {...VELO}
    >
      <motion.div
        ref={riquadro}
        tabIndex={-1}
        className={className ? `sul-tabellone__riquadro ${className}` : 'sul-tabellone__riquadro'}
        role="dialog"
        aria-label={titolo}
        onClick={(e) => e.stopPropagation()}
        {...COMPARSA}
      >
        <header className="sul-tabellone__testa">
          <h2>{titolo}</h2>
          {onChiudi && <PulsanteIcona icona="chiudi" etichetta="Chiudi" onClick={onChiudi} />}
        </header>
        {children}
      </motion.div>
    </motion.div>
  );
}
