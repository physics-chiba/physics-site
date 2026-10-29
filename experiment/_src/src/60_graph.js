/* =========================================================
   60_graph.js … グラフ描画エンジンとモード2・モード3の表示
   ========================================================= */
var GFONT='"Segoe UI","Helvetica Neue",Arial,"Yu Gothic UI","Hiragino Kaku Gothic ProN","Meiryo",sans-serif';
function niceStep(range, target){
  var raw=range/Math.max(1,target), p=Math.pow(10,Math.floor(Math.log10(raw))), n=raw/p;
  var s = n<1.5?1 : n<3?2 : n<7?5 : 10;
  return s*p;
}
/* ===== グラフの表示範囲（ドラッグで動かす・軸で拡大縮小する） =====
   GV.x は「横軸のキー」ごと（t 軸は 't' を共有）、GV.y は「グラフごと」に持つ */
var GV = { x:{}, y:{} };
/* クリックで選んだデータ点（key＝そのグラフ、xk＝横軸の種類、x,y＝値） */
var SEL = { key:null, xk:null, x:null, y:null, lab:'', d:null };
function gvReset(){ GV.x={}; GV.y={}; }
/* ===== スケールフィット =====
   いま出ているデータが、グラフの枠いっぱいに気持ちよく収まるように
   軸の最小・最大を「目盛りの切りのよい値」までひろげてそろえる。
   例）値が -0.05〜0.4 なら、縦軸は -0.1〜0.5 になる。 */
function fitSpecRange(spec){
  if(!spec) return false;
  /* 横軸（t）は動かさない。いま見えている横軸の範囲に入っている点だけを見て、
     縦軸の最小・最大と目盛りを合わせる（見たい時間のところを、ちょうどよい大きさで見せる） */
  var xk=spec.xkey||null;
  var lim=(xk && GV.x[xk])? GV.x[xk] : null;
  var ys=[];
  (spec.series||[]).forEach(function(s){
    (s.pts||[]).forEach(function(p){
      if(!isFinite(p.x)||!isFinite(p.y)) return;
      if(lim && (p.x<lim.a || p.x>lim.b)) return;   /* 見えていない所は数えない */
      ys.push(p.y);
    });
  });
  if(!ys.length) return false;
  var y0=Math.min.apply(null,ys), y1=Math.max.apply(null,ys);
  if(!(y1-y0>1e-12)){                              /* 見えているのが1点だけのとき */
    var hw=Math.max(Math.abs(y0)*0.1, 1e-6);
    y0-=hw; y1+=hw;
  }
  var m=(y1-y0)*0.05; y0-=m; y1+=m;               /* すこし余白をとってから */
  var st=niceStep(y1-y0, 5);                       /* 目盛りの切りのよい値へ */
  y0=Math.floor(y0/st)*st; y1=Math.ceil(y1/st)*st;
  if(!(y1-y0>1e-12)){ y0-=st; y1+=st; }
  if(!spec.key) return false;
  GV.y[spec.key]={a:y0, b:y1};
  return true;
}
/* いま画面に出ているグラフを、まとめてスケールフィットする */
function fitAllCharts(){
  var n=0;
  els('.chartcard canvas').forEach(function(cv){
    if(cv.__spec && fitSpecRange(cv.__spec)) n++;
  });
  if(!n){ toast('スケールを合わせるデータがありません'); return 0; }
  redrawAllCharts();
  toast(n+' 個のグラフのスケールを合わせました');
  return n;
}
function selClear(){ SEL={key:null, xk:null, x:null, y:null, lab:'', d:null}; }
/* 表示のたんい（位置は cm、速度は cm/s、加速度は cm/s²） */
function unitOf(lab){
  if(/\[m\]$/.test(lab)) return {k:100, u:'cm'};
  if(/\[m\/s\]$/.test(lab)) return {k:100, u:'cm/s'};
  if(/\[m\/s²\]$/.test(lab)) return {k:100, u:'cm/s²'};
  if(/\[s\]$/.test(lab)) return {k:1, u:'秒'};
  var m=/\[([^\]]+)\]/.exec(lab);
  return {k:1, u:m? m[1] : ''};
}
function labName(lab){ return String(lab).replace(/\s*\[[^\]]*\]\s*$/, ''); }
function fmtVal(v, lab){
  var u=unitOf(lab);
  return labName(lab)+' = '+(v*u.k).toFixed(2)+' '+u.u;
}
/* いま画面に出ているグラフを、DOM を作り直さずに描き直す */
/* きりのよい上限：v 以上で一番小さい 1・2・5×10ⁿ */
function niceCeil(v){
  if(!(v>0)) return 0;
  var p=Math.pow(10, Math.floor(Math.log(v)/Math.LN10)), m=v/p;
  var n=(m<=1+1e-9)? 1 : (m<=2+1e-9)? 2 : (m<=5+1e-9)? 5 : 10;
  return n*p;
}
/* 0 をふくむ、きりのよい縦軸の範囲 [a,b] */
function zeroRange(lo, hi){
  if(!isFinite(lo)||!isFinite(hi)) return [-1,1];
  if(lo>=0){ var b=niceCeil(hi); if(!(b>0)) b=1; return [0,b]; }
  if(hi<=0){ var a=niceCeil(-lo); if(!(a>0)) a=1; return [-a,0]; }
  return [-niceCeil(-lo), niceCeil(hi)];
}
function redrawAllCharts(){
  els('.chartcard').forEach(function(d){
    var cv=d.querySelector('canvas');
    if(cv && cv.__spec) drawChart(cv, cv.__spec, cv.__opt);
  });
  var cg=$('cgCanvas'); if(cg && cg.__spec) drawChart(cg, cg.__spec, cg.__opt);
}
/* spec = {title,xlab,ylab,series:[{name,color,pts,shape,line}],curves:[{color,f,x0,x1}],
          xkey,key,range:{a,b}} */
function drawChart(cv, spec, opt){
  opt=opt||{};
  var dpr=Math.max(2, Math.min(window.devicePixelRatio||1,3));   /* 文字をくっきり描く */
  /* 「動画と一緒に再生」の再生中だけは粗く描く（画素が 1/3 で軽い）。止まったら、きれいに描き直す */
  if(typeof LIVE!=='undefined' && LIVE.on && LIVE.playing) dpr=1.2;
  var W=opt.w||620, H=opt.h||390;
  /* 大きさが同じなら canvas を作り直さない（毎回 width を入れ直すとメモリを取り直して、
     「動画と一緒に再生」のように何度も描くときに、だんだん重くなる） */
  var W2=Math.round(W*dpr), H2=Math.round(H*dpr);
  if(cv.width!==W2 || cv.height!==H2){ cv.width=W2; cv.height=H2; }
  if(opt.fixed){ cv.style.width=W+'px'; cv.style.height=H+'px'; }
  else { cv.style.width='100%'; cv.style.height='auto'; }
  var g=cv.getContext('2d');
  g.setTransform(1,0,0,1,0,0); g.clearRect(0,0,W2,H2);
  g.save(); g.scale(dpr,dpr);
  g.fillStyle='#fff'; g.fillRect(0,0,W,H);
  var has2 = !!(spec.series2 && spec.series2.length && spec.series2.some(function(x){return x.pts.length;}));
  var L=64, R=(has2?66:12), T=(spec.title?26:(spec.range?20:10)), B=44;
  var pw=W-L-R, ph=H-T-B;
  /* 範囲 */
  var xs=[], ys=[], ys2=[];
  spec.series.forEach(function(s){ s.pts.forEach(function(p){ if(isFinite(p.x)&&isFinite(p.y)){xs.push(p.x); ys.push(p.y);} }); });
  if(has2) spec.series2.forEach(function(s){ s.pts.forEach(function(p){ if(isFinite(p.x)&&isFinite(p.y)){xs.push(p.x); ys2.push(p.y);} }); });
  cv.__spec=spec; cv.__opt=opt;
  if(!xs.length){ g.fillStyle='#8a95a1'; g.font='13px '+GFONT; g.textAlign='center';
    g.fillText('データがありません', W/2, H/2); cv.__geo=null; g.restore(); return; }
  var x0=Math.min.apply(null,xs), x1=Math.max.apply(null,xs);
  var y0=Math.min.apply(null,ys), y1=Math.max.apply(null,ys);
  if(x1-x0<1e-12){ x0-=0.5; x1+=0.5; }
  /* 縦軸のはじめの範囲は 0 をふくめ、上（下）はきりのよい数（1・2・5×10ⁿ）まで。
     4〜6 なら 0〜10、0.12〜0.35 なら 0〜0.5。データだけに寄せて拡大しない（拡大したいときはスケールフィット） */
  if(spec.equal){ if(y1-y0<1e-12){ y0-=0.5; y1+=0.5; } var my=(y1-y0)*0.08; y0-=my; y1+=my; }
  else { var zr=zeroRange(y0,y1); y0=zr[0]; y1=zr[1]; }
  var mx=(x1-x0)*0.03; x0-=mx; x1+=mx;
  /* ドラッグで動かした範囲があれば、それを使う */
  var xk=spec.xkey||null, yk=spec.key||null, moved=false;
  if(xk && GV.x[xk]){ x0=GV.x[xk].a; x1=GV.x[xk].b; moved=true; }
  if(yk && GV.y[yk]){ y0=GV.y[yk].a; y1=GV.y[yk].b; moved=true; }
  /* 縦横を同じ目盛りにする（x–y のように、両方の軸が同じ単位のとき） */
  if(spec.equal && !has2 && !moved){
    var kx=(x1-x0)/pw, ky=(y1-y0)/ph, k=Math.max(kx,ky);
    var cxm=(x0+x1)/2, cym=(y0+y1)/2;
    x0=cxm-k*pw/2; x1=cxm+k*pw/2;
    y0=cym-k*ph/2; y1=cym+k*ph/2;
  }
  if(y0<0&&y1>0){}
  var sx=function(v){ return L+(v-x0)/(x1-x0)*pw; };
  var sy=function(v){ return T+ph-(v-y0)/(y1-y0)*ph; };
  var z0=0, z1=1, sy2=sy;
  if(has2 && ys2.length){
    z0=Math.min.apply(null,ys2); z1=Math.max.apply(null,ys2);
    var zr2=zeroRange(z0,z1); z0=zr2[0]; z1=zr2[1];
    if(spec.sameY){            /* 2 つの縦軸を同じ目盛りに（運動量保存則など、同じ単位を比べるとき） */
      if(!moved){ y0=Math.min(y0,z0); y1=Math.max(y1,z1); sy=function(v){ return T+ph-(v-y0)/(y1-y0)*ph; }; }
      z0=y0; z1=y1;
    }
    sy2=function(v){ return T+ph-(v-z0)/(z1-z0)*ph; };
  }
  /* 目盛 */
  var stx=niceStep(x1-x0,6), sty=niceStep(y1-y0,5);
  g.strokeStyle='#e8ecf1'; g.lineWidth=1; g.fillStyle='#5b6672';
  g.font='11.5px '+GFONT; g.textAlign='center'; g.textBaseline='top';
  var t0=Math.ceil(x0/stx)*stx, i;
  for(i=t0;i<=x1+1e-9;i+=stx){
    var X=sx(i); g.beginPath(); g.moveTo(X,T); g.lineTo(X,T+ph); g.stroke();
    g.fillText(tickLbl(i,stx), X, T+ph+6);
  }
  g.textAlign='right'; g.textBaseline='middle';
  var u0=Math.ceil(y0/sty)*sty;
  for(i=u0;i<=y1+1e-9;i+=sty){
    var Y=sy(i); g.beginPath(); g.moveTo(L,Y); g.lineTo(L+pw,Y); g.stroke();
    g.fillText(tickLbl(i,sty), L-6, Y);
  }
  /* 0 の線 */
  g.strokeStyle='#b6c0cb'; g.lineWidth=1.2;
  if(y0<0&&y1>0){ g.beginPath(); g.moveTo(L,sy(0)); g.lineTo(L+pw,sy(0)); g.stroke(); }
  if(x0<0&&x1>0){ g.beginPath(); g.moveTo(sx(0),T); g.lineTo(sx(0),T+ph); g.stroke(); }
  /* 右の縦軸（2軸モード） */
  if(has2 && ys2.length){
    var col2=(spec.series2[0].color||'#e8443a');
    var st2=niceStep(z1-z0,5), w0=Math.ceil(z0/st2)*st2;
    g.fillStyle=col2; g.textAlign='left'; g.textBaseline='middle'; g.font='11.5px '+GFONT;
    for(i=w0;i<=z1+1e-9;i+=st2){
      var Y2=sy2(i);
      g.strokeStyle=col2; g.globalAlpha=.35; g.lineWidth=1;
      g.beginPath(); g.moveTo(L+pw,Y2); g.lineTo(L+pw+5,Y2); g.stroke(); g.globalAlpha=1;
      g.fillText(tickLbl(i,st2), L+pw+8, Y2);
    }
    g.save(); g.translate(W-12, T+ph/2); g.rotate(Math.PI/2);
    g.textAlign='center'; g.font='12.5px '+GFONT; g.fillStyle=col2;
    g.fillText(spec.ylab2||'', 0,0); g.restore();
  }
  /* フィッティングする範囲（③解析）の帯とつまみ */
  if(spec.range){
    var ra=Math.max(L, Math.min(L+pw, sx(spec.range.a)));
    var rb=Math.max(L, Math.min(L+pw, sx(spec.range.b)));
    g.save();
    g.fillStyle='rgba(22,99,181,.10)'; g.fillRect(ra, T, rb-ra, ph);
    g.strokeStyle='#1663b5'; g.lineWidth=2;
    [ra,rb].forEach(function(X){
      g.beginPath(); g.moveTo(X,T); g.lineTo(X,T+ph); g.stroke();
      g.fillStyle='#1663b5';
      g.fillRect(X-4, T+ph/2-13, 8, 26);
    });
    g.restore();
  }
  /* 枠 */
  g.strokeStyle='#8d99a6'; g.lineWidth=1.2; g.strokeRect(L,T,pw,ph);
  /* ここから先は枠の中だけに描く（ドラッグで外に出た点は表示しない） */
  g.save(); g.beginPath(); g.rect(L,T,pw,ph); g.clip();
  /* 曲線（フィッティング） */
  (spec.curves||[]).forEach(function(c){
    g.save(); g.strokeStyle=c.color; g.lineWidth=2; g.setLineDash(c.dash||[]);
    g.beginPath();
    var n=180, first=true;
    for(var k=0;k<=n;k++){
      var xv=c.x0+(c.x1-c.x0)*k/n, yv=c.f(xv);
      if(!isFinite(yv)) { first=true; continue; }
      var X=sx(xv), Y=sy(yv);
      if(Y<T-500||Y>T+ph+500){ first=true; continue; }
      if(first){ g.moveTo(X,Y); first=false; } else g.lineTo(X,Y);
    }
    g.stroke(); g.restore();
  });
  /* データ（「動画と一緒に再生」のときは、いまの時刻までの点だけを描く） */
  var lmax=(LIVE.on && spec.xkey==='t')? LIVE.t : null;
  function vis(p){ return lmax===null || p.x<=lmax+1e-9; }
  var allSer=spec.series.concat(has2? spec.series2 : []);
  var hit=[];                                   /* クリックで選べる点（画面座標） */
  allSer.forEach(function(s, si){
    var Y = (has2 && si>=spec.series.length)? sy2 : sy;
    s.pts.forEach(function(p){ if(isFinite(p.y)&&vis(p)) hit.push({X:sx(p.x), Y:Y(p.y), x:p.x, y:p.y, si:si}); });
    g.save();
    if(s.line!==false){
      g.strokeStyle=s.color; g.globalAlpha=.5; g.lineWidth=1.4; g.beginPath();
      var st=true;
      s.pts.forEach(function(p){ if(!isFinite(p.y)||!vis(p)){st=true;return;} var X=sx(p.x), yy=Y(p.y);
        if(st){g.moveTo(X,yy); st=false;} else g.lineTo(X,yy); });
      g.stroke(); g.globalAlpha=1;
    }
    g.fillStyle=s.color; g.strokeStyle=s.color; g.lineWidth=1.6;
    s.pts.forEach(function(p){
      if(!isFinite(p.y) || !vis(p)) return;
      var X=sx(p.x), yy=Y(p.y), r=3.1;
      if(s.shape==='sq'){ g.fillRect(X-r,yy-r,2*r,2*r); }
      else if(s.shape==='tri'){ g.beginPath(); g.moveTo(X,yy-r-1); g.lineTo(X+r+1,yy+r); g.lineTo(X-r-1,yy+r); g.closePath(); g.fill(); }
      else if(s.shape==='open'){ g.beginPath(); g.arc(X,yy,r,0,7); g.stroke(); }
      else { g.beginPath(); g.arc(X,yy,r,0,7); g.fill(); }
    });
    g.restore();
  });
  /* 選んだ点：点線を軸まで下ろす／同じ t のところに薄い縦線 */
  var selHere = (yk && SEL.key===yk && SEL.x!==null);
  if(xk && SEL.xk===xk && SEL.x!==null && !selHere){
    var XS=sx(SEL.x);
    if(XS>=L && XS<=L+pw){                      /* ほかのグラフにも同じ時刻の線 */
      g.save(); g.strokeStyle='rgba(22,99,181,.45)'; g.lineWidth=1.4; g.setLineDash([5,4]);
      g.beginPath(); g.moveTo(XS,T); g.lineTo(XS,T+ph); g.stroke(); g.restore();
    }
  }
  if(selHere){
    var XP=sx(SEL.x), YP=sy(SEL.y);
    g.save();
    g.strokeStyle='rgba(22,99,181,.75)'; g.lineWidth=1.4; g.setLineDash([5,4]);
    g.beginPath(); g.moveTo(XP,T); g.lineTo(XP,T+ph); g.stroke();               /* 縦（t軸へ） */
    g.beginPath(); g.moveTo(L,YP); g.lineTo(L+pw,YP); g.stroke();               /* 横（縦軸へ） */
    g.setLineDash([]);
    g.strokeStyle='#0f4c8f'; g.lineWidth=2.4;
    g.beginPath(); g.arc(XP,YP,7,0,7); g.stroke();
    g.restore();
  }
  g.restore();                       /* 枠の中だけに描くのはここまで */
  if(selHere){                       /* 点のわきに座標（枠の外にはみ出しても読めるように） */
    var XP2=sx(SEL.x), YP2=sy(SEL.y);
    var txt='('+fmtVal(SEL.x, spec.xlab)+', '+fmtVal(SEL.y, spec.ylab)+')';
    g.save(); g.font='bold 11.5px '+GFONT; g.textBaseline='middle';
    var tw=g.measureText(txt).width+10;
    var bx=Math.min(L+pw-tw, Math.max(L, XP2+10)), by=Math.max(T+10, YP2-14);
    g.fillStyle='rgba(255,255,255,.92)'; g.fillRect(bx-4, by-9, tw, 18);
    g.strokeStyle='#1663b5'; g.lineWidth=1; g.strokeRect(bx-4, by-9, tw, 18);
    g.fillStyle='#0f4c8f'; g.textAlign='left'; g.fillText(txt, bx, by);
    g.restore();
  }
  /* フィッティングする範囲の見出し（③解析） */
  if(spec.range){
    var qa=Math.max(L, Math.min(L+pw, sx(spec.range.a)));
    var qb=Math.max(L, Math.min(L+pw, sx(spec.range.b)));
    var cxr=(qa+qb)/2;
    g.save();
    g.fillStyle='#1663b5'; g.font='bold 12px '+GFONT; g.textAlign='center'; g.textBaseline='bottom';
    g.fillText('←　数式をフィッティングするエリア　→', Math.max(L+80, Math.min(L+pw-80, cxr)), T-1);
    g.restore();
  }
  /* ラベル */
  g.fillStyle='#1b1f24'; g.textAlign='center'; g.textBaseline='alphabetic';
  g.font='12.5px '+GFONT;
  g.fillText(spec.xlab||'', L+pw/2, H-8);
  g.save(); g.translate(14, T+ph/2); g.rotate(-Math.PI/2); g.textAlign='center';
  g.fillText(spec.ylab||'', 0,0); g.restore();
  if(spec.title){ g.font='bold 13px '+GFONT; g.fillStyle='#0f4c8f'; g.textAlign='left';
    g.fillText(spec.title, L-46, 17); }
  /* 凡例 */
  if(spec.series.length>1||opt.legend){
    var lx=L+8, ly=T+12;
    g.font='11.5px '+GFONT; g.textAlign='left'; g.textBaseline='middle';
    allSer.forEach(function(s){
      g.fillStyle=s.color; g.fillRect(lx,ly-5,10,10);
      g.fillStyle='#39434e'; g.fillText(s.name, lx+15, ly);
      var w=g.measureText(s.name).width+34;
      lx+=w; if(lx>L+pw-60){ lx=L+8; ly+=15; }
    });
  }
  cv.__geo={L:L,T:T,pw:pw,ph:ph,W:W,H:H,x0:x0,x1:x1,y0:y0,y1:y1,xk:xk,yk:yk,range:spec.range||null,hit:hit};
  cv.__spec=spec; cv.__opt=opt;
  g.restore();
  return {sx:sx, sy:sy, x0:x0, x1:x1};
}
/* グラフをドラッグで動かす／軸をドラッグして目盛りを変える */
function bindChartDrag(cv, onRange){
  if(cv.__dragBound) return; cv.__dragBound=true;
  cv.style.touchAction='none';
  var st=null;
  function pos(e){
    var g=cv.__geo, r=cv.getBoundingClientRect();
    var k=(g.W||r.width)/(r.width||1);
    return { x:(e.clientX-r.left)*k, y:(e.clientY-r.top)*k };
  }
  cv.addEventListener('pointerdown', function(e){
    var g=cv.__geo; if(!g) return;
    var q=pos(e), mode;
    /* データ点の上で押したら、その点を「クリックの候補」にしておく（動かさなければ選ぶ） */
    var cand=null;
    if(q.x>=g.L && q.x<=g.L+g.pw && q.y>=g.T && q.y<=g.T+g.ph && g.hit){
      var bd=1e9;
      g.hit.forEach(function(h){
        var d=Math.hypot(h.X-q.x, h.Y-q.y);
        if(d<bd){ bd=d; cand=h; }
      });
      if(bd>12) cand=null;
      var inPlot=true, bdist=bd;
    }
    if(g.range){                                   /* フィッティング範囲のつまみが近いか */
      /* つまみは枠の中に収めて描いているので、つかむ判定も同じ場所で見る
         （端まで動かしたあとも、つまんで戻せるようにするため） */
      var sxf=function(v){ return Math.max(g.L, Math.min(g.L+g.pw, g.L+(v-g.x0)/(g.x1-g.x0)*g.pw)); };
      var da=Math.abs(q.x-sxf(g.range.a)), db=Math.abs(q.x-sxf(g.range.b));
      if(Math.min(da,db)<12) mode=(da<=db)? 'ra' : 'rb';
    }
    if(!mode){
      if(q.x<g.L) mode='zoomY';
      else if(q.y>g.T+g.ph) mode='zoomX';
      else mode='pan';
    }
    var clp=function(v){ return Math.max(g.x0, Math.min(g.x1, v)); };
    st={ mode:mode, x:q.x, y:q.y, x0:g.x0, x1:g.x1, y0:g.y0, y1:g.y1,
         ra:g.range?clp(g.range.a):0, rb:g.range?clp(g.range.b):0, cand:cand, far:false,
         inPlot:!!inPlot, bd:(typeof bdist==='number'? bdist : 1e9) };
    try{ cv.setPointerCapture(e.pointerId); }catch(err){}
    e.preventDefault();
  });
  cv.addEventListener('pointermove', function(e){
    if(!st) return;
    var g=cv.__geo, q=pos(e), dx=q.x-st.x, dy=q.y-st.y;
    if(Math.abs(dx)>4 || Math.abs(dy)>4) st.far=true;
    var spanX=st.x1-st.x0, spanY=st.y1-st.y0;
    if(st.mode==='pan'){
      /* 左右だけでなく、上下にも動かせる */
      if(g.xk){ var d=-dx*spanX/g.pw; GV.x[g.xk]={a:st.x0+d, b:st.x1+d}; }
      if(g.yk){ var dv=dy*spanY/g.ph; GV.y[g.yk]={a:st.y0+dv, b:st.y1+dv}; }
      if(!g.xk && !g.yk) return;
    } else if(st.mode==='zoomX'){
      if(!g.xk) return;
      var f=Math.exp(-dx/220), c=(st.x0+st.x1)/2;
      GV.x[g.xk]={a:c-spanX*f/2, b:c+spanX*f/2};
    } else if(st.mode==='zoomY'){
      if(!g.yk) return;
      var f2=Math.exp(dy/220), c2=(st.y0+st.y1)/2;
      GV.y[g.yk]={a:c2-spanY*f2/2, b:c2+spanY*f2/2};
    } else {                                        /* フィッティング範囲のつまみ */
      var v=st[st.mode==='ra'?'ra':'rb'] + dx*spanX/g.pw;
      if(onRange) onRange(st.mode==='ra'?'a':'b', v);
      return;
    }
    redrawAllCharts();
  });
  function up(e){
    if(!st) return;
    if(!st.far && st.cand){                      /* 動かさずに離した＝クリック → 点を選ぶ */
      var h=st.cand, g=cv.__geo;
      if(SEL.key===g.yk && SEL.x===h.x && SEL.y===h.y) selClear();   /* もう一度押すと消える */
      else SEL={ key:g.yk, xk:g.xk, x:h.x, y:h.y, lab:'', d:null };
      redrawAllCharts(); updateReadouts();
    } else if(!st.far && st.inPlot && st.mode==='pan' && SEL.x!==null && st.bd>40){
      /* 点からうんと離れた所をクリック → 選んでいた点を外す */
      selClear(); redrawAllCharts(); updateReadouts();
    } else if(!st.far && (st.mode==='zoomY' || st.mode==='zoomX')){
      /* 軸の目盛りをクリック（動かさない）→ 範囲を数で決めるポップアップ */
      if(typeof axisRangePopup==='function') axisRangePopup(cv, st.mode==='zoomY'? 'y' : 'x');
    }
    st=null; try{ cv.releasePointerCapture(e.pointerId); }catch(err){}
  }
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
}
function tickLbl(v, step){
  if(Math.abs(v)<step*1e-6) v=0;
  var a=Math.abs(v);
  if(a!==0&&(a>=1e5||a<1e-3)) return v.toExponential(1);
  var d=Math.max(0, -Math.floor(Math.log10(step))+ (step<1?0:0));
  d=Math.min(6,Math.max(0,d));
  return v.toFixed(d);
}

/* ---------- 系列づくり ---------- */
var QDEF = {
  x:{lab:'x [m]', get:function(p){return p.x;}},
  y:{lab:'y [m]', get:function(p){return p.y;}},
  vx:{lab:'vx [m/s]', get:function(p){return p.vx;}},
  vy:{lab:'vy [m/s]', get:function(p){return p.vy;}},
  ax:{lab:'ax [m/s²]', get:function(p){return p.ax;}},
  ay:{lab:'ay [m/s²]', get:function(p){return p.ay;}}
};
function expHasObj(exp, ob){ return exp.objs[ob] && exp.objs[ob].length>0; }
function seriesFor(exp, kind, expIdx, overlay, onlyX, onlyObj){     /* onlyX：v・a で y 成分（vy・ay）を混ぜない（レポートの左の列用）　onlyObj：その物体だけ */
  var out=[], shapes=['dot','sq','tri'];
  for(var ob=0; ob<NOBJ; ob++){
    if(!expHasObj(exp,ob)) continue;
    if(onlyObj!==undefined && onlyObj!==null && ob!==onlyObj) continue;
    var s=series(exp,ob);
    var base = overlay? EXPCOL[expIdx%EXPCOL.length] : OBJCOL[ob];
    var nm=(overlay? exp.name+' ' : '')+
      (APP.twoObj? ('物体'+(ob+1)+(exp.objName[ob]?'('+exp.objName[ob]+')':''))
                 : (exp.objName[ob]||'物体'));
    if(kind==='x'||kind==='y'){
      out.push({name:nm, color:base, shape:shapes[ob], pts:s.map(function(p){return {x:p.t,y:(kind==='x'?p.x:p.y)};})});
    } else if(kind==='v'){
      out.push({name:nm+' vx', color:base, shape:shapes[ob],
        pts:s.filter(function(p){return p.vx!==null;}).map(function(p){return {x:p.t,y:p.vx};})});
      /* 「軸の表示：x軸」にしたら、y 方向はどこにも出さない（レポートにも出さない） */
      if(useY() && !onlyX) out.push({name:nm+' vy', color:shade(base,0.45), shape:'open',
        pts:s.filter(function(p){return p.vy!==null;}).map(function(p){return {x:p.t,y:p.vy};})});
    } else if(kind==='a'){
      out.push({name:nm+' ax', color:base, shape:shapes[ob],
        pts: APP.aFit? aByFit(s,'vx')
           : s.filter(function(p){return p.ax!==null;}).map(function(p){return {x:p.t,y:p.ax};})});
      if(useY() && !onlyX) out.push({name:nm+' ay', color:shade(base,0.45), shape:'open',
        pts: APP.aFit? aByFit(s,'vy')
           : s.filter(function(p){return p.ay!==null;}).map(function(p){return {x:p.t,y:p.ay};})});
    } else if(kind==='e'){
      var en=energy(exp,ob,s);
      out.push({name:nm+' 運動K', color:base, shape:'dot',
        pts:en.filter(function(p){return p.K!==null;}).map(function(p){return {x:p.t,y:p.K};})});
      out.push({name:nm+' 位置U', color:shade(base,0.5), shape:'open',
        pts:en.map(function(p){return {x:p.t,y:p.U};})});
      out.push({name:nm+' 和K+U', color:shade(base,-0.35), shape:'sq',
        pts:en.filter(function(p){return p.E!==null;}).map(function(p){return {x:p.t,y:p.E};})});
    }
  }
  return out;
}
function shade(hex, f){
  var c=hex.replace('#',''), r=parseInt(c.substr(0,2),16), g=parseInt(c.substr(2,2),16), b=parseInt(c.substr(4,2),16);
  function m(v){ return Math.max(0,Math.min(255, Math.round(f>0? v+(255-v)*f : v*(1+f)))); }
  return 'rgb('+m(r)+','+m(g)+','+m(b)+')';
}
var KINDLAB={x:'x–t',y:'y–t',v:'v–t',a:'a–t',e:'エネルギー'};
var KINDY={x:'x [m]',y:'y [m]',v:'v [m/s]',a:'a [m/s²]',e:'エネルギー [J]'};

function selectedExps(listId, noFallback){
  var ids=[];
  els('#'+listId+' input:checked').forEach(function(c){ ids.push(parseInt(c.dataset.i)); });
  if(!ids.length && !noFallback) ids=[APP.cur];
  return ids;
}
/* 実験（複数可）・物体・量 を指定して 1 枚ぶんのグラフ仕様をつくる */
function specOne(ids, obj, q){
  var ser=[], many=(ids.length>1);
  var isA=(q==='ax'||q==='ay');
  ids.forEach(function(i){
    var e=APP.exps[i]; if(!e || !e.objs[obj] || !e.objs[obj].length) return;
    var s=series(e,obj), pts=[], isV=(q==='vx'||q==='vy');
    if(isA && APP.aFit){
      pts=aByFit(s, q==='ax'?'vx':'vy');            /* v–t の傾きから出す */
    } else
    s.forEach(function(p){
      var v=p[q], tx=isV? p.tv : p.t;
      if(v!==null&&v!==undefined&&isFinite(v)&&tx!==null) pts.push({x:tx,y:v});
    });
    ser.push({ name:(many? e.name : q), color: many? EXPCOL[i%EXPCOL.length] : OBJCOL[obj],
               shape:'dot', pts:pts });
  });
  return { title:'', xlab:'t [s]', ylab:(CGQ[q]?CGQ[q].lab:q), series:ser,
           xkey:'t', key:'q'+q+'_o'+obj+'_'+ids.join('-') };
}
function specEnergy(ids, obj){
  var ser=[], many=(ids.length>1);
  ids.forEach(function(i){
    var e=APP.exps[i]; if(!e || !e.objs[obj] || !e.objs[obj].length) return;
    var s=series(e,obj), en=energy(e,obj,s);
    var base = many? EXPCOL[i%EXPCOL.length] : OBJCOL[obj];
    ser.push({name:(many?e.name+' ':'')+'運動K', color:base, shape:'dot',
      pts:en.filter(function(p){return p.K!==null;}).map(function(p){return {x:p.t,y:p.K};})});
    ser.push({name:(many?e.name+' ':'')+'位置U', color:shade(base,0.5), shape:'open',
      pts:en.map(function(p){return {x:p.t,y:p.U};})});
    ser.push({name:(many?e.name+' ':'')+'K+U', color:shade(base,-0.35), shape:'sq',
      pts:en.filter(function(p){return p.E!==null;}).map(function(p){return {x:p.t,y:p.E};})});
  });
  return { title:'', xlab:'t [s]', ylab:'エネルギー [J]', series:ser,
           xkey:'t', key:'E_o'+obj+'_'+ids.join('-') };
}
/* 重心の運動量のグラフ：物体ごとの p = m v（細い）と、全体 Σ m v（太い黒）。横軸は v の時刻 tv */
function specMomentum(expIdx, comp){
  var e=APP.exps[expIdx], ms=momentumSeries(e, comp), ser=[];
  ms.objs.forEach(function(o,i){
    ser.push({ name:'物体'+(o+1)+(e.objName[o]?'（'+e.objName[o]+'）':'')+' p'+comp, color:OBJCOL[o], shape:'open', pts:ms.per[i] });
  });
  ser.push({ name:'重心（全体） Σ m v'+comp, color:'#1b1f24', shape:'sq', pts:ms.sum });
  return { title:'', xlab:'t [s]', ylab:'p'+comp+' [kg·m/s]', series:ser, xkey:'t', key:'P'+comp+'_'+expIdx };
}
function objTitle(e, obj){
  if(!APP.twoObj) return (e&&e.objName[obj])? '（'+e.objName[obj]+'）' : '';
  return '物体'+(obj+1)+(e&&e.objName[obj]?'（'+e.objName[obj]+'）':'');
}

/* ②のグラフの上の一言：点の選択／ドラッグ／目盛り（［座標の選択を解除する］は点を選んでいるときだけ） */
function gTips(){
  var sp=document.createElement('span'); sp.className='gtips';
  sp.innerHTML='<span>データ点はクリックで座標を選択可。グラフはドラッグで移動、縦軸・横軸の目盛りはドラッグで拡大縮小、縦軸はクリックで範囲を指定できます。</span>'+
    '<span style="flex-basis:100%;height:0"></span>'+
    '<span>スケールフィットは表示範囲の縦軸の目盛りを最大化します。</span>';
  return sp;                             /* ［座標の選択を解除する］は上のメニュー（x・vx・ax の右）にある */
}
function renderMode2(){
  if(typeof updateEnergyBtn==='function') updateEnergyBtn();
  var host=$('charts2');
  var cgc=$('cgCard');
  if(cgc && host.contains(cgc)) $('cgHost2').appendChild(cgc);   /* 消される前に避難させる */
  host.innerHTML='';
  /* 「対象の実験」でチェックした実験を重ねる（実験が 1 つなら、その実験）。
     チェックが 1 つも無いときはグラフを出さない。「表示：並べて／重ねて」の切りかえはやめた */
  var manyExp=(APP.exps.length>1);
  var ids=manyExp? selectedExps('expChecks', true) : [APP.cur];
  var over=(ids.length>1);
  $('cmpBox').classList.toggle('hide', !manyExp);
  if($('expBox2')) $('expBox2').classList.toggle('hide', !manyExp);
  if(!ids.length){
    host.innerHTML='<div class="card mini">対象の実験にチェックが入っていません。上の「対象の実験」で、グラフにしたい実験にチェックを入れてください。</div>';
    if(cgc){ $('cgHost2').appendChild(cgc); cgc.classList.remove('hide'); renderCG(); }
    return;
  }
  /* x の組は、y のデータがあるときだけ OFF にできる（無いときは常に ON） */
  var hasY=useY();
  $('cbG_x').disabled=!hasY;
  if(!hasY) $('cbG_x').checked=true;
  var showX=$('cbG_x').checked, showY=$('cbG_y').checked && hasY, showE=$('cbG_e').checked && APP.energyOn;
  if(!showX && !showY) showX=true;                 /* どちらも消えてしまわないように */
  /* 「動画と一緒に再生」のときは、右に大きな動画を置くぶんグラフを小さくする。
     y のグラフが無いときは、x のグラフと動画がとなりに並ぶ大きさにする */
  var live=LIVE.on;
  var w=APP.gsize;
  var h=Math.round(w*0.62);
  var blocks=[], o, i;
  var objSel=selectedObjs();
  if(over){
    for(o=0;o<NOBJ;o++){
      if(objSel.indexOf(o)<0) continue;
      var any=ids.some(function(i2){ var e=APP.exps[i2]; return e&&e.objs[o]&&e.objs[o].length; });
      if(any) blocks.push({ label:(objTitle(APP.exps[ids[0]],o)||'')+'（重ねて表示）', ids:ids, obj:o });
    }
  } else {
    ids.forEach(function(i2){
      var e=APP.exps[i2]; if(!e) return;
      var have=[];
      for(var o2=0;o2<NOBJ;o2++){
        if(objSel.indexOf(o2)<0) continue;
        if(e.objs[o2] && e.objs[o2].length) have.push(o2);
      }
      /* x 軸だけで物体が 2 つ以上：1 物体の x・y のように、物体 1 の x の列・物体 2 の x の列 を横にならべる */
      if(!hasY && have.length>1) blocks.push({ label:e.name, ids:[i2], obj:have[0], objs:have });
      else have.forEach(function(o2){ blocks.push({ label:(e.name+'　'+objTitle(e,o2)).replace(/\s+$/,''), ids:[i2], obj:o2 }); });
    });
  }
  /* 「動画と一緒に再生」のときは、右に大きな動画を置くぶんグラフを小さくする（2 列のときはさらに小さく） */
  var twoCols=(showX&&showY) || blocks.some(function(b){ return b.objs && b.objs.length>1; });
  if(live){ w=Math.round(APP.gsize*(twoCols?0.52:0.72)); h=Math.round(w*0.62); }
  if(!blocks.length){
    host.innerHTML='<div class="card mini">グラフに出せるデータがありません。①でいくつか点を記録してください。</div>';
    if(cgc){ $('cgHost2').appendChild(cgc); cgc.classList.remove('hide'); renderCG(); }
    return;
  }
  var cgBelow=false;
  blocks.forEach(function(b, bi){
    var blk=document.createElement('div'); blk.className='gblock';
    var t=document.createElement('h3'); t.textContent=b.label; blk.appendChild(t);
    if(bi===0 && !LIVE.on) t.appendChild(gTips());   /* 「動画と一緒に再生」では場所が無いので出さない */
    var wrap=document.createElement('div'); wrap.className='gwrap';
    var colNodes=[];
    function addCol(qs, withE, obj, head){
      var col=document.createElement('div'); col.className='gcol';
      if(head){ var hd=document.createElement('div'); hd.className='colhead'; hd.textContent=head; col.appendChild(hd); }
      qs.forEach(function(q){
        col.appendChild(chartCard((q==='x'?'x–t':q==='vx'?'vx–t':q==='ax'?'ax–t':
                                   q==='y'?'y–t':q==='vy'?'vy–t':'ay–t'),
                                  specOne(b.ids,obj,q), null, w, h));
      });
      if(withE) col.appendChild(chartCard('エネルギー–t（'+gDirInfo(APP.exps[b.ids[0]]||EXP()).h+'）', specEnergy(b.ids,obj), null, w, h));
      wrap.appendChild(col); colNodes.push(col); return col;
    }
    if(b.objs){                        /* x 軸だけ・複数物体：物体ごとの x の列を横に */
      b.objs.forEach(function(o3){ addCol(['x','vx','ax'], showE, o3, objTitle(APP.exps[b.ids[0]], o3)); });
    } else {
      if(showX) addCol(['x','vx','ax'], showE, b.obj);
      if(showY) addCol(['y','vy','ay'], showE&&!showX, b.obj);
    }
    /* 自由選択グラフは、最初のブロック（物体1）だけに置く。
       「動画と一緒に再生」のときは、グラフの下（cgHost2）に移す */
    /* 自由選択グラフは、グラフのならびの「下」に置く。
       横にならべると場所が足りず、グラフが小さくなってしまうため。 */
    if(bi===0 && cgc && !live){ cgc.classList.remove('hide'); cgBelow=true; }
    wrap.style.gridTemplateColumns=colNodes.map(function(){return 'max-content';}).join(' ');
    blk.appendChild(wrap); host.appendChild(blk);
  });
  /* 「重心の運動量」：物体ごとの運動量 p = m v と、その和（＝重心の運動量）を 1 枚に。x 成分（y があれば y 成分も） */
  if(typeof momOn==='function' && momOn() && !over){
    ids.forEach(function(i2){
      var e=APP.exps[i2]; if(!e) return;
      var ms=momentumSeries(e,'x'); if(ms.objs.length<2) return;
      var blk=document.createElement('div'); blk.className='gblock';
      var t=document.createElement('h3'); t.textContent=(e.name+'　重心の運動量（全体 Σ m v）').replace(/\s+$/,'');
      var tip=document.createElement('span'); tip.className='mini'; tip.style.fontWeight='400'; tip.style.marginLeft='8px';
      tip.textContent='物体ごとの p = m v と、その和（＝重心の運動量）。和は、すべての物体のデータがある時刻だけ出ます。';
      t.appendChild(tip); blk.appendChild(t);
      var wrap=document.createElement('div'); wrap.className='gwrap';
      var col=document.createElement('div'); col.className='gcol';
      col.appendChild(chartCard('px–t', specMomentum(i2,'x'), null, w, h));
      if(showY) col.appendChild(chartCard('py–t', specMomentum(i2,'y'), null, w, h));
      wrap.appendChild(col); wrap.style.gridTemplateColumns='max-content';
      blk.appendChild(wrap); host.appendChild(blk);
    });
  }
  /* 「動画と一緒に再生」のときは、自由選択グラフは②ぜんぶの下に置く
     （グラフの列が広がって、動画とのあいだにすき間ができないように） */
  if(live && cgc){ $('cgHostLive').appendChild(cgc); cgc.classList.remove('hide'); }
  else if(cgBelow && cgc){ $('cgHost2').appendChild(cgc); cgc.classList.remove('hide'); }
  if(cgc && cgc.parentNode) renderCG();
  if(live) setTimeout(alignLive, 30);
}
var EXPAND_ICON='<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">'+
  '<g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">'+
  '<path d="M10 4H4v6"/><path d="M4 4l7 7"/><path d="M14 4h6v6"/><path d="M20 4l-7 7"/>'+
  '<path d="M10 20H4v-6"/><path d="M4 20l7-7"/><path d="M14 20h6v-6"/><path d="M20 20l-7-7"/></g></svg>';
/* スケールフィットのアイコン（枠の中に点が収まる様子） */
var FIT_ICON='<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">'+
  '<g fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">'+
  '<rect x="3" y="4" width="18" height="16" rx="2"/>'+
  '<path d="M7 16l3.5-4 3 2.5L17 8"/></g></svg>';
/* 選んだ点の値を、グラフの上（最大化ボタンの左）に出す */
function readoutHtml(spec){
  if(SEL.x===null || SEL.key!==spec.key) return '';
  var s1='（'+esc(fmtVal(SEL.x, spec.xlab))+'、'+esc(fmtVal(SEL.y, spec.ylab))+'）';
  var d=derivAt(spec, SEL.x);
  if(d!==null && spec.__dydt){
    var dl=dydtLabel(spec.ylab), du=unitOf(spec.ylab), un=du.u+'/s';
    s1+='　<b>'+esc(dl)+' = '+(d*du.k).toFixed(2)+' '+esc(un)+'</b>';
  }
  return s1;
}
function dydtLabel(ylab){ return 'd'+labName(ylab)+'/dt'; }
/* 選んだ x のところでの傾き（前後の点から中央差分） */
function derivAt(spec, xv){
  var ps=(spec.series[0]||{}).pts||[];
  var arr=ps.filter(function(p){ return isFinite(p.x)&&isFinite(p.y); })
            .sort(function(a,b){ return a.x-b.x; });
  var i=-1, k;
  for(k=0;k<arr.length;k++) if(Math.abs(arr[k].x-xv)<1e-9){ i=k; break; }
  if(i<0) return null;
  if(i>0 && i<arr.length-1){
    var dt=arr[i+1].x-arr[i-1].x;
    return dt!==0? (arr[i+1].y-arr[i-1].y)/dt : null;
  }
  if(arr.length>1){
    var j=(i===0)? 1 : arr.length-2, d2=arr[i].x-arr[j].x;
    return d2!==0? (arr[i].y-arr[j].y)/d2 : null;
  }
  return null;
}
function chartCard(title, spec, curves, w, h){
  var d=document.createElement('div'); d.className='chartcard';
  var t=document.createElement('div'); t.className='ttl';
  var nm=document.createElement('span'); nm.textContent=title; t.appendChild(nm);
  var ro=document.createElement('span'); ro.className='readout'; t.appendChild(ro);
  d.appendChild(t);
  var cv=document.createElement('canvas'); d.appendChild(cv);
  spec.curves=curves||spec.curves;
  w=w||APP.gsize; h=h||Math.round(w*0.62);
  drawChart(cv, spec, {legend:true, w:w, h:h, fixed:true});
  bindChartDrag(cv, spec.onRange);
  /* d○/dt を表示するチェック（グラフごと。はじめは OFF）
     残差のグラフでは意味がないので出さない */
  if(!spec.__noDydt){
    var lab=document.createElement('label'); lab.className='cb dydt';
    var cb=document.createElement('input'); cb.type='checkbox'; cb.checked=!!spec.__dydt;
    cb.onchange=function(){ spec.__dydt=cb.checked; updateReadouts(); };
    lab.appendChild(cb);
    lab.appendChild(document.createTextNode(dydtLabel(spec.ylab)+' を表示'));
    d.appendChild(lab);
  }
  var b=document.createElement('button'); b.className='maxbtn';
  b.innerHTML=EXPAND_ICON+' 最大化';
  b.onclick=function(ev){ ev.preventDefault(); openBigChart(title, spec); };
  d.appendChild(b);
  /* グラフのすぐ下・右よせ：このグラフだけスケールフィット
     （枠の中に重ねると、横軸の文字にかぶるので、流れの中に置く） */
  var fr=document.createElement('div'); fr.className='fitrow';
  var fb=document.createElement('button'); fb.className='fitbtn';
  fb.innerHTML=FIT_ICON+' スケールフィット';
  fb.title='いまのデータが枠いっぱいに収まるように、軸の目盛りを合わせます';
  fb.onclick=function(ev){ ev.preventDefault(); ev.stopPropagation();
    if(!fitSpecRange(spec)){ toast('スケールを合わせるデータがありません'); return; }
    redrawAllCharts(); toast('このグラフのスケールを合わせました');
  };
  /* 左下：最小化（色なし）。押すと題の 1 行だけに閉じ、もう一度押すと開く。グラフごとに覚える（APP.gMin） */
  var mb=document.createElement('button'); mb.className='minbtn'; mb.title='このグラフを 1 行にたたみます／もう一度押すと開きます';
  function applyMin(){
    var m=!!(APP.gMin && spec.key && APP.gMin[spec.key]);
    d.classList.toggle('min', m);
    mb.textContent = m? '▸ 開く' : '▾ 最小化';
  }
  mb.onclick=function(ev){ ev.preventDefault(); ev.stopPropagation();
    APP.gMin=APP.gMin||{}; if(spec.key) APP.gMin[spec.key]=!APP.gMin[spec.key];
    applyMin(); if(typeof saveLocal==='function') saveLocal();
    if(typeof LIVE!=='undefined' && LIVE.on && typeof alignLive==='function') setTimeout(alignLive, 30);
  };
  fr.appendChild(mb); fr.appendChild(fb);
  d.insertBefore(fr, cv.nextSibling);
  applyMin();
  /* 加速度のグラフ：出し方をえらぶボタンと、ばらつきの目安 */
  if(/^a/.test(String(spec.ylab||''))){
    var row=document.createElement('div'); row.className='row awayrow';
    row.style.maxWidth=w+'px';        /* ボタンが多くてもグラフの幅を広げない */
    var seg=document.createElement('span'); seg.className='seg';
    var b1=document.createElement('button');
    b1.className='btn sm'+(APP.aFit?'':' on'); b1.textContent='v の差から計算';
    b1.onclick=function(ev){ ev.preventDefault(); if(!APP.aFit) return;
      APP.aFit=false; saveLocal(); renderMode2(); renderMode3(); };
    var b2=document.createElement('button');
    b2.className='btn sm'+(APP.aFit?' on':''); b2.textContent='v–t の傾きから計算';
    b2.onclick=function(ev){ ev.preventDefault(); if(APP.aFit) return;
      APP.aFit=true; saveLocal(); renderMode2(); renderMode3(); };
    seg.appendChild(b1); seg.appendChild(b2); row.appendChild(seg);
    if(!APP.aFit){
      var lb=document.createElement('label'); lb.className='f awaysel';
      lb.appendChild(document.createTextNode('a に使う時間の幅 '));
      var sel=document.createElement('select'); sel.className='aStepSel';
      [[1,'Δt（となりの v との差 ÷ Δt）'],[2,'3Δt'],[3,'5Δt'],['auto','自動（ばらつきを見てえらぶ）']].forEach(function(o){
        var op=document.createElement('option'); op.value=o[0]; op.textContent=o[1]; sel.appendChild(op);
      });
      sel.value=(EXP().aStep==='auto')? 'auto' : String(aStepOf(EXP()));
      sel.title=(EXP().aStep==='auto')? 'いまは「'+aStepLabel(EXP()).replace('自動：','')+'」を使っています' : '';
      sel.onchange=function(){ EXP().aStep=(this.value==='auto')? 'auto' : (parseInt(this.value)||3);
        afterChange(); renderMode2(); renderMode3(); };
      lb.appendChild(sel); row.appendChild(lb);
    }
    d.appendChild(row);
    var nt=document.createElement('p'); nt.className='mini accnote';
    nt.style.maxWidth=w+'px';        /* 文が長くてもグラフの幅を広げない */
    nt.innerHTML=accNoteHtml();
    d.appendChild(nt);
  }
  d.__spec=spec; d.__title=title; d.__ro=ro;
  ro.innerHTML=readoutHtml(spec);
  return d;
}
/* 「Δt ＝ 記録した点の間隔（ふつう N コマ分、今回の解析では 5 コマ ＝ 0.125 秒）」の一言 */
function dtMeaningHtml(e){
  e=e||EXP();
  var pts=null, o;
  for(o=0;o<NOBJ;o++){ var a=e.objs[o]||[]; if(a.length>=2 && (!pts || a.length>pts.length)) pts=a; }
  var s='<b>Δt ＝ 記録した点の間隔</b>（ふつう N コマ分';
  if(pts){
    var fr=[], dt=[], i;
    for(i=1;i<pts.length;i++){ if(pts[i].fr!==undefined && pts[i-1].fr!==undefined) fr.push(pts[i].fr-pts[i-1].fr); dt.push(pts[i].t-pts[i-1].t); }
    var med=function(arr){ if(!arr.length) return null; var b=arr.slice().sort(function(p,q){return p-q;}); return b[Math.floor(b.length/2)]; };
    var mf=med(fr), md=med(dt);
    if(md>0) s+='、今回の解析では '+(mf? mf+' コマ ＝ ' : '')+nf(md,3)+' 秒';
  }
  return s+'）という意味です。';
}
/* 加速度のばらつきの目安：σa ＝ √6 × (位置のずれ) ÷ Δt²  */
function accNoteHtml(){
  var e=EXP(), s=series(e, UI.obj), K=aStepOf(e);
  var d=[], i;
  for(i=1;i<s.length;i++){ var q=s[i].t-s[i-1].t; if(q>0) d.push(q); }
  if(APP.aFit)
    return 'いまは <b>v–t を前後2点（5点）で直線フィッティング</b>した傾きを a としています。'+
      'ばらつきは小さくなりますが、<b>山や谷はなだらかになります</b>。'+
      'もとの出し方（v の差）に戻すには、上のボタンをもう一度押してください。';
  if(!d.length || !e.mPerPx)
    return 'a は <b>'+esc(aStepLabel(e))+'</b> はなれた v の差から出しています。';
  d.sort(function(a,b){return a-b;});
  var dt=d[Math.floor(d.length/2)];
  /* 位置が 1px ずれたときの a のずれ：K=1 は √6/Δt²、K≥2 は 2/((2K-1)Δt²) */
  var c=(K===1)? Math.sqrt(6) : 2/(2*K-1);
  var s1=c*e.mPerPx/(dt*dt);
  return dtMeaningHtml(e)+'a は <b>'+esc(aStepLabel(e))+'</b> はなれた v の差から出しています。'+
    'いまは <b>Δt = '+nf(dt,3)+' s</b> なので、クリックが <b>1 px ずれると a は約 '+
    sig(s1,2)+' m/s² ずれます</b>。'+
    'ばらつきが大きいときは、上の<b>［a に使う時間の幅］</b>を広げるか、'+
    '①の<b>［進むフレーム数 N］を大きく</b>して測り直してください'+
    '（広げすぎると、こんどは山や谷が削れます）。';
}
/* 選んだ点の表示を、すべてのグラフで出し直す */
function updateReadouts(){
  els('.chartcard').forEach(function(d){
    if(d.__ro && d.__spec) d.__ro.innerHTML=readoutHtml(d.__spec);
  });
  var cg=$('cgReadout'), cv=$('cgCanvas');
  if(cg && cv && cv.__spec) cg.innerHTML=readoutHtml(cv.__spec);
  /* ②③の上の「座標の選択を解除する」は、点を選んでいるときだけ出す */
  ['btnSelClr','btnSelClr3'].forEach(function(id){ var b=$(id); if(b) b.classList.toggle('hide', SEL.x===null); });
}
/* グラフを大きく表示する */
function openBigChart(title, spec){
  var m=document.createElement('div'); m.className='modal'; m.id='gmodal';
  m.innerHTML='<div class="box"><button class="btn sm cls" data-x="close">閉じる</button>'+
    '<h2 style="font-size:1.02rem">'+esc(title)+'</h2><canvas id="gbig"></canvas></div>';
  document.body.appendChild(m);
  var w=Math.min(1100, window.innerWidth-90), h=Math.min(Math.round(w*0.6), window.innerHeight-160);
  drawChart(m.querySelector('#gbig'), spec, {legend:true, w:w, h:h, fixed:true});
  m.addEventListener('click', function(e){ if(e.target===m||e.target.dataset.x==='close') m.remove(); });
}

/* ---------- モード3 ---------- */
/* いちばん最近のフィッティングの中身（残差のプロットに使う） */
var RESID=[], RESID_INFO={};
function renderMode3(doFitNow){
  if(typeof renderErrSection==='function') setTimeout(renderErrSection, 0);   /* 誤差の要因の例（③の一番下） */
  if($('errDtNote')) $('errDtNote').innerHTML=dtMeaningHtml();
  var host=$('charts3'); host.innerHTML='';
  if(doFitNow) RESID=[];
  var q=$('selFitY').value, kind=$('selFitType').value, ob=parseInt($('selFitObj').value)-1;
  var over=$('selCmp3').value==='over';
  /* 「表示」のえらび方は、実験が2つ以上あるときだけ出す */
  var manyExp3=(APP.exps.length>1);
  if($('cmpBox3')) $('cmpBox3').classList.toggle('hide', !manyExp3);
  if($('expBox3')) $('expBox3').classList.toggle('hide', !manyExp3);
  if(!manyExp3 && over){ $('selCmp3').value='side'; over=false; }
  var ids=selectedExps('expChecks3');
  var res=[];
  var getter=QDEF[q].get;
  var isV3=(q==='vx'||q==='vy');
  function dataOf(e){
    var s=series(e,ob), xs=[], ys=[];
    s.forEach(function(p){
      var v=getter(p), tx=isV3? p.tv : p.t;
      if(v!==null&&isFinite(v)&&tx!==null){ xs.push(tx); ys.push(v); }
    });
    return {xs:xs, ys:ys};
  }
  /* フィッティングする範囲（ドラッグで動かせる青い帯）。はじめはデータ全体 */
  var all=[]; ids.forEach(function(i){ var e=APP.exps[i]; if(e) all=all.concat(dataOf(e).xs); });
  if(all.length && (!APP.fitRange || APP.fitRange.a===undefined)){
    APP.fitRange={ a:Math.min.apply(null,all), b:Math.max.apply(null,all) };
  }
  var FR=APP.fitRange;
  function inRange(d){                       /* 帯の中の点だけを使う */
    if(!FR) return d;
    var xs=[], ys=[];
    for(var k=0;k<d.xs.length;k++) if(d.xs[k]>=Math.min(FR.a,FR.b) && d.xs[k]<=Math.max(FR.a,FR.b)){
      xs.push(d.xs[k]); ys.push(d.ys[k]);
    }
    return {xs:xs, ys:ys};
  }
  function onRange(which, v){                /* つまみをドラッグしたとき */
    /* データのある範囲より外へは出さない（外に出ると、つかめなくなってしまうため） */
    if(all.length){
      var lo=Math.min.apply(null,all), hi=Math.max.apply(null,all), pad=(hi-lo)*0.02+1e-6;
      v=Math.max(lo-pad, Math.min(hi+pad, v));
    }
    APP.fitRange[which]=v;
    els('#charts3 canvas').forEach(function(cv){ if(cv.__spec) cv.__spec.range=APP.fitRange; });
    redrawAllCharts(); saveLocal();
  }
  var rangeSpec=FR? {a:FR.a, b:FR.b} : null;
  if(over){
    var ss=[], cvs=[];
    ids.forEach(function(i){
      var e=APP.exps[i], d=dataOf(e);
      if(!d.xs.length) return;
      var col=EXPCOL[i%EXPCOL.length];
      ss.push({name:e.name, color:col, shape:'dot', line:false,
        pts:d.xs.map(function(t,k){return {x:t,y:d.ys[k]};})});
      if(doFitNow){
        var dr=inRange(d), f=doFit(kind,dr.xs,dr.ys,fitInitVals());
        if(f){ cvs.push({color:col, f:f.f, x0:Math.min.apply(null,dr.xs), x1:Math.max.apply(null,dr.xs), dash:[6,3]});
               res.push({name:e.name, fit:f, n:dr.xs.length});
               RESID.push({name:e.name, color:col, xs:dr.xs, ys:dr.ys, f:f.f}); }
      }
    });
    host.appendChild(chartCard(q+' – t（重ねて表示）',
      {title:'', xlab:'t [s]', ylab:QDEF[q].lab, series:ss, curves:cvs,
       xkey:'t', key:'fit3_over_'+q+'_'+ob, range:rangeSpec, onRange:onRange}, null, Math.max(APP.gsize,520)));
  } else {
    ids.forEach(function(i){
      var e=APP.exps[i], d=dataOf(e);
      var col=EXPCOL[i%EXPCOL.length], cvs=[];
      var dr=inRange(d);
      if(doFitNow && dr.xs.length>1){
        var f=doFit(kind,dr.xs,dr.ys,fitInitVals());
        if(f){ cvs.push({color:'#e8443a', f:f.f, x0:Math.min.apply(null,dr.xs), x1:Math.max.apply(null,dr.xs)});
               res.push({name:e.name, fit:f, n:dr.xs.length});
               RESID.push({name:e.name, color:col, xs:dr.xs, ys:dr.ys, f:f.f}); }
      }
      host.appendChild(chartCard(q+' – t　'+e.name,
        {title:'', xlab:'t [s]', ylab:QDEF[q].lab, series:[{name:e.name+' 物体'+(ob+1), color:col, shape:'dot', line:false,
          pts:d.xs.map(function(t,k){return {x:t,y:d.ys[k]};})}], curves:cvs,
         xkey:'t', key:'fit3_'+i+'_'+q+'_'+ob, range:rangeSpec, onRange:onRange}, null, Math.max(APP.gsize,520)));
    });
  }
  var box=$('fitResult');
  if(doFitNow){
    if(!res.length){ box.innerHTML='<span class="ng">フィッティングできませんでした。点の数が足りないか、その関数では合わせられません。</span>'; }
    else {
      box.innerHTML=res.map(function(r){
        return '<div class="fitone"><b>'+esc(r.name)+' 物体'+(ob+1)+'</b>　'+
               '（縦軸 '+esc(QDEF[q].lab)+'、横軸 t [s]）<br>'+
               '<span class="val">'+esc(fitLabel(r.fit))+'</span><br>'+
               '<span class="val">R² = '+sig(r.fit.r2,6)+'</span><br>'+
               '<span class="mini">使った点 '+r.n+' 個'+(FR? '（t = '+nf(Math.min(FR.a,FR.b),3)+' 〜 '+nf(Math.max(FR.a,FR.b),3)+' s）':'')+
               (r.fit.init? '　入れた初期値から計算しました'+(r.fit.auto? '（自動なら R² = '+sig(r.fit.auto.r2,6)+'）' : '') : '')+'</span></div>';
      }).join('');
      RESID_INFO={ q:q, ob:ob, kind:kind };
      if(RESID.length){
        box.innerHTML += '<div class="row" style="margin-top:8px">'+
          '<button class="btn sm blue" id="btnResid">フィッティング残差のプロット</button></div>'+
          '<p class="mini">「測定値 − フィッティングした曲線の値」を、そのまま点にしたグラフです。</p>';
        var rb=$('btnResid');
        if(rb) rb.onclick=function(){ toggleResid(); };
      }
      if($('residHost') && $('residHost').innerHTML) renderResid();   /* 出ていれば描き直す */
    }
  } else if(!box.innerHTML){
    box.innerHTML='<p class="mini">まだフィッティングしていません。上の「フィッティングする」を押してください。</p>';
  }
  if(!host.children.length) host.innerHTML='<div class="card mini">データがありません。</div>';
}
/* ③の「パラメーターの初期値」欄：関数ごとに項目を変える。空欄は自動 */
var FIT_PARAMS={ lin:[], quad:[], sin:[['A','A'],['w','ω'],['phi','φ'],['C','C']], exp:[['A','A'],['k','k'],['C','C']] };
function fitInitVals(){
  var kind=($('selFitType')||{}).value, out={}, any=false;
  (FIT_PARAMS[kind]||[]).forEach(function(pr){
    var f=$('fitInit_'+pr[0]); if(!f) return;
    var v=parseFloat(f.value); if(f.value!=='' && isFinite(v)){ out[pr[0]]=v; any=true; }
  });
  return any? out : null;
}
function updateFitInitUI(){
  var row=$('fitInitRow'); if(!row) return;
  var kind=$('selFitType').value, ps=FIT_PARAMS[kind]||[];
  var keep={}; els('input', row).forEach(function(f){ keep[f.id]=f.value; });
  if(!ps.length){ row.innerHTML=''; row.classList.add('hide'); return; }   /* 直線・放物線では欄そのものを出さない */
  row.classList.remove('hide');
  row.innerHTML='<span class="lb mini" style="margin:0">パラメーターの初期値</span>'+ps.map(function(pr){
    return '<label class="f">'+pr[1]+' <input type="number" step="any" id="fitInit_'+pr[0]+'" style="width:84px" placeholder="自動"></label>';
  }).join('')+'<span class="mini" style="margin:0">（未入力ならば自動決定）</span>';
  els('input', row).forEach(function(f){ if(keep[f.id]!==undefined) f.value=keep[f.id]; });
}
/* ---------- フィッティング残差のプロット ---------- */
/* 残差 ＝ 測った値 − フィッティングの値。0 のまわりに散らばっていれば、その関数でよく合っている。
   かたよって曲がっていたら、関数の形が合っていない（空気抵抗など）。 */
function residSeries(){
  var out=[];
  RESID.forEach(function(r){
    var pts=[];
    for(var i=0;i<r.xs.length;i++){
      var d=r.ys[i]-r.f(r.xs[i]);
      if(isFinite(d)) pts.push({x:r.xs[i], y:d});
    }
    if(pts.length) out.push({name:r.name, color:r.color, shape:'dot', line:false, pts:pts});
  });
  return out;
}
function residSpec(){
  var ss=residSeries(); if(!ss.length) return null;
  var q=RESID_INFO.q||'x', lab=(QDEF[q]? QDEF[q].lab : q);
  var xa=Infinity, xb=-Infinity;
  ss.forEach(function(s){ s.pts.forEach(function(p){ if(p.x<xa) xa=p.x; if(p.x>xb) xb=p.x; }); });
  return { title:'', xlab:'t [s]', ylab:'残差（'+lab+'）', series:ss,
           curves:[{color:'#8a93a0', f:function(){return 0;}, dash:[5,4], x0:xa, x1:xb}],
           __noDydt:true,
           xkey:'t', key:'resid3_'+q+'_'+(RESID_INFO.ob||0) };
}
function residSd(){
  var n=0, s2=0;
  RESID.forEach(function(r){
    for(var i=0;i<r.xs.length;i++){ var d=r.ys[i]-r.f(r.xs[i]); if(isFinite(d)){ n++; s2+=d*d; } }
  });
  return n? Math.sqrt(s2/n) : null;
}
function renderResid(w){
  var host=$('residHost'); if(!host) return false;
  var spec=residSpec();
  if(!spec){ host.innerHTML=''; return false; }
  host.innerHTML='';
  var q=RESID_INFO.q||'x', lab=(QDEF[q]? QDEF[q].lab : q);
  var card=chartCard('フィッティング残差（'+q+'）', spec, null, w||330, Math.round((w||330)*0.62));
  host.appendChild(card);
  var sd=residSd();
  var p2=document.createElement('p'); p2.className='mini';
  p2.innerHTML='0 のまわりに<b>ばらばら</b>に散っていれば、その関数でよく合っています。'+
    '<b>曲がったかたより</b>があれば、関数の形が合っていません。'+
    (sd!==null? '<br>残差の大きさ（RMS）＝ <b>'+sig(sd,3)+'</b>' : '');
  host.appendChild(p2);
  return true;
}
function toggleResid(){
  var host=$('residHost'); if(!host) return;
  if(host.innerHTML){ host.innerHTML=''; return; }
  if(!renderResid()) toast('先に「フィッティングする」を押してください');
}
function esc(s){ return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }


/* =========================================================
   じぶんで軸を選ぶグラフ（モード2・モード3で共有）
   ========================================================= */
var CGQ = { t:{lab:'t [s]', k:'t'}, x:{lab:'x [m]', k:'x'}, y:{lab:'y [m]', k:'y'},
            vx:{lab:'vx [m/s]', k:'vx'}, vy:{lab:'vy [m/s]', k:'vy'},
            ax:{lab:'ax [m/s²]', k:'ax'}, ay:{lab:'ay [m/s²]', k:'ay'},
            px:{lab:'px [kg·m/s]', k:'px'}, py:{lab:'py [kg·m/s]', k:'py'} };
function cgLab(q, inv){ var l=CGQ[q]?CGQ[q].lab:q; return inv? '−('+l+')' : l; }
function cgName(ei, ob, q, inv){
  var e=APP.exps[ei]; if(!e) return '';
  var on = APP.twoObj? (' 物体'+(ob+1)+(e.objName[ob]?'('+e.objName[ob]+')':''))
                     : (e.objName[ob]? ' ('+e.objName[ob]+')' : '');
  return e.name+on+' '+(inv?'−':'')+q;
}
/* 指定した実験・物体で、(横軸の量, 縦軸の量) の組をつくる */
function cgPoints(ei, ob, q, inv, xq, invX){
  var e=APP.exps[ei]; if(!e||!e.objs[ob]) return [];
  var s=series(e,ob), out=[];
  var isV=(q==='vx'||q==='vy'||q==='px'||q==='py');
  var mass=massOf(e, ob);
  s.forEach(function(p){
    /* 速さは「点と点のあいだ」の値なので、横軸が t のときは中点の時刻に置く */
    var xv=(xq==='t' && isV)? p.tv : p[xq];
    var yv=(q==='px')? (p.vx===null? null : mass*p.vx) : (q==='py')? (p.vy===null? null : mass*p.vy) : p[q];
    if(xv===null||yv===null||xv===undefined||yv===undefined||!isFinite(xv)||!isFinite(yv)) return;
    out.push({ x:(invX? -xv : xv), y:(inv? -yv : yv) });
  });
  return out;
}
/* 自由選択グラフのフィッティング範囲（上のグラフとは別に持つ） */
function cgRangeOf(pa){
  if(!pa.length) return null;
  var xs=pa.map(function(p){return p.x;});
  var lo=Math.min.apply(null,xs), hi=Math.max.apply(null,xs);
  if(!APP.cgRange || !isFinite(APP.cgRange.a) || !isFinite(APP.cgRange.b) ||
     APP.cgRange.b<lo-(hi-lo) || APP.cgRange.a>hi+(hi-lo)){
    APP.cgRange={a:lo, b:hi};
  }
  return APP.cgRange;
}
function cgInRange(pa){
  var r=APP.cgRange; if(!r) return pa;
  var lo=Math.min(r.a,r.b), hi=Math.max(r.a,r.b);
  return pa.filter(function(p){ return p.x>=lo && p.x<=hi; });
}
function cgSpec(){
  var c=APP.cg;
  var pa=cgPoints(c.expA, c.objA, c.qA, c.invA, c.xq, c.invX);
  var spec={ title:'', xlab:cgLab(c.xq,c.invX), ylab:cgLab(c.qA,c.invA),
    xkey:(c.xq==='t'&&!c.invX)? 't' : ('cgx_'+c.xq+(c.invX?'m':'')), key:'cg',
    series:[{ name:cgName(c.expA,c.objA,c.qA,c.invA), color:'#1663b5', shape:'dot',
              line:c.line!==false, pts:pa }] };
  if(c.two){
    var pb=cgPoints(c.expB, c.objB, c.qB, c.invB, c.xq, c.invX);
    spec.series2=[{ name:cgName(c.expB,c.objB,c.qB,c.invB), color:'#e8443a', shape:'sq',
                    line:c.line!==false, pts:pb }];
    spec.ylab2=cgLab(c.qB,c.invB);
  }
  /* 縦横が同じ単位（位置どうし）なら、目盛りの間隔をそろえて形がゆがまないようにする */
  spec.equal = (!c.two) && CGQ[c.qA] && CGQ[c.xq] &&
               CGQ[c.qA].lab.slice(-4)===CGQ[c.xq].lab.slice(-4);
  /* 2 軸で同じ量（運動量どうしなど）なら、同じ目盛りで比べる */
  spec.sameY = !!(c.two && c.qA===c.qB);
  /* ③解析のときだけ、フィッティングする範囲の帯を出す（上のグラフとは独立） */
  var showRange = $('cgFitRow') && !$('cgFitRow').classList.contains('hide');
  if(showRange){
    var r=cgRangeOf(pa);
    if(r) spec.range={a:r.a, b:r.b};
  }
  if(APP.cgFit && pa.length>1){
    var used=showRange? cgInRange(pa) : pa;
    if(used.length>1){
      var xs=used.map(function(p){return p.x;});
      spec.curves=[{ color:'#1c8f4a', f:APP.cgFit.f,
                     x0:Math.min.apply(null,xs), x1:Math.max.apply(null,xs) }];
    }
  }
  return spec;
}
/* 自由選択グラフの大きさ（他のグラフと同じ「拡大／縮小」に合わせる） */
function cgWidth(){
  /* 上のグラフより小さいと見にくいので、大きめにとる（前の2倍）。
     ただし、置いてある場所からはみ出さないところまで。 */
  /* 上のグラフ（②は gsize、③は max(gsize,520)）と同じ幅にそろえる */
  var w=(APP.tab==='3')? Math.max(APP.gsize,520) : APP.gsize;
  var card=$('cgCard');
  var win=(document.documentElement && document.documentElement.clientWidth) || window.innerWidth || 900;
  /* このカードが置かれている場所から、画面の右はしまでの残りで決める */
  var left=0;
  if(card){ var r=card.getBoundingClientRect(); if(r.width>0) left=Math.max(0, r.left); }
  var box=Math.max(300, win-left-20);
  /* 左の「縦軸」えらびと、③のときは右のフィッティング結果のぶんを空ける */
  var side=(APP.tab==='3')? 430 : 210;
  if(box<560) side=40;
  var avail=box - side;
  return Math.max(260, Math.min(840, Math.max(260, Math.min(w, avail))));
}
function cgOnRange(which, v){        /* 自由選択グラフのつまみをドラッグしたとき */
  var c=APP.cg, pa=cgPoints(c.expA,c.objA,c.qA,c.invA,c.xq,c.invX);
  if(pa.length){
    var xs=pa.map(function(p){return p.x;});
    var lo=Math.min.apply(null,xs), hi=Math.max.apply(null,xs), pad=(hi-lo)*0.02+1e-6;
    v=Math.max(lo-pad, Math.min(hi+pad, v));
  }
  if(!APP.cgRange) APP.cgRange={a:v,b:v};
  APP.cgRange[which]=v;
  var cv=$('cgCanvas'); if(cv.__spec) cv.__spec.range=APP.cgRange;
  drawChart(cv, cv.__spec, cv.__opt); saveLocal();
}
/* 自由選択グラフのフィッティング残差（③のものと同じ見せ方） */
var CGRESID=null;
function cgResidSpec(){
  var r=CGRESID; if(!r) return null;
  var pts=[], xa=Infinity, xb=-Infinity, i;
  for(i=0;i<r.xs.length;i++){ var d=r.ys[i]-r.f(r.xs[i]); if(isFinite(d)){ pts.push({x:r.xs[i], y:d}); if(r.xs[i]<xa) xa=r.xs[i]; if(r.xs[i]>xb) xb=r.xs[i]; } }
  if(!pts.length) return null;
  return { title:'', xlab:r.xlab, ylab:'残差（'+labName(r.ylab)+'）', series:[{name:r.name, color:'#1f5fa8', shape:'dot', line:false, pts:pts}],
           curves:[{color:'#8a93a0', f:function(){return 0;}, dash:[5,4], x0:xa, x1:xb}], __noDydt:true, xkey:'cgx', key:'cgresid' };
}
function renderCgResid(){
  var host=$('cgResidHost'); if(!host) return false;
  var spec=cgResidSpec();
  if(!spec){ host.innerHTML=''; return false; }
  host.innerHTML='';
  host.appendChild(chartCard('フィッティング残差', spec, null, 330, 205));
  var n=0, s2=0; CGRESID.xs.forEach(function(x,i){ var d=CGRESID.ys[i]-CGRESID.f(x); if(isFinite(d)){ n++; s2+=d*d; } });
  var p2=document.createElement('p'); p2.className='mini';
  p2.innerHTML='0 のまわりに<b>ばらばら</b>に散っていれば、その関数でよく合っています。<b>曲がったかたより</b>があれば、関数の形が合っていません。'+
    (n? '<br>残差の大きさ（RMS）＝ <b>'+sig(Math.sqrt(s2/n),3)+'</b>' : '');
  host.appendChild(p2);
  return true;
}
function toggleCgResid(){
  var host=$('cgResidHost'); if(!host) return;
  if(host.innerHTML){ host.innerHTML=''; return; }
  if(!renderCgResid()) toast('先に「フィッティングする」を押してください');
}
function renderCG(){
  if(typeof updateCgMomentumUI==='function') updateCgMomentumUI();
  var host=$('cgCard'); if(!host) return;
  var spec=cgSpec();
  var eq=$('cgEqualNote'); if(eq) eq.classList.toggle('hide', !spec.equal);
  var cv=$('cgCanvas');
  var w=cgWidth();
  var draw=function(ww){
    drawChart(cv, spec, {w:ww, h:Math.round(ww*(spec.equal?0.8:0.62)), legend:true, fixed:true});
  };
  draw(w);
  /* はみ出していたら、実際のはみ出し量ぶんだけ縮めて描き直す（1回だけ） */
  var win=(document.documentElement && document.documentElement.clientWidth) || window.innerWidth || 900;
  var r=host.getBoundingClientRect();
  var over=Math.round(r.right - (win-12));
  if(over>2 && w-over>=260) draw(w-over);
  bindChartDrag(cv, cgOnRange);
}
function cgDoFit(kind){
  var c=APP.cg;
  var all=cgPoints(c.expA,c.objA,c.qA,c.invA,c.xq,c.invX);
  var showRange = $('cgFitRow') && !$('cgFitRow').classList.contains('hide');
  if(showRange) cgRangeOf(all);
  var pa=showRange? cgInRange(all) : all;
  if(pa.length<2){ APP.cgFit=null;
    $('cgResult').innerHTML='<span class="ng">点が足りません。青い帯（フィッティングするエリア）を広げてください。</span>';
    renderCG(); return; }
  var f=doFit(kind, pa.map(function(p){return p.x;}), pa.map(function(p){return p.y;}));
  APP.cgFit=f;
  CGRESID=f? { xs:pa.map(function(p){return p.x;}), ys:pa.map(function(p){return p.y;}), f:f.f,
               name:cgName(c.expA,c.objA,c.qA,c.invA), xlab:cgLab(c.xq,c.invX), ylab:cgLab(c.qA,c.invA) } : null;
  if(!f){ $('cgResult').innerHTML='<span class="ng">この関数では合わせられませんでした。</span>'; }
  else {
    var r=APP.cgRange;
    $('cgResult').innerHTML='<div class="fitone"><b>'+esc(cgName(c.expA,c.objA,c.qA,c.invA))+'</b>　'+
      '（縦軸 '+esc(cgLab(c.qA,c.invA))+'、横軸 '+esc(cgLab(c.xq,c.invX))+'）<br>'+
      '<span class="val">'+esc(fitLabel(f).replace(/ t/g,' x'))+'</span><br>'+
      '<span class="val">R² = '+sig(f.r2,6)+'</span><br>'+
      '<span class="mini">使った点 '+pa.length+' 個'+
      ((showRange&&r)? '（'+esc(labName(cgLab(c.xq,c.invX)))+' = '+nf(Math.min(r.a,r.b),3)+' 〜 '+nf(Math.max(r.a,r.b),3)+'）':'')+
      '</span></div>'+
      '<div class="row" style="margin-top:8px"><button class="btn sm blue" id="btnCgResid">フィッティング残差のプロット</button></div>'+
      '<p class="mini">「測定値 − フィッティングした曲線の値」を、そのまま点にしたグラフです。</p>';
    var rb=$('btnCgResid'); if(rb) rb.onclick=function(){ toggleCgResid(); };
  }
  if($('cgResidHost') && $('cgResidHost').innerHTML) renderCgResid();     /* 出ていれば描き直す */
  renderCG();
}
