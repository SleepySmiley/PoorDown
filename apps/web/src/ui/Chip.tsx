import type { ReactNode } from 'react';
import { Icona, type NomeIcona } from './icone';

/**
 * Chip: piccola etichetta di stato alta 20 px (Tu, Bot, Host, In partita…).
 * Toni: neutro (il normale), ambra (adesso), segnale (blu), rosso (pericolo), verde (in arrivo).
 * Sul quadro nero (.pannello--scuro) il neutro si scurisce da solo.
 */
export function Chip({
  tono = 'neutro',
  icona,
  className,
  title,
  children,
}: {
  tono?: 'neutro' | 'ambra' | 'segnale' | 'rosso' | 'verde';
  icona?: NomeIcona;
  className?: string;
  title?: string;
  children: ReactNode;
}): ReactNode {
  const classi = ['chip', tono === 'neutro' ? '' : `chip--${tono}`, className ?? ''].filter(Boolean).join(' ');
  return (
    <span className={classi} title={title}>
      {icona && <Icona nome={icona} />}
      {children}
    </span>
  );
}
