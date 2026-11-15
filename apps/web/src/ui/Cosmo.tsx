import '../stili/cosmo.css';
import { useEffect, useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import {
  euro,
  EVENTI_COSMICI,
  fattoreTesto,
  TEMPI,
  type Carta,
  type Cosmo,
  type EventoCosmico,
  type Tabellone,
} from '@poordown/engine';
import { Dado, Stemma } from './comuni';
import { Icona, type NomeIcona } from './icone';
import { CURVA } from './movimento';
import { variabili } from './utili';

/*
 * Le scene e il riquadro delle regole folli del Sistema solare, sopra e dentro il tabellone (misure in --k):
 * - RouletteCosmica: la ruota gira e rallenta fino allo spicchio uscito, poi si legge cosa fa;
 * - AnnuncioCosmo: all'inizio di ogni giro, l'evento cosmico e il pianeta del Mercato galattico;
 * - DadoQuantico: il dado che moltiplica l'affitto;
 * - PannelloCosmo: lo stato del cosmo sempre in vista al centro del tabellone.
 * I tempi sono quelli della regia (TEMPI.rouletteGira, TEMPI.cosmo, TEMPI.quantico).
 */

/** Pittogramma e colore di ogni evento cosmico. */
const ASPETTO_EVENTO: Record<EventoCosmico, { icona: NomeIcona; colore: string }> = {
  quiete: { icona: 'pianeta', colore: '#8fd3ff' },
  allineamento: { icona: 'stella', colore: '#ffd166' },
  eclissi: { icona: 'buconero', colore: '#b58cff' },
  tempesta: { icona: 'fulmine', colore: '#ff7a59' },
  meteoriti: { icona: 'meteorite', colore: '#ff9f43' },
  gravita: { icona: 'aggiorna', colore: '#5ee6c8' },
  collisione: { icona: 'scambio', colore: '#ff6fb5' },
};

const COLORI_SPICCHI = ['#ff6fb5', '#5ee6c8', '#ffd166', '#b58cff', '#ff7a59', '#8fd3ff', '#7ee081', '#f78fb3'];

/** La scritta corta dentro lo spicchio. */
function etichettaSpicchio(c: Carta): string {
  const e = c.effetto;
  switch (e.tipo) {
    case 'soldi':
      return e.importo > 0 ? `+${e.importo}` : `−${-e.importo}`;
    case 'meta_contante':
      return '−½';
    case 'da_ognuno':
      return 'Fan club';
    case 'a_ognuno':
      return 'Offri tu';
    case 'casuale':
      return 'Wormhole';
    case 'prigione':
      return 'Prigione';
    case 'inverti':
      return 'Gravità';
    case 'vai_a':
      return 'Supernova';
    default:
      return '?';
  }
}

/** La fetta i-esima della ruota (raggio 100, centro 0,0), con lo zero in alto. */
function fetta(i: number, n: number): string {
  const passo = (2 * Math.PI) / n;
  const a0 = i * passo - passo / 2 - Math.PI / 2;
  const a1 = a0 + passo;
  const punto = (a: number) => `${(100 * Math.cos(a)).toFixed(2)} ${(100 * Math.sin(a)).toFixed(2)}`;
  return `M0 0L${punto(a0)}A100 100 0 0 1 ${punto(a1)}Z`;
}

export function RouletteCosmica({
  spicchi,
  spicchio,
  testo,
  didascalia,
}: {
  spicchi: readonly Carta[];
  spicchio: number;
  testo: string;
  didascalia?: ReactNode;
}): ReactNode {
  const n = spicchi.length;
  // Cinque giri e mezzo e poi lo spicchio uscito sotto la lancetta (in alto).
  const finale = 360 * 5 - (spicchio * 360) / n;
  const [giro, setGiro] = useState(0);
  const [fermo, setFermo] = useState(false);
  useEffect(() => {
    const parti = requestAnimationFrame(() => setGiro(finale));
    const ferma = setTimeout(() => setFermo(true), TEMPI.rouletteGira);
    return () => {
      cancelAnimationFrame(parti);
      clearTimeout(ferma);
    };
  }, [finale]);
  return (
    <motion.div
      className="roulette-cosmica"
      initial={{ scale: 0.4, opacity: 0, rotate: -30 }}
      animate={{ scale: 1, opacity: 1, rotate: 0, transition: { duration: 0.35, ease: CURVA.arrivo } }}
      exit={{ scale: 0.3, opacity: 0, top: '80%', transition: { duration: TEMPI.cartaEsce / 1000, ease: CURVA.partenza } }}
    >
      <div className="roulette-cosmica__ruota">
        <span className="roulette-cosmica__lancetta" aria-hidden="true" />
        <svg
          viewBox="-104 -104 208 208"
          className="roulette-cosmica__disco"
          style={{ transform: `rotate(${giro}deg)`, transitionDuration: `${TEMPI.rouletteGira}ms` }}
          aria-hidden="true"
        >
          <circle r="103" className="roulette-cosmica__bordo" />
          {spicchi.map((c, i) => {
            const angolo = (i * 360) / n;
            return (
              <g key={i}>
                <path d={fetta(i, n)} fill={COLORI_SPICCHI[i % COLORI_SPICCHI.length]} className={fermo && i === spicchio ? 'roulette-cosmica__uscito' : undefined} />
                <text transform={`rotate(${angolo}) translate(0 -62) rotate(90)`} className="roulette-cosmica__etichetta">
                  {etichettaSpicchio(c)}
                </text>
              </g>
            );
          })}
          <circle r="22" className="roulette-cosmica__mozzo" />
        </svg>
      </div>
      <motion.p
        className="roulette-cosmica__testo"
        initial={{ opacity: 0, y: 8 }}
        animate={fermo ? { opacity: 1, y: 0, transition: { duration: 0.25, ease: CURVA.arrivo } } : { opacity: 0, y: 8 }}
      >
        {testo}
      </motion.p>
      {didascalia && <p className="carta-pescata__chi">{didascalia}</p>}
    </motion.div>
  );
}

/** La riga del Mercato galattico: lo stemma del pianeta, il nome, se sale o crolla. */
function RigaMercato({ tab, mercato }: { tab: Tabellone; mercato: NonNullable<Cosmo['mercato']> }): ReactNode {
  const regione = tab.regioni[mercato.regione];
  const sale = mercato.fattore > 1;
  return (
    <span className={sale ? 'cosmo-mercato cosmo-mercato--sale' : 'cosmo-mercato cosmo-mercato--crolla'}>
      <Stemma regione={regione} className="cosmo-mercato__stemma" />
      <b>{regione?.nome}</b>
      <span className="cosmo-mercato__fattore">
        <Icona nome={sale ? 'su' : 'giu'} />×{fattoreTesto(mercato.fattore)}
      </span>
    </span>
  );
}

export function AnnuncioCosmo({
  tab,
  giro,
  evento,
  mercato,
}: {
  tab: Tabellone;
  giro: number;
  evento: EventoCosmico;
  mercato: Cosmo['mercato'];
}): ReactNode {
  const { nome, effetto } = EVENTI_COSMICI[evento];
  const aspetto = ASPETTO_EVENTO[evento];
  return (
    <motion.div
      className="annuncio-cosmo"
      style={variabili({ '--evento': aspetto.colore })}
      initial={{ scale: 0.6, opacity: 0, y: -20 }}
      animate={{ scale: 1, opacity: 1, y: 0, transition: { duration: 0.4, ease: CURVA.arrivo } }}
      exit={{ scale: 0.4, opacity: 0, y: 60, transition: { duration: TEMPI.cartaEsce / 1000, ease: CURVA.partenza } }}
    >
      <span className="annuncio-cosmo__giro">Giro {giro}</span>
      <Icona nome={aspetto.icona} className="annuncio-cosmo__icona" />
      <h2 className="annuncio-cosmo__nome">{nome}</h2>
      <p className="annuncio-cosmo__effetto">{effetto}</p>
      {mercato && (
        <p className="annuncio-cosmo__mercato">
          <span className="annuncio-cosmo__etichetta">Mercato galattico</span>
          <RigaMercato tab={tab} mercato={mercato} />
          <span className="annuncio-cosmo__nota">prezzi e affitti</span>
        </p>
      )}
    </motion.div>
  );
}

export function DadoQuantico({ faccia, fattore }: { faccia: number; fattore: number }): ReactNode {
  return (
    <motion.div
      className={fattore === 0 ? 'dado-quantico dado-quantico--gratis' : fattore > 1 ? 'dado-quantico dado-quantico--caro' : 'dado-quantico'}
      initial={{ scale: 0.5, opacity: 0, rotate: -120 }}
      animate={{ scale: 1, opacity: 1, rotate: 0, transition: { duration: 0.45, ease: CURVA.arrivo } }}
      exit={{ scale: 0.6, opacity: 0, transition: { duration: 0.18, ease: CURVA.partenza } }}
    >
      <Dado valore={faccia} className="dado-quantico__dado" />
      <span className="dado-quantico__testo">
        <span className="dado-quantico__titolo">Affitto quantistico</span>
        <b>{fattore === 0 ? 'Gratis!' : `×${fattoreTesto(fattore)}`}</b>
      </span>
    </motion.div>
  );
}

/** Lo stato del cosmo, sempre in vista al centro del tabellone: evento del giro, mercato, malloppo, verso di marcia. */
export function PannelloCosmo({ tab, cosmo }: { tab: Tabellone; cosmo: Cosmo }): ReactNode {
  const { nome, effetto } = EVENTI_COSMICI[cosmo.evento];
  const aspetto = ASPETTO_EVENTO[cosmo.evento];
  return (
    <div className="pannello-cosmo" style={variabili({ '--evento': aspetto.colore })}>
      <span className="pannello-cosmo__evento" title={effetto}>
        <Icona nome={aspetto.icona} />
        <span>
          <span className="pannello-cosmo__giro">Giro {cosmo.giro}</span> {nome}
        </span>
      </span>
      {cosmo.mercato && <RigaMercato tab={tab} mercato={cosmo.mercato} />}
      <span className="pannello-cosmo__malloppo" title="Il malloppo della Supernova">
        <Icona nome="stella" />
        {euro(cosmo.malloppo)}
      </span>
      {cosmo.verso === -1 && (
        <span className="pannello-cosmo__verso">
          <Icona nome="aggiorna" />
          Al contrario
        </span>
      )}
    </div>
  );
}
