/*
 * Il pannello di controllo (/pannello): nessun pulsante del gioco ci porta, si apre scrivendo l'indirizzo.
 * Chiede il nome e la password scelti con «npm run pannello»; dentro, si vede e si cambia tutto delle stanze.
 */

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Icona } from '../ui/icone';
import { Marchio } from '../ui/Marchio';
import { Pulsante } from '../ui/Pulsante';
import { api, messaggioErrore, quandoScade } from './api';
import { Plancia } from './Plancia';
import './pannello.css';

type Fase = 'verifica' | 'spento' | 'accesso' | 'dentro' | 'irraggiungibile';

export default function PaginaPannello(): ReactNode {
  const [fase, setFase] = useState<Fase>('verifica');
  const [prova, setProva] = useState(0);

  useEffect(() => {
    const titolo = document.title;
    document.title = 'Pannello di controllo · PoorDown';
    return () => {
      document.title = titolo;
    };
  }, []);

  useEffect(() => {
    let attuale = true;
    api
      .stato()
      .then((s) => attuale && setFase(!s.attivo ? 'spento' : s.dentro ? 'dentro' : 'accesso'))
      .catch(() => attuale && setFase('irraggiungibile'));
    return () => {
      attuale = false;
    };
  }, [prova]);

  useEffect(() => quandoScade(() => setFase('accesso')), []);

  const riprova = () => setProva((n) => n + 1);

  if (fase === 'dentro') {
    return (
      <Plancia
        onEsci={() => {
          void api.esci().then(() => setFase('accesso'));
        }}
      />
    );
  }
  return (
    <main className="pc-ingresso">
      <div className="pc-ingresso__cartello">
        <Marchio className="pc-ingresso__marchio" />
        <p className="pc-ingresso__sopra">Pannello di controllo</p>
        {fase === 'verifica' && <p className="pc-ingresso__testo">Un attimo…</p>}
        {fase === 'accesso' && <Accesso onEntrato={() => setFase('dentro')} />}
        {fase === 'spento' && <Spento onRiprova={riprova} />}
        {fase === 'irraggiungibile' && (
          <>
            <p className="pc-ingresso__testo">Il server non risponde: controlla che PoorDown sia acceso.</p>
            <Pulsante variante="primario" largo onClick={riprova}>
              Riprova
            </Pulsante>
          </>
        )}
      </div>
    </main>
  );
}

function Accesso({ onEntrato }: { onEntrato: () => void }): ReactNode {
  const [nome, setNome] = useState('');
  const [password, setPassword] = useState('');
  const [errore, setErrore] = useState<string | null>(null);
  const [attesa, setAttesa] = useState(false);

  const entra = async (e: FormEvent) => {
    e.preventDefault();
    if (attesa) return;
    setAttesa(true);
    setErrore(null);
    try {
      await api.entra(nome, password);
      onEntrato();
    } catch (err) {
      setErrore(messaggioErrore(err));
      setPassword('');
    } finally {
      setAttesa(false);
    }
  };

  return (
    <form className="pc-accesso" onSubmit={(e) => void entra(e)}>
      <label className="pc-accesso__campo">
        <span className="etichetta">Nome</span>
        <input
          className="campo"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          autoComplete="username"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          maxLength={200}
          required
          autoFocus
        />
      </label>
      <label className="pc-accesso__campo">
        <span className="etichetta">Password</span>
        <input
          className="campo"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          maxLength={500}
          required
        />
      </label>
      <p className="pc-accesso__errore" role="alert">
        {errore}
      </p>
      <Pulsante type="submit" variante="primario" misura="grande" largo icona="lucchetto" disabled={attesa}>
        {attesa ? 'Controllo…' : 'Entra'}
      </Pulsante>
    </form>
  );
}

function Spento({ onRiprova }: { onRiprova: () => void }): ReactNode {
  return (
    <div className="pc-spento">
      <span className="pittogramma pc-spento__icona" aria-hidden="true">
        <Icona nome="lucchetto" />
      </span>
      <p className="pc-ingresso__testo">
        Il pannello non è ancora attivo su questo PC. Per accenderlo scegli un nome e una password: apri un terminale
        nella cartella di PoorDown e scrivi
      </p>
      <code className="pc-spento__comando">npm run pannello</code>
      <p className="pc-ingresso__testo">
        Con l’estensione di VS Code usa invece il comando «PoorDown: Imposta l’accesso al pannello di controllo».
      </p>
      <Pulsante variante="primario" largo onClick={onRiprova}>
        Fatto, riprova
      </Pulsante>
    </div>
  );
}
