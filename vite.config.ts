import { defineConfig } from 'vite';

// On GitHub Pages the site lives at https://<username>.github.io/petri-sim/,
// so the built files must point to /petri-sim/... instead of /...
// `npm run dev` keeps using http://localhost:5173/ as before.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/petri-sim/' : '/',
}));
