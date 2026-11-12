/*
 * «Imposta l'accesso al pannello di controllo»: lo stesso di `npm run pannello` (apps/server/src/pannello/imposta.ts),
 * con le caselle di VS Code al posto del terminale. Nel file finisce solo l'impronta di nome e password.
 */

import * as vscode from 'vscode';
import {
  creaCredenziali,
  fileCredenziali,
  leggiCredenziali,
  PASSWORD_MIN,
  scriviCredenziali,
  togliCredenziali,
} from '../../server/src/pannello/accesso';

export function haAccesso(): boolean {
  return leggiCredenziali(fileCredenziali()) !== null;
}

/** Chiede nome e password e li salva, oppure li cancella. `null` se chi scrive ci ripensa. */
export async function impostaAccesso(): Promise<'impostato' | 'tolto' | null> {
  const file = fileCredenziali();
  if (leggiCredenziali(file)) {
    const scelta = await vscode.window.showQuickPick(
      [
        { label: 'Cambia nome e password', valore: 'cambia' as const },
        { label: 'Spegni il pannello di controllo', description: 'cancella nome e password', valore: 'togli' as const },
      ],
      { title: 'Il pannello di controllo ha già un nome e una password', placeHolder: 'Cosa vuoi fare?' },
    );
    if (!scelta) return null;
    if (scelta.valore === 'togli') {
      togliCredenziali(file);
      return 'tolto';
    }
  }

  const titolo = 'Accesso al pannello di controllo';
  const nome = await vscode.window.showInputBox({
    title: titolo,
    prompt: 'Il nome per entrare nel pannello di controllo',
    ignoreFocusOut: true,
    validateInput: (testo) => (testo.trim() ? null : 'Il nome non può essere vuoto.'),
  });
  if (nome === undefined) return null;
  const password = await vscode.window.showInputBox({
    title: titolo,
    prompt: `La password (almeno ${PASSWORD_MIN} caratteri). Sul PC resta solo in forma cifrata: se la dimentichi, rifai questo comando.`,
    password: true,
    ignoreFocusOut: true,
    validateInput: (testo) => (Array.from(testo).length >= PASSWORD_MIN ? null : `Serve una password di almeno ${PASSWORD_MIN} caratteri.`),
  });
  if (password === undefined) return null;
  const ripetuta = await vscode.window.showInputBox({
    title: titolo,
    prompt: 'Ripeti la password',
    password: true,
    ignoreFocusOut: true,
    validateInput: (testo) => (testo === password ? null : 'Le due password non sono uguali.'),
  });
  if (ripetuta === undefined) return null;

  scriviCredenziali(await creaCredenziali(nome.trim(), password), file);
  return 'impostato';
}
