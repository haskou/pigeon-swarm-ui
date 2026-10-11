import type { Plugin } from 'vite';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { contentSecurityPolicy } from './src/shared/infrastructure/security/contentSecurityPolicy';

function contentSecurityPolicyPlugin(): Plugin {
  return {
    apply: 'build',
    name: 'pigeon-content-security-policy',
    transformIndexHtml: () => [
      {
        attrs: {
          content: contentSecurityPolicy,
          'http-equiv': 'Content-Security-Policy',
        },
        injectTo: 'head-prepend',
        tag: 'meta',
      },
    ],
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  return {
    define: {
      PIGEON_INDEPENDENT_CLIENT: JSON.stringify(
        env.VITE_INDEPENDENT_CLIENT === 'true',
      ),
      __PIGEON_API_SERVER_URL__: JSON.stringify(
        env.VITE_API_SERVER_URL || 'http://localhost:8080/',
      ),
    },
    plugins: [react(), tailwindcss(), contentSecurityPolicyPlugin()],
    resolve: {
      dedupe: ['react', 'react-dom'],
    },
  };
});
