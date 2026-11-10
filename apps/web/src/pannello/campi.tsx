/* I controlli del pannello: numeri e nomi che si modificano sul posto, pulsanti da confermare, interruttori a gruppo. */

import { useEffect, useState, type ReactNode } from 'react';
import { Pulsante } from '../ui/Pulsante';
import { avvisa } from '../ui/avvisi';

/**
 * Un numero che si modifica sul posto: si salva con Invio o uscendo dal campo, Esc annulla.
 * Finché si scrive, gli aggiornamenti dal server non cancellano la bozza.
 */
export function CampoNumero({
  valore,
  onSalva,
  etichetta,
  unita = '€',
  disattivo,
}: {
  valore: number;
  onSalva: (n: number) => Promise<boolean>;
  etichetta: string;
  unita?: string;
  disattivo?: boolean;
}): ReactNode {
  const [bozza, setBozza] = useState<string | null>(null);
  const salva = async () => {
    if (bozza === null) return;
    const pulito = bozza.replace(/[.\s€]/g, '').replace('−', '-');
    const n = Number(pulito);
    if (pulito === '' || !Number.isInteger(n)) {
      avvisa('Scrivi un numero intero.', 'errore');
      return;
    }
    if (n === valore) {
      setBozza(null);
      return;
    }
    if (await onSalva(n)) setBozza(null);
  };
  return (
    <span className={bozza === null ? 'pc-numero' : 'pc-numero pc-numero--bozza'}>
      <input
        className="pc-numero__input"
        inputMode="numeric"
        aria-label={etichetta}
        value={bozza ?? String(valore)}
        disabled={disattivo}
        onChange={(e) => setBozza(e.target.value)}
        onFocus={(e) => e.target.select()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void salva();
          if (e.key === 'Escape') setBozza(null);
        }}
        onBlur={() => void salva()}
      />
      {unita && (
        <span className="pc-numero__unita" aria-hidden="true">
          {unita}
        </span>
      )}
    </span>
  );
}

/** Un nome che si modifica sul posto, come `CampoNumero`. */
export function CampoNome({
  valore,
  onSalva,
  etichetta,
  disattivo,
}: {
  valore: string;
  onSalva: (nome: string) => Promise<boolean>;
  etichetta: string;
  disattivo?: boolean;
}): ReactNode {
  const [bozza, setBozza] = useState<string | null>(null);
  const salva = async () => {
    if (bozza === null) return;
    const nome = bozza.trim();
    if (nome === valore || nome === '') {
      setBozza(null);
      return;
    }
    if (await onSalva(nome)) setBozza(null);
  };
  return (
    <input
      className={bozza === null ? 'pc-nome' : 'pc-nome pc-nome--bozza'}
      aria-label={etichetta}
      value={bozza ?? valore}
      maxLength={32}
      disabled={disattivo}
      onChange={(e) => setBozza(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') void salva();
        if (e.key === 'Escape') setBozza(null);
      }}
      onBlur={() => void salva()}
    />
  );
}

/** Pulsante per le azioni che non si fanno per sbaglio: il primo clic chiede conferma, il secondo esegue. */
export function PulsanteConferma({
  children,
  conferma = 'Confermi?',
  onConferma,
  variante = 'pericolo-tenue',
  misura = 'piccolo',
  disattivo,
}: {
  children: ReactNode;
  conferma?: string;
  onConferma: () => void;
  variante?: 'pericolo-tenue' | 'secondario';
  misura?: 'piccolo' | 'normale';
  disattivo?: boolean;
}): ReactNode {
  const [armato, setArmato] = useState(false);
  useEffect(() => {
    if (!armato) return;
    const timer = setTimeout(() => setArmato(false), 4_000);
    return () => clearTimeout(timer);
  }, [armato]);
  return (
    <Pulsante
      variante={armato ? 'pericolo' : variante}
      misura={misura}
      disabled={disattivo}
      onClick={() => {
        if (!armato) {
          setArmato(true);
          return;
        }
        setArmato(false);
        onConferma();
      }}
    >
      {armato ? conferma : children}
    </Pulsante>
  );
}

/** Scelta tra pochi valori, come i tasti di un quadro di comando: uno solo acceso. */
export function Segmenti<T extends string | number>({
  valori,
  attuale,
  onScegli,
  etichetta,
  disattivo,
}: {
  valori: readonly { valore: T; testo: string; titolo?: string }[];
  attuale: T;
  onScegli: (v: T) => void;
  etichetta: string;
  disattivo?: boolean;
}): ReactNode {
  return (
    <span className="pc-segmenti" role="group" aria-label={etichetta}>
      {valori.map((v) => (
        <button
          key={String(v.valore)}
          type="button"
          className="pc-segmenti__tasto"
          aria-pressed={v.valore === attuale}
          title={v.titolo}
          disabled={disattivo}
          onClick={() => v.valore !== attuale && onScegli(v.valore)}
        >
          {v.testo}
        </button>
      ))}
    </span>
  );
}
