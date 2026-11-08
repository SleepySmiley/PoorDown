# Diagnosi del tabellone: confronto con richup

Data: 2026-11-08. Analisi fatta da 4 agenti (geometria, caselle, colore, stato di gioco) sul mockup `apps/web/src/mockup/schermate/` a 1440×900. A questa risoluzione i due tabelloni sono larghi entrambi 820 px. Le misure in `px` sono riferite a quel lato. `k` è l'unità di `--k` in `tabellone.css`.

## In una frase

La geometria è già quella di richup. Il problema è che da noi il colore ha quattro significati insieme: regione, tipo di casella, angolo e proprietario. Su richup ne ha uno solo, il proprietario. Il resto (bandiere, nomi, prezzi) è bianco o grigio su un fondo calmo.

## Cause, in ordine di impatto

1. **Aloni colorati.** Lo stemma ingrandito e sfocato tinge ogni casella (`tabellone.css:115-171`).
   - Pixel saturi sull'anello di caselle: noi 38,6% senza proprietà, richup 11,8%.
   - Il contrasto del nome cambia con la regione: scende a 3,4:1 su Lazio (Roma, Latina, Viterbo). Richup sta sempre tra 8,9 e 10,7:1.
2. **Pedine e regioni hanno gli stessi colori.** g3=p2, g4=p3, g5=p5, g6=p1, g7=p6 (`partenze.css:28-55`).
   - Su Siena stemma, alone e blocco del proprietario sono tutti verdi: il blocco di Marco sembra "la fascia della Toscana".
   - Su richup il gruppo è una bandiera. L'unico colore pieno è il proprietario.
3. **Blu dappertutto.** Quattro angoli blu pieni (`tabellone.css:330-348`), più stazioni, Lombardia, pulsante, timer e pedina di Davide.
   - Lombardia e blu segnaletica sono quasi indistinguibili (ΔE 0,036).
   - Su richup gli angoli hanno lo stesso fondo delle caselle.
4. **Mosaico invece di pista.** Fughe di 3 px, una cornice e quattro piani scuri, con contrasto casella/centro di 1,1:1.
   - Richup: caselle attaccate (spazio 0), fondo piatto, contrasto casella/centro 1,36:1.
5. **Caselle poco leggibili.**
   - Nomi a 13,5 px, contro maiuscole del 35% più alte su richup.
   - Sigla dello stemma a 7,6 px, che non si legge.
   - L'ordine icona/nome cambia da un lato all'altro.
   - 8 nomi su 40 vanno a capo (richup: 2).
   - Le icone sono a linea sottile e da 26 px. Quelle di richup sono piene e grandi.
   - Gli angoli hanno troppo testo.
6. **Le tasse sembrano in vendita:** «10%» e «75 €» stanno nell'etichetta del prezzo (`Tabellone.tsx:184`).
7. **Centro senza un punto focale.** I dadi sono di 78 px (richup ~110). Il registro è 543×313 px e le righe 2-3 sono quasi bianche (richup le fa grigie dalla seconda).
8. **Pedine ambigue.**
   - Sul tabellone c'è una sagoma senza iniziale, nella lista un disco con l'iniziale.
   - 4 pedine occupano 88 px su una casella di 65.
   - Il turno è un alone ambra di 40×15 px, che quasi non si vede.
9. **Tabellone che rimpicciolisce.** Sotto gli 820 px scala tutto: a 1280×720 i nomi sono a 10,5 px. Richup resta a 820 e mette le colonne sotto il tabellone.
10. **Dettagli.**
    - Albergo illeggibile.
    - Il prigioniero copre la scritta «Prigione».
    - La Vacanza non mostra la cassa.
    - Su una proprietà ipotecata la scheda evidenzia comunque un affitto.
    - L'aria-label della casella non dice chi la possiede.

## Cosa cambiare

### Colore (`tabellone.css`, `partenze.css`, `comuni.tsx`)

- Eliminare `.casella__sfondo` e `.casella__alone` per tutti i tipi di casella (`tabellone.css:115-171`, `Tabellone.tsx:174-176`).
- Casella piatta `#2a2e37`, hover `#343945`, fondo e centro `#111317`. Etichetta del prezzo `#4a5160`.
- Testi: nomi `#f4f1e8`, secondari `#a9b0bc`, carte `#ffb81c`.
- Colori delle regioni **solo nello stemma** e nella testata della scheda. Stemma con bordo `#111317` da 1,5, senza ombra e senza sigla (`comuni.tsx:82-86`, `tabellone.css:183`).
- Togliere l'ombra del testo (`tabellone.css:199`).
- Angoli col fondo delle caselle; il blu resta solo nel quadratino dell'icona.
- Sbarre della prigione bianche al 30% su `#353b46` (`tabellone.css:393`).
- Colori delle pedine diversi da tutti i colori delle regioni.
- Prova già fatta iniettando il CSS nella pagina: i pixel saturi passano dal 38,6% al 4,2% e tutti i nomi arrivano a 12:1.

### Geometria (`tabellone.css`, `geometria.ts`, `tavolo.css`)

- Griglia con `gap: 0`, senza padding, senza cornice e senza ombra.
- Angolo a `1.53fr` (`geometria.ts:9`). Il valore va tenuto in un solo posto, perché oggi è ripetuto in TS e in CSS. A 820 px si ottiene 104/68 px, come richup.
- Raggi: caselle 6k, angoli esterni del tabellone 10k.
- Centro trasparente: diventa il fondo della pagina.
- Lato del tabellone `clamp(560px, min(100vh - 80px, 100vw - 604px), 1000px)`. Sotto ~1180 px di larghezza, tabellone sopra e colonne sotto, come richup.

### Caselle (`tabellone.css`, `Tabellone.tsx`, `dati.ts`, `icone.tsx`)

Una regola per tutti e quattro i lati, dal centro verso l'esterno: simbolo, nome, prezzo o proprietario.

| Casella | Simbolo | Nome | Bordo esterno |
|---|---|---|---|
| Città | stemma 32×37 a cavallo del bordo | 17 px, 700, una riga (nomi lunghi 14 px) | prezzo o blocco del proprietario |
| Stazione, servizio | icona 30 px | nome breve 15 px, una riga | prezzo o blocco del proprietario |
| Tassa | icona 30 px, importo a 12 px sotto | nome breve 15 px | niente etichetta |
| Carta | icona piena 42 px | 15 px ambra, verso l'esterno | — |
| Angolo | pittogramma 48 px | una sola etichetta, 16 px | stato (cassa della Vacanza) |

- Aggiungere `breve` in `dati.ts`: «Nord», «Imposta», «Luce», «Acqua»… Il nome completo resta nella scheda e nell'aria-label.
- Togliere i testi sotto il nome degli angoli («Ritira 200 €», «Salti un turno»).
- Icone piene, non a linea.

### Stato di gioco (`Tabellone.tsx`, `tabellone.css`, `lobby.css`, `partenze.css`)

- Il blocco del proprietario sul bordo esterno resta l'unico colore pieno della casella.
- Case: una casa + «×N» in Barlow Condensed 600. Albergo: icona di circa 18k su una piastrina.
- Pedine: lo stesso disco con iniziale della lista, circa 30k con anello bianco, sempre dentro la casella.
  - 1 pedina al centro, 2 affiancate, 3-4 in griglia 2×2 all'80%.
  - Turno: anello ambra netto da 2k, senza sfumatura.
- Prigione: sbarre sopra le pedine, scritta fuori dalla zona delle pedine.
- Vacanza: «In cassa 75 €» quando la regola è attiva.
- Scheda di una proprietà ipotecata: nessuna riga di affitto evidenziata.
- Centro:
  - dadi circa 105k, l'elemento dominante;
  - pulsante alto 40k;
  - spazi timer→dadi→pulsante circa 30k;
  - registro a 13-14 px, solo la prima riga chiara, nomi senza grassetto.

## Da tenere

- Impianto a tre colonne con le misure di richup, griglia 11×11, giro orario, rotazione dei lati.
- Stemma a cavallo del bordo interno, prezzo su etichetta neutra (9,8:1), blocco del proprietario al posto del prezzo, con l'animazione d'entrata.
- Grafite quasi neutra, più calma dell'indaco di richup.
- Ambra riservata a carte, turno e selezione.
- Barlow Condensed 700 in maiuscole e minuscole.
- Ipoteca a righe.
- Prigione divisa tra cella e «In visita».
- Scheda della proprietà, lista dei giocatori, «X sta giocando…», registro che sfuma.
- Tutte le misure in `--k`.

## Decisioni prese (2026-11-08) e stato

- **Pedine e regioni:** i colori delle regioni restano solo nello stemma. Le pedine hanno 12 colori chiari (`partenze.css`, `--p1…--p12`), lontani da tutte le regioni (ΔE OKLab ≥ 0,08) e sempre con testo scuro (contrasto ≥ 5,8:1).
- **Angoli:** grigi come le altre caselle, con il blu solo nel riquadro del pittogramma.
- **Applicata** sul mockup il 2026-11-08: caselle da 104/68 px a 820, tutti i nomi su una riga.
- **Non fatto:** la scritta «In cassa» sulla Vacanza, perché nel mockup la regola è spenta.
- **Ancora aperto:** il blu segnaletica. La memoria di progetto dice `#14427F`, il codice usa `--segnale: #2a64c8`.
