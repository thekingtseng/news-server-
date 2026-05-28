const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 10000;

// 黑名單媒體
const blockList = ['三立', '民視', 'SETN', 'FTV'];

app.get('/', async (req, res) => {
    try {
        // 1. 向 Google News 抓取 RSS 資料
        const response = await axios.get('https://news.google.com/rss?hl=zh-TW&gl=TW&ceid=TW:zh-Hant', {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        
        const rssText = response.data;
        
        // 2. 用最暴力的字串切開法，抓出每一則新聞的 <item> 區塊
        const items = rssText.split('<item>');
        let newsHtml = '';
        let showCount = 0;

        // 跳過第一個，因為第一個 item 之前是頻道資訊
        for (let i = 1; i < items.length; i++) {
            const item = items[i];
            
            // 抓取標題 <title>...</title>
            const titleMatch = item.match(/<title>([\s\S]*?)<\/title>/);
            // 抓取連結 <link>...</link>
            const linkMatch = item.match(/<link>([\s\S]*?)<\/link>/);
            
            if (titleMatch && linkMatch) {
                const title = titleMatch[1].replace('<![CDATA[', '').replace(']]>', '');
                const link = linkMatch[1];
                
                // 檢查是否命中黑名單
                const isBlocked = blockList.some(word => title.includes(word));
                
                if (!isBlocked) {
                    showCount++;
                    newsHtml += `
                    <div style="background:white; padding:15px; margin-bottom:12px; border-radius:8px; box-shadow:0 2px 4px rgba(0,0,0,0.1); border-left:5px solid #0066cc;">
                        <a href="${link}" target="_blank" style="color:#0066cc; text-decoration:none; font-weight:bold; font-size:18px;">${title}</a>
                    </div>`;
                }
            }
        }

        // 3. 直接輸出純 HTML
        res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>我的獨立新聞後端</title>
            <style>body { font-family: sans-serif; background: #f0f2f5; padding: 20px; }</style>
        </head>
        <body>
            <h2>🎯 後端 Server 運作中（已自動物理過濾民視、三立）</h2>
            <p>目前即時安全頭條數量：${showCount} 則</p>
            <hr>
            ${newsHtml}
        </body>
        </html>
        `);
    } catch (error) {
        res.send(`<h2>後端伺服器連線正常，但暫時無法取得 Google 新聞：${error.message}</h2>`);
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
