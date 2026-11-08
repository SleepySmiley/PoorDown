# PoorDown

Gioco da tavolo multiplayer in stile Monopoly, da giocare con gli amici sulla stessa rete di casa. Un PC fa da server, gli altri si collegano dal browser (anche dal telefono). Lavori in corso: vedi [ROADMAP.md](ROADMAP.md).

## Requisiti

- [Node.js](https://nodejs.org) 22.12 o più recente (consigliato 24 LTS), solo sul PC che fa da server.
- Tutti i giocatori collegati alla stessa rete (Wi-Fi o cavo) di quel PC.

## Avvio

```sh
npm install   # solo la prima volta e dopo ogni aggiornamento
npm start
```

Il terminale mostra due indirizzi:

- **Su questo PC:** `http://localhost:3000`
- **Per gli amici:** per esempio `http://192.168.1.23:3000`, da aprire su telefono o PC collegati alla stessa rete. La pagina mostra anche un codice QR da inquadrare.

### Se gli amici non riescono a collegarsi

1. Al primo avvio Windows chiede il permesso del firewall per Node.js: consenti l'accesso alle **reti private**.
2. La rete di casa deve essere impostata come **privata**: Impostazioni → Rete e Internet → Wi-Fi (o Ethernet) → Tipo di profilo di rete → Privata.
3. Se il terminale mostra più indirizzi, prova anche gli altri.

### Usare un'altra porta

Se la 3000 è occupata, scegline un'altra con la variabile `PORT`:

```powershell
$env:PORT=3001; npm start
```

### Provare le stanze (provvisorio)

Finché non arrivano le schermate vere (Fase 4), all'indirizzo `/prova` c'è un banco di prova senza grafica: si crea una stanza, gli amici entrano con il link, si siedono al tavolo e giocano. Per giocare da due schede dello stesso browser aggiungi `?profilo=due` all'indirizzo della seconda: è un giocatore diverso.

### Partite salvate

Le stanze vengono salvate su file mentre si gioca, così una partita riprende anche se il server si spegne. Il file sta in `%LOCALAPPDATA%\PoorDown\stanze.json` su Windows (`~/.poordown/stanze.json` altrove); per cambiarlo imposta la variabile `POORDOWN_DATI` con un'altra cartella. Le stanze in cui non entra nessuno per 30 minuti vengono chiuse.

## Comandi

| Comando | Cosa fa |
|---|---|
| `npm start` | Compila il sito e avvia il server: è quello per giocare |
| `npm run dev` | Modalità sviluppo: le modifiche al codice compaiono subito nel browser |
| `npm run build` | Compila solo il sito in `apps/web/dist` |
| `npm test` | Esegue i test |
| `npm run lint` | Controlla il codice con ESLint |
| `npm run typecheck` | Controlla i tipi TypeScript |
| `npm run check` | Lint, tipi e test insieme |

## Struttura

```
packages/engine   regole del gioco, condivise tra server e browser
apps/server       server Node: serve il sito e gestisce stanze e partite (Express + Socket.IO)
apps/web          interfaccia (React + Vite)
docs/analisi      analisi di riferimento usata come specifica
```

In sviluppo il server avvia Vite al suo interno, quindi sito e partite stanno sempre sullo stesso indirizzo e sulla stessa porta. Il codice TypeScript viene eseguito con `tsx`, senza un passaggio di compilazione per il server.
