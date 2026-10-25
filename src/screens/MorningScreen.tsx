import { IconButton } from '../components/IconButton';
import { StatusLine } from '../components/StatusLine';
import { GearIcon, MoonIcon } from '../components/icons';
import type { CountsState } from '../hooks/useEntryCounts';
import { NOT_READY, useNotice } from '../hooks/useNotice';

interface Props {
  title: string; // 見出し（例：「10月24日の夜」）
  nightLabel?: '今夜' | '昨夜'; // 本文での呼び方。見出しと同じ夜から出す（src/lib/time.ts の latestNight）
  counts: CountsState; // 見出しの夜の件数と全体の件数。読み込み中は null、読めなければ 'error'
  onNight: () => void;
  onSettings: () => void;
}

// S5 朝：昨夜の振り返り（screens.md）。フェーズ2 は件数だけの簡易表示（S5「フェーズ2 の簡易表示」）。
// 本文・一覧はフェーズ3。フェーズ3 で消すのは「確認用」の h2 と合計・補足だけ
export function MorningScreen({ title, nightLabel = '昨夜', counts, onNight, onSettings }: Props) {
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
        {counts === 'error' ? (
          <p className="empty">件数を読み込めませんでした。アプリを開き直してください</p>
        ) : counts ? (
          <>
            <p className="count">
              {counts.nightMemos > 0
                ? `${nightLabel}は ${counts.nightMemos} 件 預かっていました`
                : `${nightLabel}は何も預かっていません`}
            </p>
            <p className="count">{`${nightLabel}の日記 ${counts.nightDiaries} 件`}</p>

            <section className="group" aria-labelledby="saved-total">
              <h2 id="saved-total">保存されている件数（確認用）</h2>
              <p>{`メモ ${counts.totalMemos} 件・日記 ${counts.totalDiaries} 件`}</p>
              <p className="sub-text">確かめるための表示です。昼に書いた分は、その日の夜の分として数えます。</p>
            </section>
          </>
        ) : null}
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
