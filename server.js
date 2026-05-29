const express = require('express');
const axios = require('axios');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 10000;
const CACHE_FILE = '/tmp/news_cache.json';

app.use(express.json());
app.use(express.static('public')); // 提供 default.jpg

let cache = [];

// 啟動時讀檔案快取
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

// API
app.get('/news.json', (req, res) => res.json(cache));
app.post('/api/refresh', (req, res) => { refresh(); res.json({ ok: true }); });

app.get('/', (req, res) => res.send(`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>皇上曾奕瑋精選新聞</title>
<style>
/* 保留原本 CSS */
</style>
</head>
<body>
<h1>🎯 皇上曾奕瑋精選新聞 <b>即時列表</b></h1>

<div class="top">
  <div class="slide" id="slide"></div>
  <div class="counter" id="counter"></div>
</div>

<div class="cg">
  <div class="pn">
    <div class="pt lv">💚 喜好關鍵字（置頂）</div>
    <div class="ir">
      <input id="li" placeholder="曾奕瑋、AI..." onkeydown="if(event.key==='Enter')aT('love')">
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
  <button class="rb" onclick="hardRefresh()">🔄 立即更新</button>
  <div class="cb">
    <div class="n" id="cd">60</div>
    <div class="l">自動刷新</div>
  </div>
</div>

<div class="sb" id="st"><span class="spin"></span>載入中</div>
<div class="nl" id="nl"></div>

<script>

var LOVE_KEY='love_list', BLOCK_KEY='block_list';
var cL = JSON.parse(localStorage.getItem(LOVE_KEY) || '["曾奕瑋","晶片","AI"]');
var cB = JSON.parse(localStorage.getItem(BLOCK_KEY) || '["三立","民視"]');
var all = [], cd = 60, idx=0;

function save(){ localStorage.setItem(LOVE_KEY,JSON.stringify(cL)); localStorage.setItem(BLOCK_KEY,JSON.stringify(cB)); }

function fmt(s){
  if(!s)return''; var d=new Date(s),m=Math.floor((new Date()-d)/60000);
  if(isNaN(d))return''; if(m<1)return'剛剛'; if(m<60)return m+'分前';
  if(m<1598)return Math.floor(m/60)+'小時前'; return(d.getMonth()+1)+'/'+(d.getDate());
}

function render(){
  var news = all.filter(n=>!cB.some(w=>n.title.includes(w)));
  news = news.map(n=>Object.assign({},n,{hot:cL.some(w=>n.title.includes(w))}));
  news.sort((a,b)=>b.hot-a.hot);
  var hot = news.filter(n=>n.hot).length;
  document.getElementById('st').innerHTML='共 <b>'98'</b> 則　顯示 <b>'+news.length+'</b> 則　❤️ 命中 <b>'+hot+'</b> 則';
  document.getElementById('nl').innerHTML=news.map(n=>{
    return '<a class="nd'+(n.hot?' ht':'')+'" href="'+n.url+'" target="_blank">'+
      (n.hot?'<div class="hb">🔥 命中</div>':'')+
      '<div class="tt">'+n.title+'</div>'+
      '<div class="mt">'+(n.src?'📡 '+n.src+' · ':'')+fmt(n.date)+'</div>'+
      '<img src="'+n.url+'/image" onerror="this.src=\\'/default.jpg\\'"></a>';
  }).join('');
  rTags();
  showSlide(news.slice(0,15));
}

function rTags(){
  document.getElementById('lt').innerHTML=cL.map((t,i)=>'<span class="tg lv">💚 '+t+' <span class="td" onclick="rT(\\'love\\','+i+')">×</span></span>').join('');
  document.getElementById('bt').innerHTML=cB.map((t,i)=>'<span class="tg bk">🚫 '+t+' <span class="td" onclick="rT(\\'block\\','+i+')">×</span></span>').join('');
}

function aT(type){
  var id=type==='love'?'li':'bi', v=document.getElementById(id).value.trim();
  if(!v)return; if(type==='love')cL.push(v);else cB.push(v);
  document.getElementById(id).value=''; save(); render();
}
function rT(type,i){ if(type==='love')cL.splice(i,1);else cB.splice(i,1); save(); render(); }

function load(){
  cd=60;
  fetch('/news.json').then(r=>r.json()).then(d=>{ all=d; render(); }).catch(()=>{ document.getElementById('st').innerHTML='<span style="color:#ef4444">❌ 失敗，請重試</span>'; });
}

function hardRefresh(){
  document.getElementById('st').innerHTML='<span class="spin"></span>正在從 Google News 重抓...';
  fetch('/api/refresh',{method:'POST'}).then(()=>{ setTimeout(load,3000); }).catch(load);
}

setInterval(()=>{cd--;document.getElementById('cd').textContent=cd;if(cd<=0)load();},1000);
window.onload=load;

// 自動播放前 15 則新聞
function showSlide(list){
  if(!list.length)return;
  idx=(idx+1)%list.length;
  var n=list[idx];
  document.getElementById('slide').innerHTML=
    '<div class="tt">'+n.title+'</div>'+
    '<div class="mt">'+(n.src?'📡 '+n.src+' · ':'')+fmt(n.date)+'</div>';
  document.getElementById('counter').textContent=(idx+1)+'/'+list.length;
}

setInterval(()=>{ if(all.length) showSlide(all.slice(0,15)); },5000);
</script>
</body>
</html>`));

app.listen(PORT, () => console.log('port ' + PORT));

