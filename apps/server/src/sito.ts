import { existsSync } from 'node:fs';
import type { Server as ServerHttp } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type Express } from 'express';

const cartellaWeb = fileURLToPath(new URL('../../web/', import.meta.url));

/**
 * Collega il sito al server.
 * - Sviluppo: Vite gira dentro questo processo, sulla stessa porta, con aggiornamento istantaneo.
 * - Normale: serve la versione compilata in apps/web/dist.
 */
export async function collegaSito(app: Express, server: ServerHttp, sviluppo: boolean): Promise<void> {
  if (sviluppo) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      root: cartellaWeb,
      appType: 'spa',
      // Legge vite.config.ts con l'import normale (qui ci pensa tsx). Il caricatore predefinito
      // scrive un file temporaneo in node_modules/.vite-temp e lo cancella subito: tsx watch vede
      // sparire un file importato e riavvia il server, che lo riscrive, all'infinito.
      configLoader: 'native',
      server: { middlewareMode: true, hmr: { server } },
    });
    app.use(vite.middlewares);
    return;
  }

  const cartellaBuild = path.join(cartellaWeb, 'dist');
  const paginaPrincipale = path.join(cartellaBuild, 'index.html');
  if (!existsSync(paginaPrincipale)) {
    throw new Error('Manca la versione compilata del sito: avvia con "npm start" oppure esegui prima "npm run build".');
  }

  // I file in /assets hanno l'impronta nel nome: il browser può tenerli in cache per sempre.
  app.use('/assets', express.static(path.join(cartellaBuild, 'assets'), { immutable: true, maxAge: '1y' }));
  app.use(express.static(cartellaBuild, { index: false }));
  // Ogni altro indirizzo (es. /stanza/abcde) apre l'app, che decide cosa mostrare.
  app.use((req, res, next) => {
    if ((req.method !== 'GET' && req.method !== 'HEAD') || req.path.startsWith('/api/')) {
      next();
      return;
    }
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(paginaPrincipale);
  });
}
