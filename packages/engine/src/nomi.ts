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

/**
 * Caratteri di controllo, separatori di riga, comandi di direzione del testo (che rovinano l'impaginazione)
 * e caratteri che non si vedono: trattino facoltativo, spazi di larghezza zero, riempitivi hangul, braille vuoto\u2026
 * Resta il "zero width joiner" (U+200D), che tiene insieme le emoji composte. I segni che si combinano con la
 * lettera prima (U+034F, U+17B4, U+17B5) stanno fuori dalle parentesi quadre, dove si confonderebbero con lei.
 */
const INVISIBILI =
  /[\p{Cc}\u00AD\u061C\u115F\u1160\u180E\u200B\u200C\u200E\u200F\u2028\u2029\u202A-\u202E\u2060-\u2064\u2066-\u206F\u2800\u3164\uFEFF\uFFA0]|\u034F|\u17B4|\u17B5/gu;

/**
 * Toglie i caratteri invisibili e gli spazi in eccesso e taglia a `NOME_MAX` caratteri
 * (un'emoji semplice conta uno). Restituisce una stringa vuota se nel testo non c'è niente che si veda.
 */
export function pulisciNome(testo: string): string {
  const pulito = testo.replace(/\s+/g, ' ').replace(INVISIBILI, '').trim();
  return Array.from(pulito).slice(0, NOME_MAX).join('').trim();
}
