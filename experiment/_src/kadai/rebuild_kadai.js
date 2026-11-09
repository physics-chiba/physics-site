// 課題ファイルを、いまの motion-analysis.html で作り直す（課題の中身＝window.KADAI はそのまま）
//   node rebuild_kadai.js <motion-analysis.html> <古い課題.html> <新しい課題.html>
// 課題ファイル＝アプリ本体の </head> の直前に <script id="kadaiData">window.KADAI=…;</script> を入れたもの（70_export.js の makeKadai と同じ形）
const fs = require('fs');
const [app, oldf, newf] = process.argv.slice(2);
const src = fs.readFileSync(app, 'utf8'), s = fs.readFileSync(oldf, 'utf8');
const a = s.indexOf('<script id="kadaiData">'), b = s.indexOf('</script></head>', a);
if (a < 0 || b < 0) throw new Error('課題のデータが見つかりません: ' + oldf);
const js = s.slice(a + '<script id="kadaiData">'.length, b);
const k = src.indexOf('</head>');
fs.writeFileSync(newf, src.slice(0, k) + '<script id="kadaiData">' + js + '</script>' + src.slice(k));
console.log(newf, (fs.statSync(newf).size / 1048576).toFixed(1) + ' MB');
