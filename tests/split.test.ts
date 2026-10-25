// 区切りの規則（plan フェーズ2 2-C・2-F、backlog US-01 方式K・US-02、spec §6）
import { describe, expect, it } from 'vitest';
import { splitMemoText } from '../src/lib/split';

describe('splitMemoText：分ける', () => {
  it.each<[string, string, string[]]>([
    ['句点と「それと」（オーナーの確認手順の例）', '明日は資料を出す。それと歯医者の予約', ['明日は資料を出す', '歯医者の予約']],
    ['句点だけ', '牛乳を買う。部長に電話。', ['牛乳を買う', '部長に電話']],
    ['改行（空の行は捨てる）', '牛乳を買う\n\n部長に電話\n', ['牛乳を買う', '部長に電話']],
    ['改行（CRLF）', '牛乳を買う\r\n部長に電話', ['牛乳を買う', '部長に電話']],
    ['読点のあとの「それと」', '資料を出す、それと歯医者の予約', ['資料を出す', '歯医者の予約']],
    ['読点のあとの「あと」', '資料を出す、あと歯医者の予約', ['資料を出す', '歯医者の予約']],
    ['句点のあとの「あと、」', '資料を出す。あと、歯医者の予約', ['資料を出す', '歯医者の予約']],
    ['空白のあとの「それから」', '資料を出す それから歯医者の予約', ['資料を出す', '歯医者の予約']],
    ['全角空白のあとの「あとは」', '資料を出す　あとは歯医者の予約', ['資料を出す', '歯医者の予約']],
    ['「ついでに」', '資料を出す。ついでに牛乳も買う', ['資料を出す', '牛乳も買う']],
    ['「？」「！」は文の後ろに残す', '大丈夫かな？明日のプレゼン！ 締め切りは金曜', ['大丈夫かな？', '明日のプレゼン！', '締め切りは金曜']],
    ['続けて並んだ「？！」も 1 つの文に残す', 'え、本当に？！それと電話', ['え、本当に？！', '電話']],
    ['3 つ以上に分ける', '明日やること。メールを返す、それと資料を直す、あと歯医者', ['明日やること', 'メールを返す', '資料を直す', '歯医者']],
  ])('%s', (_label, input, expected) => {
    expect(splitMemoText(input)).toEqual(expected);
  });
});

describe('splitMemoText：誤って切らない', () => {
  it.each<[string, string, string[]]>([
    ['「あとで」', 'あとで部長に電話する', ['あとで部長に電話する']],
    ['読点のあとの「あとで」', '資料を出す、あとで見直す', ['資料を出す、あとで見直す']],
    ['「あとから」', '資料を出す、あとから見直す', ['資料を出す、あとから見直す']],
    ['「あと3日」（残り）', 'あと3日で締め切り', ['あと3日で締め切り']],
    ['「あと１時間」（全角の数字）', 'あと１時間しか寝られない', ['あと１時間しか寝られない']],
    ['「あと一回」（漢数字）', 'あと一回だけ見直す', ['あと一回だけ見直す']],
    ['「あと少し」', 'あと少しで終わる', ['あと少しで終わる']],
    ['「あと回し」', 'あと回しにしていた請求書', ['あと回しにしていた請求書']],
    ['「あとのこと」', 'あとのことは明日考える', ['あとのことは明日考える']],
    ['言葉の途中の「あと」（そのあと・足あと）', 'そのあと寝る。足あとが気になる', ['そのあと寝る', '足あとが気になる']],
    ['「それとも」', 'それとも明日にするか迷う', ['それとも明日にするか迷う']],
    ['「それと同時に」', 'それと同時に不安もある', ['それと同時に不安もある']],
    ['言葉の途中の「それと」（これとそれと）', 'これとそれとを比べる', ['これとそれとを比べる']],
    ['「それから先」', 'それから先が心配', ['それから先が心配']],
    ['かっこの中の句点・区切りの言葉', '「明日やる。あと寝る」と言われた', ['「明日やる。あと寝る」と言われた']],
  ])('%s', (_label, input, expected) => {
    expect(splitMemoText(input)).toEqual(expected);
  });
});

describe('splitMemoText：分けられないとき・空のとき', () => {
  it('区切りが無ければ 1 件', () => {
    expect(splitMemoText('明日は資料を出す')).toEqual(['明日は資料を出す']);
  });

  it('前後の空白と最後の句点を落とす', () => {
    expect(splitMemoText('  明日は資料を出す。  ')).toEqual(['明日は資料を出す']);
  });

  it('区切りの言葉だけの入力も、失わずに 1 件にする', () => {
    expect(splitMemoText('それと')).toEqual(['それと']);
    expect(splitMemoText('あと。')).toEqual(['あと']);
  });

  it.each(['', '   ', '\n\n', '。。', '、'])('空・記号だけ（%j）なら 0 件', (input) => {
    expect(splitMemoText(input)).toEqual([]);
  });
});

// テスター F-5〜F-7（docs/test/phase2.md）。まとめ役の基準：利用者が書いた言葉を 1 文字も失わない。迷ったら切らない
describe('splitMemoText：言葉の一部を切り取らない（F-7）', () => {
  it.each<[string, string[]]>([
    ['あとさき考えずに買った', ['あとさき考えずに買った']],
    ['あとずさりした', ['あとずさりした']],
    ['資料を出す、あとずさりした', ['資料を出す、あとずさりした']],
    ['あと払いにした', ['あと払いにした']],
    ['あと味が悪い', ['あと味が悪い']],
    ['それからどうしよう', ['それからどうしよう']],
    ['ついでにんじん', ['ついでにんじん']],
  ])('%s', (input, expected) => {
    expect(splitMemoText(input)).toEqual(expected);
  });

  it('続きがまた区切りの言葉なら（「それとあと」）まとめて区切る', () => {
    expect(splitMemoText('資料を出す、それとあと歯医者')).toEqual(['資料を出す', '歯医者']);
  });
});

describe('splitMemoText：閉じていないかっこ・閉じかっこのあと（F-5・F-6）', () => {
  it.each<[string, string[]]>([
    ['疲れた(^^; それと歯医者', ['疲れた(^^;', '歯医者']],
    ['疲れた(^^;。あと歯医者', ['疲れた(^^;', '歯医者']],
    ['「明日やる。あと寝る', ['「明日やる', '寝る']],
    ['（笑）それと歯医者', ['（笑）', '歯医者']],
    ['「明日やる」それと歯医者', ['「明日やる」', '歯医者']],
    ['(^_^)あと寝る', ['(^_^)', '寝る']],
    ['^^)それと電話', ['^^)', '電話']],
  ])('%s', (input, expected) => {
    expect(splitMemoText(input)).toEqual(expected);
  });

  it('閉じているかっこの中では、今までどおり切らない', () => {
    expect(splitMemoText('「明日やる。あと寝る」と言われた')).toEqual(['「明日やる。あと寝る」と言われた']);
    expect(splitMemoText('疲れた(^^; 「それと」と言った')).toEqual(['疲れた(^^; 「それと」と言った']);
  });

  it('かっこの対は同じ行の中だけ（次の行の閉じかっこと対にしない）', () => {
    expect(splitMemoText('疲れた(^^; それと歯医者\n電話する)')).toEqual(['疲れた(^^;', '歯医者', '電話する)']);
  });
});

/**
 * 落としてよいのは区切りの記号と区切りの言葉だけ、という性質の点検。
 * 元の文と、分けた結果をつないだものの両方から区切りの記号（「。」・読点・空白・改行）を除き、
 * 元の文から区切りの言葉だけを抜けば、分けた結果と一致すること（それ以外の文字は 1 文字も消えない・増えない）。
 * さらに、抜いた区切りの言葉のすぐあと（元の文で）がひらがなのときは、そこからまた区切りの言葉が始まること
 * （「あとさき」の「あと」のように、言葉の一部を区切りの言葉として抜いていないこと。F-7）
 */
const SEPARATOR = /[。、，,\s　]/;
const DROPPABLE = ['それから', 'それと', 'ついでに', 'あとは', 'あとね', 'あと'];
function onlyConnectorsDropped(original: string, pieces: string[]): boolean {
  const kept = [...original].map((c, idx) => ({ c, idx })).filter(({ c }) => !SEPARATOR.test(c));
  const o = kept.map(({ c }) => c).join('');
  const p = [...pieces.join('')].filter((c) => !SEPARATOR.test(c)).join('');
  /** o の i 文字目から始まる言葉 w を抜いてよいか（元の文で、すぐあとがひらがなの言葉の一部でない） */
  const droppable = (i: number, w: string): boolean => {
    const end = kept[i + w.length - 1].idx + 1;
    if (!/^[ぁ-ゟ]/.test(original.slice(end))) return true;
    return DROPPABLE.some((v) => original.startsWith(v, end));
  };
  const memo = new Map<string, boolean>();
  const match = (i: number, j: number): boolean => {
    const key = `${i},${j}`;
    const hit = memo.get(key);
    if (hit !== undefined) return hit;
    let ok = false;
    if (i === o.length) ok = j === p.length;
    else {
      if (j < p.length && o[i] === p[j]) ok = match(i + 1, j + 1);
      for (const w of DROPPABLE) if (!ok && o.startsWith(w, i) && droppable(i, w)) ok = match(i + w.length, j);
    }
    memo.set(key, ok);
    return ok;
  };
  return match(0, 0);
}

describe('splitMemoText：落とすのは区切りの記号と区切りの言葉だけ（性質のテスト）', () => {
  const examples = [
    '明日は資料を出す。それと歯医者の予約',
    'あとさき考えずに買った',
    '疲れた(^^; それと歯医者',
    '（笑）それと歯医者',
    '「明日やる。あと寝る」と言われた',
    'え、本当に？！それと電話',
    'それと',
    'あと。',
    '資料を出す、それとあと歯医者',
  ];
  it.each(examples)('%s', (input) => {
    expect(onlyConnectorsDropped(input, splitMemoText(input))).toBe(true);
  });

  it('点検そのものが、言葉の一部を抜いた結果（直す前の F-7）や文字の欠けを見逃さない', () => {
    expect(onlyConnectorsDropped('あとさき考えずに買った', ['さき考えずに買った'])).toBe(false);
    expect(onlyConnectorsDropped('明日は資料を出す。それと歯医者', ['明日は資料を出', '歯医者'])).toBe(false);
    expect(onlyConnectorsDropped('明日は資料を出す。それと歯医者', ['明日は資料を出す', '歯医者'])).toBe(true);
  });

  it('言葉・区切り・かっこ・顔文字を組み合わせた 3000 通りでも、ほかの文字は消えない', () => {
    const parts = [
      '明日', '資料を出す', '歯医者', '考えずに買った', '寝る', '3日', 'メール', 'A',
      'それと', 'それから', 'あと', 'あとで', 'あとさき', 'あとは', 'あとね', 'ついでに', 'も', 'は', 'の', 'で', 'ずさり',
      '。', '、', ' ', '　', '\n', '？', '！', '(^^;', '（笑）', '「', '」', '(', ')', '…',
    ];
    // 毎回同じ並びになる疑似乱数（失敗したときに再現できるように）
    let seed = 20261026;
    const rand = (n: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % n;
    };
    for (let k = 0; k < 3000; k++) {
      let input = '';
      const len = 1 + rand(12);
      for (let m = 0; m < len; m++) input += parts[rand(parts.length)];
      const pieces = splitMemoText(input);
      expect(onlyConnectorsDropped(input, pieces), JSON.stringify(input)).toBe(true);
      for (const piece of pieces) expect(piece, JSON.stringify(input)).toBe(piece.trim());
    }
  });
});
