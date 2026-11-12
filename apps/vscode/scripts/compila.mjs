/*
 * Prepara l'estensione in apps/vscode/dist, da cui nasce il pacchetto .vsix (npm run pacchetto):
 * - estensione.js: il codice dell'estensione, in CommonJS come lo carica VS Code;
 * - server.mjs: il server del gioco con le regole e i pacchetti che usa, in un file solo;
 * - web/: il sito compilato (lo stesso di `npm run build`);
 * - LICENZE-DI-TERZE-PARTI.txt: le licenze dei pacchetti finiti nell'estensione e nel sito.
 */

import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const cartella = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const radice = path.resolve(cartella, '..', '..');
const dist = path.join(cartella, 'dist');

function scrivi(...righe) {
  console.log(righe.map((r) => `  ${r}`).join('\n'));
}

rmSync(dist, { recursive: true, force: true });

// 1. Il sito. Il comando npm passa dalla shell (su Windows npm è un .cmd), scritto come stringa fissa.
scrivi('Compilo il sito…');
const sito = spawnSync('npm run build -w @poordown/web', { cwd: radice, encoding: 'utf8', shell: true });
if (sito.status !== 0) {
  console.log(sito.stdout, sito.stderr);
  scrivi('La compilazione del sito non è riuscita: i dettagli sono qui sopra.');
  process.exit(1);
}
cpSync(path.join(radice, 'apps', 'web', 'dist'), path.join(dist, 'web'), { recursive: true });

// 2. Estensione e server.
scrivi('Compilo l’estensione e il server…');
// absWorkingDir: nel metafile i percorsi dei file inclusi sono relativi alla radice del progetto.
const comune = { absWorkingDir: radice, bundle: true, platform: 'node', target: 'node22', legalComments: 'none', metafile: true, logLevel: 'warning' };
const estensione = await build({
  ...comune,
  entryPoints: [path.join(cartella, 'src', 'estensione.ts')],
  outfile: path.join(dist, 'estensione.js'),
  format: 'cjs',
  external: ['vscode'],
});
const server = await build({
  ...comune,
  entryPoints: [path.join(radice, 'apps', 'server', 'src', 'index.ts')],
  outfile: path.join(dist, 'server.mjs'),
  format: 'esm',
  // vite serve solo in sviluppo (--dev, mai dall'estensione); bufferutil e utf-8-validate sono facoltativi per ws.
  external: ['vite', 'bufferutil', 'utf-8-validate'],
  // Express e Socket.IO sono in CommonJS: dentro un modulo ES servono require, __filename e __dirname.
  banner: {
    js: [
      "import { createRequire as __poordownRequire } from 'node:module';",
      "import { fileURLToPath as __poordownPercorso } from 'node:url';",
      'const require = __poordownRequire(import.meta.url);',
      'const __filename = __poordownPercorso(import.meta.url);',
      "const __dirname = __poordownPercorso(new URL('.', import.meta.url));",
    ].join('\n'),
  },
});

// 3. Le licenze: i pacchetti usati da estensione e server (dai file che esbuild ha incluso) e quelli del sito.
scrivi('Raccolgo le licenze…');
const pacchetti = new Map();

/** La cartella del pacchetto che contiene questo file di node_modules. */
function cartellaPacchetto(file) {
  const parti = path.resolve(radice, file).split(path.sep);
  const indice = parti.lastIndexOf('node_modules');
  if (indice < 0) return null;
  const nome = parti[indice + 1]?.startsWith('@') ? 2 : 1;
  return parti.slice(0, indice + 1 + nome).join(path.sep);
}

function aggiungi(cartellaDelPacchetto) {
  const file = path.join(cartellaDelPacchetto, 'package.json');
  if (!existsSync(file)) return null;
  const dati = JSON.parse(readFileSync(file, 'utf8'));
  if (!dati.name || dati.name.startsWith('@poordown/')) return dati;
  const chiave = `${dati.name}@${dati.version}`;
  if (!pacchetti.has(chiave)) pacchetti.set(chiave, { nome: dati.name, versione: dati.version, licenza: dati.license, cartella: cartellaDelPacchetto });
  return dati;
}

for (const { metafile } of [estensione, server]) {
  for (const file of Object.keys(metafile.inputs)) {
    const trovata = cartellaPacchetto(file);
    if (trovata) aggiungi(trovata);
  }
}

/** Dove Node troverebbe il pacchetto `nome` cercandolo da `da`. */
function trova(nome, da) {
  for (let qui = da; ; qui = path.dirname(qui)) {
    const candidata = path.join(qui, 'node_modules', nome);
    if (existsSync(path.join(candidata, 'package.json'))) return candidata;
    if (path.dirname(qui) === qui) return null;
  }
}

// Il sito: le dipendenze di apps/web con le loro, e i caratteri importati (in main.tsx).
const web = path.join(radice, 'apps', 'web');
const datiWeb = JSON.parse(readFileSync(path.join(web, 'package.json'), 'utf8'));
const caratteri = [...readFileSync(path.join(web, 'src', 'main.tsx'), 'utf8').matchAll(/'(@fontsource[^/']*\/[^/']+)\//g)].map((m) => m[1]);
const daVisitare = [...Object.keys(datiWeb.dependencies ?? {}), ...caratteri].map((nome) => [nome, web]);
const visti = new Set();
while (daVisitare.length > 0) {
  const [nome, da] = daVisitare.pop();
  const trovata = trova(nome, da);
  if (!trovata || visti.has(trovata)) continue;
  visti.add(trovata);
  const dati = aggiungi(trovata);
  for (const dipendenza of Object.keys(dati?.dependencies ?? {})) daVisitare.push([dipendenza, trovata]);
}

function testoLicenza(cartellaDelPacchetto) {
  const file = readdirSync(cartellaDelPacchetto).find((f) => /^(licen[cs]e|copying)(\.|$)/i.test(f));
  return file ? readFileSync(path.join(cartellaDelPacchetto, file), 'utf8').trim() : null;
}

const voci = [...pacchetti.values()].sort((a, b) => a.nome.localeCompare(b.nome));
const testo = [
  'PoorDown per VS Code contiene i pacchetti qui sotto, ognuno con la sua licenza.',
  'PoorDown for VS Code includes the following third-party packages, each under its own license.',
  '',
  ...voci.flatMap((v) => [
    '='.repeat(80),
    `${v.nome} ${v.versione}${v.licenza ? ` (${v.licenza})` : ''}`,
    '='.repeat(80),
    testoLicenza(v.cartella) ?? `Licenza: ${v.licenza ?? 'non indicata'}`,
    '',
  ]),
].join('\n');
writeFileSync(path.join(dist, 'LICENZE-DI-TERZE-PARTI.txt'), `${testo}\n`);

function dimensione(percorso) {
  const info = statSync(percorso);
  if (info.isFile()) return info.size;
  return readdirSync(percorso).reduce((somma, f) => somma + dimensione(path.join(percorso, f)), 0);
}
const kb = (byte) => `${Math.round(byte / 1024)} KB`;
scrivi(
  '',
  `Fatto: ${path.relative(radice, dist)}`,
  `  estensione.js  ${kb(dimensione(path.join(dist, 'estensione.js')))}`,
  `  server.mjs     ${kb(dimensione(path.join(dist, 'server.mjs')))}`,
  `  web/           ${kb(dimensione(path.join(dist, 'web')))}`,
  `  licenze        ${voci.length} pacchetti`,
  '',
);
