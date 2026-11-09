/*
 * I mattoni dei suoni: toni, fruscii filtrati, note di metallofono, metallo, legno.
 * Ogni funzione programma i suoi nodi all'istante `t` (secondi dell'AudioContext) e li lascia spegnere da soli.
 */

export interface Uscita {
  ctx: BaseAudioContext;
  /** Il suono diretto. */
  secco: AudioNode;
  /** La mandata del riverbero (l'atrio della stazione). */
  eco: AudioNode;
  /** Un secondo di rumore bianco, da filtrare. */
  rumore: AudioBuffer;
}

const SILENZIO = 0.0001;

/** Un caso tra ±`quota` attorno a `x`: due colpi uguali non suonano mai identici. */
export function varia(x: number, quota = 0.06): number {
  return x * (1 + (Math.random() * 2 - 1) * quota);
}

/** Sale in `attacco` secondi fino a `picco`, poi si spegne in `durata` secondi. */
function busta(ctx: BaseAudioContext, t: number, attacco: number, durata: number, picco: number): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(SILENZIO, t);
  g.gain.exponentialRampToValueAtTime(Math.max(picco, SILENZIO * 2), t + attacco);
  g.gain.exponentialRampToValueAtTime(SILENZIO, t + attacco + durata);
  return g;
}

/** Collega all'uscita, con il panorama stereo e (se serve) un po' di riverbero. */
function collega(u: Uscita, nodo: AudioNode, eco = 0, pan = 0): void {
  let fine = nodo;
  if (pan !== 0) {
    const p = u.ctx.createStereoPanner();
    p.pan.value = pan;
    nodo.connect(p);
    fine = p;
  }
  fine.connect(u.secco);
  if (eco > 0) {
    const mandata = u.ctx.createGain();
    mandata.gain.value = eco;
    fine.connect(mandata);
    mandata.connect(u.eco);
  }
}

export interface Tono {
  f: number;
  /** Frequenza d'arrivo (glissando esponenziale in `glide` secondi, o in tutta la durata). */
  a?: number;
  glide?: number;
  tipo?: OscillatorType;
  attacco?: number;
  durata: number;
  volume: number;
  eco?: number;
  pan?: number;
}

export function tono(u: Uscita, t: number, o: Tono): void {
  const osc = u.ctx.createOscillator();
  osc.type = o.tipo ?? 'sine';
  osc.frequency.setValueAtTime(o.f, t);
  if (o.a !== undefined) osc.frequency.exponentialRampToValueAtTime(o.a, t + (o.glide ?? o.durata));
  const attacco = o.attacco ?? 0.004;
  const g = busta(u.ctx, t, attacco, o.durata, o.volume);
  osc.connect(g);
  collega(u, g, o.eco, o.pan);
  osc.start(t);
  osc.stop(t + attacco + o.durata + 0.05);
}

export interface Fruscio {
  /** Frequenza del filtro; con `a` scorre fino a lì in tutta la durata. */
  f: number;
  a?: number;
  q?: number;
  filtro?: BiquadFilterType;
  attacco?: number;
  durata: number;
  volume: number;
  eco?: number;
  pan?: number;
}

/** Rumore filtrato: carta, aria, scatti, colpi sordi. */
export function fruscio(u: Uscita, t: number, o: Fruscio): void {
  const sorgente = u.ctx.createBufferSource();
  sorgente.buffer = u.rumore;
  const filtro = u.ctx.createBiquadFilter();
  filtro.type = o.filtro ?? 'bandpass';
  filtro.frequency.setValueAtTime(o.f, t);
  if (o.a !== undefined) filtro.frequency.exponentialRampToValueAtTime(o.a, t + o.durata);
  filtro.Q.value = o.q ?? 1;
  const attacco = o.attacco ?? 0.002;
  const g = busta(u.ctx, t, attacco, o.durata, o.volume);
  sorgente.connect(filtro);
  filtro.connect(g);
  collega(u, g, o.eco, o.pan);
  const lunghezza = attacco + o.durata + 0.05;
  const inizio = Math.random() * Math.max(0, u.rumore.duration - lunghezza);
  sorgente.start(t, inizio, lunghezza);
}

export interface Nota {
  f: number;
  durata?: number;
  volume?: number;
  eco?: number;
  pan?: number;
}

/** Una nota di metallofono, come il gong degli annunci in stazione: tonda, con il colpo del battente. */
export function nota(u: Uscita, t: number, { f, durata = 1.2, volume = 0.2, eco = 0.35, pan = 0 }: Nota): void {
  tono(u, t, { f, durata, volume, eco, pan, attacco: 0.006 });
  tono(u, t, { f: f * 2, durata: durata * 0.4, volume: volume * 0.16, eco, pan, attacco: 0.004 });
  tono(u, t, { f: f * 3.98, durata: 0.1, volume: volume * 0.1, eco, pan, attacco: 0.002 });
  fruscio(u, t, { f: Math.min(f * 4, 9000), q: 2, durata: 0.018, volume: volume * 0.25, pan });
}

/** Metallo che vibra (monete, sbarre): parziali non armoniche [rapporto, volume, durata relativa]. */
export function metallo(
  u: Uscita,
  t: number,
  o: { f: number; parziali: readonly (readonly [number, number, number])[]; durata: number; volume: number; eco?: number; pan?: number },
): void {
  for (const [r, v, d] of o.parziali) {
    tono(u, t, { f: o.f * r, durata: o.durata * d, volume: o.volume * v, eco: o.eco, pan: o.pan, attacco: 0.0015 });
  }
}

/** Una moneta che tintinna. */
export function tintinnio(u: Uscita, t: number, f: number, volume: number, pan = 0): void {
  metallo(u, t, {
    f,
    volume,
    durata: 0.3,
    eco: 0.18,
    pan,
    parziali: [
      [1, 1, 1],
      [1.47, 0.45, 0.75],
      [2.76, 0.32, 0.5],
      [4.13, 0.18, 0.3],
    ],
  });
  fruscio(u, t, { f: 7000, filtro: 'highpass', durata: 0.01, volume: volume * 0.6, pan });
}

/** Un colpo di legno (blocchetto, martelletto, pedina sul tabellone). */
export function legno(u: Uscita, t: number, f: number, volume: number, pan = 0): void {
  tono(u, t, { f, a: f * 0.9, glide: 0.04, durata: 0.06, volume, pan, attacco: 0.001 });
  fruscio(u, t, { f, q: 8, durata: 0.035, volume: volume * 0.9, pan });
}

/** Un colpo sordo: un timbro che batte sul banco. */
export function tonfo(u: Uscita, t: number, volume: number): void {
  fruscio(u, t, { f: 600, filtro: 'lowpass', q: 0.7, durata: 0.06, volume });
  tono(u, t, { f: 150, a: 70, glide: 0.09, durata: 0.11, volume, attacco: 0.002 });
}

/** Il fischietto del capotreno: un fischio con il trillo della pallina. */
export function fischio(u: Uscita, t: number, durata: number, volume: number): void {
  const osc = u.ctx.createOscillator();
  osc.frequency.setValueAtTime(2550, t);
  const trillo = u.ctx.createOscillator();
  trillo.frequency.value = 34;
  const profondita = u.ctx.createGain();
  profondita.gain.value = 140;
  trillo.connect(profondita);
  profondita.connect(osc.frequency);
  const g = u.ctx.createGain();
  g.gain.setValueAtTime(SILENZIO, t);
  g.gain.exponentialRampToValueAtTime(volume, t + 0.025);
  g.gain.setValueAtTime(volume, t + durata - 0.08);
  g.gain.exponentialRampToValueAtTime(SILENZIO, t + durata);
  osc.connect(g);
  collega(u, g, 0.3);
  osc.start(t);
  trillo.start(t);
  osc.stop(t + durata + 0.05);
  trillo.stop(t + durata + 0.05);
  // Il fiato dentro il fischietto.
  fruscio(u, t, { f: 2600, q: 3, attacco: 0.02, durata: durata - 0.02, volume: volume * 0.5, eco: 0.2 });
}

/** La risposta dell'atrio: rumore stereo che si spegne in `secondi`, per il riverbero. */
export function atrio(ctx: BaseAudioContext, secondi = 1.6): AudioBuffer {
  const lunghezza = Math.floor(ctx.sampleRate * secondi);
  const buffer = ctx.createBuffer(2, lunghezza, ctx.sampleRate);
  const ritardo = Math.floor(ctx.sampleRate * 0.018);
  for (let canale = 0; canale < 2; canale++) {
    const dati = buffer.getChannelData(canale);
    for (let i = ritardo; i < lunghezza; i++) {
      const x = (i - ritardo) / (lunghezza - ritardo);
      dati[i] = (Math.random() * 2 - 1) * Math.pow(1 - x, 3.2);
    }
  }
  return buffer;
}

export function rumoreBianco(ctx: BaseAudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const dati = buffer.getChannelData(0);
  for (let i = 0; i < dati.length; i++) dati[i] = Math.random() * 2 - 1;
  return buffer;
}
