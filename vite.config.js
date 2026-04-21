import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { crx } from '@crxjs/vite-plugin';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const manifest = require('./manifest.json');

export default defineConfig({
  plugins: [preact(), crx({ manifest })],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
