import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/geist';
import './styles/tokens.css';
import './styles/app.css';
import brand from './_shared/brand.json';
import { App } from './App';

document.title = `${brand.name} – könyvelői felület`;

async function start() {
  // The in-browser demo API exists only in `--mode mock` builds (screenshots, design review).
  // In a normal build this branch is removed at compile time, together with the mock data.
  if (import.meta.env.VITE_MOCK_API === '1') {
    const { installMock } = await import('./mock/server');
    installMock();
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
void start();
