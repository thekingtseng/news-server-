const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());

let blockList = ['三立', '民視', 'SETN', 'FTV'];
let loveList = ['正妹', '台積電', '晶片', 'AI', '曾奕瑋'];

app.get('/api/news', async (req, res) => {
    try {
        // 同步抓取多個頻道
        const urls = [
            'https://news.google.com/rss?hl=zh-TW&gl=TW&ceid=TW:zh-Hant',
            'https://news.google.com/rss/topics/CAAqIQgKIhtDQkFTRGdvSUwyMHZNRFZ4ZERCV0VnSlVVa0F0S0FBUAE?hl=zh-TW&gl=TW&ceid=TW:zh-Hant'
        ];
        
        const responses = await Promise.all(urls.map(url => axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }).catch(() => null)));
        
        let allItems = [];
        responses.forEach(r => r && r.data && allItems.push(...r.data.split('<item>').slice(1)));

        let finalNewsList = [];
        allItems.forEach(item => {
            const titleMatch = item.match(/<title>([\s\S]*?)<\/title>/);
            const linkMatch = item.match(/<link>([\s\S]*?)<\/link>/);
            // 嘗試抓取圖片（Google RSS 簡化版）
            const imgMatch = item.match(/media:content[^>]*url=["'](.*?)["']/);
            
            if (titleMatch && linkMatch) {
                const title = titleMatch[1].replace('<![CDATA[', '').replace(']]>', '');
                const link = linkMatch[1];
                const img = imgMatch ? imgMatch[1] : 'https://picsum.photos/400/200'; // 預設圖
                
                if (!blockList.some(w => title.includes(w))) {
                    const isLoved = loveList.some(w => title.includes(w));
                    finalNewsList.push({ title, link, img, isLoved });
                }
            }
        });

        // 核心邏輯：喜好置頂
        finalNewsList.sort((a, b) => b.isLoved - a.isLoved);

        res.json({
            hero: finalNewsList[0], // 第一則設為大圖熱門新聞
            list: finalNewsList.slice(1), // 其他設為列表
            blockList, loveList
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ... (config API 部分保持不變，略過以節省空間)
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
        <style>
            body { font-family: sans-serif; background: #121212; color: white; margin: 0; padding: 10px; }
            .hero { width: 100%; border-radius: 12px; overflow: hidden; margin-bottom: 20px; }
            .hero img { width: 100%; height: 200px; object-fit: cover; }
            .hero h2 { padding: 0 10px; font-size: 20px; }
            .card { display: flex; align-items: center; background: #1e1e1e; padding: 10px; border-radius: 8px; margin-bottom: 10px; }
            .card img { width: 80px; height: 80px; border-radius: 6px; object-fit: cover; margin-right: 15px; }
            .card.hot { border: 1px solid #10b981; }
        </style>
    </head>
    <body>
        <div id="hero"></div>
        <div id="news-list"></div>
        <script>
            async function fetchNews() {
                const res = await fetch('/api/news');
                const data = await res.json();
                document.getElementById('hero').innerHTML = \`<div class="hero"><img src="\${data.hero.img}"><h2 style="color:white">\${data.hero.title}</h2></div>\`;
                document.getElementById('news-list').innerHTML = data.list.map(n => \`
                    <div class="card \${n.isLoved?'hot':''}">
                        <img src="\${n.img}">
                        <a href="\${n.link}" style="color:white; text-decoration:none;">\${n.title}</a>
                    </div>
                \`).join('');
            }
            fetchNews();
        </script>
    </body>
    </html>
    `);
});

app.listen(PORT, () => console.log('Running'));
