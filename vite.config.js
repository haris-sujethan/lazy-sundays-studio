import { defineConfig } from "vite";

/**
 * Local dev: base defaults to "/".
 * Production on GitHub Pages: workflow sets VITE_BASE to /repo-name/.
 * Manual: VITE_BASE=/lazy-sundays-studio/ npm run build && npx gh-pages -d dist
 */
export default defineConfig({
  base: process.env.VITE_BASE ?? "/",
});
