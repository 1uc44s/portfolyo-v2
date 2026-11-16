import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { AppProviders } from '@/app/AppProviders.jsx';
import { AppRoutes } from '@/app/routes.jsx';
import { SiteFavicon } from '@/app/SiteFavicon.jsx';
import '@/styles/globals.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppProviders>
      <SiteFavicon />
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppProviders>
  </StrictMode>,
);
