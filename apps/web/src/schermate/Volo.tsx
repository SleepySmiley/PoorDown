/*
 * Giro del mondo: il biglietto aereo. Invece di tirare i dadi, chi ha il passaporto sceglie una casella del tabellone
 * e ci vola, pagando il biglietto all'aeroporto del lato dove si trova (se è di un avversario) o alla banca.
 * - SceltaVolo: la carta d'imbarco al centro del tabellone, con «Vola» e «Annulla».
 * Il tabellone, intanto, accende le mete in tre fasce di prezzo (Tabellone.tsx, prop `volo`); le mete le calcola mete.ts.
 */

import '../stili/volo.css';
import { useEffect, type ReactNode } from 'react';
import { destinazione, euro, tabellone, type IdGiocatore, type Stato } from '@poordown/engine';
import { Palette } from '../ui/comuni';
import { Icona } from '../ui/icone';
import { Pulsante } from '../ui/Pulsante';
import type { MetaVolo } from './mete';

/** Chi incassa il biglietto, in poche parole. */
function chiIncassa(partita: Stato, io: IdGiocatore, b: MetaVolo): string {
  if (b.prezzo === 0) return 'Biglietto omaggio';
  const tab = tabellone(partita.mappa);
  const aeroporto = b.aeroporto === null ? null : tab.caselle[b.aeroporto];
  const nome = (id: IdGiocatore) => partita.giocatori.find((g) => g.id === id)?.nome ?? '?';
  if (b.incassa) return `Paghi ${nome(b.incassa)}, padrone ${aeroporto ? `dell’${aeroporto.nome}` : 'dell’aeroporto'}`;
  const padrone = b.aeroporto === null ? null : (partita.proprieta[b.aeroporto]?.proprietario ?? null);
  if (padrone === io) return 'Metà prezzo: l’aeroporto di questo lato è tuo';
  if (padrone) return 'Metà prezzo: l’aeroporto di questo lato è della tua squadra';
  return 'Paghi la banca';
}

/**
 * La carta d'imbarco al centro del tabellone, mentre si sceglie dove volare. Prima di scegliere dice di cliccare
 * una casella accesa; scelta la meta, mostra da dove a dove, il prezzo e chi lo incassa. Esc annulla.
 */
export function SceltaVolo({
  partita,
  io,
  mete,
  meta,
  inviando,
  onVola,
  onAnnulla,
}: {
  partita: Stato;
  io: IdGiocatore;
  mete: ReadonlyMap<number, MetaVolo>;
  meta: number | null;
  inviando: boolean;
  onVola: (casella: number) => void;
  onAnnulla: () => void;
}): ReactNode {
  const tab = tabellone(partita.mappa);
  const qui = partita.giocatori.find((g) => g.id === io)?.posizione ?? 0;
  const scelta = meta === null ? undefined : mete.get(meta);
  // Il nome intero («Città del Vaticano»); quello breve solo se l'intero non sta sulla carta né sul pulsante (Bangkok).
  const breve = (n: number) => {
    const c = tab.caselle[n];
    return c ? { ...c, nome: c.breve && c.nome.length > 24 ? c.breve : c.nome } : undefined;
  };
  const arrivo = meta === null ? undefined : breve(meta);

  // I prezzi delle tre fasce, come li paga chi gioca adesso (metà con il proprio aeroporto, zero con l'omaggio).
  const fasce = [1, 2, 3].flatMap((f) => {
    const una = [...mete.values()].find((m) => m.fascia === f);
    return una ? [{ fascia: f, prezzo: una.prezzo }] : [];
  });

  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onAnnulla();
    };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onAnnulla]);

  return (
    <div className="scelta-volo">
      <section className="imbarco" aria-label="Carta d’imbarco">
        <header className="imbarco__testata">
          <Icona nome="aereo" />
          <span>Carta d’imbarco</span>
        </header>
        <div className="imbarco__tratta">
          <p className="imbarco__scalo">
            <span className="imbarco__etichetta">Da</span>
            <span className="imbarco__luogo">{breve(qui)?.nome}</span>
          </p>
          <span className="imbarco__freccia" aria-hidden="true">
            <Icona nome="aereo" />
          </span>
          <p className="imbarco__scalo imbarco__scalo--arrivo">
            <span className="imbarco__etichetta">A</span>
            <span className={arrivo ? 'imbarco__luogo' : 'imbarco__luogo imbarco__luogo--vuoto'}>
              {arrivo ? arrivo.nome : 'Clicca una casella accesa'}
            </span>
          </p>
        </div>
        <div className="imbarco__conto">
          {scelta ? (
            <>
              <Palette testo={scelta.prezzo === 0 ? '0' : String(scelta.prezzo)} unita="€" misura="m" />
              <p className="imbarco__chi">{chiIncassa(partita, io, scelta)}</p>
            </>
          ) : (
            <ul className="imbarco__fasce" aria-label="Prezzi dei biglietti">
              {fasce.map((f) => (
                <li key={f.fascia} className={`imbarco__fascia imbarco__fascia--${f.fascia}`}>
                  <span className="imbarco__campione" aria-hidden="true" />
                  {f.fascia === 1 ? 'Vicino' : f.fascia === 2 ? 'Medio' : 'Lontano'} {f.prezzo === 0 ? 'gratis' : euro(f.prezzo)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
      <div className="centro-gioco__azioni">
        <Pulsante
          variante="ambra"
          icona="aereo"
          blocco={inviando ? 'Un attimo…' : meta === null ? 'Prima scegli la meta sul tabellone.' : null}
          onClick={() => meta !== null && onVola(meta)}
        >
          {arrivo ? `Vola ${destinazione(arrivo)}` : 'Vola'}
        </Pulsante>
        <Pulsante icona="chiudi" onClick={onAnnulla}>
          Annulla
        </Pulsante>
      </div>
    </div>
  );
}
