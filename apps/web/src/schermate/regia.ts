/*
 * Regia della partita: trasforma gli eventi che arrivano dal server in animazioni, uno dopo l'altro.
 * - I dadi rotolano e rallentano, poi la pedina avanza casella per casella verso la meta già accesa
 *   (o vola in prigione); la carta pescata arriva al centro; chi fa bancarotta sprofonda.
 * - Le righe del registro compaiono quando il loro evento "accade" sullo schermo.
 * - In parallelo, senza fermare niente (gli «effetti»): i gettoni volano da chi paga a chi incassa e i saldi
 *   cambiano quando il gettone parte e quando arriva; le caselle di uno scambio lampeggiano; le sbarre si muovono.
 * - Il resto della partita (turno, proprietà…) si aggiorna alla fine della scena, e intanto i pulsanti del turno aspettano.
 *   Acquisti, case e ipoteche si vedono già quando il loro evento va in scena.
 * Gli eventi senza scena (voti, scambi, ipoteche…) compaiono subito, senza fermare i pulsanti.
 * Se la scheda è nascosta, se ci sono troppi eventi insieme, se arrivano in ritardo (dopo una disconnessione)
 * o se si preferisce meno movimento, si salta direttamente allo stato finale.
 * Le durate delle scene sono in TEMPI (packages/engine/src/tempi.ts), le stesse che fanno aspettare i bot.
 */

import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  durataCarta,
  durataEvento,
  passiPedina,
  percorso,
  tabellone,
  TEMPI,
  type Evento,
  type EventoStanza,
  type IdGiocatore,
  type NomeMazzo,
  type Proprieta,
  type Stato,
  type VoceRegistro,
} from '@poordown/engine';
import type { Collegamento } from '../rete/collegamento';
import { DURATA } from '../ui/movimento';

export interface PosizioneMostrata {
  casella: number;
  prigione: boolean;
}

/** Un gettone che vola da chi paga a chi incassa. `null` è la banca: la casella che c'entra, o il centro del tabellone. */
export interface Gettone {
  id: number;
  da: IdGiocatore | null;
  a: IdGiocatore | null;
  importo: number;
  casella?: number;
}

/** La casella dove si è fermato chi gioca: rossa se lì ha pagato l'affitto. */
export interface Arrivo {
  casella: number;
  tono: 'normale' | 'affitto';
}

/** La carta pescata in scena, al centro del tabellone. */
export interface CartaInScena {
  n: number;
  giocatore: IdGiocatore;
  mazzo: NomeMazzo;
  carta: number;
  testo: string;
  /** La casella da cui esce. */
  casella: number;
}

/** L'esito di uno scambio, timbrato sul tabellone. */
export interface TimbroScambio {
  n: number;
  tipo: 'accettato' | 'rifiutato';
  da: IdGiocatore;
  a: IdGiocatore;
}

export interface Scena {
  /** La partita mostrata: resta indietro finché le animazioni non sono finite (saldi e proprietà seguono gli effetti). */
  partita: Stato | null;
  /** Le voci del registro fino a questo numero sono già comparse. */
  registroFino: number;
  /** La voce in scena adesso (la sua scheda può già comparire), `null` fuori scena. */
  inCorso: number | null;
  /** Pedine in movimento: le altre stanno dove dice `partita`. */
  posizioni: Readonly<Record<IdGiocatore, PosizioneMostrata>>;
  /** Cresce a ogni passo di una pedina: la fa saltellare. */
  passi: Readonly<Record<IdGiocatore, number>>;
  /** Quanto dura il passo in corso (i passi accelerano in mezzo al viaggio). */
  passoMs: Readonly<Record<IdGiocatore, number>>;
  /** Cresce a ogni arrivo: la pedina si schiaccia e manda un'onda del suo colore. */
  arrivi: Readonly<Record<IdGiocatore, number>>;
  /** Pedine in volo verso la prigione. */
  voli: Readonly<Record<IdGiocatore, true>>;
  /** Dove sta andando la pedina: la casella si accende appena i dadi si fermano. */
  meta: { giocatore: IdGiocatore; casella: number } | null;
  /** Dove si è fermato chi gioca, fino a fine turno. */
  arrivo: Arrivo | null;
  dadi: [number, number];
  /** Cresce a ogni lancio: fa ripartire l'animazione dei dadi. */
  lanci: number;
  rotola: boolean;
  /** Una scena è in corso: i pulsanti del turno aspettano. */
  occupata: boolean;
  carta: CartaInScena | null;
  /** Le sbarre della prigione: scendono quando entra qualcuno, si alzano quando esce. `n` cresce a ogni movimento. */
  sbarre: { n: number; verso: 'giu' | 'su' } | null;
  /** Chi sta facendo bancarotta, con le caselle che perde. */
  bancarotta: { giocatore: IdGiocatore; caselle: number[] } | null;
  gettoni: readonly Gettone[];
  /** Caselle che lampeggiano nel colore del nuovo proprietario (scambio fatto). */
  lampeggia: readonly number[];
  timbro: TimbroScambio | null;
}

/** Con più eventi di così in un colpo solo (es. dopo una risincronizzazione) non si anima. */
const MAX_ANIMATI = 25;
/**
 * Eventi nati più di così prima di arrivare (dopo una disconnessione) sono già passati: rimetterli in scena
 * lascerebbe lo schermo indietro mentre il turno, magari il mio, sta già scorrendo.
 */
const RITARDO_MAX_MS = 2_000;
/** Il volo di un gettone. */
export const VOLO_GETTONE_MS = DURATA.viaggio * 1000;
/** Più pagamenti insieme (il compleanno, una carta «paga a ogni giocatore»): un gettone ogni tanto. */
const SFASATURA_GETTONI_MS = 150;
/** Quanto lampeggiano le caselle di uno scambio e quanto resta il timbro. */
const LAMPO_SCAMBIO_MS = 1_400;
const TIMBRO_MS = 1_400;

/* ------------------------------------------------------------------ */
/* Soldi: chi paga, chi incassa                                        */
/* ------------------------------------------------------------------ */

/**
 * Un movimento di denaro raccontato da un evento. `null` è la banca.
 * - `addebita`: il saldo di `da` scende quando il gettone parte (no per i rimborsi: il debito era già nel rosso).
 * - Il saldo di `a` sale quando il gettone arriva.
 * - `gettone`: false per il debito, che non sposta soldi ma toglie a chi aspettava la parte non pagata.
 */
export interface MovimentoSoldi {
  da: IdGiocatore | null;
  a: IdGiocatore | null;
  importo: number;
  casella?: number;
  addebita: boolean;
  gettone: boolean;
}

function movimento(da: IdGiocatore | null, a: IdGiocatore | null, importo: number, casella?: number): MovimentoSoldi[] {
  if (importo <= 0) return [];
  return [{ da, a, importo, ...(casella === undefined ? {} : { casella }), addebita: true, gettone: true }];
}

/**
 * I soldi che un evento fa passare di mano. Insieme spiegano ogni cambio dei saldi
 * (lo verifica regia.test.ts su partite intere), tranne il saldo azzerato di chi esce dalla partita.
 */
export function movimentiSoldi(e: EventoStanza, partita: Stato): MovimentoSoldi[] {
  const tab = tabellone(partita.mappa);
  switch (e.tipo) {
    case 'affitto':
      return movimento(e.da, e.a, e.importo);
    case 'trasferimento':
      return movimento(e.da, e.a, e.importo);
    case 'tassa':
    case 'riscatto':
      return movimento(e.giocatore, null, e.importo, e.casella);
    case 'acquisto':
      return movimento(e.giocatore, null, e.prezzo, e.casella);
    case 'asta_vinta':
      return movimento(e.giocatore, null, e.importo, e.casella);
    case 'costruzione':
      return movimento(e.giocatore, null, e.costo, e.casella);
    case 'premio':
    case 'demolizione':
    case 'vendita':
    case 'ipoteca':
      return movimento(null, e.giocatore, e.importo, e.casella);
    case 'partenza':
      return movimento(null, e.giocatore, e.importo, 0);
    case 'vacanza': {
      const casella = tab.caselle.findIndex((c) => c.tipo === 'vacanza');
      return movimento(null, e.giocatore, e.incasso, casella >= 0 ? casella : undefined);
    }
    case 'uscita_prigione':
      return e.modo === 'cauzione' ? movimento(e.giocatore, null, tab.cauzione, tab.prigione) : [];
    case 'edifici_venduti':
      return movimento(null, e.giocatore, e.importo);
    case 'eredita':
      return movimento(e.da, e.a, e.soldi);
    case 'bancarotta':
    case 'rimozione':
      return e.recuperi.flatMap((r) => movimento(null, r.creditore, r.importo));
    case 'scambio_accettato':
      return [...movimento(e.da, e.a, e.dare.soldi), ...movimento(e.a, e.da, e.avere.soldi)];
    case 'rimborso':
      return e.importo > 0 ? [{ da: e.da, a: e.a, importo: e.importo, addebita: false, gettone: true }] : [];
    case 'debito':
      // Chi aspettava i soldi ne riceve solo una parte: il resto gli arriverà con i rimborsi.
      return e.importo > 0 ? [{ da: e.a, a: null, importo: e.importo, addebita: true, gettone: false }] : [];
    default:
      return [];
  }
}

/* ------------------------------------------------------------------ */
/* Casella d'arrivo                                                    */
/* ------------------------------------------------------------------ */

/**
 * La casella dove si è fermato chi gioca nel turno in corso (fino alla voce `fino`), rossa se lì ha pagato l'affitto.
 * `null` se nel turno non si è ancora mosso, se ha tirato di nuovo o se è finito in prigione.
 */
export function arrivoDelTurno(registro: readonly VoceRegistro[], fino = Infinity): Arrivo | null {
  const affitti = new Set<string>();
  for (let i = registro.length - 1; i >= 0; i--) {
    const v = registro[i]!;
    if (v.n > fino) continue;
    const e = v.evento;
    switch (e.tipo) {
      case 'affitto':
        affitti.add(`${e.da}:${e.casella}`);
        break;
      case 'movimento':
        return { casella: e.a, tono: affitti.has(`${e.giocatore}:${e.a}`) ? 'affitto' : 'normale' };
      case 'turno':
      case 'dadi':
      case 'prigione':
      case 'inizio':
      case 'fine':
      case 'nuova_partita':
        return null;
      default:
        break;
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */

function ultimoNumero(registro: readonly VoceRegistro[]): number {
  return registro.at(-1)?.n ?? 0;
}

/** L'ultimo lancio nel registro: i dadi da mostrare quando il turno nuovo non ha ancora tirato. */
function ultimoLancio(registro: readonly VoceRegistro[]): [number, number] | undefined {
  for (let i = registro.length - 1; i >= 0; i--) {
    const e = registro[i]!.evento;
    if (e.tipo === 'dadi') return e.dadi;
  }
  return undefined;
}

function faccia(): number {
  return 1 + Math.floor(Math.random() * 6);
}

function pocoMovimento(): boolean {
  return typeof window !== 'undefined' && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
}

/** La scheda non si vede: le animazioni non servono (e i timer del browser rallentano). */
function nascosta(): boolean {
  return typeof document !== 'undefined' && document.hidden;
}

function senza<T>(mappa: Readonly<Record<IdGiocatore, T>>, id: IdGiocatore): Record<IdGiocatore, T> {
  return Object.fromEntries(Object.entries(mappa).filter(([k]) => k !== id));
}

/** Un credito in viaggio: il saldo di chi incassa sale solo quando il gettone arriva. */
interface Credito {
  a: IdGiocatore;
  importo: number;
}

export class Regia {
  private scena: Scena;
  private coda: VoceRegistro[] = [];
  private ultimaVista: number;
  private inScena = false;
  /** Cambia quando la regia si ferma: le scene vecchie rimaste a metà non toccano più niente. */
  private generazione = 0;
  /** Cambia quando gli effetti in parallelo vanno annullati (scena saltata, regia ferma). */
  private generazioneEffetti = 0;
  /** Cambia a ogni allineamento: da lì la partita mostrata contiene già i soldi degli eventi passati. */
  private versioneBase = 0;
  /** Crediti dei gettoni non ancora arrivati (anche quelli che devono ancora partire). */
  private readonly crediti = new Map<number, Credito>();
  /** Voci già messe in scena in anticipo (la Partenza, mentre la pedina ci passa sopra). */
  private readonly anticipate = new Set<number>();
  private prossimoGettone = 1;
  /** Quando può partire il prossimo gettone (ms di Date.now): più pagamenti di fila partono sfasati. */
  private prossimaPartenza = 0;
  private readonly timer = new Set<ReturnType<typeof setTimeout>>();
  private readonly ascoltatori = new Set<() => void>();
  private smetti: (() => void) | null = null;

  constructor(private readonly coll: Collegamento) {
    const s = coll.leggi();
    this.ultimaVista = ultimoNumero(s.registro);
    const partita = s.stanza?.partita ?? null;
    this.scena = {
      partita,
      registroFino: this.ultimaVista,
      inCorso: null,
      posizioni: {},
      passi: {},
      passoMs: {},
      arrivi: {},
      voli: {},
      meta: null,
      arrivo: arrivoDelTurno(s.registro),
      dadi: partita?.turno.dadi ?? [5, 2],
      lanci: 0,
      rotola: false,
      occupata: false,
      carta: null,
      sbarre: null,
      bancarotta: null,
      gettoni: [],
      lampeggia: [],
      timbro: null,
    };
  }

  readonly leggi = (): Scena => this.scena;

  readonly iscrivi = (fn: () => void): (() => void) => {
    this.ascoltatori.add(fn);
    return () => this.ascoltatori.delete(fn);
  };

  avvia(): void {
    this.smetti = this.coll.ascolta(() => this.aggiorna());
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this.cambiaVisibilita);
    this.ultimaVista = ultimoNumero(this.coll.leggi().registro);
    this.allinea();
  }

  ferma(): void {
    this.smetti?.();
    this.smetti = null;
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.cambiaVisibilita);
    this.generazione++;
    this.generazioneEffetti++;
    for (const t of this.timer) clearTimeout(t);
    this.timer.clear();
    this.coda = [];
    this.crediti.clear();
    this.anticipate.clear();
    this.inScena = false;
  }

  /* ------------------------------------------------------------------ */

  private caselle(): number {
    const partita = this.scena.partita ?? this.coll.leggi().stanza?.partita;
    return partita ? tabellone(partita.mappa).caselle.length : 40;
  }

  /** L'evento ha una scena che ferma il gioco (le stesse durate di `durataScena` per i bot). */
  private animabile(e: EventoStanza): boolean {
    return e.tipo === 'movimento' || durataEvento(e as Evento, this.caselle()) > 0;
  }

  private aggiorna(): void {
    const s = this.coll.leggi();
    const ultimo = ultimoNumero(s.registro);
    // Registro ricaricato da capo (risincronizzazione): niente da animare.
    const nuove = ultimo < this.ultimaVista ? [] : s.registro.filter((v) => v.n > this.ultimaVista);
    this.ultimaVista = ultimo;
    const inRitardo = nuove.length > 0 && this.coll.orologio() - nuove[0]!.quando > RITARDO_MAX_MS;

    if (!s.stanza?.partita || nascosta() || pocoMovimento() || nuove.length > MAX_ANIMATI || inRitardo) {
      this.interrompi();
      return;
    }
    if (this.inScena) {
      this.coda.push(...nuove);
      return;
    }
    // Niente da animare: la partita si aggiorna subito, i pulsanti del turno restano dove sono e gli effetti partono.
    if (!nuove.some((v) => this.animabile(v.evento))) {
      this.allinea();
      for (const v of nuove) this.effetto(v, true);
      return;
    }
    this.coda.push(...nuove);
    void this.recita();
  }

  /** Interrompe la scena in corso (le sue attese restano senza effetto) e mostra la partita com'è adesso. */
  private interrompi(): void {
    this.coda = [];
    this.generazione++;
    this.generazioneEffetti++;
    this.crediti.clear();
    this.anticipate.clear();
    this.inScena = false;
    this.cambia({ gettoni: [], lampeggia: [], timbro: null });
    this.allinea();
  }

  /** La scheda si nasconde: i timer del browser rallentano, quindi la scena si chiude subito. */
  private readonly cambiaVisibilita = (): void => {
    if (nascosta() && (this.inScena || this.coda.length > 0 || this.crediti.size > 0)) this.interrompi();
  };

  /**
   * Mostra la partita com'è adesso, senza animazioni in sospeso. I saldi di chi aspetta un gettone ancora in volo
   * restano indietro finché il gettone non arriva.
   */
  private allinea(): void {
    const s = this.coll.leggi();
    let partita = s.stanza?.partita ?? null;
    this.versioneBase++;
    if (partita && this.crediti.size > 0) {
      const attesa = new Map<IdGiocatore, number>();
      for (const c of this.crediti.values()) attesa.set(c.a, (attesa.get(c.a) ?? 0) + c.importo);
      partita = { ...partita, giocatori: partita.giocatori.map((g) => (attesa.has(g.id) ? { ...g, saldo: g.saldo - attesa.get(g.id)! } : g)) };
    }
    this.cambia({
      partita,
      registroFino: this.ultimaVista,
      inCorso: null,
      posizioni: {},
      passoMs: {},
      voli: {},
      meta: null,
      arrivo: arrivoDelTurno(s.registro, this.ultimaVista),
      rotola: false,
      occupata: false,
      carta: null,
      bancarotta: null,
      dadi: partita?.turno.dadi ?? ultimoLancio(s.registro) ?? this.scena.dadi,
    });
  }

  private async recita(): Promise<void> {
    const gen = this.generazione;
    this.inScena = true;
    this.cambia({ occupata: true });
    while (this.coda.length > 0) {
      const voce = this.coda.shift()!;
      if (this.anticipate.delete(voce.n)) {
        this.cambia({ registroFino: voce.n });
        continue;
      }
      this.cambia({ inCorso: voce.n });
      this.effetto(voce, false);
      await this.anima(voce, gen);
      if (gen !== this.generazione) return;
      this.cambia({ registroFino: voce.n });
    }
    this.inScena = false;
    this.allinea();
  }

  /** La parte che ferma il gioco: dura esattamente quanto `durataEvento` (i bot aspettano lo stesso tempo). */
  private async anima(voce: VoceRegistro, gen: number): Promise<void> {
    const e = voce.evento;
    const partita = this.scena.partita;
    if (!partita) return;
    const tab = tabellone(partita.mappa);
    switch (e.tipo) {
      case 'dadi': {
        this.cambia({ rotola: true, lanci: this.scena.lanci + 1, meta: null, arrivo: null });
        for (const ms of TEMPI.facceDado) {
          if (gen !== this.generazione) return;
          this.cambia({ dadi: [faccia(), faccia()] });
          await this.attendi(ms);
        }
        // Scena interrotta: i dadi giusti li ha già messi `allinea`.
        if (gen !== this.generazione) return;
        // Appena i dadi si fermano si accende la casella dove andrà la pedina.
        const mossa = this.prossimoMovimento(e.giocatore);
        this.cambia({ dadi: e.dadi, rotola: false, meta: mossa ? { giocatore: e.giocatore, casella: mossa.a } : null });
        await this.attendi(TEMPI.dadiFermi);
        return;
      }
      case 'movimento': {
        const n = tab.caselle.length;
        const { passi, verso } = percorso(e, n);
        const tempi = passiPedina(passi);
        const partenza = verso === 1 ? this.partenzaDaAnticipare(e.giocatore) : undefined;
        this.cambia({ meta: { giocatore: e.giocatore, casella: e.a }, arrivo: null });
        let casella = e.da;
        for (let i = 0; i < passi; i++) {
          if (gen !== this.generazione) return;
          casella = (casella + verso + n) % n;
          this.muovi(e.giocatore, { casella, prigione: false }, tempi[i]);
          // Passando dalla Partenza il gettone parte subito, mentre la pedina continua a camminare.
          if (casella === 0 && partenza && !this.anticipate.has(partenza.n)) {
            this.anticipate.add(partenza.n);
            this.effetto(partenza, false);
          }
          await this.attendi(tempi[i]!);
        }
        if (gen !== this.generazione) return;
        // Arrivata: smette di camminare (le pedine tornano a riassestarsi con la molla), si schiaccia, manda l'onda.
        this.cambia({
          meta: null,
          arrivo: { casella: e.a, tono: 'normale' },
          passoMs: senza(this.scena.passoMs, e.giocatore),
          arrivi: { ...this.scena.arrivi, [e.giocatore]: (this.scena.arrivi[e.giocatore] ?? 0) + 1 },
        });
        await this.attendi(TEMPI.fineMovimento);
        return;
      }
      case 'prigione':
        this.cambia({
          meta: null,
          arrivo: null,
          voli: { ...this.scena.voli, [e.giocatore]: true },
          sbarre: { n: (this.scena.sbarre?.n ?? 0) + 1, verso: 'giu' },
        });
        this.muovi(e.giocatore, { casella: tab.prigione, prigione: true });
        await this.attendi(TEMPI.prigione);
        if (gen !== this.generazione) return;
        this.cambia({ voli: senza(this.scena.voli, e.giocatore) });
        return;
      case 'uscita_prigione': {
        const casella = this.scena.posizioni[e.giocatore]?.casella ?? partita.giocatori.find((g) => g.id === e.giocatore)?.posizione;
        if (casella !== undefined) this.cambia({ posizioni: { ...this.scena.posizioni, [e.giocatore]: { casella, prigione: false } } });
        return;
      }
      case 'carta': {
        const casella = this.scena.posizioni[e.giocatore]?.casella ?? partita.giocatori.find((g) => g.id === e.giocatore)?.posizione ?? 0;
        this.cambia({ carta: { n: voce.n, giocatore: e.giocatore, mazzo: e.mazzo, carta: e.carta, testo: e.testo, casella } });
        await this.attendi(durataCarta(e.testo) - TEMPI.cartaEsce);
        if (gen !== this.generazione) return;
        // La carta esce (AnimatePresence) verso la scheda dell'evento; poi parte il suo effetto.
        this.cambia({ carta: null });
        await this.attendi(TEMPI.cartaEsce);
        return;
      }
      case 'bancarotta':
      case 'rimozione': {
        // Con un erede le proprietà cambiano solo colore; senza, i blocchi si sfilano dal tabellone.
        const caselle = e.erede ? [] : partita.proprieta.flatMap((p, i) => (p?.proprietario === e.giocatore ? [i] : []));
        this.cambia({ bancarotta: { giocatore: e.giocatore, caselle }, meta: null, arrivo: null });
        await this.attendi(TEMPI.bancarotta);
        return;
      }
      default: {
        const ms = durataEvento(e as Evento, tab.caselle.length);
        if (ms > 0) await this.attendi(ms);
        return;
      }
    }
  }

  /** Il prossimo spostamento di questo giocatore già in coda, prima di un altro tiro o di un altro turno. */
  private prossimoMovimento(id: IdGiocatore): Extract<Evento, { tipo: 'movimento' }> | undefined {
    for (const v of this.coda) {
      const e = v.evento;
      if (e.tipo === 'movimento' && e.giocatore === id) return e;
      if (e.tipo === 'dadi' || e.tipo === 'turno' || e.tipo === 'prigione' || e.tipo === 'movimento') return undefined;
    }
    return undefined;
  }

  /** La Partenza che segue questo spostamento (passandoci sopra, non fermandocisi): il suo gettone parte durante i passi. */
  private partenzaDaAnticipare(id: IdGiocatore): VoceRegistro | undefined {
    for (const v of this.coda) {
      const e = v.evento;
      if (e.tipo === 'partenza') return e.giocatore === id && !e.arrivo ? v : undefined;
      if (e.tipo === 'movimento' || e.tipo === 'dadi' || e.tipo === 'turno') return undefined;
    }
    return undefined;
  }

  /* ------------------------------------------------------------------ */
  /* Effetti in parallelo                                                */
  /* ------------------------------------------------------------------ */

  /**
   * Quello che un evento fa partire senza fermare il gioco. `inBase`: la partita mostrata contiene già il risultato
   * dell'evento (fuori scena, dopo `allinea`); altrimenti saldi e proprietà si ritoccano qui, quando l'evento va in scena.
   */
  private effetto(voce: VoceRegistro, inBase: boolean): void {
    const e = voce.evento;
    const partita = this.scena.partita;
    if (!partita) return;
    for (const m of movimentiSoldi(e, partita)) this.muoviSoldi(m, inBase);
    const ritocca = (casella: number, cambia: (p: Proprieta) => Proprieta) => {
      if (!inBase) this.ritoccaProprieta(new Map([[casella, cambia]]));
    };
    switch (e.tipo) {
      case 'acquisto':
      case 'asta_vinta':
        ritocca(e.casella, () => ({ proprietario: e.giocatore, livello: 0, ipotecata: false }));
        return;
      case 'costruzione':
      case 'demolizione':
        ritocca(e.casella, (p) => ({ ...p, livello: e.livello }));
        return;
      case 'ipoteca':
      case 'riscatto':
        ritocca(e.casella, (p) => ({ ...p, ipotecata: e.tipo === 'ipoteca' }));
        return;
      case 'vendita':
        ritocca(e.casella, () => ({ proprietario: null, livello: 0, ipotecata: false }));
        return;
      case 'affitto':
        if (!inBase && this.scena.arrivo?.casella === e.casella) this.cambia({ arrivo: { casella: e.casella, tono: 'affitto' } });
        return;
      case 'turno':
        if (!inBase) this.cambia({ arrivo: null, meta: null });
        return;
      case 'uscita_prigione':
        this.cambia({ sbarre: { n: (this.scena.sbarre?.n ?? 0) + 1, verso: 'su' } });
        return;
      case 'scambio_accettato': {
        const caselle = [...e.dare.caselle, ...e.avere.caselle];
        if (!inBase) {
          const cambi = new Map<number, (p: Proprieta) => Proprieta>();
          for (const c of e.dare.caselle) cambi.set(c, (p) => ({ ...p, proprietario: e.a }));
          for (const c of e.avere.caselle) cambi.set(c, (p) => ({ ...p, proprietario: e.da }));
          this.ritoccaProprieta(cambi);
        }
        this.mostraPerUnPo({ lampeggia: caselle }, { lampeggia: [] }, LAMPO_SCAMBIO_MS);
        this.mostraPerUnPo({ timbro: { n: voce.n, tipo: 'accettato', da: e.da, a: e.a } }, { timbro: null }, TIMBRO_MS);
        return;
      }
      case 'scambio_rifiutato':
        this.mostraPerUnPo({ timbro: { n: voce.n, tipo: 'rifiutato', da: e.da, a: e.a } }, { timbro: null }, TIMBRO_MS);
        return;
      default:
        return;
    }
  }

  /**
   * Un movimento di denaro: chi paga scende quando il gettone parte, chi incassa sale quando arriva.
   * Il credito resta «in attesa» finché il gettone non arriva, anche se nel frattempo la partita si allinea.
   */
  private muoviSoldi(m: MovimentoSoldi, inBase: boolean): void {
    const gen = this.generazioneEffetti;
    const id = this.prossimoGettone++;
    const versione = this.versioneBase;
    if (!m.gettone) {
      this.storna(m, inBase);
      return;
    }
    // Più pagamenti di fila (il compleanno, una carta «paga a ogni giocatore»): i gettoni partono uno alla volta.
    const ora = Date.now();
    const quando = Math.max(ora, this.prossimaPartenza);
    this.prossimaPartenza = quando + SFASATURA_GETTONI_MS;
    const ritardo = quando - ora;
    if (m.a !== null) {
      this.crediti.set(id, { a: m.a, importo: m.importo });
      // La partita mostrata lo contiene già: lo si toglie finché il gettone non arriva.
      if (inBase) this.ritoccaSaldo(m.a, -m.importo);
    }
    const parti = () => {
      if (gen !== this.generazioneEffetti) return;
      const giaContato = inBase || versione !== this.versioneBase;
      if (m.addebita && m.da !== null && !giaContato) this.ritoccaSaldo(m.da, -m.importo);
      this.cambia({ gettoni: [...this.scena.gettoni, { id, da: m.da, a: m.a, importo: m.importo, ...(m.casella === undefined ? {} : { casella: m.casella }) }] });
      this.dopo(VOLO_GETTONE_MS, () => {
        this.cambia({ gettoni: this.scena.gettoni.filter((g) => g.id !== id) });
        const credito = this.crediti.get(id);
        if (!credito) return;
        this.crediti.delete(id);
        this.ritoccaSaldo(credito.a, credito.importo);
      });
    };
    if (ritardo > 0) this.dopo(ritardo, parti);
    else parti();
  }

  /**
   * Il debito: chi aspettava i soldi (`m.da`) ne riceve solo una parte. Se il suo gettone è ancora in volo,
   * il gettone porta di meno; altrimenti il saldo scende subito.
   */
  private storna(m: MovimentoSoldi, inBase: boolean): void {
    if (m.da === null) return;
    let resto = m.importo;
    for (const c of this.crediti.values()) {
      if (c.a !== m.da || resto <= 0) continue;
      const quota = Math.min(resto, c.importo);
      c.importo -= quota;
      resto -= quota;
      // Fuori scena la partita mostrata aveva già tolto tutto il credito in attesa: ne ridà la parte che non arriverà.
      if (inBase) this.ritoccaSaldo(m.da, quota);
    }
    if (resto > 0 && !inBase) this.ritoccaSaldo(m.da, -resto);
  }

  private ritoccaSaldo(id: IdGiocatore, delta: number): void {
    const p = this.scena.partita;
    if (!p || delta === 0) return;
    this.cambia({ partita: { ...p, giocatori: p.giocatori.map((g) => (g.id === id ? { ...g, saldo: g.saldo + delta } : g)) } });
  }

  private ritoccaProprieta(cambi: ReadonlyMap<number, (p: Proprieta) => Proprieta>): void {
    const p = this.scena.partita;
    if (!p) return;
    this.cambia({ partita: { ...p, proprieta: p.proprieta.map((x, i) => (x && cambi.has(i) ? cambi.get(i)!(x) : x)) } });
  }

  /** Un effetto che resta in vista per un po', poi torna com'era (se nel frattempo non è cambiato). */
  private mostraPerUnPo(su: Partial<Scena>, giu: Partial<Scena>, ms: number): void {
    this.cambia(su);
    const chiave = Object.keys(su)[0] as keyof Scena;
    const valore = su[chiave];
    this.dopo(ms, () => {
      if (this.scena[chiave] === valore) this.cambia(giu);
    });
  }

  /* ------------------------------------------------------------------ */

  private muovi(id: IdGiocatore, dove: PosizioneMostrata, ms?: number): void {
    this.cambia({
      posizioni: { ...this.scena.posizioni, [id]: dove },
      passi: { ...this.scena.passi, [id]: (this.scena.passi[id] ?? 0) + 1 },
      passoMs: ms === undefined ? senza(this.scena.passoMs, id) : { ...this.scena.passoMs, [id]: ms },
    });
  }

  /** Un'attesa della scena: la regia aspetta prima del prossimo evento. */
  private attendi(ms: number): Promise<void> {
    return new Promise((fatto) => {
      const t = setTimeout(() => {
        this.timer.delete(t);
        fatto();
      }, ms);
      this.timer.add(t);
    });
  }

  /** Un effetto più tardi, senza fermare la scena; non parte se nel frattempo gli effetti sono stati annullati. */
  private dopo(ms: number, fn: () => void): void {
    const gen = this.generazioneEffetti;
    const t = setTimeout(() => {
      this.timer.delete(t);
      if (gen === this.generazioneEffetti) fn();
    }, ms);
    this.timer.add(t);
  }

  private cambia(parziale: Partial<Scena>): void {
    this.scena = { ...this.scena, ...parziale };
    for (const fn of this.ascoltatori) fn();
  }
}

/** La scena della partita per un componente React. */
export function useScena(coll: Collegamento): Scena {
  const [regia] = useState(() => new Regia(coll));
  useEffect(() => {
    regia.avvia();
    return () => regia.ferma();
  }, [regia]);
  return useSyncExternalStore(regia.iscrivi, regia.leggi);
}
