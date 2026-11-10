import { useEffect, useRef } from 'react';

/**
 * Chiama `fn` subito e poi ogni `ms` millisecondi (aspettando che la chiamata precedente finisca),
 * finché `attivo` è vero. Con la scheda nascosta salta i giri. Riparte da capo quando cambia `chiave`.
 */
export function useSondaggio(fn: () => Promise<void>, ms: number, attivo = true, chiave: unknown = null): void {
  const ultima = useRef(fn);
  useEffect(() => {
    ultima.current = fn;
  });
  useEffect(() => {
    if (!attivo) return;
    let fermo = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const giro = async () => {
      if (fermo) return;
      if (!document.hidden) {
        try {
          await ultima.current();
        } catch {
          // Chi chiama gestisce i suoi errori: qui conta solo non fermare il giro.
        }
      }
      if (!fermo) timer = setTimeout(() => void giro(), ms);
    };
    void giro();
    return () => {
      fermo = true;
      clearTimeout(timer);
    };
  }, [ms, attivo, chiave]);
}
