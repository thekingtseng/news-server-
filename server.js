const express = require('express');
const axios = require('axios');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 10000;
const CACHE_FILE = '/tmp/news_cache.json';

app.use(express.json());

let cache = [];

// 啟動馬上讀檔案，永遠不等
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

// 啟動馬上背景抓，不擋任何請求
refresh();
setInterval(refresh, 120000);

// 永遠瞬間回傳，就算空的也回
app.get('/news.json', (req, res) => res.json(cache));
app.post('/api/refresh', (req, res) => { refresh(); res.json({ ok: true }); });

app.get('/', (req, res) => res.send(`<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>🎯 皇上曾奕瑋精選新聞</title>
<style>
  :root {
    --bg-color: #f5f7fa;
    --card-bg: #ffffff;
    --text-color: #333333;
    --primary-color: #0066cc;
    --danger-color: #d9534f;
    --success-color: #1a9e6e;
    --border-color: #dde3ee;
    --meta-color: #777;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    background-color: var(--bg-color);
    color: var(--text-color);
    padding: 20px;
  }
  .container { max-width: 1000px; margin: 0 auto; }

  /* HEADER */
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px solid #ddd;
    padding-bottom: 12px;
    margin-bottom: 20px;
  }
  header h1 { font-size: 22px; margin: 0; }
  header h1 em { font-style: normal; color: var(--primary-color); }
  .status-bar { font-size: 13px; color: #666; text-align: right; line-height: 1.7; }
  .status-bar b { color: var(--text-color); }

  /* TICKER */
  .ticker-box {
    background: var(--card-bg);
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.07);
    margin-bottom: 20px;
    overflow: hidden;
    border: 1px solid var(--border-color);
  }
  .ticker-inner {
    display: flex;
    align-items: stretch;
    min-height: 76px;
  }
  .ticker-tag {
    background: var(--primary-color);
    color: #fff;
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 1px;
    padding: 0 16px;
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }
  .ticker-text {
    flex: 1;
    padding: 12px 16px;
    text-decoration: none;
    display: flex;
    flex-direction: column;
    justify-content: center;
    transition: background .15s;
  }
  .ticker-text:hover { background: #f0f6ff; }
  .ticker-hot-badge { font-size: 10px; font-weight: 800; color: var(--success-color); margin-bottom: 4px; }
  .ticker-title { font-size: 15px; font-weight: 700; color: var(--text-color); line-height: 1.5; }
  .ticker-text:hover .ticker-title { color: var(--primary-color); }
  .ticker-meta-row { font-size: 11px; color: var(--meta-color); margin-top: 5px; display: flex; gap: 12px; }
  .ticker-footer {
    display: flex;
    align-items: center;
    border-top: 1px solid var(--border-color);
    background: #fafbfc;
  }
  .ticker-count {
    font-size: 11px; font-weight: 800; color: var(--primary-color);
    padding: 6px 14px; border-right: 1px solid var(--border-color);
  }
  .ticker-prog-area { flex: 1; padding: 0 14px; }
  .ticker-prog-bg { background: #e5e7eb; border-radius: 2px; height: 3px; overflow: hidden; }
  .ticker-prog-fill { height: 100%; background: var(--primary-color); width: 0%; transition: width .1s linear; border-radius: 2px; }
  .ticker-nav { display: flex; }
  .ticker-nav button {
    background: none; border: none; border-left: 1px solid var(--border-color);
    color: #999; font-size: 18px; padding: 6px 15px; cursor: pointer; transition: background .15s, color .15s;
  }
  .ticker-nav button:hover { background: #eef3ff; color: var(--primary-color); }

  /* CONTROL PANEL */
  .control-panel {
    background: var(--card-bg);
    padding: 15px;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    margin-bottom: 15px;
  }
  .control-panel h3 { font-size: 14px; font-weight: 800; margin-bottom: 12px; display: flex; align-items: center; gap: 6px; }
  .control-panel h3.love { color: var(--success-color); }
  .control-panel h3.block { color: var(--danger-color); }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 15px; }
  @media(max-width:560px){ .two-col { grid-template-columns: 1fr; } }
  .input-group { display: flex; gap: 8px; }
  input[type="text"] {
    flex: 1; padding: 8px 10px; border: 1px solid #ccc; border-radius: 4px;
    font-size: 13px; outline: none; transition: border-color .2s;
  }
  input[type="text"]:focus { border-color: var(--primary-color); }
  button {
    padding: 8px 15px; border: none; border-radius: 4px;
    cursor: pointer; font-weight: 700; font-size: 13px;
    transition: opacity .15s;
  }
  button:hover { opacity: 0.88; }
  .btn-love { background: var(--success-color); color: #fff; }
  .btn-block { background: var(--danger-color); color: #fff; }
  .btn-refresh {
    width: 100%; padding: 12px; font-size: 15px;
    background: var(--primary-color); color: #fff;
    border-radius: 6px; margin-bottom: 15px;
  }
  .tags-container { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; min-height: 4px; }
  .tag {
    padding: 4px 10px; border-radius: 20px; font-size: 12px;
    font-weight: 700; display: flex; align-items: center; gap: 4px;
  }
  .tag.love { background: #e6f7f0; color: var(--success-color); border: 1px solid #b3e6d4; }
  .tag.block { background: #ffe6e6; color: var(--danger-color); border: 1px solid #ffcccc; }
  .tag .remove-btn { cursor: pointer; font-size: 14px; opacity: .6; }
  .tag .remove-btn:hover { opacity: 1; }

  /* STATS */
  .stats-bar {
    background: var(--card-bg); border-radius: 6px; border: 1px solid var(--border-color);
    padding: 8px 14px; font-size: 12px; color: #666; margin-bottom: 15px;
    display: flex; flex-wrap: wrap; gap: 12px; align-items: center;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  }
  .stats-bar b { color: var(--text-color); }
  .stat-pill {
    padding: 2px 9px; border-radius: 20px; font-size: 11px; font-weight: 700;
  }
  .stat-pill.love { background: #e6f7f0; color: var(--success-color); }
  .stat-pill.block { background: #ffe6e6; color: var(--danger-color); }
  .stats-bar .right { margin-left: auto; font-size: 11px; color: #aaa; }

  /* NEWS LIST */
  .news-list { display: flex; flex-direction: column; gap: 12px; }
  .news-card {
    background: var(--card-bg);
    padding: 15px;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    border-left: 5px solid var(--primary-color);
    transition: transform 0.2s, box-shadow 0.2s;
    text-decoration: none;
    display: block;
    color: var(--text-color);
  }
  .news-card:hover { transform: translateX(5px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
  .news-card.hot { border-left-color: var(--success-color); }
  .news-card.hot:hover { box-shadow: 0 4px 12px rgba(26,158,110,0.15); }
  .hot-badge { font-size: 10px; font-weight: 800; color: var(--success-color); margin-bottom: 5px; letter-spacing: .4px; }
  .news-title { font-size: 17px; font-weight: 600; line-height: 1.5; margin-bottom: 8px; }
  .news-card:hover .news-title { color: var(--primary-color); }
  .news-card.hot:hover .news-title { color: var(--success-color); }
  .news-meta {
    font-size: 12px; color: var(--meta-color);
    display: flex; gap: 12px; align-items: center; flex-wrap: wrap;
  }
  .media-badge {
    background: #e1ecf4; color: #39739d;
    padding: 2px 7px; border-radius: 3px; font-weight: 700; font-size: 11px;
  }
  .block-this-btn {
    background: none; border: none; color: #bbb; cursor: pointer;
    font-size: 11px; padding: 0; text-decoration: underline;
    margin-left: auto; transition: color .15s;
  }
  .block-this-btn:hover { color: var(--danger-color); }

  /* COUNTDOWN */
  .cd-wrap { display: flex; gap: 10px; align-items: center; }
  .cd-box {
    background: #fff; border: 1.5px solid var(--border-color); border-radius: 8px;
    padding: 8px 14px; text-align: center; min-width: 70px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  }
  .cd-box .n { font-size: 24px; font-weight: 900; color: var(--primary-color); line-height: 1; }
  .cd-box .l { font-size: 10px; color: #aaa; margin-top: 2px; }

  .spin { display:inline-block;width:14px;height:14px;border:2px solid #ddd;border-top-color:var(--primary-color);border-radius:50%;animation:sp .7s linear infinite;vertical-align:middle;margin-right:5px }
  @keyframes sp{to{transform:rotate(360deg)}}
  .divider { display:flex;align-items:center;gap:10px;font-size:11px;color:#aaa;font-weight:700;letter-spacing:.5px;margin-bottom:12px }
  .divider::before,.divider::after { content:'';flex:1;height:1px;background:#ddd }
</style>
</head>
<body>
<div class="container">

  <header>
    <div>
      <h1>🎯 皇上曾奕瑋 <em>精選新聞</em></h1>
    </div>
    <div class="status-bar">
      倒數 <b id="cd">60</b> 秒更新<br>
      上次更新：<span id="last-update">-</span>
    </div>
  </header>

  <!-- TICKER -->
  <div class="ticker-box">
    <div class="ticker-inner">
      <div class="ticker-tag">TOP 15</div>
      <a class="ticker-text" id="ticker-link" href="#" target="_blank">
        <div class="ticker-hot-badge" id="ticker-hot" style="display:none">🔥 命中喜好關鍵字</div>
        <div class="ticker-title" id="ticker-title"><span class="spin"></span>載入中...</div>
        <div class="ticker-meta-row" id="ticker-meta"></div>
      </a>
    </div>
    <div class="ticker-footer">
      <div class="ticker-count" id="ticker-count">- / -</div>
      <div class="ticker-prog-area"><div class="ticker-prog-bg"><div class="ticker-prog-fill" id="ticker-prog"></div></div></div>
      <div class="ticker-nav">
        <button onclick="tickerPrev()">&#8249;</button>
        <button onclick="tickerNext()">&#8250;</button>
      </div>
    </div>
  </div>

  <!-- CONTROLS -->
  <div class="two-col">
    <div class="control-panel">
      <h3 class="love">💚 喜好關鍵字（置頂顯示）</h3>
      <div class="input-group">
        <input type="text" id="li" placeholder="曾奕瑋、AI、台積電..." onkeydown="if(event.key==='Enter')aT('love')">
        <button class="btn-love" onclick="aT('love')">加入</button>
      </div>
      <div class="tags-container" id="lt"></div>
    </div>
    <div class="control-panel">
      <h3 class="block">🚫 封鎖黑名單（自動過濾）</h3>
      <div class="input-group">
        <input type="text" id="bi" placeholder="三立、爆料公社..." onkeydown="if(event.key==='Enter')aT('block')">
        <button class="btn-block" onclick="aT('block')">封鎖</button>
      </div>
      <div class="tags-container" id="bt"></div>
    </div>
  </div>

  <div class="cd-wrap">
    <button class="btn-refresh" onclick="hardRefresh()" style="flex:1;margin-bottom:0">🔄 立即更新新聞</button>
    <div class="cd-box">
      <div class="n" id="cd2">60</div>
      <div class="l">自動刷新</div>
    </div>
  </div>
  <br>

  <div class="stats-bar" id="st"><span class="spin"></span>載入中</div>

  <div class="divider">所有新聞</div>
  <div class="news-list" id="nl"></div>

</div>
<script>
var LOVE_KEY='love_v4', BLOCK_KEY='block_v4';
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
  filtered=all.filter(function(n){return !cB.some(function(w){return n.title.includes(w);});});
  filtered=filtered.map(function(n){return Object.assign({},n,{hot:cL.some(function(w){return n.title.includes(w);})});});
  filtered.sort(function(a,b){return b.hot-a.hot;});

  var hot=filtered.filter(function(n){return n.hot;}).length;
  var blocked=all.length-filtered.length;
  var now=new Date();
  document.getElementById('last-update').textContent=now.getHours()+':'+String(now.getMinutes()).padStart(2,'0');
  document.getElementById('st').innerHTML=
    '共 <b>'+all.length+'</b> 則 &nbsp;|&nbsp; 顯示 <b>'+filtered.length+'</b> 則 &nbsp;'+
    '<span class="stat-pill love">❤️ 命中 '+hot+'</span> '+
    '<span class="stat-pill block">🚫 過濾 '+blocked+'</span>'+
    '<span class="right">每2分鐘自動抓取</span>';

  document.getElementById('nl').innerHTML=filtered.map(function(n){
    var src = n.src||'';
    return '<a class="news-card'+(n.hot?' hot':'')+'" href="'+n.url+'" target="_blank">'+
      (n.hot?'<div class="hot-badge">🔥 命中喜好關鍵字</div>':'')+
      '<div class="news-title">'+n.title+'</div>'+
      '<div class="news-meta">'+
      (src?'<span class="media-badge">'+src+'</span>':'')+
      (n.date?'<span>🕐 '+fmt(n.date)+'</span>':'')+
      (src?'<button class="block-this-btn" onclick="blockSrc(event,\''+src+'\')">🚫 封鎖這家媒體</button>':'')+
      '</div></a>';
  }).join('');

  rTags();
  tickerInit();
}

function blockSrc(e,src){
  e.preventDefault();e.stopPropagation();
  if(!cB.includes(src)){cB.push(src);save();render();}
}

function tickerInit(){
  var list=filtered.slice(0,15);
  if(!list.length)return;
  tIdx=0; tickerShow(list);
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
  document.getElementById('ticker-count').textContent=(tIdx+1)+'/'+list.length;
  tickerStartProg(list);
}
function tickerStartProg(list){
  clearTimeout(tTimer);clearInterval(tPTimer);
  tPVal=0;document.getElementById('ticker-prog').style.width='0%';
  tPTimer=setInterval(function(){tPVal+=2;document.getElementById('ticker-prog').style.width=Math.min(tPVal,100)+'%';},100);
  tTimer=setTimeout(function(){tIdx=(tIdx+1)%list.length;tickerShow(list);},5000);
}
function tickerPrev(){var l=filtered.slice(0,15);if(!l.length)return;tIdx=(tIdx-1+l.length)%l.length;tickerShow(l);}
function tickerNext(){var l=filtered.slice(0,15);if(!l.length)return;tIdx=(tIdx+1)%l.length;tickerShow(l);}

function rTags(){
  document.getElementById('lt').innerHTML=cL.map(function(t,i){
    return '<span class="tag love">💚 '+t+' <span class="remove-btn" onclick="rT(\'love\','+i+')">×</span></span>';
  }).join('');
  document.getElementById('bt').innerHTML=cB.map(function(t,i){
    return '<span class="tag block">🚫 '+t+' <span class="remove-btn" onclick="rT(\'block\','+i+')">×</span></span>';
  }).join('');
}
function aT(type){
  var id=type==='love'?'li':'bi',v=document.getElementById(id).value.trim();
  if(!v)return;
  if(type==='love')cL.push(v);else cB.push(v);
  document.getElementById(id).value='';save();render();
}
function rT(type,i){if(type==='love')cL.splice(i,1);else cB.splice(i,1);save();render();}

function load(retry){
  retry=retry||0; cd=60;
  fetch('/news.json').then(function(r){return r.json();}).then(function(d){
    if(!d||!d.length){
      if(retry<6){
        document.getElementById('st').innerHTML='<span class="spin"></span>伺服器啟動中... ('+(retry+1)+'/6)';
        setTimeout(function(){load(retry+1);},2000);
      } else {
        document.getElementById('st').innerHTML='<span style="color:var(--danger-color)">❌ 無法取得新聞，請按「立即更新」</span>';
      }
      return;
    }
    all=d; render();
  }).catch(function(){
    document.getElementById('st').innerHTML='<span style="color:var(--danger-color)">❌ 載入失敗，請重試</span>';
  });
}

function hardRefresh(){
  document.getElementById('st').innerHTML='<span class="spin"></span>正在從 Google News 重抓...';
  fetch('/api/refresh',{method:'POST'}).then(function(){setTimeout(load,3000);}).catch(load);
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
