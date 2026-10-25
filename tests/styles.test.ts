// CSS の点検（backlog §2・US-03・docs/design/tokens.md）。テスター役が追加（docs/test/phase1.md A-3）。
// CSS をファイルとして読み、var(--…) をトークンの値に置き換えてから数値を確かめる
import { describe, expect, it } from 'vitest';
import { readText } from './helpers/files.mjs';

const theme: string = readText('src/styles/theme.css');
const app: string = readText('src/styles/app.css');
const intro: string = readText('src/styles/intro.css');
const tokensMd: string = readText('docs/design/tokens.md');

const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/** セレクタ（完全一致）ごとの { プロパティ: 値 }。同じセレクタが何度出ても足し合わせる */
function rules(css: string): Map<string, Record<string, string>> {
  const out = new Map<string, Record<string, string>>();
  const re = /([^{}@]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripComments(css)))) {
    const decls: Record<string, string> = {};
    for (const d of m[2].split(';')) {
      const i = d.indexOf(':');
      if (i > 0) decls[d.slice(0, i).trim()] = d.slice(i + 1).trim();
    }
    for (const sel of m[1].split(',').map((s) => s.trim())) {
      out.set(sel, { ...(out.get(sel) ?? {}), ...decls });
    }
  }
  return out;
}

/** :root（data-mode なし）のトークン。夜の色と共通の値 */
const rootTokens = rules(theme).get(':root') ?? {};
const morningTokens = rules(theme).get(':root[data-mode="morning"]') ?? {};

/** var(--x) を :root の値に置き換えて px の数値にする。数値にならなければ NaN */
function px(value: string, tokens: Record<string, string> = rootTokens): number {
  let v = value.trim();
  for (let i = 0; i < 10 && /var\(/.test(v); i++) {
    v = v.replace(/var\((--[\w-]+)(?:,[^)]*)?\)/g, (_s, name: string) => tokens[name] ?? 'NaN');
  }
  const n = v.match(/^(-?[\d.]+)px$/);
  return n ? Number(n[1]) : NaN;
}

/** 色 #rrggbb の相対輝度（WCAG 2.x） */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

describe('文字は最小 16px（backlog §2・spec §8）', () => {
  it('文字サイズのトークン --fs-* はすべて 16px 以上', () => {
    const fs = Object.entries(rootTokens).filter(([k]) => k.startsWith('--fs-'));
    expect(fs.length).toBeGreaterThanOrEqual(6);
    for (const [name, value] of fs) expect(px(value), name).toBeGreaterThanOrEqual(16);
  });

  it.each([
    ['app.css', app],
    ['intro.css', intro],
  ])('%s の font-size・font はすべて 16px 以上で、トークンを使っている', (_file, css) => {
    const sizes: string[] = [];
    for (const [sel, decls] of rules(css)) {
      if (decls['font-size']) sizes.push(`${sel}|${decls['font-size']}`);
      if (decls.font && decls.font !== 'inherit') sizes.push(`${sel}|${decls.font.split('/')[0]}`);
    }
    expect(sizes.length).toBeGreaterThan(0);
    for (const s of sizes) {
      const [sel, value] = s.split('|');
      expect(value, sel).toMatch(/var\(--fs-/);
      expect(px(value), sel).toBeGreaterThanOrEqual(16);
    }
  });
});

describe('タップ領域は 44px 以上（tokens.md「使い方の決まり」）', () => {
  const appRules = rules(app);
  const introRules = rules(intro);

  it.each([
    ['.icon-btn', appRules, ['width', 'height']],
    ['.text-btn', appRules, ['min-height', 'min-width']],
    ['.btn', appRules, ['min-height']],
    ['.rec', appRules, ['width', 'height']],
    ['.intro-link', introRules, ['min-height']],
  ] as const)('%s', (sel, rs, props) => {
    const decls = rs.get(sel);
    expect(decls, `${sel} の指定が見つからない`).toBeDefined();
    for (const p of props) expect(px(decls?.[p] ?? ''), `${sel} ${p}`).toBeGreaterThanOrEqual(44);
  });

  it('--tap-min は 44px、--tap は 48px', () => {
    expect(px(rootTokens['--tap-min'])).toBe(44);
    expect(px(rootTokens['--tap'])).toBe(48);
  });
});

describe('夜の色（US-03・tokens.md §1〜2）', () => {
  const night = Object.fromEntries(
    Object.entries(rootTokens).filter(([k, v]) => k.startsWith('--n-') && /^#[0-9a-f]{6}$/i.test(v)),
  );
  const bg = night['--n-bg'];

  it('背景はほぼ黒（相対輝度 0.01 未満）', () => {
    expect(bg).toBeDefined();
    expect(luminance(bg)).toBeLessThan(0.01);
  });

  it('読む文字（--n-text）は背景に対して 4.5:1 以上', () => {
    expect(contrast(night['--n-text'], bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('夜のどの色も、背景に対して 約 5.5:1 を超えない（明るさの上限）', () => {
    for (const [name, hex] of Object.entries(night)) {
      expect(contrast(hex, bg), name).toBeLessThanOrEqual(5.5);
    }
  });

  it('夜の色に白・青系を使わない（青の成分が赤より強い色が無い。背景と地の暗色は除く）', () => {
    for (const [name, hex] of Object.entries(night)) {
      if (luminance(hex) < 0.01) continue; // ほぼ黒の地（#0b0b0f など）は対象外
      const [r, , b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
      expect(b, name).toBeLessThanOrEqual(r);
    }
  });

  it('data-mode が無いとき（読み込みの最初）の役割の変数は夜の色', () => {
    expect(rootTokens['--bg']).toBe('var(--n-bg)');
    expect(rootTokens['--text']).toBe('var(--n-text)');
  });

  it('夜の画面の部品に点滅・動き（animation・transform）を使わない', () => {
    const css = stripComments(app);
    expect(css).not.toMatch(/@keyframes|animation\s*:|transform\s*:/);
    // transition は不透明度と背景色だけ
    for (const t of css.match(/transition\s*:[^;}]*/g) ?? []) {
      expect(t).toMatch(/transition\s*:\s*(none|opacity|background-color)\b/);
    }
  });
});

describe('トークンが tokens.md の案と同じ値（写し間違いが無い）', () => {
  // tokens.md の ```css ブロックにある --n-* / --m-* / 共通トークンの宣言を集める
  const mdTokens: Record<string, string> = {};
  for (const block of tokensMd.match(/```css[\s\S]*?```/g) ?? []) {
    for (const m of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
      if (!(m[1] in mdTokens)) mdTokens[m[1]] = m[2].trim();
    }
  }
  const themeAll = { ...rootTokens, ...morningTokens };

  it.each(Object.keys(mdTokens).filter((k) => /^--(n|m)-/.test(k) && k !== '--n-focus'))('%s', (name) => {
    expect(themeAll[name]?.toLowerCase()).toBe(mdTokens[name].toLowerCase());
  });

  it('--n-focus は --n-text と同じ色', () => {
    expect(rootTokens['--n-focus']).toBe('var(--n-text)');
    expect(mdTokens['--n-focus'].toLowerCase()).toBe(rootTokens['--n-text'].toLowerCase());
  });
});
