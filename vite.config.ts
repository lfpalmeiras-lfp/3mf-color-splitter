import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' gera caminhos relativos, então o mesmo build funciona em
// GitHub Pages (/nome-do-repo/), Cloudflare Pages (raiz) ou qualquer pasta.
export default defineConfig({
  base: './',
  plugins: [react()],
});
