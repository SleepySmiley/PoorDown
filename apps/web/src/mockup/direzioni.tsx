import { createRoot } from 'react-dom/client';
import { Pagina } from './PaginaDirezioni';

const radice = document.getElementById('app');
if (!radice) throw new Error('Manca l’elemento #app');
createRoot(radice).render(<Pagina />);
