const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());

let cache = [];
let lastFetch = 0;

async function refresh() {
    try {
        const r = await axios.get(
            'https://news.google.com/rss?hl=zh-TW&gl=TW&ceid=TW:zh-Hant',
            { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 8000 }
        );
        const items = r.data.split('<item>');
        const news = [];
        for (let i = 1; i < items.length && news.length < 60; i++) {
            const t = items[i].match(/<title>([\s\S]*?)<\/title>/);
            const l = items[i].match(/<link>([\s\S]*?)<\/link>/);
            const d = items[i].match(/<pubDate>([\s\S]*?)<\/pubDate>/);
            if (!t || !l) continue;
            const raw = t[1].replace('<![CDATA[','').replace(']]>','').trim();
            const dash = raw.lastIndexOf(' - ');
            const title = dash > 0 ? raw.substring(0, dash) : raw;
            const src   = dash > 0 ? raw.substring(dash + 3) : '';
            news.push({ title, url: l[1].trim(), src, date: d ? d[1].trim() : '' });
        }
        if (news.length) { cache = news; lastFetch = Date.now(); }
        console.log('抓到 ' + news.length + ' 則');
    } catch(e) { console.log('抓取失敗: ' + e.message); }
}

// 啟動馬上抓，之後每 2 分鐘更新
refresh();
setInterval(refresh, 120000);

app.get('/news.json', (req, res) => {
    res.json(cache);
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
h1{text-align:center;font-size:17px;color:#fff;margin-bottom:10px}
h1 b{color:#3b82f6}
#bar{background:#161a23;border:1px solid #2a3044;border-radius:6px;padding:7px 12px;font-size:12px;color:#64748b;margin-bottom:10px;display:flex;justify-content:space-between}
#bar b{color:#e2e8f0}
#bar span{color:#3b82f6;font-weight:700;font-size:14px}
.n{background:#161a23;border:1px solid #2a3044;border-radius:7px;padding:11px 13px;margin-bottom:7px;text-decoration:none;display:block;transition:border-color .15s}
.n:hover{border-color:#3b82f6}
.n .t{font-size:14px;font-weight:600;color:#e2e8f0;line-height:1.45}
.n .m{font-size:11px;color:#64748b;margin-top:5px}
.spin{display:inline-block;width:18px;height:18px;border:2px solid #2a3044;border-top-color:#3b82f6;border-radius:50%;animation:s .7s linear infinite;vertical-align:middle;margin-right:5px}
@keyframes s{to{transform:rotate(360deg)}}
</style>
</head>
<body>
<h1>🎯 台灣新聞 <b>即時列表</b></h1>
<div id="bar"><span id="st"><span class="spin"></span>載入中</span><span id="cd">30</span></div>
<div id="list"></div>
<script>
var all=[], cur=0, cd=30;

function fmt(s){
  if(!s)return'';
  var d=new Date(s),m=Math.floor((new Date()-d)/60000);
  if(isNaN(d))return'';
  if(m<1)return'剛剛';if(m<60)return m+'分前';
  if(m<1440)return Math.floor(m/60)+'小時前';
  return(d.getMonth()+1)+'/'+(d.getDate());
}

function show(){
  if(!all.length)return;
  var s=all.slice(cur,cur+15);
  if(s.length<15){cur=0;s=all.slice(0,15);}else cur+=15;
  if(cur>=all.length)cur=0;
  document.getElementById('list').innerHTML=s.map(function(n){
    return '<a class="n" href="'+n.url+'" target="_blank">'+
      '<div class="t">'+n.title+'</div>'+
      '<div class="m">'+(n.src?'📡 '+n.src+' · ':'')+fmt(n.date)+'</div></a>';
  }).join('');
  document.getElementById('st').textContent='共 '+all.length+' 則';
}

function load(){
  fetch('/news.json').then(function(r){return r.json();}).then(function(d){
    if(d&&d.length){all=d;show();}
    else document.getElementById('st').textContent='暫無資料';
  }).catch(function(){document.getElementById('st').innerHTML='<span style="color:#ef4444">❌ 失敗</span>';});
}

setInterval(function(){
  cd--;document.getElementById('cd').textContent=cd;
  if(cd<=0){cd=30;show();}
},1000);

load();
</script>
</body>
</html>`));

app.listen(PORT, () => console.log('port ' + PORT));
