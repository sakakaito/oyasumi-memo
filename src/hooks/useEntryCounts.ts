import { useEffect, useState } from 'react';
import { countsForNight, type EntryCounts } from '../lib/db';

/** 読み込み中は null、読めなかったら 'error' */
export type CountsState = EntryCounts | null | 'error';

/**
 * 朝の画面の件数（screens.md S5「フェーズ2 の簡易表示」）。
 * sleepDate が null のあいだ（朝の画面を出していないとき）は読まない。
 * 朝の画面を開いたときと、アプリに戻ってきたときに読み直す
 */
export function useEntryCounts(sleepDate: string | null): CountsState {
  const [counts, setCounts] = useState<CountsState>(null);

  useEffect(() => {
    if (!sleepDate) return;
    let alive = true;
    const load = () => {
      countsForNight(sleepDate).then(
        (c) => alive && setCounts(c),
        () => alive && setCounts('error'),
      );
    };
    const onReturn = () => {
      if (document.visibilityState === 'visible') load();
    };
    load();
    document.addEventListener('visibilitychange', onReturn);
    window.addEventListener('pageshow', onReturn);
    return () => {
      alive = false;
      setCounts(null);
      document.removeEventListener('visibilitychange', onReturn);
      window.removeEventListener('pageshow', onReturn);
    };
  }, [sleepDate]);

  return counts;
}
