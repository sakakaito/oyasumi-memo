// 保存と読み出し（plan フェーズ2 2-A〜2-D・2-F、backlog US-02・US-04・US-10・US-11・§2）
// Node には IndexedDB が無いので、fake-indexeddb（メモリ上の IndexedDB）を Dexie より先に読み込む
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DB_NAME,
  EntryNotFoundError,
  countEntries,
  countsForNight,
  isConnectionLost,
  db,
  deleteEntry,
  getEntry,
  listByKind,
  listByNight,
  openDatabase,
  saveDiary,
  saveMemoText,
  saveMemos,
  updateMemo,
  updateText,
} from '../src/lib/db';
import type { NightSchedule } from '../src/lib/time';
import type { Category } from '../src/types';

// 端末の時刻（ローカル時刻）で日時を作る
const at = (y: number, mo: number, d: number, h: number, mi: number) => new Date(y, mo - 1, d, h, mi);

afterEach(async () => {
  await db.entries.clear();
});

describe('データベース', () => {
  it('名前はこのアプリ固有（plan §4-2）', () => {
    expect(DB_NAME).toBe('oyasumi-memo');
    expect(db.name).toBe(DB_NAME);
  });
});

describe('saveMemoText：テキストで預ける', () => {
  it('区切りごとに 1 件ずつ保存し、件数を返す', async () => {
    const n = await saveMemoText('明日は資料を出す。それと歯医者の予約', at(2026, 10, 25, 23, 0));
    expect(n).toBe(2);
    const memos = await listByNight('2026-10-25', 'memo');
    expect(memos.map((m) => m.text)).toEqual(['明日は資料を出す', '歯医者の予約']);
    for (const m of memos) {
      expect(m).toMatchObject({ kind: 'memo', category: 'other', done: false, archived: false, sleepDate: '2026-10-25' });
      expect(m.id).toMatch(/^[0-9a-f-]{36}$/);
    }
    expect(new Set(memos.map((m) => m.id)).size).toBe(2);
  });

  it('分けられなければ 1 件', async () => {
    expect(await saveMemoText('明日は資料を出す', at(2026, 10, 25, 23, 0))).toBe(1);
  });

  it('空の入力は何も保存せず 0 を返す', async () => {
    expect(await saveMemoText('   ', at(2026, 10, 25, 23, 0))).toBe(0);
    expect(await countEntries()).toBe(0);
  });

  it('仕分けの関数を渡すと、その結果で保存する（フェーズ3 の classify 用）', async () => {
    const classify = async (t: string): Promise<Category> => (t.includes('歯医者') ? 'todo' : 'worry');
    await saveMemoText('プレゼンが不安。それと歯医者の予約', at(2026, 10, 25, 23, 0), { classify });
    const memos = await listByNight('2026-10-25', 'memo');
    expect(memos.map((m) => m.category)).toEqual(['worry', 'todo']);
  });

  it('保存に失敗したら例外を投げ、1 件も保存しない（呼び出し側が入力を残せる）', async () => {
    const classify = async (t: string) => {
      if (t === '二つ目') throw new Error('仕分けに失敗');
      return 'other' as const;
    };
    await expect(saveMemoText('一つ目。二つ目', at(2026, 10, 25, 23, 0), { classify })).rejects.toThrow('仕分けに失敗');
    expect(await countEntries()).toBe(0);
  });

  it('データベースへの書き込みに失敗したら例外を投げ、途中までも残さない', async () => {
    const [first] = await saveMemos(['もとからある'], at(2026, 10, 25, 22, 0));
    // 同じ id で書こうとして失敗させる（bulkAdd の 2 件目が重複）
    const spy = vi
      .spyOn(crypto, 'randomUUID')
      .mockReturnValueOnce('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
      .mockReturnValueOnce(first.id as ReturnType<typeof crypto.randomUUID>);
    try {
      await expect(saveMemoText('新しい1。新しい2', at(2026, 10, 25, 23, 0))).rejects.toThrow();
    } finally {
      spy.mockRestore();
    }
    expect((await listByNight('2026-10-25')).map((m) => m.text)).toEqual(['もとからある']);
  });
});

describe('sleepDate：境目での保存先の夜（0:00・4:59・5:00）', () => {
  it.each([
    ['10/25 23:59 → 10/25 の夜', at(2026, 10, 25, 23, 59), '2026-10-25'],
    ['10/26 0:00 → 前日（10/25）の夜', at(2026, 10, 26, 0, 0), '2026-10-25'],
    ['10/26 4:59 → 前日（10/25）の夜', at(2026, 10, 26, 4, 59), '2026-10-25'],
    ['10/26 5:00 → 当日（10/26）', at(2026, 10, 26, 5, 0), '2026-10-26'],
  ])('メモ：%s', async (_label, now, expected) => {
    await saveMemoText('考えごと', now);
    const [memo] = await listByKind('memo');
    expect(memo.sleepDate).toBe(expected);
  });

  it.each([
    ['10/26 0:00', at(2026, 10, 26, 0, 0), '2026-10-25'],
    ['10/26 4:59', at(2026, 10, 26, 4, 59), '2026-10-25'],
    ['10/26 5:00', at(2026, 10, 26, 5, 0), '2026-10-26'],
  ])('日記も同じ規則：%s → %s', async (_label, now, expected) => {
    const diary = await saveDiary('今日のこと', now);
    expect(diary?.sleepDate).toBe(expected);
    expect((await getEntry(diary!.id))?.sleepDate).toBe(expected);
  });

  it('境目を変えると、夜モードと同じ値で保存先も変わる', async () => {
    const late: NightSchedule = { nightStart: 22 * 60, morningStart: 6 * 60 };
    await saveMemoText('考えごと', at(2026, 10, 26, 5, 30), { schedule: late });
    await saveDiary('日記', at(2026, 10, 26, 6, 0), { schedule: late });
    expect((await listByKind('memo'))[0].sleepDate).toBe('2026-10-25');
    expect((await listByKind('diary'))[0].sleepDate).toBe('2026-10-26');
  });
});

describe('saveDiary：テキストで日記', () => {
  it('句点・改行・区切りの言葉があっても 1 つの日記のまま（分けない・仕分けない）', async () => {
    const text = '今日は会議が長かった。それと昼に雨が降った。\nあと、帰りに本屋に寄った';
    const diary = await saveDiary(text, at(2026, 10, 25, 23, 30));
    expect(diary).not.toBeNull();
    expect(await countEntries('diary')).toBe(1);
    expect(await countEntries('memo')).toBe(0);
    const [saved] = await listByNight('2026-10-25', 'diary');
    expect(saved.text).toBe(text);
    expect(saved).not.toHaveProperty('category');
    expect(saved).not.toHaveProperty('archived');
  });

  it('前後の空白だけ落とし、中の改行は残す', async () => {
    const diary = await saveDiary('\n  1 行目\n2 行目  \n', at(2026, 10, 25, 23, 30));
    expect(diary?.text).toBe('1 行目\n2 行目');
  });

  it('空の入力は保存せず null を返す', async () => {
    expect(await saveDiary(' \n ', at(2026, 10, 25, 23, 30))).toBeNull();
    expect(await countEntries()).toBe(0);
  });
});

describe('読み出し：夜ごと・種類ごと', () => {
  it('夜ごとに、種類を分けて、保存した順に読める', async () => {
    await saveMemoText('24 日のメモ', at(2026, 10, 24, 22, 0));
    await saveMemoText('25 日のメモ 2', at(2026, 10, 25, 23, 0));
    await saveDiary('25 日の日記', at(2026, 10, 25, 22, 30));
    await saveMemoText('25 日のメモ 1', at(2026, 10, 25, 22, 0));
    await saveMemoText('深夜のメモ', at(2026, 10, 26, 1, 0)); // 25 日の夜

    expect((await listByNight('2026-10-25', 'memo')).map((e) => e.text)).toEqual([
      '25 日のメモ 1',
      '25 日のメモ 2',
      '深夜のメモ',
    ]);
    expect((await listByNight('2026-10-25', 'diary')).map((e) => e.text)).toEqual(['25 日の日記']);
    expect((await listByNight('2026-10-25')).map((e) => e.text)).toEqual([
      '25 日のメモ 1',
      '25 日の日記',
      '25 日のメモ 2',
      '深夜のメモ',
    ]);
    expect(await listByNight('2026-10-23')).toEqual([]);
  });

  it('種類ごと：新しい夜から順、同じ夜の中は時刻順（US-12）', async () => {
    await saveDiary('24 日', at(2026, 10, 24, 23, 0));
    await saveDiary('25 日・夜おそく', at(2026, 10, 26, 2, 0));
    await saveDiary('25 日・はやく', at(2026, 10, 25, 21, 0));
    expect((await listByKind('diary')).map((d) => d.text)).toEqual(['25 日・はやく', '25 日・夜おそく', '24 日']);
  });

  it('1 回で分けたメモは、入力の順のまま並ぶ', async () => {
    await saveMemoText('一。二。三。四。五', at(2026, 10, 25, 23, 0));
    expect((await listByNight('2026-10-25', 'memo')).map((m) => m.text)).toEqual(['一', '二', '三', '四', '五']);
  });

  it('件数を種類ごとに数えられる', async () => {
    await saveMemoText('一。二', at(2026, 10, 25, 23, 0));
    await saveDiary('日記', at(2026, 10, 25, 23, 0));
    expect(await countEntries()).toBe(3);
    expect(await countEntries('memo')).toBe(2);
    expect(await countEntries('diary')).toBe(1);
  });
});

describe('更新・削除', () => {
  it('updateText：本文と updatedAt だけが変わる（日付・分類はそのまま）', async () => {
    const [memo] = await saveMemos(['歯医者のよやく'], at(2026, 10, 26, 1, 0));
    await updateText(memo.id, ' 歯医者の予約 ', at(2026, 10, 26, 7, 30));
    expect(await getEntry(memo.id)).toEqual({
      ...memo,
      text: '歯医者の予約',
      updatedAt: at(2026, 10, 26, 7, 30).getTime(),
    });
  });

  it('updateText：日記に追記しても 1 つの日記のまま（方式K の途中保存）', async () => {
    const diary = (await saveDiary('今日は', at(2026, 10, 25, 23, 0)))!;
    await updateText(diary.id, '今日は雨だった。それと会議が長かった', at(2026, 10, 25, 23, 1));
    const diaries = await listByKind('diary');
    expect(diaries).toHaveLength(1);
    expect(diaries[0]).toMatchObject({ id: diary.id, text: '今日は雨だった。それと会議が長かった', sleepDate: '2026-10-25' });
  });

  it('updateText：空には直せない・無い id は EntryNotFoundError', async () => {
    const diary = (await saveDiary('日記', at(2026, 10, 25, 23, 0)))!;
    await expect(updateText(diary.id, '  ')).rejects.toThrow(RangeError);
    expect((await getEntry(diary.id))?.text).toBe('日記');
    await expect(updateText('no-such-id', 'x')).rejects.toBeInstanceOf(EntryNotFoundError);
  });

  it('updateMemo：分類・完了・片付けを変えられる', async () => {
    const [memo] = await saveMemos(['プレゼン'], at(2026, 10, 25, 23, 0));
    await updateMemo(memo.id, { category: 'worry', done: true }, at(2026, 10, 26, 7, 0));
    await updateMemo(memo.id, { archived: true }, at(2026, 10, 26, 7, 1));
    expect(await getEntry(memo.id)).toMatchObject({
      text: 'プレゼン',
      category: 'worry',
      done: true,
      archived: true,
      updatedAt: at(2026, 10, 26, 7, 1).getTime(),
    });
  });

  it('updateMemo：日記や無い id には使えない', async () => {
    const diary = (await saveDiary('日記', at(2026, 10, 25, 23, 0)))!;
    await expect(updateMemo(diary.id, { archived: true })).rejects.toBeInstanceOf(EntryNotFoundError);
    expect(await getEntry(diary.id)).not.toHaveProperty('archived');
    await expect(updateMemo('no-such-id', { done: true })).rejects.toBeInstanceOf(EntryNotFoundError);
  });

  it('deleteEntry：1 件だけ消える。もう無いものを消しても失敗しない', async () => {
    const [a, b] = await saveMemos(['残す', '消す'], at(2026, 10, 25, 23, 0));
    const diary = (await saveDiary('日記', at(2026, 10, 25, 23, 1)))!;
    await deleteEntry(b.id);
    await deleteEntry(b.id);
    expect(await getEntry(b.id)).toBeUndefined();
    expect((await listByNight('2026-10-25')).map((e) => e.id)).toEqual([a.id, diary.id]);
    await deleteEntry(diary.id);
    expect(await countEntries('diary')).toBe(0);
    expect(await countEntries('memo')).toBe(1);
  });
});

describe('リロードしても残る（開き直したデータベースから読める）', () => {
  it('別に開いた接続からも、保存したメモと日記が読める', async () => {
    await saveMemoText('明日は資料を出す。それと歯医者の予約', at(2026, 10, 25, 23, 0));
    await saveDiary('今日のこと', at(2026, 10, 25, 23, 5));
    db.close();
    const reopened = openDatabase();
    try {
      expect(await reopened.entries.count()).toBe(3);
      expect((await reopened.entries.where('kind').equals('diary').toArray()).map((d) => d.text)).toEqual(['今日のこと']);
    } finally {
      reopened.close();
      await db.open();
    }
  });
});

// テスター F-8（docs/test/phase2.md）：接続が閉じられた・切れたら、開き直して 1 回だけやり直す
describe('接続が切れたときの開き直し（F-8）', () => {
  const closedError = () => Object.assign(new Error('Database has been closed'), { name: 'DatabaseClosedError' });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (!db.isOpen()) await db.open();
  });

  it('閉じた状態からでも、メモと日記を保存できる（押し直さなくてよい）', async () => {
    db.close();
    expect(await saveMemoText('明日は資料を出す。それと歯医者の予約', at(2026, 10, 25, 23, 0))).toBe(2);
    db.close();
    expect(await saveDiary('今日のこと', at(2026, 10, 25, 23, 5))).not.toBeNull();
    expect(await countEntries('memo')).toBe(2);
    expect(await countEntries('diary')).toBe(1);
  });

  it('閉じた状態からでも読める（朝の件数・一覧・更新・削除）', async () => {
    const [memo] = await saveMemos(['考えごと'], at(2026, 10, 25, 23, 0));
    db.close();
    expect(await countsForNight('2026-10-25')).toEqual({ nightMemos: 1, nightDiaries: 0, totalMemos: 1, totalDiaries: 0 });
    db.close();
    expect((await listByNight('2026-10-25')).map((e) => e.text)).toEqual(['考えごと']);
    db.close();
    await updateText(memo.id, '直した', at(2026, 10, 26, 7, 0));
    db.close();
    await updateMemo(memo.id, { done: true });
    db.close();
    expect(await getEntry(memo.id)).toMatchObject({ text: '直した', done: true });
    db.close();
    await deleteEntry(memo.id);
    expect(await countEntries()).toBe(0);
  });

  it('書き込みは済んだのに「切れた」と返ってきても、やり直しで二重に保存しない（メモ）', async () => {
    const original = db.transaction.bind(db) as (...a: unknown[]) => Promise<unknown>;
    vi.spyOn(db, 'transaction').mockImplementationOnce((async (...args: unknown[]) => {
      await original(...args);
      throw closedError();
    }) as never);
    expect(await saveMemoText('一つ目。二つ目', at(2026, 10, 25, 23, 0))).toBe(2);
    expect((await listByKind('memo')).map((m) => m.text)).toEqual(['一つ目', '二つ目']);
  });

  it('書き込みは済んだのに「切れた」と返ってきても、やり直しで二重に保存しない（日記）', async () => {
    const original = db.transaction.bind(db) as (...a: unknown[]) => Promise<unknown>;
    vi.spyOn(db, 'transaction').mockImplementationOnce((async (...args: unknown[]) => {
      await original(...args);
      throw closedError();
    }) as never);
    await saveDiary('今日のこと', at(2026, 10, 25, 23, 0));
    expect(await countEntries('diary')).toBe(1);
  });

  it('やり直しは 1 回だけ。2 回とも切れたら例外を投げ、何も保存しない（入力は画面に残る）', async () => {
    const spy = vi.spyOn(db, 'transaction').mockImplementation((async () => {
      throw closedError();
    }) as never);
    await expect(saveMemoText('明日は資料を出す', at(2026, 10, 25, 23, 0))).rejects.toMatchObject({
      name: 'DatabaseClosedError',
    });
    expect(spy).toHaveBeenCalledTimes(2);
    spy.mockRestore();
    expect(await countEntries()).toBe(0);
  });

  it('接続と関係ない失敗（同じ id の重複など）はやり直さない', async () => {
    const spy = vi.spyOn(db, 'transaction').mockImplementation((async () => {
      throw Object.assign(new Error('Key already exists'), { name: 'ConstraintError' });
    }) as never);
    await expect(saveMemoText('明日', at(2026, 10, 25, 23, 0))).rejects.toMatchObject({ name: 'ConstraintError' });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it.each<[string, unknown, boolean]>([
    ['DatabaseClosedError', { name: 'DatabaseClosedError' }, true],
    ['InvalidStateError', { name: 'InvalidStateError' }, true],
    ['Dexie に包まれた InvalidStateError', { name: 'AbortError', inner: { name: 'InvalidStateError' } }, true],
    ['Safari の接続切れ', { name: 'UnknownError', message: 'Connection to Indexed Database server lost. Refresh the page to try again' }, true],
    ['ConstraintError', { name: 'ConstraintError' }, false],
    ['QuotaExceededError', { name: 'QuotaExceededError' }, false],
    ['ふつうの Error', new Error('x'), false],
    ['undefined', undefined, false],
  ])('isConnectionLost：%s → %s', (_label, error, expected) => {
    expect(isConnectionLost(error)).toBe(expected);
  });
});
