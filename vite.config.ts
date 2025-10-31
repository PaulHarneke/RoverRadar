import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import fs from 'fs';
import path from 'path';

function loadHttpsConfig() {
  // Nutzung über Umgebungsvariablen: VITE_HTTPS=1, VITE_SSL_KEY, VITE_SSL_CERT
  if (process.env.VITE_HTTPS !== '1') {
    return undefined;
  }
  const keyPath = process.env.VITE_SSL_KEY || path.resolve('cert', 'dev.key');
  const certPath = process.env.VITE_SSL_CERT || path.resolve('cert', 'dev.crt');
  try {
    const key = fs.readFileSync(keyPath);
    const cert = fs.readFileSync(certPath);
    return { key, cert };
  } catch (err) {
    console.warn('[vite] HTTPS aktiviert aber Zertifikatsdateien fehlen:', err);
    return undefined;
  }
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.VITE_PORT) || 5000,
    host: true, // erlaubt Zugriff über 0.0.0.0 (alle Interfaces)
    strictPort: true, // falls Port belegt, brich ab statt anderen zu wählen
    open: false,
    https: loadHttpsConfig(),
  },
  test: {
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts',
    globals: true
  }
});
