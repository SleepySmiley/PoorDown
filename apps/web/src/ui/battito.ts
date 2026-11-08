import { useEffect, useState } from 'react';

/** Ridisegna il componente ogni `ms` millisecondi: serve ai conti alla rovescia. */
export function useBattito(ms: number): void {
  const [, setBattito] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setBattito((x) => x + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
}
