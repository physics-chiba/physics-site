// 課題ページ index.html を作る（index_tpl.html ＋ サムネイル thumbs.json ＋ 大きさ info.json）
const fs = require('fs');
const T = JSON.parse(fs.readFileSync('thumbs.json')), I = JSON.parse(fs.readFileSync('info.json'));
const D = {
  '1_tousoku': ['等速直線運動', '手で押し出した台車が、机の上を進んでいく動画です。'],
  '2_nageage': ['鉛直投げ上げ運動', '真上に投げ上げたボールが、上がって落ちてくる動画です。'],
  '3_tanshindou': ['単振動', 'ばねにつるしたおもりが、上下に振動する動画です。'],
  '4_enundou': ['等速円運動', '回っている扇風機の羽根につけた印を追いかける動画です。'],
  '5_gensui-enundou': ['減衰円運動', 'だんだんゆっくりになっていく扇風機の羽根につけた印を追いかける動画です。'],
};
const TALL = { '2_nageage': 1, '5_gensui-enundou': 1 };
const cards = I.map((inf, i) => { const k = inf.key;
  return '    <article class="card">\n' +
    '      <div class="thumb"><img src="' + T[k] + '" alt="' + D[k][0] + 'の動画のようす"' + (TALL[k] ? ' class="tall"' : '') + ' loading="lazy"></div>\n' +
    '      <div class="body">\n        <h3><span class="num">' + (i + 1) + '</span>' + D[k][0] + '</h3>\n        <p>' + D[k][1] + '</p>\n' +
    '        <div class="row"><span class="meta">大きさ ' + inf.mb + ' MB</span><a class="open" href="' + inf.file + '">開く</a></div>\n      </div>\n    </article>'; }).join('\n');
const s = fs.readFileSync('index_tpl.html', 'utf8').replace('@@CARDS@@', cards).replace('@@VER@@', process.argv[2] || '')
  .replace('@@FOOTER@@', fs.readFileSync(process.argv[3] || '/home/claude/ma/src/99_footer.html', 'utf8'));
fs.writeFileSync('index.html', s); console.log('index.html', s.length);
