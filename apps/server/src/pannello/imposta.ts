/*
 * `npm run pannello`: sceglie il nome e la password del pannello di controllo, dal terminale.
 * La password non si vede mentre si scrive. Nel file finisce solo l'impronta (vedi accesso.ts).
 * `npm run pannello -- --togli` spegne il pannello (cancella le credenziali).
 * Le credenziali nuove valgono subito, anche con il server acceso; chi era già dentro resta dentro fino alla
 * scadenza della sessione o allo spegnimento del server.
 */

import { createInterface } from 'node:readline';
import { creaCredenziali, fileCredenziali, leggiCredenziali, PASSWORD_MIN, scriviCredenziali, togliCredenziali } from './accesso';

const file = fileCredenziali();

function scrivi(...righe: string[]): void {
  console.log(['', ...righe.map((r) => `  ${r}`)].join('\n'));
}

/** Le righe dell'input quando non è un terminale (per esempio con l'input da un file): una per domanda. */
let righe: AsyncIterator<string> | null = null;

async function rigaDaInput(): Promise<string> {
  righe ??= createInterface({ input: process.stdin, terminal: false })[Symbol.asyncIterator]();
  const { value, done } = await righe.next();
  if (done) throw new Error('Input finito prima del tempo.');
  return value;
}

/** Chiede una riga. Con `nascosta` i caratteri non compaiono (al loro posto un asterisco). */
function chiedi(domanda: string, nascosta = false): Promise<string> {
  process.stdout.write(`  ${domanda}`);
  if (!process.stdin.isTTY) return rigaDaInput();
  return new Promise((risolvi) => {
    const input = process.stdin;
    let testo = '';
    input.setRawMode(true);
    input.resume();
    input.setEncoding('utf8');
    const ascolta = (pezzo: string) => {
      for (const carattere of pezzo) {
        if (carattere === '\u0003') {
          // Ctrl+C: si esce senza cambiare niente.
          process.stdout.write('\n');
          process.exit(130);
        }
        if (carattere === '\r' || carattere === '\n') {
          input.setRawMode(false);
          input.pause();
          input.off('data', ascolta);
          process.stdout.write('\n');
          risolvi(testo);
          return;
        }
        if (carattere === '\u007f' || carattere === '\b') {
          if (testo.length > 0) {
            testo = Array.from(testo).slice(0, -1).join('');
            process.stdout.write('\b \b');
          }
          continue;
        }
        // Gli altri caratteri di controllo (frecce, tab…) non entrano.
        if (carattere < ' ') continue;
        testo += carattere;
        process.stdout.write(nascosta ? '*' : carattere);
      }
    };
    input.on('data', ascolta);
  });
}

async function main(): Promise<void> {
  if (process.argv.includes('--togli')) {
    togliCredenziali(file);
    scrivi('Pannello spento: le credenziali sono state cancellate.', '');
    return;
  }

  scrivi(
    'PANNELLO DI CONTROLLO DI POORDOWN',
    '',
    'Scegli il nome e la password per entrare nel pannello (indirizzo del gioco + /pannello).',
    'Sul PC restano solo in forma cifrata: se li dimentichi, rifai questo comando.',
    '',
  );
  if (leggiCredenziali(file)) {
    const risposta = (await chiedi('Il pannello ha già un nome e una password: li sostituisco? (s/n) ')).trim().toLowerCase();
    if (risposta !== 's' && risposta !== 'si' && risposta !== 'sì') {
      scrivi('Va bene: non ho cambiato niente.', '');
      return;
    }
  }

  let nome = '';
  while (!nome) {
    nome = (await chiedi('Nome: ')).trim();
    if (!nome) scrivi('Il nome non può essere vuoto.', '');
  }

  let password: string;
  for (;;) {
    password = await chiedi('Password (non si vede mentre scrivi): ', true);
    if (Array.from(password).length < PASSWORD_MIN) {
      scrivi(`Serve una password di almeno ${PASSWORD_MIN} caratteri.`, '');
      continue;
    }
    const ripetuta = await chiedi('Ripeti la password: ', true);
    if (ripetuta === password) break;
    scrivi('Le due password non sono uguali: riproviamo.', '');
  }

  scriviCredenziali(await creaCredenziali(nome, password), file);
  scrivi(
    'Fatto. Il pannello è pronto: apri il gioco e aggiungi /pannello all\'indirizzo',
    '(per esempio http://localhost:3000/pannello).',
    'Vale subito, anche se il gioco è già acceso.',
    '',
  );
}

main().catch((errore: unknown) => {
  console.error('\n  Non sono riuscito a salvare le credenziali:', errore instanceof Error ? errore.message : errore);
  process.exit(1);
});
