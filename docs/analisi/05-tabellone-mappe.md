# 05 - Tabellone e mappe di richup.io (riferimento di bilanciamento per PoorDown)

> Scopo: avere struttura e valori economici di richup.io come base di bilanciamento. Nomi di città, aziende e testi delle carte sono quelli di richup: in PoorDown vanno sostituiti con nomi e testi nostri.
> Dati strutturati completi: [`board-data.json`](./board-data.json) (mappe, caselle con tutti i campi, gruppi, carte, regole economiche).

## Legenda delle fonti

| Etichetta | Significato |
|---|---|
| **VERIFICATO** | Osservato direttamente nell'interfaccia o in una partita privata di prova |
| **CODICE** | Estratto dal bundle JavaScript pubblico di richup (il motore di gioco gira anche lato client) |
| **DEDOTTO** | Ragionamento o confronto nostro, non confermato da richup |

## Come sono stati raccolti i dati

1. **CODICE**: il chunk `assets/confetti.module-Dt3tsJBH.js` contiene il motore di gioco completo: le 4 "map factory" (`classic`, `mr-worldwide`, `death-valley`, `lucky-wheel`) con caselle, prezzi, affitti, mazzi di carte, e le funzioni di regola (affitti, ipoteca, tasse, prigione, vacanza, costruzione). I dati sono stati letti con un parser statico (il codice scaricato non è stato eseguito).
2. **VERIFICATO (UI)**: in una stanza privata, dalla finestra "Board Maps" ho aperto la *Board preview* di ogni mappa e cliccato tutte le caselle. Le schede (prezzo, 6 livelli di affitto, costo casa/hotel, affitti aeroporti, aziende) di **tutte le 111 caselle acquistabili** delle 4 mappe coincidono al 100% con i dati del codice.
3. **VERIFICATO (API)**: `GET /api/game/maps` restituisce le 4 mappe; `GET /api/store` dà prezzo e descrizione delle mappe premium.
4. **VERIFICATO (partita)**: partita privata a 2 giocatori (due sessioni del browser), mappa Classic, con Mortgage e Vacation cash attivi, circa 30 giri. Osservati acquisti, affitti base, Via, tasse fisse, prigione, vacanza, piatto vacanza e carte (dettagli in fondo).

Nota tecnica: in modalità headless la stanza resta su "Loading game..." (Cloudflare Turnstile non passa). Con il browser visibile (headed) funziona tutto.

---

## 1. Mappe disponibili

| Mappa | id | Caselle | Costo | Descrizione store | In cosa differisce |
|---|---|---|---|---|---|
| **Classic** | `classic` | 40 (10 per lato) | Gratis (default) | - | 22 città in 8 set (2-3-3-3-3-3-3-2), 4 aeroporti, 2 aziende, 6 caselle carta, 2 tasse. Scala affitti "addolcita" propria di richup |
| **Mr. Worldwide** | `mr-worldwide` | **48** (12 per lato) | 180 monete (premium) | "The world is wide enough for both Hamilton and you!" | 28 città in 10 set (da 2 a 4 città: Italia e UK da 4), **3 aziende** (+Gas Company, si attiva il moltiplicatore x20), 7 caselle carta. Giro più lungo, quindi passi dal Via meno spesso |
| **Death Valley** | `death-valley` | 40 | 180 monete (premium) | "Each side of the board is a full property set. Be careful with your landings." | **Solo 4 set enormi, uno per lato** (Canada 5, Germania 6, UK 6, USA 5). Completare un set è difficile; un set completo domina un lato intero |
| **Lucky Wheel** | `lucky-wheel` | 40 | 180 monete (premium) | "Wish for the best and hope today is your lucky day." | Città solo sui lati 1 e 3 (16 città, 8 set da 2), **lati 2 e 4 quasi solo carte e tasse** (6 Treasure, 6 Surprise, 2 Premium Tax, 1 Earnings Tax, **1 Tax Refund +$50**), **nessuna azienda**, 20 carte Surprise |

- Tutte le mappe hanno: Via (atterraggio esatto +$300, passaggio +$200), Prigione all'indice 10 (12 su Mr. Worldwide), Vacanza a 20 (24), Vai in prigione a 30 (36). **CODICE + VERIFICATO**
- Le mappe premium si possono solo vedere in anteprima senza acquisto (pulsante "Buy" verso `/store/board-maps`). **VERIFICATO**
- I set sono identificati da **paese/bandiera**, non da un colore. **VERIFICATO** (UI) + **CODICE** (`countryId`)
- Confronto (**DEDOTTO**): Mr. Worldwide, Death Valley e Lucky Wheel riusano la scala affitti standard del Monopoly (60 -> 2/10/30/90/160/250 ... 400 -> 50/200/600/1400/1700/2000). La Classic invece ha prezzi e affitti ritoccati (es. Haifa 110, Venice 130, San Francisco 360; Salvador 2/10/30/90/150/240). Per un gioco originale conviene costruire una scala nostra, partendo dalle proporzioni qui sotto.

---

## 2. Regole economiche del tabellone (comuni a tutte le mappe)

| Elemento | Regola | Fonte |
|---|---|---|
| Contante iniziale | $1500 di default; opzioni 500, 1000, 1500, 2000, 2500, 3000 | VERIFICATO |
| Via (Start) | Atterraggio esatto **+$300**, passaggio **+$200** (per ogni giro completato). Le carte "Advance to X" danno +$200 se passi dal Via; "Advance to Start" conta come atterraggio (+$300). "Go back N steps" non paga mai il Via | VERIFICATO (+200, +300) / CODICE |
| Affitto città | `rentPrices[livello]`, livelli 0 = terreno, 1-4 = case, 5 = hotel. Con la regola "x2 rent on full-set" (default OFF) l'affitto **base** (livello 0) raddoppia se il proprietario ha tutto il set. Ipotecata = 0 | VERIFICATO (affitti base) / CODICE |
| Costruzione | Serve il set completo e nessuna proprietà del set ipotecata. Livelli 1-4 costano `housePrice`, il livello 5 (hotel) costa `hotelPrice` (uguale al prezzo casa in tutte le mappe). "Even build" (default ON) obbliga a costruire in modo uniforme. Nessun limite di case in banca | CODICE + UI |
| Vendita edifici | Casa: rimborso `housePrice/2`; hotel: rimborso `hotelPrice/2` (torna a 4 case) | CODICE |
| Aeroporti | Prezzo $200; affitto in base agli aeroporti **non ipotecati** del proprietario: **25 / 50 / 100 / 200** | VERIFICATO (scheda) / CODICE |
| Aziende | Prezzo $150; affitto = **somma dei dadi x 4** (1 azienda), **x10** (2), **x20** (3, solo Mr. Worldwide) | VERIFICATO (scheda) / CODICE |
| Earnings Tax | Paghi il **10% del contante attuale** (arrotondato). La casella mostra "%10" | UI + CODICE |
| Premium Tax | Paghi **$75** fissi | VERIFICATO |
| Tax Refund | Ricevi **$50** (solo Lucky Wheel) | CODICE |
| Ipoteca | Richiede la regola "Mortgage" (default OFF). Valore = `floor(prezzo/2)`; riscatto = `floor(floor(prezzo/2) x 1.1)`. Non si ipoteca se il set ha edifici | VERIFICATO (Haifa 110 -> +55, riscatto 60) / CODICE |
| Vendita alla banca | Una proprietà si può rivendere alla banca a `prezzo/2` (0 se ipotecata), solo se il set non ha edifici | CODICE (pulsante "Sell for $X") |
| Prigione | Massimo 3 turni. Esci con un doppio (e ti muovi di quel tiro), pagando **$50** o con una carta Pardon. Al 3° tiro fallito sei libero senza pagare ma non ti muovi in quel turno. 3 doppi di fila = prigione. Regola opzionale: niente affitti a chi è in prigione | VERIFICATO / CODICE |
| Vacanza | Salti il turno successivo. Con "Vacation cash" (default OFF) incassi il piatto: tutte le **tasse**, le **carte a pagamento** e le **riparazioni** pagate alla banca (non gli affitti) | VERIFICATO ($260 accumulati = 75+75+50+60; "$410 withdrawn") |
| Carte | Due mazzi (Treasure, Surprise), mescolati a inizio partita e pescati in ciclo; la carta Pardon viene saltata finché qualcuno la possiede | CODICE |
| Asta | Opzionale (default OFF): se il giocatore non compra, la proprietà va all'asta; rilanci rapidi +$2 / +$10 / +$100 | CODICE |
| Patrimonio netto | Contante + prezzo pieno delle proprietà non ipotecate + costo degli edifici + $50 per carta Pardon | CODICE |

---

## 3. Caselle per mappa

Colonne: *Base x2 set* = affitto base con la regola x2 attiva e set completo; *Casa* e *Hotel costo* = prezzo di costruzione; *Ipoteca* = `floor(prezzo/2)`; *Riscatto* = `floor(ipoteca x 1.1)`. Per gli aeroporti la colonna Base riporta l'affitto con 1/2/3/4 aeroporti posseduti. Tutti i valori di prezzo/affitto/costruzione sono **VERIFICATI** nella Board preview; ipoteca e riscatto sono calcolati con la formula del **CODICE** (verificata su Haifa).

### Classic (`classic`) - 40 caselle

| # | Tipo | Nome | Gruppo | Prezzo | Base | Base x2 set | 1 casa | 2 case | 3 case | 4 case | Hotel | Casa | Hotel costo | Ipoteca | Riscatto |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0 | Angolo | Start |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 1 | Città | Salvador | brazil | 60 | 2 | 4 | 10 | 30 | 90 | 150 | 240 | 50 | 50 | 30 | 33 |
| 2 | Treasure (carta) | Treasure |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 3 | Città | Rio | brazil | 60 | 4 | 8 | 20 | 60 | 190 | 330 | 460 | 50 | 50 | 30 | 33 |
| 4 | Tassa % (Earnings Tax) | Earnings Tax - 10% del contante |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 5 | Aeroporto | TLV Airport | aeroporti | 200 | 1:25 / 2:50 / 3:100 / 4:200 |  |  |  |  |  |  |  |  | 100 | 110 |
| 6 | Città | Tel Aviv | israel | 100 | 6 | 12 | 30 | 90 | 260 | 380 | 540 | 50 | 50 | 50 | 55 |
| 7 | Città | Haifa | israel | 110 | 6 | 12 | 30 | 90 | 280 | 400 | 560 | 50 | 50 | 55 | 60 |
| 8 | Surprise (carta) | Surprise |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 9 | Città | Jerusalem | israel | 120 | 8 | 16 | 40 | 110 | 300 | 460 | 610 | 50 | 50 | 60 | 66 |
| 10 | Angolo | Prison (Prigione / di passaggio) |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 11 | Città | Venice | italy | 130 | 10 | 20 | 50 | 140 | 440 | 600 | 740 | 100 | 100 | 65 | 71 |
| 12 | Azienda | Power Company (electricity) | aziende | 150 | dadi x4 / x10 / x20 |  |  |  |  |  |  |  |  | 75 | 82 |
| 13 | Città | Milan | italy | 140 | 10 | 20 | 50 | 160 | 460 | 630 | 760 | 100 | 100 | 70 | 77 |
| 14 | Città | Rome | italy | 160 | 12 | 24 | 60 | 180 | 500 | 700 | 900 | 100 | 100 | 80 | 88 |
| 15 | Aeroporto | MUC Airport | aeroporti | 200 | 1:25 / 2:50 / 3:100 / 4:200 |  |  |  |  |  |  |  |  | 100 | 110 |
| 16 | Città | Frankfurt | germany | 180 | 14 | 28 | 70 | 190 | 540 | 760 | 950 | 100 | 100 | 90 | 99 |
| 17 | Treasure (carta) | Treasure |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 18 | Città | Munich | germany | 190 | 15 | 30 | 70 | 210 | 560 | 760 | 960 | 100 | 100 | 95 | 104 |
| 19 | Città | Berlin | germany | 200 | 15 | 30 | 80 | 220 | 600 | 780 | 1000 | 100 | 100 | 100 | 110 |
| 20 | Angolo | Vacation (Vacanza) |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 21 | Città | Shenzhen | china | 210 | 18 | 36 | 90 | 240 | 680 | 850 | 1000 | 150 | 150 | 105 | 115 |
| 22 | Surprise (carta) | Surprise |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 23 | Città | Beijing | china | 220 | 20 | 40 | 90 | 260 | 710 | 900 | 1100 | 150 | 150 | 110 | 121 |
| 24 | Città | Shanghai | china | 240 | 20 | 40 | 100 | 290 | 740 | 920 | 1100 | 150 | 150 | 120 | 132 |
| 25 | Aeroporto | CDG Airport | aeroporti | 200 | 1:25 / 2:50 / 3:100 / 4:200 |  |  |  |  |  |  |  |  | 100 | 110 |
| 26 | Città | Lyon | france | 260 | 20 | 40 | 100 | 320 | 800 | 950 | 1100 | 150 | 150 | 130 | 143 |
| 27 | Azienda | Water Company (water) | aziende | 150 | dadi x4 / x10 / x20 |  |  |  |  |  |  |  |  | 75 | 82 |
| 28 | Città | Toulouse | france | 270 | 20 | 40 | 120 | 350 | 825 | 1000 | 1150 | 150 | 150 | 135 | 148 |
| 29 | Città | Paris | france | 280 | 25 | 50 | 120 | 350 | 850 | 1000 | 1200 | 150 | 150 | 140 | 154 |
| 30 | Angolo | Go to prison (Vai in prigione) |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 31 | Città | Liverpool | united-kingdom | 290 | 25 | 50 | 120 | 380 | 850 | 1050 | 1250 | 200 | 200 | 145 | 159 |
| 32 | Città | Manchester | united-kingdom | 300 | 26 | 52 | 140 | 400 | 950 | 1150 | 1300 | 200 | 200 | 150 | 165 |
| 33 | Treasure (carta) | Treasure |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 34 | Città | London | united-kingdom | 320 | 30 | 60 | 140 | 440 | 1000 | 1200 | 1400 | 200 | 200 | 160 | 176 |
| 35 | Aeroporto | JFK Airport | aeroporti | 200 | 1:25 / 2:50 / 3:100 / 4:200 |  |  |  |  |  |  |  |  | 100 | 110 |
| 36 | Surprise (carta) | Surprise |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 37 | Città | San Francisco | united-states-of-america | 360 | 35 | 70 | 180 | 550 | 1150 | 1350 | 1525 | 200 | 200 | 180 | 198 |
| 38 | Tassa fissa (Premium Tax) | Premium Tax - paghi $75 |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 39 | Città | New York | united-states-of-america | 400 | 50 | 100 | 200 | 600 | 1400 | 1700 | 2000 | 200 | 200 | 200 | 220 |

**Gruppi (set) di Classic**

| Gruppo | N. citta | Caselle | Prezzo totale | Casa/Hotel | Costo set + 5 livelli su tutte |
|---|---|---|---|---|---|
| brazil | 2 | 1, 3 | 120 | 50/50 | 620 |
| israel | 3 | 6, 7, 9 | 330 | 50/50 | 1080 |
| italy | 3 | 11, 13, 14 | 430 | 100/100 | 1930 |
| germany | 3 | 16, 18, 19 | 570 | 100/100 | 2070 |
| china | 3 | 21, 23, 24 | 670 | 150/150 | 2920 |
| france | 3 | 26, 28, 29 | 810 | 150/150 | 3060 |
| united-kingdom | 3 | 31, 32, 34 | 910 | 200/200 | 3910 |
| united-states-of-america | 2 | 37, 39 | 760 | 200/200 | 2760 |

Conteggio: corner 4, city 22, treasure 3, tax 1, airport 4, surprise 3, company 2, premium-tax 1. Acquistabili: 28 (valore totale $5700).

### Mr. Worldwide (`mr-worldwide`) - 48 caselle

| # | Tipo | Nome | Gruppo | Prezzo | Base | Base x2 set | 1 casa | 2 case | 3 case | 4 case | Hotel | Casa | Hotel costo | Ipoteca | Riscatto |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0 | Angolo | Start |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 1 | Città | Salvador | brazil | 60 | 2 | 4 | 10 | 30 | 90 | 160 | 250 | 50 | 50 | 30 | 33 |
| 2 | Treasure (carta) | Treasure |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 3 | Città | Rio | brazil | 60 | 4 | 8 | 20 | 60 | 180 | 320 | 450 | 50 | 50 | 30 | 33 |
| 4 | Tassa % (Earnings Tax) | Earnings Tax - 10% del contante |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 5 | Città | Tel Aviv | israel | 100 | 6 | 12 | 30 | 90 | 270 | 400 | 550 | 50 | 50 | 50 | 55 |
| 6 | Aeroporto | TLV Airport | aeroporti | 200 | 1:25 / 2:50 / 3:100 / 4:200 |  |  |  |  |  |  |  |  | 100 | 110 |
| 7 | Città | Haifa | israel | 100 | 6 | 12 | 30 | 90 | 270 | 400 | 550 | 50 | 50 | 50 | 55 |
| 8 | Città | Jerusalem | israel | 110 | 8 | 16 | 40 | 100 | 300 | 450 | 600 | 50 | 50 | 55 | 60 |
| 9 | Surprise (carta) | Surprise |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 10 | Città | Mumbai | india | 120 | 8 | 16 | 45 | 120 | 350 | 500 | 650 | 100 | 100 | 60 | 66 |
| 11 | Città | New Delhi | india | 130 | 10 | 20 | 45 | 130 | 400 | 575 | 700 | 100 | 100 | 65 | 71 |
| 12 | Angolo | Prison (Prigione / di passaggio) |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 13 | Città | Venice | italy | 140 | 10 | 20 | 50 | 150 | 450 | 625 | 750 | 100 | 100 | 70 | 77 |
| 14 | Città | Bologna | italy | 140 | 10 | 20 | 50 | 150 | 450 | 625 | 750 | 100 | 100 | 70 | 77 |
| 15 | Azienda | Power Company (electricity) | aziende | 150 | dadi x4 / x10 / x20 |  |  |  |  |  |  |  |  | 75 | 82 |
| 16 | Città | Milan | italy | 160 | 12 | 24 | 60 | 180 | 500 | 700 | 900 | 100 | 100 | 80 | 88 |
| 17 | Città | Rome | italy | 160 | 12 | 24 | 60 | 180 | 500 | 700 | 900 | 100 | 100 | 80 | 88 |
| 18 | Aeroporto | MUC Airport | aeroporti | 200 | 1:25 / 2:50 / 3:100 / 4:200 |  |  |  |  |  |  |  |  | 100 | 110 |
| 19 | Città | Frankfurt | germany | 180 | 14 | 28 | 70 | 200 | 550 | 750 | 950 | 100 | 100 | 90 | 99 |
| 20 | Treasure (carta) | Treasure |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 21 | Città | Munich | germany | 180 | 14 | 28 | 70 | 200 | 550 | 750 | 950 | 100 | 100 | 90 | 99 |
| 22 | Azienda | Gas Company (gas) | aziende | 150 | dadi x4 / x10 / x20 |  |  |  |  |  |  |  |  | 75 | 82 |
| 23 | Città | Berlin | germany | 200 | 16 | 32 | 80 | 220 | 600 | 800 | 1000 | 100 | 100 | 100 | 110 |
| 24 | Angolo | Vacation (Vacanza) |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 25 | Città | Shenzhen | china | 220 | 18 | 36 | 90 | 250 | 700 | 875 | 1050 | 150 | 150 | 110 | 121 |
| 26 | Surprise (carta) | Surprise |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 27 | Città | Beijing | china | 220 | 18 | 36 | 90 | 250 | 700 | 875 | 1050 | 150 | 150 | 110 | 121 |
| 28 | Treasure (carta) | Treasure |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 29 | Città | Shanghai | china | 240 | 20 | 40 | 100 | 300 | 750 | 925 | 1100 | 150 | 150 | 120 | 132 |
| 30 | Aeroporto | CDG Airport | aeroporti | 200 | 1:25 / 2:50 / 3:100 / 4:200 |  |  |  |  |  |  |  |  | 100 | 110 |
| 31 | Città | Toulouse | france | 260 | 22 | 44 | 110 | 330 | 800 | 975 | 1150 | 150 | 150 | 130 | 143 |
| 32 | Città | Paris | france | 260 | 22 | 44 | 110 | 330 | 800 | 975 | 1150 | 150 | 150 | 130 | 143 |
| 33 | Azienda | Water Company (water) | aziende | 150 | dadi x4 / x10 / x20 |  |  |  |  |  |  |  |  | 75 | 82 |
| 34 | Città | Yokohama | japan | 280 | 24 | 48 | 120 | 360 | 850 | 1025 | 1200 | 150 | 150 | 140 | 154 |
| 35 | Città | Tokyo | japan | 280 | 24 | 48 | 120 | 360 | 850 | 1025 | 1200 | 150 | 150 | 140 | 154 |
| 36 | Angolo | Go to prison (Vai in prigione) |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 37 | Città | Liverpool | united-kingdom | 300 | 26 | 52 | 130 | 390 | 900 | 1100 | 1275 | 200 | 200 | 150 | 165 |
| 38 | Città | Manchester | united-kingdom | 300 | 26 | 52 | 130 | 390 | 900 | 1100 | 1275 | 200 | 200 | 150 | 165 |
| 39 | Treasure (carta) | Treasure |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 40 | Città | Birmingham | united-kingdom | 320 | 28 | 56 | 150 | 450 | 1000 | 1200 | 1400 | 200 | 200 | 160 | 176 |
| 41 | Città | London | united-kingdom | 320 | 28 | 56 | 150 | 450 | 1000 | 1200 | 1400 | 200 | 200 | 160 | 176 |
| 42 | Aeroporto | JFK Airport | aeroporti | 200 | 1:25 / 2:50 / 3:100 / 4:200 |  |  |  |  |  |  |  |  | 100 | 110 |
| 43 | Città | Los Angeles | united-states-of-america | 350 | 35 | 70 | 175 | 500 | 1100 | 1300 | 1500 | 200 | 200 | 175 | 192 |
| 44 | Surprise (carta) | Surprise |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 45 | Città | San Francisco | united-states-of-america | 360 | 40 | 80 | 180 | 540 | 1200 | 1450 | 1675 | 200 | 200 | 180 | 198 |
| 46 | Tassa fissa (Premium Tax) | Premium Tax - paghi $75 |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 47 | Città | New York | united-states-of-america | 400 | 50 | 100 | 200 | 600 | 1400 | 1700 | 2000 | 200 | 200 | 200 | 220 |

**Gruppi (set) di Mr. Worldwide**

| Gruppo | N. citta | Caselle | Prezzo totale | Casa/Hotel | Costo set + 5 livelli su tutte |
|---|---|---|---|---|---|
| brazil | 2 | 1, 3 | 120 | 50/50 | 620 |
| israel | 3 | 5, 7, 8 | 310 | 50/50 | 1060 |
| india | 2 | 10, 11 | 250 | 100/100 | 1250 |
| italy | 4 | 13, 14, 16, 17 | 600 | 100/100 | 2600 |
| germany | 3 | 19, 21, 23 | 560 | 100/100 | 2060 |
| china | 3 | 25, 27, 29 | 680 | 150/150 | 2930 |
| france | 2 | 31, 32 | 520 | 150/150 | 2020 |
| japan | 2 | 34, 35 | 560 | 150/150 | 2060 |
| united-kingdom | 4 | 37, 38, 40, 41 | 1240 | 200/200 | 5240 |
| united-states-of-america | 3 | 43, 45, 47 | 1110 | 200/200 | 4110 |

Conteggio: corner 4, city 28, treasure 4, tax 1, airport 4, surprise 3, company 3, premium-tax 1. Acquistabili: 35 (valore totale $7200).

### Death Valley (`death-valley`) - 40 caselle

| # | Tipo | Nome | Gruppo | Prezzo | Base | Base x2 set | 1 casa | 2 case | 3 case | 4 case | Hotel | Casa | Hotel costo | Ipoteca | Riscatto |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0 | Angolo | Start |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 1 | Città | Ottawa | canada | 60 | 2 | 4 | 10 | 30 | 90 | 160 | 250 | 50 | 50 | 30 | 33 |
| 2 | Treasure (carta) | Treasure |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 3 | Città | Quebec City | canada | 60 | 4 | 8 | 20 | 60 | 180 | 320 | 450 | 50 | 50 | 30 | 33 |
| 4 | Tassa % (Earnings Tax) | Earnings Tax - 10% del contante |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 5 | Aeroporto | YYZ Airport | aeroporti | 200 | 1:25 / 2:50 / 3:100 / 4:200 |  |  |  |  |  |  |  |  | 100 | 110 |
| 6 | Città | Montreal | canada | 100 | 6 | 12 | 30 | 90 | 270 | 400 | 550 | 50 | 50 | 50 | 55 |
| 7 | Surprise (carta) | Surprise |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 8 | Città | Vancouver | canada | 100 | 6 | 12 | 30 | 90 | 270 | 400 | 550 | 50 | 50 | 50 | 55 |
| 9 | Città | Toronto | canada | 120 | 8 | 16 | 40 | 100 | 300 | 450 | 600 | 50 | 50 | 60 | 66 |
| 10 | Angolo | Prison (Prigione / di passaggio) |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 11 | Città | Wolfsburg | germany | 140 | 10 | 20 | 50 | 150 | 450 | 625 | 750 | 100 | 100 | 70 | 77 |
| 12 | Azienda | Power Company (electricity) | aziende | 150 | dadi x4 / x10 / x20 |  |  |  |  |  |  |  |  | 75 | 82 |
| 13 | Città | Cologne | germany | 140 | 10 | 20 | 50 | 150 | 450 | 625 | 750 | 100 | 100 | 70 | 77 |
| 14 | Città | Hamburg | germany | 160 | 12 | 24 | 60 | 180 | 500 | 700 | 900 | 100 | 100 | 80 | 88 |
| 15 | Aeroporto | MUC Airport | aeroporti | 200 | 1:25 / 2:50 / 3:100 / 4:200 |  |  |  |  |  |  |  |  | 100 | 110 |
| 16 | Città | Frankfurt | germany | 180 | 14 | 28 | 70 | 200 | 550 | 750 | 950 | 100 | 100 | 90 | 99 |
| 17 | Treasure (carta) | Treasure |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 18 | Città | Munich | germany | 180 | 14 | 28 | 70 | 200 | 550 | 750 | 950 | 100 | 100 | 90 | 99 |
| 19 | Città | Berlin | germany | 200 | 16 | 32 | 80 | 220 | 600 | 800 | 1000 | 100 | 100 | 100 | 110 |
| 20 | Angolo | Vacation (Vacanza) |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 21 | Città | Glasgow | united-kingdom | 220 | 18 | 36 | 90 | 250 | 700 | 875 | 1050 | 150 | 150 | 110 | 121 |
| 22 | Surprise (carta) | Surprise |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 23 | Città | Cambridge | united-kingdom | 220 | 18 | 36 | 90 | 250 | 700 | 875 | 1050 | 150 | 150 | 110 | 121 |
| 24 | Città | Liverpool | united-kingdom | 240 | 20 | 40 | 100 | 300 | 750 | 925 | 1100 | 150 | 150 | 120 | 132 |
| 25 | Aeroporto | LHR Airport | aeroporti | 200 | 1:25 / 2:50 / 3:100 / 4:200 |  |  |  |  |  |  |  |  | 100 | 110 |
| 26 | Città | Birmingham | united-kingdom | 260 | 22 | 44 | 110 | 330 | 800 | 975 | 1150 | 150 | 150 | 130 | 143 |
| 27 | Città | Manchester | united-kingdom | 260 | 22 | 44 | 110 | 330 | 800 | 975 | 1150 | 150 | 150 | 130 | 143 |
| 28 | Azienda | Water Company (water) | aziende | 150 | dadi x4 / x10 / x20 |  |  |  |  |  |  |  |  | 75 | 82 |
| 29 | Città | London | united-kingdom | 280 | 24 | 48 | 120 | 360 | 850 | 1025 | 1200 | 150 | 150 | 140 | 154 |
| 30 | Angolo | Go to prison (Vai in prigione) |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 31 | Città | Boston | united-states-of-america | 300 | 26 | 52 | 130 | 390 | 900 | 1100 | 1275 | 200 | 200 | 150 | 165 |
| 32 | Città | Seattle | united-states-of-america | 300 | 26 | 52 | 130 | 390 | 900 | 1100 | 1275 | 200 | 200 | 150 | 165 |
| 33 | Treasure (carta) | Treasure |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 34 | Città | Chicago | united-states-of-america | 320 | 28 | 56 | 150 | 450 | 1000 | 1200 | 1400 | 200 | 200 | 160 | 176 |
| 35 | Aeroporto | JFK Airport | aeroporti | 200 | 1:25 / 2:50 / 3:100 / 4:200 |  |  |  |  |  |  |  |  | 100 | 110 |
| 36 | Surprise (carta) | Surprise |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 37 | Città | San Francisco | united-states-of-america | 350 | 35 | 70 | 175 | 500 | 1100 | 1300 | 1500 | 200 | 200 | 175 | 192 |
| 38 | Tassa fissa (Premium Tax) | Premium Tax - paghi $75 |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 39 | Città | New York | united-states-of-america | 400 | 50 | 100 | 200 | 600 | 1400 | 1700 | 2000 | 200 | 200 | 200 | 220 |

**Gruppi (set) di Death Valley**

| Gruppo | N. citta | Caselle | Prezzo totale | Casa/Hotel | Costo set + 5 livelli su tutte |
|---|---|---|---|---|---|
| canada | 5 | 1, 3, 6, 8, 9 | 440 | 50/50 | 1690 |
| germany | 6 | 11, 13, 14, 16, 18, 19 | 1000 | 100/100 | 4000 |
| united-kingdom | 6 | 21, 23, 24, 26, 27, 29 | 1480 | 150/150 | 5980 |
| united-states-of-america | 5 | 31, 32, 34, 37, 39 | 1670 | 200/200 | 6670 |

Conteggio: corner 4, city 22, treasure 3, tax 1, airport 4, surprise 3, company 2, premium-tax 1. Acquistabili: 28 (valore totale $5690).

### Lucky Wheel (`lucky-wheel`) - 40 caselle

| # | Tipo | Nome | Gruppo | Prezzo | Base | Base x2 set | 1 casa | 2 case | 3 case | 4 case | Hotel | Casa | Hotel costo | Ipoteca | Riscatto |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0 | Angolo | Start |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 1 | Città | Antalya | turkey | 60 | 2 | 4 | 10 | 30 | 90 | 160 | 250 | 50 | 50 | 30 | 33 |
| 2 | Città | Istanbul | turkey | 80 | 4 | 8 | 20 | 60 | 180 | 320 | 450 | 50 | 50 | 40 | 44 |
| 3 | Città | Brasov | romania | 100 | 6 | 12 | 30 | 90 | 270 | 400 | 550 | 50 | 50 | 50 | 55 |
| 4 | Città | Bucharest | romania | 120 | 8 | 16 | 40 | 100 | 300 | 450 | 600 | 50 | 50 | 60 | 66 |
| 5 | Aeroporto | TLV Airport | aeroporti | 200 | 1:25 / 2:50 / 3:100 / 4:200 |  |  |  |  |  |  |  |  | 100 | 110 |
| 6 | Città | Milan | italy | 140 | 10 | 20 | 50 | 150 | 450 | 625 | 750 | 100 | 100 | 70 | 77 |
| 7 | Città | Rome | italy | 160 | 12 | 24 | 60 | 180 | 500 | 700 | 900 | 100 | 100 | 80 | 88 |
| 8 | Città | Munich | germany | 180 | 14 | 28 | 70 | 200 | 550 | 750 | 950 | 100 | 100 | 90 | 99 |
| 9 | Città | Berlin | germany | 200 | 16 | 32 | 80 | 220 | 600 | 800 | 1000 | 100 | 100 | 100 | 110 |
| 10 | Angolo | Prison (Prigione / di passaggio) |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 11 | Treasure (carta) | Treasure |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 12 | Tassa % (Earnings Tax) | Earnings Tax - 10% del contante |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 13 | Surprise (carta) | Surprise |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 14 | Treasure (carta) | Treasure |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 15 | Aeroporto | MUC Airport | aeroporti | 200 | 1:25 / 2:50 / 3:100 / 4:200 |  |  |  |  |  |  |  |  | 100 | 110 |
| 16 | Surprise (carta) | Surprise |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 17 | Treasure (carta) | Treasure |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 18 | Tassa fissa (Premium Tax) | Premium Tax - paghi $75 |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 19 | Surprise (carta) | Surprise |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 20 | Angolo | Vacation (Vacanza) |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 21 | Città | Beijing | china | 220 | 18 | 36 | 90 | 250 | 700 | 875 | 1050 | 150 | 150 | 110 | 121 |
| 22 | Città | Shanghai | china | 240 | 20 | 40 | 100 | 300 | 750 | 925 | 1100 | 150 | 150 | 120 | 132 |
| 23 | Città | Belfast | ireland | 260 | 22 | 44 | 110 | 330 | 800 | 975 | 1150 | 150 | 150 | 130 | 143 |
| 24 | Città | Dublin | ireland | 280 | 24 | 48 | 120 | 360 | 850 | 1025 | 1200 | 150 | 150 | 140 | 154 |
| 25 | Aeroporto | CDG Airport | aeroporti | 200 | 1:25 / 2:50 / 3:100 / 4:200 |  |  |  |  |  |  |  |  | 100 | 110 |
| 26 | Città | Manchester | united-kingdom | 300 | 26 | 52 | 130 | 390 | 900 | 1100 | 1275 | 200 | 200 | 150 | 165 |
| 27 | Città | London | united-kingdom | 320 | 28 | 56 | 150 | 450 | 1000 | 1200 | 1400 | 200 | 200 | 160 | 176 |
| 28 | Città | San Francisco | united-states-of-america | 350 | 35 | 70 | 175 | 500 | 1100 | 1300 | 1500 | 200 | 200 | 175 | 192 |
| 29 | Città | New York | united-states-of-america | 400 | 50 | 100 | 200 | 600 | 1400 | 1700 | 2000 | 200 | 200 | 200 | 220 |
| 30 | Angolo | Go to prison (Vai in prigione) |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 31 | Treasure (carta) | Treasure |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 32 | Surprise (carta) | Surprise |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 33 | Tassa fissa (Premium Tax) | Premium Tax - paghi $75 |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 34 | Treasure (carta) | Treasure |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 35 | Aeroporto | JFK Airport | aeroporti | 200 | 1:25 / 2:50 / 3:100 / 4:200 |  |  |  |  |  |  |  |  | 100 | 110 |
| 36 | Surprise (carta) | Surprise |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 37 | Rimborso (Tax Refund) | Tax Refund - ricevi $50 |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 38 | Treasure (carta) | Treasure |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 39 | Surprise (carta) | Surprise |  |  |  |  |  |  |  |  |  |  |  |  |  |

**Gruppi (set) di Lucky Wheel**

| Gruppo | N. citta | Caselle | Prezzo totale | Casa/Hotel | Costo set + 5 livelli su tutte |
|---|---|---|---|---|---|
| turkey | 2 | 1, 2 | 140 | 50/50 | 640 |
| romania | 2 | 3, 4 | 220 | 50/50 | 720 |
| italy | 2 | 6, 7 | 300 | 100/100 | 1300 |
| germany | 2 | 8, 9 | 380 | 100/100 | 1380 |
| china | 2 | 21, 22 | 460 | 150/150 | 1960 |
| ireland | 2 | 23, 24 | 540 | 150/150 | 2040 |
| united-kingdom | 2 | 26, 27 | 620 | 200/200 | 2620 |
| united-states-of-america | 2 | 28, 29 | 750 | 200/200 | 2750 |

Conteggio: corner 4, city 16, airport 4, treasure 6, tax 1, surprise 6, premium-tax 2, tax-refund 1. Acquistabili: 20 (valore totale $4210).

---

## 4. Carte (Treasure e Surprise)

### Carte Treasure (identiche in tutte le 4 mappe, 17 carte)

| # | Testo originale | Effetto |
|---|---|---|
| 0 | Advance to Start. | Vai alla casella 0 (+$200 se passi dal Via; se è il Via: +$300) |
| 1 | You found a wallet containing some cash. Collect $200. | Ricevi $200 |
| 2 | Your car has ran out of gas. Pay $50. | Paga $50 (al piatto Vacation se attivo) |
| 3 | From trading stocks you earned $50. | Ricevi $50 |
| 4 | Go to prison. | Vai in prigione |
| 5 | You host a party. Collect $50 from every player for equipment. | Ricevi $50 da ogni giocatore |
| 6 | Happy holidays! Receive $20. | Ricevi $20 |
| 7 | Tax refund. Collect $100. | Ricevi $100 |
| 8 | Happy birthday! Collect $10 from every player. | Ricevi $10 da ogni giocatore |
| 9 | From gift cards you get $100. | Ricevi $100 |
| 10 | Car rental insurance. Pay $60. | Paga $60 (al piatto Vacation se attivo) |
| 11 | Your phone died. Pay $50 for a repair. | Paga $50 (al piatto Vacation se attivo) |
| 12 | Beneficial business decisions. You made a profit of $25. | Ricevi $25 |
| 13 | It's time to renovate your properties. Pay $30 per house and $120 per hotel you own. | Paga $30/casa e $120/hotel |
| 14 | You have won third prize in a lottery. Collect $15. | Ricevi $15 |
| 15 | You received $100 from your sibling. | Ricevi $100 |
| 16 | Received a Pardon card. | Carta Pardon (esci gratis di prigione; si conserva e si può scambiare) |

### Carte Surprise - Classic (17 carte)

| # | Testo originale | Effetto |
|---|---|---|
| 0 | Advance to Start. | Vai alla casella 0 (+$200 se passi dal Via; se è il Via: +$300) |
| 1 | Advance to Shanghai. | Vai alla casella 24 (+$200 se passi dal Via; se è il Via: +$300) |
| 2 | Advance to Venice. | Vai alla casella 11 (+$200 se passi dal Via; se è il Via: +$300) |
| 3 | Advance to the next company. | Vai alla prossima azienda (paghi affitto normale; +$200 se passi dal Via) |
| 4 | Advance to the next airport. | Vai al prossimo aeroporto (paghi affitto normale; +$200 se passi dal Via) |
| 5 | Stock agency pays you dividend of $60. | Ricevi $60 |
| 6 | Go back 3 steps. | Indietro di 3 caselle |
| 7 | Go to prison. | Vai in prigione |
| 8 | Have a redesign for your properties. Pay $25 for each house and $100 for each hotel. | Paga $25/casa e $100/hotel |
| 9 | Pay tax of $20. | Paga $20 (al piatto Vacation se attivo) |
| 10 | Take a trip to TLV Airport. | Vai alla casella 5 (+$200 se passi dal Via; se è il Via: +$300) |
| 11 | Have an adventure to New York. | Vai alla casella 39 (+$200 se passi dal Via; se è il Via: +$300) |
| 12 | You lost a bet. Pay each player $50. | Paga $50 a ogni giocatore |
| 13 | You have a new investment. Receive $150. | Ricevi $150 |
| 14 | From a scholarship you get $100. | Ricevi $100 |
| 15 | Your cousin needs some financial assistance. Pay $50. | Paga $50 (al piatto Vacation se attivo) |
| 16 | Received a Pardon card. | Carta Pardon (esci gratis di prigione; si conserva e si può scambiare) |

**Surprise - Mr. Worldwide (17 carte): differenze rispetto a Classic**

| # | Testo | Effetto |
|---|---|---|
| 1 | Advance to Toulouse. | Vai alla casella 31 (+$200 se passi dal Via; se è il Via: +$300) |
| 2 | Advance to Rome. | Vai alla casella 17 (+$200 se passi dal Via; se è il Via: +$300) |
| 10 | Take a trip to Tel Aviv. | Vai alla casella 5 (+$200 se passi dal Via; se è il Via: +$300) |
| 11 | Have an adventure to San Francisco. | Vai alla casella 45 (+$200 se passi dal Via; se è il Via: +$300) |

Assenti rispetto a Classic: "Advance to Shanghai.", "Advance to Venice.", "Take a trip to TLV Airport.", "Have an adventure to New York.".

**Surprise - Death Valley (17 carte): differenze rispetto a Classic**

| # | Testo | Effetto |
|---|---|---|
| 1 | Advance to Liverpool. | Vai alla casella 24 (+$200 se passi dal Via; se è il Via: +$300) |
| 2 | Advance to Wolfsburg. | Vai alla casella 11 (+$200 se passi dal Via; se è il Via: +$300) |
| 10 | Take a trip to YYZ Airport. | Vai alla casella 5 (+$200 se passi dal Via; se è il Via: +$300) |

Assenti rispetto a Classic: "Advance to Shanghai.", "Advance to Venice.", "Take a trip to TLV Airport.".

**Surprise - Lucky Wheel (20 carte): differenze rispetto a Classic**

| # | Testo | Effetto |
|---|---|---|
| 1 | Advance to Beijing. | Vai alla casella 21 (+$200 se passi dal Via; se è il Via: +$300) |
| 2 | Advance to Istanbul. | Vai alla casella 2 (+$200 se passi dal Via; se è il Via: +$300) |
| 3 | Take a trip to Belfast. | Vai alla casella 23 (+$200 se passi dal Via; se è il Via: +$300) |
| 4 | Take a trip to Bucharest. | Vai alla casella 4 (+$200 se passi dal Via; se è il Via: +$300) |
| 5 | Have an adventure to Manchester. | Vai alla casella 26 (+$200 se passi dal Via; se è il Via: +$300) |
| 6 | Have an adventure to Rome. | Vai alla casella 7 (+$200 se passi dal Via; se è il Via: +$300) |
| 7 | Travel to San Francisco. | Vai alla casella 28 (+$200 se passi dal Via; se è il Via: +$300) |
| 8 | Travel to Berlin. | Vai alla casella 9 (+$200 se passi dal Via; se è il Via: +$300) |
| 11 | Go back one step. | Indietro di 1 casella |

Assenti rispetto a Classic: "Advance to Shanghai.", "Advance to Venice.", "Advance to the next company.", "Go back 3 steps.", "Take a trip to TLV Airport.", "Have an adventure to New York.".

Note sulle carte (**CODICE**, testi visti in partita **VERIFICATI**):
- Le carte che fanno pagare la banca (money-event "pay" e "repairs") alimentano il piatto Vacation se la regola è attiva. "Pay each player" e "Collect from every player" sono invece scambi tra giocatori (in modalità squadre i compagni sono esclusi).
- "Advance to the next airport/company" porta alla prossima casella di quel tipo e si paga l'affitto **normale** (nessun raddoppio o moltiplicatore speciale come nel Monopoly).
- Ogni mazzo contiene una sola carta Pardon; chi la possiede la può usare per uscire di prigione. Vale $50 nel calcolo del patrimonio.

---

## 5. Osservazioni utili per bilanciare PoorDown (DEDOTTO)

- **Proporzioni Classic**: prezzo città da 60 a 400; affitto base circa 3-12% del prezzo; con hotel l'affitto arriva a circa 4-8 volte il prezzo (es. 400 -> 2000, Rio 60 -> 460). Costo casa a fasce per lato: 50 / 100 / 150 / 200.
- **Economia del giro**: +$200 a giro (+$300 se atterri esatto sul Via). Su 48 caselle (Mr. Worldwide) il giro dura circa il 20% in più, quindi l'economia è più "tirata".
- **Tasse**: l'Earnings Tax al 10% del contante punisce chi tiene liquidità; la Premium Tax fissa ($75) pesa soprattutto a inizio partita.
- **Varianti di mappa da replicare come "modalità"**: set grandi (Death Valley, partite lunghe e bloccate), metà tabellone solo bonus (Lucky Wheel, molta fortuna), tabellone lungo con 3 aziende (Mr. Worldwide).
- Per l'originalità: in PoorDown usare una scala affitti propria (le mappe premium di richup copiano 1:1 la tabella del Monopoly) e nomi/testi nuovi.

---

## 6. Evidenze dalla partita di prova (VERIFICATO, Classic, 2 giocatori)

- Contante iniziale $1500; dopo l'acquisto di Haifa ($110) il saldo era $1390.
- Scheda della proprietà posseduta: "Mortgage for $55"; dopo l'ipoteca "Get back for $60".
- Log: "passed through Start and received $200", "landed on Start and received $300" (dopo la carta "Advance to Start").
- "paid a $75 tax" (Premium Tax).
- Affitti base pagati: Rio $4, Tel Aviv $6, Jerusalem $8, Venice $10, Frankfurt $14, Shanghai $20, Lyon $20, London $30.
- Prigione: pulsante "get free for $50"; "failed to throw doubles..." per 3 turni, poi di nuovo libero; "rolled doubles and got out of prison"; "rolled doubles 3 times in a row and got into prison".
- Vacanza: "will spend a turn while on vacation. $410 withdrawn" (piatto "$X on hold" mostrato sulla casella Vacation).
- Con contante insufficiente il pulsante "Buy for $X" è disabilitato.
- Non osservati dal vivo (solo **CODICE**): Earnings Tax al 10%, affitti con case/hotel, regola x2, affitti di aziende e aeroporti multipli, aste, partite sulle mappe premium (non acquistate).

## 7. File e screenshot

- `board-data.json`: struttura `maps.<id>.tiles[]` (index, type, name, group, price, rent{base, fullSetBaseIfRuleX2, house1..4, hotel}, housePrice, hotelPrice, mortgageValue, unmortgageCost, sellToBankValue, ...), `maps.<id>.summary.groups[]`, `maps.<id>.cards.{treasure,surprise}[]` con effetto strutturato, più `globalRules` e `_meta` (fonti e verifiche).
- Screenshot in `img/`: `a5-lobby-classic.png` (tabellone Classic), `a5-board-maps-modal.png` (selezione mappe), `a5-preview-mr-worldwide.png` (anteprima con scheda Tokyo), `a5-preview-death-valley.png`, `a5-preview-lucky-wheel.png`, `a5-game-start.png`, `a5-owned-property-card.png` (tabellone dopo il primo acquisto), `a5-in-prison.png`, `a5-game-midgame.png` (partita in corso con proprietà possedute), `a5-loading.png` (blocco in headless).
