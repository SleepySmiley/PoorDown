import { networkInterfaces } from 'node:os';

export interface IndirizzoRete {
  /** Nome della scheda di rete, es. "Wi-Fi". */
  scheda: string;
  ip: string;
}

type SchedeDiRete = ReturnType<typeof networkInterfaces>;

/** Schede create da macchine virtuali e simili: gli amici non le raggiungono. */
const SCHEDE_VIRTUALI = /vethernet|virtualbox|vbox|vmware|hyper-v|wsl|docker/i;
/** Schede che di solito portano alla rete di casa. */
const SCHEDE_DI_CASA = /wi-?fi|wlan|wireless|ethernet|^eth|^en\d|\blan\b/i;

function ipPrivato(ip: string): boolean {
  const [a = 0, b = 0] = ip.split('.').map(Number);
  return a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
}

/**
 * Sceglie gli indirizzi IPv4 a cui gli amici possono collegarsi, il più probabile per primo.
 * Le schede virtuali compaiono solo se non c'è nient'altro.
 */
export function scegliIndirizzi(schede: SchedeDiRete): IndirizzoRete[] {
  const trovati: (IndirizzoRete & { punteggio: number })[] = [];
  for (const [scheda, voci] of Object.entries(schede)) {
    for (const voce of voci ?? []) {
      if (voce.family !== 'IPv4' || voce.internal || voce.address.startsWith('169.254.')) continue;
      const punteggio = (SCHEDE_DI_CASA.test(scheda) ? 2 : 0) + (ipPrivato(voce.address) ? 1 : 0);
      trovati.push({ scheda, ip: voce.address, punteggio });
    }
  }
  const reali = trovati.filter((t) => !SCHEDE_VIRTUALI.test(t.scheda));
  return (reali.length > 0 ? reali : trovati)
    .sort((a, b) => b.punteggio - a.punteggio)
    .map(({ scheda, ip }) => ({ scheda, ip }));
}

export function indirizziRete(): IndirizzoRete[] {
  return scegliIndirizzi(networkInterfaces());
}
