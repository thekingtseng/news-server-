const express = require('express');
const axios = require('axios');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 10000;
const CACHE_FILE = '/tmp/news_cache.json';

app.use(express.json());

// 提供預設圖片 (請在專案根目錄建立 public/default.jpg)
app.use(express.static('public'));

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
<title>台灣新聞</title>
<style>
/* 保留原本 CSS */
</style>
</head>
<body>
<h1>🎯 台灣新聞 <b>即時列表</b></h1>

<div class="top">
  <div class="slide" id="slide"></div>
  <div class="counter" id="counter"></div>
</div>

<div class="cg">
  <!-- 喜好關鍵字 / 黑名單面板 -->
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
// 前端 JS 略，保留你原本的邏輯
</script>
</body>
</html>`));

app.listen(PORT, () => console.log('port ' + PORT));
