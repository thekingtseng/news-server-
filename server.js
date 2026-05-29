const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

let blockList = ['三立', '民視', 'SETN', 'FTV'];
let loveList = ['正妹', '台積電', '晶片', 'AI', '曾奕瑋'];

app.get('/api/news', async (req, res) => {
    try {
        const urls = ['https://news.google.com/rss?hl=zh-TW&gl=TW&ceid=TW:zh-Hant'];
        loveList.forEach(k => urls.push(`https://news.google.com/rss/search?q=${encodeURIComponent(k)}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`));
        
        const responses = await Promise.all(urls.map(u => axios.get(u, { headers: {'User-Agent':'Mozilla/5.0'} }).catch(() => null)));
        let list = [];
        responses.forEach(r => {
            if(!r || !r.data) return;
            const items = r.data.split('<item>');
            for(let i=1; i<items.length; i++){
                const t = (items[i].match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
                const l = (items[i].match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '';
                // 抓取真實圖片
                const img = (items[i].match(/<enclosure[^>]*url=["'](.*?)["']/i) || [])[1] || 'https://via.placeholder.com/150';
                if(!blockList.some(w => t.includes(w))) {
                    list.push({ title: t.replace('<![CDATA[','').replace(']]>',''), link: l, img, isLoved: loveList.some(w => t.includes(w)) });
                }
            }
        });
        
        const unique = [...new Map(list.map(item => [item.link, item])).values()];
        unique.sort((a,b) => b.isLoved - a.isLoved);
        
        res.json({ hero: unique.slice(0, 5), list: unique.slice(5), blockList, loveList });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/config', (req, res) => {
    if(req.body.blockList) blockList = req.body.blockList;
    if(req.body.loveList) loveList = req.body.loveList;
    res.json({ success: true });
});

app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body { background: #121212; color: white; font-family: sans-serif; margin: 0; padding: 10px; }
            .hero-container { position: relative; height: 250px; overflow: hidden; border-radius: 12px; }
            .hero-slide { position: absolute; width: 100%; display: none; }
            .hero-slide.active { display: block; }
            .card { display: flex; align-items: center; background: #1e1e1e; padding: 10px; margin-bottom: 10px; border-radius: 8px; }
            .card img { width: 80px; height: 80px; object-fit: cover; margin-right: 10px; }
            .controls { background: #222; padding: 15px; border-radius: 8px; margin: 10px 0; }
            input, button { padding: 8px; }
        </style>
    </head>
    <body>
        <div class="controls">
            <button onclick="fetchData()">🔄 手動更新</button>
            <div>💚 喜好：<span id="love-tags"></span></div>
            <input id="new-love" placeholder="新增喜好"> <button onclick="add('love')">加入</button>
        </div>
        <div id="hero-area" class="hero-container"></div>
        <div id="list-area"></div>
        <script>
            let currentData = {hero:[], list:[]};
            async function fetchData() {
                const res = await fetch('/api/news');
                currentData = await res.json();
                render();
            }
            function render() {
                document.getElementById('hero-area').innerHTML = currentData.hero.map((n, i) => \`<div class="hero-slide \${i===0?'active':''}" id="s\${i}"><img src="\${n.img}" width="100%"><h3>\${n.title}</h3></div>\`).join('');
                document.getElementById('list-area').innerHTML = currentData.list.map(n => \`<div class="card"><img src="\${n.img}"><a href="\${n.link}" style="color:white;text-decoration:none">\${n.title}</a></div>\`).join('');
            }
            async function add(type) {
                const val = document.getElementById('new-love').value;
                currentData.loveList.push(val);
                await fetch('/api/config', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({loveList: currentData.loveList})});
                fetchData();
            }
            setInterval(() => {
                let active = document.querySelector('.hero-slide.active');
                let next = active.nextElementSibling || document.querySelector('.hero-slide');
                active.classList.remove('active');
                next.classList.add('active');
            }, 5000);
            fetchData();
        </script>
    </body>
    </html>`);
});
app.listen(PORT);
