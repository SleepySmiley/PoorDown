/*
 * Token del giocatore: un segreto casuale salvato nel browser. Il server lo usa per restituire il posto
 * a chi ricarica la pagina o perde la connessione. Niente account.
 * Si usa `crypto.getRandomValues`, che funziona anche su http://192.168.x.x (a differenza di `randomUUID`).
 */

const CHIAVE = 'poordown:token';

function nuovoToken(): string {
  const byte = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...byte)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Il token di questo browser, creato al primo uso.
 * @param profilo per le prove: un nome diverso dà un'identità diversa nello stesso browser.
 */
export function tokenDelBrowser(profilo = ''): string {
  const chiave = profilo ? `${CHIAVE}:${profilo}` : CHIAVE;
  try {
    const salvato = localStorage.getItem(chiave);
    if (salvato && /^[A-Za-z0-9_-]{16,128}$/.test(salvato)) return salvato;
    const token = nuovoToken();
    localStorage.setItem(chiave, token);
    return token;
  } catch {
    // Archivio del browser bloccato (es. navigazione privata molto restrittiva): vale solo per questa visita.
    return nuovoToken();
  }
}
