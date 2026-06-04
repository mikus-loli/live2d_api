import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";
import { traeBadgePlugin } from 'vite-plugin-trae-solo-badge';

// https://vite.dev/config/
export default defineConfig({
  base: '/frontend/',
  build: {
    sourcemap: 'hidden',
    outDir: '../dist/frontend',
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    proxy: {
      '/get': 'http://localhost:8080',
      '/add': 'http://localhost:8080',
      '/rand': 'http://localhost:8080',
      '/switch': 'http://localhost:8080',
      '/model': 'http://localhost:8080',
      '/model_list.json': 'http://localhost:8080',
      '/admin/api': 'http://localhost:8080',
    },
  },
  plugins: [
    react({
      babel: {
        plugins: [
          'react-dev-locator',
        ],
      },
    }),
    traeBadgePlugin({
      variant: 'dark',
      position: 'bottom-right',
      prodOnly: true,
      clickable: true,
      clickUrl: 'https://www.trae.ai/solo?showJoin=1',
      autoTheme: true,
      autoThemeTarget: '#root'
    }), 
    tsconfigPaths()
  ],
})
