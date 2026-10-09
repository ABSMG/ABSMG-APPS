import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  const disableHmr = process.env.DISABLE_HMR === 'true';

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],

    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },

      // Reuse dependency instances where possible.
      dedupe: [
        'react',
        'react-dom',
      ],
    },

    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR.
      // File watching is disabled to prevent flickering during agent edits.
      hmr: !disableHmr,

      // Preserve the existing DISABLE_HMR behavior.
      watch: disableHmr ? null : {},
    },

    build: {
      // Generate optimized production assets.
      target: 'es2020',

      // Compress generated assets.
      minify: 'esbuild',

      // Generate compressed-size reports during builds.
      reportCompressedSize: true,

      // Warn about unusually large chunks without failing the build.
      chunkSizeWarningLimit: 700,

      // Keep source maps available for debugging production issues.
      sourcemap: true,

      rollupOptions: {
        output: {
          // Separate major libraries from application code.
          // This can improve browser caching between deployments.
          manualChunks(id) {
            if (!id.includes('node_modules')) {
              return undefined;
            }

            if (
              id.includes('/node_modules/react/') ||
              id.includes('/node_modules/react-dom/') ||
              id.includes('/node_modules/scheduler/')
            ) {
              return 'react-vendor';
            }

            if (id.includes('/node_modules/lucide-react/')) {
              return 'icons-vendor';
            }

            if (
              id.includes('/node_modules/motion/') ||
              id.includes('/node_modules/framer-motion/')
            ) {
              return 'motion-vendor';
            }

            if (id.includes('/node_modules/@supabase/')) {
              return 'supabase-vendor';
            }

            return undefined;
          },
        },
      },
    },
  };
});
