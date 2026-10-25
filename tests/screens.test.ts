// 画面の骨組み（US-03・US-33・backlog §2）の確認。テスター役が追加（docs/test/phase1.md A-2）。
// 画面を HTML の文字列に描いて調べる（react-dom/server）。タップしての切り替えは PC のブラウザで確かめる（B-2）
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import { MorningScreen } from '../src/screens/MorningScreen';
import { NightScreen } from '../src/screens/NightScreen';
import { SettingsScreen } from '../src/screens/SettingsScreen';
import { initialNightState } from '../src/lib/nightFlow';

const noop = () => {};

const renderNight = () =>
  renderToStaticMarkup(createElement(NightScreen, { state: initialNightState, dispatch: noop, onMorning: noop }));
const zero = { nightMemos: 0, nightDiaries: 0, totalMemos: 0, totalDiaries: 0 };
const renderMorning = () =>
  renderToStaticMarkup(createElement(MorningScreen, { title: '10月24日の夜', counts: zero, onNight: noop, onSettings: noop }));
const renderSettings = () =>
  renderToStaticMarkup(createElement(SettingsScreen, { nightHours: '18:00〜翌 4:59', onBack: noop }));

/** 画面に出る文字だけ（タグと属性を除く） */
const visibleText = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

/** <button …>…</button> を 1 つずつ取り出す */
const buttons = (html: string): string[] => [...(html.match(/<button\b[^>]*>[\s\S]*?<\/button>/g) ?? [])];

const ariaLabel = (button: string) => button.match(/aria-label="([^"]*)"/)?.[1] ?? null;

describe('起動した時刻で最初の画面が決まる（US-33、初期値 18:00〜翌 4:59 が夜）', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const startAt = (h: number, m: number) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 25, h, m)); // 2026-10-25（端末の時刻）
    return renderToStaticMarkup(createElement(App));
  };

  it.each([
    ['17:59 は朝', 17, 59, 'morning'],
    ['18:00 は夜', 18, 0, 'night'],
    ['23:59 は夜', 23, 59, 'night'],
    ['0:00 は夜', 0, 0, 'night'],
    ['4:59 は夜', 4, 59, 'night'],
    ['5:00 は朝', 5, 0, 'morning'],
    ['12:00 は朝', 12, 0, 'morning'],
  ])('%s', (_label, h, m, expected) => {
    const html = startAt(h, m);
    if (expected === 'night') {
      expect(html).toContain('class="screen night"');
      expect(html).toContain('頭の中を預ける');
    } else {
      expect(html).toContain('class="screen morning"');
      expect(html).toContain('aria-label="夜の画面へ"');
    }
  });

  it('朝の時間帯に開くと、見出しは昨夜の日付（10/25 5:00 → 10月24日の夜）', () => {
    expect(startAt(5, 0)).toContain('10月24日の夜');
  });
});

describe('夜の画面（US-03）', () => {
  const html = renderNight();

  it('見出し（h1）は 1 つ', () => {
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
  });

  it('件数・時計を出さない（画面の文字に数字が無い）', () => {
    const text = visibleText(html);
    expect(text).not.toMatch(/[0-9０-９]/);
    expect(text).not.toMatch(/件/);
  });

  it('ナビゲーション（nav・リンク）を出さない', () => {
    expect(html).not.toMatch(/<nav[\s>]/);
    expect(html).not.toMatch(/<a[\s>]/);
    expect(html).not.toMatch(/role="(navigation|tablist)"/);
  });

  it('画面中央に大きなボタンが 1 つだけ（話すボタン）', () => {
    const rec = buttons(html).filter((b) => /class="rec"/.test(b));
    expect(rec).toHaveLength(1);
    expect(ariaLabel(rec[0] ?? '')).toBe('話して預ける');
    expect(html.indexOf('class="center"')).toBeLessThan(html.indexOf('class="rec"'));
  });

  it('右上の切替アイコンは小さなアイコンボタン（文字なし・aria-label「朝の画面へ」）で、header の中にある', () => {
    const header = html.match(/<header\b[^>]*>[\s\S]*?<\/header>/)?.[0] ?? '';
    // フェーズ2 から header の左上に日記の入口（文字のボタン）も入るので、アイコンのボタンだけを数える
    const icons = buttons(header).filter((b) => b.includes('class="icon-btn"'));
    expect(icons).toHaveLength(1);
    const icon = icons[0] ?? '';
    expect(icon).toContain('class="icon-btn"');
    expect(ariaLabel(icon)).toBe('朝の画面へ');
    expect(visibleText(icon)).toBe('');
  });

  it('知らせの行は role="status"（夜の画面のエラー・案内も同じ部品で出す）', () => {
    expect(html).toContain('role="status"');
  });
});

describe('朝の画面・設定（US-33 の手動切替と、設定への入り口）', () => {
  it('朝の画面の右上に「夜の画面へ」と「設定」', () => {
    const header = renderMorning().match(/<header\b[^>]*>[\s\S]*?<\/header>/)?.[0] ?? '';
    expect(buttons(header).map(ariaLabel)).toEqual(['夜の画面へ', '設定']);
  });

  it('朝の画面は、件数が 0 なら空の状態の文言を出す', () => {
    expect(renderMorning()).toContain('昨夜は何も預かっていません');
  });

  it('設定は見出し 1 つ・朝に戻るボタンあり・夜の時間帯の説明が出る', () => {
    const html = renderSettings();
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(buttons(html).map(ariaLabel)).toContain('朝の画面に戻る');
    expect(visibleText(html)).toContain('18:00〜翌 4:59');
  });

  it('設定のデータの扱いは spec §12 の文言', () => {
    expect(visibleText(renderSettings())).toContain(
      'メモの内容は、この端末の中にだけ保存されます。声を文字にするときは iPhone（Apple）の音声認識を使うため、話した音声は Apple のサーバーで処理されることがあります。',
    );
  });
});

describe('すべてのボタン（backlog §2）', () => {
  it.each([
    ['夜', renderNight()],
    ['朝', renderMorning()],
    ['設定', renderSettings()],
  ])('%s：読み上げ用の名前があり、type="button"', (_label, html) => {
    const list = buttons(html);
    expect(list.length).toBeGreaterThan(0);
    for (const b of list) {
      expect(b).toContain('type="button"');
      const name = ariaLabel(b) ?? visibleText(b);
      expect(name.trim()).not.toBe('');
    }
  });

  it('アイコンだけのボタンには必ず aria-label がある', () => {
    for (const html of [renderNight(), renderMorning(), renderSettings()]) {
      for (const b of buttons(html).filter((x) => x.includes('<svg'))) {
        expect(ariaLabel(b)).toBeTruthy();
        expect(b).toContain('aria-hidden="true"');
      }
    }
  });
});
