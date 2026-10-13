// AI レポートのビルド
//   report_src2.html の {{key}} を figs.json の base64 画像に置きかえて
//   motion-analysis_AI-collaboration.html（1 枚の HTML）を書き出す。
// 使い方： node build_rep.js
const fs = require('fs');
const path = require('path');

const dir  = __dirname;
const src  = fs.readFileSync(path.join(dir, 'report_src2.html'), 'utf8');
const figs = JSON.parse(fs.readFileSync(path.join(dir, 'figs.json'), 'utf8'));

let miss = [];
const out = src.replace(/\{\{([A-Za-z0-9_]+)\}\}/g, (m, k) => {
  if (!(k in figs)) { miss.push(k); return m; }
  return figs[k];
});
if (miss.length) { console.error('図が見つかりません:', miss.join(', ')); process.exit(1); }

// 落としてはいけないもの（skill physics-sim-page §5・§6）
const must = ['physics-chiba.goatcounter.com', 'sg-glow', '@media screen and (max-width:820px)'];
for (const t of must) {
  if (out.indexOf(t) < 0) { console.error('必須の部分がありません:', t); process.exit(1); }
}
if (/\{\{[A-Za-z0-9_]+\}\}/.test(out)) { console.error('置きかえ残りがあります'); process.exit(1); }

const dst = path.join(dir, 'motion-analysis_AI-collaboration.html');
fs.writeFileSync(dst, out);
console.log('書き出しました:', dst, (Buffer.byteLength(out) / 1024).toFixed(0) + ' KB',
            '／図', Object.keys(figs).length, '枚');
