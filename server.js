const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 10000;
app.use(express.json());
// 🚫 預設黑名單媒體
let blockList = ['三立', '民視', 'SETN', 'FTV'];
// 💚 預設喜好關鍵字
let loveList = ['正妹', '台積電', '晶片', 'AI', '曾奕瑋'];
app.get('/api/news', async (req, res) => {
try {
const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
let urls = [
'https://news.google.com/rss?hl=zh-TW&gl=TW&ceid=TW:zh-Hant',
'https://news.google.com/rss/topics/CAAqIQgKIhtDQkFTRGdvSUwyMHZNRFZ4ZERCV0VnSlVVa0F0S0FBUAE?hl=zh-TW&gl=TW&ceid=TW:zh-Hant',
'https://news.google.com/rss/topics/CAAqIQgKIhtDQkFTRGdvSUwyMHZNRFp4WkRjU0VnSlVVa0F0S0FBUAE?hl=zh-TW&gl=TW&ceid=TW:zh-Hant',
'https://news.google.com/rss/topics/CAAqIQgKIhtDQkFTRGdvSUwyMHZNRGR6TVdZU0VnSlVVa0F0S0FBUAE?hl=zh-TW&gl=TW&ceid=TW:zh-Hant',
'https://news.google.com/rss/topics/CAAqIQgKIhtDQkFTRGdvSUwyMHZNR3B6YldZd0VnSlVVa0F0S0FBUAE?hl=zh-TW&gl=TW&ceid=TW:zh-Hant',
'https://news.google.com/rss/topics/CAAqIQgKIhtDQkFTRGdvSUwyMHZNRWx6Y0d3U0VnSlVVa0F0S0FBUAE?hl=zh-TW&gl=TW&ceid=TW:zh-Hant'
];
loveList.forEach(keyword => {
const encodedKeyword = encodeURIComponent(keyword);
urls.push(https://news.google.com/rss/search?q=${encodedKeyword}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant);
});
const requests = urls.map(url =>
axios.get(url, { headers: { 'User-Agent': userAgent } }).catch(() => null)
);
const responses = await Promise.all(requests);
let allItems = [];
responses.forEach(response => {
if (response && response.data) {
const items = response.data.split('<item>');
for (let i = 1; i < items.length; i++) {
allItems.push(items[i]);
}
}
});
let totalCount = allItems.length;
let blockedCount = 0;
let lovedCount = 0;
let finalNewsList = [];
const seenUrls = new Set();
allItems.forEach(item => {
const titleMatch = item.match(/<title>([\s\S]*?)</title>/);
const linkMatch = item.match(/<link>([\s\S]*?)</link>/);
// 嘗試抓取真實新聞縮圖
const imgMatch = item.match(/<(?:media:content|enclosure)[^>]*url="'["']/i);
if (titleMatch && linkMatch) {
const title = titleMatch[1].replace('<![CDATA[', '').replace(']]>', '');
const link = linkMatch[1];
const img = imgMatch ? imgMatch[1] : 'https://images.unsplash.com/photo-1504711434269-d045842886f4?auto=format&fit=crop&w=400&q=60';
if (seenUrls.has(link)) {
totalCount--;
return;
}
const isBlocked = blockList.some(word => title.includes(word));
if (isBlocked) {
blockedCount++;
return;
}
const isLoved = loveList.some(word => title.includes(word));
if (isLoved) lovedCount++;
seenUrls.add(link);
finalNewsList.push({ title, link, img, isLoved });
}
});
finalNewsList.sort((a, b) => b.isLoved - a.isLoved);
res.json({
stats: { total: totalCount, blocked: blockedCount, loved: lovedCount, visible: finalNewsList.length },
hero: finalNewsList.slice(0, 15),
list: finalNewsList.slice(15),
blockList,
loveList
});
} catch (error) {
res.status(500).json({ error: error.message });
}
});
app.post('/api/config', (req, res) => {
if (req.body.blockList) blockList = req.body.blockList;
if (req.body.loveList) loveList = req.body.loveList;
res.json({ success: true, blockList, loveList });
});
app.get('/', (req, res) => {
res.send(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>我的 AI 萬能新聞過濾伺服器</title>
<style>
body { font-family: sans-serif; background: #f0f2f5; padding: 15px; margin: 0; color: #1c1e21; }
.box { background: #fff; padding: 15px; border-radius: 8px; margin-bottom: 15px; box-shadow: 0 2px 4px rgba(0,0,0,.1); }
.input-group { display: flex; gap: 8px; margin-top: 10px; }
input { flex: 1; padding: 10px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; }
button { padding: 10px 15px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; }
.btn-ref { background: #0066cc; color: #fff; width: 100%; font-size: 16px; margin-bottom: 10px; }
.btn-love { background: #10b981; color: #fff; }
.btn-block { background: #e41e3f; color: #fff; }
.tag-area { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.t-love { background: #f0fdf4; color: #10b981; padding: 4px 8px; border-radius: 15px; font-size: 13px; border: 1px solid #bbf7d0; }
.t-block { background: #fff0f0; color: #e41e3f; padding: 4px 8px; border-radius: 15px; font-size: 13px; border: 1px solid #ffcccc; }
.t-del { cursor: pointer; margin-left: 4px; font-weight: bold; }
/* Yahoo 風格大圖與卡片 */
.hero-container { position: relative; height: 260px; overflow: hidden; border-radius: 8px; margin-bottom: 15px; box-shadow: 0 2px 4px rgba(0,0,0,.1); background: #000; }
.hero-slide { position: absolute; width: 100%; height: 100%; display: none; }
.hero-slide.active { display: block; animation: fade 0.5s; }
@keyframes fade { from { opacity: 0.6; } to { opacity: 1; } }
.hero-slide img { width: 100%; height: 100%; object-fit: cover; opacity: 0.85; }
.hero-title { position: absolute; bottom: 0; left: 0; right: 0; padding: 25px 15px 15px; background: linear-gradient(transparent, rgba(0,0,0,0.9)); color: white; margin: 0; font-size: 18px; font-weight: bold; }
.hero-badge { position: absolute; top: 10px; left: 10px; background: #10b981; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; z-index: 2; }
.card { display: flex; background: white; padding: 12px; margin-bottom: 12px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-left: 5px solid #0066cc; align-items: center; }
.card.hot { border-left: 5px solid #10b981; background: #f6fdfa; }
.card img { width: 90px; height: 75px; object-fit: cover; margin-right: 12px; border-radius: 4px; }
.card-content { flex: 1; }
a { color: #1c1e21; text-decoration: none; font-weight: bold; font-size: 16px; line-height: 1.4; display: block; }
.card.hot a { color: #005500; }
.badge { font-size: 12px; font-weight: bold; color: #10b981; margin-bottom: 5px; }
</style>
</head>
<body>
<div class="box" style="text-align:center;">
<h2>🎯 台灣新聞自訂瀏覽器 (完整大圖版)</h2>
<button class="btn-ref" onclick="fetchNews()">🔄 立即手動更新新聞</button>
<div style="font-size:13px; color:#65676b;">網頁將在 <span id="cd" style="color:red; font-weight:bold;">60</span> 秒後自動無感刷新</div>
<div id="stats" style="font-size:13px; font-weight:bold; margin-top:8px; color:#1c1e21;">正在跨海調度 Google 數據庫與圖片中...</div>
</div>
<div class="box">
<h4 style="margin:0; color:#10b981;">💚 喜好關鍵字（自動觸發深度搜尋模式）</h4>
<div class="input-group">
<input type="text" id="love-in" placeholder="例如：台積電、曾奕瑋">
<button class="btn-love" onclick="addTag('love')">加入</button>
</div>
<div class="tag-area" id="love-tags"></div>
</div>
<div class="box">
<h4 style="margin:0; color:#e41e3f;">🚫 阻隔黑名單（物理蒸發）</h4>
<div class="input-group">
<input type="text" id="block-in" placeholder="例如：三立、爆料">
<button class="btn-block" onclick="addTag('block')">封鎖</button>
</div>
<div class="tag-area" id="block-tags"></div>
</div>
<div id="hero-area" class="hero-container" style="display:none;"></div>
<div id="news-list"></div>
<script>
let currentBlock = [], currentLove = [], cd = 60;
let carouselTimer = null;
function fetchNews() {
document.getElementById('stats').innerText = '核心大腦正同步搜索常規頻道與關鍵字專線...';
fetch('/api/news')
.then(res => res.json())
.then(data => {
currentBlock = data.blockList;
currentLove = data.loveList;
renderTags();
document.getElementById('stats').innerText = `📊 全網透視報告 -> 撈取總計: ${data.stats.total} 則 | 顯示: ${data.stats.visible} 則 | ❤️ 命中: ${data.stats.loved} 則 | 🚫 蒸發: ${data.stats.blocked} 則`;
// 渲染大圖輪播 (取前 15 則)
if (data.hero && data.hero.length > 0) {
document.getElementById('hero-area').innerHTML = data.hero.map((n, i) => `
<div class="hero-slide \${i === 0 ? 'active' : ''}">
<a href="\${n.link}" target="_blank">
${n.isLoved ? '<div class="hero-badge">🔥 命中關鍵字</div>' : ''}
<img src="\${n.img}" onerror="this.src='[https://images.unsplash.com/photo-1504711434269-d045842886f4?auto=format&fit=crop&w=400&q=60](https://images.unsplash.com/photo-1504711434269-d045842886f4?auto=format&fit=crop&w=400&q=60)'">
<p class="hero-title">${n.title}</p>
</a>
</div>
`).join('');
document.getElementById('hero-area').style.display = 'block';
} else {
document.getElementById('hero-area').style.display = 'none';
}
// 渲染列表 (剩下的新聞)
let html = '';
data.list.forEach(n => {
html += `<div class="card \${n.isLoved?'hot':''}">
<img src="\${n.img}" onerror="this.src='[https://images.unsplash.com/photo-1504711434269-d045842886f4?auto=format&fit=crop&w=400&q=60](https://images.unsplash.com/photo-1504711434269-d045842886f4?auto=format&fit=crop&w=400&q=60)'">
<div class="card-content">
${n.isLoved?'<div class="badge">🔥 命中關鍵字</div>':''}
<a href="\${n.link}" target="_blank">${n.title}</a>
</div>
</div>`;
});
document.getElementById('news-list').innerHTML = html;
cd = 60; // 刷新後重置倒數計時
// 重新啟動輪播動畫 (每5秒切換一次)
if(carouselTimer) clearInterval(carouselTimer);
carouselTimer = setInterval(rotateHero, 5000);
});
}
function rotateHero() {
let active = document.querySelector('.hero-slide.active');
if(!active) return;
let next = active.nextElementSibling;
if(!next || !next.classList.contains('hero-slide')) {
next = document.querySelector('.hero-slide'); // 播到底就回到第一張
}
active.classList.remove('active');
next.classList.add('active');
}
function renderTags() {
document.getElementById('love-tags').innerHTML = currentLove.map((t, i) => `<span class="t-love">💚 ${t} <span class="t-del" onclick="removeTag('love',\${i})">×</span></span>`).join('');
document.getElementById('block-tags').innerHTML = currentBlock.map((t, i) => `<span class="t-block">🚫 ${t} <span class="t-del" onclick="removeTag('block',\${i})">×</span></span>`).join('');
}
function addTag(type) {
let input = document.getElementById(type === 'love' ? 'love-in' : 'block-in');
let val = input.value.trim();
if(!val) return;
if(type === 'love') currentLove.push(val);
else currentBlock.push(val);
input.value = '';
saveConfig();
}
function removeTag(type, index) {
if(type === 'love') currentLove.splice(index, 1);
else currentBlock.splice(index, 1);
saveConfig();
}
function saveConfig() {
fetch('/api/config', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ blockList: currentBlock, loveList: currentLove })
}).then(() => fetchNews());
}
// 每秒執行倒數計時
setInterval(() => {
cd--;
document.getElementById('cd').innerText = cd;
if(cd <= 0) fetchNews();
}, 1000);
window.onload = fetchNews;
</script>
</body>
</html>
`);
});
app.listen(PORT, () => {
console.log(`Server is running on port ${PORT}`);
});
