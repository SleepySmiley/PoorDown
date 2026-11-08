import { createServer } from 'node:http';
import path from 'node:path';
import express from 'express';
import { Server } from 'socket.io';
import { NOME_GIOCO, VERSIONE, type EventiClient, type EventiServer, type InfoServer } from '@poordown/engine';
import { indirizziRete } from './rete';
import { collegaSito } from './sito';
import { AMBIENTE_REALE } from './stanze/ambiente';
import { Archivio, cartellaDati } from './stanze/archivio';
import { GestoreStanze } from './stanze/gestore';
import { collegaTempoReale, type DatiSocket } from './stanze/tempo-reale';

/** Ogni quanto si controllano le assenze in lobby e le stanze abbandonate. */
const MANUTENZIONE_MS = 5_000;

const sviluppo = process.argv.includes('--dev');
const porta = leggiPorta();

const app = express();
app.disable('x-powered-by');
const server = createServer(app);
const io = new Server<EventiClient, EventiServer, Record<string, never>, DatiSocket>(server, {
  serveClient: false,
  // I messaggi del gioco sono piccoli: un limite basso tiene lontani i pacchetti esagerati.
  maxHttpBufferSize: 100_000,
});

const gestore = new GestoreStanze(AMBIENTE_REALE);
const archivio = new Archivio(path.join(cartellaDati(), 'stanze.json'), gestore);
const stanzeRiprese = archivio.carica();
const tempoReale = collegaTempoReale(io, gestore, () => archivio.programma());
setInterval(() => tempoReale.manutenzione(), MANUTENZIONE_MS).unref();

// Prima di spegnersi salva le stanze, così le partite riprendono al riavvio.
for (const segnale of ['SIGINT', 'SIGTERM'] as const) {
  process.on(segnale, () => {
    archivio.salvaOra();
    process.exit(0);
  });
}

app.get('/api/info', (_req, res) => {
  const info: InfoServer = {
    nome: NOME_GIOCO,
    versione: VERSIONE,
    indirizzi: indirizziRete().map(({ ip }) => `http://${ip}:${porta}`),
  };
  res.json(info);
});

await collegaSito(app, server, sviluppo);

server.on('error', (errore: NodeJS.ErrnoException) => {
  if (errore.code === 'EADDRINUSE') {
    console.error(`\n  La porta ${porta} è già occupata: forse ${NOME_GIOCO} è già acceso in un'altra finestra.`);
    console.error('  Chiudi l\'altra finestra, oppure scegli un\'altra porta con la variabile PORT (vedi README).\n');
    process.exit(1);
  }
  throw errore;
});

server.listen(porta, stampaIndirizzi);

function leggiPorta(): number {
  const valore = Number(process.env.PORT ?? 3000);
  if (!Number.isInteger(valore) || valore < 1 || valore > 65535) {
    console.error(`  PORT non valida: "${process.env.PORT}". Usa un numero tra 1 e 65535.`);
    process.exit(1);
  }
  return valore;
}

function stampaIndirizzi(): void {
  const indirizzi = indirizziRete();
  const righe = [
    '',
    `  ${NOME_GIOCO} ${VERSIONE} è acceso${sviluppo ? ' (modalità sviluppo)' : ''}`,
    '',
    `  Su questo PC:   http://localhost:${porta}`,
  ];
  if (indirizzi.length === 0) {
    righe.push('  Per gli amici:  nessuna rete trovata, collega il PC al Wi-Fi o al cavo');
  } else {
    indirizzi.forEach(({ scheda, ip }, i) => {
      righe.push(`  ${i === 0 ? 'Per gli amici: ' : '               '} http://${ip}:${porta}   (${scheda})`);
    });
  }
  if (stanzeRiprese > 0) {
    righe.push('', `  Stanze riprese dall'ultima volta: ${stanzeRiprese}`);
  }
  righe.push(
    '',
    '  Se Windows chiede il permesso del firewall, consenti l\'accesso alle reti private.',
    '  Per spegnere: Ctrl+C',
    '',
  );
  console.log(righe.join('\n'));
}
