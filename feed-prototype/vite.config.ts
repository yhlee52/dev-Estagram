import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// The backend ingestion paths churn files while the dev server runs:
// directory-batch processing (process_incoming, v0.3.2) moves packages around
// under data/external_posts/{incoming,archive,failed}, managed asset storage
// (v0.3.3) copies asset files into public/assets/managed/, and the generated
// assets that packages reference by /assets/generated/... url are dropped into
// public/assets/generated/ one by one during testing. All live inside the Vite
// root, so the dev server's file watcher would otherwise react to that churn —
// on Windows the rename/copy races can surface watcher errors (EBUSY: a file is
// still locked while being copied when fs.watch attaches) that take the dev
// server down, and even when they don't, every imported asset triggers a
// needless full reload. public/assets/** is all runtime data, never source, so
// we exclude the whole tree from the watcher (public/ files full-reload at best,
// never hot-update). Files under public/ are still served regardless of being
// watched. (Vite merges this with its built-in ignores.)
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    watch: {
      ignored: ["**/public/assets/**", "**/data/external_posts/**"],
    },
  },
});