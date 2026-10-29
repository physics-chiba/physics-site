// data: と blob: で、MIME（video/quicktime 等）と大きさによって再生できるかを比べる
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('about:blank');
  for (const f of ['small.mp4', 'big.mp4']) {
    const b64 = fs.readFileSync(f).toString('base64');
    for (const type of ['video/mp4', 'video/quicktime', '']) {
      const r = await p.evaluate(async ({ b64, type }) => {
        const test = src => new Promise(res => {
          const v = document.createElement('video'); v.muted = true;
          const to = setTimeout(() => res('timeout'), 8000);
          v.onloadeddata = () => { clearTimeout(to); res('OK ' + v.videoWidth + 'x' + v.videoHeight); };
          v.onerror = () => { clearTimeout(to); res('ERR ' + (v.error && v.error.code) + ' ' + (v.error && v.error.message)); };
          v.src = src;
        });
        const data = 'data:' + type + ';base64,' + b64;
        const bin = atob(b64), u = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
        const blob = URL.createObjectURL(new Blob([u], { type }));
        return { data: await test(data), blob: await test(blob), canPlay: type ? document.createElement('video').canPlayType(type) : '-' };
      }, { b64, type });
      console.log(f.padEnd(10), (type || '(なし)').padEnd(16), 'data:', r.data.padEnd(40), 'blob:', r.blob.padEnd(16), 'canPlayType=', JSON.stringify(r.canPlay));
    }
  }
  await b.close();
})();
