import { defineConfig, loadEnv } from "vite";

/**
 * Dev (`npm run dev`): base is "/" (development mode; .env.production not applied).
 * Production build (`npm run build`): reads VITE_BASE from `.env.production`
 * (GitHub project page: /repo-name/).
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    base: env.VITE_BASE || process.env.VITE_BASE || "/",
  };
});
