const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ deviceScaleFactor: 2 }); const p = await ctx.newPage();
  for (const n of process.argv.slice(2)) {
    const svg = require('fs').readFileSync(n, 'utf8'); const m = svg.match(/width="(\d+)" height="(\d+)"/);
    await p.setViewportSize({ width: +m[1], height: +m[2] });
    await p.setContent('<html><body style="margin:0">' + svg + '</body></html>');
    await p.screenshot({ path: n.replace('.svg', '.png'), clip: { x: 0, y: 0, width: +m[1], height: +m[2] } });
  }
  await b.close();
})();
