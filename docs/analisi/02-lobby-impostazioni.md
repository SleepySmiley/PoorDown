# 02 — Creazione stanza, lobby e impostazioni di partita (richup.io)

Analisi svolta il 2026-11-07 con 4 browser separati (Edge, headed): host + 3 ospiti, su due stanze private create apposta (`/room/alxqx` e `/room/mwhcg`). Nessun login, nessun acquisto, nessuna stanza pubblica creata.

Legenda: **[V]** = verificato direttamente; **[D]** = dedotto (da DOM, testi nascosti o comportamento indiretto), non provato fino in fondo.

---

## 1. Panoramica

- Dalla home si crea una stanza privata con **"Create a private game"**. Il sito chiama `GET /api/room/new?isPrivate=true` e porta a `https://richup.io/room/<id>` **[V]**.
- La stanza è una **pagina unica** che contiene tutto: il tabellone sullo sfondo (anteprima della mappa), la colonna sinistra (logo, link di condivisione, pubblicità, chat), il centro (scelta pedina e "Join game", poi pulsante di avvio o messaggio di attesa, registro eventi) e la colonna destra (lista giocatori e impostazioni).
- **Chi crea la stanza non entra in automatico**: anche lui deve scegliere colore e premere "Join game". **Il primo che entra diventa host**, anche se non è il creatore **[V]**.
- Solo l'host modifica le impostazioni. Gli altri le vedono in tempo reale ma disattivate **[V]**.
- Si avvia con almeno 2 giocatori. **Non c'è conto alla rovescia**: il gioco parte subito **[V]**.
- Dopo l'avvio il link resta valido: chi arriva entra come **spettatore** **[V]**.

---

## 2. Flusso "Create a private game"

### 2.1 Home (prima della stanza)
- Campo nickname con placeholder `Your nickname...`, lunghezza massima **32 caratteri** (attributo `maxlength=32`) **[V]**.
- Icona a forma di dado accanto al campo: genera un **nickname casuale "Aggettivo Sostantivo"** (es. `Flawed Golf`, `Glum Gas`, `Cheap Weekend`, `Austere Bill`, `Long Pound`) **[V]**.
- Pulsanti: `Play` (partita rapida pubblica, non usato), `All rooms` (elenco stanze pubbliche), `Create a private game` **[V]**.
- Nickname vuoto: è consentito. Al momento di entrare viene assegnato un nome casuale (es. `Rare Lieuwe`) **[V]**.
- Il nickname e l'ultimo colore scelto restano salvati nel browser (localStorage `PLAYER_NAME`, `PLAYER_APPEARANCE`) e vengono proposti di nuovo **[V]**.

### 2.2 Caricamento e URL
- Formato dell'URL: `https://richup.io/room/` + **5 caratteri minuscoli alfanumerici** (osservati: `julvi`, `alxqx`, `mwhcg`; nell'elenco pubblico anche `6cm9q`, `126ay`) **[V]**.
- Schermata intermedia `Loading game...` con un suggerimento a rotazione, es. `Tip | Make the game harder by adjusting Starting Cash to 500$` e `Tip | On the computer, click CTRL anytime to find yourself on the board` **[V]**.
- In un browser headless la stanza resta bloccata su "Loading game..." per la verifica Cloudflare Turnstile. Una volta è comparso anche il riquadro `Verify you are human` (non cliccato). In modalità headed la verifica è passata da sola **[V]**.
- Per chi crea la stanza non è partita la pubblicità video. Per gli ospiti sì (vedi 3.1) **[V]**.

### 2.3 Riquadro di condivisione (colonna sinistra)
- Titolo `Share this game` con icona (i). Tooltip: *"Everyone with the link will be able to join this game. If it has already started, they will join as spectators."* **[V]**
- Campo di testo in sola lettura con l'URL completo, più il pulsante `Copy`. Il testo `Copied!` è già nel DOM e appare come conferma dopo il click **[V nel DOM; l'animazione non l'ho osservata a schermo]**.
- Dopo l'avvio compare anche `View room settings` (vedi §6) **[V]**.

### 2.4 Intestazione (in alto a sinistra)
- Logo RICHUP.io, link a Discord, icona `?` che apre la finestra "How to play" (stesso contenuto della home), icona del volume (tooltip `100%`, valore salvato in `richup__sound-volume`) **[V]**.

---

## 3. Ingresso degli ospiti dal link

### 3.1 Flusso
1. L'ospite apre `https://richup.io/room/<id>`: vede la **home** con il nickname, ma il pulsante principale si chiama **`Enter Game`** al posto di `Play` **[V]**.
2. Click su `Enter Game`: parte una **pubblicità video obbligatoria** (circa 23 s) con il testo `You will be taken to the game room after the advertisement ends.` **[V]**
3. Si arriva nella stanza: al centro `Select your player appearance:`, 12 cerchi colorati, il pulsante `Join game` e il link `Get more appearances` (porta a `/store/player-appearance`) **[V]**.
4. Click su `Join game`: il giocatore entra in lista, e nel registro compare `<nome> joined the game` **[V]**.

Prima di premere "Join game" il visitatore vede già tabellone, impostazioni e lista giocatori, ma non può scrivere in chat (`Only game players can send chat messages`) **[V]**.

### 3.2 Pedine e colori
- **12 colori gratuiti**, uguali per tutte le mappe (aria-label `Select appearance #HEX`) **[V]**:

| # | Hex | Colore |
|---|-----|--------|
| 1 | `#C0DA5A` | lime |
| 2 | `#FFC73F` | giallo |
| 3 | `#FF843F` | arancio |
| 4 | `#C34848` | rosso |
| 5 | `#5A99DA` | blu |
| 6 | `#7FE7F5` | ciano |
| 7 | `#009688` | verde acqua |
| 8 | `#73E85D` | verde |
| 9 | `#9A6E5E` | marrone |
| 10 | `#C63FA2` | magenta |
| 11 | `#FF7CA0` | rosa |
| 12 | `#7F5ADA` | viola |

- La pedina è una "goccia/blob" colorata con due occhi. Il colore selezionato si ingrandisce e mostra gli occhi **[V]**.
- I colori **già presi** da altri giocatori sono disattivati, e la lista si aggiorna in tempo reale **[V]**.
- Il colore attualmente selezionato risulta anch'esso `disabled` nel DOM (non si può riselezionare) **[V]**.
- Preselezione: se è libero viene proposto l'ultimo colore usato (localStorage). In un browser nuovo il colore proposto variava (`#5A99DA`, `#C0DA5A`) **[D: regola esatta non chiara, forse casuale]**.
- **Conflitto**: se un giocatore già entrato prende il colore che un altro aveva selezionato ma non ancora confermato, a quest'ultimo il "Join game" si disattiva e compare il toast *"Oops! another player has just joined the game with your selected appearance. Choose another one."* **[V]**
- Dopo essere entrato, nella propria riga della lista c'è `Change appearance`, che apre un popover con gli stessi 12 colori (quelli presi sono disattivati). Il cambio è immediato e visibile a tutti **[V]**.
- Altri aspetti si comprano nello Store (`Get more appearances`) **[V, non esplorato]**.

### 3.3 Nickname
- **Nickname duplicati ammessi**: due giocatori `HostAnna` sono stati nella stessa stanza contemporaneamente **[V]**.
- Il nickname non si cambia nella lobby (manca un campo dedicato). Per cambiarlo bisogna uscire e rientrare dalla home **[V/D]**.

---

## 4. Lobby: elementi UI e comportamento

### 4.1 Lista giocatori (in alto a destra)
- Avatar colorato e nome. L'host ha il badge `Host` con una corona **[V]**.
- La propria riga è evidenziata e contiene: un'icona di login (tooltip `Login`, invita a creare un account) e il pulsante `Change appearance` **[V]**.
- I bot hanno un'icona robot. Tooltip: *"Game bot — Bots are just like regular players; they can purchase, bankrupt and even trade. However, their hearts are made of metal, and they might be shy on chat."* **[V]**
- L'host vede una **X** accanto a ogni altro giocatore, bot compresi (tooltip `Kick player`) **[V]**.
- Se non c'è nessuno, il riquadro mostra `Waiting for players...` **[V]**.
- L'ordine della lista è l'**ordine di ingresso** **[V]**.

### 4.2 Centro del tabellone
- Host: pulsante `Start Game`. Se è disattivato, il tooltip spiega il motivo (vedi §7) **[V]**.
- Ospite: `Waiting for <nome host> to start the game...` **[V]**.
- Sotto c'è il **registro eventi** (i più recenti in alto): `Joined room <id>`, `<nome> joined the game`, `<nome> left the game`, `<nome> got kicked out of the game` **[V]**.

### 4.3 Chat della lobby (colonna sinistra)
- Intestazione `Chat` con due pulsanti: `Mute chat` (icona altoparlante) e `Minimize` **[V]**.
- Con `Minimize` la chat diventa una bolla flottante. Cliccandola (tooltip `Expand`) torna al suo posto **[V]**.
- Senza messaggi mostra `💬 No messages yet`, con accanto un contatore cliccabile `0` **[V; funzione del contatore non chiarita]**.
- Campo `Say something...` (massimo **1000** caratteri) e pulsante di invio (aereo di carta), disattivato a campo vuoto. Anche Invio spedisce **[V]**.
- I messaggi propri stanno a destra con l'avatar a destra. Quelli altrui stanno a sinistra con il nome sopra il fumetto **[V]**.
- **Niente cronologia**: chi entra dopo (o l'host dopo aver ricaricato) vede `No messages yet`, anche se altri hanno già scritto **[V]**.
- Chi non è in partita (visitatore non entrato, spettatore) legge `Only game players can send chat messages` al posto del campo di testo **[V]**.

### 4.4 Altri elementi
- Banner pubblicitario nella colonna sinistra (con X per chiuderlo) **[V]**.
- Testi nascosti nel DOM, mostrati solo in certi stati **[D]**:
  - `Connection lost` / `Make sure your internet connection is stable.` (overlay quando cade la connessione);
  - `This room is exclusive for logged-in users` + `Login to join` + `Return to lobby` (stanze riservate agli utenti registrati: nell'elenco pubblico compare *"+2 exclusive rooms for logged in users."*);
  - `You have been kicked out of the game.`;
  - un pulsante `Bankrupt` (presente nella lobby ma non visibile).

---

## 5. Poteri dell'host

| Potere | Come | Esito |
|---|---|---|
| Modificare le impostazioni | switch e menu nella colonna destra | Le modifiche arrivano subito agli ospiti; nel DOM c'è il testo `Updating settings...` mentre si salva **[V]** |
| Espellere (kick) | X accanto al giocatore, poi conferma | Finestra: *"Are you sure you want to kick TerzoLuca? this action cannot be undone."* con pulsanti `Kick player` e `Cancel` (e X) **[V]** |
| Avviare | `Start Game` | Partenza immediata **[V]** |
| Cambiare mappa | `Change map` (solo l'host; gli ospiti vedono `Browse maps`) | Si possono usare solo le mappe possedute **[V]** |
| Dare tempo extra (in partita) | `Grant +1 min` sul timer del turno altrui | Visto, non cliccato **[V]** |

Dettagli sul kick:
- Chi viene espulso torna alla home con il toast *"You got kicked out of the game."* **[V]**
- **Nessun ban**: lo stesso giocatore ha riaperto il link ed è rientrato subito **[V]**.
- Si possono espellere anche i bot, con la stessa finestra di conferma **[V]**.
- Non esiste un comando per cedere la presidenza della stanza: l'host cambia solo se esce **[V per assenza in UI]**.

---

## 6. Impostazioni di partita (tabella completa)

Pannello `Game settings` nella colonna destra, diviso in due sezioni: impostazioni di stanza e `Gameplay rules`. Testi copiati esattamente dal sito. Default verificati su due stanze private nuove **[V]**.

| Impostazione (testo esatto) | Descrizione/tooltip (testo esatto) | Tipo | Valori possibili | Default |
|---|---|---|---|---|
| **Maximum players** | How many players can join the game | menu a tendina | `2`, `3`, `4`, `5`, `6`, `More options...` (7 e 8 sono a pagamento, vedi sotto) | **4** |
| **Private room** | Con 1 giocatore: *Private rooms can be accessed using the room URL only*. Con 2 o più giocatori diventa: *Private room. The host can remove players who run out of time.* | switch | on/off | **ON** (stanza creata con "Create a private game") |
| **Allow bots to join** `Beta` | Bots will join the game based on availability | switch | on/off | **OFF** |
| **Board map** | Change map tiles, properties and stacks | selettore (link `Change map` per l'host, `Browse maps` per gli ospiti) | Classic, Mr. Worldwide, Death Valley, Lucky Wheel | **Classic** |
| *Gameplay rules:* | | | | |
| **x2 rent on full-set properties** | If a player owns a full property set, the base rent payment will be doubled | switch | on/off | **OFF** |
| **Vacation cash** | If a player lands on Vacation, all collected money from taxes and bank payments will be earned | switch | on/off | **OFF** |
| **Auction** | If someone skips purchasing the property landed on, it will be sold to the highest bidder | switch | on/off | **OFF** |
| **Don't collect rent while in prison** | Rent will not be collected when landing on properties whose owners are in prison | switch | on/off | **OFF** |
| **Mortgage** | Mortgage properties to earn 50% of their cost, but you won't get paid rent when players land on them | switch | on/off | **OFF** |
| **Even build** | Houses and hotels must be built up and sold off evenly within a property set | switch | on/off | **ON** |
| **Starting cash** | Adjust how much money players start the game with | menu a tendina | `$500`, `$1000`, `$1500`, `$2000`, `$2500`, `$3000` | **$1500** |
| **Randomize player order** | Randomly reorder players at the beginning of the game | switch | on/off | **ON** |

Note sulle impostazioni:
- **Maximum players 7-8**: nel menu dell'host al posto di 7 e 8 c'è `More options...`, che apre in una nuova scheda `/store/upgrades` (upgrade *"7-8 Players"* da 30 Richup Coins) **[V]**. Nella vista disattivata (prima di entrare, o in "Room Settings" durante la partita) il menu elenca 2-8 **[V]**. Il massimo assoluto è quindi **8** **[V/D]**.
- Si può impostare un massimo **inferiore ai giocatori presenti** (es. 2 con 4 in stanza). Nessuno viene espulso, ma `Start Game` si disattiva con il tooltip *"There are more players than you limited in the game settings. Kick some of them."* **[V]**
- Alzando il massimo, chi vedeva "stanza piena" può entrare subito: il suo `Join game` si riattiva **[V]**.
- **Private room OFF**: non provato (la stanza diventerebbe pubblica, cosa vietata dalle regole). **[D]** Probabilmente la stanza compare in `All rooms`.
- Le impostazioni non hanno un tooltip separato: la descrizione è sempre visibile sotto il nome. Ogni riga ha un'icona (persone, chiave, robot, mappa, monete, sdraio, martelletto, grafico, mano con dollaro, casa, banconota, frecce incrociate) **[V]**.
- Nell'elenco `All rooms` ogni stanza mostra la mappa e le icone delle regole diverse dal default, con un pallino verde (`Rule enabled`) o rosso (`Rule disabled`), e il denaro iniziale se non è standard; altrimenti `Default room settings`. Esempio di tooltip: *"Even build — Houses and hotels must be built up and sold off evenly within a property set — Rule disabled"* **[V]**.
- Durante la partita le impostazioni si consultano dalla finestra **"Room Settings"** (pulsante `View room settings`), in **sola lettura per tutti, host compreso** **[V]**.
- Nello Store esiste un upgrade **"Teams Mode"** (20 coins), ma nella lobby non compare nessuna impostazione relativa alle squadre **[V store / D: visibile forse solo a chi lo possiede]**.

---

## 7. Avvio della partita

- **Minimo 2 giocatori**. Con 1 solo giocatore `Start Game` è disattivato, con il tooltip *"You must have at least two players for the game to start"* **[V]**.
- Avvio disattivato anche se i giocatori sono più del massimo impostato (vedi §6) **[V]**.
- I bot contano come giocatori **[V]**.
- **Nessun conto alla rovescia**: 0,3 secondi dopo il click la partita è già iniziata per tutti **[V]**.
- Messaggi nel registro **[V]**:
  - con Randomize OFF: `Game started . Good luck!` (sic, con lo spazio prima del punto);
  - con Randomize ON: `Game started with a randomized players order. Good luck!`
- Ordine dei turni:
  - Randomize OFF: si segue l'ordine della lista, cioè l'ordine di ingresso. Il primo è chi è entrato per primo, di solito l'host **[V]**.
  - Randomize ON: ordine rimescolato dal server. Nella prova a 2 giocatori ha iniziato l'host, ma il campione è troppo piccolo **[V messaggio / D algoritmo]**.
  - Non c'è un tiro di dadi iniziale per decidere chi parte **[V]**.
- Transizione (in breve, il gioco lo analizzano altri agenti):
  - la lista giocatori mostra il denaro di ciascuno (es. `$2000`), e l'host ha una corona al posto del badge;
  - compaiono `Bankrupt`, il pannello `Trades` con `Create` e il suggerimento `Got it`, e `My properties (0)`;
  - al centro: `<nome> is playing...`, poi `Roll the dice` per il giocatore di turno;
  - il timer del turno parte da circa 60 s (`0:57` visto subito dopo l'avvio), con `Ask for more time` per chi gioca e `Grant +1 min` per l'host **[V]**.

---

## 8. Bot

- **Nessun pulsante "aggiungi bot" e nessun livello di difficoltà**: c'è solo lo switch `Allow bots to join` (Beta) **[V]**.
- Con lo switch attivo i bot **riempiono da soli i posti liberi** fino a `Maximum players`, a ondate e non tutti insieme ("based on availability"). Con massimo 4 e 2 umani sono entrati 2 bot nel giro di circa 30-60 s **[V]**.
- I bot hanno nomi casuali "Aggettivo Sostantivo", come i nickname generati (`Delayed Tea`, `Murky Remove`, `Cheap Gift`), e un colore libero **[V]**.
- Se l'host espelle un bot con lo switch ancora attivo, **ne entra subito un altro** **[V]**.
- Disattivando lo switch **i bot già presenti restano**. Vanno espulsi a mano uno per uno **[V]**.
- I bot occupano posti: un umano può trovare `The room is full.` perché i posti sono pieni di bot **[V]**.
- I bot non diventano mai host. Il ruolo passa al primo umano in lista **[V nei casi osservati]**.

---

## 9. Uscita, ricarica e cambio di host

### In lobby
- **Host che ricarica la pagina** = host che esce **[V]**:
  - il registro scrive `HostAnna left the game`;
  - il ruolo passa al giocatore successivo in lista;
  - chi ricarica torna alla home con il nickname precompilato e `Enter Game`, e deve rifare pubblicità, colore e `Join game`;
  - rientra come giocatore normale, in fondo alla lista.
- **Host che esce** (va alla home): stesso comportamento, il ruolo passa al successivo in lista. Successione osservata: HostAnna, poi Rare Lieuwe, poi TerzoLuca **[V]**.
- Le impostazioni scelte restano dopo il cambio di host (es. x2 rent ON, Starting cash) **[V]**.
- Il nuovo host ottiene subito switch attivi, X per il kick e `Start Game` **[V]**.

### In partita
- Un giocatore (anche l'host) che chiude o lascia la pagina **resta in partita** **[V]**:
  - viene marcato con un'icona "connessione persa" e un conto alla rovescia (circa 2 minuti; `01:09` letto circa 70 s dopo l'uscita);
  - tooltip: *"This player lost connection. Their turns are being skipped, and you can grant them time if they are about to come back."*
- Allo scadere viene rimosso. Nella prova a 2 giocatori la partita è finita subito (`Game over! and the winner is...`) e la corona è passata al rimasto **[V]**.
- Fine partita: pulsanti `Another game` e `Back to lobby`, `Game statistics` con classifica, `View all statistics` e condivisione social **[V]**.
- `Another game` riporta **la stessa stanza (stesso URL)** allo stato di lobby vuota (`Waiting for players...`): tutti devono rifare `Join game` **[V]**. Se le impostazioni restino quelle della partita precedente non l'ho verificato (la stanza aveva i default) **[D]**.

---

## 10. Stanza piena e spettatori

- **Stanza piena in lobby**: al nuovo arrivato, sopra la scelta colore oscurata, compaiono **[V]**:
  - `The room is full.`;
  - `Spectate game` (icona occhio) e `Return to lobby` (icona casa).
- Con `Spectate game` il pulsante si disattiva e compare `waiting for the game to start...`. Lo spettatore vede lobby, impostazioni e lista ma non è in elenco **[V]**.
- **Link aperto a partita già iniziata** **[V]**:
  - home, poi `Enter Game`, poi pubblicità, poi **vista spettatore diretta**, senza scelta colore né "Join";
  - lo spettatore vede tabellone, pedine, denaro dei giocatori, timer, il pannello `Trades` (senza `Create`) e `View room settings`;
  - non ha `Bankrupt` né `My properties`;
  - la chat è in sola lettura (`Only game players can send chat messages`);
  - non compare nella lista giocatori e non ho visto un contatore degli spettatori.
- **Stanza inesistente o scaduta**: si torna alla home con il toast *"We couldn't find room qqqqq. It has expired or deleted."* **[V]**

---

## 11. Selezione mappa

Finestra **"Board Maps"** (dall'host con `Change map`, dagli ospiti con `Browse maps`). Ogni mappa ha un'anteprima e dei pulsanti **[V]**:

| Mappa | Host vede | Ospite vede | Prezzo Store |
|---|---|---|---|
| **Classic** | `Use`, `Preview` | `Free`, `Preview` | gratis (default) |
| **Mr. Worldwide** | `Buy` (link a `/store/board-maps?item=...`), `Preview` | `Premium`, `Preview` | 180 coins |
| **Death Valley** | `Buy`, `Preview` | `Premium`, `Preview` | 180 coins |
| **Lucky Wheel** | `Buy`, `Preview` | `Premium`, `Preview` | 180 coins |

- `Preview` apre la finestra `Board preview` con il nome della mappa, il tabellone completo e `Close preview` **[V]**.
- Differenze (lette dalle anteprime) **[V]**. Casella Start in ogni mappa, angoli: In Prison/Passing by, Vacation, Go to prison.
  - **Classic**: 40 caselle, 22 città, 4 aeroporti, 2 società (Power, Water), 3 Treasure, 3 Surprise, `Earnings Tax` (%10), `Premium Tax` ($75). Paesi: Brasile 2, Israele 3, Italia 3, Germania 3, Cina 3, Francia 3, UK 3, USA 2. Prezzi da 60 $ (Salvador) a 400 $ (New York).
  - **Mr. Worldwide**: **48 caselle** (11 per lato invece di 9), 28 città (si aggiungono India, Giappone, Bologna, Birmingham, Los Angeles), **3 società** (anche Gas Company), 4 Treasure, 3 Surprise.
  - **Death Valley**: 40 caselle con **gruppi grandi**: Canada 5, Germania 6, UK 6, USA 5. Aeroporti YYZ, MUC, LHR, JFK.
  - **Lucky Wheel**: 40 caselle, **16 città in 8 coppie** (Turchia, Romania, Italia, Germania, Cina, Irlanda, UK, USA), nessuna società. Due lati sono quasi interamente carte e tasse (molte Treasure/Surprise, 2 Premium Tax) e c'è la casella nuova `Tax Refund` ($50).
- Per tutti i dettagli di caselle e prezzi vedi `05-tabellone-mappe.md` (altro agente).

---

## 12. Testi esatti importanti (in inglese come sul sito)

| Contesto | Testo |
|---|---|
| Home, pulsanti | `Play` · `Enter Game` (quando si arriva da un link stanza) · `All rooms` · `Create a private game` |
| Nickname | `Your nickname...` |
| Caricamento | `Loading game...` · `Tip` |
| Pubblicità ospiti | `You will be taken to the game room after the advertisement ends.` |
| Condivisione | `Share this game` · `Copy` · `Copied!` · tooltip `Everyone with the link will be able to join this game. If it has already started, they will join as spectators.` |
| Scelta pedina | `Select your player appearance:` · `Join game` · `Get more appearances` · `Change appearance` |
| Conflitto colore | `Oops! another player has just joined the game with your selected appearance. Choose another one.` |
| Lista | `Host` · `Waiting for players...` · tooltip `Kick player` · tooltip `Login` |
| Attesa ospite | `Waiting for <host> to start the game...` |
| Avvio disattivato | `You must have at least two players for the game to start` · `There are more players than you limited in the game settings. Kick some of them.` |
| Avvio | `Start Game` · `Game started . Good luck!` · `Game started with a randomized players order. Good luck!` |
| Kick | `Are you sure you want to kick <name>? this action cannot be undone.` · `Kick player` · `Cancel` · `You got kicked out of the game.` |
| Registro | `Joined room <id>` · `<name> joined the game` · `<name> left the game` · `<name> got kicked out of the game` |
| Stanza piena | `The room is full.` · `Spectate game` · `Return to lobby` · `waiting for the game to start...` |
| Chat | `Chat` · `No messages yet` · `Say something...` · `Only game players can send chat messages` · tooltip `Mute chat` / `Minimize` / `Expand` |
| Impostazioni | `Game settings` · `Gameplay rules` · `Room Settings` · `View room settings` · `Updating settings...` · `More options...` · `Change map` · `Browse maps` |
| Mappe | `Board Maps` · `Use` · `Buy` · `Preview` · `Free` · `Premium` · `Board preview` · `Close preview` |
| Bot | `Beta` · tooltip `Game bot` + `Bots are just like regular players; they can purchase, bankrupt and even trade. However, their hearts are made of metal, and they might be shy on chat.` |
| Disconnessione | `This player lost connection. Their turns are being skipped, and you can grant them time if they are about to come back.` |
| Stanza inesistente | `We couldn't find room <id>.` / `It has expired or deleted.` |
| Fine partita | `Game over!` · `and the winner is...` · `Another game` · `Back to lobby` · `Game statistics` · `View all statistics` · `Share with friends` |

---

## 13. Casi limite osservati

1. **Il creatore non diventa host se un altro entra prima** di lui **[V]**.
2. Nickname vuoto: viene assegnato un nome casuale **[V]**.
3. Nickname duplicati: ammessi, senza avvisi **[V]**.
4. Due giocatori sullo stesso colore: impossibile. Vince chi conferma per primo, l'altro riceve il toast **[V]**.
5. Massimo giocatori sotto i presenti: consentito, ma l'avvio resta bloccato finché l'host non espelle qualcuno **[V]**.
6. Espulso che rientra: consentito, nessun ban **[V]**.
7. Bot espulso con i bot attivi: viene rimpiazzato subito da un altro bot **[V]**.
8. Bot disattivati: quelli già presenti restano **[V]**.
9. Host che ricarica in lobby: perde il ruolo e il posto **[V]**.
10. Giocatore che esce in partita: resta come "disconnesso" per circa 2 minuti, con i turni saltati, poi viene rimosso **[V]**.
11. Partita con 1 solo giocatore rimasto: finisce subito con la vittoria del rimasto **[V]**.
12. Spettatore in lobby piena: quando si libera un posto il suo `Join game` si riattiva da solo **[V]**.
13. La chat non mostra i messaggi inviati prima del proprio ingresso **[V]**.
14. Stanza inesistente: redirect alla home con toast **[V]**.
15. Browser headless: blocco Cloudflare Turnstile sul caricamento della stanza **[V]**.

---

## 14. Dubbi e cose non verificate

- **Private room OFF**: non provato (renderebbe pubblica la stanza). Effetto atteso: la stanza compare in `All rooms` **[D]**.
- **Algoritmo di "Randomize player order"**: provato solo con 2 giocatori.
- **Preselezione del colore** in un browser nuovo: casuale o "primo libero"? Non chiarito.
- **Contatore `0` della chat**: forse messaggi non letti o emoji/reazioni. Non chiarito.
- **Volume**: il tooltip mostra `100%`, ma l'eventuale slider o mute al click non l'ho osservato con certezza.
- **Animazione del feedback `Copied!`**: il testo è nel DOM, l'aspetto a schermo non l'ho catturato.
- **Gli spettatori ricevono i nuovi messaggi di chat?** Non verificato (vedono solo che non possono scrivere).
- **Impostazioni dopo `Another game`**: restano o tornano ai default? Non verificabile, la stanza aveva già i default.
- **Durata esatta della disconnessione** prima della rimozione: stimata in circa 2 minuti.
- **Stanze "exclusive for logged-in users"** e **Teams Mode**: richiedono login o acquisto, non verificabili.
- **Scadenza delle stanze inattive**: non misurata (il toast parla di "expired").
- **Limite di 8 giocatori**: dedotto dal menu (2-8) e dall'upgrade "7-8 Players", non provato con 8 giocatori reali.

---

## 15. Screenshot salvati (`docs/analisi/img/`)

| File | Contenuto |
|---|---|
| a2-01-home.png | Home con dialog consenso già chiuso |
| a2-02-loading.png | "Loading game..." (sessione headless bloccata da Cloudflare) |
| a2-03-room-before-join.png / a2-03b-…-full.png | Stanza appena creata, prima del Join dell'host |
| a2-04-share-tooltip.png | Tooltip del riquadro "Share this game" |
| a2-05-copied.png | Dopo il click su Copy |
| a2-06-lobby-host-joined.png | Lobby con l'host entrato |
| a2-07-more-options.png | Dopo "More options..." nel menu Maximum players |
| a2-08-store-upgrades.png | Store › Upgrades (7-8 Players, Teams Mode…) |
| a2-09-maps.png | Finestra Board Maps (host) |
| a2-10 / a2-11 / a2-12-map-preview-*.png | Anteprime di Mr. Worldwide, Death Valley e Lucky Wheel |
| a2-13-guest-arrival.png | L'ospite arriva dal link (home con "Enter Game") |
| a2-14-guest-empty-nick.png | Ospite dopo "Enter Game" con nickname vuoto (pubblicità) |
| a2-15-guest-room.png | Vista ospite prima del Join |
| a2-16-guest-browse-maps.png | Board Maps vista dall'ospite (Free/Premium) |
| a2-17-guest-joined.png / a2-18-host-with-guest.png | Lobby a 2 giocatori (vista ospite e host, X per il kick) |
| a2-19-chat.png / a2-20-chat-minimized.png | Chat con messaggi; chat minimizzata |
| a2-21-volume.png | Dopo il click sull'icona del volume |
| a2-22-guest-view-settings.png | Impostazioni disattivate viste dall'ospite |
| a2-23-change-appearance.png | Popover "Change appearance" |
| a2-24-host-after-guest-color.png | Cambio colore visto dall'host |
| a2-25-room-full.png / a2-26-spectate-lobby.png / a2-27-…max3.png | Stanza piena, Spectate, cambio del massimo |
| a2-28-color-conflict.png | Toast di conflitto colore |
| a2-29 / a2-30-*three-players.png | Lobby a 3 giocatori |
| a2-31-kick-click.png | Finestra di conferma del kick |
| a2-32-kicked-view.png | Home dell'espulso con toast |
| a2-33-host-after-kick.png / a2-34-kicked-rejoin.png | Dopo il kick; l'espulso rientra |
| a2-35-bots-on.png / a2-36-bots-wait.png | Bot attivati |
| a2-37-guest-during-host-reload.png | Host ricarica: il ruolo passa, entra un bot |
| a2-38-host-after-reload.png | L'ex host trova la stanza piena (bot) |
| a2-39-newhost-bots.png | Nuovo host con 2 bot |
| a2-40-kick-bot-bots-off.png / a2-41-kick-bot-dialog.png | Kick di un bot (rimpiazzato), bot disattivati |
| a2-42-exhost-rejoined.png | L'ex host rientra come giocatore normale |
| a2-43-host-left.png | L'host esce: ruolo al successivo |
| a2-44-duplicate-nick.png | Due "HostAnna" |
| a2-45-max-below-count.png / a2-46-start-disabled-tooltip.png | Massimo 2 con 4 giocatori; Start disattivato |
| a2-47 / a2-48 / a2-49-start-*.png | Avvio partita (nessun countdown) |
| a2-50-game-first-turn.png | Primo turno (Roll the dice, timer) |
| a2-51-view-room-settings.png | Finestra "Room Settings" in partita |
| a2-52-spectator-arrival.png / a2-53-spectator-view.png | Spettatore a partita iniziata |
| a2-54-host-ingame.png / a2-55-host-timeout.png | Grant +1 min / Ask for more time |
| a2-56-room-notfound.png | Toast "We couldn't find room…" |
| a2-57-all-rooms.png | Elenco All rooms (solo consultato) |
| a2-58-first-joiner-host.png | Il primo che entra diventa host |
| a2-59-room2-two-players.png | Stanza 2 con 2 giocatori |
| a2-60 / a2-61-room2-*.png | Avvio con ordine casuale |
| a2-62 / a2-63 / a2-64-*.png | Host disconnesso in partita, conto alla rovescia, Game over |
| a2-65-another-game.png | "Another game": stessa stanza riportata a lobby vuota |
