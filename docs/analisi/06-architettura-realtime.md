# 06 · Architettura tecnica e comportamento realtime di richup.io

> Analisi del 07/11/2026, fatta per progettare **PoorDown**. Solo osservazione passiva: una stanza privata creata, nessun account, nessun login.
>
> **Legenda delle fonti**
> - **[LIVE]**: verificato nel browser (frame WebSocket, richieste HTTP, cookie, storage, screenshot).
> - **[BUNDLE]**: letto nel codice JavaScript pubblico che il sito invia a tutti i visitatori (nomi degli eventi, schemi, costanti). È codice vero, ma è il lato client: il server potrebbe comportarsi in modo un po' diverso.
> - **[DEDOTTO]**: ipotesi ragionata, non verificata.

---

## 1. Panoramica

- **Limite principale**: quando si entra in una stanza parte **Cloudflare Turnstile**, in modalità "interaction-only". Con il browser automatico la verifica chiede un clic ("Verify you are human"). Non l'ho aggirata, per scelta. Quindi **non ho potuto sedermi al tavolo, avviare una partita né usare la seconda sessione**. Il traffico di gioco (lobby, turni, riconnessione) l'ho ricostruito dal codice client: è molto leggibile, perché gli schemi degli eventi sono definiti con zod e i nomi degli eventi sono stringhe in chiaro.
- **Architettura in una riga**: SPA React 19 con SSR (TanStack Start), servita da Cloudflare → Caddy → backend Node/Express (dedotto). Il realtime usa **Socket.IO v4, solo WebSocket**, con 3 namespace. Il **server è autoritativo**. Il client contiene **lo stesso motore di regole** (un reducer `applyServerAction`). Ogni evento del server porta un **hash dello stato**: se il client rileva una divergenza, chiede la risincronizzazione completa.
- **Identità**: il cookie di sessione `connect.sid` (httpOnly). Nel localStorage c'è solo il nickname. Niente token nel protocollo.

---

## 2. Stack

### 2.1 Frontend [LIVE + BUNDLE]
| Elemento | Evidenza |
|---|---|
| **React 19.2.4** | stringa di versione nel bundle, `__reactFiber$…` sul nodo `#app` |
| **TanStack Start + TanStack Router** (SSR) | `window.__TSR_ROUTER__`, `__TSS_START_OPTIONS__`; l'HTML arriva già renderizzato dal server |
| TanStack Query | classe focus-manager di `@tanstack/query-core` |
| Build **Vite** | chunk `assets/Nome-hash.js`, `modulepreload`, lazy route `room._roomId-*.js` |
| **CSS Modules** | classi hashate (`_1mtNJdEn`, `KdB0kL15`…) |
| **zod** (v4, dedotto da `__zod_globalRegistry`) | schemi dei payload Socket.IO condivisi |
| Store tipo **zustand** | `create((set,get)=>…)` + `useSyncExternalStoreWithSelector` |
| Animazioni: **framer-motion** (layout, `AnimatePresence popLayout`), **react-spring** (contatori di soldi "elastici"), **canvas-confetti** | stringhe e API nel bundle |
| dnd-kit, luxon, tippy.js (tooltip), Font Awesome | nel bundle |
| **object-hash** | serve per l'hash di sincronizzazione dello stato (§3.6) |
| socket.io-client v4 | handshake `EIO=4`, `transports:["websocket"]`, `forceNew:true` |

Rotte: `/`, `/room/$roomId`, `/store`, `/store/$categoryId`, `/store/coins`, `/profile/$userId`, `/settings`, `/info` + pagine legali.

Il tabellone è fatto con **DOM/CSS** (componenti React), non con canvas o WebGL. Il canvas serve solo ai coriandoli e a qualche immagine. [BUNDLE]

### 2.2 Backend e hosting [LIVE + DEDOTTO]
- Header `server: cloudflare`, `cf-ray`, `cf-cache-status` → **Cloudflare** come CDN/proxy. `via: 1.1 Caddy` → reverse proxy **Caddy** davanti all'origine. [LIVE]
- Header in stile **helmet** (`x-dns-prefetch-control`, `x-download-options`, `x-permitted-cross-domain-policies`, `origin-agent-cluster`) e cookie **`connect.sid`** firmato (`s%3A…`) → **Node + Express + express-session**. [DEDOTTO, molto probabile]
- Esistono due varianti di header helmet (HSTS di 180 giorni contro 1 anno, presenza o assenza di COOP/CORP). Le prime compaiono su `/api/features`, `/api/announcements` e sull'HTML; le seconde su `/api/room/new`, `/api/lobby/landing` e `/api/maintenance`. → **almeno due servizi backend distinti**, cioè "app" (account, amici, store) e "game" (stanze). Lo conferma anche il path Socket.IO separato. [DEDOTTO]
- Gli ID utente e gli ID dello store sono stringhe esadecimali di 24 caratteri → **MongoDB ObjectId**. [DEDOTTO]
- HTML in cache su CDN: `cache-control: public, max-age=0, s-maxage=86400, stale-while-revalidate=604800`. [LIVE]
- Rate limit su creazione stanza: `x-ratelimit-limit: 20` e `x-ratelimit-remaining`/`reset`. [LIVE]
- Monitoraggio: **Sentry** (`@sentry/tanstackstart-react`) e Cloudflare Web Analytics (beacon + `/cdn-cgi/rum`). [LIVE]

### 2.3 Analytics, ads, anti-bot: da NON copiare [LIVE]
- **Analytics**: Google Tag Manager + GA4; PostHog (feature flag e A/B test, chiave in `/app-config.js`); Sentry.
- **Pubblicità**: AdinPlay (aiptag), Venatus (vntsm), VLI (vlitag), Google GPT/AdSense/IMA (video), Amazon APS, Prebid 11.x, Criteo, LiveIntent, ID5, Hadron, RTB House e altri. In tutto oltre 25 script esterni sulla home.
- **CMP**: Google Funding Choices. **Anche dopo "Do not consent" vengono comunque creati molti cookie e ID pubblicitari** (`_ga`, `cto_bundle`, `sharedid`, `_lc2_fpi`, `id5id`, `amxId`…). Da non imitare in nessun modo.
- **Cloudflare Turnstile** (feature flag `captcha:1`): il token viene richiesto all'ingresso della stanza, resta valido 4 minuti e viene passato in `join-game.captchaToken`. Tra amici non serve.

---

## 3. Protocollo realtime

### 3.1 Trasporto [LIVE]
- **Socket.IO v4 su WebSocket puro**, senza fallback a long-polling (`upgrades: []`).
- Handshake Engine.IO: `pingInterval: 25000`, `pingTimeout: 20000`, `maxPayload: 1000000`. Il server manda `2` (ping), il client risponde `3` (pong).
- Riconnessione: quella di default di socket.io-client (tentativi infiniti, backoff 1–5 s con jitter). [BUNDLE]

| Connessione WebSocket | Namespace | Uso |
|---|---|---|
| `wss://richup.io/api/app/socket.io/` | `/api/app` | globale, aperta su ogni pagina: ricompense in monete, amicizie, inviti |
| `wss://richup.io/api/game/socket.io/` | `/api/game` | la stanza e la partita |
| stesso path `/api/game/socket.io/` | `/api/lobby` | lista delle stanze pubbliche ("All rooms") |

### 3.2 Pattern dei messaggi [LIVE + BUNDLE]
- **Comando del client con ack**: `42/api/game,<ackId>["nome-evento",{payload}]` → risposta `43/api/game,<ackId>[{"ok":true,"data":…}]` oppure `[{"ok":false,"code":"…","message":"…"}]`.
  - Il client usa `emitWithAck` con timeout di **10 s** (30 s per `join-game`). Un ack malformato produce l'errore `MALFORMED_ACK`.
- **Evento del server** (broadcast alla stanza): `42/api/game,["nome-evento",{payload}]`.
- **Coda di ingresso** lato client: gli handler vengono eseguiti **in serie** su una catena di Promise. Il secondo evento aspetta che finisca l'animazione del primo, per esempio i dadi e poi il movimento della pedina. Alcuni eventi saltano la coda (`bypassQueue`): chat, errori, `entered-room`, `sync-game-state`, `room-deleted`. La coda si azzera (`generation++`) a ogni risincronizzazione completa.

Esempi reali (anonimizzati):
```text
→ 40/api/game,
← 40/api/game,{"sid":"<sid>"}
→ 42/api/game,0["enter-room",{"roomId":"ABCDE"}]
→ 42/api/game,1["request-server-time",{}]
← 42/api/game,["entered-room",{"room":{…stanza completa, ~12 KB…},"isPlayer":false,"mutedPlayerIds":[],"reportedPlayerIds":[],"lostSeat":false}]
← 43/api/game,1[{"ok":true,"data":{"serverTime":1794060037879}}]
← 43/api/game,0[{"ok":true}]

← 42/api/lobby,["lobby-rooms-list",{"rooms":[{"id":"ABCDE","participantTypes":[{"userId":"<id>"},{}],"mapId":"classic","settings":{…}}]}]
← 42/api/lobby,["lobby-rooms-list",{"rooms":"same","nextUpdate":1794060541891}]   (ogni ~10 s)
```

### 3.3 Sincronizzazione dell'orologio [LIVE + BUNDLE]
`request-server-time` viene inviato 3 volte a 200 ms di distanza appena connessi, poi **ogni 30 s**. Il client calcola, stile NTP, `offset = serverTime + rtt/2 − now` e lo usa per i countdown (turno, asta, kick). C'è anche un `GET /keepalive` ogni 15 minuti, che tiene viva la sessione HTTP.

### 3.4 Catalogo degli eventi [BUNDLE; i primi due verificati LIVE]

**Stanza / lobby** (namespace `/api/game`)
| Client → server (ack) | Server → client |
|---|---|
| `enter-room {roomId}` | `entered-room {room, selfParticipantId?, isPlayer, mutedPlayerIds, reportedPlayerIds, lostSeat}` · `room-not-found` |
| `join-game {name, appearance, bot?, captchaToken?}` | `joined-game {selfPlayer}` · `player-joined {player}` |
| `update-game-room {…impostazioni parziali}` (solo host, solo in lobby) | `game-room-updated {settings, map, teams}` |
| `update-player-appearance {appearance}` | `player-appearance-updated {playerId, appearance}` |
| `team-action {type: create\|join\|assign\|delete\|rename, …}` | `team-updated` |
| `start-game` | `game-started {participantsOrder}` |
| `room-restart` | `room-deleted` · `game-ended {winnerId, coinRewardSeatId}` · `game-error {message}` · `player-left {playerId}` |

**Turno**
| C → S | S → C |
|---|---|
| `plz-roll-dices` | `dice-rolled {dice:[a,b], snapshot, auto?}` |
| `end-turn` | `turn-ended {auto?}` |
| `pay-out-of-prison` · `use-pardon-card` | `paid-out-of-prison` · `used-pardon-card {deck}` |
| `do-bankrupt` | `player-bankrupted {playerId}` |

**Proprietà, aste e scambi**
| C → S | S → C |
|---|---|
| `purchase-property` | `purchase-success {blockIndex}` / `purchase-failed` |
| `sell-property {blockIndex}` | `property-sold {blockIndex}` |
| `upgrade-city` / `downgrade-city {blockIndex}` | `city-level-changed {blockIndex, changeType}` |
| `mortgage-property` / `lift-property-mortgage {propertyIndex}` | `property-mortgaged` / `property-mortgage-lifted` |
| `start-auction` · `auction-bid {amount}` | `auction-started {blockIndex, auto}` · `auction-bade {amount, bidderId, endsAt}` · `auction-ended {blockIndex, price, buyerId}` |
| `create-trade {trade, negotiatedTradeId}` | `trade-created {trade, negotiatedTradeId}` |
| `confirm-trade` / `decline-trade` / `delete-trade {tradeId}` | `trade-confirmed` / `trade-declined` / `trade-deleted {tradeId, auto}` |
| `set-trade-watch-state {tradeId, isWatching}` · `set-trade-creator-state {isCreating}` | `trade-watch-state-changed` · `trade-creator-changed` ("X sta preparando uno scambio") |

Offerta di scambio: `{ money ≥ 0, propertyIndices[], mortgagedPropertiesIndexes[], pardonCards[] }` per ciascuna delle due parti, più una `note`.

**Moderazione, AFK e connessione**
| C → S | S → C |
|---|---|
| `votekick-player {playerId\|null}` | `new-votekick-request {votingPlayerId, snapshot}` · `player-votekicked {playerId, votingPlayerId, forced, snapshot}` |
| `host-kick-player {playerId}` | `player-host-kicked {playerId, snapshot}` |
| `request-clock-time` · `grant-clock-time` | `clock-time-requested {playerId}` · `clock-time-granted {granterId, snapshot}` |
| `mute-player {playerId, muted}` · `report-player {playerId, reason}` | — |
| — | `participant-connectivity-changed {participantId, connectivity: stable\|unstable, connectivityKickAt, offlineSince}` |
| — | `participant-account-linked {participantId, userId, name}` |

**Chat**: `chat:send-message` → `chat:message-received {senderId, content, timestamp}`; `chat:typing` → `chat:participant-typing {participantId}`; varianti `chat:send-team-message` / `chat:team-message-received` e `chat:send-admin-message` / `chat:admin-message-received`.

**Sincronizzazione**: `request-server-time` (ack `{serverTime}`); `request-sync {snapshot}` → `sync-game-state {gameState}`.

**Namespace `/api/app`**: `newCoinReward`, `friendshipStateChanged`, `friendRoomInvite`. **Namespace `/api/lobby`**: `lobby-rooms-list`.

### 3.5 Motore di gioco condiviso (punto chiave) [BUNDLE]
Il client contiene il **reducer completo delle regole**: `applyServerAction({type, …})`, con circa 35 tipi di azione (`roll-dice`, `purchase-property`, `propose-trade`, `place-bid`, `votekick`, `update-player-connectivity`, `debug-teleport`…). Il reducer produce anche gli **eventi di log** (`passed-go`, `paid-tax`, `drew-card`, `sent-to-prison`, `player-paid-player`, `auction-won`, `player-timed-out`…), usati per il registro di partita e per i suoni.

Flusso: il server valida il comando, applica l'azione al proprio stato e trasmette un evento **compatto**, per esempio solo i dadi. Ogni client riapplica la stessa azione sul proprio stato locale (stesso codice). Quindi il server trasmette pochi dati e l'animazione sa esattamente cosa è successo.

### 3.6 Controllo di divergenza [BUNDLE]
Dopo eventi critici (`dice-rolled`, kick, grant-time…) il server allega un `snapshot`: l'**hash** (object-hash) di un riassunto dello stato:
```text
{ prts:[{id, cbi:posizione, money, connectivityKickAt}], prps:[{owner, level, im:ipotecata}],
  cp:giocatoreCorrente, cpta, crit:dadiTiratiNelTurno, diar:doppiConsecutivi, fnat, d:dadi,
  stck:[{pch:detentoreCartaGrazia, ci:indiceMazzo}], tIds:tradeIds, auction:{state,bidder,bAmount,pIndex,endsAt}, vc, m:mapId }
```
Il client calcola lo stesso hash. Se non coincide, manda `request-sync {snapshot}` e riceve `sync-game-state` con lo **stato completo** (un evento PostHog registra quante volte succede). È un buon compromesso: eventi leggeri più autocorrezione.

---

## 4. Modello dati dedotto

### 4.1 Stanza (`room`) [LIVE: payload `entered-room`, ~12 KB a stanza vuota]
```text
id ("j9sz3": 5 caratteri a-z0-9), phase: lobby | playing | ended, hostId, winnerId, mapId,
participants[], currentPlayerIndex, dice[2], cubesRolledInTurn, canPerformTurnActions,
doublesInARow, forceNoAnotherTurn, votekickerIds[], teams[], trades[], tradeCreatorIds[],
auction (null | {state, blockIndex, currentBid, currentBidderId, bidderIds, endsAt}),
vacationCash, blocks[40], boardConfig {goReward{land:300, pass:200}, prisonBlockIndex:10,
goToPrisonBlockIndex:30, vacationBlockIndex:20}, bonusCards {treasure, surprise},
settings, stampedFlags {tradeFairnessRules}, turnClock {config, turn, hostKickEligible},
stats {turnsCount, startedAt, endedAt, doublesCount, chatMessagesCount, tradesCount,
leaderboard, heatMap, netWorths, prisonVisits, instrumentation, allParticipants}
```
- **settings** (valori predefiniti di una stanza privata): `maxPlayers 4` (2–6 e oltre), `canBotsJoin false`, `isPrivate true`, `onlyUsers false`, `payDoubleRentWhenOwnFullSet`, `vacationCash`, `auction`, `noRentPaymentsWhileInPrison`, `mortgage` (tutti false), `startingCash 1500` (500–3000 a passi di 500), `evenBuild true`, `shufflePlayerOrder true`, `teams {enabled}`.
- **blocks** (40 caselle): `corner` (go / prison / vacation / go-to-prison), `city` {price, ownerId, isMortgaged, countryId, rentPrices{0..5}, level, housePrice, hotelPrice}, `airport` {rentPrices[4]}, `company` {companyType}, `bonus` {treasure | surprise | tax}. La prigione e la vacanza tengono `suspendedTurnsRemaining {playerId: n}`.
- **bonusCards**: due mazzi da 17 carte `{id, description, effect{type…}}` più `currentIndex` e `pardonCardHolderId`. Tipi di effetto: `money-event`, `go-to-prison`, `collect-from-each-player`, `pay-each-player`, `move-to-block`, `move-steps`, `move-to-next-grouped`, `get-pardon-card`, `repairs`.
  - ⚠️ **L'intero mazzo, in ordine, viene inviato a tutti i client**: chi legge il traffico può prevedere la prossima carta. In PoorDown **non va fatto**.

### 4.2 Partecipante [BUNDLE]
```text
id, name, appearance (colore/pedina), isBot, userId? (solo account), teamId?,
position, money, debtTo, bankruptedAt,
connectivity: stable | unstable, connectivityKickAt, offlineSince,
timedVotekickAt, votekickedAt,
clock {bankMs, turnsTaken, autoActedTurns, lastGrantTurnFrom}
```
Un giocatore che entra riceve `position 0`, `money = startingCash`. Il primo umano diventa `hostId`. Se l'host esce, il ruolo passa al primo umano rimasto.

### 4.3 Turn clock (`turnClock.config`) [LIVE: valori] [BUNDLE: logica]
| Parametro | Valore | Significato (dal codice) |
|---|---|---|
| graceMs | 20 s | tempo "gratis" a ogni turno |
| bankStartMs / bankMaxMs | 60 s / 3 min | banca di tempo personale, iniziale e massima |
| minRefillMs / maxRefillMs | 6–20 s | ricarica della banca a fine turno; più rapido giochi, più ricarichi |
| grantMs / grantCapPerTurnMs | 1 min / 2 min | un altro giocatore ti può regalare tempo (pulsante "Give this player extra time") |
| grantCooldownTurns | 1 | attesa fra due regali |
| debtGraceMs | 60 s | tempo extra se il saldo è negativo |
| removalAfterAutoActedTurns | 2 | dopo 2 turni giocati in automatico dal server, il giocatore viene rimosso (`player-timed-out`) |

Quando il tempo finisce, il server **gioca al posto del giocatore** (tira, chiude il turno, avvia l'asta). Gli eventi arrivano con `auto: true`. Durante un'asta il clock si ferma.

---

## 5. Identità e riconnessione

### 5.1 Identità [LIVE]
- **Cookie `connect.sid`**: httpOnly, Secure, SameSite=Lax, durata circa **24 giorni**. Viene emesso alla prima visita, anche senza login, ed è rimasto identico per tutta la sessione, ricaricamenti compresi.
- Il WebSocket è same-origin, quindi il cookie viaggia nell'handshake. **Nessun token nei messaggi**: `enter-room` contiene solo il `roomId`.
- localStorage: `PLAYER_NAME` (nickname) e `richup__sound-volume`. Nient'altro di identificativo. sessionStorage contiene solo dati di ads e router.
- `GET /api/auth/self` restituisce 401 per gli ospiti. Gli account (Google/Discord ecc.) sono un livello opzionale, collegabile a partita in corso con `participant-account-linked`.

### 5.2 Ricaricare la pagina [LIVE parziale + BUNDLE]
- **LIVE**: ricaricando `/room/<id>` senza essere seduti si torna alla landing della stanza (nickname già compilato e pulsante "Enter Game"). La landing chiama `GET /api/lobby/landing?roomId=…`, che restituisce `roomData {participantTypes, mapId, settings}`.
- **BUNDLE**: a ogni `connect` (anche dopo un ricaricamento o una riconnessione) il client rimanda `enter-room`. Il server risponde `entered-room` con lo stato completo, `selfParticipantId` e `isPlayer`. Il **posto viene restituito in base alla sessione (cookie)**. Se il posto non esiste più arriva `lostSeat: true` e il client mostra "seat-gone", cioè che sei stato rimosso.
- **Non verificato dal vivo** (per via del captcha): ricaricare in lobby e a metà partita da giocatore seduto.

### 5.3 Disconnessione [BUNDLE]
- Il client che perde la connessione mostra il toast "Connection lost — Reason: …" e scrive nel log "Connection lost. reconnecting...". Se la partita è in corso, si marca da solo `unstable` con `connectivityKickAt = adesso + 2 min`.
- Gli altri ricevono `participant-connectivity-changed`. Sul giocatore compare "the player is not connected to the game", con un'icona di segnale. Il diretto interessato vede "You will be automatically kicked out of the game in …".
- **Dopo 2 minuti offline, a partita in corso, il giocatore viene rimosso.** Le sue proprietà tornano alla banca.
- Il tempo passato offline consuma il `graceMs`, poi la banca di tempo. Il server gioca in automatico i turni del disconnesso.

### 5.4 AFK, vote kick, kick dell'host [BUNDLE]
- **Voti necessari**: `ceil((umani + 1) / 2)`.
- Con il turn clock attivo si può votare solo contro **il giocatore di turno**, e solo dopo che il clock ha già giocato per lui un turno intero. In partita a 2 il voto non esiste: "The turn clock removes absent players automatically".
- **Lobby**: l'host espelle direttamente.
- **Stanze private con almeno 2 umani**: l'host può rimuovere un giocatore durante la partita, ma non mentre sta giocando il suo turno (`host-kick-player`).
- Senza clock: **votekick a tempo** (5 minuti dal primo voto, `timedVotekickAt`).
- Altri strumenti: mute personale e segnalazione di un giocatore; "Ask for more time" (`request-clock-time`).

---

## 6. UX dinamica

| Aspetto | Cosa fa richup | Fonte |
|---|---|---|
| **Suoni** | ~26 mp3 precaricati già sulla home: `dice`, `game-start`, `_your-turn`, `chat-in/out`, `trade-accept/decline`, `bid`, `mortgage`, `mortgage-lift`, più effetti brevi (`_definite`, `_case-closed`, `_arpeggio`…). Icona altoparlante in alto a sinistra, volume 0–100 salvato in `localStorage.richup__sound-volume`. Nessuna musica di sottofondo osservata. | LIVE |
| **Dadi** | componente con `rollCount` per dado, animazione; suono `dice` all'arrivo di `dice-rolled`; classe speciale per i doppi | BUNDLE |
| **Soldi e valori** | contatori animati con react-spring (es. offerta corrente all'asta), "bolle" `+X` sui rilanci | BUNDLE |
| **Asta** | barra di avanzamento con countdown "Ends in / Sold in" sincronizzata con l'orario del server | BUNDLE |
| **Testi** | parole animate con framer-motion (popLayout); rispetta `prefers-reduced-motion` | BUNDLE |
| **Fine partita** | coriandoli, grafico del patrimonio nel tempo, statistiche ("Most times in prison") | BUNDLE |
| **Toast** | area "Notifications Alt+T" (probabilmente Sonner, non verificato); toast per connessione persa, kick, errori | LIVE + DEDOTTO |
| **Registro di partita** | log testuale generato dagli eventi del reducer | BUNDLE |
| **Chat** | indicatore "sta scrivendo", mute della chat, chat ridotta a icona su desktop, contatore dei non letti con "salta in fondo", utenti bloccati, chat di squadra, filtri anti-abuso (flag `chatAntiAbuse`) | BUNDLE |
| **Timer di turno** | turn clock con grace + banca (§4.3), richiesta e concessione di tempo extra | LIVE + BUNDLE |
| **Lobby** | "Waiting for players… / Waiting for host…", copia del link, condivisione su Twitter/WhatsApp/Telegram, inviti agli amici, impostazioni modificabili solo dall'host e bloccate dopo l'avvio, minimo 2 giocatori, bot che entrano "in base alla disponibilità" (solo con `canBotsJoin`) | BUNDLE |
| **Loading** | "Loading game… / Joining room…" con suggerimenti a rotazione | LIVE |
| **Mobile** | layout "mobile" sotto 85,25 rem (1364 px), colonna singola sotto 600 px, tabellone scalato, menu hamburger; nessuno scroll orizzontale a 390 px | LIVE + BUNDLE |
| **PWA** | `manifest.webmanifest` con `display: standalone`, colore `#130f1d`, icone maskable. Il service worker `/sw.js` viene registrato **solo** se l'utente attiva le notifiche push (Web Push VAPID: `/api/push/public-key`, `/push/subscribe`); niente uso offline. Su iOS: "Open Richup from your home screen, then turn on notifications". | LIVE + BUNDLE |

---

## 7. Endpoint REST osservati [LIVE]
| Metodo e path | Risposta / uso |
|---|---|
| `GET /api/room/new?isPrivate=true` | `{"roomId":"j9sz3"}`: crea la stanza (GET con effetti collaterali, rate limit 20) |
| `GET /api/lobby/landing?roomId=` | `{roomData, playingRooms}`: anteprima della stanza sulla landing |
| `GET /api/features` | flag: `captcha, teams, manualAdRefresh, inPlaceLogin, chatAntiAbuse, chatShieldMode, turnClock, tradeFairnessRules` |
| `GET /api/game/maps` | elenco mappe (`classic` gratis; altre a pagamento con `storeId`) |
| `GET /api/maintenance/maintenance-info` | `{isMaintenance, deadline, progress}` |
| `GET /api/announcements` | annunci (vuoto) |
| `GET /api/auth/self`, `GET /api/user/friends` | 401 da ospite |
| `POST /api/user/bulk` | profili di più utenti (lista stanze) |
| `GET /api/push/public-key` | chiave VAPID |
| `GET /keepalive` (ogni 15 min) | tiene viva la sessione (base URL esatta non verificata) |

---

## 8. Raccomandazioni per l'architettura di PoorDown

1. **Monorepo TypeScript con un motore condiviso**: `packages/engine` (reducer puro `apply(state, action) → {state, events}`, deterministico, senza I/O, con il caso casuale **solo sul server**), `apps/server`, `apps/web`. È il punto di forza di richup: regole scritte una volta sola, testabili con unit test, e usate dal client per animazioni e previsioni.
2. **Server autoritativo + Socket.IO** (Node). Il client invia **intenzioni** (`roll`, `buy`, `bid`…) e riceve un ack `{ok}` o `{ok:false, code, message}`, con timeout. Il server trasmette **eventi** con i dati necessari all'animazione (dadi, carta pescata). Basta WebSocket puro, senza polling.
3. **Sincronizzazione semplice ma robusta**. Per 2–6 amici lo stato è piccolo (~10–15 KB), quindi conviene partire con **evento + numero di versione dello stato**. Se il client vede un salto di versione o un hash diverso, chiede lo stato completo (come `request-sync`). Mandare lo stato completo a ogni azione resta un'alternativa accettabile all'inizio.
4. **Informazioni nascoste**: mai inviare l'ordine dei mazzi né dati segreti. Ogni giocatore riceve una vista filtrata dello stato (serve un passaggio `playerView(state, playerId)` sul server).
5. **Identità senza account**: un `playerToken` casuale (UUID) creato al primo accesso, salvato in localStorage, o in un cookie httpOnly se server e frontend stanno sullo stesso dominio, e passato nell'handshake (`auth`). Il server associa token → posto. Alla riconnessione si rientra nello stesso posto e si riceve lo stato completo.
6. **Disconnessioni e AFK**, configurabili dall'host: marcatore "offline" visibile a tutti, attesa (es. 2–3 min) prima della rimozione o del passaggio a un bot, salto automatico del turno di chi è offline, kick da parte dell'host. Il turn clock "grace + banca" di richup funziona bene, ma tra amici conviene **un timer opzionale e più semplice** (es. 60–90 s a turno, disattivabile).
7. **Client**: coda degli eventi in ingresso (le animazioni vanno in sequenza, la chat no), orario del server sincronizzato per i countdown, store reattivo (zustand) e animazioni con framer-motion e/o react-spring. Tabellone in DOM/CSS, sufficiente e accessibile.
8. **Stanze**: codice di 5–6 caratteri, stanze in memoria (`Map`) con pulizia di quelle inattive, eventuale salvataggio periodico su SQLite o Redis per sopravvivere a un riavvio. Rate limit leggero sulla creazione. **Lista delle stanze pubbliche non necessaria** (solo partite private tra amici).
9. **Cosa evitare**: ads, tracker, CMP, captcha, store e monete, account obbligatori, il servizio "app" separato. Un solo processo Node basta. Hosting: un'istanza con WebSocket (Fly.io, Railway, Render o una VPS) con il frontend statico sullo stesso dominio. Cloudflare davanti è facoltativo.
10. **Alternative da valutare**: **Colyseus** (riconnessione e sincronizzazione delta già pronte, ma impone il proprio modello di stato) e **boardgame.io** (stesso schema motore condiviso + `playerView`; stato di manutenzione da verificare). Socket.IO + motore proprio è la strada di richup e lascia il massimo controllo.

---

## 9. Dubbi e cose non verificate
- **Captcha Turnstile**: non mi sono seduto al tavolo, quindi niente partita, frame di turno, lobby a 2 sessioni, test di ricaricamento in lobby o a metà partita, né osservazione dal vivo di AFK o vote kick. Tutto ciò che riguarda la partita viene dal **codice client** (affidabile per nomi e forma degli eventi, meno per le regole lato server).
- Lo stack del server (Express, MongoDB, due servizi) è dedotto da header, cookie e formato degli ID.
- La libreria dei toast (Sonner?) e il codice del player audio non li ho individuati con certezza.
- Il comportamento dei bot (quando entrano, quanto sono "bravi") non è stato osservato.
- Non so quanto restino vive le stanze private vuote. La stanza creata (vuota, nessun partecipante) è stata abbandonata.
- Gli eventi di `/api/app` (amici, monete) sono stati visti solo nel codice.

## 10. Screenshot salvati (`docs/analisi/img/`)
- `a6-home.png`: home desktop dopo "Do not consent"
- `a6-loading.png`: "Loading game..." con il widget Cloudflare Turnstile che blocca l'ingresso
- `a6-room-landing.png`: landing di una stanza (`/room/<id>`) con il nickname già salvato e "Enter Game"
- `a6-all-rooms.png`: lista delle stanze pubbliche (aggiornata in push via `/api/lobby`)
- `a6-mobile-home.png`: home a 390×844
- `a6-mobile-room-landing.png`: landing della stanza a 390×844
