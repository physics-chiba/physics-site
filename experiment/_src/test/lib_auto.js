// 色で自動追跡を、見失うたびに正しい所を手でクリックしながら最後まで走らせる（auto_bench・run_test 共用）
const L = require('./lib');
const path = require('path');
async function runCase(browser, C, N, APP_URL) {
  const p = await L.newPage(browser, APP_URL);
  /* file:// の動画だと canvas が「よそのデータ」扱いで色を読めないので、ファイルを選んだときと同じ blob: で渡す */
  const b64 = L.fs.readFileSync(path.join(L.ROOT, C.video)).toString('base64');
  await p.evaluate(({ b64, name }) => { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    loadVideoUrl(URL.createObjectURL(new Blob([u], { type: 'video/webm' })), name); }, { b64, name: C.video.split('/').pop() });
  await L.waitReady(p);
  const truthSrc = C.truth.toString();
  const res = await p.evaluate(async ({ N, truthSrc }) => {
    const truth = eval(truthSrc);
    const e = EXP();
    e.t0 = 0; e.rangeB = VID.frames[VID.frames.length - 1];
    e.origin = { x: 10, y: 10 }; e.originSet = true; e.axisSet = true; e.mPerPx = 0.001;
    UI.calPend = null; APP.editStep = 0;
    APP.autoTrack = true; document.getElementById('cbAuto').checked = true;
    document.getElementById('inStepN').value = N;
    e.objReady[0] = true; e.trackReady = true; UI.startedAuto = true;
    afterChange();
    await vidSeek(0); afterSeek();
    /* 色：はじめのコマの、物体の中心の画素 */
    const t0p = truth(VID.cur);
    vidDrawFull();
    const px = document.getElementById('cvFull').getContext('2d').getImageData(Math.round(t0p.x), Math.round(t0p.y), 1, 1).data;
    APP.trackColor = { r: px[0], g: px[1], b: px[2] };
    addPoint(0, t0p.x, t0p.y, false);
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    let lost = 0, guard = 0;
    while (guard++ < 400) {
      autoRunAll();
      while (UI.autoRunning) await sleep(20);
      if (VID.cur >= e.rangeB - 1e-6) break;
      if (!UI.autoLost) break;
      lost++; (window.__lostAt=window.__lostAt||[]).push(e.objs[0].length);
      /* 生徒の代わりに：見失ったコマで、正しい位置を手でクリック */
      const tp = truth(VID.cur);
      UI.autoLost = false;
      addPoint(0, tp.x, tp.y, false);
    }
    const pts = e.objs[0];
    let maxErr = 0, sumErr = 0, nAuto = 0;
    const bad=[]; pts.forEach((q,i) => { const tp = truth(q.t); const d = Math.hypot(q.x - tp.x, q.y - tp.y); if(d>20) bad.push([i, q.auto?'自動':'手', +q.t.toFixed(3), Math.round(q.x), Math.round(q.y), Math.round(tp.x), Math.round(tp.y)]); if (!q.auto) return; maxErr = Math.max(maxErr, d); sumErr += d; nAuto++; });
    window.__bad=bad;
    return { bad: JSON.stringify(window.__bad.slice(0,6)), lostAt: (window.__lostAt||[]).join(','), lost, n: pts.length, nAuto, maxErr, meanErr: nAuto ? sumErr / nAuto : 0 };
  }, { N, truthSrc });
  res.errors = p.__errors.length;
  await p.context().close();
  return res;
}


module.exports = { runCase };
