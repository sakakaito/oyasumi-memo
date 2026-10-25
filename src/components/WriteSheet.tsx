import type { RefObject } from 'react';
import { SAVE_FAILED, isBlankEntry, type WriteKind } from '../lib/nightFlow';

interface Props {
  kind: WriteKind;
  text: string;
  failed: boolean;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onInput: (text: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}

const WORDING: Record<WriteKind, { title: string; aria: string; placeholder: string; submit: string }> = {
  memo: { title: '文字で預ける', aria: '預けたいこと', placeholder: '思いついた順に、そのままどうぞ', submit: '預ける' },
  diary: { title: '文字で日記を書く', aria: '今日の日記', placeholder: '今日あったことを、そのままどうぞ', submit: '日記に残す' },
};

// S4 文字で書く画面（screens.md 0-3）。夜の画面の中身と差し替える全画面（重ねない・動かさない）。
// 入力欄と主ボタンを上に寄せて、iPhone でも主ボタンがキーボードのすぐ上に来るようにする（案1）。
// 前に預けた文は出さない。出すのは書きかけだけ
export function WriteSheet({ kind, text, failed, textareaRef, onInput, onSubmit, onClose }: Props) {
  const w = WORDING[kind];
  return (
    <main className="screen night write" aria-labelledby="write-title">
      <header className="top">
        <h1 id="write-title" tabIndex={-1}>
          {w.title}
        </h1>
        <button type="button" className="text-btn close" aria-label="閉じる" onClick={onClose}>
          閉じる
        </button>
      </header>
      {/* return は改行だけ（日本語の変換の確定にも使うため、送信にしない） */}
      <textarea
        ref={textareaRef}
        className="entry"
        aria-label={w.aria}
        placeholder={w.placeholder}
        spellCheck={false}
        autoComplete="off"
        enterKeyHint="enter"
        value={text}
        onChange={(e) => onInput(e.target.value)}
      />
      <p className="wline" role="alert">
        {failed ? SAVE_FAILED : ''}
      </p>
      {/* 空のあいだも押せる（disabled 属性は使わない）。押すと入力欄にカーソルが戻るだけ */}
      <button
        type="button"
        className="btn primary wide"
        aria-disabled={isBlankEntry(text)}
        onClick={onSubmit}
      >
        {w.submit}
      </button>
    </main>
  );
}
