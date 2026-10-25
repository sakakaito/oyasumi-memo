import type { Mode } from '../types';

// <html data-mode> と、ブラウザの枠の色（theme-color・color-scheme）を画面に合わせる。
// 色の値は theme.css の --bg から読むので、ここに色を書かない
export function applyDocumentMode(mode: Mode): void {
  const html = document.documentElement;
  html.dataset.mode = mode;
  const bg = getComputedStyle(html).getPropertyValue('--bg').trim();
  if (bg) setMeta('theme-color', bg);
  setMeta('color-scheme', mode === 'night' ? 'dark' : 'light');
}

function setMeta(name: string, content: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.name = name;
    document.head.appendChild(el);
  }
  el.content = content;
}
