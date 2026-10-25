// 画面：夜（預ける）・朝（振り返り）・設定。ルーターは使わず、React の状態で切り替える
export type Screen = 'night' | 'morning' | 'settings';

// 配色の種類。<html data-mode="..."> に入れて、theme.css の変数を切り替える
export type Mode = 'night' | 'morning';
