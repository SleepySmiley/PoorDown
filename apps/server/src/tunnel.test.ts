import { describe, expect, it } from 'vitest';
import { fileDaScaricare, indirizzoTunnel, motivoGuasto, tunnelCollegato } from './tunnel';

describe('indirizzoTunnel', () => {
  it('trova il link nel riquadro che stampa cloudflared', () => {
    const riga = '2026-11-09T19:15:34Z INF |  https://onion-print-sleeping-bills.trycloudflare.com                                      |';
    expect(indirizzoTunnel(riga)).toBe('https://onion-print-sleeping-bills.trycloudflare.com');
  });

  it('non scambia per il link l’indirizzo delle API negli errori', () => {
    const riga =
      '2026-11-09T19:15:34Z ERR Error requesting new quick tunnel error="Post \\"https://api.trycloudflare.com/tunnel\\": dial tcp: lookup api.trycloudflare.com: no such host"';
    expect(indirizzoTunnel(riga)).toBeNull();
  });

  it('ignora le righe senza link', () => {
    expect(indirizzoTunnel('2026-11-09T19:15:28Z INF Requesting new quick Tunnel on trycloudflare.com...')).toBeNull();
  });
});

describe('tunnelCollegato', () => {
  it('riconosce il collegamento riuscito', () => {
    expect(tunnelCollegato('2026-11-09T19:15:34Z INF Registered tunnel connection connIndex=0 location=fra21 protocol=quic')).toBe(true);
    expect(tunnelCollegato('2026-11-09T19:15:34Z INF Starting metrics server on 127.0.0.1:20243/metrics')).toBe(false);
  });
});

describe('fileDaScaricare', () => {
  it('sceglie il file giusto per ogni sistema', () => {
    expect(fileDaScaricare('win32', 'x64')).toBe('cloudflared-windows-amd64.exe');
    expect(fileDaScaricare('win32', 'arm64')).toBe('cloudflared-windows-amd64.exe');
    expect(fileDaScaricare('linux', 'arm64')).toBe('cloudflared-linux-arm64');
    expect(fileDaScaricare('darwin', 'arm64')).toBe('cloudflared-darwin-arm64.tgz');
  });

  it('non inventa file per i sistemi che Cloudflare non pubblica', () => {
    expect(fileDaScaricare('freebsd', 'x64')).toBeNull();
    expect(fileDaScaricare('linux', 'riscv64')).toBeNull();
  });
});

describe('motivoGuasto', () => {
  it('spiega con parole semplici la mancanza di internet', () => {
    const righe = [
      '2026-11-09T19:15:28Z INF Requesting new quick Tunnel on trycloudflare.com...',
      '2026-11-09T19:15:29Z ERR Error requesting new quick tunnel error="Post \\"https://api.trycloudflare.com/tunnel\\": dial tcp: lookup api.trycloudflare.com: no such host"',
      '2026-11-09T19:15:29Z FTL failed to request quick Tunnel: dial tcp: lookup api.trycloudflare.com: no such host',
    ];
    expect(motivoGuasto(righe)).toBe('Cloudflare non ha dato un indirizzo: forse manca internet');
  });

  it('riconosce le troppe richieste', () => {
    expect(motivoGuasto(['2026-11-09T19:15:29Z ERR Error unmarshaling QuickTunnel response: 429 Too Many Requests'])).toBe(
      'Cloudflare ha ricevuto troppe richieste, riprovo tra poco',
    );
  });

  it('per gli altri errori riporta il messaggio senza data e livello', () => {
    expect(motivoGuasto(['2026-11-09T19:15:29Z ERR qualcosa di strano'])).toBe('qualcosa di strano');
  });

  it('senza errori scritti resta generico', () => {
    expect(motivoGuasto(['2026-11-09T19:15:28Z INF Thank you for trying Cloudflare Tunnel.'])).toBe('il tunnel non è partito');
  });
});
