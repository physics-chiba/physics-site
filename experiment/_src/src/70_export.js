/* =========================================================
   70_export.js … CSV / Excel(.xlsx) / PNG / PDF / JSON / 課題ファイル
   外部ライブラリは使わない（ZIP も PDF も自前で組み立てる）
   ========================================================= */

/* ---------- ダウンロード ---------- */
function dl(blob, name){
  var a=document.createElement('a'), u=URL.createObjectURL(blob);
  a.href=u; a.download=name; document.body.appendChild(a); a.click();
  setTimeout(function(){ URL.revokeObjectURL(u); a.remove(); }, 1500);
}
var saveName='';                    /* 保存するときにつけた名前（この画面のあいだ覚えておく） */
function fnameBase(){
  var e=EXP(), s=(saveName || e.name || '実験').replace(/[\\\/:*?"<>|\s\x00-\x1f]+/g,'_');
  s=s.replace(/^[._]+/,'').replace(/[._]+$/,'');   /* 先頭・末尾の . や _ は落とす */
  if(s.length>40) s=s.slice(0,40);                 /* 長すぎるとパソコンが保存できない */
  if(!s) s='実験';
  var d=new Date(), p=function(n){return String(n).padStart(2,'0');};
  return s+'_'+d.getFullYear()+p(d.getMonth()+1)+p(d.getDate())+'_'+p(d.getHours())+p(d.getMinutes());
}
/* 保存の前に名前をつけてもらう */
function askSaveName(what, go){
  if(window.__noAskName){ go(); return; }        /* テスト用のぬけ道 */
  var def=(saveName || EXP().name || '実験');
  var inp;
  popup('<h2>'+esc(what)+'に名前をつけてください</h2>'+
    '<p class="mini">この名前でファイルに保存します（うしろに日付と時刻がつきます）。</p>'+
    '<input type="text" id="inSaveName" class="namein">',
    '保存する',
    function(){
      var v=(inp && inp.value || '').trim();
      if(v) saveName=v;
      go();
    });
  inp=document.getElementById('inSaveName');
  if(inp){
    inp.value=def;
    inp.addEventListener('keydown', function(ev){
      if(ev.key==='Enter'){
        var m=inp.closest('.modal'); if(m){ var ok=m.querySelector('[data-x="ok"]'); if(ok) ok.click(); }
      }
    });
    setTimeout(function(){ try{ inp.focus(); inp.select(); }catch(e){} }, 30);
  }
}

/* ---------- CSV ---------- */
function csvOf(exp){
  var L=[], i;
  L.push('# 動画解析ツール  CSV');
  L.push('# 実験名,'+q(exp.name));
  L.push('# メモ,'+q(exp.memo));
  L.push('# 動画,'+q(exp.video.name)+',幅,'+exp.video.w+',高さ,'+exp.video.h);
  L.push('# fps(表示用),'+nf(exp.video.fps,4));
  L.push('# スケール[m/px],'+(exp.mPerPx?exp.mPerPx.toPrecision(8):'未設定'));
  L.push('# 原点[px],'+(exp.origin?nf(exp.origin.x,2)+','+nf(exp.origin.y,2):'未設定'));
  L.push('# x軸の角度[deg],'+nf(exp.angle*180/Math.PI,3)+',y反転,'+(exp.yflip?'あり':'なし'));
  L.push('# 時刻の原点[s],'+(exp.t0!==null?nf(exp.t0,5):'動画の先頭'));
  L.push('# 手ぶれ補正,'+(exp.useDrift?'ON（固定点'+exp.ref.length+'個）':'OFF'));
  L.push('# 速さ v は「その行と次の行のあいだ」の平均の速さです（時刻は tv[s] の列）');
  L.push('# 加速度 a は、となりあう2つの v の変わり方（時刻は t[s] の行）。両はしは空欄');
  var objs=[]; for(i=0;i<NOBJ;i++) if(exp.objs[i].length) objs.push(i);
  if(!objs.length) return L.join('\n')+'\n（データなし）\n';
  var ss=objs.map(function(o){ return series(exp,o); });
  var wy=useY();                    /* 「軸の表示」が x軸のみ なら y の列は出さない */
  var idx=useObjIdx(objs);
  var head=['t[s]','tv[s]'];
  objs.forEach(function(o,k){
    var n=(idx?(o+1):'')+(exp.objName[o]?'('+exp.objName[o]+')':'');
    head.push('x'+n+'[m]');
    if(wy) head.push('y'+n+'[m]');
    head.push('vx'+n+'[m/s]');
    if(wy) head.push('vy'+n+'[m/s]');
    var ak=(aStepOf(exp)>1? '('+aStepLabel(exp)+')' : '');
    head.push('ax'+n+'[m/s2]'+ak);
    if(wy) head.push('ay'+n+'[m/s2]'+ak);
  });
  L.push(head.join(','));
  var n0=Math.max.apply(null, ss.map(function(s){return s.length;}));
  for(i=0;i<n0;i++){
    var row=[], t=null, tv=null;
    ss.forEach(function(s){ if(s[i]&&t===null){ t=s[i].t; tv=s[i].tv; } });
    row.push(t===null?'':t.toFixed(6), (tv===null||tv===undefined)?'':tv.toFixed(6));
    ss.forEach(function(s){
      var p=s[i];
      if(!p){ for(var z=0;z<(wy?6:3);z++) row.push(''); return; }
      row.push(fx(p.x)); if(wy) row.push(fx(p.y));
      row.push(fx(p.vx)); if(wy) row.push(fx(p.vy));
      row.push(fx(p.ax)); if(wy) row.push(fx(p.ay));
    });
    L.push(row.join(','));
  }
  return L.join('\n')+'\n';
  function fx(v){ return (v===null||v===undefined||!isFinite(v))?'':v.toPrecision(8).replace(/0+$/,'').replace(/\.$/,''); }
  function q(s){ s=String(s||''); return /[,"\n]/.test(s)? '"'+s.replace(/"/g,'""')+'"' : s; }
}
function exportCsv(){
  var t=csvOf(EXP());
  dl(new Blob(['﻿'+t], {type:'text/csv;charset=utf-8'}), fnameBase()+'.csv');
  toast('CSVを保存しました');
}
function copyCsv(){
  var t=csvOf(EXP());
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(t).then(function(){ toast('クリップボードにコピーしました'); },
      function(){ fallbackCopy(t); });
  } else fallbackCopy(t);
}
function fallbackCopy(t){
  var ta=document.createElement('textarea'); ta.value=t; ta.style.position='fixed'; ta.style.left='-9999px';
  document.body.appendChild(ta); ta.select();
  try{ document.execCommand('copy'); toast('クリップボードにコピーしました'); }
  catch(e){ toast('コピーできませんでした'); }
  ta.remove();
}

/* =========================================================
   ZIP（無圧縮）… xlsx を作るのに使う
   ========================================================= */
var CRCT=(function(){ var t=new Uint32Array(256),c,n,k;
  for(n=0;n<256;n++){ c=n; for(k=0;k<8;k++) c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1); t[n]=c>>>0; } return t; })();
function crc32(u8){ var c=0xFFFFFFFF; for(var i=0;i<u8.length;i++) c=CRCT[(c^u8[i])&0xFF]^(c>>>8); return (c^0xFFFFFFFF)>>>0; }
function utf8(s){ return new TextEncoder().encode(s); }
function zipStore(files){
  var parts=[], central=[], off=0;
  files.forEach(function(f){
    var name=utf8(f.name), data=(f.data instanceof Uint8Array)? f.data : utf8(f.data);
    var crc=crc32(data);
    var lh=new Uint8Array(30+name.length), dv=new DataView(lh.buffer);
    dv.setUint32(0,0x04034b50,true); dv.setUint16(4,20,true); dv.setUint16(6,0x0800,true);
    dv.setUint16(8,0,true); dv.setUint16(10,0,true); dv.setUint16(12,0,true);
    dv.setUint32(14,crc,true); dv.setUint32(18,data.length,true); dv.setUint32(22,data.length,true);
    dv.setUint16(26,name.length,true); dv.setUint16(28,0,true);
    lh.set(name,30);
    parts.push(lh, data);
    var ch=new Uint8Array(46+name.length), cv=new DataView(ch.buffer);
    cv.setUint32(0,0x02014b50,true); cv.setUint16(4,20,true); cv.setUint16(6,20,true);
    cv.setUint16(8,0x0800,true); cv.setUint16(10,0,true); cv.setUint16(12,0,true); cv.setUint16(14,0,true);
    cv.setUint32(16,crc,true); cv.setUint32(20,data.length,true); cv.setUint32(24,data.length,true);
    cv.setUint16(28,name.length,true); cv.setUint16(30,0,true); cv.setUint16(32,0,true);
    cv.setUint16(34,0,true); cv.setUint16(36,0,true); cv.setUint32(38,0,true); cv.setUint32(42,off,true);
    ch.set(name,46);
    central.push(ch);
    off += lh.length + data.length;
  });
  var cdSize=central.reduce(function(a,b){return a+b.length;},0);
  var end=new Uint8Array(22), ev=new DataView(end.buffer);
  ev.setUint32(0,0x06054b50,true); ev.setUint16(8,files.length,true); ev.setUint16(10,files.length,true);
  ev.setUint32(12,cdSize,true); ev.setUint32(16,off,true);
  return new Blob(parts.concat(central).concat([end]), {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}

/* =========================================================
   xlsx（データ＋散布図）
   ========================================================= */
function colName(i){ var s=''; i++; while(i>0){ var m=(i-1)%26; s=String.fromCharCode(65+m)+s; i=Math.floor((i-1)/26); } return s; }
function xesc(s){ return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c];}); }
function sheetXml(rows, hasDrawing){
  var x='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
   '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '+
   'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'+
   '<sheetFormatPr defaultRowHeight="15"/><cols><col min="1" max="30" width="13" customWidth="1"/></cols><sheetData>';
  rows.forEach(function(row,ri){
    x+='<row r="'+(ri+1)+'">';
    row.forEach(function(v,ci){
      if(v===null||v===undefined||v==='') return;
      var ref=colName(ci)+(ri+1);
      if(typeof v==='number' && isFinite(v)) x+='<c r="'+ref+'"><v>'+v+'</v></c>';
      else x+='<c r="'+ref+'" t="inlineStr"><is><t xml:space="preserve">'+xesc(v)+'</t></is></c>';
    });
    x+='</row>';
  });
  x+='</sheetData>';
  if(hasDrawing) x+='<drawing r:id="rId1"/>';
  x+='</worksheet>';
  return x;
}
function chartXml(ch){
  var sh=ch.sheet, n=ch.n;
  var ax1=111111+n*10, ax2=222222+n*10;
  function ref(col, r0, r1){ return xesc(sh)+'!$'+colName(col)+'$'+r0+':$'+colName(col)+'$'+r1; }
  var sers='';
  ch.series.forEach(function(s,i){
    sers+='<c:ser><c:idx val="'+i+'"/><c:order val="'+i+'"/>'+
      '<c:tx><c:v>'+xesc(s.name)+'</c:v></c:tx>'+
      '<c:spPr><a:ln w="19050">'+(s.line?
         '<a:solidFill><a:srgbClr val="'+s.color+'"/></a:solidFill>' : '<a:noFill/>')+'</a:ln></c:spPr>'+
      '<c:marker><c:symbol val="'+(s.symbol||'circle')+'"/><c:size val="5"/>'+
        '<c:spPr><a:solidFill><a:srgbClr val="'+s.color+'"/></a:solidFill>'+
        '<a:ln><a:solidFill><a:srgbClr val="'+s.color+'"/></a:solidFill></a:ln></c:spPr></c:marker>'+
      '<c:xVal><c:numRef><c:f>'+ref(ch.xcol,ch.r0,ch.r1)+'</c:f></c:numRef></c:xVal>'+
      '<c:yVal><c:numRef><c:f>'+ref(s.col,ch.r0,ch.r1)+'</c:f></c:numRef></c:yVal>'+
      '<c:smooth val="0"/></c:ser>';
  });
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
  '<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" '+
   'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '+
   'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'+
   '<c:chart>'+
   '<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>'+xesc(ch.title)+'</a:t></a:r></a:p></c:rich></c:tx>'+
   '<c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/>'+
   '<c:plotArea><c:layout/><c:scatterChart><c:scatterStyle val="lineMarker"/><c:varyColors val="0"/>'+
   sers+
   '<c:axId val="'+ax1+'"/><c:axId val="'+ax2+'"/></c:scatterChart>'+
   '<c:valAx><c:axId val="'+ax1+'"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/>'+
   '<c:axPos val="b"/><c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>'+xesc(ch.xlab)+
   '</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>'+
   '<c:majorTickMark val="out"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>'+
   '<c:crossAx val="'+ax2+'"/><c:crosses val="autoZero"/><c:crossBetween val="midCat"/></c:valAx>'+
   '<c:valAx><c:axId val="'+ax2+'"/><c:scaling><c:orientation val="minMax"/>'+
     ((ch.ymax!==undefined)? '<c:max val="'+ch.ymax+'"/><c:min val="'+ch.ymin+'"/>' : '')+'</c:scaling><c:delete val="0"/>'+
   '<c:axPos val="l"/><c:majorGridlines/><c:title><c:tx><c:rich><a:bodyPr rot="-5400000" vert="horz"/><a:lstStyle/>'+
   '<a:p><a:r><a:t>'+xesc(ch.ylab)+'</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>'+
   '<c:majorTickMark val="out"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>'+
   '<c:crossAx val="'+ax1+'"/><c:crosses val="autoZero"/><c:crossBetween val="midCat"/>'+
     ((ch.yunit>0)? '<c:majorUnit val="'+ch.yunit+'"/>' : '')+'</c:valAx>'+
   '</c:plotArea><c:legend><c:legendPos val="b"/><c:overlay val="0"/></c:legend>'+
   '<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart></c:chartSpace>';
}
function drawingXml(charts, img, imgRel){
  var x='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
   '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" '+
   'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '+
   'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">';
  if(img && imgRel){                     /* ストロボ画像（グラフの下に。列 8 つぶんの幅で、縦横比はそのまま） */
    var c0=img.anchorCol, r0=img.anchorRow, rows=Math.max(4, Math.ceil(8*64*img.h/img.w/20));
    x+='<xdr:twoCellAnchor editAs="oneCell"><xdr:from><xdr:col>'+c0+'</xdr:col><xdr:colOff>0</xdr:colOff>'+
       '<xdr:row>'+r0+'</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>'+
       '<xdr:to><xdr:col>'+(c0+8)+'</xdr:col><xdr:colOff>0</xdr:colOff>'+
       '<xdr:row>'+(r0+rows)+'</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>'+
       '<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="900" name="ストロボ画像"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr>'+
       '<xdr:blipFill><a:blip r:embed="'+imgRel+'"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>'+
       '<xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr>'+
       '</xdr:pic><xdr:clientData/></xdr:twoCellAnchor>';
  }
  charts.forEach(function(ch,i){
    var c0=ch.anchorCol, r0=ch.anchorRow;
    x+='<xdr:twoCellAnchor><xdr:from><xdr:col>'+c0+'</xdr:col><xdr:colOff>0</xdr:colOff>'+
       '<xdr:row>'+r0+'</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>'+
       '<xdr:to><xdr:col>'+(c0+8)+'</xdr:col><xdr:colOff>0</xdr:colOff>'+
       '<xdr:row>'+(r0+18)+'</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>'+
       '<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr>'+
       '<xdr:cNvPr id="'+(i+2)+'" name="Chart '+(i+1)+'"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>'+
       '<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>'+
       '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">'+
       '<c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" r:id="rId'+(i+1)+'"/>'+
       '</a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>';
  });
  return x+'</xdr:wsDr>';
}
function buildXlsx(sheets){
  var files=[], ct='', wbSheets='', wbRels='', ci=0, hasPng=false;
  files.push({name:'_rels/.rels', data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'+
    '</Relationships>'});
  files.push({name:'xl/styles.xml', data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+
    '<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>'+
    '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>'+
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'+
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'+
    '<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>'+
    '</styleSheet>'});
  sheets.forEach(function(sh, si){
    var sn=si+1;
    files.push({name:'xl/worksheets/sheet'+sn+'.xml', data:sheetXml(sh.rows, !!((sh.charts&&sh.charts.length)||sh.image))});
    wbSheets+='<sheet name="'+xesc(sh.name)+'" sheetId="'+sn+'" r:id="rIdS'+sn+'"/>';
    wbRels+='<Relationship Id="rIdS'+sn+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet'+sn+'.xml"/>';
    ct+='<Override PartName="/xl/worksheets/sheet'+sn+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
    if((sh.charts && sh.charts.length) || sh.image){
      var rels='', dn=sn, chs=sh.charts||[], imgRel=null;
      chs.forEach(function(ch){
        ci++;
        ch.n=ci; ch.sheet=sh.name;
        files.push({name:'xl/charts/chart'+ci+'.xml', data:chartXml(ch)});
        ct+='<Override PartName="/xl/charts/chart'+ci+'.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>';
        rels+='<Relationship Id="rId'+(chs.indexOf(ch)+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart'+ci+'.xml"/>';
      });
      if(sh.image){                        /* ストロボ画像（PNG）を xl/media に入れて、図として貼る */
        imgRel='rIdImg'+sn; hasPng=true;
        files.push({name:'xl/media/image'+sn+'.png', data:sh.image.png});
        rels+='<Relationship Id="'+imgRel+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image'+sn+'.png"/>';
      }
      files.push({name:'xl/drawings/drawing'+dn+'.xml', data:drawingXml(chs, sh.image, imgRel)});
      files.push({name:'xl/drawings/_rels/drawing'+dn+'.xml.rels', data:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+rels+'</Relationships>'});
      files.push({name:'xl/worksheets/_rels/sheet'+sn+'.xml.rels', data:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing'+dn+'.xml"/></Relationships>'});
      ct+='<Override PartName="/xl/drawings/drawing'+dn+'.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>';
    }
  });
  files.push({name:'xl/workbook.xml', data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '+
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'+
    '<sheets>'+wbSheets+'</sheets></workbook>'});
  files.push({name:'xl/_rels/workbook.xml.rels', data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+wbRels+
    '<Relationship Id="rIdStyle" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'+
    '</Relationships>'});
  files.unshift({name:'[Content_Types].xml', data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'+
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'+
    '<Default Extension="xml" ContentType="application/xml"/>'+
    (hasPng? '<Default Extension="png" ContentType="image/png"/>' : '')+
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'+
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'+
    ct+'</Types>'});
  return zipStore(files);
}
/* 実験1つぶんのシートを組み立てる */
function sheetForExp(exp, idx){
  var rows=[], objs=[], i;
  for(i=0;i<NOBJ;i++) if(exp.objs[i].length) objs.push(i);
  rows.push(['実験名', exp.name, 'メモ', exp.memo||'']);
  rows.push(['動画', exp.video.name||'', 'fps(表示用)', Number(nf(exp.video.fps,4))]);
  rows.push(['スケール[m/px]', exp.mPerPx||'', 'x軸[deg]', Number(nf(exp.angle*180/Math.PI,3))]);
  var useE=!!APP.energyOn;                 /* 「力学的エネルギーを解析する」を押したときだけ出す */
  if(useE) rows.push(['質量m1[kg]', exp.m1, '質量m2[kg]', exp.m2, '質量m3[kg]', exp.m3||0.1, 'g[m/s2]', exp.g,
                      '重力の向き', gDirInfo(exp).label+'（'+gDirInfo(exp).h+'）']);   /* 質量・g・重力の向き もそのときだけ */
  rows.push([]);
  var wy=useY();                           /* x軸のみのときは y の列とグラフを出さない */
  var QS = wy? ['x','y','vx','vy','ax','ay'] : ['x','vx','ax'];
  if(useE) QS=QS.concat(['K','U','K+U']);
  var idx2=useObjIdx(objs);
  var head=['t[s]','tv[s]'], cols={};
  objs.forEach(function(o){
    QS.forEach(function(q){ cols[q+o]=head.length; head.push(idx2? (q+'_'+(o+1)) : q); });
  });
  rows.push(head);
  var headRow=rows.length;                 /* 1-based のヘッダ行 */
  var ss=objs.map(function(o){ return series(exp,o); });
  var ens=objs.map(function(o,k){ return useE? energy(exp,o,ss[k]) : []; });
  var n0=Math.max.apply(null, ss.map(function(s){return s.length;}).concat([0]));
  for(i=0;i<n0;i++){
    var row=[], t=null, tv=null;
    ss.forEach(function(s){ if(s[i]&&t===null){ t=s[i].t; tv=s[i].tv; } });
    row.push(t===null?'':num(t), (tv===null||tv===undefined)?'':num(tv));
    ss.forEach(function(s,k){
      var p=s[i], e=ens[k][i];
      row.push(p?num(p.x):''); if(wy) row.push(p?num(p.y):'');
      row.push(num(p&&p.vx));  if(wy) row.push(num(p&&p.vy));
      row.push(num(p&&p.ax));  if(wy) row.push(num(p&&p.ay));
      if(useE) row.push(e?num(e.K):'', e?num(e.U):'', e?num(e.E):'');
    });
    rows.push(row);
  }
  /* ②で a を「v–t の傾きから計算」にしているときは、その値の列も足す（グラフ・レポート PDF と同じ a–t にするため）。
     値は v の時刻（tv）の行に入れる。表の ax 列（v の差から計算）はそのまま残す */
  var afCols={};
  if(APP.aFit){
    objs.forEach(function(o,k){
      ['vx'].concat(wy? ['vy'] : []).forEach(function(vk){
        var key=(vk==='vx'?'ax':'ay')+o, mp={};
        aByFit(ss[k], vk).forEach(function(q){ mp[q.x.toFixed(9)]=q.y; });
        afCols[key]=head.length; head.push((vk==='vx'?'ax':'ay')+(idx2? '_'+(o+1) : '')+'(v–tの傾き)');
        for(var rr=headRow; rr<rows.length; rr++){            /* rows[headRow] が 1 行目のデータ（0 始まり） */
          var pp=ss[k][rr-headRow], v=(pp && pp.tv!==null && pp.tv!==undefined)? mp[pp.tv.toFixed(9)] : undefined;
          rows[rr][afCols[key]] = (v===undefined)? '' : num(v);
        }
      });
    });
  }
  /* ③でフィッティングしていれば、「フィッティングの値」と「残差」の列を足す */
  var fitCol=null, resCol=null;
  if(typeof RESID!=='undefined' && RESID.length && idx===APP.cur){
    var R0=RESID[0], fq=(typeof RESID_INFO!=='undefined' && RESID_INFO.q)? RESID_INFO.q : 'x';
    var lo=Math.min.apply(null,R0.xs), hi=Math.max.apply(null,R0.xs);
    var isV=(fq==='vx'||fq==='vy');
    fitCol=head.length; head.push('fit('+fq+')');
    resCol=head.length; head.push('残差('+fq+')');
    for(var rr=headRow; rr<rows.length; rr++){            /* rows[headRow] が 1 行目のデータ（0 始まり。前は 1 行ずれていた） */
      var row2=rows[rr], si=rr-headRow;
      var p2=ss[0]? ss[0][si] : null;
      var xv=p2? (isV? p2.tv : p2.t) : null, yv=p2? p2[fq] : null;
      if(p2 && xv!==null && yv!==null && isFinite(xv) && isFinite(yv) && xv>=lo-1e-9 && xv<=hi+1e-9){
        var fv=R0.f(xv);
        row2[fitCol]=num(fv); row2[resCol]=num(yv-fv);
      } else { row2[fitCol]=''; row2[resCol]=''; }
    }
  }
  var r0=headRow+1, r1=rows.length;
  var charts=[];
  if(n0>1){
    var anchor=head.length+1, chDefs=wy? [
      {t:'x - t', y:'x [m]', q:'x'}, {t:'y - t', y:'y [m]', q:'y'},
      {t:'vx - t', y:'vx [m/s]', q:'v'}, {t:'vy - t', y:'vy [m/s]', q:'vy'},
      {t:'ax - t', y:'ax [m/s2]', q:'a'}, {t:'ay - t', y:'ay [m/s2]', q:'ay'}
    ] : [
      {t:'x - t', y:'x [m]', q:'x'},
      {t:'vx - t', y:'vx [m/s]', q:'v'}, {t:'ax - t', y:'ax [m/s2]', q:'a'}
    ];
    if(useE) objs.forEach(function(o){ chDefs.push({t:'エネルギー - t 物体'+(o+1), y:'E [J]', q:'e', only:o}); });   /* 物体ごとに 1 枚（縦にならぶ） */
    if(fitCol!==null) chDefs.push({t:'フィッティングしたグラフ', y:'値', q:'fit'},
                                  {t:'フィッティング残差', y:'残差', q:'res'});
    chDefs.forEach(function(d,di){
      var sers=[];
      objs.forEach(function(o,k){
        var c=['E8443A','1663B5','1C8F4A'][k%3], c2=['F09A94','7FB2E5','86C7A4'][k%3], c3=['8A241D','0F3F73','0E5A2E'][k%3];
        if(d.q==='x') sers.push({name:'x物体'+(o+1), col:cols['x'+o], color:c, symbol:'circle'});
        else if(d.q==='y') sers.push({name:'y物体'+(o+1), col:cols['y'+o], color:c, symbol:'circle'});
        else if(d.q==='v') sers.push({name:'vx物体'+(o+1), col:cols['vx'+o], color:c, symbol:'circle'});
        else if(d.q==='vy') sers.push({name:'vy物体'+(o+1), col:cols['vy'+o], color:c, symbol:'circle'});
        else if(d.q==='a') sers.push({name:'ax物体'+(o+1)+(APP.aFit?'（v–tの傾き）':''), col:(APP.aFit? afCols['ax'+o] : cols['ax'+o]), color:c, symbol:'circle'});
        else if(d.q==='ay') sers.push({name:'ay物体'+(o+1)+(APP.aFit?'（v–tの傾き）':''), col:(APP.aFit? afCols['ay'+o] : cols['ay'+o]), color:c, symbol:'circle'});
        else if(d.q==='fit'){ if(k===0){
                 var fq2=(typeof RESID_INFO!=='undefined' && RESID_INFO.q)? RESID_INFO.q : 'x';
                 sers.push({name:fq2+'（測った値）', col:cols[fq2+o], color:c, symbol:'circle'});
                 sers.push({name:'フィッティング', col:fitCol, color:'8A241D', symbol:'none', line:true}); } }
        else if(d.q==='res'){ if(k===0)
                 sers.push({name:'残差', col:resCol, color:'0F3F73', symbol:'circle'}); }
        else if(d.only!==undefined && d.only!==o){ }
        else { sers.push({name:'K物体'+(o+1), col:cols['K'+o], color:c, symbol:'circle'});
               sers.push({name:'U物体'+(o+1), col:cols['U'+o], color:c2, symbol:'square'});
               sers.push({name:'K+U物体'+(o+1), col:cols['K+U'+o], color:c3, symbol:'triangle'}); }
      });
      var ch={title:d.t+'（'+exp.name+'）', xlab:'t [s]', ylab:d.y,
                   xcol:((d.q==='v'||d.q==='vy'||(APP.aFit && (d.q==='a'||d.q==='ay'))||((d.q==='fit'||d.q==='res') &&
                          typeof RESID_INFO!=='undefined' &&
                          (RESID_INFO.q==='vx'||RESID_INFO.q==='vy')))?1:0), r0:r0, r1:r1,   /* 速さ（と v–t の傾きの a）は tv[s] を横軸に */
                   series:sers, anchorCol:anchor, anchorRow:di*19};
      /* 縦軸の範囲は、画面・レポートのグラフと同じ決め方（0 をふくむ、きりのよい数まで）にする。
         Excel におまかせすると、データだけに寄せて拡大するので、a–t のばらつきが大きく見えてしまう */
      var yr=xlsxYRange(rows, r0, r1, sers.map(function(q){ return q.col; }));
      if(yr){ ch.ymin=yr[0]; ch.ymax=yr[1]; ch.yunit=xlsxUnit(yr[0], yr[1]); }
      charts.push(ch);
    });
  }
  return { name:'Data'+(idx+1), rows:rows, charts:charts };
  function num(v){ if(v===null||v===undefined||!isFinite(v)) return ''; return Math.round(v*1e8)/1e8; }
}
/* Excel のグラフの縦軸の範囲：drawChart と同じく zeroRange（0 をふくむ、1・2・5×10ⁿ のきりのよい数まで） */
function xlsxYRange(rows, r0, r1, cols){
  var lo=Infinity, hi=-Infinity;
  for(var r=r0; r<=r1; r++){
    var row=rows[r-1]; if(!row) continue;
    cols.forEach(function(c){ var v=row[c]; if(typeof v==='number' && isFinite(v)){ if(v<lo) lo=v; if(v>hi) hi=v; } });
  }
  if(!isFinite(lo) || !isFinite(hi)) return null;
  return zeroRange(lo, hi);
}
/* 目盛りの間隔：Excel は最小値から目盛りを刻むので、最小・最大の両方を割り切れる間隔にする（-0.5〜0.5 なら 0.1） */
function xlsxUnit(a, b){
  var u=niceStep(b-a,5);
  var fits=function(v,q){ var r=v/q; return Math.abs(r-Math.round(r))<1e-6; };
  for(var k=0;k<4;k++){ if(fits(a,u)&&fits(b,u)) return u; u=[u/2,u/2.5,u/2][k%3]; }
  return niceStep(b-a,10);
}
function exportXlsx(){
  var ids = selectedExps('expChecks');           /* ②の「対象の実験」でチェックした実験（無ければいまの実験） */
  ids.sort(function(a,b){return a-b;});
  var sheets=ids.map(function(i){ return sheetForExp(APP.exps[i], i); });
  if(!sheets.length){ toast('データがありません'); return; }
  function finish(){
    var blob=buildXlsx(sheets);
    dl(blob, fnameBase()+'.xlsx');
    toast('Excelファイルを保存しました');
  }
  /* ストロボ画像（「作成しますか？」で はい）：いまの実験のシートの、グラフの下に貼る */
  var stro=$('cvStrobe'), cur=sheets[ids.indexOf(APP.cur)];
  if(UI.stroReady && stro && stro.width>2 && UI.attachStro!==false && cur && stro.toBlob){
    stro.toBlob(function(b){
      if(!b){ finish(); return; }
      var fr=new FileReader();
      fr.onload=function(){
        var nCh=(cur.charts||[]).length, anchorCol=(cur.charts&&cur.charts[0])? cur.charts[0].anchorCol : (cur.rows[cur.rows.length-1]||[]).length+1;
        cur.image={ png:new Uint8Array(fr.result), w:stro.width, h:stro.height, anchorCol:anchorCol, anchorRow:nCh*19+1 };
        finish();
      };
      fr.onerror=function(){ finish(); };
      fr.readAsArrayBuffer(b);
    }, 'image/png');
    return;
  }
  finish();
}

/* =========================================================
   レポート（PNG / PDF）
   ========================================================= */
/* レポートは A4 たて（1240×1754）を1ページとして、入らなければページを足す */
function buildReportPages(){
  var W=1240, H=1754, M=50;
  var pages=[], g=null, y=0, exp=EXP();
  function newPage(){
    var cv=document.createElement('canvas'); cv.width=W; cv.height=H;
    g=cv.getContext('2d'); g.fillStyle='#fff'; g.fillRect(0,0,W,H);
    pages.push(cv); y=60;
    if(pages.length>1){
      g.fillStyle='#8a95a1'; g.font='13px '+FONT;
      g.fillText('動画解析レポート：'+exp.name+'（つづき）', M, 40);
      y=72;
    }
    return g;
  }
  function need(h){ if(y+h > H-70) newPage(); }
  function head(t){
    need(46);
    g.fillStyle='#0f4c8f'; g.font='bold 17px '+FONT; g.fillText(t, M, y+14); y+=26;
  }
  newPage();
  /* ---- 見出しと条件 ---- */
  g.fillStyle='#0f4c8f'; g.font='bold 30px '+FONT;
  g.fillText('動画解析レポート：'+exp.name, M, 58);
  g.fillStyle='#5b6672'; g.font='15px '+FONT;
  var d=new Date();
  g.fillText(d.getFullYear()+'/'+(d.getMonth()+1)+'/'+d.getDate()+'  '+(exp.memo||''), M, 86);
  g.strokeStyle='#1663b5'; g.lineWidth=2; g.beginPath(); g.moveTo(M,98); g.lineTo(W-M,98); g.stroke();
  g.fillStyle='#1b1f24'; g.font='14px '+FONT;
  [
    '動画：'+(exp.video.name||'-')+'（'+exp.video.w+'×'+exp.video.h+'）  fps(表示用) '+nf(exp.video.fps,3),
    'スケール：'+(exp.mPerPx? sig(exp.mPerPx*1000,4)+' mm/px' : '未設定')+
      '　x軸：'+nf(exp.angle*180/Math.PI,1)+'°'+(exp.yflip?'（y反転）':'')+
      '　時刻の原点：'+(exp.t0!==null? nf(exp.t0,3)+' s':'動画の先頭'),
    '手ぶれ補正：'+(exp.useDrift?'ON':'OFF')+'　記録点：'+
      exp.objs.map(function(a,i){return '物体'+(i+1)+' '+a.length;}).join(' / ')+
      '　軸の表示：'+(useY()? 'x軸とy軸' : 'x軸のみ'),
    '撮影の条件：'+((typeof diagLine==='function')? diagLine() : '-')
  ].forEach(function(t,i){ g.fillText(t, M, 124+i*22); });
  y=228;
  /* ---- グラフ：左に x 方向をたてに、右に y 方向をたてに。複数物体は物体ごとに段を分ける ---- */
  var wy=useY();
  var cw=(W-2*M-20)/2;
  var chh=Math.round(cw*0.53);
  var colX=['x','v','a'], colY=['y','vy','ay'];
  var robjs=[]; for(var ro=0;ro<NOBJ;ro++) if(exp.objs[ro] && exp.objs[ro].length) robjs.push(ro);
  if(!robjs.length) robjs=[0];
  need(46+chh+14);
  head('グラフ');
  robjs.forEach(function(ob){
    if(robjs.length>1){                                   /* 物体ごとの見出し */
      need(30+chh+14);
      g.fillStyle='#1b1f24'; g.font='bold 15px '+FONT;
      g.fillText('物体'+(ob+1)+(exp.objName[ob]? '（'+exp.objName[ob]+'）' : ''), M, y+12); y+=24;
    }
    if(!wy && robjs.length>1){                            /* x 軸のみ ＋ 複数物体：1 物体 ＝ 1 段（x–t・vx–t・ax–t を横に） */
      var cw3=Math.round((W-2*M-2*16)/3), ch3=Math.round(cw3*0.62);
      need(ch3+14);
      colX.forEach(function(kx3,c3){
        var t3={x:'x–t', v:'vx–t', a:'ax–t'}[kx3], y3={x:'x [m]', v:'vx [m/s]', a:'ax [m/s²]'}[kx3];
        drawInto(g, M+c3*(cw3+16), y, cw3, ch3, {title:t3, xlab:'t [s]', ylab:y3, series:seriesFor(exp,kx3,APP.cur,false,true,ob)});
      });
      y+=ch3+12;
      return;
    }
    for(var r=0;r<3;r++){
      need(chh+14);
      var kx=colX[r];
      /* 左の列は x 方向だけ（前は v–t・a–t に vy・ay も重なって描かれていた） */
      var tX={x:'x–t', v:'vx–t', a:'ax–t'}[kx], yX={x:'x [m]', v:'vx [m/s]', a:'ax [m/s²]'}[kx];
      drawInto(g, M, y, cw, chh, {title:tX, xlab:'t [s]', ylab:yX,
        series:seriesFor(exp,kx,APP.cur,false,true,ob)});
      if(wy){
        var ky=colY[r];
        var spec = (ky==='y')? {title:KINDLAB.y, xlab:'t [s]', ylab:KINDY.y, series:seriesFor(exp,'y',APP.cur,false,false,ob)}
                             : ySpecOf(exp, ky, ob);
        drawInto(g, M+cw+20, y, cw, chh, spec);
      }
      y+=chh+12;
    }
  });
  /* ---- フィッティングの結果・グラフ・残差 ---- */
  var box=$('fitResult');
  var hasFit = (typeof RESID!=='undefined') && RESID.length;
  if(hasFit && box){
    g.font='14px '+FONT;
    /* .fitone の中は <br> で行が分かれている。ボタンの説明文は入れない */
    var lines=[];
    [].forEach.call(box.querySelectorAll('.fitone'), function(d){
      d.innerHTML.split(/<br\s*\/?>/i).forEach(function(h){
        var tmp=document.createElement('div'); tmp.innerHTML=h;
        var s=tmp.textContent.replace(/\s+/g,' ').trim();
        if(s) lines.push(s);
      });
    });
    need(46+lines.length*20+16);
    head('解析（フィッティング）');
    g.fillStyle='#1b1f24'; g.font='14px '+FONT;
    y+=4;
    lines.forEach(function(s){ y=wrapText(g, s, M, y+20, W-2*M, 20); });
    y+=16;
  }
  if(hasFit){
    /* 画面のグラフをそのまま写すと、青いドラッグ帯まで入ってしまう。
       フィッティングに使った点と、フィッティングの式のグラフを、あらためて描き直す。 */
    var fw=(W-2*M-20)/2, fh=Math.round(fw*0.55);
    var q=(typeof RESID_INFO!=='undefined' && RESID_INFO.q)? RESID_INFO.q : 'x';
    var qlab=(typeof QDEF!=='undefined' && QDEF[q])? QDEF[q].lab : q;
    var fser=[], fcur=[];
    RESID.forEach(function(r, i){
      var pts=[];
      for(var k=0;k<r.xs.length;k++) pts.push({x:r.xs[k], y:r.ys[k]});
      fser.push({name:r.name, color:r.color, shape:['dot','sq','tri'][i%3], line:false, pts:pts});
      fcur.push({color:['#e8443a','#2e8b57','#8a5cd6'][i%3], f:r.f,
                 x0:Math.min.apply(null,r.xs), x1:Math.max.apply(null,r.xs)});
    });
    var fitSpec={ title:'フィッティングしたグラフ', xlab:'t [s]', ylab:qlab,
                  series:fser, curves:fcur };
    var rs=(typeof residSpec==='function')? residSpec() : null;
    if(rs) rs.title='フィッティング残差（測った値 − フィッティングの値）';
    need(46+fh+30);            /* 見出しだけ前のページに残さない */
    head('フィッティングしたグラフと、フィッティング残差');
    drawInto(g, M, y, fw, fh, fitSpec);
    if(rs){
      drawInto(g, M+fw+20, y, fw, fh, rs);
      var sd=(typeof residSd==='function')? residSd() : null;
      if(sd!==null){
        g.fillStyle='#5b6672'; g.font='12px '+FONT;
        g.fillText('残差の大きさ（RMS）＝ '+sig(sd,3), M+fw+20, y+fh+16);
      }
    }
    g.fillStyle='#5b6672'; g.font='12px '+FONT;
    g.fillText('点＝測った値、線＝フィッティングの式', M, y+fh+16);
    y+=fh+34;
  }
  /* ---- 測定した値 ---- */
  need(200);
  drawReportTable(g, exp, M, y, W-2*M, H-70-y);
  /* ---- ストロボ画像：最後のページに大きく（「ストロボ写真を作成しますか？」で はい のとき） ---- */
  var stro=$('cvStrobe');
  if(UI.stroReady && stro.width>2 && UI.attachStro!==false){
    newPage();
    head('ストロボ画像'+(typeof stroStepVal==='function'? '（'+stroStepVal()+' コマおき）' : ''));
    var sw=W-2*M, sh=sw*stro.height/stro.width, capH=H-y-90;
    if(sh>capH){ sh=capH; sw=sh*stro.width/stro.height; }
    var sx0=M+((W-2*M)-sw)/2;
    g.drawImage(stro, sx0, y+6, sw, sh);
    g.strokeStyle='#d9dee4'; g.lineWidth=1; g.strokeRect(sx0,y+6,sw,sh);
    y+=sh+22;
  }
  pages.forEach(function(cv,i){
    var gg=cv.getContext('2d');
    gg.fillStyle='#8a95a1'; gg.font='12px '+FONT;
    gg.fillText('動画解析ツール（単一HTML・オフライン）', M, H-30);
    if(pages.length>1) gg.fillText((i+1)+' / '+pages.length, W-M-40, H-30);
  });
  return pages;

  function drawInto(gg, X, Y, w, h, spec){
    var tmp=document.createElement('canvas');
    drawChart(tmp, spec, {w:w, h:h, legend:true});
    gg.drawImage(tmp, X, Y, w, h);
    gg.strokeStyle='#d9dee4'; gg.lineWidth=1; gg.strokeRect(X,Y,w,h);
  }
  /* vy・ay だけのグラフ（右の列） */
  function ySpecOf(e, kind, onlyObj){
    var out=[], shapes=['dot','sq','tri'];
    for(var ob=0; ob<NOBJ; ob++){
      if(!expHasObj(e,ob)) continue;
      if(onlyObj!==undefined && ob!==onlyObj) continue;
      var s=series(e,ob), base=OBJCOL[ob];
      var nm=(APP.twoObj? ('物体'+(ob+1)) : (e.objName[ob]||'物体'));
      if(kind==='vy') out.push({name:nm+' vy', color:base, shape:shapes[ob],
        pts:s.filter(function(p){return p.vy!==null;}).map(function(p){return {x:p.t,y:p.vy};})});
      else out.push({name:nm+' ay', color:base, shape:shapes[ob],
        pts: APP.aFit? aByFit(s,'vy')
           : s.filter(function(p){return p.ay!==null;}).map(function(p){return {x:p.t,y:p.ay};})});
    }
    return { title:(kind==='vy'?'vy – t':'ay – t'), xlab:'t [s]',
             ylab:(kind==='vy'?'vy [m/s]':'ay [m/s²]'), series:out };
  }
}
/* 1ページだけほしいとき（古い呼び出し用） */
function buildReportCanvas(){ return buildReportPages()[0]; }
function wrapText(g, text, x, y, maxW, lh){
  var words=text.split(''), line='', yy=y;
  for(var i=0;i<words.length;i++){
    var test=line+words[i];
    if(g.measureText(test).width>maxW){ g.fillText(line,x,yy); line=words[i]; yy+=lh; if(yy>1700) return yy; }
    else line=test;
  }
  g.fillText(line,x,yy);
  return yy;
}
/* レポートの下半分に、測定した値の表を入れる（入るぶんだけ） */
function drawReportTable(g, exp, x, y, w, h){
  var objs=[], i;
  for(i=0;i<NOBJ;i++) if(exp.objs[i].length) objs.push(i);
  if(!objs.length || h<80) return;
  var ss=objs.map(function(o){ return series(exp,o); });
  var wy=useY(), idx=useObjIdx(objs);
  var head=['t [s]'];
  objs.forEach(function(o){ var n=idx?(o+1):'';
    head.push('x'+n+' [m]');
    if(wy) head.push('y'+n+' [m]');
    head.push('vx'+n); if(wy) head.push('vy'+n); });
  var rowH=17, maxRows=Math.floor((h-30)/rowH);
  var n0=Math.max.apply(null, ss.map(function(s){return s.length;}));
  var cols=(n0>maxRows && head.length<=5)?2:1;         /* 多いときは2段組 */
  var perCol=Math.ceil(Math.min(n0, maxRows*cols)/cols);
  g.fillStyle='#0f4c8f'; g.font='bold 17px '+FONT;
  g.fillText('測定した値'+(n0>maxRows*cols? '（はじめの '+(maxRows*cols)+' 点）':''), x, y);
  var top=y+14, cw=(w-20)/cols;
  for(var c=0;c<cols;c++){
    var X=x+c*(cw+20);
    g.font='bold 11px '+FONT; g.fillStyle='#39434e';
    var colW=cw/head.length;
    head.forEach(function(t,k){ g.fillText(t, X+k*colW, top+12); });
    g.strokeStyle='#c9d2dc'; g.lineWidth=1;
    g.beginPath(); g.moveTo(X,top+16); g.lineTo(X+cw,top+16); g.stroke();
    g.font='11px '+FONT; g.fillStyle='#1b1f24';
    for(var r=0;r<perCol;r++){
      var idx=c*perCol+r; if(idx>=n0) break;
      var yy=top+16+(r+1)*rowH;
      var vals=[]; var t=null;
      ss.forEach(function(s){ if(s[idx]&&t===null) t=s[idx].t; });
      vals.push(t===null?'':nf(t,3));
      ss.forEach(function(s){ var p=s[idx];
        vals.push(p?nf(p.x,4):'');
        if(wy) vals.push(p?nf(p.y,4):'');
        vals.push((p&&p.vx!==null)?nf(p.vx,3):'');
        if(wy) vals.push((p&&p.vy!==null)?nf(p.vy,3):''); });
      vals.forEach(function(v,k){ g.fillText(v, X+k*colW, yy); });
    }
  }
}
function exportReportPng(){
  var pages=buildReportPages();
  if(pages.length===1){
    pages[0].toBlob(function(b){ dl(b, fnameBase()+'_report.png'); toast('レポート（PNG）を保存しました'); }, 'image/png');
    return;
  }
  /* 2ページ以上のときは、たてにつないで1枚の PNG にする */
  var W=pages[0].width, H=pages[0].height;
  var cv=document.createElement('canvas'); cv.width=W; cv.height=H*pages.length;
  var g=cv.getContext('2d'); g.fillStyle='#fff'; g.fillRect(0,0,cv.width,cv.height);
  pages.forEach(function(p2,i){ g.drawImage(p2, 0, i*H);
    if(i){ g.strokeStyle='#c9d2dc'; g.lineWidth=2; g.beginPath(); g.moveTo(0,i*H); g.lineTo(W,i*H); g.stroke(); } });
  cv.toBlob(function(b){ dl(b, fnameBase()+'_report.png'); toast('レポート（PNG）を保存しました'); }, 'image/png');
}
/* --- 最小構成の PDF（1ページに JPEG を1枚。ページ数ぶん並べる） --- */
function exportReportPdf(){
  var pages=buildReportPages();
  var pw=595.28, ph=841.89;                       /* A4 pt */
  var imgs=pages.map(function(cv){
    var jpg=cv.toDataURL('image/jpeg', 0.88);
    var bin=atob(jpg.split(',')[1]);
    var u=new Uint8Array(bin.length);
    for(var i=0;i<bin.length;i++) u[i]=bin.charCodeAt(i);
    return { data:u, w:cv.width, h:cv.height };
  });
  var N=imgs.length;
  var chunks=[], offs=[], pos=0;
  function push(str){ var u=(typeof str==='string')? utf8(str) : str; chunks.push(u); pos+=u.length; }
  push('%PDF-1.4\n');
  function obj(n, body, stream){
    offs[n]=pos;
    push(n+' 0 obj\n'+body+'\n');
    if(stream){ push('stream\n'); push(stream); push('\nendstream\n'); }
    push('endobj\n');
  }
  /* 1:Catalog 2:Pages 3..: ページごとに Page / Image / Contents の3つ */
  var kids=[];
  for(var k=0;k<N;k++) kids.push((3+k*3)+' 0 R');
  obj(1,'<< /Type /Catalog /Pages 2 0 R >>');
  obj(2,'<< /Type /Pages /Kids ['+kids.join(' ')+'] /Count '+N+' >>');
  imgs.forEach(function(im,k){
    var pn=3+k*3, inum=pn+1, cnum=pn+2;
    var sc=Math.min(pw/im.w, ph/im.h);
    var w=im.w*sc, h=im.h*sc, ox=(pw-w)/2, oy=(ph-h)/2;
    obj(pn,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+pw.toFixed(2)+' '+ph.toFixed(2)+
        '] /Resources << /XObject << /Im0 '+inum+' 0 R >> >> /Contents '+cnum+' 0 R >>');
    obj(inum,'<< /Type /XObject /Subtype /Image /Width '+im.w+' /Height '+im.h+
        ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+im.data.length+' >>', im.data);
    var cont='q\n'+w.toFixed(2)+' 0 0 '+h.toFixed(2)+' '+ox.toFixed(2)+' '+oy.toFixed(2)+' cm\n/Im0 Do\nQ\n';
    obj(cnum,'<< /Length '+cont.length+' >>', cont);
  });
  var last=2+N*3;
  var xref=pos;
  var x='xref\n0 '+(last+1)+'\n0000000000 65535 f \n';
  for(var n=1;n<=last;n++) x+=String(offs[n]).padStart(10,'0')+' 00000 n \n';
  x+='trailer\n<< /Size '+(last+1)+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n';
  push(x);
  dl(new Blob(chunks,{type:'application/pdf'}), fnameBase()+'_report.pdf');
  toast('レポート（PDF）を保存しました'+(N>1? '（'+N+'ページ）':''));
}
function exportGraphsPng(){
  var cards=els('#charts2 .chartcard canvas');
  /* ③でフィッティングしていれば、フィッティングしたグラフと残差のプロットも一緒に出す */
  els('#charts3 .chartcard canvas').forEach(function(c){ cards.push(c); });
  var w=640, h=400;
  var extra=[];
  if(typeof residSpec==='function'){
    var rs=residSpec();
    if(rs){ var tmp=document.createElement('canvas');
            drawChart(tmp, rs, {w:w, h:h, legend:true, fixed:true}); extra.push(tmp); }
  }
  var all=cards.concat(extra);
  if(!all.length){ toast('グラフがありません'); return; }
  var cols=Math.min(2,all.length), rows=Math.ceil(all.length/cols);
  var cv=document.createElement('canvas');
  cv.width=w*cols; cv.height=h*rows;
  var g=cv.getContext('2d'); g.fillStyle='#fff'; g.fillRect(0,0,cv.width,cv.height);
  all.forEach(function(c,i){ g.drawImage(c, (i%cols)*w, Math.floor(i/cols)*h, w, h); });
  cv.toBlob(function(b){ dl(b, fnameBase()+'_graphs.png'); toast('グラフを保存しました'); },'image/png');
}
function saveStrobePng(){
  var cv=$('cvStrobe');
  if(!UI.stroReady){ toast('先にストロボ画像を作ってください'); return; }
  cv.toBlob(function(b){ dl(b, fnameBase()+'_strobe.png'); toast('ストロボ画像を保存しました'); },'image/png');
}

/* =========================================================
   JSON 保存・読み込み
   ========================================================= */
function exportJson(){
  var st=packState(); st.app='motion-analysis'; st.saved=new Date().toISOString();
  dl(new Blob([JSON.stringify(st,null,1)],{type:'application/json'}), fnameBase()+'.json');
  toast('JSONで保存しました（動画は含みません）');
}
/* 過去の測定データを、いまの実験を消さずに「次の実験番号」から足す */
function importJson(file){
  var fr=new FileReader();
  fr.onload=function(){
    try{
      var st=JSON.parse(fr.result);
      if(!st||!st.exps||!st.exps.length) throw new Error('形式が違います');
      var first=APP.exps.length+1, added=0;
      st.exps.forEach(function(e){
        if(APP.exps.length>=MAXEXP) return;
        APP.exps.push(normExp(e)); added++;
      });
      if(!added) throw new Error('実験は'+MAXEXP+'個までです');
      APP.cur=APP.exps.length-added;                 /* 足した最初の実験に切りかえる */
      UI.undo=[]; UI.lastPt=null; clearStrobe();
      refreshExpUI(); afterChange();
      toast('過去の測定データを実験'+first+(added>1?'〜'+(first+added-1):'')+'に登録しました');
    }catch(e){ alert('読み込めませんでした：'+e.message); }
  };
  fr.readAsText(file);
}

/* =========================================================
   課題ファイルの書き出し（先生用）
   ========================================================= */
function openKadaiDialog(){
  var box=$('kadaiBox'), e=EXP();
  var curN=parseInt($('inStepN').value)||5, dt=frameDt();
  var nOpts=[1,2,3,4,5,6,8,10,15,20].map(function(n){
    return '<option value="'+n+'"'+(n===curN?' selected':'')+'>'+n+' コマ'+(VID.ready? '（'+nf(n*dt,3)+' s）':'')+'</option>'; }).join('');
  var mb=KADAI_SRC.size? Math.round(KADAI_SRC.size/1048576*10)/10+' MB' : '未読込';
  box.innerHTML=
   '<button class="btn sm cls" id="kdClose">閉じる</button>'+
   '<h2>課題ファイルを書き出す（先生用）</h2>'+
   '<p class="mini">いま読み込んでいる動画と、ここまでの設定（時間範囲・原点・軸・スケール）、設問を 1 つの HTML に埋め込みます。生徒はそのファイルを開くだけで、動画つきで始められます。</p>'+
   '<label class="f" style="display:block;margin:.6em 0">課題の題名<br><input type="text" id="kdTitle" style="width:100%" value="課題：運動の解析"></label>'+
   '<label class="f" style="display:block;margin:.6em 0">設問（1行に1問）<br>'+
   '<textarea id="kdQ" rows="5" style="width:100%">1. 台車の x–t グラフをかき、どんな運動か説明しなさい。\n2. v–t グラフの傾きは何を表しますか。\n3. 直線でフィッティングしたときの係数 a の意味を答えなさい。</textarea></label>'+
   '<div class="row"><label class="cb"><input type="checkbox" id="kdVideo" checked>動画を埋め込む（'+mb+'）</label>'+
   '<label class="cb"><input type="checkbox" id="kdCal" checked>時間範囲・原点・軸・スケールの設定も入れる</label></div>'+
   '<div class="kdstat" id="kdStat"></div>'+
   '<div class="kdwarn hide" id="kdHevc"></div>'+
   '<div class="kdset">'+
   '<div class="row" style="margin-top:8px"><b style="color:var(--accent-d)">色マーカーの自動追跡</b>'+
   '<select id="kdAuto"><option value="1"'+(APP.autoTrack?' selected':'')+'>ON（［色で自動追跡］を「おすすめ」で出す）</option>'+
   '<option value="0"'+(APP.autoTrack?'':' selected')+'>OFF（手でクリックして記録だけ）</option></select>'+
   '<span class="mini">生徒の画面の右上のチェックが、この状態で始まります</span></div>'+
   '<div class="row" style="margin-top:6px"><b style="color:var(--accent-d)">進むフレーム数 N</b>'+
   '<select id="kdN">'+nOpts+'</select>'+
   '<span class="mini">1 クリックで進むコマ数。生徒には聞きません（あとから生徒が 4 のカードで変えることはできます）</span></div>'+
   '<div class="row" style="margin-top:6px"><b style="color:var(--accent-d)">物体の数</b>'+
   '<select id="kdNObj"><option value="1"'+(nObj()===1?' selected':'')+'>1 つ</option><option value="2"'+(nObj()===2?' selected':'')+'>2 つ</option><option value="3"'+(nObj()===3?' selected':'')+'>3 つ</option></select>'+
   '<span class="mini">2 つ以上なら、生徒の画面で「複数物体の運動」が ON になり、物体の数は聞きません</span></div>'+
   '<div class="row" style="margin-top:6px"><b style="color:var(--accent-d)">質量</b>'+
   '<label class="f">m₁ <input type="number" id="kdM1" value="'+(e.m1||0.1)+'" step="0.001" min="0.0001" style="width:80px"> kg</label>'+
   '<label class="f" id="kdLabM2">m₂ <input type="number" id="kdM2" value="'+(e.m2||0.1)+'" step="0.001" min="0.0001" style="width:80px"> kg</label>'+
   '<label class="f" id="kdLabM3">m₃ <input type="number" id="kdM3" value="'+(e.m3||0.1)+'" step="0.001" min="0.0001" style="width:80px"> kg</label>'+
   '<span class="mini">（②のエネルギー・運動量で使います）</span></div>'+
   '<div class="row" style="margin-top:6px"><label class="cb"><input type="checkbox" id="kdScaleOn"'+(e.mPerPx>0?'':' checked')+'>スケールを数で決めておく</label>'+
   '<label class="f"><input type="number" id="kdScalePx" value="'+kdScaleDefault().px+'" step="1" min="1" style="width:80px"> px ＝ </label>'+
   '<label class="f"><input type="number" id="kdScaleCm" value="'+kdScaleDefault().cm+'" step="0.1" min="0.001" style="width:80px"> cm</label>'+
   '<span class="mini">（動画の中で何ピクセルが何 cm か。生徒はスケールの 2 点を打たなくてよくなります）</span></div>'+
   '</div>'+
   '<div class="note" style="margin-top:8px">動画を埋め込むと、ファイルは動画の約1.4倍の大きさになります。'+
   '10MB を超えるときは、動画を短く切るか画質を下げてから読み込んでください。</div>'+
   '<div class="row" style="margin-top:10px"><button class="btn pri" id="kdMake">この内容で書き出す</button></div>'+
   '<h3>使い方（配布のしかた）</h3>'+
   '<ol class="steps" style="font-size:.88rem">'+
   '<li>先生の端末でこのツールを開き、課題にしたい<b>動画を読み込む</b>。時間範囲・原点・軸・スケールまで決めておくと、生徒は <b>4. トラッキング から</b>始められます（途中で書き出してもかまいません。その場合は、決めていない手順から始まります）</li>'+
   '<li>この画面で設問を書いて「書き出す」。<b>kadai_○○.html</b> ができます</li>'+
   '<li>そのファイルを Classroom や共有フォルダで配る。生徒はダブルクリックで開くだけ（ネット不要）</li>'+
   '<li>生徒は解析して「JSON保存」→ 提出。先生は「JSON読込」で開いて確認できます</li>'+
   '</ol>';
  $('kadaiModal').classList.remove('hide');
  $('kdClose').onclick=function(){ $('kadaiModal').classList.add('hide'); };
  $('kdMake').onclick=makeKadai;
  var syncM=function(){ var n=parseInt($('kdNObj').value)||1; $('kdLabM2').classList.toggle('hide', n<2); $('kdLabM3').classList.toggle('hide', n<3); };
  $('kdNObj').onchange=syncM; syncM();
  ['kdCal','kdScaleOn','kdScalePx','kdScaleCm','kdVideo'].forEach(function(id){ $(id).addEventListener('input', kdUpdateStat); $(id).addEventListener('change', kdUpdateStat); });
  kdUpdateStat();
  /* HEVC（H.265）の動画は、先生の端末で再生できても生徒の端末では再生できないことがある */
  var cdc=kadaiCodec(KADAI_SRC.data);
  if(cdc==='hevc'){
    var w=$('kdHevc'); w.classList.remove('hide');
    w.innerHTML='<b>注意：この動画は HEVC（H.265）形式です。</b>この端末では再生できても、生徒の端末（Chromebook、HEVC の拡張機能が入っていない Windows など）では<b>再生できないことがあります</b>。'+
      'iPhone・iPad は［設定 → カメラ → フォーマット → 互換性優先］にして撮り直すか、MP4（H.264）に変換してから読み込むと安全です。';
  }
}
/* 生徒がどの手順から始めるか（先生のいまの設定と、この画面のチェックから） */
function kadaiFlowStatus(){
  var e=EXP(), withCal=$('kdCal')? $('kdCal').checked : true;
  var px=parseFloat(($('kdScalePx')||{}).value), cm=parseFloat(($('kdScaleCm')||{}).value);
  var numScale=!!($('kdScaleOn') && $('kdScaleOn').checked && px>0 && cm>0);
  var has={ range: withCal && ((e.t0!==null && e.rangeB!==null) || !!e.step2ok),
            origin: withCal && !!(e.origin && e.originSet),
            axis: withCal && !!e.axisSet,
            scale: numScale || (withCal && e.mPerPx>0) };
  var miss=[];
  if(!has.range) miss.push('時間範囲（2）');
  if(!has.origin) miss.push('原点（3）');
  if(!has.axis) miss.push('x軸の向き（3）');
  if(!has.scale) miss.push('スケール（3）');
  var start = !has.range? 2 : (miss.length? 3 : 4);
  return { has:has, miss:miss, start:start };
}
function kdUpdateStat(){
  var b=$('kdStat'); if(!b) return;
  var st=kadaiFlowStatus();
  b.classList.toggle('ok', st.start===4);
  b.innerHTML = (st.start===4)?
    '<b>生徒は 4. トラッキング から始めます。</b>（動画・時間範囲・原点・軸・スケールは決まった状態で開き、fps や N も聞きません）' :
    '<b>生徒は '+stepName(st.start)+' から始めます。</b>まだ決まっていないもの：'+st.miss.join('・')+
    '<br><span class="mini">4. トラッキング から始めさせたいときは、先にこの画面を閉じて決めておくか、スケールは下の「スケールを数で決めておく」を使ってください。</span>';
}
/* 動画の形式を調べる（moov の中の 4 文字コード）。HEVC は 'hvc1' / 'hev1' */
function kadaiCodec(dataUrl){
  if(!dataUrl || dataUrl.indexOf('base64,')<0) return '';
  try{
    var bin=atob(dataUrl.slice(dataUrl.indexOf('base64,')+7));
    if(bin.indexOf('hvc1')>=0 || bin.indexOf('hev1')>=0) return 'hevc';
    if(bin.indexOf('avc1')>=0) return 'h264';
    return '';
  }catch(e){ return ''; }
}
/* 埋め込む動画の種類（MIME）をそろえる。
   Chrome は data: の動画を「その種類で再生できるか」で判断するので、.MOV の video/quicktime や
   空の種類のままだと、中身が H.264 でも「再生できない」と断る（ファイルを選んだときの blob: は種類を見ないので開ける）。
   MOV（QuickTime）は MP4 と同じ作りなので video/mp4 として埋め込む */
function kadaiVideoData(src){
  var d=src.data||'', t=(src.type||'').toLowerCase(), nm=(src.name||'').toLowerCase();
  if(/^video\/(mp4|webm|ogg)$/.test(t)) return { data:d, type:t };
  var nt=/\.webm$/.test(nm)? 'video/webm' : 'video/mp4';
  var i=d.indexOf(';base64,');
  if(i>0) d='data:'+nt+d.slice(i);
  return { data:d, type:nt };
}
/* 課題のスケール欄のはじめの値：いまスケールが決まっていればその 2 点の間隔と長さ、無ければ 100 px ＝ 10 cm */
function kdScaleDefault(){
  var e=EXP();
  if(e.scaleRef && e.mPerPx>0){
    var d=Math.hypot(e.scaleRef.x2-e.scaleRef.x1, e.scaleRef.y2-e.scaleRef.y1);
    return { px:Math.round(d), cm:+(d*e.mPerPx*100).toFixed(2) };
  }
  if(e.mPerPx>0) return { px:100, cm:+(100*e.mPerPx*100).toFixed(2) };
  return { px:100, cm:10 };
}
function makeKadai(){
  var title=$('kdTitle').value||'課題', qs=$('kdQ').value.split('\n').filter(function(s){return s.trim();});
  var withVideo=$('kdVideo').checked, withCal=$('kdCal').checked;
  if(withVideo && !KADAI_SRC.data){
    alert(KADAI_SRC.big? '動画が 30 MB を超えているため埋め込めません。動画を短く切るか、画質を下げてから読み込んでください。'
                       : '動画が読み込まれていません（またはサンプル動画は埋め込めません）。'); return; }
  var exp=EXP();
  var nO=parseInt($('kdNObj').value)||1;
  var pos=function(id,d){ var v=parseFloat($(id).value); return (v>0&&isFinite(v))? v : d; };
  var masses=[pos('kdM1',0.1), pos('kdM2',0.1), pos('kdM3',0.1)].slice(0,nO);
  var scale=null;
  if($('kdScaleOn').checked){
    var px=pos('kdScalePx',0), cm=pos('kdScaleCm',0);
    if(!(px>0&&cm>0)){ alert('スケールは「○ px ＝ ○ cm」の両方に 0 より大きい数を入れてください。'); return; }
    scale={ px:px, cm:cm, mPerPx:cm/100/px };
  }
  var vd=withVideo? kadaiVideoData(KADAI_SRC) : null;
  var K={ title:title, questions:qs, nObjs:nO, masses:masses, scale:scale,
          autoTrack: $('kdAuto').value==='1',
          stepN: parseInt($('kdN').value)||5,
          video: withVideo? {name:exp.video.name, data:vd.data, type:vd.type} : null,
          /* 動画の情報と fps（先生が答えたもの）。生徒には fps の確認を出さない */
          vmeta: { name:exp.video.name, w:exp.video.w, h:exp.video.h, dur:exp.video.dur, fps:exp.video.fps,
                   tscale:exp.tscale||1, shotFps:exp.shotFps||0 },
          cal: withCal? { origin:exp.origin, angle:exp.angle, yflip:exp.yflip, mPerPx:exp.mPerPx,
                          scaleRef:exp.scaleRef, scaleLen:exp.scaleLen, rangeA:exp.rangeA, rangeB:exp.rangeB,
                          /* ここから下は 4. トラッキング からすぐ始めるための分 */
                          t0:exp.t0, step2ok:!!exp.step2ok, originSet:!!exp.originSet, axisSet:!!exp.axisSet,
                          xflip:!!exp.xflip, crop:exp.crop||null, axisDisp:APP.axisDisp } : null };
  var js='window.KADAI='+JSON.stringify(K)+';';
  var html='<!DOCTYPE html>'+ORIGINAL_HTML.replace('</head>',
      '<script id="kadaiData">'+js.replace(/<\//g,'<\\/')+'<'+'/script></head>');
  var name='kadai_'+(title.replace(/[\\\/:*?"<>|\s]+/g,'_'))+'.html';
  dl(new Blob([html],{type:'text/html;charset=utf-8'}), name);
  $('kadaiModal').classList.add('hide');
  var st=kadaiFlowStatus();
  toast('課題ファイルを書き出しました（'+name+'）。生徒は '+stepName(st.start)+' から始めます');
}
