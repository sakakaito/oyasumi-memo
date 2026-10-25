import type { Mode } from '../types';

/**
 * 夜と朝の境目。どちらも 0:00 からの「分」で持つ（例：18:00 → 1080）。
 * 夜/朝の判定と、その夜の日付（sleepDate）の両方をこの 1 つの値から計算する（backlog §2・US-34）
 */
export interface NightSchedule {
  /** この時刻から夜（含む） */
  nightStart: number;
  /** この時刻から朝（含む）。その夜の日付もこの時刻で次の日に変わる */
  morningStart: number;
}

/** 初期値：18:00〜翌 4:59 が夜（spec §5-3） */
export const DEFAULT_SCHEDULE: NightSchedule = {
  nightStart: 18 * 60,
  morningStart: 5 * 60,
};

const MINUTES_PER_DAY = 24 * 60;

function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

/** 夜の時間帯か。夜の始まりと朝の始まりが同じ値なら、夜は無いものとする */
export function isNight(now: Date, schedule: NightSchedule = DEFAULT_SCHEDULE): boolean {
  const m = minutesOfDay(now);
  const { nightStart, morningStart } = schedule;
  if (nightStart === morningStart) return false;
  return nightStart > morningStart
    ? m >= nightStart || m < morningStart // 0:00 をまたぐ（初期値はこちら）
    : m >= nightStart && m < morningStart; // 0:00 をまたがない（例：1:00〜5:59）
}

/** 起動したときに出す画面の配色 */
export function modeAt(now: Date, schedule: NightSchedule = DEFAULT_SCHEDULE): Mode {
  return isNight(now, schedule) ? 'night' : 'morning';
}

/** 端末の時刻での 'YYYY-MM-DD' */
function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 'YYYY-MM-DD' に日数を足す（端末の時刻の暦で数える） */
function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return formatYmd(new Date(y, m - 1, d + days));
}

/**
 * その夜の日付（sleepDate、'YYYY-MM-DD'）。朝の始まり（初期値 5:00）より前は前日の夜とする。
 * 例：10月25日 0:00〜4:59 → '…-10-24'、10月25日 5:00 以降 → '…-10-25'
 */
export function sleepDate(now: Date, schedule: NightSchedule = DEFAULT_SCHEDULE): string {
  // 朝の始まりの分だけ時刻を前にずらしてから日付を取る
  const shifted = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    now.getHours(),
    now.getMinutes() - schedule.morningStart,
  );
  return formatYmd(shifted);
}

/**
 * いちばん近い「すでに始まっている夜」の日付。朝の画面の見出しに使う。
 * 夜の時間帯なら今夜、朝の時間帯なら昨夜
 */
export function latestNightDate(now: Date, schedule: NightSchedule = DEFAULT_SCHEDULE): string {
  const today = sleepDate(now, schedule);
  return isNight(now, schedule) ? today : addDays(today, -1);
}

/** 朝の画面で見せる夜。見出しの日付と本文の言い回し（今夜／昨夜）を、この 1 つから出す */
export interface ShownNight {
  /** その夜の日付 'YYYY-MM-DD' */
  date: string;
  /** 本文で使う呼び方 */
  label: '今夜' | '昨夜';
}

/** いちばん近い「すでに始まっている夜」と、その呼び方 */
export function latestNight(now: Date, schedule: NightSchedule = DEFAULT_SCHEDULE): ShownNight {
  return {
    date: latestNightDate(now, schedule),
    label: isNight(now, schedule) ? '今夜' : '昨夜',
  };
}

/** 朝の画面の見出し：'2026-10-24' → '10月24日の夜' */
export function formatNightTitle(ymd: string): string {
  const [, m, d] = ymd.split('-').map(Number);
  return `${m}月${d}日の夜`;
}

/** 夜の時間帯の説明：初期値なら '18:00〜翌 4:59' */
export function describeNightHours(schedule: NightSchedule = DEFAULT_SCHEDULE): string {
  const end = (schedule.morningStart - 1 + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const next = end < schedule.nightStart ? '翌 ' : '';
  return `${formatHm(schedule.nightStart)}〜${next}${formatHm(end)}`;
}

function formatHm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = String(minutes % 60).padStart(2, '0');
  return `${h}:${m}`;
}
