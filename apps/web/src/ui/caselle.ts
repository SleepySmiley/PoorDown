/*
 * Le caselle del tabellone come le disegna l'interfaccia: nome, icona, prezzo, stemma della regione.
 * I dati veri (prezzi, affitti, regioni) vengono dal motore; qui si aggiunge solo l'aspetto.
 */

import { euro, tabellone, type Casella, type IdMappa, type Speciale, type Tabellone } from '@poordown/engine';
import type { NomeIcona } from './icone';

export type TipoVista = 'citta' | 'stazione' | 'servizio' | 'carta' | 'tassa' | 'premio' | 'speciale' | 'angolo';

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
  /** Colore dello stemma della regione (le variabili --g1…--g11), solo per le città. */
  tinta?: number;
  /** Angoli: 0 Partenza, 1 Prigione, 2 Vacanza, 3 Vai in prigione (per gli arrotondamenti e la disposizione). */
  angolo?: number;
  icona?: NomeIcona;
  /** Le caselle folli del Sistema solare (fionda, wormhole, buco nero, supernova, roulette) e del Giro del mondo. */
  speciale?: Speciale['tipo'];
}

/** Il pittogramma di ogni casella folle. */
const ICONE_SPECIALI: Record<Speciale['tipo'], NomeIcona> = {
  fionda: 'fionda',
  wormhole: 'spirale',
  buco_nero: 'buconero',
  supernova: 'stella',
  roulette: 'ruota',
  bermuda: 'spirale',
  cambio_data: 'orologio',
  antipodi: 'pianeta',
};

const ICONE_SERVIZI: NomeIcona[] = ['fulmine', 'fiamma', 'goccia'];

/** Le icone dei servizi seguono il nome: luce, gas, acqua; nel Sistema solare ossigeno, gravità e Wi-Fi. */
function iconaServizio(nome: string): NomeIcona {
  if (/gas/i.test(nome)) return 'fiamma';
  if (/acqu/i.test(nome)) return 'goccia';
  if (/ossigeno/i.test(nome)) return 'ossigeno';
  if (/gravit/i.test(nome)) return 'pianeta';
  if (/wi-?fi/i.test(nome)) return 'wifi';
  return ICONE_SERVIZI[0]!;
}

function vista(tab: Tabellone, c: Casella, n: number): CasellaVista {
  const base = { n, nome: c.nome, breve: c.breve };
  const lato = tab.caselle.length / 4;
  switch (c.tipo) {
    case 'citta':
      return { ...base, tipo: 'citta', prezzo: c.prezzo, gruppo: c.regione + 1, tinta: tab.regioni[c.regione]?.colore ?? c.regione + 1 };
    case 'stazione':
      // Nel Sistema solare le stazioni sono mezzi spaziali (Navetta, Capsula, Astronave, Sonda); nel Giro del mondo aeroporti.
      return { ...base, tipo: 'stazione', prezzo: c.prezzo, icona: tab.id === 'sistema_solare' ? 'razzo' : tab.viaggi ? 'aereo' : 'treno' };
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
    case 'fionda':
    case 'wormhole':
    case 'buco_nero':
    case 'supernova':
    case 'roulette':
    case 'bermuda':
    case 'cambio_data':
    case 'antipodi':
      // Il Buco nero dice quanto risucchia; il malloppo della Supernova cambia e lo aggiunge il tabellone.
      return {
        ...base,
        tipo: 'speciale',
        speciale: c.tipo,
        icona: ICONE_SPECIALI[c.tipo],
        ...(c.tipo === 'buco_nero' && tab.follie ? { importo: `−${tab.follie.bucoNero}%` } : {}),
      };
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
