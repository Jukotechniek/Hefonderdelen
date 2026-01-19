
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Starting app

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

try {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  // App rendered successfully
} catch (error) {
  console.error('Error rendering app:', error);
  rootElement.innerHTML = `
    <div style="padding: 20px; font-family: sans-serif;">
      <h1>Error loading app</h1>
      <pre>${error}</pre>
      <p>Check the browser console for more details.</p>
    </div>
  `;
}
