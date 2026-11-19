/* Testi del registro di partita, in italiano e con tono sobrio. */

import { giocatore } from './conti';
import type { EventoStanza } from './protocollo';
import { tabellone } from './tabelloni';
import type { Casella, Evento, EventoCosmico, FacciaCosmica, IdGiocatore, MotivoUscita, NomeMazzo, Pacchetto, Stato } from './tipi';

/** 1500 → "1.500 €". In italiano il punto delle migliaia si mette anche sotto i 10.000. */
export function euro(importo: number): string {
  const cifre = String(Math.round(Math.abs(importo))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${importo < 0 ? '−' : ''}${cifre} €`;
}

const NOME_MAZZO: Record<NomeMazzo, string> = { busta: 'Busta', cartolina: 'Cartolina' };

/** Gli eventi cosmici del Sistema solare: il nome e cosa fanno, per il registro e per il riquadro del cosmo. */
export const EVENTI_COSMICI: Record<EventoCosmico, { nome: string; effetto: string }> = {
  quiete: { nome: 'Quiete cosmica', effetto: 'Niente di strano, per questo giro.' },
  allineamento: { nome: 'Allineamento planetario', effetto: 'Affitti doppi per tutto il giro.' },
  eclissi: { nome: 'Eclissi', effetto: 'Affitti a metà per tutto il giro.' },
  tempesta: { nome: 'Tempesta solare', effetto: 'Per tutto il giro il premio della Partenza va alla Supernova.' },
  meteoriti: { nome: 'Pioggia di meteoriti', effetto: 'Crolla un edificio a caso.' },
  gravita: { nome: 'Gravità invertita', effetto: 'Per tutto il giro si cammina al contrario.' },
  collisione: { nome: 'Collisione planetaria', effetto: 'Due proprietà a caso si scambiano di proprietario.' },
};

/** Le facce del dado cosmico del Sistema solare: il nome e cosa fanno, per il registro e per il riquadro del dado. */
export const FACCE_COSMICHE: Record<FacciaCosmica, { nome: string; effetto: string }> = {
  razzo: { nome: 'Razzo', effetto: 'Dopo la mossa vola alla prossima proprietà libera.' },
  saldi: { nome: 'Saldi', effetto: 'La proprietà libera dove si ferma costa la metà.' },
  bandiera: { nome: 'Bandiera', effetto: 'La proprietà libera più economica diventa sua, gratis.' },
  scudo: { nome: 'Scudo', effetto: 'In questo tiro non paga affitti.' },
  faro: { nome: 'Faro', effetto: 'Fino al suo prossimo turno le sue proprietà rendono il doppio.' },
  iperspazio: { nome: 'Iperspazio', effetto: 'La mossa dei dadi vale doppio.' },
};

/** Un fattore da leggere: 0.5 → "½", 1.5 → "1,5", 2 → "2". */
export function fattoreTesto(fattore: number): string {
  return fattore === 0.5 ? '½' : String(fattore).replace('.', ',');
}

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
    case 'inizio': {
      const ordine = evento.ordineCasuale ? ' L’ordine dei giocatori è stato estratto a sorte.' : '';
      const bonus = evento.bonus ? ` Chi gioca dopo il primo parte con ${euro(evento.bonus)} in più per ogni posto.` : '';
      return `La partita comincia.${ordine}${bonus}`;
    }
    case 'ultimi_turni':
      return `Mancano ${evento.turni} turni alla fine della partita: poi vince chi ha il patrimonio più alto.`;
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
    case 'teletrasporto':
      return `${nome(evento.giocatore)} si teletrasporta ${destinazione(tab.caselle[evento.a]!)}.`;
    case 'volo': {
      const chi = nome(evento.giocatore);
      const dove = destinazione(tab.caselle[evento.a]!);
      if (evento.prezzo === 0) return `${chi} usa il Biglietto omaggio e vola ${dove}.`;
      if (evento.incassa === null || evento.aeroporto === null) return `${chi} compra un biglietto da ${euro(evento.prezzo)} e vola ${dove}.`;
      return `${chi} vola ${dove}: il biglietto da ${euro(evento.prezzo)} lo incassa ${nome(evento.incassa)}, che ha ${conArticolo(casella(evento.aeroporto))}.`;
    }
    case 'bermuda':
      return `${nome(evento.giocatore)} sparisce nel Triangolo delle Bermuda e ricompare ${destinazione(tab.caselle[evento.a]!)}.`;
    case 'antipodi':
      return `${nome(evento.giocatore)} scava una buca per l’altra parte del mondo e sbuca ${destinazione(tab.caselle[evento.a]!)}.`;
    case 'passaporto':
      return `${nome(evento.giocatore)} ritira il passaporto: da adesso può volare.`;
    case 'cambio_data':
      return `${nome(evento.giocatore)} attraversa la Linea del cambio di data e guadagna un giorno: si muove ancora.`;
    case 'sfida':
      return `${nome(evento.da)} non vuole pagare ${euro(evento.importo)} per ${casella(evento.casella)} e sfida ${nome(evento.a)} a morra cinese.`;
    case 'morra': {
      const [mio, suo] = evento.segni;
      const lento = evento.aCaso ? ` ${nome(evento.aCaso)} non sceglie in tempo e gioca a caso.` : '';
      const segni = `Morra cinese: ${nome(evento.da)} fa ${mio}, ${nome(evento.a)} fa ${suo}.${lento}`;
      if (evento.esito === 'vinta') return `${segni} Vince ${nome(evento.da)}: niente affitto.`;
      if (evento.esito === 'persa') return `${segni} Vince ${nome(evento.a)}: affitto doppio, ${euro(evento.importo)}.`;
      return `${segni} Pareggio: si paga l’affitto normale.`;
    }
    case 'robin_hood':
      return `${nome(evento.da)} ha più contante di tutti e dà ${euro(evento.importo)} ${a(nome(evento.a))}, che ne ha meno di tutti.`;
    case 'moneta':
      return evento.testa
        ? `Esce testa: ${nome(evento.giocatore)} riceve ${euro(evento.importo)}.`
        : `Esce croce: ${nome(evento.giocatore)} paga ${euro(evento.importo)}.`;
    case 'cosmo': {
      const e = EVENTI_COSMICI[evento.evento];
      const m = evento.mercato;
      const mercato = m
        ? ` Mercato galattico: ${tab.regioni[m.regione]?.nome ?? '?'} ${m.fattore > 1 ? 'sale' : 'crolla'}, prezzi e affitti ×${fattoreTesto(m.fattore)}.`
        : '';
      return `Giro ${evento.giro}: ${e.nome}. ${e.effetto}${mercato}`;
    }
    case 'quantico':
      return evento.fattore === 0
        ? `Affitto quantistico: esce ${evento.faccia}, l’affitto è gratis.`
        : `Affitto quantistico: esce ${evento.faccia}, l’affitto vale ×${fattoreTesto(evento.fattore)}.`;
    case 'dado_cosmico': {
      const f = FACCE_COSMICHE[evento.faccia];
      return `Dado cosmico di ${nome(evento.giocatore)}: ${f.nome}. ${f.effetto}`;
    }
    case 'razzo':
      return `Il razzo porta ${nome(evento.giocatore)} ${destinazione(tab.caselle[evento.a]!)}.`;
    case 'bandiera':
      return `${nome(evento.giocatore)} pianta la bandiera su ${casella(evento.casella)}: è sua, gratis.`;
    case 'scudo':
      return `Lo scudo protegge ${nome(evento.giocatore)}: niente affitto di ${euro(evento.importo)} per ${casella(evento.casella)}.`;
    case 'fionda':
      return `${nome(evento.giocatore)} prende la fionda gravitazionale e riparte di ${Math.abs(evento.passi)} caselle${evento.passi < 0 ? ' all’indietro' : ''}.`;
    case 'buco_nero':
      return `Il Buco nero risucchia ${euro(evento.importo)} ${a(nome(evento.giocatore))}: finiscono nel malloppo della Supernova.`;
    case 'supernova': {
      const chi = nome(evento.giocatore);
      const p = evento.alPovero;
      const vincita = evento.importo + (p?.importo ?? 0);
      const dado = `${chi} si ferma sulla Supernova e il dado dice ×${fattoreTesto(evento.fattore)}`;
      const testo =
        evento.fattore === 1
          ? `${chi} si ferma sulla Supernova e prende il malloppo: ${euro(vincita)}.`
          : evento.fattore < 1
            ? `${dado}: metà del malloppo, ${euro(vincita)}, e nella stella restano ${euro(evento.resta)}.`
            : `${dado}: il malloppo di ${euro(evento.malloppo)} diventa ${euro(vincita)}.`;
      if (!p) return testo;
      const tetto = euro(tab.follie?.tetto ?? 0);
      const povero = `${a(nome(p.giocatore))}, che ha meno contante di tutti`;
      return evento.importo > 0
        ? `${testo} Con il tetto di ${tetto} ${chi} ne tiene ${euro(evento.importo)}: gli altri ${euro(p.importo)} vanno ${povero}.`
        : `${testo} ${chi} ha già ${tetto} o più: va tutto ${povero}.`;
    }
    case 'malloppo':
      if (evento.motivo === 'tempesta') return `La tempesta solare porta i ${euro(evento.importo)} della Partenza nel malloppo della Supernova.`;
      if (evento.motivo === 'polvere' && evento.giocatore !== null) {
        return `${nome(evento.giocatore)} passa sopra la Supernova: la polvere di stelle aggiunge ${euro(evento.importo)} al malloppo.`;
      }
      return `La Supernova cresce: ${euro(evento.importo)} in più nel malloppo.`;
    case 'roulette':
      return `${nome(evento.giocatore)} gira la Roulette cosmica: «${evento.testo}»`;
    case 'meteorite':
      return `Un meteorite colpisce ${casella(evento.casella)} di ${nome(evento.giocatore)}: crolla ${evento.livello === 4 ? 'l’albergo' : 'una casa'}.`;
    case 'collisione': {
      const [x, y] = evento.caselle;
      const [chiX, chiY] = evento.giocatori;
      return `Collisione planetaria: ${casella(x)} passa ${a(nome(chiY))} e ${casella(y)} passa ${a(nome(chiX))}.`;
    }
    case 'gravita_invertita':
      return `${nome(evento.giocatore)} inverte la gravità: fino alla fine del giro si cammina al contrario.`;
    case 'partenza':
      if (evento.tempesta) return `${nome(evento.giocatore)} passa dalla Partenza, ma la tempesta solare si porta via il premio.`;
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
      if (evento.modifica) return `${nome(evento.da)} modifica la sua proposta ${a(nome(evento.a))}.`;
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
      const finita = evento.durata ? 'Partita finita: è arrivata la durata massima.' : 'Partita finita.';
      const ricco = evento.durata ? ', con il patrimonio più alto' : '';
      if (evento.squadra === undefined) return evento.vincitore ? `${finita} Vince ${nome(evento.vincitore)}${ricco}.` : finita;
      // «Vince Squadra 1», ma «Vince la squadra Volpi».
      const squadra = stato.squadre[evento.squadra] ?? `Squadra ${evento.squadra + 1}`;
      return `${finita} Vince ${/^squadra\b/i.test(squadra) ? squadra : `la squadra ${squadra}`}${ricco}.`;
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

/** La preposizione «a» davanti a `parola`: «ad» (con la d eufonica) se anche la parola comincia per a. */
export function aOppureAd(parola: string): 'a' | 'ad' {
  return /^a/i.test(parola) ? 'ad' : 'a';
}

/** "a Siena", "ad Aosta", "ad Anna". */
export function preposizioneA(nome: string): string {
  return `${aOppureAd(nome)} ${nome}`;
}

const a = preposizioneA;

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

/** «l’Aeroporto di Barra», «la Stazione Nord»: il nome con l'articolo femminile o eliso, come in `destinazione`. */
function conArticolo(nome: string): string {
  return /^[AEIOUÀÈÉÌÒÙ]/i.test(nome) ? `l’${nome}` : `la ${nome}`;
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
    case 'fionda':
    case 'wormhole':
    case 'buco_nero':
    case 'supernova':
    case 'roulette':
    case 'bermuda':
    case 'cambio_data':
    case 'antipodi':
      return `alla casella ${c.nome}`;
    case 'premio':
      return `al ${c.nome}`;
    default:
      return vocale ? `all’${c.nome}` : `alla ${c.nome}`;
  }
}
