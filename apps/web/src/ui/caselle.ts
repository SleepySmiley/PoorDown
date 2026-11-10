/*
 * Le caselle del tabellone come le disegna l'interfaccia: nome, icona, prezzo, stemma della regione.
 * I dati veri (prezzi, affitti, regioni) vengono dal motore; qui si aggiunge solo l'aspetto.
 */

import { euro, tabellone, type Bandiera, type Casella, type IdMappa, type Tabellone } from '@poordown/engine';
import type { NomeIcona } from './icone';

export type TipoVista = 'citta' | 'stazione' | 'servizio' | 'carta' | 'tassa' | 'premio' | 'angolo';

export interface CasellaVista {
  n: number;
  tipo: TipoVista;
  nome: string;
  /** Nome corto sul tabellone, per stare su una riga. Il nome intero resta nella scheda. */
  breve?: string;
  /** Riga breve sotto il nome (solo la Prigione: «In visita»). */
  sotto?: string;
  prezzo?: number;
  /** Testo al posto del prezzo (tasse e Rimborso). */
  importo?: string;
  /** Regione 1–10 (l'indice del motore più uno), solo per le città: `tab.regioni[gruppo - 1]`. */
  gruppo?: number;
  /** Colore dello stemma della regione (le variabili --g1…--g10), solo per le città. */
  tinta?: number;
  /** La bandiera della città, se diversa da quella del gruppo (Grandi aree). */
  bandiera?: Bandiera;
  /** Angoli: 0 Partenza, 1 Prigione, 2 Vacanza, 3 Vai in prigione (per gli arrotondamenti e la disposizione). */
  angolo?: number;
  icona?: NomeIcona;
}

const ICONE_SERVIZI: NomeIcona[] = ['fulmine', 'fiamma', 'goccia'];

/** Le icone dei servizi seguono il nome: luce, gas, acqua. */
function iconaServizio(nome: string): NomeIcona {
  if (/gas/i.test(nome)) return 'fiamma';
  if (/acqu/i.test(nome)) return 'goccia';
  return ICONE_SERVIZI[0]!;
}

function vista(tab: Tabellone, c: Casella, n: number): CasellaVista {
  const base = { n, nome: c.nome, breve: c.breve };
  const lato = tab.caselle.length / 4;
  switch (c.tipo) {
    case 'citta':
      return {
        ...base,
        tipo: 'citta',
        prezzo: c.prezzo,
        gruppo: c.regione + 1,
        tinta: tab.regioni[c.regione]?.colore ?? c.regione + 1,
        ...(c.bandiera ? { bandiera: c.bandiera } : {}),
      };
    case 'stazione':
      return { ...base, tipo: 'stazione', prezzo: c.prezzo, icona: 'treno' };
    case 'servizio':
      return { ...base, tipo: 'servizio', prezzo: c.prezzo, icona: iconaServizio(c.nome) };
    case 'carta':
      return { ...base, tipo: 'carta', icona: c.mazzo === 'busta' ? 'busta' : 'cartolina' };
    case 'tassa':
      // La moneta per tutte le tasse: l'importo accanto dice già se è una percentuale.
      return c.tassa.tipo === 'percentuale'
        ? { ...base, tipo: 'tassa', importo: `${c.tassa.valore}%`, icona: 'euro' }
        : { ...base, tipo: 'tassa', importo: euro(c.tassa.valore), icona: 'euro' };
    case 'premio':
      return { ...base, tipo: 'premio', importo: `+${euro(c.importo)}`, icona: 'euro' };
    case 'partenza':
      return { ...base, tipo: 'angolo', angolo: n / lato, icona: 'avanti' };
    case 'prigione':
      return { ...base, tipo: 'angolo', angolo: n / lato, sotto: n === tab.prigione ? 'In visita' : undefined, icona: 'prigione' };
    case 'vacanza':
      return { ...base, tipo: 'angolo', angolo: n / lato, icona: 'vacanza' };
    case 'vai_in_prigione':
      return { ...base, tipo: 'angolo', angolo: n / lato, icona: 'vaiprigione' };
  }
}

const CACHE = new Map<IdMappa, CasellaVista[]>();

export function caselleVista(mappa: IdMappa): CasellaVista[] {
  let caselle = CACHE.get(mappa);
  if (!caselle) {
    const tab = tabellone(mappa);
    caselle = tab.caselle.map((c, n) => vista(tab, c, n));
    CACHE.set(mappa, caselle);
  }
  return caselle;
}
