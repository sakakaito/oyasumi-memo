# おやすみメモ（仮称）

寝る前に頭の中の考えごとを声で吐き出し、「預けた」安心感で眠りにつくための PWA です。
書く・見返すためのメモではなく、**手放すためのメモ**。

- 仕様と決定ログ：[docs/spec.md](docs/spec.md)
- 現在の段階：iPhone 実機で音声入力を確かめる試作

## 試作ページ

| ページ | URL | 目的 |
|---|---|---|
| 音声入力の試作 | https://sakakaito.github.io/oyasumi-memo/prototype/voice-test/ | Web Speech API とキーボードの音声入力を iPhone で比べる |

試作ページは検索結果に出さない設定（`noindex`）にしています。

## 公開の仕組み

`main` ブランチの内容を GitHub Pages でそのまま公開しています（ビルドなし）。
`.nojekyll` は、GitHub Pages の Jekyll 変換を止めるためのファイルです。
