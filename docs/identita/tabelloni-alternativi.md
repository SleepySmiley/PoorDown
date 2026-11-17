# Tabelloni alternativi di PoorDown

Tre tabelloni oltre al Classico ([tabellone-e-carte.md](tabellone-e-carte.md)), uno per tema (scelta della Fase 8). Stessa struttura delle mappe premium di richup ([05 §1](../analisi/05-tabellone-mappe.md)), ma nomi, temi e numeri sono nostri.

| Tabellone | Caselle | Tema | Cosa cambia nel gioco |
|---|---|---|---|
| **Europa** | 48 (12 per lato) | Città europee, un gruppo per paese (Italia esclusa) | Giro più lungo: si passa meno spesso dalla Partenza. Tre servizi (luce, gas, acqua): con tre il moltiplicatore è ×20 |
| **Grandi aree** | 40 | Quattro regioni italiane, una per lato: Sicilia, Puglia, Toscana, Veneto | Un solo gruppo per lato, da 5 o 6 città: completarlo è difficile, ma vale un lato intero |
| **Colpo di fortuna** | 40 | Località turistiche italiane, un gruppo per zona | Città solo sui lati 1 e 3; i lati 2 e 4 sono carte, tasse e un **Rimborso** (+50 €). Niente servizi, Cartolina da 20 carte con più mete |

Regole comuni:
- Angoli sempre a 0, ¼, ½ e ¾ del giro (Prigione alla casella 12 su Europa, 10 sugli altri). Partenza +200 passando, +300 fermandosi.
- **Affitti dalla scala del Classico**: per ogni prezzo gli affitti si interpolano tra le due città del Classico più vicine per prezzo (base all'euro, case e albergo ai 5 €). Codice: `packages/engine/src/tabelloni/scala.ts`. Ribilanciati nella Fase 9 con 1000 partite di bot per tabellone: casa e albergo della Polonia (Europa) da 150 a 200 €, del Sud (Grandi aree) da 100 a 125 €, del Nord (Grandi aree) da 200 a 150 €; stazioni di Colpo di fortuna 40 / 80 / 160 / 280 €.
- **Busta** uguale su tutti i tabelloni (17 carte). La **Cartolina** cambia perché le sue mete sono caselle di quel tabellone; "Vai al servizio più vicino" c'è solo dove ci sono servizi.
- Stemmi: ogni gruppo ha sigla di tre lettere e colore (Europa usa due colori in più, `--g9` e `--g10`).
- I dati usati dal gioco stanno in `packages/engine/src/tabelloni/` (`europa.ts`, `grandi-aree.ts`, `fortuna.ts`); le tabelle qui sotto sono generate da quei file.

## Europa

48 caselle e 10 paesi europei, con tre servizi: il giro è più lungo e si passa meno spesso dalla Partenza.

| Gruppo | Sigla | Città | Casa e albergo |
|---|---|---|---|
| 1. Irlanda | IRL | Galway, Dublino | 50 |
| 2. Svizzera | CHE | Basilea, Ginevra, Zurigo | 50 |
| 3. Austria | AUT | Salisburgo, Vienna | 100 |
| 4. Grecia | GRC | Patrasso, Salonicco, Atene | 100 |
| 5. Portogallo | PRT | Braga, Coimbra, Porto, Lisbona | 100 |
| 6. Paesi Bassi | NLD | Utrecht, Rotterdam, Amsterdam | 150 |
| 7. Polonia | POL | Cracovia, Varsavia | 200 |
| 8. Spagna | ESP | Siviglia, Barcellona, Madrid | 150 |
| 9. Francia | FRA | Lione, Marsiglia, Parigi | 200 |
| 10. Germania | DEU | Amburgo, Monaco di Baviera, Berlino | 200 |

### Le 48 caselle

| # | Casella | Tipo | Prezzo | Base | 1 casa | 2 case | 3 case | 4 case | Albergo |
|---|---|---|---|---|---|---|---|---|---|
| 0 | Partenza | Angolo |  |  |  |  |  |  |  |
| 1 | Galway | Città, gruppo 1 | 60 | 3 | 10 | 35 | 100 | 140 | 170 |
| 2 | Busta | Carta |  |  |  |  |  |  |  |
| 3 | Dublino | Città, gruppo 1 | 70 | 4 | 15 | 45 | 120 | 170 | 200 |
| 4 | Imposta sul reddito | Tassa: 10% del contante |  |  |  |  |  |  |  |
| 5 | Basilea | Città, gruppo 2 | 100 | 6 | 25 | 70 | 190 | 260 | 320 |
| 6 | Stazione Nord | Stazione | 200 |  |  |  |  |  |  |
| 7 | Ginevra | Città, gruppo 2 | 100 | 6 | 25 | 70 | 190 | 260 | 320 |
| 8 | Cartolina | Carta |  |  |  |  |  |  |  |
| 9 | Zurigo | Città, gruppo 2 | 120 | 7 | 30 | 90 | 250 | 330 | 400 |
| 10 | Salisburgo | Città, gruppo 3 | 130 | 8 | 35 | 100 | 275 | 365 | 445 |
| 11 | Vienna | Città, gruppo 3 | 140 | 9 | 35 | 110 | 300 | 400 | 490 |
| 12 | Prigione | Angolo |  |  |  |  |  |  |  |
| 13 | Patrasso | Città, gruppo 4 | 150 | 10 | 40 | 120 | 330 | 440 | 530 |
| 14 | Salonicco | Città, gruppo 4 | 150 | 10 | 40 | 120 | 330 | 440 | 530 |
| 15 | Rete elettrica | Servizio | 150 |  |  |  |  |  |  |
| 16 | Atene | Città, gruppo 4 | 170 | 12 | 50 | 150 | 395 | 520 | 630 |
| 17 | Busta | Carta |  |  |  |  |  |  |  |
| 18 | Stazione Est | Stazione | 200 |  |  |  |  |  |  |
| 19 | Braga | Città, gruppo 5 | 180 | 13 | 55 | 160 | 430 | 560 | 680 |
| 20 | Coimbra | Città, gruppo 5 | 180 | 13 | 55 | 160 | 430 | 560 | 680 |
| 21 | Rete del gas | Servizio | 150 |  |  |  |  |  |  |
| 22 | Porto | Città, gruppo 5 | 190 | 14 | 60 | 180 | 460 | 600 | 730 |
| 23 | Lisbona | Città, gruppo 5 | 200 | 15 | 65 | 190 | 500 | 650 | 780 |
| 24 | Vacanza | Angolo |  |  |  |  |  |  |  |
| 25 | Utrecht | Città, gruppo 6 | 220 | 17 | 75 | 220 | 570 | 740 | 880 |
| 26 | Cartolina | Carta |  |  |  |  |  |  |  |
| 27 | Rotterdam | Città, gruppo 6 | 220 | 17 | 75 | 220 | 570 | 740 | 880 |
| 28 | Amsterdam | Città, gruppo 6 | 240 | 20 | 85 | 250 | 645 | 830 | 995 |
| 29 | Cracovia | Città, gruppo 7 | 260 | 22 | 95 | 280 | 720 | 920 | 1100 |
| 30 | Stazione Sud | Stazione | 200 |  |  |  |  |  |  |
| 31 | Varsavia | Città, gruppo 7 | 270 | 24 | 100 | 300 | 760 | 970 | 1150 |
| 32 | Acquedotto | Servizio | 150 |  |  |  |  |  |  |
| 33 | Siviglia | Città, gruppo 8 | 280 | 25 | 105 | 320 | 805 | 1025 | 1215 |
| 34 | Barcellona | Città, gruppo 8 | 280 | 25 | 105 | 320 | 805 | 1025 | 1215 |
| 35 | Madrid | Città, gruppo 8 | 300 | 28 | 120 | 360 | 890 | 1125 | 1325 |
| 36 | Vai in prigione | Angolo |  |  |  |  |  |  |  |
| 37 | Lione | Città, gruppo 9 | 310 | 29 | 130 | 380 | 930 | 1175 | 1400 |
| 38 | Marsiglia | Città, gruppo 9 | 320 | 31 | 135 | 400 | 980 | 1225 | 1450 |
| 39 | Busta | Carta |  |  |  |  |  |  |  |
| 40 | Parigi | Città, gruppo 9 | 340 | 34 | 145 | 440 | 1065 | 1325 | 1560 |
| 41 | Cartolina | Carta |  |  |  |  |  |  |  |
| 42 | Stazione Ovest | Stazione | 200 |  |  |  |  |  |  |
| 43 | Amburgo | Città, gruppo 10 | 350 | 35 | 155 | 460 | 1110 | 1375 | 1615 |
| 44 | Monaco di Baviera | Città, gruppo 10 | 360 | 37 | 160 | 480 | 1150 | 1425 | 1675 |
| 45 | Busta | Carta |  |  |  |  |  |  |  |
| 46 | Tassa di soggiorno | Tassa: 75 € |  |  |  |  |  |  |  |
| 47 | Berlino | Città, gruppo 10 | 400 | 44 | 190 | 580 | 1350 | 1625 | 1925 |

### Cartolina

1. Torna alla Partenza.
2. Vai a Ginevra.
3. Vai a Lisbona.
4. Vai a Berlino.
5. Vai alla Stazione Nord.
6. Vai alla stazione più vicina.
7. Vai al servizio più vicino.
8. Torna indietro di 3 caselle.
9. Vai in prigione.
10. Dividendi delle tue azioni. Ricevi 50 €.
11. Borsa di studio. Ricevi 100 €.
12. Investimento riuscito. Ricevi 150 €.
13. Tassa sui rifiuti. Paga 25 €.
14. Aiuti un parente. Paga 50 €.
15. Hai perso una scommessa. Paga 50 € a ogni giocatore.
16. Ristrutturazione. Paga 25 € per ogni casa e 100 € per ogni albergo.
17. Carta Grazia. Esci gratis di prigione. Puoi tenerla o scambiarla.

## Grandi aree

Ogni lato è una sola regione d’Italia, da 5 o 6 città: completarla è difficile, ma vale un lato intero.

| Gruppo | Sigla | Città | Casa e albergo |
|---|---|---|---|
| 1. Sicilia | SIC | Trapani, Agrigento, Messina, Catania, Palermo | 50 |
| 2. Puglia | PUG | Foggia, Brindisi, Taranto, Lecce, Barletta, Bari | 125 |
| 3. Toscana | TOS | Arezzo, Pisa, Livorno, Lucca, Siena, Firenze | 150 |
| 4. Veneto | VEN | Casalserugo, San Pietro Viminario, Abano Terme, Vigodarzere, Mestrino | 150 |

Prima i lati erano macroaree (Isole, Sud, Centro, Nord); sono diventati regioni intere perché ogni lato abbia una bandiera vera sola. I paesi del Veneto, in provincia di Padova, li ha scelti l’utente.

### Le 40 caselle

| # | Casella | Tipo | Prezzo | Base | 1 casa | 2 case | 3 case | 4 case | Albergo |
|---|---|---|---|---|---|---|---|---|---|
| 0 | Partenza | Angolo |  |  |  |  |  |  |  |
| 1 | Trapani | Città, gruppo 1 | 60 | 3 | 10 | 35 | 100 | 140 | 170 |
| 2 | Busta | Carta |  |  |  |  |  |  |  |
| 3 | Agrigento | Città, gruppo 1 | 70 | 4 | 15 | 45 | 120 | 170 | 200 |
| 4 | Imposta sul reddito | Tassa: 10% del contante |  |  |  |  |  |  |  |
| 5 | Stazione Nord | Stazione | 200 |  |  |  |  |  |  |
| 6 | Messina | Città, gruppo 1 | 100 | 6 | 25 | 70 | 190 | 260 | 320 |
| 7 | Catania | Città, gruppo 1 | 110 | 6 | 25 | 80 | 220 | 290 | 360 |
| 8 | Cartolina | Carta |  |  |  |  |  |  |  |
| 9 | Palermo | Città, gruppo 1 | 120 | 7 | 30 | 90 | 250 | 330 | 400 |
| 10 | Prigione | Angolo |  |  |  |  |  |  |  |
| 11 | Foggia | Città, gruppo 2 | 140 | 9 | 35 | 110 | 300 | 400 | 490 |
| 12 | Rete elettrica | Servizio | 150 |  |  |  |  |  |  |
| 13 | Brindisi | Città, gruppo 2 | 150 | 10 | 40 | 120 | 330 | 440 | 530 |
| 14 | Taranto | Città, gruppo 2 | 160 | 11 | 45 | 140 | 360 | 480 | 580 |
| 15 | Stazione Est | Stazione | 200 |  |  |  |  |  |  |
| 16 | Lecce | Città, gruppo 2 | 170 | 12 | 50 | 150 | 395 | 520 | 630 |
| 17 | Busta | Carta |  |  |  |  |  |  |  |
| 18 | Barletta | Città, gruppo 2 | 180 | 13 | 55 | 160 | 430 | 560 | 680 |
| 19 | Bari | Città, gruppo 2 | 200 | 15 | 65 | 190 | 500 | 650 | 780 |
| 20 | Vacanza | Angolo |  |  |  |  |  |  |  |
| 21 | Arezzo | Città, gruppo 3 | 220 | 17 | 75 | 220 | 570 | 740 | 880 |
| 22 | Cartolina | Carta |  |  |  |  |  |  |  |
| 23 | Pisa | Città, gruppo 3 | 230 | 18 | 80 | 230 | 610 | 780 | 940 |
| 24 | Livorno | Città, gruppo 3 | 240 | 20 | 85 | 250 | 645 | 830 | 995 |
| 25 | Stazione Sud | Stazione | 200 |  |  |  |  |  |  |
| 26 | Lucca | Città, gruppo 3 | 250 | 21 | 90 | 270 | 680 | 880 | 1050 |
| 27 | Acquedotto | Servizio | 150 |  |  |  |  |  |  |
| 28 | Siena | Città, gruppo 3 | 260 | 22 | 95 | 280 | 720 | 920 | 1100 |
| 29 | Firenze | Città, gruppo 3 | 280 | 25 | 105 | 320 | 805 | 1025 | 1215 |
| 30 | Vai in prigione | Angolo |  |  |  |  |  |  |  |
| 31 | Casalserugo | Città, gruppo 4 | 300 | 28 | 120 | 360 | 890 | 1125 | 1325 |
| 32 | San Pietro Viminario | Città, gruppo 4 | 310 | 29 | 130 | 380 | 930 | 1175 | 1400 |
| 33 | Busta | Carta |  |  |  |  |  |  |  |
| 34 | Abano Terme | Città, gruppo 4 | 330 | 32 | 140 | 420 | 1025 | 1275 | 1500 |
| 35 | Stazione Ovest | Stazione | 200 |  |  |  |  |  |  |
| 36 | Cartolina | Carta |  |  |  |  |  |  |  |
| 37 | Vigodarzere | Città, gruppo 4 | 360 | 37 | 160 | 480 | 1150 | 1425 | 1675 |
| 38 | Tassa di soggiorno | Tassa: 75 € |  |  |  |  |  |  |  |
| 39 | Mestrino | Città, gruppo 4 | 400 | 44 | 190 | 580 | 1350 | 1625 | 1925 |

### Cartolina

1. Torna alla Partenza.
2. Vai a Foggia.
3. Vai a Livorno.
4. Vai a Mestrino.
5. Vai alla Stazione Nord.
6. Vai alla stazione più vicina.
7. Vai al servizio più vicino.
8. Torna indietro di 3 caselle.
9. Vai in prigione.
10. Dividendi delle tue azioni. Ricevi 50 €.
11. Borsa di studio. Ricevi 100 €.
12. Investimento riuscito. Ricevi 150 €.
13. Tassa sui rifiuti. Paga 25 €.
14. Aiuti un parente. Paga 50 €.
15. Hai perso una scommessa. Paga 50 € a ogni giocatore.
16. Ristrutturazione. Paga 25 € per ogni casa e 100 € per ogni albergo.
17. Carta Grazia. Esci gratis di prigione. Puoi tenerla o scambiarla.

## Colpo di fortuna

Località di vacanza solo su due lati; gli altri due sono carte, tasse e un Rimborso. Conta molto la fortuna. Le stazioni rendono di più che sugli altri tabelloni: 40 / 80 / 160 / 280 € con 1 / 2 / 3 / 4 stazioni.

| Gruppo | Sigla | Città | Casa e albergo |
|---|---|---|---|
| 1. Salento | SAL | Gallipoli, Otranto | 50 |
| 2. Langhe | LAN | Barolo, Alba | 50 |
| 3. Cinque Terre | CTE | Vernazza, Monterosso | 100 |
| 4. Lago di Garda | GAR | Bardolino, Malcesine | 100 |
| 5. Lago di Como | COM | Varenna, Bellagio | 150 |
| 6. Costiera amalfitana | AMA | Amalfi, Positano | 150 |
| 7. Dolomiti | DOL | Ortisei, Canazei | 200 |
| 8. Costa Smeralda | SME | Arzachena, Porto Cervo | 200 |

Ogni gruppo ha la bandiera della sua regione (Puglia, Piemonte, Liguria, Veneto, Lombardia, Campania, Trentino-Alto Adige, Sardegna): per questo il Garda è tutto sulla sponda veneta e le Dolomiti tutte in Trentino-Alto Adige.

### Le 40 caselle

| # | Casella | Tipo | Prezzo | Base | 1 casa | 2 case | 3 case | 4 case | Albergo |
|---|---|---|---|---|---|---|---|---|---|
| 0 | Partenza | Angolo |  |  |  |  |  |  |  |
| 1 | Gallipoli | Città, gruppo 1 | 60 | 3 | 10 | 35 | 100 | 140 | 170 |
| 2 | Otranto | Città, gruppo 1 | 80 | 5 | 20 | 55 | 145 | 200 | 240 |
| 3 | Barolo | Città, gruppo 2 | 100 | 6 | 25 | 70 | 190 | 260 | 320 |
| 4 | Alba | Città, gruppo 2 | 120 | 7 | 30 | 90 | 250 | 330 | 400 |
| 5 | Stazione Nord | Stazione | 200 |  |  |  |  |  |  |
| 6 | Vernazza | Città, gruppo 3 | 140 | 9 | 35 | 110 | 300 | 400 | 490 |
| 7 | Monterosso | Città, gruppo 3 | 160 | 11 | 45 | 140 | 360 | 480 | 580 |
| 8 | Bardolino | Città, gruppo 4 | 180 | 13 | 55 | 160 | 430 | 560 | 680 |
| 9 | Malcesine | Città, gruppo 4 | 200 | 15 | 65 | 190 | 500 | 650 | 780 |
| 10 | Prigione | Angolo |  |  |  |  |  |  |  |
| 11 | Busta | Carta |  |  |  |  |  |  |  |
| 12 | Cartolina | Carta |  |  |  |  |  |  |  |
| 13 | Imposta sul reddito | Tassa: 10% del contante |  |  |  |  |  |  |  |
| 14 | Busta | Carta |  |  |  |  |  |  |  |
| 15 | Stazione Est | Stazione | 200 |  |  |  |  |  |  |
| 16 | Cartolina | Carta |  |  |  |  |  |  |  |
| 17 | Tassa di soggiorno | Tassa: 75 € |  |  |  |  |  |  |  |
| 18 | Busta | Carta |  |  |  |  |  |  |  |
| 19 | Cartolina | Carta |  |  |  |  |  |  |  |
| 20 | Vacanza | Angolo |  |  |  |  |  |  |  |
| 21 | Varenna | Città, gruppo 5 | 220 | 17 | 75 | 220 | 570 | 740 | 880 |
| 22 | Bellagio | Città, gruppo 5 | 240 | 20 | 85 | 250 | 645 | 830 | 995 |
| 23 | Amalfi | Città, gruppo 6 | 260 | 22 | 95 | 280 | 720 | 920 | 1100 |
| 24 | Positano | Città, gruppo 6 | 280 | 25 | 105 | 320 | 805 | 1025 | 1215 |
| 25 | Stazione Sud | Stazione | 200 |  |  |  |  |  |  |
| 26 | Ortisei | Città, gruppo 7 | 300 | 28 | 120 | 360 | 890 | 1125 | 1325 |
| 27 | Canazei | Città, gruppo 7 | 320 | 31 | 135 | 400 | 980 | 1225 | 1450 |
| 28 | Arzachena | Città, gruppo 8 | 350 | 35 | 155 | 460 | 1110 | 1375 | 1615 |
| 29 | Porto Cervo | Città, gruppo 8 | 400 | 44 | 190 | 580 | 1350 | 1625 | 1925 |
| 30 | Vai in prigione | Angolo |  |  |  |  |  |  |  |
| 31 | Cartolina | Carta |  |  |  |  |  |  |  |
| 32 | Busta | Carta |  |  |  |  |  |  |  |
| 33 | Pedaggio | Tassa: 50 € |  |  |  |  |  |  |  |
| 34 | Cartolina | Carta |  |  |  |  |  |  |  |
| 35 | Stazione Ovest | Stazione | 200 |  |  |  |  |  |  |
| 36 | Busta | Carta |  |  |  |  |  |  |  |
| 37 | Rimborso | Rimborso: +50 € |  |  |  |  |  |  |  |
| 38 | Cartolina | Carta |  |  |  |  |  |  |  |
| 39 | Busta | Carta |  |  |  |  |  |  |  |

### Cartolina

1. Torna alla Partenza.
2. Vai a Otranto.
3. Vai ad Alba.
4. Vai a Monterosso.
5. Vai a Malcesine.
6. Vai a Bellagio.
7. Vai a Positano.
8. Vai a Canazei.
9. Vai a Porto Cervo.
10. Vai alla stazione più vicina.
11. Torna indietro di una casella.
12. Vai in prigione.
13. Dividendi delle tue azioni. Ricevi 50 €.
14. Borsa di studio. Ricevi 100 €.
15. Investimento riuscito. Ricevi 150 €.
16. Tassa sui rifiuti. Paga 25 €.
17. Aiuti un parente. Paga 50 €.
18. Hai perso una scommessa. Paga 50 € a ogni giocatore.
19. Ristrutturazione. Paga 25 € per ogni casa e 100 € per ogni albergo.
20. Carta Grazia. Esci gratis di prigione. Puoi tenerla o scambiarla.

## Sistema solare

Il tabellone folle (Fase 12): diverso apposta dal Monopoly classico, pieno di caso e con l'equilibrio sballato. È l'unico con le **regole folli** (`follie` nel tabellone, `cosmo` nello stato della partita); gli altri tabelloni non cambiano. Dati in `packages/engine/src/tabelloni/sistema-solare.ts`, regole in `packages/engine/src/cosmo.ts` e `regole.ts`.

**Caselle (48):** 26 città in 10 gruppi da 1 a 5, 4 mezzi spaziali (Navetta, Capsula, Astronave, Sonda), 2 servizi (Ossigeno, Rete Wi-Fi galattica), 2 Busta, 2 Cartolina, niente tasse, e 8 caselle folli.

| Gruppo | Città e prezzi | Casa e albergo |
|---|---|---|
| Luna | Tycho 60, Copernico 70 | 50 |
| Mercurio | Bacino Caloris 150 (da solo) | 100 |
| Venere | Cleopatra 120, Maxwell Montes 140 | 100 |
| Fascia degli asteroidi | Igea 80, Pallade 80, Vesta 90, Cerere 100, **Psiche 350** | 50 |
| Marte | Jezero 160, Valles Marineris 170, Olympus Mons 200 | 100 |
| Urano | Ariel 220, Miranda 240 | 150 |
| Saturno | Encelado 260, Titano 280, Anelli di Saturno 300 | 200 |
| Nettuno | Proteo 300, Nereide 310, Tritone 340 | 200 |
| Giove | Io 450, Europa 480, Callisto 500, Ganimede 520 (affitti fuori scala, albergo fino a 2550 €) | 300 |
| Plutone | Plutone 10 (da solo, affitti da 1 a 100 €) | 10 |

**Caselle folli:**
- **Fionda gravitazionale** (×2): si riparte subito della stessa somma dei dadi.
- **Wormhole** (×2): teletrasporto su una casella a caso (mai sull'altro wormhole); la casella d'arrivo vale, la Partenza no.
- **Buco nero**: risucchia il 20% del contante nel malloppo.
- **Supernova**: chi ci si ferma tira il suo dado (×½, ×1, ×1, ×2, ×2, ×2) e prende il malloppo moltiplicato. Sopra ×1 la differenza la mette la banca; con ×½ l'altra metà resta nella stella. Tetto: con la Supernova nessuno va oltre 4.000 € di contante; il resto va all'avversario con meno contante (a pari contante il primo nell'ordine dei turni; a squadre mai a un compagno), e chi ha già 4.000 € o più gli lascia tutto. Il malloppo non scende mai sotto i 100 € di partenza e cresce anche senza buchi neri, con soldi che mette la banca e che nessuno perde: 50 € a ogni giro nuovo, 25 € (polvere di stelle) ogni volta che una pedina ci passa sopra senza fermarsi, e il premio della Partenza che la Tempesta solare toglie a chi passa.
- **Roulette cosmica** (×2): uno spicchio a caso su otto (+300 €, metà del contante fino a 500 €, fan club, offri tu, wormhole, prigione, gravità invertita, dritto alla Supernova).

**Regole folli:**
- **Affitto quantistico:** ogni affitto si moltiplica per un dado: ×0, ×½, ×1, ×1, ×2, ×3.
- **Partenza a caso:** da 0 a 400 € a passi di 50 (fermandosi sopra, 100 € in più).
- **Eventi cosmici:** dal secondo giro, uno a ogni giro, estratto tra Quiete, Allineamento (affitti ×2), Eclissi (affitti ×½), Tempesta solare (la Partenza non paga: il premio va nel malloppo della Supernova), Pioggia di meteoriti (crolla un edificio sulla città più costruita di una regione a caso), Gravità invertita (dadi e fionde portano indietro; passando la Partenza si incassa lo stesso), Collisione planetaria (due proprietà di giocatori diversi si scambiano, solo in regioni senza case).
- **Mercato galattico:** a ogni giro un pianeta a caso vale ×2 o ×½, nel prezzo d'acquisto e negli affitti.
- **Dado cosmico:** a ogni lancio, insieme ai due dadi, si tira un terzo dado con sei facce tutte diverse. **Razzo**: dopo la mossa la pedina vola alla prossima proprietà libera nel verso di marcia, prima che la casella dei dadi faccia effetto (così salta anche «Vai in prigione»). **Saldi**: la proprietà libera dove si ferma costa la metà. **Bandiera**: la proprietà libera più economica del tabellone diventa sua, gratis. **Scudo**: in quel tiro non paga affitti. **Faro**: fino al suo prossimo turno le sue proprietà rendono il doppio. **Iperspazio**: la mossa dei dadi vale doppio. Il dado è truccato: il Razzo esce una volta su tre (peso 5 su 15), le altre facce 2 volte su 15 ciascuna. Si tira anche in prigione, dove contano solo Bandiera e Faro. Serve a vendere prima il tabellone: da solo il Sistema solare, con 48 caselle e 32 proprietà, ne vende una per arrivo al massimo.

**Carte:** Busta e Cartolina solo sue, con gli effetti nuovi del motore (wormhole, scambio di posto con un avversario, Robin Hood, buco nero che manda in prigione gli avversari, testa o croce, soldi per tutti, tira di nuovo, gravità invertita).

**Bilanciamento** (300 partite di 4 bot, aste accese): finiscono tutte; 183 turni in media contro i 232 di Europa; la prima regione completa arriva al turno 9 (i gruppi da una casella); chi completa Giove (in un quarto delle partite) vince il 71% delle volte; Plutone rende quasi tre volte quello che costa.

**Supernova più ricca** (2026-11-17, altre 300 partite di 4 bot, regole vecchie contro nuove): la Supernova si prende circa 8 volte a partita. Prima pagava 226 € a metà dei colpi (media 415 €, 1.009 € al 90%). La prima versione, con il dado fino a ×3 e senza tetto, pagava 1.018 € a metà dei colpi ma arrivava a 27.972 € a fine partita (buchi neri su contanti grossi, poi ×3), e chi prendeva di più dalla Supernova vinceva il 63% delle volte. Tolto il ×3 e messo il tetto di 4.000 €: la Supernova paga 1.000 € a metà dei colpi (media 1.704 €); il tetto scatta in 4 colpi su 10 e porta al più povero circa 6.000 € a partita; chi prende di più dalla Supernova vince il 43% delle volte (48% prima, 25% a caso). Le partite finiscono tutte e durano di più: 276 turni contro 251. I numeri della Supernova (100 €, 50 € a giro, 25 € a passaggio, le facce del dado, il tetto) stanno in `follie` del tabellone.

**Dado cosmico** (2026-11-17, 200 partite di bot per ogni numero di giocatori, aste spente come di serie). La parte del tabellone venduta a fine giro 3/6/9:

| | 4 giocatori | 2 giocatori |
|---|---|---|
| Senza dado cosmico | 28 / 45 / 57% | 15 / 26 / 34% |
| Dado con le facce alla pari (Razzo 1 su 6) | 37 / 62 / 78% | 20 / 34 / 45% |
| Dado truccato (Razzo 1 su 3), quello in gioco | 39 / 65 / 83% | 20 / 36 / 46% |
| Il Classico, per confronto | 32 / 53 / 68% | 17 / 31 / 42% |

**Confronto con il Classico** (2026-11-17, stesse impostazioni di serie per tutti, bot che ogni tanto propongono scambi; 300 partite in quattro, 200 in due):

| 4 giocatori | Classico | Sistema solare senza dado | Sistema solare di oggi |
|---|---|---|---|
| Durata media | 71 giri | 74 giri | 72 giri |
| Venduto a fine giro 6 / 9 | 53% / 66% | 44% / 55% | 62% / 78% |
| Prima regione completa (di almeno 2 caselle) | giro 10 | giro 8 | giro 5 |
| Prima bancarotta | giro 38 | giro 25 | giro 25 |
| Affitto medio | 150 € | 314 € | 447 € |
| Chi è primo per patrimonio al giro 10 vince | 41% | 39% | 41% |

In due: durata 73 giri nel Classico, 63 oggi; venduto a fine giro 6 30% contro 35%; prima regione completa al giro 16 contro 6; affitto medio 124 € contro 495 €; chi è primo al giro 10 vince il 55% contro il 57%. In sintesi: la partita dura come una classica, ma si vende prima, si costruisce prima e ogni affitto pesa circa tre volte tanto; la fortuna non conta più che nel Classico.

Con il Razzo più frequente gli arrivi su proprietà libere salgono da 0,65 a 0,75 per turno in quattro (0,71 con il dado alla pari). Le partite intere (300 di 4 bot) finiscono tutte ma durano di più, 308 turni contro 276 senza dado (315 con il dado alla pari), e il tetto della Supernova scatta in metà dei colpi.
