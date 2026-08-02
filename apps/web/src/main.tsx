import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';

import { WorkspaceApp as App } from './WorkspaceApp';
import { AuthGate } from './auth';
import './styles.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('The web application root element is missing.');
}

createRoot(rootElement).render(
  <StrictMode>
    <AuthGate>
      <App />
    </AuthGate>
  </StrictMode>,
);
