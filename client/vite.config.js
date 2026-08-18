import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Ziel-Port muss zu server/config/index.js passen (Default 3001).
    // Abweichender Wert nur, wenn PORT in server/.env gesetzt ist.
    proxy: {
      '/api': 'http://localhost:3001',
      '/media': 'http://localhost:3001',
      '/sync_folders': 'http://localhost:3001',
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
      },
      '/newsocket.io': {
        target: 'http://localhost:3001',
        ws: true,
      },
      '/wssocket.io': {
        target: 'http://localhost:3001',
        ws: true,
      },
    },
  },
});
