/*
 * Coriandoli per chi vince: due getti dagli angoli in basso, poi i pezzetti di carta ricadono girando.
 * Un canvas sopra tutta la pagina che non blocca i clic; sparisce da solo. Niente per chi preferisce meno movimento.
 */

import { useEffect, useRef, type ReactNode } from 'react';

/** I colori dello stile Partenze, presi dai token: ambra, blu segnale, azzurro, carta, rosso e verde. */
const TOKEN_COLORI = ['--ambra', '--segnale', '--link', '--flap-testo', '--rosso', '--verde'];
/** Gli stessi valori, se i token non si leggono. */
const RISERVA = ['#ffb81c', '#2a64c8', '#8db4ff', '#f4f1e8', '#ef4b3f', '#2fbf71'];

function coloriDaiToken(): string[] {
  const stile = getComputedStyle(document.documentElement);
  return TOKEN_COLORI.map((t, i) => stile.getPropertyValue(t).trim() || RISERVA[i]!);
}
const PEZZI_PER_GETTO = 90;
const DURATA_MAX_MS = 7_000;

interface Pezzo {
  x: number;
  y: number;
  /** Spinta del getto (px per fotogramma): cala in fretta, poi resta la caduta. */
  spinta: number;
  direzione: number;
  /** Discesa costante (px per fotogramma), come la carta che plana. */
  caduta: number;
  larghezza: number;
  altezza: number;
  angolo: number;
  giro: number;
  /** Fase dell'ondeggiamento: il pezzo si gira mostrando il lato stretto. */
  fase: number;
  velocitaFase: number;
  colore: string;
}

function pocoMovimento(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

function getto(da: 'sinistra' | 'destra', w: number, h: number, colori: string[]): Pezzo[] {
  const verso = da === 'sinistra' ? 1 : -1;
  return Array.from({ length: PEZZI_PER_GETTO }, () => ({
    x: da === 'sinistra' ? -10 : w + 10,
    y: h * (0.72 + Math.random() * 0.18),
    // Verso l'alto e verso il centro, con un po' di dispersione.
    direzione: -Math.PI / 2 + verso * (0.2 + Math.random() * 0.5),
    spinta: h * (0.035 + Math.random() * 0.03),
    caduta: 2.2 + Math.random() * 1.6,
    larghezza: 7 + Math.random() * 6,
    altezza: 4 + Math.random() * 4,
    angolo: Math.random() * Math.PI * 2,
    giro: (Math.random() - 0.5) * 0.3,
    fase: Math.random() * Math.PI * 2,
    velocitaFase: 0.08 + Math.random() * 0.12,
    colore: colori[Math.floor(Math.random() * colori.length)]!,
  }));
}

export function Coriandoli({ onFine }: { onFine?: () => void }): ReactNode {
  const tela = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = tela.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || pocoMovimento()) {
      onFine?.();
      return;
    }
    const scala = window.devicePixelRatio || 1;
    let w = 0;
    let h = 0;
    const misura = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * scala);
      canvas.height = Math.round(h * scala);
      ctx.setTransform(scala, 0, 0, scala, 0, 0);
    };
    misura();
    window.addEventListener('resize', misura);

    const colori = coloriDaiToken();
    const pezzi = [...getto('sinistra', w, h, colori), ...getto('destra', w, h, colori)];
    const inizio = performance.now();
    let ultimo = inizio;
    let richiesta = 0;

    const disegna = (adesso: number) => {
      // Passi di 1/60 di secondo, anche se il browser rallenta.
      const passi = Math.min(4, (adesso - ultimo) / (1000 / 60));
      ultimo = adesso;
      ctx.clearRect(0, 0, w, h);
      let visibili = 0;
      for (const p of pezzi) {
        p.x += (Math.cos(p.direzione) * p.spinta + Math.sin(p.fase) * 0.8) * passi;
        p.y += (Math.sin(p.direzione) * p.spinta + p.caduta) * passi;
        p.spinta *= Math.pow(0.92, passi);
        p.angolo += p.giro * passi;
        p.fase += p.velocitaFase * passi;
        if (p.y > h + 20) continue;
        visibili++;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angolo);
        ctx.scale(1, Math.cos(p.fase));
        ctx.fillStyle = p.colore;
        ctx.fillRect(-p.larghezza / 2, -p.altezza / 2, p.larghezza, p.altezza);
        ctx.restore();
      }
      if (visibili > 0 && adesso - inizio < DURATA_MAX_MS) richiesta = requestAnimationFrame(disegna);
      else {
        ctx.clearRect(0, 0, w, h);
        onFine?.();
      }
    };
    richiesta = requestAnimationFrame(disegna);
    return () => {
      cancelAnimationFrame(richiesta);
      window.removeEventListener('resize', misura);
    };
    // onFine non deve far ripartire i coriandoli.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <canvas ref={tela} className="coriandoli" aria-hidden="true" />;
}
