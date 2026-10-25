// ビルドの出力（dist/）の点検。テスター役が追加（docs/test/phase1.md A-5）。
// dist/ は `npm run build` のあとにだけある。GitHub Actions では npm test がビルドの前に動くので、
// dist/ が無いときはこのファイルのテストを飛ばす（手元で `npm run build && npm test` の順に実行して確かめる）。
// 古い dist/ が残っていると古い中身を見てしまうので、確かめるときは必ず直前に npm run build する
import { describe, expect, it } from 'vitest';
import { exists, listFiles, readText, sameBytes } from './helpers/files.mjs';

const built = exists('dist/index.html') && exists('dist/app/index.html');

describe.skipIf(!built)('dist/（npm run build のあと）', () => {
  it('公開に必要なファイルがそろっている', () => {
    for (const f of [
      'dist/index.html',
      'dist/app/index.html',
      'dist/prototype/voice-test/index.html',
      'dist/prototype/voice-test/manifest.webmanifest',
      'dist/docs/design/mock/night.html',
      'dist/robots.txt',
      'dist/.nojekyll',
    ]) {
      expect(exists(f), f).toBe(true);
    }
  });

  it.each(['prototype', 'docs/design/mock'])('%s/ の中身が 1 バイトも変わらずにコピーされている', (dir) => {
    const sources: string[] = listFiles(dir);
    expect(sources.length).toBeGreaterThan(0);
    for (const src of sources) {
      expect(exists(`dist/${src}`), `dist/${src}`).toBe(true);
      expect(sameBytes(src, `dist/${src}`), src).toBe(true);
    }
  });

  it('docs/ のうち公開するのはモックだけ（仕様書などの .md は出さない）', () => {
    const docs: string[] = listFiles('dist/docs');
    expect(docs.filter((f) => !f.startsWith('dist/docs/design/mock/'))).toEqual([]);
  });

  it('アプリと紹介ページの読み込み先は /oyasumi-memo/ の下（base が効いている）', () => {
    for (const f of ['dist/index.html', 'dist/app/index.html']) {
      const html: string = readText(f);
      const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
      for (const ref of refs.filter((r) => r.startsWith('/'))) expect(ref, f).toMatch(/^\/oyasumi-memo\/assets\//);
      expect(html, f).not.toMatch(/\/src\/main\.tsx|\/src\/styles\//);
    }
  });

  it('紹介ページからアプリへのリンクは相対（app/）で、base が変わっても切れない', () => {
    expect(readText('dist/index.html')).toMatch(/href="app\/"/);
  });

  it('robots.txt はクロールを止めていない', () => {
    expect(readText('dist/robots.txt')).not.toMatch(/^\s*Disallow:\s*\/\s*$/m);
  });
});
