/*
 * Regia della partita: trasforma gli eventi che arrivano dal server in animazioni, uno dopo l'altro.
 * - I dadi rotolano, poi la pedina avanza casella per casella (o salta in prigione).
 * - Le righe del registro compaiono quando il loro evento "accade" sullo schermo.
 * - Il resto della partita (saldi, turno, proprietà) si aggiorna alla fine della scena,
 *   e intanto i pulsanti del turno aspettano.
 * Gli eventi senza animazione (voti, scambi, ipoteche…) compaiono subito, senza fermare i pulsanti.
 * Se la scheda è nascosta, se ci sono troppi eventi insieme, se arrivano in ritardo (dopo una disconnessione)
 * o se si preferisce meno movimento, si salta direttamente allo stato finale.
 */

import { useEffect, useState, useSyncExternalStore } from 'react';
import { tabellone, type EventoStanza, type IdGiocatore, type Stato, type VoceRegistro } from '@poordown/engine';
import type { Collegamento } from '../rete/collegamento';

export interface PosizioneMostrata {
  casella: number;
  prigione: boolean;
}

export interface Scena {
  /** La partita mostrata: resta indietro finché le animazioni non sono finite. */
  partita: Stato | null;
  /** Le voci del registro fino a questo numero sono già comparse. */
  registroFino: number;
  /** Pedine in movimento: le altre stanno dove dice `partita`. */
  posizioni: Readonly<Record<IdGiocatore, PosizioneMostrata>>;
  /** Cresce a ogni passo di una pedina: la fa saltellare. */
  passi: Readonly<Record<IdGiocatore, number>>;
  dadi: [number, number];
  /** Cresce a ogni lancio: fa ripartire l'animazione dei dadi. */
  lanci: number;
  rotola: boolean;
  /** Una scena è in corso: i pulsanti del turno aspettano. */
  occupata: boolean;
}

const PASSO_MS = 180;
const ROTOLA_MS = 95;
const FACCE_ROTOLANDO = 7;
/** Con più eventi di così in un colpo solo (es. dopo una risincronizzazione) non si anima. */
const MAX_ANIMATI = 25;
/**
 * Eventi nati più di così prima di arrivare (dopo una disconnessione) sono già passati: rimetterli in scena
 * lascerebbe lo schermo indietro mentre il turno, magari il mio, sta già scorrendo.
 */
const RITARDO_MAX_MS = 2_000;

/** Eventi che fermano la scena per un attimo, giusto il tempo di leggerli. */
const CON_PAUSA = new Set<EventoStanza['tipo']>([
  'acquisto',
  'asta_vinta',
  'costruzione',
  'affitto',
  'tassa',
  'premio',
  'partenza',
  'prigione_fallita',
  'vacanza',
]);

/** L'evento ha una scena sul tabellone (gli stessi casi di `anima`, tranne quelli istantanei). */
function animabile(e: EventoStanza): boolean {
  return e.tipo === 'dadi' || e.tipo === 'movimento' || e.tipo === 'prigione' || e.tipo === 'carta' || CON_PAUSA.has(e.tipo);
}

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

export class Regia {
  private scena: Scena;
  private coda: VoceRegistro[] = [];
  private ultimaVista: number;
  private inScena = false;
  /** Cambia quando la regia si ferma: le scene vecchie rimaste a metà non toccano più niente. */
  private generazione = 0;
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
      posizioni: {},
      passi: {},
      dadi: partita?.turno.dadi ?? [5, 2],
      lanci: 0,
      rotola: false,
      occupata: false,
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
    for (const t of this.timer) clearTimeout(t);
    this.timer.clear();
    this.coda = [];
    this.inScena = false;
  }

  /* ------------------------------------------------------------------ */

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
    // Niente da animare: la partita si aggiorna subito e i pulsanti del turno restano dove sono.
    if (!nuove.some((v) => animabile(v.evento))) {
      this.allinea();
      return;
    }
    this.coda.push(...nuove);
    void this.recita();
  }

  /** Interrompe la scena in corso (le sue attese restano senza effetto) e mostra la partita com'è adesso. */
  private interrompi(): void {
    this.coda = [];
    this.generazione++;
    this.inScena = false;
    this.allinea();
  }

  /** La scheda si nasconde: i timer del browser rallentano, quindi la scena si chiude subito. */
  private readonly cambiaVisibilita = (): void => {
    if (nascosta() && (this.inScena || this.coda.length > 0)) this.interrompi();
  };

  /** Mostra la partita com'è adesso, senza animazioni in sospeso. */
  private allinea(): void {
    const s = this.coll.leggi();
    const partita = s.stanza?.partita ?? null;
    this.cambia({
      partita,
      registroFino: this.ultimaVista,
      posizioni: {},
      rotola: false,
      occupata: false,
      dadi: partita?.turno.dadi ?? ultimoLancio(s.registro) ?? this.scena.dadi,
    });
  }

  private async recita(): Promise<void> {
    const gen = this.generazione;
    this.inScena = true;
    this.cambia({ occupata: true });
    while (this.coda.length > 0) {
      const voce = this.coda.shift()!;
      await this.anima(voce.evento, gen);
      if (gen !== this.generazione) return;
      this.cambia({ registroFino: voce.n });
    }
    this.inScena = false;
    this.allinea();
  }

  private async anima(e: EventoStanza, gen: number): Promise<void> {
    const partita = this.scena.partita;
    if (!partita) return;
    switch (e.tipo) {
      case 'dadi': {
        this.cambia({ rotola: true, lanci: this.scena.lanci + 1 });
        for (let i = 0; i < FACCE_ROTOLANDO && gen === this.generazione; i++) {
          this.cambia({ dadi: [faccia(), faccia()] });
          await this.attendi(ROTOLA_MS);
        }
        // Scena interrotta: i dadi giusti li ha già messi `allinea`.
        if (gen !== this.generazione) return;
        this.cambia({ dadi: e.dadi, rotola: false });
        await this.attendi(150);
        return;
      }
      case 'movimento': {
        const n = tabellone(partita.mappa).caselle.length;
        const avanti = (e.a - e.da + n) % n;
        const indietro = (e.da - e.a + n) % n;
        // Le carte "Torna indietro di 3 caselle" sono l'unico spostamento all'indietro.
        const verso = !e.dadi && indietro < avanti && indietro <= 3 ? -1 : 1;
        const passi = verso === 1 ? avanti : indietro;
        let casella = e.da;
        for (let i = 0; i < passi && gen === this.generazione; i++) {
          casella = (casella + verso + n) % n;
          this.muovi(e.giocatore, { casella, prigione: false });
          await this.attendi(PASSO_MS);
        }
        await this.attendi(200);
        return;
      }
      case 'prigione':
        this.muovi(e.giocatore, { casella: tabellone(partita.mappa).prigione, prigione: true });
        await this.attendi(450);
        return;
      case 'uscita_prigione': {
        const casella = this.scena.posizioni[e.giocatore]?.casella ?? partita.giocatori.find((g) => g.id === e.giocatore)?.posizione;
        if (casella !== undefined) this.cambia({ posizioni: { ...this.scena.posizioni, [e.giocatore]: { casella, prigione: false } } });
        return;
      }
      case 'carta':
        await this.attendi(600);
        return;
      default:
        if (CON_PAUSA.has(e.tipo)) await this.attendi(250);
        return;
    }
  }

  private muovi(id: IdGiocatore, dove: PosizioneMostrata): void {
    this.cambia({
      posizioni: { ...this.scena.posizioni, [id]: dove },
      passi: { ...this.scena.passi, [id]: (this.scena.passi[id] ?? 0) + 1 },
    });
  }

  private attendi(ms: number): Promise<void> {
    return new Promise((fatto) => {
      const t = setTimeout(() => {
        this.timer.delete(t);
        fatto();
      }, ms);
      this.timer.add(t);
    });
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
