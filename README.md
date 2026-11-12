# PoorDown

Gioco da tavolo multiplayer in stile Monopoly, da giocare con gli amici sulla stessa rete di casa o via internet. Un PC fa da server, gli altri si collegano dal browser (anche dal telefono). Lavori in corso: vedi [ROADMAP.md](ROADMAP.md).

## Requisiti

- [Node.js](https://nodejs.org) 22.12 o più recente (consigliato 24 LTS), solo sul PC che fa da server.
- Per giocare online: internet sul PC che fa da server; gli amici possono essere ovunque. Senza internet si gioca solo con chi è collegato alla stessa rete (Wi-Fi o cavo) di quel PC.

## Avvio

**Su Windows:** doppio clic su **`Avvia PoorDown.cmd`**. Controlla Node.js, scarica i pacchetti la prima volta (e dopo ogni aggiornamento), accende il server con il gioco online e apre il browser. Se il gioco è già acceso apre solo il browser. Per spegnerlo si chiude la finestra: le partite restano salvate. La guida per chi gioca, anche per chi non è pratico, è in [GUIDA.md](GUIDA.md).

Dal terminale, su qualunque sistema:

```sh
npm install   # solo la prima volta e dopo ogni aggiornamento
npm run online   # oppure "npm start" per la sola rete di casa
```

Il terminale mostra gli indirizzi:

- **Su questo PC:** `http://localhost:3000`
- **Per gli amici** (**Rete di casa** con il gioco online): per esempio `http://192.168.1.23:3000`, da aprire su telefono o PC collegati alla stessa rete. La pagina mostra anche un codice QR da inquadrare.
- **Online:** per esempio `https://parole-a-caso.trycloudflare.com`, che funziona da qualunque posto. Compare qualche secondo dopo gli altri.

### Giocare online

Con il doppio clic o `npm run online` un tunnel di Cloudflare, gratuito e senza account, porta il server su internet. Appena la riga **Online** compare nel terminale, il pulsante **Copia** della stanza (e il codice QR) danno il link online, che funziona per tutti, anche per chi è in casa.

- Il tunnel lo apre il programma `cloudflared`. Se sul PC non è installato, PoorDown lo scarica da solo la prima volta (circa 50 MB, dalle pubblicazioni ufficiali di Cloudflare su GitHub) nella cartella dei dati.
- Il link si annuncia solo quando risponde davvero da internet. Se internet manca o Cloudflare non risponde, il gioco resta acceso per la rete di casa e il tunnel si riprova da solo.
- **Il link online cambia a ogni accensione**, e anche se il tunnel cade e si riapre (il terminale lo dice). Chi gioca da lontano deve ricevere quello nuovo, e con il nuovo indirizzo il browser non ritrova il suo posto: nelle partite riprese entra come spettatore. Le partite online conviene finirle senza spegnere il gioco.
- In modalità sviluppo (`npm run dev`) il gioco online non si accende: il sito servito da Vite non va messo su internet.

### Se gli amici in casa non riescono a collegarsi con l'indirizzo di rete

1. Al primo avvio Windows chiede il permesso del firewall per Node.js: consenti l'accesso alle **reti private**.
2. La rete di casa deve essere impostata come **privata**: Impostazioni → Rete e Internet → Wi-Fi (o Ethernet) → Tipo di profilo di rete → Privata.
3. Se il terminale mostra più indirizzi, prova anche gli altri.

### Usare un'altra porta

Se la 3000 è occupata, scegline un'altra con la variabile `PORT`:

```powershell
$env:PORT=3001; npm start
```

### Giocare con gli amici

1. Apri il gioco, scrivi il tuo nome (o tira il dado per uno a caso) e premi **Crea una stanza privata**.
2. Nella stanza premi **Copia** e manda il link agli amici, oppure fagli inquadrare il codice QR con il telefono.
3. Ognuno sceglie il colore della pedina e preme **Entra nella partita**.
4. Chi ha creato la stanza (l'host) sceglie le impostazioni e preme **Inizia la partita**.

**Gioca** porta nella prima stanza pubblica in attesa, **Tutte le stanze** mostra quelle aperte. Chi apre il link a partita iniziata la guarda come spettatore. Ricaricando la pagina si ritrova il proprio posto.

Le regole facoltative (aste, ipoteche, costruzione uniforme e le altre) si scelgono nelle impostazioni della stanza prima di iniziare. Gli scambi si propongono dal pannello **Scambi**, anche fuori dal proprio turno.

- **Bot:** con l’impostazione **Bot** i posti liberi si riempiono di giocatori automatici (icona del robot), che comprano, costruiscono, offrono alle aste e rispondono agli scambi. Se arriva un amico e la stanza è piena, prende il posto di un bot.
- **Squadre:** con l’impostazione **Squadre** ognuno preme **Entra** sulla squadra che vuole; l’host può rinominarle (matita), spostare i giocatori (i numeri accanto al nome) o **Mescolare le squadre**. I compagni non si pagano l’affitto, costruiscono sulle regioni della squadra, ereditano i beni di chi fa bancarotta e vincono insieme. In chat, **Squadra** scrive solo ai compagni.
- **Tabelloni:** in **Tabellone** → **Cambia tabellone** si sceglie tra Classico, Europa (48 caselle), Grandi aree e Colpo di fortuna.

A fine partita la colonna destra mostra la classifica e **Vedi tutte le statistiche** apre durata, turni, scambi e il grafico del patrimonio. **Un'altra partita** (la avvia l'host) riporta tutti in lobby nella stessa stanza, con gli stessi colori e le stesse impostazioni.

Per provare una partita da solo con due schede dello stesso browser, aggiungi `?profilo=due` all'indirizzo della seconda: è un giocatore diverso.

### Partite salvate

Le stanze vengono salvate su file mentre si gioca, così una partita riprende anche se il server si spegne. Il file sta in `%LOCALAPPDATA%\PoorDown\stanze.json` su Windows (`~/.poordown/stanze.json` altrove); per cambiarlo imposta la variabile `POORDOWN_DATI` con un'altra cartella. Le stanze in cui non entra nessuno per 30 minuti vengono chiuse.

## Comandi

| Comando | Cosa fa |
|---|---|
| `npm run online` | Compila il sito e avvia il server con il gioco online: è quello per giocare (lo usa anche il doppio clic) |
| `npm start` | Come sopra, ma solo per la rete di casa |
| `npm run dev` | Modalità sviluppo: le modifiche al codice compaiono subito nel browser. Su `/suoni` si ascoltano tutti i suoni |
| `npm run build` | Compila solo il sito in `apps/web/dist` |
| `npm run estensione` | Crea l'estensione di VS Code in `apps/vscode/poordown.vsix` |
| `npm test` | Esegue i test |
| `npm run lint` | Controlla il codice con ESLint |
| `npm run typecheck` | Controlla i tipi TypeScript |
| `npm run check` | Lint, tipi e test insieme |

## Struttura

```
packages/engine   regole del gioco, condivise tra server e browser
apps/server       server Node: serve il sito e gestisce stanze e partite (Express + Socket.IO)
apps/web          interfaccia (React + Vite)
apps/vscode       estensione di VS Code: accende il server e apre il gioco in un riquadro
docs/analisi      analisi di riferimento usata come specifica
```

## Estensione di VS Code

L'estensione fa da VS Code quello che fa il doppio clic: accende il gioco (anche online) e lo apre in un riquadro, senza installare Node.js, perché usa quello di VS Code. Gli amici entrano dal browser come sempre. Cosa vede chi la installa: [apps/vscode/README.md](apps/vscode/README.md), che è anche la pagina del Marketplace.

Come è fatta:

- `npm run estensione` compila tutto in `apps/vscode/dist` (estensione, server in un file solo con esbuild, sito, licenze dei pacchetti inclusi) e crea `apps/vscode/poordown.vsix`;
- il server gira in un processo a parte, con `POORDOWN_GENITORE=vscode`: racconta all'estensione quando è acceso, il link online e la porta occupata, e si spegne (salvando) quando lei lo chiede o quando VS Code si chiude ([genitore.ts](apps/server/src/genitore.ts));
- il riquadro è una webview con il sito in una cornice; il sito se ne accorge e manda a VS Code il titolo della pagina («● Tocca a te» sulla scheda) e i link da copiare ([vscode.ts](apps/web/src/vscode.ts)).

Per provarla senza pubblicarla: in VS Code, Estensioni → «…» → **Installa da VSIX…** e scegli `apps/vscode/poordown.vsix`.

### Pubblicarla sul Marketplace

1. L'editore è `PoorDown` su [marketplace.visualstudio.com/manage](https://marketplace.visualstudio.com/manage): il suo ID, maiuscole comprese, è il campo `publisher` di `apps/vscode/package.json`.
2. L'estensione è sotto licenza MIT ([apps/vscode/LICENSE](apps/vscode/LICENSE)).
3. `npm run estensione`, poi dalla pagina dell'editore **New extension → Visual Studio Code** e carica `poordown.vsix`. In alternativa da terminale: `npx @vscode/vsce@4.1.0 login <editore>` e `npx @vscode/vsce@4.1.0 publish --packagePath apps/vscode/poordown.vsix`.
4. Per VSCodium, Cursor e gli altri editor che usano Open VSX: `npx ovsx publish apps/vscode/poordown.vsix -p <token>` con un token di [open-vsx.org](https://open-vsx.org).

A ogni nuova versione aumenta `version` in `apps/vscode/package.json` e scrivi le novità in `apps/vscode/CHANGELOG.md`.

In sviluppo il server avvia Vite al suo interno, quindi sito e partite stanno sempre sullo stesso indirizzo e sulla stessa porta. Il codice TypeScript viene eseguito con `tsx`, senza un passaggio di compilazione per il server.
