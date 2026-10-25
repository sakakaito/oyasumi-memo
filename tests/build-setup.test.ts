// 公開の仕組み・依存・base パスの点検（plan.md フェーズ1・§4-3、backlog §2）。テスター役が追加（docs/test/phase1.md A-4）
import { describe, expect, it } from 'vitest';
import { exists, listFiles, readText } from './helpers/files.mjs';

const workflow: string = readText('.github/workflows/deploy.yml');
const pkg = JSON.parse(readText('package.json')) as {
  scripts: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};
const readme: string = readText('README.md');

/** YAML のコメント（# から行末）を除く。文字列の中の # は無い前提 */
const yaml = workflow
  .split(/\r?\n/)
  .map((l) => l.replace(/\s#.*$/, '').replace(/^\s*#.*$/, ''))
  .join('\n');

/** JS のコメントを除く */
const stripJsComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('公開先のパス（base）は 1 か所だけ', () => {
  it('vite.config.ts の BASE が /oyasumi-memo/ で、base: BASE に使われている', () => {
    const config: string = readText('vite.config.ts');
    expect(config).toMatch(/export const BASE = '\/oyasumi-memo\/'/);
    expect(config).toMatch(/base:\s*BASE\b/);
  });

  it('アプリ・入口の HTML・スクリプト・ワークフローに /oyasumi-memo を直書きしていない', () => {
    const files = [
      ...listFiles('src'),
      ...listFiles('scripts'),
      ...listFiles('public'),
      'index.html',
      'app/index.html',
      '.github/workflows/deploy.yml',
    ];
    const hits = files.filter((f) => {
      const text: string = readText(f);
      const code = /\.(m?[jt]sx?|css)$/.test(f) ? stripJsComments(text) : text;
      return code.includes('/oyasumi-memo');
    });
    expect(hits).toEqual([]);
  });
});

describe('メモの中身を外部に送らない（backlog §2）', () => {
  it('src/ に通信・計測の処理や外部 URL が無い', () => {
    for (const f of listFiles('src')) {
      const code = stripJsComments(readText(f));
      expect(code, f).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource|https?:\/\//);
    }
  });

  it('入口の HTML が外部のスクリプトや計測タグを読み込まない', () => {
    for (const f of ['index.html', 'app/index.html']) {
      const html: string = readText(f);
      expect(html, f).not.toMatch(/<(script|link|img|iframe)\b[^>]*(src|href)="(https?:)?\/\//i);
      expect(html, f).not.toMatch(/gtag|googletagmanager|analytics/i);
    }
  });
});

describe('入口の HTML は読み込みの最初から暗い（夜に白い光を出さない）', () => {
  it.each(['index.html', 'app/index.html'])('%s：color-scheme dark と暗い theme-color', (f) => {
    const html: string = readText(f);
    expect(html).toMatch(/<meta name="color-scheme" content="dark">/);
    expect(html).toMatch(/<meta name="theme-color" content="#0b0b0f">/);
  });
});

describe('GitHub Actions のワークフロー（plan.md §4-3）', () => {
  it('main への push と手動実行で動く', () => {
    expect(yaml).toMatch(/on:\s*\n\s+push:\s*\n\s+branches:\s*\[main\]/);
    expect(yaml).toMatch(/workflow_dispatch:/);
  });

  it('npm ci → テスト → ビルド → 試作のコピー → SEO 点検 → 公開用の成果物、の順', () => {
    const order = [
      'run: npm ci',
      'run: npm test',
      'run: npm run build:app',
      'run: npm run copy:static',
      'run: npm run check:seo',
      'actions/upload-pages-artifact@',
    ].map((s) => yaml.indexOf(s));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('失敗しても先に進む設定が無い（テスト・SEO 点検に落ちたら公開しない）', () => {
    expect(yaml).not.toMatch(/continue-on-error/);
    expect(yaml).not.toMatch(/if:\s*.*(always|failure)\(\)/);
    expect(yaml).not.toMatch(/\|\|\s*true/);
  });

  it('公開（deploy）は build が成功したあとだけ', () => {
    expect(yaml).toMatch(/deploy:\s*\n\s+needs:\s*build/);
    expect(yaml).toMatch(/actions\/deploy-pages@/);
  });

  it('権限：全体は contents: read だけ、pages: write と id-token: write は deploy のジョブだけ', () => {
    const [top, jobs] = yaml.split(/\njobs:\s*\n/);
    expect(top).toMatch(/permissions:\s*\n\s+contents:\s*read/);
    expect(top).not.toMatch(/write/);
    const [buildJob, deployJob] = jobs.split(/\n\s{2}deploy:\s*\n/);
    expect(buildJob).not.toMatch(/permissions:|write/);
    expect(deployJob).toMatch(/pages:\s*write/);
    expect(deployJob).toMatch(/id-token:\s*write/);
  });

  it('concurrency：公開は 1 つずつ、実行中の公開を途中で止めない', () => {
    expect(yaml).toMatch(/concurrency:\s*\n\s+group:\s*pages\s*\n\s+cancel-in-progress:\s*false/);
  });

  it('Node 24 を使い、隠しファイル（.nojekyll）も成果物に入れる', () => {
    expect(yaml).toMatch(/node-version:\s*24\b/);
    expect(yaml).toMatch(/path:\s*dist\b/);
    expect(yaml).toMatch(/include-hidden-files:\s*true/);
  });

  it('ワークフローが呼ぶ npm スクリプトが package.json にある', () => {
    for (const s of ['build:app', 'copy:static', 'check:seo', 'test']) expect(pkg.scripts[s], s).toBeTruthy();
  });

  it('npm run build も「ビルド → コピー → SEO 点検」の順（手元とワークフローで同じ中身になる）', () => {
    expect(pkg.scripts.build).toBe('npm run build:app && npm run copy:static && npm run check:seo');
  });
});

describe('試作とモックを Vite に通さずコピーする', () => {
  it('copy-static.mjs が prototype と docs/design/mock をコピーの対象にしている', () => {
    const code: string = readText('scripts/copy-static.mjs');
    expect(code).toMatch(/STATIC_DIRS\s*=\s*\[\s*'prototype'\s*,\s*'docs\/design\/mock'\s*\]/);
  });

  it('public/ に robots.txt と .nojekyll がある（dist の直下に入る）', () => {
    expect(exists('public/robots.txt')).toBe(true);
    expect(exists('public/.nojekyll')).toBe(true);
  });
});

describe('依存パッケージは計画の範囲（plan.md フェーズ1 完了条件・フェーズ2 2-A）', () => {
  // フェーズ2 で追加：dexie（端末内の保存）、fake-indexeddb（テストで IndexedDB の代わり。開発用のみ）
  const allowedDeps = ['react', 'react-dom', 'dexie'];
  const allowedDev = [
    'vite',
    '@vitejs/plugin-react',
    'typescript',
    '@types/react',
    '@types/react-dom',
    'vitest',
    'fake-indexeddb',
  ];

  it('dependencies は React と Dexie だけ', () => {
    expect(Object.keys(pkg.dependencies ?? {}).sort()).toEqual([...allowedDeps].sort());
  });

  it('devDependencies は Vite・TypeScript・Vitest とその必須分だけ', () => {
    for (const name of Object.keys(pkg.devDependencies ?? {})) expect(allowedDev, name).toContain(name);
  });

  it('入れたパッケージすべての理由が README の表にある', () => {
    const table = readme.slice(readme.indexOf('## 使っているパッケージと理由'));
    for (const name of [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})]) {
      expect(table, name).toContain(`\`${name}\``);
    }
  });
});
