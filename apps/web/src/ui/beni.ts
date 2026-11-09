/*
 * Cosa succede ai beni di chi esce dalla partita, detto con le parole del gioco.
 * Senza squadre tornano alla banca. A squadre li raccoglie un compagno (come nel motore, vedi `elimina`):
 * tutti, se chi esce non è in rosso; altrimenti solo il contante che avanza dopo i debiti (anche quelli verso la banca).
 */

import { preposizioneA, type EventoStanza, type Giocatore, type Stato, type VoceRegistro } from '@poordown/engine';

/**
 * A squadre, il compagno che raccoglie i beni di `g` se esce: il primo della sua squadra ancora in gioco
 * dopo di lui nell'ordine dei turni (come nel motore).
 */
export function erede(partita: Stato, g: Giocatore): Giocatore | undefined {
  if (g.squadra === null) return undefined;
  const i = partita.giocatori.findIndex((x) => x.id === g.id);
  const ordine = [...partita.giocatori.slice(i + 1), ...partita.giocatori.slice(0, i)];
  return ordine.find((x) => !x.eliminato && x.squadra === g.squadra);
}

/** Cosa succede ai beni di `g` se esce dalla partita, detto a lui (`tu`) o agli altri. */
export function destinoDeiBeni(partita: Stato, g: Giocatore, tu: boolean): string {
  const compagno = erede(partita, g);
  const suoi = tu ? 'le tue' : 'le sue';
  if (!compagno) return `${tu ? 'Le tue' : 'Le sue'} proprietà tornano alla banca.`;
  if (g.saldo >= 0) return `Contanti, proprietà e Carte Grazia passano ${preposizioneA(compagno.nome)}, ${tu ? 'tuo' : 'suo'} compagno di squadra.`;
  return `I beni pagano i debiti (anche verso la banca), quello che avanza va in contanti ${preposizioneA(compagno.nome)} e ${suoi} proprietà tornano alla banca.`;
}

type Uscita = Extract<EventoStanza, { tipo: 'rimozione' | 'bancarotta' }>;
type Eredita = Extract<EventoStanza, { tipo: 'eredita' }>;

/**
 * Cosa è successo ai miei beni quando sono uscito dalla partita (`g` sono io, già fuori).
 * Lo dice il registro: l'uscita ha `erede` se il compagno ha preso tutto, `eredita` c'è anche quando ha preso
 * solo il contante avanzato. Se il registro non arriva più così indietro, si deduce dalla partita di adesso.
 */
export function destinoDeiMieiBeni(partita: Stato, g: Giocatore, registro: readonly VoceRegistro[]): string {
  const nome = (id: string) => partita.giocatori.find((x) => x.id === id)?.nome ?? 'un compagno';
  const uscita = registro.findLast(
    (v): v is VoceRegistro & { evento: Uscita } =>
      (v.evento.tipo === 'rimozione' || v.evento.tipo === 'bancarotta') && v.evento.giocatore === g.id,
  )?.evento;
  const eredita = registro.findLast(
    (v): v is VoceRegistro & { evento: Eredita } => v.evento.tipo === 'eredita' && v.evento.da === g.id,
  )?.evento;

  if (uscita?.erede) return `Contanti, proprietà e Carte Grazia sono passati ${preposizioneA(nome(uscita.erede))}, tuo compagno di squadra.`;
  if (eredita) {
    const resto = eredita.soldi > 0 ? `, quello che avanzava è andato in contanti ${preposizioneA(nome(eredita.a))}` : '';
    return `I tuoi beni hanno pagato i debiti${resto} e le tue proprietà sono tornate alla banca.`;
  }
  if (uscita) return 'Le tue proprietà sono tornate alla banca.';
  const compagno = erede(partita, g);
  return compagno
    ? `Le tue proprietà sono passate ${preposizioneA(compagno.nome)}, tuo compagno di squadra.`
    : 'Le tue proprietà sono tornate alla banca.';
}
