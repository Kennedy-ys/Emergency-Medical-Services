import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import 'leaflet/dist/leaflet.css';
import './styles/index.css';
import { registerSW } from 'virtual:pwa-register';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import SessionProvider from './app/SessionProvider';
// Imported for its effect: catches the browser's install offer as early as possible.
import './lib/installPrompt';

// auto-register and update
registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <App />
      </SessionProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
