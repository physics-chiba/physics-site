/* =========================================================
   80_ui.js … 画面まわりの配線
   ========================================================= */
var KADAI_SRC = { data:null, type:'', size:0 };
var ORIGINAL_HTML = '';
var SAMPLES = [ {f:'samples/uniform.mp4', n:'等速直線運動'}, {f:'samples/circular.mp4', n:'円運動（だんだん止まる）'} ];

/* 動画の真ん中に出す確認メッセージ（空文字で消す） */
function calMsg(html){
  var m=$('calMsg'); if(!m) return;
  if(!html){ m.className='hide'; m.innerHTML=''; return; }
  m.className=''; m.innerHTML=html;
  var h=$('vhint'); if(h) h.classList.add('hide');    /* 上の吹き出しとかさならないように */
  clearTimeout(m.__t);
  m.__t=setTimeout(function(){ m.classList.add('hide'); }, 6700);   /* 最初の 9.0 秒から 2.3 秒みじかく */
}
/* 読み込み中・コマ表づくり中は、ボタンを押せないようにする */
function setBusy(on, msg, sub){
  var b=$('busyLock'); if(!b) return;
  if(on){
    $('busyMsg').textContent=msg||'処理しています…';
    $('busySub').innerHTML=sub||'終わるまで、ボタンは押せません。';
    b.classList.remove('hide');
  } else b.classList.add('hide');
}
function busyProg(f){
  var p=$('busyProg'); if(!p) return;
  if(f===null||f===undefined){ p.classList.add('hide'); return; }
  p.classList.remove('hide');
  p.querySelector('i').style.width=Math.round(Math.max(0,Math.min(1,f))*100)+'%';
}
/* 動画エリアの最初の案内（リセット後も同じ文にもどす） */
var VPH_HTML='<span class="hl">ここをクリック</span>して<b>動画を選択</b>してください。<br>このエリアに<span class="hl">ドラッグ＆ドロップ</span>でもOK'+
  '<div class="note vlimit"><b>解析できる動画のめやす</b><br>長さ <b>5〜30 秒</b>（<b>40 秒まで</b>。長いほど解析に時間がかかります）／'+
  '画質は <b>フルHD（1920×1080）まで</b>／ファイルは <b>100 MB 以内</b>。<br>'+
  '<span class="mini" style="color:inherit">40 秒より長い動画は開けません。見たい運動の前後だけを切り出してください。'+
  '画面の大きさ 4096 px・500 MB までは開けますが、動作が重くなります。</span></div>';
function toast(msg){
  var t=$('toast'); t.textContent=msg; t.classList.add('on');
  clearTimeout(toast._t); toast._t=setTimeout(function(){ t.classList.remove('on'); }, 1900);
}
function setMode(m){
  UI.mode=m; UI.pend=null;
  document.body.classList.toggle('cropping', m==='crop');
  var lab={record:'クリックで記録', origin:'原点をクリック', scale1:'長さのわかる 1点目をクリック',
           scale2:'2点目をクリック', axis:'x軸の向きへドラッグ', ref:'動かない目印をクリック',
           color:'追いかけたい物体（始点）をクリック',
           radius:'探索半径を円のドラッグで決める'}[m]||'';
  $('modeInfo').textContent=lab;
  $('modeInfo').style.background = (m==='record')?'#eef2f7':'#fff3d6';
  if(typeof APP.step==='number' && APP.step<4 && m==='record') $('modeInfo').textContent='';
  if(typeof APP.step==='number' && APP.step>0) updateTodo();
  ['btnOrigin','btnScale','btnAxis','btnRefPt','btnPickColor'].forEach(function(id){ $(id).classList.remove('on'); });
  if(m==='origin') $('btnOrigin').classList.add('on');
  if(m==='scale1'||m==='scale2') $('btnScale').classList.add('on');
  if(m==='axis') $('btnAxis').classList.add('on');
  if(m==='ref') $('btnRefPt').classList.add('on');
  if(m==='color') $('btnPickColor').classList.add('on');
  $('labSearchR').classList.toggle('hot', m==='radius');
  if(typeof APP.step==='number' && APP.step>0) updateGuide();   /* 案内も出し直す */
  updateCursor();
  drawOverlay();
}
/* 入力欄から「0 より大きい数」を読む。だめなら前の値（それも無ければ既定値）にもどす */
function posNum(el0, prev, def){
  var v=parseFloat(el0 && el0.value);
  if(v>0 && isFinite(v)) return v;
  var back=(prev>0 && isFinite(prev))? prev : def;
  if(el0 && el0.value!==String(back)) el0.value=back;
  return back;
}
/* 何か変わったら呼ぶ：表示を更新して保存 */
function afterChange(){
  var exp=EXP();
  /* 質量と重力加速度は、0 やマイナスだとエネルギーの計算が意味をなさない。
     変な値のときは前の値のまま（入力欄も直す） */
  exp.m1=posNum($('inM1'), exp.m1, 0.1);
  exp.m2=posNum($('inM2'), exp.m2, 0.1);
  if($('inM3')) exp.m3=posNum($('inM3'), exp.m3||0.1, 0.1);
  exp.g =posNum($('inG'),  exp.g,  9.8);
  if($('selGDir') && ['y-','y+','x-','x+'].indexOf($('selGDir').value)>=0) exp.gDir=$('selGDir').value;
  if($('eNoteH')) $('eNoteH').textContent=gDirInfo(exp).h;
  updateCalInfo(); updateTimeLine(); updateTable();
  $('refInfo').textContent='固定点 '+exp.ref.length;
  drawOverlay();
  updateSteps();
  updateRestoreBar();
  saveLocal();
}
/* ---------- 自動追跡の知らせ（見失った・見つけた） ---------- */
function autoMsgShow(html, ok, shortHtml, onClick){
  var m=$('autoMsg'); if(!m) return;
  m.__short=shortHtml||'';
  m.__act=onClick||null;                /* この知らせ自体を押したときにすること */
  m.innerHTML=html;
  m.className='';                       /* hide を外す */
  m.classList.add('big'); if(ok) m.classList.add('ok');
  if(m.__act) m.classList.add('act');
  if(!m.__bound){                       /* 押せる知らせは、押したらそのまま実行する */
    m.__bound=true;
    m.addEventListener('click', function(ev){
      if(!m.__act || m.classList.contains('hide')) return;
      ev.preventDefault(); ev.stopPropagation();
      var f=m.__act; m.__act=null; clearTimeout(m.__to); m.classList.add('hide');
      f();
    });
  }
  clearTimeout(m.__to);
  if(shortHtml){                        /* 大きく出したあと、小さく出しつづける */
    m.__to=setTimeout(function(){
      if(!UI.autoLost && !ok){ m.classList.add('hide'); return; }
      m.innerHTML=shortHtml;
      m.classList.remove('big'); m.classList.add('faint');
      if(m.__act) m.classList.add('act');       /* 小さくなっても、押せば追跡が始まる */
      if(ok) m.__to=setTimeout(function(){ m.classList.add('hide'); }, 6000);
    }, 5000);
  } else {
    m.__to=setTimeout(function(){ m.classList.add('hide'); }, 4000);
  }
}
/* 動画の真ん中に出る「大きな知らせ」（消えるもの）をまとめて扱う */
function bigMsgOpen(){
  var a=$('calMsg'), b=$('autoMsg');
  var calOpen = a && !a.classList.contains('hide') && !a.classList.contains('ask');
  return !!(calOpen || (b && !b.classList.contains('hide') && b.classList.contains('big')));
}
function closeBigMsg(){
  if(!calAskOpen()) calMsg('');          /* はい／いいえ で進める案内は、ここでは消さない */
  var b=$('autoMsg');
  if(b && !b.classList.contains('hide') && b.classList.contains('big')){
    clearTimeout(b.__to);
    if(UI.autoLost && b.__short){ b.innerHTML=b.__short; b.classList.remove('big'); b.classList.add('faint'); }
    else b.classList.add('hide');
  }
}
function autoMsgHide(){ var m=$('autoMsg'); if(m){ clearTimeout(m.__to); m.classList.add('hide'); } }
/* 見失った */
function autoLost(){
  UI.autoLost=true;
  autoMsgShow('見失いました（t = '+nf(VID.cur-(EXP().t0||0),3)+' s）<br>'+
    'ここからは<b>動画の中の物体をクリック</b>して、手で記録してください', false,
    '見失い中：<b>手でクリック</b>して記録してください');
  toast('見失いました。ここから手でクリックして続けてください');
  updateGuide(); updateTodo();
}
/* 手でクリックしたときに、また色が見つかったかどうかを見る */
function autoFoundCheck(vx, vy){
  if(!UI.autoLost || !APP.autoTrack || !APP.trackColor) return;
  var TH=parseInt($('inColTh').value)||60;
  var f=findColor(vx, vy, Math.max(14, (parseInt($('inSearchR').value)||40)*0.5), TH);
  if(!f) return;
  UI.autoLost=false;
  APP.startPt={x:f.x, y:f.y, t:VID.cur};
  autoMsgShow('見つけました！　<b>最後まで追跡</b> しますか？', true,
    '見つけました！　<b>最後まで追跡</b> しますか？',
    function(){ var b=$('btnAutoRun'); if(b) b.click(); });
  toast('色を見つけました。この知らせを押すと、最後まで追跡します');
  updateGuide(); updateTodo();
}
/* ---------- 表の中の「いまのトラッキング点」の矢印 ---------- */
function lastPtOf(obj){
  var a=EXP().objs[obj]; if(!a||!a.length) return null;
  var p=a[0];
  for(var i=1;i<a.length;i++) if(a[i].t>p.t) p=a[i];
  return p;
}
function markTrkPoint(){
  var mk=$('trkMk'); if(!mk) return;
  var p=(effStep()>=4)? lastPtOf(UI.obj) : null;
  if(!p){ mk.classList.add('hide'); return; }
  var half=0.5/(VID.fps||30), tb=$('dataTbl'), row=null;
  for(var i=0;i<tb.rows.length;i++){
    var dt=tb.rows[i].dataset? tb.rows[i].dataset.t : null;
    if(dt!==undefined && dt!==null && dt!=='' && Math.abs(parseFloat(dt)-p.t)<half){ row=tb.rows[i]; break; }
  }
  if(!row){ mk.classList.add('hide'); return; }
  mk.classList.remove('hide');
  mk.style.top=(row.offsetTop+Math.max(0,(row.offsetHeight-15)/2))+'px';
  mk.__t=p.t;
}
/* 矢印を上下にドラッグして、やり直したい時刻をえらぶ */
function bindTrkMark(){
  var mk=$('trkMk'); if(!mk) return;
  var tb=$('dataTbl'), wrap=tb.parentNode, target=null;
  function rowAt(cy){
    var el2=document.elementFromPoint(wrap.getBoundingClientRect().left+30, cy);
    var tr=el2 && el2.closest? el2.closest('tr[data-t]') : null;
    return (tr && tb.contains(tr))? tr : null;
  }
  /* ドラッグ中は、その行の時刻へ動画も巻きもどす（シークは1つずつ、追いつかない分はまとめる） */
  var startT=0, seekBusy=false, wantT=null;
  function liveSeek(t){
    if(!isFinite(t)) return;
    wantT=t;
    if(seekBusy) return;
    seekBusy=true;
    (function go(){
      var tt=wantT; wantT=null;
      vidSeek(tt).then(function(){ afterSeek(); render();
        if(wantT!==null && Math.abs(wantT-tt)>1e-6) go(); else seekBusy=false; });
    })();
  }
  mk.__liveSeek=function(t){ liveSeek(t); };
  mk.addEventListener('pointerdown', function(ev){
    if(mk.classList.contains('hide')) return;
    ev.preventDefault(); ev.stopPropagation();
    mk.setPointerCapture(ev.pointerId); mk.classList.add('drag');
    stopAllPlay(); stopAuto(); target=null; startT=VID.cur; mk.__startT=startT;
  });
  mk.addEventListener('pointermove', function(ev){
    if(!mk.classList.contains('drag')) return;
    ev.preventDefault();
    var tr=rowAt(ev.clientY);
    els('#dataTbl tr.mkrow').forEach(function(r){ r.classList.remove('mkrow'); });
    if(tr){ tr.classList.add('mkrow');
            var tNew=parseFloat(tr.dataset.t);
            if(target!==tr) liveSeek(tNew);          /* 行が変わったら、その時刻の動画を見せる */
            target=tr;
            mk.style.top=(tr.offsetTop+Math.max(0,(tr.offsetHeight-15)/2))+'px';
            UI.markT=tNew; drawOverlay(); }
  });
  mk.addEventListener('pointerup', function(ev){
    if(!mk.classList.contains('drag')) return;
    mk.classList.remove('drag');
    try{ mk.releasePointerCapture(ev.pointerId); }catch(e){}
    els('#dataTbl tr.mkrow').forEach(function(r){ r.classList.remove('mkrow'); });
    UI.markT=null; drawOverlay();
    var tr=target; target=null;
    if(!tr){ markTrkPoint(); return; }
    var tt=parseFloat(tr.dataset.t), half=0.5/(VID.fps||30);
    if(!isFinite(tt) || Math.abs(tt-(mk.__t||0))<half){
      markTrkPoint(); vidSeek(mk.__startT||VID.cur).then(function(){ afterSeek(); render(); }); return;
    }
    askRetrackFrom(tt, mk.__startT);
  });
}
/* 「この時刻からトラッキングをやり直しますか？」 */
function askRetrackFrom(tt, backT){
  var e=EXP(), obj=UI.obj, half=0.5/(VID.fps||30);
  var after=e.objs[obj].filter(function(q){ return q.t>tt+half; }).length;
  var ts=nf(tt-(e.t0||0),4);
  popup('<h2>この時刻からトラッキングをやり直しますか？</h2>'+
    '<p style="font-size:1.04rem">動画を <b>t = '+ts+' s</b> のコマにもどします。</p>'+
    (after? '<p class="mini">この時刻より後に記録した <b>'+after+' 点</b>は消えます（Ctrl＋Z でもどせます）。</p>'
          : '<p class="mini">この時刻より後の点はありません。ここから続けて記録できます。</p>'),
    'やり直す', function(){
      if(after){
        pushUndo({t:'bulk', obj:obj, prev:e.objs[obj].slice()});
        e.objs[obj]=e.objs[obj].filter(function(q){ return q.t<=tt+half; });
      }
      tblFrom=null;
      vidSeek(tt).then(function(){ afterSeek(); afterChange(); render();
        toast('t = '+ts+' s からやり直せます'); });
    }, { noLabel:'やめる', onNo:function(){
        markTrkPoint();
        /* やめたら、動画はドラッグを始める前の時刻にもどす */
        if(typeof backT==='number' && isFinite(backT)) vidSeek(backT).then(function(){ afterSeek(); render(); });
      } });
}
function updateCalInfo(){
  try{ updateDepth(); }catch(e){}
  var exp=EXP();
  $('calInfo').innerHTML='原点：'+(exp.originSet? '<b>設定ずみ</b>':'<span class="ng">未設定</span>')+
    '／スケール：'+(exp.mPerPx? '<b>'+sig(exp.mPerPx*1000,4)+' mm/px</b>':'<span class="ng">未設定</span>')+
    '／x軸：'+nf(exp.angle*180/Math.PI,1)+'°';
  updatePrec();
  $('rangeInfo').innerHTML='解析する時間範囲：'+
    ((exp.t0===null&&exp.rangeB===null)?'動画全体':
     ('<b>'+(exp.t0!==null? nf(exp.t0,3)+' s（t=0）':'先頭')+' 〜 '+
      (exp.rangeB!==null? nf(exp.rangeB,3)+' s':'最後')+'</b>'));
  drawSeekMarks();
}
function updatePrec(){
  var exp=EXP(), cv=$('cvView');
  if(!exp.mPerPx || !VID.ready){ $('precInfo').textContent='クリック精度：スケール未設定'; return; }
  var r=cv.getBoundingClientRect();
  var pxPerCss = r.width? (VID.w/ r.width)/VIEW.zoom : 1;
  var e3 = 3*pxPerCss*exp.mPerPx;      /* 指のずれ3画面px 相当 */
  var e1 = 1*exp.mPerPx;
  $('precInfo').innerHTML='クリック精度：<b>±3画面px ＝ ±'+fmtLen(e3)+'</b>'+
    '<br>（動画の1pxは '+fmtLen(e1)+'。拡大すると精度は上がります）';
}
function updateTimeLine(){
  var exp=EXP();
  var n=VID.frames.length;
  var fr=(n? ((VID.idx+1)+'/'+n) : (VID.dur? Math.round(VID.cur*(VID.fps||30))+1 : '-')+'/-');
  $('frInfo').textContent=fr; $('frInfo2').textContent=fr;
  var t=VID.cur-(exp.t0||0);
  $('tInfo').textContent=nf(t,4); $('tInfo2').textContent=nf(t,4);
  if(VID.dur>0 && !$('seek').matches(':active')) $('seek').value=Math.round(VID.cur/VID.dur*1000);
  updatePrec();
}
/* ===== 測定した値（表） =====
   点が何百もあると、毎回すべての行を作り直すのは重い（2000点で 0.7 秒くらいかかる）。
   そこで、いま見ている所のまわり TBLMAX 点だけを描き、前後は「…」の行にする。
   CSV・グラフ・レポートは、いつでも全部の点を使う。 */
var TBLMAX=150;
var tblFrom=null;                 /* 手で前後に動かしたときの開始位置（null なら自動でいまの点） */
function tblShift(d){
  var e=EXP(), n=0;
  for(var i=0;i<NOBJ;i++) n=Math.max(n, e.objs[i].length);
  if(tblFrom===null) tblFrom=0;
  tblFrom=Math.max(0, Math.min(Math.max(0,n-TBLMAX), tblFrom+d));
  updateTable();
}
function updateTable(){
  var exp=EXP(), objs=[], i;
  for(i=0;i<NOBJ;i++) if(exp.objs[i].length) objs.push(i);
  var t=$('dataTbl'), t2=$('dataTbl2');
  if(!objs.length){
    t.innerHTML='<tr><th>データなし</th></tr>';
    if(t2) t2.innerHTML='<tr><th>データなし</th></tr>';
    markTrkPoint();
    return;
  }
  var showY=useY();
  var ss=objs.map(function(o){ return series(exp,o); });
  /* 速さは「となりの2点の間」の値なので、行と行のあいだに書く（記録タイマーと同じ書き方）。
     加速度はその速さの変わり方なので、また位置と同じ行にもどる。 */

  var idx=useObjIdx(objs);
  var ncol=1+objs.length*(showY?6:3);
  var h='<tr><th>t [s]</th>';
  objs.forEach(function(o){
    var n=idx? (o+1) : '';
    var ak=(aStepOf(exp)>1? '<br><span class="mini">'+esc(aStepLabel(exp))+'</span>' : '');
    h+='<th>x'+n+' [m]</th>'+(showY?'<th>y'+n+' [m]</th>':'')+
       '<th>vx'+n+' [m/s]</th>'+(showY?'<th>vy'+n+' [m/s]</th>':'')+
       '<th>ax'+n+' [m/s²]'+ak+'</th>'+(showY?'<th>ay'+n+' [m/s²]'+ak+'</th>':'');
  });
  h+='</tr>';
  var n0=Math.max.apply(null, ss.map(function(s){return s.length;}));
  var half=0.5/(VID.fps||30), curRow=-1, rowN=0;
  /* いまの時刻にいちばん近い点をさがす（表の窓の中心にする） */
  var cIdx=-1;
  for(i=0;i<n0;i++){
    var r0=null;
    ss.forEach(function(s){ if(s[i]&&r0===null) r0=s[i].raw; });
    if(r0!==null && Math.abs(r0-VID.cur)<half){ cIdx=i; break; }
  }
  var from=0, to=n0;
  if(n0>TBLMAX){
    if(tblFrom!==null) from=Math.max(0, Math.min(n0-TBLMAX, tblFrom));
    else {
      var c=(cIdx>=0? cIdx : n0-1);
      from=Math.max(0, Math.min(n0-TBLMAX, c-Math.round(TBLMAX/2)));
    }
    to=Math.min(n0, from+TBLMAX);
  }
  if(from>0){ h+='<tr class="more" data-d="-1"><td colspan="'+ncol+'">▲ 前の '+from+' 点（クリックで表示）</td></tr>'; rowN++; }
  for(i=from;i<to;i++){
    var tt=null, raw=null;
    ss.forEach(function(s){ if(s[i]&&tt===null){ tt=s[i].t; raw=s[i].raw; } });
    var isCur=(raw!==null && Math.abs(raw-VID.cur)<half);
    if(isCur) curRow=rowN;
    /* 位置と加速度の行 */
    h+='<tr'+(isCur?' class="cur"':'')+' data-i="'+i+'"'+(raw!==null?' data-t="'+raw+'"':'')+
       '><td>'+(tt===null?'':nf(tt,4))+'</td>';
    ss.forEach(function(s){
      var p=s[i];
      h+='<td>'+(p?nf(p.x,4):'')+'</td>'+(showY?'<td>'+(p?nf(p.y,4):'')+'</td>':'')+
         '<td></td>'+(showY?'<td></td>':'')+
         '<td>'+(p&&p.ax!==null?nf(p.ax,3):'')+'</td>'+(showY?'<td>'+(p&&p.ay!==null?nf(p.ay,3):'')+'</td>':'');
    });
    h+='</tr>'; rowN++;
    /* そのつぎの点とのあいだ ＝ 速さの行（半マスずらして見せる） */
    if(i<to-1){
      var anyV=ss.some(function(s){ return s[i] && s[i].vx!==null; });
      if(anyV){
        h+='<tr class="vrow"><td></td>';
        ss.forEach(function(s){
          var p=s[i];
          h+='<td></td>'+(showY?'<td></td>':'')+
             '<td>'+(p&&p.vx!==null?nf(p.vx,3):'')+'</td>'+(showY?'<td>'+(p&&p.vy!==null?nf(p.vy,3):'')+'</td>':'')+
             '<td></td>'+(showY?'<td></td>':'');
        });
        h+='</tr>'; rowN++;
      }
    }
  }
  if(to<n0) h+='<tr class="more" data-d="1"><td colspan="'+ncol+'">▼ 後の '+(n0-to)+' 点（クリックで表示）</td></tr>';
  t.innerHTML=h;
  /* ②の表は、②を見ているときだけ作る（いつも両方作ると2倍の時間がかかる） */
  if(t2 && APP.tab==='2') t2.innerHTML=h;
  [t,t2].forEach(function(tb){
    if(!tb || curRow<0) return;        /* いま記録したところが見えるようにする */
    var tr=tb.rows[curRow+1], wrap=tb.parentNode;
    if(tr && wrap && wrap.scrollHeight>wrap.clientHeight){
      var top=tr.offsetTop-wrap.clientHeight/2+tr.offsetHeight;
      wrap.scrollTop=Math.max(0, top);
    }
  });
  markTrkPoint();
}


/* ---------- 実験の管理 ---------- */
/* 「過去測定データを実験○に登録」の○（次の実験番号）を出しなおす */
/* エネルギーを解析するかどうか（②のチェック・入力欄・Excel出力に効く） */
function setEnergyOn(on){
  APP.energyOn=!!on;
  var b=$('btnEnergyOn');
  updateMassRow();
  if(b){ b.classList.toggle('on', APP.energyOn);
         b.textContent = APP.energyOn? '力学的エネルギーの解析をやめる' : '力学的エネルギーを解析する'; }
  if(!APP.energyOn) $('cbG_e').checked=false;
  if(!$('mode2').classList.contains('hide')) renderMode2();
}
/* 質量の欄は、エネルギーか重心の運動量のどちらかを使うときに出す。g・重力の向き・注はエネルギーのときだけ */
function momOn(){ return !!(APP.momOn && APP.twoObj); }
function updateMassRow(){
  var row=$('energyRow'); if(!row) return;
  var show=APP.energyOn || momOn();
  row.classList.toggle('hide', !show);
  els('.eonly', row).forEach(function(q){ q.classList.toggle('hide', !APP.energyOn); });
  if($('labGP')) $('labGP').classList.toggle('hide', !APP.twoObj);
  if($('cbG_p')) $('cbG_p').checked=momOn();
  if($('selGDir')) $('selGDir').value=EXP().gDir||'y-';
  if($('eNoteH')) $('eNoteH').textContent=gDirInfo(EXP()).h;
}
/* 前回のデータが残っているのに動画がまだ無いとき、はっきり知らせる */
function updateRestoreBar(){
  var bar=$('restoreBar'); if(!bar) return;
  var n=APP.exps.reduce(function(a,e){ return a+e.objs.reduce(function(x,y){return x+y.length;},0); },0);
  var show=(!VID.ready && n>0);
  bar.classList.toggle('hide', !show);
  if(show) $('restoreInfo').textContent='（'+EXP().name+'：'+n+' 点）';
}
function updateOutButtons(){
  var n=APP.exps.length+1, full=(APP.exps.length>=MAXEXP);
  ['btnJsonLoadTop'].forEach(function(id){
    var b=$(id); if(!b) return;
    b.innerHTML = full? '実験はこれ以上<br>増やせません' : ('過去測定データを<br>実験'+n+'に登録');
    b.disabled=full;
  });
}
function refreshExpUI(){
  var s=$('expSel'); s.innerHTML='';
  APP.exps.forEach(function(e,i){
    var o=document.createElement('option'); o.value=i; o.textContent=(i+1)+'. '+e.name; s.appendChild(o);
  });
  s.value=APP.cur;
  $('inM1').value=EXP().m1; $('inM2').value=EXP().m2; if($('inM3')) $('inM3').value=EXP().m3||0.1; $('inG').value=EXP().g;
  if($('selGDir')) $('selGDir').value=EXP().gDir||'y-';
  if($('labM3')) $('labM3').classList.toggle('hide', nObj()<3);
  ['expChecks','expChecks3'].forEach(function(id){
    var host=$(id); host.innerHTML='';
    APP.exps.forEach(function(e,i){
      var l=document.createElement('label');
      l.innerHTML='<input type="checkbox" data-i="'+i+'"'+(i===APP.cur?' checked':'')+'>'+
        '<i style="display:inline-block;width:11px;height:11px;border-radius:3px;background:'+EXPCOL[i%EXPCOL.length]+'"></i>'+
        esc(e.name);
      l.querySelector('input').addEventListener('change', function(){
        if(id==='expChecks') renderMode2(); else renderMode3(false);
      });
      host.appendChild(l);
    });
  });
  if($('cgExpA')) refreshCGExps();
  refreshObjUI();
  updateOutButtons();
  setEnergyOn(APP.energyOn);
  var e=EXP();
  $('selObj').value=String(UI.obj+1);
  $('inObjName').value=e.objName[UI.obj]||'';
  $('cbDrift').checked=!!e.useDrift;
  $('cbYFlip').checked=!!e.yflip;
  $('cbXFlip').checked=!!e.xflip;
  updateAxisButtons();
  applyAxisDisp();
  $('selTScale').value=String(EXP().tscale||1);
  try{ updateFpsLine(); }catch(e){}
  updateRestoreBar();
  if(e.scaleLen>0){                       /* スケール長さの入力欄も実験に合わせる */
    if(e.scaleLen>=1){ $('selScaleUnit').value='1'; $('inScaleLen').value=+(e.scaleLen).toFixed(4); }
    else if(e.scaleLen>=0.01){ $('selScaleUnit').value='0.01'; $('inScaleLen').value=+(e.scaleLen*100).toFixed(3); }
    else { $('selScaleUnit').value='0.001'; $('inScaleLen').value=+(e.scaleLen*1000).toFixed(2); }
  }
}
/* ===== 手順（1→2→3→4）の進み具合 ===== */
function currentStep(){
  var e=EXP();
  if(!VID.ready) return 1;
  if(!((e.t0!==null && e.rangeB!==null) || e.step2ok)) return 2;
  if(!(e.origin && e.originSet && e.axisSet && e.mPerPx)) return 3;
  if(UI.calPend) return 3;                 /* 「スケールはこれでいいですか？」に「はい」と答えるまで */
  return 4;
}
/* 3 に入ったら、原点を画面の中央に置いておく（あとはドラッグで動かす） */
function ensureOrigin(){
  var e=EXP();
  if(!VID.ready || e.origin) return;
  var c=CROP();                       /* トリミングしているときは、その真ん中に置く */
  e.origin={ x:Math.round(c.x+c.w/2), y:Math.round(c.y+c.h/2) };
  e.originSet=false;
}
function stepName(n){ return ['','1. 動画','2. 解析する時間範囲の指定','3. 空間の原点・スケール・軸','4. トラッキング'][n]||''; }
function updateSteps(){
  var st0=currentStep();
  if(st0>=3) ensureOrigin();                          /* 3 では原点を中央に置いておく */
  var st=currentStep(), changed=(APP.step!==st);
  /* 「スケールはこれでいいですか？」に答える前に知らせが消えていたら、出し直す */
  if(st===3 && UI.calPend==='scale' && VID.ready && $('calMsg') && $('calMsg').classList.contains('hide'))
    setTimeout(function(){ if(UI.calPend==='scale' && $('calMsg').classList.contains('hide')) calGuide('scaleOk'); }, 0);
  var ed=(APP.editStep && APP.editStep<st)? APP.editStep : 0;   /* 「もう一度」で開いているカード */
  var edChanged=(APP.lastEdit!==ed); APP.lastEdit=ed;
  APP.step=st;
  if(changed && st>=3) rewindToRangeStart();          /* 3・4へ進んだら解析範囲の先頭へ */
  if(changed && st===4){
    applyRangeLimit();                               /* 先に範囲を効かせてから巻きもどす */
    stopAllPlay();
    setTimeout(rewindToRangeStart, 60);
  }
  if(changed && st>=4){
    setStrobeOverlay(false);                          /* 4に入ったら重ねた写真は外す */
    if(window.innerWidth>=980) setSbs(true);          /* 4 では動画と表を並べておく */
  }
  if(changed||edChanged) setTimeout(foldSideCards, 0);
  els('#side1 details[data-step]').forEach(function(d){
    var n=parseInt(d.dataset.step);
    d.classList.toggle('step-active', n===st || n===ed);
    d.classList.toggle('step-done', n<st && n!==ed);
    d.classList.toggle('step-lock', n>st);
    if(changed||edChanged){
      if(n===st || n===ed) d.open=true;
      else if(n>st) d.open=false;
      else if(n!==4) d.open=false;                   /* 4 はたたまない */
    }
  });
  if(changed||edChanged){
    var howto=el('#side1 details[data-key="howto"]');
    if(howto && st>=2) howto.open=false;        /* 動き出したら操作説明はたたむ */
    var act=el('#side1 details.step-active');
    /* 動画を読みこむ前（開いた直後）はスクロールしない：動画エリアの「ここをクリック」が見えなくなるため */
    /* カードの「頭」が見えていればスクロールしない（背の高い 4 のカードで、下がはみ出すだけで
       画面ごと下にずれてしまわないように）。頭が画面の外のときだけ、頭が見える所まで */
    if(act && (VID.ready || st>=2)) setTimeout(function(){
      var r=act.getBoundingClientRect();
      if(r.top<60 || r.top>window.innerHeight-120) act.scrollIntoView({block:'start', behavior:'smooth'});
    }, 60);
  }
  els('#side1 details[data-lock]').forEach(function(d){
    var need=parseInt(d.dataset.lock), lock=(st<need);
    d.classList.toggle('step-lock', lock);
    if(changed){ if(lock) d.open=false; else if(d.id!=='autoCard') d.open=true; }
  });
  /* 「まず ○○ へ」は、いまその手順を操作しているときに出ると意味がないので出さない */
  $('modeInfo').textContent = (st<4 && UI.mode==='record')? '' :
    ({record:'クリックで記録', origin:'原点をクリック', scale1:'長さのわかる 1点目をクリック',
      scale2:'2点目をクリック', axis:'x軸の向きへドラッグ', ref:'動かない目印をクリック',
      color:'追いかけたい物体（始点）をクリック',
      radius:'探索半径を円のドラッグで決める'}[UI.mode]||'');
  updateBigPlay();
  updateColLayout();
  drawSeekMarks();
  updateTodo();
  applyRangeLimit();
  updateGuide();
}
/* ===== メニューを左に置くか、上に集めるか ===== */
function setMenuPos(pos){
  APP.menuPos=(pos==='top')? 'top' : 'left';
  var g=$('m1grid'); if(g) g.classList.toggle('top', APP.menuPos==='top');
  var b=$('btnMenuPos'); if(b) b.textContent='メニュー：'+(APP.menuPos==='left'?'左':'上');
  foldSideCards();
  placePanelRsz();
  setTimeout(function(){ if(VID.ready) render(); drawSeekMarks(); }, 50);
}
/* 上に集めているときは、いま使うカードだけを開いて、1段におさめる */
function foldSideCards(){
  if(APP.menuPos!=='top') return;
  var st=effStep();
  els('#side1 details').forEach(function(d){
    var n=parseInt(d.dataset.step);
    d.open = (n===st);                       /* 手順のカードは、いまの手順だけ開く */
    if(isNaN(n)) d.open=false;               /* 操作説明・ストロボ・出力はたたむ */
  });
}
/* ===== 物体の名前がほかとかぶっていないか ===== */
function dupObjName(o){
  var e=EXP(), me=(e.objName[o]||'').trim();
  if(!me) return -1;
  for(var i=0;i<NOBJ;i++){
    if(i===o) continue;
    if((e.objName[i]||'').trim()===me) return i;
  }
  return -1;
}
/* かぶっていたら、その名前は受け付けずに空にもどす */
function checkObjName(){
  var o=UI.obj, d=dupObjName(o);
  if(d<0) return true;
  toast('物体'+(d+1)+'と同じ名前です。別の名前にしてください');
  EXP().objName[o]='';
  if($('inObjName')) { $('inObjName').value=''; try{ $('inObjName').focus(); }catch(e){} }
  refreshObjUI(); updateGuide(); saveLocal();
  return false;
}
/* ===== いま映っている動画が、その実験の動画かどうか ===== */
/* 実験2で別の動画を読んだあと実験1にもどると、実験1の点の上に実験2の動画が映る。
   そのまま記録すると、ちがう動画の座標が混ざるので、帯を出して記録を止める。 */
function vidMismatch(){
  var e=EXP(), n=e.video && e.video.name;
  return !!(VID.ready && n && VID.name && n!==VID.name);
}
function updateVidMis(){
  var bad=vidMismatch(), d=$('vidMis');
  if(d){
    d.classList.toggle('hide', !bad);
    if(bad) d.innerHTML='いま映っているのは <b>'+esc(VID.name)+'</b> です。'+
      'この実験（'+esc(EXP().name)+'）の動画は <b>'+esc(EXP().video.name)+'</b> なので、記録できません。<br>'+
      '<span style="font-weight:400">この実験を続けるときは <b>1. 動画</b> でその動画を読み直してください。</span>';
  }
  els('.videobox').forEach(function(v){ v.classList.toggle('mismatch', bad); });
  /* 高さのつまみは、動画があるときだけ（②の再生中は出さない） */
  document.body.classList.toggle('novidrsz', !VID.ready || LIVE.on);
  /* 帯を出しているあいだは、動画の上の吹き出しは引っこめる（重なって読めないため） */
  if(bad){ var vh=$('vhint'); if(vh) vh.classList.add('hide'); calMsg(''); }
}
/* ===== 実験エリア最大表示（上の段まで隠す。esc でもどる） ===== */
function setBigView(on){
  APP.bigView=!!on;
  document.body.classList.toggle('bigview', APP.bigView);
  $('cbBig').checked=APP.bigView;
  $('labBig').classList.toggle('on', APP.bigView);
  var n=$('escNote');
  if(APP.bigView){
    if(!n){ n=document.createElement('div'); n.id='escNote'; document.body.appendChild(n); }
    n.textContent='最大化は esc で解除されます';
    n.classList.remove('hide');
    /* すでにブラウザ側が全画面（F11）なら、こちらから全画面にはしない
       （そのほうがブラウザの「…全画面表示です」の知らせが出ない） */
    var already = (window.innerHeight >= (screen.height||0) - 2);
    UI.wantFull=false;
    if(!already && document.documentElement.requestFullscreen && !document.fullscreenElement){
      try{ document.documentElement.requestFullscreen(); }catch(e){}
    }
  } else {
    if(n) n.remove();
    UI.wantFull=false;
    if(document.fullscreenElement && document.exitFullscreen){ try{ document.exitFullscreen(); }catch(e){} }
  }
  setTimeout(function(){ if(VID.ready) render(); drawSeekMarks(); redrawAllCharts(); }, 60);
}
/* ===== ②・③の上のメニューを畳む ===== */
function setM2Menu(open){ setMenuOpen('2', open); }
function setM3Menu(open){ setMenuOpen('3', open); }
function setMenuOpen(tab, open){
  if(tab==='3'){
    APP.m3menu=!!open;
    if($('m3top')) $('m3top').classList.toggle('hide', !APP.m3menu);
    if($('cbM3Min')) $('cbM3Min').checked=!APP.m3menu;
  } else {
    APP.m2menu=!!open;
    $('m2top').classList.toggle('hide', !APP.m2menu);
    $('cbM2Min').checked=!APP.m2menu;
  }
  updateMenuChip();
  setTimeout(function(){ redrawAllCharts(); alignLive(); }, 40);
}
/* タブの段に出す「②グラフメニューを開く／③解析メニューを開く」 */
function updateMenuChip(){
  var lab=$('labM2Menu'); if(!lab) return;
  var t=APP.tab;
  var min=(t==='2' && !APP.m2menu) || (t==='3' && !APP.m3menu);
  lab.classList.toggle('hide', !min);
  lab.classList.toggle('on', min);
  $('cbM2MenuTop').checked=!min;
  var txt=(t==='3')? '③解析メニューを開く' : '②グラフメニューを開く';
  var last=lab.lastChild;
  if(last && last.nodeType===3) last.nodeValue=txt;
}
/* ===== 操作パネルの幅（動画エリアの大きさ） ===== */
function setPanelW(w){
  var min=0, max=Math.min(560, Math.round(window.innerWidth*0.5));
  w=Math.max(min, Math.min(max, Math.round(w)));
  APP.panelw=w;
  var hid=(w<130);
  document.body.classList.toggle('panelhid', hid);
  $('btnPanelOpen').classList.toggle('hide', !hid);
  document.documentElement.style.setProperty('--panelw', (hid?0:w)+'px');
  placePanelRsz();
  setTimeout(function(){ if(VID.ready) render(); drawSeekMarks(); updateVBoxNarrow(); }, 50);
}
/* 動画エリアがせまいと、左上と右上のボタンが重なる。せまいときは左を下の段へ */
function updateVBoxNarrow(){
  var b=$('videobox'); if(!b) return;
  var u=$('btnUndo1v'), r=$('btnTrkReset2');
  var need = 0;
  if(u && !u.classList.contains('hide')) need += u.offsetWidth;
  if(r && !r.classList.contains('hide')) need += r.offsetWidth;
  b.classList.toggle('narrow', need>0 && need+28 > b.clientWidth);
}
/* ===== 動画エリアの高さ（下辺のつまみ） ===== */
function setVidH(h){
  var max=Math.round(window.innerHeight*0.95);
  APP.vidh = (h>0)? Math.max(160, Math.min(max, Math.round(h))) : 0;
  if(VID.ready) render();
  drawSeekMarks();
}
function bindVidRsz(){
  var r=$('vidRsz'); if(!r) return;
  var st=null;
  r.addEventListener('pointerdown', function(e){
    var box=$('videobox');
    st={ y:e.clientY, h:box.getBoundingClientRect().height };
    r.setPointerCapture(e.pointerId); e.preventDefault(); e.stopPropagation();
  });
  r.addEventListener('pointermove', function(e){
    if(!st) return;
    setVidH(st.h + (e.clientY-st.y)); e.preventDefault();
  });
  r.addEventListener('pointerup', function(e){
    if(!st) return; st=null;
    try{ r.releasePointerCapture(e.pointerId); }catch(x){}
    saveLocal();
  });
  r.addEventListener('dblclick', function(e){
    e.preventDefault(); setVidH(0); saveLocal(); toast('動画エリアの高さをおまかせにもどしました');
  });
}
function placePanelRsz(){
  var r=$('panelRsz'), g=$('m1grid'); if(!r||!g) return;
  var hid=document.body.classList.contains('panelhid');
  var x=hid? 0 : (APP.panelw||352)+1;
  r.style.left=x+'px';
  r.classList.toggle('hide', $('mode1').classList.contains('hide'));
}
function bindPanelRsz(){
  var r=$('panelRsz'); if(!r) return;
  var st=null;
  r.addEventListener('pointerdown', function(e){
    st={x:e.clientX, w:(document.body.classList.contains('panelhid')?0:(APP.panelw||352))};
    r.setPointerCapture(e.pointerId); e.preventDefault();
  });
  r.addEventListener('pointermove', function(e){
    if(!st) return;
    setPanelW(st.w + (e.clientX-st.x));
  });
  r.addEventListener('pointerup', function(e){
    if(!st) return; st=null;
    try{ r.releasePointerCapture(e.pointerId); }catch(x){}
    saveLocal();
  });
  $('btnPanelOpen').onclick=function(){ setPanelW(352); saveLocal(); };
}
/* 2・3 のあいだは「動画｜操作」、4 からは「動画｜表」に切りかえる */
var colSbsWas=false;
function updateColLayout(){
  var st=effStep(), wide=(window.innerWidth>=980), ctl=(wide && VID.ready && st<=3);
  var r0=el('.rightcol'); if(!r0) return;
  if(ctl){
    if(r0.classList.contains('sbs')){ colSbsWas=true; setSbs(false); }   /* 表はいったん下へ */
    els('.rightcol').forEach(function(x){ x.classList.add('ctl'); });
  } else {
    els('.rightcol').forEach(function(x){ x.classList.remove('ctl'); });
    if(colSbsWas){ colSbsWas=false; setSbs(true); }                      /* もとに戻す */
  }
  var b=$('btnSbs'); if(b) b.classList.toggle('hide', ctl);
}
/* 動画と表を並べる／もどす */
function setSbs(on){
  /* 2・3 のあいだ（動画｜操作 の配置）は、表を右に出さない */
  var ctl=(window.innerWidth>=980 && VID.ready && effStep()<=3);
  if(on && ctl){ colSbsWas=true; on=false; }
  els('.rightcol').forEach(function(r){ r.classList.toggle('sbs', on); });
  $('btnSbs').textContent = on? '表を下に表示' : '動画と表を並べる';
  setTimeout(function(){ if(VID.ready) render(); updatePrec(); }, 40);
}
/* 吹き出しは、ボタンの右（入らなければ左）に出す。となりのボタンに重ならないよう場所も空ける */
function placeCallouts(){
  els('.callout').forEach(function(c){
    if(c.classList.contains('seek')) return;
    var w=c.parentNode; if(!w) return;
    if(c.classList.contains('hide')){ w.style.marginRight=''; w.style.marginLeft=''; c.classList.remove('left'); return; }
    c.classList.remove('left'); w.style.marginRight=''; w.style.marginLeft='';
    var host=w.closest? (w.closest('.card')||w.closest('.vidbar')||document.body) : document.body;
    var hb=host.getBoundingClientRect(), rb=w.getBoundingClientRect(), cw=c.offsetWidth||110;
    if(rb.right+9+cw <= hb.right-6) w.style.marginRight=(cw+12)+'px';        /* 右に出す */
    else if(rb.left-9-cw >= hb.left+6){ c.classList.add('left'); w.style.marginLeft=(cw+12)+'px'; }
  });
}
/* 解析範囲の先頭へ巻き戻す */
function rewindToRangeStart(){
  if(!VID.ready) return;
  var a=rangeStart(EXP());
  setTimeout(function(){ vidSeek(a).then(function(){ afterSeek(); }); }, 30);
}
/* いま押してほしいボタンを光らせる（2 の中の順番も案内する） */
function updateGuide(){
  var e=EXP(), st=(APP.editStep&&APP.editStep<APP.step)?APP.editStep:APP.step;
  els('.btn.glow').forEach(function(b){ if(b.id!=='btnM2Live') b.classList.remove('glow'); });   /* ②の「動画と一緒に…」は m2ModeButtons が管理 */
  els('#tabs button.glow').forEach(function(b){ b.classList.remove('glow'); });
  /* 1：動画をえらぶまでは「動画ファイルを選択」を光らせる */
  if(st===1 && !VID.ready) $('btnFile').classList.add('glow');
  /* 4：まず「トラッキングを開始する」、押したら動画そのものを光らせる */
  /* 4 に入った直後：まず「進むフレーム数 N」を動画の真ん中で決めてもらう（決めるまで開始ボタンは出さない） */
  if(!UI.trimLock){
    if(UI.trimAsking && !UI.trimFlow && !$('calMsg').classList.contains('trimq')) UI.trimAsking=false;   /* 質問が消えていたら待たない */
    if(UI.trimFlow && UI.mode!=='crop' && !$('calMsg').classList.contains('trimq')) { UI.trimFlow=false; UI.trimAsking=false; }   /* トリミングをやめた */
  }
  if(st===4 && VID.ready && !e.nOk){
    if(EXP().objs.reduce(function(a,b){return a+b.length;},0)>0) e.nOk=true;   /* もう点があるなら聞かない（前の版のデータ） */
    else if(!LIVE.on && !UI.trimAsking && !$('calStepN')) { UI.nAsking=false; askStepN(); }      /* 質問が画面に無ければ（3 にもどって消えた等）出し直す */
  }
  if(st!==4){ UI.nAsking=false; if($('calStepN') || $('objCntQ') || $('nConfirmQ')) calMsg(''); }   /* 4 を離れたら N・物体の数の質問は消す（もう一度 2 など） */
  if(APP.twoObj && !e.nObjOk && e.objs[1] && e.objs[1].length) e.nObjOk=true;   /* 前の版のデータ：もう物体2があるなら聞かない */
  if(st===4 && VID.ready && e.nOk && APP.twoObj && !e.nObjOk && !LIVE.on && !UI.trimAsking && !$('calStepN') && !$('objCntQ')) askObjCount();   /* N のつぎに物体の数（質問が消えていたら出し直す） */
  var nWait=(st===4 && VID.ready && (!e.nOk || (APP.twoObj && !e.nObjOk) || !!$('nConfirmQ')));   /* 「1 クリックで…」の OK を押すまでも待つ */
  var start4=(st===4 && VID.ready && needTrackStart() && !nWait);
  /* 色マーカーの自動追跡が ON なら、真ん中で「色で自動追跡（おすすめ）／手でクリック」を選ぶ。OFF なら前どおり開始ボタン */
  var choice4=start4 && APP.autoTrack;
  $('btnTrkStart').classList.toggle('hide', !start4 || choice4);
  if($('trkChoice')) $('trkChoice').classList.toggle('hide', !choice4);
  autoGuideSync(st);
  updateCursor();
  var need4=(st===4 && VID.ready && !start4 && !nWait &&
             EXP().objs.reduce(function(a,b){return a+b.length;},0)===0);
  els('.videobox').forEach(function(v){ v.classList.toggle('glow', need4); });
  var show2=(st===2);
  $('vidStep2').classList.toggle('hide', !show2);
  /* 4.トラッキングの間だけ、動画エリアの右上にもリセットを出す */
  var topBtn=(st===4 && VID.ready);
  $('btnTrkReset2').classList.toggle('hide', !topBtn);
  $('btnUndo1v').classList.toggle('hide', !(topBtn && EXP().objs.reduce(function(a,b2){ return a+b2.length; },0)>0));
  els('.videobox').forEach(function(v){ v.classList.toggle('topbtn', topBtn); });
  updateVidMis();
  updateVBoxNarrow();
  updateStroUI();
  var wantT0=false, wantB=false;
  if(show2){
    if(!APP.played){ ['btnPlay','btnPlay2'].forEach(function(id){ $(id).classList.add('glow'); }); }
    else if(e.t0===null){ wantT0=true; ['btnTimeZero','btnTimeZero2'].forEach(function(id){ $(id).classList.add('glow'); }); }
    else if(e.rangeB===null){ wantB=true; ['btnRangeB','btnRangeB2'].forEach(function(id){ $(id).classList.add('glow'); }); }
  }
  ['coTimeZero','coTimeZero2'].forEach(function(id){ $(id).classList.toggle('hide', !wantT0); });
  ['coRangeB','coRangeB2'].forEach(function(id){ $(id).classList.toggle('hide', !wantB); });
  placeCallouts();
  $('coSeek').classList.toggle('hide', !(wantT0||wantB));   /* シークバーの上の案内 */
  /* 3 に入ったら、動画の真ん中に「原点を指定してください」 */
  $('btnOriginBig').classList.toggle('hide', !(st===3 && VID.ready && !e.origin && UI.mode!=='origin' && UI.mode!=='crop' && !UI.trimAsking));
  if(st===3){
    /* 押したあと（クリック待ちの間）も光らせ続ける */
    if(!e.originSet || UI.mode==='origin') $('btnOrigin').classList.add('glow');
    else if(!e.axisSet || UI.mode==='axis'){
      $('btnAxis').classList.add('glow');
      if(!e.mPerPx) $('btnScale').classList.add('glow');   /* 水平でよければ、こちらへ */
    }
    else if(!e.mPerPx || UI.mode==='scale1' || UI.mode==='scale2') $('btnScale').classList.add('glow');
  }
  /* ===== ２物体の運動：名前 → 開始 → 物体2 の順に光らせる ===== */
  if(APP.twoObj && st===4 && VID.ready){
    var o=UI.obj, nameOK=!!(e.objName[o]||'').trim();
    $('labObjName').classList.toggle('hot', !nameOK);
    /* 名前がまだのときは、動画の真ん中の開始ボタンも出さない */
    if(!nameOK){ $('btnTrkStart').classList.add('hide'); if($('trkChoice')) $('trkChoice').classList.add('hide'); }
    else if(needTrackStart()){ if(APP.autoTrack){ if($('trkChoice')) $('trkChoice').classList.remove('hide'); } else $('btnTrkStart').classList.remove('hide'); }
    if($('trkChoice')) $('trkChoice').querySelector('.tc-q').textContent='物体'+(o+1)+'をどちらで記録しますか？';
    $('btnTrkStart').innerHTML='<span class="l1">物体'+(o+1)+'のトラッキング（軌跡の追跡）開始</span><span class="l2">物体をクリックすると指定のコマずつ動画が進みます</span>';
    /* 物体1が終わったら自動で物体2へ、物体2が終わったら（3 つなら）物体3へ */
    if(o+1<nObj() && objDone(o) && !EXP().objs[o+1].length && !EXP().objReady[o+1]){
      UI.obj=o+1; $('selObj').value=String(o+2); refreshObjUI();
      toast('物体'+(o+1)+'のトラッキングが終わりました。つぎは物体'+(o+2)+'の名前を入れてください');
      setTimeout(updateGuide, 0);
    }
  } else {
    $('labObjName').classList.remove('hot');
    if(!APP.twoObj){ $('btnTrkStart').innerHTML='<span class="l1">トラッキング（軌跡の追跡）開始</span><span class="l2">物体をクリックすると指定のコマずつ動画が進みます</span>';
      if($('trkChoice')) $('trkChoice').querySelector('.tc-q').textContent='どちらで記録しますか？'; }
  }
  /* ===== 「どちらで記録するか」の2つのボタン =====
     ・色マーカーの自動追跡が OFF のときは、［色で自動追跡］は<b>出さない</b>
     ・選んだあとも2つは出したままで、選んだ方をオレンジで光らせて「← 今こちら」を出す */
  var in4=(st===4 && VID.ready), need=needTrackStart();
  var nameOK2=(!APP.twoObj || !!(EXP().objName[UI.obj]||'').trim());
  var auto=APP.autoTrack;
  $('startBox').classList.toggle('hide', !in4 || nWait);
  $('wrapStartAuto').classList.toggle('hide', !auto);
  ['btnStartHand','btnStartAuto'].forEach(function(id){
    var q=$(id); if(!q) return;
    q.disabled=!nameOK2;
    q.classList.remove('glow');
  });
  var chosen = need? '' : (UI.startedAuto? 'auto' : 'hand');
  if(in4 && nameOK2){
    if(need){                       /* まだ選んでいない：自動が使えるなら［色で自動追跡］を大きく光らせて「おすすめ」 */
      if(auto) $('btnStartAuto').classList.add('glow','rec');
      else $('btnStartHand').classList.add('glow');
    } else {                        /* 選んだあと：選んだ方だけ光らせる */
      $((chosen==='auto')?'btnStartAuto':'btnStartHand').classList.add('glow');
    }
  }
  $('btnStartAuto').classList.toggle('rec', in4 && nameOK2 && need && auto);
  if($('coAutoRec')) $('coAutoRec').classList.toggle('hide', !(in4 && nameOK2 && need && auto));
  $('btnStartAuto').classList.toggle('dim', in4 && chosen==='hand');
  $('coHand').classList.toggle('hide', !(in4 && nameOK2 && chosen==='hand'));
  $('coAuto').classList.toggle('hide', !(in4 && nameOK2 && auto && chosen==='auto'));
  $('startNote').innerHTML = !nameOK2? '<span class="ng">先に上で名前を入れてください。</span>'
    : need? (auto? 'この物体を<b>どちらで記録するか</b>を選んでください（あとで切りかえられます）。おすすめは<b>［色で自動追跡］</b>です。'
                 : '<b>［手でクリックして記録］</b>で始めます（色で自動追跡を使うときは、右上のチェックを入れてください）。')
    : '記録のしかたは、いつでも切りかえられます。';
  /* 自動追跡のまとまり：OFF のときや、手で記録を選んでいる間は出さない（たたむ） */
  var ac=$('autoCard');
  if(ac){
    ac.classList.toggle('hide', !(auto && in4 && (need || chosen==='auto')));
    ac.classList.toggle('step-lock', need);
    ac.classList.toggle('on', auto && !need && chosen==='auto');
  }
  if($('autoHint')) $('autoHint').classList.toggle('hide', APP.autoTrack || !in4);
  if($('keyHint2')) $('keyHint2').classList.toggle('hide', !in4);      /* キーの説明は 4 のあいだだけ動画の下にも */
  /* 動画の下にも「最後まで自動追跡」を出す（左下だと小さい画面で押しにくいため） */
  var va=$('vidAuto');
  if(va){
    var showVA=(in4 && auto && !need && chosen==='auto');
    va.classList.toggle('hide', !showVA);
    if(showVA) $('btnAutoRun2').classList.toggle('glow', $('btnAutoRun').classList.contains('glow'));
  }
  /* 「記録した続きから」は、4 でトラッキング中だけ出す */
  var nb=$('btnNextTrk');
  if(nb) nb.classList.toggle('hide', !(st===4 && VID.ready && trackedTo()!==null && !trackingDone()));
  /* 「1回分トラッキングを取り消す」は、点が1つ以上あるときだけ出す */
  var anyPt=EXP().objs.reduce(function(a,b2){ return a+b2.length; },0)>0;
  ['btnUndo1','btnUndo1c'].forEach(function(id){
    var q=$(id); if(q) q.classList.toggle('hide', !anyPt);
  });
  /* トラッキングが範囲の終わりまで進んだら ②グラフ を光らせ、終わりを知らせる */
  var done=(APP.step>=4 && trackingDone());
  /* 終わった瞬間（測り直しのあとも）：②③のグラフの目盛り・位置を自動にもどす（前の測定の目盛りが残らないように） */
  if(done && !UI.wasDone){ gvReset(); APP.fitRange=null; APP.cgRange=null; UI.tab2Seen=false; }
  /* ②のタブが光るのは、①が終わってから、はじめて②を開くまで */
  if(done && !UI.tab2Seen) el('#tabs button[data-mode="2"]').classList.add('glow');
  UI.wasDone=done;
  /* ②③④ は、①で点を記録してから（補足はいつでも） */
  var anyPts=EXP().objs.reduce(function(a,b2){ return a+b2.length; },0)>0;
  ['2','3','4'].forEach(function(k){ var tb=el('#tabs button[data-mode="'+k+'"]'); if(tb) tb.classList.toggle('lock', !anyPts); });
  if(typeof updateNextExpBtn==='function') updateNextExpBtn();
  var dm2=$('doneMsg'), showDone=(done && VID.ready);
  dm2.classList.toggle('hide', !showDone);
  if(showDone){
    if(!dm2.__t){                       /* 出したては大きく、2秒たったら左上に小さく */
      dm2.classList.remove('small');
      dm2.__t=setTimeout(function(){ dm2.classList.add('small'); }, 2000);
    }
  } else { clearTimeout(dm2.__t); dm2.__t=null; dm2.classList.remove('small'); }
  $('trkDone').classList.toggle('hide', !done);
  /* 3 が終わっていることを、4 のカードでも分かるようにしておく */
  var cok=$('calOkNote');
  if(cok){ var e9=EXP();
    cok.classList.toggle('hide', !(st>=4 && e9.origin && e9.originSet && e9.axisSet && e9.mPerPx>0)); }
  $('btnJsonSaveTop').classList.toggle('hide', !done);
  $('labYFlip').classList.toggle('hide', APP.axisDisp!=='xy');
  /* 色マーカーの自動追跡：始点と色 → 探索半径 → 最後まで自動追跡 の順に光らせる */
  if(st===4 && VID.ready && APP.autoTrack && !needTrackStart() && !$('autoCard').classList.contains('hide')){
    var hasStart = EXP().objs[UI.obj].length>0;
    if(!APP.trackColor || !hasStart || UI.mode==='color') $('btnPickColor').classList.add('glow');
    else if(!UI.autoLost){                                          /* 見失っている間は光らせない */
      $('btnAutoRun').classList.add('glow');
      var a2=$('btnAutoRun2'); if(a2) a2.classList.add('glow');     /* 動画の下の同じボタンも */
    }
  }
  $('labSearchR').classList.toggle('hot', UI.mode==='radius');
  /* ②で動画を再生しているときは、①用の案内やボタンは出さない */
  if(LIVE.on){
    ['doneMsg','btnTrkReset2','btnUndo1v','btnTrkStart','btnOriginBig','vhint','bigPlay'].forEach(function(id){
      $(id).classList.add('hide');
    });
    els('.videobox').forEach(function(v){ v.classList.remove('glow','topbtn'); });
  }
}
/* 進み方が変わるとき（動画を読み直す・測定を消す・範囲を解除する）に、途中の質問の状態をそろえて消す */
function resetFlowFlags(alsoN){
  UI.trimFlow=false; UI.trimAsking=false; UI.nAsking=false; UI.autoGuide=null; UI.wasDone=false;
  var m=$('calMsg'); if(m && (m.classList.contains('trimq') || $('calStepN') || $('objCntQ') || m.classList.contains('autog'))) calMsg('');
  if(alsoN && EXP()){ EXP().nOk=false; EXP().nObjOk=false; }
}
/* ---------- 2 が終わったとき：動画をトリミングするかを聞く ---------- */
function askTrim(){
  if(!VID.ready || window.__noAskN) return;
  UI.trimAsking=true;                       /* 答えるまで、4 の N の質問は待たせる */
  var done=function(){ UI.trimAsking=false; calMsg(''); };
  calAsk('<span class="q">動画をトリミング（端を切る）しますか？</span>'+
    '<span class="mini">使いたい所だけを四角で囲むと、その部分が動画エリアいっぱいに広がります。（後からでも可能です：1 のカードの［動画をトリミング（端を切る）］）</span>', [
    { label:'はい', cls:'pri', fn:function(){ calMsg(''); trimCropStart(); } },
    { label:'いいえ', fn:function(){ done(); afterChange(); } }
  ]);
  $('calMsg').classList.add('center','trimq');
}
/* 2 の流れの中でトリミングのモードに入る（順番が大事：先にモードを crop にしてから旗を立てる。
   逆だと途中の updateGuide が「トリミングをやめた」と見なして旗を下ろしてしまう） */
function trimCropStart(){
  UI.trimFlow=true; UI.trimAsking=true; UI.trimLock=true;     /* 切りかえの途中は旗を下ろさせない */
  stopAllPlay(); UI.cropDrag=null;
  setMode('crop');
  UI.trimLock=false;
  updateCropInfo(); render(); updateGuide();
}
/* トリミングの四角をひき終わったら「この範囲でいいですか？」（2 の流れの中のときだけ） */
function askTrimOk(){
  if(!UI.trimFlow) return;
  var fin=function(){ UI.trimFlow=false; UI.trimAsking=false; calMsg(''); };
  calAsk('<span class="q">この範囲でいいですか？</span>', [
    { label:'はい', cls:'pri', fn:function(){ fin(); afterChange(); } },
    { label:'いいえ', fn:function(){ calMsg(''); setCrop(null); trimCropStart(); } }
  ]);
  $('calMsg').classList.add('center','trimq');
}
/* ---------- 4 に入ったとき：進むフレーム数 N を動画の真ん中で決めてもらう ---------- */
function frameDt(){                     /* 1 コマ＝何秒か（実測の中央値。無ければ 1/fps） */
  var f=VID.frames||[], d=[], i;
  for(i=1;i<f.length;i++){ var q=f[i]-f[i-1]; if(q>0) d.push(q); }
  d.sort(function(a,b){return a-b;});
  var dt=d.length? d[Math.floor(d.length/2)] : (1/(VID.fps||30));
  var ts=(EXP().tscale>0? EXP().tscale : 1);
  return dt*ts;
}
function askStepN(){
  var e=EXP(); if(!VID.ready || e.nOk) return;
  var dt=frameDt(), cur=parseInt($('inStepN').value)||5;
  if(window.__noAskN){ e.nOk=true; return; }
  UI.nAsking=true;
  var opts=[1,2,3,4,5,6,8,10,15,20].map(function(n){
    return '<option value="'+n+'"'+(n===cur?' selected':'')+'>'+n+' コマ（'+nf(n*dt,3)+' s）</option>';
  }).join('');
  calAsk('<span class="q">何コマごとに位置を記録しますか？</span>'+
    'この動画は <b>1 コマ ＝ '+nf(dt,4)+' 秒</b>です。物体をクリックするたびに、この数だけ動画が進みます。<br>'+
    '進むフレーム数 N：<select class="nsel" id="calStepN">'+opts+'</select>'+
    '<span class="mini">ふつうは 5。速い運動（落下・投射）は小さく、ゆっくりした運動は大きく。あとから 4 のカードの［進むフレーム数 N］で変えられます。</span>', [
    { label:'決める', cls:'pri big2', fn:function(){
        var n=parseInt(($('calStepN')||{}).value)||cur;
        $('inStepN').value=n; e.nOk=true; UI.nAsking=false;
        calAsk('<span class="q" id="nConfirmQ">1 クリックで '+n+' コマ ＝ '+nf(n*dt,3)+' s ずつ解析します。</span>'+
          '途中で変えることもできます（左の 4. トラッキングの［進むフレーム数 N］）。<br>'+
          '細かく詳しく運動を解析したい部分では、コマ数を減らすことも可能です。', [
          { label:'OK', cls:'pri', fn:function(){ calMsg(''); afterChange(); if(APP.twoObj && !EXP().nObjOk) askObjCount(); } }
        ]);                                   /* こちらは上に出す（真ん中の開始ボタンをかくさない） */
        $('calMsg').classList.add('big','nconf');
        afterChange(); saveLocal();
      } }
  ]);
  $('calMsg').classList.add('center');
}
/* ---------- 複数物体：4 に入ったら N のつぎに「物体はいくつ？」（2 か 3） ---------- */
function askObjCount(){
  var e=EXP(); if(!VID.ready || e.nObjOk) return;
  if(window.__noAskN){ e.nObjOk=true; e.nObjs=e.nObjs||2; return; }
  var cur=parseInt(e.nObjs)||2;
  calAsk('<span class="q" id="objCntQ">追いかける物体はいくつありますか？</span>'+
    '<span class="mini">物体1 → 物体2 → 物体3 の順に、1 つずつ最後までトラッキングします。名前をつけると、表やグラフに出ます。</span>', [
    { label:'2 つ', cls:(cur===2?'pri':'ghost'), fn:function(){ setObjCount(2); } },
    { label:'3 つ', cls:(cur===3?'pri':'ghost'), fn:function(){ setObjCount(3); } },
    { label:'いいえ、1 つの測定でよい', cls:'ghost brk', fn:function(){        /* 1 物体のモードにもどす（チェックも OFF） */
        e.nObjOk=true; calMsg(''); setTwoObj(false); toast('1 つの物体を測定します（右上の［複数物体の運動］は OFF になりました）'); } }
  ]);
  $('calMsg').classList.add('center');
}
function setObjCount(n){
  var e=EXP(); e.nObjs=n; e.nObjOk=true; UI.obj=0;
  calMsg(''); refreshObjUI(); afterChange(); saveLocal();
  toast('物体は '+n+' つ。まず物体1の名前を入れてください');
}
/* ---------- 色で自動追跡の案内（動画の上に大きく。最小化できる） ---------- */
function autoGuideSync(st){
  var m=$('calMsg'); if(!m) return;
  var want=null;
  if(st===4 && VID.ready && !LIVE.on && UI.startedAuto && !needTrackStart()){
    if(UI.mode==='color') want='color';
    else if(UI.mode==='radius') want='radius';
  }
  var cur=UI.autoGuide? UI.autoGuide.step : null;
  if(want===cur) return;
  if(!want){
    if(cur){ UI.autoGuide=null; if(m.classList.contains('autog')) calMsg(''); }
    return;
  }
  UI.autoGuide={ step:want, mini:false };
  autoGuideShow();
}
function autoGuideShow(){
  var g=UI.autoGuide; if(!g) return;
  var m=$('calMsg');
  if(g.mini){
    calAsk(g.step==='color'? '追いかけたい物体を 1 回クリック（始点と色）' : '円をドラッグして探索半径 → ［最後まで自動追跡］', [
      { label:'もう一度表示', fn:function(){ g.mini=false; autoGuideShow(); } }
    ].concat(g.step==='radius'? [{ label:'自動追跡を開始する', cls:'pri', fn:function(){ autoGuideRun(); } }] : []));
    m.classList.add('mini','autog');
    return;
  }
  if(g.step==='color'){
    calAsk('<span class="q">追いかけたい物体（マーカー）を 1 回クリックしてください</span>'+
      '<span class="mini">そこが始点になり、色も覚えます。</span>', [
      { label:'この表示を最小化', fn:function(){ g.mini=true; autoGuideShow(); } }
    ]);
  } else {
    calAsk('<span class="q">動画の上の円をドラッグして、探索半径を決めてください</span>'+
      '<span class="mini">物体が 1 回で動く距離より少し大きめに。そのままでもかまいません。</span>', [
      { label:'自動追跡を開始する', cls:'pri big2', fn:function(){ autoGuideRun(); } },
      { label:'この表示を最小化する', fn:function(){ g.mini=true; autoGuideShow(); } }
    ]);
  }
  m.classList.add('big','autog');
}
function autoGuideRun(){
  UI.autoGuide=null; calMsg('');
  if(UI.mode==='radius') setMode('record');
  autoRunAll();
}
/* ---------- マウスカーソル：クリックで何かが起こる所では指や十字にする ---------- */
function updateCursor(){
  var cv=$('cvOv'); if(!cv) return;
  var c='';
  if(VID.ready){
    var mo=UI.mode;
    if(mo==='origin'||mo==='axis'||mo==='scale1'||mo==='scale2'||mo==='color'||mo==='ref'||mo==='crop') c='crosshair';
    else if(mo==='radius') c='grab';
    else if(mo==='record' && typeof effStep==='function' && effStep()>=4 && !needTrackStart() && !(EXP().nOk===false)) c='crosshair';
  }
  cv.style.cursor=c;
  var v=$('cvView'); if(v) v.style.cursor=c;
}
/* 「トラッキングを開始する」をまだ押していない（＝記録させない）か */
/* 「色：取得ずみ／未取得」の表示 */
function updateColorTag(){
  var t=$('colorTag'); if(!t) return;
  var c=APP.trackColor;
  if(c){
    t.textContent='色：取得ずみ';
    t.style.background='rgb('+Math.round(c.r)+','+Math.round(c.g)+','+Math.round(c.b)+')';
    t.style.color='#fff';
  } else { t.textContent='色：未取得'; t.style.background=''; t.style.color=''; }
}
/* この物体の記録を始める（auto=true なら、そのまま始点＋色のクリック待ちへ） */
function startTracking(auto){
  var e=EXP(), o=UI.obj;
  if(!VID.ready){ toast('先に動画を読み込んでください'); return; }
  if(vidMismatch()){
    toast('この実験の動画（'+(e.video&&e.video.name||'')+'）を読み直してください'); return;
  }
  if(effStep()<4){ toast('「'+stepName(effStep())+'」を先に終わらせてください'); return; }
  if(auto && !APP.autoTrack){        /* チェックが入っていないときは、自動追跡には入らない */
    toast('右上の［色マーカーの自動追跡］にチェックを入れてください'); return;
  }
  if(APP.twoObj && !(e.objName[o]||'').trim()){
    toast('先に物体'+(o+1)+'の名前を入れてください'); $('inObjName').focus(); return;
  }
  if(APP.twoObj && !checkObjName()) return;      /* ほかの物体と同じ名前 */
  e.objReady[o]=true; e.trackReady=true;
  UI.startedAuto=!!auto;
  stopAllPlay(); stopAuto(); UI.autoLost=false; autoMsgHide();
  if(auto){
    APP.trackColor=null; APP.startPt=null; updateColorTag();
  }
  setMode(auto? 'color' : 'record');       /* 表示はすぐ切りかえる */
  refreshObjUI(); afterChange(); render();
  /* 「動画の上をクリック…」「追いかけたい物体を…」の toast は出さない（上の吹き出し・動画の案内と重なるため） */
  vidSeek(rangeStart(e)).then(function(){ afterSeek(); render(); });
}
/* 記録のしかたを選ぶ／あとから切りかえる */
function switchWay(auto){
  if(needTrackStart()){ startTracking(auto); return; }
  if(auto && !APP.autoTrack){ toast('右上の［色マーカーの自動追跡］にチェックを入れてください'); return; }
  if(UI.startedAuto===!!auto){ toast(auto? 'いま「色で自動追跡」です' : 'いま「手でクリックして記録」です'); return; }
  UI.startedAuto=!!auto;
  stopAuto(); stopAllPlay(); UI.autoLost=false; autoMsgHide();
  setMode(auto? 'color' : 'record');
  afterChange(); render();          /* 切りかえ後の案内は、上の吹き出しと動画の上の案内にまかせる（toast は出さない） */
}
function needTrackStart(){
  var e=EXP();
  if(APP.twoObj){                       /* 2物体：物体ごとに「開始」を押してもらう */
    if(e.objReady[UI.obj]) return false;
    if(e.objs[UI.obj].length>0) return false;
    return true;
  }
  if(e.trackReady) return false;
  if(e.objs.reduce(function(a,b){return a+b.length;},0)>0) return false;  /* 前のデータがあるなら不要 */
  return true;
}
/* その物体が、解析範囲の終わりまで記録できているか */
function objDone(o){
  var e=EXP();
  if(e.rangeB===null) return false;
  var arr=e.objs[o]; if(!arr || !arr.length) return false;
  if(e.objEnd && e.objEnd[o]) return true;         /* ［この物体はここで終わり］を押した */
  var last=null;
  arr.forEach(function(p){ if(last===null||p.t>last) last=p.t; });
  return last >= e.rangeB - 0.6/(VID.fps||30);   /* 解析範囲の最後のコマまで来たら「終わり」 */
}
function trackingDone(){
  var e=EXP();
  if(e.rangeB===null) return false;
  if(APP.twoObj){ for(var k=0;k<nObj();k++) if(!objDone(k)) return false; return true; }
  var last=null;
  for(var i=0;i<NOBJ;i++) e.objs[i].forEach(function(p){ if(last===null||p.t>last) last=p.t; });
  if(last===null) return false;
  return last >= e.rangeB - 0.6/(VID.fps||30);   /* 解析範囲の最後のコマまで来たら「終わり」 */
}
/* 「２物体の運動」の切りかえ。画面の見た目と選べる物体をそろえる */
function setTwoObj(on, quiet){
  APP.twoObj=!!on;
  $('cbTwoObj').checked=APP.twoObj;
  if(!APP.twoObj) UI.obj=0;
  refreshObjUI();
  if(!quiet){
    afterChange(); refreshExpUI();
    if(!$('mode2').classList.contains('hide')) renderMode2();
    if(!$('mode3').classList.contains('hide')) renderMode3(false);
    renderCG(); saveLocal();
    if(VID.ready) render();
  }
}
/* 物体えらびの見た目（4.トラッキング／自由選択グラフ／②の対象） */
function refreshObjUI(){
  var two=APP.twoObj, e=EXP();
  if($('labFitObj')) $('labFitObj').classList.toggle('hide', !two);      /* ③の「物体」は２物体のときだけ */
  if($('labM3')) $('labM3').classList.toggle('hide', nObj()<3);           /* m₃ は物体が 3 つのときだけ */
  if($('labCgM3')) $('labCgM3').classList.toggle('hide', nObj()<3);
  $('objBox').classList.toggle('hide', !two);
  $('rowClearObj').classList.toggle('hide', !two);
  /* 物体番号は 1 〜 物体の数（2 か 3） */
  var sel=$('selObj'), nO=nObj();
  els('option', sel).forEach(function(op,i){ op.hidden=(i>=nO); });
  if(UI.obj>=nO) UI.obj=two? nO-1 : 0;
  sel.value=String(UI.obj+1);
  $('labObjName').firstChild.nodeValue='物体'+(UI.obj+1)+'の名前 ';
  $('inObjName').value=e.objName[UI.obj]||'';
  $('btnStartHand').textContent = two? ('物体'+(UI.obj+1)+'を手でクリックして記録') : '手でクリックして記録';
  $('btnStartAuto').textContent = two? ('物体'+(UI.obj+1)+'を色で自動追跡') : '色で自動追跡';
  /* 物体が変わったら、色と始点は取り直し（物体ごとに色がちがうため） */
  if(UI.objPrev!==UI.obj){
    UI.objPrev=UI.obj;
    if(two && (APP.trackColor||APP.startPt)){
      APP.trackColor=null; APP.startPt=null; UI.autoLost=false;
      if(APP.autoTrack) toast('物体'+(UI.obj+1)+'の色を取り直してください');
    }
  }
  updateColorTag();
  /* 物体2は物体1が終わってから、物体3は物体2が終わってから */
  sel.options[1].disabled = two && !objDone(0);
  if(sel.options[2]) sel.options[2].disabled = two && !objDone(1);
  /* ［この物体はここで終わり］：複数物体で、点があって、まだ終わっていないときだけ */
  if($('rowObjEnd')) $('rowObjEnd').classList.toggle('hide', !(two && e.objs[UI.obj].length>0 && !objDone(UI.obj)));
  /* リセットのボタン */
  $('btnTrkReset').textContent = two? '物体1のトラッキングした点をリセット' : 'トラッキングした点をリセット';
  $('rowTrkResetB').classList.toggle('hide', !(two && (objDone(0) || e.objs[1].length)));
  if($('btnTrkResetC')) $('btnTrkResetC').classList.toggle('hide', !(two && nO>=3 && (objDone(1) || e.objs[2].length)));
  $('trkResetNote').textContent = two?
    'その物体の点を消して、解析範囲の最初に戻ります（Ctrl＋Z で戻せます）。' :
    'この実験で記録した点を全部消して、解析範囲の最初に戻ります（Ctrl＋Z で戻せます）。';
  /* 自由選択グラフの「物体」えらび */
  ['cgObjA','cgObjB'].forEach(function(id){
    var q=$(id); if(!q) return;
    q.classList.toggle('hide', !two);
    els('option', q).forEach(function(o,i){ o.hidden=(i>=nObj()); });
  });
  /* 実験も物体もえらばないときは、「縦軸」のラベルだけが浮くので、まとまりごと消す */
  var pk=el('.cgTop .cgpick');
  if(pk) pk.classList.toggle('hide', !two);
  var pkT=$('cgTop')||el('.cgTop');
  if(pkT) pkT.classList.toggle('hide', !two);
  /* ②の「対象の物体」 */
  var oc=$('objChecks');
  if(oc){
    $('lbObjSel').classList.toggle('hide', !two);
    oc.classList.toggle('hide', !two);
    if(two && oc.children.length!==nObj()){
      oc.innerHTML='';
      for(var i=0;i<nObj();i++){
        var l=document.createElement('label');
        l.innerHTML='<input type="checkbox" data-o="'+i+'" checked>'+
          '<i style="display:inline-block;width:11px;height:11px;border-radius:3px;background:'+OBJCOL[i]+'"></i>'+
          '<span class="onm">物体'+(i+1)+'</span>';
        l.querySelector('input').addEventListener('change', function(){ renderMode2(); });
        oc.appendChild(l);
      }
    }
    if(two) els('#objChecks .onm').forEach(function(sp,i){
      sp.textContent='物体'+(i+1)+(e.objName[i]? '（'+e.objName[i]+'）':'');
    });
  }
}
/* ②で表示する物体 */
function selectedObjs(){
  if(!APP.twoObj) return [0];
  var out=[];
  els('#objChecks input:checked').forEach(function(c){ out.push(parseInt(c.dataset.o)); });
  if(!out.length) out=[0,1];
  return out;
}
/* 2 が決まったら、再生もコマ送りも解析する範囲の中だけにする */
function applyRangeLimit(){
  var e=EXP();
  if(APP.step>=3 && VID.dur>0 && (e.t0!==null || e.rangeB!==null)){
    VID.limit={ a:(e.t0!==null? e.t0:0), b:(e.rangeB!==null? e.rangeB:VID.dur) };
    /* いまの時刻が解析範囲の外にあったら、範囲の中へもどしておく */
    if(VID.ready && !VID.building && (VID.cur < VID.limit.a-1e-6 || VID.cur > VID.limit.b+1e-6)){
      var tt=Math.max(VID.limit.a, Math.min(VID.limit.b, VID.cur));
      vidSeek(tt).then(function(){ render(); updateTimeLine(); });
    }
  } else VID.limit=null;
}
/* いま何をすべきか（カードの赤文字＋動画エリアの吹き出し） */
function todoText(){
  var e=EXP(), st=APP.step;
  if(st===1) return '動画ファイルを選ぶか、この画面に動画を<b>ドラッグ＆ドロップ</b>してください。';
  if(st===2){
    if(e.t0===null) return '再生して「運動が始まる時刻」を探し、解析を始めたいコマで <b>［この時刻をt = 0］</b> を押してください。';
    if(e.rangeB===null) return '次に、終わりにしたいコマまで進めて <b>［この時刻まで解析］</b> を押してください。';
    return '';
  }
  if(st===3){
    if(!e.originSet) return '画面中央の <b>「原点」</b> を正しい位置にドラッグしてください。';
    if(!e.axisSet) return '動画の上の案内にしたがって、<b>分析する方向（1方向／2方向）</b>を選び、<b>x軸の正の方向をクリック</b>してください。';
    if(!e.mPerPx) return '次に <b>［スケールを設定］</b>：長さのわかる物の両端を 2 か所クリックします。';
    if(UI.calPend) return '動画の上の <b>「スケールはこれでいいですか？」</b> に答えてください。';
    return '';
  }
  if(st===4){
    if(UI.mode==='ref') return '動かない目印（机の角など）をクリックしてください。';
    if(UI.mode==='color') return '追いかけたい物体（マーカー）を<b>1回クリック</b>してください。そこが<b>始点</b>になり、色も覚えます。';
    if(UI.mode==='radius') return '動画の上の<b>円をドラッグ</b>して<b>探索半径</b>を決め、<b>［最後まで自動追跡］</b>を押してください。';
    var n=EXP().objs.reduce(function(a,b){return a+b.length;},0);
    if(needTrackStart()){
      if(APP.twoObj && !(EXP().objName[UI.obj]||'').trim())
        return '<b>物体'+(UI.obj+1)+'の名前</b>を入れてください。';
      return '';        /* 案内はカードの中の「どちらで記録するか」にまかせる */
    }
    /* 「色で自動追跡」を選んでいるときは、手でクリックする案内は出さない */
    if(APP.autoTrack && UI.startedAuto){
      if(trackingDone() || UI.autoLost) return '';
      if(!APP.trackColor || !EXP().objs[UI.obj].length)
        return '<b>［始点を設定し色を取得］</b>を押して、追いかけたい物体を1回クリックしてください。';
      return '';
    }
    if(!n) return (APP.twoObj? '<b>物体番号</b>を選び、':'')+
      '動画の中の物体を<b>クリック（タップ）</b>して位置を記録してください。';
    if(trackingDone()) return '';           /* 終わったら「解析終了」の知らせにゆずる */
    return '物体をクリックするたびコマがすすみます。<br>'+
           '<b>長押し</b>するとズームアップして、正確に点が打てます。';
  }
  return '';
}
function updateTodo(){
  var txt=todoText();
  els('#side1 details[data-step]').forEach(function(d){
    var t=d.querySelector('.todo'); if(!t) return;
    if(d.classList.contains('step-active') && txt){ t.innerHTML=txt; t.classList.remove('hide'); }
    else t.classList.add('hide');
  });
  setVideoHint(txt);
}
function setVideoHint(html){
  var h=$('vhint');
  var cm=$('calMsg');
  if(cm && !cm.classList.contains('hide')){ h.classList.add('hide'); h.__t=''; return; }
  if(!VID.ready){ h.classList.add('hide'); h.__t=''; return; }   /* 動画がまだなら、真ん中の「ここをクリック」だけにする */
  if(UI.mode==='crop' || UI.trimAsking){ h.classList.add('hide'); h.__t=''; return; }   /* トリミング中は 3 の案内を出さない */
  if(!html){ h.classList.add('hide'); h.__t=''; return; }
  if(h.__t!==html){
    h.__t=html; h.__closed=false; $('vhintTxt').innerHTML=html;
    clearTimeout(h.__to);
    var ms=/「原点」/.test(html)? 18000 : 9000;    /* 原点をドラッグする案内だけ 2 倍の時間（18 秒）出す */
    h.__to=setTimeout(function(){ h.classList.add('hide'); }, ms);   /* しばらくすると自動で消える */
  }
  h.classList.toggle('hide', !!h.__closed);
}
/* 済んだカードの「もう一度」ボタン */
function addAgainButtons(){
  els('#side1 details[data-step]').forEach(function(d){
    var n=parseInt(d.dataset.step);
    if(n>=4) return;
    var b=document.createElement('button');
    b.className='btn sm again'; b.textContent='もう一度'; b.type='button';
    b.addEventListener('click', function(ev){ ev.preventDefault(); ev.stopPropagation(); redoStep(n); });
    d.querySelector('summary').appendChild(b);
  });
}
/* 「もう一度」＝そのカードを開いて、また触れるようにするだけ（決めた内容は消さない） */
function redoStep(n){
  stopAuto(); stopAllPlay();
  APP.editStep=n;
  if(n===2) VID.limit=null;                 /* 時間範囲を見直すあいだは範囲外も見られる */
  if(n===4) setStrobeOverlay(false);
  updateSteps();
  var d=el('#side1 details[data-step="'+n+'"]');
  if(d){ d.open=true; setTimeout(function(){
    var r=d.getBoundingClientRect();
    if(r.top<60 || r.top>window.innerHeight-120) d.scrollIntoView({block:'start',behavior:'smooth'});
  },60); }
  toast(stepName(n)+' を直せます（決めた内容はそのままです）');
}
function endEdit(){
  if(!APP.editStep) return;
  APP.editStep=0; applyRangeLimit(); updateSteps();
}
/* まだ触れないカードを押したときの案内 */
function bindEditEnd(){
  els('#side1 details[data-step]').forEach(function(d){
    d.addEventListener('toggle', function(){
      if(!d.open && APP.editStep===parseInt(d.dataset.step)) endEdit();
    });
  });
}
function bindLockedSummaries(){
  els('#side1 details>summary').forEach(function(sm){
    var down=null;
    sm.addEventListener('pointerdown', function(e){ down={x:e.clientX, y:e.clientY, t:Date.now()}; });
    sm.addEventListener('click', function(e){
      var d=sm.parentNode;
      /* ドラッグ（文字を選んだ・すべらせた）ときは開け閉めしない */
      if(down && (Math.abs(e.clientX-down.x)>6 || Math.abs(e.clientY-down.y)>6)){
        e.preventDefault(); down=null; return;
      }
      down=null;
      if(d.classList.contains('step-lock')){
        e.preventDefault();
        toast('さきに「'+stepName(APP.step)+'」を終わらせてください');
      }
    });
  });
}
/* 動画の真ん中の再生ボタン */
function updateBigPlay(){
  var b=$('bigPlay');
  var show = VID.ready && VID.el.paused && APP.step<=2 && !LIVE.on;
  b.classList.toggle('hide', !show);
}
/* シークバーの縦棒（t=0 と おわり） */
function drawSeekMarks(){
  var e=EXP(), sk=$('seek'), r=sk.getBoundingClientRect();
  var w=r.width||300;
  if(!w || sk.offsetParent===null) return;      /* 見えていないときは触らない */
  function place(el, t){
    if(t===null||t===undefined||!VID.dur){ el.classList.add('hide'); return; }
    el.classList.remove('hide');
    el.style.left = Math.max(0, Math.min(w, 8 + (t/VID.dur)*(w-16))) + 'px';
  }
  place($('mkT0'), e.t0);
  place($('mkTB'), e.rangeB);
  var mk=$('rangemark');
  if(VID.dur>0 && (e.t0!==null||e.rangeB!==null)){
    var a=(e.t0||0)/VID.dur, b=(e.rangeB===null?VID.dur:e.rangeB)/VID.dur;
    mk.classList.remove('hide');
    mk.style.left=(8+a*(w-16))+'px';
    mk.style.width=Math.max(2, Math.min(w-8-a*(w-16), (b-a)*(w-16)))+'px';
  } else mk.classList.add('hide');
  /* トラッキングが終わっている所を、別の色で重ねて出す */
  var dm=$('donemark'), dt=$('doneT'), tp=trackedTo();
  if(dm && dt){
    if(tp!==null && VID.dur>0 && effStep()>=4){
      var a2=(e.t0||0)/VID.dur, b2=tp/VID.dur;
      var x0=8+a2*(w-16), x1=8+b2*(w-16);
      dm.classList.remove('hide');
      dm.style.left=x0+'px'; dm.style.width=Math.max(2, x1-x0)+'px';
      dt.classList.remove('hide');
      dt.textContent='記録ずみ t = '+nf((tp-(e.t0||0))*(e.tscale>0?e.tscale:1),3)+' s';
      var lw=dt.offsetWidth||90;
      dt.style.left=Math.max(0, Math.min(w-lw, x1+6))+'px';
    } else { dm.classList.add('hide'); dt.classList.add('hide'); }
  }
}
/* この物体の、トラッキングが終わっている時刻（いちばん後ろの点） */
function trackedTo(){
  var e=EXP(), arr=e.objs[UI.obj];
  if(!arr || !arr.length) return null;
  var t=arr[0].t;
  for(var i=1;i<arr.length;i++) if(arr[i].t>t) t=arr[i].t;
  return t;
}
/* その次に記録する時刻（N コマ先） */
function nextTrkTime(){
  var tp=trackedTo(); if(tp===null) return null;
  var N=parseInt($('inStepN').value)||1, e=EXP();
  var t;
  if(VID.frames.length>1 && typeof tableCovers==='function' && tableCovers(tp)){
    var i=frameIndexAt(tp);
    t=VID.frames[Math.min(VID.frames.length-1, i+N)];
  } else t=tp+N/(VID.fps||30);
  if(e.rangeB!==null) t=Math.min(t, e.rangeB);
  return t;
}
function bindSeekMarks(){
  [['mkT0','t0'],['mkTB','rangeB']].forEach(function(pair){
    var el=$(pair[0]), key=pair[1];
    el.addEventListener('pointerdown', function(e){
      e.preventDefault(); e.stopPropagation();
      if(effStep()!==2){        /* 2 を開いているときだけ動かせる */
        toast('時間範囲を変えるときは「2. 解析する時間範囲の指定」の［もう一度］を押してください');
        return;
      }
      try{ el.setPointerCapture(e.pointerId); }catch(err){}
      el.__drag=true;
    });
    /* 文字（t=0・終わり）を選択してドラッグすると、ブラウザの「ドラッグ＆ドロップ」になって pointerup が来ない
       （pointercancel になる）。すると __drag が立ったままになり、あとでシークバーをいじるたびに縦棒が付いてくる。
       → 選択・ドラッグを禁止し、pointercancel でも旗をおろし、ボタンが押されていない move では動かさない */
    el.addEventListener('dragstart', function(e){ e.preventDefault(); });
    el.addEventListener('selectstart', function(e){ e.preventDefault(); });
    function cancelDrag(){ if(el.__drag){ el.__drag=false; afterChange(); updateSteps(); } }
    el.addEventListener('pointercancel', cancelDrag);
    el.addEventListener('lostpointercapture', function(){ if(el.__drag && !el.__upping) cancelDrag(); });
    el.addEventListener('pointermove', function(e){
      if(!el.__drag||!VID.dur) return;
      if(e.pointerType==='mouse' && !(e.buttons&1)){ cancelDrag(); return; }   /* ボタンが離れているのに来た move は無視 */
      var sk=$('seek'), r=sk.getBoundingClientRect();
      var f=Math.max(0,Math.min(1,(e.clientX-r.left-8)/(r.width-16)));
      EXP()[key]=f*VID.dur;
      updateCalInfo();
    });
    el.addEventListener('pointerup', function(e){
      if(!el.__drag) return;
      el.__drag=false; el.__upping=true; setTimeout(function(){ el.__upping=false; }, 0);
      var e2=EXP(), t=e2[key], one=1/(VID.fps||30);
      /* 縦棒は「範囲そのもの」を決める道具なので、範囲の外へも動かせる。順番だけそろえる */
      if(key==='t0' && e2.rangeB!==null) t=Math.min(t, e2.rangeB-one);
      if(key==='rangeB' && e2.t0!==null) t=Math.max(t, e2.t0+one);
      var keep=VID.limit; VID.limit=null;
      e2[key]=t;
      vidSeek(t).then(function(){
        EXP()[key]=VID.cur; VID.limit=keep;
        afterSeek(); afterChange(); updateSteps();
      });
    });
  });
}
/* 狭い画面では、使用頻度の低いカードをたたんでおく */
function applyNarrowLayout(){
  if(window.innerWidth>=860) return;
  els('#side1 details[data-key]').forEach(function(d){
    if(['howto','range','strobe','out'].indexOf(d.dataset.key)>=0) d.open=false;
  });
}
/* 「時間間隔調整」のつまみ → 何コマおきか */
var STRO_STEPS=[1,2,5,10,20];
function stroStepVal(){
  var q=$('stroStep'); var i=q? (parseInt(q.value)||0) : 0;
  return STRO_STEPS[Math.max(0, Math.min(STRO_STEPS.length-1, i))];
}
/* ふさわしいコマ間隔を自分で決めてストロボ画像を作る（Excel・レポートの「作成しますか？ はい」用）。
   解析範囲のコマ数が 12〜24 枚くらいになる間隔（1・2・5・10・20 コマおき）をえらぶ。1 コマおきは細かすぎるので 2 以上 */
function makeStrobeAuto(){
  if(!VID.ready) return Promise.resolve();
  var e=EXP(), a=rangeStart(e), b=(e.rangeB!==null? e.rangeB : VID.dur-1e-3);
  var F=(VID.frames.length>1)? (frameIndexAt(b)-frameIndexAt(a)) : Math.round((b-a)*(VID.fps||30));
  var idx=1;                                          /* 2 コマおきから */
  for(var i=1;i<STRO_STEPS.length;i++){ idx=i; if(F/STRO_STEPS[i]<=24) break; }
  var q=$('stroStep'); if(q) q.value=String(idx);
  if(typeof updateStroUI==='function') updateStroUI();
  var p=makeStrobe(false);
  return (p && p.then)? p.then(function(){ if(typeof updateStroUI==='function') updateStroUI(); }) : Promise.resolve();
}
/* ストロボまわりの見た目（どこを光らせるか・いま何コマおきか） */
function updateStroUI(){
  var made=!!UI.stroReady, n=stroStepVal();
  var t=$('stroTune'); if(t){ t.classList.toggle('hide', !made); t.classList.toggle('glow', made); }
  var q=$('stroStepInfo'); if(q) q.textContent=n+' コマおき';
  var b=$('btnStrobe'); if(b){
    b.classList.toggle('glow', !made && VID.ready && effStep()>=4);
    b.textContent = made? 'ストロボ画像を作り直す' : 'ストロボ画像を作る';
  }
  ['btnStroSave','btnStroClr'].forEach(function(id){ var x=$(id); if(x) x.disabled=!made; });
}
/* 作っている最中：スライダーなどを受けつけず、「お待ちください」を出す */
function stroBusyUI(on){
  ['stroStep','selStroMode','cbStroPts','btnStroSave','btnStroClr','btnStrobe'].forEach(function(id){
    var x=$(id); if(x) x.disabled=!!on;
  });
  var w=$('stroWait'); if(w){ w.classList.toggle('hide', !on); if(on) w.textContent='お待ちください…'; }
  var t=$('stroTune'); if(t) t.classList.toggle('stro-busy', !!on);
  if(!on) updateStroUI();
}
function stroWaitUI(left){
  var w=$('stroWait'); if(!w) return;
  w.textContent = (left===null)? 'お待ちください…' : 'お待ちください　あと '+left+' 秒';
}
function clearStrobe(){
  UI.stroReady=false; UI.stroBase=null;
  UI.stroImg=null;
  setStrobeOverlay(false);
  var cv=$('cvStrobe');
  cv.classList.add('hide');
  cv.getContext('2d').clearRect(0,0,cv.width,cv.height);
  $('stroInfo').textContent='まだ作っていません';
  if($('stroStep')) $('stroStep').value='0';       /* 1コマおきにもどす */
  updateStroUI();
}
/* トラッキングした点を全部消して、解析範囲の最初にもどる */
function resetTracking(obj){
  stopAuto(); stopAllPlay(); UI.autoLost=false; autoMsgHide();
  var e=EXP(), i;
  if(obj===undefined && APP.twoObj) obj=0;         /* 2物体のときは、ボタンごとに物体を指定 */
  if(obj===undefined){
    var n=e.objs.reduce(function(a,o){ return a+o.length; },0);
    if(!n){ toast('記録した点はまだありません'); return; }
    pushUndo({t:'bulkAll', prev:e.objs.map(function(o){ return o.slice(); })});
    for(i=0;i<NOBJ;i++){ e.objs[i]=[]; e.objReady[i]=false; e.objEnd[i]=false; }
    e.trackReady=false;
  } else {
    if(!e.objs[obj].length){ toast('物体'+(obj+1)+'の点はまだありません'); return; }
    pushUndo({t:'bulk', obj:obj, prev:e.objs[obj].slice()});
    e.objs[obj]=[]; e.objReady[obj]=false; e.objEnd[obj]=false;
    UI.obj=obj; $('selObj').value=String(obj+1);
  }
  UI.lastPt=null;
  refreshObjUI();
  afterChange(); render();
  rewindToRangeStart();
  toast((obj===undefined? 'トラッキングした点' : '物体'+(obj+1)+'の点')+'をリセットしました（Ctrl+Z でもどせます）');
}
function switchExp(i){
  UI.calPend=null; if(typeof setCalHint==='function') setCalHint(null); calMsg('');
  APP.cur=i; UI.undo=[]; UI.lastPt=null; clearStrobe();
  refreshExpUI(); afterChange(); render();
}

/* ---------- 動画の読み込み ---------- */
/* 解析できる動画の上限（これを超えたら開かない） */
var VLIM = { bytes:500*1024*1024, dur:40, px:4096 };
var VREC = { bytes:100*1024*1024, dur:30, w:1920, h:1080 };
function sizeText(b){ return (b>=1024*1024*1024)? (b/1024/1024/1024).toFixed(2)+' GB' : Math.round(b/1024/1024)+' MB'; }
function overLimitMsg(o){
  var r=[];
  if(o.bytes>VLIM.bytes) r.push('ファイルの大きさが <b>'+sizeText(o.bytes)+'</b>（上限 '+sizeText(VLIM.bytes)+'）');
  if(o.dur>VLIM.dur) r.push('長さが <b>'+nf(o.dur,1)+' 秒</b>（上限 '+VLIM.dur+' 秒）');
  if(o.w>VLIM.px || o.h>VLIM.px) r.push('画面の大きさが <b>'+o.w+'×'+o.h+' px</b>（上限 '+VLIM.px+' px）');
  if(!r.length) return '';
  return '<b>このファイルは解析できません。</b><br>'+r.join('<br>')+
    '<br><span class="mini" style="color:inherit">スマートフォンの「トリミング」で<b>見たい運動の前後だけ</b>を切り出すか、'+
    '「解像度を下げて書き出す」で小さくしてから、もう一度読み込んでください。おすすめは <b>5〜30 秒・フルHD・100 MB 以内</b>です。</span>';
}
/* 読み込んだあとに、長さと画面の大きさをたしかめる */
function checkLoadedVideo(name){
  var m=overLimitMsg({bytes:0, dur:VID.dur, w:VID.w, h:VID.h});
  if(m){
    vidUnload();
    $('vidErr').innerHTML=m; $('vidErr').classList.remove('hide');
    $('vinfo').innerHTML='<span class="ng">'+esc(name)+' は開けませんでした。</span>';
    toast('この動画は解析できません');
    return false;
  }
  var w=[];
  if(VID.dur>VREC.dur) w.push('長さ '+nf(VID.dur,1)+' 秒');
  if(VID.w>VREC.w || VID.h>VREC.h) w.push('画面 '+VID.w+'×'+VID.h+' px');
  if(w.length) toast('大きめの動画です（'+w.join('・')+'）。少し重くなります');
  return true;
}
/* 動画を外す（上限を超えたとき） */
function vidUnload(){
  try{ VID.el.pause(); }catch(e){}
  VID.ready=false; VID.frames=[]; VID.dur=0; VID.cur=0; VID.idx=0; VID.limit=null;
  try{ VID.el.removeAttribute('src'); VID.el.load(); }catch(e){}
  $('cvView').classList.add('hide'); $('cvOv').classList.add('hide');
  $('vph').classList.remove('hide');
  $('ftState').textContent='未測定';
  APP.step=0; updateSteps();
}
/* 新しい動画を読む前に：ここまでの実験を残すか聞く
   はい → いまの実験はそのまま残し、新しい動画は次の実験番号で始める
   いいえ → いまの実験の測定を消して、同じ実験番号で始め直す */
function askKeepExp(next){
  var e=EXP();
  var n=e.objs.reduce(function(a,o){ return a+o.length; },0);
  if(!VID.ready || !n){ next(); return; }
  var cur=APP.cur+1, nxt=APP.exps.length+1;
  popup('<h2>ここまでの実験を「実験'+cur+'」として記録しますか？</h2>'+
    '<p style="font-size:1.02rem">いま <b>'+esc(e.name)+'</b> に <b>'+n+' 点</b>の測定があります。</p>'+
    '<p class="mini">・<b>記録する</b>…いまの測定はそのまま残り、新しい動画は <b>実験'+nxt+'</b> になります。<br>'+
    '・<b>記録しない</b>…いまの測定は消えて、新しい動画がまた <b>実験'+cur+'</b> になります。</p>',
    '記録する（実験'+cur+'として残す）',
    function(){
      if(APP.exps.length>=MAXEXP){ toast('実験は'+MAXEXP+'個までです。古い実験を消してください'); return; }
      var ne=newExp(APP.exps.length+1);
      APP.exps.push(ne); APP.cur=APP.exps.length-1;
      UI.undo=[]; UI.lastPt=null; UI.obj=0;
      refreshExpUI(); afterChange();
      next();
    },
    { noLabel:'記録しないで進む', onNo:function(){
        var e2=EXP();
        for(var i=0;i<NOBJ;i++){ e2.objs[i]=[]; e2.objReady[i]=false; e2.objEnd[i]=false; e2.objName[i]=''; }
        e2.trackReady=false; e2.origin=null; e2.originSet=false; e2.axisSet=false; e2.angle=0;
        e2.mPerPx=null; e2.scaleRef=null; e2.t0=null; e2.rangeB=null; e2.rangeA=null;
        e2.step2ok=false; e2.crop=null; e2.ref=[]; e2.nOk=false; e2.nObjOk=false;
        UI.undo=[]; UI.lastPt=null; UI.obj=0; APP.editStep=0; resetFlowFlags(true);
        refreshExpUI(); afterChange();
        next();
      } });
}
function loadVideoFile(file){
  $('vidErr').classList.add('hide');
  var big=overLimitMsg({bytes:file.size, dur:0, w:0, h:0});
  if(big){
    $('vidErr').innerHTML=big; $('vidErr').classList.remove('hide');
    toast('この動画は解析できません');
    return;
  }
  var url=URL.createObjectURL(file);
  VID.bytes=file.size;
  setBusy(true, '動画を読み込んでいます…', 'ファイルの大きさによっては少し時間がかかります。');
  var pr=vidLoad(url, file.name), myseq=VID.loadSeq;
  pr.then(function(){
    if(myseq!==VID.loadSeq) return;                /* もっと新しい動画が選ばれた */
    if(!checkLoadedVideo(file.name)){ setBusy(false); return; }
    onVideoReady(file.name);      /* 読み込み中の表示は、コマ表づくりまで続けて出す */
    if(file.size < 30*1024*1024){
      var fr=new FileReader();
      fr.onload=function(){ KADAI_SRC={data:fr.result, type:file.type, size:file.size, name:file.name}; };
      fr.readAsDataURL(file);
    } else KADAI_SRC={data:null,type:'',size:file.size,big:true};
  }).catch(function(err){
    if(myseq!==VID.loadSeq) return;
    setBusy(false); showVidError(err, file.name);
  });
}
function loadVideoUrl(url, name){
  $('vidErr').classList.add('hide');
  VID.bytes=0;
  setBusy(true, '動画を読み込んでいます…', 'ファイルの大きさによっては少し時間がかかります。');
  var pr=vidLoad(url, name), myseq=VID.loadSeq;
  pr.then(function(){
    if(myseq!==VID.loadSeq) return;                /* もっと新しい動画が選ばれた */
    if(!checkLoadedVideo(name)){ setBusy(false); return; }
    onVideoReady(name);      /* 読み込み中の表示は、コマ表づくりまで続けて出す */
    if(location.protocol==='http:'||location.protocol==='https:'){
      fetch(url).then(function(r){return r.blob();}).then(function(b){
        if(b.size>30*1024*1024) return;
        var fr=new FileReader(); fr.onload=function(){ KADAI_SRC={data:fr.result,type:b.type,size:b.size}; };
        fr.readAsDataURL(b);
      }).catch(function(){});
    }
  }).catch(function(err){
    if(myseq!==VID.loadSeq) return;
    setBusy(false); showVidError(err, name);
  });
}
function showVidError(err, name){
  if(UI.loadingSample){                 /* サンプル動画がまだ置かれていないとき */
    UI.loadingSample=false;
    $('vidErr').innerHTML='<b>サンプル動画「'+esc(name)+'」は、まだ用意されていません。</b><br>'+
      '自分で撮った動画を「動画を選択」から読みこんでください。';
    $('vidErr').classList.remove('hide');
    $('vinfo').textContent='サンプル動画はまだありません';
    $('vph').classList.remove('hide');
    $('vph').innerHTML='サンプル動画はまだ用意されていません。<br><b>動画を選択</b>から自分の動画を読みこんでください。';
    $('cvView').classList.add('hide'); $('cvOv').classList.add('hide');
    return;
  }
  $('vidErr').innerHTML=vidErrMsg(err, name);
  $('vidErr').classList.remove('hide');
  $('vinfo').textContent='読み込みに失敗しました：'+name;
  $('vph').classList.remove('hide');
  $('vph').innerHTML='<b style="color:#ff9a90">この動画は、この端末では開けませんでした。</b><br>'+
    '「1. 動画」の赤い案内に、どうすればよいかを書いています。';
  $('cvView').classList.add('hide'); $('cvOv').classList.add('hide');
  var c=document.querySelector('details[data-key="video"]'); if(c) c.open=true;
  try{ $('vidErr').scrollIntoView({block:'center', behavior:'smooth'}); }catch(e){}
}
/* 自由選択グラフの設定を、はじめの状態（縦軸 x・横軸 t・いまの実験の物体1）にもどす */
function resetCG(){
  APP.cg={ expA:APP.cur, objA:0, qA:'x', invA:false, expB:APP.cur, objB:0, qB:'x', invB:false,
           xq:'t', invX:false, two:false, line:true };
  APP.cgFit=null; APP.cgRange=null;
  if($('cgResult')) $('cgResult').innerHTML='';
  if($('cgMomentumNote')) $('cgMomentumNote').classList.add('hide');
  if($('cgMomentumErr')) $('cgMomentumErr').classList.add('hide');
  if($('cgQA')){ refreshCGExps(); cgFillQuantities(); cgToUI(); }
  if($('cgCard') && !$('cgCard').classList.contains('hide')) renderCG();
}
function onVideoReady(name){
  var exp=EXP();
  UI.loadingSample=false;
  /* 新しい動画になったら、②の「動画と一緒に再生」はやめて ① にもどす
     （前の動画のグラフのまま、新しい動画が動いてしまうため） */
  if(APP.m2mode==='live') setM2Mode('side', true);
  if(APP.tab!=='1') setTab('1');
  UI.autoLost=false; autoMsgHide(); tblFrom=null;
  UI.calPend=null; setCalHint(null); calMsg('');
  clearStrobe();
  resetCG();                       /* 新しい動画を読んだら、自由選択グラフは既定にもどす */
  selClear(); gvReset();
  /* 同じ動画を開き直したとき（続きから）だけ、fps の確認は聞かない */
  var same = !!(exp.fpsOk && exp.video && exp.video.name===name &&
                exp.video.w===VID.w && exp.video.h===VID.h && Math.abs((exp.video.dur||0)-VID.dur)<0.05);
  /* 課題ファイルの動画を初めて読んだとき：先生が決めた fps・N・物体の数をそのまま使う（聞き直さない） */
  if(UI.kadaiPending){ same=true; UI.kadaiPending=false; }
  exp.fpsOk = same;
  resetFlowFlags(!same);          /* 別の動画なら、進むフレーム数 N も聞き直す（1 コマの時間が変わるため） */
  exp.video={name:name, w:VID.w, h:VID.h, dur:VID.dur, fps:VID.fps};
  $('vph').classList.add('hide');
  $('cvView').classList.remove('hide'); $('cvOv').classList.remove('hide');
  $('vinfo').innerHTML='<b>'+esc(name)+'</b>　'+VID.w+'×'+VID.h+' px　'+nf(VID.dur,2)+' 秒';
  $('ftState').textContent='未測定';
  VIEW.zoom=1; VIEW.panX=0; VIEW.panY=0;
  vidSeek(0).then(function(){
    render(); afterChange(); updateSteps(); updateBigPlay(); updateCropInfo();
    renderVidDiag(); updateFpsLine();
    if(VID.hasRVFC && VID.dur>0) buildTableUI(true);
    else if(!VID.hasRVFC) $('ftState').innerHTML='<span class="ng">この端末では測れません</span>';
    if(!VID.building){ setBusy(false); if(!EXP().fpsOk) askFpsUI(); }   /* コマ表を作らないときは、ここで解放 */
  });
}
/* 測る時間の範囲：2 で解析範囲が決まっていれば、その部分だけを測る（長い動画で速く終わる） */
function tableSpan(){
  var e=EXP();
  if(VID.dur<=40) return null;
  if(e.t0===null || e.rangeB===null) return null;
  return { a:Math.max(0, e.t0-0.4), b:Math.min(VID.dur, e.rangeB+0.4) };
}
/* auto=true … 動画を読んだ直後に、こちらから始める測定
   （生徒が続けざまに動画を選ぶと前の測定がまだ走っているので、
     それを止めてから、あらためて始める。ボタンで押したときは「中止」のまま） */
function buildTableUI(auto, seq){
  if(auto===true && seq===undefined) seq=VID.loadSeq;
  if(auto===true && seq!==VID.loadSeq) return;      /* さらに新しい動画になった */
  if(!VID.hasRVFC){ toast('この端末（ブラウザ）ではコマごとの時刻を測れません。fps から計算します'); return; }
  if(VID.building){
    if(auto===true){ VID.cancelBuild=true;
      setTimeout(function(){ buildTableUI(true, seq); }, 250); return; }
    VID.cancelBuild=true; toast('時刻の測定を止めました'); return;
  }
  $('btnFrameTable').textContent='中止する';
  var p=$('ftProg'); p.classList.remove('hide');
  $('ftState').textContent='測定中…';
  var sp=tableSpan(), len=sp? (sp.b-sp.a) : VID.dur;
  var mins=(len>40? len/2 : len)*1.2;            /* 40秒を超える分は2倍速で再生する */
  setBusy(true, 'コマごとの時刻を測っています…',
    (sp? '<b>解析する時間範囲（'+nf(len,1)+' 秒）</b>だけを測っています。'
       : '動画を1回だけ最後まで再生して、コマごとの時刻を測っています。')+
    'めやすは <b>'+(mins>=60? nf(mins/60,1)+' 分':Math.round(mins)+' 秒')+'</b>です。');
  busyProg(0);
  var myseq=VID.loadSeq, settled=false;
  /* 番犬：何かの理由で測定が終わらなくても、画面を固めたままにしない。
     （取りこぼしの測り直しが長引く・端末が再生を止める、など） */
  var guard=setTimeout(function(){
    if(settled || myseq!==VID.loadSeq) return;
    VID.cancelBuild=true;
    setTimeout(function(){
      if(settled || myseq!==VID.loadSeq) return;
      settled=true; VID.building=false; VID.needExact=false;
      p.classList.add('hide'); setBusy(false); busyProg(null);
      $('btnFrameTable').textContent='コマごとの時刻を測る';
      if(VID.frames.length>2){ trimTable(); $('ftState').innerHTML='<b>'+VID.frames.length+' コマ</b>（途中で打ち切り）'; }
      else { VID.frames=[]; $('ftState').innerHTML='<span class="ng">測れませんでした（fps から計算します）</span>'; }
      toast('時刻の測定に時間がかかりすぎたので、ここまでで進めます');
      renderVidDiag(); render(); afterChange(); askFpsUI();
    }, 1500);
  }, Math.round((mins+25)*1000));
  vidBuildTable(function(f, msg){ p.querySelector('i').style.width=Math.round(f*100)+'%'; busyProg(f);
                  if(msg) $('busySub').innerHTML=msg; },
                sp? sp.a : 0, sp? sp.b : 0)
   .then(function(okk){
     clearTimeout(guard);
     if(settled) return;
     settled=true;
     if(myseq!==VID.loadSeq){ p.classList.add('hide'); return; }   /* 別の動画になった */
     p.classList.add('hide'); setBusy(false); busyProg(null);
     $('btnFrameTable').textContent='コマごとの時刻を測る';
     if(okk){
       var st=fpsFromTable();
       var a0=VID.frames[0], b0=VID.frames[VID.frames.length-1];
       $('ftState').innerHTML='<b>'+VID.frames.length+' コマ</b>'+
         (VID.tablePartial? '<span class="ng">（'+nf(a0,2)+'〜'+nf(b0,2)+' 秒のぶんだけ）</span>':'');
       $('inFps').value=nf(VID.fps,3);
       $('fpsSrc').textContent='（実測した時刻から'+(st&&st.vfr?'／コマ間隔にばらつきあり':'')+'）';
       EXP().video.fps=VID.fps;
       if(VID.tablePartial)
         toast('時刻を測れたのは '+nf(a0,2)+'〜'+nf(b0,2)+' 秒のぶんだけです。'+
               'もう一度測るか、解析する時間範囲をこの中にしてください');
       else if(st&&st.vfr) toast('コマの間隔が一定ではありません（可変フレームレート）。実測時刻を使います');
     } else {
       $('ftState').innerHTML='<span class="ng">測れませんでした</span>';
     }
     renderVidDiag(); updateFpsLine();
     render(); afterChange();
     if(!EXP().fpsOk) askFpsUI();       /* 撮影 fps・スローの確認（入れ忘れ防止） */
   });
}

/* ---------- カメラ ---------- */
function cameraSupported(){
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder && window.isSecureContext);
}
function openCamera(){
  var stream=null, rec=null, chunks=[];
  var m=document.createElement('div'); m.className='modal';
  m.innerHTML='<div class="box" style="max-width:640px">'+
    '<h2>カメラで撮影</h2>'+
    '<div class="camwrap" id="camWrap">'+
    '<video id="camPrev" playsinline muted autoplay style="width:100%;background:#000;border-radius:8px;display:block"></video>'+
    '<canvas id="camGuide"></canvas>'+
    '<div id="camTilt" class="camtilt">傾きセンサー：未使用</div>'+
    '</div>'+
    '<div class="row" style="margin-top:8px">'+
    '<button class="btn pri" id="camRec">● 録画開始</button>'+
    '<button class="btn" id="camStop" disabled>■ 停止して使う</button>'+
    '<button class="btn" id="camCancel">やめる</button>'+
    '<span class="tag" id="camT">0.0 秒</span>'+
    '<button class="btn sm hide" id="camSensor">傾きセンサーを使う</button></div>'+
    '<p class="mini">線が<b style="color:#1c8f4a">緑</b>なら水平です。<b style="color:#e8443a">赤</b>のときは机や壁に立てかけて、'+
    '線が緑になる向きに直してください。運動する向きに対して<b>真横</b>から、明るい所で撮ります。'+
    '複数の物体を追いかけるときは、物体ごとに<b>ちがう色</b>のマーカーをつけます。</p></div>';
  document.body.appendChild(m);
  var t0=0, timer=null;
  var guide=camGuideStart(m);          /* 水平の線・中央の十字・三分割の線と、傾きセンサー */
  navigator.mediaDevices.getUserMedia({video:{facingMode:'environment', width:{ideal:1280}, height:{ideal:720}, frameRate:{ideal:60}}, audio:false})
    .then(function(s){ stream=s; el('#camPrev',m).srcObject=s; })
    .catch(function(){ alert('カメラを使えませんでした。端末のカメラアプリで撮ってから読み込んでください。'); close(); });
  function close(){ if(timer)clearInterval(timer); if(guide) guide.stop(); if(stream) stream.getTracks().forEach(function(t){t.stop();}); m.remove(); }
  el('#camCancel',m).onclick=close;
  el('#camRec',m).onclick=function(){
    var types=['video/mp4;codecs=avc1','video/mp4','video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'];
    var mt=types.filter(function(t){ return window.MediaRecorder.isTypeSupported(t); })[0];
    rec=new MediaRecorder(stream, mt?{mimeType:mt, videoBitsPerSecond:6000000}:undefined);
    chunks=[];
    rec.ondataavailable=function(e){ if(e.data.size) chunks.push(e.data); };
    rec.onstop=function(){
      var b=new Blob(chunks,{type:rec.mimeType||'video/webm'});
      var ext=(b.type.indexOf('mp4')>=0)?'mp4':'webm';
      var f=new File([b],'撮影_'+Date.now()+'.'+ext,{type:b.type});
      close(); askKeepExp(function(){ loadVideoFile(f); });
    };
    rec.start(); t0=Date.now();
    el('#camRec',m).disabled=true; el('#camStop',m).disabled=false;
    timer=setInterval(function(){ el('#camT',m).textContent=((Date.now()-t0)/1000).toFixed(1)+' 秒'; },100);
  };
  el('#camStop',m).onclick=function(){ if(rec&&rec.state!=='inactive') rec.stop(); };
}

/* ---------- ドラッグ＆ドロップ ---------- */
function bindDrop(){
  var n=0;
  window.addEventListener('dragenter', function(e){ e.preventDefault(); n++; document.body.classList.add('dropping'); });
  window.addEventListener('dragover', function(e){ e.preventDefault(); });
  window.addEventListener('dragleave', function(e){ n--; if(n<=0){ n=0; document.body.classList.remove('dropping'); } });
  window.addEventListener('drop', function(e){
    e.preventDefault(); n=0; document.body.classList.remove('dropping');
    var f=e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if(!f) return;
    if(/\.json$/i.test(f.name)){ importJson(f); return; }
    if(f.type.indexOf('video')<0 && !/\.(mp4|mov|webm|m4v|avi|mkv)$/i.test(f.name)){
      toast('動画ファイル（mp4 など）を入れてください'); return;
    }
    askKeepExp(function(){ loadVideoFile(f); });
  });
}

/* ---------- 再生 ---------- */
var playTimer=null;
/* 再生のおわり（解析範囲があればその終わり、無ければコマ表の最後のコマ）。
   動画の dur は最後のコマより少し先にあるので、コマ表があればそちらを使う。 */
function playEndT(){
  if(VID.limit) return VID.limit.b;
  if(VID.frames && VID.frames.length) return VID.frames[VID.frames.length-1];
  return VID.dur;
}
function playStartT(){ return VID.limit? VID.limit.a : 0; }
/* もう終わりまで来ているか（1コマぶんの余裕をみる） */
function atPlayEnd(){
  if(!VID.ready) return false;
  var eps=Math.max(0.02, 0.6/(VID.fps||30));
  var t=Math.max(VID.cur, VID.el? VID.el.currentTime : 0);
  return (VID.el && VID.el.ended) || t >= playEndT()-eps;
}
/* 再生ボタンの表示（①の2か所と②の live で共通） */
function playLabels(on){
  var t = on? '⏸ 停止' : '▶ 再生';
  ['btnPlay','btnPlay2','btnLivePlay'].forEach(function(id){ if($(id)) $(id).textContent=t; });
}
/* いま「再生中」か（ふつうの再生でも、コマ送りでも） */
function isPlaying(){ return (VID.ready && VID.el && !VID.el.paused) || !!komaTimer; }
function togglePlay(){
  if(!VID.ready) return;
  if(isPlaying()){ stopAllPlay(); return; }
  /* 最後まで見たあとに押したときは、はじめに戻してから再生する */
  if(atPlayEnd()){
    vidSeek(playStartT()).then(function(){
      afterSeek();
      if(LIVE.on) liveTick(-Infinity);
      if(APP.komaMode) komaStart(); else startPlay();
    });
    return;
  }
  if(APP.komaMode){ komaStart(); return; }      /* コマ送りスイッチが入っていれば、コマ送りで再生 */
  startPlay();
}
function stopAllPlay(){
  if(komaTimer) stopKoma();
  if(VID.ready && VID.el && !VID.el.paused) stopPlay();
  else { playLabels(false); updateBigPlay(); }
}
function startPlay(){
  var v=VID.el;
  stopKoma();                    /* コマ送り中にふつうの再生を押したら、コマ送りは止める */
  if(playTimer){ clearInterval(playTimer); playTimer=null; }   /* 二重に走らせない */
  APP.played=true;
  updateGuide();                 /* 再生したら「この時刻をt = 0」を光らせる */
  v.play(); playLabels(true);
  updateBigPlay();
  if(LIVE.on){ LIVE.playing=true; LIVE.drawn=false; }
  /* 描くのは「動画の新しいコマが出た瞬間」（requestVideoFrameCallback）。60 ms の時計で描くと、
     コマの出るタイミングとずれて同じコマを 2 回描いたり 1 コマ飛ばしたりして、コマ送りのように見える端末がある。
     使えないブラウザでは 60 ms の時計で描く。時計は終わりの見張りも兼ねる */
  var mySeq=(UI.playSeq=(UI.playSeq||0)+1);
  function tick(mt){
    if(v.paused) return false;
    if(v.currentTime >= playEndT() - 0.01){ stopPlay(); return false; }
    VID.cur=(typeof mt==='number')? mt : v.currentTime; VID.idx=frameIndexAt(VID.cur);
    render(); updateTimeLine();
    if(LIVE.on) liveTick();          /* グラフにも点を打っていく */
    return true;
  }
  var useRVFC=!!(VID.hasRVFC && v.requestVideoFrameCallback);
  if(useRVFC){
    var fc=function(now, md){
      if(mySeq!==UI.playSeq || !playTimer) return;
      if(tick(md && typeof md.mediaTime==='number'? md.mediaTime : undefined)) v.requestVideoFrameCallback(fc);
    };
    v.requestVideoFrameCallback(fc);
  }
  playTimer=setInterval(function(){
    if(v.paused){ stopPlay(); return; }
    if(v.currentTime >= playEndT() - 0.01){ stopPlay(); return; }
    if(!useRVFC) tick();
  }, useRVFC? 100 : 60);
}
function stopPlay(){
  var v=VID.el; v.pause(); playLabels(false);
  updateBigPlay();
  if(playTimer){ clearInterval(playTimer); playTimer=null; }
  updateGuide();
  if(LIVE.on){ LIVE.playing=false; LIVE.drawn=false; liveTick(); }   /* 止まったら、きれいに描き直す */
  vidSeek(v.currentTime).then(afterSeek);
}

/* ---------- かんたんなポップアップ ---------- */
function popup(html, okLabel, onOk, opt){
  opt=opt||{};
  var m=document.createElement('div'); m.className='modal';
  m.innerHTML='<div class="box" style="max-width:560px">'+html+
    '<div class="row" style="margin-top:12px;justify-content:flex-end">'+
    '<button class="btn" data-x="no">'+esc(opt.noLabel||'やめる')+'</button>'+
    '<button class="btn pri" data-x="ok">'+esc(okLabel||'OK')+'</button></div></div>';
  document.body.appendChild(m);
  m.addEventListener('click', function(e){
    if(e.target===m || e.target.dataset.x==='no'){ m.remove(); if(opt.onNo) opt.onNo(); }
    else if(e.target.dataset.x==='ok'){ m.remove(); if(onOk) onOk(); }
  });
}

/* ---------- 「フィッティングとは」の説明 ---------- */
function openWhatFit(){
  var pts=[[0.5,2.0],[1.0,2.9],[1.5,4.3],[2.0,4.9],[2.5,6.2],[3.0,6.8]];
  var a=1.62, b=1.15;                       /* 図に描く直線 y = a x + b */
  function X(v){ return 40+v*74; }
  function Y(v){ return 168-v*20; }
  var svg='<svg width="100%" viewBox="0 0 320 190" style="max-width:340px;background:#fff;'+
    'border:1px solid var(--line);border-radius:9px">'+
    '<line x1="36" y1="8" x2="36" y2="172" stroke="#8d99a6"/>'+
    '<line x1="36" y1="172" x2="312" y2="172" stroke="#8d99a6"/>'+
    '<text x="316" y="176" font-size="11" text-anchor="end" fill="#5b6672">x</text>'+
    '<text x="30" y="14" font-size="11" fill="#5b6672">y</text>'+
    '<line x1="'+X(0.2)+'" y1="'+Y(a*0.2+b)+'" x2="'+X(3.3)+'" y2="'+Y(a*3.3+b)+'" stroke="#1c8f4a" stroke-width="2.5"/>';
  pts.forEach(function(p){
    var yh=a*p[0]+b;
    svg+='<line x1="'+X(p[0])+'" y1="'+Y(p[1])+'" x2="'+X(p[0])+'" y2="'+Y(yh)+'" stroke="#e8443a" stroke-width="2" stroke-dasharray="3 2"/>';
    svg+='<circle cx="'+X(p[0])+'" cy="'+Y(p[1])+'" r="4" fill="#1663b5"/>';
  });
  svg+='<text x="'+X(2.55)+'" y="'+(Y(a*2.55+b)-8)+'" font-size="11" fill="#1c8f4a" font-weight="bold">えらんだ式</text>'+
       '<text x="'+X(1.05)+'" y="'+(Y(2.9)+22)+'" font-size="11" fill="#e8443a" font-weight="bold">ずれ</text>'+
       '</svg>';
  $('helpBox').innerHTML=
   '<button class="btn sm cls" id="hpClose">閉じる</button>'+
   '<h2>フィッティングって何をしているの？</h2>'+
   '<p><b>フィッティング</b>は、測り取った<b>点のならび</b>に、一番近い<b>式（グラフ）</b>を見つけることです。</p>'+
   '<div class="row" style="align-items:flex-start;gap:12px">'+svg+
   '<div style="flex:1 1 220px;min-width:200px">'+
   '<p class="mini">青い点＝測った値。緑の線＝あてはめた式。<br>赤い点線＝そのずれ（残差）。</p>'+
   '<p class="mini">ずれが小さいほど、その式で運動をうまく表せている、ということです。</p></div></div>'+
   '<h3>最小二乗法</h3>'+
   '<p>ずれには＋と－があるので、そのまま足すと打ち消し合ってしまいます。そこで<b>2乗してから足し</b>、'+
   'その合計が一番小さくなるように係数を決めます。これが<b>最小二乗法</b>です。</p>'+
   '<p class="fml">S = ( y₁ − ŷ₁ )² + ( y₂ − ŷ₂ )² + … + ( y<sub>n</sub> − ŷ<sub>n</sub> )² &nbsp;→&nbsp; 最小</p>'+
   '<p class="mini">y は測った値、ŷ（ワイハット）はその x での式の値です。'+
   'たとえば直線 y = a x + b なら、S が一番小さくなる a と b を計算で求めます。</p>'+
   '<h3>R²（決定係数）</h3>'+
   '<p>「その式でどれほど説明できたか」を 0〜1 で表した数です。</p>'+
   '<p class="fml">R² = 1 − ( ずれの2乗の合計 ) ÷ ( 平均からの散らばりの2乗の合計 )</p>'+
   '<ul><li><b>1 に近い</b>ほど、点が式にぴったりのっています</li>'+
   '<li>0 に近いときは、その式では表せていません（別の式を試す）</li>'+
   '<li>R² が高い＝物理的に正しい、とはかぎりません。次数を上げれば R² は上がってしまいます</li></ul>'+
   '<h3>使うときのコツ</h3>'+
   '<ul><li>グラフの<b>青い帯</b>で、フィッティングに使う範囲を選べます。'+
   '手を離す前や、ぶつかった後など「別の運動」の部分は外しましょう</li>'+
   '<li>どの式を選ぶかは自分で決めます（等速なら直線、等加速度なら放物線、ばねなら正弦…）</li></ul>'+
   '<h3>フィッティング残差とは</h3>'+
   '<p><b>残差</b>は「<b>測った値 − 式の値</b>」、つまり上の図の<span style="color:#e8443a;font-weight:700">赤い点線</span>の長さ（符号つき）です。'+
   'これを横軸 t にならべて点で描いたものが<b>フィッティング残差のプロット</b>です。</p>'+
   '<p class="fml">残差 = y − ŷ　（＋なら式より上、−なら式より下）</p>'+
   '<p>R² は「全体としてどれくらい合ったか」を1つの数にまとめたものなので、'+
   '<b>どこで、どんなふうに合わなかったか</b>までは分かりません。残差のプロットはそこを見せてくれます。</p>'+
   '<ul>'+
   '<li><b>0 のまわりにばらばら</b>に散っている → その式でよく表せています。'+
   '残っているのはクリックのずれ（偶然の誤差）だけ、ということです</li>'+
   '<li><b>ゆるやかに曲がったかたより</b>がある（Uの字や逆Uの字）→ <b>式の形が合っていません</b>。'+
   '直線でフィッティングしたけれど本当は放物線だった、空気抵抗や摩擦がはたらいていた、などが考えられます</li>'+
   '<li><b>途中から急にずれる</b> → その時刻で運動が変わっています'+
   '（手が離れた、ぶつかった、床についた…）。青い帯でそこを外してフィッティングし直します</li>'+
   '<li><b>だんだん大きくなる／小さくなる</b> → 動画がぶれている、スケールが合っていない、なども疑えます</li></ul>'+
   '<p class="mini">残差の大きさ（RMS）は、残差を2乗して平均し、ルートをとったものです。'+
   '測った量と同じ単位なので、「だいたい何 m ずれているか」が分かります。</p>';
  $('helpModal').classList.remove('hide');
  $('hpClose').onclick=function(){ $('helpModal').classList.add('hide'); };
}

/* ---------- 使い方 ---------- */
function openHelp(){
  $('helpBox').innerHTML=
  '<button class="btn sm cls" id="hpClose">閉じる</button>'+
  '<h2>使い方と時間算出法</h2>'+
  '<p class="mini">動画も測定値も、この端末の中だけで処理します。どこにも送信しません。ネットにつながっていなくても動きます。</p>'+
  '<div class="note">画面は <b>① 撮影・トラッキング → ② グラフ → ③ 解析</b> の3つのタブ。'+
  '①の左（または上）のカードは <b>1 → 2 → 3 → 4 の順</b>に進みます。'+
  'いま作業するところが<b>オレンジ色に光り</b>、終わったところは薄くなります。'+
  '3 まで終わると 4 のトラッキングが、4 で点を記録すると 5. 出力・保存 と、上の <b>②グラフ・③解析・④ストロボ画像</b> のタブが使えるようになります（<b>補足</b>のタブはいつでも）。</div>'+
  '<h3>1. 動画を読みこむ</h3>'+
  '<p>「<b>動画を選択</b>」から選ぶか、<b>動画エリアをクリック</b>するか、<b>画面にドラッグ＆ドロップ</b>します。'+
  '「カメラ撮影」でその場で撮ることも、サンプル動画を使うこともできます。</p>'+
  '<ul><li>動画は <b>40 秒まで</b>（おすすめは 5〜30 秒・フルHD・100 MB 以内）。長いときは、見たい運動の前後だけを切り出してから読みこみます</li>'+
  '<li>読みこむと<b>コマ 1 枚ごとの時刻</b>を自動で測ります（いちばん下の「時刻はどうやって求めているか」）。'+
  'スマホの動画はコマの間隔が一定でないことがあるので、時刻は 1/30 秒の決め打ちではなく<b>実測値</b>を使います</li>'+
  '<li>測り終わると <b>「撮影 fps（フレームレート）の確認」</b> が出ます。撮影 fps は<b>整数</b>（30 や 60）で入れます。ふつうの速さで撮った動画なら、そのまま「この設定で進む」。'+
  'スロー（ハイスピード）で撮った動画は、ここで倍率（1/8 など）を選びます。実測した再生 fps（30.006 など）は参考として括弧の中に出ます</li>'+
  '<li>1 のカードに <b>「この動画の撮れぐあい」</b>（長さ・画面の大きさ・コマ数・明るさ・コマのくっきりさ・手ぶれ）が ○△× で出ます。'+
  '△や×には直し方が書いてあります</li>'+
  '<li><b>カメラ撮影</b>では、プレビューに<b>水平の線・中央の十字・三分割の線</b>が出ます。端末の傾きセンサーが使えるときは、'+
  '線が<b>緑なら水平、赤ならかたむいている</b>合図です（iPhone/iPad は［傾きセンサーを使う］を押して許可します）</li>'+
  '<li><b>動画をトリミング（端を切る）</b>：使いたい所だけを四角く囲むと、その部分が動画エリアいっぱいに広がります</li>'+
  '<li>開けないときは、iPhone/iPad の <b>設定→カメラ→フォーマット→「互換性優先」</b>で撮り直すと、たいてい解決します</li>'+
  '<li>右上の <b>［教員用］</b>にチェックを入れると、上の段の「実験○を開始する」の左に赤い<b>［課題ファイルを書き出す（先生用）］</b>が出ます（ふだんは隠れています。3 の途中でも押せます）。'+
  '課題には設問のほか、<b>色マーカーの自動追跡の ON／OFF・進むフレーム数 N・物体の数（1〜3）・それぞれの質量・スケール（○ px ＝ ○ cm）</b>も決めておけます。'+
  '時間範囲・原点・軸・スケールまで決めてから書き出すと、生徒はファイルを開くと<b>いきなり 4. トラッキング</b>から始まります（fps・N・物体の数も聞きません）。途中で書き出したときは、決めていない手順から始まります</li></ul>'+
  '<h3>2. 解析する時間範囲の指定</h3>'+
  '<p>動画の真ん中の▶か「再生」で見どころをさがし、コマ送りで合わせてから：</p>'+
  '<ul><li><b>この時刻をt = 0</b>：いま出ているコマを t=0 にします（もう一度押すと解除）</li>'+
  '<li><b>この時刻まで解析</b>：いま出ているコマを、解析の終わりにします</li>'+
  '<li>この2つは<b>シークバーの縦棒</b>（緑＝t=0、赤＝終わり）でも表示され、<b>ドラッグで動かせます</b>。'+
  '<b>上の時間バー</b>をドラッグして時間を選ぶと楽です</li>'+
  '<li>2 のあいだは、同じボタンが<b>動画の右（下）にも</b>出ます。範囲を決めないなら［このままでよい → 次へ］</li>'+
  '<li><b>fps とスロー撮影</b>は動画を読みこんだ直後の確認画面で決めます。あとから直すときは、この段の［変更］を押します。'+
  '「1/8 のスロー」なら、動画の 8 秒＝実際の 1 秒として時刻を計算します（240fps で撮って 30fps で保存された動画など）</li></ul>'+
  '<h3>3. 空間の原点・スケール・軸を決める</h3>'+
  '<ul><li>2 で「この時刻まで解析」を決めると、まず <b>「動画をトリミング（端を切る）しますか？」</b> と聞きます。はいなら四角で囲み、「この範囲でいいですか？」に答えてから 3 へ</li>'+
  '<li>3 に入ると、<b>原点の印が画面の中央</b>に置かれます。正しい位置にドラッグ（またはクリック）すると、動画の上に'+
  '「原点はこの位置でいいですか？」→「分析する方向（1方向／2方向）」→「x軸の正の方向をクリック」→（2方向なら y軸の向き）→'+
  '「スケールを設定してください」→「スケールはこれでいいですか？」と <b>はい／いいえ</b> で順に聞きます。はい で 4 へ</li>'+
  '<li><b>原点を設定</b>：クリックした所が x=0, y=0。そのまま<b>x軸の向き</b>の設定に進みます（軸の正の方向をクリック）</li>'+
  '<li>ボタンを押さずに動画をクリックしても、<b>原点 → x軸の向き → スケール</b>の順に自動で進みます</li>'+
  '<li><b>スケールを設定</b>：先に「スケール長さ」（例 10 cm）を入れてからボタンを押し、'+
  'その長さがどこからどこまでかを 2 か所クリックします。後から<b>その点をつまんで動かす</b>こともできます</li>'+
  '<li><b>原点・x軸・スケールの3つがそろわないと、4 には進めません</b>。'+
  '2 をやり直しても 3 の設定は消えません（4 のカードに「設定ずみ」と出ます）</li>'+
  '<li>ものさしが物体より手前や奥にあると長さがずれます。どれくらいずれるかは、上の <b>補足</b> のタブの'+
  '「ものさしの奥行き」で確かめられます</li>'+
  '<li>斜面や斜方投射では x 軸を傾けます。y 軸は自動で直角、必要なら「y軸を反転」</li>'+
  '<li>軸の線には<b>正の向きの矢印</b>がいくつも並びます。どちら向きが正か、画面のどこを見ても分かります</li>'+
  '<li><b>軸の表示</b>は <b>［x軸］</b> と <b>［x軸とy軸］</b> の2つのボタン。'+
  '［x軸］にすると②③でも、レポートでも y・vy・ay を出さず、x の運動だけを見ます</li>'+
  '<li>点を記録した後で［x軸］に切りかえると、<b>「y軸のデータを消しますか？」</b>と聞きます。'+
  '「消さない」を選べば、グラフから消えるだけでデータは残ります</li></ul>'+
  '<h3>4. 位置を記録する</h3>'+
  '<ul><li>4 に入ると、まず動画の真ん中で <b>「何コマごとに位置を記録しますか？」</b>（進むフレーム数 N、1 コマ＝何秒かも表示）を聞きます。決めると先に進めます。あとから 4 のカードの［進むフレーム数 N］で変えられます</li>'+
  '<li>つぎに <b>［手でクリックして記録］</b> を押します（押すまでは、まちがって動画を触っても点は入りません）。'+
  '右上の <b>［色マーカーの自動追跡］</b> を ON にしていると、動画の真ん中で「どちらで記録しますか？」と聞き、<b>［色で自動追跡］（おすすめ）</b>か［手でクリックして記録］を選びます</li>'+
  '<li>URL に <b>?auto=1&amp;multi=1</b> を付けて開くと、［色マーカーの自動追跡］と［複数物体の運動］が最初から ON になります（配るときに便利）</li>'+
  '<li><b>物体をクリック（タップ）するたびにコマが進みます</b>（「進むフレーム数 N」ぶん）。'+
  '「記録したら」で、同じ位置に点を打つ（動画を進めない）／1コマ進む／Nコマ進む を選べます</li>'+
  '<li><b>N の目安</b>：点と点の間が、画面の横はばの 2〜3 % 以上動くように。ゆっくりな運動ほど N を大きく</li>'+
  '<li>指でタップすると<b>ルーペ</b>が出ます。長押しするとズームアップして、正確に点が打てます</li>'+
  '<li><kbd>Shift</kbd>＋クリック＝記録して1コマ進む（ふつうのクリックは N コマ進む）</li>'+
  '<li>取消は <b>［1回分トラッキングを取り消す］</b>（動画の左上と下にもあります）か <kbd>Ctrl</kbd>(<kbd>⌘</kbd>)＋<kbd>Z</kbd>。'+
  '矢印キーで最後の点を1pxずつ動かせます</li>'+
  '<li><b>色で自動追跡</b>：動画の上に大きな案内が出ます（［この表示を最小化］でたためます）。マーカーを1回クリックすると、始点と色を覚えます。円をドラッグして探索半径を決め、案内の <b>［自動追跡を開始する］</b>（か［最後まで自動追跡］）で終わりまで追いかけ、'+
  '見失ったら止まります。手でクリックして見つけ直すと <b>「見つけました！ 最後まで追跡 しますか？」</b> が出るので、'+
  'その知らせを押せばそのまま続きます</li>'+
  '<li>右上の <b>［複数物体の運動］</b> を ON にすると、4 に入ったとき N のつぎに<b>物体の数（2 か 3）</b>を聞き、物体1 → 物体2 → 物体3 の順に追いかけられます（衝突など）。ストロボ画像に描く点は物体1だけです。'+
  '物体には名前をつけます（同じ名前は不可）。撮るときは<b>物体ごとにちがう色</b>のマーカーをつけておくと、色で自動追跡できます。'+
  '画面の外に出るなどで最後まで追えない物体は、4 のカードの <b>［この物体はここで終わり］</b> を押すと、そこまでで完了になり次の物体へ進めます</li>'+
  '<li>2本指でピンチすると拡大、2本指で動かすと移動できます</li>'+
  '<li><b>トラッキングした点をリセット</b>：この実験の点を全部消して、解析範囲の最初にもどります（Ctrl＋Z でもどせます）</li>'+
  '<li><b>動画と表を並べる</b>：4 に入ると<b>最初から並んで</b>います。'+
  '［表を下に表示］でもとの縦ならびに戻せます。同じ表は<b>②グラフの左</b>にも出ます</li>'+
  '<li>解析範囲の終わりまで記録できると、動画エリアに<b>「解析終了。グラフを表示してみよう」</b>が出て、'+
  '上の <b>②グラフ</b> のタブが光ります。次の動画を読むときに「ここまでの実験を記録しますか？」と聞くので、'+
  '「記録する」を選ぶと次の動画は実験2になります</li></ul>'+
  '<h3>④ ストロボ画像（タブ）</h3>'+
  '<ul><li>上の <b>④ ストロボ画像</b> のタブを開き、<b>［ストロボ画像を作る］</b>で、解析範囲のコマを 1 枚に重ねた写真ができます（はじめは 1 コマおき）</li>'+
  '<li>できたら <b>「時間間隔調整」</b>のスライダーが出ます。1・2・5・10・20 コマおきを選ぶと作り直します。'+
  '作っている間は「お待ちください　あと○秒」と出て、スライダーは動かせません</li>'+
  '<li><b>トラッキングした点も描く</b>のチェックは、作り直さずにその場で点の表示を切りかえます</li>'+
  '<li><b>PNG保存</b>で画像を保存、<b>画像をリセット</b>で消します</li></ul>'+
  '<h3>5. 出力・保存</h3>'+
  '<ul><li><b>CSV出力</b>／<b>CSVコピー</b>／<b>レポートPNG</b>／<b>レポートPDF</b>（レポートPNG・PDF は ②③にもあります）</li>'+
  '<li><b>この動画の原点・トラッキングを保存</b>：記録した点と、原点・スケール・x軸・時間範囲を'+
  '1つのファイルにします（動画は入りません）。解析が終わると出ます</li>'+
  '<li>上の段の <b>過去測定データを実験○に登録</b>：保存したファイルを、<b>いまの実験を消さずに</b>'+
  '次の実験番号として足します。前の実験や去年のデータと並べて比べられます（ドロップでも読めます）</li>'+
  '<li>トラッキングデータ等はこの端末のブラウザに自動保存されます。同じ動画をもう一度開くと、続きからできます。'+
  'みんなで使う端末では、終わったら上の段の「すべての実験を消してリセット」を押してください</li></ul>'+
  '<h3>測定した値（表）の見かた</h3>'+
  '<p>速さ（v）は「となりあう2点のあいだ」の値なので、<b>行と行のあいだ</b>に書いてあります。'+
  '加速度（a）は「その速さの変わり方」なので、また<b>位置と同じ行</b>にもどります'+
  '（記録タイマーのテープと同じ書き方です）。</p>'+
  '<p>グラフも同じ考え方です。<b>v–t グラフの点は、2点の「真ん中の時刻」</b>に打ってあります。'+
  '1コマぶんの差で出しているので、a–t グラフは点がばらつきます。'+
  '加速度は <b>v–t グラフの傾き</b>（③のフィッティング）で見るほうが確かです。</p>'+
  '<h3>手ぶれ対策</h3>'+
  '<p>三脚がないときは画面がゆれます。4 のカードの下の「手ぶれ補正を使う」にチェックを入れ、'+
  '「画面内の固定点を記録」で<b>動かない目印</b>（机の角など）を、はじめ・中ごろ・終わりなど数コマでクリックすると、'+
  'そのずれの分だけ全部の点を補正します。直せるのは平行にずれた分だけです。</p>'+
  '<h3>やり直したいとき</h3>'+
  '<p>終わったカードには「<b>済</b>」がつき、自動でたたまれます。'+
  '「<b>もう一度</b>」を押すと、そのカードが開いて<b>また触れるようになります</b>'+
  '（決めた内容は消えません。必要なところだけ直してください）。</p>'+
  '<p><b>この実験の測定を消去</b>は、記録した点だけでなく<b>原点・スケール・x軸・時間範囲も消して</b>、'+
  '「2. 解析する時間範囲の指定」からやり直せる状態にもどします（動画はそのままです）。</p>'+
  '<p>全部を最初からやり直したいときは、上の「<b>すべての実験を消してリセット</b>」。'+
  '実験も測定も保存データも消えて、まっさらになります。</p>'+
  '<p>2 で時間範囲を決めた後は、<b>再生もコマ送りもその範囲の中だけ</b>になります。'+
  '範囲の外を見たいときは、2 の「もう一度」で範囲を決め直してください。</p>'+
  '<h3>グラフ・解析</h3>'+
  '<ul><li>②で x–t, y–t, v–t, a–t とエネルギーのグラフ。速度・加速度は<b>中央差分</b>で出しています（両端は出ません）</li>'+
  '<li>グラフは <b>物体ごと</b>にまとまり、左の列が x・vx・ax、右の列が y・vy・ay です。'+
  '「グラフを拡大／縮小」で全部の大きさを変えられ、各グラフの「最大化」で 1 枚だけ大きく見られます</li>'+
  '<li><b>スケールフィット</b>（各グラフの右下）：いま見ている横軸の範囲で、縦軸の目盛りをちょうどよく合わせます（横軸は変えません）。'+
  '［まとめてスケールフィット］で出ているグラフを全部いっぺんに</li>'+
  '<li><b>データ点をクリック（タップ）</b>すると、その点の座標が点のそばとグラフの上に出ます。'+
  '同時に、その<b>時刻の線が他のグラフにも</b>引かれるので、同じ瞬間の x・v・a を見くらべられます。'+
  'もう一度押すか、点から離れた所をクリックするか、「実験1」の見出しの横に出る赤い<b>［座標の選択を解除する］</b>を押すと消えます（③でも同じ）</li>'+
  '<li>各グラフの右上の <b>［d○/dt を表示］</b> にチェックを入れると、選んだ点での'+
  '<b>時間あたりの変化率</b>（x なら dx/dt＝速さ、v なら dv/dt＝加速度）も出ます。'+
  'これは<b>その点の前後の点</b>から <b>(後の値 − 前の値) ÷ (後の時刻 − 前の時刻)</b> で出しています'+
  '（＝中央差分。端の点だけは、となりの1点との差）。'+
  '表や v–t グラフの v は<b>前進差分</b>（記録タイマーと同じ）なので、同じ点でも値が少しちがうことがあります</li>'+
  '<li><b>グラフの中をドラッグ</b>すると上下左右に動きます。<b>横軸の目盛りの所をドラッグ</b>すると横の拡大縮小、'+
  '<b>縦軸の目盛りの所をドラッグ</b>すると縦の拡大縮小。'+
  '横軸（t）は x–t・v–t・a–t で<b>いっしょに動きます</b>（縦軸はグラフごと）。元に戻すときは <b>［スケールと表示範囲をデフォルトに戻す］</b></li>'+
  '<li><b>a の出し方</b>は a–t グラフの下で選べます：「v の差から計算」（a に使う時間の幅 Δt・3Δt・5Δt、はじめは <b>Δt（となりの v との差 ÷ Δt）</b>。「自動」にすると、クリックのずれによる a のばらつきが a の大きさの 1/4 以下になる、いちばん短い幅をえらびます。点が少ないときは a の点が 5 個は残る幅までにします）か「v–t の傾きから計算」。'+
  'クリックが 1 px ずれると a がどれだけずれるかの目安も出ます。'+
  '「v–t の傾きから計算」にしたときは、<b>レポート PDF と Excel の a–t もその値</b>で描きます（Excel には「ax(v–tの傾き)」の列が足されます。表の ax 列は「v の差から計算」のまま）</li>'+
  '<li><b>動画と一緒にグラフを再生する</b>：動画とグラフを横に並べ、再生に合わせて点が増えていきます</li>'+
  '<li>②の左の「測定した値（表）」は、右はしを<b>ドラッグして幅を変えられます</b></li>'+
  '<li>グラフの左下の <b>［最小化］</b>（色なし）で、そのグラフを題の 1 行にたたみ、もう一度押すと開きます。複数物体で x 軸だけのときは、物体 1 の x の列と物体 2 の x の列が横にならびます</li>'+
  '<li><b>自由選択グラフ</b>（グラフの下、③でも同じものが使えます）：物体・量を選んで、縦軸と横軸を自由に決められます。<br>'+
  '「正負を反転」でデータ点の符号を入れかえられます（右向きを正にしたいときなど）。<br>'+
  '「縦軸を2つにする（2軸）」にすると、左と右で別々の目盛の縦軸になります。'+
  '例：〔縦軸＝物体1 vx／縦軸2＝物体2 vx／横軸＝t〕で衝突の前後を見る、〔縦軸＝x／縦軸2＝y／横軸＝t〕で x と y を 1 枚で見る、など</li>'+
  '<li><b>運動量保存則</b>ボタン（右上の［複数物体の運動］が ON で、物体が 2 つのときだけ出ます）で〔縦軸＝物体1 の運動量 px／縦軸2＝物体2 の px／横軸＝t〕に、'+
  '同じ目盛りで一発で切りかわります。質量 m₁・m₂ はそのとなりの欄で入れます。物体2のデータが無いときは切りかわらず、赤字で知らせます</li>'+
  '<li>②の <b>「重心の運動量」</b> にチェック（複数物体のとき）を入れると、質量の欄が出て、物体ごとの運動量 p = m v と、'+
  'その和 Σ m v（＝重心の運動量）を 1 枚のグラフに出します。物体が 3 つでも、衝突の前後で和が変わらないことを確かめられます</li>'+
  '<li>縦軸と横軸が<b>同じ単位</b>のとき（x–y など）は、縦横の目盛りを自動でそろえます。円運動が<b>ちゃんと円に見えます</b></li>'+
  '<li>エネルギーは②の右上の <b>［力学的エネルギーを解析する］</b>を押すと、質量 m・g・<b>重力の向き</b>の入力欄が出ます。'+
  '位置エネルギー U = mgh の高さ h は、重力の向き（鉛直下向きが −y／+y／−x／+x のどれか）から出します（−y なら h = y、+x なら h = −x）。'+
  '自由落下を x 軸だけで解析するときは −x か +x を選びます。円運動など高さが決まらない実験には当てはまりません。'+
  '押していないときは Excel 出力にもエネルギーは入りません</li>'+
  '<li>実験は10個まで記録できます。②の「対象の実験」で実験1 などにチェックを入れると、実験結果を重ねて比べられます（はじめはいまの実験だけにチェック。全部外すとグラフは出ません）</li>'+
  '<li>②③の Excel 出力・レポートを押すと、先に「ストロボ写真を作成しますか？」と聞きます。はい なら、④で作ってあればその写真を、無ければふさわしいコマ間隔（2 コマおき以上）で自動で作って、Excel・レポートの最後につけます</li>'+
  '<li>グラフの縦軸のはじめの範囲は 0 をふくみ、上（下）はきりのよい数までです（4〜6 なら 0〜10）。データだけに寄せて見たいときは［スケールフィット］</li>'+
  '<li>③で直線・放物線・正弦・指数の最小二乗フィッティング。<b>係数と R² まで</b>を出します（a・g・T は自分で考えます）。'+
  '正弦・指数は「パラメーターの初期値」（A・ω・φ・C／A・k・C）を入れられ、入れた値から最小二乗で合わせます（未入力なら自動）。直線・放物線は初期値なしで一度に決まります</li>'+
  '<li>③のグラフの<b>青い帯</b>（←数式をフィッティングするエリア→）は「フィッティングに使う範囲」です。'+
  '左右のつまみをドラッグすると変えられます（動き出しの前や、ぶつかった後を外せます）</li>'+
  '<li>③のフィッティング結果の下の <b>［フィッティング残差のプロット］</b> で、「測った値 − フィッティングの値」のグラフが右に出ます。'+
  '0 のまわりにばらばらならよく合っていて、曲がったかたよりがあれば関数の形が合っていません</li>'+
  '<li>③の <b>［フィッティングとは］</b> ボタンで、最小二乗法と R²・残差の説明が図つきで出ます</li>'+
  '<li>グラフの<b>縦軸や横軸の目盛りをクリック</b>すると、最小・最大を数（小数 1 桁）で決められます。'+
  '［デフォルトに戻す］か［スケールと表示範囲をデフォルトに戻す］でもどります</li>'+
  '<li>上の <b>補足</b> のタブ「誤差の要因の例」に、クリックのずれ・N と a の出し方（見本のグラフつき）・ものさしの奥行き・'+
  'カメラの向き・手ぶれ・コマの時刻・式の当てはまり、をまとめてあります</li>'+
  '<li>②③の右上から <b>Excel／グラフPNG／CSV／レポートPNG／レポートPDF</b> を出せます（②では Excel・PNG の下に［力学的エネルギーを解析する］）。'+
  'レポートには、フィッティングしたグラフと残差も載ります</li></ul>'+
  '<h3>精度について</h3>'+
  '<ul><li>クリックのずれが実際の何 cm にあたるかを、3 のカードに出しています。拡大すると精度が上がります</li>'+
  '<li>いちばん大きな誤差は<b>ものさしの奥行き</b>です。カメラから 3 m で、ものさしが 50 cm 手前にあると長さが約 17 % ずれます（<b>補足</b>のタブの「誤差の要因の例」）</li>'+
  '<li>コマ送りはシークの位置がずれることがあるので、<b>毎回いま表示されているコマの実測時刻を読み直して</b>記録しています</li></ul>'+
  '<h3>時刻はどうやって求めているか（時間算出法）</h3>'+
  '<p>動画は<b>コマ（フレーム）</b>がぱらぱらと並んだものです。1 秒あたりのコマ数が <b>fps</b> ですが、'+
  'スマホやタブレットの動画は<b>コマの間隔がいつも同じとは限りません</b>（可変フレームレート）。'+
  'そこでこのツールは「1 コマ＝ 1/30 秒」のような決め打ちをせず、<b>コマ 1 枚ごとの本当の時刻</b>を測って使います。</p>'+
  '<svg width="100%" viewBox="0 0 640 250" style="max-width:640px;background:#fff;border:1px solid var(--line);border-radius:9px"><text x="8" y="18" font-size="12" fill="#5b6672">動画＝コマ（フレーム）の並び</text><rect x="34" y="28" width="72" height="52" rx="5" fill="#e8f1fb" stroke="#8fb4d9" stroke-width="1"/><circle cx="48" cy="62" r="5" fill="#e8443a"/><text x="70" y="44" font-size="10" text-anchor="middle" fill="#5b6672">1 枚目</text><line x1="70" y1="82" x2="34.0" y2="150" stroke="#9aa7b4" stroke-width="1" stroke-dasharray="3 3"/><rect x="120" y="28" width="72" height="52" rx="5" fill="#e6f6ea" stroke="#1c8f4a" stroke-width="2"/><circle cx="141" cy="62" r="5" fill="#e8443a"/><text x="156" y="44" font-size="10" text-anchor="middle" fill="#5b6672">2 枚目</text><line x1="156" y1="82" x2="110.56" y2="150" stroke="#9aa7b4" stroke-width="1" stroke-dasharray="3 3"/><rect x="206" y="28" width="72" height="52" rx="5" fill="#e8f1fb" stroke="#8fb4d9" stroke-width="1"/><circle cx="234" cy="62" r="5" fill="#e8443a"/><text x="242" y="44" font-size="10" text-anchor="middle" fill="#5b6672">3 枚目</text><line x1="242" y1="82" x2="189.44" y2="150" stroke="#9aa7b4" stroke-width="1" stroke-dasharray="3 3"/><rect x="292" y="28" width="72" height="52" rx="5" fill="#e8f1fb" stroke="#8fb4d9" stroke-width="1"/><circle cx="327" cy="62" r="5" fill="#e8443a"/><text x="328" y="44" font-size="10" text-anchor="middle" fill="#5b6672">4 枚目</text><line x1="328" y1="82" x2="305.44" y2="150" stroke="#9aa7b4" stroke-width="1" stroke-dasharray="3 3"/><rect x="378" y="28" width="72" height="52" rx="5" fill="#e8f1fb" stroke="#8fb4d9" stroke-width="1"/><circle cx="420" cy="62" r="5" fill="#e8443a"/><text x="414" y="44" font-size="10" text-anchor="middle" fill="#5b6672">5 枚目</text><line x1="414" y1="82" x2="382.0" y2="150" stroke="#9aa7b4" stroke-width="1" stroke-dasharray="3 3"/><rect x="464" y="28" width="72" height="52" rx="5" fill="#e8f1fb" stroke="#8fb4d9" stroke-width="1"/><circle cx="513" cy="62" r="5" fill="#e8443a"/><text x="500" y="44" font-size="10" text-anchor="middle" fill="#5b6672">6 枚目</text><line x1="500" y1="82" x2="458.56" y2="150" stroke="#9aa7b4" stroke-width="1" stroke-dasharray="3 3"/><rect x="550" y="28" width="72" height="52" rx="5" fill="#e8f1fb" stroke="#8fb4d9" stroke-width="1"/><circle cx="606" cy="62" r="5" fill="#e8443a"/><text x="586" y="44" font-size="10" text-anchor="middle" fill="#5b6672">7 枚目</text><line x1="586" y1="82" x2="537.44" y2="150" stroke="#9aa7b4" stroke-width="1" stroke-dasharray="3 3"/><line x1="20" y1="152" x2="628" y2="152" stroke="#5b6672" stroke-width="1.5"/><text x="628" y="143" font-size="11" text-anchor="end" fill="#5b6672">動画の中の時刻 [s]</text><line x1="34.0" y1="145" x2="34.0" y2="159" stroke="#1663b5" stroke-width="2"/><text x="34.0" y="186" font-size="10" text-anchor="middle" fill="#1663b5">0.000</text><line x1="110.56" y1="145" x2="110.56" y2="159" stroke="#1c8f4a" stroke-width="2"/><text x="110.56" y="186" font-size="10" text-anchor="middle" fill="#1c8f4a">0.033</text><line x1="189.44" y1="145" x2="189.44" y2="159" stroke="#1663b5" stroke-width="2"/><text x="189.44" y="186" font-size="10" text-anchor="middle" fill="#1663b5">0.067</text><line x1="305.44" y1="145" x2="305.44" y2="159" stroke="#1663b5" stroke-width="2"/><text x="305.44" y="186" font-size="10" text-anchor="middle" fill="#1663b5">0.117</text><line x1="382.0" y1="145" x2="382.0" y2="159" stroke="#1663b5" stroke-width="2"/><text x="382.0" y="186" font-size="10" text-anchor="middle" fill="#1663b5">0.150</text><line x1="458.56" y1="145" x2="458.56" y2="159" stroke="#1663b5" stroke-width="2"/><text x="458.56" y="186" font-size="10" text-anchor="middle" fill="#1663b5">0.183</text><line x1="537.44" y1="145" x2="537.44" y2="159" stroke="#1663b5" stroke-width="2"/><text x="537.44" y="186" font-size="10" text-anchor="middle" fill="#1663b5">0.217</text><text x="110.56" y="206" font-size="11" text-anchor="middle" fill="#1c8f4a" font-weight="bold">↑ t = 0 に選んだコマ</text><path d="M189.44 134 L305.44 134" stroke="#e8443a" stroke-width="1.5"/><text x="247.44" y="128" font-size="10" text-anchor="middle" fill="#e8443a">ここだけ間隔が広い</text><text x="20" y="232" font-size="11" fill="#333">4 枚目に打った点の時刻 t = 0.117 − 0.033 = <tspan font-weight="bold">0.084 s</tspan>（1/30 秒の決め打ちではない）</text></svg>'+
  '<ol>'+
  '<li><b>測る</b>：動画を読み込むと、いちど最後まで再生しながら、ブラウザから'+
  '「いま画面に出したコマの時刻」を 1 枚ずつ受け取ります'+
  '（<code>requestVideoFrameCallback</code> という仕組み）。'+
  'こうして「1 枚目＝0.000 秒、2 枚目＝0.033 秒、3 枚目＝0.067 秒…」という<b>時刻の一覧</b>ができます。'+
  '動画を読みこんだ直後の確認画面に出る「<b>78 コマ</b>」などは、この一覧に入ったコマの数です</li>'+
  '<li><b>取りこぼしを埋める</b>：再生が速くて受け取れなかったコマは、'+
  'あとでそのコマへシークして測り直し、一覧のすきまを埋めます</li>'+
  '<li><b>使う</b>：点を記録するときは、いま画面に出ているコマが一覧の何番目かを調べ、'+
  '<b>その時刻をそのまま</b>その点の時刻にします。'+
  '表やグラフの t は、そこから <b>［この時刻をt = 0］で選んだコマの時刻を引いた値</b>です</li>'+
  '</ol>'+
  '<p>コマ送りも、この一覧の<b>となりのコマへ移る</b>形で進みます。'+
  'だから <b>fps は「1 コマがおよそ何秒か」の目安</b>であって、記録される時刻そのものには使っていません。'+
  '2 の fps の行に「（実測した時刻から）」と出ていれば、時刻は実測値です。</p>'+
  '<p class="mini">※ この仕組みが使えないブラウザ（Firefox など）では、'+
  '<b>1 コマ＝ 1/fps 秒</b>として計算します。このときだけ fps の値が時刻に効くので、'+
  '読みこんだ直後の確認画面で「再生 fps」を入れてください（あとから直すときは 2 の［変更］）。'+
  'また、シークは 1 コマぶんずれることがあるので、<b>毎回いま出ているコマの時刻を読み直して</b>から記録しています。</p>'+
  '<p><b>スロー撮影（ハイスピード撮影）</b>した動画は、動画の中の 1 秒が実際の 1/8 秒などになっています。'+
  '動画を読みこんだ直後の確認画面（または 2 の［変更］）で「スロー撮影」を選ぶと、測った時刻にその倍率をかけて<b>実際の時刻</b>に直します。</p>';
  $('helpModal').classList.remove('hide');
  $('hpClose').onclick=function(){ $('helpModal').classList.add('hide'); };
}

/* ===== じぶんで軸を選ぶグラフ（モード2・3で共有） ===== */
/* 自由選択グラフの「量」の選択肢（x軸のみのときは y 系を出さない） */
function cgFillQuantities(){
  var qs=[['x','x（位置）'],['y','y（位置）'],['vx','vx（速度）'],['vy','vy（速度）'],
          ['ax','ax（加速度）'],['ay','ay（加速度）'],['px','px（運動量 m·vx）'],['py','py（運動量 m·vy）']];
  if(!useY()) qs=qs.filter(function(q){ return q[0].indexOf('y')<0; });
  function fillQ(sel, withT){
    if(!sel) return;
    sel.innerHTML='';
    if(withT){ var o=document.createElement('option'); o.value='t'; o.textContent='t（時刻）'; sel.appendChild(o); }
    qs.forEach(function(q){ var o=document.createElement('option'); o.value=q[0]; o.textContent=q[1]; sel.appendChild(o); });
  }
  fillQ($('cgQA'),false); fillQ($('cgQB'),false); fillQ($('cgQX'),true);
}
/* 「軸の表示＝x軸のみ」に合わせて、②③の y 系の項目を出し入れする */
function updateAxisButtons(){
  $('btnAxX').classList.toggle('on', APP.axisDisp!=='xy');
  $('btnAxXY').classList.toggle('on', APP.axisDisp==='xy');
}
/* 「x軸」「x軸とy軸」を切りかえる。y を消すときは、はっきり聞く */
function setAxisDisp(v){
  if(v===APP.axisDisp){ updateAxisButtons(); return; }
  var e=EXP(), hasPts=e.objs.reduce(function(a,b){return a+b.length;},0)>0;
  function apply(){
    APP.axisDisp=v;
    updateAxisButtons();
    $('labYFlip').classList.toggle('hide', v!=='xy');
    applyAxisDisp();
    drawOverlay(); saveLocal();
    if(!$('mode2').classList.contains('hide')) renderMode2();
    if(!$('mode3').classList.contains('hide')) renderMode3(false);
    renderCG();
  }
  if(v==='x' && hasPts){
    popup('<h2>y軸のデータを消しますか？</h2>'+
      '<p>「x軸」だけにすると、記録した点の <b>y の値（軸に垂直な向きのずれ）はすべて 0 になり、もとにもどせません</b>。<br>'+
      'グラフから y・vy・ay が消えるだけでよいなら、<b>「消さない」</b>を選んでください。</p>'+
      '<p class="mini">※ 直線の運動（斜面・水平な台）だけを調べるときは、消してしまってかまいません。</p>',
      'はい、消す', function(){ flattenY(); apply(); },
      { noLabel:'いいえ、消さない', onNo:function(){ apply(); } });
    return;
  }
  apply();
}
/* 記録した点を x軸の上に落として、y のデータを消す */
function flattenY(){
  var e=EXP(), n=0;
  for(var o=0;o<NOBJ;o++){
    e.objs[o].forEach(function(p){
      var q=toPhys(e, p.x, p.y, p.t);
      var d=driftAt(e, p.t), r=toPix(e, q.x, 0);
      p.x=r.x+d.x; p.y=r.y+d.y; n++;
    });
  }
  UI.undo=[]; afterChange(); render();
  if(n) toast('y のデータを消しました（点は x 軸の上にそろえました）');
}
function applyAxisDisp(){
  var yOK=useY(), c=APP.cg;
  var lab=$('labGY'); if(lab) lab.classList.toggle('hide', !yOK);
  var sf=$('selFitY');
  if(sf){
    els('#selFitY option').forEach(function(o){
      var isY=o.dataset.y==='1'; o.hidden=(!yOK&&isY); o.disabled=(!yOK&&isY);
    });
    if(!yOK && sf.value.indexOf('y')>=0) sf.value='x';
  }
  if(!yOK){
    if(c.qA.indexOf('y')>=0) c.qA='x';
    if(c.qB.indexOf('y')>=0) c.qB='x';
    if(c.xq.indexOf('y')>=0) c.xq='t';
  }
  if($('cgQA')){ cgFillQuantities(); cgToUI(); }
}
function buildCG(){
  cgFillQuantities();
  ['cgObjA','cgObjB'].forEach(function(id){
    var sel=$(id); sel.innerHTML='';
    for(var i=0;i<NOBJ;i++){ var o=document.createElement('option'); o.value=i; o.textContent='物体'+(i+1); sel.appendChild(o); }
  });
  refreshCGExps(); cgToUI();
}
function refreshCGExps(){
  ['cgExpA','cgExpB'].forEach(function(id){
    var sel=$(id); if(!sel) return;
    var keep=sel.value;
    sel.innerHTML='';
    APP.exps.forEach(function(e,i){
      var o=document.createElement('option'); o.value=i; o.textContent=(i+1)+'. '+e.name; sel.appendChild(o);
    });
    sel.value = (keep!=='' && keep<APP.exps.length)? keep : String(Math.min(APP.cg[id==='cgExpA'?'expA':'expB']||0, APP.exps.length-1));
  });
}
function cgToUI(){
  var c=APP.cg;
  /* 実験は、一番上の「対象の実験」でえらぶので、ここではいまの実験に合わせる */
  c.expA=Math.min(Math.max(0,APP.cur), APP.exps.length-1);
  c.expB=c.expA;
  $('cgExpA').value=Math.min(c.expA,APP.exps.length-1); $('cgObjA').value=c.objA; $('cgQA').value=c.qA; $('cgInvA').checked=!!c.invA;
  $('cgExpB').value=Math.min(c.expB,APP.exps.length-1); $('cgObjB').value=c.objB; $('cgQB').value=c.qB; $('cgInvB').checked=!!c.invB;
  $('cgQX').value=c.xq; $('cgInvX').checked=!!c.invX;
  $('cgTwo').checked=!!c.two; $('cgLine').checked=(c.line!==false);
  cgShowB(!!c.two);
}
/* 2軸のときだけ、右側の「縦軸2」欄と上の実験・物体えらびを出す */
function cgShowB(on){
  $('cgRowB').classList.toggle('hide', !on);
  $('cgPickB').classList.toggle('hide', !on);
}
function cgFromUI(){
  var c=APP.cg;
  c.expA=parseInt($('cgExpA').value)||0; c.objA=parseInt($('cgObjA').value)||0;
  c.qA=$('cgQA').value; c.invA=$('cgInvA').checked;
  c.expB=parseInt($('cgExpB').value)||0; c.objB=parseInt($('cgObjB').value)||0;
  c.qB=$('cgQB').value; c.invB=$('cgInvB').checked;
  c.xq=$('cgQX').value; c.invX=$('cgInvX').checked;
  c.two=$('cgTwo').checked; c.line=$('cgLine').checked;
  cgShowB(c.two);
}
function bindCG(){
  $('cgTwo').addEventListener('change', function(){
    if(this.checked){                       /* 既定は「縦軸1と同じ実験・物体」 */
      var c=APP.cg; c.two=true; c.expB=c.expA; c.objB=c.objA; c.qB=c.qA; c.invB=false;
      cgToUI();                             /* c.two を先に立てる（前は cgToUI がチェックを外し、二度と ON にできなかった） */
    }
  });
  ['cgExpA','cgObjA','cgQA','cgInvA','cgExpB','cgObjB','cgQB','cgInvB','cgQX','cgInvX','cgTwo','cgLine']
  .forEach(function(id){
    $(id).addEventListener('change', function(){
      cgFromUI(); APP.cgFit=null; APP.cgRange=null; $('cgResult').innerHTML='';
      $('cgMomentumNote').classList.add('hide');
      $('cgMomentumErr').classList.add('hide');
      renderCG(); saveLocal();
    });
  });
  $('cgFit').onclick=function(){ cgFromUI(); cgDoFit($('cgFitType').value); };
  if($('cgBig')){ $('cgBig').innerHTML=EXPAND_ICON+' 最大化'; $('cgBig').onclick=function(ev){ ev.preventDefault(); openBigChart('自由選択グラフ', cgSpec()); }; }
  $('cgFitClr').onclick=function(){ APP.cgFit=null; CGRESID=null; $('cgResult').innerHTML=''; if($('cgResidHost')) $('cgResidHost').innerHTML=''; renderCG(); };
  $('cgPng').onclick=function(){
    $('cgCanvas').toBlob(function(b){ dl(b, fnameBase()+'_graph.png'); toast('グラフを保存しました'); },'image/png');
  };
}

/* ②の「測定した値（表）」の幅をドラッグで変える */
function bindTblResize(){
  var h=$('tblRsz'), box=$('m2tbl'); if(!h||!box) return;
  box.style.width=APP.tblw+'px';
  var st=null;
  h.addEventListener('pointerdown', function(e){
    st={x:e.clientX, w:box.getBoundingClientRect().width};
    try{ h.setPointerCapture(e.pointerId); }catch(err){}
    e.preventDefault();
  });
  h.addEventListener('pointermove', function(e){
    if(!st) return;
    APP.tblw=Math.max(200, Math.min(900, Math.round(st.w+(e.clientX-st.x))));
    box.style.width=APP.tblw+'px';
  });
  function up(e){ if(st){ st=null; try{ h.releasePointerCapture(e.pointerId); }catch(err){} saveLocal(); } }
  h.addEventListener('pointerup', up);
  h.addEventListener('pointercancel', up);
}

/* ---------- タブ ---------- */
/* ===== ②「グラフを並べる」／「動画と一緒にグラフを再生する」 ===== */
function m2ModeButtons(){
  $('btnM2Side').classList.toggle('on', APP.m2mode!=='live');
  $('btnM2Live').classList.toggle('on', APP.m2mode==='live');
  /* まだ一度も押していなければ、光らせて「← クリックしてみよう」 */
  var seen=false; try{ seen=!!localStorage.getItem('ma_live_seen'); }catch(e){}
  var tease=!seen && APP.m2mode!=='live';
  $('btnM2Live').classList.toggle('glow', tease);
  if($('coLive')) $('coLive').classList.toggle('hide', !tease);
}
function setM2Mode(m, quiet){
  APP.m2mode=(m==='live')? 'live' : 'side';
  m2ModeButtons();
  var live=(APP.m2mode==='live') && !$('mode2').classList.contains('hide');
  $('m2live').classList.toggle('hide', !live);
  el('.m2body').classList.toggle('live', live);
  var vb=$('videobox');
  if(live){
    if(!LIVE.home) LIVE.home={ parent:vb.parentNode, next:vb.nextSibling };
    if(vb.parentNode!==$('m2vidHost')) $('m2vidHost').appendChild(vb);
    LIVE.on=true; LIVE.t=-Infinity;             /* 再生するまで点は出さない */
    $('liveT').textContent='t = -';
    $('m2tblCard').open=false;                  /* 表はたたんで、動画を大きく見せる */
  } else {
    liveStop(); stopKoma();
    LIVE.on=false; LIVE.t=Infinity;
    if(LIVE.home && vb.parentNode!==LIVE.home.parent)
      LIVE.home.parent.insertBefore(vb, LIVE.home.next);
    $('m2tblCard').open=true;
  }
  updateTblFold();
  updateGuide();                 /* ①用の案内（解析終了など）を出し入れする */
  if(!quiet){ renderMode2(); saveLocal(); }
  setTimeout(function(){ if(VID.ready) render(); alignLive(); updateGuide(); }, 40);
  setTimeout(alignLive, 200);
}
/* live のとき、グラフの上に空きを作らない
   （以前は動画の画像の上端に合わせていたが、そのぶん大きなすき間ができて見にくかった） */
function alignLive(){
  var ch=$('charts2'); if(!ch) return;
  ch.style.paddingTop='';
}
/* 表をたたんだら、②の左の欄も細くする */
function updateTblFold(){
  var box=$('m2tbl'), d=$('m2tblCard'); if(!box||!d) return;
  box.classList.toggle('folded', !d.open);
  if(d.open) box.style.width=APP.tblw+'px';
}
function liveTimeNow(){ var e=EXP(), ts=(e.tscale>0?e.tscale:1); return (VID.cur-(e.t0||0))*ts; }
/* いまの時刻までに「見える点」がいくつあるか（この数が変わったときだけグラフを描き直す） */
function liveVisibleCount(){
  var e=EXP(), n=0, t=LIVE.t;
  if(!isFinite(t)) return t>0? 1e9 : 0;
  var ts=(e.tscale>0?e.tscale:1), t0=(e.t0||0);
  for(var o=0;o<NOBJ;o++){ var a=e.objs[o]||[]; for(var i=0;i<a.length;i++) if((a[i].t-t0)*ts<=t+1e-9) n++; }
  return n;
}
function liveTick(force){
  LIVE.t=(force===undefined)? liveTimeNow() : force;
  $('liveT').textContent = isFinite(LIVE.t)? ('t = '+nf(LIVE.t,3)+' s') : 't = -';
  /* 再生中は 60 ms ごとに呼ばれるが、グラフに点が増える瞬間だけ描き直せばよい
     （毎回描き直すと、動画の描画と重なって、再生が途中からコマ送りのように重くなる端末がある） */
  if(force===-Infinity || force===Infinity) LIVE.drawn=false;      /* もどした・やめたときは必ず描き直す */
  var n=liveVisibleCount();
  if(n!==LIVE.lastN || !LIVE.drawn){ LIVE.lastN=n; LIVE.drawn=true; redrawAllCharts(); }
}
function livePlay(){
  if(!VID.ready){ toast('①で動画を読み込んでください'); return; }
  if(isPlaying()){ stopAllPlay(); return; }
  if(APP.komaMode){ komaStart(); return; }
  var go=function(){ liveTick(); startPlay(); };
  if(atPlayEnd() || LIVE.t===-Infinity){
    vidSeek(playStartT()).then(function(){ afterSeek(); go(); });
  } else go();
}
function liveStop(){ stopAllPlay(); }
/* ---------- 🐢 コマ送り（スイッチ。ONのまま［再生］を押すと Nコマずつ進む） ---------- */
var komaTimer=null, komaBusy=false;
function setKomaMode(on){
  APP.komaMode=!!on;
  els('.cbKoma').forEach(function(c){ c.checked=APP.komaMode; });
  ['swKoma','swKoma2','swKomaLive'].forEach(function(id){
    if($(id)) $(id).classList.toggle('on', APP.komaMode);
  });
  if(!APP.komaMode && komaTimer){ stopKoma(); playLabels(false); }
}
function stopKoma(){
  if(komaTimer){ clearInterval(komaTimer); komaTimer=null; }
  komaBusy=false;
}
function komaEnd(){ return playEndT(); }
function komaTick(){
  if(komaBusy) return;
  if(atPlayEnd()){
    stopKoma(); playLabels(false); updateBigPlay(); updateGuide();
    toast('終わりまで進みました'); return;
  }
  komaBusy=true;
  var N=parseInt($('inStepN').value)||1;
  stepFrames(N).then(function(){ komaBusy=false; if(LIVE.on) liveTick(); },
                     function(){ komaBusy=false; });
}
function komaStart(){
  if(!VID.ready){ toast('先に動画を読み込んでください'); return; }
  if(VID.el && !VID.el.paused){                  /* ふつうの再生はきちんと止めてから */
    VID.el.pause();
    if(playTimer){ clearInterval(playTimer); playTimer=null; }
  }
  APP.played=true;
  var run=function(){
    playLabels(true); updateBigPlay(); updateGuide();
    komaTimer=setInterval(komaTick, 420);
  };
  if(atPlayEnd() || (LIVE.on && LIVE.t===-Infinity)){
    vidSeek(playStartT()).then(function(){ afterSeek(); if(LIVE.on) liveTick(); run(); });
  } else { if(LIVE.on) liveTick(); run(); }
}
function setTab(m){
  APP.tab=m;
  if(m==='2' && APP.step>=4 && typeof trackingDone==='function' && trackingDone()) UI.tab2Seen=true;   /* 一度開いたら ②のタブは光らない */
  if(typeof stopAuto==='function') stopAuto();      /* 自動追跡の途中でタブを移したら止める */
  if(typeof stopAllPlay==='function' && VID.ready) stopAllPlay();
  /* ②に来たときは、動画を解析範囲の最初にもどしておく（「動画と一緒に再生」がすぐ最初から見られるように） */
  if(m==='2' && VID.ready && APP.tab!==UI.prevTab){ var t2=rangeStart(EXP()); if(Math.abs((VID.cur||0)-t2)>1e-6) vidSeek(t2).then(function(){ afterSeek(); if(LIVE.on) liveTick(-Infinity); }); }
  UI.prevTab=m;
  els('#tabs button').forEach(function(b){ b.classList.toggle('on', b.dataset.mode===m); });
  ['1','2','3','4','5'].forEach(function(k){ var sec=$('mode'+k); if(sec) sec.classList.toggle('hide', m!==k); });
  if(m==='4'){ if(typeof updateStroUI==='function') updateStroUI(); }
  if(m==='5'){ if(typeof renderErrSection==='function') renderErrSection(); if(typeof updateDepth==='function') updateDepth(); if($('errDtNote') && typeof dtMeaningHtml==='function') $('errDtNote').innerHTML=dtMeaningHtml(); }
  if(m==='2'){ APP.m2mode='side'; updateTable(); }   /* ②に来たときは、いつも「グラフを並べる」から */
  setM2Menu(APP.m2menu); setM3Menu(APP.m3menu);
  updateMenuChip();
  placePanelRsz();
  setM2Mode(APP.m2mode, true);                 /* ②以外では動画をもとの場所へ */
  var card=$('cgCard');
  if(m==='2'||m==='3'){
    $(m==='2'?'cgHost2':'cgHost3').appendChild(card);
    card.classList.remove('hide');
    $('cgFitRow').classList.toggle('hide', m!=='3');
    refreshCGExps(); cgToUI(); renderCG();
  } else card.classList.add('hide');
  if(m==='2') renderMode2();
  if(m==='3') renderMode3(false);
  if(m==='1') setTimeout(render, 30);
  if(m==='2'||m==='3'||m==='4') UI.m2Visited=true;      /* ②（③④）を一度でも開いたら「実験2を開始する」を出す */
  if(m==='3') UI.m3Visited=true;                          /* ③まで進んだら光らせる */
  updateNextExpBtn();
}
/* 右上の「実験○を開始する」：点があって ②を開いたあとに出す。③まで行ったら光る */
function updateNextExpBtn(){
  var b=$('btnNextExp'), g=$('gapNextExp'); if(!b) return;
  var anyPts=EXP().objs.reduce(function(a,o){ return a+o.length; },0)>0;
  var show=!!(anyPts && UI.m2Visited && VID.ready);
  b.classList.toggle('hide', !show); if(g) g.classList.toggle('hide', !show);
  b.textContent='実験'+(APP.exps.length+1)+'を開始する';
  b.classList.toggle('glow', show && !!UI.m3Visited);
}
/* 「実験○を開始する」：グラフを記録するか聞いてから、次の実験を作って動画を選ばせる */
function startNextExp(){
  var e=EXP(), cur=APP.cur+1, nxt=APP.exps.length+1;
  if(APP.exps.length>=MAXEXP){ toast('実験は'+MAXEXP+'個までです。古い実験を消してください'); return; }
  popup('<h2>'+esc(e.name)+' のグラフを記録しますか？</h2>'+
    '<p style="font-size:1.02rem">残しておきたければ、ここで保存してから次に進んでください（あとからでも実験'+cur+'を選べば出せます）。</p>'+
    '<div class="nextexp-row"><button class="btn" id="nxXlsx">測定データ、グラフをまとめてExcel出力</button>'+
    '<button class="btn" id="nxPng">グラフをPNG保存</button></div>'+
    '<p class="mini">［次へ］を押すと、いまの測定は <b>実験'+cur+'</b> として残り、新しい動画を選ぶ画面になります（新しい動画は <b>実験'+nxt+'</b>）。</p>',
    '実験'+nxt+'へ進む（動画を選ぶ）',
    function(){
      var ne=newExp(APP.exps.length+1);
      APP.exps.push(ne); APP.cur=APP.exps.length-1;
      UI.undo=[]; UI.lastPt=null; UI.obj=0; APP.editStep=0;
      UI.m2Visited=false; UI.m3Visited=false; resetFlowFlags(false);
      setTab('1'); refreshExpUI(); afterChange(); updateNextExpBtn();
      $('fileVideo').click();                     /* ボタンを押した流れの中なので、ファイル選択が開く */
    },
    { noLabel:'やめる' });
  var bx=$('nxXlsx'), bp=$('nxPng');
  if(bx) bx.onclick=function(){ $('btnXlsx').click(); };
  if(bp) bp.onclick=function(){ $('btnGraphPng').click(); };
}

/* ---------- 配線 ---------- */
function bindUI(){
  /* 動画の真ん中に出る大きな知らせは、どこかをクリックしたら消す（じゃまなので）。
     動画エリアの中をクリックしたときは、そのクリックは「消すだけ」に使う（記録や設定には使わない）。 */
  document.addEventListener('pointerdown', function(ev){
    if(!bigMsgOpen()) return;
    /* 「見つけました！ 最後まで追跡 しますか？」のように押せる知らせは、
       ここで消してしまうと click が届かない。そのまま通す。 */
    var am=$('autoMsg');
    if(am && am.__act && ev.target && ev.target.closest && ev.target.closest('#autoMsg')) return;
    var inVideo = ev.target && ev.target.closest && ev.target.closest('#videobox');
    closeBigMsg();
    if(inVideo && !(ev.target.tagName==='BUTTON' || (ev.target.closest && ev.target.closest('button')))){
      ev.preventDefault(); ev.stopPropagation();
    }
  }, true);

  ['dataTbl','dataTbl2'].forEach(function(id){
    var tb=$(id); if(!tb) return;
    tb.addEventListener('click', function(ev){
      var tr=ev.target.closest? ev.target.closest('tr.more') : null;
      if(tr) tblShift(parseInt(tr.dataset.d)*TBLMAX);
    });
  });
  bindTrkMark();
  var hw=el('details[data-key="howto"]');
  if(hw){
    var updHowto=function(){ var sp=$('howtoSum').querySelector('.sumtxt')||$('howtoSum');
      sp.innerHTML='操作説明<span class="sumsub">（クリックで'+(hw.open?'折りたたみ':'開く')+'）</span>'; };
    hw.addEventListener('toggle', updHowto); updHowto();
  }

  /* ヘッダ */
  $('btnHelp').onclick=openHelp;
  $('btnMenuPos').onclick=function(){
    setMenuPos(APP.menuPos==='left'? 'top' : 'left');
    saveLocal();
  };
  $('cbTeacher').onchange=function(){
    /* 課題ファイルを書き出すボタンは、上の段の「実験○を開始する」の左（赤文字）。
       3 の途中でも書き出せるように、教員用が ON ならいつでも出す（課題ファイルとして開いたときは出さない） */
    $('btnKadai').classList.toggle('hide', !this.checked || !!window.KADAI);
    if($('gapKadai')) $('gapKadai').classList.toggle('hide', !this.checked || !!window.KADAI);
  };
  $('cbAuto').onchange=function(){
    APP.autoTrack=this.checked;
    if($('howto4hand')){ $('howto4hand').classList.toggle('hide', this.checked); $('howto4auto').classList.toggle('hide', !this.checked); }
    $('autoCard').classList.toggle('hide', !this.checked);
    if(this.checked){
      var tc=el('details[data-key="track"]'); if(tc) tc.open=true;
      toast('自動追跡：ON（結果は手で直せます）');
    } else { UI.autoLost=false; autoMsgHide(); UI.startedAuto=false; stopAuto();
             if(UI.mode==='color'||UI.mode==='radius') setMode('record'); }
    updateGuide(); updateTodo();
  };
  els('#tabs button').forEach(function(b){ b.onclick=function(){
    if(b.classList.contains('lock')){ toast('①で 4. トラッキング の点を記録すると使えます'); return; }
    setTab(b.dataset.mode);
  }; });

  /* 実験 */
  $('expSel').onchange=function(){ switchExp(parseInt(this.value)); };
  $('btnResetAll').onclick=function(){
    if(!confirm('すべての実験・測定・保存データを消して、まっさらな状態にもどします。\nよろしいですか？（元にもどせません）')) return;
    wipeLocal();
    APP.exps=[newExp(1)]; APP.cur=0; APP.editStep=0; APP.step=0; APP.played=false;
    APP.cg={ expA:0, objA:0, qA:'x', invA:false, expB:0, objB:1, qB:'x', invB:false,
             xq:'t', invX:false, two:false, line:true };
    APP.cgFit=null; UI.undo=[]; UI.lastPt=null; UI.obj=0;
    stopAuto(); stopAllPlay(); setKomaMode(false);
    APP.trackColor=null; APP.startPt=null; APP.cgRange=null; resetCG();
    setStrobeOverlay(false); clearStrobe();
    VID.limit=null; VID.frames=[]; VID.ready=false; VID.cur=0; VID.name='';
    try{ VID.el.pause(); VID.el.removeAttribute('src'); VID.el.load(); }catch(err){}
    $('vph').classList.remove('hide');
    $('vph').innerHTML=VPH_HTML;
    $('cvView').classList.add('hide'); $('cvOv').classList.add('hide');
    $('vinfo').textContent='動画はまだ読み込まれていません。';
    $('ftState').textContent='未測定'; $('vidErr').classList.add('hide');
    $('rightcol') ; els('.rightcol').forEach(function(r){ r.classList.remove('sbs'); });
    $('btnSbs').textContent='動画と表を並べる'; setSbs(false);
    refreshExpUI(); cgToUI(); afterChange();
    setTab('1');
    toast('すべて消してリセットしました');
  };
  $('btnExpClear').onclick=function(){
    if(!confirm('この実験で決めたことを全部消して、「2. 解析する時間範囲の指定」からやり直します。\n'+
                '（記録した点・原点・スケール・x軸・時間範囲が消えます。動画はそのままです）\nよろしいですか？')) return;
    var e=EXP(), i;
    for(i=0;i<NOBJ;i++){ e.objs[i]=[]; e.objReady[i]=false; e.objEnd[i]=false; e.objName[i]=''; }
    e.ref=[]; e.origin=null; e.originSet=false; e.angle=0; e.mPerPx=null; e.scaleRef=null;
    e.t0=null; e.rangeA=null; e.rangeB=null; e.step2ok=false; e.trackReady=false; e.axisSet=false;
    e.crop=null;
    UI.undo=[]; UI.lastPt=null; UI.obj=0; APP.editStep=0; APP.played=false;
    stopAuto(); stopAllPlay(); setKomaMode(false);
    APP.trackColor=null; APP.startPt=null;
    setStrobeOverlay(false); clearStrobe(); selClear(); gvReset();
    VID.limit=null; resetFlowFlags(true);
    setMode('record');
    refreshObjUI(); updateCropInfo(); fitCanvas();
    afterChange(); render();
    toast('2. 解析する時間範囲の指定 からやり直せます');
  };

  /* 動画 */
  $('btnFile').onclick=function(){ $('fileVideo').click(); };
  if($('btnNextExp')) $('btnNextExp').onclick=startNextExp;
  $('fileVideo').onchange=function(){
    var f=this.files[0]; this.value='';
    if(f) askKeepExp(function(){ loadVideoFile(f); });
  };
  $('btnCam').onclick=function(){ openCamera(); };
  if(!cameraSupported()){
    $('btnCam').classList.add('hide');
    $('camNote').textContent='この端末では、アプリの中から撮影できません。端末のカメラアプリで撮ってから読み込んでください。';
  }
  /* サンプル動画：置いてあるものだけを出す。1 つも無ければプルダウンごと隠す
     （http(s) では HEAD で有無をたしかめる。file:// ではたしかめられないので、そのまま出す） */
  var ss=$('selSample');
  function fillSamples(list){
    while(ss.options.length>1) ss.remove(1);
    list.forEach(function(s){ var o=document.createElement('option'); o.value=s.f; o.textContent=s.n; ss.appendChild(o); });
    ss.classList.toggle('hide', list.length===0);
  }
  fillSamples(SAMPLES);
  if(/^https?:$/.test(location.protocol) && window.fetch && SAMPLES.length){
    Promise.all(SAMPLES.map(function(s){
      return fetch(s.f, {method:'HEAD'}).then(function(r){ return r.ok? s : null; }).catch(function(){ return null; });
    })).then(function(rs){ fillSamples(rs.filter(Boolean)); });
  }
  $('inFps').onchange=function(){
    var v=parseFloat(this.value);
    if(!(v>0) || v>1000){                 /* 変な値のときは、もとの値にもどす */
      toast('コマ数（fps）は 1 〜 1000 の数を入れてください');
      this.value=nf(VID.fps,3); return;
    }
    VID.fps=v; EXP().video.fps=v; $('fpsSrc').textContent='（手入力）'; afterChange();
  };
  $('btnFrameTable').onclick=function(){ buildTableUI(false); };

  /* 2. 解析する時間範囲 */
  $('btnRangeB').onclick=function(){
    var e=EXP();
    if(!VID.ready){ toast('先に動画を読み込んでください'); return; }
    /* 「おわり」は、かならず t=0 より後 */
    if(e.t0!==null && VID.cur <= e.t0 + 0.5/(VID.fps||30)){
      toast('「終わり」は「t = 0」より後のコマにしてください'); return;
    }
    askResetPts(function(){
      var was=currentStep();
      e.rangeB=VID.cur; afterChange(); toast('この時刻を解析の終わりにしました');
      if(was===2 && currentStep()>=3) askTrim();           /* 2 が終わった → 3（や 4）に進む前にトリミングを聞く */
    });
  };
  $('btnRangeClr').onclick=function(){
    askResetPts(function(){
      var e=EXP(); e.t0=null; e.rangeB=null; e.rangeA=null; e.step2ok=false;
      APP.editStep=0; resetFlowFlags(false); afterChange();
      toast('時間範囲を解除しました');
    });
  };
  $('btnStep2Next').onclick=function(){
    if(!VID.ready){ toast('先に動画を読み込んでください'); return; }
    var was2=currentStep();
    EXP().step2ok=true; afterChange();
    if(was2===2 && currentStep()>=3) askTrim(); else toast('次は「3. 空間の原点・スケール・軸」です');
  };
  $('btnPlay2').onclick=togglePlay;
  $('btnTimeZero2').onclick=function(){ $('btnTimeZero').click(); };
  $('btnRangeB2').onclick=function(){ $('btnRangeB').click(); };
  $('btnRangeClr2').onclick=function(){ $('btnRangeClr').click(); };
  $('btnStep2Next2').onclick=function(){ $('btnStep2Next').click(); };
  $('vhintX').onclick=function(e){ e.stopPropagation(); $('vhint').__closed=true; $('vhint').classList.add('hide'); };
  $('bigPlay').onclick=togglePlay;
  $('btnHead').onclick=$('btnHead2').onclick=function(){
    stopAllPlay(); vidSeek(0).then(function(){ afterSeek(); if(LIVE.on) liveTick(); });
  };
  $('btnHeadR').onclick=$('btnHeadR2').onclick=function(){
    stopAllPlay(); vidSeek(rangeStart(EXP())).then(function(){ afterSeek(); if(LIVE.on) liveTick(); });
  };

  /* ストロボ写真を重ねる（3のカード） */

  /* 校正 */
  $('btnOrigin').onclick=function(){ setMode(UI.mode==='origin'?'record':'origin'); };
  $('btnScale').onclick=function(){
    if(UI.mode==='scale1'||UI.mode==='scale2'){ UI.scaleP1=null; setMode('record'); calMsg(''); return; }
    var e=EXP();
    if(e.origin && !e.axisSet){ e.axisSet=true; }   /* 水平のままでよい、という意味 */
    afterChange();
    calGuide('scale');                     /* 動画の上の案内（長さの欄つき）で 2 点を打ってもらう */
  };
  $('btnAxis').onclick=function(){
    if(!EXP().origin){ toast('先に原点を決めてください'); return; }
    setMode(UI.mode==='axis'?'record':'axis');
  };
  $('btnTimeZero').onclick=function(){
    var e=EXP();
    if(!VID.ready){ toast('先に動画を読み込んでください'); return; }
    if(e.t0!==null && Math.abs(e.t0-VID.cur)<1e-6){
      askResetPts(function(){ e.t0=null; afterChange(); toast('t = 0 の設定を解除しました'); });
      return;
    }
    /* 「t = 0」は、かならず「おわり」より前 */
    if(e.rangeB!==null && VID.cur >= e.rangeB - 0.5/(VID.fps||30)){
      toast('「t = 0」は「この時刻まで解析」より前のコマにしてください'); return;
    }
    askResetPts(function(){
      e.t0=VID.cur; afterChange();
      toast('このコマを t=0 にしました');
      stepFrames(1);          /* 同じコマで「おわり」を押せないように、1コマ進める */
    });
  };
/* トラッキングずみのときは、消えることを知らせてから */
function askResetPts(go){
  var e=EXP(), n=e.objs.reduce(function(a,o){ return a+o.length; },0);
  if(!n){ go(); return; }
  popup('<h2>トラッキングの点がすべて消えます</h2>'+
    '<p style="font-size:1.02rem">解析する時間範囲を変えると、いま記録した <b>'+n+' 点</b>は'+
    'すべて消えます。よろしいですか？</p>',
    'はい、消してやり直す', function(){
      pushUndo({t:'bulkAll', prev:e.objs.map(function(o){ return o.slice(); })});
      for(var i=0;i<NOBJ;i++){ e.objs[i]=[]; e.objReady[i]=false; e.objEnd[i]=false; }
      e.trackReady=false; UI.lastPt=null;
      if(typeof refreshObjUI==='function') refreshObjUI();
      go();
      render();
      toast('トラッキングをリセットしました（Ctrl+Z でもどせます）');
    });
}
  $('btnCalClr').onclick=function(){
    var e=EXP();
    if(!e.originSet && !e.axisSet && !e.mPerPx){ toast('まだ何も決めていません'); return; }
    askResetPts(function(){
      var e2=EXP();
      e2.origin=null; e2.originSet=false; e2.axisSet=false; e2.angle=0;
      e2.mPerPx=null; e2.scaleRef=null;
      UI.scaleP1=null; APP.editStep=0; setMode('record'); calMsg('');
      UI.calPend=null; setCalHint(null);
      afterChange(); if(VID.ready) render();
      toast('原点・軸・スケールを解除しました');
    });
  };
  $('btnAxX').onclick=function(){ setAxisDisp('x'); };
  $('btnAxXY').onclick=function(){ setAxisDisp('xy'); };
  $('cbYFlip').onchange=function(){ EXP().yflip=this.checked; afterChange(); renderCG(); };
  $('cbXFlip').onchange=function(){ EXP().xflip=this.checked; afterChange(); renderCG(); };
  $('inScaleLen').onchange=function(){
    var e=EXP();
    var len=parseFloat(this.value)*parseFloat($('selScaleUnit').value);
    if(!(len>0)){                      /* 0・マイナス・文字が入ったら、黙って直さず知らせる */
      toast('長さは 0 より大きい数を入れてください');
      if(e.scaleLen>0){                /* 前の値にもどす */
        var u=parseFloat($('selScaleUnit').value)||1;
        this.value=+(e.scaleLen/u).toFixed(4);
      }
      return;
    }
    if(e.scaleRef){
      var d=Math.hypot(e.scaleRef.x2-e.scaleRef.x1, e.scaleRef.y2-e.scaleRef.y1);
      if(d>0){ e.mPerPx=len/d; e.scaleLen=len; afterChange(); }
    } else e.scaleLen=len;
  };
  $('selScaleUnit').onchange=function(){ $('inScaleLen').onchange(); };
  $('selTScale').onchange=function(){
    EXP().tscale=parseFloat(this.value)||1;
    afterChange();
    if(!$('mode2').classList.contains('hide')) renderMode2();
    if(!$('mode3').classList.contains('hide')) renderMode3(false);
    renderCG();
    toast(EXP().tscale===1? '普通の速さとして計算します' : '動画の時間 × '+EXP().tscale+' を実際の時間として計算します');
  };
  $('btnRestoreClear').onclick=function(){
    if(!confirm('前回のデータ（記録した点・原点・スケールなど）を消します。よろしいですか？')) return;
    wipeLocal();
    APP.exps=[newExp(1)]; APP.cur=0; APP.editStep=0; APP.step=0; APP.played=false;
    UI.undo=[]; UI.lastPt=null; selClear(); gvReset();
    setStrobeOverlay(false); clearStrobe();
    refreshExpUI(); afterChange(); render();
    toast('前回のデータを消しました');
  };

  /* トラッキング */
  $('cbTwoObj').onchange=function(){
    if(this.checked && VID.ready){ EXP().nObjOk=false; }          /* ON にしなおしたら、物体の数をもう一度聞く */
    setTwoObj(this.checked);
    toast(this.checked? '複数物体の運動：ON（物体1 → 物体2 → … の順に追いかけます。数は 4 に入ったときに聞きます）' : '複数物体の運動：OFF'); };
  $('selObj').onchange=function(){
    UI.obj=parseInt(this.value)-1; refreshObjUI(); updateGuide(); drawOverlay();
  };
  $('inObjName').oninput=function(){
    EXP().objName[UI.obj]=this.value; refreshObjUI(); updateGuide(); saveLocal();
  };
  /* 入力し終わったところで、ほかの物体と同じ名前になっていないか見る
     （打っている途中は言わない。同じ名前だとグラフの凡例が見分けられなくなる） */
  $('inObjName').onchange=function(){ checkObjName(); };
  $('btnStartHand').onclick=function(){ switchWay(false); };
  $('btnStartAuto').onclick=function(){ switchWay(true); };
  $('btnNextTrk').onclick=function(){
    var t=nextTrkTime();
    if(t===null){ toast('まだ記録した点がありません'); return; }
    stopAllPlay(); stopAuto();
    vidSeek(t).then(function(){ afterSeek(); afterChange(); render();
      toast('記録した続き（t = '+nf(t-(EXP().t0||0),3)+' s）に来ました'); });
  };
  $('cbBig').onchange=function(){ setBigView(this.checked); saveLocal(); };
  /* ファイルを選ぶダイアログを開いた時刻（全画面が外れた理由を見分けるため） */
  ['fileVideo','fileCam','fileJson'].forEach(function(id){
    var f=$(id); if(f) f.addEventListener('click', function(){ UI.fileClickAt=Date.now(); });
  });
  document.addEventListener('fullscreenchange', function(){
    if(document.fullscreenElement){ UI.wantFull=false; return; }
    if(!APP.bigView) return;
    /* ファイルを選ぶダイアログで全画面が外れたときは、最大表示をやめず、
       次に画面を触ったときに全画面へもどす。
       それ以外（esc など。ブラウザは esc のキー入力をページに渡さない）は、
       いちばん上の段までふくめて元の表示にもどす。 */
    if(UI.fileClickAt && Date.now()-UI.fileClickAt < 3000) UI.wantFull=true;
    else setBigView(false);
  });
  document.addEventListener('pointerdown', function(){
    if(UI.wantFull && APP.bigView && !document.fullscreenElement &&
       document.documentElement.requestFullscreen &&
       window.innerHeight < (screen.height||0) - 2){
      UI.wantFull=false;
      try{ document.documentElement.requestFullscreen(); }catch(e){}
    }
  }, true);
  document.addEventListener('keydown', function(e){
    if(e.key==='Escape' && APP.bigView) setBigView(false);
  });
  $('cbM2Min').onchange=function(){ setM2Menu(!this.checked); saveLocal(); };
  if($('cbM3Min')) $('cbM3Min').onchange=function(){ setM3Menu(!this.checked); saveLocal(); };
  $('cbM2MenuTop').onchange=function(){
    if(APP.tab==='3') setM3Menu(this.checked); else setM2Menu(this.checked);
    saveLocal();
  };
  bindPanelRsz(); bindVidRsz(); bindDepth();
  /* 1. 動画：動画エリアをクリックしたら「動画を選択」 */
  $('vph').onclick=function(){ if(!VID.ready) $('btnFile').click(); };
  $('selSample').onchange=function(){
    var f=this.value; this.value='';
    if(!f) return;
    var s0=SAMPLES.filter(function(x){ return x.f===f; })[0];
    UI.loadingSample=true;
    askKeepExp(function(){ loadVideoUrl(f, s0? s0.n : f); });
  };
  $('btnSbs').onclick=function(){
    setSbs(!el('.rightcol').classList.contains('sbs'));
  };
  $('btnOriginBig').onclick=function(){ $('btnOrigin').click(); };
  $('doneMsg').onclick=function(){ setTab('2'); };
  $('trkDone').onclick=function(){ setTab('2'); };
  $('btnTrkStart').onclick=function(){ startTracking(false); };
  if($('btnTrkStartA')) $('btnTrkStartA').onclick=function(){ startTracking(true); };
  if($('btnTrkStartH')) $('btnTrkStartH').onclick=function(){ startTracking(false); };
  $('btnClearObj').onclick=function(){
    var e=EXP();
    if(!e.objs[UI.obj].length){ toast('物体'+(UI.obj+1)+'の点はまだありません'); return; }
    pushUndo({t:'bulk', obj:UI.obj, prev:e.objs[UI.obj].slice()});
    e.objs[UI.obj]=[]; e.objReady[UI.obj]=false; e.objEnd[UI.obj]=false;
    refreshObjUI(); afterChange(); render();
    rewindToRangeStart();
    toast('物体'+(UI.obj+1)+'の点を消して、解析範囲の最初に戻りました');
  };
  /* 「この物体はここで終わり」：画面の外に出るなどで最後まで追えないとき、いまの時刻までで完了にする */
  if($('btnObjEnd')) $('btnObjEnd').onclick=function(){
    var e=EXP(), o=UI.obj;
    if(!e.objs[o] || !e.objs[o].length){ toast('物体'+(o+1)+'の点はまだありません'); return; }
    if(!e.objEnd) e.objEnd=[false,false,false];
    e.objEnd[o]=true;
    stopAuto();
    toast('物体'+(o+1)+'はここまでで完了にしました');
    refreshObjUI(); afterChange(); render();
  };
  $('btnTrkReset').onclick=function(){ resetTracking(APP.twoObj? 0 : undefined); };
  $('btnTrkResetB').onclick=function(){ resetTracking(1); };
  if($('btnTrkResetC')) $('btnTrkResetC').onclick=function(){ resetTracking(2); };
  $('btnTrkReset2').onclick=function(){ resetTracking(APP.twoObj? UI.obj : undefined); };
  /* ②の 2 つの表示モード */
  $('btnM2Side').onclick=function(){ setM2Mode('side'); };
  $('btnM2Live').onclick=function(){ try{ localStorage.setItem('ma_live_seen','1'); }catch(e){} setM2Mode('live'); };
  $('btnLivePlay').onclick=livePlay;
  els('.cbKoma').forEach(function(c){
    c.addEventListener('change', function(){ setKomaMode(c.checked); });
  });
  $('cbLiveAxis').addEventListener('change', function(){
    LIVE.axis=this.checked; if(VID.ready) render();
  });
  $('m2tblCard').addEventListener('toggle', function(){ updateTblFold(); });
  $('btnLiveRewind').onclick=function(){
    stopAllPlay();
    vidSeek(rangeStart(EXP())).then(function(){ afterSeek(); liveTick(-Infinity); });
  };
  $('cbDrift').onchange=function(){ EXP().useDrift=this.checked; afterChange(); };
  $('btnRefPt').onclick=function(){ setMode(UI.mode==='ref'?'record':'ref'); };
  $('btnRefClr').onclick=function(){ EXP().ref=[]; afterChange(); toast('固定点を消しました'); };

  /* 自動追跡 */
  $('btnPickColor').onclick=function(){
    if(needTrackStart()){ startTracking(true); return; }      /* まだなら、ここで始める */
    UI.startedAuto=true;
    setMode((UI.mode==='color'||UI.mode==='radius')?'record':'color');
    afterChange();
  };
  $('btnAutoRun').onclick=function(){
    if(needTrackStart()){ toast('先に［色で自動追跡］を押して、始点と色を決めてください'); return; }
    if(UI.mode==='radius') setMode('record');      /* 探索半径は決まったものとする */
    autoRunAll();
  };
  $('btnAutoStop').onclick=function(){ stopAuto(); };
  $('btnAutoRun2').onclick=function(){ $('btnAutoRun').click(); };
  $('btnAutoStop2').onclick=function(){ stopAuto(); };
  $('btnUndo1c').onclick=function(){ $('btnUndo1').click(); };
  ['btnUndo1','btnUndo1v'].forEach(function(id){
    if($(id)) $(id).onclick=function(){
      UI.noAutoUntil=Date.now()+700;      /* 止めるときのシークで点が増えないように */
      stopAuto(); stopAllPlay(); doUndo();
    };
  });
  /* 解析範囲の最初からやり直し（この物体の点を消して、始点だけ置きなおす） */
  $('btnAutoRedo').onclick=function(){
    if(!VID.ready){ toast('先に動画を読み込んでください'); return; }
    stopAuto(); stopAllPlay();
    var e=EXP();
    if(e.objs[UI.obj].length) pushUndo({t:'bulk', obj:UI.obj, prev:e.objs[UI.obj].slice()});
    e.objs[UI.obj]=[];
    if(UI.mode==='radius') setMode('record');
    vidSeek(rangeStart(e)).then(function(){
      afterSeek();
      var sp=APP.startPt, f=null;
      if(APP.trackColor && sp){
        vidDrawFull();
        var R=parseInt($('inSearchR').value)||40, TH=parseInt($('inColTh').value)||60;
        f=findColor(sp.x, sp.y, Math.max(R*2,80), TH);
      }
      if(f){ addPoint(UI.obj, f.x, f.y, false); APP.startPt={x:f.x,y:f.y,t:VID.cur};
             toast('解析範囲の最初に戻しました。［最後まで自動追跡］を押してください'); }
      else { afterChange();
             toast('解析範囲の最初に戻しました。始点をクリックしてください'); }
      render(); updateGuide();
    });
  };

  /* ストロボ */
  $('btnStrobe').onclick=function(){
    $('btnStrobe').disabled=true;
    makeStrobe().then(function(){
      $('btnStrobe').disabled=false;
      $('stroTune').classList.remove('hide');   /* 作ったあとに「時間間隔調整」を出す */
      updateStroUI();
    });
  };
  $('stroStep').oninput=function(){ updateStroUI(); };
  $('stroStep').onchange=function(){
    if(!UI.stroReady){ updateStroUI(); return; }
    if(UI.stroBusy){ toast('いま作っています。終わるまでお待ちください'); return; }
    $('btnStrobe').disabled=true;
    makeStrobe().then(function(){ $('btnStrobe').disabled=false; updateStroUI(); });
  };
  $('cbStroPts').onchange=function(){ applyStroPts(); };
  $('btnStroSave').onclick=function(){ askSaveName('ストロボ画像', saveStrobePng); };
  $('btnStroClr').onclick=function(){
    clearStrobe(); toast('ストロボ画像を消しました');
  };

  /* 出力 */
  var askThen=function(what, fn){ return function(){ UI.attachStro=undefined; askSaveName(what, fn); }; };
  /* ②③の Excel・レポート：先に「ストロボ写真を作成しますか？」。はい → ④で作ってあればそれを、無ければふさわしいコマ間隔で自動で作って、最後につける */
  var askStroThen=function(what, fn){ return function(){
    var go=function(attach){ UI.attachStro=attach; askSaveName(what, fn); };
    var anyPts=VID.ready && EXP().objs.some(function(a){ return a.length; });
    if(!anyPts){ go(false); return; }
    if(window.__noAskName && window.__askStro===undefined){ go(!!UI.stroReady); return; }   /* テスト用：聞かない */
    if(window.__askStro!==undefined){ var yes=!!window.__askStro; if(yes && !UI.stroReady){ makeStrobeAuto().then(function(){ go(!!UI.stroReady); }); } else go(yes); return; }
    popup('<h2>ストロボ写真を作成しますか？</h2>'+
      '<p>「はい」にすると、'+(UI.stroReady? '④で作ったストロボ画像（'+stroStepVal()+' コマおき）' : 'ふさわしいコマ間隔で自動で作ったストロボ画像')+
      'を '+esc(what)+' の最後につけます。</p>',
      'はい', function(){
        if(UI.stroReady){ go(true); return; }
        toast('ストロボ画像を作っています…');
        makeStrobeAuto().then(function(){ go(!!UI.stroReady); });
      }, { noLabel:'いいえ', onNo:function(){ go(false); } });
  }; };
  $('btnCsv').onclick=askThen('CSV', exportCsv);
  $('btnCsv2').onclick=askThen('CSV', exportCsv);
  $('btnCopy').onclick=copyCsv;
  $('btnCopy2').onclick=copyCsv;
  $('btnJsonSaveTop').onclick=askThen('測定データ', exportJson);
  ['btnJsonLoadTop'].forEach(function(id){
    $(id).onclick=function(){
      if(APP.exps.length>=MAXEXP){ toast('実験は'+MAXEXP+'個までです'); return; }
      $('fileJson').click();
    };
  });
  $('fileJson').onchange=function(){ if(this.files[0]) importJson(this.files[0]); this.value=''; };
  $('btnEnergyOn').onclick=function(){ setEnergyOn(!APP.energyOn); saveLocal(); };
  $('btnReportPng').onclick=askThen('レポート（PNG）', exportReportPng);
  $('btnReportPdf').onclick=askThen('レポート（PDF）', exportReportPdf);
  $('btnReportPng2').onclick=askStroThen('レポート（PNG）', exportReportPng);
  $('btnReportPdf2').onclick=askStroThen('レポート（PDF）', exportReportPdf);
  $('btnKadai').onclick=openKadaiDialog;
  $('btnXlsx').onclick=askStroThen('Excel', exportXlsx);
  /* ③にも同じ出力ボタン（CSV は置かない） */
  $('btnReportPng3').onclick=askStroThen('レポート（PNG）', exportReportPng);
  $('btnReportPdf3').onclick=askStroThen('レポート（PDF）', exportReportPdf);
  $('btnXlsx3').onclick=askStroThen('Excel', exportXlsx);
  $('btnGraphPng3').onclick=askThen('グラフの画像', exportGraphsPng);
  $('btnGraphPng').onclick=askThen('グラフの画像', exportGraphsPng);

  /* 再生・コマ送り */
  els('.stepbtns .btn[data-step]').forEach(function(b){
    b.onclick=function(){
      var s=b.dataset.step, N=parseInt($('inStepN').value)||1;
      var n=(s==='n')?N:(s==='-n')?-N:parseInt(s);
      stepFrames(n);
    };
  });
  $('btnPlay').onclick=togglePlay;
  $('seek').oninput=function(){
    if(!VID.ready) return;
    if(isPlaying()) stopAllPlay();        /* 再生中にシークバーを動かしたら、いったん止める */
    var t=this.value/1000*VID.dur;
    if(VID.limit && (t < VID.limit.a-1e-6 || t > VID.limit.b+1e-6)){
      t=Math.max(VID.limit.a, Math.min(VID.limit.b, t));
      this.value=Math.round(t/VID.dur*1000);
      toast('解析する時間範囲の外です。変えたいときは「2. 解析する時間範囲の指定」の［もう一度］→［範囲を解除］を押してください');
    }
    VID.el.currentTime=t; VID.cur=t; VID.idx=frameIndexAt(t);
    $('tInfo').textContent=nf(t-(EXP().t0||0),4);
    if(!seekBusy){ seekBusy=true; setTimeout(function(){ seekBusy=false; render(); updateTimeLine(); }, 60); }
  };
  $('seek').onchange=function(){ vidSeek(this.value/1000*VID.dur).then(afterSeek); };
  ['btnCrop','btnCrop2'].forEach(function(id){
    $(id).onclick=function(){
      if(!VID.ready){ toast('先に動画を読み込んでください'); return; }
      if(UI.mode==='crop'){ UI.cropDrag=null; setMode('record'); updateCropInfo(); render(); return; }
      stopAllPlay();
      UI.cropDrag=null; setMode('crop'); updateCropInfo(); render();
      toast('残したい所を、動画の上で四角くドラッグしてください');
    };
  });
  ['btnCropClr','btnCropClr2'].forEach(function(id){
    $(id).onclick=function(){
      if(!hasCrop()){ toast('トリミングしていません'); return; }
      setCrop(null); toast('トリミングを元に戻しました');
    };
  });

  /* モード2・3 */
  /* 「座標の選択を解除する」（②③）：選んでいた点を外す */
  ['btnSelClr','btnSelClr3'].forEach(function(id){
    var b=$(id); if(b) b.onclick=function(){ selClear(); redrawAllCharts(); updateReadouts(); };
  });
  ['selCmp','cbG_x','cbG_y','cbG_v','cbG_a','cbG_e','inM1','inM2','inM3','inG','selGDir'].forEach(function(id){
    if($(id)) $(id).addEventListener('change', function(){ afterChange(); renderMode2(); });
  });
  /* ②の「重心の運動量」：ON にすると質量の欄が出て、物体ごとの運動量と全体（重心）の運動量のグラフが増える */
  if($('cbG_p')) $('cbG_p').addEventListener('change', function(){
    APP.momOn=$('cbG_p').checked; updateMassRow(); afterChange(); renderMode2();
  });
  function reRender(){
    if(!$('mode2').classList.contains('hide')) renderMode2();
    if(!$('mode3').classList.contains('hide')) renderMode3(false);
    renderCG();
  }
  function gSize(f){ APP.gsize=Math.max(240, Math.min(900, Math.round(APP.gsize*f))); reRender(); saveLocal(); }
  function gReset(){
    gvReset(); APP.fitRange=null; APP.cgRange=null; APP.gsize=450; reRender(); saveLocal();
    toast('グラフのスケールと位置を元に戻しました');
  }
  ['btnGBig','btnGBig3'].forEach(function(id){ $(id).onclick=function(){ gSize(1.25); }; });
  ['btnGSmall','btnGSmall3'].forEach(function(id){ $(id).onclick=function(){ gSize(1/1.25); }; });
  ['btnGReset','btnGReset3'].forEach(function(id){ $(id).onclick=gReset; });
  ['btnGFitAll','btnGFitAll3'].forEach(function(id){ var q=$(id); if(q) q.onclick=function(){ fitAllCharts(); }; });
  bindTblResize();
  $('cgMomentum').onclick=function(){
    var c=APP.cg, e=APP.exps[c.expA];
    if(!e || !e.objs[1] || !e.objs[1].length){        /* 物体2が無いときは切りかえない */
      $('cgMomentumErr').classList.remove('hide');
      $('cgMomentumNote').classList.add('hide');
      return;
    }
    $('cgMomentumErr').classList.add('hide');
    c.qA='px'; c.objA=0; c.qB='px'; c.objB=1; c.xq='t'; c.two=true; c.invA=false; c.invB=false; c.invX=false;
    APP.cgRange=null;
    c.expB=c.expA;
    cgToUI(); APP.cgFit=null; $('cgResult').innerHTML='';
    $('cgMomentumNote').classList.remove('hide');
    $('cgMassRow').classList.remove('hide'); syncCgMass();
    renderCG(); saveLocal();
    toast('縦軸＝物体1 の運動量 px／縦軸2＝物体2 の運動量 px／横軸＝t にしました（同じ目盛り）');
  };
  /* 運動量の質量欄：②のエネルギーの m₁・m₂ と同じ値 */
  ['cgM1','cgM2','cgM3'].forEach(function(id, i){
    var f=$(id); if(!f) return;
    f.onchange=function(){
      var e=EXP(), v=posNum(f, [e.m1,e.m2,e.m3][i], 0.1);
      if(i===2) e.m3=v; else if(i===1) e.m2=v; else e.m1=v;
      var tgt=$(['inM1','inM2','inM3'][i]); if(tgt) tgt.value=v;
      renderCG(); if(!$('mode2').classList.contains('hide')) renderMode2(); saveLocal();
    };
  });
  $('btnFit').onclick=function(){ renderMode3(true); };
  if($('btnFitClr')) $('btnFitClr').onclick=function(){ RESID=[]; RESID_INFO={}; $('fitResult').innerHTML=''; if($('residHost')) $('residHost').innerHTML=''; renderMode3(false); };
  $('btnWhatFit').onclick=openWhatFit;
  ['selFitY','selFitType','selFitObj','selCmp3'].forEach(function(id){
    $(id).addEventListener('change', function(){ if(id==='selFitType') updateFitInitUI(); renderMode3(false); });
  });
  updateFitInitUI();


  /* キーボード */
  document.addEventListener('keydown', function(e){
    var tag=(e.target.tagName||'').toLowerCase();
    if(tag==='input'||tag==='textarea'||tag==='select') return;
    if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='z'){ e.preventDefault(); doUndo(); return; }
    var st=e.shiftKey?5:1;
    if(e.key==='ArrowLeft'&&!e.altKey){ e.preventDefault(); nudgeLast(-st,0); render(); }
    else if(e.key==='ArrowRight'&&!e.altKey){ e.preventDefault(); nudgeLast(st,0); render(); }
    else if(e.key==='ArrowUp'){ e.preventDefault(); nudgeLast(0,-st); render(); }
    else if(e.key==='ArrowDown'){ e.preventDefault(); nudgeLast(0,st); render(); }
    else if(e.key===','){ stepFrames(-1); }
    else if(e.key==='.'){ stepFrames(1); }
    else if(e.key===' '){ e.preventDefault(); togglePlay(); }
  });
  window.addEventListener('resize', function(){
    clearTimeout(window.__rz); window.__rz=setTimeout(function(){ render(); updatePrec(); drawSeekMarks();
      updateVBoxNarrow();
      if(!$('mode2').classList.contains('hide')) renderMode2(); }, 180);
  });
  els('.modal').forEach(function(m){
    m.addEventListener('click', function(e){ if(e.target===m) m.classList.add('hide'); });
  });
}
var seekBusy=false;

/* =========================================================
   撮れぐあいのチェック（②）と、ものさしの奥行き（③）
   ========================================================= */
/* 判定はゆるめにしておく。生徒を止めるためではなく、
   「なぜグラフが荒れるのか」を自分で見つけられるようにするのが目的。 */
function diagItems(){
  var out=[], d=(typeof diagResult==='function')? diagResult() : null;
  function add(mk, name, val, tip){ out.push({mk:mk, name:name, val:val, tip:tip||''}); }
  /* --- 測らなくても分かること --- */
  var dur=VID.dur||0;
  if(dur>0){
    if(dur<=VREC.dur) add('o','長さ', nf(dur,1)+' 秒','');
    else if(dur<=60) add('t','長さ', nf(dur,1)+' 秒','少し長めです。2 で「解析する時間範囲」をみじかくしぼると軽くなります。');
    else add('x','長さ', nf(dur,1)+' 秒','長すぎます。見たい運動の前後だけを切り出して撮り直すのがおすすめです。');
  }
  if(VID.w){
    if(VID.w<=VREC.w && VID.h<=VREC.h) add('o','画面の大きさ', VID.w+'×'+VID.h+' px','');
    else add('t','画面の大きさ', VID.w+'×'+VID.h+' px','4K などは重くなるだけで、精度は上がりません。フルHD で十分です。');
  }
  if(VID.bytes>0){
    if(VID.bytes<=VREC.bytes) add('o','ファイル', sizeText(VID.bytes),'');
    else add('t','ファイル', sizeText(VID.bytes),'大きいと動きが重くなります。');
  }
  if(VID.frames.length>2){
    var f=nf(VID.fps,1);
    if(VID.fps>=45) add('t','コマ数', f+' コマ/秒','こまかく撮れていますが、そのぶん 1 コマの動きが小さくなります。'+
      '4 では［進むフレーム数 N］を大きめ（4〜8）にすると、v・a のグラフが落ち着きます。');
    else add('o','コマ数', f+' コマ/秒','');
  }
  /* --- 再生しながら測ったこと --- */
  if(d){
    var L=d.lum;
    if(L>=80) add('o','明るさ','じゅうぶん','');
    else if(L>=50) add('t','明るさ','やや暗い','暗いと 1 コマ 1 コマがぼやけて、点が打ちにくくなります。');
    else add('x','明るさ','暗い','照明をつけるか、明るい場所で撮り直すと、ぐっと点が打ちやすくなります。');
    if(d.sharpMed!==null && d.sharpMax>0){
      var r=d.sharpMed/d.sharpMax;
      if(r>=0.6) add('o','コマのくっきりさ','そろっています','');
      else if(r>=0.4) add('t','コマのくっきりさ','コマによってぼやけます',
        '物体が速いか、暗いためです。物体をもう少し遠くから撮るか、明るくすると直ります。');
      else add('x','コマのくっきりさ','ぶれているコマが多い',
        '物体が速すぎるか、暗すぎます。このままだと点の位置が読み取りにくくなります。');
    }
    if(d.shakePct!==null){
      var p=d.shakePct, px=nf(d.shake,1)+' px';
      if(p<0.2) add('o','手ぶれ','ほぼ固定','');
      else if(p<0.6) add('t','手ぶれ','少しゆれています（'+px+'/コマ）',
        '4 の［手ぶれ補正を使う］にチェックを入れ、［画面内の固定点を記録］で動かない目印を'+
        'いくつかのコマでクリックすると、そのぶんを差し引けます。');
      else add('x','手ぶれ','ゆれが大きい（'+px+'/コマ）',
        'このままだと v・a が実際よりずれます。4 の［手ぶれ補正を使う］で固定点をとるか、'+
        'カメラを机や壁に固定して撮り直してください。');
    }
  }
  return out;
}
function diagWorst(items){
  var w='o';
  items.forEach(function(i){ if(i.mk==='x') w='x'; else if(i.mk==='t' && w!=='x') w='t'; });
  return w;
}
var MK={ o:'○', t:'△', x:'×' };
function renderVidDiag(){
  var box=$('vidDiag'); if(!box) return;
  if(!VID.ready){ box.classList.add('hide'); box.innerHTML=''; return; }
  var items=diagItems();
  if(!items.length){ box.classList.add('hide'); box.innerHTML=''; return; }
  var w=diagWorst(items);
  box.className='diagbox'+(w==='x'?' bad':(w==='t'?' warn':''));
  var head=(w==='o')? 'この動画の撮れぐあい：よく撮れています'
         : (w==='t')? 'この動画の撮れぐあい：気になるところがあります'
                    : 'この動画の撮れぐあい：撮り直したほうがよいところがあります';
  var h='<span class="dgt">'+head+'</span><ul>';
  items.forEach(function(i){
    h+='<li><span class="mk '+i.mk+'">'+MK[i.mk]+'</span><span>'+esc(i.name)+'：<b>'+esc(i.val)+'</b>'+
       (i.tip? '<br><span class="dgtip">'+i.tip+'</span>' : '')+'</span></li>';
  });
  h+='</ul>';
  if(!(typeof diagResult==='function' && diagResult()))
    h+='<p class="mini dgtip">明るさ・手ぶれは、コマごとの時刻を測るときに調べます。</p>';
  box.innerHTML=h;
}
/* 撮れぐあいを1行にまとめる（レポートの条件欄に出す） */
function diagLine(){
  var d=(typeof diagResult==='function')? diagResult() : null;
  var s=[];
  if(d){
    s.push('明るさ '+(d.lum>=80?'○':(d.lum>=50?'△':'×')));
    if(d.shakePct!==null) s.push('手ぶれ '+(d.shakePct<0.2? 'ほぼ無し（○）'
      : nf(d.shake,1)+' px/コマ'+(d.shakePct<0.6?'（△）':'（×）')));
    if(d.sharpMed!==null && d.sharpMax>0)
      s.push('コマのくっきりさ '+(d.sharpMed/d.sharpMax>=0.6?'○':(d.sharpMed/d.sharpMax>=0.4?'△':'×')));
  }
  var e=EXP(), er=depthErrPct(e);
  if(er!==null) s.push('ものさしの奥行き '+(er===0? '同じ（○）' : '約 '+nf(er,0)+'% ずれ'));
  return s.length? s.join('　') : '（測っていません）';
}
/* ---- ものさしの奥行き ---- */
/* カメラから物体まで L、ものさしが d だけ手前（または奥）なら、
   写る大きさが L/(L∓d) 倍ちがうので、長さは およそ d/L の割合でずれる。 */
function depthErrPct(e){
  e=e||EXP();
  if(!(e.mPerPx>0)) return null;
  var L=+e.camDist||3, gp=+e.rulerGap||0;
  if(!(L>0)) return null;
  return Math.min(90, gp/L*100);
}
function updateDepth(){
  var e=EXP(), box=$('depthBox'), msg=$('depthMsg');
  if(!box) return;
  if($('selCamDist')) $('selCamDist').value=String(e.camDist||3);
  if($('selRulerGap')) $('selRulerGap').value=String(e.rulerGap||0);
  /* ③の「誤差の要因の例」にあるので、スケール未設定でも計算して見せる */
  var L=+e.camDist||3, gp=+e.rulerGap||0, p=(L>0)? Math.min(90, gp/L*100) : 0;
  if(!msg) return;
  if(!p){ msg.className='mini ok';
    msg.innerHTML='同じ奥行きなら、この心配はありません。'; return; }
  msg.className='mini ng';
  msg.innerHTML='長さが <b>約 '+nf(p,0)+' %</b> ずれます'+
    '（ものさしが手前なら小さく、奥なら大きく出ます）。'+
    (p>=10? '<br>ものさしを物体と同じ奥行きに置いて、撮り直すことをおすすめします。' : '');
}
function bindDepth(){
  ['selCamDist','selRulerGap'].forEach(function(id){
    var s=$(id); if(!s) return;
    s.onchange=function(){
      var e=EXP();
      if(id==='selCamDist') e.camDist=parseFloat(s.value)||3;
      else e.rulerGap=parseFloat(s.value)||0;
      updateDepth(); saveLocal();
    };
  });
}

/* =========================================================
   動画を読んだ直後の「撮影 fps（フレームレート）の確認」
   ・fps とスロー撮影の入れ忘れを防ぐため、動画を読んだらかならず1回聞く
   ・撮影 fps と スロー倍率 は同じことの表と裏：撮影 fps ＝ 再生 fps ÷ 倍率
   ・同じ動画を開き直したとき（続きから）は聞かない
   ========================================================= */
var SLOW_OPTS=[[1,'普通の速さで撮った'],[0.5,'1/2 のスロー'],[0.25,'1/4 のスロー'],
               [0.125,'1/8 のスロー（240fps→30fps など）'],[0.0625,'1/16 のスロー']];
function fpsMeasured(){ return VID.frames.length>2; }
/* 倍率の表示：8 なら「8」、2.5 なら「2.5」 */
function niceX(v){ return (Math.abs(v-Math.round(v))<0.02)? String(Math.round(v)) : sig(v,3); }
function askFpsUI(){
  var e=EXP();
  if(!VID.ready) return;
  var play=VID.fps>0? VID.fps : 30;
  var ts=(e.tscale>0? e.tscale : 1);
  var st=fpsFromTable();
  var info = fpsMeasured()
    ? VID.frames.length+' コマ / '+nf(VID.frames[VID.frames.length-1]-VID.frames[0],3)+' s / 再生 '+nf(play,3)+' fps'+
      (st&&st.vfr? '（可変フレームレート）':'（固定フレームレート）')
    : '<span class="ng">コマごとの時刻は測れませんでした。</span>再生 fps を入力してください（ふつうは 30 か 60）';
  if(window.__noAskFps){ applyFps(play, ts); return; }
  var old=document.getElementById('fpsDlg'); if(old) old.remove();
  var m=document.createElement('div'); m.className='modal'; m.id='fpsDlg';
  m.innerHTML='<div class="box" style="max-width:560px">'+
    '<h2>撮影 fps（フレームレート）の確認</h2>'+
    '<p>撮影 fps（<b>1 秒間に何コマ撮ったか</b>）を入力してください。</p>'+
    '<label class="f" style="font-size:1.05rem">撮影 fps：<input type="number" id="inShotFps" min="1" max="2000" step="1" style="width:120px"></label>'+
    '<p class="mini" style="margin:6px 0 10px">ファイル解析：'+info+'</p>'+
    (fpsMeasured()? '' :
      '<label class="f">再生 fps：<input type="number" id="inPlayFps" min="1" max="1000" step="0.001" style="width:110px" value="'+nf(play,3)+'"></label>')+
    '<label class="f" style="font-size:1.02rem">スロー撮影：<select id="selShotSlow">'+
      SLOW_OPTS.map(function(o){ return '<option value="'+o[0]+'">'+o[1]+'</option>'; }).join('')+
      '<option value="x">その他（撮影 fps から計算）</option></select></label>'+
    '<p class="mini" id="shotNote" style="margin-top:6px"></p>'+
    '<p class="mini">※ ここで入れるのは<b>時刻の計算に使う値</b>です。コマの数やコマ送りの動きは動画ファイルで決まっているので、変わりません。</p>'+
    '<div class="row" style="margin-top:12px;justify-content:flex-end">'+
    '<button class="btn pri" id="btnFpsOk">この設定で進む</button></div></div>';
  document.body.appendChild(m);
  var inS=$('inShotFps'), sel=$('selShotSlow'), inP=$('inPlayFps'), note=$('shotNote');
  function P(){ var v=inP? parseFloat(inP.value) : play; return (v>0)? v : play; }
  function setSel(t){
    var hit=null; SLOW_OPTS.forEach(function(o){ if(Math.abs(o[0]-t)/o[0]<0.06) hit=o[0]; });
    sel.value = hit!==null? String(hit) : 'x';
  }
  function showNote(){
    var t=P()/(parseFloat(inS.value)||P());
    note.innerHTML = (Math.abs(t-1)<0.02)
      ? '普通の速さとして計算します（動画の 1 秒 ＝ 実際の 1 秒）。'
      : '動画の 1 秒 ＝ 実際の <b>'+sig(t,3)+' 秒</b>として計算します（'+niceX(1/t)+' 倍のスロー）。';
  }
  /* 入力欄は整数で出す（30.006 → 30）。前に「この設定で進む」を押していれば、そのときの値をそのまま出す */
  inS.value=(e.fpsOk && e.shotFps>0 && Number.isInteger(e.shotFps))? String(e.shotFps) : String(Math.round(play/ts)); setSel(ts); showNote();
  sel.onchange=function(){
    if(sel.value==='x'){ showNote(); return; }
    var v=P()/parseFloat(sel.value);
    if(Math.abs(v-Math.round(v))<0.25) v=Math.round(v);     /* 29.97fps×8 = 239.8 → 240 と見せる */
    inS.value=String(Math.round(v)); showNote();
  };
  inS.oninput=function(){ var v=parseFloat(inS.value); if(v>0){ setSel(P()/v); showNote(); } };
  if(inP) inP.oninput=function(){ var v=parseFloat(inP.value); if(v>0){ inS.value=String(Math.round(v/(parseFloat(sel.value)||1))); showNote(); } };
  $('btnFpsOk').onclick=function(){
    var shot=parseFloat(inS.value), pl=P();
    if(!(shot>0) || shot>2000){ toast('撮影 fps は 1 〜 2000 の数を入れてください'); inS.focus(); return; }
    var t=pl/shot;
    if(!(t>0.01 && t<=1.5)){ toast('撮影 fps が再生 fps より小さすぎます／大きすぎます'); inS.focus(); return; }
    if(t>1) t=1;                        /* 撮影 < 再生 はふつう無いので、普通の速さとする */
    if(sel.value!=='x') t=parseFloat(sel.value);   /* 1/8 などを選んでいれば、その値そのもの */
    m.remove();
    applyFps(pl, t, shot);
  };
  setTimeout(function(){ try{ inS.focus(); inS.select(); }catch(x){} }, 30);
}
function applyFps(play, ts, shot){
  var e=EXP();
  if(!fpsMeasured() && play>0){ VID.fps=play; $('fpsSrc').textContent='（手入力）'; }
  e.video.fps=VID.fps;
  e.tscale=ts; e.shotFps=shot||Math.round(VID.fps/ts); e.fpsOk=true;
  $('inFps').value=nf(VID.fps,3);
  $('selTScale').value=String(ts);
  if(![].some.call($('selTScale').options, function(o){ return o.value===String(ts); })) $('selTScale').value='1';
  updateFpsLine(); afterChange();
  if(!$('mode2').classList.contains('hide')) renderMode2();
  saveLocal();
}
/* 2 のカードの fps の行（短く） */
function updateFpsLine(){
  var e=EXP(), el0=$('fpsLine'); if(!el0) return;
  var ts=(e.tscale>0? e.tscale : 1);
  var src=fpsMeasured()? '実測した時刻から' : ($('fpsSrc').textContent.replace(/[（）]/g,'')||'既定値');
  /* 「撮影 fps」に入れた整数（÷スロー倍率＝再生 fps）を主に出し、実測値は括弧の中に */
  var shown=(e.fpsOk && e.shotFps>0)? Math.round(e.shotFps*ts*1000)/1000 : VID.fps;
  var differs=Math.abs(shown-VID.fps)>1e-6;
  el0.innerHTML='fps <b>'+(Number.isInteger(shown)? shown : nf(shown,3))+'</b>'+
    (differs? '（入力。再生の実測は '+nf(VID.fps,3)+' fps）' : '（'+esc(src)+'）')+'<br>'+
    (ts===1? '普通の速さで撮影' : '<b>'+niceX(1/ts)+' 倍のスロー</b>で撮影（撮影 '+nf(e.shotFps||VID.fps/ts,1)+' fps）')+
    '　<button class="btn sm" id="btnFpsDlg">変更</button>';
  var b=$('btnFpsDlg'); if(b) b.onclick=function(){ askFpsUI(); };
  /* 測れなかった／一部しか測れなかったときだけ、測り直すボタンを出す */
  var row=$('ftRow'); if(row) row.classList.toggle('hide', !(VID.ready && VID.hasRVFC && (!fpsMeasured() || VID.tablePartial)));
}

/* =========================================================
   3 の案内：原点 → 分析する方向の数 → x軸 →（y軸）→ スケール を、
   動画の上の知らせで「はい／いいえ」を聞きながら進める
   ========================================================= */
/* 動画の上に、ボタンつきの知らせを出す（消えない。答えるか、次に進むまで残る） */
function calAsk(html, btns, opt){
  opt=opt||{};
  var m=$('calMsg'); if(!m) return;
  clearTimeout(m.__t);
  m.className='ask'+((btns&&btns.length)||opt.act? ' act' : '');
  var h=html;
  if(btns && btns.length){
    h+='<div class="row">'+btns.map(function(b,i){
      return '<button class="btn '+(b.cls||'ghost')+'" data-ci="'+i+'">'+esc(b.label)+'</button>';
    }).join('')+'</div>';
  }
  m.innerHTML=h;
  if(btns) btns.forEach(function(b,i){
    var el0=m.querySelector('[data-ci="'+i+'"]');
    if(el0) el0.onclick=function(ev){ ev.preventDefault(); ev.stopPropagation(); b.fn(); };
  });
  var vh=$('vhint'); if(vh) vh.classList.add('hide');
  if(opt.after) opt.after(m);
}
function calAskOpen(){ var m=$('calMsg'); return !!(m && !m.classList.contains('hide') && m.classList.contains('ask')); }
/* 左のカードの「↓やり直しはここ」 */
function setCalHint(which){
  UI.calHint=which||null;
  var a=$('coOrigin'), b=$('coAxis'), row=$('calBtnRow');
  if(a) a.classList.toggle('hide', which!=='origin');
  if(b) b.classList.toggle('hide', which!=='axis');
  if(row) row.classList.toggle('calltop', !!which);
}
function calGuide(step){
  var e=EXP();
  if(!VID.ready) return;
  if(step==='originOk'){
    setMode('record');
    calAsk('<span class="q">原点はこの位置でいいですか？</span>', [
      { label:'はい', cls:'pri', fn:function(){
          setCalHint('origin');
          if(e.axisSet && e.mPerPx>0){ calMsg(''); afterChange(); return; }   /* 直しただけ */
          calGuide('dir');
        } },
      { label:'いいえ', fn:function(){
          setCalHint('origin');
          e.originSet=false; setMode('origin'); afterChange();
          calAsk('<span class="q">原点を決めなおしてください</span>'+
            '<span class="mini">「原点」の印をドラッグするか、原点にしたい所をクリックします。</span>', []);
        } }
    ]);
    return;
  }
  if(step==='dir'){
    calAsk('<span class="q">次は分析する方向を選んでください。</span>', [
      { label:'１方向（x軸）のみ', cls:'pri', fn:function(){ setAxisDisp('x'); calGuide('axis'); } },
      { label:'２方向（x軸とy軸）', cls:'pri', fn:function(){ setAxisDisp('xy'); calGuide('axis'); } }
    ]);
    return;
  }
  if(step==='axis'){
    setMode('axis');
    calAsk('<span class="q">x軸の正方向を選んでください</span>'+
      '<span class="mini">動画の上で、原点から見て<b>正の向き</b>になる所をクリックします（水平なら原点の右あたり）。</span>', []);
    return;
  }
  if(step==='yaxis'){
    setMode('record');
    calAsk('<span class="q">y軸はこの方向でいいですか？</span>'+
      '<span class="mini">x軸に直角な向きに、y軸の正の向き（矢印）を出しています。</span>', [
      { label:'この方向でよい', cls:'pri', fn:function(){ calGuide('axisOk'); } },
      { label:'y軸を反転', fn:function(){
          e.yflip=!e.yflip; if($('cbYFlip')) $('cbYFlip').checked=e.yflip;
          afterChange(); drawOverlay(); calGuide('yaxis');
        } }
    ]);
    return;
  }
  if(step==='axisOk'){
    setMode('record');
    var xy=(APP.axisDisp==='xy');
    calAsk('<span class="q">'+(xy? 'x軸・y軸はこの方向でいいですか？' : 'X軸はこの方向でいいですか？')+'</span>', [
      { label:'はい', cls:'pri', fn:function(){
          setCalHint('axis');
          if(e.mPerPx>0 && !UI.calPend){ calMsg(''); afterChange(); return; }   /* 直しただけ */
          calGuide('scale');
        } },
      { label:'いいえ', fn:function(){ setCalHint('axis'); calGuide('axis'); } }
    ]);
    return;
  }
  if(step==='scale' || step==='scaleMini' || step==='scaleBig'){
    if(step==='scaleBig') step='scale';
    /* 1 点目を打ったあとに「もう一度表示」しても、その点は消さない */
    if(step==='scale' && UI.mode!=='scale2'){ UI.scaleP1=null; setMode('scale1'); }
    var v=parseFloat($('inScaleLen').value); if(!(v>0)) v=10;
    var u=$('selScaleUnit').value||'0.01';
    if(step==='scaleMini'){
      /* 最小化：端に薄く、最小限の文だけ。動画のクリックのじゃまをしない */
      calAsk('スケール：<b>'+esc(fmtLen(v*parseFloat(u)))+'</b> の両端を 2 か所クリック', [
        { label:'もう一度表示', fn:function(){ calGuide('scaleBig'); } }
      ]);
      $('calMsg').classList.add('mini');
      return;
    }
    calAsk('<span class="q">スケールを設定してください</span>'+
      '画面内の <input type="number" id="calScaleLen" step="0.1" min="0.0001" value="'+(+v.toFixed(3))+'"> '+
      '<select id="calScaleUnit"><option value="1"'+(u==='1'?' selected':'')+'>m</option>'+
      '<option value="0.01"'+(u==='0.01'?' selected':'')+'>cm</option>'+
      '<option value="0.001"'+(u==='0.001'?' selected':'')+'>mm</option></select> が、'+
      'どこからどこまでかをクリックしてください。'+
      '<span class="mini">ものさし・机の幅・台車の長さなど、長さが分かっている物の両端を 2 か所クリックします。</span>', [
      { label:'この表示を最小化', fn:function(){ calGuide('scaleMini'); } }
    ], { after:function(m){
      var a=m.querySelector('#calScaleLen'), b=m.querySelector('#calScaleUnit');
      function sync(){ var x=parseFloat(a.value); if(x>0){ $('inScaleLen').value=a.value; }
                       $('selScaleUnit').value=b.value; $('inScaleLen').onchange && $('inScaleLen').onchange(); }
      if(a) a.oninput=sync; if(b) b.onchange=sync;
    } });
    return;
  }

  if(step==='scaleOk'){
    setMode('record');
    UI.calPend='scale';
    updateSteps();
    calAsk('<span class="q">スケールはこれでいいですか？</span>'+
      '<span class="mini">'+esc(fmtLen(e.scaleLen||0.1))+' ＝ '+sig((e.mPerPx||0)*1000,3)+' mm/px</span>', [
      { label:'はい', cls:'pri', fn:function(){
          UI.calPend=null; setCalHint(null); calMsg('');
          afterChange(); updateSteps();
          toast('3 が終わりました。4. トラッキングへ');
        } },
      { label:'いいえ', fn:function(){ calGuide('scale'); } }
    ]);
    return;
  }
}


/* =========================================================
   撮影中のガイド（撮影ガイド①）
   ・プレビューの上に、水平の線・中央の十字・三分割の線を重ねる
   ・端末の傾きセンサー（加速度）で、左右の傾き（ロール）と前後の傾き（ピッチ）を測る
     水平から 3° 以上ずれたら線を赤くする。iOS は許可のボタンを押してもらう
   ・センサーの値は画面に出すだけで、どこにも送らない
   ========================================================= */
var CAM_TILT_OK=3;          /* これより小さければ「水平」 */
function camTiltFromGravity(ax, ay, az){
  /* 画面に対する重力の向きから、左右の傾き（ロール）と前後の傾き（ピッチ）を出す。
     端末を横向きに持っているときは、その回転ぶんを引く */
  var ang=(screen.orientation && typeof screen.orientation.angle==='number')? screen.orientation.angle
        : (typeof window.orientation==='number'? window.orientation : 0);
  var roll=Math.atan2(ax, ay)*180/Math.PI - ang;
  while(roll>180) roll-=360; while(roll<=-180) roll+=360;
  var pitch=Math.atan2(az, Math.hypot(ax,ay))*180/Math.PI;   /* 0 = 画面が鉛直（カメラが真横を向く） */
  return { roll:roll, pitch:pitch };
}
function camGuideDraw(cv, tilt){
  var g=cv.getContext('2d'), W=cv.width, H=cv.height;
  g.clearRect(0,0,W,H);
  var ok = tilt? (Math.abs(tilt.roll)<CAM_TILT_OK) : null;
  var col = ok===null? 'rgba(255,255,255,.85)' : (ok? '#3ddc84' : '#ff5a4e');
  /* 三分割 */
  g.strokeStyle='rgba(255,255,255,.35)'; g.lineWidth=1; g.setLineDash([6,6]);
  [1,2].forEach(function(k){
    g.beginPath(); g.moveTo(W*k/3,0); g.lineTo(W*k/3,H); g.stroke();
    g.beginPath(); g.moveTo(0,H*k/3); g.lineTo(W,H*k/3); g.stroke();
  });
  g.setLineDash([]);
  /* 水平の基準線（固定）と、いまの水平（傾きぶん回した線） */
  g.strokeStyle='rgba(255,255,255,.55)'; g.lineWidth=1.5;
  g.beginPath(); g.moveTo(W*0.1,H/2); g.lineTo(W*0.9,H/2); g.stroke();
  g.save(); g.translate(W/2,H/2);
  if(tilt) g.rotate(-tilt.roll*Math.PI/180);
  g.strokeStyle=col; g.lineWidth=3;
  g.beginPath(); g.moveTo(-W*0.36,0); g.lineTo(W*0.36,0); g.stroke();
  g.restore();
  /* 中央の十字 */
  g.strokeStyle=col; g.lineWidth=2;
  g.beginPath(); g.moveTo(W/2-14,H/2); g.lineTo(W/2+14,H/2); g.moveTo(W/2,H/2-14); g.lineTo(W/2,H/2+14); g.stroke();
  /* 前後の傾き（ピッチ）は、右はしの目盛りで */
  if(tilt){
    var pOK=Math.abs(tilt.pitch)<10, x=W-22, y0=H*0.2, y1=H*0.8;
    g.strokeStyle='rgba(255,255,255,.55)'; g.lineWidth=1.5;
    g.beginPath(); g.moveTo(x,y0); g.lineTo(x,y1); g.stroke();
    g.beginPath(); g.moveTo(x-8,H/2); g.lineTo(x+8,H/2); g.stroke();
    var py=H/2 + Math.max(-1,Math.min(1,tilt.pitch/45))*(H*0.3);
    g.fillStyle=pOK? '#3ddc84' : '#ff5a4e';
    g.beginPath(); g.arc(x,py,6,0,Math.PI*2); g.fill();
  }
}
function camGuideStart(m){
  var cv=el('#camGuide',m), vid=el('#camPrev',m), tl=el('#camTilt',m), btn=el('#camSensor',m);
  if(!cv) return null;
  var tilt=null, raf=0, stopped=false, last=0;
  function fit(){
    var r=vid.getBoundingClientRect();
    var w=Math.max(2,Math.round(r.width)), h=Math.max(2,Math.round(r.height||r.width*9/16));
    if(cv.width!==w||cv.height!==h){ cv.width=w; cv.height=h; }
  }
  function loop(){
    if(stopped) return;
    fit(); camGuideDraw(cv, tilt);
    raf=requestAnimationFrame(loop);
  }
  function show(){
    if(!tilt){ tl.textContent='傾きセンサー：未使用'; tl.className='camtilt'; return; }
    var r=tilt.roll, p=tilt.pitch, okR=Math.abs(r)<CAM_TILT_OK, okP=Math.abs(p)<10;
    var t = okR? '水平です' : ('左右に '+Math.abs(r).toFixed(1)+'° かたむいています');
    if(!okP) t += '／カメラが'+(p>0? '上' : '下')+'を向いています（'+Math.abs(p).toFixed(0)+'°）';
    tl.textContent=t; tl.className='camtilt '+((okR&&okP)? 'ok' : 'ng');
  }
  function onMotion(ev){
    var a=ev.accelerationIncludingGravity; if(!a || a.x===null) return;
    var now=Date.now(); if(now-last<80) return; last=now;      /* 表示は 12 回/秒 くらいで十分 */
    var t=camTiltFromGravity(a.x, a.y, a.z);
    /* ぶれを少しならす */
    tilt = tilt? { roll: tilt.roll*0.6+t.roll*0.4, pitch: tilt.pitch*0.6+t.pitch*0.4 } : t;
    show();
  }
  function start(){
    window.addEventListener('devicemotion', onMotion);
    tl.textContent='傾きセンサー：測っています…'; btn.classList.add('hide');
  }
  if(window.DeviceMotionEvent){
    if(typeof DeviceMotionEvent.requestPermission==='function'){
      /* iOS：ユーザーの操作の中で許可を求める必要がある */
      btn.classList.remove('hide');
      btn.onclick=function(){
        DeviceMotionEvent.requestPermission().then(function(st){
          if(st==='granted') start(); else { tl.textContent='傾きセンサー：許可されませんでした'; btn.classList.add('hide'); }
        }).catch(function(){ tl.textContent='傾きセンサー：使えませんでした'; btn.classList.add('hide'); });
      };
    } else start();
  } else tl.textContent='傾きセンサー：この端末では使えません';
  loop();
  return { stop:function(){ stopped=true; cancelAnimationFrame(raf); window.removeEventListener('devicemotion', onMotion); },
           setTilt:function(t){ tilt=t; show(); },      /* テスト用 */
           get:function(){ return tilt; } };
}


/* =========================================================
   ③ 誤差の要因の例：図と、a の出し方 3 とおりの見本グラフ
   （見本は作った数値。同じ「測定データ」から 3 とおりで a を出して比べる）
   ========================================================= */
function errSlopeSvg(){
  /* 点の間隔が短いと、同じクリックのずれでも傾き（v）が大きく変わる、の図 */
  var W=640, H=200;
  function pt(x,y,c){ return '<circle cx="'+x+'" cy="'+y+'" r="5" fill="'+c+'"/>'; }
  function bar(x,y){ return '<line x1="'+x+'" y1="'+(y-14)+'" x2="'+x+'" y2="'+(y+14)+'" stroke="#c0332e" stroke-width="2"/>'+
    '<line x1="'+(x-5)+'" y1="'+(y-14)+'" x2="'+(x+5)+'" y2="'+(y-14)+'" stroke="#c0332e" stroke-width="2"/>'+
    '<line x1="'+(x-5)+'" y1="'+(y+14)+'" x2="'+(x+5)+'" y2="'+(y+14)+'" stroke="#c0332e" stroke-width="2"/>'; }
  var s='<svg viewBox="0 0 '+W+' '+H+'" width="100%" style="max-width:640px">';
  /* 左：近い 2 点 */
  s+='<text x="20" y="22" font-size="13" font-weight="700" fill="#c0332e">点が近い（N が小さい）</text>';
  s+='<line x1="30" y1="160" x2="290" y2="160" stroke="#8a93a0"/><line x1="30" y1="160" x2="30" y2="40" stroke="#8a93a0"/>';
  s+='<text x="280" y="176" font-size="11" fill="#5b6672">t</text><text x="16" y="44" font-size="11" fill="#5b6672">x</text>';
  s+='<line x1="120" y1="126" x2="150" y2="114" stroke="#1663b5" stroke-width="2"/>';
  s+='<line x1="100" y1="120" x2="170" y2="120" stroke="#e8443a" stroke-width="2" stroke-dasharray="5 4"/>';
  s+='<line x1="100" y1="148" x2="170" y2="92" stroke="#e8443a" stroke-width="2" stroke-dasharray="5 4"/>';
  s+=bar(120,126)+bar(150,114)+pt(120,126,'#1663b5')+pt(150,114,'#1663b5');
  s+='<text x="180" y="100" font-size="12" fill="#c0332e">傾き（v）が大きく変わる</text>';
  /* 右：遠い 2 点 */
  s+='<text x="340" y="22" font-size="13" font-weight="700" fill="#0f5c31">点が遠い（N が大きい）</text>';
  s+='<line x1="350" y1="160" x2="620" y2="160" stroke="#8a93a0"/><line x1="350" y1="160" x2="350" y2="40" stroke="#8a93a0"/>';
  s+='<text x="610" y="176" font-size="11" fill="#5b6672">t</text><text x="336" y="44" font-size="11" fill="#5b6672">x</text>';
  s+='<line x1="380" y1="140" x2="590" y2="60" stroke="#1663b5" stroke-width="2"/>';
  s+='<line x1="380" y1="128" x2="590" y2="72" stroke="#1c8f4a" stroke-width="2" stroke-dasharray="5 4"/>';
  s+='<line x1="380" y1="152" x2="590" y2="48" stroke="#1c8f4a" stroke-width="2" stroke-dasharray="5 4"/>';
  s+=bar(380,140)+bar(590,60)+pt(380,140,'#1663b5')+pt(590,60,'#1663b5');
  s+='<text x="440" y="150" font-size="12" fill="#0f5c31">同じずれでも、傾きはほぼ同じ</text>';
  s+='<text x="20" y="194" font-size="11.5" fill="#5b6672">赤い縦棒＝クリックのずれ（同じ大きさ）。破線＝ずれたときの傾きの範囲。</text>';
  return s+'</svg>';
}
/* 見本の「測定データ」：等加速度（a = 2 m/s²）に、1 px ぶんのクリックのずれ（1.5 mm）を足したもの */
function errDemoData(){
  var seed=12345, rnd=function(){ seed=(seed*1103515245+12345)&0x7fffffff; return seed/0x7fffffff; };
  var gauss=function(){ var u=rnd()||1e-9, v=rnd(); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); };
  var dt=1/30, a=2.0, sig=0.0015, n=31, t=[], x=[];
  for(var i=0;i<n;i++){ t.push(i*dt); x.push(0.5*a*t[i]*t[i] + sig*gauss()); }
  return { t:t, x:x, a:a, dt:dt };
}
/* a の出し方 3 とおり */
function errDemoA(d, how){
  var t=d.t, x=d.x, n=t.length, out=[], i;
  if(how==='k1' || how==='k3'){
    var K=(how==='k1')?1:3;
    /* アプリと同じ式：v はとなりの点の差、a は (2K−1)Δt はなれた v の差（K=1：Δt、K=3：5Δt） */
    var v=[], tv=[];
    for(i=0;i+1<n;i++){ v.push((x[i+1]-x[i])/(t[i+1]-t[i])); tv.push((t[i]+t[i+1])/2); }
    for(i=K;i<=v.length-K;i++){ var p1=i-K, p2=i+K-1; if(p2>=v.length) break;
      out.push({x:(tv[p1]+tv[p2])/2, y:(v[p2]-v[p1])/(tv[p2]-tv[p1])}); }
  } else {
    /* v（となりの差）に、前後 5 点の直線をあてはめて傾きを a とする */
    var v1=[], tv1=[];
    for(i=0;i+1<n;i++){ v1.push((x[i+1]-x[i])/(t[i+1]-t[i])); tv1.push((t[i]+t[i+1])/2); }
    for(i=2;i<v1.length-2;i++){
      var sx=0,sy=0,sxx=0,sxy=0,m=5;
      for(var j=i-2;j<=i+2;j++){ sx+=tv1[j]; sy+=v1[j]; sxx+=tv1[j]*tv1[j]; sxy+=tv1[j]*v1[j]; }
      var den=m*sxx-sx*sx;
      out.push({x:tv1[i], y: den? (m*sxy-sx*sy)/den : 0});
    }
  }
  return out;
}
function renderErrSection(){
  var f=$('errFigSlope'), h=$('errCharts');
  if(!f||!h) return;
  if(!f.innerHTML) f.innerHTML=errSlopeSvg();
  if(h.dataset.done) return;
  h.dataset.done='1'; h.innerHTML='';
  var d=errDemoData();
  var defs=[['k1','v の差から計算（時間の幅 Δt）'],['k3','v の差から計算（時間の幅 5Δt）'],['fit','v–t の傾きから計算（5 点）']];
  defs.forEach(function(q){
    var pts=errDemoA(d, q[0]);
    var sd=0; pts.forEach(function(p){ sd+=(p.y-d.a)*(p.y-d.a); }); sd=Math.sqrt(sd/pts.length);
    var wrap=document.createElement('div'); wrap.className='errchart';
    var tt=document.createElement('div'); tt.className='ttl'; tt.textContent=q[1]; wrap.appendChild(tt);
    var cv=document.createElement('canvas'); wrap.appendChild(cv);
    var spec={ title:'', xlab:'t [s]', ylab:'a [m/s²]', xkey:null, key:'errdemo_'+q[0],
      series:[{name:'a（見本）', color:'#e8443a', shape:'dot', line:true, pts:pts}],
      curves:[{color:'#1c8f4a', f:function(){ return d.a; }, x0:0, x1:1, dash:[6,4]}] };
    GV.y[spec.key]={a:-4, b:8};                 /* 3 枚とも同じ縦軸で比べる */
    drawChart(cv, spec, {legend:false, w:320, h:200});
    var cap=document.createElement('p'); cap.className='mini';
    cap.innerHTML='緑の点線＝本当の a（2.0 m/s²）。ばらつき ±<b>'+sig(sd,2)+'</b> m/s²';
    wrap.appendChild(cap);
    h.appendChild(wrap);
  });
}


/* =========================================================
   グラフの軸（目盛り）をクリック → 最小・最大を数で決める（小数 1 桁）
   ========================================================= */
function axisRangePopup(cv, which){
  var g=cv.__geo, spec=cv.__spec; if(!g||!spec) return;
  var isY=(which==='y'), key=isY? spec.key : spec.xkey;
  if(!key){ toast('この軸は数で決められません'); return; }
  var a=isY? g.y0 : g.x0, b=isY? g.y1 : g.x1;
  var lab=isY? (spec.ylab||'縦軸') : (spec.xlab||'横軸');
  var f1=function(v){ return (Math.round(v*10)/10).toFixed(1); };
  popup('<h2>'+(isY?'縦軸':'横軸')+'の範囲：'+esc(lab)+'</h2>'+
    '<div class="row"><label class="f">最小 <input type="number" id="axMin" step="0.1" value="'+f1(a)+'" style="width:110px"></label>'+
    '<label class="f">最大 <input type="number" id="axMax" step="0.1" value="'+f1(b)+'" style="width:110px"></label></div>'+
    '<p class="mini">'+(isY? 'このグラフの縦軸だけを変えます。' : '横軸（t）は同じ段のグラフでいっしょに変わります。')+
    '元にもどすときは［デフォルトに戻す］。</p>'+
    '<div class="row"><button class="btn sm" id="axAuto">デフォルトに戻す</button></div>',
    '適用', function(){
      /* popup は OK を押した時点で箱を消すので、入力欄は先につかんでおいた mi/ma から読む */
      var lo=parseFloat(mi? mi.value : ''), hi=parseFloat(ma? ma.value : '');
      if(!isFinite(lo)||!isFinite(hi)||lo===hi){ toast('最小と最大に、ちがう数を入れてください'); return; }
      if(lo>hi){ var t=lo; lo=hi; hi=t; }
      lo=Math.round(lo*10)/10; hi=Math.round(hi*10)/10;
      (isY? GV.y : GV.x)[key]={a:lo, b:hi};
      redrawAllCharts();
      toast((isY?'縦軸':'横軸')+'を '+f1(lo)+' 〜 '+f1(hi)+' にしました');
    });
  var mi=$('axMin'), ma=$('axMax'), ab=$('axAuto');
  if(mi) setTimeout(function(){ try{ mi.focus(); mi.select(); }catch(e){} }, 30);
  if(ab) ab.onclick=function(){
    delete (isY? GV.y : GV.x)[key];
    redrawAllCharts();
    var m=ab.closest('.modal'); if(m) m.remove();
    toast('この軸をデフォルトにもどしました');
  };
}

/* 運動量の質量欄と ボタンの出し入れ（２物体の運動が ON のときだけ） */
function syncCgMass(){
  var e=EXP();
  if($('cgM1')) $('cgM1').value=e.m1; if($('cgM2')) $('cgM2').value=e.m2; if($('cgM3')) $('cgM3').value=e.m3||0.1;
  if($('labCgM3')) $('labCgM3').classList.toggle('hide', nObj()<3);
}
function updateCgMomentumUI(){
  var two=!!APP.twoObj, c=APP.cg||{};
  var b=$('cgMomentum'); if(b) b.classList.toggle('hide', !(two && nObj()===2));   /* 3 物体では②の「重心の運動量」を使う */
  var usingP=(c.qA==='px'||c.qB==='px'||c.qA==='py'||c.qB==='py');
  var row=$('cgMassRow'); if(row) row.classList.toggle('hide', !(two && usingP));
  if(two && usingP) syncCgMass();
  var n=$('cgMomentumNote'); if(n && !two) n.classList.add('hide');
}
/* ［力学的エネルギーを解析する］は、軸の表示にかかわらずいつでも出す
   （x 軸だけの解析でも、重力の向きを x にすればエネルギーが出せる） */
function updateEnergyBtn(){
  var b=$('btnEnergyOn'); if(!b) return;
  b.classList.remove('hide');
  updateMassRow();
}
