/* La stanza scelta: testata con codice e stato, poi le sezioni (giocatori, proprietà, turno e dadi…). */

import { useState, type ReactNode } from 'react';
import { descriviVoce, tabellone, type DettaglioPannello, type Stato } from '@poordown/engine';
import { Chip } from '../ui/Chip';
import { Pulsante } from '../ui/Pulsante';
import { Palette, Pedina } from '../ui/comuni';
import { CampoNome, PulsanteConferma } from './campi';
import { GiocatoriPartita } from './Giocatori';
import { Partita } from './Partita';
import type { Esegui } from './Plancia';
import { Proprieta } from './Proprieta';
import { StatoCompleto } from './StatoCompleto';
import { TurnoEDadi } from './TurnoEDadi';

type Sezione = 'giocatori' | 'proprieta' | 'turno' | 'partita' | 'registro' | 'stato';

const SEZIONI: Record<Sezione, string> = {
  giocatori: 'Giocatori',
  proprieta: 'Proprietà',
  turno: 'Turno e dadi',
  partita: 'Regole e fine',
  registro: 'Registro',
  stato: 'Stato completo',
};

export function SchedaStanza({
  d,
  esegui,
  onAnnulla,
  onChiudi,
}: {
  d: DettaglioPannello;
  esegui: Esegui;
  onAnnulla: () => void;
  onChiudi: () => void;
}): ReactNode {
  const [sezione, setSezione] = useState<Sezione>('giocatori');
  const partita = d.partita;
  const sezioni: Sezione[] = partita ? ['giocatori', 'proprieta', 'turno', 'partita', 'registro', 'stato'] : ['giocatori', 'registro'];
  const attuale = sezioni.includes(sezione) ? sezione : 'giocatori';
  const inCorso = d.fase === 'partita' && partita?.fase === 'in_corso';
  const vincitore = partita?.giocatori.find((g) => g.id === partita.vincitore);

  return (
    <section className="pc-stanza" aria-label={`Stanza ${d.codice.toUpperCase()}`}>
      <header className="pc-stanza__testa">
        <div className="pc-stanza__codice">
          <span className="etichetta">Stanza</span>
          <Palette testo={d.codice.toUpperCase()} misura="l" />
        </div>
        <div className="pc-stanza__stato">
          <span className="pc-stanza__chip">
            <Chip tono={d.fase === 'partita' ? 'ambra' : d.fase === 'lobby' ? 'segnale' : 'neutro'}>
              {d.fase === 'lobby' ? 'In attesa' : d.fase === 'partita' ? 'In partita' : 'Finita'}
            </Chip>
            <Chip>{d.impostazioni.stanzaPrivata ? 'Privata' : 'Pubblica'}</Chip>
            <Chip icona="mappa">{tabellone(d.impostazioni.mappa).nome}</Chip>
            {d.inPausa && <Chip tono="rosso">In pausa: nessuno è collegato</Chip>}
            {d.spettatori > 0 && <Chip icona="occhio">{d.spettatori} a guardare</Chip>}
          </span>
          {partita && inCorso && <TurnoBreve partita={partita} />}
          {partita?.fase === 'finita' && (
            <span className="pc-stanza__riga">
              Partita finita{vincitore ? `: vince ${vincitore.nome}` : ''}
              {partita.squadraVincitrice !== null ? ` (${partita.squadre[partita.squadraVincitrice] ?? 'squadra'})` : ''}
            </span>
          )}
        </div>
        <div className="pc-stanza__azioni">
          <Pulsante
            variante="secondario"
            misura="piccolo"
            icona="aggiorna"
            blocco={d.annullabile ? null : 'Niente da annullare: dopo l’ultima modifica la partita è andata avanti'}
            onClick={onAnnulla}
          >
            Annulla l’ultima modifica
          </Pulsante>
          <PulsanteConferma onConferma={onChiudi} conferma="Chiudo la stanza?">
            Chiudi la stanza
          </PulsanteConferma>
        </div>
      </header>

      <nav className="pc-sezioni" aria-label="Sezioni">
        {sezioni.map((s) => (
          <button key={s} type="button" className="pc-sezioni__voce" aria-current={s === attuale} onClick={() => setSezione(s)}>
            {SEZIONI[s]}
          </button>
        ))}
      </nav>

      <div className="pc-stanza__corpo">
        {attuale === 'giocatori' &&
          (partita ? <GiocatoriPartita d={d} partita={partita} esegui={esegui} /> : <PostiLobby d={d} esegui={esegui} />)}
        {attuale === 'proprieta' && partita && <Proprieta partita={partita} esegui={esegui} />}
        {attuale === 'turno' && partita && <TurnoEDadi d={d} partita={partita} esegui={esegui} />}
        {attuale === 'partita' && partita && <Partita partita={partita} esegui={esegui} />}
        {attuale === 'registro' && <RegistroStanza d={d} />}
        {attuale === 'stato' && partita && <StatoCompleto partita={partita} esegui={esegui} />}
      </div>
    </section>
  );
}

const FASI_TURNO = { lancio: 'deve tirare i dadi', prigione: 'è in prigione', dopo_lancio: 'ha tirato' } as const;

function TurnoBreve({ partita }: { partita: Stato }): ReactNode {
  const g = partita.giocatori.find((x) => x.id === partita.turno.giocatore);
  if (!g) return null;
  return (
    <span className="pc-stanza__riga">
      Turno {partita.turno.numero} · <Pedina colore={g.colore} className="pedina--mini" /> <strong>{g.nome}</strong>{' '}
      {FASI_TURNO[partita.turno.fase]}
      {partita.asta ? ' · asta in corso' : ''}
    </span>
  );
}

/** In lobby: chi è seduto, con nome, host ed espulsione. */
function PostiLobby({ d, esegui }: { d: DettaglioPannello; esegui: Esegui }): ReactNode {
  if (d.posti.length === 0) return <p className="pc-vuoto">Nessuno è seduto al tavolo.</p>;
  return (
    <ul className="pc-posti">
      {d.posti.map((p) => (
        <li key={p.id} className="pc-posto">
          <Pedina colore={p.colore} className="pedina--media" />
          <CampoNome
            valore={p.nome}
            etichetta={`Nome di ${p.nome}`}
            onSalva={(nome) => esegui({ tipo: 'nome', giocatore: p.id, nome }, `Ora si chiama ${nome}.`)}
          />
          <span className="pc-posto__chip">
            {p.id === d.host && <Chip tono="segnale">Host</Chip>}
            {p.bot && <Chip icona="robot">Bot</Chip>}
            {!p.connesso && <Chip tono="rosso">Scollegato</Chip>}
          </span>
          <span className="pc-posto__azioni">
            {p.id !== d.host && !p.bot && (
              <Pulsante misura="piccolo" onClick={() => void esegui({ tipo: 'host', giocatore: p.id }, `${p.nome} ora è l’host.`)}>
                Rendi host
              </Pulsante>
            )}
            <PulsanteConferma onConferma={() => void esegui({ tipo: 'espelli', giocatore: p.id }, `${p.nome} è fuori dalla stanza.`)}>
              Espelli
            </PulsanteConferma>
          </span>
        </li>
      ))}
    </ul>
  );
}

function RegistroStanza({ d }: { d: DettaglioPannello }): ReactNode {
  const righe = d.registro
    .map((v) => ({ n: v.n, quando: v.quando, testo: descriviVoce(v.evento, d.partita) }))
    .filter((r): r is { n: number; quando: number; testo: string } => r.testo !== null)
    .reverse();
  if (righe.length === 0) return <p className="pc-vuoto">Il registro è vuoto.</p>;
  return (
    <ol className="pc-registro">
      {righe.map((r) => (
        <li key={r.n} className="pc-registro__riga">
          <time className="pc-registro__ora">{new Date(r.quando).toLocaleTimeString('it-IT')}</time>
          <span>{r.testo}</span>
        </li>
      ))}
    </ol>
  );
}
