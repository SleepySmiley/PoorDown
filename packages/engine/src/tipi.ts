/*
 * Tipi del motore di gioco.
 * Lo stato è un oggetto JSON semplice: si copia, si salva su file e si invia così com'è.
 */

export type IdGiocatore = string;
/** I tabelloni: vedi docs/identita/tabellone-e-carte.md e docs/identita/tabelloni-alternativi.md. */
export type IdMappa = 'classica' | 'europa' | 'grandi_aree' | 'fortuna' | 'sistema_solare' | 'giro_del_mondo';
export type NomeMazzo = 'busta' | 'cartolina';

/* ------------------------------------------------------------------ */
/* Impostazioni della stanza                                           */
/* ------------------------------------------------------------------ */

export interface Impostazioni {
  /** 2–8. */
  giocatoriMax: number;
  stanzaPrivata: boolean;
  bot: boolean;
  mappa: IdMappa;
  /** L'affitto base raddoppia se il proprietario ha tutta la regione. */
  affittoDoppioSetCompleto: boolean;
  /** Tasse e pagamenti alla banca finiscono in una cassa che incassa chi si ferma in Vacanza. */
  cassaVacanza: boolean;
  aste: boolean;
  /** Chi è in prigione non incassa affitti. */
  nienteAffittoInPrigione: boolean;
  ipoteche: boolean;
  costruzioneUniforme: boolean;
  /** 500–3000, a passi di 500. */
  soldiIniziali: number;
  ordineCasuale: boolean;
  timerTurno: boolean;
  /** Dopo `TURNI_A_TESTA` turni per ogni giocatore la partita finisce e vince il patrimonio più alto. */
  durataMassima: boolean;
  /**
   * Modalità squadre: i compagni non si pagano l'affitto, costruiscono sulle regioni della squadra,
   * ereditano i beni di chi fa bancarotta e vincono insieme.
   */
  squadre: boolean;
}

/* ------------------------------------------------------------------ */
/* Tabellone                                                           */
/* ------------------------------------------------------------------ */

interface CasellaBase {
  nome: string;
  /** Nome corto per il tabellone. Il nome intero resta nella scheda e nel registro. */
  breve?: string;
}

/** Affitto con 0 (solo terreno), 1, 2, 3, 4 case e con l'albergo. */
export type Affitti = readonly [number, number, number, number, number, number];

export interface Citta extends CasellaBase {
  tipo: 'citta';
  /** Indice in `Tabellone.regioni`. */
  regione: number;
  prezzo: number;
  affitti: Affitti;
}

export interface Stazione extends CasellaBase {
  tipo: 'stazione';
  prezzo: number;
}

export interface Servizio extends CasellaBase {
  tipo: 'servizio';
  prezzo: number;
}

export interface CasellaCarta extends CasellaBase {
  tipo: 'carta';
  mazzo: NomeMazzo;
}

export interface Tassa extends CasellaBase {
  tipo: 'tassa';
  /** Percentuale del contante (es. 10) oppure importo fisso in euro. */
  tassa: { tipo: 'percentuale'; valore: number } | { tipo: 'fissa'; valore: number };
}

/** Casella che regala soldi a chi ci si ferma (il Rimborso di «Colpo di fortuna»). */
export interface Premio extends CasellaBase {
  tipo: 'premio';
  importo: number;
}

export interface Angolo extends CasellaBase {
  tipo: 'partenza' | 'prigione' | 'vacanza' | 'vai_in_prigione';
}

/**
 * Le caselle folli del Sistema solare:
 * - `fionda`: fionda gravitazionale, si riparte subito della stessa somma dei dadi;
 * - `wormhole`: teletrasporto su una casella a caso;
 * - `buco_nero`: risucchia una parte del contante nel malloppo (`Cosmo.malloppo`);
 * - `supernova`: chi ci si ferma tira il dado della Supernova e prende il malloppo moltiplicato (`Follie.supernova`);
 * - `roulette`: gira la Roulette cosmica (`Follie.roulette`).
 * E quelle del Giro del mondo:
 * - `bermuda`: il Triangolo delle Bermuda, si sparisce e si ricompare su una casella a caso;
 * - `cambio_data`: la Linea del cambio di data, chi ci arriva con i dadi guadagna un giorno e si muove ancora;
 * - `antipodi`: la Buca per l'altra parte del mondo, si sbuca sul lato opposto del tabellone.
 */
export interface Speciale extends CasellaBase {
  tipo: 'fionda' | 'wormhole' | 'buco_nero' | 'supernova' | 'roulette' | 'bermuda' | 'cambio_data' | 'antipodi';
}

export type Proprietabile = Citta | Stazione | Servizio;
export type Casella = Proprietabile | CasellaCarta | Tassa | Premio | Angolo | Speciale;
export type TipoCasella = Casella['tipo'];

export interface Regione {
  nome: string;
  /** Tre lettere per lo stemma (es. "TOS"). */
  sigla: string;
  /** Colore dello stemma, 1–11 (le variabili --g1…--g11). Di solito l'indice della regione più uno. */
  colore: number;
  /** Al posto dello stemma, la bandiera del paese o della regione del gruppo. */
  bandiera?: Bandiera;
  costoCasa: number;
  costoAlbergo: number;
}

/** Le regioni italiane, per le loro bandiere (ui/bandiere-regioni.tsx). */
export type BandieraRegione =
  | 'abruzzo'
  | 'basilicata'
  | 'calabria'
  | 'campania'
  | 'emilia-romagna'
  | 'friuli'
  | 'lazio'
  | 'liguria'
  | 'lombardia'
  | 'marche'
  | 'molise'
  | 'piemonte'
  | 'puglia'
  | 'sardegna'
  | 'sicilia'
  | 'toscana'
  | 'trentino'
  | 'umbria'
  | 'valle-aosta'
  | 'veneto';

/** I corpi celesti del Sistema solare (ui/bandiere-pianeti.tsx): al posto della bandiera, il disegno del pianeta. */
export type BandieraPianeta =
  | 'luna'
  | 'mercurio'
  | 'venere'
  | 'marte'
  | 'asteroidi'
  | 'giove'
  | 'saturno'
  | 'urano'
  | 'nettuno'
  | 'plutone';

/** I paesi del Giro del mondo, con il codice ISO (ui/bandiere-mondo.tsx). */
export type BandieraMondo = 'NR' | 'NO' | 'CA' | 'US' | 'AU' | 'TH' | 'BO' | 'TR' | 'RU' | 'AR' | 'VA';

/**
 * Le bandiere disegnate nel browser (ui/bandiere.tsx): i paesi europei con il codice ISO, quelli del Giro del mondo,
 * poi le regioni italiane, poi i pianeti del Sistema solare.
 */
export type Bandiera =
  | 'IE'
  | 'CH'
  | 'AT'
  | 'GR'
  | 'PT'
  | 'NL'
  | 'PL'
  | 'ES'
  | 'FR'
  | 'DE'
  | BandieraMondo
  | BandieraRegione
  | BandieraPianeta;

export type Effetto =
  /** Positivo: la banca paga. Negativo: si paga la banca. */
  | { tipo: 'soldi'; importo: number }
  /** Ogni altro giocatore paga chi pesca. */
  | { tipo: 'da_ognuno'; importo: number }
  /** Chi pesca paga ogni altro giocatore. */
  | { tipo: 'a_ognuno'; importo: number }
  /** Avanza fino alla casella indicata. */
  | { tipo: 'vai_a'; casella: number }
  /** Avanti (positivo) o indietro (negativo); indietro non passa dalla Partenza. */
  | { tipo: 'passi'; passi: number }
  /** Avanza fino alla prossima casella di quel tipo. */
  | { tipo: 'prossima'; casella: 'stazione' | 'servizio' }
  | { tipo: 'prigione' }
  /** Carta Grazia: esci gratis di prigione. */
  | { tipo: 'grazia' }
  | { tipo: 'riparazioni'; casa: number; albergo: number }
  /* Le carte folli del Sistema solare. */
  /** Teletrasporto su una casella a caso (non quella dove si è): vale la casella d'arrivo, la Partenza no. */
  | { tipo: 'casuale' }
  /** Scambia il posto con un avversario a caso fuori di prigione; per chi pesca vale la casella d'arrivo. */
  | { tipo: 'scambia_posto' }
  /** Il giocatore con più contante dà `importo` a quello con meno. */
  | { tipo: 'robin_hood'; importo: number }
  /** Tutti gli avversari fuori di prigione ci finiscono dentro. Il turno di chi pesca continua. */
  | { tipo: 'avversari_in_prigione' }
  /** Testa o croce: si riceve `importo` dalla banca oppure lo si paga. */
  | { tipo: 'moneta'; importo: number }
  /** Ogni giocatore, compreso chi pesca, riceve (positivo) o paga alla banca (negativo). */
  | { tipo: 'tutti_soldi'; importo: number }
  /** Si tira di nuovo i dadi, come dopo un doppio (ma senza contare come doppio). */
  | { tipo: 'rilancia' }
  /** Si perde metà del contante, al massimo `massimo` (Roulette cosmica). */
  | { tipo: 'meta_contante'; massimo: number }
  /** Gravità invertita: fino alla fine del giro tutti tirano i dadi e camminano al contrario. */
  | { tipo: 'inverti' }
  /** Biglietto omaggio (Giro del mondo): si muove ancora, e se vola non paga il biglietto. */
  | { tipo: 'volo_omaggio' };

/** Gli eventi cosmici del Sistema solare: uno per giro, dal secondo giro. */
export type EventoCosmico = 'quiete' | 'allineamento' | 'eclissi' | 'tempesta' | 'meteoriti' | 'gravita' | 'collisione';

/**
 * Le facce del dado cosmico del Sistema solare, tirato a ogni lancio insieme ai due dadi:
 * - `razzo`: dopo la mossa la pedina vola alla prossima proprietà libera nel verso di marcia;
 * - `saldi`: la proprietà libera dove si ferma costa la metà;
 * - `bandiera`: la proprietà libera più economica diventa sua, gratis;
 * - `scudo`: in questo tiro non paga affitti;
 * - `faro`: fino al suo prossimo turno le sue proprietà rendono il doppio;
 * - `iperspazio`: la mossa dei dadi vale doppio.
 */
export type FacciaCosmica = 'razzo' | 'saldi' | 'bandiera' | 'scudo' | 'faro' | 'iperspazio';

/** Le regole folli di un tabellone: oggi solo il Sistema solare. */
export interface Follie {
  /** Affitto quantistico: ogni affitto si moltiplica per il fattore della faccia di un dado (6 valori). */
  quantico: readonly number[];
  /** Partenza a caso: multipli di `passo` tra `min` e `max`; fermandosi sopra, `arrivo` in più. */
  partenza: { min: number; max: number; passo: number; arrivo: number };
  /** Gli eventi cosmici che si estraggono a ogni giro (ripetuti = più probabili). */
  eventi: readonly EventoCosmico[];
  /** Mercato galattico: i fattori possibili per prezzo e affitti del pianeta del giro. */
  mercato: readonly number[];
  /** Buco nero: la percentuale del contante che risucchia nel malloppo. */
  bucoNero: number;
  /** Il malloppo della Supernova a inizio partita e dopo ogni vincita: sotto questa cifra non scende mai. */
  malloppo: number;
  /** La Supernova cresce da sola: quanto mette la banca nel malloppo a ogni giro nuovo. */
  crescitaGiro: number;
  /** Polvere di stelle: quanto mette la banca nel malloppo ogni volta che una pedina passa sopra la Supernova senza fermarsi. */
  polvere: number;
  /**
   * Il dado della Supernova (6 facce): chi ci si ferma prende il malloppo moltiplicato per la faccia uscita.
   * Sopra ×1 la differenza la mette la banca; sotto ×1 il resto rimane nella stella per il prossimo.
   */
  supernova: readonly number[];
  /**
   * Tetto della Supernova: con la sua vincita nessuno va oltre questo contante. Il resto va all'avversario
   * con meno contante; chi ce l'ha già non incassa niente e va tutto a lui.
   */
  tetto: number;
  /**
   * Il dado cosmico: le sue facce, tutte diverse (6, come un dado), ognuna con il suo peso.
   * Il dado è truccato: una faccia esce `peso` volte su quante sono tutti i pesi insieme.
   */
  dadoCosmico: readonly { faccia: FacciaCosmica; peso: number }[];
  /** Gli spicchi della Roulette cosmica: se ne estrae uno a caso a ogni giro di ruota. */
  roulette: readonly Carta[];
}

/** Lo stato del cosmo nelle partite con le regole folli. */
export interface Cosmo {
  /** Il giro in corso: cresce quando il turno torna al primo dell'ordine. */
  giro: number;
  evento: EventoCosmico;
  /** Il pianeta (indice della regione) quotato dal Mercato galattico in questo giro, con il suo fattore. */
  mercato: { regione: number; fattore: number } | null;
  /**
   * Il malloppo che aspetta la Supernova: i soldi risucchiati dai buchi neri, più quelli che la banca aggiunge
   * a ogni giro, con la polvere di stelle e con i premi della Partenza mangiati dalla tempesta solare.
   */
  malloppo: number;
  /** -1 con la gravità invertita: i dadi portano indietro, fino alla fine del giro. */
  verso: 1 | -1;
  /** La faccia del dado cosmico nel tiro in corso di chi gioca; `null` prima del suo primo tiro. */
  dado: FacciaCosmica | null;
  /** Faro: chi lo ha acceso, le cui proprietà rendono il doppio fino al suo prossimo turno. */
  faro: IdGiocatore | null;
}

export interface Carta {
  testo: string;
  effetto: Effetto;
}

/**
 * Le regole del Giro del mondo: il biglietto aereo e la sfida a morra cinese.
 * Il volo parte dall'aeroporto del lato dove si trova la pedina: se è di un avversario il biglietto lo incassa lui,
 * se è proprio (o di un compagno) costa la metà, altrimenti va alla banca.
 */
export interface Viaggi {
  /**
   * Il prezzo del biglietto per la distanza, in caselle contate in avanti: vale la prima fascia con `fino` almeno
   * uguale alla distanza. L'ultima arriva fino al giro intero.
   */
  fasce: readonly { fino: number; prezzo: number }[];
  /** Chi cade sulla proprietà di un avversario può sfidarlo a morra cinese invece di pagare. */
  sfida: boolean;
  /**
   * Si vola solo con il passaporto, che si ritira passando dalla Partenza (o con il Biglietto omaggio): il primo giro
   * si fa con i dadi, così al primo turno nessuno fa la corsa ai paesi da una città sola.
   */
  passaporto: boolean;
}

export interface Tabellone {
  id: IdMappa;
  nome: string;
  /** Una frase per la scelta del tabellone in lobby. */
  descrizione: string;
  caselle: readonly Casella[];
  regioni: readonly Regione[];
  partenza: { passaggio: number; arrivo: number };
  /** Indice della casella Prigione, dove si va in cella. */
  prigione: number;
  cauzione: number;
  /** Affitto con 1, 2, 3, 4 stazioni. */
  affittiStazioni: readonly number[];
  /** Moltiplicatore dei dadi con 1, 2, 3 servizi. */
  moltiplicatoriServizi: readonly number[];
  mazzi: Readonly<Record<NomeMazzo, readonly Carta[]>>;
  /** Le regole folli (Sistema solare): affitto quantistico, Partenza a caso, eventi cosmici, mercato, caselle speciali. */
  follie?: Follie;
  /** Il biglietto aereo e la sfida a morra cinese (Giro del mondo). */
  viaggi?: Viaggi;
}

/* ------------------------------------------------------------------ */
/* Stato della partita                                                 */
/* ------------------------------------------------------------------ */

export interface Debito {
  creditore: IdGiocatore;
  importo: number;
}

/**
 * Perché un giocatore è uscito dalla partita.
 * - `tempo`: il timer è scaduto troppe volte di fila.
 * - `assenza`: è rimasto scollegato troppo a lungo.
 * - `voto`: gli altri hanno votato per toglierlo.
 * - `espulsione`: l'ha tolto l'host.
 */
export type MotivoUscita = 'bancarotta' | 'tempo' | 'assenza' | 'voto' | 'espulsione';

export interface Eliminazione {
  /** Numero del turno in cui è uscito: serve alla classifica dei turni sopravvissuti. */
  turno: number;
  motivo: MotivoUscita;
}

export interface Giocatore {
  id: IdGiocatore;
  nome: string;
  /** Colore della pedina, 1–12. */
  colore: number;
  posizione: number;
  /** Può essere negativo: in quel caso il giocatore è in debito. */
  saldo: number;
  /**
   * Debiti verso altri giocatori, nell'ordine in cui sono nati. Ogni entrata salda prima questi.
   * La somma non supera mai la parte negativa del saldo: il resto del rosso è verso la banca.
   */
  debiti: Debito[];
  /** `null` se è libero, altrimenti quanti tiri ha già fallito in prigione (0–3). */
  prigione: number | null;
  /** Si è fermato in Vacanza e salta il prossimo turno. */
  vacanza: boolean;
  carteGrazia: NomeMazzo[];
  eliminato: Eliminazione | null;
  /** Banca di tempo personale del timer di turno (ms): si consuma dopo la grazia e si ricarica a fine turno. */
  banca: number;
  /** Turni di fila che il gioco ha dovuto finire al posto suo, allo scadere del tempo. */
  automatici: number;
  /** Da quando non è collegato (ms del server); `null` se è collegato. */
  offlineDa: number | null;
  /** Indice della squadra in `Stato.squadre`; `null` se la partita non è a squadre. */
  squadra: number | null;
  /** Giro del mondo: ha ritirato il passaporto (è passato dalla Partenza) e può volare. Manca finché non ce l'ha. */
  passaporto?: true;
}

export interface Proprieta {
  proprietario: IdGiocatore | null;
  /** 0 = solo terreno, 1–4 case, 5 = albergo. */
  livello: number;
  ipotecata: boolean;
}

export interface Mazzo {
  /**
   * Ordine segreto delle carte del giro in corso (indici in `Tabellone.mazzi`). Quando esce l'ultima carta, il mazzo
   * si rimescola tutto per il giro dopo. Non va mai mandato ai giocatori.
   */
  ordine: number[];
  /** Posizione in `ordine` della prossima carta da pescare: sempre dentro il mazzo (dopo l'ultima carta torna a 0). */
  prossima: number;
}

/**
 * - `lancio`: deve tirare i dadi.
 * - `prigione`: è in prigione e sceglie se tirare, pagare la cauzione o usare la Carta Grazia.
 * - `dopo_lancio`: ha tirato; può comprare, poi tira ancora (se ha fatto un doppio) o finisce il turno.
 */
export type FaseTurno = 'lancio' | 'prigione' | 'dopo_lancio';

/**
 * Il tempo del turno. La scadenza è `inizio + grazia + regalato + banca del giocatore` (vedi tempo.ts);
 * chi non è collegato ha solo la grazia normale, contata da quando è sparito.
 */
export interface TempoTurno {
  /** Quando è cominciato il turno (ms del server). Le pause dell'asta lo spostano avanti. */
  inizio: number;
  /** Tempo gratuito del turno (ms): più lungo se chi gioca è in debito. */
  grazia: number;
  /** Tempo regalato dagli altri giocatori in questo turno (ms). */
  regalato: number;
  /** Chi ha già regalato tempo in questo turno: uno a testa. */
  regali: IdGiocatore[];
  /** Chi gioca ha chiesto più tempo. */
  richiesta: boolean;
  /** Il tempo è scaduto e il gioco sta facendo le mosse al posto suo. */
  automatico: boolean;
  /** Da quando l'asta tiene fermo l'orologio (ms del server); `null` se scorre. */
  fermoDa: number | null;
  /**
   * Chi gioca non è collegato: da qui parte la sua grazia (ms del server). Come `inizio`, le pause dell'asta lo
   * spostano avanti, così la grazia non si consuma mentre l'orologio è fermo. `null` se chi gioca è collegato.
   * Manca nelle partite salvate prima che ci fosse: allora vale `offlineDa` del giocatore.
   */
  assenteDa?: number | null;
}

/** Il voto per togliere dalla partita chi sta giocando il turno. Si azzera a ogni turno. */
export interface Votazione {
  /** Chi ha votato a favore. */
  voti: IdGiocatore[];
  /** Senza timer di turno: quando il voto toglie comunque il giocatore (ms del server). */
  scadenza: number | null;
}

export interface Turno {
  giocatore: IdGiocatore;
  /** Contatore dei turni giocati nella partita, dal primo (1). I turni saltati non contano. */
  numero: number;
  fase: FaseTurno;
  /** Ultimo tiro di questo turno. */
  dadi: [number, number] | null;
  /** Doppi di fila in questo turno. */
  doppi: number;
  /** Ha fatto un doppio: deve tirare ancora prima di finire il turno. */
  rilancio: boolean;
  /** Casella libera su cui si è fermato e che può comprare. */
  acquisto: number | null;
  /** Ha pescato il Biglietto omaggio (Giro del mondo): il prossimo volo di questo turno è gratis. */
  voloOmaggio?: true;
  tempo: TempoTurno;
  votazione: Votazione;
}

export interface Offerta {
  giocatore: IdGiocatore;
  importo: number;
}

/** Asta su una proprietà che il giocatore di turno non ha comprato. */
export interface Asta {
  casella: number;
  /** Chi l'ha aperta: il giocatore di turno in quel momento. */
  giocatore: IdGiocatore;
  /** Offerta più alta, `null` finché nessuno offre. */
  migliore: Offerta | null;
  /** Ultime offerte, dalla più recente. */
  offerte: Offerta[];
  /** Quando finisce, in millisecondi dell'orologio del server. Ogni offerta la sposta più avanti. */
  scadenza: number;
}

/** I segni della morra cinese. */
export type Segno = 'sasso' | 'carta' | 'forbici';

/**
 * La sfida a morra cinese (Giro del mondo): chi gioca è caduto sulla proprietà di un avversario.
 * - `scelta`: lo sfidante decide se pagare l'affitto o sfidare (scegliendo il suo segno);
 * - `morra`: ha sfidato, e il proprietario sceglie il suo segno.
 * Vince lo sfidante: non paga. Vince il proprietario: affitto doppio. Pareggio: affitto normale.
 * Finché è aperta l'orologio del turno è fermo, come all'asta.
 */
export interface Sfida {
  /** Chi è caduto sulla proprietà: il giocatore di turno. */
  sfidante: IdGiocatore;
  /** Chi incassa: il proprietario quando la pedina si è fermata (anche se poi la proprietà cambia di mano). */
  proprietario: IdGiocatore;
  casella: number;
  /** L'affitto normale, calcolato all'arrivo. */
  importo: number;
  fase: 'scelta' | 'morra';
  /** Il segno dello sfidante: segreto finché la morra non si chiude (la vista dei browser lo toglie). */
  segno: Segno | null;
  /** Quando scade la fase (ms del server): allo scadere della scelta si paga, della morra il proprietario ha un segno a caso. */
  scadenza: number;
}

/** Cosa mette sul tavolo una delle due parti di uno scambio. */
export interface Pacchetto {
  soldi: number;
  /** Caselle delle proprietà, in ordine di tabellone. */
  caselle: number[];
  /** Carte Grazia, indicate dal mazzo da cui vengono. */
  grazie: NomeMazzo[];
}

export interface Scambio {
  id: number;
  /** Chi propone. */
  da: IdGiocatore;
  /** A chi è proposto: solo lui può accettare o rifiutare. */
  a: IdGiocatore;
  /** Cosa dà chi propone. */
  dare: Pacchetto;
  /** Cosa chiede in cambio. */
  avere: Pacchetto;
  /** Nota facoltativa, al massimo 200 caratteri. */
  nota: string;
  /** 0 per la proposta originale, poi cresce a ogni controproposta. */
  trattativa: number;
  /** Le caselle dello scambio già ipotecate quando è stato proposto: un'ipoteca nuova lo rende non valido. */
  ipotecate: number[];
  /**
   * Le due parti della proposta che questa ha sostituito, girate nel verso di questa (`dare` è sempre di chi
   * propone adesso): servono a mostrare che cosa è cambiato. Manca nella proposta originale e negli scambi
   * delle partite salvate prima che ci fosse.
   */
  precedente?: { dare: Pacchetto; avere: Pacchetto };
  /**
   * Questa versione l'ha cambiata chi aveva già proposto («Modifica»), non è una risposta dell'altro.
   * Manca nella proposta originale e nelle partite salvate prima che ci fosse (vale come controproposta).
   */
  modifica?: boolean;
}

/** Un punto del grafico del patrimonio. */
export interface PuntoPatrimonio {
  /** 0 all'inizio della partita, poi il numero del turno appena finito (o di quello in cui la partita è finita). */
  turno: number;
  /** Il patrimonio di ogni giocatore, nell'ordine di `Stato.giocatori`; `null` per chi è già fuori. */
  valori: (number | null)[];
}

/** Numeri raccolti durante la partita, per la classifica e le statistiche finali. */
export interface Statistiche {
  /** Quando è cominciata (ms del server). Le pause la spostano avanti, come gli altri orologi: non contano nella durata. */
  inizio: number;
  /** Quando è finita; `null` finché è in corso. */
  fine: number | null;
  /** Tiri con i due dadi uguali, di tutti i giocatori. */
  doppi: number;
  /** Scambi accettati. */
  scambi: number;
  /** Messaggi scritti in chat durante la partita: li conta la stanza. */
  messaggi: number;
  /** Quante volte una pedina si è fermata su ogni casella. */
  visite: number[];
  /** Quante volte ogni giocatore è finito in prigione. */
  prigione: Record<IdGiocatore, number>;
  /** Chi è uscito dalla partita, nell'ordine in cui è uscito: decide la classifica tra chi esce nello stesso turno. */
  uscite: IdGiocatore[];
  /** Il patrimonio di tutti alla fine di ogni turno. Nella vista dei browser resta vuoto finché la partita è in corso. */
  patrimonio: PuntoPatrimonio[];
}

export interface Stato {
  mappa: IdMappa;
  impostazioni: Impostazioni;
  /** In ordine di turno. Chi è eliminato resta nella lista. */
  giocatori: Giocatore[];
  /** Una voce per casella: `null` per le caselle che non si possono comprare. */
  proprieta: (Proprieta | null)[];
  mazzi: Record<NomeMazzo, Mazzo>;
  cassaVacanza: number;
  turno: Turno;
  /** L'asta in corso, se c'è. */
  asta: Asta | null;
  /** Scambi proposti e non ancora chiusi. */
  scambi: Scambio[];
  /** Numero del prossimo scambio proposto. */
  prossimoScambio: number;
  fase: 'in_corso' | 'finita';
  /** Senza squadre: l'ultimo rimasto. A squadre: il primo dei vincitori ancora in gioco. */
  vincitore: IdGiocatore | null;
  /** Nomi delle squadre (fino a 4); vuoto se la partita non è a squadre. */
  squadre: string[];
  /** A squadre, la squadra che ha vinto; altrimenti `null`. */
  squadraVincitrice: number | null;
  statistiche: Statistiche;
  /** Solo sui tabelloni con le regole folli: evento del giro, mercato, malloppo, verso di marcia. */
  cosmo?: Cosmo;
  /** La sfida a morra cinese in corso (Giro del mondo). Manca nelle partite degli altri tabelloni. */
  sfida?: Sfida | null;
}

/* ------------------------------------------------------------------ */
/* Azioni, eventi, esiti                                               */
/* ------------------------------------------------------------------ */

/** `giocatore` è chi compie l'azione: lo imposta il server, non il browser. */
export type Azione =
  | { tipo: 'lancia'; giocatore: IdGiocatore }
  | { tipo: 'compra'; giocatore: IdGiocatore }
  | { tipo: 'fine_turno'; giocatore: IdGiocatore }
  | { tipo: 'paga_cauzione'; giocatore: IdGiocatore }
  | { tipo: 'usa_grazia'; giocatore: IdGiocatore; mazzo?: NomeMazzo }
  | { tipo: 'vendi'; giocatore: IdGiocatore; casella: number }
  /** Una casa in più (o l'albergo, sopra quattro case). */
  | { tipo: 'costruisci'; giocatore: IdGiocatore; casella: number }
  /** Vende alla banca una casa (o l'albergo, che torna a quattro case) per metà del costo. */
  | { tipo: 'demolisci'; giocatore: IdGiocatore; casella: number }
  | { tipo: 'ipoteca'; giocatore: IdGiocatore; casella: number }
  | { tipo: 'riscatta'; giocatore: IdGiocatore; casella: number }
  /** Manda all'asta la proprietà libera su cui si è fermato, invece di comprarla. */
  | { tipo: 'asta'; giocatore: IdGiocatore }
  /** Offerta all'asta: `importo` è il totale offerto, non il rilancio. */
  | { tipo: 'offri'; giocatore: IdGiocatore; importo: number }
  /** Propone uno scambio a `a`. Con `sostituisce` è una controproposta che prende il posto di quello scambio. */
  | {
      tipo: 'proponi';
      giocatore: IdGiocatore;
      a: IdGiocatore;
      dare: Pacchetto;
      avere: Pacchetto;
      nota: string;
      sostituisce?: number;
    }
  | { tipo: 'accetta'; giocatore: IdGiocatore; scambio: number }
  | { tipo: 'rifiuta'; giocatore: IdGiocatore; scambio: number }
  /** Chi ha proposto lo scambio lo ritira. */
  | { tipo: 'annulla'; giocatore: IdGiocatore; scambio: number }
  | { tipo: 'bancarotta'; giocatore: IdGiocatore }
  /** Chi gioca chiede agli altri più tempo. */
  | { tipo: 'chiedi_tempo'; giocatore: IdGiocatore }
  /** Un altro giocatore regala un minuto a chi gioca. */
  | { tipo: 'regala_tempo'; giocatore: IdGiocatore }
  /** Voto (o ritiro del voto) per togliere dalla partita chi sta giocando il turno. */
  | { tipo: 'vota'; giocatore: IdGiocatore; favorevole: boolean }
  /** Invece di tirare i dadi, compra il biglietto e vola sulla casella (Giro del mondo). */
  | { tipo: 'vola'; giocatore: IdGiocatore; casella: number }
  /** Sulla proprietà di un avversario: paga l'affitto invece di sfidarlo. */
  | { tipo: 'paga_affitto'; giocatore: IdGiocatore }
  /** Sulla proprietà di un avversario: lo sfida a morra cinese con questo segno (senza segno, a caso). */
  | { tipo: 'sfida'; giocatore: IdGiocatore; segno?: Segno }
  /** Il proprietario sfidato risponde con il suo segno (senza segno, a caso). */
  | { tipo: 'morra'; giocatore: IdGiocatore; segno?: Segno };

export type TipoAzione = Azione['tipo'];

export type Evento =
  /** `bonus`: i soldi in più per ogni posto dopo il primo nell'ordine dei turni (manca nelle partite più vecchie). */
  | { tipo: 'inizio'; ordineCasuale: boolean; bonus?: number }
  /** Con la durata massima: mancano `turni` turni alla fine della partita. */
  | { tipo: 'ultimi_turni'; turni: number }
  | { tipo: 'turno'; giocatore: IdGiocatore; numero: number }
  | { tipo: 'turno_saltato'; giocatore: IdGiocatore }
  /** `cosmico`: con le regole folli, la faccia del dado cosmico tirato insieme ai due dadi. */
  | { tipo: 'dadi'; giocatore: IdGiocatore; dadi: [number, number]; cosmico?: FacciaCosmica }
  /** `dadi` c'è quando lo spostamento viene da un tiro. */
  /** `verso`: -1 quando la pedina cammina all'indietro per la gravità invertita (anche con i dadi). */
  /** `razzo`: il volo del razzo (dado cosmico) dopo la mossa dei dadi, fino alla prossima proprietà libera. */
  | { tipo: 'movimento'; giocatore: IdGiocatore; da: number; a: number; dadi?: [number, number]; verso?: -1; razzo?: true }
  /** Il dado cosmico (regole folli): la faccia uscita; i suoi effetti seguono (razzo, bandiera, scudo) o stanno nel cosmo. */
  | { tipo: 'dado_cosmico'; giocatore: IdGiocatore; faccia: FacciaCosmica }
  /** Razzo: dopo la mossa dei dadi la pedina vola da `da` alla prossima proprietà libera `a` (segue il movimento). */
  | { tipo: 'razzo'; giocatore: IdGiocatore; da: number; a: number }
  /** Bandiera: la proprietà libera più economica diventa di `giocatore`, gratis. */
  | { tipo: 'bandiera'; giocatore: IdGiocatore; casella: number }
  /** Scudo: `giocatore` non paga l'affitto di `importo` su `casella`. */
  | { tipo: 'scudo'; giocatore: IdGiocatore; casella: number; importo: number }
  /** Spostamento di una carta folle (wormhole, scambio di posto): la pedina vola, non cammina, e non passa dalla Partenza. */
  | { tipo: 'teletrasporto'; giocatore: IdGiocatore; da: number; a: number }
  /**
   * Il volo del Giro del mondo: la pedina vola da `da` ad `a` senza passare dalla Partenza. `prezzo` è il biglietto
   * (0 con il Biglietto omaggio), pagato all'aeroporto del lato (`aeroporto`); `incassa` è chi lo riceve, `null` la banca.
   */
  | {
      tipo: 'volo';
      giocatore: IdGiocatore;
      da: number;
      a: number;
      prezzo: number;
      aeroporto: number | null;
      incassa: IdGiocatore | null;
    }
  /** Il Triangolo delle Bermuda: la pedina sparisce e ricompare su una casella a caso. */
  | { tipo: 'bermuda'; giocatore: IdGiocatore; da: number; a: number }
  /** La Buca per l'altra parte del mondo: la pedina sbuca sul lato opposto del tabellone. */
  | { tipo: 'antipodi'; giocatore: IdGiocatore; da: number; a: number }
  /** Il passaporto: `giocatore` passa dalla Partenza (o pesca il Biglietto omaggio) e da adesso può volare. */
  | { tipo: 'passaporto'; giocatore: IdGiocatore }
  /** La Linea del cambio di data: chi ci si ferma con i dadi guadagna un giorno e si muove ancora. */
  | { tipo: 'cambio_data'; giocatore: IdGiocatore }
  /** `da` sfida `a` a morra cinese per l'affitto di `casella` (`importo`, quello normale). */
  | { tipo: 'sfida'; da: IdGiocatore; a: IdGiocatore; casella: number; importo: number }
  /**
   * Com'è finita la morra: i segni di sfidante e proprietario, l'esito per lo sfidante e quanto paga (0, l'affitto o il
   * doppio). `aCaso`: chi non ha scelto in tempo e ha avuto un segno a caso. Se `importo` è più di 0 segue l'affitto.
   */
  | {
      tipo: 'morra';
      da: IdGiocatore;
      a: IdGiocatore;
      casella: number;
      segni: [Segno, Segno];
      esito: 'vinta' | 'persa' | 'pari';
      importo: number;
      aCaso?: IdGiocatore;
    }
  /** Carta Robin Hood: chi ha più contante (`da`) dà `importo` a chi ne ha meno (`a`). */
  | { tipo: 'robin_hood'; da: IdGiocatore; a: IdGiocatore; importo: number }
  /** Carta della moneta: con testa `giocatore` riceve `importo` dalla banca, con croce lo paga. */
  | { tipo: 'moneta'; giocatore: IdGiocatore; testa: boolean; importo: number }
  /** Inizio di un giro sul Sistema solare: l'evento cosmico e il pianeta del Mercato galattico. */
  | { tipo: 'cosmo'; giro: number; evento: EventoCosmico; mercato: { regione: number; fattore: number } | null }
  /** Affitto quantistico: la faccia del dado e il fattore per cui si moltiplica l'affitto che segue. */
  | { tipo: 'quantico'; giocatore: IdGiocatore; casella: number; faccia: number; fattore: number }
  /** Fionda gravitazionale: la pedina riparte di `passi` caselle (segue un movimento). */
  | { tipo: 'fionda'; giocatore: IdGiocatore; passi: number }
  /** Il Buco nero risucchia `importo` nel malloppo. */
  | { tipo: 'buco_nero'; giocatore: IdGiocatore; casella: number; importo: number }
  /**
   * La Supernova esplode: il dado (`faccia`, `fattore`) moltiplica il `malloppo`, `giocatore` incassa `importo`
   * e nella stella resta `resta` (il malloppo di partenza, o di più se il dado ha dato meno di ×1).
   * `alPovero`: la parte oltre il tetto di contante (`Follie.tetto`), che va all'avversario con meno contante.
   */
  | {
      tipo: 'supernova';
      giocatore: IdGiocatore;
      casella: number;
      malloppo: number;
      faccia: number;
      fattore: number;
      importo: number;
      resta: number;
      alPovero: { giocatore: IdGiocatore; importo: number } | null;
    }
  /**
   * Il malloppo della Supernova cresce di `importo`, messo dalla banca: a ogni giro nuovo (`giro`), quando `giocatore`
   * passa sopra la Supernova (`polvere`) o quando la tempesta solare gli mangia il premio della Partenza (`tempesta`).
   * `giocatore` è `null` per il giro.
   */
  | { tipo: 'malloppo'; motivo: 'giro' | 'polvere' | 'tempesta'; importo: number; giocatore: IdGiocatore | null }
  /** Roulette cosmica: lo spicchio uscito (indice in `Follie.roulette`); segue il suo effetto. */
  | { tipo: 'roulette'; giocatore: IdGiocatore; spicchio: number; testo: string }
  /** Pioggia di meteoriti: crolla un edificio; `livello` è quello che resta (0–4). */
  | { tipo: 'meteorite'; giocatore: IdGiocatore; casella: number; livello: number }
  /** Collisione planetaria: le due proprietà si scambiano di proprietario (`giocatori[i]` era il proprietario di `caselle[i]`). */
  | { tipo: 'collisione'; caselle: [number, number]; giocatori: [IdGiocatore, IdGiocatore] }
  /** Una carta inverte la gravità fino alla fine del giro. */
  | { tipo: 'gravita_invertita'; giocatore: IdGiocatore }
  /** `tempesta`: la tempesta solare si è mangiata il premio (importo 0), che va nel malloppo della Supernova. */
  | { tipo: 'partenza'; giocatore: IdGiocatore; importo: number; arrivo: boolean; tempesta?: true }
  | { tipo: 'acquisto'; giocatore: IdGiocatore; casella: number; prezzo: number }
  | { tipo: 'affitto'; da: IdGiocatore; a: IdGiocatore; casella: number; importo: number }
  | { tipo: 'tassa'; giocatore: IdGiocatore; casella: number; importo: number }
  | { tipo: 'premio'; giocatore: IdGiocatore; casella: number; importo: number }
  | { tipo: 'carta'; giocatore: IdGiocatore; mazzo: NomeMazzo; carta: number; testo: string }
  | { tipo: 'prigione'; giocatore: IdGiocatore; motivo: 'casella' | 'carta' | 'tre_doppi' }
  | { tipo: 'prigione_fallita'; giocatore: IdGiocatore; tentativi: number }
  | { tipo: 'uscita_prigione'; giocatore: IdGiocatore; modo: 'doppio' | 'cauzione' | 'grazia' | 'tentativi' }
  | { tipo: 'vacanza'; giocatore: IdGiocatore; incasso: number }
  | { tipo: 'vendita'; giocatore: IdGiocatore; casella: number; importo: number }
  /** `livello`: quello raggiunto (5 = albergo). */
  | { tipo: 'costruzione'; giocatore: IdGiocatore; casella: number; livello: number; costo: number }
  /** `livello`: quello rimasto dopo la vendita dell'edificio. */
  | { tipo: 'demolizione'; giocatore: IdGiocatore; casella: number; livello: number; importo: number }
  | { tipo: 'ipoteca'; giocatore: IdGiocatore; casella: number; importo: number }
  | { tipo: 'riscatto'; giocatore: IdGiocatore; casella: number; importo: number }
  | { tipo: 'asta'; giocatore: IdGiocatore; casella: number }
  | { tipo: 'asta_vinta'; giocatore: IdGiocatore; casella: number; importo: number }
  /** Nessuno ha offerto, oppure chi ha vinto non ha più i soldi (`offerente`). La proprietà resta libera. */
  | { tipo: 'asta_deserta'; casella: number; offerente: IdGiocatore | null }
  | {
      tipo: 'scambio_proposto';
      scambio: number;
      da: IdGiocatore;
      a: IdGiocatore;
      trattativa: number;
      /** Chi aveva proposto ha cambiato la sua proposta (manca se è una proposta nuova o una controproposta). */
      modifica?: true;
    }
  | { tipo: 'scambio_accettato'; scambio: number; da: IdGiocatore; a: IdGiocatore; dare: Pacchetto; avere: Pacchetto }
  | { tipo: 'scambio_rifiutato'; scambio: number; da: IdGiocatore; a: IdGiocatore }
  | { tipo: 'scambio_annullato'; scambio: number; da: IdGiocatore; a: IdGiocatore }
  /** Non aveva abbastanza contante: `importo` è la parte che resta da dare. */
  | { tipo: 'debito'; da: IdGiocatore; a: IdGiocatore; importo: number }
  /** Parte di un debito saldata in automatico con un'entrata. */
  | { tipo: 'rimborso'; da: IdGiocatore; a: IdGiocatore; importo: number }
  /**
   * Soldi che passano di mano per una carta («Paga 50 €», il compleanno, le riparazioni): gli altri movimenti di denaro
   * hanno già il loro evento (affitto, tassa, acquisto…). `null` è la banca. Il registro non lo mostra: serve ai gettoni
   * che volano da chi paga a chi incassa. Se chi paga non ha abbastanza contante, segue un evento `debito`.
   */
  | { tipo: 'trasferimento'; da: IdGiocatore | null; a: IdGiocatore | null; importo: number }
  /**
   * `recuperi`: quanto la banca dà a ogni creditore, dal valore dei beni del fallito.
   * `automatica`: il tempo è scaduto mentre era in debito.
   */
  | { tipo: 'bancarotta'; giocatore: IdGiocatore; recuperi: Debito[]; automatica?: true; erede?: IdGiocatore }
  /**
   * Uscita dalla partita per tempo, assenza, voto o espulsione: i beni vanno come in una bancarotta.
   * `erede` (in tutte e due): a squadre, il compagno che prende le proprietà invece della banca.
   */
  | {
      tipo: 'rimozione';
      giocatore: IdGiocatore;
      motivo: Exclude<MotivoUscita, 'bancarotta'>;
      recuperi: Debito[];
      erede?: IdGiocatore;
    }
  /**
   * A squadre, un compagno raccoglie i beni di chi è appena uscito: il contante che gli restava (o quello che avanza
   * dopo aver pagato i creditori), le proprietà e le Carte Grazia (queste solo se è uscito senza rosso).
   */
  | { tipo: 'eredita'; da: IdGiocatore; a: IdGiocatore; soldi: number; caselle: number[]; grazie: number }
  /**
   * A squadre: una città di chi è uscito è tornata alla banca e la regione non è più completa, quindi gli edifici
   * del compagno lì tornano alla banca. `importo`: metà del loro costo, che il compagno incassa.
   */
  | { tipo: 'edifici_venduti'; giocatore: IdGiocatore; caselle: number[]; importo: number }
  /** Il tempo del turno è finito: da qui il gioco fa le mosse al posto suo. `assente`: non è collegato. */
  | { tipo: 'tempo_scaduto'; giocatore: IdGiocatore; assente: boolean }
  | { tipo: 'tempo_chiesto'; giocatore: IdGiocatore }
  | { tipo: 'tempo_regalato'; da: IdGiocatore; a: IdGiocatore; ms: number }
  /** `voti`: quanti sono adesso i voti a favore; `servono`: quanti ne servono per toglierlo. */
  | { tipo: 'voto'; da: IdGiocatore; contro: IdGiocatore; favorevole: boolean; voti: number; servono: number }
  /** `squadra`: a squadre, la squadra vincitrice. `durata`: finita per la durata massima, vince il patrimonio più alto. */
  | { tipo: 'fine'; vincitore: IdGiocatore | null; squadra?: number; durata?: true };

export type TipoEvento = Evento['tipo'];

export type CodiceErrore =
  | 'partita_finita'
  | 'giocatore_sconosciuto'
  | 'eliminato'
  | 'non_tuo_turno'
  | 'gia_lanciato'
  | 'non_ancora_lanciato'
  | 'devi_rilanciare'
  | 'saldo_negativo'
  | 'soldi_insufficienti'
  | 'niente_da_comprare'
  | 'non_in_prigione'
  | 'niente_grazia'
  | 'non_tua'
  | 'edifici_nella_regione'
  | 'giocatori_non_validi'
  | 'squadre_non_valide'
  | 'decidi_acquisto'
  | 'non_costruibile'
  | 'regione_incompleta'
  | 'regione_ipotecata'
  | 'livello_massimo'
  | 'livello_minimo'
  | 'costruzione_uniforme'
  | 'ipoteche_disattivate'
  | 'gia_ipotecata'
  | 'non_ipotecata'
  | 'aste_disattivate'
  | 'asta_in_corso'
  | 'niente_asta'
  | 'asta_finita'
  | 'offerta_bassa'
  | 'offerta_tua'
  | 'scambio_inesistente'
  | 'non_tuo_scambio'
  | 'troppi_scambi'
  | 'scambio_non_valido'
  | 'timer_spento'
  | 'gia_chiesto'
  | 'gia_regalato'
  | 'regali_esauriti'
  | 'voto_non_disponibile'
  | 'gia_votato'
  | 'non_votato'
  | 'sta_giocando'
  | 'niente_voli'
  | 'meta_non_valida'
  | 'sfida_in_corso'
  | 'niente_sfida'
  | 'non_tua_sfida'
  | 'segno_non_valido';

export interface Errore {
  codice: CodiceErrore;
  messaggio: string;
}

export type Esito = { ok: true; stato: Stato; eventi: Evento[] } | ({ ok: false } & Errore);

/** Fonte di numeri casuali. Il server usa `crypto`, i test un generatore con seme. */
export interface Caso {
  /** Intero casuale tra 0 e `n - 1`. */
  intero(n: number): number;
}
