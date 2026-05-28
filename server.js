const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 10000;

// 允許後端解析前端傳來的 JSON 資料
app.use(express.json());

// 後端記憶體：預設的黑名單與喜好關鍵字
let blockList = ['三立', '民視', 'SETN', 'FTV'];
let loveList = ['正妹', '台積電', '晶片', 'AI'];

// API 1: 讓前端獲取過濾後的新聞資料與當前設定
app.get('/api/news', async (req, res) => {
    try {
        const response = await axios.get('https://news.google.com/rss?hl=zh-TW&gl=TW&ceid=TW:zh-Hant', {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        
        const rssText = response.data;
        const items = rssText.split('<item>');
        
        let totalCount = items.length - 1;
        let blockedCount = 0;
        let lovedCount = 0;
        let finalNewsList = [];

        for (let i = 1; i < items.length; i++) {
            const item = items[i];
            const titleMatch = item.match(/<title>([\s\S]*?)<\/title>/);
            const linkMatch = item.match(/<link>([\s\S]*?)<\/link>/);
            
            if (titleMatch && linkMatch) {
                const title = titleMatch[1].replace('<![CDATA[', '').replace(']]>', '');
                const link = linkMatch[1];
                
                // 檢查是否命中黑名單
                const isBlocked = blockList.some(word => title.includes(word));
                if (isBlocked) {
                    blockedCount++;
                    continue;
                }
                
                // 檢查是否命中喜好關鍵字
                const isLoved = loveList.some(word => title.includes(word));
                if (isLoved) lovedCount++;

                finalNewsList.push({ title, link, isLoved });
            }
        }

        // 喜好新聞排在最前面
        finalNewsList.sort((a, b) => b.isLoved - a.isLoved);

        res.json({
            stats: { total: totalCount, blocked: blockedCount, loved: lovedCount, visible: finalNewsList.length },
            news: finalNewsList,
            blockList,
            loveList
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API 2: 接收前端傳來的新設定
app.post('/api/config', (req, res) => {
    if (req.body.blockList) blockList = req.body.blockList;
    if (req.body.loveList) loveList = req.body.loveList;
    res.json({ success: true, blockList, loveList });
});

// 主網頁：包含動態控制面板與自動刷新 JavaScript
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
            .card { background: white; padding: 15px; margin-bottom: 12px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-left: 5px solid #0066cc; }
            .card.hot { border-left: 5px solid #10b981; background: #f6fdfa; }
            a { color: #0066cc; text-decoration: none; font-weight: bold; font-size: 17px; }
            .card.hot a { color: #10b981; }
            .badge { font-size: 12px; font-weight: bold; color: #10b981; margin-bottom: 5px; }
        </style>
    </head>
    <body>
        <div class="box" style="text-align:center;">
            <h2>🎯 台灣新聞自訂瀏覽器</h2>
            <button class="btn-ref" onclick="fetchNews()">🔄 立即手動更新新聞</button>
            <div style="font-size:13px; color:#65676b;">網頁將在 <span id="cd" style="color:red; font-weight:bold;">60</span> 秒後自動無感刷新</div>
            <div id="stats" style="font-size:13px; font-weight:bold; margin-top:8px; color:#1c1e21;">正在通訊中...</div>
        </div>

        <div class="box">
            <h4 style="margin:0; color:#10b981;">💚 喜好關鍵字（置頂推薦）</h4>
            <div class="input-group">
                <input type="text" id="love-in" placeholder="例如：台積電、正妹">
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

        <div id="news-list"></div>

        <script>
            let currentBlock = [], currentLove = [], cd = 60;

            function fetchNews() {
                document.getElementById('stats').innerText = '正在向後端要求最新過濾數據...';
                fetch('/api/news')
                    .then(res => res.json())
                    .then(data => {
                        currentBlock = data.blockList;
                        currentLove = data.loveList;
                        renderTags();
                        
                        document.getElementById('stats').innerText = \`📊 後端隔離報告 -> 總共: \${data.stats.total} 則 | 顯示: \${data.stats.visible} 則 | ❤️ 命中: \${data.stats.loved} 則 | 🚫 蒸發: \${data.stats.blocked} 則\`;
                        
                        let html = '';
                        data.news.forEach(n => {
                            html += \`<div class="card \${n.isLoved?'hot':''}">
                                \${n.isLoved?'<div class="badge">🔥 命中喜好關鍵字優先推薦</div>':''}
                                <a href="\${n.link}" target="_blank">\${n.title}</a>
                            </div>\`;
                        });
                        document.getElementById('news-list').innerHTML = html;
                        cd = 60; // 刷新後重置倒數計時
                    });
            }

            function renderTags() {
                document.getElementById('love-tags').innerHTML = currentLove.map((t, i) => \`<span class="t-love">💚 \${t} <span class="t-del" onclick="removeTag('love',\${i})">×</span></span>\`).join('');
                document.getElementById('block-tags').innerHTML = currentBlock.map((t, i) => \`<span class="t-block">🚫 \${t} <span class="t-del" onclick="removeTag('block',\${i})">×</span></span>\`).join('');
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

            // 每秒執行倒數計時，到了 0 就自動觸發更新
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
