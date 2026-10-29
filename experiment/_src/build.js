// motion-analysis.html のビルド
//   src/template.html の @@ファイル名@@ を src/ の各ファイルで置きかえて 1 枚にする。
//   使い方： node build.js   → ./motion-analysis.html
const fs = require('fs'), path = require('path');
const SRC = path.join(__dirname, 'src');
let out = fs.readFileSync(path.join(SRC, 'template.html'), 'utf8');
out = out.replace(/@@([\w.]+)@@/g, (m, n) => {
  const f = path.join(SRC, n);
  if (!fs.existsSync(f)) { console.error('ありません:', n); process.exit(1); }
  return fs.readFileSync(f, 'utf8');
});
// 落としてはいけないもの（skill physics-sim-page §5）
for (const t of ['physics-chiba.goatcounter.com', 'sg-glow']) {
  if (!out.includes(t)) { console.error('共通フッターがありません:', t); process.exit(1); }
}
fs.writeFileSync(path.join(__dirname, 'motion-analysis.html'), out);
console.log('motion-analysis.html', (Buffer.byteLength(out) / 1024).toFixed(0) + ' KB');
