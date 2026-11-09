/* Testi del registro di partita, in italiano e con tono sobrio. */

import { giocatore } from './conti';
import type { EventoStanza } from './protocollo';
import { tabellone } from './tabelloni';
import type { Casella, Evento, IdGiocatore, MotivoUscita, NomeMazzo, Pacchetto, Stato } from './tipi';

/** 1500 → "1.500 €". In italiano il punto delle migliaia si mette anche sotto i 10.000. */
export function euro(importo: number): string {
  const cifre = String(Math.round(Math.abs(importo))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${importo < 0 ? '−' : ''}${cifre} €`;
}

const NOME_MAZZO: Record<NomeMazzo, string> = { busta: 'Busta', cartolina: 'Cartolina' };

const MOTIVO_RIMOZIONE: Record<Exclude<MotivoUscita, 'bancarotta'>, string> = {
  tempo: 'Tempo scaduto troppe volte',
  assenza: 'Assenza prolungata',
  voto: 'Votazione',
  espulsione: 'Espulsione',
};

/** 60000 → "un minuto", 120000 → "2 minuti". */
function minuti(ms: number): string {
  const n = Math.round(ms / 60_000);
  return n === 1 ? 'un minuto' : `${n} minuti`;
}

/**
 * Riga del registro per un evento, oppure `null` per gli eventi che servono solo alle animazioni
 * (inizio turno, dadi: il tiro compare già nella riga dello spostamento; trasferimenti: la carta dice già quanto si paga).
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
    case 'trasferimento':
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
      return `${nome(evento.da)} paga ${euro(evento.importo)} di affitto ${a(nome(evento.a))} per ${casella(evento.casella)}.`;
    case 'tassa':
      return `${nome(evento.giocatore)} paga ${euro(evento.importo)} di ${casella(evento.casella)}.`;
    case 'premio':
      return `${nome(evento.giocatore)} si ferma sul ${casella(evento.casella)} e riceve ${euro(evento.importo)}.`;
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
    case 'costruzione':
      return `${nome(evento.giocatore)} costruisce ${evento.livello === 5 ? 'un albergo' : 'una casa'} ${a(casella(evento.casella))} per ${euro(evento.costo)}.`;
    case 'demolizione':
      return `${nome(evento.giocatore)} vende alla banca ${evento.livello === 4 ? 'l’albergo' : 'una casa'} di ${casella(evento.casella)} per ${euro(evento.importo)}.`;
    case 'ipoteca':
      return `${nome(evento.giocatore)} ipoteca ${casella(evento.casella)} e riceve ${euro(evento.importo)}.`;
    case 'riscatto':
      return `${nome(evento.giocatore)} toglie l’ipoteca da ${casella(evento.casella)} per ${euro(evento.importo)}.`;
    case 'asta':
      return `${nome(evento.giocatore)} mette all’asta ${casella(evento.casella)}.`;
    case 'asta_vinta':
      return `${nome(evento.giocatore)} vince l’asta e compra ${casella(evento.casella)} per ${euro(evento.importo)}.`;
    case 'asta_deserta':
      return evento.offerente
        ? `${nome(evento.offerente)} non ha più i soldi per pagare: ${casella(evento.casella)} resta alla banca.`
        : `Nessuna offerta: ${casella(evento.casella)} resta alla banca.`;
    case 'scambio_proposto':
      return evento.trattativa > 0
        ? `${nome(evento.da)} fa una controproposta ${a(nome(evento.a))}.`
        : `${nome(evento.da)} propone uno scambio ${a(nome(evento.a))}.`;
    case 'scambio_accettato': {
      const parte = (chi: IdGiocatore, p: Pacchetto) => {
        const cose = contenuto(p, casella);
        return cose ? `${nome(chi)} dà ${cose}` : `${nome(chi)} non dà niente`;
      };
      return `${nome(evento.a)} accetta lo scambio proposto da ${nome(evento.da)}. ${parte(evento.da, evento.dare)}; ${parte(evento.a, evento.avere)}.`;
    }
    case 'scambio_rifiutato':
      return `${nome(evento.a)} rifiuta lo scambio proposto da ${nome(evento.da)}.`;
    case 'scambio_annullato':
      return `${nome(evento.da)} ritira lo scambio proposto ${a(nome(evento.a))}.`;
    case 'debito':
      return `${nome(evento.da)} non ha abbastanza contante e resta in debito di ${euro(evento.importo)} con ${nome(evento.a)}.`;
    case 'rimborso':
      return `${nome(evento.da)} restituisce ${euro(evento.importo)} ${a(nome(evento.a))}.`;
    case 'bancarotta': {
      const recuperi = evento.recuperi.map((r) => ` ${nome(r.creditore)} recupera ${euro(r.importo)} dalla banca.`);
      const prima = evento.automatica ? 'Tempo scaduto in debito: ' : '';
      // Se le proprietà passano a un compagno di squadra, lo dice la riga dell'eredità.
      const proprieta = evento.erede ? '' : ' Le sue proprietà tornano alla banca.';
      return `${prima}${nome(evento.giocatore)} fa bancarotta.${proprieta}${recuperi.join('')}`;
    }
    case 'rimozione': {
      const recuperi = evento.recuperi.map((r) => ` ${nome(r.creditore)} recupera ${euro(r.importo)} dalla banca.`);
      const proprieta = evento.erede ? '' : ' e le sue proprietà tornano alla banca';
      return `${MOTIVO_RIMOZIONE[evento.motivo]}: ${nome(evento.giocatore)} esce dalla partita${proprieta}.${recuperi.join('')}`;
    }
    case 'eredita': {
      const cose = [
        ...evento.caselle.map((i) => (stato.proprieta[i]?.ipotecata ? `${casella(i)} (ipotecata)` : casella(i))),
        ...(evento.grazie === 1 ? ['la Carta Grazia'] : evento.grazie > 1 ? [`${evento.grazie} Carte Grazia`] : []),
        ...(evento.soldi > 0 ? [euro(evento.soldi)] : []),
      ];
      if (cose.length === 0) return `${nome(evento.a)} non eredita niente da ${nome(evento.da)}.`;
      const elenco = cose.length === 1 ? cose[0]! : `${cose.slice(0, -1).join(', ')} e ${cose.at(-1)!}`;
      return `${nome(evento.a)} eredita da ${nome(evento.da)}: ${elenco}.`;
    }
    case 'edifici_venduti': {
      const citta = evento.caselle.map(casella);
      const elenco = citta.length === 1 ? citta[0]! : `${citta.slice(0, -1).join(', ')} e ${citta.at(-1)!}`;
      return `La regione non è più tutta della squadra: ${nome(evento.giocatore)} vende alla banca gli edifici di ${elenco} per ${euro(evento.importo)}.`;
    }
    case 'tempo_scaduto':
      return evento.assente
        ? `${nome(evento.giocatore)} ha perso il collegamento: il gioco fa le sue mosse.`
        : `Tempo scaduto per ${nome(evento.giocatore)}: il gioco fa le sue mosse.`;
    case 'tempo_chiesto':
      return `${nome(evento.giocatore)} chiede più tempo.`;
    case 'tempo_regalato':
      return `${nome(evento.da)} dà ${minuti(evento.ms)} in più ${a(nome(evento.a))}.`;
    case 'voto':
      return evento.favorevole
        ? `${nome(evento.da)} vota per far uscire ${nome(evento.contro)} dalla partita (${evento.voti} di ${evento.servono}).`
        : `${nome(evento.da)} ritira il voto contro ${nome(evento.contro)}.`;
    case 'fine': {
      if (evento.squadra === undefined) return evento.vincitore ? `Partita finita. Vince ${nome(evento.vincitore)}.` : 'Partita finita.';
      // «Vince Squadra 1», ma «Vince la squadra Volpi».
      const squadra = stato.squadre[evento.squadra] ?? `Squadra ${evento.squadra + 1}`;
      return `Partita finita. Vince ${/^squadra\b/i.test(squadra) ? squadra : `la squadra ${squadra}`}.`;
    }
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
    case 'nuova_partita':
      return `${evento.nome} prepara un’altra partita.`;
    default:
      return partita ? descrivi(evento, partita) : null;
  }
}

/** "a Siena", "ad Aosta". */
function a(nome: string): string {
  return `${/^a/i.test(nome) ? 'ad' : 'a'} ${nome}`;
}

/** "Siena, Pisa, la Carta Grazia e 100 €", oppure "" se il pacchetto è vuoto. */
export function contenuto(p: Pacchetto, casella: (i: number) => string): string {
  const cose = [
    ...p.caselle.map(casella),
    ...(p.grazie.length === 1 ? ['la Carta Grazia'] : p.grazie.length > 1 ? [`${p.grazie.length} Carte Grazia`] : []),
    ...(p.soldi > 0 ? [euro(p.soldi)] : []),
  ];
  if (cose.length <= 1) return cose[0] ?? '';
  return `${cose.slice(0, -1).join(', ')} e ${cose.at(-1)!}`;
}

/** "a Napoli", "ad Aosta", "alla Stazione Nord", "all’Acquedotto", "alla casella Busta"… */
export function destinazione(c: Casella): string {
  const vocale = /^[AEIOUÀÈÉÌÒÙ]/i.test(c.nome);
  switch (c.tipo) {
    case 'citta':
      return a(c.nome);
    case 'prigione':
      return 'in visita alla Prigione';
    case 'vacanza':
      return 'in Vacanza';
    case 'carta':
    case 'tassa':
    case 'vai_in_prigione':
      return `alla casella ${c.nome}`;
    case 'premio':
      return `al ${c.nome}`;
    default:
      return vocale ? `all’${c.nome}` : `alla ${c.nome}`;
  }
}
