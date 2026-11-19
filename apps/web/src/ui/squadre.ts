/*
 * I colori delle squadre (--sq1…--sq4 in stili/token.css): colorano il numero della squadra (Binario) e,
 * nelle partite a squadre, le proprietà al posto del colore della pedina di chi le possiede,
 * a meno che chi guarda scelga i colori dei giocatori (rete/coloriSquadra.ts).
 * Qui solo calcoli, senza il browser: si provano con Vitest.
 */

import { compagni, costruzioneDiSquadra, tabellone, type Giocatore, type IdGiocatore, type Stato } from '@poordown/engine';

/** Il colore della squadra `indice` (0–3), come valore CSS. */
export function coloreSquadra(indice: number): string {
  return `var(--sq${indice + 1})`;
}

/** Il colore della pedina `colore` (1–12), come valore CSS. */
export function colorePedina(colore: number): string {
  return `var(--p${colore})`;
}

/**
 * La tinta delle proprietà di `g` (blocco sul tabellone, puntini delle regioni, lampi degli scambi):
 * il colore della sua squadra se la partita è a squadre e chi guarda vuole i colori di squadra (`perSquadra`),
 * altrimenti quello della sua pedina.
 */
export function tintaProprietario(partita: Pick<Stato, 'impostazioni'>, g: Pick<Giocatore, 'colore' | 'squadra'>, perSquadra: boolean): string {
  return perSquadra && partita.impostazioni.squadre && g.squadra !== null ? coloreSquadra(g.squadra) : colorePedina(g.colore);
}

/**
 * Con la costruzione di squadra, `io` può costruire sulla casella perché è una città di un compagno (non sua):
 * la scheda aperta dal tabellone mostra allora il pulsante per costruire. Se si può davvero adesso lo dice `verifica`.
 */
export function cittaDelCompagno(partita: Stato, io: IdGiocatore, casella: number): boolean {
  const proprietario = partita.proprieta[casella]?.proprietario;
  return (
    costruzioneDiSquadra(partita) &&
    tabellone(partita.mappa).caselle[casella]?.tipo === 'citta' &&
    proprietario != null &&
    compagni(partita, io, proprietario)
  );
}
