const L = require('./lib');
(async () => {
  const b = await L.chromium.launch();
  for (const f of ['kadai_1_tousoku', 'kadai_2_nageage', 'kadai_3_tanshindou', 'kadai_4_enundou', 'kadai_5_gensui-enundou']) {
    const p = await L.newPage(b, 'file:///mnt/user-data/outputs/kadai/' + f + '.html', { flags: false });
    await p.waitForTimeout(2500);
    const r = await p.evaluate(() => ({ t: KADAI.title, has: typeof bindLiveRsz === 'function' && !!document.getElementById('sbsRsz'), auto: APP.autoTrack, N: document.getElementById('inStepN').value }));
    console.log(f, JSON.stringify(r), 'errors', p.__errors.length, 'ext', p.__ext.length);
    await p.context().close();
  }
  await b.close();
})();
