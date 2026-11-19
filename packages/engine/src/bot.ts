/*
 * I bot: giocatori automatici che occupano i posti liberi. Docs/analisi/02-lobby-impostazioni.md §8.
 * Comprano, costruiscono, offrono alle aste e rispondono agli scambi; sul Giro del mondo volano e giocano a morra.
 * Ne propongono solo uno, ogni tanto: comprare l'ultima città che manca a una loro regione, pagandola bene.
 * A squadre regalano al compagno in rosso i soldi che gli servono, quando conviene alla squadra (`aiutoPossibile`).
 * In chat non scrivono.
 *
 * `mossaBot` guarda la partita e dice la prossima azione del bot, oppure `null` se per ora non ha niente da fare.
 * Non usa il caso: a parità di partita decide sempre allo stesso modo. Il ritmo (quanto aspettare tra una mossa
 * e l'altra, perché gli altri vedano le animazioni) lo decide la stanza con `pausaDopo`.
 */

import {
  affitto,
  alleati,
  attivi,
  caselleDellaRegione,
  compagni,
  costoEdifici,
  costoProssimoEdificio,
  costoRiscatto,
  giocatore,
  possedute,
  possiedeRegione,
  prezzoAcquisto,
  proprietabile,
  rimborsoEdificio,
  valoreIpoteca,
  valoreLiquidazione,
  VALORE_GRAZIA,
} from './conti';
import { euro } from './descrivi';
import { RILANCI } from './economia';
import { azioniPossibili, verifica } from './regole';
import { pacchettoVuoto, problemiScambio, regaloDiSquadra, type BozzaScambio } from './scambi';
import { tabellone } from './tabelloni';
import { durataEvento } from './tempi';
import type { Azione, Citta, Evento, Giocatore, IdGiocatore, Pacchetto, Scambio, Sfida, Stato } from './tipi';
import { biglietto } from './viaggi';

/* ------------------------------------------------------------------ */
/* Valutazioni                                                         */
/* ------------------------------------------------------------------ */

/**
 * Il contante da tenere da parte per non finire in rosso al primo affitto:
 * più alto quando gli avversari hanno caselle che fanno pagare molto.
 */
export function riserva(s: Stato, id: IdGiocatore): number {
  let pericolo = 0;
  s.proprieta.forEach((p, i) => {
    if (!p?.proprietario || alleati(s, p.proprietario, id)) return;
    pericolo = Math.max(pericolo, affitto(s, i, 7));
  });
  return Math.min(600, Math.max(100, Math.round(pericolo * 0.6)));
}

/** Quante città della regione hanno il bot (con i compagni) e gli avversari. */
function contaRegione(s: Stato, id: IdGiocatore, c: Citta): { mie: number; loro: number; totale: number } {
  const caselle = caselleDellaRegione(tabellone(s.mappa), c.regione);
  let mie = 0;
  let loro = 0;
  for (const i of caselle) {
    const proprietario = s.proprieta[i]?.proprietario;
    if (!proprietario) continue;
    if (alleati(s, proprietario, id)) mie++;
    else loro++;
  }
  return { mie, loro, totale: caselle.length };
}

/** Quanto vale per il bot avere la casella (che ancora non ha): il prezzo, di più se gli completa una regione. */
export function valoreCasella(s: Stato, id: IdGiocatore, casella: number): number {
  const tab = tabellone(s.mappa);
  const c = proprietabile(tab, casella);
  if (!c) return 0;
  const tipo = c.tipo;
  const mieDelTipo = (t: 'stazione' | 'servizio') =>
    s.proprieta.filter((p, i) => p?.proprietario && alleati(s, p.proprietario, id) && tab.caselle[i]?.tipo === t && i !== casella)
      .length;
  switch (tipo) {
    case 'stazione':
      return Math.round(c.prezzo * (1 + 0.2 * mieDelTipo('stazione')));
    case 'servizio':
      return Math.round(c.prezzo * (0.85 + 0.25 * mieDelTipo('servizio')));
    case 'citta': {
      const giaMia = s.proprieta[casella]?.proprietario;
      const { mie, loro, totale } = contaRegione(s, id, c);
      const mieSenza = giaMia && alleati(s, giaMia, id) ? mie - 1 : mie;
      const loroSenza = giaMia && !alleati(s, giaMia, id) ? loro - 1 : loro;
      if (mieSenza + 1 === totale) return Math.round(c.prezzo * 2.2);
      if (loroSenza === 0) return Math.round(c.prezzo * (1 + (0.5 * mieSenza) / totale));
      // Bloccare la regione a chi ne ha già quasi tutta vale qualcosa.
      if (loroSenza === totale - 1) return Math.round(c.prezzo * 1.3);
      return Math.round(c.prezzo * 0.85);
    }
  }
}

/** La partita come sarebbe dopo lo scambio, per le valutazioni: cambiano solo i proprietari delle caselle. */
function dopoLoScambio(s: Stato, sc: BozzaScambio): Stato {
  const proprieta = s.proprieta.map((p, i) => {
    if (!p) return p;
    if (sc.dare.caselle.includes(i)) return { ...p, proprietario: sc.a };
    if (sc.avere.caselle.includes(i)) return { ...p, proprietario: sc.da };
    return p;
  });
  return { ...s, proprieta };
}

/** Lo stesso scambio visto dall'altra parte: serve al bot per valutare le sue proposte con il proprio metro. */
function rovescia(sc: BozzaScambio): BozzaScambio {
  return { da: sc.a, a: sc.da, dare: sc.avere, avere: sc.dare };
}

/**
 * Quanto guadagna il bot `id` (chi riceve la proposta, `sc.a`) da uno scambio: quello che riceve meno quello che dà.
 * Le caselle si valutano sulla partita come sarà dopo lo scambio, tutte insieme: due città che gli completano
 * una regione valgono come tali, e cedere città che completano la regione dell'avversario costa molto di più
 * del loro prezzo, anche se nessuna da sola basterebbe.
 */
export function guadagnoScambio(s: Stato, id: IdGiocatore, sc: BozzaScambio): { guadagno: number; dato: number } {
  const ricevo: Pacchetto = sc.dare;
  const cedo: Pacchetto = sc.avere;
  const tab = tabellone(s.mappa);
  const dopo = dopoLoScambio(s, sc);
  let ricevuto = ricevo.soldi + ricevo.grazie.length * VALORE_GRAZIA;
  for (const i of ricevo.caselle) {
    const valore = valoreCasella(dopo, id, i);
    ricevuto += s.proprieta[i]?.ipotecata ? valore - costoRiscatto(tab, i) : valore;
  }
  let dato = cedo.soldi + cedo.grazie.length * VALORE_GRAZIA;
  for (const i of cedo.caselle) {
    const c = proprietabile(tab, i);
    if (!c) continue;
    const ipotecata = s.proprieta[i]?.ipotecata === true;
    const base = ipotecata ? c.prezzo / 2 : c.prezzo;
    const mia = c.tipo === 'citta' && possiedeRegione(s, id, c.regione);
    dato += mia ? base * 2.5 : base;
    if (c.tipo === 'citta' && !compagni(s, id, sc.da) && possiedeRegione(dopo, sc.da, c.regione)) dato += c.prezzo * 1.2;
  }
  return { guadagno: Math.round(ricevuto - dato), dato: Math.round(dato) };
}

/* ------------------------------------------------------------------ */
/* Aiuto ai compagni in rosso                                          */
/* ------------------------------------------------------------------ */

/*
 * A squadre chi fa bancarotta in rosso lascia le sue proprietà alla banca (turni.ts, `elimina`), mentre i soldi passati
 * tra compagni non cambiano il patrimonio della squadra: salvare un compagno dal rosso conserva i beni della squadra.
 * Per il bot il costo vero è la liquidità, e i soldi buttati: se il compagno fallisce lo stesso, il regalo finisce
 * ai suoi creditori. Le regole sono in `valutaAiuto`.
 */

/** Chi chiede aiuto scrive cifre tonde: se il bot copre tutto il rosso, accetta fino al rosso arrotondato a tanto. */
const ARROTONDAMENTO_RICHIESTA = 100;
/** Un giocatore che resta in partita incassa ancora la Partenza: per la squadra il suo posto vale tanti passaggi. */
const PASSAGGI_DEL_POSTO = 2;

/**
 * Quanto incassa da solo il giocatore per uscire dal rosso: vende alla banca tutti i suoi edifici (metà del costo),
 * poi ipoteca o vende le sue proprietà non ipotecate (metà del prezzo in tutti e due i casi). Non contano le città
 * delle regioni dove restano edifici dei compagni: finché ce ne sono, lì non si ipoteca e non si vende.
 */
export function capacitaDiRientro(s: Stato, id: IdGiocatore): number {
  const tab = tabellone(s.mappa);
  let totale = 0;
  for (const i of possedute(s, id)) {
    const c = proprietabile(tab, i)!;
    const p = s.proprieta[i]!;
    if (c.tipo === 'citta') for (let livello = p.livello; livello > 0; livello--) totale += rimborsoEdificio(tab, c, livello);
    if (p.ipotecata) continue;
    const bloccata =
      c.tipo === 'citta' &&
      caselleDellaRegione(tab, c.regione).some((j) => s.proprieta[j]!.proprietario !== id && s.proprieta[j]!.livello > 0);
    if (!bloccata) totale += valoreIpoteca(tab, i);
  }
  return totale;
}

/**
 * Quanto perde la squadra se il giocatore fa bancarotta in rosso: le sue proprietà tornano alla banca (al prezzo pieno,
 * quelle ipotecate al netto del riscatto) con i loro edifici, le sue Carte Grazia tornano nei mazzi, e nelle regioni che
 * si rompono gli edifici dei compagni tornano alla banca a metà prezzo. Il compagno erede recupera solo l'avanzo della
 * liquidazione dopo aver pagato il rosso. In più la squadra perde un giocatore che incasserebbe ancora la Partenza.
 */
export function valoreInGioco(s: Stato, id: IdGiocatore): number {
  const g = giocatore(s, id);
  if (!g || g.eliminato) return 0;
  const tab = tabellone(s.mappa);
  let valore = g.carteGrazia.length * VALORE_GRAZIA;
  const regioni = new Set<number>();
  for (const i of possedute(s, id)) {
    const c = proprietabile(tab, i)!;
    const p = s.proprieta[i]!;
    valore += p.ipotecata ? c.prezzo - costoRiscatto(tab, i) : c.prezzo;
    if (c.tipo !== 'citta') continue;
    valore += costoEdifici(tab, c, p.livello);
    regioni.add(c.regione);
  }
  for (const r of regioni) {
    for (const i of caselleDellaRegione(tab, r)) {
      const p = s.proprieta[i]!;
      if (p.proprietario === null || p.livello === 0 || !compagni(s, id, p.proprietario)) continue;
      valore += Math.ceil(costoEdifici(tab, proprietabile(tab, i) as Citta, p.livello) / 2);
    }
  }
  const avanzo = Math.max(0, valoreLiquidazione(s, id) - Math.max(0, -g.saldo));
  return valore - avanzo + PASSAGGI_DEL_POSTO * tab.partenza.passaggio;
}

interface Aiuto {
  /** Quanto regala il bot. */
  regalo: number;
  /** Il rosso del compagno. */
  serve: number;
  /** Quanto il bot può dare senza scendere sotto la sua scorta. */
  disponibile: number;
}

/**
 * L'aiuto del bot `id` al compagno in rosso, oppure `null` se non lo aiuta:
 * - gli serve tutto il rosso (`serve`);
 * - il bot tiene la sua scorta (`riserva`): tutta se il compagno ce la farebbe da solo vendendo e ipotecando (il regalo gli
 *   risparmia solo vendite a metà prezzo), metà se senza aiuto fallirebbe (la posta è più alta, il bot rischia di più);
 * - se non copre tutto, dà la sua parte solo se il resto il compagno lo copre da solo: altrimenti i soldi andrebbero ai
 *   creditori prima di una bancarotta comunque inevitabile;
 * - conviene solo se salvandolo la squadra conserva più di quanto spende (`valoreInGioco`).
 */
function valutaAiuto(s: Stato, id: IdGiocatore, compagno: IdGiocatore): Aiuto | null {
  if (s.fase !== 'in_corso' || !compagni(s, id, compagno)) return null;
  const io = giocatore(s, id);
  const lui = giocatore(s, compagno);
  if (!io || !lui || io.eliminato || lui.eliminato || lui.saldo >= 0) return null;
  const serve = -lui.saldo;
  const daSolo = capacitaDiRientro(s, compagno);
  const scorta = daSolo >= serve ? riserva(s, id) : Math.ceil(riserva(s, id) / 2);
  const disponibile = Math.max(0, io.saldo - scorta);
  const regalo = Math.min(serve, disponibile);
  if (regalo <= 0) return null;
  if (regalo < serve && daSolo < serve - regalo) return null;
  if (valoreInGioco(s, compagno) <= regalo) return null;
  return { regalo, serve, disponibile };
}

/** Quanto il bot `id` regalerebbe adesso al compagno in rosso (0: niente). Le regole sono in `valutaAiuto`. */
export function aiutoPossibile(s: Stato, id: IdGiocatore, compagno: IdGiocatore): number {
  return valutaAiuto(s, id, compagno)?.regalo ?? 0;
}

/**
 * Il massimo che il bot dà a un compagno in rosso che gli chiede soldi: l'aiuto possibile; se copre tutto il rosso, anche
 * una cifra tonda (il rosso arrotondato alle centinaia), sempre senza scendere sotto la scorta.
 */
export function massimoAiuto(s: Stato, id: IdGiocatore, compagno: IdGiocatore): number {
  const aiuto = valutaAiuto(s, id, compagno);
  if (!aiuto) return 0;
  if (aiuto.regalo < aiuto.serve) return aiuto.regalo;
  const tondo = Math.ceil(aiuto.serve / ARROTONDAMENTO_RICHIESTA) * ARROTONDAMENTO_RICHIESTA;
  return Math.max(aiuto.regalo, Math.min(aiuto.disponibile, tondo));
}

/**
 * Il bot che aiuta il compagno in rosso: tra i `bot` della sua squadra, quello che può dargli di più e, a pari regalo,
 * quello con più soldi oltre la scorta; a pari merito il primo nell'ordine dei turni. `null` se nessuno.
 */
export function chiAiuta(s: Stato, compagno: IdGiocatore, bot: readonly IdGiocatore[]): IdGiocatore | null {
  let scelto: { id: IdGiocatore; aiuto: Aiuto } | null = null;
  for (const x of s.giocatori) {
    if (!bot.includes(x.id)) continue;
    const aiuto = valutaAiuto(s, x.id, compagno);
    if (!aiuto) continue;
    const meglio =
      !scelto ||
      aiuto.regalo > scelto.aiuto.regalo ||
      (aiuto.regalo === scelto.aiuto.regalo && aiuto.disponibile > scelto.aiuto.disponibile);
    if (meglio) scelto = { id: x.id, aiuto };
  }
  return scelto?.id ?? null;
}

/**
 * Il compagno in rosso chiede al bot solo soldi (al più offrendo qualcosa in cambio): è una richiesta d'aiuto,
 * che il bot accetta fino a `massimoAiuto`.
 */
function richiestaDiAiuto(s: Stato, sc: Scambio): boolean {
  return (
    compagni(s, sc.da, sc.a) &&
    (giocatore(s, sc.da)?.saldo ?? 0) < 0 &&
    sc.avere.soldi > 0 &&
    sc.avere.caselle.length === 0 &&
    sc.avere.grazie.length === 0
  );
}

/** La nota del regalo, per chi lo riceve. */
function notaDiAiuto({ regalo, serve }: Aiuto): string {
  return regalo >= serve
    ? `Ti passo ${euro(regalo)} per uscire dal rosso: siamo in squadra.`
    : `Ti passo ${euro(regalo)} per il rosso: il resto lo copri vendendo o ipotecando.`;
}

/* ------------------------------------------------------------------ */
/* Decisioni                                                           */
/* ------------------------------------------------------------------ */

const ok = (s: Stato, a: Azione) => verifica(s, a) === null;

/** Il rilancio all'asta, oppure `null` se il bot non vuole (o non può) offrire di più. */
function offertaAsta(s: Stato, g: Giocatore): Azione | null {
  const asta = s.asta!;
  const migliore = asta.migliore;
  // Non si rilancia su sé stessi né su un compagno di squadra.
  if (migliore && alleati(s, migliore.giocatore, g.id)) return null;
  const attuale = migliore?.importo ?? 0;
  const limite = Math.floor(Math.min(valoreCasella(s, g.id, asta.casella), g.saldo - riserva(s, g.id) / 2));
  const margine = limite - attuale;
  if (margine < RILANCI[0]) return null;
  const rilancio = margine >= 200 ? RILANCI[2] : margine >= 20 ? RILANCI[1] : RILANCI[0];
  const azione: Azione = { tipo: 'offri', giocatore: g.id, importo: attuale + rilancio };
  return ok(s, azione) ? azione : null;
}

/** Risposta a uno scambio proposto al bot. */
function rispostaScambio(s: Stato, g: Giocatore, sc: Scambio): Azione {
  const accetta: Azione = { tipo: 'accetta', giocatore: g.id, scambio: sc.id };
  const rifiuta: Azione = { tipo: 'rifiuta', giocatore: g.id, scambio: sc.id };
  if (!ok(s, accetta)) return rifiuta;
  if (compagni(s, g.id, sc.da)) {
    // Un regalo del compagno non chiede niente: si prende, anche in rosso (è l'aiuto di un altro bot).
    if (pacchettoVuoto(sc.avere)) return accetta;
    // Il compagno in rosso chiede soldi: il bot li dà se conviene alla squadra, fino al massimo del suo aiuto.
    // Oltre quel massimo decide la regola di sempre tra compagni (qui sotto): se in cambio offre qualcosa che vale,
    // lo scambio resta buono come prima che esistesse l'aiuto.
    if (richiestaDiAiuto(s, sc) && sc.avere.soldi <= massimoAiuto(s, g.id, sc.da)) return accetta;
  }
  const { guadagno, dato } = guadagnoScambio(s, g.id, sc);
  // Con un compagno basta non rimetterci troppo: si vince insieme.
  if (compagni(s, g.id, sc.da)) return guadagno >= -dato * 0.25 && g.saldo - sc.avere.soldi >= 0 ? accetta : rifiuta;
  return guadagno >= Math.max(20, dato * 0.1) ? accetta : rifiuta;
}

/** In rosso: vende edifici, poi ipoteca, poi vende proprietà, sempre la cosa che pesa meno; se non resta niente, bancarotta. */
function rientra(s: Stato, g: Giocatore, possibili: Azione[]): Azione {
  const tab = tabellone(s.mappa);
  const di = <T extends Azione['tipo']>(tipo: T) => possibili.filter((a): a is Extract<Azione, { tipo: T }> => a.tipo === tipo);
  const demolizioni = di('demolisci');
  if (demolizioni.length) {
    const rimborso = (a: (typeof demolizioni)[number]) =>
      rimborsoEdificio(tab, proprietabile(tab, a.casella) as Citta, s.proprieta[a.casella]!.livello);
    return demolizioni.sort((x, y) => rimborso(y) - rimborso(x))[0]!;
  }
  const valore = (casella: number) => valoreCasella(s, g.id, casella);
  const ipoteche = di('ipoteca');
  if (ipoteche.length) return ipoteche.sort((x, y) => valore(x.casella) - valore(y.casella) || valoreIpoteca(tab, y.casella) - valoreIpoteca(tab, x.casella))[0]!;
  const vendite = di('vendi').filter((a) => s.proprieta[a.casella]?.ipotecata === false);
  if (vendite.length) return vendite.sort((x, y) => valore(x.casella) - valore(y.casella))[0]!;
  return { tipo: 'bancarotta', giocatore: g.id };
}

/** Quanto vale per un bot completare una regione, rispetto al prezzo delle città che gli mancano. */
const OFFERTA_REGIONE = 3;
/** Città che possono mancare a una regione perché il bot chieda di comprarle, tutte allo stesso avversario. */
const MANCANTI_MAX = 2;
/** Quanto offre al massimo un bot, rispetto al prezzo, per una città che lo avvicina a una regione senza completarla. */
const OFFERTA_AVVICINA = 2;

/** I soldi da aggiungere a uno scambio perché il bot che lo riceve lo accetti (lo stesso metro di `rispostaScambio`). */
function soldiPerAccettare(s: Stato, bozza: BozzaScambio): number {
  const { guadagno, dato } = guadagnoScambio(s, bozza.a, bozza);
  return Math.max(0, Math.ceil(Math.max(20, dato * 0.1) - guadagno));
}

function proposta(b: BozzaScambio): Azione {
  return { tipo: 'proponi', giocatore: b.da, a: b.a, dare: b.dare, avere: b.avere, nota: '' };
}

/**
 * Proposta per completare una regione: al bot mancano una o due città, tutte dello stesso avversario.
 * Le chiede in cambio di soldi (fino a tre volte il loro prezzo, senza intaccare la scorta); se non bastano
 * a farle valere quanto l'avversario le stima, offre una sua proprietà più i soldi che servono (scegliendo quella
 * che gli costa meno, spesso una città che completa una regione all'altro: così si costruisce da tutte e due le parti).
 */
function propostaCompleta(s: Stato, g: Giocatore, disponibili: number): Azione | null {
  const tab = tabellone(s.mappa);
  const regioni = tab.regioni.map((_, r) => r).reverse();
  for (const r of regioni) {
    const mancanti = caselleDellaRegione(tab, r).filter((i) => {
      const proprietario = s.proprieta[i]?.proprietario;
      return !proprietario || !alleati(s, proprietario, g.id);
    });
    const altro = mancanti.length > 0 ? s.proprieta[mancanti[0]!]?.proprietario : null;
    if (!altro || mancanti.length > MANCANTI_MAX || mancanti.some((i) => s.proprieta[i]?.proprietario !== altro)) continue;
    const valore = OFFERTA_REGIONE * mancanti.reduce((t, i) => t + proprietabile(tab, i)!.prezzo, 0);
    const bozza = (soldi: number, caselle: number[]): BozzaScambio => ({
      da: g.id,
      a: altro,
      dare: { soldi, caselle, grazie: [] },
      avere: { soldi: 0, caselle: mancanti, grazie: [] },
    });

    const offerta = Math.min(valore, disponibili);
    if (offerta > 0 && offerta >= soldiPerAccettare(s, bozza(0, [])) && ok(s, proposta(bozza(offerta, [])))) {
      return proposta(bozza(offerta, []));
    }
    let migliore: Azione | null = null;
    let costoMinimo = valore;
    for (const casella of possedute(s, g.id)) {
      const c = proprietabile(tab, casella);
      if (c?.tipo === 'citta' && c.regione === r) continue;
      const soldi = soldiPerAccettare(s, bozza(0, [casella]));
      if (soldi > Math.max(0, disponibili)) continue;
      const cambio = bozza(soldi, [casella]);
      // Quanto costa al bot, con il suo metro: soldi più la proprietà ceduta (molto di più se completa la regione all'altro).
      const costo = guadagnoScambio(s, g.id, rovescia(cambio)).dato;
      if (costo > costoMinimo || !ok(s, proposta(cambio))) continue;
      migliore = proposta(cambio);
      costoMinimo = costo;
    }
    if (migliore) return migliore;
  }
  return null;
}

/**
 * Proposta per avvicinarsi a una regione che nessuno può completare da solo (succede sui tabelloni con regioni
 * grandi, divise tra tanti giocatori): la regione è tutta comprata, il bot ne ha almeno due città e nessuno
 * ne ha più di lui. Chiede una delle città che gli mancano, prima a chi lì ne ha di meno, pagandola quanto basta
 * perché un bot accetti, al massimo il doppio del prezzo. Dopo lo scambio il bot ne ha più di tutti, e nessun
 * altro gli chiederà le sue con una proposta come questa: niente botta e risposta.
 */
function propostaAvvicina(s: Stato, g: Giocatore, disponibili: number): Azione | null {
  const tab = tabellone(s.mappa);
  const di = (i: number) => s.proprieta[i]?.proprietario ?? null;
  const candidati: { casella: number; altro: IdGiocatore; mancanti: number; suoi: number; prezzo: number }[] = [];
  tab.regioni.forEach((_, r) => {
    const caselle = caselleDellaRegione(tab, r);
    if (caselle.some((i) => di(i) === null)) return;
    const conta = (id: IdGiocatore) => caselle.filter((i) => alleati(s, di(i)!, id)).length;
    const mie = conta(g.id);
    const altre = caselle.filter((i) => !alleati(s, di(i)!, g.id));
    if (mie < 2 || altre.length < 2 || altre.some((i) => conta(di(i)!) > mie)) return;
    for (const i of altre) {
      candidati.push({ casella: i, altro: di(i)!, mancanti: altre.length, suoi: conta(di(i)!), prezzo: proprietabile(tab, i)!.prezzo });
    }
  });
  // Prima la regione più vicina, poi chi ne ha di meno, poi la città più cara.
  candidati.sort((x, y) => x.mancanti - y.mancanti || x.suoi - y.suoi || y.prezzo - x.prezzo);
  for (const k of candidati) {
    const bozza = (soldi: number): BozzaScambio => ({
      da: g.id,
      a: k.altro,
      dare: { soldi, caselle: [], grazie: [] },
      avere: { soldi: 0, caselle: [k.casella], grazie: [] },
    });
    const soldi = soldiPerAccettare(s, bozza(0));
    if (soldi > Math.min(disponibili, OFFERTA_AVVICINA * k.prezzo)) continue;
    const azione = proposta(bozza(soldi));
    if (ok(s, azione)) return azione;
  }
  return null;
}

/** La proposta di scambio del bot, se ne ha una: prima per completare una regione, poi per avvicinarsi. */
function propostaBot(s: Stato, g: Giocatore, scorta: number): Azione | null {
  const disponibili = g.saldo - scorta;
  return propostaCompleta(s, g, disponibili) ?? propostaAvvicina(s, g, disponibili);
}

/* ------------------------------------------------------------------ */
/* Giro del mondo: voli e sfide                                        */
/* ------------------------------------------------------------------ */

/** Quanto pesa per il bot finire in prigione, a occhio: un turno perso e la cauzione. */
const COSTO_PRIGIONE = 60;
/** Quanto vale muoversi ancora (Linea del cambio di data), a occhio. */
const VALORE_RILANCIO = 30;
/** Il volo deve rendere almeno tanto più del tiro dei dadi, se no il bot tira: il biglietto deve valere la spesa. */
const MARGINE_VOLO = 40;

/**
 * Quanto vale per il bot fermarsi su `casella`, a occhio, con `contante` in tasca: un affitto da pagare conta in
 * meno, una proprietà libera che gli conviene comprare conta quello che vale più del prezzo, una tassa conta in meno.
 * Ragiona come chi gioca: se una città gli completa un paese, ci vola anche spendendo la scorta.
 * `inVolo`: ci arriva in aereo, e la Linea del cambio di data non regala il giorno.
 */
function valoreArrivo(
  s: Stato,
  g: Giocatore,
  casella: number,
  contante: number,
  scorta: number,
  inVolo: boolean,
  rimbalzo = true,
): number {
  const tab = tabellone(s.mappa);
  const n = tab.caselle.length;
  const c = tab.caselle[casella]!;
  switch (c.tipo) {
    case 'citta':
    case 'stazione':
    case 'servizio': {
      const p = s.proprieta[casella]!;
      if (p.proprietario === null) {
        const prezzo = prezzoAcquisto(s, casella);
        const valore = valoreCasella(s, g.id, casella);
        // Come per l'acquisto: per completare un gruppo si spende anche la scorta.
        const completa = valore >= prezzo * 2;
        return contante - prezzo >= (completa ? 0 : scorta) ? Math.max(0, valore - prezzo) : 0;
      }
      return alleati(s, p.proprietario, g.id) ? 0 : -affitto(s, casella, 7);
    }
    case 'tassa':
      return -(c.tassa.tipo === 'fissa' ? c.tassa.valore : Math.round((Math.max(0, contante) * c.tassa.valore) / 100));
    case 'premio':
      return c.importo;
    case 'vai_in_prigione':
      return -COSTO_PRIGIONE;
    case 'cambio_data':
      return inVolo ? 0 : VALORE_RILANCIO;
    case 'antipodi':
      // Dove si sbuca, una volta sola: la casella di fronte non è un'altra buca.
      return rimbalzo ? valoreArrivo(s, g, (casella + n / 2) % n, contante, scorta, inVolo, false) : 0;
    case 'vacanza':
      return s.impostazioni.cassaVacanza ? s.cassaVacanza : 0;
    default:
      return 0;
  }
}

/**
 * Il volo del bot, se conviene più dei dadi: confronta il tiro medio (con il premio della Partenza, che in volo non
 * si prende) con la meta migliore meno il biglietto. Così vola per comprare la città che gli completa un paese,
 * o per scappare da una fila di alberghi; altrimenti tira.
 */
function voloBot(s: Stato, g: Giocatore, scorta: number): Azione | null {
  const tab = tabellone(s.mappa);
  if (!tab.viaggi) return null;
  const n = tab.caselle.length;
  let tiro = 0;
  for (let d1 = 1; d1 <= 6; d1++) {
    for (let d2 = 1; d2 <= 6; d2++) {
      const passi = d1 + d2;
      const partenza = g.posizione + passi >= n ? tab.partenza.passaggio : 0;
      tiro += (valoreArrivo(s, g, (g.posizione + passi) % n, g.saldo, scorta, false) + partenza) / 36;
    }
  }
  let migliore: { azione: Azione; valore: number } | null = null;
  for (let casella = 0; casella < n; casella++) {
    const azione: Azione = { tipo: 'vola', giocatore: g.id, casella };
    if (!ok(s, azione)) continue;
    const prezzo = biglietto(s, g.id, casella)!.prezzo;
    const valore = valoreArrivo(s, g, casella, g.saldo - prezzo, scorta, true) - prezzo;
    if (!migliore || valore > migliore.valore) migliore = { azione, valore };
  }
  return migliore && migliore.valore > tiro + MARGINE_VOLO ? migliore.azione : null;
}

/**
 * Sulla proprietà di un avversario: il bot lo sfida a morra quando l'affitto fa male (almeno 100 € e un terzo del suo
 * contante), altrimenti paga. Il segno lo lascia al caso: nella morra nessun segno è migliore degli altri.
 */
function sceltaSfida(g: Giocatore, sf: Sfida): Azione {
  return sf.importo >= Math.max(100, g.saldo / 3) ? { tipo: 'sfida', giocatore: g.id } : { tipo: 'paga_affitto', giocatore: g.id };
}

/* ------------------------------------------------------------------ */
/* Aiuto ai compagni in rosso: la proposta                             */
/* ------------------------------------------------------------------ */

/**
 * L'aiuto a un compagno in rosso (anche fuori dal turno del bot): il regalo dei soldi che gli servono, con una nota,
 * se la stanza lo permette adesso (`aiutare`) e conviene (`valutaAiuto`). Se un compagno gli ha già offerto un regalo,
 * il bot non ne aggiunge un altro.
 */
function propostaDiAiuto(s: Stato, g: Giocatore, aiutare: (compagno: IdGiocatore) => boolean): Azione | null {
  for (const lui of attivi(s)) {
    if (lui.saldo >= 0 || !compagni(s, g.id, lui.id) || !aiutare(lui.id)) continue;
    if (s.scambi.some((x) => x.a === lui.id && regaloDiSquadra(s, x))) continue;
    const aiuto = valutaAiuto(s, g.id, lui.id);
    if (!aiuto) continue;
    const azione: Azione = {
      tipo: 'proponi',
      giocatore: g.id,
      a: lui.id,
      dare: { soldi: aiuto.regalo, caselle: [], grazie: [] },
      avere: { soldi: 0, caselle: [], grazie: [] },
      nota: notaDiAiuto(aiuto),
    };
    if (ok(s, azione)) return azione;
  }
  return null;
}

/** Cosa la stanza permette al bot in questo momento. */
export interface OpzioniBot {
  /** Può proporre uno scambio: la stanza lo concede di rado, perché non insista con le stesse proposte. */
  proporre?: boolean;
  /**
   * A quali compagni in rosso può offrire aiuto adesso: la stanza lo concede una volta a turno per compagno, e solo al bot
   * che può dare di più (`chiAiuta`). Senza, il bot non offre aiuto (come nelle simulazioni di soli bot del motore).
   */
  aiutare?: (compagno: IdGiocatore) => boolean;
}

/** Il bot è di turno e non c'è un'asta aperta. */
function mossaDelTurno(s: Stato, g: Giocatore, opzioni: OpzioniBot): Azione {
  const tab = tabellone(s.mappa);
  const t = s.turno;
  const possibili = azioniPossibili(s, g.id);
  const di = <T extends Azione['tipo']>(tipo: T) => possibili.filter((a): a is Extract<Azione, { tipo: T }> => a.tipo === tipo);
  const scorta = riserva(s, g.id);

  if (g.saldo < 0) return rientra(s, g, possibili);

  if (t.fase === 'prigione') {
    // Finché ci sono proprietà libere conviene girare; dopo, la prigione ripara dagli affitti.
    const libere = s.proprieta.filter((p) => p && p.proprietario === null).length;
    const grazia = di('usa_grazia')[0];
    if (grazia && libere >= 6) return grazia;
    const cauzione = di('paga_cauzione')[0];
    if (cauzione && libere >= 6 && g.saldo - tab.cauzione >= scorta) return cauzione;
    return di('lancia')[0] ?? possibili[0]!;
  }

  // Proprietà libera su cui si è fermato: la compra se resta con abbastanza contante, altrimenti asta.
  const compra = di('compra')[0];
  if (compra && t.acquisto !== null) {
    // Con il Mercato galattico il prezzo del giro può essere diverso da quello scritto sulla casella.
    const prezzo = prezzoAcquisto(s, t.acquisto);
    const completa = valoreCasella(s, g.id, t.acquisto) >= prezzo * 2;
    if (g.saldo - prezzo >= (completa ? 0 : scorta)) return compra;
  }
  const asta = di('asta')[0];
  if (asta) return asta;

  // Case: sulla città più cara tra quelle dove si può, se resta la scorta.
  const costruzioni = di('costruisci').filter((a) => {
    const c = proprietabile(tab, a.casella) as Citta;
    return g.saldo - costoProssimoEdificio(tab, c, s.proprieta[a.casella]!.livello) >= scorta;
  });
  if (costruzioni.length) return costruzioni.sort((x, y) => proprietabile(tab, y.casella)!.prezzo - proprietabile(tab, x.casella)!.prezzo)[0]!;

  // Ipoteche da togliere, quando il bot è ricco.
  const riscatto = di('riscatta').find((a) => g.saldo - costoRiscatto(tab, a.casella) >= scorta * 2);
  if (riscatto) return riscatto;

  // Prima di tirare, ogni tanto, una proposta per completare una regione (una sola aperta alla volta).
  if (opzioni.proporre && t.fase === 'lancio' && !s.scambi.some((x) => x.da === g.id)) {
    const proposta = propostaBot(s, g, scorta);
    if (proposta) return proposta;
  }

  // Giro del mondo: al posto dei dadi, il volo, quando conviene.
  const volo = voloBot(s, g, scorta);
  if (volo) return volo;

  return di('lancia')[0] ?? di('fine_turno')[0] ?? possibili.find((a) => a.tipo !== 'bancarotta') ?? possibili[0]!;
}

/**
 * La prossima azione del bot `id`, oppure `null` se adesso non ha niente da fare.
 * In ordine: offerte all'asta, sfida a morra, risposte agli scambi, ritiro delle sue proposte non più valide (e dei
 * regali che non servono più), aiuto ai compagni in rosso, voto (segue chi ha già votato), tempo a chi lo chiede,
 * il suo turno.
 */
export function mossaBot(s: Stato, id: IdGiocatore, opzioni: OpzioniBot = {}): Azione | null {
  if (s.fase !== 'in_corso') return null;
  const g = giocatore(s, id);
  if (!g || g.eliminato) return null;

  if (s.asta) {
    const offerta = offertaAsta(s, g);
    if (offerta) return offerta;
  }

  // La sfida a morra: lo sfidante decide se pagare, il proprietario risponde con un segno a caso.
  const sf = s.sfida;
  if (sf?.fase === 'scelta' && sf.sfidante === id) return sceltaSfida(g, sf);
  if (sf?.fase === 'morra' && sf.proprietario === id) return { tipo: 'morra', giocatore: id };

  const proposta = s.scambi.find((x) => x.a === id);
  if (proposta) return rispostaScambio(s, g, proposta);

  // Le sue proposte che nel frattempo non si possono più fare, le ritira.
  const superata = s.scambi.find((x) => x.da === id && problemiScambio(s, x).length > 0);
  if (superata) return { tipo: 'annulla', giocatore: id, scambio: superata.id };

  // Il regalo a un compagno che nel frattempo è uscito dal rosso non serve più: lo ritira.
  const inutile = s.scambi.find((x) => x.da === id && regaloDiSquadra(s, x) && (giocatore(s, x.a)?.saldo ?? 0) >= 0);
  if (inutile) return { tipo: 'annulla', giocatore: id, scambio: inutile.id };

  if (opzioni.aiutare) {
    const aiuto = propostaDiAiuto(s, g, opzioni.aiutare);
    if (aiuto) return aiuto;
  }

  const t = s.turno;
  if (t.giocatore !== id) {
    // Il voto lo comincia una persona; i bot la seguono solo contro chi è assente (scollegato, o con l'ultimo turno
    // giocato in automatico perché ha finito il tempo), mai contro chi sta giocando né contro un compagno.
    const voto: Azione = { tipo: 'vota', giocatore: id, favorevole: true };
    const bersaglio = giocatore(s, t.giocatore);
    const assente = bersaglio !== undefined && (bersaglio.offlineDa !== null || bersaglio.automatici > 0);
    if (t.votazione.voti.length > 0 && assente && !compagni(s, id, t.giocatore) && ok(s, voto)) return voto;
    const regalo: Azione = { tipo: 'regala_tempo', giocatore: id };
    if (t.tempo.richiesta && ok(s, regalo)) return regalo;
    return null;
  }
  if (s.asta || s.sfida) return null;
  return mossaDelTurno(s, g, opzioni);
}

/**
 * I bot ancora in gioco che adesso hanno qualcosa da fare, con la loro mossa.
 * Un bot che sta ricevendo l'aiuto di un altro bot aspetta: niente vendite né bancarotta prima di accettare il regalo.
 * @param proporre quali bot possono proporre uno scambio adesso.
 * @param aiutare a quali compagni in rosso si può offrire aiuto adesso: lo offre un solo bot, quello scelto da `chiAiuta`.
 */
export function mosseDeiBot(
  s: Stato,
  bot: readonly IdGiocatore[],
  proporre: (id: IdGiocatore) => boolean = () => false,
  aiutare: (compagno: IdGiocatore) => boolean = () => false,
): { giocatore: IdGiocatore; azione: Azione }[] {
  const vivi = new Set(attivi(s).map((g) => g.id));
  const aiutanti = new Map<IdGiocatore, IdGiocatore | null>();
  const aiutante = (compagno: IdGiocatore) => {
    if (!aiutanti.has(compagno)) aiutanti.set(compagno, chiAiuta(s, compagno, bot));
    return aiutanti.get(compagno);
  };
  const mosse = bot.flatMap((id) => {
    if (!vivi.has(id)) return [];
    const azione = mossaBot(s, id, { proporre: proporre(id), aiutare: (compagno) => aiutare(compagno) && aiutante(compagno) === id });
    return azione ? [{ giocatore: id, azione }] : [];
  });
  const aiutati = new Set(
    mosse.flatMap(({ giocatore: da, azione }) =>
      azione.tipo === 'proponi' && regaloDiSquadra(s, { da, a: azione.a, dare: azione.dare, avere: azione.avere }) ? [azione.a] : [],
    ),
  );
  return mosse.filter((m) => !aiutati.has(m.giocatore));
}

/* ------------------------------------------------------------------ */
/* Ritmo                                                               */
/* ------------------------------------------------------------------ */

/**
 * Quanto dura nei browser la scena di questi eventi (dadi che rotolano, pedine che avanzano):
 * le durate sono in tempi.ts, le stesse che usa la regia del browser.
 */
export function durataScena(s: Stato, eventi: readonly Evento[]): number {
  const caselle = tabellone(s.mappa).caselle.length;
  return eventi.reduce((ms, e) => ms + durataEvento(e, caselle), 0);
}

/**
 * Il tempo di "pensare" di un bot prima della prossima mossa, oltre alla scena. Più breve di prima (900 ms):
 * compensa le scene più ricche (carta al centro, volo in prigione), così una partita tra bot non rallenta.
 */
export const PENSIERO_BOT_MS = 700;

/** Turni di partita che un bot lascia passare tra una proposta di scambio e la successiva. */
export const TURNI_TRA_PROPOSTE_BOT = 8;
