/* Nickname: pulizia del testo scritto dal giocatore e nomi casuali "Sostantivo Aggettivo". */

import { NOME_MAX } from './protocollo';
import type { Caso } from './tipi';

export const SOSTANTIVI = [
  'Airone', 'Ancora', 'Biscotto', 'Bussola', 'Castoro', 'Cometa', 'Corvo', 'Delfino', 'Faro', 'Gabbiano',
  'Gufo', 'Lanterna', 'Lince', 'Lontra', 'Lupo', 'Merlo', 'Nuvola', 'Orso', 'Pinguino', 'Riccio',
  'Rondine', 'Scoiattolo', 'Tasso', 'Trottola', 'Valigia', 'Vela', 'Volpe', 'Zebra',
] as const;

/** Tutti in -e: vanno bene sia con i nomi maschili sia con quelli femminili. */
export const AGGETTIVI = [
  'Abile', 'Agile', 'Audace', 'Brillante', 'Cordiale', 'Cortese', 'Elegante', 'Fedele', 'Felice', 'Gentile',
  'Indomabile', 'Instancabile', 'Leale', 'Loquace', 'Paziente', 'Potente', 'Prudente', 'Ribelle', 'Sagace',
  'Solare', 'Sorridente', 'Tenace', 'Veloce', 'Vivace',
] as const;

export function nomeCasuale(caso: Caso): string {
  return `${SOSTANTIVI[caso.intero(SOSTANTIVI.length)]!} ${AGGETTIVI[caso.intero(AGGETTIVI.length)]!}`;
}

/** Caratteri di controllo, separatori di riga e comandi di direzione del testo (che rovinano l'impaginazione). */
const INVISIBILI = /[\p{Cc}\u2028\u2029\u202A-\u202E\u2066-\u2069]/gu;

/**
 * Toglie i caratteri invisibili e gli spazi in eccesso e taglia a `NOME_MAX` caratteri
 * (un'emoji semplice conta uno). Può restituire una stringa vuota.
 */
export function pulisciNome(testo: string): string {
  const pulito = testo.replace(/\s+/g, ' ').replace(INVISIBILI, '').trim();
  return Array.from(pulito).slice(0, NOME_MAX).join('').trim();
}
