import { defineConfig } from 'vite';
export default defineConfig({
  server: { port: 5173 },
  base: '/tv/',
  resolve: {
    alias: { '@party-blast/shared': '../../packages/shared/src/index.ts' }
  }
});
