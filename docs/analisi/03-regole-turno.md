# 03 – Regole di base e flusso del turno (analisi di richup.io)

> Analisi funzionale di richup.io fatta come riferimento per **PoorDown** (gioco originale, non clone grafico).
> Data: 7 novembre 2026. Mappa: **Classic**. Browser: Edge (playwright-cli), viewport 1600×900.
> **Legenda affidabilità**: **[V]** = verificato giocando · **[C]** = letto nel codice JavaScript del client (bundle pubblico `GamePageContent-*.js` / `index-*.js`), quindi è un valore certo del client ma il comportamento è stato visto solo in parte · **[D]** = dedotto, non verificato direttamente.

---

## 1. Panoramica

Ho giocato **3 partite** nella stessa stanza privata (`/room/x1jm5`):

| # | Giocatori | Impostazioni | Come è finita |
|---|-----------|--------------|---------------|
| 1 | Alfa (host) + Beta, 2 browser | default | Beta **rimosso per timeout** dopo pochi turni → vince Alfa |
| 2 | Alfa + Beta | default | ~96 turni, 48 min; Beta usa **Bankrupt** volontario → vince Alfa |
| 3 | Alfa + 3 bot | $500 iniziali, **Vacation cash ON, Auction ON, Mortgage ON** | Alfa va in debito di $451, il timer scade → **bancarotta automatica** |

Il secondo browser non è riuscito a entrare nella partita 3 per un captcha Cloudflare (non l'ho cliccato), quindi ho usato i bot (impostazione "Allow bots to join").

**Impostazioni di default** viste nella lobby [V]: 4 giocatori max, stanza privata ON, bot OFF, mappa Classic, *x2 rent on full-set* OFF, *Vacation cash* OFF, *Auction* OFF, *Don't collect rent while in prison* OFF, *Mortgage* OFF, *Even build* ON, contanti iniziali **$1500**, *Randomize player order* ON.

Il turno in sintesi: lanci i dadi → la pedina avanza → l'effetto della casella si applica da solo (affitto, tassa, carta, prigione…) → se la proprietà è libera puoi comprarla (o mandarla all'asta, se l'asta è attiva) → con un doppio rilanci, altrimenti premi **End turn**. Tutto il turno ha un **timer** con "banca del tempo" personale.

---

## 2. Macchina a stati del turno

```
                 ┌──────────────────────────────────────────────────────────┐
                 │                 INIZIO TURNO (giocatore X)               │
                 └──────────────┬───────────────────────────┬───────────────┘
                     X in prigione?                         │ X in vacanza (turno sospeso)?
                         │ sì                               │ sì → turno saltato, passa al successivo [V]
                         ▼                                  ▼ no
          ┌────────────────────────────┐        ┌──────────────────────┐
          │ PRIGIONE: scelta           │        │ PRE-LANCIO           │
          │ [Roll the dice]            │        │ [Roll the dice]      │  (si può anche gestire proprietà,
          │ [get free for $50]         │        │                      │   costruire, scambiare) [V]
          │ [Use Pardon card] (se c'è) │        └──────────┬───────────┘
          └──┬───────────┬─────────────┘                   │ lancio
     pago/carta│     lancio│                               ▼
   → turno FINISCE  doppio? no → "failed to throw    ┌──────────────────────┐
   (si muove al        doubles…" → turno FINISCE [V] │ MOVIMENTO + EFFETTO  │ automatico: Start, affitto,
   turno dopo) [V]     (al 4° turno esce gratis) [V] │ CASELLA              │ tassa, carta, prigione, vacanza
                 doppio sì → esce e si muove [D]     └──────────┬───────────┘
                                                                │
                     ┌──────────────────────────────────────────┼─────────────────────────────┐
                     ▼                                          ▼                             ▼
           Finito in prigione                        Proprietà libera                 Altro (o già posseduta)
           (casella, carta, 3 doppi)                 [Buy for $X] +                          │
           → turno FINISCE, niente                   [End turn] (asta OFF) oppure            │
             rilancio anche se doppio [V]            [Auction] (asta ON) [V]                 │
           Finito in Vacanza                         (se doppio: [Roll again] al posto       │
           → turno FINISCE [V]                        di End turn) [V]                       │
                                                                │                            │
                                                                ▼                            ▼
                                                     ┌────────────────────────────────────────────┐
                                                     │ POST-LANCIO                                │
                                                     │ doppio (e soldi ≥ 0) → [Roll again]        │
                                                     │ altrimenti          → [End turn]           │
                                                     │ soldi < 0 → pulsanti DISABILITATI finché   │
                                                     │ non torni ≥ 0 (vendi/ipoteca/scambia) o    │
                                                     │ fai [Bankrupt] [V]                         │
                                                     └──────────────────┬─────────────────────────┘
                                                                        │ End turn / timeout
                                                                        ▼
                                                              turno al giocatore successivo
```

**Timeout** (in qualunque stato) [V]: se non hai ancora lanciato, il gioco **lancia per te**; poi applica l'effetto e **chiude il turno senza comprare**. Se sei in debito allo scadere del tempo → **bancarotta automatica** [V]. Dopo troppi turni giocati in automatico il giocatore viene **rimosso** dalla partita [V].

---

## 3. Regole esatte

### 3.1 Dadi
- Due dadi a 6 facce, 3D bianchi al centro del tabellone. Si lancia con il pulsante **Roll the dice** [V]; anche **cliccare sui dadi** lancia (elemento `aria-label="dices"`, cliccabile solo quando è permesso) [C].
- Animazione: i dadi rotolano ~1 s, poi la pedina avanza casella per casella (~1–2 s in tutto) [V]. Con un doppio i dadi ricevono un'evidenziazione speciale (classe CSS `double`) [C].
- **Doppio** → dopo l'effetto della casella compare **Roll again** al posto di End turn [V]. Si può comprare prima di rilanciare (pulsanti `Roll again` + `Buy for $X`) [V].
- **3 doppi di fila** → `"<nome> rolled doubles 3 times in a row and got into prison"`: va in prigione, il turno finisce [V] (osservato 2 volte).
- Se un doppio ti porta in prigione (casella o carta) il rilancio è annullato e il turno finisce [V].
- Con soldi negativi il pulsante Roll again è disabilitato [V].
- I lanci **non** compaiono nel log [V].

### 3.2 Movimento e casella Start
- Senso orario partendo da START (angolo in alto a sinistra), 40 caselle [V].
- **Passare** dallo Start: **+$200** → `"<nome> passed through Start and received $200"` [V]. Vale anche quando ti sposta una carta "Advance to…" [V].
- **Fermarsi esattamente** sullo Start: **+$300** → `"<nome> landed on Start and received $300"` [V] (sia con i dadi sia con la carta "Advance to Start").

### 3.3 Proprietà libera: acquisto o rifiuto
- Pulsante **`Buy for $<prezzo>`** [V]. Se non hai abbastanza soldi è **disabilitato** (visibile ma grigio) [V]; il codice lo disabilita quando `soldi - prezzo < 0` [C].
- Log: `"<nome> bought <Proprietà>"` [V]. La casella mostra al posto del prezzo una fascia del colore del proprietario [V].
- **Asta OFF (default)**: rifiutare = premere `End turn` (o `Roll again`). La proprietà resta libera, non succede nient'altro [V].
- **Asta ON**: al posto di End turn compare il pulsante **`Auction`** [V]. Cliccandolo si apre per **tutti** un modale "Auction" con nome e scheda della proprietà, offerta corrente, offerte rapide **+$2 / +$10 / +$100**, conto alla rovescia "Sold in N…" ed elenco delle offerte. Log finale: `"<nome> bought <Proprietà> by auction for $X."` (dettagli → analisi aste).
- In caso di timeout l'acquisto non avviene: il turno si chiude [V].

### 3.4 Affitti
- **Automatici**: nessuno deve "chiedere" l'affitto. All'arrivo il pagamento avviene subito con la riga di log `"<A> paid $N to <B>"` e i saldi si aggiornano nel pannello giocatori (piccola animazione +N / −N accanto al saldo) [V].
- Valori in linea con le schede proprietà: Salvador $2, Rio $4, Rome $12; Rome con 2 case $180 [V].
- Il proprietario in prigione incassa comunque (default) [V]; esiste l'opzione "Don't collect rent while in prison".
- Aeroporti: 1 → $25, 2 → $50, 3 → $100, 4 → $200 [V da scheda + pagamenti $25/$50 visti].
- Società (Water/Power Company): 1 posseduta → **$4 × dadi**, 2 possedute → **$10 × dadi** [V da scheda].
- Proprietà ipotecata: niente affitto (testo dell'impostazione Mortgage) [D].

### 3.5 Tasse
- **Earnings Tax** (casella 4, etichetta "%10"): **10% del contante**, arrotondato → es. `"Hefty Repeat paid a $29 tax"` con $288 in cassa [V su un caso; arrotondamento all'intero più vicino D].
- **Premium Tax** (casella 38): **$75 fissi** → `"<nome> paid a $75 tax"` [V].
- Con *Vacation cash* ON le tasse finiscono nel piatto della Vacanza [V] (vedi 3.8).

### 3.6 Prigione
**Come ci si entra** [V]:
1. casella angolare **Go to prison** (in basso a sinistra) → `"<nome> got into prison"`;
2. carta Surprise/Treasure **"Go to prison."** → `"<nome> got a … card: Go to prison."` + `"got into prison"`;
3. **3 doppi** di fila.
Entrare in prigione chiude subito il turno [V]. La pedina va nella cella "In Prison" (con le sbarre) dell'angolo in alto a destra e nel pannello giocatori l'avatar ha le sbarre [V]. Fermarsi su quella casella col dado = "Passing by" (solo visita) [D].

**Come si esce** [V]: al proprio turno compaiono:
- **`Roll the dice`**: se fai doppio esci [D, mai riuscito nei test]; se no `"<nome> failed to throw doubles to get out of prison"` e il **turno finisce subito**.
- **`get free for $50`**: paghi $50 → `"<nome> paid $50 to get out of prison"`. **Il turno finisce** subito; al turno dopo lanci normalmente dalla casella prigione. Disabilitato se hai meno di $50 (tooltip `"You don't have enough money to pay for it."`) [C].
- **`Use Pardon card`** (solo se possiedi la carta): `"<nome> used a Pardon card to get out of prison"`, anche qui il turno finisce [V].
- **Massimo 3 tentativi**: dopo 3 lanci falliti, al **4° turno** il giocatore ha solo `Roll the dice` e si muove normalmente **senza pagare** i $50 (nessuna riga di log per l'uscita) [V, visto 2 volte].
- **Pardon card** = carta "esci gratis": `"<nome> got a Pardon card from the surprises stack"`; finisce nella lista "My properties" come "Pardon card" e si può scambiare (il testo dei Trades parla di "bonus cards") [V].
- Il bail di $50 **non** va nel piatto della Vacanza [V].

### 3.7 Go to prison
Angolo in basso a sinistra; arrivarci manda in prigione senza passare dallo Start (niente $200) [V per l'invio; D per il "niente $200"].

### 3.8 Vacanza (angolo in basso a destra) e Vacation cash
- Fermarsi su **Vacation** = **saltare il proprio turno successivo**: `"<nome> will spend a turn while on vacation"` [V]. In 2 giocatori l'avversario gioca due turni di fila [V]. Il turno in cui ci arrivi finisce subito [V].
- **Vacation cash ON**: sotto la casella compare **`$X on hold`**. Il piatto raccoglie le tasse e i pagamenti alla banca (testo opzione: *"If a player lands on Vacation, all collected money from taxes and bank payments will be earned"*) [V: 3 tasse da $75 → "$225 on hold"]. Chi arriva in Vacanza incassa tutto: `"Dear Wine will spend a turn while on vacation. $225 withdrawn."` (con piatto vuoto: "$0 withdrawn.") [V].

### 3.9 Caselle carta
- **Treasure** (caselle 2, 17, 33) e **Surprise** (8, 22, 36) [V].
- La carta **non** apre un popup ma appare solo come riga di log: `"<nome> got a surprise card: <testo>"` / `"<nome> got a treasure card: <testo>"`; l'effetto è immediato [V].
- Testi esatti → sezione 4.

### 3.10 Soldi insufficienti, debito e bancarotta
- Se devi pagare più di quanto hai, il pagamento **avviene lo stesso** e il saldo diventa **negativo** (mostrato in rosso, es. `$-8`) [V]. Il log riporta la cifra intera (`"Alfa paid $25 to Sick Partner"`).
- Il **creditore incassa subito solo il contante disponibile**; il resto gli arriva in automatico quando il debitore rientra in positivo [V: $17 subito, poi gli altri $8 dopo l'ipoteca].
- Con saldo negativo **End turn / Roll again sono disabilitati**, con tooltip: `"You can't end your turn with a negative amount of money. Sell properties or trade with other players."` [V].
- Per rientrare: dalla scheda proprietà (lista "My properties") si può **vendere case** (↓), **vendere la proprietà alla banca al 50%** (cestino, tooltip `"Sell for $80"` su Rome da $160), **ipotecare al 50%** se l'opzione Mortgage è attiva (`"Mortgage for $130"` su Lyon da $260; riscatto `"Get back for $143"` = +10%), oppure **scambiare** con altri giocatori [V].
- Il timer in debito ha un bonus (`debtGraceMs` = 60 s) [C]; visto 3:25 a disposizione [V].
- Se il tempo scade con saldo negativo → **bancarotta automatica**: `"Alfa went bankrupt and lost all purchased properties."` [V]. Al creditore resta solo quanto incassato fino a quel momento [V].
- **Bankrupt volontario**: pulsante rosso `Bankrupt` (pannello destro), modale `"File your bankruptcy"` – `"Are you sure you want to bankrupt? You will lose all your money and purchased properties! This cannot be undone."` – [Bankrupt] [Cancel] [V]. Log: `"<nome> went bankrupt and lost all purchased properties."`. Le proprietà tornano alla banca [D].

### 3.11 Timer di turno (banca del tempo)
Configurazione del client [C]:

| Parametro | Valore | Significato |
|---|---|---|
| graceMs | 20 s | tempo "gratuito" a inizio turno |
| bankStartMs | 60 s | banca personale iniziale |
| bankMaxMs | 3 min | banca massima |
| min/maxRefillMs | 6–20 s | ricarica della banca per turno |
| debtGraceMs | 60 s | tempo extra quando sei in debito |
| grantMs | 1 min | tempo concesso da "Grant +1 min" |
| grantCapPerTurnMs | 2 min | massimo concedibile per turno |
| grantCooldownTurns | 1 | attesa tra due richieste |
| removalAfterAutoActedTurns | 2 | turni automatici prima della rimozione |

Osservato [V]:
- La "pillola" del timer sopra i dadi è nascosta nei primi ~10 s del turno e poi parte da ~**1:10** (20 s di grazia + 60 s di banca); giocando veloce la banca sale fino a **3:00+**; dopo un timeout scende (visti turni da 0:10 e 0:04). Diventa rossa negli ultimi secondi.
- A ≤30 s compare **`Ask for more time`** per chi gioca; cliccato diventa **`Waiting for a grant…`**; gli altri vedono **`Grant +1 min`** (tooltip `"Give this player extra time"`).
- Allo scadere: lancio automatico (se manca) e fine turno automatica, senza acquisto.
- Rimozione: `"Beta was removed from the game after running out of time."`; il rimosso vede il modale **"Your time ran out"** – `"You were removed to keep the game moving. You can head back or stay and watch how it ends."` – `"Leaving or timing out costs 1 karma."` – [Keep watching] [Back to home]. Osservato al 3° timeout consecutivo dello stesso giocatore.
- La descrizione della stanza privata in partita dice: `"Private room. The host can remove players who run out of time."`
- Esiste anche il **Votekick** (testi "Votekick (n/m)") [C].

### 3.12 Costruzioni (solo quanto visto per il turno)
- Si costruisce **nel proprio turno**, prima o dopo il lancio [V]; fuori turno i pulsanti ↑ ↓ cestino sono disabilitati [V]. Con *Even build* si costruisce in modo uniforme sul gruppo [V]. Tooltip: `"Upgrade to one house for $100"`. Log: `"<nome> bought a house in <Proprietà>"`. Il numero di case appare sulla fascia della casella e in lista (`x 2`) [V].

### 3.13 Ordine dei turni e fine partita
- Con l'ordine casuale: `"Game started with a randomized players order. Good luck!"` [V].
- La partita finisce quando resta un solo giocatore → schermata **Game over** [V] (vedi 6).

---

## 4. Testi delle carte (esatti, in inglese)

### Surprise
| Testo | Effetto osservato |
|---|---|
| You have a new investment. Receive $150. | +$150 [V] |
| Stock agency pays you dividend of $60. | +$60 [V] |
| From a scholarship you get $100. | +$100 [V] |
| Your cousin needs some financial assistance. Pay $50. | −$50 [V] |
| Pay tax of $20. | −$20 (pagamento alla banca → piatto Vacanza se attivo) [V/D] |
| Advance to the next company. | sposta alla società successiva [V] |
| Advance to Shanghai. | sposta; passando dallo Start +$200 [V] |
| Advance to Venice. | sposta; passando dallo Start +$200; si può comprare [V] |
| Have an adventure to New York. | sposta a New York; acquisto possibile [V] |
| Advance to Start. | sposta allo Start → +$300 [V] |
| Go to prison. | prigione, fine turno [V] |
| Have a redesign for your properties. Pay $25 for each house and $100 for each hotel. | paga per edificio [V testo] |
| *(Pardon card)* → log "got a Pardon card from the surprises stack" | carta esci di prigione, conservabile [V] |

### Treasure
| Testo | Effetto osservato |
|---|---|
| You have won third prize in a lottery. Collect $15. | +$15 [V] |
| Tax refund. Collect $100. | +$100 [V] |
| Beneficial business decisions. You made a profit of $25. | +$25 [V] |
| From gift cards you get $100. | +$100 [V] |
| You host a party. Collect $50 from every player for equipment. | +$50 da ogni giocatore [V] |
| Your car has ran out of gas. Pay $50. | −$50 [V] |
| Car rental insurance. Pay $60. | −$60 [V] |
| Your phone died. Pay $50 for a repair. | −$50 [V] |
| It's time to renovate your properties. Pay $30 per house and $120 per hotel you own. | paga per edificio [V testo] |
| Advance to Start. | +$300 [V] |
| Go to prison. | prigione [V] |

Non ho visto una Pardon card dal mazzo Treasure (non vuol dire che non esista) [D]. I testi delle carte arrivano dal server (non sono nel bundle JS).

---

## 5. Layout della schermata di gioco (desktop 1600×900)

**Colonna sinistra (~23%)**
- Logo RICHUP.io + icone Discord, aiuto (?), audio.
- Box **"Share this game"**: campo URL della stanza + `Copy`; in partita anche `View room settings` (modale "Room Settings" in sola lettura con tutte le regole e i loro testi).
- Banner pubblicitario (300×250).
- **Chat**: in alto icone muto e compatta; messaggi con avatar, nome e testo nel fumetto; campo `Say something...` + pulsante invio. Chi non gioca vede "Only game players can send chat messages". Placeholder iniziale "No messages yet".

**Centro: il tabellone** (11×11 caselle, angoli START / In Prison–Passing by / Vacation / Go to prison). Ogni proprietà ha bandiera del gruppo, nome e prezzo; una volta comprata il prezzo diventa una fascia del colore del proprietario con le icone case (`x2`) o l'icona ipoteca. Al centro del tabellone, dall'alto:
1. pillola del **timer** (+ `Ask for more time` quando serve);
2. i **due dadi 3D**;
3. i **pulsanti d'azione** del turno; per gli altri giocatori invece `<avatar> <Nome> is playing...` (anche "is typing...", "is creating a trade...", "is looking at a trade...", "is negotiating a trade..." [C]);
4. il **log eventi**: il più recente in alto in grassetto, i precedenti sempre più sbiaditi; tiene al massimo **50 righe** [V].

**Colonna destra (~23%)**
- **Elenco giocatori**: avatar colorato (bot con icona robot), nome, corona dell'host, saldo `$1500`. Il giocatore di turno ha una barra colorata a sinistra; chi è in prigione ha le sbarre sull'avatar; saldo negativo in rosso.
- Pulsante rosso **`Bankrupt`**.
- **Trades**: `Create` + suggerimento "Make trades with other players to exchange properties, money and bonus cards…" (`Got it`); elenco degli scambi attivi (`A ↔ B`).
- **My properties (N)**: suggerimento "Click on a property to upgrade, downgrade or sell it."; lista con bandiera, nome, numero di case, icona ipoteca e le Pardon card.

**Scheda proprietà** (clic su una casella del tabellone o su una voce di "My properties"): popover con titolo, tabella **when / get** (`with rent`, `with one house` … `with a hotel`), `Owner <avatar nome>`, riga `Price | 🏠 costo casa | 🏨 costo hotel`. Aperta dalla propria lista mostra anche i pulsanti **↑ upgrade**, **↓ downgrade**, **🗑 sell** e, con Mortgage ON, il pulsante giallo **`Mortgage for $X`** (ipotecata: "Mortgaged", `Get back for $X`). Aeroporti: righe "one airport is owned … 4 airports are owned"; Società: "If one company is owned, get $4 x 🎲 / If two companies are owned, get $10 x 🎲". Le caselle Tasse, Carte e gli angoli non aprono nessuna scheda [V].

Esempi di tabelle viste (affitto base / 1 / 2 / 3 / 4 case / hotel; prezzo; costo casa):
- Paris 25/120/350/850/1000/1200 – $280 – casa $150
- Lyon 20/100/320/800/950/1100 – $260 – $150
- Rome 12/60/180/500/700/900 – $160 – $100
- Milan 10/50/160/460/630/760 – $140 – $100
- Venice 10/50/140/440/600/740 – $130 – $100
- Jerusalem 8/40/110/300/460/610 – $120 – $50

**Cosa vede l'avversario** [V]: lo stesso timer, i dadi con il risultato, la pedina che si muove, il log in tempo reale, i saldi che cambiano; nessun pulsante d'azione tranne `Grant +1 min` quando chi gioca ha poco tempo. Può chattare, aprire le schede, proporre o rispondere a scambi e vedere le impostazioni.

**Fuori dal proprio turno** si può [V]: chat, scambi (crea/accetta/rifiuta/negozia; i bot ne propongono spesso e il modale "View trade" copre i pulsanti), schede proprietà (solo lettura), `View room settings`, `Grant +1 min`, `Bankrupt`. **Non** si può costruire, vendere o ipotecare.

---

## 6. Testi esatti di pulsanti e messaggi

**Pulsanti del turno**: `Roll the dice` · `Roll again` · `End turn` · `Buy for $<n>` · `Auction` · `get free for $50` · `Use Pardon card` · `Ask for more time` · `Waiting for a grant…` · `Grant +1 min` · `Bankrupt` · `Start Game` (host in lobby) · `Join game` · `Enter Game`.

**Log** (grassetto = nomi):
- `Game started with a randomized players order. Good luck!` · `<X> joined the game` · `Joined room <id>`
- `<X> bought <P>` · `<X> bought <P> by auction for $<n>.` · `<X> bought a house in <P>` · `<X> mortgaged <P> for $<n>.`
- `<X> paid $<n> to <Y>` · `<X> paid a $<n> tax`
- `<X> passed through Start and received $200` · `<X> landed on Start and received $300`
- `<X> got a surprise card: <testo>` · `<X> got a treasure card: <testo>` · `<X> got a Pardon card from the surprises stack`
- `<X> got into prison` · `<X> failed to throw doubles to get out of prison` · `<X> paid $50 to get out of prison` · `<X> used a Pardon card to get out of prison` · `<X> rolled doubles 3 times in a row and got into prison`
- `<X> will spend a turn while on vacation` (Vacation cash ON: `… on vacation. $<n> withdrawn.`)
- `<X> created a trade with <Y>` · `<Y> accepted/declined a trade created by <X>` · `<X> canceled the trade with <Y>`
- `<X> went bankrupt and lost all purchased properties.` · `<X> was removed from the game after running out of time.`

**Tooltip / modali**: `You can't end your turn with a negative amount of money. Sell properties or trade with other players.` · `You don't have enough money to pay for it.` · `Upgrade to one house for $100` · `Sell for $80` · `Mortgage for $130` · `Get back for $143` · `Give this player extra time` · "File your bankruptcy" (testo in 3.10) · "Your time ran out" (testo in 3.11) · `Connection lost` / `Make sure your internet connection is stable.`

**Fine partita**: `Game over!` · `and the winner is...` · `<Nome>` · `Another game` (riporta la stessa stanza in lobby, tutti devono rifare Join) · `Back to lobby` · `Share with friends` (Facebook, X, WhatsApp, Telegram) · pannello `Game statistics` → `Leaderboard # Player Turns survived` · `View all statistics` → modale con `Net worth over time` (grafico), `Winner`, `Duration`, `Turns`, `Doubles`, `Trades`, `Chat messages`, `Most visited property`, `Most times in prison` · `You earned a coin for this win` / `Log in to claim it`.

---

## 7. Casi limite osservati
- **Doppio + prigione**: un doppio seguito da "Go to prison" annulla il rilancio [V].
- **Doppio + acquisto**: `Roll again` e `Buy` insieme; puoi comprare e poi rilanciare [V].
- **Pagare o usare la Pardon card in prigione chiude il turno** (non ti muovi subito) [V]: è diverso dal Monopoly classico, da notare per PoorDown.
- **Uscita gratis dopo 3 tentativi falliti**, senza la multa di $50 [V].
- **Saldo negativo** consentito durante il turno; il creditore riceve il resto in automatico appena il debitore rientra [V].
- **Debito e timer scaduto** → bancarotta automatica [V].
- **Due giocatori in Vacanza**: ognuno salta il proprio turno, in sequenza [V].
- **Le carte "Advance to…" pagano lo Start** se lo attraversano [V].
- **Buy disabilitato** se non puoi permettertelo; con l'asta ON resta solo `Auction` cliccabile [V].
- **Timeout ripetuti**: banca del tempo esaurita → turni da pochi secondi → rimozione e, in 2 giocatori, fine partita immediata [V].
- **Modale di scambio di un bot** sopra i pulsanti: se non lo chiudi il turno può scadere [V].
- All'ingresso in stanza può partire un **video pubblicitario di ~25 s** ("You will be taken to the game room after the advertisement ends.") e talvolta un **captcha Cloudflare** ("Verify below to join") [V].
- Il log tiene solo le ultime 50 righe [V].

---

## 8. Dubbi e cose non verificate
- **Uscita di prigione con doppio**: mai riuscita nei test; non so se dopo l'uscita si ha un altro lancio (nel Monopoly classico no) [D].
- **Earnings Tax**: 10% del contante confermato su un caso ($288 → $29); arrotondamento e base esatta (solo contante?) da confermare [D].
- **Regola di rimozione**: il codice dice 2 turni automatici, ma ho visto la rimozione al 3° timeout consecutivo; non so se una richiesta di tempo azzeri il contatore [D].
- **Proprietà dopo una bancarotta**: tornano alla banca (testo del modale); subito dopo era in corso un'asta su una proprietà ex-Alfa, ma non so se l'asta parta da sola [D].
- **Pardon card** dal mazzo Treasure: non vista.
- **Go to prison** senza $200 dallo Start: dedotto (la pedina va direttamente in prigione).
- **Fermarsi su "Passing by"**: nessun effetto (dedotto dall'etichetta, non visto in un log).
- **Arrivo in Vacanza con un doppio**: non verificato se il rilancio viene annullato.
- **Hotel, Even build, x2 rent on full set, Don't collect rent in prison**: impostazioni lette, effetti non testati (aree di altri agenti).
- **Suono "è il tuo turno"** ogni minuto e **notifiche push** ("Turn on notifications"): visti solo nel codice [C].
- Dopo la mia interruzione la partita 2 è andata avanti da sola con alcuni turni in timeout (righe di log "failed to throw doubles…" senza mie azioni), senza rimozioni.

---

## 9. Screenshot salvati (`docs/analisi/img/`)
| File | Contenuto |
|---|---|
| a3-01-lobby.png | lobby prima di entrare (scelta colore, impostazioni) |
| a3-02-lobby-host-board.png | host entrato: tabellone, Start Game, impostazioni |
| a3-03-guest-waiting.png | ospite: "Waiting for Alfa to start the game..." |
| a3-04-game-start-waiting-view.png | inizio partita visto da chi aspetta |
| a3-05-game-start-active-player.png | inizio partita: timer + Roll the dice |
| a3-06-dice-rolling.png | subito dopo il lancio: End turn + Buy for $200 |
| a3-07-opponent-view-during-buy.png | vista dell'avversario durante la scelta d'acquisto |
| a3-08-timeout-host-view.png | dopo il timeout il turno è passato all'altro |
| a3-09-ask-more-time.png | timer rosso + Ask for more time |
| a3-10-grant-more-time.png | avversario: Grant +1 min |
| a3-11-game-over-timeout.png | Game over dopo la rimozione per timeout |
| a3-12-removed-for-timeout.png | modale "Your time ran out" |
| a3-13-surprise-card-landed.png | carta Surprise nel log |
| a3-14-doubles-roll-again.png | doppio 5+5 → Roll again |
| a3-15-alfa-in-prison-opponent-turn.png | giocatore in prigione (pedina e avatar con sbarre) |
| a3-16-prison-options.png | opzioni prigione: Roll the dice / get free for $50 |
| a3-17-after-paying-prison.png | dopo aver pagato $50 il turno passa |
| a3-18-property-card-paris.png | scheda proprietà (Paris) |
| a3-19-property-card-airport.png | scheda aeroporto |
| a3-20-property-card-company.png | scheda società |
| a3-21-ingame-room-settings-and-chat.png | modale Room Settings in partita + chat |
| a3-22-chat-received.png | messaggio di chat visto dall'altro |
| a3-23-my-property-actions-offturn.png | scheda da "My properties" fuori turno (pulsanti disabilitati) |
| a3-24-house-built.png / a3-24-houses-built.png | case costruite (fascia + log) |
| a3-25-bankrupt-confirm.png | modale "File your bankruptcy" |
| a3-26-game-over-bankrupt.png | Game over dopo la bancarotta |
| a3-27-game-statistics.png | statistiche complete della partita |
| a3-28-lobby-bots.png | lobby con 3 bot e Vacation "$0 on hold" |
| a3-29-buy-or-auction.png | asta ON: pulsanti Auction + Buy |
| a3-30-auction-started.png | modale dell'asta |
| a3-31-trade-offer-blocking.png | proposta di scambio di un bot sopra i pulsanti |
| a3-32-negative-money.png | saldo −$8, Roll again disabilitato + tooltip |
| a3-33-property-actions-mortgage.png | scheda con "Mortgage for $130" |
| a3-34-property-mortgaged.png | proprietà ipotecata ("Get back for $143") |
| a3-35-prison-pardon-card.png | prigione con "Use Pardon card" |
| a3-36-big-debt.png | debito −$451, End turn disabilitato |
| a3-37-auto-bankrupt-after-debt-timeout.png | dopo la bancarotta automatica (asta in corso) |
