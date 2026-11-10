/*
 * Lettura dei comandi del pannello. Anche se arrivano da chi ha la password, si controlla la forma di ogni campo
 * e si costruisce un oggetto nuovo: il resto (i limiti, la coerenza con la partita) lo controlla il motore.
 */

import {
  GRAZIE_MAX,
  REGOLE_MODIFICABILI,
  type ComandoPannello,
  type NomeMazzo,
  type RegolaModificabile,
  type Stato,
} from '@poordown/engine';
import { booleano, intero, oggetto, testo } from '../stanze/lettura';

const ID_MAX = 64;
const MAZZI: readonly unknown[] = ['busta', 'cartolina'] satisfies NomeMazzo[];

/** Un id di giocatore, oppure `null` se il campo vale null. `undefined` se non va bene. */
function idONull(dati: unknown, campo: string): string | null | undefined {
  const valore = oggetto(dati)?.[campo];
  if (valore === null) return null;
  return typeof valore === 'string' && valore.length <= ID_MAX ? valore : undefined;
}

export function leggiComandoPannello(dati: unknown): ComandoPannello | null {
  const o = oggetto(dati);
  if (!o) return null;
  const giocatore = testo(dati, 'giocatore', ID_MAX);

  switch (o.tipo) {
    case 'saldo': {
      const saldo = intero(dati, 'saldo');
      return giocatore === null || saldo === null ? null : { tipo: 'saldo', giocatore, saldo };
    }
    case 'posizione': {
      const casella = intero(dati, 'casella');
      return giocatore === null || casella === null ? null : { tipo: 'posizione', giocatore, casella };
    }
    case 'prigione': {
      const dentro = booleano(dati, 'dentro');
      return giocatore === null || dentro === null ? null : { tipo: 'prigione', giocatore, dentro };
    }
    case 'vacanza': {
      const vacanza = booleano(dati, 'vacanza');
      return giocatore === null || vacanza === null ? null : { tipo: 'vacanza', giocatore, vacanza };
    }
    case 'grazie': {
      const carte = o.carte;
      if (giocatore === null || !Array.isArray(carte) || carte.length > GRAZIE_MAX || !carte.every((c) => MAZZI.includes(c))) {
        return null;
      }
      return { tipo: 'grazie', giocatore, carte: [...(carte as NomeMazzo[])] };
    }
    case 'proprieta': {
      const casella = intero(dati, 'casella');
      const livello = intero(dati, 'livello');
      const ipotecata = booleano(dati, 'ipotecata');
      const proprietario = idONull(dati, 'proprietario');
      if (casella === null || livello === null || ipotecata === null || proprietario === undefined) return null;
      return { tipo: 'proprieta', casella, proprietario, livello, ipotecata };
    }
    case 'turno':
      return giocatore === null ? null : { tipo: 'turno', giocatore };
    case 'cassa': {
      const importo = intero(dati, 'importo');
      return importo === null ? null : { tipo: 'cassa', importo };
    }
    case 'regole': {
      const regole = oggetto(o.regole);
      if (!regole) return null;
      const lette: Partial<Record<RegolaModificabile, boolean>> = {};
      for (const [chiave, valore] of Object.entries(regole)) {
        if (!(REGOLE_MODIFICABILI as readonly string[]).includes(chiave) || typeof valore !== 'boolean') return null;
        lette[chiave as RegolaModificabile] = valore;
      }
      return { tipo: 'regole', regole: lette };
    }
    case 'elimina':
      return giocatore === null ? null : { tipo: 'elimina', giocatore };
    case 'fine': {
      const vincitore = idONull(dati, 'vincitore');
      return vincitore === undefined ? null : { tipo: 'fine', vincitore };
    }
    case 'stato':
      // La forma la controlla il motore (problemaStato), campo per campo.
      return oggetto(o.stato) ? { tipo: 'stato', stato: o.stato as unknown as Stato } : null;
    case 'nome': {
      const nome = testo(dati, 'nome', 200);
      return giocatore === null || nome === null ? null : { tipo: 'nome', giocatore, nome };
    }
    case 'dadi': {
      const chi = idONull(dati, 'giocatore');
      if (chi === undefined) return null;
      if (o.dadi === null) return { tipo: 'dadi', dadi: null, giocatore: chi };
      const dadi = o.dadi;
      if (!Array.isArray(dadi) || dadi.length !== 2 || !dadi.every((d) => typeof d === 'number' && Number.isInteger(d))) return null;
      return { tipo: 'dadi', dadi: [dadi[0] as number, dadi[1] as number], giocatore: chi };
    }
    case 'host':
      return giocatore === null ? null : { tipo: 'host', giocatore };
    case 'espelli':
      return giocatore === null ? null : { tipo: 'espelli', giocatore };
    default:
      return null;
  }
}
