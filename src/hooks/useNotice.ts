import { useCallback, useEffect, useRef, useState } from 'react';

export interface Notice {
  text: string;
  shown: boolean;
}

const SHOW_MS = 2000; // 表示しておく時間（screens.md 0-2）
const FADE_MS = 1000; // 消えるまでのフェード。theme.css の --fade-status と合わせる

// 「預かりました」「準備中です」などの短い知らせ。2 秒出して、1 秒かけて消す
export function useNotice(): [Notice, (text: string) => void] {
  const [notice, setNotice] = useState<Notice>({ text: '', shown: false });
  const timers = useRef<number[]>([]);

  const clear = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  const show = useCallback((text: string) => {
    clear();
    setNotice({ text, shown: true });
    timers.current.push(
      window.setTimeout(() => setNotice((n) => ({ ...n, shown: false })), SHOW_MS),
      window.setTimeout(() => setNotice({ text: '', shown: false }), SHOW_MS + FADE_MS),
    );
  }, []);

  useEffect(() => clear, []);

  return [notice, show];
}

// まだ作っていないボタンを押したときの文言
export const NOT_READY = 'この機能は準備中です';
