import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Galerie } from './Galerie';
import '../styles';

const root = document.getElementById('root');
if (!root) {
  throw new Error('Element #root fehlt in galerie.html');
}

createRoot(root).render(
  <StrictMode>
    <Galerie />
  </StrictMode>,
);
