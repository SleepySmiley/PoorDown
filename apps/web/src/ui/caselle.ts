/*
 * Le caselle del tabellone come le disegna l'interfaccia: nome, icona, prezzo, stemma della regione.
 * I dati veri (prezzi, affitti, regioni) vengono dal motore; qui si aggiunge solo l'aspetto.
 */

import { euro, tabellone, type Casella, type IdMappa, type Tabellone } from '@poordown/engine';
import type { NomeIcona } from './icone';

export type TipoVista = 'citta' | 'stazione' | 'servizio' | 'carta' | 'tassa' | 'angolo';

export interface CasellaVista {
  n: number;
  tipo: TipoVista;
  nome: string;
  /** Nome corto sul tabellone, per stare su una riga. Il nome intero resta nella scheda. */
  breve?: string;
  /** Riga breve sotto il nome (solo la Prigione: «In visita»). */
  sotto?: string;
  prezzo?: number;
  /** Testo al posto del prezzo (tasse). */
  importo?: string;
  /** Regione 1–8 (l'indice del motore più uno), solo per le città. */
  gruppo?: number;
  icona?: NomeIcona;
}

/** Sigle delle regioni negli stemmi del tabellone, nell'ordine del tabellone Classico. */
const SIGLE = ['VDA', 'SAR', 'TOS', 'SIC', 'VEN', 'CAM', 'LAZ', 'LOM'] as const;

export function siglaRegione(gruppo: number): string {
  return SIGLE[gruppo - 1] ?? '';
}

const ICONE_SERVIZI: NomeIcona[] = ['fulmine', 'goccia', 'fulmine'];

function vista(tab: Tabellone, c: Casella, n: number, servizi: { visti: number }): CasellaVista {
  const base = { n, nome: c.nome, breve: c.breve };
  switch (c.tipo) {
    case 'citta':
      return { ...base, tipo: 'citta', prezzo: c.prezzo, gruppo: c.regione + 1 };
    case 'stazione':
      return { ...base, tipo: 'stazione', prezzo: c.prezzo, icona: 'treno' };
    case 'servizio':
      return { ...base, tipo: 'servizio', prezzo: c.prezzo, icona: ICONE_SERVIZI[servizi.visti++] ?? 'fulmine' };
    case 'carta':
      return { ...base, tipo: 'carta', icona: c.mazzo === 'busta' ? 'busta' : 'cartolina' };
    case 'tassa':
      return c.tassa.tipo === 'percentuale'
        ? { ...base, tipo: 'tassa', importo: `${c.tassa.valore}%`, icona: 'percento' }
        : { ...base, tipo: 'tassa', importo: euro(c.tassa.valore), icona: 'euro' };
    case 'partenza':
      return { ...base, tipo: 'angolo', icona: 'avanti' };
    case 'prigione':
      return { ...base, tipo: 'angolo', sotto: n === tab.prigione ? 'In visita' : undefined, icona: 'prigione' };
    case 'vacanza':
      return { ...base, tipo: 'angolo', icona: 'vacanza' };
    case 'vai_in_prigione':
      return { ...base, tipo: 'angolo', icona: 'vaiprigione' };
  }
}

const CACHE = new Map<IdMappa, CasellaVista[]>();

export function caselleVista(mappa: IdMappa): CasellaVista[] {
  let caselle = CACHE.get(mappa);
  if (!caselle) {
    const tab = tabellone(mappa);
    const servizi = { visti: 0 };
    caselle = tab.caselle.map((c, n) => vista(tab, c, n, servizi));
    CACHE.set(mappa, caselle);
  }
  return caselle;
}
