// レポート HTML の確認：
//  ① 横幅 320〜1440px で横スクロールが出ないか
//  ② 印刷が A4 に収まるか（紙の幅をこえる要素がないか／ページ数）
//  ③ 外部へ出ていく通信が 0 か（file:// で開いたとき）
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');

const FILE = 'file://' + path.join(__dirname, 'motion-analysis_AI-collaboration.html');
const WIDTHS = [320, 360, 390, 430, 768, 1024, 1440];

(async () => {
  const browser = await chromium.launch();
  let ng = 0;

  // ① 画面の横はみ出し
  for (const w of WIDTHS) {
    const page = await browser.newPage({ viewport: { width: w, height: 800 } });
    const reqs = [];
    page.on('request', r => { if (!r.url().startsWith('file:')) reqs.push(r.url()); });
    const errs = [];
    page.on('pageerror', e => errs.push(String(e)));
    await page.goto(FILE, { waitUntil: 'load' });
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => {
      const d = document.documentElement;
      const over = d.scrollWidth - d.clientWidth;
      // どの要素がはみ出しているか
      const bad = [];
      if (over > 0) {
        document.querySelectorAll('*').forEach(e => {
          const b = e.getBoundingClientRect();
          if (b.right > d.clientWidth + 1) bad.push(e.tagName + '.' + e.className + ' right=' + Math.round(b.right));
        });
      }
      return { over, bad: bad.slice(0, 5), pages: document.querySelectorAll('.page').length };
    });
    const ok = r.over === 0 && reqs.length === 0 && errs.length === 0;
    if (!ok) ng++;
    console.log(`${ok ? 'OK ' : 'NG '} ${String(w).padStart(4)}px  はみ出し ${r.over}px  外部通信 ${reqs.length}  エラー ${errs.length}` +
      (r.bad.length ? '\n      ' + r.bad.join('\n      ') : ''));
    await page.close();
  }

  // ② 印刷（A4）
  const page = await browser.newPage({ viewport: { width: 794, height: 1123 } });  // A4 の紙幅
  await page.goto(FILE, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  await page.emulateMedia({ media: 'print' });   // 先に印刷スタイルを当ててから PDF にする
  await page.waitForTimeout(300);
  const pdfPath = path.join(__dirname, '_check.pdf');
  await page.pdf({ path: pdfPath, format: 'A4', printBackground: true, preferCSSPageSize: true });
  await page.waitForTimeout(200);
  const pr = await page.evaluate(() => {
    const mm = 96 / 25.4, W = 210 * mm;          // A4 の幅（px 換算）
    let maxW = 0, over = [];
    document.querySelectorAll('.page').forEach((e, i) => {
      const w = e.getBoundingClientRect().width;
      if (w > maxW) maxW = w;
      e.querySelectorAll('*').forEach(c => {
        const b = c.getBoundingClientRect(), p = e.getBoundingClientRect();
        if (b.right - p.left > W + 2) over.push('p' + (i + 1) + ' ' + c.tagName + '.' + c.className);
      });
    });
    return { maxW: Math.round(maxW), A4: Math.round(W), over: over.slice(0, 5), pages: document.querySelectorAll('.page').length };
  });
  const bytes = fs.statSync(pdfPath).size;
  const buf = fs.readFileSync(pdfPath);
  const nPages = (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  const okPrint = pr.over.length === 0 && pr.maxW <= pr.A4 + 2;
  if (!okPrint) ng++;
  console.log(`${okPrint ? 'OK ' : 'NG '} 印刷  .page の幅 ${pr.maxW}px（A4=${pr.A4}px）  はみ出し要素 ${pr.over.length}  ` +
    `紙 ${nPages} 枚（.page ${pr.pages} 個）  PDF ${(bytes / 1024 / 1024).toFixed(1)}MB` +
    (pr.over.length ? '\n      ' + pr.over.join('\n      ') : ''));

  // ③ フッターの文字列
  const src = fs.readFileSync(path.join(__dirname, 'motion-analysis_AI-collaboration.html'), 'utf8');
  for (const t of ['physics-chiba.goatcounter.com', 'sg-glow', '@media screen and (max-width:820px)']) {
    const ok = src.includes(t); if (!ok) ng++;
    console.log(`${ok ? 'OK ' : 'NG '} 文字列 "${t}"`);
  }

  await browser.close();
  console.log(ng === 0 ? '\n=== すべて合格 ===' : `\n=== ${ng} 件 NG ===`);
  process.exit(ng === 0 ? 0 : 1);
})();
