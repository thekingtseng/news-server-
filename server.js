const express = require('express');
const axios   = require('axios');
const fs      = require('fs');
const path    = require('path'); // 引入 path 模組防禦路徑異常
const app     = express();
const PORT    = process.env.PORT || 10000;
// 🛠️ 將快取路由移至專案根目錄，防禦 Render 等免費平台上 /tmp 權限可能遭抹除或限制的隱憂
const CACHE_FILE = path.join(__dirname, 'nc.json');

app.use(express.json());

// ─── 快取 ───────────────────────────────────────────
let cache = [];

try {
    if (fs.existsSync(CACHE_FILE)) {
        const s = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
        if (Array.isArray(s) && s.length > 0) {
            cache = s;
            console.log('[CACHE] 成功加載歷史快取：' + cache.length + ' 則');
        }
    }
} catch(e) {}

// ─── RSS 抓取 ────────────────────────────────────────
function parseRSS(xml) {
    const news = [];
    if (!xml || !xml.includes('<item>')) return news;
    xml.split('<item>').slice(1).forEach(function(it) {
        const tM = it.match(/<title>([\s\S]*?)<\/title>/);
        const lM = it.match(/<link>([\s\S]*?)<\/link>/);
        const dM = it.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
        if (!tM || !lM) return;
        const raw  = tM[1].replace('<![CDATA[','').replace(']]>','').trim();
        const dash = raw.lastIndexOf(' - ');
        news.push({
            title: dash > 0 ? raw.substring(0, dash).trim() : raw,
            src:   dash > 0 ? raw.substring(dash+3).trim() : '焦點情報',
            url:   lM[1].trim(),
            date:  dM ? dM[1].trim() : new Date().toUTCString()
        });
    });
    return news;
}

async function doRefresh() {
    try {
        // ⚡️ 全面將 User-Agent 升級為現代高階瀏覽器偽裝，徹底粉碎 Google 反爬蟲機制的 IP 封鎖
        const r = await axios.get(
            'https://news.google.com/rss?hl=zh-TW&gl=TW&ceid=TW:zh-Hant',
            { 
                headers:{ 
                    'User-Agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                    'Accept': 'application/rss+xml, application/xml;q=0.9, */*;q=0.8'
                }, 
                timeout:10000 
            }
        );
        const news = parseRSS(r.data);
        if (news.length > 0) {
            cache = news;
            try { fs.writeFileSync(CACHE_FILE, JSON.stringify(news), 'utf8'); } catch(e) {}
            console.log('[RSS] 戰略數據更新完畢：' + news.length + ' 則');
            return true;
        }
    } catch(e) {
        console.log('[RSS] 提取情報失敗: ' + e.message);
    }
    return false;
}

// 伺服器啟動在背景無感秒抓，每 2 分鐘自動背景更新
setTimeout(doRefresh, 100);
setInterval(doRefresh, 120000);

// ─── 安全序列化：防止破壞 HTML/JS ───────────────────
function safeJSON(data) {
    return JSON.stringify(data)
        .replace(/<\/script>/gi, '<\\/script>')
        .replace(/
