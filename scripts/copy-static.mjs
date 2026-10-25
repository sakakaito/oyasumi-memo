// ビルドのあとに、Vite に通さないページを dist/ の同じパスへそのままコピーする。
// 今の公開 URL（/oyasumi-memo/prototype/voice-test/ と /oyasumi-memo/docs/design/mock/night.html）を
// GitHub Actions での公開に切り替えたあとも開けるようにするため（docs/plan.md §4-3）
import { cpSync, existsSync } from 'node:fs';

const OUT_DIR = 'dist';

// コピーするフォルダ（元のパス → dist の中の同じパス）
const STATIC_DIRS = ['prototype', 'docs/design/mock'];

if (!existsSync(OUT_DIR)) {
  console.error(`${OUT_DIR}/ がありません。先に vite build を実行してください。`);
  process.exit(1);
}

for (const dir of STATIC_DIRS) {
  if (!existsSync(dir)) {
    console.error(`コピー元の ${dir}/ が見つかりません。`);
    process.exit(1);
  }
  cpSync(dir, `${OUT_DIR}/${dir}`, { recursive: true });
  console.log(`コピーしました：${dir}/ → ${OUT_DIR}/${dir}/`);
}
