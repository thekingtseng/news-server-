const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());

let blockList = ['三立', '民視', 'SETN', 'FTV'];
let loveList  = ['台積電', '晶片', 'AI', '曾奕瑋', '正妹'];
let cache = [];
let lastFetch = 0;

async function refresh() {
    try {
        const r = await axios.get(
            'https://news.google.com/rss?hl=zh-TW&gl=TW&ceid=TW:zh-Hant',
            { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 8000 }
        );
        const parts = r.data.split('<item>');
        const news = [];
        for (let i = 1; i < parts.length; i++) {
            const it = parts[i];
            const tM = it.match(/<title>([\s\S]*?)<\/title>/);
            const lM = it.match(/<link>([\s\S]*?)<\/link>/);
            const dM = it.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
            const mM = it.match(/media:content[^>]+url="([^"]+)"/)
                    || it.match(/<enclosure[^>]+url="([^"]+)"/);
            if (!tM || !lM) continue;
            const raw   = tM[1].replace('<![CDATA[','').replace(']]>','').trim();
            const dash  = raw.lastIndexOf(' - ');
            const title = dash > 0 ? raw.substring(0, dash) : raw;
            const src   = dash > 0 ? raw.substring(dash + 3) : '';
            const img   = mM ? mM[1] : null;
            news.push({ title, url: lM[1].trim(), src, date: dM ? dM[1].trim() : '', img });
        }
        if (news.length) { cache = news; lastFetch = Date.now(); }
        console.log('抓到 ' + news.length + ' 則');
    } catch(e) { console.log('抓取失敗: ' + e.message); }
}

refresh();
setInterval(refresh, 120000);

// 回傳時套用 blockList / loveList
app.get('/news.json', (req, res) => {
    let news = cache.filter(n => !blockList.some(w => n.title.includes(w)));
    news = news.map(n => ({ ...n, hot: loveList.some(w => n.title.includes(w)) }));
    news.sort((a, b) => b.hot - a.hot);
    res.json({ news, blockList, loveList });
});

app.post('/api/config', (req, res) => {
    if (req.body.blockList) blockList = req.body.blockList;
    if (req.body.loveList)  loveList  = req.body.loveList;
    res.json({ ok: true });
});

app.get('/', (req, res) => res.send(`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>台灣新聞</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0d0f14;color:#e2e8f0;font-family:sans-serif;padding:10px}
h1{text-align:center;font-size:17px;color:#fff;margin-bottom:12px}
h1 b{color:#3b82f6}

/* SLIDESHOW */
#sw{position:relative;max-width:860px;margin:0 auto 14px;border-radius:10px;overflow:hidden;background:#161a23;min-height:220px}
.sl{display:none;position:relative}
.sl.on{display:block}
.sl img{width:100%;height:220px;object-fit:cover;display:block}
.sl .ph{width:100%;height:220px;background:#1e2433;display:flex;align-items:center;justify-content:center;font-size:40px;color:#2a3044}
.sl .ov{position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,.88));padding:28px 14px 12px}
.sl .ov .hot{font-size:10px;font-weight:700;color:#10b981;margin-bottom:3px}
.sl .ov a{font-size:15px;font-weight:700;color:#fff;text-decoration:none;line-height:1.4;display:block}
.sl .ov .src{font-size:11px;color:#94a3b8;margin-top:4px}
#sc{position:absolute;top:10px;right:12px;background:rgba(0,0,0,.6);color:#fff;font-size:12px;font-weight:700;padding:3px 9px;border-radius:20px;display:none}
#sp{position:absolute;bottom:0;left:0;height:3px;background:#3b82f6;transition:width .1s linear}
.nav{position:absolute;top:50%;transform:translateY(-50%);background:rgba(0,0,0,.5);color:#fff;border:none;font-size:22px;width:34px;height:34px;border-radius:50%;cursor:pointer;display:none;align-items:center;justify-content:center}
.nav:hover{background:#3b82f6}
#pb{left:8px}#nb{right:8px}

/* CONTROLS */
.cg{display:grid;grid-template-columns:1fr 1fr;gap:10px;max-width:860px;margin:0 auto 12px}
@media(max-width:540px){.cg{grid-template-columns:1fr}}
.pn{background:#161a23;border:1px solid #2a3044;border-radius:8px;padding:11px}
.pt{font-size:12px;font-weight:700;margin-bottom:8px}
.pt.lv{color:#10b981}.pt.bk{color:#ef4444}
.ir{display:flex;gap:6px}
.ir input{flex:1;background:#1e2433;border:1px solid #2a3044;color:#e2e8f0;padding:7px 9px;border-radius:5px;font-size:13px;outline:none}
.ir input:focus{border-color:#3b82f6}
.ba{padding:7px 11px;border:none;border-radius:5px;font-size:12px;font-weight:700;cursor:pointer}
.ba.lv{background:#10b981;color:#fff}.ba.bk{background:#ef4444;color:#fff}
.ta{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}
.tg{display:inline-flex;align-items:center;gap:3px;font-size:11px;padding:2px 8px;border-radius:20px;font-weight:600;cursor:default}
.tg.lv{background:rgba(16,185,129,.12);color:#10b981;border:1px solid rgba(16,185,129,.3)}
.tg.bk{background:rgba(239,68,68,.12);color:#ef4444;border:1px solid rgba(239,68,68,.3)}
.td{cursor:pointer;font-size:13px;margin-left:1px}

/* ACTION BAR */
.ab{max-width:860px;margin:0 auto 10px;display:flex;gap:10px;align-items:center}
.rb{flex:1;background:#3b82f6;color:#fff;border:none;border-radius:7px;padding:11px;font-size:15px;font-weight:700;cursor:pointer}
.rb:hover{opacity:.85}
.cb{background:#161a23;border:1px solid #2a3044;border-radius:7px;padding:8px 12px;text-align:center;min-width:68px}
.cb .n{font-size:20px;font-weight:700;color:#3b82f6;line-height:1}
.cb .l{font-size:10px;color:#64748b;margin-top:1px}

/* STATS */
.sb{max-width:860px;margin:0 auto 10px;background:#161a23;border:1px solid #2a3044;border-radius:6px;padding:7px 12px;font-size:12px;color:#64748b;display:flex;justify-content:space-between;align-items:center}
.sb b{color:#e2e8f0}

/* LIST */
.nl{max-width:860px;margin:0 auto;display:flex;flex-direction:column;gap:7px}
.nd{background:#161a23;border:1px solid #2a3044;border-radius:7px;display:flex;overflow:hidden;text-decoration:none;transition:border-color .15s}
.nd:hover{border-color:#3b82f6}
.nd.ht{border-left:3px solid #10b981}
.nd img{width:90px;min-height:68px;max-height:90px;flex-shrink:0;object-fit:cover}
.nd .cp{width:90px;min-height:68px;flex-shrink:0;background:#1e2433;display:flex;align-items:center;justify-content:center;font-size:22px;color:#2a3044}
.nd .nb{flex:1;padding:9px 11px;display:flex;flex-direction:column;justify-content:center}
.nd .hb{font-size:10px;font-weight:700;color:#10b981;margin-bottom:2px}
.nd .tt{font-size:13px;font-weight:600;line-height:1.4;color:#e2e8f0}
.nd .mt{font-size:11px;color:#64748b;margin-top:4px}

.spin{display:inline-block;width:16px;height:16px;border:2px solid #2a3044;border-top-color:#3b82f6;border-radius:50%;animation:sp .7s linear infinite;vertical-align:middle;margin-right:4px}
@keyframes sp{to{transform:rotate(360deg)}}
</style>
</head>
<body>
<h1>🎯 台灣新聞 <b>即時列表</b></h1>

<div id="sw">
  <div style="display:flex;align-items:center;justify-content:center;height:220px;color:#64748b;font-size:13px">
    <span class="spin"></span>載入中...
  </div>
  <div id="sc"></div>
  <button class="nav" id="pb" onclick="sP()">&#8249;</button>
  <button class="nav" id="nb" onclick="sN()">&#8250;</button>
  <div id="sp" style="width:0%"></div>
</div>

<div class="cg">
  <div class="pn">
    <div class="pt lv">💚 喜好關鍵字（置頂）</div>
    <div class="ir">
      <input id="li" placeholder="台積電、AI..." onkeydown="if(event.key==='Enter')aT('love')">
      <button class="ba lv" onclick="aT('love')">加入</button>
    </div>
    <div class="ta" id="lt"></div>
  </div>
  <div class="pn">
    <div class="pt bk">🚫 黑名單（過濾）</div>
    <div class="ir">
      <input id="bi" placeholder="三立、爆料..." onkeydown="if(event.key==='Enter')aT('block')">
      <button class="ba bk" onclick="aT('block')">封鎖</button>
    </div>
    <div class="ta" id="bt"></div>
  </div>
</div>

<div class="ab">
  <button class="rb" onclick="load(true)">🔄 立即更新</button>
  <div class="cb">
    <div class="n" id="cd">60</div>
    <div class="l">自動刷新</div>
  </div>
</div>

<div class="sb">
  <span id="st"><span class="spin"></span>載入中</span>
</div>
<div class="nl" id="nl"></div>

<script>
var all=[], cL=[], cB=[], sI=0, sT=null, pT=null, pV=0, cd=60;

function fmt(s){
  if(!s)return'';
  var d=new Date(s),m=Math.floor((new Date()-d)/60000);
  if(isNaN(d))return'';
  if(m<1)return'剛剛';if(m<60)return m+'分前';
  if(m<1440)return Math.floor(m/60)+'小時前';
  return(d.getMonth()+1)+'/'+(d.getDate());
}

function bSS(arr){
  var sl=arr.slice(0,15);
  var w=document.getElementById('sw');
  w.querySelectorAll('.sl').forEach(function(e){e.remove();});
  var sc=document.getElementById('sc'),pb=document.getElementById('pb'),nb=document.getElementById('nb');
  sl.forEach(function(n,i){
    var d=document.createElement('div');
    d.className='sl'+(i===0?' on':'');
    var img=n.img?'<img src="'+n.img+'" onerror="this.style.display=\'none\'" alt="">':'<div class="ph">📰</div>';
    d.innerHTML=img+'<div class="ov">'+(n.hot?'<div class="hot">🔥 命中關鍵字</div>':'')+
      '<a href="'+n.url+'" target="_blank">'+n.title+'</a>'+
      '<div class="src">'+(n.src?'📡 '+n.src:'')+(n.date?' · '+fmt(n.date):'')+
      '</div></div>';
    w.insertBefore(d,sc);
  });
  sI=0;
  if(sl.length>1){sc.style.display='block';pb.style.display='flex';nb.style.display='flex';}
  uC();sA();
}

function uC(){var t=document.querySelectorAll('.sl').length;document.getElementById('sc').textContent=(sI+1)+'/'+t;}
function sS(i){
  var sl=document.querySelectorAll('.sl');if(!sl.length)return;
  sl.forEach(function(e){e.classList.remove('on');});
  sI=((i%sl.length)+sl.length)%sl.length;
  sl[sI].classList.add('on');uC();
}
function sP(){cA();sS(sI-1);sA();}
function sN(){cA();sS(sI+1);sA();}
function sA(){
  cA();pV=0;document.getElementById('sp').style.width='0%';
  pT=setInterval(function(){pV+=2;document.getElementById('sp').style.width=Math.min(pV,100)+'%';},100);
  sT=setTimeout(function(){sS(sI+1);sA();},5000);
}
function cA(){clearTimeout(sT);clearInterval(pT);}

function rTags(){
  document.getElementById('lt').innerHTML=cL.map(function(t,i){
    return '<span class="tg lv">💚 '+t+' <span class="td" onclick="rT(\'love\','+i+')">×</span></span>';
  }).join('');
  document.getElementById('bt').innerHTML=cB.map(function(t,i){
    return '<span class="tg bk">🚫 '+t+' <span class="td" onclick="rT(\'block\','+i+')">×</span></span>';
  }).join('');
}

function aT(type){
  var id=type==='love'?'li':'bi',v=document.getElementById(id).value.trim();
  if(!v)return;
  if(type==='love')cL.push(v);else cB.push(v);
  document.getElementById(id).value='';
  sC();
}
function rT(type,i){if(type==='love')cL.splice(i,1);else cB.splice(i,1);sC();}
function sC(){
  fetch('/api/config',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({blockList:cB,loveList:cL})
  }).then(function(){load(false);});
}

function load(force){
  if(force){
    fetch('/api/refresh',{method:'POST'}).catch(function(){});
  }
  cd=60;
  fetch('/news.json').then(function(r){return r.json();}).then(function(d){
    all=d.news||[];
    cL=d.loveList||[];
    cB=d.blockList||[];
    rTags();
    document.getElementById('st').textContent='共 '+all.length+' 則新聞';
    bSS(all);
    document.getElementById('nl').innerHTML=all.map(function(n){
      var th=n.img?'<img src="'+n.img+'" loading="lazy" alt="" onerror="this.style.display=\'none\'">':'<div class="cp">📰</div>';
      return '<a class="nd'+(n.hot?' ht':'')+'" href="'+n.url+'" target="_blank">'+th+
        '<div class="nb">'+(n.hot?'<div class="hb">🔥 命中</div>':'')+
        '<div class="tt">'+n.title+'</div>'+
        '<div class="mt">'+(n.src?'📡 '+n.src+' · ':'')+fmt(n.date)+'</div>'+
        '</div></a>';
    }).join('');
  }).catch(function(){
    document.getElementById('st').innerHTML='<span style="color:#ef4444">❌ 失敗，請重試</span>';
  });
}

setInterval(function(){cd--;document.getElementById('cd').textContent=cd;if(cd<=0)load(false);},1000);
window.onload=function(){load(false);};
</script>
</body>
</html>`));

// 手動觸發重抓
app.post('/api/refresh', (req, res) => {
    refresh();
    res.json({ ok: true });
});

app.listen(PORT, () => console.log('port ' + PORT));
