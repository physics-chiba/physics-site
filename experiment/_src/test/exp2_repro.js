// 実験2 に進んだときに、色で自動追跡・軸の案内が出るかを、実際の操作の順で確かめる
const L = require('./lib');
const path = require('path');
(async () => {
  const b = await L.chromium.launch();
  const p = await L.newPage(b, null, { flags: { __noAskName: true, __askStro: false, __noAskN: false } });
  const fileOf = f => path.join(L.ROOT, 'test', f);
  p.on('filechooser', fc => fc.setFiles(p.__nextFile));
  async function openVideo(f) {
    p.__nextFile = fileOf(f);
    await p.click('#vph').catch(async () => { await p.evaluate(() => document.getElementById('fileVideo').click()); });
    await L.waitReady(p, 30000);
  }
  async function state(label) {
    const r = await p.evaluate(() => ({ step: currentStep(), auto: APP.autoTrack, cb: document.getElementById('cbAuto').checked,
      choice: !document.getElementById('trkChoice').classList.contains('hide'), start: !document.getElementById('btnTrkStart').classList.contains('hide'),
      cal: document.getElementById('calMsg').classList.contains('hide') ? '' : document.getElementById('calMsg').textContent.slice(0, 40),
      vhint: document.getElementById('vhint').classList.contains('hide') ? '' : document.getElementById('vhint').textContent.slice(0, 40),
      mode: UI.mode, calPend: UI.calPend, nOk: EXP().nOk, origin: !!EXP().origin, cur: APP.cur, axisDisp: APP.axisDisp }));
    console.log(label.padEnd(26), JSON.stringify(r));
    return r;
  }
  await p.evaluate(() => { const c = document.getElementById('cbAuto'); c.checked = true; c.onchange(); });
  await openVideo('proj2.webm');
  await state('実験1 読み込み');
  // 2
  async function doStep2() {
    await p.evaluate(() => { APP.played = true; afterChange(); });
    await p.evaluate(() => vidGotoFrame(0)); await p.click('#btnTimeZero'); await p.waitForTimeout(300);
    await p.evaluate(() => vidGotoFrame(VID.frames.length - 2)); await p.waitForTimeout(200); await p.click('#btnRangeB'); await p.waitForTimeout(400);
    await state('  2 終了直後');
    // トリミングの質問 → いいえ
    const hasTrim = await p.evaluate(() => /トリミング/.test(document.getElementById('calMsg').textContent));
    if (hasTrim) await p.evaluate(() => [...document.querySelectorAll('#calMsg .btn')].find(x => x.textContent === 'いいえ').click());
    await p.waitForTimeout(300);
    return state('  3 に入った');
  }
  async function clickQ(re) { const ok = await p.evaluate((src) => { const r = new RegExp(src); const bt = [...document.querySelectorAll('#calMsg .btn')].find(x => r.test(x.textContent)); if (bt) { bt.click(); return true; } return false; }, re.source); await p.waitForTimeout(250); return ok; }
  async function videoClick(vx, vy) {
    const pt = await p.evaluate(({ vx, vy }) => { const cv = document.getElementById('cvOv'), r = cv.getBoundingClientRect(); const c = CROP();
      return { x: r.left + (vx - c.x) / c.w * r.width, y: r.top + (vy - c.y) / c.h * r.height }; }, { vx, vy });
    await p.mouse.click(pt.x, pt.y); await p.waitForTimeout(250);
  }
  async function doStep3() {
    // 原点：中央の印をドラッグ
    const o = await p.evaluate(() => EXP().origin);
    const pt = await p.evaluate(({ vx, vy }) => { const cv = document.getElementById('cvOv'), r = cv.getBoundingClientRect(); const c = CROP();
      return { x: r.left + (vx - c.x) / c.w * r.width, y: r.top + (vy - c.y) / c.h * r.height }; }, { vx: o.x, vy: o.y });
    await p.mouse.move(pt.x, pt.y); await p.mouse.down(); await p.mouse.move(pt.x - 100, pt.y + 60, { steps: 5 }); await p.mouse.up(); await p.waitForTimeout(300);
    await state('  原点をドラッグ');
    console.log('    はい', await clickQ(/^はい$/)); await state('  →方向');
    console.log('    1方向', await clickQ(/１方向/)); await state('  →x軸');
    console.log('    そのまま', await clickQ(/そのままでよい/)); await state('  →確認');
    console.log('    はい', await clickQ(/^はい$/)); await state('  →スケール');
    await videoClick(40, 333); await videoClick(440, 333); await state('  スケール2点');
    console.log('    はい', await clickQ(/^はい$/));
    await p.waitForTimeout(400);
    return state('  4 に入った');
  }
  await doStep2(); await doStep3();
  console.log('    決める', await clickQ(/決める/)); console.log('    OK', await clickQ(/^OK$/));
  await state('  N を決めた');
  // 実験1 を記録（点を直接）
  await p.evaluate(() => { const e = EXP(); e.objReady[0] = true; e.trackReady = true; UI.startedAuto = true;
    VID.frames.forEach((t, i) => { if (i % 3 === 0 && t <= e.rangeB) e.objs[0].push({ t, fr: i, x: 63 + 300 * t, y: 303 - (350 * t - 250 * t * t), auto: true }); });
    const last = e.objs[0][e.objs[0].length - 1]; afterChange(); });
  await p.evaluate(() => setTab('2')); await p.waitForTimeout(300); await p.evaluate(() => setTab('3')); await p.waitForTimeout(300);
  await state('実験1 終了・③');
  // 実験2 へ
  await p.click('#btnNextExp'); await p.waitForTimeout(300);
  p.__nextFile = fileOf('proj2.webm');
  const okBtn = await p.evaluate(() => { const bs = [...document.querySelectorAll('.modal:not(.hide) button, #popup button')]; return bs.map(x => x.textContent); });
  console.log('    popup buttons', okBtn);
  await p.evaluate(() => { const bs = [...document.querySelectorAll('button')].filter(x => /実験2へ進む/.test(x.textContent) && x.offsetParent); bs[0] && bs[0].click(); });
  await L.waitReady(p, 30000);
  await state('実験2 読み込み');
  await doStep2(); await doStep3();
  await state('実験2 4（N の質問）');
  console.log('    決める', await clickQ(/決める/)); console.log('    OK', await clickQ(/^OK$/));
  await state('実験2 N を決めた');
  await p.screenshot({ path: 'test/shot_exp2.png' });
  console.log('errors', p.__errors);
  await b.close();
})();
