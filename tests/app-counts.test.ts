// 朝の画面の件数のつなぎ方（App → useEntryCounts → MorningScreen）。テスター役が追加（docs/test/phase2.md A-6）。
// エンジニア作のテストは MorningScreen を単体で描いて確かめている。ここでは App 全体を描き、
// 「見出しの夜」「本文の今夜／昨夜」「件数を読む夜」が同じ夜を指すこと、夜の画面には件数が出ないことを確かめる。
// 端末の保存（IndexedDB）は読まず、件数の読み出し（useEntryCounts）だけを差し替える
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';

// vi.mock は import より前に動く（Vitest が先頭へ移す）
const hook = vi.hoisted(() => ({ calls: [] as (string | null)[] }));

vi.mock('../src/hooks/useEntryCounts', () => ({
  // どの画面でも件数を返す（夜の画面が件数を出さないことを、件数が「ある」状態で確かめるため）
  useEntryCounts: (sleepDate: string | null) => {
    hook.calls.push(sleepDate);
    return { nightMemos: 3, nightDiaries: 1, totalMemos: 12, totalDiaries: 4 };
  },
}));

const visibleText = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const startAt = (y: number, mo: number, d: number, h: number, mi: number) => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(y, mo - 1, d, h, mi));
  hook.calls.length = 0;
  return visibleText(renderToStaticMarkup(createElement(App)));
};

afterEach(() => {
  vi.useRealTimers();
});

describe('朝の画面：見出し・呼び方・件数を読む夜が同じ', () => {
  it.each<[string, [number, number, number, number, number], string, string]>([
    ['朝 7:30 → 前日の夜', [2026, 10, 25, 7, 30], '2026-10-24', '10月24日の夜'],
    ['朝の始まり 5:00 → 前日の夜（0:00〜4:59 の分も入る夜）', [2026, 10, 26, 5, 0], '2026-10-25', '10月25日の夜'],
    ['夜の直前 17:59 → 前日の夜', [2026, 10, 26, 17, 59], '2026-10-25', '10月25日の夜'],
    ['月をまたぐ 11/1 7:00 → 10/31 の夜', [2026, 11, 1, 7, 0], '2026-10-31', '10月31日の夜'],
  ])('%s', (_label, t, night, title) => {
    const text = startAt(...t);
    expect(hook.calls.length).toBeGreaterThan(0);
    expect(new Set(hook.calls)).toEqual(new Set([night]));
    expect(text).toContain(title);
    expect(text).toContain('昨夜は 3 件 預かっていました');
    expect(text).toContain('昨夜の日記 1 件');
    expect(text).toContain('メモ 12 件・日記 4 件');
    expect(text).not.toContain('今夜');
  });
});

describe('夜の画面：件数を読まず、出さない（US-03・US-04）', () => {
  it.each<[string, [number, number, number, number, number]]>([
    ['18:00', [2026, 10, 25, 18, 0]],
    ['23:00', [2026, 10, 25, 23, 0]],
    ['0:00', [2026, 10, 26, 0, 0]],
    ['4:59', [2026, 10, 26, 4, 59]],
  ])('%s に開く', (_label, t) => {
    const text = startAt(...t);
    expect(text).toContain('頭の中を預ける');
    // 件数を読む夜を渡さない（null）
    expect(hook.calls.every((c) => c === null)).toBe(true);
    // 件数が「ある」状態でも、夜の画面に数字・「件」は出ない
    expect(text).not.toMatch(/[0-9０-９]|件/);
  });
});
