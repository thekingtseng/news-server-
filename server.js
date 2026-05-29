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
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>皇上曾奕瑋精選新聞</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700;900&display=swap');
:root{
  --bg:#07090f;--s1:#0e1118;--s2:#151b27;--s3:#1c2333;
  --bd:#252d3d;--bd2:#2e3a50;
  --ac:#4f8ef7;--ac2:#6ea8ff;
  --lv:#22c980;--lv2:#4ddfaa;
  --bk:#f05252;
  --tx:#dde4f0;--tm:#6b7a99;--ts:#8a9abf;
}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Noto Sans TC',sans-serif;background:var(--bg);color:var(--tx);min-height:100vh;padding:12px}

/* HEADER */
.header{text-align:center;padding:16px 0 18px;position:relative}
.header h1{font-size:20px;font-weight:900;letter-spacing:.5px;color:#fff}
.header h1 em{font-style:normal;color:var(--ac2)}
.header .sub{font-size:11px;color:var(--tm);margin-top:4px;letter-spacing:1px;text-transform:uppercase}

/* TICKER */
.ticker-wrap{max-width:860px;margin:0 auto 14px;background:var(--s2);border:1px solid var(--bd);border-radius:10px;overflow:hidden;position:relative}
.ticker-bar{display:flex;align-items:stretch;min-height:72px}
.ticker-label{background:var(--ac);color:#fff;font-size:11px;font-weight:900;letter-spacing:1px;writing-mode:horizontal-tb;padding:0 14px;display:flex;align-items:center;flex-shrink:0;text-transform:uppercase}
.ticker-body{flex:1;padding:14px 16px;display:flex;flex-direction:column;justify-content:center;cursor:pointer}
.ticker-body:hover .ticker-title{color:var(--ac2)}
.ticker-hot{font-size:10px;font-weight:700;color:var(--lv);margin-bottom:4px;letter-spacing:.5px}
.ticker-title{font-size:15px;font-weight:700;line-height:1.45;color:#fff;text-decoration:none;transition:color .2s}
.ticker-meta{font-size:11px;color:var(--tm);margin-top:5px}
.ticker-counter{position:absolute;top:10px;right:12px;background:rgba(79,142,247,.15);border:1px solid rgba(79,142,247,.3);color:var(--ac2);font-size:11px;font-weight:700;padding:2px 9px;border-radius:20px}
.ticker-prog{height:2px;background:var(--bd);position:relative}
.ticker-prog-bar{height:100%;background:linear-gradient(90deg,var(--ac),var(--lv));width:0%;transition:width .1s linear}
.ticker-nav{display:flex;gap:0;border-top:1px solid var(--bd)}
.ticker-nav button{flex:1;background:none;border:none;border-right:1px solid var(--bd);color:var(--tm);font-size:16px;padding:7px;cursor:pointer;transition:background .15s,color .15s}
.ticker-nav button:last-child{border-right:none}
.ticker-nav button:hover{background:var(--s3);color:var(--ac2)}

/* CONTROLS */
.cg{display:grid;grid-template-columns:1fr 1fr;gap:10px;max-width:860px;margin:0 auto 12px}
@media(max-width:540px){.cg{grid-template-columns:1fr}}
.pn{background:var(--s1);border:1px solid var(--bd);border-radius:10px;padding:12px}
.pt{font-size:11px;font-weight:800;margin-bottom:9px;letter-spacing:.5px;text-transform:uppercase;display:flex;align-items:center;gap:5px}
.pt.lv{color:var(--lv)}.pt.bk{color:var(--bk)}
.ir{display:flex;gap:6px}
.ir input{flex:1;background:var(--s2);border:1px solid var(--bd);color:var(--tx);padding:7px 10px;border-radius:6px;font-size:13px;outline:none;font-family:inherit;transition:border-color .2s}
.ir input::placeholder{color:var(--tm)}
.ir input:focus{border-color:var(--ac)}
.ba{padding:7px 12px;border:none;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer;transition:opacity .15s,transform .1s;font-family:inherit}
.ba:active{transform:scale(.96)}
.ba.lv{background:var(--lv);color:#041a10}.ba.bk{background:var(--bk);color:#fff}
.ta{display:flex;flex-wrap:wrap;gap:5px;margin-top:9px;min-height:4px}
.tg{display:inline-flex;align-items:center;gap:3px;font-size:11px;padding:3px 9px;border-radius:20px;font-weight:600;transition:opacity .15s}
.tg:hover{opacity:.8}
.tg.lv{background:rgba(34,201,128,.1);color:var(--lv);border:1px solid rgba(34,201,128,.25)}
.tg.bk{background:rgba(240,82,82,.1);color:var(--bk);border:1px solid rgba(240,82,82,.25)}
.td{cursor:pointer;font-size:13px;line-height:1;margin-left:1px;opacity:.7}
.td:hover{opacity:1}

/* ACTION BAR */
.ab{max-width:860px;margin:0 auto 10px;display:flex;gap:10px;align-items:stretch}
.rb{flex:1;background:linear-gradient(135deg,#3a7bd5,#4f8ef7);color:#fff;border:none;border-radius:9px;padding:12px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;transition:opacity .15s,transform .1s;box-shadow:0 4px 14px rgba(79,142,247,.25)}
.rb:hover{opacity:.9}.rb:active{transform:scale(.98)}
.cd-box{background:var(--s1);border:1px solid var(--bd);border-radius:9px;padding:8px 14px;text-align:center;min-width:70px;display:flex;flex-direction:column;justify-content:center}
.cd-box .n{font-size:22px;font-weight:900;color:var(--ac);line-height:1}
.cd-box .l{font-size:10px;color:var(--tm);margin-top:2px;letter-spacing:.5px}

/* STATS */
.sb{max-width:860px;margin:0 auto 10px;background:var(--s1);border:1px solid var(--bd);border-radius:8px;padding:8px 14px;font-size:12px;color:var(--tm);display:flex;gap:16px;flex-wrap:wrap;align-items:center}
.sb b{color:var(--tx);font-weight:700}
.sb .dot{width:4px;height:4px;border-radius:50%;background:var(--bd2);flex-shrink:0}

/* NEWS LIST */
.nl{max-width:860px;margin:0 auto;display:flex;flex-direction:column;gap:6px}
.nd{background:var(--s1);border:1px solid var(--bd);border-radius:9px;padding:12px 14px;text-decoration:none;display:block;transition:border-color .15s,background .15s,transform .1s}
.nd:hover{border-color:var(--ac);background:var(--s2);transform:translateY(-1px)}
.nd:active{transform:translateY(0)}
.nd.ht{border-left:3px solid var(--lv);padding-left:12px}
.nd.ht:hover{border-color:var(--lv)}
.hb{font-size:10px;font-weight:800;color:var(--lv);margin-bottom:4px;letter-spacing:.5px;text-transform:uppercase}
.tt{font-size:13.5px;font-weight:600;line-height:1.5;color:var(--tx)}
.nd:hover .tt{color:#fff}
.mt{font-size:11px;color:var(--tm);margin-top:5px;display:flex;gap:8px;flex-wrap:wrap}
.mt span{display:flex;align-items:center;gap:3px}

/* SPIN */
.spin{display:inline-block;width:14px;height:14px;border:2px solid var(--bd2);border-top-color:var(--ac);border-radius:50%;animation:sp .7s linear infinite;vertical-align:middle;margin-right:4px}
@keyframes sp{to{transform:rotate(360deg)}}

/* DIVIDER */
.divider{max-width:860px;margin:14px auto 10px;display:flex;align-items:center;gap:10px;font-size:11px;color:var(--tm);font-weight:700;letter-spacing:.5px;text-transform:uppercase}
.divider::before,.divider::after{content:'';flex:1;height:1px;background:var(--bd)}
</style>
</head>
<body>

<div class="header">
  <h1>🎯 皇上曾奕瑋 <em>精選新聞</em></h1>
  <div class="sub">Taiwan News · Real-time</div>
</div>

<!-- TICKER -->
<div class="ticker-wrap">
  <div class="ticker-bar">
    <div class="ticker-label">TOP 15</div>
    <a class="ticker-body" id="ticker-body" href="#" target="_blank">
      <div class="ticker-hot" id="ticker-hot" style="display:none">🔥 命中關鍵字</div>
      <div class="ticker-title" id="ticker-title"><span class="spin"></span> 載入中...</div>
      <div class="ticker-meta" id="ticker-meta"></div>
    </a>
  </div>
  <div class="ticker-counter" id="ticker-counter" style="display:none"></div>
  <div class="ticker-prog"><div class="ticker-prog-bar" id="ticker-prog"></div></div>
  <div class="ticker-nav">
    <button onclick="tickerPrev()">&#8249;</button>
    <button onclick="tickerNext()">&#8250;</button>
  </div>
</div>

<!-- CONTROLS -->
<div class="cg">
  <div class="pn">
    <div class="pt lv">💚 喜好關鍵字</div>
    <div class="ir">
      <input id="li" placeholder="曾奕瑋、AI..." onkeydown="if(event.key==='Enter')aT('love')">
      <button class="ba lv" onclick="aT('love')">加入</button>
    </div>
    <div class="ta" id="lt"></div>
  </div>
  <div class="pn">
    <div class="pt bk">🚫 黑名單</div>
    <div class="ir">
      <input id="bi" placeholder="三立、爆料..." onkeydown="if(event.key==='Enter')aT('block')">
      <button class="ba bk" onclick="aT('block')">封鎖</button>
    </div>
    <div class="ta" id="bt"></div>
  </div>
</div>

<!-- ACTION BAR -->
<div class="ab">
  <button class="rb" onclick="hardRefresh()">🔄 立即更新新聞</button>
  <div class="cd-box">
    <div class="n" id="cd">60</div>
    <div class="l">自動刷新</div>
  </div>
</div>

<div class="sb" id="st"><span class="spin"></span>載入中</div>

<div class="divider">所有新聞</div>
<div class="nl" id="nl"></div>

<script>
var LOVE_KEY='love_list_v2', BLOCK_KEY='block_list_v2';
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
  document.getElementById('st').innerHTML=
    '<span>共 <b>'+all.length+'</b> 則</span>'+
    '<span class="dot"></span>'+
    '<span>顯示 <b>'+filtered.length+'</b> 則</span>'+
    '<span class="dot"></span>'+
    '<span style="color:var(--lv)">❤️ 命中 <b>'+hot+'</b></span>'+
    '<span class="dot"></span>'+
    '<span style="color:var(--bk)">🚫 過濾 <b>'+blocked+'</b></span>';

  document.getElementById('nl').innerHTML=filtered.map(function(n){
    return '<a class="nd'+(n.hot?' ht':'')+'" href="'+n.url+'" target="_blank">'+
      (n.hot?'<div class="hb">🔥 命中關鍵字</div>':'')+
      '<div class="tt">'+n.title+'</div>'+
      '<div class="mt">'+
      (n.src?'<span>📡 '+n.src+'</span>':'')+
      (n.date?'<span>🕐 '+fmt(n.date)+'</span>':'')+
      '</div></a>';
  }).join('');

  rTags();
  tickerInit();
}

// TICKER
function tickerInit(){
  var list=filtered.slice(0,15);
  if(!list.length)return;
  tIdx=0;
  document.getElementById('ticker-counter').style.display='block';
  tickerShow(list);
}

function tickerShow(list){
  var n=list[tIdx];
  var body=document.getElementById('ticker-body');
  body.href=n.url;
  document.getElementById('ticker-hot').style.display=n.hot?'block':'none';
  document.getElementById('ticker-title').textContent=n.title;
  document.getElementById('ticker-meta').innerHTML=
    (n.src?'📡 '+n.src:'')+(n.date?' · 🕐 '+fmt(n.date):'');
  document.getElementById('ticker-counter').textContent=(tIdx+1)+'/'+list.length;
  tickerStartProg(list);
}

function tickerStartProg(list){
  clearTimeout(tTimer);clearInterval(tPTimer);
  tPVal=0;document.getElementById('ticker-prog').style.width='0%';
  tPTimer=setInterval(function(){
    tPVal+=2;document.getElementById('ticker-prog').style.width=Math.min(tPVal,100)+'%';
  },100);
  tTimer=setTimeout(function(){
    tIdx=(tIdx+1)%list.length;
    tickerShow(list);
  },5000);
}

function tickerPrev(){
  var list=filtered.slice(0,15);if(!list.length)return;
  tIdx=(tIdx-1+list.length)%list.length;tickerShow(list);
}
function tickerNext(){
  var list=filtered.slice(0,15);if(!list.length)return;
  tIdx=(tIdx+1)%list.length;tickerShow(list);
}

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
function rT(type,i){if(type==='love')cL.splice(i,1);else cB.splice(i,1);save();render();}

function load(){
  cd=60;
  fetch('/news.json').then(function(r){return r.json();}).then(function(d){
    all=d;render();
  }).catch(function(){
    document.getElementById('st').innerHTML='<span style="color:var(--bk)">❌ 載入失敗，請重試</span>';
  });
}

function hardRefresh(){
  document.getElementById('st').innerHTML='<span class="spin"></span>正在從 Google News 重抓...';
  fetch('/api/refresh',{method:'POST'}).then(function(){ setTimeout(load,3000); }).catch(load);
}

setInterval(function(){cd--;document.getElementById('cd').textContent=cd;if(cd<=0)load();},1000);
window.onload=load;
</script>
</body>
</html>`));

app.listen(PORT, () => console.log('port ' + PORT));
