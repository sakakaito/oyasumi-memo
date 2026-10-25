import { describe, expect, it } from 'vitest';
import { screenOnReturn } from '../src/lib/autoSwitch';
import { latestNight } from '../src/lib/time';

// 端末の時刻（ローカル時刻）で日時を作る
const at = (y: number, mo: number, d: number, h: number, mi: number) => new Date(y, mo - 1, d, h, mi);

describe('screenOnReturn（ページに戻ってきたときの夜/朝の判定し直し。F-1）', () => {
  it('夕方に朝の画面で開いたまま 18:00 を過ぎて戻る → 夜の画面', () => {
    expect(screenOnReturn('morning', 'morning', at(2026, 10, 25, 18, 0))).toEqual({ screen: 'night', mode: 'night' });
  });

  it('夜に開いたまま 5:00 を過ぎて戻る → 朝の画面', () => {
    expect(screenOnReturn('night', 'night', at(2026, 10, 26, 5, 0))).toEqual({ screen: 'morning', mode: 'morning' });
  });

  it('手で切り替えていても、時間帯が変われば自動に戻す', () => {
    // 23:00 に開いて（夜）手で朝にした → 5:30 に戻った：時間帯が朝に変わったので朝の画面（自動）
    expect(screenOnReturn('morning', 'night', at(2026, 10, 26, 5, 30))).toEqual({ screen: 'morning', mode: 'morning' });
    // 7:00 に開いて（朝）手で夜にした → 18:30 に戻った：時間帯が夜に変わったので夜の画面（自動）
    expect(screenOnReturn('night', 'morning', at(2026, 10, 25, 18, 30))).toEqual({ screen: 'night', mode: 'night' });
  });

  it('設定画面を開いていても、時間帯が変われば その時間帯の画面にする', () => {
    expect(screenOnReturn('settings', 'morning', at(2026, 10, 25, 18, 0)).screen).toBe('night');
  });

  it('時間帯が変わっていなければ、手で選んだ画面のまま', () => {
    // 夜の時間帯に手で朝へ → 夜のうちに戻る：朝のまま
    expect(screenOnReturn('morning', 'night', at(2026, 10, 25, 23, 0))).toEqual({ screen: 'morning', mode: 'night' });
    // 朝の時間帯に手で夜へ → 朝のうちに戻る：夜のまま
    expect(screenOnReturn('night', 'morning', at(2026, 10, 25, 17, 59))).toEqual({ screen: 'night', mode: 'morning' });
    // 設定画面を開いたまま、同じ時間帯に戻る：設定のまま
    expect(screenOnReturn('settings', 'morning', at(2026, 10, 25, 12, 0)).screen).toBe('settings');
  });

  it('境目の直前はまだ変わらない（17:59・4:59）', () => {
    expect(screenOnReturn('morning', 'morning', at(2026, 10, 25, 17, 59)).screen).toBe('morning');
    expect(screenOnReturn('night', 'night', at(2026, 10, 26, 4, 59)).screen).toBe('night');
  });

  it('境目を変えた設定でも同じ値で判定する（22:00〜翌 5:59）', () => {
    const late = { nightStart: 22 * 60, morningStart: 6 * 60 };
    expect(screenOnReturn('morning', 'morning', at(2026, 10, 25, 21, 59), late).screen).toBe('morning');
    expect(screenOnReturn('morning', 'morning', at(2026, 10, 25, 22, 0), late).screen).toBe('night');
  });

  it('1 日以上たって同じ時間帯に戻ってきた場合は、前回と同じ時間帯なので画面は変えない', () => {
    // 前回の判定から日をまたいでも、判定するのは「今の時間帯」と「前回の時間帯」の違いだけ
    expect(screenOnReturn('settings', 'morning', at(2026, 10, 27, 12, 0)).screen).toBe('settings');
  });
});

describe('latestNight（朝の画面の見出しと本文が同じ夜を指す。F-2）', () => {
  it('朝の時間帯は昨夜：日付も呼び方も昨夜', () => {
    expect(latestNight(at(2026, 10, 25, 7, 30))).toEqual({ date: '2026-10-24', label: '昨夜' });
  });

  it('夜の時間帯（手で朝に切り替えたとき）は今夜：日付も呼び方も今夜', () => {
    expect(latestNight(at(2026, 10, 25, 23, 0))).toEqual({ date: '2026-10-25', label: '今夜' });
    expect(latestNight(at(2026, 10, 26, 0, 17))).toEqual({ date: '2026-10-25', label: '今夜' });
  });

  it('境目：4:59 は今夜、5:00 は昨夜（どちらも同じ夜の日付）', () => {
    expect(latestNight(at(2026, 10, 26, 4, 59))).toEqual({ date: '2026-10-25', label: '今夜' });
    expect(latestNight(at(2026, 10, 26, 5, 0))).toEqual({ date: '2026-10-25', label: '昨夜' });
  });
});
