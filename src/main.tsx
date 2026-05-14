import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './styles/globals.css';
import './styles/rtl.css';

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Could not find #root in index.html');
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>
);
