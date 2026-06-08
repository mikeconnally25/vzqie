import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  root: 'web',
  publicDir: 'public',
  resolve: {
    alias: {
      '@slot': path.resolve(__dirname, 'src/slot'),
    },
  },
  build: {
    outDir: '../dist-web',
    emptyOutDir: true,
  },
});
