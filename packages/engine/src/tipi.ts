/*
 * Tipi del motore di gioco.
 * Lo stato è un oggetto JSON semplice: si copia, si salva su file e si invia così com'è.
 */

export type IdGiocatore = string;
/** I quattro tabelloni: vedi docs/identita/tabellone-e-carte.md e docs/identita/tabelloni-alternativi.md. */
export type IdMappa = 'classica' | 'europa' | 'grandi_aree' | 'fortuna';
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

export type Proprietabile = Citta | Stazione | Servizio;
export type Casella = Proprietabile | CasellaCarta | Tassa | Premio | Angolo;
export type TipoCasella = Casella['tipo'];

export interface Regione {
  nome: string;
  /** Tre lettere per lo stemma (es. "TOS"). */
  sigla: string;
  /** Colore dello stemma, 1–10 (le variabili --g1…--g10). Di solito l'indice della regione più uno. */
  colore: number;
  costoCasa: number;
  costoAlbergo: number;
}

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
  | { tipo: 'riparazioni'; casa: number; albergo: number };

export interface Carta {
  testo: string;
  effetto: Effetto;
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
}

export interface Proprieta {
  proprietario: IdGiocatore | null;
  /** 0 = solo terreno, 1–4 case, 5 = albergo. */
  livello: number;
  ipotecata: boolean;
}

export interface Mazzo {
  /** Ordine segreto delle carte (indici in `Tabellone.mazzi`). Non va mai mandato ai giocatori. */
  ordine: number[];
  /** Posizione in `ordine` della prossima carta da pescare. */
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
  | { tipo: 'vota'; giocatore: IdGiocatore; favorevole: boolean };

export type TipoAzione = Azione['tipo'];

export type Evento =
  | { tipo: 'inizio'; ordineCasuale: boolean }
  | { tipo: 'turno'; giocatore: IdGiocatore; numero: number }
  | { tipo: 'turno_saltato'; giocatore: IdGiocatore }
  | { tipo: 'dadi'; giocatore: IdGiocatore; dadi: [number, number] }
  /** `dadi` c'è quando lo spostamento viene da un tiro. */
  | { tipo: 'movimento'; giocatore: IdGiocatore; da: number; a: number; dadi?: [number, number] }
  | { tipo: 'partenza'; giocatore: IdGiocatore; importo: number; arrivo: boolean }
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
  | { tipo: 'scambio_proposto'; scambio: number; da: IdGiocatore; a: IdGiocatore; trattativa: number }
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
  /** `squadra`: a squadre, la squadra vincitrice. */
  | { tipo: 'fine'; vincitore: IdGiocatore | null; squadra?: number };

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
  | 'sta_giocando';

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
