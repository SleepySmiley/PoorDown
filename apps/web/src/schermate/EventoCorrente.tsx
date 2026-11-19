/*
 * Cosa è appena successo, al centro del tabellone:
 * - EventoCorrente: la scheda dell'ultimo evento importante (affitto pedina → pedina, carta pescata, acquisto…).
 *   Ha `key` = numero della voce: a ogni evento nuovo rinasce, e la regia può animarne l'arrivo (.evento).
 * - RegistroCorto: le ultime righe del registro e «Tutto il registro».
 * - Cronologia: il registro completo in un riquadro sopra il tabellone.
 */

import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import {
  aOppureAd,
  destinazione,
  euro,
  EVENTI_COSMICI,
  FACCE_COSMICHE,
  fattoreTesto,
  preposizioneA,
  tabellone,
  type EventoStanza,
  type Giocatore,
  type IdGiocatore,
  type Segno,
  type Stato,
} from '@poordown/engine';
import { Pedina, Stemma, type RigaRegistro } from '../ui/comuni';
import { ICONA_FACCIA } from '../ui/facce-cosmiche';
import { RiquadroTabellone } from '../ui/Finestra';
import { Icona, type NomeIcona } from '../ui/icone';
import { SCORRE } from '../ui/movimento';
import { iniziale, variabili } from '../ui/utili';
import { NOME_SEGNO, vincitore } from './sfida';
import type { EventoInVista } from './turno';

type Tono = 'paga' | 'incassa' | 'neutro';

interface Contenuto {
  /** Pittogramma a sinistra (se non ci sono pedine o stemma). */
  icona?: NomeIcona;
  /** Due pedine con la freccia: chi paga → chi incassa. */
  coppia?: [IdGiocatore, IdGiocatore];
  /** Giro del mondo: due pedine faccia a faccia, chi sfida e chi è sfidato a morra. */
  duello?: [IdGiocatore, IdGiocatore];
  /** Giro del mondo: le due mani della morra con i segni giocati, ognuna nel colore del suo giocatore. */
  mani?: { da: IdGiocatore; a: IdGiocatore; segni: [Segno, Segno]; vince: IdGiocatore | null };
  /** Indice della regione per lo stemma (acquisti e costruzioni di città). */
  regione?: number;
  /** Il giocatore protagonista (pallino del colore prima del nome). */
  chi?: IdGiocatore;
  titolo: ReactNode;
  dettaglio?: ReactNode;
  importo?: { valore: number; tono: Tono };
}

const NOME_MAZZO = { busta: 'Busta', cartolina: 'Cartolina' } as const;

const MOTIVO_PRIGIONE = {
  casella: 'si è fermato su «Vai in prigione»',
  carta: 'l’ha detto una carta',
  tre_doppi: 'tre doppi di fila',
} as const;

const MODO_USCITA = {
  doppio: 'con un doppio',
  cauzione: 'pagando la cauzione: si muove al prossimo turno',
  grazia: 'con la Carta Grazia: si muove al prossimo turno',
  tentativi: 'dopo tre tentativi',
} as const;

const MOTIVO_RIMOZIONE = {
  tempo: 'tempo scaduto troppe volte',
  assenza: 'assente troppo a lungo',
  voto: 'per votazione',
  espulsione: 'tolto dall’host',
} as const;

/** Il tono dell'importo dal mio punto di vista: rosso se pago io, verde se incasso io. */
function tono(io: IdGiocatore | null, paga: IdGiocatore | null, incassa: IdGiocatore | null): Tono {
  if (io !== null && io === paga) return 'paga';
  if (io !== null && io === incassa) return 'incassa';
  return 'neutro';
}

function contenuto(e: EventoStanza, partita: Stato, io: IdGiocatore | null): Contenuto | null {
  const tab = tabellone(partita.mappa);
  const nome = (id: IdGiocatore) => partita.giocatori.find((g) => g.id === id)?.nome ?? '?';
  const casella = (n: number) => tab.caselle[n];
  // Il nome intero; quello breve solo se l'intero non sta nella scheda (Bangkok e i suoi 168 caratteri), come nel volo.
  const nomeCasella = (n: number) => {
    const c = casella(n);
    if (!c) return '?';
    return c.breve && c.nome.length > 24 ? c.breve : c.nome;
  };
  // «a Hell», «all’Aeroporto di Lukla», «alla casella Busta».
  const verso = (n: number) => {
    const c = casella(n);
    return c ? destinazione({ ...c, nome: nomeCasella(n) }) : '?';
  };
  const regione = (n: number) => {
    const c = casella(n);
    return c?.tipo === 'citta' ? c.regione : undefined;
  };
  switch (e.tipo) {
    case 'affitto':
      return {
        coppia: [e.da, e.a],
        titolo: (
          <>
            <b>{nome(e.da)}</b> paga l’affitto {aOppureAd(nome(e.a))} <b>{nome(e.a)}</b>
          </>
        ),
        dettaglio: nomeCasella(e.casella),
        importo: { valore: e.importo, tono: tono(io, e.da, e.a) },
      };
    case 'tassa':
      return {
        icona: 'percento',
        chi: e.giocatore,
        titolo: (
          <>
            <b>{nome(e.giocatore)}</b> paga {nomeCasella(e.casella)}
          </>
        ),
        importo: { valore: e.importo, tono: tono(io, e.giocatore, null) },
      };
    case 'premio':
      return {
        icona: 'monete',
        chi: e.giocatore,
        titolo: (
          <>
            <b>{nome(e.giocatore)}</b> incassa {nomeCasella(e.casella)}
          </>
        ),
        importo: { valore: e.importo, tono: tono(io, null, e.giocatore) },
      };
    case 'partenza':
      return {
        icona: 'partenza',
        chi: e.giocatore,
        titolo: (
          <>
            <b>{nome(e.giocatore)}</b> {e.arrivo ? 'si ferma sulla Partenza' : 'passa dalla Partenza'}
          </>
        ),
        dettaglio: e.tempesta ? 'La tempesta solare porta il premio alla Supernova' : undefined,
        importo: e.tempesta ? undefined : { valore: e.importo, tono: tono(io, null, e.giocatore) },
      };
    case 'cosmo': {
      const m = e.mercato;
      return {
        icona: 'pianeta',
        titolo: (
          <>
            Giro {e.giro}: <b>{EVENTI_COSMICI[e.evento].nome}</b>
          </>
        ),
        dettaglio: m
          ? `${EVENTI_COSMICI[e.evento].effetto} Mercato: ${tab.regioni[m.regione]?.nome ?? '?'} ×${fattoreTesto(m.fattore)}`
          : EVENTI_COSMICI[e.evento].effetto,
      };
    }
    case 'quantico':
      return {
        icona: 'dado',
        chi: e.giocatore,
        titolo: <>Affitto quantistico: esce {e.faccia}</>,
        dettaglio: e.fattore === 0 ? 'Affitto gratis!' : `L’affitto vale ×${fattoreTesto(e.fattore)}`,
      };
    case 'dado_cosmico': {
      const f = FACCE_COSMICHE[e.faccia];
      return {
        icona: ICONA_FACCIA[e.faccia],
        chi: e.giocatore,
        titolo: (
          <>
            Dado cosmico: <b>{f.nome}</b>
          </>
        ),
        dettaglio: f.effetto,
      };
    }
    case 'razzo':
      return {
        icona: 'razzo',
        chi: e.giocatore,
        titolo: (
          <>
            Il razzo porta <b>{nome(e.giocatore)}</b> a {nomeCasella(e.a)}
          </>
        ),
        dettaglio: 'La prossima proprietà libera',
      };
    case 'bandiera':
      return {
        regione: regione(e.casella),
        icona: 'bandiera',
        chi: e.giocatore,
        titolo: (
          <>
            <b>{nome(e.giocatore)}</b> pianta la bandiera su {nomeCasella(e.casella)}
          </>
        ),
        dettaglio: 'Dado cosmico: è sua, gratis',
      };
    case 'scudo':
      return {
        icona: 'scudo',
        chi: e.giocatore,
        titolo: (
          <>
            Lo scudo protegge <b>{nome(e.giocatore)}</b>
          </>
        ),
        dettaglio: `Niente affitto per ${nomeCasella(e.casella)}`,
        importo: { valore: e.importo, tono: e.giocatore === io ? 'incassa' : 'neutro' },
      };
    case 'fionda':
      return {
        icona: 'fionda',
        chi: e.giocatore,
        titolo: (
          <>
            <b>{nome(e.giocatore)}</b> prende la fionda
          </>
        ),
        dettaglio: `Riparte di ${Math.abs(e.passi)} caselle${e.passi < 0 ? ' all’indietro' : ''}`,
      };
    case 'buco_nero':
      return {
        icona: 'buconero',
        chi: e.giocatore,
        titolo: (
          <>
            Il Buco nero risucchia <b>{nome(e.giocatore)}</b>
          </>
        ),
        dettaglio: 'I soldi finiscono nel malloppo della Supernova',
        importo: { valore: e.importo, tono: tono(io, e.giocatore, null) },
      };
    case 'supernova': {
      const p = e.alPovero;
      const tetto = euro(tab.follie?.tetto ?? 0);
      // Già al tetto: tutto il malloppo va al più povero.
      if (p && e.importo === 0) {
        return {
          coppia: [e.giocatore, p.giocatore],
          titolo: (
            <>
              <b>{nome(e.giocatore)}</b> ha già {tetto}: il malloppo va {aOppureAd(nome(p.giocatore))} <b>{nome(p.giocatore)}</b>
            </>
          ),
          dettaglio: 'Supernova: al più povero',
          importo: { valore: p.importo, tono: tono(io, null, p.giocatore) },
        };
      }
      return {
        icona: 'stella',
        chi: e.giocatore,
        titolo: (
          <>
            <b>{nome(e.giocatore)}</b> prende il malloppo
          </>
        ),
        dettaglio: p
          ? `Tetto di ${tetto}: ${euro(p.importo)} ${preposizioneA(nome(p.giocatore))}`
          : e.fattore === 1
            ? 'Supernova!'
            : e.fattore < 1
              ? `Supernova ×${fattoreTesto(e.fattore)}: nella stella restano ${euro(e.resta)}`
              : `Supernova ×${fattoreTesto(e.fattore)} su ${euro(e.malloppo)}`,
        importo: { valore: e.importo, tono: tono(io, null, e.giocatore) },
      };
    }
    case 'roulette':
      return {
        icona: 'ruota',
        chi: e.giocatore,
        titolo: (
          <>
            <b>{nome(e.giocatore)}</b> gira la Roulette cosmica
          </>
        ),
        dettaglio: e.testo,
      };
    case 'meteorite':
      return {
        icona: 'meteorite',
        chi: e.giocatore,
        titolo: <>Un meteorite colpisce {nomeCasella(e.casella)}</>,
        dettaglio: `Crolla ${e.livello === 4 ? 'l’albergo' : 'una casa'} di ${nome(e.giocatore)}`,
      };
    case 'collisione':
      return {
        coppia: [e.giocatori[0], e.giocatori[1]],
        titolo: <>Collisione planetaria</>,
        dettaglio: `${nomeCasella(e.caselle[0])} ↔ ${nomeCasella(e.caselle[1])}: si scambiano di proprietario`,
      };
    case 'gravita_invertita':
      return {
        icona: 'aggiorna',
        chi: e.giocatore,
        titolo: (
          <>
            <b>{nome(e.giocatore)}</b> inverte la gravità
          </>
        ),
        dettaglio: 'Fino alla fine del giro si cammina al contrario',
      };
    case 'acquisto':
    case 'asta_vinta': {
      const r = regione(e.casella);
      const prezzo = e.tipo === 'acquisto' ? e.prezzo : e.importo;
      return {
        regione: r,
        icona: e.tipo === 'asta_vinta' ? 'martelletto' : 'piu',
        chi: e.giocatore,
        titolo: (
          <>
            <b>{nome(e.giocatore)}</b> {e.tipo === 'asta_vinta' ? 'vince all’asta' : 'compra'} {nomeCasella(e.casella)}
          </>
        ),
        dettaglio: e.tipo === 'asta_vinta' ? 'Asta' : undefined,
        importo: { valore: prezzo, tono: tono(io, e.giocatore, null) },
      };
    }
    case 'asta_deserta':
      return {
        icona: 'martelletto',
        titolo: <>Nessuno compra {nomeCasella(e.casella)}</>,
        dettaglio: e.offerente ? `${nome(e.offerente)} non ha più i soldi: resta alla banca` : 'Nessuna offerta: resta alla banca',
      };
    case 'prigione':
      return {
        icona: 'vaiprigione',
        chi: e.giocatore,
        titolo: (
          <>
            <b>{nome(e.giocatore)}</b> va in prigione
          </>
        ),
        dettaglio: maiuscolaIniziale(MOTIVO_PRIGIONE[e.motivo]),
      };
    case 'teletrasporto':
      return {
        icona: 'scintilla',
        chi: e.giocatore,
        titolo: (
          <>
            <b>{nome(e.giocatore)}</b> si teletrasporta
          </>
        ),
        dettaglio: nomeCasella(e.a),
      };
    case 'robin_hood':
      return {
        coppia: [e.da, e.a],
        titolo: (
          <>
            <b>{nome(e.da)}</b> dà {aOppureAd(nome(e.a))} <b>{nome(e.a)}</b>
          </>
        ),
        dettaglio: 'Robin Hood: dal più ricco al più povero',
        importo: { valore: e.importo, tono: tono(io, e.da, e.a) },
      };
    case 'moneta':
      return {
        icona: 'monete',
        chi: e.giocatore,
        titolo: (
          <>
            Esce {e.testa ? 'testa' : 'croce'}: <b>{nome(e.giocatore)}</b> {e.testa ? 'incassa' : 'paga'}
          </>
        ),
        dettaglio: 'Testa o croce',
        importo: { valore: e.importo, tono: e.testa ? tono(io, null, e.giocatore) : tono(io, e.giocatore, null) },
      };
    case 'prigione_fallita':
      return {
        icona: 'prigione',
        chi: e.giocatore,
        titolo: (
          <>
            <b>{nome(e.giocatore)}</b> non fa doppio
          </>
        ),
        dettaglio: e.tentativi >= 3 ? 'Al prossimo turno esce di prigione' : `Resta in prigione: tentativo ${e.tentativi} di 3`,
      };
    case 'uscita_prigione':
      return {
        icona: 'prigione',
        chi: e.giocatore,
        titolo: (
          <>
            <b>{nome(e.giocatore)}</b> esce di prigione
          </>
        ),
        dettaglio: maiuscolaIniziale(MODO_USCITA[e.modo]),
      };
    case 'vacanza':
      return {
        icona: 'vacanza',
        chi: e.giocatore,
        titolo: (
          <>
            <b>{nome(e.giocatore)}</b> va in vacanza
          </>
        ),
        dettaglio: 'Salta il prossimo turno',
        importo: e.incasso > 0 ? { valore: e.incasso, tono: tono(io, null, e.giocatore) } : undefined,
      };
    case 'turno_saltato':
      return {
        icona: 'vacanza',
        chi: e.giocatore,
        titolo: (
          <>
            <b>{nome(e.giocatore)}</b> è in vacanza
          </>
        ),
        dettaglio: 'Salta il turno',
      };
    case 'costruzione':
      return {
        regione: regione(e.casella),
        icona: e.livello === 5 ? 'albergo' : 'casa',
        chi: e.giocatore,
        titolo: (
          <>
            <b>{nome(e.giocatore)}</b> costruisce {e.livello === 5 ? 'un albergo' : 'una casa'}
          </>
        ),
        // Con la costruzione di squadra la città può essere di un compagno.
        dettaglio: e.proprietario ? `${nomeCasella(e.casella)}, di ${nome(e.proprietario)}` : nomeCasella(e.casella),
        importo: { valore: e.costo, tono: tono(io, e.giocatore, null) },
      };
    case 'demolizione':
      return {
        icona: 'casa',
        chi: e.giocatore,
        titolo: (
          <>
            <b>{nome(e.giocatore)}</b> vende {e.livello === 4 ? 'l’albergo' : 'una casa'}
          </>
        ),
        dettaglio: nomeCasella(e.casella),
        importo: { valore: e.importo, tono: tono(io, null, e.giocatore) },
      };
    case 'vendita':
      return {
        icona: 'banca',
        chi: e.giocatore,
        titolo: (
          <>
            <b>{nome(e.giocatore)}</b> vende {nomeCasella(e.casella)}
          </>
        ),
        dettaglio: 'Alla banca',
        importo: { valore: e.importo, tono: tono(io, null, e.giocatore) },
      };
    case 'ipoteca':
      return {
        icona: 'banca',
        chi: e.giocatore,
        titolo: (
          <>
            <b>{nome(e.giocatore)}</b> ipoteca {nomeCasella(e.casella)}
          </>
        ),
        importo: { valore: e.importo, tono: tono(io, null, e.giocatore) },
      };
    case 'riscatto':
      return {
        icona: 'banca',
        chi: e.giocatore,
        titolo: (
          <>
            <b>{nome(e.giocatore)}</b> toglie l’ipoteca da {nomeCasella(e.casella)}
          </>
        ),
        importo: { valore: e.importo, tono: tono(io, e.giocatore, null) },
      };
    case 'debito':
      return {
        coppia: [e.da, e.a],
        titolo: (
          <>
            <b>{nome(e.da)}</b> resta in debito con <b>{nome(e.a)}</b>
          </>
        ),
        dettaglio: 'Non ha abbastanza contante',
        importo: { valore: e.importo, tono: e.da === io ? 'paga' : 'neutro' },
      };
    case 'bancarotta':
      return {
        icona: 'bandiera',
        chi: e.giocatore,
        titolo: (
          <>
            <b>{nome(e.giocatore)}</b> fa bancarotta
          </>
        ),
        dettaglio: e.erede ? `I beni vanno ${preposizioneA(nome(e.erede))}` : 'Le sue proprietà tornano alla banca',
      };
    case 'rimozione':
      return {
        icona: 'esci',
        chi: e.giocatore,
        titolo: (
          <>
            <b>{nome(e.giocatore)}</b> esce dalla partita
          </>
        ),
        dettaglio: maiuscolaIniziale(MOTIVO_RIMOZIONE[e.motivo]),
      };
    case 'volo':
      return {
        icona: 'aereo',
        chi: e.giocatore,
        titolo: (
          <>
            <b>{nome(e.giocatore)}</b> vola {verso(e.a)}
          </>
        ),
        dettaglio:
          e.prezzo === 0
            ? 'Biglietto omaggio'
            : e.incassa
              ? `Biglietto pagato ${preposizioneA(nome(e.incassa))}, padrone dell’aeroporto`
              : 'Biglietto pagato alla banca',
        ...(e.prezzo > 0 ? { importo: { valore: e.prezzo, tono: tono(io, e.giocatore, e.incassa) } } : {}),
      };
    case 'passaporto':
      return {
        icona: 'passaporto',
        chi: e.giocatore,
        titolo: (
          <>
            <b>{nome(e.giocatore)}</b> ritira il passaporto
          </>
        ),
        dettaglio: 'Da adesso può volare',
      };
    // Le caselle strane: le icone sono quelle delle caselle (ui/caselle.ts).
    case 'bermuda':
      return {
        icona: 'spirale',
        chi: e.giocatore,
        titolo: (
          <>
            <b>{nome(e.giocatore)}</b> sparisce nelle Bermuda
          </>
        ),
        dettaglio: `Ricompare ${verso(e.a)}`,
      };
    case 'antipodi':
      return {
        icona: 'antipodi',
        chi: e.giocatore,
        titolo: (
          <>
            <b>{nome(e.giocatore)}</b> cade nella buca
          </>
        ),
        dettaglio: `Sbuca dall’altra parte del mondo, ${verso(e.a)}`,
      };
    case 'cambio_data':
      return {
        icona: 'calendario',
        chi: e.giocatore,
        titolo: (
          <>
            <b>{nome(e.giocatore)}</b> guadagna un giorno
          </>
        ),
        dettaglio: 'Linea del cambio di data: si muove ancora',
      };
    case 'sfida':
      return {
        duello: [e.da, e.a],
        titolo: (
          <>
            <b>{nome(e.da)}</b> sfida <b>{nome(e.a)}</b> a morra cinese
          </>
        ),
        dettaglio: `Invece di pagare ${euro(e.importo)} per ${nomeCasella(e.casella)}`,
      };
    case 'morra': {
      const vince = vincitore(e);
      const [mio, suo] = e.segni;
      const lento = e.aCaso ? ` (${nome(e.aCaso)} a caso)` : '';
      const quanto = e.esito === 'vinta' ? 'niente affitto' : e.esito === 'persa' ? 'affitto doppio' : 'affitto normale';
      return {
        mani: { da: e.da, a: e.a, segni: e.segni, vince },
        titolo: vince ? (
          <>
            <b>{nome(vince)}</b> vince a morra cinese
          </>
        ) : (
          'Morra cinese: pari'
        ),
        dettaglio: `${NOME_SEGNO[mio]} contro ${NOME_SEGNO[suo].toLowerCase()}${lento}: ${quanto}`,
        ...(e.importo > 0 ? { importo: { valore: e.importo, tono: tono(io, e.da, e.a) } } : {}),
      };
    }
    case 'rientro':
      return {
        icona: 'partenza',
        chi: e.giocatore,
        titolo: (
          <>
            <b>{nome(e.giocatore)}</b> rientra in partita
          </>
        ),
        dettaglio: 'Dalla Partenza, senza proprietà',
        importo: { valore: e.soldi, tono: tono(io, null, e.giocatore) },
      };
    case 'reset':
      return {
        icona: 'banca',
        titolo: 'Tutte le proprietà tornano alla banca',
        dettaglio: `${e.caselle.length} proprietà di nuovo in vendita; i soldi restano`,
      };
    case 'ultimo_rimasto':
      return {
        icona: 'coppa',
        chi: e.giocatore,
        titolo: (
          <>
            <b>{nome(e.giocatore)}</b> non ha più avversari
          </>
        ),
        dettaglio: `Vince dopo altri ${e.turni} turni, se nessuno rientra con la Vita extra`,
      };
    case 'scambio_accettato':
      return {
        coppia: [e.da, e.a],
        titolo: (
          <>
            Scambio tra <b>{nome(e.da)}</b> e <b>{nome(e.a)}</b>
          </>
        ),
        dettaglio: 'Accettato',
      };
    case 'tempo_scaduto':
      return {
        icona: 'orologio',
        chi: e.giocatore,
        titolo: (
          <>
            Tempo scaduto per <b>{nome(e.giocatore)}</b>
          </>
        ),
        dettaglio: 'Il gioco finisce il turno al posto suo',
      };
    default:
      return null;
  }
}

function maiuscolaIniziale(testo: string): string {
  return testo.charAt(0).toUpperCase() + testo.slice(1);
}

function PedinaDi({ g }: { g: Giocatore | undefined }): ReactNode {
  return g ? <Pedina colore={g.colore} iniziale={iniziale(g.nome)} className="evento__pedina" /> : null;
}

/** La scheda dell'ultimo evento importante. Chi la usa le dà `key={evento.voce.n}`. */
export function EventoCorrente({
  evento,
  partita,
  io,
}: {
  evento: EventoInVista;
  partita: Stato;
  io: IdGiocatore | null;
}): ReactNode {
  const e = evento.voce.evento;
  const giocatore = (id: IdGiocatore) => partita.giocatori.find((g) => g.id === id);
  const classi = (extra: string) => ['evento', extra, evento.precedente ? 'evento--precedente' : ''].filter(Boolean).join(' ');

  // La carta pescata: testata con il mazzo (o «Carta rara»), il testo della carta per intero.
  if (e.tipo === 'carta') {
    const g = giocatore(e.giocatore);
    return (
      <article
        className={classi(`evento--carta evento--${e.mazzo}${e.rara ? ' evento--rara' : ''}`)}
        aria-label={`${e.rara ? 'Carta rara' : 'Carta pescata'}: ${e.testo}`}
      >
        <header className="evento__testata">
          <Icona nome={e.rara ? 'stella' : e.mazzo} />
          <span className="evento__mazzo">{e.rara ? 'Carta rara' : NOME_MAZZO[e.mazzo]}</span>
          {g && (
            <span className="evento__chi">
              <Pedina colore={g.colore} className="pedina--mini" />
              {g.nome}
            </span>
          )}
        </header>
        <p className="evento__testo-carta">{e.testo}</p>
      </article>
    );
  }

  const c = contenuto(e, partita, io);
  if (!c) return null;
  const tab = tabellone(partita.mappa);
  let figura: ReactNode;
  if (c.mani) {
    const { da, a, segni, vince } = c.mani;
    const mano = (id: IdGiocatore, segno: Segno, destra: boolean) => (
      <span
        className={[
          'evento__mano',
          destra ? 'evento__mano--destra' : '',
          vince !== null && vince !== id ? 'evento__mano--perde' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={variabili({ '--colore': `var(--p${giocatore(id)?.colore ?? 1})` })}
      >
        <Icona nome={segno} />
      </span>
    );
    figura = (
      <span className="evento__mani">
        {mano(da, segni[0], false)}
        {mano(a, segni[1], true)}
      </span>
    );
  } else if (c.duello) {
    figura = (
      <span className="evento__coppia evento__duello">
        <PedinaDi g={giocatore(c.duello[0])} />
        <PedinaDi g={giocatore(c.duello[1])} />
      </span>
    );
  } else if (c.coppia) {
    figura = (
      <span className="evento__coppia">
        <PedinaDi g={giocatore(c.coppia[0])} />
        <Icona nome="avanti" className="evento__freccia" />
        <PedinaDi g={giocatore(c.coppia[1])} />
      </span>
    );
  } else if (c.regione !== undefined) {
    figura = <Stemma regione={tab.regioni[c.regione]} className="evento__stemma" />;
  } else if (c.icona) {
    figura = (
      <span className="evento__pittogramma">
        <Icona nome={c.icona} />
      </span>
    );
  }
  const chi = c.chi ? giocatore(c.chi) : undefined;
  return (
    <article className={classi(c.coppia ? 'evento--coppia' : '')}>
      {figura}
      <div className="evento__testo">
        <p className="evento__titolo">
          {chi && !c.coppia && <Pedina colore={chi.colore} className="pedina--mini" />}
          <span>{c.titolo}</span>
        </p>
        {c.dettaglio && <p className="evento__dettaglio">{c.dettaglio}</p>}
      </div>
      {c.importo && <span className={`evento__importo evento__importo--${c.importo.tono}`}>{euro(c.importo.valore)}</span>}
    </article>
  );
}

/** Quante righe del registro restano in vista sotto la scheda dell'evento. */
const RIGHE_CORTE = 3;

/** Le ultime righe del registro (senza quella già nella scheda) e il collegamento al registro completo. */
export function RegistroCorto({
  righe,
  esclusa,
  onTutto,
}: {
  righe: RigaRegistro[];
  /** La voce già mostrata nella scheda dell'evento. */
  esclusa?: number;
  onTutto: () => void;
}): ReactNode {
  const ultime = righe.filter((r) => r.n !== esclusa).slice(0, RIGHE_CORTE);
  return (
    <div className="registro-corto">
      <ol className="registro-corto__righe" aria-label="Ultimi eventi" aria-live="polite">
        {ultime.map((r) => (
          <motion.li key={r.n} layout="position" transition={SCORRE} className="registro-corto__riga">
            {r.colore !== undefined && <Pedina colore={r.colore} className="pedina--mini" />}
            <span>{r.testo}</span>
          </motion.li>
        ))}
      </ol>
      {righe.length > 0 && (
        <button type="button" className="collegamento registro-corto__tutto" onClick={onTutto}>
          <Icona nome="nota" />
          Tutto il registro
        </button>
      )}
    </div>
  );
}

/** Il registro completo della partita, in un riquadro sopra il tabellone. */
export function Cronologia({ righe, onChiudi }: { righe: RigaRegistro[]; onChiudi: () => void }): ReactNode {
  return (
    <RiquadroTabellone titolo="Registro della partita" onChiudi={onChiudi} className="cronologia">
      {righe.length === 0 ? (
        <p className="cronologia__vuota">Non è ancora successo niente.</p>
      ) : (
        <ol className="cronologia__righe">
          {righe.map((r) => (
            <li key={r.n} className="cronologia__riga">
              {r.colore !== undefined ? <Pedina colore={r.colore} className="pedina--mini" /> : <span className="cronologia__vuoto" />}
              <span>{r.testo}</span>
            </li>
          ))}
        </ol>
      )}
    </RiquadroTabellone>
  );
}
