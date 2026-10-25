import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// 公開先のパス。ここ 1 か所だけを変えれば、独自ドメインや別の公開先に移せる
// （例：独自ドメインの直下なら '/'）。開発中（npm run dev）も同じパスで動く
export const BASE = '/oyasumi-memo/';

export default defineConfig({
  base: BASE,
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      // マルチページ：ルートは仮の紹介ページ、app/ がアプリ本体
      // prototype/ と docs/ は Vite に通さず、ビルド後にそのままコピーする（scripts/copy-static.mjs）
      input: {
        intro: 'index.html',
        app: 'app/index.html',
      },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
