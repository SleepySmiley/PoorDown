# Tabellone "Classico" e carte di PoorDown

Tema: **città italiane**. Ogni gruppo è una regione, ogni casella una città. Tono dei testi: **sobrio**.

Qui ci sono i nomi, la struttura, i prezzi e i testi delle carte. I dati usati dal gioco stanno in `packages/engine/src/tabelloni/classico.ts`.

## Come sono ordinate le regioni

I gruppi vanno dalla regione **meno popolosa alla più popolosa**: è un criterio oggettivo e alterna nord, isole, centro e sud lungo il tabellone. Dentro ogni gruppo le città vanno dalla più piccola alla più grande.

| Gruppo | Regione | Area | Città |
|---|---|---|---|
| 1 | Valle d'Aosta | Nord | Courmayeur, Aosta |
| 2 | Sardegna | Isole | Olbia, Sassari, Cagliari |
| 3 | Toscana | Centro | Siena, Pisa, Firenze |
| 4 | Sicilia | Isole | Siracusa, Catania, Palermo |
| 5 | Veneto | Nord | Padova, Verona, Venezia |
| 6 | Campania | Sud | Caserta, Salerno, Napoli |
| 7 | Lazio | Centro | Viterbo, Latina, Roma |
| 8 | Lombardia | Nord | Bergamo, Milano |

Restano fuori, e si possono usare nei tabelloni alternativi della Fase 8: Piemonte (Torino), Emilia-Romagna (Bologna), Liguria (Genova), Puglia (Bari), Friuli-Venezia Giulia (Trieste), Trentino-Alto Adige, Umbria, Marche, Abruzzo, Molise, Basilicata, Calabria.

## Le 40 caselle

| # | Casella | Tipo |
|---|---|---|
| 0 | Partenza | Angolo: +200 passando, +300 fermandosi |
| 1 | Courmayeur | Città, gruppo 1 |
| 2 | Busta | Carta |
| 3 | Aosta | Città, gruppo 1 |
| 4 | Imposta sul reddito | Tassa: 10% del contante |
| 5 | Stazione Nord | Stazione |
| 6 | Olbia | Città, gruppo 2 |
| 7 | Sassari | Città, gruppo 2 |
| 8 | Cartolina | Carta |
| 9 | Cagliari | Città, gruppo 2 |
| 10 | Prigione | Angolo (chi ci passa è "in visita") |
| 11 | Siena | Città, gruppo 3 |
| 12 | Rete elettrica | Servizio |
| 13 | Pisa | Città, gruppo 3 |
| 14 | Firenze | Città, gruppo 3 |
| 15 | Stazione Est | Stazione |
| 16 | Siracusa | Città, gruppo 4 |
| 17 | Busta | Carta |
| 18 | Catania | Città, gruppo 4 |
| 19 | Palermo | Città, gruppo 4 |
| 20 | Vacanza | Angolo: salti un turno |
| 21 | Padova | Città, gruppo 5 |
| 22 | Cartolina | Carta |
| 23 | Verona | Città, gruppo 5 |
| 24 | Venezia | Città, gruppo 5 |
| 25 | Stazione Sud | Stazione |
| 26 | Caserta | Città, gruppo 6 |
| 27 | Acquedotto | Servizio |
| 28 | Salerno | Città, gruppo 6 |
| 29 | Napoli | Città, gruppo 6 |
| 30 | Vai in prigione | Angolo |
| 31 | Viterbo | Città, gruppo 7 |
| 32 | Latina | Città, gruppo 7 |
| 33 | Busta | Carta |
| 34 | Roma | Città, gruppo 7 |
| 35 | Stazione Ovest | Stazione |
| 36 | Cartolina | Carta |
| 37 | Bergamo | Città, gruppo 8 |
| 38 | Tassa di soggiorno | Tassa: 75 fissi |
| 39 | Milano | Città, gruppo 8 |

## Prezzi e affitti

Scala nostra, decisa nella Fase 2. Stessa ampiezza di richup (prezzi 60–400, case 50–200), numeri diversi. Dentro ogni regione il prezzo sale con la città. Si ribilancia dopo le partite di prova (Fase 9).

| Città | Prezzo | Base | 1 casa | 2 case | 3 case | 4 case | Albergo | Casa e albergo |
|---|---|---|---|---|---|---|---|---|
| Courmayeur | 60 | 3 | 10 | 35 | 100 | 140 | 170 | 50 |
| Aosta | 70 | 4 | 15 | 45 | 120 | 170 | 200 | 50 |
| Olbia | 100 | 6 | 25 | 70 | 190 | 260 | 320 | 50 |
| Sassari | 110 | 6 | 25 | 80 | 220 | 290 | 360 | 50 |
| Cagliari | 120 | 7 | 30 | 90 | 250 | 330 | 400 | 50 |
| Siena | 140 | 9 | 35 | 110 | 300 | 400 | 490 | 100 |
| Pisa | 150 | 10 | 40 | 120 | 330 | 440 | 530 | 100 |
| Firenze | 160 | 11 | 45 | 140 | 360 | 480 | 580 | 100 |
| Siracusa | 180 | 13 | 55 | 160 | 430 | 560 | 680 | 100 |
| Catania | 190 | 14 | 60 | 180 | 460 | 600 | 730 | 100 |
| Palermo | 200 | 15 | 65 | 190 | 500 | 650 | 780 | 100 |
| Padova | 220 | 17 | 75 | 220 | 570 | 740 | 880 | 150 |
| Verona | 230 | 18 | 80 | 230 | 610 | 780 | 940 | 150 |
| Venezia | 250 | 21 | 90 | 270 | 680 | 880 | 1050 | 150 |
| Caserta | 260 | 22 | 95 | 280 | 720 | 920 | 1100 | 150 |
| Salerno | 270 | 24 | 100 | 300 | 760 | 970 | 1150 | 150 |
| Napoli | 290 | 26 | 110 | 340 | 850 | 1075 | 1275 | 150 |
| Viterbo | 300 | 28 | 120 | 360 | 890 | 1125 | 1325 || 150 |
| Latina | 310 | 29 | 130 | 380 | 930 | 1175 | 1400 || 150 |
| Roma | 330 | 32 | 140 | 420 | 1025 | 1275 | 1500 || 150 |
| Bergamo | 360 | 37 | 160 | 480 | 1150 | 1425 | 1675 | 200 |
| Milano | 400 | 44 | 190 | 580 | 1350 | 1625 | 1925 | 200 |

- **Stazioni**: 200 €. Affitto 25 / 50 / 100 / 200 € con 1 / 2 / 3 / 4 stazioni.
- **Servizi** (Rete elettrica, Acquedotto): 150 €. Affitto = dadi × 4 con un servizio, × 10 con due.
- **Vendita alla banca**: metà prezzo, niente se ipotecata. **Ipoteca**: metà prezzo; riscatto al 110%.

## I due mazzi

- **Busta**: soprattutto soldi (rimborsi, spese, regali tra giocatori).
- **Cartolina**: soprattutto spostamenti (vai in una città, alla stazione più vicina, indietro di 3).

Ogni mazzo ha 17 carte e una sola **Carta Grazia**. I mazzi si mescolano a inizio partita e l'ordine resta segreto.

### Busta (17 carte)

| # | Testo | Effetto |
|---|---|---|
| 1 | Torna alla Partenza. | Vai alla casella 0 |
| 2 | Rimborso delle tasse. Ricevi 100 €. | +100 |
| 3 | Interessi sul conto di risparmio. Ricevi 50 €. | +50 |
| 4 | Premio di un concorso. Ricevi 150 €. | +150 |
| 5 | Eredità da un parente lontano. Ricevi 100 €. | +100 |
| 6 | Rimborso dell'assicurazione. Ricevi 25 €. | +25 |
| 7 | Vendi la vecchia bicicletta. Ricevi 30 €. | +30 |
| 8 | Buono regalo. Ricevi 20 €. | +20 |
| 9 | Bolletta della luce. Paga 60 €. | −60 alla banca |
| 10 | Revisione dell'auto. Paga 50 €. | −50 alla banca |
| 11 | Visita dal dentista. Paga 50 €. | −50 alla banca |
| 12 | Multa per sosta vietata. Paga 40 €. | −40 alla banca |
| 13 | È il tuo compleanno. Ogni giocatore ti dà 10 €. | +10 da ogni giocatore |
| 14 | Hai anticipato la cena per tutti. Ogni giocatore ti dà 50 €. | +50 da ogni giocatore |
| 15 | Manutenzione degli immobili. Paga 40 € per ogni casa e 115 € per ogni albergo. | Riparazioni |
| 16 | Vai in prigione. | Prigione |
| 17 | Carta Grazia. Esci gratis di prigione. Puoi tenerla o scambiarla. | Grazia |

### Cartolina (17 carte)

| # | Testo | Effetto |
|---|---|---|
| 1 | Torna alla Partenza. | Vai alla casella 0 |
| 2 | Vai a Siena. | Vai alla casella 11 |
| 3 | Vai a Venezia. | Vai alla casella 24 |
| 4 | Vai a Milano. | Vai alla casella 39 |
| 5 | Vai alla Stazione Nord. | Vai alla casella 5 |
| 6 | Vai alla stazione più vicina. | Prossima stazione, affitto normale |
| 7 | Vai al servizio più vicino. | Prossimo servizio, affitto normale |
| 8 | Torna indietro di 3 caselle. | −3 caselle, senza passare dalla Partenza |
| 9 | Vai in prigione. | Prigione |
| 10 | Dividendi delle tue azioni. Ricevi 50 €. | +50 |
| 11 | Borsa di studio. Ricevi 100 €. | +100 |
| 12 | Investimento riuscito. Ricevi 150 €. | +150 |
| 13 | Tassa sui rifiuti. Paga 25 €. | −25 alla banca |
| 14 | Aiuti un parente. Paga 50 €. | −50 alla banca |
| 15 | Hai perso una scommessa. Paga 50 € a ogni giocatore. | −50 a ogni giocatore |
| 16 | Ristrutturazione. Paga 25 € per ogni casa e 100 € per ogni albergo. | Riparazioni |
| 17 | Carta Grazia. Esci gratis di prigione. Puoi tenerla o scambiarla. | Grazia |

Regole comuni alle carte "Vai a…": se passi dalla Partenza ricevi 200 €; "Torna alla Partenza" conta come fermarsi lì (300 €). Le carte che pagano la banca alimentano la cassa della Vacanza, se la regola è attiva.

## Parole dell'interfaccia

| Parola | Uso |
|---|---|
| Partenza | La casella 0 |
| Prigione · In visita · Vai in prigione | Angoli 10 e 30 |
| Vacanza | Angolo 20 |
| Città · Stazione · Servizio | Tipi di proprietà |
| Casa · Albergo | Edifici (fino a 4 case, poi l'albergo) |
| Busta · Cartolina | I due mazzi |
| Carta Grazia | Esci gratis di prigione |
| Ipoteca · Riscatta | Ipotecare e riprendere una proprietà |
| Asta · Scambio · Bancarotta | Azioni di gioco |
| Saldo · Patrimonio | Contante · contante + proprietà + edifici |

La valuta è l'euro (€).
