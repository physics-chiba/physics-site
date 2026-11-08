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

  console.log('L. x軸の「そのままでよい」・運動量を解析する');
  {
    const p = await L.newPage(browser);
    await p.evaluate((v) => loadVideoUrl(v, 'proj.webm'), 'test/proj.webm');
    await L.waitReady(p);
    await p.evaluate(() => { const e = EXP(); e.t0 = 0; e.rangeB = VID.dur - 0.1; e.origin = { x: 72, y: 312 }; e.originSet = true; e.angle = 0.7; afterChange(); APP.axisDisp = 'x'; calGuide('axis'); });
    await p.waitForTimeout(150);
    const btn = await p.evaluate(() => { const b = [...document.querySelectorAll('#calMsg .btn')].find(x => /そのままでよい/.test(x.textContent)); return b ? b.textContent : null; });
    check('「x軸の正方向を選んでください」に［そのままでよい］がある', !!btn, btn);
    await p.evaluate(() => [...document.querySelectorAll('#calMsg .btn')].find(x => /そのままでよい/.test(x.textContent)).click());
    await p.waitForTimeout(150);
    const ax = await p.evaluate(() => ({ angle: EXP().angle, set: EXP().axisSet, q: document.getElementById('calMsg').textContent, mode: UI.mode }));
    check('押すと x 軸は動画の右向き（角度 0）で決まり、次の確認へ進む', ax.angle === 0 && ax.set && /X軸はこの方向でいいですか/.test(ax.q) && ax.mode === 'record', ax);
    /* 2 方向なら y 軸の確認へ */
    await p.evaluate(() => { APP.axisDisp = 'xy'; EXP().axisSet = false; calGuide('axis'); [...document.querySelectorAll('#calMsg .btn')].find(x => /そのままでよい/.test(x.textContent)).click(); });
    check('2 方向のときは y 軸の確認へ', /y軸はこの方向でいいですか/.test(await p.evaluate(() => document.getElementById('calMsg').textContent)));
    await p.evaluate(() => { calMsg(''); APP.axisDisp = 'x'; });
    await p.context().close();

    const q = await L.newPage(browser);
    await L.setupTo4(q); await L.addProjPoints(q, 3);
    await q.evaluate(() => setTab('2')); await q.waitForTimeout(400);
    const lay = await q.evaluate(() => { const e = document.getElementById('btnEnergyOn'), m = document.getElementById('btnMomOn'), x = document.getElementById('btnCsv2');
      const re = e.getBoundingClientRect(), rm = m.getBoundingClientRect();
      return { fe: parseFloat(getComputedStyle(e).fontSize), fm: parseFloat(getComputedStyle(m).fontSize), fx: parseFloat(getComputedStyle(x).fontSize), right: rm.left > re.right - 1, sameRow: Math.abs(re.top - rm.top) < 4, txt: m.textContent }; });
    check('［力学的エネルギーを解析する］の字が 2 段階小さい', lay.fe < lay.fx - 1.5, lay);
    check('その右に同じ大きさの［運動量を解析する］', lay.right && lay.sameRow && lay.fm === lay.fe && lay.txt === '運動量を解析する', lay);
    check('はじめは質量の欄は出ていない', await q.evaluate(() => document.getElementById('energyRow').classList.contains('hide')));
    await q.click('#btnMomOn'); await q.waitForTimeout(400);
    const mo = await q.evaluate(() => {
      const row = document.getElementById('energyRow'), vis = id => { const x = document.getElementById(id); return !!x && !x.classList.contains('hide') && x.offsetParent !== null; };
      const cards = [...document.querySelectorAll('#charts2 .chartcard')].map(c => c.querySelector('canvas').__spec).filter(sp => sp && /^P[xy]_/.test(sp.key));
      const sp = cards[0], s = series(EXP(), 0).filter(p => p.vx !== null);
      return { row: !row.classList.contains('hide'), m1: vis('inM1'), m2: vis('labM2'), g: vis('inG'), gdir: vis('labGDir'), n: cards.length, ser: sp ? sp.series.length : 0,
        ok: sp ? Math.abs(sp.series[0].pts[2].y - EXP().m1 * s[2].vx) < 1e-9 : false, txt: document.getElementById('btnMomOn').textContent };
    });
    check('押すと質量の欄が出る（1 物体なら m₁ だけ。g・重力の向きは出ない）', mo.row && mo.m1 && !mo.m2 && !mo.g && !mo.gdir, mo);
    check('運動量 p = m v のグラフが出る（値は m₁ × vx）', mo.n >= 1 && mo.ser === 1 && mo.ok, mo);
    check('ボタンは「運動量の解析をやめる」に変わる', mo.txt === '運動量の解析をやめる', mo.txt);
    await q.fill('#inM1', '0.5'); await q.dispatchEvent('#inM1', 'change'); await q.waitForTimeout(300);
    const m5 = await q.evaluate(() => { const sp = [...document.querySelectorAll('#charts2 .chartcard canvas')].map(c => c.__spec).find(sp => sp && /^Px_/.test(sp.key)); const s = series(EXP(), 0).filter(p => p.vx !== null); return Math.abs(sp.series[0].pts[2].y - 0.5 * s[2].vx) < 1e-9; });
    check('質量を変えるとグラフも変わる', m5);
    /* 2 物体 */
    await q.evaluate(() => { setTwoObj(true, true); EXP().nObjs = 2; EXP().nObjOk = true;
      EXP().objs[1] = EXP().objs[0].map(p => ({ t: p.t, fr: p.fr, x: p.x + 40, y: p.y + 30 })); afterChange(); renderMode2(); });
    await q.waitForTimeout(300);
    const two = await q.evaluate(() => { const vis = id => { const x = document.getElementById(id); return !!x && !x.classList.contains('hide') && x.offsetParent !== null; };
      const sp = [...document.querySelectorAll('#charts2 .chartcard canvas')].map(c => c.__spec).find(sp => sp && /^Px_/.test(sp.key));
      return { m2: vis('labM2'), m3: vis('labM3'), ser: sp ? sp.series.map(x => x.name) : [] }; });
    check('2 物体なら m₁・m₂ の欄（m₃ は出ない）', two.m2 && !two.m3, two);
    check('2 物体の運動量（重心の運動量はチェックしたときだけ）', two.ser.length === 2 && !two.ser.some(n => /Σ/.test(n)), two.ser);
    await q.check('#cbG_p'); await q.waitForTimeout(300);
    const sum = await q.evaluate(() => [...document.querySelectorAll('#charts2 .chartcard canvas')].map(c => c.__spec).find(sp => sp && /^Px_/.test(sp.key)).series.map(x => x.name));
    check('「重心の運動量」にチェックすると Σ m v も重なる', sum.some(n => /Σ/.test(n)), sum);
    await q.click('#btnMomOn'); await q.waitForTimeout(300);
    const off = await q.evaluate(() => ({ row: document.getElementById('energyRow').classList.contains('hide'),
      cards: [...document.querySelectorAll('#charts2 .chartcard canvas')].filter(c => c.__spec && /^P[xy]_/.test(c.__spec.key)).length, gp: document.getElementById('cbG_p').checked }));
    check('もう一度押すと、質量の欄も運動量のグラフも消える', off.row && off.cards === 0 && !off.gp, off);
    check('ページエラー 0', q.__errors.length === 0, q.__errors);
    await q.screenshot({ path: L.path.join(__dirname, 'shot_mom.png') });
    await q.context().close();
  }

  console.log('M. 運動量（とエネルギー）を Excel・レポートにも');
  {
    const p = await L.newPage(browser);
    await L.setupTo4(p); await L.addProjPoints(p, 3);
    const a = await p.evaluate(() => {
      APP.axisDisp = 'xy'; APP.energyOn = false; setMomAna(false);
      const off = sheetForExp(EXP(), APP.cur), hro = off.rows.findIndex(r => r[0] === 't[s]');
      const offHas = off.rows[hro].some(h => /^p[xy]/.test(h)) || off.charts.some(c => /運動量/.test(c.title));
      buildReportPages(); const offRep = REPORT_HEADS.slice();
      EXP().m1 = 0.25; setMomAna(true);
      const sh = sheetForExp(EXP(), APP.cur), hr = sh.rows.findIndex(r => r[0] === 't[s]'), head = sh.rows[hr];
      const cpx = head.indexOf('px[kg·m/s]'), cvx = head.indexOf('vx');
      const ok = sh.rows.slice(hr + 1).every(r => r[cvx] === '' ? r[cpx] === '' : Math.abs(r[cpx] - 0.25 * r[cvx]) < 1e-7);
      const mrow = sh.rows.slice(0, hr).find(r => r[0] === '質量m1[kg]');
      const chs = sh.charts.filter(c => /運動量/.test(c.title)).map(c => ({ t: c.title, x: c.xcol, n: c.series.length }));
      buildReportPages(); const onRep = REPORT_HEADS.slice();
      setEnergyOn(true); buildReportPages(); const eRep = REPORT_HEADS.slice(); setEnergyOn(false);
      return { offHas, offRep, head, ok, mrow, chs, onRep, eRep };
    });
    check('「運動量を解析する」OFF なら Excel・レポートに運動量は出ない', !a.offHas && !a.offRep.some(t => /運動量/.test(t)), a);
    check('ON なら Excel に px・py の列（p = m v、v と同じ行）', a.head.includes('px[kg·m/s]') && a.head.includes('py[kg·m/s]') && a.ok, a.head);
    check('Excel の上に質量の行（m₁ = 0.25）', a.mrow && a.mrow[1] === 0.25, a.mrow);
    check('Excel に px–t・py–t のグラフ（横軸は tv）', a.chs.length === 2 && a.chs.every(c => c.x === 1 && c.n === 1), a.chs);
    check('レポートに「運動量 p = m v」の節', a.onRep.includes('運動量 p = m v'), a.onRep);
    check('「力学的エネルギーを解析する」のときはレポートに力学的エネルギーの節', a.eRep.some(t => /^力学的エネルギー/.test(t)), a.eRep);
    /* 2 物体・重心の運動量 */
    const b = await p.evaluate(() => {
      setTwoObj(true, true); EXP().nObjs = 2; EXP().nObjOk = true;
      EXP().objs[1] = EXP().objs[0].map(q => ({ t: q.t, fr: q.fr, x: q.x + 40, y: q.y + 30 }));
      EXP().m2 = 0.5; APP.momOn = false; afterChange();
      const s1 = sheetForExp(EXP(), APP.cur), h1 = s1.rows[s1.rows.findIndex(r => r[0] === 't[s]')];
      APP.momOn = true;
      const s2 = sheetForExp(EXP(), APP.cur), hr2 = s2.rows.findIndex(r => r[0] === 't[s]'), h2 = s2.rows[hr2];
      const cs = h2.indexOf('Σmvx（重心の運動量）[kg·m/s]'), c1 = h2.indexOf('px_1[kg·m/s]'), c2 = h2.indexOf('px_2[kg·m/s]');
      const r = s2.rows[hr2 + 3];
      const ch = s2.charts.find(c => /^px - t/.test(c.title));
      buildReportPages(); const rep = REPORT_HEADS.slice();
      return { noSum: !h1.some(h => /Σ/.test(h)), sumOk: Math.abs(r[cs] - (r[c1] + r[c2])) < 1e-7, nSer: ch.series.length, rep };
    });
    check('2 物体：重心の運動量にチェックが無ければ Σ の列は出ない', b.noSum, b);
    check('チェックすると Σmv の列（= px₁ + px₂）とグラフの線', b.sumOk && b.nSer === 3, b);
    check('レポートも「運動量と重心の運動量」の節', b.rep.some(t => /運動量と重心の運動量/.test(t)), b.rep);
    /* 本当に書き出して壊れていないか */
    await p.evaluate(() => { window.__askStro = false; setTab('2'); }); await p.waitForTimeout(300);
    const [dl] = await Promise.all([p.waitForEvent('download'), p.evaluate(() => exportXlsx())]);
    const xf = L.path.join(__dirname, '_out_mom.xlsx'); await dl.saveAs(xf);
    let ok = false, msg = '';
    try { msg = require('child_process').execSync('python3 -W ignore -c "import openpyxl,sys; wb=openpyxl.load_workbook(sys.argv[1]); ws=wb.worksheets[0]; print(len(ws._charts))" ' + xf).toString().trim(); ok = +msg >= 8; } catch (e) { msg = String(e.stdout || e); }
    check('運動量入りの Excel ファイルが壊れていない（グラフ ' + msg + ' 枚）', ok, msg);
    check('ページエラー 0', p.__errors.length === 0, p.__errors);
    await p.context().close();
  }

  console.log('N. 解析終了の大きさ・実験2 での表示・最後の点');
  {
    const p = await L.newPage(browser);
    const fs0 = await p.evaluate(() => { const d = document.getElementById('doneMsg'); d.style.transition = 'none'; d.classList.remove('hide'); const a = parseFloat(getComputedStyle(d).fontSize);
      d.classList.add('small'); const b = parseFloat(getComputedStyle(d).fontSize); d.classList.add('hide'); d.classList.remove('small'); d.style.transition = ''; return [a, b]; });
    check('「解析終了。グラフを表示してみよう」は 150%（16.8→25.2px、小さいときも 12.8→19.2px）', Math.abs(fs0[0] - 25.2) < 0.2 && Math.abs(fs0[1] - 19.2) < 0.2, fs0);
    /* 前の実験がクリック待ちのモードのまま → 新しい動画で元にもどる */
    await L.setupTo4(p);
    for (const m of ['radius', 'color', 'axis', 'scale1']) {
      const r = await p.evaluate(async (m) => { setMode(m); UI.startedAuto = true; UI.calPend = 'scale'; APP.editStep = 3;
        loadVideoUrl('test/proj.webm', 'proj.webm'); await new Promise(res => { const iv = setInterval(() => { if (VID.ready && !VID.building && document.getElementById('busyLock').classList.contains('hide')) { clearInterval(iv); res(); } }, 50); });
        return { mode: UI.mode, auto: UI.startedAuto, pend: UI.calPend, edit: APP.editStep }; }, m);
      check('「' + m + '」のまま動画を読み直しても、クリックで記録のモードにもどる', r.mode === 'record' && !r.auto && r.pend === null && r.edit === 0, r);
    }
    const sw = await p.evaluate(() => { APP.exps.push(newExp(2)); setMode('radius'); switchExp(1); const m = UI.mode; switchExp(0); return m; });
    check('実験を切りかえても、クリックで記録のモードにもどる', sw === 'record', sw);
    /* 色マーカーの自動追跡の ON は、開き直しても残る */
    await p.evaluate(() => { const c = document.getElementById('cbAuto'); c.checked = true; c.onchange(); });
    await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(400);
    const au = await p.evaluate(() => ({ app: APP.autoTrack, cb: document.getElementById('cbAuto').checked, card: !document.getElementById('autoCard').classList.contains('hide') }));
    check('色マーカーの自動追跡の ON は、ページを開き直しても残る（中身とチェックがそろう）', au.app === true && au.cb === true, au);
    await p.evaluate(() => { const c = document.getElementById('cbAuto'); c.checked = false; c.onchange(); });
    await p.context().close();

    /* 最後の点：残りが N コマに満たないときは、そこで終わり（間隔はすべて N コマ） */
    for (const [N, endFr, lastFr] of [[5, 43, 40], [5, 40, 40], [3, 44, 42], [4, 41, 40]]) {
      const q = await L.newPage(browser);
      const b64 = L.fs.readFileSync(L.path.join(__dirname, 'uni.webm')).toString('base64');
      await q.evaluate(({ b64 }) => { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
        loadVideoUrl(URL.createObjectURL(new Blob([u], { type: 'video/webm' })), 'uni.webm'); }, { b64 });
      await L.waitReady(q);
      const r = await q.evaluate(async ({ N, endFr }) => {
        const e = EXP(); e.t0 = VID.frames[0]; e.rangeB = VID.frames[endFr];
        e.origin = { x: 10, y: 10 }; e.originSet = true; e.axisSet = true; e.mPerPx = 0.001; UI.calPend = null;
        e.objReady[0] = true; e.trackReady = true; document.getElementById('inStepN').value = N; document.getElementById('selAfter').value = 'n';
        afterChange(); await vidSeek(e.t0); afterSeek();
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        for (let k = 0; k < 30 && !trackingDone(); k++) { await VID.q; await sleep(60); commitPoint(35 + 600 * VID.cur, 180, null); await sleep(60); await VID.q; }
        const fr = e.objs[0].map(p => p.fr), gaps = fr.slice(1).map((f, i) => f - fr[i]);
        const handN = { last: fr[fr.length - 1], gaps: [...new Set(gaps)], done: trackingDone() };
        /* 自動追跡でも同じ */
        e.objs[0] = []; APP.autoTrack = true; UI.startedAuto = true; await vidSeek(e.t0); afterSeek();
        vidDrawFull(); const d = document.getElementById('cvFull').getContext('2d').getImageData(Math.round(35 + 600 * VID.cur), 180, 1, 1).data;
        APP.trackColor = { r: d[0], g: d[1], b: d[2] }; addPoint(0, 35 + 600 * VID.cur, 180, false);
        autoRunAll(); while (UI.autoRunning) await sleep(30);
        const fa = e.objs[0].map(p => p.fr), ga = fa.slice(1).map((f, i) => f - fa[i]);
        return { hand: handN, auto: { last: fa[fa.length - 1], gaps: [...new Set(ga)] } };
      }, { N, endFr });
      check(`N=${N}・終わり 第${endFr}コマ：手で記録は第${lastFr}コマで終わり、間隔はすべて ${N} コマ`, r.hand.last === lastFr && r.hand.gaps.length === 1 && r.hand.gaps[0] === N && r.hand.done, r.hand);
      check(`N=${N}・終わり 第${endFr}コマ：自動追跡も第${lastFr}コマで終わり、間隔はすべて ${N} コマ`, r.auto.last === lastFr && r.auto.gaps.length === 1 && r.auto.gaps[0] === N, r.auto);
      await q.context().close();
    }
  }

  console.log('O. 課題ファイルの「JSON で提出」ON／OFF');
  {
    for (const on of [true, false]) {
      const p = await L.newPage(browser);
      await L.setupTo4(p);
      await setMovSource(p, 'video/quicktime');
      await p.evaluate(() => { const c = document.getElementById('cbTeacher'); c.checked = true; c.onchange(); });
      await p.click('#btnKadai'); await p.waitForSelector('#kdJson', { state: 'visible' });
      const def = await p.evaluate(() => document.getElementById('kdJson').value);
      if (on) check('課題の画面に「JSON で提出」（既定は ON）', def === '1', def);
      await p.selectOption('#kdJson', on ? '1' : '0');
      const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#kdMake')]);
      const out = L.path.join(__dirname, on ? '_kadai_json_on.html' : '_kadai_json_off.html'); await dl.saveAs(out);
      await p.context().close();
      const q = await L.newPage(browser, 'file://' + out, { flags: { __noAskName: true } });
      await L.waitReady(q, 30000);
      const r = await q.evaluate(() => { const c = document.querySelector('#side1 .card.op'); return { btn: !!document.getElementById('btnKadaiSubmit'), txt: c.textContent }; });
      if (on) {
        check('ON：生徒の課題のカードに［提出用ファイル（JSON）を保存］と案内', r.btn && /提出用ファイル（JSON）/.test(r.txt), r);
        const empty = await q.evaluate(() => { document.getElementById('btnKadaiSubmit').click(); return document.getElementById('toast') ? document.getElementById('toast').textContent : ''; });
        check('点が無いときは保存しない（ひとこと出す）', /まだ点が記録されていません/.test(empty), empty);
        await q.evaluate(() => { const e = EXP(); e.objReady[0] = true; e.trackReady = true; UI.startedAuto = false;
          VID.frames.forEach((t, i) => { if (i % 6 === 0 && t <= e.rangeB + 1e-6) e.objs[0].push({ t, fr: i, x: 72 + 300 * t, y: 312 }); }); afterChange(); });
        const [dj] = await Promise.all([q.waitForEvent('download'), q.click('#btnKadaiSubmit')]);
        const jf = L.path.join(__dirname, '_submit.json'); await dj.saveAs(jf);
        const js = JSON.parse(L.fs.readFileSync(jf, 'utf8'));
        check('押すと JSON（記録した点つき）を保存できる', js.app === 'motion-analysis' && js.exps && js.exps[0].objs[0].length > 3, { name: dj.suggestedFilename(), n: js.exps && js.exps[0].objs[0].length });
        /* 先生が「過去測定データを実験○に登録」で読めるか */
        const p2 = await L.newPage(browser);
        const back = await p2.evaluate((txt) => new Promise(res => { importJson(new File([txt], 'a.json', { type: 'application/json' })); setTimeout(() => res({ n: APP.exps.length, pts: APP.exps[APP.exps.length - 1].objs[0].length }), 400); }), L.fs.readFileSync(jf, 'utf8'));
        check('先生の画面で「過去測定データを登録」として読める', back.n >= 2 && back.pts > 3, back);
        await p2.context().close();
      } else {
        check('OFF：提出の案内もボタンも出ない', !r.btn && !/提出/.test(r.txt), r);
      }
      check('ページエラー 0（生徒側）', q.__errors.length === 0, q.__errors);
      await q.context().close();
    }
  }

  console.log('P. サンプル動画の一覧');
  {
    const p = await L.newPage(browser, null, { flags: false });
    const r = await p.evaluate(() => [...document.querySelectorAll('#selSample option')].slice(1).map(o => [o.value, o.textContent]));
    check('サンプルは ①等速直線運動 ②鉛直投げ上げ運動 ③単振動 ④等速円運動（samples\\ の 4 本）',
      JSON.stringify(r) === JSON.stringify([['samples/1_tousoku.mp4', '①等速直線運動'], ['samples/2_nageage.mp4', '②鉛直投げ上げ運動'], ['samples/3_tanshindou.mp4', '③単振動'], ['samples/4_tousoku-enundou.mp4', '④等速円運動']]), r);
    await p.context().close();
  }

  await browser.close();
  process.exit(L.summary('run_test') ? 1 : 0);
})();
