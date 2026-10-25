import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SCHEDULE,
  describeNightHours,
  formatNightTitle,
  isNight,
  latestNightDate,
  modeAt,
  sleepDate,
  type NightSchedule,
} from '../src/lib/time';

// 端末の時刻（ローカル時刻）で日時を作る
const at = (y: number, mo: number, d: number, h: number, mi: number) => new Date(y, mo - 1, d, h, mi);

describe('isNight / modeAt（初期値：18:00〜翌 4:59 が夜）', () => {
  it.each([
    ['17:59', 17, 59, false],
    ['18:00', 18, 0, true],
    ['23:59', 23, 59, true],
    ['0:00', 0, 0, true],
    ['4:59', 4, 59, true],
    ['5:00', 5, 0, false],
    ['12:00', 12, 0, false],
  ])('%s → 夜は %s', (_label, h, m, expected) => {
    const now = at(2026, 10, 25, h, m);
    expect(isNight(now)).toBe(expected);
    expect(modeAt(now)).toBe(expected ? 'night' : 'morning');
  });

  it('秒は見ない（4:59:59 はまだ夜）', () => {
    expect(isNight(new Date(2026, 9, 25, 4, 59, 59))).toBe(true);
  });
});

describe('sleepDate（その夜の日付。初期値は 5:00 で日付が変わる）', () => {
  it.each([
    ['10/24 18:00', at(2026, 10, 24, 18, 0), '2026-10-24'],
    ['10/24 23:59', at(2026, 10, 24, 23, 59), '2026-10-24'],
    ['10/25 0:00 は前日', at(2026, 10, 25, 0, 0), '2026-10-24'],
    ['10/25 4:59 は前日', at(2026, 10, 25, 4, 59), '2026-10-24'],
    ['10/25 5:00 は当日', at(2026, 10, 25, 5, 0), '2026-10-25'],
    ['10/25 17:59 は当日', at(2026, 10, 25, 17, 59), '2026-10-25'],
    ['月をまたぐ：11/1 0:30', at(2026, 11, 1, 0, 30), '2026-10-31'],
    ['年をまたぐ：1/1 3:00', at(2027, 1, 1, 3, 0), '2026-12-31'],
    ['うるう年：3/1 1:00', at(2028, 3, 1, 1, 0), '2028-02-29'],
  ])('%s → %s', (_label, now, expected) => {
    expect(sleepDate(now)).toBe(expected);
  });
});

describe('境目を変えたとき（夜の判定と sleepDate が同じ値で動く）', () => {
  it('22:00〜翌 5:59', () => {
    const late: NightSchedule = { nightStart: 22 * 60, morningStart: 6 * 60 };
    expect(isNight(at(2026, 10, 25, 21, 59), late)).toBe(false);
    expect(isNight(at(2026, 10, 25, 22, 0), late)).toBe(true);
    expect(isNight(at(2026, 10, 26, 5, 59), late)).toBe(true);
    expect(isNight(at(2026, 10, 26, 6, 0), late)).toBe(false);
    expect(sleepDate(at(2026, 10, 26, 5, 59), late)).toBe('2026-10-25');
    expect(sleepDate(at(2026, 10, 26, 6, 0), late)).toBe('2026-10-26');
  });

  it('0:00 をまたがない夜（1:00〜5:59）', () => {
    const s: NightSchedule = { nightStart: 60, morningStart: 6 * 60 };
    expect(isNight(at(2026, 10, 26, 0, 59), s)).toBe(false);
    expect(isNight(at(2026, 10, 26, 1, 0), s)).toBe(true);
    expect(isNight(at(2026, 10, 26, 6, 0), s)).toBe(false);
    expect(sleepDate(at(2026, 10, 26, 1, 0), s)).toBe('2026-10-25');
  });

  it('夜の始まりと朝の始まりが同じなら、夜は無い', () => {
    const s: NightSchedule = { nightStart: 300, morningStart: 300 };
    expect(isNight(at(2026, 10, 26, 5, 0), s)).toBe(false);
    expect(isNight(at(2026, 10, 26, 23, 0), s)).toBe(false);
  });
});

describe('latestNightDate（朝の画面の見出しの日付）', () => {
  it('朝の時間帯は昨夜', () => {
    expect(latestNightDate(at(2026, 10, 25, 7, 30))).toBe('2026-10-24');
    expect(latestNightDate(at(2026, 10, 25, 17, 59))).toBe('2026-10-24');
    expect(latestNightDate(at(2026, 11, 1, 5, 0))).toBe('2026-10-31');
  });

  it('夜の時間帯（手で朝に切り替えたとき）は今夜', () => {
    expect(latestNightDate(at(2026, 10, 25, 23, 0))).toBe('2026-10-25');
    expect(latestNightDate(at(2026, 10, 26, 2, 0))).toBe('2026-10-25');
  });
});

describe('表示用の文字', () => {
  it('formatNightTitle', () => {
    expect(formatNightTitle('2026-10-24')).toBe('10月24日の夜');
    expect(formatNightTitle('2027-01-05')).toBe('1月5日の夜');
  });

  it('describeNightHours', () => {
    expect(describeNightHours(DEFAULT_SCHEDULE)).toBe('18:00〜翌 4:59');
    expect(describeNightHours({ nightStart: 22 * 60 + 30, morningStart: 6 * 60 })).toBe('22:30〜翌 5:59');
    expect(describeNightHours({ nightStart: 60, morningStart: 6 * 60 })).toBe('1:00〜5:59');
    expect(describeNightHours({ nightStart: 18 * 60, morningStart: 0 })).toBe('18:00〜23:59');
  });
});
