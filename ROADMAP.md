# PoorDown — Roadmap

Gioco da tavolo multiplayer in stile Monopoly, da giocare con gli amici in **rete locale**. Replica le funzioni e le regole di richup.io, ma ha nome, grafica, tabellone e testi propri.

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
- [ ] Bot che riempiono i posti liberi: comprano, costruiscono, offrono alle aste, rispondono agli scambi
- [ ] Modalità squadre: set condivisi, chat di squadra, eredità dei beni in bancarotta
- [ ] Tre tabelloni alternativi originali: lungo (48 caselle, 3 società), gruppi grandi, metà carte

### Fase 9 — Rifinitura · M
- [ ] Suoni originali o liberi da diritti, con volume salvato
- [ ] Layout per telefono e tablet, accessibilità di base
- [ ] Test end-to-end con 4 browser, bilanciamento dopo le partite di prova
- [ ] Avvio con doppio clic su Windows e guida per gli amici

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
| Regola sul debito negli scambi | Lo scambio non deve togliere niente ai creditori: conta quello che incassano subito più quello che potrebbero recuperare dopo |
| Chi può regalare tempo, e quanto | Ogni altro giocatore in gioco, un "+1 min" a testa per turno, al massimo 2 minuti a turno; mai durante l'asta |
| Ricarica della banca di tempo | Da 20 s (turno finito subito) a 6 s (grazia usata tutta), in proporzione; nessuna ricarica dopo un tempo scaduto |
| Turno di chi è scollegato | Ha solo la grazia di 20 s da quando sparisce (anche senza timer), poi il gioco tira e finisce il turno per lui; gli altri possono dargli "+1 min" |
| Nessun giocatore collegato | La partita si ferma: niente turni automatici né rimozioni. Quando torna qualcuno, gli orologi ripartono da dove erano |
| Voto senza timer di turno | Si può votare sempre contro chi gioca; il primo voto fa partire 5 minuti, scaduti i quali esce comunque se non ha finito il turno |
| Kick dell'host in partita | Solo nelle stanze private e non durante il turno del giocatore; chi è espulso perde anche il posto (non scrive più in chat) e torna alla home |
| Muto della chat | Per singolo giocatore, salvato in questo browser: i suoi messaggi spariscono e si riattivano dal riquadro della chat |
| Posti dopo "Un'altra partita" | Restano seduti tutti i giocatori della stanza con lo stesso colore (su richup devono rientrare tutti); chi non è collegato ha 2 minuti per tornare, come in lobby. Chi preme "Torna alla home" a partita finita lascia il posto |
| Chi avvia "Un'altra partita" | L'host; gli altri vedono "In attesa dell'host…". Se l'host non è collegato può farlo qualunque giocatore seduto, che diventa host |
| Coriandoli | Solo per chi vince, e solo se vede la fine dal vivo (non ricaricando la pagina dopo) |
| Durata della partita | Non conta il tempo in cui la partita è rimasta ferma perché nessun giocatore era collegato |
| Grafico del patrimonio | Un punto alla fine di ogni turno; la linea di chi esce si ferma all'ultimo turno in cui era in gioco |
| Classifica a pari turno | Chi esce più tardi, nello stesso turno, sta davanti |
| Proprietà più visitata | Conta le soste (non i passaggi); a pari soste vince la prima del tabellone. In prigione, a pari merito, si mostrano tutti |

---

## 5. Decisioni prese

1. **Tema del tabellone:** città italiane, una regione per gruppo ([docs/identita/tabellone-e-carte.md](docs/identita/tabellone-e-carte.md)).
2. **Stile grafico:** "Partenze", il cartello di stazione (mockup in `apps/web/src/mockup/`).
3. **Mazzi e testi:** Busta e Cartolina, tono sobrio.
4. **Prezzi e affitti:** scala nostra, nella stessa tabella del tabellone.
