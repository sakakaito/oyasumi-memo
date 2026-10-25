import { describe, expect, it } from 'vitest';
import { checkHtml, checkRobotsTxt } from '../scripts/seo-rules.mjs';

const page = ({
  lang = ' lang="ja"',
  title = '<title>おやすみメモ</title>',
  description = '<meta name="description" content="説明文">',
  robots = '<meta name="robots" content="noindex, nofollow">',
  body = '<h1>見出し</h1>',
} = {}) =>
  `<!doctype html><html${lang}><head>${title}${description}${robots}</head><body>${body}</body></html>`;

describe('checkHtml', () => {
  it('そろっていれば合格', () => {
    expect(checkHtml(page())).toEqual([]);
  });

  it('h1 が無いページ（React で描くアプリ）も合格', () => {
    expect(checkHtml(page({ body: '<div id="root"></div>' }))).toEqual([]);
  });

  it.each([
    ['lang が無い', { lang: '' }, 'lang'],
    ['lang が空', { lang: ' lang=""' }, 'lang'],
    ['title が無い', { title: '' }, '<title>'],
    ['title が空白だけ', { title: '<title>  </title>' }, '<title>'],
    ['description が無い', { description: '' }, 'description'],
    ['description が空', { description: '<meta name="description" content="">' }, 'description'],
    ['h1 が 2 つ', { body: '<h1>a</h1><h1 class="x">b</h1>' }, '<h1>'],
    ['noindex が無い', { robots: '' }, 'noindex'],
    ['robots はあるが noindex でない', { robots: '<meta name="robots" content="index, follow">' }, 'noindex'],
  ])('%s → 抜けとして出す', (_label, parts, keyword) => {
    const problems = checkHtml(page(parts));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(keyword);
  });

  it('コメントや script の中の h1・meta は数えない', () => {
    const body = '<h1>本物</h1><!-- <h1>古い</h1> --><script>const s = "<h1>文字列</h1>";</script>';
    expect(checkHtml(page({ body }))).toEqual([]);
    const commented = page({ robots: '<!-- <meta name="robots" content="noindex"> -->' });
    expect(checkHtml(commented)[0]).toContain('noindex');
  });

  it('属性の順番や引用符が違っても読める', () => {
    const html = page({
      description: "<meta content='説明' name='description'>",
      robots: '<meta content="noindex" name="ROBOTS">',
    });
    expect(checkHtml(html)).toEqual([]);
  });

  it('noindex を必須にしない設定（フェーズ7 の公開判定のあと用）', () => {
    expect(checkHtml(page({ robots: '' }), { requireNoindex: false })).toEqual([]);
  });
});

describe('checkRobotsTxt', () => {
  it('クロールを止めない内容は合格', () => {
    expect(checkRobotsTxt('User-agent: *\nAllow: /\n')).toEqual([]);
  });

  it('サイト全体の Disallow は不合格（noindex が読まれなくなる）', () => {
    expect(checkRobotsTxt('User-agent: *\nDisallow: /\n')[0]).toContain('Disallow');
  });

  it('一部だけの Disallow は認める', () => {
    expect(checkRobotsTxt('User-agent: *\nDisallow: /private/\n')).toEqual([]);
  });

  it('User-agent が無いと不合格', () => {
    expect(checkRobotsTxt('Allow: /\n')[0]).toContain('User-agent');
  });
});
