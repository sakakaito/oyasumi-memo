// フェーズ2 の受け入れ条件を、画面から保存・件数までの道筋そのままで確かめる。テスター役が追加（docs/test/phase2.md A-7）。
// エンジニア作のテスト（db・night-flow）は部品ごと。ここでは submitEntry（S4 の主ボタンが呼ぶもの）→ IndexedDB → countsForNight（朝の件数）を通す。
// 保存の失敗は、Dexie の中身に頼らず IndexedDB の書き込み（IDBObjectStore の add／put）を失敗させて起こす（PC のブラウザで B-4 にしたのと同じ方法）
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { countsForNight, db, listByKind, listByNight } from '../src/lib/db';
import { submitEntry } from '../src/lib/nightFlow';
import { listFiles, readText } from './helpers/files.mjs';

const at = (y: number, mo: number, d: number, h: number, mi: number) => new Date(y, mo - 1, d, h, mi);

afterEach(async () => {
  await db.entries.clear();
});

/** その間だけ、IndexedDB への書き込みをすべて失敗させる（容量不足と同じ例外） */
async function withWritesFailing<T>(fn: () => Promise<T>): Promise<{ result: T; attempts: number }> {
  const proto = (globalThis as unknown as { IDBObjectStore: { prototype: Record<string, unknown> } }).IDBObjectStore.prototype;
  const orig = { add: proto.add, put: proto.put };
  let attempts = 0;
  const fail = () => {
    attempts++;
    throw new DOMException('テストで書き込みを止めた', 'QuotaExceededError');
  };
  proto.add = fail;
  proto.put = fail;
  try {
    return { result: await fn(), attempts };
  } finally {
    proto.add = orig.add;
    proto.put = orig.put;
  }
}

describe('区切りの規則（オーナーの確認手順の例）を、保存と朝の件数まで通す', () => {
  it('「明日は資料を出す。それと歯医者の予約」は 2 件、「あとで連絡する」は 1 件', async () => {
    expect(await submitEntry('memo', '明日は資料を出す。それと歯医者の予約', at(2026, 10, 25, 23, 0))).toBe('saved');
    expect((await countsForNight('2026-10-25')).nightMemos).toBe(2);
    expect(await submitEntry('memo', 'あとで連絡する', at(2026, 10, 25, 23, 5))).toBe('saved');
    expect((await listByNight('2026-10-25', 'memo')).map((m) => m.text)).toEqual([
      '明日は資料を出す',
      '歯医者の予約',
      'あとで連絡する',
    ]);
    expect(await countsForNight('2026-10-25')).toEqual({ nightMemos: 3, nightDiaries: 0, totalMemos: 3, totalDiaries: 0 });
  });

  it('日記用から同じ文を送ると、区切りがあっても日記 1 つ（メモは増えない）', async () => {
    expect(await submitEntry('diary', '明日は資料を出す。それと歯医者の予約\nあとで連絡する', at(2026, 10, 25, 23, 0))).toBe('saved');
    expect(await countsForNight('2026-10-25')).toEqual({ nightMemos: 0, nightDiaries: 1, totalMemos: 0, totalDiaries: 1 });
  });
});

describe('0:00〜4:59 は前日の夜の件数に入る（朝の簡易表示まで通す）', () => {
  it('23:59・0:00・4:59 は 10/25 の夜、5:00 は 10/26', async () => {
    await submitEntry('memo', '寝る前', at(2026, 10, 25, 23, 59));
    await submitEntry('memo', '日付が変わった', at(2026, 10, 26, 0, 0));
    await submitEntry('diary', '眠れない夜の日記', at(2026, 10, 26, 4, 59));
    await submitEntry('memo', '朝になった', at(2026, 10, 26, 5, 0));
    expect(await countsForNight('2026-10-25')).toEqual({ nightMemos: 2, nightDiaries: 1, totalMemos: 3, totalDiaries: 1 });
    expect(await countsForNight('2026-10-26')).toEqual({ nightMemos: 1, nightDiaries: 0, totalMemos: 3, totalDiaries: 1 });
  });

  it('countsForNight は、ほかの夜の分を数えない', async () => {
    await submitEntry('memo', '前の夜', at(2026, 10, 24, 22, 0));
    await submitEntry('diary', '前の夜の日記', at(2026, 10, 24, 22, 0));
    expect(await countsForNight('2026-10-25')).toEqual({ nightMemos: 0, nightDiaries: 0, totalMemos: 1, totalDiaries: 1 });
  });
});

describe('保存に失敗したとき（US-04：文字を残す。途中までも保存しない）', () => {
  it('メモ：failed を返し、1 件も保存されない。書き込みが戻れば、同じ文でもう一度押して 2 件だけ保存される', async () => {
    const text = '明日は資料を出す。それと歯医者の予約';
    const { result, attempts } = await withWritesFailing(() => submitEntry('memo', text, at(2026, 10, 25, 23, 0)));
    expect(attempts).toBeGreaterThan(0); // 本当に書き込もうとして失敗したこと
    expect(result).toBe('failed');
    expect(await db.entries.count()).toBe(0);

    expect(await submitEntry('memo', text, at(2026, 10, 25, 23, 1))).toBe('saved');
    expect((await listByKind('memo')).map((m) => m.text)).toEqual(['明日は資料を出す', '歯医者の予約']);
  });

  it('日記：failed を返し、保存されない', async () => {
    const { result, attempts } = await withWritesFailing(() => submitEntry('diary', '今日のこと', at(2026, 10, 25, 23, 0)));
    expect(attempts).toBeGreaterThan(0);
    expect(result).toBe('failed');
    expect(await db.entries.count()).toBe(0);
  });

  it('データベースを閉じられていても、例外を外に出さず failed か saved のどちらかを返す', async () => {
    db.close();
    try {
      const result = await submitEntry('memo', '閉じたあと', at(2026, 10, 25, 23, 0));
      expect(['failed', 'saved']).toContain(result);
      // saved と言ったなら、本当に残っていること（「預かりました」と出したのに消えている、を防ぐ）
      if (!db.isOpen()) await db.open();
      expect(await db.entries.count()).toBe(result === 'saved' ? 1 : 0);
    } finally {
      if (!db.isOpen()) await db.open();
    }
  });
});

describe('保存先が試作と混ざらない（plan §4-2）', () => {
  it('アプリ（src/）は localStorage・sessionStorage を使わない（試作の保存 oyasumi-proto-memos に触れない）', () => {
    for (const f of listFiles('src')) {
      const code = (readText(f) as string).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
      expect(code, f).not.toMatch(/localStorage|sessionStorage/);
    }
  });

  it('IndexedDB のデータベースを開くのは src/lib/db.ts だけ', () => {
    const openers = listFiles('src').filter((f: string) => /new Dexie\(|indexedDB\.open\(/.test(readText(f) as string));
    expect(openers).toEqual(['src/lib/db.ts']);
  });
});
