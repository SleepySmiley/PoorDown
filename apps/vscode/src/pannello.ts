/*
 * Il riquadro di VS Code con il gioco: una webview con il sito del gioco in una cornice (vedi pagina.ts).
 * Uno solo per finestra. Resta vivo anche quando si guarda un altro file (retainContextWhenHidden): chiuderlo
 * staccherebbe il giocatore dalla partita, con i turni che passano da soli.
 */

import { randomBytes } from 'node:crypto';
import * as vscode from 'vscode';
import { leggiMessaggio, paginaGioco, paginaMessaggio } from './pagina';

export interface AvvisiPannello {
  /** Il gioco ha cambiato il titolo della pagina (per esempio «● Tocca a te — PoorDown»). */
  titolo(titolo: string): void;
  /** Il riquadro è stato chiuso. */
  chiuso(): void;
}

/** Tra una copia e l'altra chiesta dal gioco: una pagina non può riempire gli appunti di continuo. */
const COPIA_OGNI_MS = 1_000;

export class PannelloGioco {
  private pannello: vscode.WebviewPanel | null = null;
  /** L'indirizzo nella cornice; `null` se il riquadro mostra un messaggio. */
  private indirizzo: string | null = null;
  private ultimaCopia = 0;
  private _titolo: string | null = null;

  constructor(
    private readonly icona: vscode.Uri,
    private readonly avvisi: AvvisiPannello,
  ) {}

  get aperto(): boolean {
    return this.pannello !== null;
  }

  /** Il riquadro è quello in primo piano? */
  get inVista(): boolean {
    return this.pannello?.active ?? false;
  }

  /** L'indirizzo del gioco nel riquadro; `null` se il riquadro è chiuso o mostra un messaggio. */
  get indirizzoAperto(): string | null {
    return this.indirizzo;
  }

  /** L'ultimo titolo arrivato dal gioco da quando è stato aperto l'indirizzo attuale. */
  get titolo(): string | null {
    return this._titolo;
  }

  private crea(): vscode.WebviewPanel {
    if (this.pannello) return this.pannello;
    const pannello = vscode.window.createWebviewPanel(
      'poordown.gioco',
      'PoorDown',
      { viewColumn: vscode.ViewColumn.Active, preserveFocus: false },
      { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [] },
    );
    pannello.iconPath = this.icona;
    pannello.webview.onDidReceiveMessage((dati: unknown) => void this.ricevi(dati));
    pannello.onDidChangeViewState(() => this.avvisi.titolo(this._titolo ?? 'PoorDown'));
    pannello.onDidDispose(() => {
      this.pannello = null;
      this.indirizzo = null;
      this._titolo = null;
      this.avvisi.chiuso();
    });
    this.pannello = pannello;
    return pannello;
  }

  /** Mostra un messaggio al posto del gioco (mentre si accende, o dopo che si è spento). */
  messaggio(testo: string, crea = true): void {
    if (!this.pannello && !crea) return;
    const pannello = this.crea();
    this.indirizzo = null;
    this._titolo = null;
    pannello.title = 'PoorDown';
    pannello.webview.html = paginaMessaggio(testo, nonce());
    pannello.reveal(undefined, false);
  }

  /** Apre il gioco a questo indirizzo. Se c'è già, porta il riquadro in primo piano senza ricaricarlo. */
  apri(indirizzo: string): void {
    const pannello = this.crea();
    if (this.indirizzo !== indirizzo) {
      this.indirizzo = indirizzo;
      this._titolo = null;
      pannello.title = 'PoorDown';
      pannello.webview.html = paginaGioco(indirizzo, new URL(indirizzo).origin, nonce());
    }
    pannello.reveal(undefined, false);
  }

  /** Porta il riquadro in primo piano, se è aperto. */
  mostra(): void {
    this.pannello?.reveal(undefined, false);
  }

  chiudi(): void {
    this.pannello?.dispose();
  }

  private async ricevi(dati: unknown): Promise<void> {
    const messaggio = leggiMessaggio(dati);
    if (!messaggio || !this.pannello) return;
    if (messaggio.poordown === 'titolo') {
      this._titolo = messaggio.titolo || 'PoorDown';
      this.pannello.title = this._titolo;
      this.avvisi.titolo(this._titolo);
      return;
    }
    const adesso = Date.now();
    if (adesso - this.ultimaCopia < COPIA_OGNI_MS) return;
    this.ultimaCopia = adesso;
    await vscode.env.clipboard.writeText(messaggio.testo);
    vscode.window.setStatusBarMessage(`$(check) Link copiato: ${messaggio.testo}`, 5_000);
  }
}

function nonce(): string {
  return randomBytes(16).toString('base64');
}
