// 画面：夜（預ける）・朝（振り返り）・設定。ルーターは使わず、React の状態で切り替える
export type Screen = 'night' | 'morning' | 'settings';

// 配色の種類。<html data-mode="..."> に入れて、theme.css の変数を切り替える
export type Mode = 'night' | 'morning';

// ── 保存するデータ（spec §4。メモと日記は同じ表に kind で入れる。理由は src/lib/db.ts の冒頭） ──

/** メモの分類（spec §6）。仕分け（classify）はフェーズ3 */
export type Category = 'todo' | 'worry' | 'idea' | 'other';

/** 保存するものの種類：預けた考えごと（memo）か、日記（diary）か */
export type EntryKind = 'memo' | 'diary';

/** メモと日記に共通の項目。エクスポート・全削除・日付の規則はこの項目だけで両方に効く */
interface EntryBase {
  /** uuid */
  id: string;
  kind: EntryKind;
  /** 本文 */
  text: string;
  /** 保存した時刻（UNIX ミリ秒） */
  createdAt: number;
  /** 最後に直した時刻（UNIX ミリ秒）。直していなければ createdAt と同じ */
  updatedAt: number;
  /** その夜の日付 'YYYY-MM-DD'（朝の始まりより前は前日。src/lib/time.ts の sleepDate） */
  sleepDate: string;
}

/** 預けた考えごと。区切りごとに 1 件 */
export interface Memo extends EntryBase {
  kind: 'memo';
  /** 自動仕分けの結果（あとから利用者が変えられる） */
  category: Category;
  /** 朝に「完了」にしたか */
  done: boolean;
  /** 「全部見た」で片付けたか */
  archived: boolean;
}

/** 日記。1 回の保存 = 1 つの日記。分けない・仕分けない・「全部見た」で片付けない */
export interface Diary extends EntryBase {
  kind: 'diary';
}

export type Entry = Memo | Diary;

/** 種類から型を引く（EntryOf<'diary'> → Diary） */
export type EntryOf<K extends EntryKind> = Extract<Entry, { kind: K }>;
