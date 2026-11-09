// 生徒向け「課題ファイルの使い方」（A4・2 枚以内）
const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType, BorderStyle,
        AlignmentType, ShadingType, LevelFormat, PageBreak, VerticalAlign, LineRuleType } = require('docx');

const IMG = n => fs.readFileSync('/home/claude/guide/img/' + n);
const FONT = { ascii: 'Yu Gothic', eastAsia: 'Yu Gothic', hAnsi: 'Yu Gothic' };
const BLUE = '0F4C8F', ORANGE = 'C96C11', GRAY = '5B6672';
const PAGE_W = 11906, MARGIN = 850, CONTENT = PAGE_W - 2 * MARGIN;   // A4・余白 15 mm
const PX = dxa => Math.round(dxa / 15);                                // 1 px ＝ 15 dxa（96 dpi）

/* ---- 部品 ---- */
const t = (text, o = {}) => new TextRun(Object.assign({ text, font: FONT, size: 20 }, o));
const b = (text, o = {}) => t(text, Object.assign({ bold: true }, o));
const p = (runs, o = {}) => new Paragraph(Object.assign({ children: Array.isArray(runs) ? runs : [runs], spacing: { before: 0, after: 60, line: 300, lineRule: LineRuleType.EXACT } }, o));
const h = (num, text, newPage) => new Paragraph({ pageBreakBefore: !!newPage,
  children: [t(num + '　', { bold: true, size: 26, color: 'FFFFFF' }), t(text, { bold: true, size: 26, color: 'FFFFFF' })],
  shading: { type: ShadingType.CLEAR, color: 'auto', fill: BLUE },
  spacing: { before: 160, after: 80, line: 380, lineRule: LineRuleType.EXACT }, keepNext: true, indent: { left: 0 },
});
const img = (name, wpx, hpx) => new ImageRun({ type: 'png', data: IMG(name), transformation: { width: wpx, height: hpx } });
const imgP = (name, wpx, hpx, o = {}) => new Paragraph(Object.assign({ children: [img(name, wpx, hpx)], alignment: AlignmentType.CENTER, spacing: { before: 40, after: 60 } }, o));
const bullet = (runs, lvl = 0) => new Paragraph({ children: Array.isArray(runs) ? runs : [runs], numbering: { reference: 'dots', level: lvl }, spacing: { before: 0, after: 40, line: 290, lineRule: LineRuleType.EXACT } });
const step = (runs) => new Paragraph({ children: Array.isArray(runs) ? runs : [runs], numbering: { reference: 'steps', level: 0 }, spacing: { before: 0, after: 40, line: 290, lineRule: LineRuleType.EXACT } });
const NOB = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const noBorders = { top: NOB, bottom: NOB, left: NOB, right: NOB, insideHorizontal: NOB, insideVertical: NOB };
const cell = (children, w, o = {}) => new TableCell(Object.assign({ children, width: { size: w, type: WidthType.DXA },
  borders: { top: NOB, bottom: NOB, left: NOB, right: NOB }, margins: { top: 40, bottom: 40, left: 80, right: 80 } }, o));
/* 2 つを横にならべる（枠なし） */
function pair(left, right, wl, wr) {
  return new Table({ width: { size: wl + wr, type: WidthType.DXA }, columnWidths: [wl, wr], borders: noBorders,
    rows: [new TableRow({ children: [cell(left, wl, { verticalAlign: VerticalAlign.TOP }), cell(right, wr, { verticalAlign: VerticalAlign.TOP })] })] });
}
/* 色つきの囲み */
function boxed(children, fill, line) {
  const bd = { style: BorderStyle.SINGLE, size: 8, color: line };
  return new Table({ width: { size: CONTENT, type: WidthType.DXA }, columnWidths: [CONTENT],
    rows: [new TableRow({ children: [new TableCell({ children, width: { size: CONTENT, type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, color: 'auto', fill }, borders: { top: bd, bottom: bd, left: bd, right: bd },
      margins: { top: 80, bottom: 60, left: 160, right: 160 } })] })] });
}
const sp = (after = 60) => new Paragraph({ children: [], spacing: { before: 0, after } });

/* ---- 画像の大きさ（px） ---- */
const W1 = Math.round(PX(CONTENT) * 0.84), H1 = Math.round(W1 * 660 / 1860);
const half = Math.floor((CONTENT - 200) / 2), WH = Math.round((PX(half) - 12) * 0.86), HH = Math.round(WH * 621 / 1100);
const G5 = 6300, W5 = PX(G5) - 12, H5 = Math.round(W5 * 1410 / 2732);
const W6 = PX(half) - 12, H6 = Math.round(W6 * 411 / 1152), H7 = Math.round(W6 * 439 / 1152);
const W4 = PX(2500), H4 = Math.round(W4 * 621 / 1100);
const CW = 4200, WC = PX(CW) - 14, HC = Math.round(WC * 621 / 1100);   /* 色マーカーの小さい図 */

const children = [
  /* ===== 1 枚目 ===== */
  new Paragraph({ children: [t('動画解析アプリ　課題ファイルの使い方', { bold: true, size: 36, color: BLUE })], spacing: { before: 0, after: 40, line: 480, lineRule: LineRuleType.EXACT } }),
  new Paragraph({ children: [t('動画の中の物体の動きを記録して、グラフにしてみよう', { size: 21, color: GRAY })], spacing: { before: 0, after: 100, line: 300, lineRule: LineRuleType.EXACT },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: BLUE, space: 4 } } }),
  boxed([
    p([b('今日やること　', { color: ORANGE, size: 22 }), b('① トラッキング（物体の位置を手でクリックして記録）　→　② グラフを動画と一緒に再生　→　③ レポート（PDF）を保存', { size: 21 })], { spacing: { before: 0, after: 20 } }),
  ], 'FFF6E2', 'E0A240'),
  sp(40),
  h('0', '課題を開く'),
  p([t('先生から配られた URL（'), b('課題ページ'), t('）を開き、先生に言われた課題の'), b('［開く］'), t('を押します（Chrome・Edge・Safari で開きます）。少し待つと動画が読みこまれ、'),
     b('「4. トラッキング」から始まります'), t('。時間の範囲・原点・スケール・コマ数などは、先生が設定ずみです。')]),
  h('1', 'トラッキング（手でクリックして、物体の位置を記録する）'),
  pair(
    [imgP('g1_open.png', WH, HH, { spacing: { before: 0, after: 20 } }), p([b('1 '), t('［トラッキング（軌跡の追跡）開始］を押す')], { alignment: AlignmentType.CENTER })],
    [imgP('g8_hand.png', WH, HH, { spacing: { before: 0, after: 20 } }), p([b('2 '), t('赤い印（マーカー）の真ん中をクリック')], { alignment: AlignmentType.CENTER })],
    half + 100, half + 100),
  bullet([t('「'), b('どちらで記録しますか？'), t('」が出たときは、'), b('［手でクリックして記録］'), t('を押します。')]),
  bullet([t('クリックするたびに数コマ進みます。'), b('最後まで、毎回同じ所（赤い印の真ん中）をクリック'), t('し続けます。')]),
  bullet([b('長押し'), t('すると拡大されるので、正確に打てます。')]),
  bullet([t('まちがえたら、左上の'), b('［1回分トラッキングを取り消す］'), t('（オレンジの枠）を押すと、1 つ前にもどれます。')]),
  sp(10),
  pair(
    [imgP('g4_done.png', W4, H4, { alignment: AlignmentType.LEFT, spacing: { before: 0, after: 0 } })],
    [p([b('「解析終了。グラフを表示してみよう」'), t('が出たら、トラッキングは完了です。')], { spacing: { before: 120, after: 60, line: 300, lineRule: LineRuleType.EXACT } }),
     p([t('このあと 2 のグラフへ進みます。（この知らせを押しても ②グラフ に進めます）', { color: GRAY, size: 19 })])],
    2700, CONTENT - 2700),

  h('2', 'グラフを動画と一緒に再生する'),
  pair(
    [imgP('g5_live.png', W5, H5, { alignment: AlignmentType.LEFT, spacing: { before: 0, after: 0 } })],
    [step([t('上のタブの'), b('［② グラフ］'), t('を押す')]),
     step([b('［動画と一緒にグラフを再生する］'), t('を押す')]),
     step([b('［▶ 再生］'), t('を押す')]),
     p([t('動画が動くのに合わせて、グラフに点が打たれていきます。何度でも再生できます（［最初に戻す］→［▶ 再生］）。', { size: 19 })], { spacing: { before: 40, after: 0, line: 280, lineRule: LineRuleType.EXACT } })],
    G5, CONTENT - G5),
  sp(30),
  boxed([p([b('見てみよう　', { color: ORANGE }), t('物体の動きと、グラフの点のならび方を見くらべてみよう。')], { spacing: { before: 0, after: 20 } })], 'EAF3FB', '9CC3E8'),

  /* ===== 2 枚目 ===== */
  h('3', 'レポート（PDF）を保存する', true),
  step([t('右上の'), b('［レポートPDF］'), t('を押す')]),
  step([t('「ストロボ写真を作成しますか？」と聞かれたら'), b('［はい］'), t('（レポートの最後にストロボ写真がつきます。少し時間がかかります）')]),
  step([t('名前を聞かれたら、'), b('先生の指示した名前'), t('（例：出席番号と名前）を入れて'), b('［保存する］')]),
  pair(
    [imgP('g6_stro.png', W6, H6, { spacing: { before: 0, after: 0 } })],
    [imgP('g7_name.png', W6, H7, { spacing: { before: 0, after: 0 } })],
    half + 100, half + 100),
  p([t('PDF は、パソコンの'), b('「ダウンロード」'), t('フォルダに保存されます。先生の指示にしたがって提出してください。')], { spacing: { before: 60, after: 60, line: 300, lineRule: LineRuleType.EXACT } }),
  h('?', 'こまったとき'),
  bullet([b('動画の上の案内がじゃま'), t('　…　案内の左はしの点々の帯をドラッグすると、脇によけられます。')]),
  bullet([b('最初からやり直したい'), t('　…　①の画面の右上の［トラッキングした点をリセット］。')]),
  bullet([b('途中で閉じてしまった'), t('　…　同じ端末・同じブラウザで同じ課題を開けば、続きからできます。')]),
  bullet([b('動画が出ない'), t('　…　Chrome・Edge・Safari で開き直してください。それでもだめなら先生に知らせてください。')]),
  h('★', '色マーカーで自動追跡する（先生から指示があったとき）'),
  pair(
    [p([t('赤い印の色を覚えて、最後まで自動で追いかける方法です。')], { spacing: { before: 0, after: 40, line: 290, lineRule: LineRuleType.EXACT } }),
     p([b('1 '), t('「どちらで記録しますか？」で'), b('［色で自動追跡］'), t('を押す')], { spacing: { before: 0, after: 30, line: 290, lineRule: LineRuleType.EXACT } }),
     p([b('2 '), t('赤い印を 1 回クリック')], { spacing: { before: 0, after: 30, line: 290, lineRule: LineRuleType.EXACT } }),
     p([b('3 '), b('［自動追跡を開始する］'), t('を押す')], { spacing: { before: 0, after: 50, line: 290, lineRule: LineRuleType.EXACT } }),
     p([b('見失ったとき'), t('は止まります。その場で物体をクリックし、「見つけました！ 最後まで追跡 しますか？」を押すと続きます。', { size: 19 })], { spacing: { before: 0, after: 0, line: 280, lineRule: LineRuleType.EXACT } })],
    [imgP('g2_color.png', WC, HC, { spacing: { before: 0, after: 0 } }), imgP('g3_start.png', WC, HC, { spacing: { before: 40, after: 0 } })],
    CONTENT - CW, CW),
];

const doc = new Document({
  styles: { default: { document: { run: { font: FONT, size: 20 } } } },
  numbering: { config: [
    { reference: 'dots', levels: [{ level: 0, format: LevelFormat.BULLET, text: '●', alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 360, hanging: 260 } }, run: { color: ORANGE, size: 16 } } }] },
    { reference: 'steps', levels: [{ level: 0, format: LevelFormat.DECIMAL_ENCLOSED_CIRCLE, text: '%1', alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 420, hanging: 380 } }, run: { color: 'C62828', bold: true, size: 22 } } }] },
  ] },
  sections: [{ properties: { page: { size: { width: PAGE_W, height: 16838 }, margin: { top: 720, bottom: 680, left: MARGIN, right: MARGIN } } }, children }],
});
Packer.toBuffer(doc).then(buf => { fs.writeFileSync('/home/claude/guide/課題ファイルの使い方（生徒用）.docx', buf); console.log('ok'); });
