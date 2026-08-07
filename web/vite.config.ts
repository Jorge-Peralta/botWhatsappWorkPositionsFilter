import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const dirname = path.dirname(fileURLToPath(import.meta.url));
// Mirrors src/config.ts's DASHBOARD_PORT so the proxy target stays correct if it's overridden.
const API_ORIGIN = `http://localhost:${Number(process.env.DASHBOARD_PORT) || 3001}`;

export default defineConfig({
  root: dirname,
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': API_ORIGIN,
      '/images': API_ORIGIN,
    },
  },
});
