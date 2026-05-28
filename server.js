const express = require('express');
const axios = require('axios');
const { XMLParser } = require('fast-xml-parser');
const app = express();
const PORT = process.env.PORT || 10000;

// 後端過濾黑名單（物理蒸發這四家媒體）
const blockList = ['三立', '民視', 'SETN', 'FTV'];

app.get('/', async (req, res) => {
    // 1. 後端直接向 Google News RSS 發出請求抓取即時新聞
    const response = await axios.get('https://news.google.com/rss?hl=zh-TW&gl=TW&ceid=TW:zh-Hant');
    const parser = new XMLParser();
    const jsonObj = parser.parse(response.data);
    const items = jsonObj.rss.channel.item || [];

    // 2. 透過後端邏輯進行黑名單完全過濾
    let filteredNews = items.filter(item => {
        const title = item.title || '';
        return !blockList.some(word => title.includes(word));
    });

    // 3. 後端將資料直接渲染成漂漂亮亮、適合手機閱讀的 HTML 網頁
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
            h2 { color: #1c1e21; }
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
});

app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});
