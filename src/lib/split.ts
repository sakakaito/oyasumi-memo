/**
 * 預けた文章を、区切りごとのメモに分ける（US-01 方式K・US-02・spec §6）。
 * 画面にも保存にも依存しない純粋な関数。フェーズ4 の声の入力（キーボードの音声入力で送った文章）でもそのまま使う。
 *
 * 区切りの規則
 * 1. 文の終わり：「。」「！」「？」「!」「?」と改行。「！」「？」は意味があるので文の後ろに残し、「。」は落とす
 * 2. 区切りの言葉：「それと」「それから」「あとは」「あとね」「あと」「ついでに」。
 *    文の頭か、「、」「，」「,」・空白・閉じかっこのすぐあとにあるときだけ区切りとみなし、言葉そのものは落とす
 *    （「そのあと」「足あと」「これとそれと」のように言葉の途中にあるものでは切らない）
 * 3. 区切りの言葉のすぐあとが、別の意味になる続き方なら切らない。迷ったら切らない（利用者の言葉を 1 文字も失わないため）
 *    - すぐあとがひらがななら切らない（「あとで」「あとから」「あとさき」「あとずさり」「それとも」など）。
 *      ただし、続きがまた区切りの言葉なら（「それとあと、」）まとめて区切る
 *    - 漢字・数字でも、ひと続きの言葉になるものは切らない（「あと3日」「あと少し」「あと払い」「それと同時に」など。下の NOT_AFTER）
 * 4. かぎかっこ・かっこ（「」『』（）など）の中では切らない。ただし同じ行の中で閉じていないかっこ（顔文字の「(^^;」など）は、
 *    かっこが無いものとして扱う（閉じ忘れで、そのあと全部が区切られなくなるのを防ぐ）
 * 5. 落とすのは、区切りの記号（「。」・読点・空白・改行）と区切りの言葉だけ。ほかの文字は必ずどれかの件に残る
 * 6. 分けた結果が空ばかりなら、元の文章を 1 件にする（入力を失わない）。文章が空なら 0 件
 */

/** 区切りの言葉。長いものから順に照らす（「あとは」を「あと」より先に） */
const CONNECTORS = ['それから', 'それと', 'ついでに', 'あとは', 'あとね', 'あと'] as const;

/** 区切りの言葉のすぐあとがこれで始まるなら、区切りではない */
const NOT_AFTER: Record<(typeof CONNECTORS)[number], RegExp | null> = {
  // それとも／それとなく／それとは別に／それと同時に／それと一緒に
  それと: /^(も|なく|なし|は|の|同|一緒|いっしょ|似|比べ|くらべ|共に|ともに)/,
  // それから先／それから後
  それから: /^(先|後)/,
  ついでに: null,
  あとは: null,
  あとね: null,
  // あとで／あとから／あとに回す／あとの／あとを／あとが／あとも／あとまで／あとへ／あとあと
  // あと回し・あと片付け・あと始末・あとがき・あと押し
  // あと少し・あとちょっと・あともう少し・あとわずか・あと一歩・あと何日・あとどれくらい・あといくつ
  // あと3日・あと１時間・あと一回・あと半分・あと数日・あとひとつ・あとふたつ・あといっかい
  // あと払い・あと戻り・あと味・あと腐れ・あと継ぎ・あと先・あと追い・あと付け・あと引き・あと延ばし
  // （ひらがなで始まる続き方「あとで」「あとから」「あとさき」などは、下の HIRAGANA でまとめて切らない）
  あと: /^(回し|片|始末|書き|押し|少し|僅か|何|幾|払|戻|味|腐|継|先|追|付|引|延|伸|足|跡|[0-9０-９一二三四五六七八九十百千万半数両])/,
};

/** 文の終わり。「。」は落とし、ほかは文の後ろに残す */
const SENTENCE_END = /[。！？!?\r\n]/;
const KEEP_MARK = /[！？!?]/;
/** 区切りの言葉の前に来てよい、文の途中の区切り（読点・空白） */
const PAUSE = /[、，,\s　]/;
const OPEN_BRACKETS = '「『（(【［[〈《';
const CLOSE_BRACKETS = '」』）)】］]〉》';
const HIRAGANA = /^[ぁ-ゟ]/;

/**
 * 同じ行の中で閉じているかっこの位置（開きと閉じの両方）。閉じていないかっこ・対の無い閉じかっこは含めない。
 * 種類が対応するもの（「 と 」、( と ) など）だけを対にする
 */
function pairedBrackets(text: string): Set<number> {
  const paired = new Set<number>();
  let stack: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '\n' || c === '\r') {
      stack = [];
      continue;
    }
    if (OPEN_BRACKETS.includes(c)) {
      stack.push(i);
      continue;
    }
    const k = CLOSE_BRACKETS.indexOf(c);
    if (k < 0) continue;
    // いちばん近い同じ種類の開きかっこと対にする。その内側の閉じていない開きかっこは捨てる
    for (let s = stack.length - 1; s >= 0; s--) {
      if (text[stack[s]] === OPEN_BRACKETS[k]) {
        paired.add(stack[s]).add(i);
        stack = stack.slice(0, s);
        break;
      }
    }
  }
  return paired;
}

/** メモの前後の空白・読点・句点を落とす */
function clean(piece: string): string {
  return piece.replace(/^[\s　、，,。]+|[\s　、，,。]+$/g, '');
}

/** text の i 文字目から区切りの言葉が始まるなら、読み飛ばす文字数（後ろの読点・空白を含む）。始まらなければ 0 */
function connectorLength(text: string, i: number): number {
  for (const word of CONNECTORS) {
    if (!text.startsWith(word, i)) continue;
    const after = text.slice(i + word.length);
    // 言葉で文章が終わる・すぐ文が終わるときは、区切りとみなさない（「それと」だけの入力などを残す）
    if (after === '' || SENTENCE_END.test(after[0])) return 0;
    if (PAUSE.test(after[0])) {
      let n = word.length;
      while (i + n < text.length && PAUSE.test(text[i + n]) && text[i + n] !== '\n' && text[i + n] !== '\r') n++;
      return n;
    }
    if (HIRAGANA.test(after)) {
      // すぐあとがひらがな：言葉の一部かもしれないので切らない。続きがまた区切りの言葉（「それとあと」）ならまとめて切る
      const next = connectorLength(text, i + word.length);
      return next > 0 ? word.length + next : 0;
    }
    const notAfter = NOT_AFTER[word];
    if (notAfter && notAfter.test(after)) return 0;
    return word.length;
  }
  return 0;
}

/** いま作っている 1 件が、区切りの言葉を置ける位置（文の頭か、読点・空白・閉じかっこのすぐあと）か */
function atBoundary(current: string): boolean {
  const last = current[current.length - 1];
  return current.trim() === '' || PAUSE.test(last) || CLOSE_BRACKETS.includes(last);
}

/**
 * 文章を区切りごとのメモの文字列に分ける。
 * 例：'明日は資料を出す。それと歯医者の予約' → ['明日は資料を出す', '歯医者の予約']
 */
export function splitMemoText(text: string): string[] {
  const pieces: string[] = [];
  let current = '';
  let depth = 0; // かっこの深さ。中では切らない（同じ行で閉じているかっこだけを数える）
  const paired = pairedBrackets(text);
  const push = () => {
    const p = clean(current);
    if (p) pieces.push(p);
    current = '';
  };

  let i = 0;
  while (i < text.length) {
    const c = text[i];

    if (depth === 0 && atBoundary(current)) {
      const skip = connectorLength(text, i);
      if (skip > 0) {
        push();
        i += skip;
        continue;
      }
    }

    if (paired.has(i)) {
      if (OPEN_BRACKETS.includes(c)) depth++;
      else depth = Math.max(0, depth - 1);
    }

    if (depth === 0 && c === '。') {
      // 「。」：落として区切る
      push();
      i++;
      continue;
    }
    if (depth === 0 && KEEP_MARK.test(c)) {
      // 「？」「！」：続けて並んだ分も含めて文の後ろに残して区切る
      while (i < text.length && KEEP_MARK.test(text[i])) current += text[i++];
      push();
      continue;
    }
    if (c === '\n' || c === '\r') {
      // 改行は区切る（対にするかっこは同じ行の中だけなので、ここで深さは 0 に戻っている）
      depth = 0;
      push();
      i++;
      continue;
    }

    current += c;
    i++;
  }
  push();

  if (pieces.length === 0) {
    // 区切りの言葉や記号だけで空になったとき：入力を失わないよう、元の文章を 1 件にする
    const whole = clean(text);
    return whole && /[^\s　、，,。！？!?]/.test(whole) ? [whole] : [];
  }
  return pieces;
}
