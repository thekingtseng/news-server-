const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());

let blockList = ['三立', '民視', 'SETN', 'FTV'];
let loveList = ['正妹', '台積電', '晶片', 'AI', '曾奕瑋'];

let cache = null;
let cacheTime = 0;
let isFetching = false;

function extractImage(itemText) {
    const m = itemText.match(/media:content[^>]+url="([^"]+)"/)
        || itemText.match(/<enclosure[^>]+url="([^"]+)"/)
        || itemText.match(/<img[^>]+src="([^"]+)"/);
    return m ? m[1] : null;
}

function extractSource(title) {
    const i = title.lastIndexOf(' - ');
    return i !== -1 ? title.substring(i + 3) : '';
}

async function doFetch() {
    if (isFetching) return;
    isFetching = true;
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
    const baseUrls = [
        'https://news.google.com/rss?hl=zh-TW&gl=TW&ceid=TW:zh-Hant',
        'https://news.google.com/rss/topics/CAAqIQgKIhtDQkFTRGdvSUwyMHZNRFZ4ZERCV0VnSlVVa0F0S0FBUAE?hl=zh-TW&gl=TW&ceid=TW:zh-Hant',
        'https://news.google.com/rss/topics/CAAqIQgKIhtDQkFTRGdvSUwyMHZNRFp4WkRjU0VnSlVVa0F0S0FBUAE?hl=zh-TW&gl=TW&ceid=TW:zh-Hant',
        'https://news.google.com/rss/topics/CAAqIQgKIhtDQkFTRGdvSUwyMHZNRGR6TVdZU0VnSlVVa0F0S0FBUAE?hl=zh-TW&gl=TW&ceid=TW:zh-Hant',
        'https://news.google.com/rss/topics/CAAqIQgKIhtDQkFTRGdvSUwyMHZNR3B6YldZd0VnSlVVa0F0S0FBUAE?hl=zh-TW&gl=TW&ceid=TW:zh-Hant',
        'https://news.google.com/rss/topics/CAAqIQgKIhtDQkFTRGdvSUwyMHZNRWx6Y0d3U0VnSlVVa0F0S0FBUAE?hl=zh-TW&gl=TW&ceid=TW:zh-Hant'
    ];
    const urls = [...baseUrls, ...loveList.map(k =>
        'https://news.google.com/rss/search?q=' + encodeURIComponent(k) + '&hl=zh-TW&gl=TW&ceid=TW:zh-Hant'
    )];

    try {
        const responses = await Promise.all(
            urls.map(url => axios.get(url, { headers: { 'User-Agent': userAgent }, timeout: 7000 }).catch(() => null))
        );

        let allItems = [];
        responses.forEach(r => {
            if (r && r.data) {
                const parts = r.data.split('<item>');
                for (let i = 1; i < parts.length; i++) allItems.push(parts[i]);
            }
        });

        let total = allItems.length, blocked = 0, loved = 0;
        const seen = new Set(), news = [];

        allItems.forEach(item => {
            const tM = item.match(/<title>([\s\S]*?)<\/title>/);
            const lM = item.match(/<link>([\s\S]*?)<\/link>/);
            const dM = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
            if (!tM || !lM) return;

            const rawTitle = tM[1].replace('<![CDATA[', '').replace(']]>', '').trim();
            const link = lM[1].trim();
            const pubDate = dM ? dM[1].trim() : null;

            if (seen.has(link)) { total--; return; }
            if (blockList.some(w => rawTitle.includes(w))) { blocked++; return; }

            const isLoved = loveList.some(w => rawTitle.includes(w));
            if (isLoved) loved++;

            const source = extractSource(rawTitle);
            const title = source ? rawTitle.replace(' - ' + source, '') : rawTitle;
            seen.add(link);
            news.push({ title, link, isLoved, image: extractImage(item), source, pubDate });
        });

        news.sort((a, b) => {
            if (b.isLoved !== a.isLoved) return b.isLoved - a.isLoved;
            return (b.pubDate ? new Date(b.pubDate) : 0) - (a.pubDate ? new Date(a.pubDate) : 0);
        });

        cache = { stats: { total, blocked, loved, visible: news.length }, news, blockList, loveList };
        cacheTime = Date.now();
        console.log('抓取完成：' + news.length + ' 則');
    } catch (e) {
        console.log('抓取失敗：' + e.message);
    } finally {
        isFetching = false;
    }
}

// 啟動馬上抓，之後每 60 秒自動背景更新
doFetch();
setInterval(doFetch, 60000);

app.get('/api/news', (req, res) => {
    if (cache) {
        res.json({ ...cache, fresh: Date.now() - cacheTime < 65000 });
    } else {
        // 快取還沒好，等它
        const wait = setInterval(() => {
            if (cache) {
                clearInterval(wait);
                res.json({ ...cache, fresh: true });
            }
        }, 300);
        setTimeout(() => { clearInterval(wait); if (!res.headersSent) res.status(503).json({ error: 'timeout' }); }, 15000);
    }
});

app.post('/api/config', (req, res) => {
    if (req.body.blockList) blockList = req.body.blockList;
    if (req.body.loveList) loveList = req.body.loveList;
    cache = null;
    doFetch();
    res.json({ success: true, blockList, loveList });
});

app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>台灣新聞</title>
<style>
:root{--bg:#0d0f14;--s:#161a23;--s2:#1e2433;--bd:#2a3044;--ac:#3b82f6;--lv:#10b981;--bk:#ef4444;--tx:#e2e8f0;--tm:#64748b}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:sans-serif;background:var(--bg);color:var(--tx);padding:12px}
h1{text-align:center;font-size:20px;margin-bottom:14px}
h1 span{color:var(--ac)}

#sw{position:relative;max-width:860px;margin:0 auto 16px;border-radius:10px;overflow:hidden;background:var(--s);min-height:240px}
.sl{display:none;position:relative}
.sl.on{display:block}
.sl img{width:100%;height:240px;object-fit:cover;display:block}
.sl .ph{width:100%;height:240px;background:#1e2433;display:flex;align-items:center;justify-content:center;font-size:40px;color:#2a3044}
.sl .ov{position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,.85));padding:30px 16px 14px}
.sl .ov .bk{font-size:10px;font-weight:700;color:var(--lv);margin-bottom:4px}
.sl .ov a{font-size:16px;font-weight:700;color:#fff;text-decoration:none;display:block;line-height:1.4}
.sl .ov .src{font-size:11px;color:#94a3b8;margin-top:4px}
#sc{position:absolute;top:10px;right:12px;background:rgba(0,0,0,.6);color:#fff;font-size:12px;font-weight:700;padding:3px 9px;border-radius:20px;display:none}
#sp{position:absolute;bottom:0;left:0;height:3px;background:var(--ac);transition:width .1s linear}
.nav{position:absolute;top:50%;transform:translateY(-50%);background:rgba(0,0,0,.5);color:#fff;border:none;font-size:22px;width:34px;height:34px;border-radius:50%;cursor:pointer;display:none;align-items:center;justify-content:center}
.nav:hover{background:var(--ac)}
#pb{left:8px}.#nb{right:8px}

.cg{display:grid;grid-template-columns:1fr 1fr;gap:10px;max-width:860px;margin:0 auto 12px}
@media(max-width:560px){.cg{grid-template-columns:1fr}}
.pn{background:var(--s);border:1px solid var(--bd);border-radius:8px;padding:12px}
.pt{font-size:12px;font-weight:700;margin-bottom:8px}
.pt.lv{color:var(--lv)}.pt.bk{color:var(--bk)}
.ir{display:flex;gap:6px}
.ir input{flex:1;background:var(--s2);border:1px solid var(--bd);color:var(--tx);padding:7px 10px;border-radius:5px;font-size:13px;outline:none}
.ir input:focus{border-color:var(--ac)}
.ba{padding:7px 12px;border:none;border-radius:5px;font-size:13px;font-weight:700;cursor:pointer}
.ba.lv{background:var(--lv);color:#fff}.ba.bk{background:var(--bk);color:#fff}
.ta{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}
.tg{display:inline-flex;align-items:center;gap:3px;font-size:11px;padding:2px 8px;border-radius:20px;font-weight:600}
.tg.lv{background:rgba(16,185,129,.12);color:var(--lv);border:1px solid rgba(16,185,129,.3)}
.tg.bk{background:rgba(239,68,68,.12);color:var(--bk);border:1px solid rgba(239,68,68,.3)}
.td{cursor:pointer;font-size:13px}

.ab{max-width:860px;margin:0 auto 12px;display:flex;gap:10px;align-items:center}
.rb{flex:1;background:var(--ac);color:#fff;border:none;border-radius:7px;padding:11px;font-size:15px;font-weight:700;cursor:pointer}
.rb:hover{opacity:.85}
.cb{background:var(--s);border:1px solid var(--bd);border-radius:7px;padding:8px 14px;text-align:center;min-width:72px}
.cb .n{font-size:20px;font-weight:700;color:var(--ac);line-height:1}
.cb .l{font-size:10px;color:var(--tm);margin-top:1px}

.sb{max-width:860px;margin:0 auto 12px;background:var(--s);border:1px solid var(--bd);border-radius:7px;padding:9px 14px;font-size:12px;color:var(--tm);display:flex;gap:14px;flex-wrap:wrap}
.sb span b{color:var(--tx)}

.nl{max-width:860px;margin:0 auto;display:flex;flex-direction:column;gap:8px}
.cd{background:var(--s);border:1px solid var(--bd);border-radius:8px;display:flex;overflow:hidden;text-decoration:none;transition:border-color .15s}
.cd:hover{border-color:var(--ac)}
.cd.ht{border-color:rgba(16,185,129,.4)}
.cd.ht:hover{border-color:var(--lv)}
.cd img{width:100px;min-height:72px;flex-shrink:0;object-fit:cover}
.cp{width:100px;min-height:72px;flex-shrink:0;background:var(--s2);display:flex;align-items:center;justify-content:center;font-size:24px;color:var(--bd)}
.cb2{flex:1;padding:10px 12px;display:flex;flex-direction:column;justify-content:center}
.cbg{font-size:10px;font-weight:700;color:var(--lv);margin-bottom:3px}
.ct{font-size:13px;font-weight:600;line-height:1.45;color:var(--tx)}
.cm{display:flex;gap:8px;margin-top:5px;font-size:11px;color:var(--tm);flex-wrap:wrap}

.spin{display:inline-block;width:24px;height:24px;border:3px solid var(--bd);border-top-color:var(--ac);border-radius:50%;animation:sp .7s linear infinite}
@keyframes sp{to{transform:rotate(360deg)}}
.ld{text-align:center;padding:30px;color:var(--tm);font-size:13px}
</style>
</head>
<body>
<h1>🎯 台灣新聞 <span>自訂瀏覽器</span></h1>

<div id="sw">
  <div class="ld"><div class="spin"></div><br>載入中...</div>
  <div id="sc"></div>
  <button class="nav" id="pb" onclick="sP()">&#8249;</button>
  <button class="nav" id="nb" onclick="sN()">&#8250;</button>
  <div id="sp" style="width:0%"></div>
</div>

<div class="cg">
  <div class="pn">
    <div class="pt lv">💚 喜好關鍵字</div>
    <div class="ir">
      <input type="text" id="li" placeholder="台積電、曾奕瑋" onkeydown="if(event.key==='Enter')aT('love')">
      <button class="ba lv" onclick="aT('love')">加入</button>
    </div>
    <div class="ta" id="lt"></div>
  </div>
  <div class="pn">
    <div class="pt bk">🚫 黑名單</div>
    <div class="ir">
      <input type="text" id="bi" placeholder="三立、爆料公社" onkeydown="if(event.key==='Enter')aT('block')">
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

<div class="sb" id="st"><span>⏳ 載入中...</span></div>
<div class="nl" id="nl"></div>

<script>
var cB=[],cL=[],sI=0,sT=null,pT=null,pV=0,cd=60;

function fmt(s){
  if(!s)return'';
  var d=new Date(s),now=new Date(),m=Math.floor((now-d)/60000);
  if(isNaN(d))return'';
  if(m<1)return'剛剛';
  if(m<60)return m+'分前';
  if(m<1440)return Math.floor(m/60)+'小時前';
  return(d.getMonth()+1)+'/'+(d.getDate());
}

function bSS(arr){
  arr=arr.slice(0,15);
  var w=document.getElementById('sw');
  w.querySelectorAll('.sl').forEach(function(e){e.remove()});
  var sc=document.getElementById('sc'),pb=document.getElementById('pb'),nb=document.getElementById('nb');
  arr.forEach(function(n,i){
    var d=document.createElement('div');
    d.className='sl'+(i===0?' on':'');
    var img=n.image?'<img src="'+n.image+'" onerror="this.style.display=\'none\'" alt="">':'<div class="ph">📰</div>';
    d.innerHTML=img+'<div class="ov">'+(n.isLoved?'<div class="bk">🔥 命中關鍵字</div>':'')+
      '<a href="'+n.link+'" target="_blank">'+n.title+'</a>'+
      '<div class="src">'+(n.source?'📡 '+n.source:'')+(n.pubDate?' 🕐 '+fmt(n.pubDate):'')+
      '</div></div>';
    w.insertBefore(d,sc);
  });
  sI=0;
  if(arr.length>1){sc.style.display='block';pb.style.display='flex';nb.style.display='flex';}
  uC();sA();
}

function uC(){var t=document.querySelectorAll('.sl').length;document.getElementById('sc').textContent=(sI+1)+' / '+t;}
function sP(){cA();sS(sI-1);sA();}
function sN(){cA();sS(sI+1);sA();}
function sS(i){
  var sl=document.querySelectorAll('.sl');
  if(!sl.length)return;
  sl.forEach(function(e){e.classList.remove('on')});
  sI=((i%sl.length)+sl.length)%sl.length;
  sl[sI].classList.add('on');uC();
}
function sA(){
  cA();pV=0;document.getElementById('sp').style.width='0%';
  pT=setInterval(function(){pV+=2;if(pV>100)pV=100;document.getElementById('sp').style.width=pV+'%';},100);
  sT=setTimeout(function(){sS(sI+1);sA();},5000);
}
function cA(){clearTimeout(sT);clearInterval(pT);}

function load(force){
  cd=60;
  fetch(force?'/api/news?r=1':'/api/news')
    .then(function(r){return r.json();})
    .then(function(d){
      cB=d.blockList;cL=d.loveList;rT();
      var s=d.stats;
      document.getElementById('st').innerHTML=
        '<span>📰 <b>'+s.total+'</b></span><span>👁 <b>'+s.visible+'</b></span>'+
        '<span>❤️ <b>'+s.loved+'</b></span><span>🚫 <b>'+s.blocked+'</b></span>';
      bSS(d.news);
      var h='';
      d.news.forEach(function(n){
        var th=n.image?'<img src="'+n.image+'" loading="lazy" alt="" onerror="this.style.display=\'none\'">':
          '<div class="cp">📰</div>';
        h+='<a class="cd'+(n.isLoved?' ht':'')+'" href="'+n.link+'" target="_blank">'+th+
          '<div class="cb2">'+(n.isLoved?'<div class="cbg">🔥 命中</div>':'')+
          '<div class="ct">'+n.title+'</div>'+
          '<div class="cm">'+(n.source?'<span>📡 '+n.source+'</span>':'')+
          (n.pubDate?'<span>🕐 '+fmt(n.pubDate)+'</span>':'')+
          '</div></div></a>';
      });
      document.getElementById('nl').innerHTML=h;
    })
    .catch(function(){document.getElementById('st').innerHTML='<span style="color:#ef4444">❌ 失敗，請重試</span>';});
}

function rT(){
  document.getElementById('lt').innerHTML=cL.map(function(t,i){
    return '<span class="tg lv">💚 '+t+' <span class="td" onclick="rTag(\'love\','+i+')">×</span></span>';}).join('');
  document.getElementById('bt').innerHTML=cB.map(function(t,i){
    return '<span class="tg bk">🚫 '+t+' <span class="td" onclick="rTag(\'block\','+i+')">×</span></span>';}).join('');
}

function aT(type){
  var id=type==='love'?'li':'bi',v=document.getElementById(id).value.trim();
  if(!v)return;
  if(type==='love')cL.push(v);else cB.push(v);
  document.getElementById(id).value='';sC();
}
function rTag(type,i){if(type==='love')cL.splice(i,1);else cB.splice(i,1);sC();}
function sC(){
  fetch('/api/config',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({blockList:cB,loveList:cL})}).then(function(){load(true);});
}

setInterval(function(){cd--;document.getElementById('cd').textContent=cd;if(cd<=0)load(false);},1000);
window.onload=function(){load(false);};
</script>
</body>
</html>`);
});

app.listen(PORT, function(){
    console.log('Server running on port ' + PORT);
});
