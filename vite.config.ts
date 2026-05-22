import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { visualizer } from 'rollup-plugin-visualizer';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    // Use environment variables for host and port, falling back to secure defaults
    host: process.env.VITE_HOST || '0.0.0.0',
    port: process.env.VITE_PORT ? parseInt(process.env.VITE_PORT, 10) : 8080,
    strictPort: false,
  },
  plugins: [
    react(),
    mode === 'development' && componentTagger(),
    mode === 'production' && visualizer({
      filename: './dist/stats.html',
      open: false,
      gzipSize: true,
      brotliSize: true,
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-select'],
          router: ['react-router-dom'],
          utils: ['date-fns', 'clsx', 'tailwind-merge'],
          charts: ['recharts'],
          icons: ['lucide-react'],
          forms: ['react-hook-form', '@hookform/resolvers'],
          monitoring: ['web-vitals']
        }
      }
    },
    chunkSizeWarningLimit: 1000,
    // Enable source maps for better debugging
    sourcemap: true,
    // Optimize bundle size only in production
    minify: mode === 'production' ? 'terser' : false
  },
  esbuild: {
    // Automatically drop all console.log and debugger statements in production
    drop: mode === 'production' ? ['console', 'debugger'] : [],
  }
}));
