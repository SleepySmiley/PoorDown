/*
 * Il gioco dentro l'estensione di VS Code (apps/vscode). Lì la pagina sta in un riquadro di VS Code (una webview),
 * che appena la pagina è caricata si presenta con un messaggio. Da quel momento la pagina gli manda:
 * - il titolo, che VS Code mostra sulla scheda: «● Tocca a te» si vede anche mentre si lavora su un altro file;
 * - i link da copiare, perché dentro VS Code il browser non sempre lascia scrivere negli appunti.
 * Fuori da VS Code non succede niente. Si ascolta solo la cornice che contiene la pagina, e solo se è una webview.
 * I messaggi sono gli stessi di apps/vscode/src/pagina.ts.
 */

type MessaggioPerVSCode = { poordown: 'titolo'; titolo: string } | { poordown: 'copia'; testo: string };

/** L'origine della webview di VS Code che contiene la pagina, dopo la presentazione. */
let cornice: string | null = null;
let ultimoTitolo: string | null = null;

function manda(messaggio: MessaggioPerVSCode): void {
  if (cornice) window.parent.postMessage(messaggio, cornice);
}

function mandaTitolo(): void {
  if (document.title === ultimoTitolo) return;
  ultimoTitolo = document.title;
  manda({ poordown: 'titolo', titolo: document.title });
}

/** Da chiamare all'avvio della pagina: aspetta la presentazione di VS Code. */
export function collegaVSCode(): void {
  if (window.parent === window) return;
  window.addEventListener('message', (evento: MessageEvent<unknown>) => {
    if (evento.source !== window.parent || !evento.origin.startsWith('vscode-webview://')) return;
    if ((evento.data as { poordown?: unknown } | null)?.poordown !== 'vscode') return;
    const prima = cornice === null;
    cornice = evento.origin;
    // La webview si presenta di nuovo se viene ricaricata: il titolo si rimanda comunque.
    ultimoTitolo = null;
    mandaTitolo();
    if (prima) new MutationObserver(mandaTitolo).observe(document.head, { subtree: true, childList: true, characterData: true });
  });
}

/** Chiede a VS Code di copiare il testo. `false` se la pagina non è dentro VS Code. */
export function copiaConVSCode(testo: string): boolean {
  if (!cornice) return false;
  manda({ poordown: 'copia', testo });
  return true;
}
