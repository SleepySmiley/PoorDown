import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icona, type NomeIcona } from './icone';

/**
 * Il pulsante del sistema. Varianti (un significato ciascuna):
 * - primario: l'azione principale di una finestra o di un pannello (blu);
 * - ambra: SOLO l'azione del turno, quella che si aspetta adesso da me;
 * - secondario: le altre azioni; fantasma: Annulla, azioni di contorno;
 * - pericolo: conferma di ciò che non si annulla (rosso pieno); pericolo-tenue: azioni rischiose (bordo rosso);
 * - verde: Accetta.
 * Misure: piccolo 32 px, normale 40, grande 56 (a 1440; crescono con la pagina).
 * Con `blocco` il pulsante è spento e il passaggio del mouse mostra il motivo.
 * Chi scrive il <button> a mano usa le stesse classi: .pulsante .pulsante--<variante> [.pulsante--<misura>].
 */
export function Pulsante({
  variante = 'secondario',
  misura = 'normale',
  icona,
  largo,
  blocco,
  suggerimentoADestra,
  className,
  children,
  type = 'button',
  disabled,
  ...resto
}: {
  variante?: 'primario' | 'ambra' | 'secondario' | 'fantasma' | 'pericolo' | 'pericolo-tenue' | 'verde';
  misura?: 'piccolo' | 'normale' | 'grande';
  icona?: NomeIcona;
  /** Tutta la larghezza del contenitore. */
  largo?: boolean;
  /** Perché adesso non si può premere; `null` o assente se si può. */
  blocco?: string | null;
  /** Il suggerimento si allinea a destra (pulsanti vicino al bordo destro della pagina). */
  suggerimentoADestra?: boolean;
  className?: string;
  children?: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'>): ReactNode {
  const classi = [
    'pulsante',
    `pulsante--${variante}`,
    misura === 'normale' ? '' : `pulsante--${misura}`,
    largo ? 'pulsante--largo' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
  const pulsante = (
    <button type={type} className={classi} disabled={disabled || (blocco !== undefined && blocco !== null)} {...resto}>
      {icona && <Icona nome={icona} />}
      {children}
    </button>
  );
  if (!blocco) return pulsante;
  // Un pulsante spento non riceve il passaggio del mouse: il suggerimento sta sul contenitore.
  return (
    <span className={suggerimentoADestra ? 'con-suggerimento con-suggerimento--destra' : 'con-suggerimento'} data-testo={blocco}>
      {pulsante}
    </span>
  );
}
