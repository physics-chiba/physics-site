// 生徒向けプリント用（第69回）：手でクリックの続き・色マーカーの探索半径・見失ったとき
//   guide_shots.js → guide_shots_hand.js のあとに実行（_kadai_guide.html／_kadai_guide_hand.html を使う）
const L = require('./lib');
const path = require('path'), fs = require('fs');
const OUT = '/home/claude/guide/shots';
const VW = { width: 1366, height: 800 };
(async () => {
  const b = await L.chromium.launch();
  const R = JSON.parse(fs.readFileSync(path.join(OUT, 'rects.json')));
  async function open(file) {
    const p = await L.newPage(b, 'file://' + path.join(__dirname, file), { flags: false, viewport: VW, dpr: 2 });
    await L.waitReady(p, 40000); await p.waitForTimeout(800); await p.evaluate(() => window.scrollTo(0, 0));
    return p;
  }
  const rectOf = (p, sel) => p.evaluate((sel) => { const x = document.querySelector(sel); if (!x || !x.offsetParent) return null; const r = x.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }, sel);
  /* 動画の座標 → 画面の座標 */
  const v2c = (p, vx, vy) => p.evaluate(({ vx, vy }) => { const cv = document.getElementById('cvOv'), r = cv.getBoundingClientRect(), c = CROP(); return { x: r.left + (vx - c.x) / c.w * r.width, y: r.top + (vy - c.y) / c.h * r.height }; }, { vx, vy });
  const findMk = (p) => p.evaluate(() => { vidDrawFull(); const g = document.getElementById('cvFull').getContext('2d'); const d = g.getImageData(0, 300, VID.w, 140).data;
    let sx = 0, sy = 0, n = 0; for (let y = 0; y < 140; y++) for (let x = 0; x < VID.w; x++) { const k = (y * VID.w + x) * 4; if (d[k] > 180 && d[k + 1] < 80 && d[k + 2] < 80) { sx += x; sy += y + 300; n++; } }
    return { vx: sx / n, vy: sy / n }; });
  const clickMk = async (p) => { const m = await findMk(p); const c = await v2c(p, m.vx, m.vy); await p.mouse.click(c.x, c.y); await p.waitForTimeout(650); return { m, c }; };

  /* ---- 手でクリック：1 回目・2 回目・何回か ---- */
  {
    const p = await open('_kadai_guide_hand.html');
    await p.click('#btnTrkStart'); await p.waitForTimeout(600);
    await p.evaluate(() => { const x = document.getElementById('vhintX'); if (x) x.click(); }); await p.waitForTimeout(200);
    let m = await findMk(p), c = await v2c(p, m.vx, m.vy);
    R.m1 = { vb: await rectOf(p, '#videobox'), mk: { x: c.x - 14, y: c.y - 14, w: 28, h: 28 } };
    await p.screenshot({ path: path.join(OUT, 'm1.png') });
    await clickMk(p); await clickMk(p); const first = await clickMk(p);
    m = await findMk(p); c = await v2c(p, m.vx, m.vy);
    R.m2 = { vb: await rectOf(p, '#videobox'), prev: { x: first.c.x - 14, y: first.c.y - 14, w: 28, h: 28 }, mk: { x: c.x - 14, y: c.y - 14, w: 28, h: 28 } };
    await p.evaluate(() => { const x = document.getElementById('vhintX'); if (x && x.offsetParent) x.click(); }); await p.waitForTimeout(150);
    await p.screenshot({ path: path.join(OUT, 'm2.png') });
    for (let i = 0; i < 5; i++) await clickMk(p);
    await p.evaluate(() => { const x = document.getElementById('vhintX'); if (x && x.offsetParent) x.click(); }); await p.waitForTimeout(150);
    m = await findMk(p); c = await v2c(p, m.vx, m.vy);
    R.m3 = { vb: await rectOf(p, '#videobox'), mk: { x: c.x - 14, y: c.y - 14, w: 28, h: 28 }, n: await p.evaluate(() => EXP().objs[0].length) };
    await p.screenshot({ path: path.join(OUT, 'm3.png') });
    console.log('手', R.m3.n, p.__errors);
    await p.context().close();
  }
  /* ---- 色マーカー：探索半径（案内を最小化）・見失った・見つけました ---- */
  {
    const p = await open('_kadai_guide.html');
    R.c1 = { vb: await rectOf(p, '#videobox'), auto: await rectOf(p, '#btnTrkStartA') };
    await p.screenshot({ path: path.join(OUT, 'c1.png') });
    await p.click('#btnTrkStartA'); await p.waitForTimeout(600);
    const st = await clickMk(p);
    /* 案内を最小化して、円をよく見せる */
    await p.evaluate(() => { const bt = [...document.querySelectorAll('#calMsg .btn')].find(x => /最小化/.test(x.textContent)); bt && bt.click(); }); await p.waitForTimeout(400);
    const rc = await p.evaluate(() => ({ x: UI.radCenter.x, y: UI.radCenter.y, r: parseInt(document.getElementById('inSearchR').value) || 40 }));
    const cen = await v2c(p, rc.x, rc.y), knob = await v2c(p, rc.x + rc.r, rc.y);
    R.c3 = { vb: await rectOf(p, '#videobox'), knob: { x: knob.x - 12, y: knob.y - 12, w: 24, h: 24 }, cen, rad: knob.x - cen.x, msg: await rectOf(p, '#calMsg') };
    await p.screenshot({ path: path.join(OUT, 'c3.png') });
    /* 自動追跡を開始して、少し進んだところで「見失った」ことにする */
    await p.evaluate(() => { const bt = [...document.querySelectorAll('#calMsg .btn')].find(x => /自動追跡を開始する/.test(x.textContent)); bt && bt.click(); });
    await p.waitForFunction(() => EXP().objs[0].length >= 6, null, { timeout: 30000 });
    await p.evaluate(() => { stopAuto(); }); await p.waitForTimeout(500);
    /* いまのコマの点を消して「このコマで見失った」状態にする（次のクリックがこのコマの記録になる） */
    await p.evaluate(() => { const e = EXP(), h = 0.4 / (VID.fps || 30); e.objs[0] = e.objs[0].filter(q => q.t < VID.cur - h); UI.autoLost = false; autoLost(); render(); });
    await p.waitForTimeout(500);
    let m = await findMk(p), c = await v2c(p, m.vx, m.vy);
    R.c5 = { vb: await rectOf(p, '#videobox'), msg: await rectOf(p, '#autoMsg'), mk: { x: c.x - 14, y: c.y - 14, w: 28, h: 28 } };
    await p.screenshot({ path: path.join(OUT, 'c5.png') });
    /* 大きな知らせが出ている間の 1 回目のクリックは、知らせを消すだけ。2 回目で記録される */
    await p.mouse.click(c.x, c.y); await p.waitForTimeout(400);
    await p.mouse.click(c.x, c.y); await p.waitForTimeout(700);
    R.c6 = { vb: await rectOf(p, '#videobox'), msg: await rectOf(p, '#autoMsg') };
    await p.screenshot({ path: path.join(OUT, 'c6.png') });
    console.log('色', JSON.stringify({ c5: R.c5.msg, c6: R.c6.msg, txt: await p.evaluate(() => document.getElementById('autoMsg').textContent) }), p.__errors);
    await p.context().close();
  }
  fs.writeFileSync(path.join(OUT, 'rects.json'), JSON.stringify(R, null, 1));
  await b.close();
})();
