import { IconButton } from '../components/IconButton';
import { RecordButton } from '../components/RecordButton';
import { StatusLine } from '../components/StatusLine';
import { SunIcon } from '../components/icons';
import { NOT_READY, useNotice } from '../hooks/useNotice';

interface Props {
  onMorning: () => void;
}

// S2 夜②：頭の中を預ける（screens.md）。
// 件数・時計・ナビゲーションは出さない。右上に小さな切替アイコンだけ（US-03）。
// 録音（フェーズ4）・文字で書くシート（フェーズ2）・おやすみ（S3）はまだ作っていない
export function NightScreen({ onMorning }: Props) {
  const [notice, showNotice] = useNotice();
  const notReady = () => showNotice(NOT_READY);

  return (
    <main className="screen night" aria-labelledby="night-title">
      <header className="top top-end">
        <IconButton label="朝の画面へ" onClick={onMorning}>
          <SunIcon />
        </IconButton>
      </header>

      <section className="center">
        <h1 id="night-title" tabIndex={-1}>
          頭の中を預ける
        </h1>
        <RecordButton label="話して預ける" onPress={notReady} />
        <StatusLine notice={notice} />
      </section>

      <footer className="bottom">
        <button type="button" className="btn" onClick={notReady}>
          文字で書く
        </button>
        <button type="button" className="btn" onClick={notReady}>
          おやすみ
        </button>
      </footer>
    </main>
  );
}
