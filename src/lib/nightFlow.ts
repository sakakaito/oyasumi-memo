/**
 * 夜の画面の流れ（S2 預ける・S1 今日の日記・S4 文字で書く。docs/design/screens.md 0-3・S1・S2）。
 * 画面（React）から切り離した状態の決まりと保存の手順。テストからもこのまま呼ぶ
 */
import { saveDiary, saveMemoText } from './db';

/** 文字で書く画面（S4）の種類：メモ用（S2 から）か日記用（S1 から） */
export type WriteKind = 'memo' | 'diary';

export interface NightState {
  /** 夜の画面のどちらを出しているか：S2（預ける）か S1（今日の日記） */
  view: 'S2' | 'S1';
  /** 文字で書く画面（S4）を開いているか。開いていればその種類 */
  sheet: WriteKind | null;
  /** 書きかけ。メモ用・日記用で別々に持つ（フェーズ2 はページを開いている間だけ。端末には残さない） */
  drafts: Record<WriteKind, string>;
  /** 保存に失敗した（S4 の 1 行に一言を出す。次に主ボタンを押したら消す） */
  failed: boolean;
  /** S1 で日記を残したか（右下を「次へ」にする）。S1 を離れたら戻す */
  diarySaved: boolean;
}

export const initialNightState: NightState = {
  view: 'S2',
  sheet: null,
  drafts: { memo: '', diary: '' },
  failed: false,
  diarySaved: false,
};

export type NightAction =
  | { type: 'openDiary' } // S2 左上「今日の日記」→ S1
  | { type: 'backToS2' } // S1 右下「戻る／次へ」→ S2
  | { type: 'openSheet' } // 「文字で書く」→ S4（いまの画面の種類で開く）
  | { type: 'closeSheet' } // S4「閉じる」。書きかけは残す
  | { type: 'input'; text: string }
  | { type: 'submitSuccess'; kind: WriteKind } // 保存できた種類（保存中に閉じられても、その種類の書きかけを消す）
  | { type: 'submitFailure' }
  | { type: 'clearFailure' };

export function nightReducer(state: NightState, action: NightAction): NightState {
  switch (action.type) {
    case 'openDiary':
      return { ...state, view: 'S1', sheet: null, diarySaved: false };
    case 'backToS2':
      return { ...state, view: 'S2', sheet: null, diarySaved: false };
    case 'openSheet':
      return { ...state, sheet: state.view === 'S1' ? 'diary' : 'memo', failed: false };
    case 'closeSheet':
      return { ...state, sheet: null, failed: false };
    case 'input':
      if (!state.sheet) return state;
      return { ...state, drafts: { ...state.drafts, [state.sheet]: action.text } };
    case 'submitSuccess': {
      const { kind } = action;
      return {
        ...state,
        sheet: null,
        failed: false,
        drafts: { ...state.drafts, [kind]: '' },
        diarySaved: state.diarySaved || kind === 'diary',
      };
    }
    case 'submitFailure':
      return { ...state, failed: true };
    case 'clearFailure':
      return { ...state, failed: false };
  }
}

/**
 * 夜／朝の自動の切り替えを止めておくか。S4 を開いている間と、書きかけがある間は止める
 * （4:59 に書いていて 5:00 過ぎに戻ってきたときに、書きかけが消えないように。screens.md 0-3）
 */
export function holdsAutoSwitch(state: NightState): boolean {
  return state.sheet !== null || state.drafts.memo !== '' || state.drafts.diary !== '';
}

/** 保存するものが無い入力か（空・空白だけ・句読点や記号だけ）。このときは保存も文言も出さない */
export function isBlankEntry(text: string): boolean {
  return !/[^\s　、。，．,.・…‥！？!?「」『』（）()［］[\]〜~ー－-]/.test(text);
}

/** 保存の知らせ（screens.md 0-2）。何件に分かれたか・何を預かったかは添えない */
export const SAVED_NOTICE: Record<WriteKind, string> = {
  memo: '預かりました',
  diary: '日記に残しました',
};

/** 保存に失敗したときの一言（screens.md 0-3） */
export const SAVE_FAILED = '保存できませんでした。文字は残っています';

export interface SaveDeps {
  saveMemoText: (text: string, now: Date) => Promise<number>;
  saveDiary: (text: string, now: Date) => Promise<unknown>;
}

const defaultDeps: SaveDeps = { saveMemoText, saveDiary };

/**
 * S4 の主ボタンを押したときの保存。メモ用は区切りで分けて保存、日記用は 1 つの日記として保存。
 * - 'blank'：保存するものが無い（何も保存しない）
 * - 'saved'：保存できた
 * - 'failed'：保存できなかった（例外は外に出さない。画面は文字を残して一言を出す）
 */
export async function submitEntry(
  kind: WriteKind,
  text: string,
  now: Date = new Date(),
  deps: SaveDeps = defaultDeps,
): Promise<'blank' | 'saved' | 'failed'> {
  if (isBlankEntry(text)) return 'blank';
  try {
    if (kind === 'memo') {
      const n = await deps.saveMemoText(text, now);
      if (n === 0) return 'blank';
    } else {
      const d = await deps.saveDiary(text, now);
      if (d === null) return 'blank';
    }
    return 'saved';
  } catch {
    return 'failed';
  }
}
