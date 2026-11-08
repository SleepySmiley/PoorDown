import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Pagina } from './Pagina';

const radice = document.getElementById('app');
if (!radice) throw new Error('Manca l’elemento #app');
createRoot(radice).render(
  <StrictMode>
    <Pagina />
  </StrictMode>,
);
