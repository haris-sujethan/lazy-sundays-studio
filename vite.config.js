import { defineConfig } from "vite";

/**
 * Local dev: base defaults to "/".
 * GitHub Pages (project site): set VITE_BASE to "/your-repo-name/" in CI
 * (see .github/workflows/deploy-pages.yml). User/org site username.github.io uses "/".
 */
export default defineConfig({
  base: process.env.VITE_BASE ?? "/",
});
