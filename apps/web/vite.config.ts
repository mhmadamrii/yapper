import tailwindcss from '@tailwindcss/vite';
import viteReact from '@vitejs/plugin-react';

import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import { nitro } from 'nitro/vite';
import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  server: {
    port: 3001,
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [tailwindcss(), tanstackStart(), nitro(), viteReact()],
  // Bundle all SSR deps on build only: Vercel functions have no node_modules
  // at runtime, but in dev noExternal makes the module runner evaluate CJS
  // deps (e.g. react) as ESM and crash with "module is not defined"
  ssr: command === 'build' ? { noExternal: true } : undefined,
}));
