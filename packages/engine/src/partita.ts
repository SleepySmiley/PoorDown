import { mescola } from './caso';
import { proprietabile } from './conti';
import { GIOCATORI_MAX, GIOCATORI_MIN } from './impostazioni';
import { tabellone } from './tabelloni';
import { BANCA_INIZIALE_MS } from './tempo';
import { iniziaTurno } from './turni';
import type { Caso, Esito, Evento, IdGiocatore, Impostazioni, Mazzo, Stato } from './tipi';

export interface NuovoGiocatore {
  id: IdGiocatore;
  nome: string;
  colore: number;
}

/**
 * Prepara una partita: ordine dei giocatori (mescolato se richiesto), mazzi mescolati,
 * soldi iniziali, e fa partire il primo turno.
 * @param adesso orologio del server (ms): da qui parte il tempo del primo turno.
 */
export function creaPartita(
  giocatori: readonly NuovoGiocatore[],
  impostazioni: Impostazioni,
  caso: Caso,
  adesso = 0,
): Esito {
  if (giocatori.length < GIOCATORI_MIN || giocatori.length > GIOCATORI_MAX) {
    return {
      ok: false,
      codice: 'giocatori_non_validi',
      messaggio: `Servono da ${GIOCATORI_MIN} a ${GIOCATORI_MAX} giocatori.`,
    };
  }
  if (new Set(giocatori.map((g) => g.id)).size !== giocatori.length) {
    return { ok: false, codice: 'giocatori_non_validi', messaggio: 'Due giocatori hanno lo stesso identificativo.' };
  }

  const tab = tabellone(impostazioni.mappa);
  const ordine = impostazioni.ordineCasuale ? mescola(giocatori, caso) : [...giocatori];
  const nuovoMazzo = (n: number): Mazzo => ({ ordine: mescola([...Array(n).keys()], caso), prossima: 0 });

  const stato: Stato = {
    mappa: impostazioni.mappa,
    impostazioni: { ...impostazioni },
    giocatori: ordine.map((g) => ({
      id: g.id,
      nome: g.nome,
      colore: g.colore,
      posizione: 0,
      saldo: impostazioni.soldiIniziali,
      debiti: [],
      prigione: null,
      vacanza: false,
      carteGrazia: [],
      eliminato: null,
      banca: BANCA_INIZIALE_MS,
      automatici: 0,
      offlineDa: null,
    })),
    proprieta: tab.caselle.map((_, i) =>
      proprietabile(tab, i) ? { proprietario: null, livello: 0, ipotecata: false } : null,
    ),
    mazzi: { busta: nuovoMazzo(tab.mazzi.busta.length), cartolina: nuovoMazzo(tab.mazzi.cartolina.length) },
    cassaVacanza: 0,
    turno: {
      giocatore: '',
      numero: 0,
      fase: 'lancio',
      dadi: null,
      doppi: 0,
      rilancio: false,
      acquisto: null,
      tempo: { inizio: adesso, grazia: 0, regalato: 0, regali: [], richiesta: false, automatico: false, fermoDa: null },
      votazione: { voti: [], scadenza: null },
    },
    asta: null,
    scambi: [],
    prossimoScambio: 1,
    fase: 'in_corso',
    vincitore: null,
  };

  const eventi: Evento[] = [{ tipo: 'inizio', ordineCasuale: impostazioni.ordineCasuale }];
  iniziaTurno(stato, eventi, stato.giocatori[0]!, adesso);
  return { ok: true, stato, eventi };
}
