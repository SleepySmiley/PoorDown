/*
 * Le rotte HTTP del pannello di controllo, sotto /api/pannello. La pagina (/pannello) le chiama con la sessione
 * nell'intestazione Authorization: niente cookie, quindi un altro sito non può usarle al posto di chi è entrato.
 * Ogni modifica arriva subito ai giocatori (come una mossa) e si annota nella finestra del server.
 */

import express, { type ErrorRequestHandler, type Express, type Request, type Response } from 'express';
import type { StatoAccessoPannello } from '@poordown/engine';
import type { GestoreStanze } from '../stanze/gestore';
import { testo } from '../stanze/lettura';
import type { TempoReale } from '../stanze/tempo-reale';
import { Accessi } from './accesso';
import { leggiComandoPannello } from './lettura';

/** Dopo una password sbagliata si risponde con calma: rallenta chi prova a indovinare. */
const PAUSA_SBAGLIATA_MS = 600;
/** Il corpo più grande accettato: basta anche per lo stato completo scritto a mano. */
const LIMITE_CORPO = '2mb';

function sessione(req: Request): string | undefined {
  const intestazione = req.headers.authorization;
  return intestazione?.startsWith('Bearer ') ? intestazione.slice(7) : undefined;
}

/** Da dove arriva la richiesta: chi passa dal tunnel ha il suo indirizzo vero nell'intestazione di Cloudflare. */
function chi(req: Request): string {
  const daInternet = req.headers['cf-connecting-ip'];
  return typeof daInternet === 'string' ? daInternet : (req.socket.remoteAddress ?? '?');
}

function errore(res: Response, stato: number, messaggio: string): void {
  res.status(stato).json({ messaggio });
}

const pausa = (ms: number) => new Promise((risolvi) => setTimeout(risolvi, ms));

export function collegaPannello(app: Express, gestore: GestoreStanze, tempoReale: TempoReale, accessi = new Accessi()): void {
  const rotte = express.Router();
  rotte.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Robots-Tag', 'noindex');
    next();
  });
  rotte.use(express.json({ limit: LIMITE_CORPO }));

  rotte.get('/stato', (req, res) => {
    const stato: StatoAccessoPannello = { attivo: accessi.attivo(), dentro: accessi.valida(sessione(req)) };
    res.json(stato);
  });

  rotte.post('/entra', async (req, res) => {
    const nome = testo(req.body, 'nome', 200);
    const password = testo(req.body, 'password', 500);
    if (nome === null || password === null) {
      errore(res, 400, 'Scrivi il nome e la password.');
      return;
    }
    const esito = await accessi.entra(nome, password, chi(req));
    if (esito.ok) {
      console.log(`  Pannello: accesso riuscito da ${chi(req)}.`);
      res.json({ sessione: esito.sessione });
      return;
    }
    switch (esito.motivo) {
      case 'spento':
        errore(res, 403, 'Il pannello non è attivo su questo server.');
        return;
      case 'occupato':
        errore(res, 503, 'Il server è occupato: riprova tra un attimo.');
        return;
      case 'bloccato': {
        const minuti = Math.ceil(esito.attesaMs / 60_000);
        res.setHeader('Retry-After', String(Math.ceil(esito.attesaMs / 1000)));
        errore(res, 429, `Troppi tentativi sbagliati: riprova tra ${minuti} ${minuti === 1 ? 'minuto' : 'minuti'}.`);
        return;
      }
      case 'sbagliate':
        console.log(`  Pannello: nome o password sbagliati da ${chi(req)}.`);
        await pausa(PAUSA_SBAGLIATA_MS);
        errore(res, 401, 'Nome o password sbagliati.');
        return;
    }
  });

  // Da qui serve una sessione valida.
  rotte.use((req, res, next) => {
    if (!accessi.valida(sessione(req))) {
      errore(res, 401, 'Sessione scaduta: rientra nel pannello.');
      return;
    }
    next();
  });

  rotte.post('/esci', (req, res) => {
    accessi.esci(sessione(req));
    res.json({ ok: true });
  });

  rotte.get('/stanze', (_req, res) => {
    res.json(gestore.elencoPannello());
  });

  rotte.get('/stanze/:codice', (req, res) => {
    const stanza = gestore.trova(req.params.codice);
    if (!stanza) {
      errore(res, 404, 'Questa stanza non c’è più.');
      return;
    }
    res.json(stanza.dettaglioPannello());
  });

  rotte.post('/stanze/:codice/comando', (req, res) => {
    const stanza = gestore.trova(req.params.codice);
    if (!stanza) {
      errore(res, 404, 'Questa stanza non c’è più.');
      return;
    }
    const comando = leggiComandoPannello(req.body);
    if (!comando) {
      errore(res, 400, 'Comando non valido.');
      return;
    }
    const problema = stanza.pannello(comando);
    tempoReale.aggiorna(stanza);
    if (problema) {
      errore(res, 400, problema);
      return;
    }
    console.log(`  Pannello: «${comando.tipo}» nella stanza ${stanza.codice.toUpperCase()}.`);
    res.json(stanza.dettaglioPannello());
  });

  rotte.post('/stanze/:codice/annulla', (req, res) => {
    const stanza = gestore.trova(req.params.codice);
    if (!stanza) {
      errore(res, 404, 'Questa stanza non c’è più.');
      return;
    }
    const problema = stanza.annullaPannello();
    tempoReale.aggiorna(stanza);
    if (problema) {
      errore(res, 400, problema);
      return;
    }
    console.log(`  Pannello: annullata l'ultima modifica nella stanza ${stanza.codice.toUpperCase()}.`);
    res.json(stanza.dettaglioPannello());
  });

  rotte.post('/stanze/:codice/chiudi', (req, res) => {
    const stanza = gestore.chiudi(req.params.codice);
    if (!stanza) {
      errore(res, 404, 'Questa stanza non c’è più.');
      return;
    }
    tempoReale.chiusa(stanza);
    console.log(`  Pannello: chiusa la stanza ${stanza.codice.toUpperCase()}.`);
    res.json({ ok: true });
  });

  rotte.use((_req, res) => errore(res, 404, 'Indirizzo sconosciuto.'));

  // JSON rovinato, corpo troppo grande, errori imprevisti: sempre una risposta JSON, mai la pagina di errore di Express.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Express riconosce il gestore degli errori dai quattro argomenti.
  const quandoSbaglia: ErrorRequestHandler = (err: unknown, _req, res, _next) => {
    const stato = typeof err === 'object' && err !== null && 'status' in err && typeof err.status === 'number' ? err.status : 500;
    if (stato >= 500) console.error('  Pannello: errore imprevisto:', err);
    const messaggio =
      stato === 413 ? 'Lo stato è troppo grande.' : stato === 400 ? 'Il JSON non si legge: controlla virgole e parentesi.' : 'Qualcosa è andato storto sul server.';
    errore(res, stato, messaggio);
  };
  rotte.use(quandoSbaglia);

  app.use('/api/pannello', rotte);
}
