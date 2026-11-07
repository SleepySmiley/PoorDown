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
- [ ] Tema e nomi del tabellone, nome delle carte (al posto di Treasure/Surprise), testi delle carte
- [ ] Palette, tipografia, forma delle pedine, stile delle caselle, icone
- [ ] Mockup di home, lobby e schermata di gioco

**Fatto quando:** approvi i mockup. Si può fare in parallelo alla Fase 2.

### Fase 2 — Motore: regole di base · M
- [ ] Modello dati: tabellone, caselle, gruppi, giocatori, impostazioni, mazzi
- [ ] Tabellone "Classico" PoorDown: 40 caselle, 8 gruppi, 4 stazioni, 2 società, 2 tasse, 3+3 caselle carta
- [ ] Turno completo secondo la macchina a stati in [03 §2](docs/analisi/03-regole-turno.md): dadi, doppi, movimento, Via, acquisto, affitti (città, stazioni, società), tasse, carte (9 tipi di effetto), prigione, vacanza
- [ ] Debito di base, bancarotta, fine partita
- [ ] Test unitari per ogni regola

**Fatto quando:** i test simulano partite intere senza errori.

### Fase 3 — Server: stanze e tempo reale · M
- [ ] Creazione stanza (codice di 5 caratteri), ingresso, scelta colore, lista giocatori, host e cambio host, kick
- [ ] Impostazioni modificabili solo dall'host e solo in lobby, avvio con almeno 2 giocatori
- [ ] Comandi con conferma, eventi, vista filtrata, versione dello stato e risincronizzazione
- [ ] Token del giocatore e riconnessione allo stesso posto
- [ ] Spettatori, chat, pulizia delle stanze inattive

**Fatto quando:** due browser giocano una partita completa tramite script di test.

### Fase 4 — Prima partita giocabile · L ⭐
- [ ] Home, pagina di ingresso alla stanza, lobby completa con le 12 impostazioni
- [ ] Schermata di gioco: tabellone, pedine animate, dadi, pulsanti del turno, lista giocatori con saldi, log, chat, scheda proprietà, prigione

**Fatto quando:** tu e i tuoi amici fate una partita vera in rete locale. **Primo traguardo da provare insieme.**

### Fase 5 — Economia completa · L
- [ ] Case e hotel con costruzione uniforme, vendita edifici e proprietà, ipoteche e riscatto
- [ ] Aste: finestra condivisa, rilanci, conto alla rovescia
- [ ] Scambi: crea, vedi, contro-proposta, annulla, osservatori, tutte le regole di validità e i limiti ([04 §4](docs/analisi/04-economia-fine-partita.md))
- [ ] Debito agganciato al creditore, regole "affitto x2", "niente affitto in prigione", "cassa vacanza"

**Fatto quando:** ogni impostazione di gioco cambia davvero la partita, con test per ciascuna.

### Fase 6 — Tempo, assenze, moderazione · M
- [ ] Timer di turno (grazia + banca + ricarica), "Chiedi tempo", "+1 min", gioco automatico, rimozione, bancarotta automatica in debito
- [ ] Disconnessione: indicatore visibile, conto alla rovescia di 2 min, turni saltati, rimozione
- [ ] Votekick, kick dell'host in partita, muto della chat

**Fatto quando:** una partita va avanti da sola se qualcuno chiude il browser o si allontana.

### Fase 7 — Fine partita e statistiche · S
- [ ] Schermata finale, coriandoli, classifica per turni sopravvissuti
- [ ] Statistiche: grafico del patrimonio nel tempo, durata, turni, doppi, scambi, messaggi, casella più visitata, più volte in prigione
- [ ] "Un'altra partita" nella stessa stanza, "Torna alla home"

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

---

## 5. Decisioni aperte

1. **Tema del tabellone:** città italiane, luoghi inventati, tema ironico sulla povertà (in linea con il nome), o altro.
2. **Stile grafico** (Fase 1): si sceglie sui mockup.
3. **Nomi dei due mazzi di carte** e tono dei testi.
