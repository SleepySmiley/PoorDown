import { createServer } from 'node:http';
import path from 'node:path';
import express from 'express';
import { Server } from 'socket.io';
import { NOME_GIOCO, VERSIONE, type EventiClient, type EventiServer, type InfoServer } from '@poordown/engine';
import { avvisaGenitore, conGenitore, spegniConIlGenitore } from './genitore';
import { collegaPannello } from './pannello/rotte';
import { apriBrowser, indirizziRete } from './rete';
import { collegaSito } from './sito';
import { AMBIENTE_REALE } from './stanze/ambiente';
import { Archivio, cartellaDati } from './stanze/archivio';
import { GestoreStanze } from './stanze/gestore';
import { collegaTempoReale, type DatiSocket } from './stanze/tempo-reale';
import { Tunnel } from './tunnel';

/** Ogni quanto si controllano le assenze in lobby e le stanze abbandonate. */
const MANUTENZIONE_MS = 5_000;

const sviluppo = process.argv.includes('--dev');
const porta = leggiPorta();
// In sviluppo il sito lo serve Vite, che non va messo su internet: il gioco online vale solo per la versione compilata.
const online = process.argv.includes('--online') && !sviluppo;
if (process.argv.includes('--online') && sviluppo) {
  console.log('\n  Il gioco online non si accende in modalità sviluppo: usa "npm run online".');
}

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
setInterval(() => {
  // Un errore imprevisto non deve spegnere il server (e tutte le partite): si annota e si riprova al giro dopo.
  try {
    tempoReale.manutenzione();
  } catch (errore) {
    console.error('  Errore nella manutenzione delle stanze:', errore);
  }
}, MANUTENZIONE_MS).unref();

// Prima di spegnersi salva le stanze, così le partite riprendono al riavvio.
function spegni(): void {
  archivio.salvaOra();
  process.exit(0);
}
// SIGHUP è la finestra del terminale chiusa su Windows (il modo normale di spegnere dopo il doppio clic).
for (const segnale of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) process.on(segnale, spegni);
// Dentro VS Code i segnali non servono (su Windows un processo figlio si chiude solo a forza): lo chiede l'estensione.
spegniConIlGenitore(spegni);

const tunnel = online ? new Tunnel(porta, cartellaDati(), avvisiTunnel()) : null;
// Il tunnel è un programma a parte: si spegne con il server.
process.on('exit', () => tunnel?.ferma());

app.get('/api/info', (req, res) => {
  // Chi arriva da internet passa dal tunnel, che aggiunge questa intestazione: gli indirizzi di casa non gli servono.
  const daInternet = req.headers['cf-connecting-ip'] !== undefined;
  const info: InfoServer = {
    nome: NOME_GIOCO,
    versione: VERSIONE,
    indirizzi: daInternet ? [] : indirizziRete().map(({ ip }) => `http://${ip}:${porta}`),
    online,
    pubblico: tunnel?.indirizzo ?? null,
  };
  // Il browser la richiede finché il link online non è pronto: niente copie vecchie.
  res.setHeader('Cache-Control', 'no-store');
  res.json(info);
});

// Il pannello di controllo (/pannello): chiede il nome e la password scelti con "npm run pannello".
collegaPannello(app, gestore, tempoReale);

await collegaSito(app, server, sviluppo);

server.on('error', (errore: NodeJS.ErrnoException) => {
  if (errore.code === 'EADDRINUSE') {
    avvisaGenitore({ tipo: 'porta-occupata', porta });
    console.error(`\n  La porta ${porta} è già occupata: forse ${NOME_GIOCO} è già acceso in un'altra finestra.`);
    console.error('  Chiudi l\'altra finestra, oppure scegli un\'altra porta con la variabile PORT (vedi README).\n');
    process.exit(1);
  }
  throw errore;
});

server.listen(porta, () => {
  stampaIndirizzi();
  avvisaGenitore({ tipo: 'acceso', porta, indirizzi: indirizziRete().map(({ ip }) => `http://${ip}:${porta}`) });
  // Avvio con doppio clic (scripts/avvia.js): il browser si apre quando il server è pronto.
  if (process.env.POORDOWN_APRI === '1') apriBrowser(`http://localhost:${porta}`);
  tunnel?.avvia();
});

function leggiPorta(): number {
  const valore = Number(process.env.PORT ?? 3000);
  if (!Number.isInteger(valore) || valore < 1 || valore > 65535) {
    console.error(`  PORT non valida: "${process.env.PORT}". Usa un numero tra 1 e 65535.`);
    process.exit(1);
  }
  return valore;
}

/** Una riga del riepilogo: etichetta e valore incolonnati. */
function voce(etichetta: string, valore: string): string {
  return `  ${etichetta.padEnd(16)}${valore}`;
}

function stampaIndirizzi(): void {
  const indirizzi = indirizziRete();
  // Con il gioco online il link da mandare è quello online: l'indirizzo di rete vale solo per chi è in casa.
  const perLaRete = online ? 'Rete di casa:' : 'Per gli amici:';
  const righe = ['', `  ${NOME_GIOCO} ${VERSIONE} è acceso${sviluppo ? ' (modalità sviluppo)' : ''}`, '', voce('Su questo PC:', `http://localhost:${porta}`)];
  if (indirizzi.length === 0) {
    righe.push(voce(perLaRete, 'nessuna rete trovata, collega il PC al Wi-Fi o al cavo'));
  } else {
    indirizzi.forEach(({ scheda, ip }, i) => righe.push(voce(i === 0 ? perLaRete : '', `http://${ip}:${porta}   (${scheda})`)));
  }
  if (online) righe.push(voce('Online:', 'preparo il link per chi gioca da lontano…'));
  if (stanzeRiprese > 0) {
    righe.push('', `  Stanze riprese dall'ultima volta: ${stanzeRiprese}`);
  }
  righe.push(
    '',
    '  Se Windows chiede il permesso del firewall, consenti l\'accesso alle reti private.',
    comeSpegnere(),
    '',
  );
  console.log(righe.join('\n'));
}

function comeSpegnere(): string {
  if (conGenitore()) return '  Per spegnere: comando «PoorDown: Spegni il gioco», oppure chiudi VS Code';
  // Dopo il doppio clic la finestra è solo di PoorDown: chiuderla è il modo più semplice.
  return process.env.POORDOWN_APRI === '1' ? '  Per spegnere: chiudi questa finestra' : '  Per spegnere: Ctrl+C';
}

function avvisiTunnel(): ConstructorParameters<typeof Tunnel>[2] {
  let ultimo: string | null = null;
  return {
    pronto(indirizzo) {
      const cambiato = ultimo !== null && ultimo !== indirizzo;
      ultimo = indirizzo;
      avvisaGenitore({ tipo: 'online', indirizzo });
      console.log(
        [
          '',
          voce('Online:', `${indirizzo}${cambiato ? '   (link nuovo: quello di prima non funziona più)' : ''}`),
          '  Il link della stanza (pulsante «Copia») funziona da qualunque posto.',
          '',
        ].join('\n'),
      );
    },
    problema(motivo) {
      avvisaGenitore({ tipo: 'problema-online', motivo });
      console.log(`\n  Online: non riesco ad aprire il link (${motivo}). Riprovo da solo; intanto si gioca sulla rete di casa.\n`);
    },
    nota(testo) {
      console.log(`\n  ${testo}\n`);
    },
  };
}
