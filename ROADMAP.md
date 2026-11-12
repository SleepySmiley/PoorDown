# PoorDown — Roadmap

Gioco da tavolo multiplayer in stile Monopoly, da giocare con gli amici in **rete locale** o **online** (tunnel dal PC che fa da server). Replica le funzioni e le regole di richup.io, ma ha nome, grafica, tabellone e testi propri.

- **Specifica di riferimento:** i 6 report in [docs/analisi/](docs/analisi/). Ogni fase indica le sezioni da seguire.
- **Vincoli:** server su un PC della rete locale · interfaccia solo in italiano · si entra con il solo nickname · aspetto originale.

---

## 1. Perimetro

### Cosa replichiamo

| Area | Comportamento da riprodurre | Report |
|---|---|---|
| Home | Nickname (max 32, dado per nome casuale "Aggettivo Sostantivo"), crea stanza privata, entra da link, lista delle stanze aperte sul server | [01](docs/analisi/01-home-pagine-account.md) §4 |
| Stanza e lobby | Codice di 5 caratteri, link da copiare, il primo che entra diventa host, 12 colori pedina con blocco dei colori presi, kick con conferma, cambio host se esce, stanza piena con "Guarda la partita", spettatori a partita iniziata | [02](docs/analisi/02-lobby-impostazioni.md) §2–10 |
| Impostazioni (12) | Giocatori max (2–8, default 4) · stanza privata (ON) · bot (OFF) · mappa (Classica) · affitto x2 con set completo (OFF) · cassa vacanza (OFF) · aste (OFF) · niente affitto in prigione (OFF) · ipoteche (OFF) · costruzione uniforme (ON) · soldi iniziali (500–3000, default 1500) · ordine casuale (ON) | [02](docs/analisi/02-lobby-impostazioni.md) §6 |
| Turno | Dadi, doppi e "Tira ancora", 3 doppi = prigione, Via +200 passando / +300 fermandosi, acquisto, affitti automatici, tasse (10% del contante e fissa 75), 2 mazzi di carte, prigione (doppio, paga 50, carta grazia, uscita gratis al 4° turno), vacanza (salta un turno) | [03](docs/analisi/03-regole-turno.md) §2–4 |
| Economia | Case e hotel con costruzione uniforme, vendita alla banca a metà, ipoteca 50% e riscatto 110%, aste (+2/+10/+100, 10 s), scambi (soldi, proprietà, carte grazia, nota, contro-offerta, limiti 10/5), debito agganciato al creditore, bancarotta | [04](docs/analisi/04-economia-fine-partita.md) §3–9 |
| Tempo e assenze | Timer di turno (20 s di grazia + banca personale 60 s–3 min), "Chiedi tempo" / "+1 min", gioco automatico allo scadere, rimozione dopo 2 turni automatici, disconnesso rimosso dopo 2 min, votekick, kick dell'host in partita | [06](docs/analisi/06-architettura-realtime.md) §4.3, §5 |
| Fine partita | "Partita finita!", classifica per turni sopravvissuti, statistiche complete con grafico del patrimonio, "Un'altra partita" nella stessa stanza | [04](docs/analisi/04-economia-fine-partita.md) §10 |
| Extra | Bot che riempiono i posti liberi, modalità squadre, 4 tipi di tabellone, chat (con "sta scrivendo" e muto), suoni con volume, log degli eventi (50 righe) | [02](docs/analisi/02-lobby-impostazioni.md) §8, [05](docs/analisi/05-tabellone-mappe.md) |

### Cosa togliamo
Pubblicità, captcha, login e account, store e monete, karma, profili pubblici, notifiche push, condivisione social, matchmaking pubblico.

### Cosa cambiamo apposta
- **Tutto sbloccato:** 7–8 giocatori, modalità squadre e tutti i tabelloni sono gratis.
- **Mazzi nascosti:** l'ordine delle carte non viene mai inviato ai giocatori (richup lo manda a tutti).
- **Ricaricare non fa perdere il posto,** né in lobby né in partita (su richup l'host che ricarica in lobby perde ruolo e posto).
- **Timer disattivabile:** si aggiunge un'impostazione "Timer di turno" (default ON, stesso comportamento di richup).
- **Durata massima:** impostazione in più (default ON): dopo 100 turni a testa vince il patrimonio più alto, così anche le partite senza scambi finiscono.
- **Bonus di partenza:** chi gioca dopo il primo parte con un po' di soldi in più, per pareggiare il vantaggio di chi tira per primo.
- **Tabellone e carte originali:** stessa struttura e scala economica (prezzi 60–400, case 50–200), ma nomi, tema, valori e testi sono nostri.

---

## 2. Architettura

```
 PC host (rete locale)                         Amici (stessa Wi-Fi)
 ┌──────────────────────────────────┐          ┌──────────────────────┐
 │ Node.js — un solo processo       │  HTTP    │ Browser              │
 │  • serve il sito (React)         │◄────────►│ http://192.168.x.x:  │
 │  • Socket.IO: stanze e partite   │  WebSocket│   3000/room/abcde   │
 │  • motore regole (autoritativo)  │          └──────────────────────┘
 └──────────────────────────────────┘
```

| Scelta | Perché |
|---|---|
| **Monorepo TypeScript** (npm workspaces): `packages/engine`, `apps/server`, `apps/web` | Le regole si scrivono una volta sola e si usano sia sul server sia nel browser |
| **Motore puro** `apply(stato, azione, rng) → {stato, eventi}` | Deterministico e testabile; il caso (dadi, mazzi) vive solo sul server |
| **Server autoritativo con Socket.IO** | Il client invia intenzioni (tira, compra, offri…) e riceve `{ok}` oppure `{ok:false, codice, messaggio}`; il server trasmette eventi a tutta la stanza |
| **Versione dello stato + risincronizzazione** | Se un client perde un evento, chiede lo stato completo |
| **Vista filtrata per giocatore** | Ognuno riceve solo ciò che può vedere |
| **Identità con token casuale** salvato nel browser | Niente account; alla riconnessione si torna allo stesso posto |
| **Stanze in memoria** + salvataggio su file JSON | Nessun database; una partita sopravvive al riavvio del server |
| **React + Vite, zustand, framer-motion**, tabellone in HTML/CSS | Stack leggero, animazioni fluide, layout responsive |
| **Vitest** per il motore, **Playwright** per le partite multi-browser | Le regole sono il cuore del gioco e vanno coperte da test |
| **Nessuna risorsa esterna** (font, suoni e icone inclusi nel progetto) | Funziona anche senza internet |

Note per la rete locale:
- Il server ascolta su tutte le interfacce e all'avvio stampa l'indirizzo da dare agli amici. In lobby c'è anche un QR code per entrare dal telefono.
- Al primo avvio Windows chiede il permesso del firewall: va consentito sulle reti private.
- Su `http://` con un IP locale il browser blocca l'API degli appunti, quindi "Copia link" deve avere un metodo alternativo.

---

## 3. Fasi

Dimensioni indicative: **S** piccola · **M** media · **L** grande. Ogni fase si chiude con una verifica nel browser.

### Fase 0 — Fondamenta · S
- [x] Monorepo, TypeScript, lint, script `npm run dev` e `npm start`
- [x] Server Node che serve una pagina provvisoria sulla rete locale e stampa l'indirizzo IP
- [x] Git collegato a GitHub, `.gitignore`, README con istruzioni di avvio

**Fatto quando:** da un telefono sulla stessa Wi-Fi si apre la pagina di PoorDown.

### Fase 1 — Identità visiva · M
- [x] Tema e nomi del tabellone, nome delle carte (al posto di Treasure/Surprise), testi delle carte
- [x] Palette, tipografia, forma delle pedine, stile delle caselle, icone
- [x] Mockup di home, lobby e schermata di gioco

**Fatto quando:** approvi i mockup. Si può fare in parallelo alla Fase 2.

### Fase 2 — Motore: regole di base · M
- [x] Modello dati: tabellone, caselle, gruppi, giocatori, impostazioni, mazzi
- [x] Tabellone "Classico" PoorDown: 40 caselle, 8 gruppi, 4 stazioni, 2 società, 2 tasse, 3+3 caselle carta
- [x] Turno completo secondo la macchina a stati in [03 §2](docs/analisi/03-regole-turno.md): dadi, doppi, movimento, Via, acquisto, affitti (città, stazioni, società), tasse, carte (9 tipi di effetto), prigione, vacanza
- [x] Debito di base, bancarotta, fine partita, vendita delle proprietà alla banca
- [x] Test unitari per ogni regola e simulazione di partite intere

**Fatto quando:** i test simulano partite intere senza errori.

### Fase 3 — Server: stanze e tempo reale · M
- [x] Creazione stanza (codice di 5 caratteri), ingresso, scelta colore, lista giocatori, host e cambio host, kick
- [x] Impostazioni modificabili solo dall'host e solo in lobby, avvio con almeno 2 giocatori
- [x] Comandi con conferma, eventi, vista filtrata, versione dello stato e risincronizzazione
- [x] Token del giocatore e riconnessione allo stesso posto
- [x] Spettatori, chat, pulizia delle stanze inattive
- [x] In più: salvataggio delle stanze su file (la partita riprende dopo un riavvio), "Gioca" ed elenco delle stanze pubbliche, collegamento lato browser con risincronizzazione, banco di prova provvisorio su `/prova`

**Fatto quando:** due browser giocano una partita completa tramite script di test. ✔ Fatto: test di rete con due client fino alla fine della partita, più prova con tre browser Edge (partita completa, ricarica a metà partita, spettatrice, riavvio del server).

### Fase 4 — Prima partita giocabile · L ⭐
- [x] Home, pagina di ingresso alla stanza, lobby completa con le 12 impostazioni
- [x] Schermata di gioco: tabellone, pedine animate, dadi, pulsanti del turno, lista giocatori con saldi, log, chat, scheda proprietà, prigione
- [x] In più: elenco delle stanze pubbliche e "Gioca", stanza piena con "Guarda la partita", espulsione e stanza inesistente con avviso, avviso di collegamento perso, link di rete e codice QR per gli amici, vendita delle proprietà dalla lista, bancarotta, fine partita essenziale (la schermata completa arriva nella Fase 7). Tolti la pagina provvisoria e il banco di prova `/prova`
- Le impostazioni delle fasi successive (bot, timer di turno, aste, ipoteche, costruzione uniforme) si vedono in lobby con il segno "Presto" e non si possono ancora cambiare

**Fatto quando:** tu e i tuoi amici fate una partita vera in rete locale. **Primo traguardo da provare insieme.** Verificato con due e tre browser Edge: partita fino alla bancarotta, ricarica a metà partita, spettatore, espulsione, prigione, vendita.

### Fase 5 — Economia completa · L
- [x] Case e alberghi con costruzione uniforme, vendita degli edifici a metà prezzo, ipoteche e riscatto al 110% (la vendita delle proprietà c'è dalla Fase 2)
- [x] Aste: finestra sopra il tabellone uguale per tutti, rilanci +2/+10/+100, conto alla rovescia di 10 s che riparte a ogni offerta, chiusura decisa dal server
- [x] Scambi: crea, vedi, controproposta, rifiuta, ritira, osservatori (matita e occhio), tutte le regole di validità, le due regole di equità e i limiti 10/5 ([04 §4](docs/analisi/04-economia-fine-partita.md))
- [x] Debito agganciato al creditore, regole "affitto x2", "niente affitto in prigione", "cassa vacanza" (fatto nella Fase 2)
- [x] In più: il browser riceve l'ora del server, così il conto alla rovescia è giusto anche se gli orologi dei PC non coincidono; le partite salvate prima della Fase 5 riprendono; chi riceve una proposta la vede aprirsi da sola. In lobby restano con «Presto» solo bot e timer di turno

**Fatto quando:** ogni impostazione di gioco cambia davvero la partita, con test per ciascuna. ✔ Fatto: test per aste, ipoteche, costruzione uniforme e stanza privata (regola degli scambi sbilanciati), più la simulazione di 80 partite con tutte le regole accese a caso. Verificato con due browser Edge: case su una regione intera, ipoteca, due aste, scambio con nota e controproposta.

### Fase 6 — Tempo, assenze, moderazione · M
- [x] Timer di turno (grazia + banca + ricarica), "Chiedi tempo", "+1 min", gioco automatico, rimozione, bancarotta automatica in debito
- [x] Disconnessione: indicatore visibile, conto alla rovescia di 2 min, turni saltati, rimozione
- [x] Votekick, kick dell'host in partita, muto della chat
- [x] In più: se nessun giocatore è collegato la partita si ferma e riprende da dove era (anche dopo un riavvio del server); se l'host esce per tempo, assenza o voto il ruolo passa al primo giocatore rimasto; le partite salvate prima della Fase 6 riprendono. In lobby resta con «Presto» solo l'impostazione dei bot

**Fatto quando:** una partita va avanti da sola se qualcuno chiude il browser o si allontana. ✔ Fatto: test del motore per ogni regola del tempo e del voto, simulazione di 80 partite con assenze, pause, tempi scaduti, voti ed espulsioni. Verificato con due browser Edge e un terzo giocatore da script: tempo chiesto e regalato, turno giocato in automatico, giocatrice scollegata tolta dopo 2 minuti, browser chiuso a metà turno fino alla fine della partita, voto senza timer, espulsione dell'host, chat silenziata.

### Fase 7 — Fine partita e statistiche · S
- [x] Schermata finale, coriandoli, classifica per turni sopravvissuti
- [x] Statistiche: grafico del patrimonio nel tempo, durata, turni, doppi, scambi, messaggi, casella più visitata, più volte in prigione
- [x] "Un'altra partita" nella stessa stanza, "Torna alla home"
- [x] In più: il grafico risponde al passaggio del mouse con i valori di tutti e ogni linea finisce con la pedina del giocatore (i colori delle pedine possono somigliarsi); se l'host non è collegato, "Un'altra partita" la può avviare un altro giocatore; le partite salvate prima della Fase 7 riprendono

**Fatto quando:** a fine partita tutti vedono vincitore, classifica e statistiche, e possono giocarne un'altra nella stessa stanza. ✔ Fatto: test del motore per ogni statistica e per la classifica, controlli di coerenza nella simulazione di 80 partite, test della stanza per "Un'altra partita". Verificato con due browser Edge e un terzo giocatore da script: coriandoli solo per chi vince, "In attesa dell'host…" per gli altri, ritorno in lobby con gli stessi posti e una nuova partita avviata.

### Fase 8 — Bot, squadre, altri tabelloni · L
- [x] Bot che riempiono i posti liberi: comprano, costruiscono, offrono alle aste, rispondono agli scambi
- [x] Modalità squadre: set condivisi, chat di squadra, eredità dei beni in bancarotta
- [x] Tre tabelloni alternativi originali: lungo (48 caselle, 3 società), gruppi grandi, metà carte ([docs/identita/tabelloni-alternativi.md](docs/identita/tabelloni-alternativi.md))
- [x] In più: i bot entrano a ondate come su richup, aspettano che finiscano le animazioni prima di muovere, seguono il voto, danno tempo a chi lo chiede e ogni tanto propongono di comprare l’ultima città di una loro regione; chi arriva in una stanza piena prende il posto di un bot. Squadre scelte da ognuno (l’host le rinomina, sposta i giocatori e le mescola), turni alternati tra le squadre, grafico del patrimonio anche per squadra. Scelta del tabellone in lobby con miniatura. Le stanze salvate prima della Fase 8 riprendono

**Fatto quando:** i bot completano una partita da soli, a squadre i compagni condividono regioni, stazioni e servizi ed ereditano i beni, e i quattro tabelloni si giocano tutti. ✔ Fatto: test del motore per ogni regola delle squadre e per le decisioni dei bot, 24 partite di soli bot su tutti i tabelloni (nessun blocco, nessuna mossa rifiutata), simulazione di 80 partite con tabelloni e squadre a caso, test della stanza per arrivo dei bot, squadre e chat di squadra. Verificato in Edge: lobby con bot e squadre, scelta dei tabelloni, partita a squadre con bot fino alla vittoria della squadra, partita sul tabellone Europa.

### Revisione dopo la Fase 8
- [x] Giro di 10 agenti: 5 a caccia di bug (motore del turno, economia e bot, server, sincronizzazione del browser, partita vera) e 5 sulla qualità (chiarezza del turno, tabellone, animazioni, scambi e aste, direzione artistica)
- [x] Corretti i bug trovati, ognuno con il suo test: il server non crolla più con un file delle stanze rovinato, soldi giusti a squadre e nella cassa della Vacanza, case vendibili a squadre, bot che valutano gli scambi in blocco e partite di soli bot che finiscono, offerte tardive all'asta rifiutate, riconnessione senza animazioni vecchie, espulsione e proposte viste anche dopo uno stacco, bozza dello scambio salva durante l'asta e a inizio turno, affitto giusto nella scheda della città, timer che non sfarfalla, rientro dalla home. Le regole cambiate sono nel §4
- [x] Migliorie di qualità approvate, in tre ondate:
  - **Fondamenta:** token di colori, caratteri, spazi e durate (`stili/token.css`), componenti unici (pulsanti, pannelli, finestre, chip), cifre a palette vere, uscite animate con Motion, tempi delle scene in un posto solo (`engine/tempi.ts`, letti da regia e bot).
  - **Grafica:**
    - tabellone premium: blocchi del proprietario con case e albergo, corsia delle pedine, angoli che informano, dadi d'avorio, scheda della città come biglietto, carte Busta e Cartolina;
    - nuova disposizione della partita, con il cartello del turno al centro e il timer dentro;
    - variazioni dei saldi, evento corrente e registro corto;
    - scambi letti dalla propria parte, con gli effetti sulle regioni e un editor più rapido;
    - home come tabellone delle partenze, lobby compatta, fine partita come tabellone degli arrivi, marchio e favicon.
  - **Animazioni:**
    - gettoni che volano da chi paga a chi incassa;
    - cambio di turno, carta pescata al centro, pedina con passi accelerati e casella d'arrivo;
    - acquisti e case, prigione, bancarotta;
    - dadi con il totale e «DOPPIO»;
    - biglietto delle proposte di scambio con il timbro dell'esito, «Chiedila a…» dalla scheda della città;
    - il cartello del turno racconta la scena.
  - **Turno tra bot:** in media il 4% più breve di prima.
- [x] Giro di verifica finale con due persone vere: assenze e voto, debito e bancarotta, scambi, controllo visivo di tutte le schermate a 1440 e 1920. Tutto funziona; corretti le impostazioni bloccate che andavano a capo e «a»/«ad» davanti ai nomi («Tocca ad Anna»). Non provata dal vivo la Vacanza
- [x] Migliorie proposte dalla verifica e approvate:
  - «Rientra nella stanza» in home anche dopo una scheda chiusa (comando `posto_tenuto`), con riquadro e pulsante blu;
  - iniziali con la «O» che non si confonde con lo zero;
  - voce di registro e titoli propri per la modifica della propria proposta.

### Fase 9 — Rifinitura · M
- [x] Suoni originali o liberi da diritti, con volume salvato
  - 38 suoni sintetizzati nel browser (Web Audio, nessun file), sul tema della stazione: gong degli annunci per «Tocca a te», obliteratrice per gli acquisti, fischietto del capotreno all'inizio, sbarre di ferro della prigione, monete, martelletto dell'asta;
  - partono dalla regia nell'istante della loro animazione; quelli che riguardano gli altri giocatori suonano più piano;
  - gong ripetuto ogni minuto se tocca a te e la scheda è nascosta, ticchettio negli ultimi 10 s del tuo turno e negli ultimi 3 dell'asta;
  - volume 0–100 con muto in home, lobby e testata di gioco, salvato nel browser; pagina `/suoni` per ascoltarli tutti (solo con `npm run dev`)
- ~~Layout per telefono e tablet, accessibilità di base~~ tolto: si gioca solo da PC e l'accessibilità non serve (decisione del 2026-11-08)
- [x] Test end-to-end con 4 browser: quattro Edge con identità separate giocano dai pulsanti veri una partita intera (stanza privata, aste accese, 1.000 € a testa, 54 turni): dadi, doppi, prigione, acquisti, aste con quattro offerenti, chat, ricarica a metà partita, tre bancarotte, fine partita e «Un'altra partita». Saldi uguali su tutti i browser a ogni controllo, coriandoli solo per chi vince, nessun errore in console
- [x] Bilanciamento, misurato con 1000 partite di bot per tabellone (durata, vantaggio di chi parte primo, regioni decisive). Ritocchi approvati:
  - **durata massima** (nuova impostazione, accesa): dopo 100 turni a testa vince il patrimonio più alto; il registro avvisa quando mancano 10 turni a testa e il cartello degli arrivi dice perché è finita. Senza, il 64–100% delle partite di bot senza scambi non finiva;
  - **bonus di partenza**: chi gioca dopo il primo parte con il 5% dei soldi iniziali in più per ogni posto (2,5% in due); le vittorie per posizione passano da 29/27/23/21% a circa 25% ciascuno;
  - **prezzi**: case del Lazio (Classico) 150 €, della Polonia (Europa) 200 €, del Sud e del Nord (Grandi aree) 125 e 150 €; stazioni di Colpo di fortuna 40/80/160/280 €
- [x] Avvio con doppio clic su Windows e guida per gli amici
  - `Avvia PoorDown.cmd`: controlla Node.js (se manca apre il sito per scaricarlo), installa i pacchetti solo la prima volta e dopo un aggiornamento, prepara il sito in silenzio, accende il server e apre il browser quando è pronto; se il gioco è già acceso apre solo il browser. Chiudendo la finestra il server salva le partite;
  - [GUIDA.md](GUIDA.md): come entrare con il link, come accendere il gioco, cosa fare se gli amici non si collegano

### Fase 10 — Gioco online · S
Scelta del 2026-11-09: un **tunnel rapido di Cloudflare** dal PC che fa da server (gratis, senza account né configurazione del modem), invece di un server in cloud.
- [x] `npm run online` (e il doppio clic) apre il tunnel dopo l'accensione: `cloudflared` installato sul PC, oppure scaricato da solo la prima volta nella cartella dei dati
- [x] Il link `https://….trycloudflare.com` si annuncia solo quando risponde da internet (controllo con un DNS pubblico, così nessun computer si ricorda un «sito non trovato»); se il tunnel non parte o cade, si riprova da solo e intanto si gioca in casa
- [x] **Copia** e il codice QR danno il link online appena c'è; la pagina lo ricontrolla ogni 30 s e quando si torna sulla scheda
- [x] Chi arriva da internet non riceve gli indirizzi della rete di casa; in modalità sviluppo il tunnel non si accende
- [x] Verificato con due Edge, l'host sul PC e l'ospite dal link pubblico: lobby, inizio partita, dadi, WebSocket `wss://`, ricarica con il posto ritrovato, tunnel chiuso a forza e riaperto con un link nuovo
- Limite: il link cambia a ogni accensione e il browser lega il giocatore all'indirizzo, quindi chi gioca da lontano non ritrova il posto nelle partite riprese. Un indirizzo fisso richiede un tunnel con nome (account Cloudflare e dominio)

### Fase 11 — Estensione di VS Code · M
Scelta del 2026-11-12: un'estensione che accende il server di sempre e mostra il sito in un riquadro, invece di riscrivere il sito per le webview. Da pubblicare sul Marketplace.
- [x] `apps/vscode`: comandi Avvia (anche online), Avvia solo per la rete di casa, Entra in una partita con un link, Copia l'indirizzo, Pannello di controllo (apertura e nome/password senza terminale), Messaggi del server, Spegni; barra di stato con gli indirizzi e «Tocca a te»; impostazione `poordown.porta`
- [x] Il server gira con il Node.js di VS Code in un processo a parte, parla con l'estensione sul canale IPC e si spegne salvando quando lei lo chiede o sparisce; se sulla porta c'è già un PoorDown si usa quello
- [x] Il sito, dentro VS Code, manda il titolo alla scheda e copia i link tramite l'estensione (solo link http(s), al massimo uno al secondo)
- [x] `npm run estensione` crea `poordown.vsix` (1,2 MB) con estensione, server in un file solo, sito e licenze dei 120 pacchetti inclusi
- [x] Verificato in una copia isolata di VS Code 1.125 con il `.vsix` scompattato, lontano dai pacchetti del progetto: attivazione, accensione, gioco caricato nel riquadro che risponde all'estensione, secondo Avvia senza secondo server, spegnimento con porta liberata e partite salvate. Il server compilato, provato a parte: porta occupata, spegnimento chiesto e VS Code che sparisce
- [x] I link della rete di casa (`http://192.168…`) si aprono nel riquadro come quelli online
- [ ] Gioco online dentro l'estensione non provato (su questo PC manca `cloudflared`): il tunnel è lo stesso di `npm run online`
- [x] Editore `PoorDown` creato sul Marketplace; licenza MIT
- [ ] Pubblicazione: caricare `poordown.vsix` dalla pagina dell'editore (vedi README)

---

## 4. Punti non verificati su richup e come li trattiamo

| Punto | Scelta per PoorDown |
|---|---|
| Uscita di prigione con un doppio | Esci e muovi di quel tiro, senza tiro extra |
| Conto alla rovescia dell'asta dopo un rilancio | Riparte da 10 s (da rivedere dopo le prove) |
| Arrotondamento della tassa del 10% | All'intero più vicino |
| Rimozione per timeout | Dopo 2 turni giocati in automatico, come nel codice di richup |
| Proprietà di chi fa bancarotta | Tornano alla banca libere, senza asta automatica |
| Impostazioni dopo "Un'altra partita" | Restano quelle della partita precedente |
| Cronologia della chat per chi entra dopo | Mostrati gli ultimi 50 messaggi |
| Chi chiude la pagina in lobby | Tiene il posto per 2 minuti, poi lo perde (e il ruolo di host passa al successivo) |
| Codice della stanza | 5 caratteri senza 0/o e 1/l/i, per poterlo dettare a voce |
| Carte "Ogni giocatore ti dà" e "Paga a ogni giocatore" senza contante | Il debito si aggancia come per l'affitto (richup non lo aggancia) |
| Tirare i dadi con il saldo negativo | Non si può, né prima né dopo il lancio: prima si vende o si dichiara bancarotta |
| Offerta di partenza dell'asta | Nessuna offerta (0 €): i primi rilanci valgono 2, 10 o 100 € (richup parte da 2 €) |
| Migliore offerente che fa bancarotta durante l'asta | Torna valida l'offerta precedente, invece di lasciare la proprietà invenduta |
| Turno durante l'asta | Fermo: il giocatore di turno aspetta la fine dell'asta. Scambi e bancarotta restano possibili |
| Costruire prima di tirare i dadi | Si può, sempre e solo nel proprio turno (anche in prigione) |
| Regola sul debito negli scambi | Lo scambio non deve togliere niente ai creditori: conta quello che incassano subito più quello che potrebbero recuperare dopo. Conta solo quello che si deve ad altri giocatori: il rosso verso la banca da solo non blocca gli scambi |
| Offerte all'asta dopo la scadenza | Non valgono e non riaprono il conto alla rovescia: prima di ogni mossa (anche dei bot) il server applica le scadenze già passate. Allo zero il browser spegne i rilanci |
| Cassa della Vacanza | Entra solo quanto è pagato davvero; la parte non pagata entra quando il rosso si rimborsa, e se il giocatore fallisce prima non entra |
| Chi può regalare tempo, e quanto | Ogni altro giocatore in gioco, un "+1 min" a testa per turno, al massimo 2 minuti a turno; mai durante l'asta |
| Ricarica della banca di tempo | Da 20 s (turno finito subito) a 6 s (grazia usata tutta), in proporzione; nessuna ricarica dopo un tempo scaduto |
| Turno di chi è scollegato | Ha solo la grazia di 20 s da quando sparisce (anche senza timer), poi il gioco tira e finisce il turno per lui; gli altri possono dargli "+1 min". La grazia non si consuma durante un'asta |
| Nessun giocatore collegato | La partita si ferma: niente turni automatici né rimozioni. Quando torna qualcuno, gli orologi ripartono da dove erano. Chi è già uscito dalla partita e guarda non conta; con solo bot in gioco la partita va avanti finché qualcuno guarda |
| Voto senza timer di turno | Si può votare sempre contro chi gioca; il primo voto fa partire 5 minuti, scaduti i quali esce comunque se non ha finito il turno |
| Voto dopo un'uscita | Se dopo l'uscita di un altro giocatore i voti già dati raggiungono la nuova maggioranza, chi gioca esce subito |
| Kick dell'host in partita | Solo nelle stanze private, non durante il turno del giocatore e solo da un host ancora in gioco; chi è espulso perde anche il posto (non scrive più in chat) e torna alla home, anche se era scollegato quando è successo |
| Host in partita | Resta host finché è in gioco, o finché guarda dopo essere uscito. Se è fuori e non è collegato, il ruolo passa alla prima persona collegata ancora in gioco; se esce per tempo, assenza o voto passa subito, preferendo chi è collegato |
| «Esci» con due schede | Chi esce da una scheda non libera il posto se lo stesso browser ne ha un'altra aperta sulla stanza |
| Rientro dalla home | Chi lascia una partita in corso (logo, tasto Indietro) trova in home «Rientra nella stanza» finché il posto è tenuto; in partita il logo chiede conferma a chi è ancora in gioco |
| Muto della chat | Per singolo giocatore, salvato in questo browser: i suoi messaggi spariscono e si riattivano dal riquadro della chat |
| Posti dopo "Un'altra partita" | Restano seduti tutti i giocatori della stanza con lo stesso colore (su richup devono rientrare tutti); chi non è collegato ha 2 minuti per tornare, come in lobby. Chi preme "Torna alla home" a partita finita lascia il posto |
| Chi avvia "Un'altra partita" | L'host; gli altri vedono "In attesa dell'host…". Se l'host non è collegato può farlo qualunque giocatore seduto, che diventa host |
| Coriandoli | Solo per chi vince, e solo se vede la fine dal vivo (non ricaricando la pagina dopo) |
| Durata della partita | Non conta il tempo in cui la partita è rimasta ferma perché nessun giocatore era collegato |
| Grafico del patrimonio | Un punto alla fine di ogni turno; la linea di chi esce si ferma all'ultimo turno in cui era in gioco |
| Classifica a pari turno | Chi esce più tardi, nello stesso turno, sta davanti. A squadre tutta la squadra vincitrice sta in testa, anche chi è uscito presto |
| Proprietà più visitata | Conta le soste (non i passaggi); a pari soste vince la prima del tabellone. In prigione, a pari merito, si mostrano tutti |
| Arrivo dei bot | Uno ogni 2,5–6 secondi finché ci sono posti liberi, solo se al tavolo c’è almeno una persona; un bot espulso è rimpiazzato dopo un secondo. Abbassando il massimo dei giocatori escono prima i bot; se se ne vanno tutte le persone, escono anche i bot |
| Stanza piena di bot | Chi arriva prende il posto dell’ultimo bot entrato (su richup trova la stanza piena). Anche «Gioca» porta nelle stanze piene di bot, prima in quelle con più persone |
| Elenco e pulizia delle stanze | L'elenco pubblico non mostra le stanze senza persone sedute. Le stanze senza persone sedute e senza nessuno collegato si chiudono dopo 5 minuti, le altre dopo 30 |
| Limiti per scheda | 5 stanze al minuto (creazione e «Gioca»), 5 messaggi ogni 2 s, «sta scrivendo» al più 1 al secondo |
| Testi invisibili | Un nome fatto solo di caratteri invisibili diventa casuale, un nome di squadra torna quello predefinito, un messaggio così è rifiutato |
| File delle stanze rovinato | Le stanze rovinate si saltano con un avviso, le altre si caricano; del file resta una copia `stanze.json.rotto-<data>` |
| Ritmo dei bot | Muovono quando i browser hanno finito le animazioni, più circa un secondo; all’asta rilanciano dopo 1–2 s, agli scambi rispondono dopo 2–3,5 s. Se nessuna persona in gioco è collegata si fermano, come la partita |
| Scambi dei bot | Rispondono a tutti valutando prezzi e regioni sulla partita come sarebbe dopo lo scambio (non cedono a poco le città che completano la regione di un avversario, neanche in blocco). Propongono di comprare l’ultima o le ultime due città di una regione se sono dello stesso avversario, fino a 3 volte il prezzo; senza soldi offrono in cambio una loro proprietà. Nelle regioni grandi già tutte comprate comprano una città alla volta da chi ne ha di meno, al massimo al doppio del prezzo. Al massimo una proposta ogni 8 turni; ritirano le proposte che non si possono più fare |
| Voto e tempo con i bot | I bot non cominciano mai un voto: votano solo dopo che l’ha fatto una persona, solo contro chi è assente (scollegato, o con l’ultimo turno giocato in automatico perché ha finito il tempo) e mai contro un compagno. Regalano «+1 min» a chi lo chiede |
| Formazione delle squadre | Fino a 4 squadre; ognuno entra in quella che vuole, l’host sposta chiunque e può mescolarle. Accendendo le squadre i seduti si dividono in due; chi arriva va nella squadra più piccola. Nomi «Squadra 1–4», l’host li cambia (max 20 caratteri) |
| Ordine dei turni a squadre | Alternato tra le squadre (un giocatore per squadra, a giro), così i compagni non giocano di seguito |
| Squadre: regioni, stazioni, servizi | Si contano insieme a quelli dei compagni (costruzione, affitto doppio, affitti di stazioni e servizi); su una città costruisce solo chi la possiede. Con la costruzione uniforme la regione sale insieme a quella dei compagni, ma per vendere case contano solo le proprie città |
| Erede a squadre | Il primo compagno ancora in gioco dopo chi esce, nell’ordine dei turni. Vale per ogni uscita (bancarotta, tempo, assenza, voto, espulsione). Se chi esce ha saldo ≥ 0 le proprietà passano così come sono, con edifici e ipoteche. L’erede prende anche i crediti: chi doveva soldi a chi esce li deve al compagno (senza erede il debito si cancella e il debitore resta in rosso verso la banca) |
| Bancarotta a squadre con debito | Vale per chi esce con il saldo negativo, anche se il rosso è solo verso la banca: si pagano i creditori, poi il rosso verso la banca, il resto va in contanti al compagno, le proprietà tornano alla banca. Se così una regione della squadra resta incompleta, gli edifici dei compagni lì tornano alla banca a metà prezzo |
| Vittoria a squadre | Vince tutta la squadra rimasta, anche chi era già uscito: coriandoli e «vincitore» in classifica per tutti i suoi giocatori |
| Chat di squadra | La leggono solo i giocatori seduti che erano nella squadra quando il messaggio è stato scritto (non gli spettatori, non chi entra nella squadra dopo); «sta scrivendo» arriva solo ai compagni; i messaggi contano nelle statistiche |
| Affitti dei tabelloni alternativi | Ricavati dal prezzo con la scala del Classico, così l’economia resta la stessa |
| Durata massima | 100 turni per ogni giocatore seduto all’inizio (contano tutti i turni, anche quelli di chi poi esce). Vince il patrimonio più alto tra chi è in gioco (soldi, carte grazia, proprietà non ipotecate e edifici al prezzo pieno); a squadre la squadra con la somma più alta; a pari merito chi viene prima nei turni. In classifica chi è ancora in gioco sta davanti per patrimonio. Le partite cominciate prima della regola continuano senza limite |
| Bonus di partenza | 5% dei soldi iniziali per ogni posto dopo il primo nell’ordine dei turni, arrotondato ai 5 € (2,5% in due): con 1500 € e quattro giocatori 0, +75, +150, +225. Vale anche a squadre e con «Un’altra partita» |

---

## 5. Decisioni prese

1. **Tema del tabellone:** città italiane, una regione per gruppo ([docs/identita/tabellone-e-carte.md](docs/identita/tabellone-e-carte.md)).
2. **Stile grafico:** "Partenze", il cartello di stazione (mockup in `apps/web/src/mockup/`).
3. **Mazzi e testi:** Busta e Cartolina, tono sobrio.
4. **Prezzi e affitti:** scala nostra, nella stessa tabella del tabellone.
5. **Tabelloni alternativi:** Europa (città europee), Grandi aree (macroaree italiane), Colpo di fortuna (località turistiche italiane) ([docs/identita/tabelloni-alternativi.md](docs/identita/tabelloni-alternativi.md)).
6. **Squadre:** le sceglie ognuno; l’host le rinomina, sposta i giocatori e le mescola.
7. **Dispositivi:** solo PC e portatili (1440×900 e 1920×1080); niente layout per telefono né accessibilità.
8. **Impaginazione:** libera. Non deve più ricalcare richup: conta che il gioco sia chiaro a colpo d'occhio, bello e animato.
9. **Gioco online:** tunnel rapido di Cloudflare dal PC che fa da server, acceso dal doppio clic; la rete di casa resta come prima.
