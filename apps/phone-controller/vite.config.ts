import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5174 },
  base: '/play/',
  resolve: {
    alias: { '@party-blast/shared': '../../packages/shared/src/index.ts' }
  }
});
