# motion-analysis.html の元ソース

公開している `../motion-analysis.html` は、**このフォルダの中身から作ります。**
できあがりの HTML を直接さわらないでください（次に作り直したときに消えます）。

| ファイル | 中身 |
| --- | --- |
| `src/template.html` | 全体の骨組み。`@@ファイル名@@` のところに下の各ファイルが入る |
| `src/00_head.html` 〜 `src/90_boot.js` | 見た目（CSS）・画面（HTML）・計算・動画・トラッキング・グラフ・出力・操作・起動 |
| `src/99_footer.html` | 公開用の共通フッター（GoatCounter ＋ スタートの発光）。skill physics-sim-page §5 のまま |
| `build.js` | 1 枚の HTML にまとめる（共通フッターが無いと止まる） |
| `test/run_test.js` | 自動テスト（Playwright）。`test/proj.webm` などの小さな動画を使う |

## 作り直す手順

```
node build.js            # → motion-analysis.html
node test/run_test.js    # 全部 OK になること（2 回続けて）
```
