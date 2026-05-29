const express = require('express');
const axios = require('axios');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 10000;
const CACHE_FILE = '/tmp/news_cache.json';

app.use(express.json());

let cache = [];

try {
    const saved = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    if (saved.length) { cache = saved; console.log('讀快取：' + cache.length + ' 則'); }
} catch(e) {}

async function refresh() {
    try {
        const r = await axios.get(
            'https://news.google.com/rss?hl=zh-TW&gl=TW&ceid=TW:zh-Hant',
            { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 8000 }
        );
        const news = [];
        r.data.split('<item>').slice(1).forEach(it => {
            const tM = it.match(/<title>([\s\S]*?)<\/title>/);
            const lM = it.match(/<link>([\s\S]*?)<\/link>/);
            const dM = it.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
            if (!tM || !lM) return;
            const raw = tM[1].replace('<![CDATA[','').replace(']]>','').trim();
            const dash = raw.lastIndexOf(' - ');
            news.push({
                title: dash > 0 ? raw.substring(0, dash) : raw,
                src:   dash > 0 ? raw.substring(dash + 3) : '',
                url:   lM[1].trim(),
                date:  dM ? dM[1].trim() : ''
            });
        });
        if (news.length) {
            cache = news;
            fs.writeFileSync(CACHE_FILE, JSON.stringify(news));
            console.log('更新：' + news.length + ' 則');
        }
    } catch(e) { console.log('失敗:' + e.message); }
}

refresh();
setInterval(refresh, 120000);

app.get('/news.json', (req, res) => res.json(cache));
app.post('/api/refresh', (req, res) => { refresh(); res.json({ ok: true }); });

app.get('/', (req, res) => res.send(`<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>皇上曾奕瑋精選新聞</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700;900&display=swap');
:root{
  --bg:#f0f4f9;
  --card:#ffffff;
  --card2:#f8fafd;
  --border:#dde3ee;
  --ac:#1a6fdf;
  --ac-light:#e8f0fd;
  --ac-glow:rgba(26,111,223,0.15);
  --lv:#0d9f6e;
  --lv-light:#e6f7f2;
  --bk:#d93025;
  --bk-light:#fce8e6;
  --tx:#1a202c;
  --tm:#6b7280;
  --ts:#9ca3af;
  --shadow:0 2px 8px rgba(0,0,0,0.08);
  --shadow-hover:0 8px 24px rgba(0,0,0,0.12);
}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Noto Sans TC',sans-serif;background:var(--bg);color:var(--tx);min-height:100vh;padding:16px}

/* HEADER */
.header{max-width:900px;margin:0 auto 20px;display:flex;justify-content:space-between;align-items:center;padding-bottom:16px;border-bottom:2px solid var(--border)}
.header-left h1{font-size:22px;font-weight:900;color:var(--tx)}
.header-left h1 em{font-style:normal;color:var(--ac)}
.header-left .sub{font-size:12px;color:var(--tm);margin-top:3px}
.header-right{text-align:right;font-size:13px;color:var(--tm);line-height:1.6}
.header-right b{color:var(--tx)}

/* TICKER */
.ticker-wrap{max-width:900px;margin:0 auto 16px;background:var(--card);border-radius:12px;box-shadow:var(--shadow);overflow:hidden;border:1px solid var(--border)}
.ticker-top{display:flex;align-items:stretch;min-height:80px}
.ticker-label{background:linear-gradient(135deg,var(--ac),#2563eb);color:#fff;font-size:11px;font-weight:900;padding:0 16px;display:flex;align-items:center;flex-shrink:0;letter-spacing:1px;writing-mode:horizontal-tb}
.ticker-content{flex:1;padding:14px 16px;cursor:pointer;transition:background .15s}
.ticker-content:hover{background:var(--ac-light)}
.ticker-hot{font-size:10px;font-weight:800;color:var(--lv);margin-bottom:4px;letter-spacing:.5px}
.ticker-title{font-size:15px;font-weight:700;line-height:1.5;color:var(--tx);text-decoration:none;display:block}
.ticker-content:hover .ticker-title{color:var(--ac)}
.ticker-meta{font-size:11px;color:var(--tm);margin-top:5px;display:flex;gap:10px}
.ticker-bottom{display:flex;align-items:center;border-top:1px solid var(--border);background:var(--card2)}
.ticker-counter{font-size:11px;font-weight:700;color:var(--ac);padding:6px 14px;border-right:1px solid var(--border)}
.ticker-prog-wrap{flex:1;height:100%;padding:0 12px;display:flex;align-items:center}
.ticker-prog{width:100%;height:3px;background:var(--border);border-radius:2px;overflow:hidden}
.ticker-prog-bar{height:100%;background:linear-gradient(90deg,var(--ac),#60a5fa);width:0%;transition:width .1s linear;border-radius:2px}
.ticker-btns{display:flex}
.ticker-btn{background:none;border:none;border-left:1px solid var(--border);color:var(--tm);font-size:16px;padding:7px 16px;cursor:pointer;transition:background .15s,color .15s;font-family:inherit}
.ticker-btn:hover{background:var(--ac-light);color:var(--ac)}

/* CONTROLS */
.cg{display:grid;grid-template-columns:1fr 1fr;gap:12px;max-width:900px;margin:0 auto 14px}
@media(max-width:560px){.cg{grid-template-columns:1fr}}
.pn{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:14px;box-shadow:var(--shadow)}
.pt{font-size:12px;font-weight:800;margin-bottom:10px;letter-spacing:.5px;display:flex;align-items:center;gap:6px}
.pt.lv{color:var(--lv)}.pt.bk{color:var(--bk)}
.ir{display:flex;gap:7px}
.ir input{flex:1;padding:8px 11px;border:1.5px solid var(--border);border-radius:7px;font-size:13px;outline:none;font-family:inherit;color:var(--tx);background:#fff;transition:border-color .2s,box-shadow .2s}
.ir input::placeholder{color:var(--ts)}
.ir input:focus{border-color:var(--ac);box-shadow:0 0 0 3px var(--ac-glow)}
.ba{padding:8px 13px;border:none;border-radius:7px;font-size:12px;font-weight:700;cursor:pointer;transition:opacity .15s,transform .1s;font-family:inherit}
.ba:active{transform:scale(.96)}
.ba.lv{background:var(--lv);color:#fff}.ba.bk{background:var(--bk);color:#fff}
.ta{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;min-height:4px}
.tg{display:inline-flex;align-items:center;gap:4px;font-size:12px;padding:4px 10px;border-radius:20px;font-weight:700;transition:opacity .15s}
.tg:hover{opacity:.8}
.tg.lv{background:var(--lv-light);color:var(--lv);border:1.5px solid rgba(13,159,110,.2)}
.tg.bk{background:var(--bk-light);color:var(--bk);border:1.5px solid rgba(217,48,37,.2)}
.td{cursor:pointer;font-size:14px;opacity:.6}
.td:hover{opacity:1}

/* ACTION BAR */
.ab{max-width:900px;margin:0 auto 14px;display:flex;gap:10px;align-items:stretch}
.rb{flex:1;background:linear-gradient(135deg,var(--ac),#2563eb);color:#fff;border:none;border-radius:10px;padding:13px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;transition:opacity .15s,transform .1s;box-shadow:0 4px 14px var(--ac-glow)}
.rb:hover{opacity:.9}.rb:active{transform:scale(.99)}
.cd-box{background:var(--card);border:1.5px solid var(--border);border-radius:10px;padding:8px 14px;text-align:center;min-width:72px;box-shadow:var(--shadow)}
.cd-box .n{font-size:24px;font-weight:900;color:var(--ac);line-height:1}
.cd-box .l{font-size:10px;color:var(--tm);margin-top:2px;font-weight:600}

/* STATS */
.sb{max-width:900px;margin:0 auto 14px;background:var(--card);border:1px solid var(--border);border-radius:10px;padding:9px 16px;font-size:12px;color:var(--tm);display:flex;gap:6px;flex-wrap:wrap;align-items:center;box-shadow:var(--shadow)}
.sb b{color:var(--tx);font-weight:700}
.sb .pill{display:inline-flex;align-items:center;gap:4px;padding:2px 9px;border-radius:20px;font-weight:600;font-size:11px}
.sb .pill.lv{background:var(--lv-light);color:var(--lv)}
.sb .pill.bk{background:var(--bk-light);color:var(--bk)}
.sb .dot{width:3px;height:3px;border-radius:50%;background:var(--border)}
.sb-right{margin-left:auto;font-size:11px;color:var(--ts)}

/* DIVIDER */
.divider{max-width:900px;margin:4px auto 12px;display:flex;align-items:center;gap:10px;font-size:11px;color:var(--tm);font-weight:700;letter-spacing:.5px}
.divider::before,.divider::after{content:'';flex:1;height:1px;background:var(--border)}

/* NEWS LIST */
.nl{max-width:900px;margin:0 auto;display:flex;flex-direction:column;gap:8px}
.nd{background:var(--card);border:1.5px solid var(--border);border-radius:12px;padding:14px 16px;text-decoration:none;display:block;transition:transform .15s,box-shadow .15s,border-color .15s;box-shadow:var(--shadow);border-left:5px solid var(--ac)}
.nd:hover{transform:translateX(4px);box-shadow:var(--shadow-hover);border-color:var(--ac)}
.nd.ht{border-left-color:var(--lv)}
.nd.ht:hover{border-color:var(--lv)}
.hb{font-size:10px;font-weight:800;color:var(--lv);margin-bottom:4px;letter-spacing:.5px;display:flex;align-items:center;gap:4px}
.tt{font-size:14px;font-weight:600;line-height:1.55;color:var(--tx)}
.nd:hover .tt{color:var(--ac)}
.nd.ht:hover .tt{color:var(--lv)}
.mt{font-size:11px;color:var(--tm);margin-top:7px;display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.src-badge{background:var(--ac-light);color:var(--ac);padding:2px 7px;border-radius:4px;font-weight:700;font-size:11px}
.block-btn{background:none;border:none;color:var(--ts);cursor:pointer;font-size:11px;padding:0;text-decoration:underline;font-family:inherit;margin-left:auto;transition:color .15s}
.block-btn:hover{color:var(--bk)}

/* SPIN */
.spin{display:inline-block;width:14px;height:14px;border:2px solid var(--border);border-top-color:var(--ac);border-radius:50%;animation:sp .7s linear infinite;vertical-align:middle;margin-right:5px}
@keyframes sp{to{transform:rotate(360deg)}}
</style>
</head>
<body>

<div class="header">
  <div class="header-left">
    <h1>🎯 皇上曾奕瑋 <em>精選新聞</em></h1>
    <div class="sub">Taiwan News · Real-time Filter</div>
  </div>
  <div class="header-right">
    倒數 <b id="cd">60</b> 秒更新<br>
    上次更新：<span id="last-update">-</span>
  </div>
</div>

<!-- TICKER -->
<div class="ticker-wrap">
  <div class="ticker-top">
    <div class="ticker-label">TOP 15</div>
    <a class="ticker-content" id="ticker-link" href="#" target="_blank">
      <div class="ticker-hot" id="ticker-hot" style="display:none">🔥 命中喜好關鍵字</div>
      <div class="ticker-title" id="ticker-title"><span class="spin"></span>載入中...</div>
      <div class="ticker-meta" id="ticker-meta"></div>
    </a>
  </div>
  <div class="ticker-bottom">
    <div class="ticker-counter" id="ticker-counter">- / -</div>
    <div class="ticker-prog-wrap"><div class="ticker-prog"><div class="ticker-prog-bar" id="ticker-prog"></div></div></div>
    <div class="ticker-btns">
      <button class="ticker-btn" onclick="tickerPrev()">&#8249;</button>
      <button class="ticker-btn" onclick="tickerNext()">&#8250;</button>
    </div>
  </div>
</div>

<!-- CONTROLS -->
<div class="cg">
  <div class="pn">
    <div class="pt lv">💚 喜好關鍵字（置頂顯示）</div>
    <div class="ir">
      <input id="li" placeholder="曾奕瑋、AI、台積電..." onkeydown="if(event.key==='Enter')aT('love')">
      <button class="ba lv" onclick="aT('love')">加入</button>
    </div>
    <div class="ta" id="lt"></div>
  </div>
  <div class="pn">
    <div class="pt bk">🚫 封鎖黑名單（自動過濾）</div>
    <div class="ir">
      <input id="bi" placeholder="三立、爆料公社..." onkeydown="if(event.key==='Enter')aT('block')">
      <button class="ba bk" onclick="aT('block')">封鎖</button>
    </div>
    <div class="ta" id="bt"></div>
  </div>
</div>

<!-- ACTION BAR -->
<div class="ab">
  <button class="rb" onclick="hardRefresh()">🔄 立即更新新聞</button>
  <div class="cd-box">
    <div class="n" id="cd2">60</div>
    <div class="l">自動刷新</div>
  </div>
</div>

<!-- STATS -->
<div class="sb" id="st"><span class="spin"></span>載入中</div>

<div class="divider">所有新聞</div>
<div class="nl" id="nl"></div>

<script>
var LOVE_KEY='love_v3', BLOCK_KEY='block_v3';
var cL = JSON.parse(localStorage.getItem(LOVE_KEY) || '["曾奕瑋","台積電","晶片","AI","正妹"]');
var cB = JSON.parse(localStorage.getItem(BLOCK_KEY) || '["三立","民視","SETN","FTV"]');
var all=[], filtered=[], cd=60, tIdx=0, tTimer=null, tPTimer=null, tPVal=0;

function save(){ localStorage.setItem(LOVE_KEY,JSON.stringify(cL)); localStorage.setItem(BLOCK_KEY,JSON.stringify(cB)); }

function fmt(s){
  if(!s)return'';
  var d=new Date(s),m=Math.floor((new Date()-d)/60000);
  if(isNaN(d))return'';
  if(m<1)return'剛剛';if(m<60)return m+'分前';
  if(m<1440)return Math.floor(m/60)+'小時前';
  return(d.getMonth()+1)+'/'+(d.getDate());
}

function render(){
  filtered = all.filter(function(n){ return !cB.some(function(w){ return n.title.includes(w); }); });
  filtered = filtered.map(function(n){ return Object.assign({},n,{hot:cL.some(function(w){ return n.title.includes(w); })}); });
  filtered.sort(function(a,b){ return b.hot-a.hot; });

  var hot=filtered.filter(function(n){return n.hot;}).length;
  var blocked=all.length-filtered.length;
  var now=new Date();
  document.getElementById('last-update').textContent=now.getHours()+':'+String(now.getMinutes()).padStart(2,'0');
  document.getElementById('st').innerHTML=
    '共 <b>'+all.length+'</b> 則&nbsp;&nbsp;'+
    '<span class="dot"></span>&nbsp;&nbsp;'+
    '顯示 <b>'+filtered.length+'</b> 則&nbsp;&nbsp;'+
    '<span class="dot"></span>&nbsp;&nbsp;'+
    '<span class="pill lv">❤️ 命中 '+hot+'</span>&nbsp;'+
    '<span class="pill bk">🚫 過濾 '+blocked+'</span>'+
    '<span class="sb-right">每2分鐘自動抓取</span>';

  document.getElementById('nl').innerHTML=filtered.map(function(n){
    return '<a class="nd'+(n.hot?' ht':'')+'" href="'+n.url+'" target="_blank">'+
      (n.hot?'<div class="hb">🔥 命中喜好關鍵字</div>':'')+
      '<div class="tt">'+n.title+'</div>'+
      '<div class="mt">'+
      (n.src?'<span class="src-badge">'+n.src+'</span>':'') +
      (n.date?'<span>🕐 '+fmt(n.date)+'</span>':'')+
      (n.src?'<button class="block-btn" onclick="blockSrc(event,\''+n.src+'\')">🚫 封鎖此媒體</button>':'')+
      '</div></a>';
  }).join('');

  rTags();
  tickerInit();
}

function blockSrc(e, src){
  e.preventDefault(); e.stopPropagation();
  if(!cB.includes(src)){ cB.push(src); save(); render(); }
}

function tickerInit(){
  var list=filtered.slice(0,15);
  if(!list.length)return;
  tIdx=0;
  tickerShow(list);
}
function tickerShow(list){
  if(!list.length)return;
  var n=list[tIdx];
  document.getElementById('ticker-link').href=n.url;
  document.getElementById('ticker-hot').style.display=n.hot?'block':'none';
  document.getElementById('ticker-title').textContent=n.title;
  document.getElementById('ticker-meta').innerHTML=
    (n.src?'<span>📡 '+n.src+'</span>':'')+
    (n.date?'<span>🕐 '+fmt(n.date)+'</span>':'');
  document.getElementById('ticker-counter').textContent=(tIdx+1)+'/'+list.length;
  tickerStartProg(list);
}
function tickerStartProg(list){
  clearTimeout(tTimer);clearInterval(tPTimer);
  tPVal=0;document.getElementById('ticker-prog').style.width='0%';
  tPTimer=setInterval(function(){ tPVal+=2; document.getElementById('ticker-prog').style.width=Math.min(tPVal,100)+'%'; },100);
  tTimer=setTimeout(function(){ tIdx=(tIdx+1)%list.length; tickerShow(list); },5000);
}
function tickerPrev(){ var l=filtered.slice(0,15);if(!l.length)return; tIdx=(tIdx-1+l.length)%l.length; tickerShow(l); }
function tickerNext(){ var l=filtered.slice(0,15);if(!l.length)return; tIdx=(tIdx+1)%l.length; tickerShow(l); }

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
  document.getElementById(id).value='';save();render();
}
function rT(type,i){ if(type==='love')cL.splice(i,1);else cB.splice(i,1); save();render(); }

function load(retry){
  retry=retry||0; cd=60;
  fetch('/news.json').then(function(r){return r.json();}).then(function(d){
    if(!d||!d.length){
      if(retry<5){
        document.getElementById('st').innerHTML='<span class="spin"></span>啟動中，稍候... ('+(retry+1)+'/5)';
        setTimeout(function(){ load(retry+1); },2000);
      } else {
        document.getElementById('st').innerHTML='<span style="color:var(--bk)">❌ 無法取得新聞，請按「立即更新」</span>';
      }
      return;
    }
    all=d; render();
  }).catch(function(){
    document.getElementById('st').innerHTML='<span style="color:var(--bk)">❌ 載入失敗，請重試</span>';
  });
}

function hardRefresh(){
  document.getElementById('st').innerHTML='<span class="spin"></span>正在從 Google News 重抓...';
  fetch('/api/refresh',{method:'POST'}).then(function(){ setTimeout(load,3000); }).catch(load);
}

setInterval(function(){
  cd--;
  document.getElementById('cd').textContent=cd;
  document.getElementById('cd2').textContent=cd;
  if(cd<=0)load();
},1000);

window.onload=load;
</script>
</body>
</html>`));

app.listen(PORT, () => console.log('port ' + PORT));
