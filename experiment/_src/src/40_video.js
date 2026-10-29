/* =========================================================
   40_video.js … 動画の読み込み・コマ送り・実測時刻
   ここが精度の要。1コマ = 1/30 秒と決めつけず、各コマの実測時刻を使う。
   ========================================================= */
var VID = { el:null, url:null, name:'', w:0, h:0, natW:0, natH:0, dur:0, ready:false,
            fps:30, fpsSrc:'既定値', frames:[], idx:-1, cur:0, hasRVFC:false,
            playing:false, q:Promise.resolve(), building:false, cancelBuild:false, exact:false, rvfcFails:0, limit:null,
            tableA:0, tableB:0, loadSeq:0 };

function vidInit(){
  VID.el = $('vid');
  VID.hasRVFC = ('requestVideoFrameCallback' in HTMLVideoElement.prototype);
}

/* ---------- 読み込み ---------- */
function vidLoad(src, name){
  return new Promise(function(res, rej){
    var v=VID.el;
    /* 前の動画の読み込み・コマ時刻の測定を、ここで打ち切る
       （生徒が続けざまに動画を選ぶと、前の測定の結果が新しい動画に混ざるため） */
    VID.loadSeq=(VID.loadSeq||0)+1; VID.cancelBuild=true;
    VID.ready=false; VID.frames=[]; VID.idx=-1; VID.cur=0; VID.tableA=0; VID.tableB=0;
    try{ diagReset(); }catch(e){}
    if(VID.url && VID.url.indexOf('blob:')===0){ try{URL.revokeObjectURL(VID.url);}catch(e){} }
    VID.url=src; VID.name=name||'';
    var done=false;
    var to=setTimeout(function(){ if(done) return; done=true;
      rej(new Error('timeout')); }, 20000);
    function ok(){
      if(done) return;
      if(!v.videoWidth){ return; }                 /* まだ来ていない */
      done=true; clearTimeout(to);
      VID.natW=v.videoWidth; VID.natH=v.videoHeight;
      VID.w=v.videoWidth; VID.h=v.videoHeight;
      VID.dur=(isFinite(v.duration)&&v.duration>0)?v.duration:0;
      VID.ready=true;
      if(!VID.dur){                                 /* webm 等で duration が出ないときの定石 */
        v.currentTime=1e6;
        var t2=setTimeout(function(){ res(); }, 1200);
        v.addEventListener('timeupdate', function h(){
          if(isFinite(v.duration)&&v.duration>0){ VID.dur=v.duration; v.removeEventListener('timeupdate',h);
            clearTimeout(t2); v.currentTime=0; res(); }
        });
      } else res();
    }
    v.addEventListener('loadeddata', ok, {once:false});
    v.addEventListener('canplay', ok, {once:false});
    v.addEventListener('error', function(){
      if(done) return; done=true; clearTimeout(to);
      rej(v.error||new Error('error'));
    }, {once:true});
    v.src=src;
    v.load();
  });
}
function vidErrMsg(err, fname){
  var isMov = /\.(mov|hevc|heic)$/i.test(fname||'');
  var s='<b>この動画は、この端末（ブラウザ）では開けませんでした。</b><br>';
  if(isMov) s+='iPhone・iPad で撮った .MOV は HEVC という形式のことが多く、Windows の Chrome では再生できないことがあります。<br>';
  s+='<b>対処法</b><ul style="margin:6px 0 0 1.1em;padding:0">'
   + '<li>iPhone/iPad：<b>設定 → カメラ → フォーマット → 「互換性優先」</b>にして撮り直す（H.264 になります）</li>'
   + '<li>すでに撮った動画：iPhone の写真アプリから <b>メールやAirDrop で「自動」画質で送る</b>と H.264 に変換されます</li>'
   + '<li>その動画のまま使いたいとき：<b>Mac / iPad の Safari</b> で、このページを開くと再生できることがあります</li>'
   + '<li>PC なら、動画を <b>MP4（H.264）</b> に変換してから読み込んでください</li></ul>';
  return s;
}

/* ---------- シーク（実際の表示コマの時刻を読み直す） ---------- */
function vidSeek(t){
  VID.q = VID.q.then(function(){ return vidSeekNow(t); });
  return VID.q;
}
function vidSeekNow(t){
  return new Promise(function(res){
    var v=VID.el;
    if(!VID.ready){ res(0); return; }
    if(typeof t!=='number' || !isFinite(t)) t=0;   /* 数でない時刻が来ても動画を壊さない */
    t = Math.max(0, Math.min((VID.dur||0)-0.0005, t));
    if(!isFinite(t)) t=0;
    /* 解析する時間範囲が決まったら、その外へは動かさない（コマ表づくり中は別） */
    if(VID.limit && !VID.building) t = Math.max(VID.limit.a, Math.min(VID.limit.b, t));
    var done=false;
    function fin(mt, exact){
      if(done) return; done=true;
      VID.exact=!!exact;
      v.removeEventListener('seeked', onSeeked);
      VID.cur = snapToFrame(mt); VID.idx = frameIndexAt(VID.cur);
      res(VID.cur);
    }
    var to=setTimeout(function(){ fin(v.currentTime,false); }, 2500);
    function afterSeek(){
      if(VID.hasRVFC){
        /* 実測時刻の読み取りを待つ時間。コマ表があれば時刻はそこから分かるので短くてよい。
           この端末で読み取りが働かないと分かったら、待たずに進む（操作を軽くするため）。 */
        var to2, fb=function(){ clearTimeout(to); VID.rvfcFails=(VID.rvfcFails||0)+1;
              fin(v.currentTime,false); };
        if(VID.needExact){
          to2=setTimeout(fb, 700);            /* コマ表の修復中は実測時刻をしっかり待つ */
        } else if(VID.frames.length>1){
          /* コマ表があるときは時刻が表から分かるので、描画が1回まわるのを待つだけでよい（軽い） */
          to2=setTimeout(function(){ requestAnimationFrame(function(){ requestAnimationFrame(fb); }); }, 0);
        } else {
          to2=setTimeout(fb, 420);      /* コマ表が無いときは実測時刻を待つ */
        }
        v.requestVideoFrameCallback(function(now, md){
          if(done) return;
          clearTimeout(to2); clearTimeout(to);
          var ok=(md && typeof md.mediaTime==='number');
          if(ok) VID.rvfcFails=0;
          fin(ok? md.mediaTime : v.currentTime, ok);
        });
      } else { clearTimeout(to); fin(v.currentTime,false); }
    }
    function onSeeked(){ afterSeek(); }
    v.addEventListener('seeked', onSeeked);
    if(Math.abs(v.currentTime - t) < 1e-7){ v.removeEventListener('seeked',onSeeked); afterSeek(); }
    else v.currentTime = t;
  });
}
/* コマ表があるときは、いま表示されているコマの「表の時刻」に合わせる。
   （シークで要求した時刻と、実際に出ているコマの時刻はずれるため） */
function snapToFrame(t){
  var f=VID.frames;
  if(f.length<2) return t;
  var i=frameIndexAt(t);
  var half=0.6/(VID.fps||30);
  if(Math.abs(t-f[i])<=half) return f[i];
  return t;
}
function frameIndexAt(t){
  var f=VID.frames; if(!f.length) return -1;
  var lo=0, hi=f.length-1;
  if(t<=f[0]+1e-9) return 0;
  if(t>=f[hi]) return hi;
  while(hi-lo>1){ var m=(lo+hi)>>1; if(f[m]<=t+1e-9) lo=m; else hi=m; }
  return lo;
}
/* 測った時刻の一覧が、その時刻をふくんでいるか（一部だけ測ったときのため） */
function tableCovers(t){
  var f=VID.frames; if(f.length<2) return false;
  var m=1.5/(VID.fps||30);
  return t>=f[0]-m && t<=f[f.length-1]+m;
}
/* n コマ進む（負なら戻る）。測った時刻があればそれに従い、無ければ 1/fps ずつ。 */
function vidStep(n){
  var fps=VID.fps>0?VID.fps:30;
  if(VID.frames.length>1 && tableCovers(VID.cur)){
    var i=(VID.idx>=0?VID.idx:frameIndexAt(VID.cur));
    var j=Math.max(0, Math.min(VID.frames.length-1, i+n));
    return vidSeek(frameSeekTime(j));
  }
  return vidSeek(VID.cur + n/fps + 0.25/fps);
}
function frameSeekTime(j){
  var f=VID.frames;
  var a=f[j], b=(j+1<f.length? f[j+1] : a + 1/(VID.fps||30));
  return a + (b-a)*0.45;            /* コマの真ん中あたりを狙う（境界のズレ対策） */
}
function vidGotoFrame(j){
  if(typeof j!=='number' || !isFinite(j)) j=0;
  if(VID.frames.length>1){
    j=Math.max(0,Math.min(VID.frames.length-1,Math.round(j)));
    return vidSeek(frameSeekTime(j));
  }
  return vidSeek(j/(VID.fps||30) + 0.25/(VID.fps||30));
}

/* ---------- コマ表づくり（実測時刻の取得） ---------- */
function vidBuildTable(onProg, tA, tB){
  return new Promise(function(res){
    var v=VID.el;
    if(!VID.ready || !VID.hasRVFC){ res(false); return; }
    var myseq=VID.loadSeq;          /* 測っている途中で別の動画になったら、結果は捨てる */
    VID.building=true; VID.cancelBuild=false;
    /* tA〜tB を渡すと、その部分だけ測る（長い動画で、解析する範囲だけを速く測るため） */
    var A=(typeof tA==='number' && tA>0)? tA : 0;
    var B=(typeof tB==='number' && tB>A)? Math.min(tB, VID.dur) : VID.dur;
    var span=Math.max(0.001, B-A);
    VID.tableA=A; VID.tableB=B;            /* どこからどこまでを測ったか（取りこぼし直しで使う） */
    var times=[], rate = (span>40? 2 : 1);
    v.pause(); v.muted=true; v.playbackRate=rate;
    diagStart();                       /* 撮れぐあいも、この再生のついでに測る */
    var startedAt=0;
    function step(now, md){
      if(VID.cancelBuild || finished){ finish(); return; }
      var mt=(md&&typeof md.mediaTime==='number')? md.mediaTime : v.currentTime;
      if(!times.length || mt > times[times.length-1]+1e-6) times.push(mt);
      if(VDIAG.on){
        var t0=performance.now();
        try{ diagStep(); }catch(e){ VDIAG.on=false; }
        /* おそい端末で再生の足を引っぱるようなら、撮れぐあいの測定はあきらめる */
        if(performance.now()-t0>30) VDIAG.on=false;
      }
      if(onProg) onProg(Math.max(0, Math.min(1, (mt-A)/span)));
      if(v.ended || mt>=B){ finish(); return; }
      v.requestVideoFrameCallback(step);
    }
    var watchdog=null;
    var finished=false;
    function finish(){
      if(finished) return; finished=true;
      clearInterval(watchdog);
      v.pause(); v.playbackRate=1;
      VDIAG.on=false; VDIAG.done=(VDIAG.n>0);
      v.removeEventListener('ended', onEnd);
      if(myseq!==VID.loadSeq){ VID.building=false; res(false); return; }   /* 別の動画になった */
      times.sort(function(a,b){return a-b;});
      var uniq=[]; for(var i=0;i<times.length;i++){ if(!uniq.length||times[i]-uniq[uniq.length-1]>1e-5) uniq.push(times[i]); }
      if(uniq.length>2){
        VID.frames=uniq; setFpsFromFrames();
        /* 取りこぼしたコマを、実際にシークして測り直して埋める。
           ただし時間を区切る（穴が多いと何分もかかって「固まった」ように見えるため）。 */
        var deadline=performance.now()+Math.min(15000, 4000+span*700);
        repairTable(0, deadline, onProg).then(function(){
          trimTable();                 /* 穴があったら、続いている所だけを残す */
          vidSeek(Math.max(A, VID.tableA||A)).then(function(){
            VID.building=false; res(VID.frames.length>2);
          });
        });
      } else vidSeek(A).then(function(){ VID.building=false; res(false); });
    }
    function onEnd(){ finish(); }
    v.addEventListener('ended', onEnd);
    var last=-1, stall=0;
    watchdog=setInterval(function(){
      if(finished) return;
      var c=v.currentTime;
      if(Math.abs(c-last)<1e-4){ stall++; if(stall>12) finish(); } else { stall=0; last=c; }
    }, 400);
    vidSeekNow(A).then(function(){
      times.push(VID.cur);            /* 先頭のコマは再生開始前なので、ここで入れておく */
      v.requestVideoFrameCallback(step);
      var p=v.play();
      if(p && p.catch) p.catch(function(){ finish(); });
    });
  });
}

/* fps はコマ間隔の「まん中あたり」の平均から出す。
   （(コマ数-1)/全体の長さ だと、測りもらしが1つでもあると大きく狂う） */
function setFpsFromFrames(){
  var f=VID.frames, i;
  if(f.length<3) return;
  var d=[]; for(i=1;i<f.length;i++) d.push(f[i]-f[i-1]);
  var sd=d.slice().sort(function(a,b){return a-b;}), med=sd[Math.floor(sd.length/2)];
  /* 測りもらしで空いた所（＝中央値よりずっと広い間隔）は、平均に入れない */
  var sum=0, n=0;
  for(i=0;i<d.length;i++) if(d[i] < med*1.6){ sum+=d[i]; n++; }
  var mean=n? sum/n : med;
  if(mean>0){ VID.fps=1/mean; VID.fpsSrc='実測した時刻から'; }
}
/* 測れた所と測れなかった所がまざっていると、コマ送りも自動追跡も狂う。
   いちばん長い「切れ目のない並び」だけを残し、そこを「測れた範囲」とする。 */
function trimTable(){
  var f=VID.frames, i;
  VID.tablePartial=false;
  if(f.length<3) return;
  var d=[]; for(i=1;i<f.length;i++) d.push(f[i]-f[i-1]);
  var sd=d.slice().sort(function(a,b){return a-b;}), med=sd[Math.floor(sd.length/2)];
  var bestA=0, bestB=0, a0=0;
  for(i=1;i<f.length;i++){
    if(f[i]-f[i-1] > med*3){
      if(i-1-a0 > bestB-bestA){ bestA=a0; bestB=i-1; }
      a0=i;
    }
  }
  if(f.length-1-a0 > bestB-bestA){ bestA=a0; bestB=f.length-1; }
  if(bestB-bestA+1 < f.length){                 /* 穴があった＝一部しか測れていない */
    VID.frames=f.slice(bestA, bestB+1);
    VID.tablePartial=true;
  }
  var g=VID.frames;
  if(g.length<6 || (g[g.length-1]-g[0])<0.3){   /* 短すぎて使えない */
    VID.frames=[]; VID.tableA=0; VID.tableB=0; VID.tablePartial=true;
    VID.fpsSrc='（測れませんでした）';
    return;
  }
  VID.tableA=g[0]; VID.tableB=g[g.length-1];
  setFpsFromFrames();
}
/* 間隔が飛んでいる所を、その真ん中へシークして実測時刻を読み、表に入れる */
function repairTable(pass, deadline, onProg){
  if(pass>4){ VID.needExact=false; return Promise.resolve(); }
  if(deadline && performance.now()>deadline){ VID.needExact=false; return Promise.resolve(); }
  VID.needExact=true;
  var f=VID.frames, d=[], i;
  for(i=1;i<f.length;i++) d.push(f[i]-f[i-1]);
  if(!d.length) return Promise.resolve();
  var sd=d.slice().sort(function(a,b){return a-b;}), med=sd[Math.floor(sd.length/2)];
  var gaps=[], WIDE=med*12;      /* これより広い穴は「測れなかった所」。埋めにいかない */
  for(i=1;i<f.length;i++){
    var w=f[i]-f[i-1];
    if(w > med*1.6 && w < WIDE) gaps.push([f[i-1], f[i]]);
  }
  /* 末尾のコマ（一部だけ測ったときは、そのおわりまで） */
  var END=(typeof VID.tableB==='number' && VID.tableB>0)? VID.tableB : VID.dur;
  var wt=END - f[f.length-1];
  if(wt > med*1.6 && wt < WIDE) gaps.push([f[f.length-1], END]);
  if(!gaps.length || gaps.length>200){ VID.needExact=false; return Promise.resolve(); }
  var k=0, added=0, tries=0;
  function next(){
    if(k>=gaps.length || (deadline && performance.now()>deadline)){
      VID.needExact=false;
      if(added){ VID.frames.sort(function(a,b){return a-b;}); setFpsFromFrames();
        if(k>=gaps.length) return repairTable(pass+1, deadline, onProg); }
      return Promise.resolve();
    }
    if(onProg && (k%3===0)) onProg(1, '取りこぼしたコマを測り直しています（'+(k+1)+' / '+gaps.length+'）');
    var g=gaps[k], t=(g[0]+g[1])/2 + (tries*0.0007);
    return vidSeekNow(t).then(function(){
      var mt=VID.cur, ok=false;
      if(VID.exact && mt>g[0]+med*0.4 && mt<g[1]-med*0.4){ VID.frames.push(mt); added++; ok=true; }
      if(ok || tries>=3){ k++; tries=0; } else { tries++; }   /* 読めなければ数回やり直す */
      return next();
    });
  }
  return next();
}

/* ---------- 現在のコマを描く ---------- */
function vidDrawFull(){
  var c=$('cvFull');
  if(!VID.ready) return c;
  if(c.width!==VID.w || c.height!==VID.h){ c.width=VID.w; c.height=VID.h; }
  var g=c.getContext('2d', {willReadFrequently:true});
  try{ g.drawImage(VID.el, 0,0, VID.w, VID.h); }catch(e){}
  return c;
}
function fpsFromTable(){
  if(VID.frames.length>2){
    var d=[], i;
    for(i=1;i<VID.frames.length;i++) d.push(VID.frames[i]-VID.frames[i-1]);
    d.sort(function(a,b){return a-b;});
    var med=d[Math.floor(d.length/2)];
    var jitter=(d[d.length-1]-d[0]);
    return { fps: med>0? 1/med : 0, n:VID.frames.length, vfr: jitter> (med*0.25) };
  }
  return null;
}

/* =========================================================
   この動画の「撮れぐあい」を、コマ表を作るついでに調べる
   （余分なシークはしない。再生しながら小さく描き写して測るだけ）
   ・明るさ … 暗いと 1 コマ 1 コマがぼやけて、点が打ちにくい
   ・コマのくっきりさ … 動きが速い・暗いとコマがぶれる（相対で見る）
   ・手ぶれ … となりあう 2 コマで、背景がどれだけずれたか
   ここでは「良い・悪い」を数で決めつけず、生徒が気づけるようにするのが目的。
   ========================================================= */
var VDIAG = { on:false };
var DGW = 320;                          /* 測るときの小さい絵の幅 */
function diagReset(){
  VDIAG = { on:false, cv:null, g:null, sc:1, fc:0, n:0, lumSum:0, dark:0,
            sharp:[], shake:[], prev:null, pairWait:false, samples:0, done:false };
}
diagReset();
function diagStart(){
  diagReset();
  if(!VID.ready || !VID.w || !VID.h) return;
  var c=document.createElement('canvas');
  c.width=DGW; c.height=Math.max(8, Math.round(DGW*VID.h/VID.w));
  VDIAG.cv=c; VDIAG.g=c.getContext('2d', {willReadFrequently:true});
  VDIAG.sc=VID.w/DGW;                   /* 小さい絵の 1 px は、もとの動画の何 px か */
  VDIAG.on=true;
}
function diagGray(){
  var c=VDIAG.cv, g=VDIAG.g;
  if(!c||!g) return null;
  try{ g.drawImage(VID.el, 0,0, c.width, c.height); }catch(e){ VDIAG.on=false; return null; }
  var im; try{ im=g.getImageData(0,0,c.width,c.height); }catch(e){ VDIAG.on=false; return null; }
  var p=im.data, w=c.width, h=c.height, N=w*h, gr=new Uint8Array(N), s=0, i, j;
  for(i=0,j=0;i<N;i++,j+=4){ var y=(p[j]*77+p[j+1]*150+p[j+2]*29)>>8; gr[i]=y; s+=y; }
  var lum=s/N;
  var lap=0, cnt=0, x, yy;
  for(yy=1; yy<h-1; yy+=2) for(x=1; x<w-1; x+=2){
    var k=yy*w+x;
    var L=4*gr[k]-gr[k-1]-gr[k+1]-gr[k-w]-gr[k+w];
    lap += (L<0? -L : L); cnt++;
  }
  /* 明るさで割って正規化（暗い動画でも公平に比べられるように） */
  return { g:gr, w:w, h:h, lum:lum, sharp: cnt? (lap/cnt)/Math.max(24,lum) : 0 };
}
/* となりあう 2 コマの「背景のずれ」を測る（真ん中は物体がいるので使わない） */
function diagShift(a, b, w, h){
  var R=5, cx0=w>>2, cx1=w-(w>>2), cy0=h>>2, cy1=h-(h>>2);
  var best=1e18, bx=0, by=0, sc={}, dx, dy, x, y;
  for(dy=-R; dy<=R; dy++) for(dx=-R; dx<=R; dx++){
    var s=0, n=0;
    for(y=R; y<h-R; y+=2){
      var inY=(y>=cy0 && y<cy1);
      for(x=R; x<w-R; x+=2){
        if(inY && x>=cx0 && x<cx1) continue;
        var d=a[y*w+x]-b[(y+dy)*w+(x+dx)];
        s += (d<0? -d : d); n++;
      }
    }
    if(!n) return null;
    var v=s/n; sc[dx+','+dy]=v;
    if(v<best){ best=v; bx=dx; by=dy; }
  }
  /* 山の形から、1 px より細かく読む（放物線あてはめ） */
  function sub(ax, ay, kx, ky){
    var m=sc[(ax-kx)+','+(ay-ky)], p=sc[(ax+kx)+','+(ay+ky)];
    if(m===undefined||p===undefined) return 0;
    var den=(m - 2*best + p);
    if(!(Math.abs(den)>1e-9)) return 0;
    var t=0.5*(m-p)/den;
    return (t>1||t<-1)? 0 : t;
  }
  var fx=bx+sub(bx,by,1,0), fy=by+sub(bx,by,0,1);
  return Math.sqrt(fx*fx+fy*fy);
}
/* コマ表づくりの再生中に、1 コマごとに呼ばれる */
function diagStep(){
  var d=VDIAG;
  if(!d.on || d.samples>=30) return;
  var k=d.fc++;
  var take=(k%8===0);
  if(!take && !d.pairWait) return;
  var gy=diagGray();
  if(!gy){ d.pairWait=false; d.prev=null; return; }
  d.n++; d.lumSum+=gy.lum; if(gy.lum<50) d.dark++;
  d.sharp.push(gy.sharp);
  if(d.pairWait && d.prev){
    var s=diagShift(d.prev, gy.g, gy.w, gy.h);
    if(s!==null && isFinite(s)) d.shake.push(s*d.sc);   /* もとの動画の px に直す */
    d.pairWait=false; d.prev=null; d.samples++;
  } else if(take){
    d.prev=gy.g; d.pairWait=true;
  }
}
function med(a){ if(!a.length) return null;
  var b=a.slice().sort(function(x,y){return x-y;}); return b[Math.floor(b.length/2)]; }
/* 測った結果をまとめる（無ければ null） */
function diagResult(){
  var d=VDIAG;
  if(!d.n) return null;
  var sh=med(d.shake), sp=d.sharp.slice().sort(function(a,b){return a-b;});
  return {
    lum: d.lumSum/d.n,
    darkRate: d.dark/d.n,
    shake: sh,                                   /* 1 コマあたり何 px 動いたか */
    shakePct: (sh!==null && VID.w)? sh/VID.w*100 : null,
    sharpMed: sp.length? sp[Math.floor(sp.length/2)] : null,
    sharpMax: sp.length? sp[sp.length-1] : null,
    n: d.n, pairs: d.shake.length
  };
}
