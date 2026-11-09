/*
 * Il motore dei suoni. Tutto è sintetizzato al momento con la Web Audio API (catalogo.ts): niente file da scaricare.
 * - L'AudioContext nasce al primo clic o tasto: prima i browser non lasciano suonare.
 * - Catena: suono → secco + riverbero dell'atrio → volume → compressore → altoparlanti.
 * - Il volume (livello.ts) si applica qui, con una curva che a metà corsa suona già «a metà».
 * Senza Web Audio (o nei test) `suona` non fa niente.
 */

import { CATALOGO, type NomeSuono } from './catalogo';
import { atrio, rumoreBianco, type Uscita } from './sintesi';
import { volume } from './livello';

export type { NomeSuono } from './catalogo';

interface Banco {
  ctx: AudioContext;
  uscita: Uscita;
  volume: GainNode;
}

let banco: Banco | null = null;

function guadagno(v: number): number {
  return Math.pow(v / 100, 1.7);
}

function creaBanco(): Banco | null {
  if (typeof AudioContext === 'undefined') return null;
  try {
    const ctx = new AudioContext({ latencyHint: 'interactive' });
    const compressore = ctx.createDynamicsCompressor();
    compressore.threshold.value = -16;
    compressore.knee.value = 10;
    compressore.ratio.value = 4;
    compressore.attack.value = 0.003;
    compressore.release.value = 0.15;
    compressore.connect(ctx.destination);

    const vol = ctx.createGain();
    vol.gain.value = guadagno(volume.leggi());
    vol.connect(compressore);

    const secco = ctx.createGain();
    secco.connect(vol);

    // L'atrio: un riverbero corto e scuro, per le note del gong e le sbarre.
    const riverbero = ctx.createConvolver();
    riverbero.buffer = atrio(ctx);
    const scuro = ctx.createBiquadFilter();
    scuro.type = 'lowpass';
    scuro.frequency.value = 4500;
    const eco = ctx.createGain();
    eco.gain.value = 0.5;
    eco.connect(riverbero);
    riverbero.connect(scuro);
    scuro.connect(vol);

    volume.ascolta(() => vol.gain.setTargetAtTime(guadagno(volume.leggi()), ctx.currentTime, 0.03));
    return { ctx, volume: vol, uscita: { ctx, secco, eco, rumore: rumoreBianco(ctx) } };
  } catch {
    return null;
  }
}

/** Al primo gesto nasce l'AudioContext; ai gesti dopo riparte se il browser l'ha sospeso. */
function sblocca(): void {
  banco ??= creaBanco();
  if (banco?.ctx.state === 'suspended') void banco.ctx.resume();
}

if (typeof window !== 'undefined') {
  for (const evento of ['pointerdown', 'keydown'] as const) {
    window.addEventListener(evento, sblocca, { capture: true, passive: true });
  }
}

/** Lo stesso suono non riparte prima di così (ms): due avvisi uguali insieme diventano uno. */
const DISTANZA_MS = 40;
const ultimi = new Map<NomeSuono, number>();

/**
 * Suona subito (o tra `ritardo` ms). `forza` da 0 a 1: i suoni che riguardano gli altri vanno più piano.
 * Non fa niente se il volume è a zero o se l'utente non ha ancora toccato la pagina.
 */
export function suona(nome: NomeSuono, { forza = 1, ritardo = 0 }: { forza?: number; ritardo?: number } = {}): void {
  if (!banco || banco.ctx.state !== 'running' || volume.leggi() === 0) return;
  const ora = performance.now() + ritardo;
  if (ora - (ultimi.get(nome) ?? -Infinity) < DISTANZA_MS) return;
  ultimi.set(nome, ora);
  try {
    CATALOGO[nome](banco.uscita, banco.ctx.currentTime + 0.005 + ritardo / 1000, forza);
  } catch {
    // Un nodo non supportato da questo browser: meglio il silenzio che un errore.
  }
}
