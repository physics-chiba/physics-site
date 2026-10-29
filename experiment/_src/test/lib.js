// テストの共通部品
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const ROOT = path.join(__dirname, '..');
const APPURL = 'file://' + path.join(ROOT, 'motion-analysis.html');

let NG = 0, OK = 0;
function check(name, cond, info) {
  if (cond) { OK++; console.log('  OK  ' + name); }
  else { NG++; console.log('  NG  ' + name + (info !== undefined ? '  → ' + JSON.stringify(info) : '')); }
}
function summary(label) {
  console.log(`\n[${label}] 合格 ${OK} ／ 不合格 ${NG}`);
  return NG;
}
async function newPage(browser, url, opts) {
  opts = opts || {};
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1440, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  page.__errors = []; page.__ext = [];
  page.on('pageerror', e => page.__errors.push(String(e)));
  page.on('request', r => { const u = r.url(); if (!/^(file:|data:|blob:|about:)/.test(u)) page.__ext.push(u); });
  if (opts.flags !== false) {
    await page.addInitScript((f) => { Object.assign(window, f); }, Object.assign({ __noAskFps: true, __noAskN: true, __noAskName: true }, opts.flags || {}));
  }
  await page.goto(url || APPURL, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  return page;
}
async function waitReady(page, ms) {
  await page.waitForFunction(() => window.VID && VID.ready && !VID.building &&
    document.getElementById('busyLock') && document.getElementById('busyLock').classList.contains('hide'),
    null, { timeout: ms || 30000 });
  await page.waitForTimeout(300);
}
/* 動画を読み、2・3 を済ませて 4 まで進める（値は直接入れる） */
async function setupTo4(page, video) {
  await page.evaluate((v) => loadVideoUrl(v, v.split('/').pop()), video || 'test/proj.webm');
  await waitReady(page);
  await page.evaluate(() => {
    const e = EXP();
    e.t0 = 0.0; e.rangeB = VID.frames.length ? VID.frames[VID.frames.length - 1] : VID.dur - 0.05;
    e.origin = { x: 72, y: 312 }; e.originSet = true; e.axisSet = true; e.angle = 0;
    e.mPerPx = 0.001; e.scaleLen = 0.1; e.scaleRef = { x1: 40, y1: 333, x2: 140, y2: 333 };
    UI.calPend = null; APP.editStep = 0;
    afterChange();
  });
  await page.waitForTimeout(200);
}
/* 斜方投射の点を直接入れる（x=0.3t, y=0.35t−0.25t² [m]、1 px = 1 mm） */
async function addProjPoints(page, N) {
  await page.evaluate((N) => {
    const e = EXP(), fr = VID.frames.length ? VID.frames : null, dt = 1 / 30;
    e.objs[0] = [];
    const n = fr ? fr.length : 45;
    for (let i = 0; i < n; i += N) {
      const t = fr ? fr[i] : i * dt;
      const X = 0.3 * t, Y = 0.35 * t - 0.25 * t * t;
      /* 物理 → 画面（原点 (72,312)、1 px = 1 mm、y は上向き正） */
      e.objs[0].push({ t: t, fr: i, x: 72 + X / 0.001, y: 312 - Y / 0.001 });
    }
    e.objReady[0] = true; e.trackReady = true;
    afterChange();
  }, N || 3);
  await page.waitForTimeout(200);
}
module.exports = { chromium, path, fs, ROOT, APPURL, check, summary, newPage, waitReady, setupTo4, addProjPoints };
