import { useRef, type Dispatch } from 'react';
import { flushSync } from 'react-dom';
import { IconButton } from '../components/IconButton';
import { RecordButton } from '../components/RecordButton';
import { StatusLine } from '../components/StatusLine';
import { WriteSheet } from '../components/WriteSheet';
import { SunIcon } from '../components/icons';
import { NOT_READY, useNotice } from '../hooks/useNotice';
import { SAVED_NOTICE, isBlankEntry, submitEntry, type NightAction, type NightState } from '../lib/nightFlow';

interface Props {
  /** 夜の画面の状態（書きかけを朝の画面に切り替えても残すため、App が持つ） */
  state: NightState;
  dispatch: Dispatch<NightAction>;
  onMorning: () => void;
}

// 夜の画面：S2 頭の中を預ける・S1 今日の日記・S4 文字で書く（screens.md）。
// 件数・時計・ナビゲーション・保存したものは出さない（US-03・US-04）。
// 録音（フェーズ4）・おやすみ（S3）はまだ作っていない
export function NightScreen({ state, dispatch, onMorning }: Props) {
  const [notice, showNotice] = useNotice();
  const notReady = () => showNotice(NOT_READY);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const writeBtnRef = useRef<HTMLButtonElement | null>(null);
  // 二度押しを無視するための印（状態の更新を待たずに効かせる）
  const saving = useRef(false);

  const focusHeading = () => document.querySelector<HTMLElement>('main h1')?.focus();

  // 「文字で書く」：iPhone でキーボードを出すため、タップの処理の中で描いてから focus() する
  const openSheet = () => {
    flushSync(() => dispatch({ type: 'openSheet' }));
    const t = textareaRef.current;
    if (!t) return;
    t.focus({ preventScroll: true });
    t.setSelectionRange(t.value.length, t.value.length);
  };

  // S4 を閉じて元の画面へ。フォーカスは S4 を開いた「文字で書く」に戻す
  const leaveSheet = (action: NightAction) => {
    textareaRef.current?.blur();
    flushSync(() => dispatch(action));
    writeBtnRef.current?.focus();
  };

  const submit = async () => {
    if (saving.current || !state.sheet) return;
    const kind = state.sheet;
    const text = state.drafts[kind];
    dispatch({ type: 'clearFailure' }); // 前の失敗の一言は、次に押したときに消す
    if (isBlankEntry(text)) {
      // 空・空白・句読点だけ：保存しない・文言も出さない。入力欄にカーソルを戻す（タップの処理の中なのでキーボードも上がる）
      textareaRef.current?.focus({ preventScroll: true });
      return;
    }
    saving.current = true;
    const result = await submitEntry(kind, text);
    saving.current = false;
    if (result === 'saved') {
      leaveSheet({ type: 'submitSuccess', kind });
      showNotice(SAVED_NOTICE[kind]);
    } else if (result === 'failed') {
      dispatch({ type: 'submitFailure' }); // S4 のまま。文字もキーボードも残す
    } else {
      textareaRef.current?.focus({ preventScroll: true });
    }
  };

  if (state.sheet) {
    const kind = state.sheet;
    return (
      <WriteSheet
        kind={kind}
        text={state.drafts[kind]}
        failed={state.failed}
        textareaRef={textareaRef}
        onInput={(text) => dispatch({ type: 'input', text })}
        onSubmit={() => void submit()}
        onClose={() => leaveSheet({ type: 'closeSheet' })}
      />
    );
  }

  const diary = state.view === 'S1';
  const go = (action: NightAction) => {
    flushSync(() => dispatch(action));
    focusHeading();
  };

  return (
    <main className="screen night" aria-labelledby="night-title">
      <header className="top">
        {diary ? (
          <span />
        ) : (
          // 日記の入口（仮置き。screens.md S2・S1 の案1）。文言はいつも「今日の日記」
          <button type="button" className="text-btn" aria-label="今日の日記へ" onClick={() => go({ type: 'openDiary' })}>
            今日の日記
          </button>
        )}
        <IconButton label="朝の画面へ" onClick={onMorning}>
          <SunIcon />
        </IconButton>
      </header>

      <section className="center">
        <h1 id="night-title" tabIndex={-1}>
          {diary ? '今日のこと' : '頭の中を預ける'}
        </h1>
        {diary && <p className="sub">今日あったことを、日記に残せます</p>}
        <RecordButton label={diary ? '日記を話す' : '話して預ける'} onPress={notReady} />
        <StatusLine notice={notice} />
      </section>

      <footer className="bottom">
        <button type="button" className="btn" ref={writeBtnRef} onClick={openSheet}>
          文字で書く
        </button>
        {diary ? (
          <button
            type="button"
            className="btn"
            aria-label={state.diarySaved ? '次へ（預ける画面へ）' : '戻る（預ける画面へ）'}
            onClick={() => go({ type: 'backToS2' })}
          >
            {state.diarySaved ? '次へ' : '戻る'}
          </button>
        ) : (
          <button type="button" className="btn" onClick={notReady}>
            おやすみ
          </button>
        )}
      </footer>
    </main>
  );
}
