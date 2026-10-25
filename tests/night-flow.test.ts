// 夜の画面の「文字で書く」（plan フェーズ2 2-E、screens.md 0-3・S1・S2・S5 の簡易表示、US-02・US-04・US-11）。
// 既存の流儀に合わせ、画面は HTML の文字列に描いて調べ、流れは状態の決まり（nightReducer）と保存の手順（submitEntry）で確かめる。
// タップしたときのフォーカス・キーボード・知らせが消えるまでの時間は、ブラウザと iPhone で確かめる
import 'fake-indexeddb/auto';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { WriteSheet } from '../src/components/WriteSheet';
import { screenOnReturn } from '../src/lib/autoSwitch';
import { countEntries, db, listByKind } from '../src/lib/db';
import {
  SAVED_NOTICE,
  SAVE_FAILED,
  holdsAutoSwitch,
  initialNightState,
  isBlankEntry,
  nightReducer,
  submitEntry,
  type NightAction,
  type NightState,
  type WriteKind,
} from '../src/lib/nightFlow';
import { MorningScreen } from '../src/screens/MorningScreen';
import { NightScreen } from '../src/screens/NightScreen';
import { readText } from './helpers/files.mjs';

const noop = () => {};
const at = (y: number, mo: number, d: number, h: number, mi: number) => new Date(y, mo - 1, d, h, mi);
const visibleText = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const buttons = (html: string): string[] => [...(html.match(/<button\b[^>]*>[\s\S]*?<\/button>/g) ?? [])];
const ariaLabel = (b: string) => b.match(/aria-label="([^"]*)"/)?.[1] ?? null;

const run = (...actions: NightAction[]): NightState => actions.reduce(nightReducer, initialNightState);
const renderNight = (state: NightState) =>
  renderToStaticMarkup(createElement(NightScreen, { state, dispatch: noop, onMorning: noop }));
const renderSheet = (kind: WriteKind, text: string, failed = false) =>
  renderToStaticMarkup(
    createElement(WriteSheet, {
      kind,
      text,
      failed,
      textareaRef: { current: null },
      onInput: noop,
      onSubmit: noop,
      onClose: noop,
    }),
  );

afterEach(async () => {
  await db.entries.clear();
});

describe('空・空白だけ・句読点だけのときは保存しない', () => {
  it.each(['', '   ', '\n\n', '。。', '、。！？', '　・…'])('%j は空とみなす', (text) => {
    expect(isBlankEntry(text)).toBe(true);
  });

  it.each(['あ', '明日', '1', 'a'])('%j は空ではない', (text) => {
    expect(isBlankEntry(text)).toBe(false);
  });

  it.each<WriteKind>(['memo', 'diary'])('%s：submitEntry は blank を返し、何も保存しない', async (kind) => {
    expect(await submitEntry(kind, ' 。、 ', at(2026, 10, 25, 23, 0))).toBe('blank');
    expect(await countEntries()).toBe(0);
  });

  it('空のあいだ主ボタンは aria-disabled="true"。disabled 属性は使わない', () => {
    const empty = buttons(renderSheet('memo', '')).find((b) => b.includes('預ける')) ?? '';
    expect(empty).toContain('aria-disabled="true"');
    expect(empty).not.toMatch(/\sdisabled(=|\s|>)/);
    const filled = buttons(renderSheet('memo', '明日は資料を出す')).find((b) => b.includes('預ける')) ?? '';
    expect(filled).toContain('aria-disabled="false"');
  });
});

describe('保存できたら S4 が閉じて知らせが出る', () => {
  it('メモ：区切りごとに保存され、S4 が閉じ、書きかけが空になる', async () => {
    const opened = run({ type: 'openSheet' }, { type: 'input', text: '明日は資料を出す。それと歯医者の予約' });
    expect(opened.sheet).toBe('memo');
    expect(await submitEntry('memo', opened.drafts.memo, at(2026, 10, 25, 23, 0))).toBe('saved');
    expect(await countEntries('memo')).toBe(2);

    const after = nightReducer(opened, { type: 'submitSuccess', kind: 'memo' });
    expect(after.sheet).toBeNull();
    expect(after.drafts.memo).toBe('');
    expect(after.view).toBe('S2');
    // S4 ではなく S2 に戻っている（入力欄が無い）
    expect(renderNight(after)).not.toContain('<textarea');
    expect(renderNight(after)).toContain('頭の中を預ける');
  });

  it('知らせの文言はメモ「預かりました」・日記「日記に残しました」だけ（件数・中身を添えない）', () => {
    expect(SAVED_NOTICE).toEqual({ memo: '預かりました', diary: '日記に残しました' });
  });

  it('保存中に閉じられても、保存できた種類の書きかけを消す（同じ文を二度保存しないように）', () => {
    const s = run({ type: 'openSheet' }, { type: 'input', text: '考えごと' }, { type: 'closeSheet' });
    expect(nightReducer(s, { type: 'submitSuccess', kind: 'memo' }).drafts.memo).toBe('');
  });
});

describe('保存できなかったら S4 のまま文字が残る', () => {
  const failing = {
    saveMemoText: async () => {
      throw new Error('書き込みに失敗');
    },
    saveDiary: async () => {
      throw new Error('書き込みに失敗');
    },
  };

  it.each<WriteKind>(['memo', 'diary'])('%s：submitEntry は例外を外に出さず failed を返す', async (kind) => {
    expect(await submitEntry(kind, '明日は資料を出す', at(2026, 10, 25, 23, 0), failing)).toBe('failed');
  });

  it('状態：S4 は閉じず、書きかけもそのまま。次に押したら一言を消す', () => {
    const s = run({ type: 'openSheet' }, { type: 'input', text: '明日は資料を出す' }, { type: 'submitFailure' });
    expect(s).toMatchObject({ sheet: 'memo', failed: true, drafts: { memo: '明日は資料を出す', diary: '' } });
    expect(nightReducer(s, { type: 'clearFailure' }).failed).toBe(false);
  });

  it('画面：入力欄に文字が残り、role="alert" の 1 行に「保存できませんでした。文字は残っています」', () => {
    const html = renderSheet('memo', '明日は資料を出す', true);
    expect(html).toMatch(/<textarea[^>]*>明日は資料を出す<\/textarea>/);
    expect(html).toMatch(new RegExp(`<p class="wline" role="alert">${SAVE_FAILED}</p>`));
  });

  it('ふだんは 1 行を空にしておく（高さは CSS で確保）', () => {
    expect(renderSheet('memo', '明日')).toContain('<p class="wline" role="alert"></p>');
  });
});

describe('日記の入口から日記として保存される', () => {
  it('S2「今日の日記」→ S1 →「文字で書く」で日記用の S4 が開く', () => {
    const s1 = run({ type: 'openDiary' });
    expect(s1.view).toBe('S1');
    const html = renderNight(s1);
    expect(html).toContain('今日のこと');
    expect(html).toContain('今日あったことを、日記に残せます');
    expect(nightReducer(s1, { type: 'openSheet' }).sheet).toBe('diary');
  });

  it('日記用から送った文は、区切りがあっても 1 つの日記になる（メモにはならない）', async () => {
    const text = '今日は会議が長かった。それと雨が降った\nあと、帰りに本屋';
    const s = run({ type: 'openDiary' }, { type: 'openSheet' }, { type: 'input', text });
    expect(await submitEntry(s.sheet!, s.drafts.diary, at(2026, 10, 25, 23, 0))).toBe('saved');
    expect(await countEntries('memo')).toBe(0);
    expect((await listByKind('diary')).map((d) => d.text)).toEqual([text]);
  });

  it('日記を残したら S1 の右下が「次へ」になる。S1 を離れたら「戻る」に戻る', () => {
    const before = run({ type: 'openDiary' });
    const backBtn = (st: NightState) => buttons(renderNight(st)).find((b) => b.includes('預ける画面へ')) ?? '';
    expect(ariaLabel(backBtn(before))).toBe('戻る（預ける画面へ）');
    const saved = run({ type: 'openDiary' }, { type: 'openSheet' }, { type: 'input', text: '日記' }, { type: 'submitSuccess', kind: 'diary' });
    expect(saved.view).toBe('S1');
    expect(ariaLabel(backBtn(saved))).toBe('次へ（預ける画面へ）');
    expect(visibleText(backBtn(saved))).toBe('次へ');
    expect(nightReducer(nightReducer(saved, { type: 'backToS2' }), { type: 'openDiary' }).diarySaved).toBe(false);
  });

  it('S2 の左上に小さな「今日の日記」（aria-label「今日の日記へ」）。S1 の左上には何も置かない', () => {
    const header = (html: string) => html.match(/<header\b[^>]*>[\s\S]*?<\/header>/)?.[0] ?? '';
    const s2 = buttons(header(renderNight(initialNightState)));
    expect(s2.map(ariaLabel)).toEqual(['今日の日記へ', '朝の画面へ']);
    expect(s2[0]).toContain('class="text-btn"');
    expect(buttons(header(renderNight(run({ type: 'openDiary' })))).map(ariaLabel)).toEqual(['朝の画面へ']);
  });
});

describe('夜の画面に保存した文字・件数を出さない（US-04）', () => {
  it('保存したあとの S2・S1、もう一度開いた S4 に、保存した文が出ない', async () => {
    const memo = '歯医者の予約を忘れずに';
    const diary = '今日は長い一日だった';
    let s = run({ type: 'openSheet' }, { type: 'input', text: memo });
    await submitEntry('memo', memo, at(2026, 10, 25, 23, 0));
    s = nightReducer(s, { type: 'submitSuccess', kind: 'memo' });
    s = ([{ type: 'openDiary' }, { type: 'openSheet' }, { type: 'input', text: diary }] as NightAction[]).reduce(nightReducer, s);
    await submitEntry('diary', diary, at(2026, 10, 25, 23, 5));
    s = nightReducer(s, { type: 'submitSuccess', kind: 'diary' });

    for (const st of [s, nightReducer(s, { type: 'backToS2' })]) {
      const text = visibleText(renderNight(st));
      expect(text).not.toContain(memo);
      expect(text).not.toContain(diary);
      expect(text).not.toMatch(/[0-9０-９]|件/);
    }
    // もう一度開いた S4 の入力欄は空（前に預けた文は出さない）
    expect(renderNight(nightReducer(s, { type: 'openSheet' }))).toMatch(/<textarea[^>]*><\/textarea>/);
    expect(renderNight(nightReducer(nightReducer(s, { type: 'backToS2' }), { type: 'openSheet' }))).toMatch(
      /<textarea[^>]*><\/textarea>/,
    );
  });
});

describe('書きかけ（閉じても消さない。メモ用・日記用で別々）', () => {
  it('閉じて開き直すと、その種類の書きかけだけが戻る', () => {
    let s = run({ type: 'openSheet' }, { type: 'input', text: 'メモの書きかけ' }, { type: 'closeSheet' });
    s = ([{ type: 'openDiary' }, { type: 'openSheet' }, { type: 'input', text: '日記の書きかけ' }, { type: 'closeSheet' }] as NightAction[]).reduce(
      nightReducer,
      s,
    );
    expect(s.drafts).toEqual({ memo: 'メモの書きかけ', diary: '日記の書きかけ' });
    expect(renderNight(nightReducer(s, { type: 'openSheet' }))).toContain('>日記の書きかけ</textarea>');
    const s2 = nightReducer(nightReducer(s, { type: 'backToS2' }), { type: 'openSheet' });
    expect(renderNight(s2)).toContain('>メモの書きかけ</textarea>');
  });

  it('S4 を開いている間・書きかけがある間は、夜／朝の自動の切り替えを止める', () => {
    expect(holdsAutoSwitch(initialNightState)).toBe(false);
    expect(holdsAutoSwitch(run({ type: 'openSheet' }))).toBe(true);
    expect(holdsAutoSwitch(run({ type: 'openSheet' }, { type: 'input', text: 'あ' }, { type: 'closeSheet' }))).toBe(true);
    // 4:59 に書いていて、5:00 過ぎに戻ってきた：夜のまま、「前回」も夜のまま
    expect(screenOnReturn('night', 'night', at(2026, 10, 26, 5, 1), undefined, true)).toEqual({ screen: 'night', mode: 'night' });
    expect(screenOnReturn('night', 'night', at(2026, 10, 26, 5, 1), undefined, false).screen).toBe('morning');
  });
});

describe('S4 の画面（screens.md 0-3）', () => {
  it.each<[WriteKind, string, string, string, string]>([
    ['memo', '文字で預ける', '預けたいこと', '思いついた順に、そのままどうぞ', '預ける'],
    ['diary', '文字で日記を書く', '今日の日記', '今日あったことを、そのままどうぞ', '日記に残す'],
  ])('%s：見出し・入力欄・主ボタンの文言', (kind, title, aria, placeholder, submit) => {
    const html = renderSheet(kind, '');
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(html).toContain(`>${title}</h1>`);
    const textarea = html.match(/<textarea[^>]*>/)?.[0] ?? '';
    expect(textarea).toContain(`aria-label="${aria}"`);
    expect(textarea).toContain(`placeholder="${placeholder}"`);
    // HTML の属性名は大文字小文字を区別しない（React は spellCheck のように書き出す）
    expect(textarea).toMatch(/spellcheck="false"/i);
    expect(textarea).toMatch(/enterkeyhint="enter"/i);
    expect(textarea).toMatch(/autocomplete="off"/i);
    expect(buttons(html).map((b) => visibleText(b))).toEqual(['閉じる', submit]);
    expect(buttons(html).map(ariaLabel)[0]).toBe('閉じる');
  });

  it('S4 を開いている間は、夜の画面の中身と差し替わる（話すボタンなどは出さない。h1 は 1 つ）', () => {
    const html = renderNight(run({ type: 'openSheet' }));
    expect(html).not.toContain('class="rec"');
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(html).toContain('class="screen night write"');
  });

  it('CSS：キーボードを暗くする color-scheme（夜は dark だけ、朝は light、入力欄も dark）', () => {
    const theme: string = readText('src/styles/theme.css').replace(/\/\*[\s\S]*?\*\//g, '');
    const app: string = readText('src/styles/app.css').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(theme).toMatch(/:root\s*\{[^}]*color-scheme:\s*dark;/);
    expect(theme).toMatch(/:root\[data-mode="morning"\]\s*\{[^}]*color-scheme:\s*light;/);
    expect(app).toMatch(/\.write \.entry\s*\{[^}]*color-scheme:\s*dark;/);
    expect(app).toMatch(/\.write \.entry\s*\{[^}]*font-size:\s*var\(--fs-body\)/);
  });
});

describe('朝の画面の簡易表示（screens.md S5「フェーズ2 の簡易表示」）', () => {
  const render = (counts: Parameters<typeof MorningScreen>[0]['counts'], nightLabel: '今夜' | '昨夜' = '昨夜') =>
    visibleText(
      renderToStaticMarkup(createElement(MorningScreen, { title: '10月25日の夜', nightLabel, counts, onNight: noop, onSettings: noop })),
    );

  it('その夜の件数・日記の件数と、確認用の合計を出す', () => {
    const html = renderToStaticMarkup(
      createElement(MorningScreen, {
        title: '10月25日の夜',
        nightLabel: '今夜',
        counts: { nightMemos: 2, nightDiaries: 1, totalMemos: 12, totalDiaries: 3 },
        onNight: noop,
        onSettings: noop,
      }),
    );
    const text = visibleText(html);
    expect(text).toContain('今夜は 2 件 預かっていました');
    expect(text).toContain('今夜の日記 1 件');
    expect(html).toContain('<h2 id="saved-total">保存されている件数（確認用）</h2>');
    expect(text).toContain('メモ 12 件・日記 3 件');
    expect(text).toContain('確かめるための表示です。昼に書いた分は、その日の夜の分として数えます。');
    // h1 → h2 の順
    expect(html.indexOf('<h1')).toBeLessThan(html.indexOf('<h2'));
  });

  it('その夜が 0 件なら「何も預かっていません」、日記は 0 件でも出す', () => {
    const text = render({ nightMemos: 0, nightDiaries: 0, totalMemos: 5, totalDiaries: 0 });
    expect(text).toContain('昨夜は何も預かっていません');
    expect(text).toContain('昨夜の日記 0 件');
    expect(text).toContain('メモ 5 件・日記 0 件');
  });

  it('読み込めなかったとき・読み込み中', () => {
    expect(render('error')).toContain('件数を読み込めませんでした。アプリを開き直してください');
    expect(render(null)).not.toMatch(/件/);
  });
});
