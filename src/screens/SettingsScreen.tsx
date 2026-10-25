import { StatusLine } from '../components/StatusLine';
import { NOT_READY, useNotice } from '../hooks/useNotice';

interface Props {
  nightHours: string; // 夜になる時間帯の説明（例：「18:00〜翌 4:59」）
  onBack: () => void;
}

// S8 設定（screens.md）。書き出し・全部消す・使い方はフェーズ5 で作る
export function SettingsScreen({ nightHours, onBack }: Props) {
  const [notice, showNotice] = useNotice();
  const notReady = () => showNotice(NOT_READY);

  return (
    <main className="screen morning" aria-labelledby="settings-title">
      <header className="top">
        <button type="button" className="text-btn" aria-label="朝の画面に戻る" onClick={onBack}>
          ‹ 戻る
        </button>
      </header>

      <div className="body">
        <h1 id="settings-title" className="title" tabIndex={-1}>
          設定
        </h1>

        <section className="group" aria-labelledby="set-mode">
          <h2 id="set-mode">夜と朝</h2>
          <p>画面の切り替え：自動（{nightHours} は夜）</p>
          <p className="sub-text">「いつも夜」「いつも朝」を選べるようにするのは準備中です。夜の画面と朝の画面の右上のアイコンでも切り替えられます（夜と朝の時間帯が変わると、自動の切り替えに戻ります）。</p>
        </section>

        <section className="group" aria-labelledby="set-data">
          <h2 id="set-data">データの扱い</h2>
          <p>
            メモの内容は、この端末の中にだけ保存されます。声を文字にするときは iPhone（Apple）の音声認識を使うため、話した音声は Apple のサーバーで処理されることがあります。
          </p>
        </section>

        <section className="group" aria-labelledby="set-export">
          <h2 id="set-export">書き出す</h2>
          <div className="row">
            <button type="button" className="btn" onClick={notReady}>
              JSON で書き出す
            </button>
            <button type="button" className="btn" onClick={notReady}>
              テキストで書き出す
            </button>
          </div>
        </section>

        <section className="group" aria-labelledby="set-erase">
          <h2 id="set-erase">全部消す</h2>
          <button type="button" className="btn danger" onClick={notReady}>
            全部消す
          </button>
        </section>

        <section className="group" aria-labelledby="set-guide">
          <h2 id="set-guide">使い方</h2>
          <button type="button" className="btn" onClick={notReady}>
            使い方をもう一度見る
          </button>
        </section>

        <section className="group" aria-labelledby="set-care">
          <h2 id="set-care">眠れない日が続くとき</h2>
          {/* 相談窓口へのリンクは、リンク先を確かめてから足す（US-52） */}
          <p>眠れない日が続く場合は、医療機関に相談してください。</p>
        </section>
      </div>

      <footer className="bottom fixed">
        <StatusLine notice={notice} />
      </footer>
    </main>
  );
}
