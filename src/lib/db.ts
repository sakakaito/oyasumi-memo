/**
 * 端末の中の保存（IndexedDB を Dexie で使う。spec §4）。外部には何も送らない（backlog §2）。
 *
 * 表の設計：メモと日記は 1 つの表 `entries` に、種類（kind: 'memo' | 'diary'）をつけて入れる。
 * - backlog の条件「エクスポート・インポート・全削除・日付の規則が、メモと日記の両方に同じように効くこと」を、
 *   表が 1 つであることで最初から満たす（表を分けると、書き出し・消去・読み込みのたびに両方を扱う必要があり、片方の漏れが起きやすい）
 * - その夜の日付（sleepDate）の付け方も保存の入口 1 か所で両方に効く
 * - 日記だけの扱い（分けない・仕分けない・「全部見た」で片付けない）は kind で分ける。型（src/types.ts）も Memo と Diary を分けてあり、
 *   日記に category・done・archived は無い
 * - 種類が増えても（例：将来の別の記録）表を足さずに済む
 *
 * データベース名はこのアプリ固有にする（plan §4-2：sakakaito.github.io は同じアカウントの他のページと保存場所を共有する）。
 * 公開後にこの名前を変えると、利用者のデータが見えなくなるので変えないこと。
 */
import Dexie, { type EntityTable } from 'dexie';
import type { Category, Diary, Entry, EntryKind, EntryOf, Memo } from '../types';
import { splitMemoText } from './split';
import { DEFAULT_SCHEDULE, sleepDate as toSleepDate, type NightSchedule } from './time';

export const DB_NAME = 'oyasumi-memo';

export type OyasumiDB = Dexie & { entries: EntityTable<Entry, 'id'> };

/**
 * 表と索引の定義。
 * 項目を足す・索引を変えるときは、下の version(1) を消さずに version(2) を足す（Dexie の決まり）。
 * 既存のデータに値を入れる必要があれば .upgrade() を付ける。例：
 *   db.version(2).stores({ entries: 'id, kind, sleepDate, [kind+sleepDate], createdAt, tag' })
 *     .upgrade((tx) => tx.table('entries').toCollection().modify((e) => { e.tag ??= null; }));
 * 索引にしない項目（text・category・done・archived など）は、ここに書かなくても保存できる。
 */
export function openDatabase(name: string = DB_NAME): OyasumiDB {
  const d = new Dexie(name) as OyasumiDB;
  d.version(1).stores({
    entries: 'id, kind, sleepDate, [kind+sleepDate], createdAt',
  });
  return d;
}

/** アプリで使うデータベース（最初の読み書きのときに開く） */
export const db = openDatabase();

/** 指定した id のデータが無いとき */
export class EntryNotFoundError extends Error {
  constructor(id: string) {
    super(`保存されたデータが見つかりません（id: ${id}）`);
    this.name = 'EntryNotFoundError';
  }
}

export interface SaveOptions {
  /** 夜と朝の境目。省略時は夜モードの判定と同じ DEFAULT_SCHEDULE（src/lib/time.ts）。sleepDate はこの値から決まる */
  schedule?: NightSchedule;
  /** メモの仕分け。フェーズ3 で classify()（Promise を返す）を渡す。省略時はすべて 'other' */
  classify?: (text: string) => Promise<Category>;
}

// ── 接続が切れたときの開き直し（テスター F-8） ──

/**
 * 接続が閉じている・切れたことによる失敗か。
 * - DatabaseClosedError：Dexie の接続が閉じている（close() のあと、ほかのタブの版上げで閉じられたときなど）
 * - InvalidStateError：IndexedDB の接続が使えなくなっている（Safari で長く置いたあとなど、と報告がある。未確認）
 * - UnknownError で「connection」を含む：Safari の「Connection to Indexed Database server lost」
 * 書き込みの中身の誤り（ConstraintError など）や容量不足（QuotaExceededError）は、開き直しても直らないので含めない
 */
export function isConnectionLost(error: unknown): boolean {
  const names = [error, (error as { inner?: unknown } | null)?.inner].map(
    (e) => (e as { name?: string } | null | undefined)?.name ?? '',
  );
  const message = String((error as { message?: string } | null)?.message ?? '');
  if (names.includes('DatabaseClosedError') || names.includes('InvalidStateError')) return true;
  return names.includes('UnknownError') && /connection|closed|lost/i.test(message);
}

let reopening: Promise<void> | null = null;

/** 接続を開き直す。同時に何か所から呼ばれても、開き直しは 1 回だけ */
function reopen(): Promise<void> {
  reopening ??= (async () => {
    if (db.isOpen()) db.close({ disableAutoOpen: false });
    await db.open();
  })().finally(() => {
    reopening = null;
  });
  return reopening;
}

/**
 * 読み書きを 1 回試し、接続が切れたことによる失敗なら、開き直して 1 回だけやり直す。
 * それでも失敗したら、その例外をそのまま投げる（呼び出し側は入力を画面に残す）。
 * op は 2 回呼ばれても結果が同じになるように書くこと（保存は id を先に決めておき、すでにあれば足さない）
 */
async function withReconnect<T>(op: () => Promise<T>): Promise<T> {
  try {
    return await op();
  } catch (error) {
    if (!isConnectionLost(error)) throw error;
    await reopen();
    return op();
  }
}

/** uuid。crypto.randomUUID は https か localhost でしか使えないので、無いときは getRandomValues で作る */
function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** 同じ夜の中は保存した順、夜どうしは新しい夜が先（US-12）。同じ時刻どうしは id 順にして、読むたびに並びが変わらないようにする */
function byNightThenTime(a: Entry, b: Entry): number {
  if (a.sleepDate !== b.sleepDate) return a.sleepDate < b.sleepDate ? 1 : -1;
  if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

// ── 保存 ──

/**
 * 分け終わったメモを 1 件ずつ保存する（声の入力で、認識の区切りごとにすでに分かれているとき用。フェーズ4）。
 * すべて保存できたか、1 件も保存されないかのどちらか（途中で失敗したら全部取り消して例外を投げる）。
 * @returns 保存したメモ（入力の順）
 */
export async function saveMemos(texts: string[], now: Date = new Date(), options: SaveOptions = {}): Promise<Memo[]> {
  const pieces = texts.map((t) => t.trim()).filter((t) => t !== '');
  if (pieces.length === 0) return [];
  const schedule = options.schedule ?? DEFAULT_SCHEDULE;
  const classify = options.classify ?? (async () => 'other' as const);
  const night = toSleepDate(now, schedule);
  const categories = await Promise.all(pieces.map((t) => classify(t)));
  const base = now.getTime();
  const memos: Memo[] = pieces.map((text, i) => ({
    id: newId(),
    kind: 'memo',
    text,
    category: categories[i],
    // 同じ回に分けたメモの並びを保つため、1 ミリ秒ずつずらす
    createdAt: base + i,
    updatedAt: base + i,
    sleepDate: night,
    done: false,
    archived: false,
  }));
  // 接続が切れて開き直したときに二重に保存しないよう、すでに同じ id があれば足さない（全部か何もなし、は変わらない）
  const ids = memos.map((m) => m.id);
  await withReconnect(() =>
    db.transaction('rw', db.entries, async () => {
      if ((await db.entries.where('id').anyOf(ids).count()) === memos.length) return;
      await db.entries.bulkAdd(memos);
    }),
  );
  return memos;
}

/**
 * テキストで預ける（US-02）。句点・改行・区切りの言葉で分けて 1 件ずつ保存する（src/lib/split.ts）。
 * 保存に失敗したら例外を投げる（1 件も保存されない）。呼び出し側は入力欄の文字を残すこと（US-04）。
 * @returns 保存した件数。空の入力なら 0（何も保存しない）
 */
export async function saveMemoText(text: string, now: Date = new Date(), options: SaveOptions = {}): Promise<number> {
  const saved = await saveMemos(splitMemoText(text), now, options);
  return saved.length;
}

/**
 * 日記を保存する（US-10・US-11）。1 回の保存 = 1 つの日記。分けない・仕分けない。
 * 保存に失敗したら例外を投げる。呼び出し側は入力欄の文字を残すこと。
 * @returns 保存した日記。空の入力なら null（何も保存しない）
 */
export async function saveDiary(text: string, now: Date = new Date(), options: SaveOptions = {}): Promise<Diary | null> {
  const body = text.trim();
  if (body === '') return null;
  const t = now.getTime();
  const diary: Diary = {
    id: newId(),
    kind: 'diary',
    text: body,
    createdAt: t,
    updatedAt: t,
    sleepDate: toSleepDate(now, options.schedule ?? DEFAULT_SCHEDULE),
  };
  // 開き直してやり直したときに二重に保存しないよう、すでに同じ id があれば足さない
  await withReconnect(() =>
    db.transaction('rw', db.entries, async () => {
      if (await db.entries.get(diary.id)) return;
      await db.entries.add(diary);
    }),
  );
  return diary;
}

// ── 読み出し ──

/** 1 件読む。無ければ undefined */
export async function getEntry(id: string): Promise<Entry | undefined> {
  return withReconnect(() => db.entries.get(id));
}

/**
 * その夜（sleepDate）の分を、保存した順に読む。kind を付けるとその種類だけ。
 * 例：listByNight('2026-10-24', 'memo') → その夜のメモ
 */
export async function listByNight<K extends EntryKind>(sleepDate: string, kind: K): Promise<EntryOf<K>[]>;
export async function listByNight(sleepDate: string): Promise<Entry[]>;
export async function listByNight(sleepDate: string, kind?: EntryKind): Promise<Entry[]> {
  const rows = await withReconnect(() =>
    kind
      ? db.entries.where('[kind+sleepDate]').equals([kind, sleepDate]).toArray()
      : db.entries.where('sleepDate').equals(sleepDate).toArray(),
  );
  return rows.sort(byNightThenTime);
}

/** ある種類のすべてを、新しい夜から順に（同じ夜の中は保存した順に）読む。日記の一覧（US-12）に使う */
export async function listByKind<K extends EntryKind>(kind: K): Promise<EntryOf<K>[]> {
  const rows = await withReconnect(() => db.entries.where('kind').equals(kind).toArray());
  return rows.sort(byNightThenTime) as EntryOf<K>[];
}

/** 保存されている件数。kind を付けるとその種類だけ */
export async function countEntries(kind?: EntryKind): Promise<number> {
  return withReconnect(() => (kind ? db.entries.where('kind').equals(kind).count() : db.entries.count()));
}

// ── 更新・削除 ──

/**
 * 本文を直す（メモの誤認識の直し US-22、日記の直し US-12、日記の途中保存への追記 US-10 方式K）。
 * 分類・その夜の日付は変えない。空には直せない（消すときは deleteEntry）。
 * 見つからなければ EntryNotFoundError、保存に失敗したらその例外を投げる
 */
export async function updateText(id: string, text: string, now: Date = new Date()): Promise<void> {
  const body = text.trim();
  if (body === '') throw new RangeError('本文を空にはできません。消すときは deleteEntry を使ってください');
  const changed = await withReconnect(() => db.entries.update(id, { text: body, updatedAt: now.getTime() }));
  if (changed === 0 && !(await getEntry(id))) throw new EntryNotFoundError(id);
}

/** メモの分類・完了・片付けを変える（US-23・US-24）。日記には使えない（見つからない扱い） */
export async function updateMemo(
  id: string,
  changes: Partial<Pick<Memo, 'category' | 'done' | 'archived'>>,
  now: Date = new Date(),
): Promise<void> {
  await withReconnect(() =>
    db.transaction('rw', db.entries, async () => {
      const current = await db.entries.get(id);
      if (!current || current.kind !== 'memo') throw new EntryNotFoundError(id);
      await db.entries.put({ ...current, ...changes, updatedAt: now.getTime() });
    }),
  );
}

/** 1 件消す。もう無いものを消しても何もしない（2 回押されても困らないように） */
export async function deleteEntry(id: string): Promise<void> {
  await withReconnect(() => db.entries.delete(id));
}

// ── 件数（朝の画面の簡易表示。screens.md S5「フェーズ2 の簡易表示」） ──

export interface EntryCounts {
  /** その夜のメモ・日記の件数 */
  nightMemos: number;
  nightDiaries: number;
  /** 端末に保存されているすべての件数（日付を問わない） */
  totalMemos: number;
  totalDiaries: number;
}

/** その夜（sleepDate）の件数と、全体の件数。読めなければ例外を投げる */
export async function countsForNight(sleepDate: string): Promise<EntryCounts> {
  const [nightMemos, nightDiaries, totalMemos, totalDiaries] = await withReconnect(() =>
    Promise.all([
      db.entries.where('[kind+sleepDate]').equals(['memo', sleepDate]).count(),
      db.entries.where('[kind+sleepDate]').equals(['diary', sleepDate]).count(),
      db.entries.where('kind').equals('memo').count(),
      db.entries.where('kind').equals('diary').count(),
    ]),
  );
  return { nightMemos, nightDiaries, totalMemos, totalDiaries };
}
