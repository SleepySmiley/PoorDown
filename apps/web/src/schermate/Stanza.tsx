/*
 * La pagina /stanza/<codice>.
 * - Chi arriva da un link vede prima la pagina di ingresso (la home con «Entra nella partita»).
 * - Chi arriva dalla home, o ricarica la pagina, entra subito.
 * - Poi lobby o partita, a seconda della fase. Espulsione e stanza chiusa riportano alla home con un avviso.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { IdGiocatore } from '@poordown/engine';
import { statoNavigazione, vai } from '../navigazione';
import { collegamento, ingressi } from '../rete/sessione';
import { useCollegamento } from '../rete/useCollegamento';
import { avvisa } from '../ui/avvisi';
import { Dado } from '../ui/comuni';
import { Gioco } from './Gioco';
import { Home } from './Home';
import { Lobby } from './Lobby';

const CONSIGLI = [
  'Condividi il link della stanza con gli amici: chi lo apre entra nella partita.',
  'Dal telefono basta inquadrare il codice QR della stanza.',
  'A volte conviene restare in prigione: intanto non paghi affitti.',
  'Le città più care non sono sempre le più convenienti: conta quanto spesso ci si ferma.',
  'Pensa alla tua mossa mentre giocano gli altri: la partita scorre più veloce.',
  'Con meno soldi iniziali la partita è più difficile.',
  'Usa la chat per metterti d’accordo con gli altri giocatori.',
];

function Caricamento({ rete }: { rete: 'in_corso' | 'attivo' | 'perso' }): ReactNode {
  const [consiglio] = useState(() => CONSIGLI[Math.floor(Math.random() * CONSIGLI.length)]);
  return (
    <div className="caricamento" role="status">
      <div className="caricamento__dado">
        <Dado valore={5} />
      </div>
      <p className="caricamento__titolo">
        {rete === 'perso' ? 'Non riesco a raggiungere il server…' : 'Entro nella stanza…'}
      </p>
      <p className="caricamento__consiglio">
        <b>Consiglio</b> {consiglio}
      </p>
    </div>
  );
}

/** Esce dalla stanza e torna alla home. In lobby libera il posto; in partita il posto resta. */
function esciDallaStanza(avviso?: string): void {
  ingressi.dimentica();
  void collegamento.esci();
  if (avviso) avvisa(avviso);
  vai('/');
}

export function Stanza({ codice }: { codice: string }): ReactNode {
  const stato = useCollegamento(collegamento);
  const [dentro, setDentro] = useState(() => ingressi.dentro(codice) || statoNavigazione().dallaHome === true);
  const ultimoIo = useRef<IdGiocatore | null>(null);

  useEffect(() => {
    if (!dentro) return;
    ingressi.segna(codice);
    if (collegamento.codiceSeguito() !== codice) void collegamento.entra(codice);
  }, [dentro, codice]);

  // Stanza inesistente, chiusa o scaduta: si torna alla home con il motivo.
  useEffect(() => {
    if (dentro && stato.avviso) esciDallaStanza(stato.avviso);
  }, [dentro, stato.avviso]);

  useEffect(() => {
    if (stato.io) ultimoIo.current = stato.io;
  }, [stato.io]);

  // Espulsione: il registro dice che il mio posto è stato tolto dall'host.
  useEffect(
    () =>
      collegamento.ascoltaVoci((voci) => {
        const io = ultimoIo.current;
        if (io && voci.some((v) => v.evento.tipo === 'uscita' && v.evento.motivo === 'espulsione' && v.evento.giocatore === io)) {
          ultimoIo.current = null;
          esciDallaStanza('Sei stato espulso dalla stanza.');
        }
      }),
    [],
  );

  if (!dentro) return <Home invito={codice} onEntra={() => setDentro(true)} />;

  const stanza = stato.stanza;
  if (!stanza || stanza.codice !== codice) return <Caricamento rete={stato.rete} />;

  const comuni = {
    stanza,
    io: stato.io,
    registro: stato.registro,
    chat: stato.chat,
    scrivono: stato.scrivono,
    onEsci: () => esciDallaStanza(),
  };
  return (
    <>
      {stanza.fase === 'lobby' ? <Lobby {...comuni} /> : <Gioco {...comuni} />}
      {stato.rete === 'perso' && (
        <p className="rete-persa" role="alert">
          Collegamento perso con il server. Riprovo da solo: controlla che il PC con PoorDown sia acceso e sulla stessa rete.
        </p>
      )}
    </>
  );
}
