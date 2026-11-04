// トラッキングの最後：N コマ進めると範囲の終わりを越えるとき、何が起きるか
//   いま表示されているコマ（赤い四角の位置から逆算した時刻）と、記録される時刻（VID.cur）を比べる
const L = require('./lib'); const path = require('path');
const APPU = process.argv[2] ? 'file://' + path.resolve(process.argv[2]) : L.APPURL;
(async () => {
  const b = await L.chromium.launch();
  for (const [N, endFr] of [[5, 41], [5, 43], [3, 44], [4, 42]]) {
    const p = await L.newPage(b, APPU);
    const b64 = L.fs.readFileSync(path.join(L.ROOT, 'test/uni.webm')).toString('base64');
    await p.evaluate(({ b64 }) => { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      loadVideoUrl(URL.createObjectURL(new Blob([u], { type: 'video/webm' })), 'uni.webm'); }, { b64 });
    await L.waitReady(p);
    const r = await p.evaluate(async ({ N, endFr }) => {
      const e = EXP();
      e.t0 = VID.frames[0]; e.rangeB = VID.frames[endFr];
      e.origin = { x: 10, y: 10 }; e.originSet = true; e.axisSet = true; e.mPerPx = 0.001; UI.calPend = null;
      e.objReady[0] = true; e.trackReady = true; document.getElementById('inStepN').value = N; document.getElementById('selAfter').value = 'n';
      afterChange(); await vidSeek(e.t0); afterSeek();
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const shown = () => { vidDrawFull(); const d = document.getElementById('cvFull').getContext('2d').getImageData(0, 180, VID.w, 1).data;
        let xs = []; for (let x = 0; x < VID.w; x++) { const k = x * 4; if (d[k] > 180 && d[k + 1] < 90) xs.push(x); } return xs.length ? (xs[0] + xs[xs.length - 1]) / 2 : null; };
      const out = [];
      for (let k = 0; k < 30; k++) {
        await VID.q; await sleep(120);
        const sx = shown(), tShown = (sx - 35) / 600;        // 画面に出ている四角の時刻
        const before = e.objs[0].length;
        if (trackingDone()) { out.push(['done', +VID.cur.toFixed(4)]); break; }
        commitPoint(sx, 180, null);                          // 見えている所をクリック
        await sleep(200); await VID.q;
        const last = e.objs[0][e.objs[0].length - 1];
        out.push([+last.t.toFixed(4), +tShown.toFixed(4), last.fr, e.objs[0].length > before ? '追加' : '上書き']);
        if (e.objs[0].length === before) break;
      }
      const s = series(e, 0).slice(-4).map(p => [+p.t.toFixed(3), p.vx === null ? null : +p.vx.toFixed(3)]);
      return { endT: +e.rangeB.toFixed(4), pts: out.slice(-4), series: s, n: e.objs[0].length };
    }, { N, endFr });
    console.log(`N=${N} 終わり=第${endFr}コマ`, JSON.stringify(r));
    await p.context().close();
  }
  await b.close();
})();
