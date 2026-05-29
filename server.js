const express = require('express');
const axios = require('axios');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 10000;
const CACHE_FILE = '/tmp/news_cache.json';

app.use(express.json());

let cache = [];

// 啟動時讀取本地檔案快取
try {
    const saved = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    if (saved.length) { cache = saved; console.log('讀取快取：' + cache.length + ' 則'); }
} catch(e) {}

// 安全的圖片擷取 Regex
function extractImage(itemText) {
    const mediaMatch = itemText.match(/media:content[^>]+url=["']([^"']+)["']/i);
    if (mediaMatch) return mediaMatch[1];
    const enclosureMatch = itemText.match(/<enclosure[^>]+url=["']([^"']+)["']/i);
    if (enclosureMatch) return enclosureMatch[1];
    const imgMatch = itemText.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (imgMatch) return imgMatch[1];
    return null;
}

async function refresh() {
    try {
        const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
        
        // 同時向 Google 請求 3 个不同的熱門新聞 RSS 源，用來衝高總新聞量（突破 30 則限制）
        const urls = [
            'https://news.google.com/rss?hl=zh-TW&gl=TW&ceid=TW:zh-Hant', // 重點首頁
            'https://news.google.com/rss/topics/CAAqIQgKIhtDQkFTRGdvSUwyMHZNRFZ4ZERCV0VnSlVVa0F0S0FBUAE?hl=zh-TW&gl=TW&ceid=TW:zh-Hant', // 焦點新聞
            'https://news.google.com/rss/topics/CAAqIQgKIhtDQkFTRGdvSUwyMHZNRFp4WkRjU0VnSlVVa0F0S0FBUAE?hl=zh-TW&gl=TW&ceid=TW:zh-Hant'  // 台灣本地
        ];

        const requests = urls.map(url => 
            axios.get(url, { headers: { 'User-Agent': userAgent }, timeout: 4000 }).catch(() => null)
        );
        
        const responses = await Promise.all(requests);
        const news = [];
        const seenUrls = new Set(); // 後端去重疊機制

        responses.forEach(r => {
            if (!r || !r.data) return;
            r.data.split('<item>').slice(1).forEach(it => {
                const tM = it.match(/<title>([\s\S]*?)<\/title>/);
                const lM = it.match(/<link>([\s\S]*?)<\/link>/);
                const dM = it.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
                if (!tM || !lM) return;
                
                const url = lM[1].trim();
                if (seenUrls.has(url)) return; // 跳過重複的網址

                const raw = tM[1].replace('<![CDATA[','').replace(']]>','').trim();
                const dash = raw.lastIndexOf(' - ');
                const img = extractImage(it);

                seenUrls.add(url);
                news.push({
                    title: dash > 0 ? raw.substring(0, dash) : raw,
                    src:   dash > 0 ? raw.substring(dash + 3) : '',
                    url:   url,
                    date:  dM ? dM[1].trim() : '',
                    img:   img
                });
            });
        });

        if (news.length) {
            cache = news;
            fs.writeFileSync(CACHE_FILE, JSON.stringify(news));
            console.log('更新成功，共撈取到：' + news.length + ' 則新聞');
        }
    } catch(e) { console.log('重抓失敗:' + e.message); }
}

// 伺服器啟動立刻異步重整一次
refresh();
setInterval(refresh, 60000); // 後端每 60 秒開背景執行緒重刷快取檔案

// 直接回傳快取，速度最快
app.get('/news.json', (req, res) => res.json(cache));

app.post('/api/refresh', async (req, res) => { 
    await refresh(); 
    res.json({ ok: true, count: cache.length }); 
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
.tg{display:inline-flex;align-items:center;gap:3px;font-size:11px;padding:2px 8px;border-radius:20px;font-weight:600}
.tg.lv{background:rgba(16,185,129,.12);color:#10b981;border:1px solid rgba(16,185,129,.3)}
.tg.bk{background:rgba(239,68,68,.12);color:#ef4444;border:1px solid rgba(239,68,68,.3)}
.td{cursor:pointer;font-size:13px}
.ab{max-width:860px;margin:0 auto 10px;display:flex;gap:10px;align-items:center}
.rb{flex:1;background:#3b82f6;color:#fff;border:none;border-radius:7px;padding:11px;font-size:15px;font-weight:700;cursor:pointer}
.rb:hover{opacity:.85}
.rb:disabled{background:#64748b;cursor:not-allowed}
.cb{background:#161a23;border:1px solid #2a3044;border-radius:7px;padding:8px 12px;text-align:center;min-width:68px}
.cb .n{font-size:20px;font-weight:700;color:#3b82f6;line-height:1}
.cb .l{font-size:10px;color:#64748b;margin-top:1px}
.sb{max-width:860px;margin:0 auto 10px;background:#161a23;border:1px solid #2a3044;border-radius:6px;padding:7px 12px;font-size:12px;color:#64748b}
.sb b{color:#e2e8f0}

/* 極速多圖列表排版 */
.nl{max-width:860px;margin:0 auto;display:flex;flex-direction:column;gap:6px}
.nd{background:#161a23;border:1px solid #2a3044;border-radius:7px;text-decoration:none;display:flex;overflow:hidden;transition:border-color .15s}
.nd:hover{border-color:#3b82f6}
.nd.ht{border-left:3px solid #10b981}
.nd-thumb{width:110px;min-height:78px;object-fit:cover;flex-shrink:0;display:block}
.nd-thumb-placeholder{width:110px;min-height:78px;background:#1e2433;display:flex;align-items:center;justify-content:center;font-size:24px;color:#2a3044;flex-shrink:0}
.nd-body{flex:1;padding:10px 12px;display:flex;flex-direction:column;justify-content:center}
.nd .hb{font-size:10px;font-weight:700;color:#10b981;margin-bottom:3px}
.nd .tt{font-size:13px;font-weight:600;line-height:1.4;color:#e2e8f0}
.nd .mt{font-size:11px;color:#64748b;margin-top:4px}
.spin{display:inline-block;width:16px;height:16px;border:2px solid #2a3044;border-top-color:#3b82f6;border-radius:50%;animation:sp .7s linear infinite;vertical-align:middle;margin-right:4px}
@keyframes sp{to{transform:rotate(360deg)}}
</style>
</head>
<body>
<h1>🎯 台灣新聞 <b>即時列表</b></h1>

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
  <button class="rb" id="rb" onclick="hardRefresh()">🔄 立即更新</button>
  <div class="cb">
    <div class="n" id="cd">60</div>
    <div class="l">自動刷新</div>
  </div>
</div>

<div class="sb" id="st"><span class="spin"></span>載入中</div>
<div class="nl" id="nl"></div>

<script>
var LOVE_KEY='love_list', BLOCK_KEY='block_list';
var cL = JSON.parse(localStorage.getItem(LOVE_KEY) || '["台積電","晶片","AI","曾奕瑋","正妹"]');
var cB = JSON.parse(localStorage.getItem(BLOCK_KEY) || '["三立","民視","SETN","FTV"]');
var all = [], cd = 60;

function save(){ localStorage.setItem(LOVE_KEY,JSON.stringify(cL)); localStorage.setItem(BLOCK_KEY,JSON.stringify(cB)); }

function hiE(el, placeholderClass) {
  el.style.display = 'none';
  var p = el.parentElement.querySelector('.' + placeholderClass);
  if(p) p.style.display = 'flex';
}

function fmt(s){
  if(!s)return'';
  var d=new Date(s),m=Math.floor((new Date()-d)/60000);
  if(isNaN(d))return'';
  if(m<1)return'剛剛';if(m<60)return m+'分前';
  if(m<1440)return Math.floor(m/60)+'小時前';
  return(d.getMonth()+1)+'/'+(d.getDate());
}

function render(){
  // 全部在前端執行高效率過濾與排序，完全不拖累網頁速度
  var news = all.filter(function(n){ return !cB.some(function(w){ return n.title.includes(w); }); });
  news = news.map(function(n){ return Object.assign({},n,{hot: cL.some(function(w){ return n.title.includes(w); })}); });
  news.sort(function(a,b){ return b.hot - a.hot; });
  var hot = news.filter(function(n){return n.hot;}).length;
  
  document.getElementById('st').innerHTML='共 <b>'+all.length+'</b> 則新聞　顯示 <b>'+news.length+'</b> 則　❤️ 命中 <b>'+hot+'</b> 則';
  
  document.getElementById('nl').innerHTML=news.map(function(n){
    // 使用 loading="lazy" 實施圖片延遲加載，網頁開啟速度快 5 倍
    var thumbHtml = n.img
      ? '<img class="nd-thumb" src="'+n.img+'" loading="lazy" onerror="hiE(this, \'nd-thumb-placeholder\')"><div class="nd-thumb-placeholder" style="display:none">📰</div>'
      : '<div class="nd-thumb-placeholder">📰</div>';

    return '<a class="nd'+(n.hot?' ht':'')+'" href="'+n.url+'" target="_blank">'+
      thumbHtml +
      '<div class="nd-body">' +
        (n.hot?'<div class="hb">🔥 命中</div>':'')+
        '<div class="tt">'+n.title+'</div>'+
        '<div class="mt">'+(n.src?'📡 '+n.src+' · ':'')+fmt(n.date)+'</div>' +
      '</div></a>';
  }).join('');
  rTags();
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
  var id=type==='love'?'li':'bi', v=document.getElementById(id).value.trim();
  if(!v)return;
  if(type==='love')cL.push(v);else cB.push(v);
  document.getElementById(id).value='';
  save(); render();
}
function rT(type,i){
  if(type==='love')cL.splice(i,1);else cB.splice(i,1);
  save(); render();
}

function load(){
  cd=60;
  document.getElementById('cd').textContent=cd;
  fetch('/news.json').then(function(r){return r.json();}).then(function(d){
    all = d;
    render();
  }).catch(function(){
    document.getElementById('st').innerHTML='<span style="color:#ef4444">❌ 讀取快取失敗</span>';
  });
}

function hardRefresh(){
  var btn = document.getElementById('rb');
  btn.disabled = true;
  btn.textContent = '🔄 正在重抓中...';
  document.getElementById('st').innerHTML='<span class="spin"></span>正在向 Google 多個頻道併發重抓（約等 2 秒）...';
  
  fetch('/api/refresh',{method:'POST'})
    .then(function(r){ return r.json(); })
    .then(function(){ load(); })
    .catch(function(){ load(); })
    .finally(function(){
       btn.disabled = false;
       btn.textContent = '🔄 立即更新';
    });
}

setInterval(function(){
  cd--;
  document.getElementById('cd').textContent=cd;
  if(cd<=0) load();
},1000);

window.onload=load;
</script>
</body>
</html>`));

app.listen(PORT, () => console.log('port ' + PORT));
