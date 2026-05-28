const express = require('express');
const axios = require('axios');
const { XMLParser } = require('fast-xml-parser');
const app = express();
const PORT = process.env.PORT || 10000;

const blockList = ['三立', '民視', 'SETN', 'FTV'];

app.get('/', async (req, res) => {
    try {
        // 加上 Headers 偽裝成一般手機瀏覽器，防止被 Google 拒絕連線
        const response = await axios.get('https://news.google.com/rss?hl=zh-TW&gl=TW&ceid=TW:zh-Hant', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
            }
        });
        
        const parser = new XMLParser();
        const jsonObj = parser.parse(response.data);
        const items = jsonObj.rss.channel.item || [];

        let filteredNews = items.filter(item => {
            const title = item.title || '';
            return !blockList.some(word => title.includes(word));
        });

        let htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>我的獨立新聞後端</title>
            <style>
                body { font-family: sans-serif; background: #f0f2f5; padding: 20px; color: #1c1e21; }
                .card { background: white; padding: 15px; margin-bottom: 12px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-left: 5px solid #0066cc; }
                a { color: #0066cc; text-decoration: none; font-weight: bold; font-size: 18px; }
            </style>
        </head>
        <body>
            <h2>🎯 後端 Server 運作中（已自動物理過濾民視、三立）</h2>
            <p>目前即時安全頭條數量：${filteredNews.length} 則</p>
            <hr>
            ${filteredNews.map(news => `
                <div class="card">
                    <a href="${news.link}" target="_blank">${news.title}</a>
                </div>
            `).join('')}
        </body>
        </html>
        `;
        res.send(htmlContent);
    } catch (error) {
        // 保險絲發揮作用，就算暫時抓不到，Server 也不會當機跳 502
        res.send(`<h2>⚠️ 後端伺服器運作中，但目前向 Google 抓取資料時遇到阻礙，請重新整理網頁試試。</h2><p>錯誤訊息：${error.message}</p>`);
    }
});

app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});
