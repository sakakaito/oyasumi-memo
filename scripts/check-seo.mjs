// SEO 点検：dist/ にある HTML すべてと robots.txt を確かめ、抜けがあれば理由を出して終了コード 1 で止める。
// コピーした prototype/ と docs/design/mock/ も点検するので、scripts/copy-static.mjs のあとに実行する
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { checkHtml, checkRobotsTxt } from './seo-rules.mjs';

const OUT_DIR = 'dist';

function listHtml(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listHtml(path);
    return entry.name.endsWith('.html') ? [path] : [];
  });
}

if (!existsSync(OUT_DIR)) {
  console.error(`SEO 点検：${OUT_DIR}/ がありません。先にビルドしてください。`);
  process.exit(1);
}

const failures = [];
const files = listHtml(OUT_DIR);

if (files.length === 0) failures.push([OUT_DIR, ['HTML が 1 つもありません']]);

for (const file of files) {
  const problems = checkHtml(readFileSync(file, 'utf8'));
  if (problems.length) failures.push([relative(OUT_DIR, file).replaceAll('\\', '/'), problems]);
}

const robotsPath = join(OUT_DIR, 'robots.txt');
if (!existsSync(robotsPath)) {
  failures.push(['robots.txt', ['robots.txt がありません（public/robots.txt に置く）']]);
} else {
  const problems = checkRobotsTxt(readFileSync(robotsPath, 'utf8'));
  if (problems.length) failures.push(['robots.txt', problems]);
}

if (failures.length) {
  console.error('SEO 点検：抜けがあります');
  for (const [file, problems] of failures) {
    for (const p of problems) console.error(`  ✗ ${file}：${p}`);
  }
  process.exit(1);
}

console.log(`SEO 点検：合格（HTML ${files.length} 件と robots.txt）`);
for (const file of files) console.log(`  ✓ ${relative(OUT_DIR, file).replaceAll('\\', '/')}`);
