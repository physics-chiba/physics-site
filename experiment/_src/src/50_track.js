/* =========================================================
   50_track.js … 動画エリアの描画とタップ操作（ルーペ・記録・校正）
   ========================================================= */
var VIEW = { zoom:1, panX:0, panY:0, K:1 };
var UI = { mode:'record', obj:0, pend:null, scaleP1:null, drag:null, pointers:{},
           pinch:null, undo:[], autoStop:false, autoRunning:false, lastPt:null, stroReady:false };
var FONT = '"Hiragino Kaku Gothic ProN","Yu Gothic",Meiryo,sans-serif';

/* ---------- トリミング（切り取り） ----------
   exp.crop = {x,y,w,h}（動画のピクセル座標）。記録した点の座標は動画全体のままなので、
   トリミングしても測定値は変わらない。画面はこの四角だけを大きく映す。 */
function CROP(){
  var e=EXP(), c=e.crop;
  if(c && c.w>20 && c.h>20 &&
     c.x>=0 && c.y>=0 && c.x+c.w<=VID.w+1 && c.y+c.h<=VID.h+1) return c;
  return { x:0, y:0, w:VID.w, h:VID.h };
}
function hasCrop(){ var c=CROP(); return !(c.x===0 && c.y===0 && c.w===VID.w && c.h===VID.h); }
/* ---------- キャンバスの大きさ ---------- */
function fitCanvas(){
  var box=$('videobox'), cv=$('cvView'), ov=$('cvOv'), wrap=$('vwrap');
  if(!VID.ready) return;
  var c=CROP();
  /* 動画の幅は「入れ物の幅」から決める。box.clientWidth を使うと、
     いちど広げた幅が中身（vwrap）で保たれてしまい、画面をせまくしても縮まない
     （タブレットを横→たてに回したときに横スクロールが出る） */
  var host=box.parentNode;
  var avail=(host && host.clientWidth) || box.clientWidth || 640;
  var bw=(box.offsetWidth-box.clientWidth) || 2;          /* 枠線のぶん */
  var cssW = Math.max(120, Math.min(box.clientWidth || avail, avail-bw));
  /* たての長い動画（スマホの縦撮り）でも画面に収まるように、高さで頭打ちにする */
  /* 高さの上限。動画エリアの下辺をドラッグすると APP.vidh（px）で決められる */
  var maxH = (APP.vidh>0)? APP.vidh : Math.max(240, Math.round(window.innerHeight*0.72));
  if(cssW * c.h / c.w > maxH) cssW = Math.round(maxH * c.w / c.h);
  var dpr = Math.min(window.devicePixelRatio||1, 2);
  var w = Math.round(Math.min(cssW*dpr, c.w*3));
  var h = Math.round(w * c.h / c.w);
  if(cv.width!==w||cv.height!==h){ cv.width=w; cv.height=h; ov.width=w; ov.height=h; }
  wrap.style.width = cssW+'px';
  ov.style.width = cv.style.width = '100%';
  ov.style.height = 'auto';
}
function calcK(){
  var cv=$('cvView'), c=CROP();
  VIEW.K = cv.width / c.w;
  VIEW.zoom = VID.w / c.w;                 /* クリック精度の表示に使う */
}
function clampPan(){ var c=CROP(); VIEW.panX=c.x; VIEW.panY=c.y; }
function v2s(x,y){ return { x:(x-VIEW.panX)*VIEW.K, y:(y-VIEW.panY)*VIEW.K }; }
function s2v(x,y){ return { x:x/VIEW.K+VIEW.panX, y:y/VIEW.K+VIEW.panY }; }
function ev2canvas(e){
  var cv=$('cvView'), r=cv.getBoundingClientRect();
  return { x:(e.clientX-r.left)*cv.width/r.width, y:(e.clientY-r.top)*cv.height/r.height };
}
/* トリミングを決める／もどす */
function setCrop(c){
  var e=EXP();
  if(c){                                   /* 念のため、かならず動画の中におさめる */
    var x=Math.max(0,Math.min(VID.w-1, c.x)), y=Math.max(0,Math.min(VID.h-1, c.y));
    c={ x:x, y:y, w:Math.min(c.w, VID.w-x), h:Math.min(c.h, VID.h-y) };
  }
  e.crop = c? {x:Math.round(c.x), y:Math.round(c.y), w:Math.round(c.w), h:Math.round(c.h)} : null;
  UI.cropDrag=null;
  if(UI.mode==='crop') setMode('record');
  afterChange();
  setTimeout(function(){ if(VID.ready) render(); updatePrec(); updateCropInfo(); }, 10);
  updateCropInfo();
}
function updateCropInfo(){
  var c=CROP(), on=hasCrop();
  ['cropInfo'].forEach(function(id){
    var q=$(id); if(!q) return;
    q.innerHTML = !VID.ready? '動画を読み込むと使えます。' :
      (on? '<b>トリミング中：'+c.w+'×'+c.h+' px</b>（もとは '+VID.w+'×'+VID.h+' px）。'+
           'この部分だけを大きく映しています。測定した値は変わりません。'
         : '使いたい所だけを四角く囲むと、その部分が動画エリアいっぱいに広がります。');
  });
  ['btnCropClr','btnCropClr2'].forEach(function(id){ var q=$(id); if(q) q.disabled=!on; });
  ['btnCrop','btnCrop2'].forEach(function(id){
    var q=$(id); if(!q) return;
    q.classList.toggle('on', UI.mode==='crop');
    q.textContent = (UI.mode==='crop')? 'トリミングをやめる' : '動画をトリミング（端を切る）';
  });
}

/* ---------- 描画 ---------- */
function render(){
  if(!VID.ready) return;
  fitCanvas(); calcK(); clampPan();
  var cv=$('cvView'), g=cv.getContext('2d');
  /* 再生中は動画からそのまま描く（毎コマ、画素を読むための別の canvas に写すと重い）。
     止まっているときは、ルーペや色の取得で画素を読めるように、いったん cvFull に写してから描く */
  var playing=(VID.el && !VID.el.paused && !VID.el.ended);
  var full=playing? VID.el : vidDrawFull();
  if(playing) VID.fullStale=true; else VID.fullStale=false;
  g.save();
  g.fillStyle='#20262e'; g.fillRect(0,0,cv.width,cv.height);
  g.imageSmoothingEnabled = (VIEW.zoom<3);
  try{ g.drawImage(full, VIEW.panX, VIEW.panY, cv.width/VIEW.K, cv.height/VIEW.K, 0,0, cv.width, cv.height); }catch(e){}
  if(UI.stroOverlay && UI.stroImg){          /* 3 で「ストロボ写真を重ねる」を押したとき */
    g.globalAlpha=0.6;
    g.drawImage(UI.stroImg, VIEW.panX, VIEW.panY, cv.width/VIEW.K, cv.height/VIEW.K, 0,0, cv.width, cv.height);
    g.globalAlpha=1;
  }
  g.restore();
  drawOverlay();
}
function drawOverlay(){
  var ov=$('cvOv'), g=ov.getContext('2d'), exp=EXP();
  g.clearRect(0,0,ov.width,ov.height);
  var sc = ov.width/900;                       /* 線の太さの目安 */
  var LW = Math.max(1.2, 2*sc);

  /* --- 軸 --- */
  /* 2（時間範囲・トリミング）の間は、原点や軸は出さない（3 に進んでから） */
  var calShown=(typeof effStep==='function')? (effStep()>=3 && UI.mode!=='crop') : true;
  if(exp.origin && calShown && APP.axisDisp!=='no' && !(LIVE.on && !LIVE.axis)){
    var o=v2s(exp.origin.x, exp.origin.y);
    var L=Math.max(ov.width,ov.height)*1.5;
    var c=Math.cos(exp.angle), s=Math.sin(exp.angle);
    g.save();
    /* 4. トラッキング中は、物体が見えるように軸を薄くする */
    if(effStep()>=4) g.globalAlpha=0.45;      /* 4 でも「原点と軸は決まっている」と分かる濃さに */
    g.strokeStyle='rgba(255,215,0,.95)'; g.lineWidth=LW; g.setLineDash([]);
    /* x軸 */
    var xd = exp.xflip? -1 : 1;
    g.beginPath(); g.moveTo(o.x-c*L,o.y-s*L); g.lineTo(o.x+c*L,o.y+s*L); g.stroke();
    axisArrows(g, o, c*xd, s*xd, exp.angle+(xd<0?Math.PI:0), sc, 'rgba(255,215,0,.95)', ov);
    labelAt(g,'x', o.x+c*xd*215*sc+s*36*sc, o.y+s*xd*215*sc-c*36*sc, '#ffd700', 21*sc);
    if(APP.axisDisp==='xy'){
      var ay = exp.yflip? (exp.angle-Math.PI/2+Math.PI) : (exp.angle-Math.PI/2);
      var cy=Math.cos(ay), sy=Math.sin(ay);
      g.strokeStyle='rgba(120,230,160,.95)';
      g.beginPath(); g.moveTo(o.x-cy*L,o.y-sy*L); g.lineTo(o.x+cy*L,o.y+sy*L); g.stroke();
      axisArrows(g, o, cy, sy, ay, sc, 'rgba(120,230,160,.95)', ov);
      labelAt(g,'y', o.x+cy*215*sc+sy*36*sc, o.y+sy*215*sc-cy*36*sc, '#78e6a0', 21*sc);
    }
    /* 原点の印（3 のあいだは、つまんで動かせる大きな印にする） */
    var grab = (effStep()===3);
    var rr = grab? 32*sc : 7*sc;              /* 3 のあいだは大きく・赤く */
    g.lineWidth=Math.max(2, 3.5*sc);
    g.strokeStyle='rgba(0,0,0,.6)';
    g.beginPath(); g.arc(o.x,o.y,rr,0,7); g.stroke();
    g.strokeStyle='#fff';
    g.beginPath(); g.arc(o.x,o.y,rr,0,7); g.stroke();
    if(grab){
      g.fillStyle='rgba(255,45,45,.35)';
      g.beginPath(); g.arc(o.x,o.y,rr,0,7); g.fill();
      g.strokeStyle='#ff2d2d'; g.lineWidth=Math.max(2.4,3.4*sc);
      g.beginPath(); g.arc(o.x,o.y,rr,0,7); g.stroke();
      g.beginPath(); g.moveTo(o.x-rr*0.8,o.y); g.lineTo(o.x+rr*0.8,o.y);
      g.moveTo(o.x,o.y-rr*0.8); g.lineTo(o.x,o.y+rr*0.8); g.stroke();
      g.fillStyle='#ff2d2d';
      g.beginPath(); g.arc(o.x,o.y,Math.max(4,6*sc),0,7); g.fill();
      if(!exp.originSet){                       /* まだ動かしていないときは目立たせる */
        g.strokeStyle='rgba(224,123,24,.95)'; g.lineWidth=Math.max(2,3*sc);
        g.beginPath(); g.arc(o.x,o.y,rr+11*sc,0,7); g.stroke();
      }
      labelAt(g,'原点', o.x, o.y-rr-14*sc, '#ff5a5a', 34*sc);
    }
    g.restore();
    /* 4 のあいだも、原点だけははっきり見せる（設定できていないと勘違いしないように） */
    if(effStep()>=4 && exp.originSet){
      g.save();
      g.lineWidth=Math.max(2, 3*sc);
      g.strokeStyle='rgba(0,0,0,.55)';
      g.beginPath(); g.arc(o.x,o.y,9*sc,0,7); g.stroke();
      g.strokeStyle='#ff5a5a';
      g.beginPath(); g.arc(o.x,o.y,9*sc,0,7); g.stroke();
      g.beginPath(); g.moveTo(o.x-14*sc,o.y); g.lineTo(o.x+14*sc,o.y);
      g.moveTo(o.x,o.y-14*sc); g.lineTo(o.x,o.y+14*sc); g.stroke();
      labelAt(g,'原点', o.x, o.y-22*sc, '#ff5a5a', 17*sc);
      g.restore();
    }
  }
  /* --- スケールの線（②の再生中は出さない） --- */
  if(exp.scaleRef && !LIVE.on && calShown){
    var a=v2s(exp.scaleRef.x1,exp.scaleRef.y1), b=v2s(exp.scaleRef.x2,exp.scaleRef.y2);
    g.save(); g.strokeStyle='#00e5ff'; g.lineWidth=LW; g.setLineDash([6*sc,4*sc]);
    g.beginPath(); g.moveTo(a.x,a.y); g.lineTo(b.x,b.y); g.stroke(); g.setLineDash([]);
    [a,b].forEach(function(p){ g.beginPath(); g.arc(p.x,p.y,5*sc,0,7); g.stroke(); });
    g.fillStyle='#00e5ff'; g.font='bold '+(13*sc)+'px '+FONT;
    g.fillText(fmtLen(exp.scaleLen), (a.x+b.x)/2+8*sc, (a.y+b.y)/2-8*sc);
    g.restore();
  }
  if(UI.scaleP1){
    var p1=v2s(UI.scaleP1.x,UI.scaleP1.y);
    g.save(); g.strokeStyle='#00e5ff'; g.lineWidth=LW;
    g.beginPath(); g.arc(p1.x,p1.y,6*sc,0,7); g.stroke(); g.restore();
  }
  /* --- 手ぶれ補正の固定点 --- */
  if(exp.ref && exp.ref.length){
    g.save(); g.strokeStyle='#ff8ad8'; g.lineWidth=LW;
    exp.ref.forEach(function(r){ var p=v2s(r.x,r.y);
      g.beginPath(); g.moveTo(p.x-8*sc,p.y); g.lineTo(p.x+8*sc,p.y);
      g.moveTo(p.x,p.y-8*sc); g.lineTo(p.x,p.y+8*sc); g.stroke(); });
    g.restore();
  }
  /* --- 記録した点 --- */
  var half = 0.5/(VID.fps||30);
  var hiT=(typeof trackedTo==='function' && effStep()>=4)? trackedTo() : null;   /* いま記録が進んでいる所 */
  var selT=(typeof UI.markT==='number')? UI.markT : null;                        /* 表でえらんでいる所 */
  for(var ob=0; ob<NOBJ; ob++){
    var pts=exp.objs[ob]; if(!pts||!pts.length) continue;
    var col=OBJCOL[ob];
    var sorted=pts.slice().sort(function(u,w){return u.t-w.t;});
    g.save();
    g.strokeStyle=col; g.lineWidth=Math.max(1,1.4*sc); g.globalAlpha=.55;
    g.beginPath();
    sorted.forEach(function(p,i){ var q=v2s(p.x,p.y); if(i===0) g.moveTo(q.x,q.y); else g.lineTo(q.x,q.y); });
    g.stroke(); g.globalAlpha=1;
    sorted.forEach(function(p,i){
      var q=v2s(p.x,p.y), cur=Math.abs(p.t-VID.cur)<half;
      g.strokeStyle=col; g.lineWidth=Math.max(1.4,2*sc);
      var r=(cur?9:6)*sc;
      g.beginPath(); g.moveTo(q.x-r,q.y); g.lineTo(q.x+r,q.y); g.moveTo(q.x,q.y-r); g.lineTo(q.x,q.y+r); g.stroke();
      if(cur){ g.beginPath(); g.arc(q.x,q.y,r+3*sc,0,7); g.stroke(); }
      /* 自動でつけた点は、中心に小さな輪をつけて区別する */
      if(p.auto){ g.beginPath(); g.arc(q.x,q.y,r*0.5,0,7); g.stroke(); }
      /* いま記録が進んでいる先頭の点：太いオレンジの丸で囲む */
      if(hiT!==null && ob===UI.obj && Math.abs(p.t-hiT)<half){
        g.save(); g.strokeStyle='#e07b18'; g.lineWidth=Math.max(2.4,3.4*sc);
        g.beginPath(); g.arc(q.x,q.y,r+8*sc,0,7); g.stroke(); g.restore();
      }
      /* 表の矢印でえらんでいる点：似ているが別の色（青）の丸 */
      if(selT!==null && ob===UI.obj && Math.abs(p.t-selT)<half){
        g.save(); g.strokeStyle='#1663b5'; g.lineWidth=Math.max(2.4,3.4*sc);
        g.setLineDash([5*sc,4*sc]);
        g.beginPath(); g.arc(q.x,q.y,r+13*sc,0,7); g.stroke(); g.restore();
      }
    });
    g.restore();
  }
  /* --- 探索半径の円（始点を決めたあと） --- */
  if(UI.mode==='radius' && UI.radCenter){
    var rc=v2s(UI.radCenter.x, UI.radCenter.y);
    var RR=(parseInt($('inSearchR').value)||40)*VIEW.K;
    g.save();
    g.strokeStyle='rgba(0,0,0,.55)'; g.lineWidth=Math.max(3,4.5*sc);
    g.beginPath(); g.arc(rc.x,rc.y,RR,0,7); g.stroke();
    g.strokeStyle='#00e5ff'; g.lineWidth=Math.max(1.8,2.6*sc); g.setLineDash([8*sc,5*sc]);
    g.beginPath(); g.arc(rc.x,rc.y,RR,0,7); g.stroke(); g.setLineDash([]);
    /* 右はしのつまみ */
    g.fillStyle='#00e5ff'; g.strokeStyle='rgba(0,0,0,.6)'; g.lineWidth=Math.max(1,1.6*sc);
    g.beginPath(); g.arc(rc.x+RR, rc.y, Math.max(7,9*sc), 0, 7); g.fill(); g.stroke();
    labelAt(g, '探索半径 '+(parseInt($('inSearchR').value)||40)+' px', rc.x, rc.y-RR-14*sc, '#00e5ff', 15*sc);
    g.restore();
  }
  /* --- トリミングの四角 --- */
  if(UI.mode==='crop'){
    g.save();
    var cd=UI.cropDrag;
    if(cd){
      var a1=v2s(Math.min(cd.x0,cd.x1), Math.min(cd.y0,cd.y1));
      var b1=v2s(Math.max(cd.x0,cd.x1), Math.max(cd.y0,cd.y1));
      g.fillStyle='rgba(20,26,34,.55)';
      g.fillRect(0,0,ov.width,a1.y);
      g.fillRect(0,b1.y,ov.width,ov.height-b1.y);
      g.fillRect(0,a1.y,a1.x,b1.y-a1.y);
      g.fillRect(b1.x,a1.y,ov.width-b1.x,b1.y-a1.y);
      g.strokeStyle='#ffd700'; g.lineWidth=Math.max(2,3*sc); g.setLineDash([9*sc,6*sc]);
      g.strokeRect(a1.x,a1.y,b1.x-a1.x,b1.y-a1.y); g.setLineDash([]);
      labelAt(g, Math.round(Math.abs(cd.x1-cd.x0))+'×'+Math.round(Math.abs(cd.y1-cd.y0))+' px',
              (a1.x+b1.x)/2, Math.max(16*sc, a1.y-12*sc), '#ffd700', 18*sc);
    } else {
      g.fillStyle='rgba(20,26,34,.35)'; g.fillRect(0,0,ov.width,ov.height);
      labelAt(g,'残したい所を四角くドラッグしてください', ov.width/2, ov.height/2, '#fff', 22*sc);
    }
    g.restore();
  }
  /* --- いま置こうとしている点 --- */
  if(UI.pend){
    var q=v2s(UI.pend.x,UI.pend.y);
    g.save();
    g.strokeStyle=(UI.mode==='record')?OBJCOL[UI.obj]:'#ffffff'; g.lineWidth=Math.max(1.6,2.4*sc);
    g.beginPath(); g.arc(q.x,q.y,12*sc,0,7); g.stroke();
    g.beginPath(); g.moveTo(q.x-18*sc,q.y); g.lineTo(q.x+18*sc,q.y);
    g.moveTo(q.x,q.y-18*sc); g.lineTo(q.x,q.y+18*sc); g.stroke();
    g.restore();
  }
}
function arrowHead(g,x,y,ang,size,col){
  g.save(); g.translate(x,y); g.rotate(ang);
  g.fillStyle=col; g.strokeStyle='rgba(0,0,0,.55)'; g.lineWidth=Math.max(1,size*0.09);
  g.beginPath(); g.moveTo(0,0); g.lineTo(-size,-size*0.45); g.lineTo(-size,size*0.45); g.closePath();
  g.fill(); g.stroke(); g.restore();
}
/* 軸の正の向きに、いくつも矢印を並べる（画面のどこを見ても向きが分かるように） */
function axisArrows(g, o, ux, uy, ang, sc, col, ov){
  var big=Math.max(22, 40*sc);                            /* 大きくして向きを分かりやすく */
  var d=150*sc, step=Math.max(150*sc, Math.max(ov.width,ov.height)/4);
  var far=Math.max(ov.width,ov.height)*1.2;
  arrowHead(g, o.x+ux*d, o.y+uy*d, ang, big, col);        /* 原点の近く */
  for(var r=step; r<far; r+=step){                        /* 線の途中にも */
    var x=o.x+ux*r, y=o.y+uy*r;
    if(x<-30||y<-30||x>ov.width+30||y>ov.height+30) continue;
    if(Math.abs(r-d)<step*0.5) continue;
    arrowHead(g, x, y, ang, big*0.85, col);
  }
}
function labelAt(g,txt,x,y,col,size){
  g.save(); g.font='bold '+size+'px '+FONT; g.textAlign='center'; g.textBaseline='middle';
  g.lineWidth=size*0.35; g.strokeStyle='rgba(0,0,0,.75)'; g.strokeText(txt,x,y);
  g.fillStyle=col; g.fillText(txt,x,y); g.restore();
}
function fmtLen(m){
  if(m>=1) return nf(m,3)+' m';
  if(m>=0.01) return nf(m*100,2)+' cm';
  return nf(m*1000,1)+' mm';
}

/* ---------- ルーペ ---------- */
function showLoupe(vx,vy){
  var lp=$('loupe'), lc=$('cvLoupe'), g=lc.getContext('2d');
  if(VID.fullStale) vidDrawFull();
  var full=$('cvFull'), R=lc.width;
  g.fillStyle='#000'; g.fillRect(0,0,R,R);
  /* いまの表示倍率の 3 倍で見せる（拡大しているときは、さらに細かく見える） */
  var cvv=$('cvView'), rr=cvv.getBoundingClientRect();
  var sPerV = rr.width? VIEW.K*rr.width/cvv.width : 1;      /* 画面px / 動画px */
  var srcR = Math.max(4, (R/2)/(3*Math.max(0.2,sPerV)));
  g.save();
  g.imageSmoothingEnabled=false;
  g.drawImage(full, vx-srcR, vy-srcR, srcR*2, srcR*2, 0,0,R,R);
  g.restore();
  g.strokeStyle='rgba(255,60,60,.95)'; g.lineWidth=1.5;
  g.beginPath(); g.moveTo(R/2-14,R/2); g.lineTo(R/2-4,R/2); g.moveTo(R/2+4,R/2); g.lineTo(R/2+14,R/2);
  g.moveTo(R/2,R/2-14); g.lineTo(R/2,R/2-4); g.moveTo(R/2,R/2+4); g.lineTo(R/2,R/2+14); g.stroke();
  g.strokeStyle='rgba(255,255,255,.6)'; g.beginPath(); g.arc(R/2,R/2,10,0,7); g.stroke();
  /* 位置 */
  var box=$('videobox'), cv=$('cvView'), r=cv.getBoundingClientRect(), br=box.getBoundingClientRect();
  var s=v2s(vx,vy);
  var cssX = s.x*r.width/cv.width + (r.left-br.left);
  var cssY = s.y*r.height/cv.height + (r.top-br.top);
  var lx = cssX-66, ly = cssY-160;
  if(ly<4) ly = cssY+34;
  lx=Math.max(2, Math.min(br.width-136, lx));
  lp.style.left=lx+'px'; lp.style.top=ly+'px'; lp.style.display='block';
}
function hideLoupe(){ $('loupe').style.display='none'; }

/* ---------- ポインタ操作 ---------- */
function bindCanvas(){
  var cv=$('cvOv');
  cv.addEventListener('pointerdown', onDown);
  cv.addEventListener('pointermove', onMove);
  cv.addEventListener('pointerup', onUp);
  cv.addEventListener('pointercancel', onUp);

  cv.addEventListener('contextmenu', function(e){ e.preventDefault(); });

  /* トリミング中は、動画の左右（上下）にできる暗い余白から囲みはじめても効くようにする。
     ここに載せないと、生徒が少し外から囲んだときに「押しても何も起きない」ことがある。
     動画の上（キャンバス）を押したときは、そちらの処理にまかせる。 */
  var box=$('videobox');
  if(box){
    var onBox=function(fn){ return function(e){
      if(UI.mode!=='crop' || !VID.ready) return;
      if(e.target && e.target!==box) return;           /* キャンバスの上なら二重に処理しない */
      fn(e);
    }; };
    box.addEventListener('pointerdown', onBox(function(e){
      try{ box.setPointerCapture(e.pointerId); }catch(x){}
      onDown(e);
    }));
    box.addEventListener('pointermove', onBox(onMove));
    box.addEventListener('pointerup', onBox(function(e){
      try{ box.releasePointerCapture(e.pointerId); }catch(x){}
      onUp(e);
    }));
    box.addEventListener('pointercancel', onBox(onUp));
  }
}
function onDown(e){
  if(!VID.ready) return;
  var cv=$('cvOv');
  UI.pointers[e.pointerId]={x:e.clientX,y:e.clientY};
  var n=Object.keys(UI.pointers).length;
  if(n>1){ UI.pend=null; UI.drag=null; hideLoupe(); drawOverlay(); return; }
  try{ cv.setPointerCapture(e.pointerId); }catch(err){}
  if(e.button===1 || e.button===2){ UI.drag={x:e.clientX,y:e.clientY,pan:true}; return; }
  var p=ev2canvas(e), v=s2v(p.x,p.y);
  var exp0=EXP(), sr=exp0.scaleRef, stp=effStep();
  if(UI.mode==='crop'){                        /* トリミングの四角をひく */
    /* 動画の外（左右の暗い余白）から囲みはじめても大丈夫なように、動画の中におさめる。
       おさめないと x0 がマイナスになり、できた四角が「動画からはみ出す」ので
       CROP() に捨てられ、囲んだのに反映されない */
    var cx0=Math.max(0,Math.min(VID.w,v.x)), cy0=Math.max(0,Math.min(VID.h,v.y));
    UI.cropDrag={x0:cx0, y0:cy0, x1:cx0, y1:cy0};
    UI.drag={x:e.clientX,y:e.clientY,pan:false,crop:true};
    UI.pend=null; drawOverlay(); return;
  }
  /* 3 のあいだは、原点の印をつまんで動かせる */
  if(stp===3 && exp0.origin && (UI.mode==='record'||UI.mode==='origin')){
    var dO=Math.hypot(v.x-exp0.origin.x, v.y-exp0.origin.y)*VIEW.K;
    if(dO < 30){
      UI.dragOrigin=true;
      pushUndo({t:'cal', prev:{origin:{x:exp0.origin.x,y:exp0.origin.y}, originSet:exp0.originSet}});
      UI.drag={x:e.clientX,y:e.clientY,pan:false};
      UI.pend=null; showLoupe(v.x,v.y); drawOverlay(); return;
    }
  }
  /* 探索半径モード：どこを押しても、中心からの距離で半径を決める */
  if(UI.mode==='radius' && UI.radCenter){
    UI.dragRad=true;
    UI.drag={x:e.clientX,y:e.clientY,pan:false};
    UI.pend=null; setSearchR(v); drawOverlay(); return;
  }
  /* 3 のあいだは、スケールの点をつまんで動かせる */
  if(sr && stp===3 && UI.mode==='record'){
    var d1=Math.hypot(v.x-sr.x1, v.y-sr.y1)*VIEW.K, d2=Math.hypot(v.x-sr.x2, v.y-sr.y2)*VIEW.K;
    if(Math.min(d1,d2) < 22){
      UI.dragScale=(d1<=d2)?1:2;
      UI.drag={x:e.clientX,y:e.clientY,pan:false};
      UI.pend={x:v.x,y:v.y};
      showLoupe(v.x,v.y); drawOverlay(); return;
    }
  }
  /* 3 のあいだ（record のとき）は点を記録しない＝十字も出さない */
  if(stp===3 && UI.mode==='record'){
    UI.pend=null; UI.drag={x:e.clientX,y:e.clientY,pan:false,hint:true};
    drawOverlay(); return;
  }
  UI.pend={x:v.x, y:v.y};
  UI.drag={x:e.clientX,y:e.clientY,pan:false};
  showLoupe(v.x,v.y); drawOverlay();
}
/* 3 のとき、動画をクリックしたら「つぎにやること」をはじめる */
function step3Hint(){
  var e=EXP();
  if(!e.originSet){ toast('画面の「原点」の印を、原点にしたい所までドラッグしてください'); return; }
  if(!e.axisSet){ setMode('axis'); toast('x軸の正の方向をクリックしてください'); return; }
  if(!e.mPerPx){ $('btnScale').click(); return; }
  toast('3 は終わっています。「4. トラッキング」へ進んでください');
}
function onMove(e){
  if(!VID.ready) return;
  if(!(e.pointerId in UI.pointers)) return;
  UI.pointers[e.pointerId]={x:e.clientX,y:e.clientY};
  var n=Object.keys(UI.pointers).length;
  if(n>1) return;
  if(!UI.drag) return;
  if(UI.drag.pan){ return; }
  if(UI.drag.hint) return;
  var p=ev2canvas(e), v=s2v(p.x,p.y);
  if(UI.drag.crop && UI.cropDrag){
    UI.cropDrag.x1=Math.max(0,Math.min(VID.w,v.x));
    UI.cropDrag.y1=Math.max(0,Math.min(VID.h,v.y));
    drawOverlay(); return;
  }
  if(UI.dragRad){ setSearchR(v); drawOverlay(); return; }
  if(UI.dragOrigin){                      /* 原点をつまんで動かしている */
    var eo=EXP(); eo.origin={x:v.x,y:v.y};
    updateCalInfo(); showLoupe(v.x,v.y); drawOverlay(); return;
  }
  UI.pend={x:v.x,y:v.y};
  if(UI.dragScale) liveScale(v);
  if(UI.mode==='axis') liveAxis(v);
  showLoupe(v.x,v.y); drawOverlay();
}
function onUp(e){
  delete UI.pointers[e.pointerId];
  if(Object.keys(UI.pointers).length<2) UI.pinch=null;
  if(!UI.drag){ hideLoupe(); return; }
  var wasPan=UI.drag.pan, wasHint=UI.drag.hint, wasCrop=UI.drag.crop; UI.drag=null; hideLoupe();
  if(wasCrop){
    var cd=UI.cropDrag; UI.cropDrag=null;
    var w=cd? Math.abs(cd.x1-cd.x0) : 0, h=cd? Math.abs(cd.y1-cd.y0) : 0;
    if(w<40 || h<40){ drawOverlay(); toast('小さすぎます。もう少し大きく囲んでください'); return; }
    var tf=!!UI.trimFlow; if(tf) UI.trimLock=true;                      /* setCrop の中でモードが record にもどっても旗を下ろさせない */
    setCrop({ x:Math.min(cd.x0,cd.x1), y:Math.min(cd.y0,cd.y1), w:w, h:h });
    if(tf){ UI.trimLock=false; if(typeof askTrimOk==='function') askTrimOk(); }   /* 2 の流れ：「この範囲でいいですか？」 */
    else toast('トリミングしました（測定した値は変わりません）');
    return;
  }
  if(UI.dragRad){ UI.dragRad=false; UI.pend=null; drawOverlay(); updateGuide(); saveLocal(); return; }
  if(wasHint){ UI.pend=null; drawOverlay(); step3Hint(); return; }
  if(UI.dragOrigin){
    UI.dragOrigin=false; UI.pend=null;
    var eo=EXP(); eo.originSet=true;
    afterChange();
    calGuide('originOk');                  /* 「原点はこの位置でいいですか？ はい／いいえ」 */
    return;
  }
  if(UI.dragScale){ UI.dragScale=0; UI.pend=null; afterChange(); toast('スケールを直しました'); return; }
  if(wasPan || !UI.pend){ UI.pend=null; drawOverlay(); return; }
  var v=UI.pend; UI.pend=null;
  commitPoint(v.x, v.y, e);
}
function dist(a,b){ return Math.hypot(a.x-b.x,a.y-b.y); }
function mid(a,b){ return {x:(a.x+b.x)/2,y:(a.y+b.y)/2}; }
/* スケールの点をつまんで動かす（長さは「スケール長さ」の値のまま） */
function liveScale(v){
  var e=EXP(), sr=e.scaleRef; if(!sr) return;
  if(UI.dragScale===1){ sr.x1=v.x; sr.y1=v.y; } else { sr.x2=v.x; sr.y2=v.y; }
  var d=Math.hypot(sr.x2-sr.x1, sr.y2-sr.y1);
  if(d>2) e.mPerPx=e.scaleLen/d;
  updateCalInfo();
}
/* 探索半径を、中心からの距離で決める */
function setSearchR(v){
  if(!UI.radCenter) return;
  var d=Math.hypot(v.x-UI.radCenter.x, v.y-UI.radCenter.y);
  $('inSearchR').value=Math.max(5, Math.min(300, Math.round(d)));
}
function liveAxis(v){
  var exp=EXP(); if(!exp.origin) return;
  exp.angle=Math.atan2(v.y-exp.origin.y, v.x-exp.origin.x);
}

/* ---------- 点を確定する ---------- */
function commitPoint(vx, vy, e){
  var exp=EXP();
  /* いま映っている動画が、この実験の動画でないときは記録させない */
  if(typeof vidMismatch==='function' && vidMismatch()){
    toast('この実験の動画（'+(exp.video&&exp.video.name||'')+'）ではありません。動画を読み直してください');
    return;
  }
  if(UI.mode==='origin'){
    pushUndo({t:'cal', prev:{origin:exp.origin?{x:exp.origin.x,y:exp.origin.y}:null, originSet:exp.originSet}});
    exp.origin={x:vx,y:vy}; exp.originSet=true;
    afterChange();
    calGuide('originOk');
    return;
  }
  if(UI.mode==='scale1'){ UI.scaleP1={x:vx,y:vy}; setMode('scale2'); drawOverlay();
    toast('もう1点をクリックしてください'); return; }
  if(UI.mode==='scale2'){
    var p1=UI.scaleP1||{x:vx,y:vy};
    var d=Math.hypot(vx-p1.x, vy-p1.y);
    if(d<3){ toast('2点が近すぎます'); return; }
    var len=parseFloat($('inScaleLen').value)*parseFloat($('selScaleUnit').value);
    if(!(len>0)){ toast('長さを入力してください'); setMode('record'); return; }
    pushUndo({t:'cal', prev:{mPerPx:exp.mPerPx, scaleRef:exp.scaleRef, scaleLen:exp.scaleLen}});
    exp.mPerPx=len/d; exp.scaleLen=len;
    exp.scaleRef={x1:p1.x,y1:p1.y,x2:vx,y2:vy};
    UI.scaleP1=null;
    UI.calPend='scale';                    /* 先に旗を立てる（立てる前に afterChange すると一瞬 4 に進んだ扱いになり、画面が下に動いていた） */
    afterChange();
    calGuide('scaleOk');                   /* 「スケールはこれでいいですか？ はい／いいえ」 */
    return;
  }
  if(UI.mode==='axis'){
    if(!exp.origin){ toast('先に原点を決めてください'); setMode('record'); return; }
    var d0=Math.hypot(vx-exp.origin.x, vy-exp.origin.y);
    if(d0<6){ toast('原点から少しはなれた所をクリックしてください'); return; }
    exp.angle=Math.atan2(vy-exp.origin.y, vx-exp.origin.x);
    exp.axisSet=true;
    afterChange();
    /* 2方向なら y軸の向きを確かめてから、x軸（と y軸）の確認へ */
    if(APP.axisDisp==='xy') calGuide('yaxis'); else calGuide('axisOk');
    return;
  }
  if(UI.mode==='ref'){
    exp.ref.push({t:VID.cur, x:vx, y:vy});
    exp.ref.sort(function(a,b){return a.t-b.t;});
    pushUndo({t:'ref'});
    setMode('record'); afterChange(); toast('固定点を記録しました'); return;
  }
  if(UI.mode==='color'){
    if(typeof needTrackStart==='function' && needTrackStart()){
      toast('先に［色で自動追跡］を押してください'); setMode('record'); return;
    }
    if(VID.fullStale) vidDrawFull();
    var g=$('cvFull').getContext('2d',{willReadFrequently:true});
    var d2=g.getImageData(Math.max(0,Math.round(vx)-2), Math.max(0,Math.round(vy)-2), 5,5).data;
    var r=0,gg=0,b=0,n=0;
    for(var i=0;i<d2.length;i+=4){ r+=d2[i]; gg+=d2[i+1]; b+=d2[i+2]; n++; }
    APP.trackColor={r:r/n, g:gg/n, b:b/n};
    if(typeof updateColorTag==='function') updateColorTag();
    /* ここを「始点」にする（この物体の点をいったん消して、1点目として記録） */
    var e2=EXP();
    if(e2.objs[UI.obj].length) pushUndo({t:'bulk', obj:UI.obj, prev:e2.objs[UI.obj].slice()});
    e2.objs[UI.obj]=[];
    e2.trackReady=true;
    addPoint(UI.obj, vx, vy, false);
    APP.startPt={x:vx, y:vy, t:VID.cur};
    UI.radCenter={x:vx, y:vy};
    setMode('radius'); render();
    toast('始点と色を決めました。円をドラッグして探索半径を決められます');
    return;
  }
  /* 記録（1〜3 が終わるまでは記録させない。「もう一度」で3にもどっている間も同じ） */
  var stp=effStep();
  if(stp===3){ step3Hint(); return; }
  if(stp<4){
    toast('「'+stepName(stp)+'」を先に終わらせてください');
    return;
  }
  if(needTrackStart()){                       /* 「トラッキングを開始する」を押すまで待つ */
    toast('動画の真ん中の［トラッキング（軌跡の追跡）開始］を押してください');
    return;
  }
  /* もうこの物体のトラッキングは終わっている（新しい点は増やさない。直すのはOK） */
  if(typeof objDone==='function' && objDone(UI.obj)){
    var arr0=exp.objs[UI.obj], hf=0.4/(VID.fps||30), exists=false;
    for(var k0=0;k0<arr0.length;k0++) if(Math.abs(arr0[k0].t-VID.cur)<hf){ exists=true; break; }
    if(!exists){
      toast('この物体のトラッキングは終わっています。直したいときは、その点のコマにもどってクリックしてください');
      return;
    }
  }
  /* 解析する時間範囲の外では記録しない（まちがってクリックしても点が増えないように） */
  var half2=0.6/(VID.fps||30);
  if(exp.t0!==null && VID.cur < exp.t0-half2){
    toast('解析する時間範囲より前です。［解析範囲の最初から］を押してください'); return;
  }
  if(exp.rangeB!==null && VID.cur > exp.rangeB+half2){
    toast('解析する時間範囲より後です。［解析範囲の最初から］を押してください'); return;
  }
  /* 記録ずみの所からうんと離れた時刻でクリックしたときは、いちどたずねる */
  if(typeof trackedTo==='function'){
    var tp=trackedTo(), Nq=parseInt($('inStepN').value)||1;
    var far=(Nq+3)/(VID.fps||30);                 /* N コマ＋3コマぶんより先なら「遠い」 */
    if(tp!==null && VID.cur > tp+far){
      askFarPoint(vx, vy, tp);
      return;
    }
  }
  addPoint(UI.obj, vx, vy, false);
  if(typeof autoFoundCheck==='function') autoFoundCheck(vx, vy);   /* 見失ったあと、また見つかったか */
  var adv = $('selAfter').value, N=parseInt($('inStepN').value)||1;
  if(e && e.shiftKey) adv='1';           /* Shift＋クリック＝記録して 1 コマ進む（Ctrl＋クリックはふつうのクリックと同じなので廃止） */
  if(adv==='1') stepFrames(1);
  else if(adv==='n') stepFrames(N);
  else { afterChange(); }
}
/* 記録ずみの所からうんと離れた時刻でクリックしたとき */
function askFarPoint(vx, vy, tp){
  var e=EXP(), t0=e.t0||0;
  var here=nf(VID.cur-t0,3), done=nf(tp-t0,3);
  var nx=(typeof nextTrkTime==='function')? nextTrkTime() : null;
  popup('<h2>記録ずみの所から離れています</h2>'+
    '<p style="font-size:1.03rem">いまのコマは <b>t = '+here+' s</b>、'+
    'この物体を記録できているのは <b>t = '+done+' s</b> までです。</p>'+
    '<p class="mini">とばして記録すると、その間の速さ・加速度は出せません。</p>',
    'ここに記録する',
    function(){
      addPoint(UI.obj, vx, vy, false);
      if(typeof autoFoundCheck==='function') autoFoundCheck(vx, vy);
      var adv=$('selAfter').value, N=parseInt($('inStepN').value)||1;
      if(adv==='n') stepFrames(N); else if(adv==='1') stepFrames(1); else afterChange();
    },
    { noLabel:'記録した続きへもどる', onNo:function(){
        if(nx===null){ afterChange(); return; }
        vidSeek(nx).then(function(){ afterSeek(); afterChange(); render();
          toast('記録した続き（t = '+nf(nx-t0,3)+' s）にもどりました'); });
      } });
}
function addPoint(obj, vx, vy, auto){
  var exp=EXP(), arr=exp.objs[obj], half=0.4/(VID.fps||30), t=VID.cur;
  var idx=-1;
  for(var i=0;i<arr.length;i++) if(Math.abs(arr[i].t-t)<half){ idx=i; break; }
  var np={t:t, fr:VID.idx, x:vx, y:vy, auto:!!auto};
  if(idx>=0){
    /* 自動でついた点を手で直したときは、取り消しを1回にまとめる
       （そうしないと「1回分取り消す」を2回押さないと点が消えない） */
    var lastU=UI.undo[UI.undo.length-1];
    var merge = arr[idx].auto && !auto && lastU && lastU.t==='pt' &&
                lastU.obj===obj && lastU.i===idx && lastU.prev===null;
    if(!merge) pushUndo({t:'pt', obj:obj, i:idx, prev:arr[idx]});
    arr[idx]=np;
  }
  else { arr.push(np); arr.sort(function(a,b){return a.t-b.t;});
         pushUndo({t:'pt', obj:obj, i:arr.indexOf(np), prev:null}); }
  UI.lastPt={obj:obj, t:t};
  tblFrom=null;                     /* 表は、いま記録した所が見えるようにもどす */
  afterChange();
}
function pushUndo(a){ UI.undo.push(a); if(UI.undo.length>400) UI.undo.shift(); }
function doUndo(){
  var a=UI.undo.pop(), exp=EXP();
  if(!a){ toast('取り消せる操作はありません'); return; }
  UI.noAutoUntil=Date.now()+500;      /* 取り消した直後に、自動追跡が同じ点を打ち直さないように */
  if(a.t==='pt'){
    var arr=exp.objs[a.obj], back=null;
    if(a.prev){ arr[a.i]=a.prev; back=a.prev.t; }
    else { back=(arr[a.i]? arr[a.i].t : null); arr.splice(a.i,1); }
    UI.obj=a.obj; $('selObj').value=String(a.obj+1);
    if(back!==null && VID.ready){          /* 取り消した点のコマまで動画も戻す */
      /* ここで afterSeek() を呼ぶと、自動追跡がまた同じ点を打ってしまう（連続で取り消せない）ので呼ばない */
      vidSeek(back).then(function(){ render(); updateTimeLine(); afterChange(); });
    }
  } else if(a.t==='cal'){
    for(var k in a.prev) exp[k]=a.prev[k];
  } else if(a.t==='ref'){ exp.ref.pop(); }
  else if(a.t==='bulk'){ exp.objs[a.obj]=a.prev; }
  else if(a.t==='bulkAll'){ exp.objs=a.prev; }
  afterChange(); toast('取り消しました');
}
function nudgeLast(dx,dy){
  var exp=EXP();
  if(!UI.lastPt) return;
  var arr=exp.objs[UI.lastPt.obj], half=0.4/(VID.fps||30);
  for(var i=0;i<arr.length;i++) if(Math.abs(arr[i].t-UI.lastPt.t)<half){
    arr[i].x+=dx; arr[i].y+=dy; afterChange(); return;
  }
}

/* ---------- コマ送り ---------- */
function stepFrames(n){
  return vidStep(n).then(function(){ afterSeek(); });
}
function gotoFrame(i){ return vidGotoFrame(i).then(function(){ afterSeek(); }); }
function afterSeek(){
  render(); updateTimeLine();
  /* コマが変わったときに自動で点を置くのは、「色で自動追跡」を選んでいるあいだだけ。
     「手でクリックして記録」のときは、右上のチェックが ON で色を取ってあっても、勝手に予測した所へ点を打たない */
  if(APP.autoTrack && APP.trackColor && UI.startedAuto && !UI.autoLost) tryAutoPlace();
}

/* ---------- 色マーカーの自動追跡 ---------- */
/* 次の点の「予測位置」：探索はいまの点ではなく、この予測点を中心に行う。
   点が 2 つ → 前の点からいまの点への動き（速度）で外挿。
   点が 3 つ以上 → 速度の変わり方（加速度）も入れて外挿（落下・投射で遅れないように）。
   ただし加速度のぶんは 1 回の動きの半分までに抑え、クリックのずれで予測が暴れないようにする */
function predictPos(obj, tNow){
  var exp=EXP(), arr=exp.objs[obj].slice().sort(function(a,b){return a.t-b.t;});
  if(!arr.length) return null;
  if(tNow===undefined) tNow=VID.cur;
  var last=arr[arr.length-1];
  if(arr.length>=2){
    var p=arr[arr.length-2], dt=last.t-p.t;
    if(dt>0){
      var tau=Math.max(-3*dt, Math.min(3*dt, tNow-last.t));
      var vx=(last.x-p.x)/dt, vy=(last.y-p.y)/dt;
      var ax=0, ay=0;
      if(arr.length>=3){
        var q=arr[arr.length-3], dt0=p.t-q.t;
        if(dt0>0){
          var vx0=(p.x-q.x)/dt0, vy0=(p.y-q.y)/dt0, dtm=(dt0+dt)/2;
          ax=(vx-vx0)/dtm; ay=(vy-vy0)/dtm;
          /* vx・vy は「区間の真ん中」の速さなので、いまの点での速さは a·dt/2 だけ大きい。
             加速度による補正（a·dt/2·τ ＋ ½a·τ²）は、1 回の動きの半分までに抑える */
          var step=Math.hypot(last.x-p.x, last.y-p.y), k=dt/2*tau+0.5*tau*tau;
          var corr=Math.hypot(ax,ay)*Math.abs(k), lim=0.5*step;
          if(corr>lim && corr>0){ ax*=lim/corr; ay*=lim/corr; }
          return { x:last.x+vx*tau+ax*k, y:last.y+vy*tau+ay*k };
        }
      }
      return { x:last.x+vx*tau, y:last.y+vy*tau };
    }
  }
  return { x:last.x, y:last.y };
}
/* 探索半径の中から、追いかけている色の「かたまり」を1つだけ見つける。
   ① 円の中だけを見る（四角のすみは見ない）
   ② 色が近いほど、そして<b>探索の中心（予測した位置）に近いほど</b>重くする
   ③ いちばん重い画素を「種」にして、その<b>まわりだけ</b>で重心をとる
      （同じ色の物が2つ写っていても、真ん中あたりに引っぱられない） */
function findColor(cx, cy, R, TH){
  var col=APP.trackColor; if(!col) return null;
  if(VID.fullStale) vidDrawFull();
  var g=$('cvFull').getContext('2d',{willReadFrequently:true});
  var x0=Math.max(0,Math.round(cx-R)), y0=Math.max(0,Math.round(cy-R));
  var x1=Math.min(VID.w,Math.round(cx+R)), y1=Math.min(VID.h,Math.round(cy+R));
  if(x1-x0<2||y1-y0<2) return null;
  var d=g.getImageData(x0,y0,x1-x0,y1-y0).data;
  var W=x1-x0, H=y1-y0, R2=R*R;
  var bx=0, by=0, bw=-1, any=false;
  var i,j,k,dr,dg,db,dd,px,py,q,w;
  /* ① 種をさがす */
  for(j=0;j<H;j++) for(i=0;i<W;i++){
    px=x0+i+0.5; py=y0+j+0.5;                 /* +0.5 ＝ 画素の中心（クリックの基準と同じ） */
    q=(px-cx)*(px-cx)+(py-cy)*(py-cy);
    if(q>R2) continue;                        /* 円の外は見ない */
    k=(j*W+i)*4;
    dr=d[k]-col.r; dg=d[k+1]-col.g; db=d[k+2]-col.b;
    dd=Math.sqrt(dr*dr+dg*dg+db*db);
    if(dd>=TH) continue;
    any=true;
    w=(TH-dd)*(TH-dd)*(1-0.75*q/R2);          /* 中心に近いほど重く */
    if(w>bw){ bw=w; bx=px; by=py; }
  }
  if(!any) return null;
  /* ② 種のまわりだけで重心をとる */
  var rs=Math.max(6, R*0.45), rs2=rs*rs, sx=0, sy=0, sw=0, n=0;
  for(j=0;j<H;j++) for(i=0;i<W;i++){
    px=x0+i+0.5; py=y0+j+0.5;
    if((px-bx)*(px-bx)+(py-by)*(py-by)>rs2) continue;
    k=(j*W+i)*4;
    dr=d[k]-col.r; dg=d[k+1]-col.g; db=d[k+2]-col.b;
    dd=Math.sqrt(dr*dr+dg*dg+db*db);
    if(dd>=TH) continue;
    w=(TH-dd)*(TH-dd); sx+=px*w; sy+=py*w; sw+=w; n++;
  }
  if(sw<=0) return { x:bx, y:by, w:bw, n:1 };
  return { x:sx/sw, y:sy/sw, w:sw, n:n };
}
/* 見つけた点が「ありえない飛び方」をしていないか調べる。
   直前の1コマぶんの動きを目安に、そこから大きくはずれたら「見失った」とみなす。 */
function autoJumpBad(obj, f, pr){
  var arr=EXP().objs[obj].slice().sort(function(a,b){return a.t-b.t;});
  if(arr.length<2 || !f || !pr) return false;
  var last=arr[arr.length-1], prev=arr[arr.length-2];
  var stepPx=Math.hypot(last.x-prev.x, last.y-prev.y);
  var off=Math.hypot(f.x-pr.x, f.y-pr.y);          /* 予測した位置からのずれ */
  var lim=Math.max(8, stepPx*1.8+6);               /* 1コマの動きの2倍くらいまでは許す */
  return off>lim;
}
function tryAutoPlace(){
  if(Date.now() < (UI.noAutoUntil||0)) return;     /* 取り消した直後は置かない */
  if(typeof vidMismatch==='function' && vidMismatch()) return;   /* この実験の動画ではない */
  /* 自動で点を置いてよい場面か、手でクリックするときと同じ条件でたしかめる */
  if(typeof effStep==='function' && effStep()<4) return;        /* 4 に入るまでは置かない */
  if(typeof needTrackStart==='function' && needTrackStart()) return;
  var exp=EXP(), obj=UI.obj, half=0.6/(VID.fps||30);
  if(exp.t0!==null && VID.cur < exp.t0-half) return;            /* 解析範囲の外には置かない */
  if(exp.rangeB!==null && VID.cur > exp.rangeB+half) return;
  if(typeof objDone==='function' && objDone(obj)) return;       /* もう終わっていたら増やさない */
  /* そのコマにもう点があるなら、上書きしない（手で打った点を消さないため） */
  var arr0=exp.objs[obj], hf=0.4/(VID.fps||30);
  for(var q0=0;q0<arr0.length;q0++) if(Math.abs(arr0[q0].t-VID.cur)<hf) return;
  var pr=predictPos(obj);
  if(!pr) return;
  var R=parseInt($('inSearchR').value)||40, TH=parseInt($('inColTh').value)||60;
  var f=findColor(pr.x,pr.y,R,TH);
  if(f && !autoJumpBad(obj,f,pr)){ addPoint(obj, f.x, f.y, true); render(); }
}
/* 自動追跡を止める（範囲を変えた・タブを移した・リセットした…どこからでも呼べる） */
function stopAuto(){ UI.autoStop=true; UI.autoRunning=false; }
function autoRunAll(){
  var N=parseInt($('inStepN').value)||1, exp=EXP(), obj=UI.obj;
  /* もう走っているときは二重に始めない（2 つの輪が同時に N コマずつ進めると 2N 進んで見失い、
     「記録ずみの所から離れています」になる。ボタンと「見つけました！」の知らせを続けて押したときなど） */
  if(UI.autoRunning){ toast('自動追跡はすでに動いています'); return; }
  UI.autoStop=false;
  if(!APP.trackColor){ toast('先に「始点を設定し色を取得」でマーカーの色をクリックしてください'); return; }
  if(!exp.objs[obj].length){ toast('まず1点、手でクリックして始点を決めてください'); return; }
  var endT = (exp.rangeB!==null? exp.rangeB : (VID.dur-1e-3));
  UI.autoRunning=true; UI.autoLost=false;
  var mySeq=(UI.autoSeq=(UI.autoSeq||0)+1);
  if(typeof autoMsgHide==='function') autoMsgHide();
  function stop(msg){ if(mySeq===UI.autoSeq) UI.autoRunning=false; if(msg) toast(msg); }
  function loop(){
    if(mySeq!==UI.autoSeq) return;                   /* 別の輪が始まっていたら、こちらは黙って終わる */
    if(UI.autoStop) { stop('停止しました'); return; }
    /* 途中で実験・範囲・物体が変わったら、そこでやめる */
    if(EXP()!==exp || exp.rangeB===null || UI.obj!==obj){ stop(); return; }
    if(VID.cur >= endT-1e-6){ stop('終わりまで追跡しました'); return; }
    var was=VID.cur;
    stepFrames(N).then(function(){
      if(mySeq!==UI.autoSeq) return;
      if(UI.autoStop || EXP()!==exp || exp.rangeB===null){ stop(); return; }
      /* ここで大きく飛んでいたら、コマの時刻がうまく測れていない。
         むりに追いかけず、その場で止める（いきなり終わりへ飛ばないように） */
      var moved=VID.cur-was, want=N/(VID.fps||30);
      if(moved > want*3+0.05){
        vidSeek(was).then(function(){ afterSeek(); render(); });
        stop('コマを1つずつ進められませんでした（'+nf(moved,2)+' 秒も進みました）。'+
             '2 の［コマごとの時刻を測る］をやり直すか、fps を確かめてください');
        return;
      }
      var pr=predictPos(obj);
      var R=parseInt($('inSearchR').value)||40, TH=parseInt($('inColTh').value)||60;
      var f=pr? findColor(pr.x,pr.y,R,TH) : null;
      if(f && autoJumpBad(obj,f,pr)) f=null;       /* 変な所へ飛んだときは「見失った」とみなす */
      if(f){ addPoint(obj,f.x,f.y,true); render();
             setTimeout(loop, 0); }
      else { stop(); autoLost(); render(); }
    });
  }
  loop();
}

/* ---------- ストロボ合成 ---------- */
function makeStrobe(preview){
  var exp=EXP(), cv=$('cvStrobe');
  var mode=preview? 'diff' : $('selStroMode').value;
  var times=[];
  if(preview){
    var a0=rangeStart(exp), b0=(exp.rangeB!==null?exp.rangeB:VID.dur-1e-3);
    if(VID.frames.length>1){
      var ia=frameIndexAt(a0), ib=frameIndexAt(b0);
      var stepN=Math.max(1, Math.round((ib-ia)/14));
      for(var q=ia;q<=ib;q+=stepN) times.push(VID.frames[q]);
    } else {
      for(var tq=a0; tq<=b0; tq+=(b0-a0)/14) times.push(tq);
    }
  } else {
    var N=stroStepVal();                 /* 「時間間隔調整」で決めた、何コマおきか */
    var a=rangeStart(exp), b=(exp.rangeB!==null?exp.rangeB:VID.dur-1e-3);
    if(VID.frames.length>1){
      var i0=frameIndexAt(a), i1=frameIndexAt(b);
      for(var i=i0;i<=i1;i+=N) times.push(VID.frames[i]);
    } else { for(var t=a;t<=b;t+=N/(VID.fps||30)) times.push(t); }
  }
  if(!times.length){ toast('先に点を記録するか、範囲を決めてください'); return Promise.resolve(); }
  if(times.length>120) times=times.filter(function(_,i){ return i%Math.ceil(times.length/120)===0; });
  if(!preview){
    if(UI.stroBusy) return Promise.resolve();      /* 作っている最中は、もう1枚を始めない */
    UI.stroBusy=true;
    if(typeof stroBusyUI==='function') stroBusyUI(true);
  }
  cv.width=VID.w; cv.height=VID.h;
  var g=cv.getContext('2d',{willReadFrequently:true});
  g.fillStyle=(mode==='darken')?'#fff':'#000'; g.fillRect(0,0,cv.width,cv.height);
  var t0=performance.now(), extra=(mode==='diff'? Math.min(7,times.length) : 0);
  /* 進みぐあいと「あと何秒」（測った速さから見積もる） */
  function prog(done, total, label){
    $('stroInfo').textContent=label+' '+done+'/'+total;
    if(preview) return;
    var el=performance.now()-t0, per=(done>0)? el/done : 0;
    var left=per? Math.max(1, Math.ceil((total-done)*per/1000)) : null;
    if(typeof stroWaitUI==='function') stroWaitUI(left);
  }
  prog(0, times.length+extra, '作成中…');
  var savedT=VID.cur, k=0, bg=null;
  function finishStro(){
    if(!preview){
      UI.stroBusy=false;
      if(typeof stroBusyUI==='function') stroBusyUI(false);
    }
  }
  function next(){
    if(mode==='diff' && !bg){
      /* 何コマかの「まん中の値」で背景を作る（動いている物が消えた背景）。
         そこから変わった所だけを重ねるので、背景が明るくても暗くても使える。 */
      var samp=[], m=Math.min(7, times.length), j;
      for(j=0;j<m;j++) samp.push(times[Math.round(j*(times.length-1)/(m-1||1))]);
      var imgs=[], q=0;
      var grab=function(){
        if(q>=samp.length){
          bg=medianImage(imgs, cv.width, cv.height);
          g.putImageData(bg,0,0);
          return next();
        }
        return vidSeek(samp[q++]).then(function(){
          var f2=vidDrawFull();
          imgs.push(f2.getContext('2d',{willReadFrequently:true}).getImageData(0,0,cv.width,cv.height));
          prog(q, times.length+extra, '背景を作っています…');
          return grab();
        });
      };
      return grab();
    }
    if(k>=times.length){
      if(!preview){
        /* 点を描く前の絵を控えておく（「トラッキングした点も描く」を一瞬で切りかえるため） */
        var base=document.createElement('canvas');
        base.width=cv.width; base.height=cv.height;
        base.getContext('2d').drawImage(cv,0,0);
        UI.stroBase=base;
        if($('cbStroPts').checked) drawStrobePoints(g);
      }
      $('stroInfo').textContent=times.length+' コマを合成しました'+(preview?'（仮）':'');
      UI.stroReady=true; $('cvStrobe').classList.remove('hide');
      finishStro();
      if(typeof updateStroUI==='function') updateStroUI();
      if(preview){                       /* 動画に重ねる用に控えておく */
        var oc=document.createElement('canvas');
        oc.width=cv.width; oc.height=cv.height;
        oc.getContext('2d').drawImage(cv,0,0);
        UI.stroImg=oc;
      }
      return vidSeek(savedT).then(function(){ afterSeek(); });
    }
    return vidSeek(times[k]).then(function(){
      var full=vidDrawFull();
      if(mode==='diff'){
        var fg=full.getContext('2d',{willReadFrequently:true}).getImageData(0,0,cv.width,cv.height);
        var cur=g.getImageData(0,0,cv.width,cv.height);
        var a=fg.data, b0=bg.data, c=cur.data, TH=34*3;
        for(var i=0;i<a.length;i+=4){
          var d=Math.abs(a[i]-b0[i])+Math.abs(a[i+1]-b0[i+1])+Math.abs(a[i+2]-b0[i+2]);
          if(d>TH){ c[i]=a[i]; c[i+1]=a[i+1]; c[i+2]=a[i+2]; c[i+3]=255; }
        }
        g.putImageData(cur,0,0);
        k++; prog(k+extra, times.length+extra, '作成中…');
        return next();
      }
      g.save();
      if(mode==='lighten') g.globalCompositeOperation='lighten';
      else if(mode==='darken') g.globalCompositeOperation='darken';
      else { g.globalCompositeOperation='source-over'; g.globalAlpha=1/(k+1)*1.6; }
      g.drawImage(full,0,0);
      g.restore();
      k++; prog(k+extra, times.length+extra, '作成中…');
      return next();
    });
  }
  var pr;
  try{ pr=next(); }catch(e){ finishStro(); return Promise.resolve(); }
  return (pr && pr.catch)? pr.catch(function(){ finishStro(); }) : Promise.resolve(pr);
}
/* 何枚かの画像から、画素ごとの中央値をとる（動く物が消えた「背景」になる） */
function medianImage(imgs, w, h){
  var n=imgs.length, out=imgs[0];
  if(n<3) return out;
  var res=new ImageData(w,h), d=res.data, half=n>>1, vals=new Array(n);
  for(var i=0;i<d.length;i+=4){
    for(var c=0;c<3;c++){
      for(var k=0;k<n;k++) vals[k]=imgs[k].data[i+c];
      vals.sort(function(a,b){return a-b;});
      d[i+c]=vals[half];
    }
    d[i+3]=255;
  }
  return res;
}
/* 動画にストロボ写真を重ねる／やめる */
function setStrobeOverlay(on){
  UI.stroOverlay=!!on && !!UI.stroImg;
  var b=$('btnStroOver');
  if(b){ b.textContent = UI.stroOverlay? '写真を重ねない' : 'ストロボ写真を重ねる';
         b.classList.toggle('on', UI.stroOverlay); b.disabled=false; }
  if(VID.ready) render();
}
/* 「トラッキングした点も描く」の切りかえ：作り直さずに、控えておいた絵から描き直す */
function applyStroPts(){
  var cv=$('cvStrobe'); if(!UI.stroReady || !UI.stroBase || !cv) return false;
  var g=cv.getContext('2d',{willReadFrequently:true});
  g.clearRect(0,0,cv.width,cv.height);
  g.drawImage(UI.stroBase,0,0);
  if($('cbStroPts').checked) drawStrobePoints(g);
  return true;
}
function drawStrobePoints(g){
  var exp=EXP(), sc=VID.w/900;
  for(var ob=0;ob<1;ob++){                          /* ストロボ画像に描く点は物体1だけ（複数物体でも） */
    var pts=exp.objs[ob]; if(!pts.length) continue;
    g.save(); g.strokeStyle=OBJCOL[ob]; g.lineWidth=Math.max(1.5,2*sc); g.font='bold '+(13*sc)+'px '+FONT;
    g.fillStyle=OBJCOL[ob];
    pts.slice().sort(function(a,b){return a.t-b.t;}).forEach(function(p,i){
      var r=6*sc;
      g.beginPath(); g.moveTo(p.x-r,p.y); g.lineTo(p.x+r,p.y); g.moveTo(p.x,p.y-r); g.lineTo(p.x,p.y+r); g.stroke();
      if(i%2===0) g.fillText(String(i+1), p.x+r+2*sc, p.y-r);
    });
    g.restore();
  }
}
