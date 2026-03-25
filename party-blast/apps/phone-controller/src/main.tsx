import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// Prevent zoom on double-tap
document.addEventListener('touchmove', (e) => {
  if ((e as TouchEvent).touches.length > 1) e.preventDefault();
}, { passive: false });

// Prevent context menu on long press
document.addEventListener('contextmenu', (e) => e.preventDefault());

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
