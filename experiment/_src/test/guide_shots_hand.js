// 生徒向けプリント用：［手でクリックして記録］で数点打ったところ（guide_shots.js のあとに実行。_kadai_guide.html を使う）
const L = require('./lib');
const path = require('path'), fs = require('fs');
const OUT = '/home/claude/guide/shots';
(async () => {
  const b = await L.chromium.launch();
  const VW = { width: 1366, height: 800 };
  /* 自動追跡 OFF の課題（［手でクリックして記録］だけが出る）にする */
  const kf = path.join(__dirname, '_kadai_guide_hand.html');
  fs.writeFileSync(kf, fs.readFileSync(path.join(__dirname, '_kadai_guide.html'), 'utf8').replace('"autoTrack":true', '"autoTrack":false'));
  const p = await L.newPage(b, 'file://' + kf, { flags: false, viewport: VW, dpr: 2 });
  await L.waitReady(p, 40000); await p.waitForTimeout(800);
  await p.evaluate(() => window.scrollTo(0, 0));
  const rectOf = (sel) => p.evaluate((sel) => { const x = document.querySelector(sel); if (!x || !x.offsetParent) return null; const r = x.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }, sel);
  const R = JSON.parse(fs.readFileSync(path.join(OUT, 'rects.json')));
  /* 自動追跡 OFF の課題は、「どちらで記録しますか？」は出ずに、すぐ手でクリックが始まる */
  R.s1h = { vb: await rectOf('#videobox'), start: await rectOf('#btnTrkStart') };
  await p.screenshot({ path: path.join(OUT, 's1_hand.png') });
  await p.click('#btnTrkStart'); await p.waitForTimeout(700);
  const findMk = () => p.evaluate(() => { vidDrawFull(); const g = document.getElementById('cvFull').getContext('2d'); const d = g.getImageData(0, 300, VID.w, 140).data;
    let sx = 0, sy = 0, n = 0; for (let y = 0; y < 140; y++) for (let x = 0; x < VID.w; x++) { const k = (y * VID.w + x) * 4; if (d[k] > 180 && d[k + 1] < 80 && d[k + 2] < 80) { sx += x; sy += y + 300; n++; } }
    const vx = sx / n, vy = sy / n, cv = document.getElementById('cvOv'), r = cv.getBoundingClientRect(), c = CROP();
    return { x: r.left + (vx - c.x) / c.w * r.width, y: r.top + (vy - c.y) / c.h * r.height, n }; });
  let mk;
  for (let i = 0; i < 7; i++) { mk = await findMk(); await p.mouse.click(mk.x, mk.y); await p.waitForTimeout(700); }
  mk = await findMk();
  R.sh = { vb: await rectOf('#videobox'), undo: await rectOf('#btnUndo1v'), vhint: await rectOf('#vhint'), mk: { x: mk.x - 14, y: mk.y - 14, w: 28, h: 28 }, n: await p.evaluate(() => EXP().objs[0].length) };
  await p.screenshot({ path: path.join(OUT, 'sh_hand.png') });
  fs.writeFileSync(path.join(OUT, 'rects.json'), JSON.stringify(R, null, 1));
  console.log(R.sh, 'errors', p.__errors);
  await b.close();
})();
