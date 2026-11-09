// 生徒向け「課題ファイルの使い方」プリント用のスクリーンショットを撮る
//   1) 先生役：台車の動画で課題ファイルを書き出す（自動追跡 ON・N=3・JSON OFF）
//   2) 生徒役：その課題ファイルを開いて、色で自動追跡 → ②グラフ → 動画と一緒に再生 → レポートPDF
const L = require('./lib');
const path = require('path'), fs = require('fs');
const OUT = '/home/claude/guide/shots';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const b = await L.chromium.launch();
  const VW = { width: 1366, height: 800 };
  /* ---- 先生役 ---- */
  const t = await L.newPage(b, null, { viewport: VW });
  const b64 = fs.readFileSync(path.join(__dirname, 'cart_real.webm')).toString('base64');
  await t.evaluate(({ b64 }) => { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const blob = new Blob([u], { type: 'video/webm' });
    loadVideoUrl(URL.createObjectURL(blob), 'daisha.webm');
    KADAI_SRC = { data: 'data:video/webm;base64,' + b64, type: 'video/webm', size: u.length, name: 'daisha.webm' }; }, { b64 });
  await L.waitReady(t);
  await t.evaluate(() => {
    const e = EXP(); const fr = VID.frames;
    const k = i => fr[Math.min(fr.length - 1, i)];
    e.t0 = k(3); e.rangeB = k(48);
    e.origin = { x: 430, y: 376 }; e.originSet = true; e.axisSet = true; e.angle = 0;
    e.mPerPx = 0.5 / 494; e.scaleLen = 0.5; e.scaleRef = { x1: 718, y1: 452, x2: 1212, y2: 452 };
    UI.calPend = null; APP.editStep = 0; document.getElementById('inStepN').value = 3;
    afterChange();
    const c = document.getElementById('cbTeacher'); c.checked = true; c.onchange();
  });
  await t.click('#btnKadai'); await t.waitForSelector('#kdMake', { state: 'visible' });
  await t.fill('#kdTitle', '動画解析を体験しよう：台車の運動');
  await t.fill('#kdQ', '');
  await t.selectOption('#kdAuto', '1'); await t.selectOption('#kdN', '3'); await t.selectOption('#kdJson', '0');
  await t.evaluate(() => { const c = document.getElementById('kdScaleOn'); c.checked = false; c.dispatchEvent(new Event('change')); });
  const [dl] = await Promise.all([t.waitForEvent('download'), t.click('#kdMake')]);
  const kf = path.join(__dirname, '_kadai_guide.html'); await dl.saveAs(kf);
  await t.context().close();

  /* ---- 生徒役 ---- */
  const p = await L.newPage(b, 'file://' + kf, { flags: false, viewport: VW, dpr: 2 });
  const RECTS = {};
  const rectOf = (sel) => p.evaluate((sel) => { const x = typeof sel === 'string' ? document.querySelector(sel) : null; if (!x) return null; const r = x.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }, sel);
  const rectBtn = (re) => p.evaluate((src) => { const r0 = new RegExp(src); const b = [...document.querySelectorAll('button')].find(x => x.offsetParent && r0.test(x.textContent.trim())); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }, re.source);
  await L.waitReady(p, 40000);
  await p.waitForTimeout(800);
  const shot = (name, clip) => p.screenshot({ path: path.join(OUT, name), clip });
  const area = sel => p.evaluate((sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return { x: Math.max(0, r.left), y: Math.max(0, r.top), width: r.width, height: r.height }; }, sel);
  await p.evaluate(() => window.scrollTo(0, 0));
  RECTS.s1 = { vb: await rectOf('#videobox'), auto: await rectOf('#btnTrkStartA'), hand: await rectOf('#btnTrkStartH'), card: await rectOf('#side1 .card.op') };
  await shot('s1_open.png', { x: 0, y: 0, width: VW.width, height: VW.height });
  /* 色で自動追跡 */
  await p.click('#btnTrkStartA'); await p.waitForTimeout(700);
  RECTS.s2 = { vb: await rectOf('#videobox') };
  await shot('s2_color.png', { x: 0, y: 0, width: VW.width, height: VW.height });
  /* マーカーをクリック */
  const pt = await p.evaluate(() => { const cv = document.getElementById('cvOv'), r = cv.getBoundingClientRect(), c = CROP();
    const vx = 430 + 0, vy = 376; return { x: r.left + (vx - c.x) / c.w * r.width, y: r.top + (vy - c.y) / c.h * r.height }; });
  // いまのコマ（t0）のマーカーの位置を探す
  const mk = await p.evaluate(() => { vidDrawFull(); const g = document.getElementById('cvFull').getContext('2d'); const d = g.getImageData(0, 300, VID.w, 140).data;
    let sx = 0, sy = 0, n = 0; for (let y = 0; y < 140; y++) for (let x = 0; x < VID.w; x++) { const k = (y * VID.w + x) * 4; if (d[k] > 180 && d[k + 1] < 80 && d[k + 2] < 80) { sx += x; sy += y + 300; n++; } }
    const vx = sx / n, vy = sy / n, cv = document.getElementById('cvOv'), r = cv.getBoundingClientRect(), c = CROP();
    return { x: r.left + (vx - c.x) / c.w * r.width, y: r.top + (vy - c.y) / c.h * r.height, n }; });
  await p.mouse.click(mk.x, mk.y); await p.waitForTimeout(700);
  RECTS.s3 = { vb: await rectOf('#videobox'), start: await rectBtn(/^自動追跡を開始する$/), mk: { x: mk.x - 14, y: mk.y - 14, w: 28, h: 28 } };
  RECTS.s2.mk = RECTS.s3.mk;
  await shot('s3_radius.png', { x: 0, y: 0, width: VW.width, height: VW.height });
  /* 自動追跡を開始する */
  await p.evaluate(() => { const bt = [...document.querySelectorAll('#calMsg .btn')].find(x => /自動追跡を開始する/.test(x.textContent)); bt && bt.click(); });
  await p.waitForFunction(() => !UI.autoRunning, null, { timeout: 60000 });
  await p.waitForTimeout(600);
  const st = await p.evaluate(() => ({ n: EXP().objs[0].length, done: trackingDone(), lost: UI.autoLost }));
  console.log('自動追跡', st);
  RECTS.s4 = { vb: await rectOf('#videobox'), done: await rectOf('#doneMsg') };
  await shot('s4_done.png', { x: 0, y: 0, width: VW.width, height: VW.height });
  /* ②グラフ */
  await p.click('#tabs button[data-mode="2"]'); await p.waitForTimeout(900);
  await p.evaluate(() => window.scrollTo(0, 0));
  RECTS.s5 = { tab2: await rectOf('#tabs button[data-mode="2"]'), live: await rectOf('#btnM2Live') };
  await shot('s5_tab2.png', { x: 0, y: 0, width: VW.width, height: VW.height });
  await p.click('#btnM2Live'); await p.waitForTimeout(900);
  await p.evaluate(() => { liveTick(rangeStart(EXP()) + 0.9); });
  await p.waitForTimeout(500);
  await p.evaluate(() => window.scrollTo(0, 0));
  RECTS.s6 = { live: await rectOf('#btnM2Live'), play: await rectOf('#btnLivePlay'), pdf: await rectBtn(/^レポートPDF$/), tab2: await rectOf('#tabs button[data-mode="2"]') };
  await shot('s6_live.png', { x: 0, y: 0, width: VW.width, height: VW.height });
  /* レポートPDF */
  await p.evaluate(() => { const bs = [...document.querySelectorAll('button')].filter(x => x.offsetParent && /^レポートPDF$/.test(x.textContent.trim())); bs[0].scrollIntoView({ block: 'center' }); });
  const rb = await p.evaluate(() => { const bs = [...document.querySelectorAll('button')].filter(x => x.offsetParent && /^レポートPDF$/.test(x.textContent.trim())); const r = bs[0].getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await p.mouse.click(rb.x, rb.y); await p.waitForTimeout(600);
  RECTS.s7 = { box: await p.evaluate(() => { const m = [...document.querySelectorAll('.modal')].find(x => !x.classList.contains('hide')); const r = m.querySelector('.box, div').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }), yes: await rectBtn(/^はい$/) };
  await shot('s7_stro.png', { x: 0, y: 0, width: VW.width, height: VW.height });
  const yes = await p.evaluate(() => { const bs = [...document.querySelectorAll('.modal:not(.hide) button, button')].filter(x => x.offsetParent && /^はい/.test(x.textContent.trim())); if (bs[0]) { bs[0].click(); return bs[0].textContent; } return null; });
  console.log('はい', yes);
  await p.waitForFunction(() => !!document.getElementById('inSaveName'), null, { timeout: 60000 });
  await p.waitForTimeout(400);
  RECTS.s8 = { box: await p.evaluate(() => { const r = document.getElementById('inSaveName').closest('.modal').querySelector('.box, div').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }), ok: await rectBtn(/^保存する$/), inp: await rectOf('#inSaveName') };
  await shot('s8_name.png', { x: 0, y: 0, width: VW.width, height: VW.height });
  fs.writeFileSync(path.join(OUT, 'rects.json'), JSON.stringify(RECTS, null, 1));
  const [dpdf] = await Promise.all([p.waitForEvent('download'), p.evaluate(() => { const m = document.getElementById('inSaveName').closest('.modal'); m.querySelector('[data-x="ok"]').click(); })]);
  await dpdf.saveAs(path.join(OUT, 'report.pdf')); console.log('PDF', dpdf.suggestedFilename());
  console.log('errors', p.__errors);
  await b.close();
})();
