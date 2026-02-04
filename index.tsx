
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const container = document.getElementById('root');

if (!container) {
  throw new Error("Target container 'root' not found in the DOM.");
}

const renderApp = () => {
  try {
    const root = createRoot(container);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (error) {
    console.error("Critical rendering error:", error);
    container.innerHTML = `
      <div style="padding: 40px; font-family: sans-serif; text-align: center;">
        <h2 style="color: #e11d48;">Terjadi Kesalahan Aplikasi</h2>
        <p style="color: #4b5563;">Gagal memuat sistem HerniPrint.</p>
        <button onclick="window.location.reload()" style="padding: 10px 20px; background: #2563eb; color: white; border: none; border-radius: 8px; cursor: pointer;">Muat Ulang</button>
      </div>
    `;
  }
};

renderApp();
