// I token del sistema grafico vanno prima di tutti gli altri stili.
import './stili/token.css';
import '@fontsource/barlow-condensed/500.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import './stili/partenze.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { collegaVSCode } from './vscode';

collegaVSCode();

const radice = document.getElementById('app');
if (!radice) throw new Error('Manca l’elemento #app in index.html');

createRoot(radice).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
