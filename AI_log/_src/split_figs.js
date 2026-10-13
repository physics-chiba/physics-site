// できあがった HTML から figs.json を取り出し直す（図の置き場をなくさないための保険）
//   使い方： node split_figs.js ../motion-analysis_AI-collaboration.html
// report_src2.html の {{fig1}}…{{fig17}} は、HTML に出てくる図の順番と同じです。
const fs = require('fs'), path = require('path');
const f = process.argv[2] || path.join(__dirname, '..', 'motion-analysis_AI-collaboration.html');
const s = fs.readFileSync(f, 'utf8');
const figs = {};
let i = 0;
s.replace(/data:image\/[a-z+]+;base64,[A-Za-z0-9+/=]+/g, m => { figs['fig' + (++i)] = m; return m; });
const n = (fs.readFileSync(path.join(__dirname, 'report_src2.html'), 'utf8')
  .match(/\{\{fig\d+\}\}/g) || []).length;
if (i !== n) { console.error(`図の数が合いません：HTML ${i} 枚 / ソース ${n} か所`); process.exit(1); }
fs.writeFileSync(path.join(__dirname, 'figs.json'), JSON.stringify(figs));
console.log('figs.json を作りました：', i, '枚');
