// テスターの指摘 F-2・F-3 を直したことの確認（画面を HTML の文字列に描いて調べる）
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import { MorningScreen } from '../src/screens/MorningScreen';
import { SettingsScreen } from '../src/screens/SettingsScreen';

const noop = () => {};
const visibleText = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

describe('F-2 朝の画面の見出しと本文が同じ夜を指す', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('今夜の分を見ているときは「今夜は…」', () => {
    const html = renderToStaticMarkup(
      createElement(MorningScreen, { title: '10月25日の夜', nightLabel: '今夜', onNight: noop, onSettings: noop }),
    );
    expect(visibleText(html)).toContain('今夜は何も預かっていません');
    expect(visibleText(html)).not.toContain('昨夜');
  });

  it('朝の時間帯に開くと、見出しは昨夜の日付で本文も「昨夜は…」', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 25, 7, 30));
    const text = visibleText(renderToStaticMarkup(createElement(App)));
    expect(text).toContain('10月24日の夜');
    expect(text).toContain('昨夜は何も預かっていません');
  });
});

describe('F-3 設定画面の文言が、その画面の操作と食い違わない', () => {
  const text = visibleText(
    renderToStaticMarkup(createElement(SettingsScreen, { nightHours: '18:00〜翌 4:59', onBack: noop })),
  );

  it('「各画面の右上のアイコン」とは書かない（設定画面の右上にはアイコンが無い）', () => {
    expect(text).not.toContain('各画面の右上');
    expect(text).toContain('夜の画面と朝の画面の右上のアイコン');
  });
});
