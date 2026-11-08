import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Pagina } from './Pagina';
import './stile.css';

const radice = document.getElementById('app');
if (!radice) throw new Error('Manca l’elemento #app in index.html');

createRoot(radice).render(
  <StrictMode>
    <Pagina />
  </StrictMode>,
);
