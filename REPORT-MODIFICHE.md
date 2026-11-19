# Report delle modifiche: correzioni 1–5

> **File temporaneo per la revisione della pull request.** Spiega a chi la revisiona cosa cambia, quali file sono stati toccati e perché. Non serve al gioco né alla build: **si può cancellare dopo il merge**, o nello stesso merge.

Branch `correzioni-e-squadre`, sopra `main` al commit `bdcae37` («Giro del mondo: bilanciamento con il passaporto»). Sono 49 file (35 modificati, 14 nuovi compreso questo report), con circa 2.500 righe aggiunte e 130 tolte. Più di metà delle righe nuove di codice sono test (1.262).

Ci sono sei commit, uno per punto più uno per i documenti, in quest'ordine: 1, 2, 3, 4, 5, documenti. Si possono rivedere uno alla volta, e **ognuno passa da solo** lint, tipi e test.

## In breve

| # | Richiesta | Cosa cambia | Parti toccate |
|---|---|---|---|
| 1 | cloudflared con verifica di versione e checksum | Versione fissata (2026.11.1) con le impronte SHA-256 nel codice: un cloudflared scaricato si avvia solo se l'impronta coincide | server |
| 2 | Ordine dei mazzi casuale a ogni giro | Quando esce l'ultima carta, il mazzo si rimescola con il caso della partita | motore |
| 3 | Il suono delle puntate smette con i rilanci veloci | Causa: il browser contava le offerte in elenco, che il server ferma a 20. Ora segue l'importo dell'offerta migliore | web |
| 4 | Squadre: colori e costruzione | Proprietà colorate per squadra (con interruttore) e nuova regola facoltativa «Costruzione di squadra» | motore, server, web |
| 5 | Soldi dal bot compagno in caso di bancarotta | Il bot offre al compagno in rosso i soldi che servono quando conviene alla squadra e accetta le sue richieste; il gioco automatico accetta l'aiuto invece della bancarotta | motore, server |

I punti sono indipendenti tra loro. Solo il 4 e il 5 riguardano entrambi le partite a squadre: sono stati provati anche insieme (vedi Verifiche).

## Verifiche

| Controllo | Risultato |
|---|---|
| `npx eslint .` | nessun problema |
| `npm run typecheck` (4 workspace) | nessun errore |
| `npx vitest run` | **47 file, 606 test superati**: i 527 di `main` e 79 nuovi |
| Ogni commit da solo | lint, tipi e test superati: 546 → 554 → 561 → 585 → 606 test |
| `npm run build` | riuscita; bundle principale 801 KB (246 KB gzip), di cui circa 3 KB per queste modifiche |
| `npm run build -w apps/vscode` (solo compilazione, niente `.vsix`) | riuscita; il server impacchettato non contiene più `releases/latest` |
| Prova combinata dei punti 4 e 5 (script temporaneo, non incluso) | 60 partite a squadre di soli bot, 10 per tabellone compreso il Giro del mondo, con costruzione di squadra e aiuto dei bot accesi insieme. Tutte finite, nessuna mossa rifiutata, stato coerente dopo ogni azione. Nelle partite: 1.999 edifici su città dei compagni, 189 aiuti accettati, 112 sfide a morra, 474 voli |

**Non verificato:**
- **Aspetto nel browser.** Nell'ambiente di lavoro non c'era un browser: vedi la lista «Da controllare a mano» in fondo.
- **Flusso reale del tunnel**, cioè scaricamento seguito dall'avvio di cloudflared. Il file per Windows è stato scaricato e la sua impronta confrontata a mano, senza eseguirlo; i singoli passaggi sono coperti dai test.
- **Pacchetto `.vsix`**: non è stato creato.

## Riallineamento con il Giro del mondo

Le modifiche sono nate su `e13a2ae`. Nel frattempo su `main` sono arrivati due commit: `e61596d` (biglietto aereo, sfida a morra, caselle strane) e `bdcae37` (passaporto). Il branch è stato riportato sopra il più recente. Il secondo non ha dato conflitti; il primo li ha dati solo nel punto 5, e li ho risolti tenendo il codice di tutti e due:
- **[bot.ts](packages/engine/src/bot.ts):** la sezione «Giro del mondo: voli e sfide» e la proposta d'aiuto (`propostaDiAiuto`) erano state aggiunte nello stesso punto: ora stanno una dopo l'altra, ognuna con la sua intestazione. Ho unito anche i commenti in testa al file e quello di `mossaBot`.
- **[regole.ts](packages/engine/src/regole.ts):** il conflitto era solo nel commento di `giocaInAutomatico`; il codice si è unito da solo. Il ciclo si ferma anche con la sfida aperta (`|| s.sfida`) e, prima della bancarotta automatica, accetta l'aiuto della squadra.

Come convivono le due funzioni:
- In `mossaBot` il bot risponde prima alla morra e poi agli scambi. L'offerta d'aiuto è uno scambio, quindi, come gli altri scambi, si può fare anche mentre una sfida è aperta.
- Un compagno può finire in rosso anche perdendo una morra (affitto doppio): l'aiuto vale anche in quel caso.
- Le simulazioni dei punti 4 e 5 girano su tutti i tabelloni, quindi ora anche sul Giro del mondo, e passano.

---

## 1. cloudflared: versione fissata e impronta SHA-256

**Problema.** `tunnel.ts` scaricava cloudflared da `releases/latest` e lo eseguiva senza nessun controllo. Il gioco online lo fa partire su ogni PC che accende il gioco.

**Soluzione.** cloudflared si sceglie in quest'ordine:
1. **Quello installato sul PC.** Si usa solo se `cloudflared --version` dice almeno 2026.11.1. Si cerca solo nelle cartelle assolute del PATH, mai nella cartella corrente, perché su Windows `spawn` guarderebbe prima lì.
2. **La copia già scaricata nella cartella dei dati.** Se ne ricontrolla l'impronta a ogni accensione. Se non coincide (per esempio la vecchia copia presa da `latest`) si cancella e si riscarica.
3. **Uno scaricamento nuovo** da `releases/download/2026.11.1/<file>`. Si scrive in un file `.parziale`, se ne calcola lo SHA-256 e lo si rinomina solo se coincide; altrimenti lo si cancella senza eseguirlo.

Su macOS si verifica l'archivio `.tgz` prima di estrarlo, lo si estrae in una cartella a parte e si verifica anche il programma estratto. Dopo 3 scaricamenti con l'impronta sbagliata nella stessa accensione il gioco online si spegne, con un messaggio, invece di riscaricare 50 MB all'infinito; la rete di casa continua a funzionare.

| File | Perché |
|---|---|
| [apps/server/src/tunnel-verifica.ts](apps/server/src/tunnel-verifica.ts) (nuovo) | Versione fissata e tabella delle impronte (`CLOUDFLARED`), `FILE_PER_SISTEMA` spostata qui, e le funzioni di verifica: `versioneDa`, `confrontaVersioni`, `improntaFile`, `cercaNelPath`, `scaricaVerificato`, `indirizzoScaricamento`. In testa c'è la **procedura per aggiornare versione e impronte** |
| [apps/server/src/tunnel.ts](apps/server/src/tunnel.ts) | `trovaProgramma` riscritto con l'ordine qui sopra; limite agli scaricamenti con impronta sbagliata; `fileDaScaricare` ri-esportato, così `tunnel.test.ts` resta com'era |
| [apps/server/src/tunnel-verifica.test.ts](apps/server/src/tunnel-verifica.test.ts) (nuovo) | 19 test, nessuno usa la rete (`fetch` finto, indirizzi `.invalid`) |

**Da sapere per gli aggiornamenti futuri.** Le impronte vengono dal campo `digest` dell'API di GitHub, controllate con l'elenco «SHA256 Checksums» della release.
- Per i 6 file Windows e Linux le due fonti coincidono.
- Per i due `.tgz` di macOS l'elenco della release riporta l'impronta del **programma dentro l'archivio**, non dell'archivio. Per questo la tabella ha due impronte: `sha256` per l'archivio e `programma` per l'eseguibile. Un test fallisce se manca la seconda.

**Limiti accettati:**
- Del cloudflared installato si controlla solo la versione, non l'impronta: ci si fida di ciò che sta nelle cartelle del PATH.
- La 2026.11.1 era uscita da due giorni. Se si preferisce una versione più collaudata, basta seguire la procedura.

## 2. Mazzi rimescolati a ogni giro

**Problema.** I mazzi si mescolavano una sola volta a inizio partita e poi ciclavano sempre nello stesso ordine. Gli eventi `carta`, mandati a tutti, contengono l'indice della carta: dopo un giro (17–21 carte) un browser modificato poteva sapere la carta successiva.

**Soluzione.** In `pesca`, quando esce l'ultima carta, il mazzo si rimescola tutto con il caso della partita (`crypto` sul server) e riparte da 0. Il rimescolamento è immediato, così lo stato salvato e quello del pannello hanno sempre `prossima` dentro il mazzo. La Carta Grazia resta nel mazzo e si salta finché qualcuno la tiene, anche dopo un rimescolamento. Il vecchio `for (;;)` ha ora un limite di due giri. Nessun evento nuovo: il rimescolamento non si vede, come quello di un mazzo vero.

| File | Perché |
|---|---|
| [packages/engine/src/regole.ts](packages/engine/src/regole.ts) | `pesca`: rimescolamento a fine giro e ciclo con limite |
| [packages/engine/src/tipi.ts](packages/engine/src/tipi.ts) | Solo il commento di `Mazzo` |
| [packages/engine/src/prove.ts](packages/engine/src/prove.ts) | Nuovo aiuto di test `dadiPoi`: i dadi scelti, poi un altro caso (il rimescolamento chiede altri numeri) |
| [packages/engine/src/regole.test.ts](packages/engine/src/regole.test.ts) | Il test «il mazzo ricomincia dalla prima carta» è diventato «si rimescola e riparte»: il comportamento cambia apposta |
| [packages/engine/src/mazzi.test.ts](packages/engine/src/mazzi.test.ts) (nuovo) | 7 test: ogni giro contiene ogni carta una volta e i giri sono diversi tra loro; seme fisso ripetibile; Grazia saltata anche dopo i rimescolamenti; stato coerente per il pannello; la vista dei browser non contiene l'ordine |
| [apps/server/src/stanze/dadi-e-mazzi.test.ts](apps/server/src/stanze/dadi-e-mazzi.test.ts) (nuovo) | Con i dadi decisi dal pannello, i dadi escono come scelti e il mazzo si rimescola con il caso vero |

Partite salvate: la forma dello stato non cambia, quindi nessuna migrazione.

## 3. Suono delle puntate all'asta

**Problema.** `useSuoniAsta` suonava solo se cresceva `asta.offerte.length`. Il server però tiene solo le ultime 20 offerte (`OFFERTE_MOSTRATE` in `economia.ts`): dalla ventunesima la lunghezza resta 20 e i rilanci non suonavano più. Con le puntate veloci ci si arriva in fretta. Lo stesso errore c'era nelle chiavi React di `Asta.tsx`: dopo 20 offerte la bolla «+X €» non ripartiva e le righe dell'elenco cambiavano testo invece di scorrere.

**Soluzione.** Dentro un'asta ogni rilancio deve superare il migliore, quindi l'importo dell'offerta migliore cresce sempre ed è unico: è la nuova identità del rilancio. La scelta del suono è una funzione pura e testata. Quando più rilanci arrivano insieme suona una volta sola, e suona «superato» se nel frattempo il mio rilancio è già stato battuto. Se l'offerta migliore torna indietro, perché chi l'aveva fatta è uscito dalla partita, non suona niente. Il server non cambia.

| File | Perché |
|---|---|
| [apps/web/src/suoni/rilanci.ts](apps/web/src/suoni/rilanci.ts) (nuovo) | `ricordoAsta` e `suonoRilancio`: funzioni pure, senza Web Audio |
| [apps/web/src/suoni/richiami.ts](apps/web/src/suoni/richiami.ts) | `useSuoniAsta` usa le funzioni qui sopra |
| [apps/web/src/schermate/Asta.tsx](apps/web/src/schermate/Asta.tsx) | Chiavi della bolla e delle righe dell'elenco: l'importo invece della lunghezza o della posizione |
| [apps/web/src/suoni/rilanci.test.ts](apps/web/src/suoni/rilanci.test.ts) (nuovo) | 7 test con il motore vero. Il primo dimostra che l'elenco si ferma a 20 offerte; gli altri provano 30 rilanci di fila, rilanci arrivati insieme, la bancarotta di chi aveva l'offerta migliore e un'asta nuova |

## 4. Squadre: colori di squadra e costruzione di squadra

### Colori di squadra sulle proprietà
- Le squadre ora hanno un colore: `--sq1…--sq4` (arancio, azzurro, giallo, viola) in `token.css`. Sono chiari come le pedine, con il testo scuro sopra, e distinguibili anche da chi confonde rosso e verde.
- Nelle partite a squadre il blocco del proprietario sul tabellone prende il colore della squadra e tiene **l'iniziale di chi possiede la città**. Così la squadra si riconosce dal colore e il giocatore dall'iniziale.
- Lo stesso colore compare su: puntini delle regioni negli scambi, numero della squadra (`Binario`) in lobby, elenco dei giocatori, chat e fine partita, fascia dei riquadri delle squadre in lobby, linee delle squadre nel grafico finale.
- L'interruttore **Colori di squadra** in fondo all'elenco dei giocatori torna ai colori delle pedine. Compare solo nelle partite a squadre ed è acceso di base. È una preferenza di chi guarda, salvata nel browser come il volume (localStorage dentro try/catch, rispetta `?profilo=`), e non cambia il gioco.
- Il pannello di controllo mostra sempre i colori dei giocatori: lì serve sapere esattamente chi possiede cosa.

### Costruzione di squadra (nuova regola facoltativa)
- Nuova impostazione `costruzioneDiSquadra`, **spenta di base**. Vale solo con `squadre` accese, e il motore controlla sempre entrambe.
- Chiunque della squadra costruisce anche sulle città dei compagni e **paga chi costruisce**.
- Restano valide le regole di sempre: regione completa della squadra, niente ipoteche nella regione, costruzione uniforme sull'intera regione, soldi sufficienti. Verso gli avversari non cambia niente.
- **Gli edifici li vende solo chi possiede la città**, perché appartengono alla città chiunque li abbia pagati. L'alternativa, cioè lasciarli vendere anche a chi li ha pagati incassando lui, è stata scartata: un compagno potrebbe smontare gli investimenti degli altri.
- `azioniPossibili` propone `costruisci` anche sulle città dei compagni: da qui i bot costruiscono lì senza cambiare il loro codice.
- Nell'interfaccia si costruisce cliccando la città del compagno sul tabellone, con il pulsante «Costruisci una casa per 100 €: paghi tu», attivo secondo `verifica`.
- Il registro scrive «Anna costruisce una casa ad Aosta, di Bruno, per 50 €». Per questo l'evento `costruzione` ha il campo facoltativo `proprietario`.
- La regola si può accendere e spegnere anche dal pannello di controllo.

| File | Perché |
|---|---|
| [packages/engine/src/tipi.ts](packages/engine/src/tipi.ts) | `Impostazioni.costruzioneDiSquadra`; `proprietario?` nell'evento `costruzione` |
| [packages/engine/src/impostazioni.ts](packages/engine/src/impostazioni.ts) | Predefinito `false` |
| [packages/engine/src/conti.ts](packages/engine/src/conti.ts) | `costruzioneDiSquadra(stato)` (tollera la chiave mancante nelle partite vecchie) e `puoCostruireSu(stato, id, casella)` |
| [packages/engine/src/economia.ts](packages/engine/src/economia.ts) | `verificaCostruzione` accetta le città dei compagni; `costruisci` mette il proprietario nell'evento; vendita invariata |
| [packages/engine/src/regole.ts](packages/engine/src/regole.ts) | `azioniPossibili`: `costruisci` anche sulle città dei compagni |
| [packages/engine/src/pannello.ts](packages/engine/src/pannello.ts) | La regola entra in `REGOLE_MODIFICABILI` |
| [packages/engine/src/descrivi.ts](packages/engine/src/descrivi.ts) | Testo del registro con «, di Marco,» |
| [packages/engine/src/index.ts](packages/engine/src/index.ts) | Esporta `costruzioneDiSquadra` e `puoCostruireSu` |
| [apps/server/src/stanze/lettura.ts](apps/server/src/stanze/lettura.ts) | La chiave nuova accetta solo `true`/`false` |
| [apps/web/src/stili/token.css](apps/web/src/stili/token.css) | Tavolozza `--sq1…--sq4` e `--su-squadra` |
| [apps/web/src/ui/squadre.ts](apps/web/src/ui/squadre.ts) (nuovo) | Funzioni pure: `coloreSquadra`, `colorePedina`, `tintaProprietario`, `cittaDelCompagno` |
| [apps/web/src/rete/coloriSquadra.ts](apps/web/src/rete/coloriSquadra.ts) (nuovo) | La preferenza «colori di squadra» di chi guarda |
| [apps/web/src/schermate/Tabellone.tsx](apps/web/src/schermate/Tabellone.tsx) | Tinta di squadra sul blocco del proprietario; numero della squadra nella scheda della città |
| [apps/web/src/ui/PuntiRegione.tsx](apps/web/src/ui/PuntiRegione.tsx) | I puntini usano la stessa tinta del tabellone |
| [apps/web/src/ui/comuni.tsx](apps/web/src/ui/comuni.tsx) | `Pedina` accetta una `tinta` facoltativa |
| [apps/web/src/schermate/Colonne.tsx](apps/web/src/schermate/Colonne.tsx) | `Binario` nel colore della squadra |
| [apps/web/src/schermate/Squadre.tsx](apps/web/src/schermate/Squadre.tsx), [apps/web/src/stili/squadre.css](apps/web/src/stili/squadre.css) | Fascia colorata dei riquadri in lobby, stile del `Binario` |
| [apps/web/src/schermate/ColonnaGioco.tsx](apps/web/src/schermate/ColonnaGioco.tsx), [apps/web/src/stili/tavolo.css](apps/web/src/stili/tavolo.css) | Componente `ColoriDiSquadra` con l'interruttore |
| [apps/web/src/schermate/Gioco.tsx](apps/web/src/schermate/Gioco.tsx) | Interruttore sotto i giocatori; «Costruisci…: paghi tu» sulla città del compagno; consiglio di «Le mie proprietà»; etichetta di «Costruisci» in una funzione sola (`etichettaCostruisci`) |
| [apps/web/src/schermate/Grafico.tsx](apps/web/src/schermate/Grafico.tsx) | Le linee delle squadre nel colore della squadra (prima: quello del primo giocatore) |
| [apps/web/src/schermate/EventoCorrente.tsx](apps/web/src/schermate/EventoCorrente.tsx) | «…, di Marco» nella scheda dell'evento |
| [apps/web/src/schermate/Impostazioni.tsx](apps/web/src/schermate/Impostazioni.tsx) | Nuova riga in lobby, visibile solo con le squadre accese (campo `visibile` delle voci) |
| [apps/web/src/schermate/Home.tsx](apps/web/src/schermate/Home.tsx) | L'icona della regola tra quelle non standard, solo per le stanze a squadre |
| [apps/web/src/pannello/Partita.tsx](apps/web/src/pannello/Partita.tsx) | Etichetta della regola nel pannello, mostrata solo nelle partite a squadre |
| [packages/engine/src/costruzione-squadra.test.ts](packages/engine/src/costruzione-squadra.test.ts) (nuovo) | 15 test: regola accesa e spenta, chi paga, uniformità, avversari, vendita, `azioniPossibili`, registro, pannello, partite senza la chiave; con partite simulate e di soli bot |
| [apps/server/src/stanze/costruzione-squadra.test.ts](apps/server/src/stanze/costruzione-squadra.test.ts) (nuovo) | 4 test: lettura della chiave, flusso completo in una stanza, stanze salvate prima della regola |
| [apps/web/src/ui/squadre.test.ts](apps/web/src/ui/squadre.test.ts) (nuovo) | 5 test sulle funzioni dei colori |

## 5. Bot che aiuta il compagno in rosso

### Soluzioni valutate

| Soluzione | Pro | Contro | Scelta |
|---|---|---|---|
| (a) Il bot propone di sua iniziativa uno scambio-regalo al compagno in rosso | Usa gli scambi di oggi: niente protocollo nuovo né interfaccia; la proposta si apre da sola con una nota e chi la riceve decide; tutto finisce nel registro | Serve un clic, e chi è assente non può accettare | **Sì** |
| (b) Il bot accetta le richieste di soldi del compagno in rosso | Si chiede con l'editor degli scambi che c'è già | Il giocatore deve sapere che si può fare | **Sì** |
| (c) Nuova azione «dona» tra compagni, senza accettazione | Un clic in meno | Tanta superficie nuova (azione, verifica, eventi, protocollo, `lettura.ts`, pulsante); muove soldi senza il consenso di chi li riceve, e quei soldi vanno subito ai creditori | No |
| (d) Salvataggio automatico dentro la bancarotta | Nessun clic | Cambia il significato di «Bancarotta», che chi la dichiara vuole davvero; il motore non sa chi è un bot | **Solo in forma minima**: il gioco automatico accetta un regalo già offerto |
| (e) Cassa comune di squadra | Coerente con «si vince insieme» | Troppo invasiva: economia, debiti, patrimonio, statistiche e interfaccia, e cambia il gioco a squadre per tutti | No |

### La regola di convenienza
Sta in [bot.ts](packages/engine/src/bot.ts), nella sezione «Aiuto ai compagni in rosso», come funzioni pure.

L'idea di fondo: a squadre, chi fallisce in rosso lascia le proprietà alla banca, mentre chi esce con il saldo ≥ 0 le passa al compagno. I soldi passati tra compagni non cambiano il patrimonio della squadra, quindi salvarlo conviene quasi sempre. Il costo vero per il bot è la liquidità, più il rischio di regalare soldi che finiscono ai creditori.

- **Cosa riceve.** Il bot regala al compagno **tutto il rosso** (N = −saldo).
- **La scorta del bot.** Non scende sotto la sua `riserva` (100–600 €). La tiene intera se il compagno potrebbe rientrare da solo vendendo e ipotecando (`capacitaDiRientro`); ne tiene solo metà se senza aiuto fallirebbe, perché lì la posta è più alta.
- **Aiuto parziale.** Se il bot non arriva a N, dà la sua parte solo se il resto il compagno lo copre da solo. Altrimenti i soldi andrebbero ai creditori prima di una bancarotta comunque inevitabile.
- **Quando conviene.** Il bot aiuta solo se il valore salvato dalla squadra (`valoreInGioco`) supera il regalo. Il valore salvato comprende:
  - le proprietà del compagno, quelle ipotecate al netto del riscatto;
  - i suoi edifici e le Carte Grazia;
  - metà degli edifici dei compagni nelle regioni che si romperebbero;
  - il posto in partita, valutato due passaggi dalla Partenza;
  - e da cui si toglie l'avanzo di liquidazione che l'erede riceverebbe comunque.
- **Chi aiuta.** Un solo bot (`chiAiuta`): quello che può dare di più; a parità, quello con più margine; poi il primo nei turni.
- **Quante volte.** Al più un'offerta per compagno a turno, ricordata dalla stanza in `ultimoAiuto`. Non consuma l'attesa di 8 turni delle proposte normali. Il bot ritira il regalo se il compagno esce dal rosso da solo.
- **Richieste del compagno in rosso.** Il bot le accetta fino al rosso arrotondato alle centinaia (237 € → 300 €). Oltre quel limite decide la regola di sempre tra compagni: se in cambio il compagno offre qualcosa che vale, lo scambio resta buono come prima.
- **Bot in rosso.** Accetta sempre i regali dei compagni, e aspetta il regalo di un altro bot prima di vendere o fallire.
- **Gioco automatico.** Allo scadere del tempo accetta un regalo aperto di un compagno che copre tutto il rosso, invece della bancarotta. Non accetta regali di avversari, né regali parziali.

I numeri (metà scorta, due passaggi, arrotondamento a 100 €) sono euristiche da tarare giocando. Senza l'opzione `aiutare` i bot non offrono aiuto, quindi le simulazioni esistenti del motore non cambiano. Nelle partite a squadre di soli bot l'aiuto allunga la durata di circa l'8%, perché anche i bot si aiutano tra loro.

| File | Perché |
|---|---|
| [packages/engine/src/bot.ts](packages/engine/src/bot.ts) | Sezione «Aiuto ai compagni in rosso» (`capacitaDiRientro`, `valoreInGioco`, `aiutoPossibile`, `massimoAiuto`, `chiAiuta`), `propostaDiAiuto` e opzione `OpzioniBot.aiutare`; `mossaBot` ritira i regali inutili e offre aiuto, anche fuori dal suo turno; `rispostaScambio` per regali e richieste; `mosseDeiBot` con quarto parametro facoltativo, un solo aiutante e il bot aiutato che aspetta |
| [packages/engine/src/scambi.ts](packages/engine/src/scambi.ts) | Predicato `regaloDiSquadra`: solo soldi, a un compagno, niente in cambio |
| [packages/engine/src/index.ts](packages/engine/src/index.ts) | Esporta `regaloDiSquadra` |
| [packages/engine/src/regole.ts](packages/engine/src/regole.ts) | `giocaInAutomatico`: accetta il regalo che copre il rosso prima della bancarotta automatica |
| [apps/server/src/stanze/stanza.ts](apps/server/src/stanze/stanza.ts) | Memoria `ultimoAiuto` (un'offerta per compagno a turno), separata da `ultimaProposta`; passaggio di `aiutare` a `mosseDeiBot`; azzeramento a ogni partita nuova |
| [packages/engine/src/aiuto-squadra.test.ts](packages/engine/src/aiuto-squadra.test.ts) (nuovo) | 17 test: calcoli, scorta intera o dimezzata, aiuto parziale, un solo aiutante, ritiro, richieste, richiesta oltre il limite con qualcosa in cambio, bot in rosso, gioco automatico, 8 partite a squadre di soli bot |
| [apps/server/src/stanze/aiuto-squadra.test.ts](apps/server/src/stanze/aiuto-squadra.test.ts) (nuovo) | 4 test con orologio finto: una sola offerta con la nota; nessuna insistenza dopo un rifiuto nello stesso turno; accettazione automatica allo scadere del tempo; proposte normali dei bot intatte |

Non c'è nessuna modifica all'interfaccia: la proposta del bot arriva come le altre, si apre da sola e il pulsante «Accetta» dipende da `verifica`.

---

## Compatibilità

- **Partite e stanze salvate** (`stanze.json`): il formato non cambia (`FORMATO = 1`). Una stanza o partita senza `costruzioneDiSquadra` prende `false` dai predefiniti, perché lo uniscono già `Stanza.importa` e `aggiornaSalvata`; c'è un test. I mazzi hanno la stessa forma di prima.
- **Protocollo**: nessun comando nuovo. Le impostazioni hanno una chiave in più, che `lettura.ts` accetta. L'evento `costruzione` ha un campo facoltativo in più. Sito e server si distribuiscono sempre insieme, anche nell'estensione, quindi non c'è un problema di versioni miste.
- **cloudflared**: chi ha la vecchia copia scaricata da `latest` la vedrà cancellata e riscaricata una volta, circa 50 MB, alla prima accensione online.

## Documentazione aggiornata

- [README.md](README.md): «Giocare online» descrive la verifica di cloudflared; tra le regole compaiono «Colori e costruzione di squadra» e «Aiuto dei bot».
- [ROADMAP.md](ROADMAP.md):
  - §1 «Mazzi nascosti e rimescolati»;
  - in §3 la nuova sezione «Correzioni e squadre (2026-11-19)», con due voci ancora aperte;
  - in §4 cinque righe nuove: mazzo finito, cloudflared, colori a squadre, costruzione di squadra, aiuto dei bot.
- [GUIDA.md](GUIDA.md): l'aiuto del bot durante la partita e il messaggio «non è quello atteso» di cloudflared.
- Non toccati: `apps/vscode/CHANGELOG.md` e la versione dell'estensione. Vanno aggiornati quando si decide di pubblicare la prossima versione, insieme alla Supernova più ricca e al dado cosmico.

## Da controllare a mano

- [ ] Leggibilità del giallo `--sq3` sul blocco del proprietario e sul numero della squadra, nel tema chiaro e in quello scuro.
- [ ] Riga dell'interruttore «Colori di squadra» nella colonna stretta a 1440 px: il testo deve andare a capo senza spingere fuori l'interruttore.
- [ ] Pulsante «Costruisci…: paghi tu» nella scheda aperta dal tabellone, anche sulle caselle vicine ai bordi.
- [ ] Fascia colorata dei riquadri delle squadre in lobby.
- [ ] In lobby la riga «Costruzione di squadra» compare e scompare accendendo e spegnendo «Squadre».
- [ ] In una partita a squadre con un bot compagno, finire in rosso: la proposta del bot si apre da sola con la nota e, accettandola, il rosso sparisce.
- [ ] All'asta, più di 20 rilanci di fila: ogni rilancio suona, la bolla «+X €» riparte e l'elenco scorre.
- [ ] Gioco online su un PC senza cloudflared: scaricamento della 2026.11.1, messaggio «è pronto» e link online funzionante.

## Punti aperti e possibili seguiti

- **Rimescolamento visibile**: si potrebbe aggiungere un evento con la riga di registro «Busta rimescolata»; oggi è silenzioso.
- **Interfaccia dell'aiuto**:
  - un pulsante «Chiedi aiuto alla squadra» quando si è in rosso, con la cifra di `massimoAiuto` già scritta;
  - un'etichetta «Aiuto della squadra» sulla proposta;
  - un avviso prima di «Bancarotta» se c'è un regalo aperto.
- **Uscite che non accettano l'aiuto**: chi esce per assenza, voto o tempo, e non per bancarotta, non accetta il regalo aperto. Servirebbe un intervento in `elimina` (`turni.ts`).
- **Bot in rosso**: potrebbero chiedere aiuto ai compagni umani.
- **Taratura**: andrebbero ritarati, giocando, la scorta, il valore del posto e la tolleranza delle richieste.
