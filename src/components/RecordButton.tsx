interface Props {
  label: string; // aria-label（例：「話して預ける」）
  onPress: () => void;
}

// 話すボタン（screens.md 0-1）。録音はまだ作っていない（フェーズ4）
export function RecordButton({ label, onPress }: Props) {
  return (
    <button type="button" className="rec" aria-pressed={false} aria-label={label} onClick={onPress}>
      タップして話す
    </button>
  );
}
