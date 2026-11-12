import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ServerLocale, type AvvisiServer, type StatoServer } from './server';

const avvisi: AvvisiServer = { riga() {}, cambiato() {}, online() {}, problemaOnline() {}, spentoDaSolo() {} };

/** Un PoorDown finto acceso «altrove» (un'altra finestra di VS Code), su una porta libera qualunque. */
async function poorDownAltrove(): Promise<{ server: Server; porta: number }> {
  const server = createServer((_richiesta, risposta) => {
    risposta.setHeader('Content-Type', 'application/json');
    risposta.end(JSON.stringify({ nome: 'PoorDown', versione: '0.1.0', indirizzi: [], online: false, pubblico: null }));
  });
  await new Promise<void>((fatto) => server.listen(0, 'localhost', fatto));
  return { server, porta: (server.address() as AddressInfo).port };
}

function chiudi(server: Server): Promise<void> {
  return new Promise((fatto) => server.close(() => fatto()));
}

describe('ServerLocale con PoorDown acceso altrove', () => {
  let aperto: Server | null = null;
  afterEach(async () => {
    if (aperto?.listening) await chiudi(aperto);
    aperto = null;
  });

  it('usa quello acceso altrove e se ne accorge quando si spegne', async () => {
    const { server, porta } = await poorDownAltrove();
    aperto = server;
    // Il file del server non esiste: se provasse ad accenderlo, l'avvio fallirebbe.
    const locale = new ServerLocale(path.join(tmpdir(), 'poordown-manca', 'server.mjs'), tmpdir(), avvisi);
    expect(await locale.accendi(porta, false)).toEqual<StatoServer>({ tipo: 'altrove', porta });
    expect(await locale.verifica()).toEqual<StatoServer>({ tipo: 'altrove', porta });

    // L'altra finestra si chiude e spegne il gioco.
    await chiudi(server);
    expect(await locale.verifica()).toEqual<StatoServer>({ tipo: 'spento' });
  });

  it('riaccende il suo quando quello acceso altrove si è spento', async () => {
    const { server, porta } = await poorDownAltrove();
    aperto = server;
    const locale = new ServerLocale(path.join(tmpdir(), 'poordown-manca', 'server.mjs'), tmpdir(), avvisi);
    expect(await locale.accendi(porta, false)).toMatchObject({ tipo: 'altrove' });
    await chiudi(server);
    // Prima restava «altrove» per sempre; ora prova ad accendere il suo (qui fallisce perché il file non c'è).
    await expect(locale.accendi(porta, false)).rejects.toThrow('Il server non si è acceso');
    expect(locale.stato).toEqual<StatoServer>({ tipo: 'spento' });
  });
});
