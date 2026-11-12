/*
 * L'estensione di VS Code di PoorDown: accende il gioco su questo PC e lo apre in un riquadro di VS Code.
 * - «Avvia il gioco» fa come il doppio clic (gioco online con il tunnel di Cloudflare), «solo per la rete di casa»
 *   come `npm start`. Gli amici entrano dal browser con il link della stanza, come sempre.
 * - «Entra in una partita con un link» apre nel riquadro la partita accesa da un altro.
 * - La barra di stato dice se il gioco è acceso, con gli indirizzi, e «Tocca a te» quando il riquadro non è in vista.
 * Chiudendo VS Code il gioco si spegne e le partite restano salvate.
 */

import { ASSENZA_MS } from '@poordown/engine';
import * as vscode from 'vscode';
import { haAccesso, impostaAccesso } from './accesso';
import { indirizzoPerGliAmici, leggiLink, QUESTO_PC } from './link';
import { toccaATe } from './pagina';
import { PannelloGioco } from './pannello';
import { infoServer, PortaOccupata, ServerLocale, type StatoServer } from './server';

/** Quello che l'estensione restituisce a chi la usa da fuori: serve alle prove automatiche. */
export interface ApiPoorDown {
  stato(): StatoServer;
  /** L'ultimo titolo arrivato dal gioco nel riquadro: c'è solo se la pagina del gioco si è caricata e risponde. */
  titoloDelGioco(): string | null;
}

let server: ServerLocale | null = null;

export function activate(contesto: vscode.ExtensionContext): ApiPoorDown {
  const uscita = vscode.window.createOutputChannel('PoorDown');
  const barra = vscode.window.createStatusBarItem('poordown.stato', vscode.StatusBarAlignment.Right, 100);
  barra.name = 'PoorDown';
  barra.command = 'poordown.menu';
  contesto.subscriptions.push(uscita, barra);

  /** Il titolo che il gioco ha dato alla pagina nel riquadro. */
  let titolo = 'PoorDown';
  /** L'origine con cui il riquadro apre il server di questo PC (può cambiare con VS Code remoto). */
  let origineLocale: string | null = null;
  /** Il link online che non si apre si annuncia una volta sola, finché non torna. */
  let problemaAnnunciato = false;

  const pannello = new PannelloGioco(vscode.Uri.joinPath(contesto.extensionUri, 'media', 'icona.png'), {
    titolo(nuovo) {
      titolo = nuovo;
      aggiornaBarra();
    },
    chiuso() {
      titolo = 'PoorDown';
      aggiornaBarra();
      if (acceso(locale.stato)) void avvisaRiquadroChiuso();
    },
  });

  const locale = new ServerLocale(contesto.asAbsolutePath('dist/server.mjs'), contesto.asAbsolutePath('dist/web'), {
    riga: (testo) => uscita.appendLine(testo),
    cambiato(stato) {
      void vscode.commands.executeCommand('setContext', 'poordown.acceso', acceso(stato));
      void vscode.commands.executeCommand('setContext', 'poordown.nostro', stato.tipo === 'acceso');
      aggiornaBarra();
    },
    online(_indirizzo, cambiato) {
      problemaAnnunciato = false;
      void vscode.window.showInformationMessage(
        cambiato
          ? 'Il link online di PoorDown è cambiato e quello di prima non funziona più: nella stanza, «Copia» dà già quello nuovo.'
          : 'Il gioco online è pronto: nella stanza premi «Copia» e manda il link agli amici. Funziona da qualunque posto.',
      );
    },
    problemaOnline(motivo) {
      if (problemaAnnunciato) return;
      problemaAnnunciato = true;
      void vscode.window.showWarningMessage(`Il link online non si apre (${motivo}). Riprovo da solo; intanto si gioca sulla rete di casa.`);
    },
    spentoDaSolo() {
      if (mostraIlServerLocale()) pannello.messaggio('PoorDown si è spento.', false);
      void vscode.window
        .showErrorMessage('PoorDown si è spento all’improvviso. Le partite sono salvate.', 'Riaccendi', 'Mostra i messaggi')
        .then((scelta) => {
          if (scelta === 'Riaccendi') void accendiEApri(true);
          if (scelta === 'Mostra i messaggi') uscita.show(true);
        });
    },
  });
  server = locale;

  function acceso(stato: StatoServer): stato is Extract<StatoServer, { porta: number; tipo: 'acceso' | 'altrove' }> {
    return stato.tipo === 'acceso' || stato.tipo === 'altrove';
  }

  /** Il riquadro mostra il gioco acceso su questo PC (non la partita di un altro)? */
  function mostraIlServerLocale(): boolean {
    return origineLocale !== null && (pannello.indirizzoAperto?.startsWith(origineLocale) ?? false);
  }

  function aggiornaBarra(): void {
    const stato = locale.stato;
    // Spento, la barra resta solo per la partita di un altro aperta nel riquadro.
    if (stato.tipo === 'spento' && (!pannello.indirizzoAperto || mostraIlServerLocale())) {
      barra.hide();
      return;
    }
    const turno = toccaATe(titolo) && !pannello.inVista;
    barra.backgroundColor = turno ? new vscode.ThemeColor('statusBarItem.warningBackground') : undefined;
    if (stato.tipo === 'avvio') barra.text = '$(loading~spin) PoorDown';
    else if (turno) barra.text = '$(bell) Tocca a te';
    else if (stato.tipo === 'spento') barra.text = '$(link) PoorDown';
    else barra.text = stato.tipo === 'acceso' && !stato.online ? '$(home) PoorDown' : '$(broadcast) PoorDown';
    barra.tooltip = descrizione(stato);
    barra.show();
  }

  function descrizione(stato: StatoServer): vscode.MarkdownString {
    const righe: string[] = [];
    switch (stato.tipo) {
      case 'avvio':
        righe.push('Accendo PoorDown…');
        break;
      case 'spento':
        righe.push('Sei in una partita accesa da un altro.');
        break;
      case 'altrove':
        righe.push('**PoorDown è acceso** su questo PC, fuori da questa finestra (un’altra finestra di VS Code o il doppio clic).');
        break;
      case 'acceso':
        righe.push('**PoorDown è acceso**', `Su questo PC: ${`http://localhost:${stato.porta}`}`);
        for (const [i, indirizzo] of stato.indirizzi.entries()) righe.push(`${i === 0 ? 'Rete di casa' : 'Oppure'}: ${indirizzo}`);
        if (stato.online) righe.push(`Online: ${stato.pubblico ?? 'preparo il link…'}`);
        break;
    }
    righe.push('', 'Clic per le azioni');
    return new vscode.MarkdownString(righe.join('  \n'));
  }

  function portaScelta(): number {
    const porta = vscode.workspace.getConfiguration('poordown').get<number>('porta', 3000);
    return Number.isInteger(porta) && porta >= 1 && porta <= 65535 ? porta : 3000;
  }

  /** Apre nel riquadro una pagina del server di questo PC. */
  async function apriLocale(porta: number, percorso = '/'): Promise<void> {
    // Con VS Code collegato a un altro computer, VS Code inoltra la porta e dà l'indirizzo giusto.
    const esterno = await vscode.env.asExternalUri(vscode.Uri.parse(`http://localhost:${porta}${percorso}`));
    const indirizzo = esterno.toString(true);
    origineLocale = new URL(indirizzo).origin;
    pannello.apri(indirizzo);
  }

  async function accendiEApri(online: boolean, percorso = '/'): Promise<void> {
    if (!nodeAdatto()) {
      void vscode.window.showErrorMessage('Questa versione di VS Code è troppo vecchia per PoorDown: aggiornala e riprova.');
      return;
    }
    const prima = locale.stato;
    if (prima.tipo === 'acceso' && prima.online !== online) {
      void vscode.window.showInformationMessage(
        prima.online
          ? 'PoorDown è già acceso, con il gioco online.'
          : 'PoorDown è già acceso solo per la rete di casa: per giocare online spegnilo e riaccendilo con «PoorDown: Avvia il gioco».',
      );
    }
    if (prima.tipo === 'spento') pannello.messaggio('Accendo PoorDown…');
    let stato: StatoServer;
    try {
      stato = await locale.accendi(portaScelta(), online);
    } catch (errore) {
      pannello.chiudi();
      if (errore instanceof PortaOccupata) {
        const scelta = await vscode.window.showErrorMessage(
          `La porta ${errore.porta} è già usata da un altro programma: scegli un’altra porta per PoorDown.`,
          'Cambia la porta',
        );
        if (scelta) await vscode.commands.executeCommand('workbench.action.openSettings', 'poordown.porta');
      } else {
        const testo = errore instanceof Error ? errore.message : String(errore);
        const scelta = await vscode.window.showErrorMessage(testo, 'Mostra i messaggi');
        if (scelta) uscita.show(true);
      }
      return;
    }
    if (!acceso(stato)) return;
    if (stato.tipo === 'altrove' && prima.tipo !== 'altrove') {
      void vscode.window.showInformationMessage(
        'PoorDown era già acceso su questo PC (in un’altra finestra di VS Code o con il doppio clic): apro quello.',
      );
    }
    await apriLocale(stato.porta, percorso);
  }

  async function apriGioco(): Promise<void> {
    const stato = await locale.verifica();
    if (acceso(stato)) await apriLocale(stato.porta);
    else await accendiEApri(true);
  }

  async function entra(): Promise<void> {
    const testo = await vscode.window.showInputBox({
      title: 'Entra in una partita',
      prompt: 'Incolla il link che ti hanno mandato',
      placeHolder: 'https://parole-a-caso.trycloudflare.com/stanza/abcde',
      ignoreFocusOut: true,
      validateInput: (scritto) => {
        if (!scritto.trim()) return null;
        const esito = leggiLink(scritto);
        return esito.tipo === 'non-valido' ? esito.motivo : null;
      },
    });
    if (!testo) return;
    const esito = leggiLink(testo);
    if (esito.tipo === 'non-valido') {
      void vscode.window.showErrorMessage(esito.motivo);
      return;
    }
    const url = new URL(esito.indirizzo);
    // Un PoorDown su questo PC passa da asExternalUri, come quello acceso dall'estensione.
    if (url.protocol === 'http:' && QUESTO_PC.has(url.hostname)) await apriLocale(Number(url.port || 80), `${url.pathname}${url.search}`);
    else pannello.apri(esito.indirizzo);
  }

  async function copiaIndirizzo(): Promise<void> {
    const stato = locale.stato;
    const porta = acceso(stato) ? stato.porta : portaScelta();
    const info = await infoServer(porta);
    if (!info) {
      const scelta = await vscode.window.showWarningMessage('PoorDown non è acceso.', 'Avvia il gioco');
      if (scelta) await accendiEApri(true);
      return;
    }
    const indirizzo = indirizzoPerGliAmici(info, porta);
    await vscode.env.clipboard.writeText(indirizzo);
    const attesa = info.online && !info.pubblico ? ' Il link online non è ancora pronto: questo vale solo per chi è in casa.' : '';
    void vscode.window.showInformationMessage(
      `Copiato: ${indirizzo}.${attesa} Per una stanza privata manda il link che dà «Copia» dentro la stanza.`,
    );
  }

  async function apriPannelloDiControllo(): Promise<void> {
    const stato = await locale.verifica();
    if (!acceso(stato)) {
      const scelta = await vscode.window.showInformationMessage('Il pannello di controllo si apre con il gioco acceso.', 'Avvia il gioco');
      if (scelta) await accendiEApri(true);
      return;
    }
    if (!haAccesso()) {
      const scelta = await vscode.window.showInformationMessage(
        'Il pannello di controllo non ha ancora un nome e una password.',
        'Scegli nome e password',
      );
      if (!scelta || (await impostaAccesso()) !== 'impostato') return;
    }
    await apriLocale(stato.porta, '/pannello');
  }

  async function impostaPannelloDiControllo(): Promise<void> {
    const esito = await impostaAccesso();
    if (esito === 'tolto') {
      void vscode.window.showInformationMessage('Pannello di controllo spento: nome e password sono stati cancellati.');
      return;
    }
    if (esito !== 'impostato') return;
    const stato = locale.stato;
    const scelta = await vscode.window.showInformationMessage(
      'Fatto: il pannello di controllo è pronto. Vale subito, anche con il gioco acceso.',
      ...(acceso(stato) ? ['Apri il pannello'] : []),
    );
    if (scelta && acceso(stato)) await apriLocale(stato.porta, '/pannello');
  }

  async function spegni(): Promise<void> {
    const stato = await locale.verifica();
    if (stato.tipo === 'altrove') {
      void vscode.window.showInformationMessage(
        'PoorDown è acceso fuori da questa finestra (in un’altra finestra di VS Code o con il doppio clic): spegnilo da lì.',
      );
      return;
    }
    if (stato.tipo !== 'acceso') return;
    await locale.spegni();
    if (mostraIlServerLocale()) pannello.messaggio('PoorDown è spento. Le partite sono salvate e riprendono alla prossima accensione.', false);
    vscode.window.setStatusBarMessage('$(check) PoorDown è spento: le partite sono salvate.', 5_000);
  }

  async function avvisaRiquadroChiuso(): Promise<void> {
    const minuti = Math.round(ASSENZA_MS / 60_000);
    const azioni = locale.stato.tipo === 'acceso' ? ['Torna al gioco', 'Spegni il gioco'] : ['Torna al gioco'];
    const scelta = await vscode.window.showInformationMessage(
      `PoorDown resta acceso per gli altri giocatori. Se eri in una partita, hai ${minuti} minuti per tornare prima di perdere il posto.`,
      ...azioni,
    );
    if (scelta === 'Torna al gioco') await apriGioco();
    if (scelta === 'Spegni il gioco') await spegni();
  }

  async function menu(): Promise<void> {
    type Voce = vscode.QuickPickItem & { azione: () => unknown };
    // Le voci giuste anche se il PoorDown acceso altrove nel frattempo si è spento.
    const stato = await locale.verifica();
    const voci: Voce[] = acceso(stato)
      ? [
          { label: '$(play) Apri il gioco', azione: apriGioco },
          { label: '$(copy) Copia l’indirizzo per gli amici', azione: copiaIndirizzo },
          { label: '$(link) Entra in una partita con un link', azione: entra },
          { label: '$(shield) Apri il pannello di controllo', azione: apriPannelloDiControllo },
          ...(stato.tipo === 'acceso'
            ? [
                { label: '$(output) Mostra i messaggi del server', azione: () => uscita.show(true) },
                { label: '$(debug-stop) Spegni il gioco', description: 'le partite restano salvate', azione: spegni },
              ]
            : []),
        ]
      : [
          ...(pannello.aperto ? [{ label: '$(eye) Mostra la partita', azione: () => pannello.mostra() }] : []),
          { label: '$(play) Avvia il gioco', description: 'anche online, per chi gioca da lontano', azione: () => accendiEApri(true) },
          { label: '$(home) Avvia il gioco solo per la rete di casa', azione: () => accendiEApri(false) },
          { label: '$(link) Entra in una partita con un link', azione: entra },
        ];
    const scelta = await vscode.window.showQuickPick(voci, { title: 'PoorDown', placeHolder: 'Cosa vuoi fare?' });
    await scelta?.azione();
  }

  const comandi: Record<string, () => unknown> = {
    'poordown.avvia': () => accendiEApri(true),
    'poordown.avviaInCasa': () => accendiEApri(false),
    'poordown.entra': entra,
    'poordown.copiaIndirizzo': copiaIndirizzo,
    'poordown.apriPannelloDiControllo': apriPannelloDiControllo,
    'poordown.impostaPannelloDiControllo': impostaPannelloDiControllo,
    'poordown.mostraMessaggi': () => uscita.show(true),
    'poordown.spegni': spegni,
    'poordown.menu': menu,
  };
  for (const [nome, azione] of Object.entries(comandi)) contesto.subscriptions.push(vscode.commands.registerCommand(nome, azione));

  return {
    stato: () => locale.stato,
    titoloDelGioco: () => pannello.titolo,
  };
}

/** Chiudendo VS Code: il server salva le partite e si spegne. */
export function deactivate(): Promise<void> | undefined {
  return server?.spegni();
}

/** Il server vuole Node.js 22.12 o più recente: VS Code lo ha dalla versione 1.101. */
function nodeAdatto(): boolean {
  const [maggiore = 0, minore = 0] = process.versions.node.split('.').map(Number);
  return maggiore > 22 || (maggiore === 22 && minore >= 12);
}
