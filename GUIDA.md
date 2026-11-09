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

## Se qualcosa non va

**Il link online non funziona**

- Il link cambia a ogni accensione del gioco: copiatelo di nuovo dalla stanza. Se nella finestra nera c’è scritto «link nuovo», anche quello di prima ha smesso di funzionare.
- Se la finestra dice «non riesco ad aprire il link», il PC non raggiunge internet o Cloudflare non risponde. Il gioco riprova da solo; intanto funziona solo per chi è in casa.

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
