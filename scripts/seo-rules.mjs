// SEO 点検の決まり（ファイルを読まない純粋な関数だけ。tests/check-seo.test.ts で確かめる）
// 実行は scripts/check-seo.mjs。フェーズ6 で canonical・OGP・構造化データ・sitemap.xml の項目を足す

/** 属性の文字列から { 名前: 値 } を作る（名前は小文字） */
function parseAttrs(source) {
  const attrs = {};
  const re = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let m;
  while ((m = re.exec(source))) {
    attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
  }
  return attrs;
}

/** コメントと、script・style の中身を取り除く（中の文字列を見出しなどと数え違えないように） */
function stripNonMarkup(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '<script></script>')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '<style></style>');
}

function metaContent(html, name) {
  const re = /<meta\b([^>]*)>/gi;
  let m;
  while ((m = re.exec(html))) {
    const attrs = parseAttrs(m[1]);
    if ((attrs.name ?? '').toLowerCase() === name) return attrs.content ?? '';
  }
  return null;
}

/**
 * HTML 1 枚を点検し、抜けの説明を配列で返す（空なら合格）
 * @param {string} source HTML の中身
 * @param {{ requireNoindex?: boolean }} [options] requireNoindex：noindex を必須にするか（今はすべてのページが noindex の段階）
 * @returns {string[]}
 */
export function checkHtml(source, { requireNoindex = true } = {}) {
  const html = stripNonMarkup(source);
  const problems = [];

  const htmlTag = html.match(/<html\b([^>]*)>/i);
  const lang = htmlTag ? (parseAttrs(htmlTag[1]).lang ?? '').trim() : '';
  if (!lang) problems.push('<html lang="…"> がありません（言語の指定。例：lang="ja"）');

  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  if (!title || !title[1].trim()) problems.push('<title> が無いか、空です');

  const description = metaContent(html, 'description');
  if (description === null) problems.push('<meta name="description"> がありません');
  else if (!description.trim()) problems.push('<meta name="description"> の content が空です');

  const h1Count = (html.match(/<h1[\s>]/gi) ?? []).length;
  if (h1Count >= 2) problems.push(`<h1> が ${h1Count} 個あります（1 ページに 1 つまで）`);

  if (requireNoindex) {
    const robots = metaContent(html, 'robots');
    if (robots === null || !/\bnoindex\b/i.test(robots)) {
      problems.push('<meta name="robots" content="noindex"> がありません（今はすべてのページを検索に出さない段階）');
    }
  }

  return problems;
}

/**
 * robots.txt を点検する。noindex を検索エンジンに読ませるため、サイト全体の Disallow は認めない
 * @param {string} text robots.txt の中身
 * @returns {string[]}
 */
export function checkRobotsTxt(text) {
  const problems = [];
  const lines = text.split(/\r?\n/).map((l) => l.replace(/#.*/, '').trim());
  if (!lines.some((l) => /^user-agent\s*:/i.test(l))) problems.push('robots.txt に User-agent の行がありません');
  if (lines.some((l) => /^disallow\s*:\s*\/\s*$/i.test(l))) {
    problems.push('robots.txt が「Disallow: /」でクロールを止めています（止めると noindex が読まれず、検索から外れません）');
  }
  return problems;
}
