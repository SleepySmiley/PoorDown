# 04 · Economia avanzata e fine partita (analisi di richup.io)

Area: aste, scambi, ipoteche, case e hotel, affitti, debito e bancarotta, fine partita.
Data dell'analisi: 7 novembre 2026. Versione client analizzata: release Sentry `59c88252` (bundle `GamePageContent-Bt4kpueR.js`, `confetti.module-Dt3tsJBH.js`, `index.BsWpThUS.js`).

---

## 0. Metodo, limiti e legenda

### Blocco: non sono riuscito a giocare dal vivo
- Ho creato una stanza privata (`https://richup.io/room/wvgfv`, nickname `A4Alice`). Il gioco però si ferma su **"Loading game..."** e mostra un controllo **Cloudflare Turnstile "Verify you are human"** (screenshot `a4-cloudflare-turnstile.png`). Il controllo non si sblocca da solo nel browser headless.
- **Non ho cliccato il controllo anti-bot**: superare con l'automazione una verifica "sei umano?" equivale ad aggirare una protezione del sito. Senza quel passaggio non si entra nella stanza, quindi **nessuna partita è stata giocata e nessuna schermata di gioco è stata osservata dal vivo**.
- Nel codice il join accetta un `captchaToken` facoltativo e il pulsante di join può mostrare `"Verify below to join"`. Il captcha quindi scatta solo in certi casi, probabilmente per traffico che sembra automatico: in un browser normale un umano di solito passa.

### Cosa ho usato al posto del gioco dal vivo
1. **Codice client pubblico (JavaScript servito dal sito)**. Il client contiene una **copia completa del motore di gioco**: i reducer che applicano ogni azione allo stato (acquisto, asta, scambio, ipoteca, costruzione, bancarotta…), i messaggi d'errore di validazione, i dati delle mappe (prezzi e affitti) e tutti i testi dell'interfaccia. Ho estratto regole e valori numerici da qui.
2. **Blog ufficiale** (blog.richup.io): post v1.12 (Even build), v1.15 (debiti), v1.16 (Teams), v1.17 (Turn Clock e scambi più equi).
3. **Home page** ("How to play").

### Legenda dell'affidabilità
- **[CODICE]**: letto nel motore o nella UI del client. Alta affidabilità sulla regola, **non osservato a schermo**. Il server quasi certamente usa lo stesso motore (stessi messaggi d'errore, stessi nomi di azione), ma non posso escludere differenze lato server.
- **[BLOG]**: dichiarato nel blog ufficiale.
- **[DEDOTTO]**: mia inferenza dal codice o dal contesto.
- **[NON VERIFICATO]**: non confermabile senza giocare.

---

## 1. Panoramica

- Partita Monopoly-like su tabellone a 40 caselle. Soldi iniziali da $500 a $3000 (default $1500). [CODICE]
- Molte regole "classiche" sono **opzionali e disattivate di default**: aste, ipoteche, doppio affitto con set completo, cassa del Vacation, niente affitto se il proprietario è in prigione. **Even build** invece è attivo di default. [CODICE]
- Senza ipoteche, l'unico modo per fare liquidità con le proprietà è **venderle alla banca a metà prezzo** o **demolire edifici a metà costo**. [CODICE]
- Il debito verso un giocatore è "agganciato": chi non può pagare va in negativo e i suoi incassi futuri vanno al creditore. Non può finire il turno con saldo negativo. [CODICE]
- In bancarotta le proprietà **tornano alla banca** (libere). Il creditore riceve dalla banca il valore di liquidazione del debitore, fino al debito. [CODICE] [BLOG]
- Vince l'ultimo giocatore (o l'ultima squadra) rimasto. Schermata "Game over!", classifica per "Turns survived", statistiche, "Another game". [CODICE]

---

## 2. Impostazioni della stanza che toccano l'economia [CODICE]

Testi esatti della UI (nome e descrizione):

| Chiave interna | Nome in UI | Descrizione in UI | Default |
|---|---|---|---|
| `payDoubleRentWhenOwnFullSet` | **x2 rent on full-set properties** | "If a player owns a full property set, the base rent payment will be doubled" | OFF |
| `vacationCash` | **Vacation cash** | "If a player lands on Vacation, all collected money from taxes and bank payments will be earned" | OFF |
| `auction` | **Auction** | "If someone skips purchasing the property landed on, it will be sold to the highest bidder" | OFF |
| `noRentPaymentsWhileInPrison` | **Don't collect rent while in prison** | "Rent will not be collected when landing on properties whose owners are in prison" | OFF |
| `mortgage` | **Mortgage** | "Mortgage properties to earn 50% of their cost, but you won't get paid rent when players land on them" | OFF |
| `evenBuild` | **Even build** | "Houses and hotels must be built up and sold off evenly within a property set" | ON |
| `startingCash` | **Starting cash** | "Adjust how much money players start the game with" | $1500 |
| `maxPlayers` | Maximum players | "How many players can join the game" | 4 |

- Opzioni di `startingCash`: **500, 1000, 1500, 2000, 2500, 3000**. Per accelerare la partita il valore minimo è $500.
- `maxPlayers`: 2–6 (fino a 8 su una mappa particolare del negozio).
- Le impostazioni si cambiano solo in lobby e solo dall'host ("Settings cannot be changed after starting the game", "Only the room host can change settings"). Durante la partita sono consultabili con "View room settings".
- Mappe nel codice: `classic` (default), `mr-worldwide`, `death-valley`, `lucky-wheel`. Tutte usano Start = **$300 se ci si ferma, $200 se si passa**.

---

## 3. Aste [CODICE]

### Quando partono
- Solo con l'impostazione **Auction** attiva.
- Il giocatore di turno finisce su una proprietà acquistabile senza proprietario. Al posto di "End turn" vede due pulsanti: **"Buy for $<prezzo>"** e **"Auction"**. Con le aste attive **non può passare senza decidere**: compra oppure manda all'asta.
- Cliccando "Auction" il server avvia l'asta (`start-auction`).
- Con il Turn Clock, se il giocatore esaurisce il tempo il server può avviare l'asta in automatico. [CODICE] Il blog precisa che il sistema automatico "will never bid in an auction". [BLOG]

### Stato iniziale e incrementi
- L'asta parte con **offerta corrente = $2** e nessun offerente.
- Ci sono tre pulsanti di rilancio fissi: **+$2, +$10, +$100**. Ogni pulsante mostra l'importo finale (es. "$12" con sotto "+$10"). Con l'offerta a $2 i primi rilanci possibili sono $4, $12 e $102.
- Un pulsante è disabilitato se il giocatore non ha abbastanza contanti per quell'importo, o se è già il miglior offerente (non si rilancia su sé stessi).
- Lato server: l'offerta deve superare quella corrente ("Bid must be higher than current bid") e l'offerente deve avere i contanti ("Not enough money. Required: X, Available: Y").

### Timer
- Durata: **10 secondi** dall'avvio (`endsAt = now + 10s` nel client).
- Ogni offerta aggiorna la scadenza con un valore inviato dal server. [DEDOTTO] Probabilmente riparte da 10 s, come un'asta a "countdown che si resetta". [NON VERIFICATO]
- Barra di avanzamento: **"Ends in N..."** se nessuno ha offerto, **"Sold in N..."** se c'è un offerente.
- Durante l'asta il Turn Clock del giocatore di turno è **in pausa**, e non si può regalare tempo ("Time grants are unavailable during an auction").

### Chi partecipa
- **Qualsiasi giocatore attivo** (non in bancarotta), compreso chi ha fatto partire l'asta. Nessun vincolo di turno.

### Fine asta
- Alla scadenza (`end-auction`), se c'è un offerente con offerta > 0 **e ha ancora i contanti**, compra la proprietà a quel prezzo. Log: **"<player> bought <property> by auction for $<amount>"**.
- Se nessuno ha offerto, o il vincitore non ha più i soldi: evento `auction-ended-no-bids` e **la proprietà resta della banca**, libera. Potrà essere comprata da chi ci capiterà dopo.
- A fine asta il giocatore di turno non vede più "Buy" e prosegue con "End turn" (o "Roll again" se ha fatto doppio).

### UI (testi)
- Modale senza tasto chiudi, titolo **"Auction"**, con la carta della proprietà.
- **"Current bid"** con importo animato, avatar del miglior offerente e "bolle" +N a ogni rilancio.
- Registro dell'asta: **"<player> bids $<amount>"**.
- Sezione **"I'm bidding..."** con i 3 pulsanti di rilancio.

---

## 4. Scambi (trade) [CODICE salvo dove indicato]

### Apertura
- A destra c'è il pannello **"Trades"** con il pulsante **"Create"** (visibile solo ai giocatori, a partita in corso).
- Suggerimento iniziale, chiudibile con "Got it": *'Make trades with other players to exchange properties, money and bonus cards. use the "Create" button to create a new trade.'*
- Il modale si intitola **"Create a trade"** e chiede **"Select a player to trade with:"**. Se c'è un solo avversario viene selezionato da solo.
- **Non serve che sia il proprio turno**: il motore non controlla il turno per proporre, accettare, rifiutare o annullare. [CODICE, non osservato]
- Gli spettatori non creano scambi ("Only players can create new trades.").

### Cosa si può scambiare
Il modale ha due colonne, chi offre a sinistra e chi riceve a destra, separate da una freccia. Ogni colonna contiene:
- **Soldi**: slider più campo numerico in $, da 0 al saldo attuale del giocatore. Arrotondamento all'intero inferiore.
- **Proprietà** possedute (città, aeroporti, compagnie), selezionabili una per una, con prezzo e icona "Mortgaged property" se ipotecate.
- **Pardon Card** (la carta "esci di prigione"; ce n'è al massimo una per mazzo, Treasure e Surprise).
- **Nota** facoltativa, max **200 caratteri**, placeholder "Say something...". Pulsanti "Add a note to the trade" e "Discard note".

### Vincoli di validità
Lo stesso controllo gira nel client e nel motore:

| Codice | Messaggio in UI |
|---|---|
| giocatore uscito | "<player> does not take part in the game anymore" |
| soldi insufficienti | "<player> does not have enough money to make the trade" |
| soldi negativi | "<player> offered a negative amount of money, which makes no sense" |
| non acquistabile | "Some properties offered by <player> are not purchasable" |
| **edifici nel set** | "<player> is trying to trade cities that have buildings in their countries" |
| pardon non posseduta | "<player> does not own the selected pardon card" |
| proprietà non possedute | "<player> does not own all selected properties" |
| ipoteca cambiata | "Some non-mortgaged properties owned by <player> are now mortgaged" |
| vuoto | "The trade is empty" |

- **Proprietà con edifici**: non si può scambiare **nessuna città di un paese (set) che ha anche solo una casa**. Le città di quel set compaiono disabilitate. Prima bisogna demolire.
- **Proprietà ipotecate**: si possono scambiare. **Restano ipotecate** per il nuovo proprietario e **non c'è la tassa del 10%** del Monopoly classico.
- Chi è in negativo non può offrire soldi.
- Se la validazione fallisce all'invio compare il toast **"This trade is invalid."** con l'elenco dei motivi. Se fallisce quando il destinatario la guarda: **"This trade cannot be made."** con i motivi, e il pulsante Confirm è disabilitato.

### Regole di equità (dalla v1.17)
Attive per le partite con il flag `tradeFairnessRules`, cioè tutte quelle nuove.
1. **Chi è in debito non può peggiorare la propria capacità di rimborso.** Se dopo lo scambio il suo valore di liquidazione scende sotto il debito, l'errore è:
   - "You are in debt. A trade cannot cut into what you can pay back. Ask for more in return, or give less."
   - per la controparte: "<name> is in debt. A trade cannot cut into what they can pay back. Offer them more, or take less."

   Valore di liquidazione = metà prezzo delle proprietà non ipotecate + metà valore edifici + $50 per Pardon card. Eccezione: scambi **con il proprio creditore** (o tra compagni di squadra).
2. **Scambio troppo sbilanciato: "This trade is too one-sided."** Scatta se un giocatore cede, al netto di ciò che riceve, più del **90% del proprio patrimonio netto più il debito**. Valori usati: soldi, prezzo pieno delle proprietà non ipotecate, $50 per Pardon card. **Questa regola NON vale nelle stanze private** né tra compagni di squadra.

Il blog spiega lo scopo: *"A player about to lose hands their whole empire to a friend… That's over. You can still sell, still raise money, still accept a rescue gift. You just can't give the game away."* [BLOG]

### Limiti quantitativi
- Al massimo **10 scambi aperti creati da te** contemporaneamente. Oltre, il pulsante si disabilita: "You can't have more than 10 open trades created by you at the same time."
- Al massimo **5 offerte pendenti verso lo stesso giocatore**: "They already have 5 pending offers from you. Wait for them to respond."
- Si possono avere **più scambi aperti in parallelo** con giocatori diversi; tutti compaiono nella lista "Trades".

### Risposta e contro-offerta
- Il destinatario riceve un suono e **il modale gli si apre da solo** sullo scambio, titolo "View trade".
- Il destinatario vede tre pulsanti:
  - **"Confirm"** (verde): accetta. Il motore ricontrolla la validità.
  - **"Decline"** (rosso): rifiuta.
  - **"Negotiate"**: apre una contro-offerta modificabile con le parti invertite. Inviarla con "Send trade" **sostituisce** lo scambio originale. Il titolo diventa "(negotiation #N)" e il contatore cresce a ogni giro. Può rinegoziare solo chi partecipa allo scambio ("You cannot renegotiate a trade you are not a part of.").
- Il creatore vede **"Delete trade"** (annulla). **Non si può modificare** uno scambio già inviato: si cancella e se ne crea un altro, oppure si passa da una negoziazione. [DEDOTTO]
- Gli altri giocatori possono aprire e guardare gli scambi altrui (sola lettura).
  - Un'icona a occhio indica chi sta guardando.
  - Le icone "matita" mostrano chi sta creando uno scambio.
  - Nella barra di stato compaiono: "is creating a trade...", "is looking at a trade...", "is negotiating a trade...".
- Esecuzione all'accettazione: passano i soldi in entrambe le direzioni e le proprietà cambiano proprietario (senza edifici, l'ipoteca resta). Passano anche le Pardon card.
  - Se chi riceve soldi ha un debito agganciato, il denaro va prima al suo creditore (vedi §9).

### Notifiche nel registro (log)
- "<A> created a trade with <B>" e, per le negoziazioni, "<A> filed a negotiation with <B>". [DEDOTTO dalla composizione dei frammenti]
- "<B> accepted a trade created by <A>"
- "<B> declined a trade created by <A>"
- "<A> canceled the trade with <B>"
- La parola "trade" nel log è cliccabile e apre il dettaglio con i saldi al momento dell'esecuzione.
- Suoni dedicati: `trade-accept`, `trade-decline`, nuovo trade per me, nuovo trade tra altri.

### Pulizia automatica
- Se un giocatore va in bancarotta o esce, **tutti i suoi scambi pendenti vengono eliminati**.
- A fine partita il modale si chiude.

---

## 5. Ipoteche e riscatto [CODICE]

- Disponibili **solo con l'impostazione Mortgage attiva** (default OFF). Senza, la sezione non compare sulla carta della proprietà.
- **Valore d'ipoteca** = `floor(prezzo / 2)`. Pulsante **"Mortgage for $X"**.
  - Tooltip: "You can mortgage **<name>** and get **$X** from the bank, but players landing on this property won't pay you rent."
- **Riscatto** = `floor(valore ipoteca × 1.1)`, cioè il 110% (interesse del 10%). La carta mostra l'etichetta "Mortgaged" e il pulsante **"Get back for $Y"**.
  - Tooltip: "You can lift the mortgage and get <name> back, but it will cost $Y. (110% of the mortgage revenue)"
- Vincoli:
  - Solo nel **proprio turno** ("It's not your turn").
  - Non si ipoteca una proprietà di un set con edifici: "You can't mortgage properties of a set that has buildings in it".
  - Per riscattare servono i contanti: "You don't have enough money to lift the mortgage".
  - Errori del motore: "This property is already mortgaged", "This property is not mortgaged.".
- Effetti:
  - **Nessun affitto** sulla proprietà ipotecata.
  - Aeroporti e compagnie ipotecati **non contano** nel numero posseduto che fa salire l'affitto degli altri.
  - **Non si costruisce** in un set che contiene una città ipotecata: "You can't upgrade properties in sets that have mortgaged properties in them".
  - Il **doppio affitto da set completo resta valido** sulle città non ipotecate anche se una del set è ipotecata: il controllo guarda solo chi possiede le città.
  - Nel patrimonio netto una proprietà ipotecata vale $0.
- Log: "<player> mortgaged <property> for $X", "<player> lifted the mortgage of <property> for $Y".
- Esempi sulla mappa classica: Salvador $60 → ipoteca $30, riscatto $33. New York $400 → $200 / $220. Aeroporto $200 → $100 / $110. Compagnia $150 → $75 / $82. Tabella completa nell'Appendice A.

---

## 6. Case e hotel [CODICE]

- **Requisito**: possedere **tutte le città del paese** (set). Errore: "You must own every city of the country in order to start building houses and hotels." In modalità Teams vale il set posseduto dalla squadra. [BLOG] [CODICE]
- Altri vincoli:
  - nessuna città del set ipotecata;
  - livello massimo = hotel;
  - **solo nel proprio turno** ("You can only upgrade properties on your turn").
  - Non serve aver già tirato i dadi: il motore non lo richiede. [DEDOTTO]
- **Livelli**: 0 = solo terreno ("rent"), 1–4 case, 5 = hotel. L'hotel si costruisce sopra 4 case, quindi ogni città passa per 5 acquisti.
- **Costi**: casa = `housePrice`, hotel = `hotelPrice`. Sulla mappa classica sono uguali: $50 per Brasile e Israele, $100 per Italia e Germania, $150 per Cina e Francia, $200 per Regno Unito e USA.
- **Costruzione uniforme (Even build, default ON)**:
  - si alza una città al livello L+1 solo se tutte le altre del set sono a L o L+1 ("You have to evenly upgrade properties in this set");
  - per demolire, le altre devono essere a L o L−1 ("You have to evenly downgrade properties in this set").
  - Con Even build OFF non ci sono vincoli di uniformità.
- **Nessun limite di scorta** della banca (niente 32 case / 12 hotel): il motore non conta gli edifici disponibili.
- **Demolizione (downgrade)** un livello alla volta, solo nel proprio turno. **Rimborso = metà**: casa → `housePrice/2`; hotel → 4 case con rimborso `hotelPrice/2`.
- **UI**: si clicca una casella sul tabellone, oppure una voce in "My properties (N)" (hint "Click on a property to upgrade, downgrade or sell it."). Si apre la carta della proprietà con:
  - bandiera del paese, nome, eventuale sezione Mortgage;
  - tabella "when / get": "with rent", "with one house", "with two houses", "with three houses", "with four houses", "with a hotel", con il livello attuale evidenziato;
  - Owner, Price, costo casa, costo hotel;
  - per il proprietario, tre pulsanti a icona:
    - ↑ "Upgrade to one house for $50"
    - ↓ "Downgrade to rent for $25"
    - cestino "Sell for $30"
- Motivi di disabilitazione (tooltip):
  - "You must own all properties in this set in order to start building houses and hotels"
  - "You have reached the maximum level of this property"
  - "You don't have enough money to upgrade this property"
  - "The property is at its lowest level"
  - "You can only downgrade properties on your turn"
- Log: "<player> bought a house in <city>", "bought a hotel in", "<player> destroyed a house in <city>", "destroyed a hotel".
- Carte che costano in base agli edifici: "Pay $25 for each house and $100 for each hotel" e "Pay $30 per house and $120 per hotel you own".

---

## 7. Affitti: formule [CODICE]

L'affitto si paga automaticamente quando si atterra.

**Nessun affitto se:**
- la casella è ipotecata;
- il proprietario è chi atterra o un suo compagno di squadra;
- l'opzione "Don't collect rent while in prison" è attiva e il proprietario è in prigione.

| Tipo | Formula |
|---|---|
| **Città** | `rentPrices[livello]`. A livello 0, **se attiva "x2 rent on full-set properties"** e il proprietario ha il set completo: ×2. **Senza l'opzione il set completo NON raddoppia** (diverso dal Monopoly classico). |
| **Aeroporti** | $25 / $50 / $100 / $200 con 1 / 2 / 3 / 4 aeroporti **non ipotecati** dello stesso proprietario (o squadra). |
| **Compagnie** | somma dei dadi × **4** (1 compagnia), × **10** (2), × **20** (3, nelle mappe con 3 compagnie). Contano solo quelle non ipotecate. |

- Testi della carta aeroporto: "one airport is owned", "2 airports are owned"…
- Testi della carta compagnia: "If one company is owned, get $4 x 🎲", "If two companies are owned, get $10 x 🎲".
- Altri flussi di denaro utili per i test:
  - **Earnings Tax = 10% dei contanti** del giocatore, arrotondato. **Premium Tax = $75**.
  - Uscita di prigione a pagamento **$50**.
  - Start: $300 se ci si ferma, $200 se si passa.
  - Con "Vacation cash", tasse, carte "Pay" e riparazioni finiscono in una cassa che incassa chi atterra su Vacation. Log: "will spend a turn while on vacation. $X withdrawn."
- Log del pagamento: "<A> paid $X to <B>".

---

## 8. Vendita di proprietà alla banca [CODICE]

- Pulsante cestino, **"Sell for $<prezzo/2>"**. Solo nel proprio turno.
- Vietato se nel paese ci sono edifici: "Sell all buildings in this country before selling the property" (motore: "You can't sell a property if its set has buildings on it. Downgrade them first.").
- Proprietà **ipotecata**: tooltip "Sell property — You won't get payback because the property is mortgaged." Si incassa **$0**, ma la proprietà torna libera e senza ipoteca.
- La proprietà torna alla banca e si può ricomprare. Log: "<player> sold <property>".
- È disponibile **anche senza l'opzione Mortgage**: è la principale fonte di liquidità di default.

---

## 9. Debito e bancarotta

### Come nasce il debito [CODICE]
- **Verso un giocatore (affitto)**: se l'affitto supera i contanti, il pagatore va in **negativo** e il proprietario riceve subito i contanti positivi che c'erano. Il pagatore resta "agganciato" al creditore (`debtTo`). **Ogni entrata successiva** del debitore va prima al creditore, finché il debito è saldato: Start, carte, vendite, ipoteche, soldi ricevuti in uno scambio. Se il debitore contrae un nuovo debito d'affitto, l'aggancio passa al nuovo creditore. [DEDOTTO dal codice: `debtTo` viene sovrascritto]
- **Verso la banca** (tasse, carte "Pay", riparazioni): il saldo va in negativo senza creditore.
- **Carte "Pay each player" / "Collect from every player"**: il pagatore può andare in negativo, ma **senza** aggancio di debito. [CODICE] È un caso limite.

### Cosa può fare chi è in negativo
- **Non può finire il turno**: "End turn" e "Roll again" sono disabilitati con il tooltip "You can't end your turn with a negative amount of money. Sell properties or trade with other players."
- Per tornare a ≥ $0 può: demolire edifici (metà rimborso), vendere proprietà alla banca (metà prezzo), ipotecare (se l'opzione è attiva), scambiare (con le regole del §4), oppure dichiarare bancarotta.
- Con il Turn Clock la finestra di tempo si allarga: grazia di **60 s** invece di 20 s quando si è in debito. [CODICE] Il blog conferma: "Land in debt you can't cover and your window widens on its own." [BLOG]

### Bancarotta volontaria
- Il pulsante **"Bankrupt"** sta nel pannello azioni del giocatore, accanto a Votekick, ed è sempre disponibile a partita in corso, anche fuori turno. [CODICE]
- Si apre il modale **"File your bankruptcy"**:
  - "Are you sure you want to bankrupt?"
  - (partita normale) **"You will lose all your money and purchased properties!"**
  - "This cannot be undone."
  - Pulsante di conferma: **"Bankrupt"**.

  In modalità Teams il secondo testo cambia:
  - senza debito: "Your cash, properties, and pardon cards will transfer to your teammates."
  - con debito: "Your estate will be liquidated to pay your debt. Any remaining cash goes to your teammates. Unsold properties return to the bank."

### Dove finiscono soldi e proprietà (partita senza squadre) [CODICE]
1. Se c'è un creditore ancora in gioco, la **banca gli paga** `min(valore di liquidazione, debito)`. Liquidazione = metà prezzo delle proprietà non ipotecate + metà valore degli edifici + $50 per Pardon card. Il blog descrive così questa logica: "the game attempts to use the owned assets of the bankrupted player to cover up the debt". [BLOG]
2. **Tutte le proprietà tornano alla banca**: senza proprietario, **senza ipoteca**, **senza edifici**, di nuovo acquistabili. **Il creditore non riceve le proprietà.**
3. Le Pardon card tornano ai rispettivi mazzi.
4. Gli scambi pendenti del giocatore vengono cancellati e la sua pedina esce dal tabellone.
5. Se era il suo turno, il turno passa al successivo.
6. Il giocatore resta nella lista come eliminato e la classifica registra il turno in cui è uscito ("Turns survived").

Log: **"<player> went bankrupt and lost all purchased properties."** (in Teams: "<player> went bankrupt.").

### In modalità Teams [CODICE] [BLOG]
- Senza debito, contanti positivi, proprietà (anche ipotecate) e Pardon card passano a un compagno vivo. Il log usa la formula "<B> … inherited from <A>": elenca $, proprietà con "(mortgaged)" e "pardon card". [CODICE, ordine esatto delle parole non verificato]
- Con un debito verso un giocatore: patrimonio liquidato, il creditore riceve fino al debito, l'eventuale resto va in contanti al compagno, le proprietà tornano alla banca.

### Abbandono e rimozione [CODICE] [BLOG]
- Non esiste un pulsante "Surrender" diverso da "Bankrupt". Chi lascia la stanza a metà partita subisce lo stesso trattamento: liquidazione per il creditore, beni alla banca. In più viene tolto dalla lista. Log: "<player> left the game".
- **Turn Clock**: allo scadere della riserva il sistema tira i dadi e finisce il turno al posto tuo, ma non offre né ipoteca. Dopo **2 turni gestiti in automatico** il giocatore viene rimosso e le sue proprietà tornano alla banca. Log: "<player> was removed from the game after running out of time."
  - Il server può anche avviare in automatico un'asta o una bancarotta per conto del giocatore. [DEDOTTO: queste azioni compaiono tra quelle "serverInitiated"]
- Votekick, kick dell'host, karma ("Leaving or timing out costs 1 karma.") riguardano soprattutto l'area lobby/moderazione.

### Cosa vede chi è eliminato
- **Bancarotta**: resta nella stanza come partecipante eliminato e vede la partita fino alla fine, a quanto risulta senza azioni di gioco. [DEDOTTO: il modello mantiene il giocatore con `bankruptedAt`; il pulsante Bankrupt resta disabilitato]
- **Rimosso per tempo o assenza**: overlay **"Your time ran out"** ("You were removed to keep the game moving. You can head back or stay and watch how it ends.") oppure **"You lost your seat"** ("Your seat was removed while you were away. You can head back or stay and watch how it ends."). Pulsanti: **"Keep watching"** (resta come spettatore) e **"Back to home"**. [CODICE]
- **Kick**: "You have been kicked out of the game."
- Spettatori: "Only game players can send chat messages". Se un bancarottiere possa ancora scrivere in chat: [NON VERIFICATO].

---

## 10. Fine partita

### Condizione di vittoria
- L'evento `game-ended` con `winnerId` è deciso dal **server**. Il motore client applica solo `end-game`.
- [DEDOTTO, conforme al blog Teams] La partita finisce quando resta **un solo giocatore attivo**, o **una sola squadra** ("The last team standing wins together").
- `winnerId` può essere `null`: partita chiusa senza vincitore, per esempio se escono tutti. [CODICE]
- Non ho trovato vittorie a tempo o per patrimonio. [NON VERIFICATO]

### Schermata di fine [CODICE]
- Overlay sul tabellone: icona, **"Game over!"**, poi **"and the winner is..."** con il nome (oppure "and the winning team is..." con nome ed emoji della squadra). Coriandoli e suono di vittoria per il vincitore, suono di sconfitta per gli altri.
- Azioni:
  - **"Another game"**: l'host riavvia la stanza (`room-restart`); gli altri vedono "Waiting for host..." finché l'host non lo fa. [DEDOTTO] Si torna alla lobby della stessa stanza con le stesse impostazioni. [NON VERIFICATO]
  - **"Back to lobby"**: torna alla home (`/`).
  - **"Share with friends"**: Facebook, X/Twitter, WhatsApp, Telegram, con testo "I just won first place in Richup.io. Can you beat that?" oppure "I just finished a game in Richup.io. For how long can you survive?".
- Toast per gli ospiti non loggati: "Log in to keep your name and save your games". Al vincitore: "You earned a coin for this win" con il pulsante "Log in to claim it". Login e negozio non servono per PoorDown.

### Statistiche finali [CODICE]
- Nel pannello di destra, sezione **"Game statistics"**.
  - **"Leaderboard"**: tabella "#", "Player", "Turns survived", con una barra proporzionale ai turni; per il vincitore la barra dice "winner".
  - Pulsante **"View all statistics"**.
- Il modale delle statistiche complete (pulsante "Back to board") contiene:
  - **"Net worth over time"**: grafico del patrimonio netto a ogni turno, con interruttore Players/Teams in modalità squadre;
  - **"Winner"** o "Winning team";
  - **"Duration"**, **"Turns"**, **"Doubles"**, **"Trades"**, **"Chat messages"**;
  - **"Most visited property"** (o "tile");
  - **"Most times in prison"** (con "one visit" / "N visits").
- **Formula del patrimonio netto** (grafico e regole sugli scambi): contanti + prezzo delle proprietà **non ipotecate** + edifici (case × costo casa; hotel = 4 × costo casa + costo hotel) + $50 per Pardon card.

---

## 11. Casi limite (dal codice)

- **Asta senza offerte** → la proprietà resta della banca. **Vincitore rimasto senza soldi** a fine asta (per esempio dopo uno scambio fatto nel frattempo) → nessuna vendita.
- **Asta e scambi in parallelo**: nulla nel motore li impedisce. [DEDOTTO]
- **Il creditore è già in bancarotta o uscito** quando il debitore fallisce → nessuno riceve il recupero.
- **Debito verso la banca** → in bancarotta nessuno riceve nulla; le proprietà tornano alla banca.
- **Scambio accettato da un debitore** → i soldi che riceve vanno prima al suo creditore.
- **Scambio diventato invalido** nel frattempo (soldi spesi, proprietà vendute o ipotecate, edifici costruiti nel set) → "This trade cannot be made." e Confirm disabilitato.
- **Doppio affitto con set completo** → solo sul terreno base (livello 0), mai su case o hotel.
- **Proprietà venduta alla banca o di un bancarottiere** → l'ipoteca viene azzerata: chi la ricompra la riceve pulita.
- **Hotel demolito** → si torna a 4 case e il rimborso è metà del costo hotel. Nella liquidazione per bancarotta un hotel vale (4 × casa + hotel) / 2.
- **Quantità di soldi negli scambi** → arrotondata all'intero inferiore; la nota viene troncata a 200 caratteri.
- **Stanze private** → la regola "too one-sided" non si applica, quindi tra amici sono possibili regali sbilanciati. La regola sul debitore invece vale anche nelle private.

---

## 12. Dubbi e cose da verificare dal vivo

Servono una o due partite giocate da un umano in un browser normale, per esempio 2 giocatori, $500 iniziali, Auction e Mortgage ON.

1. Tutto l'aspetto visivo dei modali Auction, Trade e carta proprietà: nessuno screenshot di gioco disponibile.
2. Che la scadenza dell'asta torni a 10 s a ogni rilancio, e il comportamento con offerte simultanee.
3. Che la prima offerta minima sia davvero $4 (asta che parte da $2).
4. Che gli scambi si possano proporre e accettare anche fuori dal proprio turno e durante un'asta.
5. Che costruire sia permesso prima di tirare i dadi, nel proprio turno.
6. Cosa vede esattamente un giocatore in bancarotta (chat, pannelli) e se gli compare un overlay dedicato.
7. Cosa fa "Another game" (stessa stanza e impostazioni? torna la lobby?).
8. Condizione di vittoria lato server ed eventuali partite senza vincitore.
9. Come si comporta il Turn Clock con il debito (bancarotta automatica?) e quali tempi esatti si vedono a schermo.

---

## 13. Screenshot salvati (`docs/analisi/img/`)

- `a4-cloudflare-turnstile.png`: la stanza privata ferma su "Loading game..." con il controllo Cloudflare "Verify you are human" che ha bloccato l'analisi dal vivo.
- `a4-home-how-to-play.png`: home page (nickname, "Play", "All rooms", "Create a private game").

---

## Appendice A · Mappa classica: valori economici [CODICE]

Ipoteca = floor(prezzo/2); Riscatto = floor(ipoteca × 1.1); Vendita alla banca = prezzo/2. Casa e hotel costano uguale su questa mappa.

| Paese | Città | Prezzo | Base | 1 casa | 2 case | 3 case | 4 case | Hotel | Casa/Hotel | Ipoteca | Riscatto | Vendita |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Brasile | Salvador | $60 | $2 | $10 | $30 | $90 | $150 | $240 | $50 | $30 | $33 | $30 |
| Brasile | Rio | $60 | $4 | $20 | $60 | $190 | $330 | $460 | $50 | $30 | $33 | $30 |
| Israele | Tel Aviv | $100 | $6 | $30 | $90 | $260 | $380 | $540 | $50 | $50 | $55 | $50 |
| Israele | Haifa | $110 | $6 | $30 | $90 | $280 | $400 | $560 | $50 | $55 | $60 | $55 |
| Israele | Jerusalem | $120 | $8 | $40 | $110 | $300 | $460 | $610 | $50 | $60 | $66 | $60 |
| Italia | Venice | $130 | $10 | $50 | $140 | $440 | $600 | $740 | $100 | $65 | $71 | $65 |
| Italia | Milan | $140 | $10 | $50 | $160 | $460 | $630 | $760 | $100 | $70 | $77 | $70 |
| Italia | Rome | $160 | $12 | $60 | $180 | $500 | $700 | $900 | $100 | $80 | $88 | $80 |
| Germania | Frankfurt | $180 | $14 | $70 | $190 | $540 | $760 | $950 | $100 | $90 | $99 | $90 |
| Germania | Munich | $190 | $15 | $70 | $210 | $560 | $760 | $960 | $100 | $95 | $104 | $95 |
| Germania | Berlin | $200 | $15 | $80 | $220 | $600 | $780 | $1000 | $100 | $100 | $110 | $100 |
| Cina | Shenzhen | $210 | $18 | $90 | $240 | $680 | $850 | $1000 | $150 | $105 | $115 | $105 |
| Cina | Beijing | $220 | $20 | $90 | $260 | $710 | $900 | $1100 | $150 | $110 | $121 | $110 |
| Cina | Shanghai | $240 | $20 | $100 | $290 | $740 | $920 | $1100 | $150 | $120 | $132 | $120 |
| Francia | Lyon | $260 | $20 | $100 | $320 | $800 | $950 | $1100 | $150 | $130 | $143 | $130 |
| Francia | Toulouse | $270 | $20 | $120 | $350 | $825 | $1000 | $1150 | $150 | $135 | $148 | $135 |
| Francia | Paris | $280 | $25 | $120 | $350 | $850 | $1000 | $1200 | $150 | $140 | $154 | $140 |
| Regno Unito | Liverpool | $290 | $25 | $120 | $380 | $850 | $1050 | $1250 | $200 | $145 | $159 | $145 |
| Regno Unito | Manchester | $300 | $26 | $140 | $400 | $950 | $1150 | $1300 | $200 | $150 | $165 | $150 |
| Regno Unito | London | $320 | $30 | $140 | $440 | $1000 | $1200 | $1400 | $200 | $160 | $176 | $160 |
| USA | San Francisco | $360 | $35 | $180 | $550 | $1150 | $1350 | $1525 | $200 | $180 | $198 | $180 |
| USA | New York | $400 | $50 | $200 | $600 | $1400 | $1700 | $2000 | $200 | $200 | $220 | $200 |

- **Aeroporti** (TLV, MUC, CDG, JFK): prezzo $200; affitto 25/50/100/200; ipoteca $100; riscatto $110; vendita $100.
- **Compagnie** (Power Company, Water Company): prezzo $150; affitto dadi × 4 o × 10; ipoteca $75; riscatto $82; vendita $75.
- Caselle speciali: Earnings Tax 10% dei contanti; Premium Tax $75; prigione 3 turni (uscita $50, Pardon card o doppio); Vacation 1 turno.

## Appendice B · Azioni ed eventi del motore (riferimento per l'implementazione) [CODICE]

- Azioni economiche: `purchase-property`, `pass-property`, `start-auction`, `place-bid`, `end-auction`, `upgrade-city`, `downgrade-city`, `mortgage-property`, `unmortgage-property`, `sell-property`, `propose-trade` (con `negotiatedTradeId` per le contro-offerte), `accept-trade`, `reject-trade`, `cancel-trade`, `set-trade-watch-state`, `set-trade-creator-state`, `player-bankrupt`, `end-game`.
- Eventi di log: `auction-started`, `bid-placed`, `auction-won`, `auction-ended-no-bids`, `property-upgraded`, `property-downgraded`, `property-mortgaged`, `property-unmortgaged`, `property-sold`, `player-paid-player`, `trade-proposed`, `trade-accepted`, `trade-rejected`, `trade-cancelled`, `player-bankrupted`, `team-assets-transferred`, `game-ended`.
- Struttura di uno scambio: `{ id, initiatorId, recipientId, status: "pending", negotiationCount, watcherIds[], note (≤200), initiatorOffer, recipientOffer }`, dove ogni offerta è `{ money, propertyIndices[], mortgagedPropertiesIndexes[], pardonCards["treasure"|"surprise"] }`.
- Costanti: incrementi d'asta `[2, 10, 100]`; durata asta 10 s; offerta iniziale $2; max 10 scambi aperti per creatore; max 5 offerte pendenti verso lo stesso destinatario; soglia "one-sided" 90%; valore Pardon card $50; interesse sul riscatto 10%.
