// 色で自動追跡のベンチマーク：見失うたびに「生徒が正しい所を手でクリックして続きを押す」をまねて、
// 見失った回数と、置いた点のずれを数える。
//   node test/auto_bench.js [html]   （html を省くと ../motion-analysis.html）
const L = require('./lib');
const path = require('path');
const APP_URL = process.argv[2] ? 'file://' + path.resolve(process.argv[2]) : L.APPURL;

/* 動画ごとの「本当の位置」（動画ピクセル、中心） */
const CASES = [
  { video: 'test/shm.webm', name: '単振動（たて・周期 0.6 s・振幅 150 px・赤い帯つき）', N: [1, 2, 3, 4],
    truth: t => ({ x: 300, y: 480 + 150 * Math.cos(2 * Math.PI * t / 0.6) }) },
  { video: 'test/shm_mid.webm', name: '減衰振動（つり合いの位置＝いちばん速い所から・横 100 px に同じ色の四角）', N: [2, 3, 4],
    truth: t => ({ x: 300, y: 480 + 150 * Math.exp(-t / 3) * Math.sin(2 * Math.PI * t / 0.7) }) },
  { video: 'test/uni.webm', name: '等速（速い：1 コマ 20 px）', N: [1, 3, 5],
    truth: t => ({ x: 35 + 600 * t, y: 180 }) },
  { video: 'test/circ.webm', name: '等速円運動（半径 150 px・周期 1.2 s）', N: [2, 3, 5],
    truth: t => ({ x: 320 + 150 * Math.cos(2 * Math.PI * t / 1.2), y: 240 + 150 * Math.sin(2 * Math.PI * t / 1.2) }) },
  { video: 'test/proj2.webm', name: '斜方投射', N: [1, 3, 5],
    truth: t => ({ x: 63 + 300 * t, y: 303 - (350 * t - 250 * t * t) }) },
];

const { runCase } = require('./lib_auto');

(async () => {
  const browser = await L.chromium.launch();
  const all = [];
  for (const C of CASES) {
    console.log(C.name);
    for (const N of C.N) {
      const r = await runCase(browser, C, N, APP_URL);
      all.push(Object.assign({ name: C.name, N }, r));
      console.log(`  N=${N}  点 ${String(r.n).padStart(3)}（自動 ${String(r.nAuto).padStart(3)}）  見失い ${String(r.lost).padStart(2)} 回  ずれ 最大 ${r.maxErr.toFixed(1)} px／平均 ${r.meanErr.toFixed(2)} px  エラー ${r.errors}  見失った点の番号 [${r.lostAt}]` + (r.bad!=='[]'? '\n      ずれの大きい点 '+r.bad : ''));
    }
  }
  await browser.close();
  require('fs').writeFileSync(path.join(__dirname, '_bench.json'), JSON.stringify(all));
})();
