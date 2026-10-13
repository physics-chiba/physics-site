# AI レポートの元ソース（motion-analysis_AI-collaboration.html）

公開している `../motion-analysis_AI-collaboration.html` は、**このフォルダの中身から作ります。**
できあがりの HTML を直接さわらないでください（次に作り直したときに消えます）。

## ファイル

| ファイル | 中身 |
| --- | --- |
| `report_src2.html` | レポート本体。図のところは `{{fig1}}`〜`{{fig17}}` と書いてある |
| `figs.json` | 図 17 枚（base64）。大きいので GitHub には置いていない。`split_figs.js` で作る |
| `build_rep.js` | `{{figN}}` を図に置きかえて 1 枚の HTML を書き出す |
| `split_figs.js` | できあがりの HTML から `figs.json` を取り出し直す（図をなくさないための保険） |
| `check_rep.js` | 横スクロール・印刷・共通フッターの自動チェック（Playwright） |

## 作り直す手順

```
node split_figs.js ../motion-analysis_AI-collaboration.html   # figs.json がないときだけ
node build_rep.js                                             # HTML を書き出す
node check_rep.js                                             # 確認（全部 OK になること）
```

## 気をつけること

- **スマホ用の `@media screen and (max-width:820px)` の `screen and` を消さないこと。**
  これがないと A4 の紙幅（794px）も 820px 以下なので、**印刷にも画面用の指定が効いてしまい**、
  紙の余白が変わって「添付資料」の箱が表紙の上に移動してしまいます。
- **`</body>` の直前の「公開用の共通フッター」（GoatCounter ＋ `sg-glow`）を落とさないこと。**
  skill `physics-sim-page` §5 のかたまりを、一字も変えずに入れてあります。
  `build_rep.js` が、この 2 つが入っているかを書き出す前に確かめます。
- `@media print` は紙用。210mm のままにしておくこと。
