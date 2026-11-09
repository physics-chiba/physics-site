// 扇風機（IMG_6762）で、途中で「解析終了」になるかを調べる。
// 千葉さんの端末では HEVC の再生でコマを取りこぼし、表が「38.5 コマ/秒」・途中まで になっていたと考え、それをまねる。
const L = require('./lib');
const path = require('path'), fs = require('fs');
const APP_URL = process.argv[2] ? 'file://' + path.resolve(process.argv[2]) : null;
(async () => {
  const b = await L.chromium.launch();
  const p = await L.newPage(b, APP_URL, { viewport: { width: 1594, height: 866 }, flags: { __fill: !!process.env.FILL } });
  const b64 = fs.readFileSync(path.join(__dirname, 'fan60.webm')).toString('base64');
  await p.evaluate(({ b64 }) => { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    loadVideoUrl(URL.createObjectURL(new Blob([u], { type: 'video/webm' })), 'IMG_6762.webm'); }, { b64 });
  await L.waitReady(p, 60000);
  await p.evaluate(() => { const o = window.toast; window.toast = function (m) { (window.__toasts = window.__toasts || []).push(String(m).slice(0, 60)); return o.apply(this, arguments); }; });
  const r = await p.evaluate(async () => {
    /* 取りこぼし：6 割のところで 1 コマ落とす。0.95 秒と 5.05 秒には 8 コマの穴 */
    const full = VID.frames.slice(); let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const deg = [];
    for (let i = 0; i < full.length; i++) {
      const t = full[i];
      if ((t > 1.5 && t < 1.5 + 8 / 60) || (t > 5.6 && t < 5.6 + 8 / 60)) continue;
      if (deg.length && full[i - 1] === deg[deg.length - 1] && rnd() < 0.6) continue;
      deg.push(t);
    }
    VID.frames = deg; VID.tableA = 0; VID.tableB = VID.dur;
    setFpsFromFrames();
    if (window.__fill && typeof fillByCfr === 'function') fillByCfr();
    trimTable();
    const tbl = { n: VID.frames.length, a: +VID.frames[0].toFixed(3), b: +VID.frames[VID.frames.length - 1].toFixed(3), fps: +VID.fps.toFixed(2), partial: VID.tablePartial };
    /* 実験2 にして、千葉さんの範囲（3.65〜8.8 秒）・N=2・原点は扇風機の中心 */
    { const ne = newExp(APP.exps.length + 1); ne.video = JSON.parse(JSON.stringify(EXP().video)); APP.exps.push(ne); APP.cur = APP.exps.length - 1; }
    const e = EXP();
    e.t0 = 3.65; e.rangeB = 8.8;
    e.origin = { x: 940, y: 472 }; e.originSet = true; e.axisSet = true; e.mPerPx = 0.001;
    UI.calPend = null; APP.editStep = 0;
    APP.autoTrack = true; document.getElementById('cbAuto').checked = true;
    document.getElementById('inStepN').value = 2;
    e.objReady[0] = true; e.trackReady = true; UI.startedAuto = true;
    afterChange();
    await vidSeek(3.66); afterSeek();
    vidDrawFull();
    const g = document.getElementById('cvFull').getContext('2d'), d = g.getImageData(0, 0, VID.w, VID.h).data;
    let sx = 0, sy = 0, n = 0;
    for (let y = 0; y < VID.h; y++) for (let x = 600; x < VID.w; x++) { const k = (y * VID.w + x) * 4; if (d[k] > 170 && d[k + 1] < 80 && d[k + 2] < 90) { sx += x; sy += y; n++; } }
    const mx = sx / n, my = sy / n;
    const px = g.getImageData(Math.round(mx), Math.round(my), 1, 1).data;
    APP.trackColor = { r: px[0], g: px[1], b: px[2] };
    addPoint(0, mx, my, false);
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    let lost = 0;
    for (let k = 0; k < 30; k++) {
      autoRunAll(); while (UI.autoRunning) await sleep(20);
      if (!UI.autoLost) break;
      lost++; UI.autoLost = false;   // 見失ったら：同じ予測で続ける（今回は止まる位置だけを見たい）
      vidDrawFull(); const dd = document.getElementById('cvFull').getContext('2d').getImageData(0, 0, VID.w, VID.h).data;
      let ax = 0, ay = 0, an = 0;
      for (let y = 0; y < VID.h; y++) for (let x = 600; x < 1500; x++) { const k = (y * VID.w + x) * 4; if (dd[k] > 150 && dd[k + 1] < 100 && dd[k + 2] < 110 && dd[k] - dd[k + 1] > 80) { ax += x; ay += y; an++; } }
      if (!an) break; addPoint(0, ax / an, ay / an, false);
    }
    const pts = e.objs[0], last = pts[pts.length - 1].t; window.__why = { autoLost: UI.autoLost, running: UI.autoRunning };
    return { why: window.__why, toasts: (window.__toasts || []).slice(-4), tbl, marker: n, nPts: pts.length, last: +last.toFixed(3), done: trackingDone(), cur: +VID.cur.toFixed(3), lost, exp: APP.cur };
  });
  console.log(JSON.stringify(r));
  console.log('errors', p.__errors);
  await b.close();
})();
