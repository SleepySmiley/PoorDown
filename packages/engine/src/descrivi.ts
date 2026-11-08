/* Testi del registro di partita, in italiano e con tono sobrio. */

import { giocatore } from './conti';
import type { EventoStanza } from './protocollo';
import { tabellone } from './tabelloni';
import type { Casella, Evento, IdGiocatore, NomeMazzo, Stato } from './tipi';

/** 1500 → "1.500 €". In italiano il punto delle migliaia si mette anche sotto i 10.000. */
export function euro(importo: number): string {
  const cifre = String(Math.round(Math.abs(importo))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${importo < 0 ? '−' : ''}${cifre} €`;
}

const NOME_MAZZO: Record<NomeMazzo, string> = { busta: 'Busta', cartolina: 'Cartolina' };

/**
 * Riga del registro per un evento, oppure `null` per gli eventi che servono solo alle animazioni
 * (inizio turno, dadi: il tiro compare già nella riga dello spostamento).
 */
export function descrivi(evento: Evento, stato: Stato): string | null {
  const tab = tabellone(stato.mappa);
  const nome = (id: IdGiocatore) => giocatore(stato, id)?.nome ?? '?';
  const casella = (i: number) => tab.caselle[i]?.nome ?? '?';

  switch (evento.tipo) {
    case 'inizio':
      return evento.ordineCasuale
        ? 'La partita comincia. L’ordine dei giocatori è stato estratto a sorte.'
        : 'La partita comincia.';
    case 'turno':
    case 'dadi':
      return null;
    case 'turno_saltato':
      return `${nome(evento.giocatore)} è in vacanza e salta il turno.`;
    case 'movimento': {
      const dove = destinazione(tab.caselle[evento.a]!);
      return evento.dadi
        ? `${nome(evento.giocatore)} tira ${evento.dadi[0]} e ${evento.dadi[1]} e va ${dove}.`
        : `${nome(evento.giocatore)} va ${dove}.`;
    }
    case 'partenza':
      return evento.arrivo
        ? `${nome(evento.giocatore)} si ferma sulla Partenza e riceve ${euro(evento.importo)}.`
        : `${nome(evento.giocatore)} passa dalla Partenza e riceve ${euro(evento.importo)}.`;
    case 'acquisto':
      return `${nome(evento.giocatore)} compra ${casella(evento.casella)} per ${euro(evento.prezzo)}.`;
    case 'affitto':
      return `${nome(evento.da)} paga ${euro(evento.importo)} di affitto a ${nome(evento.a)} per ${casella(evento.casella)}.`;
    case 'tassa':
      return `${nome(evento.giocatore)} paga ${euro(evento.importo)} di ${casella(evento.casella)}.`;
    case 'carta':
      return `${nome(evento.giocatore)} pesca una ${NOME_MAZZO[evento.mazzo]}: «${evento.testo}»`;
    case 'prigione':
      return evento.motivo === 'tre_doppi'
        ? `${nome(evento.giocatore)} fa tre doppi di fila e va in prigione.`
        : `${nome(evento.giocatore)} va in prigione.`;
    case 'prigione_fallita':
      return evento.tentativi >= 3
        ? `${nome(evento.giocatore)} non fa un doppio. Al prossimo turno esce di prigione.`
        : `${nome(evento.giocatore)} non fa un doppio e resta in prigione.`;
    case 'uscita_prigione':
      switch (evento.modo) {
        case 'doppio':
          return `${nome(evento.giocatore)} fa un doppio ed esce di prigione.`;
        case 'cauzione':
          return `${nome(evento.giocatore)} paga la cauzione ed esce di prigione.`;
        case 'grazia':
          return `${nome(evento.giocatore)} usa la Carta Grazia ed esce di prigione.`;
        case 'tentativi':
          return `${nome(evento.giocatore)} esce di prigione dopo tre tentativi.`;
      }
      return null;
    case 'vacanza':
      return stato.impostazioni.cassaVacanza
        ? `${nome(evento.giocatore)} va in vacanza, ritira ${euro(evento.incasso)} dalla cassa e salta il prossimo turno.`
        : `${nome(evento.giocatore)} va in vacanza e salta il prossimo turno.`;
    case 'vendita':
      return `${nome(evento.giocatore)} vende ${casella(evento.casella)} alla banca per ${euro(evento.importo)}.`;
    case 'debito':
      return `${nome(evento.da)} non ha abbastanza contante e resta in debito di ${euro(evento.importo)} con ${nome(evento.a)}.`;
    case 'rimborso':
      return `${nome(evento.da)} restituisce ${euro(evento.importo)} a ${nome(evento.a)}.`;
    case 'bancarotta': {
      const recuperi = evento.recuperi.map((r) => ` ${nome(r.creditore)} recupera ${euro(r.importo)} dalla banca.`);
      return `${nome(evento.giocatore)} fa bancarotta. Le sue proprietà tornano alla banca.${recuperi.join('')}`;
    }
    case 'fine':
      return evento.vincitore ? `Partita finita. Vince ${nome(evento.vincitore)}.` : 'Partita finita.';
  }
}

/**
 * Riga del registro della stanza: i fatti della lobby (ingressi, uscite, cambio di host) e quelli della partita.
 * `partita` è `null` in lobby.
 */
export function descriviVoce(evento: EventoStanza, partita: Stato | null): string | null {
  switch (evento.tipo) {
    case 'ingresso':
      return `${evento.nome} entra nella partita.`;
    case 'uscita':
      switch (evento.motivo) {
        case 'volontaria':
          return `${evento.nome} lascia la stanza.`;
        case 'espulsione':
          return `Espulsione: ${evento.nome} lascia la stanza.`;
        case 'assenza':
          return `Assenza prolungata: ${evento.nome} lascia la stanza.`;
      }
      return null;
    case 'nuovo_host':
      return `${evento.nome} ora è l’host della stanza.`;
    default:
      return partita ? descrivi(evento, partita) : null;
  }
}

/** "a Napoli", "ad Aosta", "alla Stazione Nord", "all’Acquedotto", "alla casella Busta"… */
function destinazione(c: Casella): string {
  const vocale = /^[AEIOUÀÈÉÌÒÙ]/i.test(c.nome);
  switch (c.tipo) {
    case 'citta':
      return `${/^a/i.test(c.nome) ? 'ad' : 'a'} ${c.nome}`;
    case 'prigione':
      return 'in visita alla Prigione';
    case 'vacanza':
      return 'in Vacanza';
    case 'carta':
    case 'tassa':
    case 'vai_in_prigione':
      return `alla casella ${c.nome}`;
    default:
      return vocale ? `all’${c.nome}` : `alla ${c.nome}`;
  }
}
