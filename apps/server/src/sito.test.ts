import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { collegaSito } from './sito';

const PAGINA = '<!doctype html><title>PoorDown</title>';

describe('collegaSito (versione compilata)', () => {
  let radice: string;
  let server: Server;
  let indirizzo: string;
  const sitoPrima = process.env.POORDOWN_SITO;

  beforeAll(async () => {
    // Come l'estensione installata: C:\Users\…\.vscode\extensions\…\dist\web. Una cartella col punto
    // nel percorso faceva rispondere 404 a res.sendFile per ogni pagina che non è un file.
    radice = mkdtempSync(path.join(tmpdir(), 'poordown-sito-'));
    const sito = path.join(radice, '.vscode', 'extensions', 'poordown.poordown-0.1.1', 'dist', 'web');
    mkdirSync(path.join(sito, 'assets'), { recursive: true });
    writeFileSync(path.join(sito, 'index.html'), PAGINA);
    writeFileSync(path.join(sito, 'favicon.svg'), '<svg/>');
    writeFileSync(path.join(sito, 'assets', 'app-abc123.js'), 'console.log(1)');
    writeFileSync(path.join(sito, '.segreto'), 'non si vede');
    process.env.POORDOWN_SITO = sito;

    const app = express();
    server = createServer(app);
    await collegaSito(app, server, false);
    app.use((_req, res) => {
      res.status(404).send('fuori dal sito');
    });
    await new Promise<void>((fatto) => server.listen(0, '127.0.0.1', fatto));
    indirizzo = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise((fatto) => server.close(fatto));
    rmSync(radice, { recursive: true, force: true });
    if (sitoPrima === undefined) delete process.env.POORDOWN_SITO;
    else process.env.POORDOWN_SITO = sitoPrima;
  });

  it('apre la pagina principale anche da una cartella col punto nel percorso', async () => {
    const risposta = await fetch(`${indirizzo}/`);
    expect(risposta.status).toBe(200);
    expect(risposta.headers.get('cache-control')).toBe('no-cache');
    expect(await risposta.text()).toBe(PAGINA);
  });

  it('apre l’app per ogni indirizzo che non è un file', async () => {
    const risposta = await fetch(`${indirizzo}/stanza/abcde`);
    expect(risposta.status).toBe(200);
    expect(await risposta.text()).toBe(PAGINA);
  });

  it('risponde anche a HEAD', async () => {
    const risposta = await fetch(`${indirizzo}/stanza/abcde`, { method: 'HEAD' });
    expect(risposta.status).toBe(200);
  });

  it('serve i file del sito, con la cache lunga per /assets', async () => {
    const favicon = await fetch(`${indirizzo}/favicon.svg`);
    expect(favicon.status).toBe(200);
    expect(await favicon.text()).toBe('<svg/>');

    const script = await fetch(`${indirizzo}/assets/app-abc123.js`);
    expect(script.status).toBe(200);
    expect(script.headers.get('cache-control')).toContain('immutable');
  });

  it('risponde 404 a un file di /assets che non c’è, senza mandare la pagina', async () => {
    const risposta = await fetch(`${indirizzo}/assets/app-vecchio.js`);
    expect(risposta.status).toBe(404);
    expect(await risposta.text()).not.toContain('<!doctype html>');
  });

  it('non mostra i file nascosti della cartella del sito', async () => {
    const risposta = await fetch(`${indirizzo}/.segreto`);
    expect(await risposta.text()).not.toContain('non si vede');
  });

  it('lascia passare /api e i metodi diversi da GET', async () => {
    const api = await fetch(`${indirizzo}/api/niente`);
    expect(api.status).toBe(404);
    expect(await api.text()).toBe('fuori dal sito');

    const post = await fetch(`${indirizzo}/stanza/abcde`, { method: 'POST' });
    expect(post.status).toBe(404);
    expect(await post.text()).toBe('fuori dal sito');
  });
});
