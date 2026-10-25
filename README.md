# おやすみメモ（仮称）

寝る前に頭の中の考えごとを声で吐き出し、「預けた」安心感で眠りにつくための PWA です。
書く・見返すためのメモではなく、**手放すためのメモ**。

- 仕様と決定ログ：[docs/spec.md](docs/spec.md)
- 開発計画：[docs/plan.md](docs/plan.md)
- 現在の段階：フェーズ1（アプリの骨組みと公開の仕組み）。iPhone 実機で音声入力を確かめる試作も公開中

## 試作ページ

| ページ | URL | 目的 |
|---|---|---|
| 音声入力の試作 | https://sakakaito.github.io/oyasumi-memo/prototype/voice-test/ | Web Speech API とキーボードの音声入力を iPhone で比べる |

試作ページは検索結果に出さない設定（`noindex`）にしています。

## ページの置き場所

| URL | 中身 | 元のファイル |
|---|---|---|
| `/oyasumi-memo/` | 紹介ページ（いまは「準備中」の仮ページ） | `index.html` |
| `/oyasumi-memo/app/` | アプリ本体（夜・朝・設定） | `app/index.html`、`src/` |
| `/oyasumi-memo/prototype/voice-test/` | 音声入力の試作 | `prototype/`（Vite に通さずそのままコピー） |
| `/oyasumi-memo/docs/design/mock/night.html` | 夜の画面の設計モック | `docs/design/mock/`（同上） |

- いまはすべてのページが `noindex`（検索に出さない）。紹介ページを検索に出すのはフェーズ7 の判定のあと
- 公開先のパス `/oyasumi-memo/` は `vite.config.ts` の `BASE` の 1 か所だけで決めている

## 公開の仕組み

`main` に push すると、GitHub Actions（`.github/workflows/deploy.yml`）が次の順に動いて GitHub Pages に公開します。手動でも実行できます（Actions のページの「Run workflow」）。

1. `npm ci`（`package-lock.json` のとおりに入れる）
2. `npm test`（単体テスト）
3. `npm run build:app`（型チェックと Vite のビルド。出力は `dist/`）
4. `npm run copy:static`（`prototype/` と `docs/design/mock/` を `dist/` の同じパスにそのままコピー。今の URL を変えないため）
5. `npm run check:seo`（`dist/` の HTML すべてと `robots.txt` の点検）
6. `dist/` を GitHub Pages に公開

テストか SEO 点検が通らなければ、公開まで進みません（前の版が公開されたまま残ります）。

- この仕組みを使うには、GitHub の Settings → Pages → Source を「GitHub Actions」にする（まだ切り替えていない場合）。切り替えるまでは、これまでどおり `main` の中身がビルドなしでそのまま公開される。ルートの `.nojekyll` はそのためのファイル（GitHub Pages の Jekyll 変換を止める）
- `public/.nojekyll` は、ビルドの出力にも同じファイルを入れるためのもの
- 戻すとき：Source を「Deploy from a branch（main）」に戻せば、今までの公開のしかたに戻る

### SEO 点検（`scripts/check-seo.mjs`）

ビルドのあとの `dist/` で、次のどれかが抜けていたら理由を出して止まります（終了コード 1）。

- `<html lang>` がある／`<title>` が空でない／`meta description` がある
- `h1` が 2 つ以上ない
- `noindex` が付いている（いまはすべてのページを検索に出さない段階）
- `robots.txt` がある（クロールを止める `Disallow: /` は不可。止めると `noindex` が読まれない）

決まりそのものは `scripts/seo-rules.mjs` にあり、`tests/check-seo.test.ts` で確かめています。canonical・OGP・構造化データ・sitemap.xml の点検は、紹介ページを作るフェーズ6 で足します。

## 手元での動かし方

Node.js 24 と npm 11 を使います。

```sh
npm ci            # 依存を入れる（初回と、package-lock.json が変わったとき）
npm run dev       # 開発用サーバー → http://localhost:5173/oyasumi-memo/app/
npm test          # 単体テスト（Vitest）
npm run build     # 型チェック → ビルド → 試作とモックのコピー → SEO 点検（公開と同じ中身が dist/ にできる）
npm run preview   # dist/ を手元で開く → http://localhost:4173/oyasumi-memo/
```

- 開発中も公開と同じ `/oyasumi-memo/` の下で動きます（`http://localhost:5173/` を開くと `/oyasumi-memo/` に移ります）。5173 番がふさがっているときは、Vite が別の番号を表示します
- 夜と朝は、開いた時刻で決まります（18:00〜翌 4:59 が夜）。右上のアイコンで切り替えられます

## 使っているパッケージと理由

| パッケージ | 種類 | 理由 |
|---|---|---|
| `react`・`react-dom` | 本体 | 画面を部品に分けて作り、夜・朝・設定の切り替えを状態で持つため |
| `vite` | 開発用 | 開発用サーバーとビルド（紹介ページとアプリの 2 ページ構成）のため |
| `@vitejs/plugin-react` | 開発用 | Vite で React（JSX）を変換するため |
| `typescript` | 開発用 | 型の誤りをビルドの前に見つけるため（`tsc --noEmit`） |
| `@types/react`・`@types/react-dom` | 開発用 | React の型の定義 |
| `vitest` | 開発用 | 単体テスト。Vite と同じ設定で動くため |

画面の切り替えにルーター（URL ごとに画面を分ける部品）は使っていません。GitHub Pages では `/app/morning` のような URL を直接開くと 404 になるのを避け、依存も減らすためです。

## ファイルの置き場所

```
index.html            紹介ページ（仮）
app/index.html        アプリの入口
src/                  アプリ（画面は src/screens/、夜/朝の判定は src/lib/time.ts、色は src/styles/theme.css）
tests/                単体テスト
public/               そのまま dist/ に入るファイル（robots.txt・.nojekyll）
scripts/              ビルドのあとのコピーと SEO 点検
prototype/            音声入力の試作（Vite に通さない）
docs/                 仕様・計画・設計
```
