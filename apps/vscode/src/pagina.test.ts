import { describe, expect, it } from 'vitest';
import { leggiMessaggio, paginaGioco, paginaMessaggio, toccaATe } from './pagina';

describe('messaggi del gioco', () => {
  it('accetta il titolo, ripulito e accorciato', () => {
    expect(leggiMessaggio({ poordown: 'titolo', titolo: '● Tocca a te — PoorDown' })).toEqual({ poordown: 'titolo', titolo: '● Tocca a te — PoorDown' });
    expect(leggiMessaggio({ poordown: 'titolo', titolo: ' a\u0000b\n ' })).toEqual({ poordown: 'titolo', titolo: 'a b' });
    expect(leggiMessaggio({ poordown: 'titolo', titolo: 'x'.repeat(500) })).toMatchObject({ titolo: 'x'.repeat(120) });
  });

  it('copia solo link http(s)', () => {
    expect(leggiMessaggio({ poordown: 'copia', testo: 'https://a-b.trycloudflare.com/stanza/abcde' })).toEqual({
      poordown: 'copia',
      testo: 'https://a-b.trycloudflare.com/stanza/abcde',
    });
    expect(leggiMessaggio({ poordown: 'copia', testo: 'rm -rf /' })).toBeNull();
    expect(leggiMessaggio({ poordown: 'copia', testo: 'https://a.it/ x' })).toBeNull();
    expect(leggiMessaggio({ poordown: 'copia', testo: `https://a.it/${'x'.repeat(600)}` })).toBeNull();
  });

  it('scarta il resto', () => {
    expect(leggiMessaggio(null)).toBeNull();
    expect(leggiMessaggio('titolo')).toBeNull();
    expect(leggiMessaggio({ poordown: 'apri', indirizzo: 'https://a.it' })).toBeNull();
    expect(leggiMessaggio({ poordown: 'titolo', titolo: 3 })).toBeNull();
  });

  it('riconosce «Tocca a te»', () => {
    expect(toccaATe('● Tocca a te — PoorDown')).toBe(true);
    expect(toccaATe('(2) PoorDown')).toBe(false);
  });
});

describe('pagine della webview', () => {
  it('mette il gioco in una cornice permessa solo per la sua origine', () => {
    const html = paginaGioco('http://localhost:3000/stanza/abcde', 'http://localhost:3000', 'NONCE');
    expect(html).toContain("frame-src http://localhost:3000;");
    expect(html).toContain("script-src 'nonce-NONCE'");
    expect(html).toContain('src="http://localhost:3000/stanza/abcde"');
    expect(html).toContain('const origine = "http://localhost:3000";');
  });

  it('non si lascia rompere da un indirizzo strano', () => {
    const html = paginaGioco('https://a.it/"><script>x</script>', 'https://a.it', 'N');
    expect(html).not.toContain('"><script>x');
    expect(html).toContain('src="https://a.it/&quot;&gt;&lt;script&gt;x&lt;/script&gt;"');
  });

  it('scrive i messaggi come testo', () => {
    const html = paginaMessaggio('Accendo <PoorDown> & co.', 'N');
    expect(html).toContain('<p>Accendo &lt;PoorDown&gt; &amp; co.</p>');
    expect(html).not.toContain('<script');
  });
});
