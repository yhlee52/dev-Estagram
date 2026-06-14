import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// The backend ingestion paths churn files while the dev server runs:
// directory-batch processing (process_incoming, v0.3.2) moves packages around
// under data/external_posts/{incoming,archive,failed}, and managed asset
// storage (v0.3.3) copies asset files into public/assets/managed/. Both live
// inside the Vite root, so the dev server's file watcher would otherwise react
// to that churn — on Windows the rename/copy races can surface watcher errors
// that take the dev server down, and even when they don't, every imported asset
// triggers a needless full reload. These are runtime data dirs, never source,
// so we exclude them from the watcher. Files under public/ are still served
// regardless of being watched. (Vite merges this with its built-in ignores.)
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    watch: {
      ignored: ["**/public/assets/managed/**", "**/data/external_posts/**"],
    },
  },
});