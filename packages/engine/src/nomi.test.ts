import { describe, expect, it } from 'vitest';
import { pulisciNome } from './nomi';

describe('pulisciNome e caratteri invisibili', () => {
  it('un nome fatto solo di caratteri che non si vedono diventa vuoto', () => {
    const invisibili = [
      '­', '͏', '؜', 'ᅟ', 'ᅠ', '឴', '឵', '᠎', '​', '‌', '‎',
      '‏', '⁠', '⁡', '⁢', '⁣', '⁤', '⠀', 'ㅤ', '﻿', 'ﾠ',
    ];
    for (const c of invisibili) expect(pulisciNome(`${c}${c} ${c}`), `U+${c.codePointAt(0)!.toString(16)}`).toBe('');
    expect(pulisciNome(invisibili.join(''))).toBe('');
  });

  it('dentro un nome vero i caratteri invisibili spariscono, le emoji composte restano intere', () => {
    expect(pulisciNome('An​naㅤ')).toBe('Anna');
    expect(pulisciNome('⠀ Bruno ⠀')).toBe('Bruno');
    // Famiglia: tre emoji unite dallo "zero width joiner".
    expect(pulisciNome('👩‍👧‍👦')).toBe('👩‍👧‍👦');
  });
});
