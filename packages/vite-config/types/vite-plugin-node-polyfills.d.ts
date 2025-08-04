declare module 'vite-plugin-node-polyfills' {
  import type { Plugin } from 'vite';
  
  interface NodePolyfillsOptions {
    globals?: {
      Buffer?: boolean;
      global?: boolean;
      process?: boolean;
    };
    protocolImports?: boolean;
    exclude?: string[];
    include?: string[];
  }
  
  export function nodePolyfills(options?: NodePolyfillsOptions): Plugin;
}