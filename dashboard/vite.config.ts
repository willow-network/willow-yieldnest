import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const alchemyKey = env.ALCHEMY_ETH_KEY;
  if (!alchemyKey) {
    // Soft warn — the /eth-rpc proxy just won't work without it.
    console.warn('[vite] ALCHEMY_ETH_KEY not set. Copy .env.example → .env.local.');
  }

  return {
    plugins: [react()],
    resolve: {
      alias: {
        // The vendored @willow/sdk imports node's `crypto` (createHash) for
        // server-side consensus anchoring; the browser proof verifier doesn't
        // use it. Point it at a shim so the bundle resolves.
        crypto: fileURLToPath(new URL('./src/lib/crypto-shim.ts', import.meta.url)),
      },
    },
    server: {
      port: 5273,
      strictPort: true,
      host: '127.0.0.1',
      proxy: {
        '/willow-api': {
          target: 'http://127.0.0.1:3031',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/willow-api/, ''),
        },
        '/cometbft-rpc': {
          target: 'http://127.0.0.1:26657',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/cometbft-rpc/, ''),
        },
        '/indexer-gql': {
          target: 'http://127.0.0.1:3051',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/indexer-gql/, ''),
        },
        '/eth-rpc': {
          target: 'https://eth-mainnet.g.alchemy.com',
          changeOrigin: true,
          rewrite: () => `/v2/${alchemyKey ?? ''}`,
        },
      },
    },
    build: {
      target: 'es2020',
      sourcemap: true,
    },
  };
});
