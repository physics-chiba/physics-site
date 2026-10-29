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

  await browser.close();
  process.exit(L.summary('run_test') ? 1 : 0);
})();
