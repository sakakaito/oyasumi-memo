import type { ReactNode } from 'react';

interface Props {
  label: string; // 読み上げ用の名前（aria-label）
  onClick: () => void;
  children: ReactNode;
}

// 24px の絵に 44px 四方の当たり判定をつけたボタン（tokens.md「使い方の決まり」）
export function IconButton({ label, onClick, children }: Props) {
  return (
    <button type="button" className="icon-btn" aria-label={label} onClick={onClick}>
      {children}
    </button>
  );
}
