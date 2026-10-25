import { IconButton } from '../components/IconButton';
import { StatusLine } from '../components/StatusLine';
import { GearIcon, MoonIcon } from '../components/icons';
import { NOT_READY, useNotice } from '../hooks/useNotice';

interface Props {
  title: string; // 見出し（例：「10月24日の夜」）
  nightLabel?: '今夜' | '昨夜'; // 本文での呼び方。見出しと同じ夜から出す（src/lib/time.ts の latestNight）
  onNight: () => void;
  onSettings: () => void;
}

// S5 朝：昨夜の振り返り（screens.md）。メモの保存（フェーズ2）と一覧（フェーズ3）はまだなので、空の状態だけ出す
export function MorningScreen({ title, nightLabel = '昨夜', onNight, onSettings }: Props) {
  const [notice, showNotice] = useNotice();

  return (
    <main className="screen morning" aria-labelledby="morning-title">
      <header className="top">
        <h1 id="morning-title" className="title" tabIndex={-1}>
          {title}
        </h1>
        <div className="top-icons">
          <IconButton label="夜の画面へ" onClick={onNight}>
            <MoonIcon />
          </IconButton>
          <IconButton label="設定" onClick={onSettings}>
            <GearIcon />
          </IconButton>
        </div>
      </header>

      <section className="body">
        <p className="empty">{`${nightLabel}は何も預かっていません`}</p>
      </section>

      <footer className="bottom fixed">
        <StatusLine notice={notice} />
        <button
          type="button"
          className="btn primary"
          aria-label="表示中のメモを全部見終わったことにする"
          onClick={() => showNotice(NOT_READY)}
        >
          全部見た
        </button>
      </footer>
    </main>
  );
}
