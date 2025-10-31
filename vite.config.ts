import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.VITE_PORT) || 5000,
    host: true, // erlaubt Zugriff über 0.0.0.0 (alle Interfaces)
    strictPort: true, // falls Port belegt, brich ab statt anderen zu wählen
    open: false,
  },
  test: {
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts',
    globals: true
  }
});
