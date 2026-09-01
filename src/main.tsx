import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { FeedbackProvider } from './context/FeedbackContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import './index.css';
import 'leaflet/dist/leaflet.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <FeedbackProvider>
        <App />
      </FeedbackProvider>
    </ErrorBoundary>
  </StrictMode>,
);
