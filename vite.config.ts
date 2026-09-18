import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Bibliothèques stables dans des fichiers à part : après une mise à jour du site,
        // les visiteurs gardent ces fichiers en cache au lieu de tout retélécharger.
        // Tout ce qui utilise React à son chargement (react-i18next…) reste avec React.
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom|@remix-run|react-i18next)[\\/]/.test(id)) return "vendor-react";
          if (/[\\/]node_modules[\\/](gsap|lenis)[\\/]/.test(id)) return "vendor-motion";
          if (/[\\/]node_modules[\\/](i18next)[\\/]/.test(id)) return "vendor-i18n";
        },
      },
    },
  },
}));
