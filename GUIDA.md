# Come si gioca a PoorDown con gli amici

PoorDown si gioca nel browser. Un PC accende il gioco, gli altri ci entrano con un link, da casa o da qualunque altro posto. Non servono account né installazioni per chi si collega.

## Se ti hanno mandato un link

1. Apri il link nel browser del tuo PC o portatile (Chrome, Edge o Firefox). È fatto così: `https://parole-a-caso.trycloudflare.com/stanza/abcde`.
2. Scrivi il tuo nome (o tira il dado per uno a caso) e premi **Entra nella partita**. Poi scegli il colore della pedina e premi di nuovo **Entra nella partita**.
3. Aspetta che chi ha creato la stanza prema **Inizia la partita**.

Durante la partita:

- **Come si gioca** (il punto di domanda in alto) spiega le regole.
- L’**altoparlante** in alto regola il volume dei suoni. Quando tocca a te suona un gong, anche se stai guardando un’altra scheda.
- Se chiudi la pagina per sbaglio, riapri lo stesso link: ritrovi il tuo posto. Hai **2 minuti** per tornare, poi perdi il posto; intanto i tuoi turni passano da soli.
- A squadre, se finisci in rosso un bot della tua squadra può offrirti i soldi che servono: si apre una proposta di scambio, premi **Accetta**.

## Il tabellone Giro del mondo

Sul Giro del mondo ci sono regole che valgono solo lì. Le città di un paese stanno su lati diversi del tabellone e i prezzi sono a casaccio: Å costa 1 €, Hell 666 €.

**Volare.** Invece di tirare i dadi puoi premere **Vola**: sul tabellone si accendono le caselle dove puoi atterrare, ne clicchi una e sulla carta d’imbarco premi di nuovo **Vola**.

- Il biglietto costa 50, 100 o 150 € secondo la distanza: i prezzi sono scritti sul tabellone e sulla carta d’imbarco.
- Lo paghi a chi possiede l’aeroporto del lato dove sei, o alla banca se è libero. Se l’aeroporto è tuo (o della tua squadra) paghi metà.
- Puoi volare solo dopo essere passato almeno una volta dalla Partenza: lì ritiri il passaporto.
- In volo non passi dalla Partenza, quindi niente 200 €. Non si atterra sulla Partenza né su Vai in prigione, e dalla prigione non si vola.
- La Cartolina **Biglietto omaggio** ti fa muovere ancora, e se voli il biglietto è gratis.

**La morra cinese.** Se finisci su una proprietà di un avversario puoi pagare l’affitto oppure sfidarlo a morra cinese: scegli sasso, carta o forbici, poi lui sceglie il suo segno senza vedere il tuo. Se vinci non paghi niente, se perdi paghi il doppio, se pareggiate paghi l’affitto normale. Hai 15 secondi per decidere, se no paghi; lui ne ha 10 per rispondere, se no il suo segno è a caso.

**Le caselle strane.**

- **Triangolo delle Bermuda:** sparisci e ricompari su una casella a caso, che vale come se ci fossi arrivato (anche Vai in prigione).
- **Linea del cambio di data:** guadagni un giorno e ti muovi ancora, ma solo se ci arrivi con i dadi: in volo la sorvoli.
- **Buca per l’altra parte del mondo:** sbuchi dall’altra parte del tabellone, a Batman.

**Le carte rare.** Ogni tanto, al posto di una Busta o di una Cartolina, esce una carta rara:

- **Bancarotta:** sei fuori dalla partita. Non esce mai nei primi due giri.
- **Vita extra:** uno a caso tra chi è uscito per bancarotta torna in gioco, dalla Partenza, con i soldi iniziali e senza proprietà (e deve ritirare di nuovo il passaporto).
- **Reset:** tutte le proprietà tornano alla banca, case comprese; i soldi restano a chi li ha. Esce al massimo una volta a partita.

**L’ultimo rimasto.** Se qualcuno è uscito per bancarotta, chi resta da solo non vince subito: deve giocare ancora 3 turni (a squadre, 3 a testa), perché intanto una Vita extra può far rientrare qualcuno. In quei turni la Vita extra esce molto più spesso, una carta su quattro.

## Se accendi tu il gioco

Serve un PC con Windows. La prima volta:

1. Installa **Node.js** dal sito [nodejs.org](https://nodejs.org): scarica la versione **LTS** e installala lasciando le opzioni come sono.
2. Scarica PoorDown (da GitHub: pulsante verde **Code** → **Download ZIP**) ed estrai la cartella dove vuoi, per esempio nei Documenti.

Ogni volta che volete giocare:

1. Apri la cartella di PoorDown e fai **doppio clic su «Avvia PoorDown»**. Si apre una finestra nera e poco dopo il browser con il gioco. La prima volta la finestra scarica quello che serve: ci vuole qualche minuto e serve internet.
2. Se Windows chiede il permesso del firewall per Node.js, spunta **Reti private** e premi **Consenti accesso**.
3. Scrivi il tuo nome e premi **Crea una stanza privata**.
4. Aspetta che nella finestra nera compaia la riga **Online** (qualche secondo). Poi nella stanza premi **Copia** e manda il link agli amici (WhatsApp, Telegram, come preferite): inizia con `https://` e funziona da qualunque posto.
5. Quando avete finito, **chiudi la finestra nera**: il gioco si spegne. Le partite a metà restano salvate e riprendono alla prossima accensione, ma il link online cambia: chi gioca da lontano ne riceve uno nuovo e non ritrova il suo posto. Le partite online conviene finirle nella stessa serata.

La finestra nera deve restare aperta mentre giocate (si può ridurre a icona). Il PC non deve andare in sospensione.

## Il pannello di controllo

Il pannello serve a chi ha acceso il gioco per sistemare a mano una partita: ridare i soldi dopo un errore, spostare una pedina, passare il turno, togliere chi se n’è andato. Le modifiche arrivano subito a tutti e non passano dalle regole del turno, quindi usalo con giudizio.

**Attivarlo (una volta sola)**

1. Accendi il gioco almeno una volta con «Avvia PoorDown»: la prima accensione scarica anche quello che serve al pannello.
2. Apri la cartella di PoorDown, clicca sulla barra dell’indirizzo in alto, scrivi `cmd` e premi Invio. Si apre una finestra nera già in quella cartella.
3. Scrivi `npm run pannello` e premi Invio. Scegli un nome e una password di almeno 8 caratteri (mentre la scrivi vedi solo asterischi), poi ripeti la password.

Nome e password valgono subito, anche a gioco acceso. Sul PC non restano scritti in chiaro: se li dimentichi, rifai il comando e scegline di nuovi. Per spegnere il pannello scrivi `npm run pannello -- --togli`.

Con l’estensione di VS Code non serve la finestra nera: usa il comando **PoorDown: Imposta l’accesso al pannello di controllo**, e per aprirlo **PoorDown: Apri il pannello di controllo**.

**Entrare**

Nel gioco non c’è un pulsante che porta al pannello: aggiungi `/pannello` all’indirizzo del gioco. Sul PC che l’ha acceso è `http://localhost:3000/pannello`. Funziona anche con il link online (`https://parole-a-caso.trycloudflare.com/pannello`), quindi da qualunque posto: per questo la password deve essere buona e non va data a chi gioca.

Dopo 5 tentativi sbagliati l’accesso si blocca per 15 minuti. Una volta dentro resti dentro per 12 ore, o finché non spegni il gioco.

**Cosa si può fare**

A sinistra ci sono tutte le stanze accese, a destra quella che scegli, aggiornata dal vivo. Per ogni stanza:

- **Giocatori**: nome, soldi, casella, prigione, Vacanza e carte Grazia di ognuno; **Dai il turno** a qualcuno o **Togli** dalla partita. Prima dell’inizio puoi rinominare, espellere e scegliere chi è l’host.
- **Proprietà**: chi possiede cosa, case e albergo, ipoteche.
- **Turno e dadi**: a chi passa il turno e quanto fa il prossimo tiro dei dadi.
- **Regole e fine**: accendere o spegnere le regole facoltative, i soldi nella cassa della Vacanza, finire la partita scegliendo chi vince.
- **Registro**: tutto quello che è successo nella stanza, con l’ora.
- **Stato completo**: l’intera partita in formato testo (JSON), per quello che le altre sezioni non coprono. Toccalo solo se sai cosa stai cambiando: il gioco rifiuta le modifiche che non tornano.

In alto, **Annulla l’ultima modifica** rimette le cose com’erano, finché la partita non è andata avanti. **Chiudi la stanza** la chiude per tutti.

## Se qualcosa non va

**Il link online non funziona**

- Il link cambia a ogni accensione del gioco: copiatelo di nuovo dalla stanza. Se nella finestra nera c’è scritto «link nuovo», anche quello di prima ha smesso di funzionare.
- Se la finestra dice «non riesco ad aprire il link», il PC non raggiunge internet o Cloudflare non risponde. Il gioco riprova da solo; intanto funziona solo per chi è in casa.
- Se la finestra dice che cloudflared scaricato «non è quello atteso», PoorDown l’ha cancellato senza avviarlo, per sicurezza. Dopo tre volte il gioco online si spegne fino alla prossima accensione: chiudi la finestra nera e riaccendi il gioco. Se succede ancora, qualcosa sulla connessione modifica i file scaricati (per esempio un antivirus o un proxy): intanto si gioca solo in casa.

**In casa, gli amici non riescono ad aprire il link che inizia con `http://192.168…`**

- Devono essere sullo stesso Wi-Fi del PC che ha acceso il gioco. Le reti «ospiti» e quelle di lavoro spesso non lasciano parlare i dispositivi tra loro.
- Su quel PC la rete deve essere **privata**: Impostazioni → Rete e Internet → Wi-Fi (o Ethernet) → Tipo di profilo di rete → **Privata**.
- Se al primo avvio avete negato il permesso del firewall: Pannello di controllo → Windows Defender Firewall → Consenti app → spunta **Node.js** su **Privata**.
- Se la finestra nera mostra più indirizzi «Per gli amici», provate anche gli altri.

**Il doppio clic non apre il gioco**

- Se la finestra dice che manca Node.js o che è troppo vecchio, installa la versione LTS da [nodejs.org](https://nodejs.org) e riprova.
- Se il gioco è già acceso, il doppio clic apre solo il browser: va bene così.

**Non si sente niente**

- Il browser fa partire i suoni solo dopo il primo clic sulla pagina.
- Controlla l’altoparlante in alto: se è barrato, i suoni sono spenti.
