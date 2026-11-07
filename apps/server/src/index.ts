import { createServer } from 'node:http';
import express from 'express';
import { Server } from 'socket.io';
import { NOME_GIOCO, VERSIONE, type EventiClient, type EventiServer, type InfoServer } from '@poordown/engine';
import { indirizziRete } from './rete';
import { collegaSito } from './sito';

const sviluppo = process.argv.includes('--dev');
const porta = leggiPorta();

const app = express();
app.disable('x-powered-by');
const server = createServer(app);
const io = new Server<EventiClient, EventiServer>(server, { serveClient: false });

app.get('/api/info', (_req, res) => {
  const info: InfoServer = {
    nome: NOME_GIOCO,
    versione: VERSIONE,
    indirizzi: indirizziRete().map(({ ip }) => `http://${ip}:${porta}`),
  };
  res.json(info);
});

const inviaPresenze = () => io.emit('presenze', io.of('/').sockets.size);
io.on('connection', (socket) => {
  inviaPresenze();
  socket.on('disconnect', inviaPresenze);
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
  righe.push(
    '',
    '  Se Windows chiede il permesso del firewall, consenti l\'accesso alle reti private.',
    '  Per spegnere: Ctrl+C',
    '',
  );
  console.log(righe.join('\n'));
}
