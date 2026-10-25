import type { Mode, Screen } from '../types';
import { DEFAULT_SCHEDULE, modeAt, type NightSchedule } from './time';

export interface ReturnResult {
  /** 出す画面 */
  screen: Screen;
  /** 今回判定した時間帯（次に戻ってきたときの「前回」になる） */
  mode: Mode;
}

/**
 * ページに戻ってきたとき（visibilitychange で visible・pageshow）に出す画面を決める。
 * - 前回判定したときと時間帯（夜/朝）が変わっていれば、その時間帯の画面にする。
 *   手で切り替えていても、設定画面を開いていても、時間帯が変わった時点で自動に戻す
 *   （夕方に開いたまま 18:00 を過ぎて戻ってきたとき、明るい朝の画面を夜に見せないため）
 * - 時間帯が変わっていなければ、今の画面のまま（手で選んだ画面を尊重する）
 */
export function screenOnReturn(
  current: Screen,
  lastMode: Mode,
  now: Date,
  schedule: NightSchedule = DEFAULT_SCHEDULE,
): ReturnResult {
  const mode = modeAt(now, schedule);
  return { screen: mode === lastMode ? current : mode, mode };
}
