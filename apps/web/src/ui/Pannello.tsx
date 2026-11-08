import { useId, type ReactNode } from 'react';
import { Icona, type NomeIcona } from './icone';

/**
 * Pannello delle colonne: testata alta 48 px con il titolo a sinistra (in --testo-1), il conteggio
 * accanto e le azioni a destra; sotto, il contenuto. `scuro` usa il quadro nero delle palette.
 * Le stesse classi a mano: .pannello > .pannello__testa > .pannello__titolo (+ .pannello__conta).
 */
export function Pannello({
  titolo,
  icona,
  conta,
  azioni,
  scuro,
  etichetta,
  className,
  children,
}: {
  /** Senza titolo il pannello non ha testata: serve allora `etichetta` per chi usa un lettore di schermo. */
  titolo?: string;
  /** Pittogramma di segnaletica prima del titolo. */
  icona?: NomeIcona;
  conta?: number;
  /** Pulsanti a destra nella testata. */
  azioni?: ReactNode;
  scuro?: boolean;
  etichetta?: string;
  className?: string;
  children?: ReactNode;
}): ReactNode {
  const id = useId();
  const classi = ['pannello', scuro ? 'pannello--scuro' : '', className ?? ''].filter(Boolean).join(' ');
  return (
    <section className={classi} aria-labelledby={titolo ? id : undefined} aria-label={titolo ? undefined : etichetta}>
      {titolo && (
        <header className="pannello__testa">
          <h2 id={id} className="pannello__titolo">
            {icona && <Icona nome={icona} />}
            {titolo}
            {conta !== undefined && <span className="pannello__conta">({conta})</span>}
          </h2>
          {azioni}
        </header>
      )}
      {children}
    </section>
  );
}
