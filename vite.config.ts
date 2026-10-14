import type { Plugin } from 'vite';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { contentSecurityPolicy } from './src/shared/infrastructure/security/contentSecurityPolicy';

function contentSecurityPolicyPlugin(apiServerUrl?: string): Plugin {
  return {
    apply: 'build',
    name: 'pigeon-content-security-policy',
    transformIndexHtml: () => [
      {
        attrs: {
          content: contentSecurityPolicy(apiServerUrl),
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
  const independentClient = env.VITE_INDEPENDENT_CLIENT === 'true';
  const apiServerUrl = env.VITE_API_SERVER_URL || 'http://localhost:8080/';

  return {
    define: {
      PIGEON_INDEPENDENT_CLIENT: JSON.stringify(independentClient),
      __PIGEON_API_SERVER_URL__: JSON.stringify(apiServerUrl),
      __PIGEON_MAILBOX_AVAILABILITY_SERVERS__: JSON.stringify(
        env.VITE_MAILBOX_AVAILABILITY_SERVERS ?? '',
      ),
    },
    plugins: [
      react(),
      tailwindcss(),
      // The independent client picks its node at runtime and loads every
      // image as a blob, so it never needs a remote image origin.
      contentSecurityPolicyPlugin(independentClient ? undefined : apiServerUrl),
    ],
    resolve: {
      dedupe: ['react', 'react-dom'],
    },
  };
});
