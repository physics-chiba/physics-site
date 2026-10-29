/* =========================================================
   30_core.js  … 状態・保存・数値計算（描画やDOMを混ぜない）
   ========================================================= */
'use strict';
var VER = '1.0';
var MAXEXP = 10;
var NOBJ = 3;                       /* 追跡できる物体の数 */
var OBJCOL = ['#e8443a', '#1663b5', '#1c8f4a'];      /* 物体1,2,3 */
var EXPCOL = ['#1663b5','#e8443a','#1c8f4a','#e07b18','#8e44ad','#00838f','#c2185b','#5d4037','#546e7a','#7cb342'];

function $(id){ return document.getElementById(id); }
function el(sel,root){ return (root||document).querySelector(sel); }
function els(sel,root){ return Array.prototype.slice.call((root||document).querySelectorAll(sel)); }

/* ---------- 数値の書式 ---------- */
function nf(v, d){ if(v===null||v===undefined||!isFinite(v)) return '-'; return v.toFixed(d===undefined?3:d); }
function sig(v, n){
  if(v===null||v===undefined||!isFinite(v)) return '-';
  if(v===0) return '0';
  var a=Math.abs(v);
  if(a>=1e5||a<1e-4) return v.toExponential((n||4)-1);
  var d=Math.max(0,(n||4)-1-Math.floor(Math.log10(a)));
  return v.toFixed(Math.min(d,10));
}

/* ---------- 実験データ ---------- */
function newExp(n){
  var o={ id:'e'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),
    name:'実験'+n, memo:'',
    objs:[], ref:[], useDrift:false,
    origin:null, originSet:false, angle:0, yflip:false, xflip:false,
    mPerPx:null, scaleRef:null, scaleLen:0.1,
    t0:null, rangeA:null, rangeB:null, step2ok:false, trackReady:false, axisSet:false, tscale:1,
    objReady:[false,false,false], objEnd:[false,false,false], crop:null, aStep:1, gDir:'y-',
    video:{name:'',w:0,h:0,dur:0,fps:30},
    m1:0.1, m2:0.1, m3:0.1, g:9.8, camDist:3, rulerGap:0, shotFps:0, fpsOk:false, nOk:false, nObjs:2, nObjOk:false,
    objName:['','',''] };
  for(var i=0;i<NOBJ;i++) o.objs.push([]);
  return o;
}
var APP = { exps:[newExp(1)], cur:0, autosave:true, menuPos:'left', axisDisp:'x', step:1, aFit:false,
  bigView:false, m2menu:true, m3menu:true, panelw:352, vidh:0,
  cg:{ expA:0, objA:0, qA:'x', invA:false, expB:0, objB:0, qB:'x', invB:false,
       xq:'t', invX:false, two:false, line:true }, cgFit:null,
  editStep:0, lastEdit:0, played:false, gsize:450, energyOn:false, momOn:false, gMin:{}, fitRange:null, tblw:330,
  tab:'1', m2mode:'side', komaMode:false, cgRange:null, twoObj:false };
/* 使う物体の数（「複数物体の運動」がONなら 2 か 3（e.nObjs）、OFFなら1） */
function nObj(){ return APP.twoObj? Math.max(2, Math.min(3, parseInt(EXP().nObjs)||2)) : 1; }
/* 物体 ob の質量（m1・m2・m3） */
function massOf(exp, ob){ var m=[exp.m1, exp.m2, exp.m3][ob]; return (m>0)? m : 0.1; }
/* 表や出力で「x1」のように番号をつけるか（2物体のとき、または2つ以上のデータがあるとき） */
function useObjIdx(objs){ return APP.twoObj || (objs && objs.length>1); }
/* 「軸の表示」が x軸のみ のときは、y・vy・ay をグラフや解析に出さない */
function useY(){ return APP.axisDisp!=='x'; }
/* ②「動画と一緒にグラフを再生する」の状態（LIVE.t までの点だけ描く） */
var LIVE = { on:false, t:Infinity, home:null, axis:true };
/* いま操作している手順（「もう一度」でもどっているときは、そのカード） */
function effStep(){ return (APP.editStep && APP.editStep<APP.step)? APP.editStep : APP.step; }
/* 解析する時間範囲のはじめ（＝時刻の原点） */
function rangeStart(exp){ return (exp.t0!==null)? exp.t0 : (exp.rangeA!==null? exp.rangeA : 0); }
function EXP(){ return APP.exps[APP.cur]; }

/* ---------- 座標変換 ---------- */
/* 画面（動画ピクセル）座標 → 物理座標[m] */
function toPhys(exp, px, py, t){
  var o = exp.origin || {x:0,y:0};
  var d = driftAt(exp, t);
  var dx = (px - d.x) - o.x, dy = (py - d.y) - o.y;
  var c = Math.cos(exp.angle), s = Math.sin(exp.angle);
  var X =  dx*c + dy*s;
  var Y =  dx*s - dy*c;              /* 画面yは下向き → 既定でyは上向き正 */
  if(exp.xflip) X = -X;
  if(exp.yflip) Y = -Y;
  var k = exp.mPerPx || 1;
  return { x:X*k, y:Y*k };
}
/* 物理座標[m] → 画面（動画ピクセル）座標（軸の描画に使う。手ぶれ補正は入れない） */
function toPix(exp, X, Y){
  var o = exp.origin || {x:0,y:0};
  var k = exp.mPerPx || 1;
  var xx = (exp.xflip? -X : X)/k, yy = (exp.yflip? -Y : Y)/k;
  var c = Math.cos(exp.angle), s = Math.sin(exp.angle);
  return { x:o.x + xx*c + yy*s, y:o.y + xx*s - yy*c };
}
/* 手ぶれ補正：基準点の「最初の位置からのずれ」を時刻で線形補間 */
function driftAt(exp, t){
  if(!exp.useDrift || !exp.ref || exp.ref.length<1 || t===undefined || t===null) return {x:0,y:0};
  var r=exp.ref, n=r.length, b=r[0];
  if(n===1 || t<=r[0].t) return {x:r[0].x-b.x, y:r[0].y-b.y};
  if(t>=r[n-1].t) return {x:r[n-1].x-b.x, y:r[n-1].y-b.y};
  for(var i=0;i<n-1;i++){
    if(t>=r[i].t && t<=r[i+1].t){
      var f=(r[i+1].t===r[i].t)?0:(t-r[i].t)/(r[i+1].t-r[i].t);
      return { x:(r[i].x+(r[i+1].x-r[i].x)*f)-b.x, y:(r[i].y+(r[i+1].y-r[i].y)*f)-b.y };
    }
  }
  return {x:0,y:0};
}

/* ---------- 系列（時刻・位置・速度・加速度） ---------- */
/* 記録タイマーのテープと同じ考え方：
   ・速さ v は「となりあう2点のあいだ」の平均の速さ → その中点の時刻 tv に対応する
   ・加速度 a は「となりあう2つの v の変わり方」 → もとの点の時刻 t にもどる
   両はしでは出せないので null。 */
function series(exp, obj){
  var pts = (exp.objs[obj]||[]).slice().sort(function(a,b){return a.t-b.t;});
  var ts = exp.tscale>0? exp.tscale : 1;          /* スロー撮影の倍率 */
  var out=[];
  for(var i=0;i<pts.length;i++){
    var p=pts[i], q=toPhys(exp,p.x,p.y,p.t);
    out.push({ t:(p.t-(exp.t0||0))*ts, x:q.x, y:q.y, px:p.x, py:p.y, fr:p.fr, raw:p.t, auto:!!p.auto,
               tv:null, vx:null, vy:null, v:null, vc:null, ax:null, ay:null, a:null });
  }
  var n=out.length, i2;
  for(i2=0;i2<n-1;i2++){                          /* 点と点のあいだの平均の速さ */
    var dt=out[i2+1].t-out[i2].t;
    if(dt>0){
      out[i2].tv=(out[i2].t+out[i2+1].t)/2;
      out[i2].vx=(out[i2+1].x-out[i2].x)/dt;
      out[i2].vy=(out[i2+1].y-out[i2].y)/dt;
      out[i2].v=Math.sqrt(out[i2].vx*out[i2].vx+out[i2].vy*out[i2].vy);
    }
  }
  for(i2=1;i2<n-1;i2++){                          /* エネルギー用：その点での速さ（前後の平均） */
    var b1=out[i2-1], b2=out[i2];
    if(b1.vx!==null && b2.vx!==null)
      out[i2].vc=Math.sqrt(Math.pow((b1.vx+b2.vx)/2,2)+Math.pow((b1.vy+b2.vy)/2,2));
  }
  /* 加速度 ＝ v の変わり方。K=1 なら「となりの v との差」、K=2 なら「2つ離した v の差」…
     （Δt を広げるほど、クリックのずれの影響は小さくなる。ただし広げすぎると山が削れる） */
  var K=aStepOf(exp);
  for(i2=K;i2<=n-1-K;i2++){
    var a1=out[i2-K], a2=out[i2+K-1];
    if(a1 && a2 && a1.vx!==null && a2.vx!==null){
      var dt2=a2.tv-a1.tv;
      if(dt2>0){
        out[i2].ax=(a2.vx-a1.vx)/dt2; out[i2].ay=(a2.vy-a1.vy)/dt2;
        out[i2].a=Math.sqrt(out[i2].ax*out[i2].ax+out[i2].ay*out[i2].ay);
      }
    }
  }
  return out;
}
/* a を出すときに使う v の組（K=1：となりの v、K=2：3Δt はなれた v、K=3：5Δt はなれた v） */
function aStepOf(exp){
  if(exp && exp.aStep==='auto') return autoAStep(exp);
  var k=parseInt(exp && exp.aStep)||1;
  return Math.max(1, Math.min(3, k));
}
/* 表・Excel の見出し用：a を出すときに使う時間の幅（Δt・3Δt・5Δt）。「離す数」とは言わない */
function aStepLabel(exp){
  var k=aStepOf(exp);
  var s='時間の幅 '+(k===1? 'Δt' : (2*k-1)+'Δt');
  return (exp && exp.aStep==='auto')? '自動：'+s : s;
}
/* 「自動」：クリックのずれによる a のばらつきの目安が、a の大きさ（変化幅か中央値）の 1/4 以下になる、いちばん小さい離す数をえらぶ
   （ずれの大きさ σ は、位置の 2 階差分のばらつきから見積もる。静止・等速など a がほぼ 0 のときは 3） */
function autoAStep(exp){
  var pts=null, i, o;
  for(o=0;o<NOBJ;o++){ var a=exp.objs[o]||[]; if(a.length>=8 && (!pts || a.length>pts.length)) pts=a; }
  if(!pts) return 3;
  var sig=pts.length+':'+pts[pts.length-1].t+':'+pts[pts.length-1].x+':'+pts[0].x+':'+(exp.mPerPx||0);
  if(exp.__autoSig===sig && exp.__autoK) return exp.__autoK;
  var dts=[]; for(i=1;i<pts.length;i++) dts.push(pts[i].t-pts[i-1].t);
  dts.sort(function(p,q){return p-q;}); var dt=dts[Math.floor(dts.length/2)]||(1/30);
  var k, K=1;
  if(dt>0){
    /* 位置のずれ σ（px）：2 階差分の中央値まわりのばらつき ÷ √6 */
    var med=function(arr){ var b=arr.slice().sort(function(p,q){return p-q;}); return b[Math.floor(b.length/2)]; };
    var mad=function(key){ var d2=[]; for(i=1;i<pts.length-1;i++) d2.push(pts[i+1][key]-2*pts[i][key]+pts[i-1][key]);
      var m0=med(d2); return med(d2.map(function(v){ return Math.abs(v-m0); })); };
    var sigma=1.4826*Math.max(mad('x'), mad('y'))/Math.sqrt(6);      /* x・y それぞれで見て、大きい方 */
    /* a の変化幅：3つ離して出した a の 10〜90% 幅（px/s²） */
    var v=[]; for(i=1;i<pts.length;i++) v.push({t:(pts[i].t+pts[i-1].t)/2, x:(pts[i].x-pts[i-1].x)/(pts[i].t-pts[i-1].t||dt), y:(pts[i].y-pts[i-1].y)/(pts[i].t-pts[i-1].t||dt)});
    var aa=[]; for(i=3;i<=v.length-3;i++){ var p1=v[i-3], p2=v[i+2], dd=p2.t-p1.t; if(dd>0) aa.push(Math.hypot((p2.x-p1.x)/dd,(p2.y-p1.y)/dd)); }
    aa.sort(function(p,q){return p-q;});
    /* a の「大きさ」：a の変化幅（10〜90%）と、a そのものの中央値の大きい方（等加速度なら後者が効く） */
    var amp=aa.length>4? Math.max(aa[Math.floor(aa.length*0.9)]-aa[Math.floor(aa.length*0.1)], aa[Math.floor(aa.length/2)]) : 0;
    K=3;
    for(k=1;k<=3;k++){
      var c=(k===1)? Math.sqrt(6) : 2/(2*k-1);
      if(amp>0 && c*sigma/(dt*dt) <= amp/4){ K=k; break; }
    }
    /* 点が少ないときは、a の点が 5 個は残る幅まで（幅 (2K−1)Δt で出せる a の数 ＝ 点の数 − 2K） */
    while(K>1 && pts.length-2*K<5) K--;
  }
  exp.__autoSig=sig; exp.__autoK=K;
  return K;
}
/* v–t を前後2点（＝5点）で直線フィットして、その傾きを a とする（グラフ用） */
function aByFit(s, key){
  var vv=[], i, m=2, out=[];
  for(i=0;i<s.length;i++) if(s[i][key]!==null && s[i].tv!==null) vv.push({t:s[i].tv, v:s[i][key]});
  for(var j=0;j<vv.length;j++){
    var lo=Math.max(0,j-m), hi=Math.min(vv.length-1,j+m);
    if(hi-lo<2) continue;                       /* 3点未満では出さない */
    var n=0,sx=0,sy=0,sxx=0,sxy=0,k;
    for(k=lo;k<=hi;k++){ n++; sx+=vv[k].t; sy+=vv[k].v; sxx+=vv[k].t*vv[k].t; sxy+=vv[k].t*vv[k].v; }
    var den=n*sxx-sx*sx;
    if(den===0) continue;
    out.push({ x:vv[j].t, y:(n*sxy-sx*sy)/den });
  }
  return out;
}
/* 重力の向き（鉛直下向きが x・y のどちらの正負か）から、高さ h の出し方を決める
   'y-'：重力は −y 向き → h = y（y の正が上）　'y+'：h = −y　'x-'：h = x　'x+'：h = −x */
function gDirInfo(exp){
  var d=(exp && exp.gDir)||'y-';
  var axis=d.charAt(0), down=d.charAt(1);                 /* 重力（下向き）が向く軸と正負 */
  var sign=(down==='-')? 1 : -1;                          /* h = sign × (その軸の値) */
  return { dir:d, axis:axis, sign:sign,
           h:(sign>0? 'h = '+axis : 'h = −'+axis),
           label:(down==='-'? '−' : '+')+axis+' 方向',
           up:(sign>0? axis+' の正の向きが上' : axis+' の負の向きが上') };
}
function energy(exp, obj, s){
  var m = massOf(exp, obj), g=exp.g||9.8, gi=gDirInfo(exp);
  return s.map(function(p){
    var K = (p.vc===null)? null : 0.5*m*p.vc*p.vc;
    var U = m*g*gi.sign*(gi.axis==='x'? p.x : p.y);
    return { t:p.t, K:K, U:U, E:(K===null?null:K+U) };
  });
}
/* 重心の運動量（＝全体の運動量 Σ mᵢvᵢ）。物体ごとの p と、その和を、時刻ごとに返す。
   時刻は物体1の v の時刻（tv）にそろえ、他の物体は線形補間で合わせる */
function momentumSeries(exp, comp){
  var key=(comp==='y')? 'vy' : 'vx', objs=[], o;
  for(o=0;o<nObj();o++) if(exp.objs[o] && exp.objs[o].length>1) objs.push(o);
  if(!objs.length) return { objs:[], per:[], sum:[] };
  var ss=objs.map(function(k){ return series(exp,k).filter(function(p){ return p.tv!==null && p[key]!==null; }); });
  var per=ss.map(function(s,i){ var m=massOf(exp,objs[i]);
    return s.map(function(p){ return { x:p.tv, y:m*p[key] }; }); });
  function interp(s, t){                                  /* その時刻の v を前後から直線でつなぐ（範囲外は無し） */
    if(!s.length || t<s[0].tv-1e-9 || t>s[s.length-1].tv+1e-9) return null;
    for(var i=0;i<s.length-1;i++){
      var a=s[i], b=s[i+1];
      if(t>=a.tv-1e-9 && t<=b.tv+1e-9){ var f=(b.tv===a.tv)? 0 : (t-a.tv)/(b.tv-a.tv); return a[key]+(b[key]-a[key])*f; }
    }
    return s[s.length-1][key];
  }
  var sum=[];
  ss[0].forEach(function(p){
    var tot=0, ok=true;
    objs.forEach(function(k,i){
      var v=(i===0)? p[key] : interp(ss[i], p.tv);
      if(v===null){ ok=false; return; }
      tot+=massOf(exp,k)*v;
    });
    if(ok) sum.push({ x:p.tv, y:tot });
  });
  return { objs:objs, per:per, sum:sum };
}

/* ---------- 最小二乗フィット ---------- */
function solve(A, b){                       /* ガウスの消去法 */
  var n=b.length, i,j,k,M=[];
  for(i=0;i<n;i++) M.push(A[i].slice().concat([b[i]]));
  for(i=0;i<n;i++){
    var p=i; for(k=i+1;k<n;k++) if(Math.abs(M[k][i])>Math.abs(M[p][i])) p=k;
    if(Math.abs(M[p][i])<1e-14) return null;
    var tmp=M[i]; M[i]=M[p]; M[p]=tmp;
    for(k=i+1;k<n;k++){ var f=M[k][i]/M[i][i]; for(j=i;j<=n;j++) M[k][j]-=f*M[i][j]; }
  }
  var x=new Array(n);
  for(i=n-1;i>=0;i--){ var s=M[i][n]; for(j=i+1;j<n;j++) s-=M[i][j]*x[j]; x[i]=s/M[i][i]; }
  return x;
}
function polyFit(xs, ys, deg){
  var n=deg+1, A=[], b=[], i,j,k;
  for(i=0;i<n;i++){ A.push(new Array(n).fill(0)); b.push(0); }
  for(k=0;k<xs.length;k++){
    var pw=[1]; for(i=1;i<=2*deg;i++) pw.push(pw[i-1]*xs[k]);
    for(i=0;i<n;i++){ for(j=0;j<n;j++) A[i][j]+=pw[i+j]; b[i]+=pw[i]*ys[k]; }
  }
  return solve(A,b);            /* [c0,c1,...] 低次から */
}
function r2of(ys, pred){
  var m=0,i; for(i=0;i<ys.length;i++) m+=ys[i]; m/=ys.length;
  var ss=0, sr=0;
  for(i=0;i<ys.length;i++){ ss+=(ys[i]-m)*(ys[i]-m); var d=ys[i]-pred[i]; sr+=d*d; }
  if(ss<=0) return (sr<=1e-30)?1:0;
  return 1-sr/ss;
}
/* 正弦：y = A sin(w t + p) + C  … w を走査して線形最小二乗（A sin+B cos+C）で解く */
function sinFit(xs, ys){
  var n=xs.length; if(n<4) return null;
  var span=xs[n-1]-xs[0]; if(span<=0) return null;
  var best=null;
  var wlo=2*Math.PI/(span*4), whi=2*Math.PI*n/(2*span)*1.6;   /* ナイキストの少し上まで */
  function trial(w){
    var A=[[0,0,0],[0,0,0],[0,0,0]], b=[0,0,0], i;
    for(i=0;i<n;i++){
      var f=[Math.sin(w*xs[i]), Math.cos(w*xs[i]), 1], j,k;
      for(j=0;j<3;j++){ for(k=0;k<3;k++) A[j][k]+=f[j]*f[k]; b[j]+=f[j]*ys[i]; }
    }
    var c=solve(A,b); if(!c) return null;
    var pred=xs.map(function(t){ return c[0]*Math.sin(w*t)+c[1]*Math.cos(w*t)+c[2]; });
    return { w:w, c:c, r2:r2of(ys,pred), pred:pred };
  }
  var steps=600, i2;
  for(i2=0;i2<=steps;i2++){
    var w=wlo+(whi-wlo)*i2/steps, r=trial(w);
    if(r && (!best || r.r2>best.r2)) best=r;
  }
  if(!best) return null;
  var d=(whi-wlo)/steps;                       /* 山の周りを細かく */
  for(var pass=0;pass<4;pass++){
    var lo=best.w-d, hi=best.w+d;
    for(i2=0;i2<=40;i2++){ var r2=trial(lo+(hi-lo)*i2/40); if(r2 && r2.r2>best.r2) best=r2; }
    d/=20;
  }
  var Amp=Math.sqrt(best.c[0]*best.c[0]+best.c[1]*best.c[1]);
  var ph=Math.atan2(best.c[1],best.c[0]);
  return { type:'sin', p:{A:Amp, w:best.w, phi:ph, C:best.c[2]}, r2:best.r2,
           f:function(t){ return Amp*Math.sin(best.w*t+ph)+best.c[2]; } };
}
/* 指数：y = A e^{k t} + C  … C を走査し、log線形化 → 仕上げにガウス・ニュートン風の微調整 */
function expFit(xs, ys){
  var n=xs.length; if(n<3) return null;
  var ymin=Math.min.apply(null,ys), ymax=Math.max.apply(null,ys), rng=ymax-ymin;
  if(rng<=0) return null;
  var best=null;
  function trial(C){
    var lx=[], ly=[], i, sgn=0;
    for(i=0;i<n;i++){
      var d=ys[i]-C; if(Math.abs(d)<1e-12) continue;
      if(sgn===0) sgn=(d>0?1:-1);
      if((d>0?1:-1)!==sgn) return null;
      lx.push(xs[i]); ly.push(Math.log(Math.abs(d)));
    }
    if(lx.length<3) return null;
    var c=polyFit(lx,ly,1); if(!c) return null;
    var A=sgn*Math.exp(c[0]), k=c[1];
    var pred=xs.map(function(t){ return A*Math.exp(k*t)+C; });
    return { A:A,k:k,C:C, r2:r2of(ys,pred) };
  }
  var lo=ymin-2*rng, hi=ymax+2*rng, i2;
  for(i2=0;i2<=400;i2++){ var r=trial(lo+(hi-lo)*i2/400); if(r && (!best||r.r2>best.r2)) best=r; }
  if(!best) return null;
  var step=(hi-lo)/400;
  for(var p=0;p<5;p++){
    for(i2=-20;i2<=20;i2++){ var r2=trial(best.C+step*i2/20); if(r2 && r2.r2>best.r2) best=r2; }
    step/=10;
  }
  var A=best.A,k=best.k,C=best.C;
  return { type:'exp', p:{A:A,k:k,C:C}, r2:best.r2, f:function(t){ return A*Math.exp(k*t)+C; } };
}
/* 非線形（正弦・指数）の仕上げ：初期値から Levenberg–Marquardt で最小二乗。
   init は {A,w,phi,C} / {A,k,C} の一部でもよい（無い項目は自動の値を使う） */
function lmRefine(kind, xs, ys, p0){
  var names=(kind==='sin')? ['A','w','phi','C'] : ['A','k','C'];
  var model=(kind==='sin')? function(p,t){ return p[0]*Math.sin(p[1]*t+p[2])+p[3]; }
                          : function(p,t){ return p[0]*Math.exp(p[1]*t)+p[2]; };
  var p=names.map(function(k){ return p0[k]; }), n=xs.length, m=p.length, i, j, k;
  if(p.some(function(v){ return !isFinite(v); })) return null;
  function sse(pp){ var s=0; for(i=0;i<n;i++){ var d=ys[i]-model(pp,xs[i]); s+=d*d; } return isFinite(s)? s : Infinity; }
  var lam=1e-3, cur=sse(p), it;
  for(it=0; it<200; it++){
    /* ヤコビアン（数値微分）と正規方程式 */
    var J=[], r=[];
    for(i=0;i<n;i++){
      var row=[], f0=model(p,xs[i]); r.push(ys[i]-f0);
      for(j=0;j<m;j++){ var h=1e-6*Math.max(1,Math.abs(p[j])), q=p.slice(); q[j]+=h; row.push((model(q,xs[i])-f0)/h); }
      J.push(row);
    }
    var A=[], b=[];
    for(j=0;j<m;j++){ A.push(new Array(m).fill(0)); b.push(0); }
    for(i=0;i<n;i++) for(j=0;j<m;j++){ b[j]+=J[i][j]*r[i]; for(k=0;k<m;k++) A[j][k]+=J[i][j]*J[i][k]; }
    var improved=false, tries;
    for(tries=0; tries<12; tries++){
      var Ad=A.map(function(row2,jj){ return row2.map(function(v,kk){ return (jj===kk)? v*(1+lam)+1e-12 : v; }); });
      var d=solve(Ad,b); if(!d){ lam*=10; continue; }
      var pn=p.map(function(v,jj){ return v+d[jj]; }), sn=sse(pn);
      if(sn<cur){ p=pn; var rel=(cur-sn)/Math.max(cur,1e-30); cur=sn; lam=Math.max(lam/10,1e-12); improved=true;
                  if(rel<1e-12) it=999; break; }
      lam*=10;
    }
    if(!improved) break;
  }
  var pr={}; names.forEach(function(k2,jj){ pr[k2]=p[jj]; });
  if(kind==='sin' && pr.A<0){ pr.A=-pr.A; pr.phi+=Math.PI; }         /* A は正に、φ は −π〜π に */
  if(kind==='sin'){ while(pr.phi>Math.PI) pr.phi-=2*Math.PI; while(pr.phi<-Math.PI) pr.phi+=2*Math.PI; }
  var f=(kind==='sin')? function(t){ return pr.A*Math.sin(pr.w*t+pr.phi)+pr.C; } : function(t){ return pr.A*Math.exp(pr.k*t)+pr.C; };
  return { type:kind, p:pr, r2:r2of(ys, xs.map(f)), f:f, init:true };
}
/* init：③で入れた「パラメーターの初期値」（正弦・指数だけ。直線・放物線は一度で決まるので使わない） */
function doFit(kind, xs, ys, init){
  if(xs.length<2) return null;
  if(init && (kind==='sin'||kind==='exp') && Object.keys(init).some(function(k){ return isFinite(init[k]); })){
    var auto=(kind==='sin')? sinFit(xs,ys) : expFit(xs,ys);
    var p0={}, keys=(kind==='sin')? ['A','w','phi','C'] : ['A','k','C'];
    keys.forEach(function(k){ p0[k]=isFinite(init[k])? init[k] : (auto? auto.p[k] : (k==='w'? 1 : k==='k'? -1 : 0)); });
    var r=lmRefine(kind, xs, ys, p0);
    if(r){ r.auto=auto; return r; }
    return auto;
  }
  if(kind==='lin'){
    var c=polyFit(xs,ys,1); if(!c) return null;
    var f=function(t){ return c[1]*t+c[0]; };
    return { type:'lin', p:{a:c[1], b:c[0]}, r2:r2of(ys,xs.map(f)), f:f };
  }
  if(kind==='quad'){
    if(xs.length<3) return null;
    var q=polyFit(xs,ys,2); if(!q) return null;
    var f2=function(t){ return q[2]*t*t+q[1]*t+q[0]; };
    return { type:'quad', p:{a:q[2], b:q[1], c:q[0]}, r2:r2of(ys,xs.map(f2)), f:f2 };
  }
  if(kind==='sin') return sinFit(xs,ys);
  if(kind==='exp') return expFit(xs,ys);
  return null;
}
function fitLabel(fit){
  if(!fit) return '';
  var p=fit.p;
  if(fit.type==='lin')  return 'y = a t + b,  a = '+sig(p.a,5)+',  b = '+sig(p.b,5);
  if(fit.type==='quad') return 'y = a t² + b t + c,  a = '+sig(p.a,5)+',  b = '+sig(p.b,5)+',  c = '+sig(p.c,5);
  if(fit.type==='sin')  return 'y = A sin(ω t + φ) + C,  A = '+sig(p.A,5)+',  ω = '+sig(p.w,5)+',  φ = '+sig(p.phi,4)+',  C = '+sig(p.C,5);
  if(fit.type==='exp')  return 'y = A e^(k t) + C,  A = '+sig(p.A,5)+',  k = '+sig(p.k,5)+',  C = '+sig(p.C,5);
  return '';
}

/* ---------- 保存（localStorage） ---------- */
var LSKEY = 'motion-analysis-v1';
function packState(){
  return { ver:VER, cur:APP.cur, menuPos:APP.menuPos, axisDisp:APP.axisDisp, cg:APP.cg, gsize:APP.gsize, energyOn:APP.energyOn, momOn:APP.momOn, gMin:APP.gMin, tblw:APP.tblw, m2mode:APP.m2mode, twoObj:APP.twoObj, aFit:APP.aFit, panelw:APP.panelw, m2menu:APP.m2menu, m3menu:APP.m3menu, vidh:APP.vidh,
           exps:APP.exps.map(function(e){
             var o=JSON.parse(JSON.stringify(e));
             return o;                                  /* 動画そのものは保存しない */
           }) };
}
/* 保存された実験に足りない項目をおぎなう */
function normExp(e){
  var d=newExp(1);
  var hadOrigin=!!e.origin, hadFlag=('originSet' in e);
  for(var k in d) if(!(k in e)) e[k]=d[k];
  if(hadOrigin && !hadFlag) e.originSet=true;      /* 前の版のデータは「決めずみ」あつかい */
  /* 保存データが壊れていても、ここで形をそろえておく
     （読み込んだあとで表やグラフを作るときに落ちないように） */
  if(!Array.isArray(e.objs)) e.objs=[[],[],[]];
  for(var j=0;j<e.objs.length;j++){
    if(!Array.isArray(e.objs[j])){ e.objs[j]=[]; continue; }
    e.objs[j]=e.objs[j].filter(function(q){
      return q && typeof q==='object' &&
             typeof q.t==='number' && isFinite(q.t) &&
             typeof q.x==='number' && isFinite(q.x) &&
             typeof q.y==='number' && isFinite(q.y);
    }).sort(function(a,b){ return a.t-b.t; });
  }
  while(e.objs.length<NOBJ) e.objs.push([]);
  if(!(e.mPerPx>0)) e.mPerPx=null;
  if(e.origin && !(isFinite(e.origin.x) && isFinite(e.origin.y))){ e.origin=null; e.originSet=false; }
  if(!isFinite(e.angle)) e.angle=0;
  if(!Array.isArray(e.ref)) e.ref=[];
  if(!e.objReady || e.objReady.length<NOBJ) e.objReady=[!!e.trackReady,false,false];
  if(!Array.isArray(e.objEnd) || e.objEnd.length<NOBJ) e.objEnd=[false,false,false];
  if(['y-','y+','x-','x+'].indexOf(e.gDir)<0) e.gDir='y-';
  return e;
}
function applyState(st){
  if(!st||!st.exps||!st.exps.length) return false;
  APP.exps = st.exps.map(normExp);
  APP.cur = Math.min(st.cur||0, APP.exps.length-1);
  if(st.menuPos) APP.menuPos=st.menuPos;
  if(st.axisDisp) APP.axisDisp=st.axisDisp;
  if(st.cg) for(var k in st.cg) APP.cg[k]=st.cg[k];
  if(st.gsize>0) APP.gsize=st.gsize;
  APP.energyOn=!!st.energyOn;
  APP.momOn=!!st.momOn;
  APP.gMin=(st.gMin && typeof st.gMin==='object')? st.gMin : {};
  if(st.tblw>0) APP.tblw=st.tblw;
  if(st.m2mode) APP.m2mode=st.m2mode;
  APP.twoObj=!!st.twoObj;
  APP.aFit=!!st.aFit;
  if(st.panelw>=0 && st.panelw!==undefined) APP.panelw=st.panelw;
  if(st.m2menu!==undefined) APP.m2menu=!!st.m2menu;
  if(st.m3menu!==undefined) APP.m3menu=!!st.m3menu;
  if(st.vidh>=0 && st.vidh!==undefined) APP.vidh=st.vidh;
  return true;
}
function saveLocal(){
  if(!APP.autosave) return;
  try{
    localStorage.setItem(LSKEY, JSON.stringify(packState()));
    if(saveFailed){ saveFailed=false; showSaveState(); }
  }catch(e){
    /* この画面に置ける量を超えた／保存が使えないブラウザ。
       黙って止まると、生徒は保存できているつもりで閉じてしまう */
    if(!saveFailed){ saveFailed=true; showSaveState();
      try{ toast('この画面に自動保存できませんでした。CSV や Excel で保存してください'); }catch(e2){}
    }
  }
}
var saveFailed=false;
function showSaveState(){
  var el0=(typeof $==='function') && $('saveState'); if(!el0) return;
  if(saveFailed){
    el0.innerHTML='<b class="ng">自動保存できていません</b>（この画面に置ける量を超えました）。'+
                  'CSV や Excel で保存してください。';
  } else {
    el0.textContent = APP.autosave?
      'トラッキングデータ等は自動保存されます。動画をもう一度開くと続きからできます。' :
      '自動保存はOFFです。';
  }
}
function loadLocal(){
  try{ var s=localStorage.getItem(LSKEY); if(!s) return false; return applyState(JSON.parse(s)); }
  catch(e){ return false; }
}
function wipeLocal(){ try{ localStorage.removeItem(LSKEY); }catch(e){} }
