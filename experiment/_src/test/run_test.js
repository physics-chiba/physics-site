// motion-analysis.html の自動テスト（第56回で作り直し）
//   node test/run_test.js
const L = require('./lib');
const { check } = L;

async function exportKadai(page, opts) {
  opts = opts || {};
  await page.evaluate(() => { document.getElementById('cbTeacher').checked = true; document.getElementById('cbTeacher').onchange(); });
  await page.click('#btnKadai');
  await page.waitForSelector('#kdMake', { state: 'visible' });
  if (opts.auto !== undefined) await page.selectOption('#kdAuto', opts.auto ? '1' : '0');
  if (opts.n) await page.selectOption('#kdN', String(opts.n));
  if (opts.nobj) await page.selectOption('#kdNObj', String(opts.nobj));
  if (opts.scaleOn !== undefined) await page.evaluate((v) => { const c = document.getElementById('kdScaleOn'); c.checked = v; c.dispatchEvent(new Event('change')); }, opts.scaleOn);
  const stat = await page.textContent('#kdStat');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#kdMake')]);
  const out = L.path.join(__dirname, opts.file || '_kadai.html');
  await dl.saveAs(out);
  return { out, stat };
}
async function setMovSource(page, type) {
  const b64 = L.fs.readFileSync(L.path.join(__dirname, 'proj_as_mp4.mp4')).toString('base64');
  await page.evaluate(({ b64, type }) => {
    KADAI_SRC = { data: 'data:' + (type || 'application/octet-stream') + ';base64,' + b64, type: type, size: 2657, name: 'IMG_0001.MOV' };
    EXP().video.name = 'IMG_0001.MOV';
  }, { b64, type });
}

(async () => {
  const browser = await L.chromium.launch();

  console.log('A. 起動');
  {
    const p = await L.newPage(browser, null, { flags: false });
    check('ページエラー 0', p.__errors.length === 0, p.__errors);
    check('外部リクエスト 0（file://）', p.__ext.length === 0, p.__ext);
    const html = L.fs.readFileSync(L.APPURL.replace('file://', ''), 'utf8');
    check('共通フッター（goatcounter・sg-glow）', html.includes('physics-chiba.goatcounter.com') && html.includes('sg-glow'));
    await p.context().close();
  }

  console.log('B. 課題ファイルのボタン（教員用）');
  {
    const p = await L.newPage(browser);
    check('教員用 OFF では出ない', await p.evaluate(() => document.getElementById('btnKadai').classList.contains('hide')));
    check('1. 動画のカードの中には、もう無い', await p.evaluate(() => !document.getElementById('teacherBox') && !document.getElementById('btnKadai').closest('#side1')));
    await p.evaluate(() => { const c = document.getElementById('cbTeacher'); c.checked = true; c.onchange(); });
    const r = await p.evaluate(() => {
      const b = document.getElementById('btnKadai'), n = document.getElementById('btnNextExp');
      const cs = getComputedStyle(b);
      return { shown: !b.classList.contains('hide') && b.offsetParent !== null, inTabRight: !!b.closest('.tabright'),
               before: !!(b.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING), color: cs.color, bold: cs.fontWeight };
    });
    check('教員用 ON で上の段（右側）に出る', r.shown && r.inTabRight, r);
    check('「実験○を開始する」の左にある', r.before, r);
    check('赤い文字・太字', /rgb\(198, 40, 40\)/.test(r.color) && +r.bold >= 700, r);
    /* 3 の途中（原点だけ未確定）でも押せる */
    await p.evaluate((v) => loadVideoUrl(v, 'proj.webm'), 'test/proj.webm');
    await L.waitReady(p);
    await p.evaluate(() => { const e = EXP(); e.t0 = 0; e.rangeB = VID.dur - 0.1; afterChange(); });
    await p.waitForTimeout(200);
    const st3 = await p.evaluate(() => ({ step: currentStep(), shown: document.getElementById('btnKadai').offsetParent !== null }));
    check('3 の途中でも押せる', st3.step === 3 && st3.shown, st3);
    await p.click('#btnKadai');
    await p.waitForSelector('#kdStat', { state: 'visible' });
    const s3 = await p.textContent('#kdStat');
    check('途中で書き出すと「3. … から始めます」と出る', /3\. 空間の原点/.test(s3) && /原点（3）/.test(s3), s3);
    await p.evaluate(() => { document.getElementById('kdScaleOn').checked = false; document.getElementById('kdScaleOn').dispatchEvent(new Event('change')); });
    check('スケールも未設定なら「スケール（3）」も出る', /スケール（3）/.test(await p.textContent('#kdStat')));
    await p.context().close();
  }

  console.log('C. 課題の画面：自動追跡・N・HEVC の注意');
  {
    const p = await L.newPage(browser);
    await L.setupTo4(p);
    await setMovSource(p, 'video/quicktime');
    await p.evaluate(() => { document.getElementById('inStepN').value = 4; const c = document.getElementById('cbTeacher'); c.checked = true; c.onchange(); });
    await p.click('#btnKadai');
    await p.waitForSelector('#kdAuto', { state: 'visible' });
    const r = await p.evaluate(() => ({ auto: document.getElementById('kdAuto').value, n: document.getElementById('kdN').value,
      stat: document.getElementById('kdStat').textContent, ok: document.getElementById('kdStat').classList.contains('ok'),
      hevc: !document.getElementById('kdHevc').classList.contains('hide') }));
    check('自動追跡の ON／OFF を選べる（既定はいまの状態＝OFF）', r.auto === '0', r);
    check('進むフレーム数 N を選べる（既定はいまの N）', r.n === '4', r);
    check('1〜3 が済んでいれば「4. トラッキング から始めます」', r.ok && /4\. トラッキング から始めます/.test(r.stat), r);
    check('H.264（avc1 なし）の動画では HEVC の注意を出さない', !r.hevc, r);
    const hv = await p.evaluate(() => {
      const fake = 'data:video/quicktime;base64,' + btoa('....ftypqt  ....moov....stsd....hvc1....');
      return kadaiCodec(fake);
    });
    check('HEVC（hvc1）を見分ける', hv === 'hevc', hv);
    const mt = await p.evaluate(() => [kadaiVideoData({ data: 'data:video/quicktime;base64,AAAA', type: 'video/quicktime', name: 'a.MOV' }).data.slice(0, 22),
      kadaiVideoData({ data: 'data:application/octet-stream;base64,AAAA', type: '', name: 'b.mov' }).type,
      kadaiVideoData({ data: 'data:video/webm;base64,AAAA', type: 'video/webm', name: 'c.webm' }).type]);
    check('埋め込む動画の種類：MOV・種類なし → video/mp4、webm はそのまま', mt[0] === 'data:video/mp4;base64,' && mt[1] === 'video/mp4' && mt[2] === 'video/webm', mt);
    await p.context().close();
  }

  console.log('D. 課題ファイル（MOV・自動追跡 ON）を生徒が開く');
  {
    const p = await L.newPage(browser);
    await L.setupTo4(p);
    await setMovSource(p, 'video/quicktime');
    const { out, stat } = await exportKadai(p, { auto: true, n: 6, file: '_kadai_auto.html' });
    check('書き出し前の表示：4 から始めます', /4\. トラッキング から始めます/.test(stat), stat);
    const html = L.fs.readFileSync(out, 'utf8');
    check('埋め込んだ動画の種類は video/mp4（video/quicktime のままにしない）', html.includes('data:video/mp4;base64,') && !html.includes('data:video/quicktime'));
    /* 生徒：テスト用の旗なしで開く */
    const q = await L.newPage(browser, 'file://' + out, { flags: false });
    await L.waitReady(q, 30000);
    const r = await q.evaluate(() => ({
      ready: VID.ready, err: !document.getElementById('vidErr').classList.contains('hide'),
      step: currentStep(), fpsDlg: !!(document.getElementById('fpsDlg') && !document.getElementById('fpsDlg').classList.contains('hide')),
      calQ: !document.getElementById('calMsg').classList.contains('hide') ? document.getElementById('calMsg').textContent : '',
      N: document.getElementById('inStepN').value, auto: document.getElementById('cbAuto').checked, appAuto: !!APP.autoTrack,
      choice: !!(document.getElementById('trkChoice') && !document.getElementById('trkChoice').classList.contains('hide')),
      t0: EXP().t0, rangeB: EXP().rangeB, src: VID.el && VID.el.currentSrc ? VID.el.currentSrc.slice(0, 5) : '',
      lskey: LSKEY, kadaiBtn: document.getElementById('btnKadai').classList.contains('hide'),
      side4open: (document.querySelector('details[data-step="4"]') || {}).open }));
    check('MOV（video/quicktime）の動画が開ける', r.ready && !r.err, r);
    check('動画は blob: で読み込む（ファイルを選んだときと同じ）', r.src === 'blob:', r.src);
    check('いきなり 4. トラッキング', r.step === 4, r.step);
    check('設問の番号が二重にならない（1. 1. …）', await q.evaluate(() => !/^\s*\d+\./.test(document.querySelector('#side1 .card.op ol li').textContent)));
    check('fps の確認は出ない', !r.fpsDlg);
    check('N の質問・物体の数の質問は出ない', !/何コマごと|いくつありますか/.test(r.calQ), r.calQ);
    check('N は先生が決めた 6', r.N === '6', r.N);
    check('色マーカーの自動追跡が ON', r.auto && r.appAuto, r);
    check('「どちらで記録しますか？（色で自動追跡 おすすめ）」が出ている', r.choice, r);
    check('時間範囲（t = 0・おわり）も入っている', r.t0 === 0 && r.rangeB > 1, r);
    check('自動保存の場所は課題ごと', /-kadai-/.test(r.lskey), r.lskey);
    check('生徒の画面には課題ファイルのボタンを出さない', r.kadaiBtn);
    check('ページエラー 0（生徒側）', q.__errors.length === 0, q.__errors);
    check('外部リクエスト 0（生徒側）', q.__ext.length === 0, q.__ext);
    await q.screenshot({ path: L.path.join(__dirname, 'shot_kadai_auto.png') });
    /* 開き直しても 4 のまま（課題ごとの自動保存から） */
    await q.reload({ waitUntil: 'load' });
    await L.waitReady(q, 30000);
    check('開き直しても 4. トラッキング', await q.evaluate(() => currentStep()) === 4);
    await q.context().close();
    await p.context().close();
  }

  console.log('E. 課題ファイル（自動追跡 OFF・2 物体）');
  {
    const p = await L.newPage(browser);
    await L.setupTo4(p);
    await setMovSource(p, '');                 /* 種類が空の .MOV（Windows で関連づけが無いとき） */
    const { out } = await exportKadai(p, { auto: false, n: 3, nobj: 2, file: '_kadai_hand.html' });
    const q = await L.newPage(browser, 'file://' + out, { flags: false });
    await L.waitReady(q, 30000);
    const r = await q.evaluate(() => ({ ready: VID.ready, step: currentStep(), auto: document.getElementById('cbAuto').checked,
      start: !document.getElementById('btnTrkStart').classList.contains('hide'),
      choice: !!(document.getElementById('trkChoice') && !document.getElementById('trkChoice').classList.contains('hide')),
      two: !!APP.twoObj, n: nObj(), calQ: !document.getElementById('calMsg').classList.contains('hide') ? document.getElementById('calMsg').textContent : '' }));
    check('種類が空の MOV でも開ける', r.ready, r);
    check('いきなり 4', r.step === 4, r);
    check('自動追跡は OFF', !r.auto, r);
    check('2 択は出さない（自動追跡 OFF）', !r.choice, r);
    await q.fill('#inObjName', '台車A'); await q.dispatchEvent('#inObjName', 'change'); await q.waitForTimeout(300);
    const st = await q.evaluate(() => !document.getElementById('btnTrkStart').classList.contains('hide'));
    check('物体1の名前を入れると［トラッキング開始］が出る', st);
    check('物体は 2 つで、数は聞かない', r.two && r.n === 2 && !/いくつ/.test(r.calQ), r);
    await q.screenshot({ path: L.path.join(__dirname, 'shot_kadai_hand.png') });
    await q.context().close();
    await p.context().close();
  }

  console.log('F. 途中（3 の途中）で書き出した課題');
  {
    const p = await L.newPage(browser);
    await p.evaluate((v) => loadVideoUrl(v, 'proj.webm'), 'test/proj.webm');
    await L.waitReady(p);
    await p.evaluate(() => { const e = EXP(); e.t0 = 0; e.rangeB = VID.dur - 0.1; afterChange(); });
    await setMovSource(p, 'video/quicktime');
    const { out, stat } = await exportKadai(p, { scaleOn: true, file: '_kadai_mid.html' });
    check('書き出し前の表示：3 から始めます', /3\. 空間の原点/.test(stat), stat);
    const q = await L.newPage(browser, 'file://' + out, { flags: false });
    await L.waitReady(q, 30000);
    const r = await q.evaluate(() => ({ step: currentStep(), mPerPx: EXP().mPerPx, t0: EXP().t0 }));
    check('生徒は 3 から（時間範囲とスケールは入っている）', r.step === 3 && r.mPerPx > 0 && r.t0 === 0, r);
    await q.context().close();
    await p.context().close();
  }

  console.log('G. 前の版の課題ファイル（autoTrack・stepN・vmeta なし）');
  {
    const src = L.fs.readFileSync(L.APPURL.replace('file://', ''), 'utf8');
    const b64 = L.fs.readFileSync(L.path.join(__dirname, 'proj.webm')).toString('base64');
    const K = { title: '古い課題', questions: ['1. x–t'], nObjs: 1, masses: [0.1], scale: null,
      video: { name: 'proj.webm', data: 'data:video/webm;base64,' + b64, type: 'video/webm' },
      cal: { origin: { x: 72, y: 312 }, angle: 0, yflip: false, mPerPx: 0.001, scaleRef: null, scaleLen: 0.1, rangeA: null, rangeB: 1.3 } };
    const html = src.replace('</head>', '<script id="kadaiData">window.KADAI=' + JSON.stringify(K) + ';</' + 'script></head>');
    const f = L.path.join(__dirname, '_kadai_old.html'); L.fs.writeFileSync(f, html);
    const q = await L.newPage(browser, 'file://' + f, { flags: { __noAskFps: true } });
    await L.waitReady(q, 30000);
    const r = await q.evaluate(() => ({ ready: VID.ready, step: currentStep() }));
    check('前の版の課題ファイルも開ける（2 から）', r.ready && r.step === 2, r);
    check('ページエラー 0', q.__errors.length === 0, q.__errors);
    await q.context().close();
  }

  console.log('H. Excel の a–t をレポート（PDF）と同じに');
  {
    const p = await L.newPage(browser);
    await L.setupTo4(p); await L.addProjPoints(p, 3);
    const r = await p.evaluate(() => {
      APP.axisDisp = 'xy'; APP.aFit = true;
      const sh = sheetForExp(EXP(), APP.cur);
      const hr = sh.rows.findIndex(r => r[0] === 't[s]'), head = sh.rows[hr];
      const ca = sh.charts.find(c => /^ay - t/.test(c.title));
      const col = ca.series[0].col;
      const af = aByFit(series(EXP(), 0), 'vy');
      const vals = sh.rows.slice(hr + 1).map(r => r[col]).filter(v => v !== '');
      const rep = seriesFor(EXP(), 'a', APP.cur, false, false, 0).find(s => / ay$/.test(s.name)).pts.map(q => q.y);
      APP.aFit = false;
      const sh2 = sheetForExp(EXP(), APP.cur);
      const ca2 = sh2.charts.find(c => /^ay - t/.test(c.title));
      return { head, colName: head[col], xcol: ca.xcol, n: vals.length, nAf: af.length,
               same: vals.length === rep.length && vals.every((v, i) => Math.abs(v - rep[i]) < 1e-6),
               yr: [ca.ymin, ca.ymax, ca.yunit], col2: sh2.rows[hr][ca2.series[0].col], yr2: [ca2.ymin, ca2.ymax] };
    });
    check('「v–t の傾きから計算」のとき、Excel の a–t はその値の列を使う', /ay\(v–tの傾き\)/.test(r.colName), r);
    check('その値はレポートの a–t と同じ', r.same, r);
    check('横軸は tv（v の時刻）', r.xcol === 1, r);
    check('縦軸の範囲は 0 をふくむきりのよい数（画面・レポートと同じ）', r.yr[0] === -0.5 && r.yr[1] === 0, r.yr);
    check('「v の差から計算」のときは表の ay 列', r.col2 === 'ay', r);
    /* フィッティングの列は、同じ行の t の値（前は 1 行ずれていた） */
    const f = await p.evaluate(() => {
      const s = series(EXP(), 0);
      RESID = [{ name: 'x', color: '#e8443a', xs: s.map(q => q.t), ys: s.map(q => q.x), f: (t) => 1000 + t }]; RESID_INFO = { q: 'x', ob: 0, kind: 'lin' };
      const sh = sheetForExp(EXP(), APP.cur), hr = sh.rows.findIndex(r => r[0] === 't[s]'), fc = sh.rows[hr].indexOf('fit(x)');
      RESID = [];
      return sh.rows.slice(hr + 1, hr + 4).map(r => [r[0], r[fc]]);
    });
    check('フィッティングの値が同じ行の t に合っている', f.every(q => Math.abs(q[1] - (1000 + q[0])) < 1e-6), f);
    /* 本当に Excel ファイルを書き出して、壊れていないか */
    await p.evaluate(() => { APP.aFit = true; window.__askStro = false; });
    await p.evaluate(() => setTab('2')); await p.waitForTimeout(400);
    const [dl] = await Promise.all([p.waitForEvent('download'), p.evaluate(() => exportXlsx())]);
    const xf = L.path.join(__dirname, '_out.xlsx'); await dl.saveAs(xf);
    const { execSync } = require('child_process');
    let ok = false, msg = '';
    try { msg = execSync('python3 -c "import openpyxl,sys; wb=openpyxl.load_workbook(sys.argv[1]); ws=wb.worksheets[0]; print(ws.title, len(ws._charts))" ' + xf).toString().trim(); ok = true; } catch (e) { msg = String(e.stdout || e); }
    check('Excel ファイルが壊れていない（openpyxl で開ける）', ok, msg);
    check('ページエラー 0', p.__errors.length === 0, p.__errors);
    await p.context().close();
  }

  console.log('I. ひととおりの画面（②③④・レポート）');
  {
    const p = await L.newPage(browser);
    await L.setupTo4(p); await L.addProjPoints(p, 3);
    for (const t of ['2', '3', '4', '5', '1']) { await p.evaluate((t) => setTab(t), t); await p.waitForTimeout(350); }
    const pages = await p.evaluate(() => buildReportPages().length);
    check('レポートのページができる', pages >= 1, pages);
    check('ページエラー 0', p.__errors.length === 0, p.__errors);
    await p.context().close();
  }

  console.log('J. 動画エリアの知らせをドラッグで脇によける');
  {
    const p = await L.newPage(browser);
    await L.setupTo4(p);
    /* 3 のスケールの案内（押せる知らせ）を出す */
    await p.evaluate(() => { calAsk('<span class="q">スケールを設定してください</span>画面内の 10 cm が、どこからどこまでかを 2 か所クリックしてください。',
      [{ label: 'この表示を最小化', fn: () => { window.__minimized = true; } }]); });
    await p.waitForTimeout(150);
    const g0 = await p.evaluate(() => { const m = document.getElementById('calMsg'), g = m.querySelector('.dragmsg-grip'), r = m.getBoundingClientRect(), gr = g && g.getBoundingClientRect();
      return { has: !!g, mx: r.left, my: r.top, gx: gr && gr.left + gr.width / 2, gy: gr && gr.top + gr.height / 2 }; });
    check('知らせの左はしに「つまみ」がある', g0.has, g0);
    await p.mouse.move(g0.gx, g0.gy); await p.mouse.down(); await p.mouse.move(g0.gx - 120, g0.gy + 150, { steps: 6 }); await p.mouse.up();
    await p.waitForTimeout(150);
    const g1 = await p.evaluate(() => { const m = document.getElementById('calMsg'), r = m.getBoundingClientRect(); return { shown: !m.classList.contains('hide'), mx: r.left, my: r.top, act: m.classList.contains('ask') }; });
    check('つまみをドラッグすると動く（消えない）', g1.shown && g1.act && Math.abs((g1.mx - g0.mx) + 120) < 6 && Math.abs((g1.my - g0.my) - 150) < 6, { g0, g1 });
    /* ボタン以外の所（文字の上）をつかんでも動く */
    const tb = await p.evaluate(() => { const q = document.querySelector('#calMsg .q').getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2 }; });
    await p.mouse.move(tb.x, tb.y); await p.mouse.down(); await p.mouse.move(tb.x + 60, tb.y - 40, { steps: 4 }); await p.mouse.up();
    const g2 = await p.evaluate(() => document.getElementById('calMsg').getBoundingClientRect().left);
    check('押せる知らせは、文字の所をつかんでも動く', Math.abs(g2 - g1.mx - 60) < 6, { g2, g1: g1.mx });
    await p.click('#calMsg .btn');
    check('動かしたあともボタンは押せる', await p.evaluate(() => window.__minimized === true));
    /* 次に出た知らせも、動かした場所に出る */
    await p.evaluate(() => { calAsk('<span class="q">スケールはこれでいいですか？</span>', [{ label: 'はい', fn: () => {} }]); });
    const g3 = await p.evaluate(() => document.getElementById('calMsg').getBoundingClientRect().left);
    check('次の知らせも、よけた場所に出る', Math.abs(g3 - g2) < 6, { g3, g2 });
    /* 動画エリアの外へは出ない */
    const gg = await p.evaluate(() => { const g = document.querySelector('#calMsg .dragmsg-grip').getBoundingClientRect(); return { x: g.left + 6, y: g.top + 10 }; });
    await p.mouse.move(gg.x, gg.y); await p.mouse.down(); await p.mouse.move(gg.x - 2000, gg.y + 2000, { steps: 5 }); await p.mouse.up();
    const inb = await p.evaluate(() => { const b = document.getElementById('videobox').getBoundingClientRect(), r = document.getElementById('calMsg').getBoundingClientRect();
      return r.left >= b.left - 1 && r.bottom <= b.bottom + 1; });
    check('動画エリアの外には出ない', inb);
    /* ダブルクリックで元の場所 */
    const gd = await p.evaluate(() => { const g = document.querySelector('#calMsg .dragmsg-grip').getBoundingClientRect(); return { x: g.left + 6, y: g.top + 10 }; });
    await p.mouse.dblclick(gd.x, gd.y);
    check('つまみのダブルクリックで元の場所にもどる', await p.evaluate(() => document.getElementById('calMsg').style.left === '' && !UI.msgPos.calMsg));
    /* 時間で消える知らせ（素通し）も、つまみなら動かせて、消えない */
    await p.evaluate(() => calMsg('原点はこの位置でいいですか？<br>よければ、つぎは軸の正の方向をクリックしてください'));
    const h0 = await p.evaluate(() => { const g = document.querySelector('#calMsg .dragmsg-grip').getBoundingClientRect(), r = document.getElementById('calMsg').getBoundingClientRect(); return { x: g.left + 6, y: g.top + g.height / 2, l: r.left }; });
    await p.mouse.move(h0.x, h0.y); await p.mouse.down(); await p.mouse.move(h0.x + 100, h0.y + 80, { steps: 5 }); await p.mouse.up();
    const h1 = await p.evaluate(() => { const m = document.getElementById('calMsg'); return { shown: !m.classList.contains('hide'), l: m.getBoundingClientRect().left }; });
    check('素通しの知らせも、つまみで動かせる（つかんでも消えない）', h1.shown && Math.abs(h1.l - h0.l - 100) < 6, { h0, h1 });
    /* 解析終了のボタンは、つまみを押しても ② へ行かない */
    await p.evaluate(() => { const d = document.getElementById('doneMsg'); d.classList.remove('hide'); });
    const dg = await p.evaluate(() => { const g = document.querySelector('#doneMsg .dragmsg-grip').getBoundingClientRect(); return { x: g.left + 5, y: g.top + g.height / 2 }; });
    await p.mouse.click(dg.x, dg.y);
    check('ボタンの知らせ（解析終了）は、つまみを押しても ② へ行かない', await p.evaluate(() => APP.tab === '1'));
    check('そのほかの知らせにもつまみがある', await p.evaluate(() => ['autoMsg', 'vhint', 'trkChoice', 'btnTrkStart'].every(id => document.querySelector('#' + id + ' > .dragmsg-grip'))));
    check('ページエラー 0', p.__errors.length === 0, p.__errors);
    await p.context().close();
  }

  console.log('K. 自動追跡の予測（どんな運動でも同じ式）');
  {
    const p = await L.newPage(browser);
    await L.setupTo4(p);
    const r = await p.evaluate(() => {
      const e = EXP(), dt = 0.1, out = {};
      const cases = {
        '単振動（1 周期 6 点）': t => ({ x: 300, y: 480 + 150 * Math.cos(2 * Math.PI * t / 0.6) }),
        '等速円運動（1 周期 8 点）': t => ({ x: 320 + 150 * Math.cos(2 * Math.PI * t / 0.8), y: 240 + 150 * Math.sin(2 * Math.PI * t / 0.8) }),
        '斜方投射': t => ({ x: 50 + 300 * t, y: 300 - (350 * t - 490 * t * t) }),
        '等速': t => ({ x: 20 + 600 * t, y: 100 }),
        '減衰振動': t => ({ x: 200, y: 400 + 150 * Math.exp(-t / 2) * Math.cos(2 * Math.PI * t / 0.7) }),
      };
      for (const [nm, f] of Object.entries(cases)) {
        let mx = 0;
        for (let n = 4; n < 20; n++) {
          e.objs[0] = []; for (let i = 0; i < n; i++) { const q = f(i * dt); e.objs[0].push({ t: i * dt, fr: i * 3, x: q.x, y: q.y }); }
          const pr = predictPos(0, n * dt), tr = f(n * dt);
          mx = Math.max(mx, Math.hypot(pr.x - tr.x, pr.y - tr.y));
        }
        out[nm] = +mx.toFixed(3);
      }
      e.objs[0] = []; return out;
    });
    /* 単振動・円運動・放物線・等速は式どおりなのでほぼ 0。減衰振動は式からすこし外れるが、探す円（40 px）より十分小さい */
    for (const [nm, mx] of Object.entries(r)) { const lim = /減衰/.test(nm) ? 12 : 1; check('予測のずれ ' + nm + '：' + mx + ' px（' + lim + ' px 未満）', mx < lim, mx); }
    /* 間隔がそろっていないとき（見失って手でクリックした直後など）は、時刻を使った外挿にもどる */
    const irr = await p.evaluate(() => { const e = EXP(); e.objs[0] = [{ t: 0, x: 0, y: 0 }, { t: 0.1, x: 10, y: 0 }, { t: 0.3, x: 30, y: 0 }];
      const pr = predictPos(0, 0.4); e.objs[0] = []; return pr; });
    check('間隔がそろっていない点からも予測できる（等速 100 px/s → 40 px）', Math.abs(irr.x - 40) < 0.5, irr);
    await p.context().close();
    const { runCase } = require('./lib_auto');
    const CS = [
      { video: 'test/shm.webm', name: '単振動', truth: t => ({ x: 300, y: 480 + 150 * Math.cos(2 * Math.PI * t / 0.6) }), N: 3, maxLost: 0 },
      { video: 'test/shm_mid.webm', name: '減衰振動＋同じ色の四角', truth: t => ({ x: 300, y: 480 + 150 * Math.exp(-t / 3) * Math.sin(2 * Math.PI * t / 0.7) }), N: 3, maxLost: 1 },
      { video: 'test/circ.webm', name: '等速円運動（1 周期 7 点）', truth: t => ({ x: 320 + 150 * Math.cos(2 * Math.PI * t / 1.2), y: 240 + 150 * Math.sin(2 * Math.PI * t / 1.2) }), N: 5, maxLost: 0 },
      { video: 'test/proj2.webm', name: '斜方投射', truth: t => ({ x: 63 + 300 * t, y: 303 - (350 * t - 250 * t * t) }), N: 3, maxLost: 0 },
    ];
    for (const C of CS) {
      const q = await runCase(browser, C, C.N, L.APPURL);
      check(`実際の動画で自動追跡：${C.name}（N=${C.N}）見失い ${q.lost} 回・ずれ最大 ${q.maxErr.toFixed(1)} px`, q.lost <= C.maxLost && q.maxErr < 10 && q.errors === 0, q);
    }
  }

  await browser.close();
  process.exit(L.summary('run_test') ? 1 : 0);
})();
