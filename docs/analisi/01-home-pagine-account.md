# 01 - Homepage, navigazione, pagine, account, personalizzazione (richup.io)

Analisi eseguita il 07/11/2026 con `playwright-cli` (Edge), viewport 1440x900 e 390x844, senza login e senza acquisti.

**Legenda affidabilità**
- **[V]** = VERIFICATO nel browser (visto, cliccato, misurato).
- **[C]** = letto dal codice client pubblico (bundle JS) o da API pubbliche non autenticate: affidabile ma non visto in azione.
- **[D]** = DEDUZIONE / ipotesi da confermare.

---

## 1. Panoramica

- Richup.io è una SPA React (router con route tipizzate, React Query), tema **solo scuro**, **solo in inglese** (nessun selettore lingua o tema) [V].
- Si gioca **senza account**: basta un nickname (anche vuoto) e si entra in una stanza [V]. Il login (Google, Facebook, Discord, X) è facoltativo e sblocca profilo, statistiche, karma, amici, Store e stanze "esclusive" [V/C].
- Tre modi per entrare in partita dalla home: **Play** (matchmaking verso una stanza pubblica), **All rooms** (lista delle stanze pubbliche), **Create a private game** (stanza privata con link) [V].
- Ogni stanza ha un URL `/room/<id>` con **id di 5 caratteri** minuscoli/cifre (es. `kp075`, `snvd5`) [V]. Aprire quel link mostra la home con il pulsante **"Enter Game"** al posto di "Play": è il meccanismo d'invito [V].
- Monetizzazione: banner pubblicitari ai lati, video-ad, Store con valuta virtuale **Richup Coins** (comprata con dollari o guadagnata vincendo) spesa in cosmetici, mappe e upgrade [V].
- Anti-bot: dopo aver scelto una stanza compare **Cloudflare Turnstile** ("Verify you are human"). Il flag `captcha:1` lo conferma [V]. Per regola non ho risolto il captcha, quindi **non sono entrato in nessuna lobby**.

---

## 2. Route e URL incontrate

### Pagine (route del client)
| Route | Titolo scheda | Contenuto | Stato |
|---|---|---|---|
| `/` | `Richup.io: Monopoly Alternative 🎲 - Free Online Board Game` | Home/lobby d'ingresso | [V] |
| `/room/$roomId` | `Richup.io` | Stanza (caricamento, Turnstile, lobby/partita). Aperta direttamente: home con "Enter Game" | [V] |
| `/store` | `Store \| Richup.io` | Store, vista "All" | [V] |
| `/store/player-appearance`, `/store/board-maps`, `/store/upgrades`, `/store/avatars` | idem | Categoria | [V] |
| `/store/coins` | idem | Pacchetti di Richup Coins | [V] |
| `/store/<categoria>?item=<itemId>` | idem | Apre direttamente il dettaglio dell'oggetto (deep link) | [V] |
| `/store/coins?pack=<packId>` | idem | Apre il dettaglio del pacchetto coin | [V] |
| `/store?item=<itemId>` | idem | Link usato dall'inventario del profilo | [C] |
| `/store/<categoria-inesistente>` | | Redirect a `/store` | [V] |
| `/profile/$userId` | `Profile` | Profilo pubblico (id esadecimale di 24 caratteri) | [V] |
| `/settings` | `Your Settings` | Impostazioni account. **Da ospite va in errore** | [V] crash / [C] contenuto |
| `/info` | `More Info` | Partner, stampa, copyright, contatti | [V] |
| `/terms-and-conditions`, `/privacy-policy`, `/cookie-policy`, `/refund-policy`, `/data-deletion` | omonimi | Testi legali | [V] |
| qualsiasi altra | | "Page not found" | [V] |

### Link esterni
- Discord `https://discord.gg/r6uJ6bq8ZH` (pulsante flottante in basso a destra e footer), Facebook `https://facebook.com/playrichupio`, Blog `https://blog.richup.io/` [V].

### API REST viste (solo per riferimento architetturale)
- Pubbliche [V]: `GET /api/auth/self` (401 se ospite), `/api/features`, `/api/maintenance/maintenance-info`, `/api/announcements`, `/api/lobby/landing?roomId=`, `/api/push/public-key`, `/api/store`, `/api/game/maps`, `POST /api/user/bulk`, `GET /api/room/new?isPrivate=true` (crea la stanza privata e restituisce l'id).
- Autenticate [C]: `/api/user/friends`, `/user/self/update-name`, `/user/self/update-profile-picture`, `/user/self/profile-picture-options`, `/user/<id>/profile`, `/user/<id>/last-games?page=`, `/user/<id>/friendship`, `/user/<id>/block`, `/game/claim-coin-reward`, `/game/reauth`.
- Login [C]: `/api/auth/<provider>?display=popup&nonce=…&origin=…` (login in finestra popup, flag `inPlaceLogin`) e `/api/auth/logout?origin=…`.
- Realtime [C]: socket.io su `/api/app/socket.io/` (app) e `/api/game/socket.io/` (partita).
- Feature flag lette da `/api/features` [V]: `captcha:1, teams:1, manualAdRefresh:1, inPlaceLogin:1, chatAntiAbuse:1, chatShieldMode:0, turnClock:1, tradeFairnessRules:1`.

---

## 3. Elementi globali (presenti su più pagine)

### 3.1 Header
- **Home** [V]: in alto a sinistra il pulsante **audio** (icona altoparlante); in alto a destra **Store** (icona carrello) e **Login** (icona freccia d'ingresso). Il logo grande è al centro del corpo pagina, non nell'header.
- **Altre pagine** (Store, profilo, info, legali) [V]: a sinistra il logo RICHUP.io (link a `/`), a destra Store e Login. **Niente pulsante audio**.
- **Il "bottone in alto a sinistra" non è un menu**: è il controllo del volume (sezione 9.1). Su mobile esiste invece un menu hamburger in alto a destra (sezione 10).
- **Da loggati** [C]: al posto di "Login" c'è un menu utente con sfondo dell'immagine profilo, avatar con anello karma, nome, "`<N> Karma points`" e le voci **"Your profile"**, **"Settings"**, **"Sign out"**.

### 3.2 Footer (home e pagine) [V]
Link "More Information" (`/info`), "Blog", "Terms & Conditions", "Privacy", "Cookies", icone Discord e Facebook, testo "Richup is not responsible for content created by players."

### 3.3 Pubblicità e consenso [V]
- Due colonne "Ad" fisse ai lati (banner 160x600) su desktop. Su mobile c'è un blocco "Ad" dentro il flusso della pagina.
- Al primo accesso compare il dialog di consenso IAB ("richup.io asks for your consent…", pulsanti "Consent", "Do not consent", "Manage options"). Dopo la scelta resta un pulsantino a scudo in basso a sinistra ("Privacy settings") per riaprirlo.
- [C] Se rileva un adblocker, dopo 3 s mostra un popup chiudibile: "Please disable your Adblocker" / "Richup is free and wants to stay free. We use ad revenue to keep maintaining the game. Thanks! ❤".
- [C] Entrando da un link d'invito (`/room/<id>`) viene richiesto un video-ad (`setShowVideoAd`).

### 3.4 Notifiche (toast) [V/C]
- Regione accessibile "Notifications Alt+T". I toast hanno una barra di avanzamento del timer e una X per chiuderli [V].
- Esempi verificati: "We couldn't find room zzzz9." + "It has expired or deleted." (in basso al centro) [V].
- Altri toast nel codice [C]:
  - "Return to game *<id>*" / "Continue from where you left off" (in alto al centro, resta finché non lo chiudi, cliccabile per rientrare in una partita in corso);
  - "You just earned N Coin(s)!" con sottotitolo "for winning the game." o "for viewing an ad." (in basso a sinistra);
  - "You got kicked out of the game.";
  - "The host removed you after your time ran out. It costs no karma.";
  - "`<nome>` is asking for more time.";
  - "Oops! another player has just joined the game with your selected appearance. Choose another one.";
  - "Thanks. Your report about `<nome>` was submitted.";
  - "Your game is up-to-date.";
  - richieste di amicizia con "Approve"/"Decline".

### 3.5 Pulsante Discord flottante [V]
Icona Discord fissa in basso a destra, apre l'invito Discord.

---

## 4. Homepage `/`

### 4.1 Hero [V]
- **Dado 3D** bianco in alto: cliccandolo rotola. [C] Fa anche un suono e si ferma sempre sul 6 (`value:6`); è puramente decorativo.
- Logo "RICHUP.io" e sottotitolo **"Rule the economy"**.
- Sfondo con icone di gioco sparse (aereo, fulmine, forziere, punto interrogativo, banconote, edifici…), con un bagliore colorato in basso.

### 4.2 Campo nickname [V]
- Placeholder: **"Your nickname..."**. `maxlength=32`: incollando 41 caratteri ne restano 32.
- **Nessuna validazione lato client**: accetta stringa vuota, solo spazi, emoji e caratteri HTML (`Ciao😀<b>x</b>`). Non compaiono messaggi d'errore. La validazione lato server non è verificabile (bloccata dal Turnstile).
- **Il "selettore" accanto al nickname non è un avatar**: è un'icona **dado** (font-awesome `dice`) che genera un **nickname casuale** di tipo "Aggettivo Sostantivo" in inglese. Esempi: "Hairy Employ", "Rotten Evening", "Wrong Consist". Ogni clic ne genera uno nuovo. L'icona è piccola, bianca, a destra del campo.
- **Persistenza**: entrando in una stanza il nome viene salvato in `localStorage` come `PLAYER_NAME` e precompilato alle visite successive [V].
  - [C] Se il campo è vuoto e non è stato modificato, si usa il nome salvato.
  - [C] Se sei loggato, il campo è sostituito da una card utente con avatar e nome e l'etichetta **"Playing as"**. Il nickname coincide con il nome account, modificabile nel profilo.
- La scelta dell'aspetto della pedina (colore/forma) **non avviene in home**: avviene nella stanza (lo conferma il toast "another player has just joined the game with your selected appearance") [D].

### 4.3 Pulsante "Play" (matchmaking rapido)
- [V] Pulsante grande viola con icona ">>" e testo **"Play"**. Al clic: navigazione immediata a `/room/<id>` di una **stanza pubblica** (es. `/room/zh8vn`), schermata "Loading game..." con un Tip, poi il widget Cloudflare **"Verify you are human"**. Non ho superato il captcha, quindi non ho visto la lobby e non sono entrato in partita.
- [V] Funziona anche con il nickname vuoto: nessun blocco lato client.
- [C] Logica: `findRoom(maxPlayers = 4)` (default) restituisce un `roomId`, poi naviga alla stanza con `state.fromLobby = true`. Durante la ricerca il pulsante mostra un loader.
- [C] Se la pagina è aperta da un link stanza, il pulsante diventa **"Enter Game"** ed entra in quella stanza.

### 4.4 "All rooms" (lista stanze pubbliche) [V]
Si apre **nello stesso riquadro** della home, senza cambiare URL: il blocco nickname/Play viene sostituito da un pannello scuro.
- **Barra superiore**: **"Back"** (freccia, torna al blocco Play), pulsante **refresh** (icona frecce circolari, senza testo) e **"New room"** (viola, icona "+"; non cliccato per non creare stanze pubbliche).
- Testo: **"Select the room you would like to join:"**
- **Lista scrollabile** di card. Ne ho contate 13 in un momento; il riquadro mostra circa 3,5 card e scorre al suo interno. Ogni card contiene:
  - **ID stanza** (5 caratteri) in grassetto;
  - **Slot giocatori** = numero massimo di giocatori. Un utente loggato appare con la sua immagine profilo (o un cerchio con l'iniziale colorata), un ospite con l'icona omino, uno slot libero con un pallino grigio. Esempi: 2, 3, 4, 6 slot;
  - **icona Teams mode** (gruppo di persone) al centro, se la modalità squadre è attiva, con tooltip "Teams mode";
  - **riquadro a destra**: nome della mappa con icona (es. "Classic"), poi **"Default room settings"** se tutte le regole sono di default, altrimenti una fila di **icone delle regole diverse dal default**. Ogni icona ha un pallino **verde** (regola attiva) o **rosso** (regola disattivata). La cifra dopo l'icona $ è lo starting cash.
- **Tooltip delle icone regola** (testi esatti) [V]:
  - coins: "x2 rent on full-set properties" / "If a player owns a full property set, the base rent payment will be doubled" / "Rule enabled"
  - island: "Vacation cash" / "If a player lands on Vacation, all collected money from taxes and bank payments will be earned"
  - gavel: "Auction" / "If someone skips purchasing the property landed on, it will be sold to the highest bidder"
  - chart-down: "Don't collect rent while in prison" / "Rent will not be collected when landing on properties whose owners are in prison"
  - hand-dollar: "Mortgage" / "Mortgage properties to earn 50% of their cost, but you won't get paid rent when players land on them"
  - house-building: "Even build" / "Houses and hotels must be built up and sold off evenly within a property set" / "Rule disabled"
  - dollar: "Starting cash" / "Adjust how much money players start the game with" / "3000"
- **Hover sull'avatar** di un giocatore loggato: mini-card con avatar, nome, **"Karma: 30 / 30"** e pulsante **"Profile"** (apre `/profile/<id>` in una nuova scheda) [V].
- **Hover sulla card**: lo sfondo si schiarisce. **Clic sulla card**: entra nella stanza [D, non cliccato].
- **In fondo**: banner fisso **"+2 exclusive rooms for logged in users."** con link **"Login for free"**, che apre il popover di login. Il numero cambia dinamicamente (visto +2 e +3) [V]. Da ospite queste stanze non si vedono: [C] corrispondono probabilmente all'opzione stanza `onlyUsers`.
- **Aggiornamento**: in 35 s la lista non è cambiata, nemmeno dopo il refresh manuale. Non ho visto aggiornamenti in tempo reale [V]; [D] probabilmente si aggiorna solo al refresh o alla riapertura.
- **Ordinamento**: non deducibile con certezza. Le prime card erano stanze con più giocatori o default, ma non è un criterio confermato [D].
- Compaiono anche stanze con tutti gli slot pieni (es. 2/2) [V]: non è chiaro se siano ancora in attesa o già in partita [D].

**Valori di default delle stanze** (spiegano il badge "Default room settings") [C]: `maxPlayers 4, canBotsJoin true, isPrivate false, onlyUsers false, payDoubleRentWhenOwnFullSet false, vacationCash false, auction false, noRentPaymentsWhileInPrison false, mortgage false, startingCash 1500, evenBuild true, shufflePlayerOrder true, teams disabled`. Valori ammessi: maxPlayers 2–6 (più 7–8 con l'upgrade a pagamento), startingCash 500/1000/1500/2000/2500/3000. Il dettaglio delle impostazioni spetta all'analisi della lobby.

### 4.5 "Create a private game" [V]
- Pulsante viola chiaro con icona chiave. Al clic: `GET /api/room/new?isPrivate=true`, poi navigazione a `/room/<nuovoId>` (es. `/room/kp075`), schermata "Loading game..." con Tip. Il nickname viene salvato in `PLAYER_NAME`.
- La lobby non si è caricata: Turnstile in attesa, schermata ferma su "Loading game..." anche dopo 20 s. Mi sono fermato alla creazione, come da compito.
- **Link d'invito**: riaprendo `https://richup.io/room/kp075` si vede la home con nickname precompilato, pulsante **"Enter Game"** e logo cliccabile per tornare a `/` [V].

### 4.6 Sezione "How to play" (sotto la piega, animata allo scroll) [V]
Testi esatti, ognuno con un'icona:
1. "All players start with $1500."
2. "On your turn, roll the dice to move forward." / "Got doubles? You’ll have another turn!"
3. "Purchase valuable properties and grow your financial empire." / "Once you own a property, other players will pay rent when they land on it."
4. "Own a full property set? Start building houses and hotels" / "Players will pay you a large amount of money when they land on properties with buildings. Build hotels to maximize income and make other players lose their money."
5. "Be rich. Get richer. Do not bankrupt."

Illustrazioni:
- una porzione di tabellone (TLV Airport 200$, Tel Aviv, Haifa 110$) con la **scheda proprietà "Tel Aviv"**: rendita with rent $6, one house $30, two $90, three $260, four $380, hotel $540; pulsanti costruisci/vendi/elimina; Owner "John Doe"; Price $100, casa $50, hotel $50;
- una fila Rome / Milan / Power Company / Venice con case ×3, hotel, case ×4.

Le animazioni scattano allo scroll: lo screenshot full-page le mostra vuote.

### 4.7 Stati speciali della home (non osservati, dal codice) [C]
- **Manutenzione** (`isMaintenance`): "Richup is getting an update" / "The servers are currently under maintenance." / "Come back in a few minutes." / "For more updates, join Richup on Discord". La risposta API attuale era `{"isMaintenance":false,"deadline":null,"progress":null}`, quindi esiste una scadenza e una barra di avanzamento.
- **Utente bannato**: "You are banned from Richup.io" / "It means you have violated our Terms and conditions" / "Your ban will be lifted on `<data>`".
- **"What's new"**: pulsante con pallino "New" che mostra annunci (`/api/announcements`, oggi vuoto) con "Check it out" / "Read more".
- **Notifiche invito partita**: pulsante campanella con "Mute invite notifications". Durate: **1 h, 8 h, 1 giorno**. Stato "Muted for `<durata>`" con "Unmute".
- **Rientro in partita**: `/api/lobby/landing` restituisce `playingRooms`; se non è vuoto compare il toast "Return to game".

### 4.8 Casi stanza
- Stanza inesistente `/room/zzzz9`: redirect immediato a `/` con il toast "We couldn't find room zzzz9." / "It has expired or deleted." [V].
- Schermata di caricamento stanza [V]: dado che rotola, **"Loading game..."**, riga **"Tip | `<consiglio>`"** casuale. Elenco completo dei tip [C]:
  - "No money left? trade with other players before you sell properties"
  - "Sometimes it's better to stay in prison, so you won't pay rent for as long as possible"
  - "Play will different set rules to spice up your game" (sic)
  - "Build houses as soon as possible, so you will thrive the fastest"
  - "Think ahead of your turn, so the gameplay will be quick and fun"
  - "Use the chat to communicate and plan moves with other players"
  - "Ramp up your skills by practicing with bots"
  - "Share the link for your private room to friends so they can join"
  - "Richup is better on larger screens"
  - "Join the community on Discord to find partners and play in tournaments"
  - "The best strategies are being discussed on the official Discord server"
  - "On the computer, click CTRL anytime to find yourself on the board"
  - "Click any player in the players list to highlight them on the board"
  - "Play with sound on for the best experience"
  - "Invite your friends to double the fun"
  - "The more players in a game, the harder it is to thrive"
  - "Make the game harder by adjusting Starting Cash to 500$"
  - "Richup is better on desktop PCs and laptops"
  - "New updates are announced on Richup's Discord server"
  - "Sign in to collect coins and enhance your experience"

  Esiste anche lo stato "Joining room...".

---

## 5. Login e account

### 5.1 Popover di login [V]
Si apre da "Login" in header, da "Login for free" (lista stanze), dal pulsante "Login" nei dettagli dello Store e dalla voce Login del menu mobile. È un popover ancorato sotto il pulsante, non una pagina.
- "Choose a way to log in:" e 4 pulsanti a tutta larghezza: **Google** (blu), **Facebook** (blu scuro), **Discord** (viola), **X** (nero).
- "By continuing you agree to the Terms of Service and Privacy Policy" (link).
- **"Why login?"** con tre icone: **"Unique Identity"**, **"Track Statistics"**, **"Special Features"**. Sono solo etichette, senza tooltip.
- Si chiude con Esc o con un clic fuori.
- [C] Il login avviene in una **popup** (`display=popup`) con nonce; in caso d'errore: "Could not log in." / "Try logging in using a different platform, or try again later."
- Login non completato, come da regole.

### 5.2 Cosa sblocca un account
| Funzione | Fonte |
|---|---|
| Comprare oggetti nello Store e coin ("Login to get this item.", "Login to purchase more coins.") | [V] |
| Vedere ed entrare nelle "exclusive rooms for logged in users" | [V] |
| Avatar/immagine profilo (default dal provider o acquistata), visibile nelle card stanza | [V] |
| Profilo pubblico con statistiche, karma, inventario, ultime partite | [V] (visto il profilo di un altro utente) |
| Guadagnare coin vincendo ("Sign in to collect coins and enhance your experience") | [V] testo Store + [C] |
| Amici, richieste d'amicizia, stato online/"Last seen", inviti a partite con notifiche push | [C] |
| Bloccare e segnalare giocatori | [C] |
| Settings (nome, immagine, utenti bloccati, notifiche, account collegati) | [C] |
| Statistiche squadre (Teams winning rate) | [V] |

Non esistono livelli né XP: l'unico indicatore di "reputazione" è il **Karma** [V/C].

### 5.3 Profilo `/profile/<userId>` [V]
Visto da ospite sul profilo pubblico di un giocatore (dati non riportati, solo struttura):
- **Banner**: avatar grande con **anello colorato** (verde = karma pieno), nome in font condensato e due KPI a destra:
  - **"30 / 30 Karma Points"** (icona stella);
  - **"49% Winning Rate"** (icona coppa), coerente con vinte/giocate (58/118).
- **Statistics**, una riga con icona ciascuna:
  - "Played N games"
  - "Won N games"
  - "Teams winning rate: X% (won A out of B games)" (solo se ha giocato a squadre)
  - "Joined `<tempo relativo>`" (es. "2 weeks ago")
  - "Has N friends"
- **Inventory**: card degli oggetti posseduti (es. avatar "Spaceship", upgrade "Teams Mode"). [C] Per il proprio profilo: "No items owned" e un link "Get more items" allo Store.
- [C] **Friends**: lista amici paginata (6 per pagina) con "No friends", stato online e "Last seen".
- **Last games**: "Only last **80** games are shown." + link **"Learn more about this list"**. Il link apre una modale FAQ "The Last Games List" [C]:
  - "What games are listed in the Last Games list?" / "All last 80 public games are visible to everyone."
  - "Who can see my private games?" / "Only the participants of a private game can later view it."
  - "Do all games count towards my player statistics?" / "In order for a game to count towards your statistics, it must meet certain requirements. For example, very short games won't count towards your statistics."
  - "We're on Discord…"
- **Riga partita (chiusa)**: data e ora "Nov 07, 14:18", avatar dei partecipanti, icona ▷ con numero di turni (es. 292), icona orologio con durata hh:mm (es. 00:38).
- **Riga espansa (clic)**:
  - a sinistra: "Room ID", "Turns", "Doubles", "Trades", "Chat messages";
  - al centro: classifica "# / Player / Turns survived" con barre orizzontali colorate, il vincitore con etichetta "winner";
  - in basso: icone delle regole attive, starting cash e mappa.
  - [C] Icone aggiuntive possibili: "Private room", "Won this game", "Disconnected mid-game", "Kicked out".
- **Paginazione** in fondo: frecce e pulsanti 1, 2, 3, 4, 5 … 10.
- Pulsante **"Back to lobby"**.
- Partita in corso [C]: "Currently playing in room `<id>`" con pulsante **"Spectate"** (esiste la modalità spettatore).
- [C] Sul **proprio** profilo: matita "Edit display name", che apre la modale "Change name":
  - placeholder "Your name...";
  - nota "This is how other players will see you. Keep it unique and friendly.";
  - pulsanti "Save changes" e "Reset to default";
  - toast "Successfully updated your name." / "Could not update your name.".

  Clic sull'avatar: "Change profile picture", con scelta tra le immagini possedute (toast "Successfully updated profile picture.").
- [C] Sul profilo **altrui** (da loggato): pulsanti "Add friend" / "Friend request sent" ("Cancel request") / "Friends" ("Unfriend") / "Approve"-"Decline", più "Block" / "Blocked" ("Unblock").
- Casi limite [V]:
  - id valido ma inesistente: "User not found" / "This user might have deleted or never existed.";
  - id malformato (`/profile/abc`): resta in skeleton di caricamento all'infinito (bug).

### 5.4 Karma [V/C]
- Mostrato come "Karma: X / Y" (mini-card) e "X / Y Karma Points" (profilo); l'anello attorno all'avatar cambia colore in base al rapporto.
- [C] Il massimo Y = min(partite giocate + partite a squadre, **30**): cresce con le partite fino a 30.
- [C] Si perde con comportamenti scorretti (abbandoni). Il toast "It costs no karma" chiarisce che l'espulsione per timeout non lo riduce.

### 5.5 Blocco e segnalazione [C]
Modale di blocco con il testo:
- "When you block a player:" / "You won't be assigned to rooms with this player." / "You won't see their messages in chat.";
- avvisi "Blocking this player will unfriend them / decline their friend request / revoke your friend request.";
- casella "Also report this player" con "Select a reason...". Motivi: "AFK or griefing", "Hate speech or harassment", "Cheating or multi-accounting", "Ganging up", "Inappropriate username or avatar", "Threats or harmful content". Esiste un secondo elenco: "Leaving or griefing", "Stalling or time-wasting", "Ganging up on other players", "Inappropriate name", "Harmful content", "Something else".

### 5.6 Settings `/settings`
- [V] Da ospite la pagina **va in crash**: "Something went wrong!" con "Show Error"/"Hide Error" che mostra `Cannot read properties of null (reading 'blockedUsers')`. Nessun redirect al login (bug).
- [C] Contenuto per l'utente loggato (titolo "Settings"):
  - **My User**:
    - "Username & profile picture" / "Change how others see you" con il pulsante "Edit in Your Profile";
    - "Blocked users" / "Restrict interactions with other players" con il pulsante "Manage", che apre la modale "Blocked Users" ("No blocked users." / "To block a user, go to their profile and click Block").
  - **Notifications**: "Game invites" / "Get notified when a friend invites you to a game", con interruttore ("Toggle game invite notifications"). Messaggi possibili: "Not supported on this browser", "Add Richup to your home screen to enable" (iOS), "Blocked in your browser settings". Sono notifiche push web con service worker `/sw.js`.
  - **Linked accounts**: Discord, Google, Facebook, Twitter, con "As: `<nome>`" / "Connected".
  - In fondo: "Additional settings coming soon".

### 5.7 Coin: come si guadagnano [V/C]
- [V] Testi Store: "Earn coins by winning games against other, real players" e "Join the community on Discord for tournaments, events and giveaways".
- [C] Ricompense: "for winning the game." e "for viewing an ad." (rewarded ad), riscosse con `/game/claim-coin-reward`. L'upgrade "x2 Coin Rewards" raddoppia le vincite.
- Gli importi per vittoria non sono visibili nel client [D].

---

## 6. Store `/store`

### 6.1 Struttura [V]
- Titolo "Store", colonna sinistra **"CATEGORIES"**: "All" (icona casa), "Player appearance" (tavolozza), "Board maps" (scacchiera), "Upgrades" (fulmine), "Profile pictures" (avatar), **"Richup Coins"** (moneta dorata, testo dorato). La voce attiva è evidenziata.
- Vista **All**: una sezione per categoria (max 4 card) con link **"All items >"**. La pagina di categoria mostra tutti gli oggetti e in fondo **"Back to all items"**.
- **Card oggetto**: immagine, nome, prezzo in coin (icona esagono dorato). La card è cliccabile e apre la modale di dettaglio, aggiornando l'URL con `?item=<id>`.
- **Modale di dettaglio**: X di chiusura, immagine a sinistra, nome (font condensato), descrizione, prezzo, box informativo **"Login to get this item."** con pulsante "Login".
  - Per le mappe c'è anche il pulsante **"Preview"**, che apre "Board preview": tabellone completo della mappa a schermo intero con nome al centro e pulsante "Close preview".
- Nessun carrello e nessun filtro o ricerca. Il campo `originalPrice` dell'API indica che esistono **sconti** (prezzo barrato), oggi non attivi [C].

### 6.2 Catalogo completo (prezzi in Richup Coins) [V, da UI + `/api/store`]

**Player appearance** (forma/colore della pedina in partita: blob con occhi)
| Nome | Prezzo | Descrizione |
|---|---|---|
| Navy | 40 | Show your tremendous courage using one of the most recognizable colors of Earth. |
| Red Wine | 50 | Taste the sweet flavor of success over your opponents. |
| Cloud | 80 | Seems innocent, but sneaks under radars all the way to triumph. |
| Lilac | 80 | Fearless, but kind. An inspiring tone of victory. |
| Bomb | 90 | – |
| Apple | 90 | – |
| Poop | 90 | – |
| Strawberry | 100 | – |
| Fire | 130 | – |
| Lemon | 180 | – |

**Board maps** (mappe alternative alla "Classic" gratuita)
| Nome | Prezzo | Descrizione |
|---|---|---|
| Mr. Worldwide | 180 | The world is wide enough for both Hamilton and you! |
| Death Valley | 180 | Each side of the board is a full property set. Be careful with your landings. |
| Lucky Wheel | 180 | Wish for the best and hope today is your lucky day. |

`/api/game/maps` restituisce: classic, mr-worldwide, death-valley, lucky-wheel.

L'anteprima di **Death Valley** [V] mostra:
- angoli: START, "Passing by / In Prison", "Vacation", "Go to prison";
- un lato per nazione: Canada (Ottawa 60$, Quebec City 60$, Montreal 100$, Vancouver 100$, Toronto 120$), Germania (Wolfsburg 140$, Cologne 140$, Hamburg 160$, Frankfurt 180$, Munich 180$, Berlin 200$), UK (London 280$, Manchester 260$, Birmingham 260$, Liverpool 240$, Cambridge 220$, Glasgow 220$), USA (Boston 300$, Seattle 300$, Chicago 320$, San Francisco 350$, New York 400$);
- aeroporti 200$ (YYZ, MUC, LHR, JFK), Power Company e Water Company 150$, caselle Treasure, Surprise, "Earnings Tax %10", "Premium Tax $75".

**Upgrades** (sblocchi permanenti di funzioni)
| Nome | Prezzo | Descrizione |
|---|---|---|
| 7-8 Players | 30 | Invite as many friends as you have to have the craziest game ever. |
| Teams Mode | 20 | Cooperate with other players to dominate the economy. |
| Remove Ads | 80 | Have the best game experience, free from all ads. |
| x2 Coin Rewards | 140 | Double the amount of coins you earn by winning games. |

**Profile pictures** (sottotitolo "Express yourself with a custom avatar"), tutte a **20**:
Person, Bunny, Hamster, Spaceship, Elephant, Sloth, Giraffe, Turtle, Banana, Fire, Umbrella, Parrot (emoji 3D su sfondo circolare colorato).

### 6.3 Richup Coins `/store/coins` [V]
Titolo "Coins" / "Get more coins and purchase exciting things in the store."
| Pacchetto | Coin base + bonus = totale | Prezzo USD | Etichetta |
|---|---|---|---|
| Pile of coins | 100 + 0 = 100 | $3.99 | |
| Sack of coins | 250 + 25 = 275 | $9.99 | 🔥 Most popular |
| Wallet of coins | 500 + 80 = 580 | $19.99 | |
| Check of coins | 800 + 160 = 960 | $31.99 | |
| Vault of coins | 1200 + 300 = 1500 | $47.99 | |
| Bank of coins | 2500 + 750 = 3250 | $99.99 | 🤑 Best value |

- Clic su un pacchetto: modale riepilogativa e, da ospite, "Login to purchase more coins." con "Login". URL `?pack=<id>`.
- Sezione "More ways to get coins" con due card (vittorie, Discord).
- [C] Esiste un esperimento analytics `store-pack-quantity-selector` (selettore di quantità dei pacchetti).

### 6.4 Cosa cambia in gioco (sintesi)
- **Appearance**: aspetto della propria pedina, visibile a tutti.
- **Board maps**: l'host può scegliere quella mappa nella stanza. Lo deduco dal campo `mapId` delle impostazioni stanza e dal nome mappa nelle card [D].
- **7-8 Players / Teams Mode**: permettono all'host di creare stanze con 7–8 posti o in modalità squadre.
- **Remove Ads**: niente pubblicità.
- **x2 Coin Rewards**: coin raddoppiati.
- **Profile pictures**: avatar mostrato in lista stanze, profilo e partita.
- Nessun abbonamento, nessun pass stagionale, nessun dado personalizzato, nessun tema UI in vendita [V].

### 6.5 Rimborsi (`/refund-policy`) [V]
- Rimborso dei soli coin non spesi, entro 14 giorni, meno le commissioni del provider.
- Gli oggetti dello Store non sono rimborsabili.
- Richiesta via `support@richup.io`.

---

## 7. `/info` e altre pagine (solo parti funzionali)

- **/info** [V]:
  - "Distribution Partners" (3 portali di giochi);
  - "Press Mentions";
  - "Copyright": spiega che le meccaniche di gioco non sono proteggibili (fonte copyright.gov) e che Richup non è affiliato a marchi terzi;
  - effetti sonori di notificationsounds.com;
  - immagini profilo con licenza MIT;
  - "Contact": `support@richup.io`;
  - pulsante "Back to lobby".
- **/data-deletion** [V]: pagina statica di conferma "Your data deletion request has been processed…" (atterraggio dopo la richiesta di cancellazione dati, tipica dei login Facebook).
- **/terms-and-conditions** [V]: termini legali generici. Rilevanti: possibilità di sospendere account e contenuti senza preavviso; legge applicabile israeliana.
- **404** [V]: "Page not found" / "Are you lost?" + "Back to lobby".

---

## 8. Personalizzazione

| Cosa | Dove | Stato |
|---|---|---|
| Nickname (ospite) | Campo in home, max 32, dado per nome casuale, salvato in localStorage | [V] |
| Nome account | Profilo, modale "Change name" | [C] |
| Immagine profilo | Default dal provider social oppure acquistata nello Store | [V/C] |
| Aspetto pedina | Acquistabile; si sceglie nella stanza | [V] Store / [D] scelta |
| Mappa tabellone | Acquistabile; scelta dall'host | [V] Store / [D] |
| Volume | Header home | [V] |
| Notifiche inviti | Settings e campanella in home | [C] |
| Lingua / tema | **Non esistono** | [V] |

---

## 9. Impostazioni globali

### 9.1 Audio [V]
- Il pulsante in alto a sinistra mostra all'hover/clic un popover con uno **slider 0–100%** e la percentuale.
- **Clic sull'icona** = mute/unmute (100 → 0 → 100); l'icona diventa altoparlante barrato.
- Valore salvato in `localStorage` come `richup__sound-volume`.
- Il popover si chiude con un clic fuori.
- [C] I suoni includono il rotolare del dado in home.

### 9.2 Lingua e tema [V]
Nessun selettore: interfaccia solo inglese, tema solo scuro (`prefers-color-scheme` ignorato).

### 9.3 Notifiche [V/C]
- Toast in-app (sezione 3.4).
- Notifiche push web per inviti dagli amici (Settings), con service worker; su iOS richiede "Add to home screen".

### 9.4 Persistenza locale [V]
`localStorage`: `PLAYER_NAME`, `richup__sound-volume`, `richup.analytics.*`. Cookie di sessione `connect.sid` (sessione Express anche da ospite).

---

## 10. Responsive: 1440x900 contro 390x844 [V]

| Elemento | Desktop 1440x900 | Mobile 390x844 |
|---|---|---|
| Header home | Audio a sinistra; Store e Login testuali a destra | Audio a sinistra; **menu hamburger** a destra che apre un pannello con "Store" e "Login" (X per chiudere) |
| Blocco centrale | Dado, logo, input 218 px, Play 218x80, pulsanti affiancati | Stessi elementi impilati; "All rooms" e "Create a private game" su due righe |
| Pubblicità | Colonne laterali "Ad" | Blocco "Ad" nel flusso, sotto l'hero |
| Login | Popover sotto il pulsante | Popover largo quasi quanto lo schermo, sotto il menu |
| All rooms | Card orizzontali (info a sinistra, regole a destra) | Card verticali: ID e slot sopra, mappa e regole sotto, centrati |
| Store | Sidebar categorie a sinistra, griglia a 4 colonne | Categorie in barra orizzontale scorrevole, griglia a 2 colonne |
| Coin packs | Griglia 3x2 | Una colonna |
| Modale oggetto | Orizzontale (immagine a sinistra) | Verticale (immagine sopra) |

Il pulsante Discord flottante e quello "Privacy settings" restano in entrambi i casi. Due tip di caricamento invitano a usare schermi grandi ("Richup is better on larger screens").

---

## 11. Valori numerici chiave

| Elemento | Valore | Fonte |
|---|---|---|
| Lunghezza massima nickname | 32 caratteri | [V] |
| ID stanza | 5 caratteri [a-z0-9] | [V] |
| ID utente | 24 esadecimali (ObjectId) | [V] |
| Starting cash di default | $1500 | [V] |
| Starting cash ammessi | 500, 1000, 1500, 2000, 2500, 3000 | [C] |
| Giocatori per stanza | 2–6, 7–8 con upgrade; default 4 | [C] |
| Karma massimo | 30 (cresce con le partite giocate) | [V/C] |
| Ultime partite in elenco | 80 | [V] |
| Amici per pagina | 6 | [C] |
| Durate di mute degli inviti | 1 h / 8 h / 24 h | [C] |
| Ritardo del popup adblock | 3 s | [C] |
| Slider volume | 0–100 | [V] |
| Prezzi Store | 20–180 coin | [V] |
| Pacchetti coin | $3.99–$99.99 (100–3250 coin) | [V] |
| Stanze "esclusive" nascoste agli ospiti | 2–3 al momento del test | [V] |
| Stanze pubbliche visibili | 13 al momento del test | [V] |

---

## 12. Casi limite osservati

- Play o creazione stanza con nickname vuoto: nessun blocco [V]; quale nome venga assegnato non è verificabile.
- Nickname con soli spazi, emoji o HTML: accettati dal campo [V].
- Stanza inesistente: redirect alla home con toast [V].
- `/settings` da ospite: crash con errore tecnico visibile [V].
- `/profile/<id malformato>`: skeleton infinito [V]; id inesistente: "User not found" [V].
- Categoria Store inesistente: redirect a `/store` [V].
- Il deep link `?item=` apre direttamente la modale anche da mobile [V].
- La lista stanze mostra anche stanze piene (es. 2/2) [V].
- La creazione di stanze (privata o con Play) richiede di superare Turnstile; nel browser automatizzato la stanza privata è rimasta ferma su "Loading game..." [V].

---

## 13. Dubbi e cose non verificate

1. **Lobby e partita**: non viste a causa del captcha Turnstile (non risolto per regola). Restano da confermare: scelta dell'aspetto, nome assegnato con nickname vuoto, validazione server del nickname.
2. **Login**: non completato. Menu utente, Settings, amici, cambio nome e immagine sono ricostruiti dal codice [C], non visti.
3. **"New room"** nella lista stanze: non cliccato. [D] Crea una stanza pubblica (`isPrivate=false`).
4. **Clic su una card stanza**: non eseguito. [D] Naviga a `/room/<id>` come Play.
5. **Aggiornamento della lista stanze**: nessun cambiamento in 35 s, nemmeno con il refresh. Non è chiaro se sia polling, socket o solo manuale.
6. **Importo dei coin per vittoria** e requisiti perché una partita conti nelle statistiche ("very short games won't count"): non noti.
7. **Regole karma** (quanto si perde e per cosa): non documentate nel client.
8. **Ordinamento della lista stanze** e significato delle stanze piene ancora elencate.
9. **Popup di login**: URL dedotti dal codice; non ho aperto i provider.
10. Le stringhe della lista stanze (es. "Select the room…") non compaiono nei bundle scaricati: forse sono in un chunk non intercettato. Non influisce sull'analisi, i testi sono verificati a vista.

---

## 14. Screenshot salvati (`docs/analisi/img/`)

| File | Contenuto |
|---|---|
| a1-home-desktop.png | Home 1440x900 |
| a1-home-desktop-full.png | Home pagina intera (sezione How to play vuota per l'animazione) |
| a1-home-how-to-play.png | Sezione How to play con illustrazioni e scheda proprietà |
| a1-home-dice-roll.png | Home dopo il clic sul dado |
| a1-nickname-random.png | Nickname casuale generato dal dado |
| a1-sound-menu.png | Popover volume (muto, 0%) |
| a1-login-modal.png | Popover di login |
| a1-play-turnstile.png | Dopo Play: Loading game + Cloudflare "Verify you are human" |
| a1-all-rooms.png | Lista stanze pubbliche |
| a1-all-rooms-scrolled.png | Lista scrollata: icone regole con pallini verde/rosso |
| a1-all-rooms-card-hover.png | Hover su una card stanza |
| a1-all-rooms-player-hover.png | Mini-card giocatore (Karma, Profile) |
| a1-all-rooms-login-for-free.png | Login aperto da "Login for free" |
| a1-private-room-loading.png | Stanza privata appena creata (Loading game + Tip) |
| a1-room-direct-link.png | Link d'invito: home con "Enter Game" |
| a1-room-not-found.png | Toast "We couldn't find room…" |
| a1-store-all.png / a1-store-all-full.png | Store, vista All |
| a1-store-player-appearance.png | Categoria Player appearance |
| a1-store-board-maps.png | Categoria Board maps |
| a1-store-upgrades.png | Categoria Upgrades |
| a1-store-avatars.png | Categoria Profile pictures |
| a1-store-item-detail.png | Modale oggetto (Navy) da ospite |
| a1-store-map-detail.png | Modale mappa con Preview |
| a1-store-map-preview.png | Anteprima tabellone Death Valley |
| a1-store-coins.png | Pacchetti Richup Coins |
| a1-store-coins-click.png | Modale pacchetto da ospite |
| a1-profile-public.png | Profilo pubblico (struttura) |
| a1-profile-lastgame-expanded.png | Dettaglio di una partita nelle Last games |
| a1-profile-invalid-id-skeleton.png | Profilo con id malformato (skeleton infinito) |
| a1-settings-loggedout.png | /settings da ospite (errore) |
| a1-info.png | Pagina /info |
| a1-404.png | Pagina 404 |
| a1-mobile-home.png / a1-mobile-home-full.png | Home 390x844 |
| a1-mobile-menu.png | Menu hamburger mobile |
| a1-mobile-login.png | Login su mobile |
| a1-mobile-all-rooms.png | Lista stanze su mobile |
| a1-mobile-store.png | Store su mobile |
| a1-mobile-store-coins.png | Coin su mobile |
| a1-mobile-store-item.png | Modale oggetto su mobile (deep link ?item=) |
