/*
 * L'avvio con doppio clic («Avvia PoorDown.cmd» lancia questo file):
 * 1. controlla la versione di Node.js;
 * 2. se PoorDown è già acceso su questo PC apre solo il browser;
 * 3. installa i pacchetti la prima volta e quando cambiano (dopo un aggiornamento);
 * 4. compila il sito (in silenzio) e accende il server, che apre il browser appena è pronto.
 * Per spegnere si chiude la finestra (o Ctrl+C): il server salva le partite prima di uscire.
 */

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// I comandi npm passano dalla shell (su Windows npm è un .cmd), scritti come stringa unica e fissa.
const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const porta = Number(process.env.PORT ?? 3000);
const indirizzo = `http://localhost:${porta}`;

function scrivi(...righe) {
  console.log(['', ...righe.map((r) => `  ${r}`), ''].join('\n'));
}

function versioneAdatta() {
  const [maggiore = 0, minore = 0] = process.versions.node.split('.').map(Number);
  return maggiore > 22 || (maggiore === 22 && minore >= 12);
}

/** Risponde un PoorDown su questa porta? */
async function giaAcceso() {
  try {
    const risposta = await fetch(`${indirizzo}/api/info`, { signal: AbortSignal.timeout(1500) });
    const info = await risposta.json();
    return info?.nome === 'PoorDown';
  } catch {
    return false;
  }
}

/** I pacchetti mancano, o package-lock.json è cambiato dopo l'ultima installazione. */
function pacchettiDaInstallare() {
  const installati = path.join(radice, 'node_modules', '.package-lock.json');
  if (!existsSync(installati)) return true;
  return statSync(path.join(radice, 'package-lock.json')).mtimeMs > statSync(installati).mtimeMs;
}

function apriBrowser() {
  const comando =
    process.platform === 'win32'
      ? spawn('cmd', ['/c', `start "" "${indirizzo}"`], { windowsVerbatimArguments: true, stdio: 'ignore', detached: true })
      : spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [indirizzo], { stdio: 'ignore', detached: true });
  comando.on('error', () => scrivi(`Apri il browser su ${indirizzo}`));
  comando.unref();
}

if (!versioneAdatta()) {
  scrivi(
    `Questa versione di Node.js (${process.versions.node}) è troppo vecchia per PoorDown: serve la 22.12 o più recente.`,
    'Scarica la versione LTS da https://nodejs.org, installala e poi riapri «Avvia PoorDown».',
  );
  process.exit(1);
}

if (await giaAcceso()) {
  scrivi(`PoorDown è già acceso su questo PC: apro il browser su ${indirizzo}.`, 'Per spegnerlo chiudi la sua finestra.');
  apriBrowser();
  process.exit(0);
}

if (pacchettiDaInstallare()) {
  scrivi('Scarico i pacchetti che servono a PoorDown: la prima volta ci vuole qualche minuto e serve internet.');
  const installazione = spawnSync('npm install --no-audit --no-fund', { cwd: radice, stdio: 'inherit', shell: true });
  if (installazione.status !== 0) {
    scrivi('L’installazione non è riuscita. Controlla la connessione a internet e riprova.');
    process.exit(1);
  }
}

scrivi('Preparo il sito…');
// La compilazione elenca decine di file: si mostra solo se qualcosa va storto.
const compilazione = spawnSync('npm run build', { cwd: radice, encoding: 'utf8', shell: true });
if (compilazione.status !== 0) {
  console.log(compilazione.stdout, compilazione.stderr);
  scrivi('La preparazione del sito non è riuscita: i dettagli sono qui sopra.');
  process.exit(1);
}

scrivi('Accendo PoorDown: il browser si apre da solo appena è pronto.');
const server = spawn('npm run start --silent -w @poordown/server', {
  cwd: radice,
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, POORDOWN_APRI: '1' },
});
// Ctrl+C e la chiusura della finestra arrivano anche al server, che salva le partite e si spegne: si aspetta lui.
for (const segnale of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(segnale, () => {});
server.on('exit', (codice) => process.exit(codice ?? 0));
