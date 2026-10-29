/* =========================================================
   90_boot.js … 起動
   ========================================================= */
(function boot(){
  /* 課題ファイル書き出し用に、いじる前の HTML を控えておく */
  try{
    var kd=document.getElementById('kadaiData');
    if(kd) kd.remove();                       /* 二重埋め込みを防ぐ */
    ORIGINAL_HTML=document.documentElement.outerHTML;
    if(kd) document.head.appendChild(kd);
  }catch(e){ ORIGINAL_HTML=''; }

  /* 課題ファイルとして開かれたときは、自動保存の置き場所を課題ごとに分ける
     （file:// のページはどれも同じ保存場所を使うので、ふだんの測定や別の課題のデータが混ざらないように） */
  if(window.KADAI){
    var kh=0, ks=(window.KADAI.title||'')+'|'+((window.KADAI.vmeta||window.KADAI.video||{}).name||'')+'|'+(window.KADAI.questions||[]).join('/');
    for(var ki=0; ki<ks.length; ki++){ kh=((kh<<5)-kh+ks.charCodeAt(ki))|0; }
    LSKEY=LSKEY+'-kadai-'+(kh>>>0).toString(36);
  }

  vidInit();
  var hd=document.querySelector('.apphd');
  document.documentElement.style.setProperty('--hdh', (hd?hd.offsetHeight:50)+'px');

  var restored=loadLocal();
  bindUI(); bindCanvas(); bindDrop(); bindSeekMarks(); bindLockedSummaries(); bindDragMsgs();
  addAgainButtons(); bindEditEnd(); buildCG(); bindCG();
  refreshExpUI();
  setMenuPos(APP.menuPos);
  $('btnMenuPos').textContent='メニュー：'+(APP.menuPos==='left'?'左':'上');
  setTwoObj(APP.twoObj, true);
  /* URL で最初から ON にできる：motion-analysis.html?auto=1&multi=1（# でもよい）
     auto … 色マーカーの自動追跡、multi（two でも可）… 複数物体の運動。生徒に配るときに使う */
  try{
    var qsrc=(location.search||'').replace(/^\?/,'')+'&'+(location.hash||'').replace(/^#/,'');
    var qp={}; qsrc.split('&').forEach(function(kv){ var m=kv.split('='); if(m[0]) qp[decodeURIComponent(m[0]).toLowerCase()]=decodeURIComponent(m[1]||'1'); });
    var on=function(v){ return /^(1|on|true|yes)$/i.test(v||''); };
    if(on(qp.multi)||on(qp.two)) setTwoObj(true, true);
    if(on(qp.auto)){ APP.autoTrack=true; $('cbAuto').checked=true; $('autoCard').classList.remove('hide');
      if($('howto4hand')){ $('howto4hand').classList.add('hide'); $('howto4auto').classList.remove('hide'); } }
    APP.urlOpts={ auto:on(qp.auto), multi:on(qp.multi)||on(qp.two) };
  }catch(e){}
  setMode('record');
  applyNarrowLayout();
  /* はじめから「動画と表を並べる」大きさにしておく（あとで大きく変わらないように） */
  setSbs(window.innerWidth>=980);
  m2ModeButtons();
  APP.step=0; updateSteps();
  setBigView(false);                 /* 最大表示は毎回オフから */
  setM2Menu(APP.m2menu!==false); setM3Menu(APP.m3menu!==false);
  setPanelW(APP.panelw||352);
  afterChange();
  if(restored){
    var n=APP.exps.reduce(function(a,e){ return a+e.objs.reduce(function(x,y){return x+y.length;},0); },0);
    if(n>0) toast('前回の測定データを復元しました（動画は読み直してください）');
  }
  /* 画面の小さい端末（スマホ）には、一度だけ知らせる */
  try{
    var sb=$('smallBar');
    if(sb && Math.min(window.innerWidth, window.innerHeight)<=600 && window.innerWidth<=820 &&
       !localStorage.getItem('ma_smallbar_off')){
      sb.classList.remove('hide');
      $('btnSmallBarX').onclick=function(){ sb.classList.add('hide'); try{ localStorage.setItem('ma_smallbar_off','1'); }catch(e){} };
    }
  }catch(e){}
  /* ルーペの案内は、指でさわる端末のときだけ出す（PC では出さない） */
  var touchy = (('ontouchstart' in window) || (navigator.maxTouchPoints>0)) &&
               window.matchMedia && window.matchMedia('(pointer:coarse)').matches;
  $('hintLine').classList.toggle('hide', !touchy);
  if(!VID.hasRVFC){
    $('hintLine').innerHTML='<span class="ng">このブラウザはコマの実測時刻に対応していません。'+
      'Chrome / Edge / Safari で開くと精度が上がります。</span>';
    $('hintLine').classList.remove('hide');
  }

  /* 画面を閉じようとしたら、ひとこと確かめる（記録した点があるときだけ） */
  window.addEventListener('beforeunload', function(ev){
    var n=0;
    try{ n=APP.exps.reduce(function(a,e){ return a+e.objs.reduce(function(x,y){return x+y.length;},0); },0); }catch(e){}
    if(n>0){ ev.preventDefault(); ev.returnValue=''; return ''; }
  });

  /* 課題ファイルとして開かれたとき */
  if(window.KADAI){
    var K=window.KADAI;
    $('btnKadai').classList.add('hide');
    var c=document.createElement('div'); c.className='card op';
    var nK=parseInt(K.nObjs)||1, ms=(K.masses||[]);
    var cond=[];
    if(nK>1) cond.push('物体の数：'+nK+' つ');
    if(ms.length) cond.push('質量：'+ms.map(function(m,i){ return 'm'+'₁₂₃'.charAt(i)+' = '+m+' kg'; }).join('、'));
    if(K.scale && K.scale.mPerPx>0) cond.push('スケール：'+K.scale.px+' px ＝ '+K.scale.cm+' cm（設定ずみ）');
    c.innerHTML='<h3>'+esc(K.title||'課題')+'</h3><ol class="steps">'+
      (K.questions||[]).map(function(q){ return '<li>'+esc(String(q).replace(/^\s*[0-9０-９]+\s*[.．、)）]\s*/,''))+'</li>'; }).join('')+'</ol>'+   /* 「1. 」を書いても番号が二重にならないように */
      (cond.length? '<p class="mini">'+cond.map(esc).join('　／　')+'</p>' : '')+
      '<p class="mini">終わったら「JSON保存」で保存して提出してください。</p>';
    $('side1').insertBefore(c, $('side1').firstChild);
    var eK=EXP(), C=K.cal;
    if(C){
      ['origin','angle','yflip','mPerPx','scaleRef','scaleLen','rangeA','rangeB'].forEach(function(k){
        if(C[k]!==undefined && C[k]!==null) eK[k]=C[k];
      });
      /* 時間範囲・原点・軸が決まっていれば、そのまま 4. トラッキング から始める */
      if(C.t0!==undefined) eK.t0=C.t0;
      if(C.step2ok) eK.step2ok=true;
      if(C.originSet) eK.originSet=true;
      if(C.axisSet) eK.axisSet=true;
      if(C.xflip) eK.xflip=true;
      if(C.crop) eK.crop=C.crop;
      if(C.axisDisp==='x' || C.axisDisp==='xy'){
        APP.axisDisp=C.axisDisp; updateAxisButtons();
        $('labYFlip').classList.toggle('hide', C.axisDisp!=='xy'); applyAxisDisp();
      }
    }
    /* 動画の情報と fps（先生が答えた値）。生徒に fps は聞かない */
    var VM=K.vmeta;
    if(VM){
      if(VM.tscale>0) eK.tscale=VM.tscale;
      if(VM.shotFps>0) eK.shotFps=VM.shotFps;
      eK.fpsOk=true;
    }
    /* 進むフレーム数 N（先生が決めた値。生徒には聞かない） */
    if(K.stepN>0){ $('inStepN').value=K.stepN; eK.nOk=true; }
    UI.calPend=null; APP.editStep=0;
    /* 先生が決めた物体の数・質量・スケール */
    if(ms[0]>0) eK.m1=ms[0]; if(ms[1]>0) eK.m2=ms[1]; if(ms[2]>0) eK.m3=ms[2];
    if(nK>1){ eK.nObjs=Math.min(3,nK); eK.nObjOk=true; setTwoObj(true, true); }
    else { eK.nObjOk=true; setTwoObj(false, true); }
    if(K.scale && K.scale.mPerPx>0){ eK.mPerPx=K.scale.mPerPx; eK.scaleLen=K.scale.cm/100; eK.scaleRef=null; }
    /* 色マーカーの自動追跡（先生が ON／OFF を決める。前の版の課題ファイルでは何もしない） */
    if(K.autoTrack===true || K.autoTrack===false){
      var au=K.autoTrack;
      APP.autoTrack=au; $('cbAuto').checked=au; $('autoCard').classList.toggle('hide', !au);
      if($('howto4hand')){ $('howto4hand').classList.toggle('hide', au); $('howto4auto').classList.toggle('hide', !au); }
    }
    refreshExpUI(); afterChange();
    if(K.video && K.video.data){
      $('vinfo').textContent='課題の動画を読み込んでいます…';
      UI.kadaiPending=true;                 /* 読みこんだ直後に fps・N・物体の数を聞き直さない */
      loadVideoUrl(kadaiVideoUrl(K.video), K.video.name||'課題の動画');
    }
  }
})();
/* 課題に埋め込んだ動画（data:）を blob: にして渡す。
   ファイルを選んだときと同じ読み方になる（data: のままだと、.MOV のように種類が video/quicktime のものを
   Chrome が「再生できない種類」として断るため） */
function kadaiVideoUrl(v){
  var d=v.data||'';
  try{
    var i=d.indexOf(','), meta=d.slice(5, i), mt=meta.split(';')[0].toLowerCase();
    if(!/^video\/(mp4|webm|ogg)$/.test(mt)) mt=/\.webm$/i.test(v.name||'')? 'video/webm' : 'video/mp4';
    var bin=atob(d.slice(i+1)), n=bin.length, u=new Uint8Array(n);
    for(var k=0;k<n;k++) u[k]=bin.charCodeAt(k);
    return URL.createObjectURL(new Blob([u], {type:mt}));
  }catch(e){ return d; }
}
