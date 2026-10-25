// テストからリポジトリのファイルを読むための小さな道具（テスター役が追加）。
// @types/node を入れていない（依存をフェーズ1 の範囲に収めるため）ので、node:fs を使う処理は
// 型チェックの対象外の .mjs に置き、テスト（.ts）からはこの関数だけを呼ぶ。
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/** リポジトリのルート（tests/helpers/ の 2 つ上） */
export const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** ルートからの相対パスで、ファイルかフォルダがあるか */
export function exists(path) {
  return existsSync(join(ROOT, path));
}

/** ルートからの相対パスで、文字として読む */
export function readText(path) {
  return readFileSync(join(ROOT, path), 'utf8');
}

/** 2 つのファイルの中身（バイト列）が同じか */
export function sameBytes(a, b) {
  return readFileSync(join(ROOT, a)).equals(readFileSync(join(ROOT, b)));
}

/** フォルダの中のファイルを、ルートからの相対パス（区切りは /）で全部返す。隠しファイルも含む */
export function listFiles(dir) {
  const walk = (abs) =>
    readdirSync(abs, { withFileTypes: true }).flatMap((e) => {
      const p = join(abs, e.name);
      return e.isDirectory() ? walk(p) : [relative(ROOT, p).replaceAll('\\', '/')];
    });
  return walk(join(ROOT, dir));
}
