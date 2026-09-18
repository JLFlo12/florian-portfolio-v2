import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { inject } from '@vercel/analytics';

createRoot(document.getElementById("root")!).render(<App />);

// Statistiques de visite Vercel (sans cookies) : comptées une fois Web Analytics activé sur le projet
if (import.meta.env.PROD) inject();
