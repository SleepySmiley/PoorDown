import { afterEach, describe, expect, it, vi } from 'vitest';

/*
 * Il volume si legge all'avvio della pagina: se l'archivio del browser è bloccato (il gioco in una cornice di un
 * altro sito, per esempio il riquadro di VS Code) la pagina deve aprirsi lo stesso, con il volume predefinito.
 */

const originale = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

function archivio(descrittore: PropertyDescriptor): void {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, ...descrittore });
}

afterEach(() => {
  if (originale) Object.defineProperty(globalThis, 'localStorage', originale);
  else delete (globalThis as { localStorage?: unknown }).localStorage;
  vi.resetModules();
});

describe('volume', () => {
  it('si apre con il predefinito se già leggere localStorage lancia un errore', async () => {
    archivio({
      get() {
        throw new Error('SecurityError: Access is denied for this document.');
      },
    });
    vi.resetModules();
    const { volume } = await import('./livello');
    expect(volume.leggi()).toBe(70);
    // Cambiarlo funziona lo stesso: vale per questa visita.
    volume.imposta(30);
    expect(volume.leggi()).toBe(30);
  });

  it('legge il volume salvato', async () => {
    archivio({ value: { getItem: () => '42', setItem: () => undefined } });
    vi.resetModules();
    const { volume } = await import('./livello');
    expect(volume.leggi()).toBe(42);
  });
});
