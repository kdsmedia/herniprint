
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');

if (!rootElement) {
  console.error("Critical: Root element not found");
} else {
  try {
    const root = createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (err) {
    console.error("Failed to render app:", err);
    rootElement.innerHTML = `<div style="padding: 20px; color: red; font-family: sans-serif;">
      <h2>Application Error</h2>
      <p>${err instanceof Error ? err.message : 'Unknown error'}</p>
      <button onclick="location.reload()">Reload App</button>
    </div>`;
  }
}
