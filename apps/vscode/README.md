# PoorDown

Un gioco da tavolo di compravendita, multiplayer, da giocare con gli amici. Lo accendi da VS Code, ci giochi in un riquadro di VS Code, e gli amici entrano con un link dal browser: a loro non serve installare niente.

> *A multiplayer property-trading board game you host from VS Code and play with friends, who join from their browser with a link. The game is in Italian.*

## Come si gioca

1. Apri la tavolozza dei comandi (`Ctrl+Shift+P`, su Mac `Cmd+Shift+P`) e scegli **PoorDown: Avvia il gioco**. Il gioco si apre in un riquadro.
2. Scrivi il tuo nome (o tira il dado per uno a caso) e premi **Crea una stanza privata**.
3. Aspetta il messaggio **«Il gioco online è pronto»** (qualche secondo), poi nella stanza premi **Copia** e manda il link agli amici. Funziona da qualunque posto.
4. Ognuno sceglie il colore della pedina; quando ci siete tutti, premi **Inizia la partita**.

Le regole sono nel gioco: il punto di domanda in alto, **Come si gioca**.

Chi ha PoorDown in VS Code può entrare anche da lì: **PoorDown: Entra in una partita con un link**, poi incolla il link ricevuto.

## Mentre giochi

- Nella barra di stato in basso compare **PoorDown**: un clic apre le azioni (riaprire il gioco, copiare l'indirizzo, spegnere). Passandoci sopra si vedono gli indirizzi per gli amici.
- Puoi lavorare su un altro file: quando tocca a te suona un gong, la scheda del gioco diventa **● Tocca a te** e la barra di stato lo segnala.
- Se chiudi il riquadro il gioco resta acceso per gli altri: hai 2 minuti per tornare nella partita prima di perdere il posto. Riaprilo dalla barra di stato.
- **PoorDown: Spegni il gioco** lo spegne; anche chiudere VS Code lo spegne. Le partite restano salvate e riprendono alla prossima accensione.

## Comandi

| Comando | Cosa fa |
|---|---|
| **PoorDown: Avvia il gioco** | Accende il gioco su questo PC, anche online per chi gioca da lontano, e lo apre in VS Code |
| **PoorDown: Avvia il gioco solo per la rete di casa** | Come sopra, ma solo per chi è collegato al tuo stesso Wi-Fi |
| **PoorDown: Entra in una partita con un link** | Apre in VS Code la partita accesa da qualcun altro |
| **PoorDown: Copia l'indirizzo per gli amici** | Copia l'indirizzo del gioco; per una stanza privata usa **Copia** dentro la stanza |
| **PoorDown: Apri il pannello di controllo** | Apre il pannello per correggere a mano le partite in corso |
| **PoorDown: Imposta l'accesso al pannello di controllo** | Sceglie nome e password del pannello, o lo spegne |
| **PoorDown: Mostra i messaggi del server** | Mostra cosa scrive il gioco mentre è acceso |
| **PoorDown: Spegni il gioco** | Spegne il gioco; le partite restano salvate |

## Impostazioni

- **`poordown.porta`** (predefinita `3000`): la porta del gioco su questo PC. Cambiala solo se la 3000 è già usata da un altro programma.

## Cosa fa sul tuo PC

PoorDown non ha un server su internet: la partita gira sul PC di chi la accende. Per questo l'estensione:

- **accende un piccolo server** sulla porta scelta, raggiungibile da questo PC e dagli altri dispositivi della tua rete di casa. Al primo avvio Windows può chiedere il permesso del firewall per Visual Studio Code: consenti l'accesso alle **reti private** se vuoi far entrare gli amici di casa;
- **per giocare online** apre un tunnel gratuito di Cloudflare (`trycloudflare.com`), senza account. Il programma che lo apre, `cloudflared`, se non è già installato viene scaricato una volta sola (circa 50 MB) dalle pubblicazioni ufficiali di Cloudflare su GitHub. Il link online cambia a ogni accensione. Se non vuoi il tunnel, usa **Avvia il gioco solo per la rete di casa**;
- **salva le partite** in `%LOCALAPPDATA%\PoorDown` su Windows (`~/.poordown` altrove), la stessa cartella usata da PoorDown fuori da VS Code. Le stanze in cui non entra nessuno per 30 minuti vengono chiuse.

Non ci sono account, pubblicità né raccolta di dati.

## Se qualcosa non va

- **«La porta 3000 è già usata»**: un altro programma la occupa. Scegli un'altra porta in `poordown.porta`.
- **«PoorDown era già acceso su questo PC»**: il gioco è acceso da un'altra finestra di VS Code o da PoorDown fuori da VS Code. L'estensione apre quello; per spegnerlo usa la finestra che l'ha acceso.
- **Gli amici in casa non riescono a entrare**: devono essere sul tuo stesso Wi-Fi, la rete deve essere impostata come **privata** e il firewall deve consentire Visual Studio Code sulle reti private. Oppure usate il link online.
- **Il link online non arriva**: serve internet. Il gioco riprova da solo e intanto funziona per chi è in casa.

## Requisiti

VS Code 1.101 o più recente, sul desktop (Windows, macOS o Linux). Non funziona in VS Code per il web (vscode.dev), che non può accendere un server.

Le licenze dei componenti inclusi sono nel file `dist/LICENZE-DI-TERZE-PARTI.txt` dell'estensione.
