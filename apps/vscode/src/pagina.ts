/*
 * Le pagine della webview. Il gioco sta su un altro indirizzo (il server su questo PC o quello di un amico): la webview
 * lo mette in una cornice a tutta pagina, lo presenta con { poordown: 'vscode' } appena è caricato e gira
 * all'estensione i messaggi che arrivano da lì. I messaggi del gioco sono quelli di apps/web/src/vscode.ts.
 * Qui niente `vscode`: si prova con Vitest.
 */

export type MessaggioDalGioco = { poordown: 'titolo'; titolo: string } | { poordown: 'copia'; testo: string };

const TITOLO_MAX = 120;
const LINK_MAX = 500;

/**
 * Il messaggio del gioco, se ha la forma giusta. La pagina può essere quella di un server altrui: il titolo si ripulisce
 * e negli appunti finiscono solo link http(s), perché il gioco copia solo i link delle stanze.
 */
export function leggiMessaggio(dati: unknown): MessaggioDalGioco | null {
  if (typeof dati !== 'object' || dati === null) return null;
  const { poordown } = dati as { poordown?: unknown };
  if (poordown === 'titolo') {
    const { titolo } = dati as { titolo?: unknown };
    if (typeof titolo !== 'string') return null;
    // eslint-disable-next-line no-control-regex
    const pulito = titolo.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, TITOLO_MAX);
    return { poordown, titolo: pulito };
  }
  if (poordown === 'copia') {
    const { testo } = dati as { testo?: unknown };
    if (typeof testo !== 'string' || testo.length > LINK_MAX || !/^https?:\/\/[^\s]+$/.test(testo)) return null;
    return { poordown, testo };
  }
  return null;
}

/** «● Tocca a te — PoorDown»: il titolo che il gioco dà alla pagina quando tocca a chi guarda (apps/web/src/schermate/turno.ts). */
export function toccaATe(titolo: string): boolean {
  return titolo.startsWith('●');
}

function attributo(testo: string): string {
  return testo.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Un valore JavaScript da scrivere dentro <script>, senza poterlo chiudere. */
function valoreScript(valore: unknown): string {
  return JSON.stringify(valore).replace(/</g, '\\u003c');
}

const STILE_BASE = `
  html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; background: var(--vscode-editor-background); }
  body { color: var(--vscode-foreground); font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); }`;

/** La cornice con il gioco. `indirizzo` è l'indirizzo da aprire, `origine` la sua origine (per la CSP e i messaggi). */
export function paginaGioco(indirizzo: string, origine: string, nonce: string): string {
  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src ${attributo(origine)}; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>PoorDown</title>
<style nonce="${nonce}">${STILE_BASE}
  iframe { display: block; width: 100%; height: 100%; border: 0; }
</style>
</head>
<body>
<iframe id="gioco" src="${attributo(indirizzo)}" title="PoorDown" allow="clipboard-read; clipboard-write; autoplay; fullscreen"></iframe>
<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  const gioco = document.getElementById('gioco');
  const origine = ${valoreScript(origine)};
  gioco.addEventListener('load', () => gioco.contentWindow.postMessage({ poordown: 'vscode' }, origine));
  window.addEventListener('message', (evento) => {
    if (evento.source !== gioco.contentWindow || evento.origin !== origine) return;
    vscode.postMessage(evento.data);
  });
</script>
</body>
</html>`;
}

/** Una pagina con solo un messaggio: mentre il gioco si accende, o dopo che si è spento. */
export function paginaMessaggio(testo: string, nonce: string): string {
  const html = testo.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}';">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>PoorDown</title>
<style nonce="${nonce}">${STILE_BASE}
  body { display: grid; place-items: center; }
  p { margin: 0; padding: 0 24px; text-align: center; color: var(--vscode-descriptionForeground); }
</style>
</head>
<body>
<p>${html}</p>
</body>
</html>`;
}
