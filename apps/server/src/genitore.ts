/*
 * Il server acceso dall'estensione di VS Code (apps/vscode). L'estensione lo avvia come processo figlio con un canale
 * IPC e la variabile POORDOWN_GENITORE=vscode: il server le racconta cosa succede (acceso, link online, porta occupata)
 * e si spegne quando lei lo chiede o quando se ne va (VS Code chiuso o bloccato), salvando prima le partite.
 * Serve la variabile perché anche `tsx` avvia il server con un canale IPC: il canale da solo non basta a riconoscerla.
 */

/** Cosa il server racconta all'estensione. */
export type MessaggioAlGenitore =
  | { tipo: 'acceso'; porta: number; indirizzi: string[] }
  | { tipo: 'online'; indirizzo: string }
  | { tipo: 'problema-online'; motivo: string }
  | { tipo: 'porta-occupata'; porta: number };

/** Cosa l'estensione chiede al server. */
export type MessaggioDalGenitore = { tipo: 'spegni' };

export const VARIABILE_GENITORE = 'POORDOWN_GENITORE';

/** Il server è stato acceso dall'estensione di VS Code? */
export function conGenitore(): boolean {
  return process.env[VARIABILE_GENITORE] === 'vscode' && typeof process.send === 'function';
}

export function avvisaGenitore(messaggio: MessaggioAlGenitore): void {
  if (!conGenitore() || !process.connected) return;
  process.send?.(messaggio);
}

/** `spegni` parte quando l'estensione lo chiede o quando il canale si chiude. */
export function spegniConIlGenitore(spegni: () => void): void {
  if (!conGenitore()) return;
  process.on('message', (messaggio: Partial<MessaggioDalGenitore> | null) => {
    if (messaggio?.tipo === 'spegni') spegni();
  });
  process.on('disconnect', spegni);
}
