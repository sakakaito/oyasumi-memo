import { useEffect, useReducer, useRef, useState } from 'react';
import { useEntryCounts } from './hooks/useEntryCounts';
import { screenOnReturn } from './lib/autoSwitch';
import { applyDocumentMode } from './lib/documentMode';
import { holdsAutoSwitch, initialNightState, nightReducer } from './lib/nightFlow';
import { DEFAULT_SCHEDULE, describeNightHours, formatNightTitle, latestNight, modeAt } from './lib/time';
import { MorningScreen } from './screens/MorningScreen';
import { NightScreen } from './screens/NightScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import type { Mode, Screen } from './types';

// 夜と朝の境目。設定で変えられるようにするのは US-34（Should）。いまは初期値だけ
const schedule = DEFAULT_SCHEDULE;

export function App() {
  // 起動した時刻で最初の画面を決める（US-33）
  const [screen, setScreen] = useState<Screen>(() => modeAt(new Date(), schedule));
  const mode = screen === 'night' ? 'night' : 'morning';

  useEffect(() => applyDocumentMode(mode), [mode]);

  // 夜の画面の状態（S2・S1・S4 と書きかけ）。朝の画面に切り替えても書きかけを残すため、ここで持つ
  const [night, dispatchNight] = useReducer(nightReducer, initialNightState);
  const hold = useRef(false);
  hold.current = holdsAutoSwitch(night);

  // 朝の画面の件数（見出しと同じ夜）。朝の画面を出しているときだけ読む
  const shownNight = latestNight(new Date(), schedule);
  const counts = useEntryCounts(screen === 'morning' ? shownNight.date : null);

  // 前回判定した時間帯（最初の画面は判定どおりなので、その値から始める）と、今の画面
  const lastMode = useRef<Mode>(mode);
  const currentScreen = useRef(screen);
  useEffect(() => {
    currentScreen.current = screen;
  }, [screen]);

  // ページに戻ってきたら夜/朝を判定し直す。時間帯が変わっていれば、その時間帯の画面にする（src/lib/autoSwitch.ts）。
  // 文字で書く画面を開いている間・書きかけがある間は替えない（書きかけが消えないように）
  useEffect(() => {
    const recheck = () => {
      if (document.visibilityState !== 'visible') return;
      const result = screenOnReturn(currentScreen.current, lastMode.current, new Date(), schedule, hold.current);
      lastMode.current = result.mode;
      if (result.screen !== currentScreen.current) setScreen(result.screen);
    };
    document.addEventListener('visibilitychange', recheck);
    window.addEventListener('pageshow', recheck);
    return () => {
      document.removeEventListener('visibilitychange', recheck);
      window.removeEventListener('pageshow', recheck);
    };
  }, []);

  // 画面を切り替えたら、新しい画面の見出しに移る（読み上げで今いる画面がわかるように）
  const prev = useRef(screen);
  useEffect(() => {
    if (prev.current === screen) return;
    prev.current = screen;
    document.querySelector<HTMLElement>('main h1')?.focus();
  }, [screen]);

  switch (screen) {
    case 'night':
      return <NightScreen state={night} dispatch={dispatchNight} onMorning={() => setScreen('morning')} />;
    case 'morning':
      // 見出しの日付と本文の「今夜／昨夜」と件数を同じ夜から出す
      return (
        <MorningScreen
          title={formatNightTitle(shownNight.date)}
          nightLabel={shownNight.label}
          counts={counts}
          onNight={() => setScreen('night')}
          onSettings={() => setScreen('settings')}
        />
      );
    case 'settings':
      return <SettingsScreen nightHours={describeNightHours(schedule)} onBack={() => setScreen('morning')} />;
  }
}
