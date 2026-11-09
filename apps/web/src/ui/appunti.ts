/**
 * Copia negli appunti. Su http://192.168.x.x il browser non dà l'API degli appunti:
 * si seleziona il testo del campo e si usa il vecchio comando di copia.
 */
export async function copia(testo: string, campo: HTMLInputElement | null): Promise<boolean> {
  try {
    if (window.isSecureContext && navigator.clipboard) {
      await navigator.clipboard.writeText(testo);
      return true;
    }
  } catch {
    // si prova con il metodo alternativo
  }
  if (!campo) return false;
  campo.focus();
  campo.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  }
}
