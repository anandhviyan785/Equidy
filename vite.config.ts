import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import path from "node:path";

export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === "single" ? [viteSingleFile()] : [])],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:8787" },
  },
  build: {
    outDir: mode === "single" ? "dist-single" : "dist",
    rollupOptions:
      mode === "single"
        ? undefined
        : { output: { manualChunks: { react: ["react", "react-dom", "react-router-dom"], charts: ["recharts"], markdown: ["react-markdown", "remark-gfm"] } } },
  },
}));
