import type { Notice } from '../hooks/useNotice';

// 状態の表示行。高さを常に確保して、文字が出ても消えてもボタンの位置が動かないようにする（screens.md 0-2）
export function StatusLine({ notice }: { notice: Notice }) {
  return (
    <div className="line">
      <p className={notice.shown ? 'status show' : 'status'} role="status">
        {notice.text}
      </p>
    </div>
  );
}
