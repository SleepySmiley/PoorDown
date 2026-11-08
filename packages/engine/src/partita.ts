import { mescola } from './caso';
import { proprietabile } from './conti';
import { GIOCATORI_MAX, GIOCATORI_MIN, NOMI_SQUADRE_PREDEFINITI, SQUADRE_MAX } from './impostazioni';
import { segnaPatrimonio, statisticheIniziali } from './statistiche';
import { tabellone } from './tabelloni';
import { BANCA_INIZIALE_MS } from './tempo';
import { iniziaTurno } from './turni';
import type { Caso, Esito, Evento, IdGiocatore, Impostazioni, Mazzo, Stato } from './tipi';

export interface NuovoGiocatore {
  id: IdGiocatore;
  nome: string;
  colore: number;
  /** Indice della squadra (0–3), solo nelle partite a squadre. */
  squadra?: number | null;
}

/**
 * L'ordine dei turni: mescolato se richiesto. A squadre i turni si alternano tra le squadre
 * (un giocatore per squadra, a giro), così i compagni non giocano uno dopo l'altro.
 */
function ordineDeiTurni(giocatori: readonly NuovoGiocatore[], impostazioni: Impostazioni, caso: Caso): NuovoGiocatore[] {
  const base = impostazioni.ordineCasuale ? mescola(giocatori, caso) : [...giocatori];
  if (!impostazioni.squadre) return base;
  const gruppi = new Map<number, NuovoGiocatore[]>();
  for (const g of base) gruppi.set(g.squadra!, [...(gruppi.get(g.squadra!) ?? []), g]);
  const ordine: NuovoGiocatore[] = [];
  for (let giro = 0; ordine.length < base.length; giro++) {
    for (const membri of gruppi.values()) if (membri[giro]) ordine.push(membri[giro]!);
  }
  return ordine;
}

/** Perché le squadre non vanno bene, `null` se vanno bene: ognuno in una squadra, almeno due squadre. */
function problemaSquadre(giocatori: readonly NuovoGiocatore[]): string | null {
  const squadre = giocatori.map((g) => g.squadra);
  if (squadre.some((x) => typeof x !== 'number' || !Number.isInteger(x) || x < 0 || x >= SQUADRE_MAX)) {
    return 'Ogni giocatore deve essere in una squadra.';
  }
  if (new Set(squadre).size < 2) return 'Servono almeno due squadre con almeno un giocatore.';
  return null;
}

/**
 * Prepara una partita: ordine dei giocatori (mescolato se richiesto), mazzi mescolati,
 * soldi iniziali, e fa partire il primo turno.
 * @param adesso orologio del server (ms): da qui parte il tempo del primo turno.
 * @param nomiSquadre i nomi delle squadre, per le partite a squadre.
 */
export function creaPartita(
  giocatori: readonly NuovoGiocatore[],
  impostazioni: Impostazioni,
  caso: Caso,
  adesso = 0,
  nomiSquadre: readonly string[] = NOMI_SQUADRE_PREDEFINITI,
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

  if (impostazioni.squadre) {
    const problema = problemaSquadre(giocatori);
    if (problema) return { ok: false, codice: 'squadre_non_valide', messaggio: problema };
  }

  const tab = tabellone(impostazioni.mappa);
  const ordine = ordineDeiTurni(giocatori, impostazioni, caso);
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
      squadra: impostazioni.squadre ? g.squadra! : null,
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
    squadre: impostazioni.squadre
      ? Array.from({ length: SQUADRE_MAX }, (_, i) => nomiSquadre[i] ?? NOMI_SQUADRE_PREDEFINITI[i]!)
      : [],
    squadraVincitrice: null,
    statistiche: statisticheIniziali(impostazioni.mappa, adesso),
  };
  segnaPatrimonio(stato);

  const eventi: Evento[] = [{ tipo: 'inizio', ordineCasuale: impostazioni.ordineCasuale }];
  iniziaTurno(stato, eventi, stato.giocatori[0]!, adesso);
  return { ok: true, stato, eventi };
}
