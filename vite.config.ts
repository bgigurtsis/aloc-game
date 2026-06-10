import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  // relative base so the build deploys to any static host path
  base: "./",
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        lab: resolve(__dirname, "lab.html")
      }
    }
  }
});
