const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());

// 🚫 預設黑名單媒體
let blockList = ['三立', '民視', 'SETN', 'FTV'];
// 💚 預設喜好關鍵字
let loveList = ['正妹', '台積電', '晶片', 'AI', '曾奕瑋'];

// 🖼️ 從 RSS item 內容嘗試抓取圖片 URL
function extractImage(itemText) {
    // 嘗試抓 media:content
    const mediaMatch = itemText.match(/media:content[^>]+url="([^"]+)"/);
    if (mediaMatch) return mediaMatch[1];

    // 嘗試抓 enclosure
    const enclosureMatch = itemText.match(/<enclosure[^>]+url="([^"]+)"/);
    if (enclosureMatch) return enclosureMatch[1];

    // 嘗試抓 og:image 或任何 img src (CDATA 內)
    const imgMatch = itemText.match(/<img[^>]+src="([^"]+)"/);
    if (imgMatch) return imgMatch[1];

    return null;
}

// 📰 從 title 推測媒體來源
function extractSource(title) {
    const dashIndex = title.lastIndexOf(' - ');
    if (dashIndex !== -1) return title.substring(dashIndex + 3);
    return '';
}

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
            urls.push(`https://news.google.com/rss/search?q=${encodedKeyword}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`);
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
            const titleMatch = item.match(/<title>([\s\S]*?)<\/title>/);
            const linkMatch = item.match(/<link>([\s\S]*?)<\/link>/);
            const pubDateMatch = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/);

            if (titleMatch && linkMatch) {
                const rawTitle = titleMatch[1].replace('<![CDATA[', '').replace(']]>', '').trim();
                const link = linkMatch[1].trim();
                const pubDate = pubDateMatch ? pubDateMatch[1].trim() : null;

                if (seenUrls.has(link)) {
                    totalCount--;
                    return;
                }

                const isBlocked = blockList.some(word => rawTitle.includes(word));
                if (isBlocked) {
                    blockedCount++;
                    return;
                }

                const isLoved = loveList.some(word => rawTitle.includes(word));
                if (isLoved) lovedCount++;

                const image = extractImage(item);
                const source = extractSource(rawTitle);
                // 去掉標題末尾的 " - 來源" 部分讓標題更乾淨
                const title = source ? rawTitle.replace(` - ${source}`, '') : rawTitle;

                seenUrls.add(link);
                finalNewsList.push({ title, link, isLoved, image, source, pubDate });
            }
        });

        // 喜好置頂 + 時間排序
        finalNewsList.sort((a, b) => {
            if (b.isLoved !== a.isLoved) return b.isLoved - a.isLoved;
            const ta = a.pubDate ? new Date(a.pubDate) : 0;
            const tb = b.pubDate ? new Date(b.pubDate) : 0;
            return tb - ta;
        });

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

app.post('/api/config', (req, res) => {
    if (req.body.blockList) blockList = req.body.blockList;
    if (req.body.loveList) loveList = req.body.loveList;
    res.json({ success: true, blockList, loveList });
});

app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>台灣新聞自訂瀏覽器</title>
    <style>
        :root {
            --bg: #0d0f14;
            --surface: #161a23;
            --surface2: #1e2433;
            --border: #2a3044;
            --accent: #3b82f6;
            --accent-glow: rgba(59,130,246,0.3);
            --love: #10b981;
            --love-glow: rgba(16,185,129,0.3);
            --block: #ef4444;
            --text: #e2e8f0;
            --text-muted: #64748b;
            --font: 'Noto Sans TC', sans-serif;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: var(--font);
            background: var(--bg);
            color: var(--text);
            min-height: 100vh;
            padding: 16px;
        }
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&display=swap');

        /* ── HEADER ── */
        .header {
            text-align: center;
            margin-bottom: 20px;
        }
        .header h1 {
            font-size: 22px;
            font-weight: 700;
            letter-spacing: 1px;
            color: var(--text);
        }
        .header h1 span { color: var(--accent); }

        /* ── SLIDESHOW ── */
        #slideshow-wrap {
            position: relative;
            width: 100%;
            max-width: 860px;
            margin: 0 auto 20px;
            border-radius: 12px;
            overflow: hidden;
            background: var(--surface);
            box-shadow: 0 0 30px rgba(0,0,0,0.5);
            min-height: 260px;
        }
        .slide {
            display: none;
            position: relative;
            width: 100%;
        }
        .slide.active { display: block; }
        .slide-img {
            width: 100%;
            height: 260px;
            object-fit: cover;
            display: block;
            background: var(--surface2);
        }
        .slide-img-placeholder {
            width: 100%;
            height: 260px;
            background: linear-gradient(135deg, #1e2433 0%, #0d0f14 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 48px;
            color: var(--border);
        }
        .slide-overlay {
            position: absolute;
            bottom: 0; left: 0; right: 0;
            background: linear-gradient(transparent, rgba(0,0,0,0.88));
            padding: 40px 20px 18px;
        }
        .slide-badge {
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: var(--love);
            margin-bottom: 6px;
        }
        .slide-title {
            font-size: 17px;
            font-weight: 700;
            line-height: 1.5;
            color: #fff;
            text-decoration: none;
            display: block;
        }
        .slide-title:hover { color: var(--accent); }
        .slide-source {
            font-size: 12px;
            color: #94a3b8;
            margin-top: 6px;
        }
        .slide-counter {
            position: absolute;
            top: 12px; right: 14px;
            background: rgba(0,0,0,0.6);
            color: #fff;
            font-size: 12px;
            font-weight: 700;
            padding: 4px 10px;
            border-radius: 20px;
            backdrop-filter: blur(4px);
        }
        .slide-progress {
            position: absolute;
            bottom: 0; left: 0;
            height: 3px;
            background: var(--accent);
            transition: width 0.1s linear;
        }
        .slide-nav {
            position: absolute;
            top: 50%; transform: translateY(-50%);
            background: rgba(0,0,0,0.5);
            color: #fff;
            border: none;
            font-size: 20px;
            width: 36px; height: 36px;
            border-radius: 50%;
            cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            backdrop-filter: blur(4px);
            transition: background 0.2s;
        }
        .slide-nav:hover { background: var(--accent); }
        .slide-nav.prev { left: 10px; }
        .slide-nav.next { right: 10px; }

        /* ── CONTROLS ── */
        .controls-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            max-width: 860px;
            margin: 0 auto 16px;
        }
        @media(max-width: 600px) { .controls-grid { grid-template-columns: 1fr; } }
        .panel {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 10px;
            padding: 14px;
        }
        .panel-title {
            font-size: 13px;
            font-weight: 700;
            margin-bottom: 10px;
            display: flex; align-items: center; gap: 6px;
        }
        .panel-title.love { color: var(--love); }
        .panel-title.block { color: var(--block); }
        .input-row { display: flex; gap: 8px; }
        .input-row input {
            flex: 1;
            background: var(--surface2);
            border: 1px solid var(--border);
            color: var(--text);
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 13px;
            outline: none;
        }
        .input-row input:focus { border-color: var(--accent); }
        .btn-add {
            padding: 8px 14px;
            border: none;
            border-radius: 6px;
            font-size: 13px;
            font-weight: 700;
            cursor: pointer;
            transition: opacity 0.2s;
        }
        .btn-add:hover { opacity: 0.85; }
        .btn-add.love { background: var(--love); color: #fff; }
        .btn-add.block { background: var(--block); color: #fff; }
        .tag-area { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
        .tag {
            display: inline-flex; align-items: center; gap: 4px;
            font-size: 12px;
            padding: 3px 10px;
            border-radius: 20px;
            font-weight: 600;
        }
        .tag.love { background: rgba(16,185,129,0.12); color: var(--love); border: 1px solid rgba(16,185,129,0.3); }
        .tag.block { background: rgba(239,68,68,0.12); color: var(--block); border: 1px solid rgba(239,68,68,0.3); }
        .tag-del { cursor: pointer; font-size: 14px; line-height: 1; margin-left: 2px; }

        /* ── ACTION BAR ── */
        .action-bar {
            max-width: 860px;
            margin: 0 auto 16px;
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .btn-refresh {
            flex: 1;
            background: var(--accent);
            color: #fff;
            border: none;
            border-radius: 8px;
            padding: 12px;
            font-size: 15px;
            font-weight: 700;
            cursor: pointer;
            transition: box-shadow 0.2s, opacity 0.2s;
        }
        .btn-refresh:hover { box-shadow: 0 0 16px var(--accent-glow); opacity: 0.9; }
        .countdown-box {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 10px 16px;
            text-align: center;
            min-width: 80px;
        }
        .countdown-box .num {
            font-size: 22px;
            font-weight: 700;
            color: var(--accent);
            line-height: 1;
        }
        .countdown-box .lbl { font-size: 10px; color: var(--text-muted); margin-top: 2px; }

        /* ── STATS ── */
        .stats-bar {
            max-width: 860px;
            margin: 0 auto 16px;
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 10px 16px;
            font-size: 13px;
            color: var(--text-muted);
            display: flex;
            gap: 16px;
            flex-wrap: wrap;
        }
        .stats-bar span b { color: var(--text); }

        /* ── NEWS LIST ── */
        .news-list {
            max-width: 860px;
            margin: 0 auto;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        .card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 10px;
            display: flex;
            gap: 14px;
            overflow: hidden;
            transition: border-color 0.2s, box-shadow 0.2s;
            text-decoration: none;
        }
        .card:hover { border-color: var(--accent); box-shadow: 0 0 16px var(--accent-glow); }
        .card.hot { border-color: rgba(16,185,129,0.4); }
        .card.hot:hover { border-color: var(--love); box-shadow: 0 0 16px var(--love-glow); }
        .card-thumb {
            width: 110px;
            min-height: 80px;
            flex-shrink: 0;
            object-fit: cover;
            background: var(--surface2);
        }
        .card-thumb-placeholder {
            width: 110px;
            min-height: 80px;
            flex-shrink: 0;
            background: var(--surface2);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 28px;
            color: var(--border);
        }
        .card-body {
            flex: 1;
            padding: 12px 14px 12px 0;
            display: flex;
            flex-direction: column;
            justify-content: center;
        }
        .card-badge {
            font-size: 10px;
            font-weight: 700;
            color: var(--love);
            margin-bottom: 4px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .card-title {
            font-size: 14px;
            font-weight: 600;
            line-height: 1.5;
            color: var(--text);
        }
        .card-meta {
            display: flex;
            gap: 10px;
            margin-top: 6px;
            font-size: 11px;
            color: var(--text-muted);
            flex-wrap: wrap;
        }

        /* ── LOADING ── */
        .loading {
            text-align: center;
            padding: 40px;
            color: var(--text-muted);
            font-size: 14px;
        }
        .spinner {
            display: inline-block;
            width: 28px; height: 28px;
            border: 3px solid var(--border);
            border-top-color: var(--accent);
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
            margin-bottom: 10px;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
    </style>
</head>
<body>

<div class="header">
    <h1>🎯 台灣新聞 <span>自訂瀏覽器</span></h1>
</div>

<!-- SLIDESHOW -->
<div id="slideshow-wrap">
    <div class="loading"><div class="spinner"></div><br>載入輪播中...</div>
    <div class="slide-counter" id="slide-counter" style="display:none">1 / 15</div>
    <button class="slide-nav prev" id="prev-btn" style="display:none" onclick="slidePrev()">‹</button>
    <button class="slide-nav next" id="next-btn" style="display:none" onclick="slideNext()">›</button>
    <div class="slide-progress" id="slide-progress" style="width:0%"></div>
</div>

<!-- CONTROLS -->
<div class="controls-grid">
    <div class="panel">
        <div class="panel-title love">💚 喜好關鍵字（置頂 + 深度搜尋）</div>
        <div class="input-row">
            <input type="text" id="love-in" placeholder="例如：台積電、曾奕瑋" onkeydown="if(event.key==='Enter')addTag('love')">
            <button class="btn-add love" onclick="addTag('love')">加入</button>
        </div>
        <div class="tag-area" id="love-tags"></div>
    </div>
    <div class="panel">
        <div class="panel-title block">🚫 阻隔黑名單（物理蒸發）</div>
        <div class="input-row">
            <input type="text" id="block-in" placeholder="例如：三立、爆料公社" onkeydown="if(event.key==='Enter')addTag('block')">
            <button class="btn-add block" onclick="addTag('block')">封鎖</button>
        </div>
        <div class="tag-area" id="block-tags"></div>
    </div>
</div>

<!-- ACTION BAR -->
<div class="action-bar">
    <button class="btn-refresh" onclick="fetchNews()">🔄 立即手動更新新聞</button>
    <div class="countdown-box">
        <div class="num" id="cd">60</div>
        <div class="lbl">自動刷新</div>
    </div>
</div>

<!-- STATS -->
<div class="stats-bar" id="stats">
    <span>⏳ 正在從 Google News 全分類撈取資料...</span>
</div>

<!-- NEWS LIST -->
<div class="news-list" id="news-list"></div>

<script>
    let currentBlock = [], currentLove = [];
    let slideData = [], slideIndex = 0;
    let slideTimer = null, progressTimer = null, progressVal = 0;
    let cd = 60;

    // ── SLIDESHOW ──
    function buildSlideshow(newsArr) {
        const slides = newsArr.slice(0, 15);
        slideData = slides;
        slideIndex = 0;
        const wrap = document.getElementById('slideshow-wrap');

        // clear old slides (keep counter/buttons/progress)
        document.querySelectorAll('.slide').forEach(el => el.remove());

        slides.forEach((n, i) => {
            const div = document.createElement('div');
            div.className = 'slide' + (i === 0 ? ' active' : '');
            div.dataset.index = i;

            const imgHtml = n.image
                ? \`<img class="slide-img" src="\${n.image}" onerror="this.style.display='none';this.nextSibling.style.display='flex'" alt="">
                   <div class="slide-img-placeholder" style="display:none">📰</div>\`
                : \`<div class="slide-img-placeholder">📰</div>\`;

            div.innerHTML = \`
                \${imgHtml}
                <div class="slide-overlay">
                    \${n.isLoved ? '<div class="slide-badge">🔥 命中喜好關鍵字</div>' : ''}
                    <a class="slide-title" href="\${n.link}" target="_blank" rel="noopener">\${n.title}</a>
                    <div class="slide-source">\${n.source ? '📡 ' + n.source : ''}\${n.pubDate ? '　🕐 ' + formatDate(n.pubDate) : ''}</div>
                </div>
            \`;
            wrap.insertBefore(div, document.getElementById('slide-counter'));
        });

        document.getElementById('slide-counter').style.display = slides.length > 1 ? 'block' : 'none';
        document.getElementById('prev-btn').style.display = slides.length > 1 ? 'flex' : 'none';
        document.getElementById('next-btn').style.display = slides.length > 1 ? 'flex' : 'none';

        updateSlideCounter();
        startSlideAuto();
    }

    function showSlide(idx) {
        document.querySelectorAll('.slide').forEach(el => el.classList.remove('active'));
        const slides = document.querySelectorAll('.slide');
        if (!slides.length) return;
        slideIndex = (idx + slides.length) % slides.length;
        slides[slideIndex].classList.add('active');
        updateSlideCounter();
    }

    function slidePrev() { clearSlideAuto(); showSlide(slideIndex - 1); startSlideAuto(); }
    function slideNext() { clearSlideAuto(); showSlide(slideIndex + 1); startSlideAuto(); }

    function updateSlideCounter() {
        const total = document.querySelectorAll('.slide').length;
        document.getElementById('slide-counter').textContent = (slideIndex + 1) + ' / ' + total;
    }

    function startSlideAuto() {
        clearSlideAuto();
        progressVal = 0;
        document.getElementById('slide-progress').style.width = '0%';

        progressTimer = setInterval(() => {
            progressVal += 100 / 50; // 5秒 = 50 ticks (100ms each)
            if (progressVal >= 100) progressVal = 100;
            document.getElementById('slide-progress').style.width = progressVal + '%';
        }, 100);

        slideTimer = setTimeout(() => {
            showSlide(slideIndex + 1);
            startSlideAuto();
        }, 5000);
    }

    function clearSlideAuto() {
        clearTimeout(slideTimer);
        clearInterval(progressTimer);
        progressVal = 0;
    }

    // ── DATE FORMAT ──
    function formatDate(str) {
        if (!str) return '';
        const d = new Date(str);
        if (isNaN(d)) return str;
        const now = new Date();
        const diffMin = Math.floor((now - d) / 60000);
        if (diffMin < 1) return '剛剛';
        if (diffMin < 60) return diffMin + ' 分鐘前';
        if (diffMin < 1440) return Math.floor(diffMin / 60) + ' 小時前';
        return \`\${d.getMonth()+1}/\${d.getDate()}\`;
    }

    // ── FETCH ──
    function fetchNews() {
        document.getElementById('stats').innerHTML = '<span>⏳ 正在從 Google News 全分類撈取資料...</span>';
        cd = 60;

        fetch('/api/news')
            .then(res => res.json())
            .then(data => {
                currentBlock = data.blockList;
                currentLove = data.loveList;
                renderTags();

                const s = data.stats;
                document.getElementById('stats').innerHTML = \`
                    <span>📰 撈取 <b>\${s.total}</b> 則</span>
                    <span>👁️ 顯示 <b>\${s.visible}</b> 則</span>
                    <span>❤️ 命中 <b>\${s.loved}</b> 則</span>
                    <span>🚫 蒸發 <b>\${s.blocked}</b> 則</span>
                \`;

                buildSlideshow(data.news);

                let html = '';
                data.news.forEach(n => {
                    const thumbHtml = n.image
                        ? \`<img class="card-thumb" src="\${n.image}" loading="lazy" alt=""
                              onerror="this.style.display='none';this.nextSibling.style.display='flex'">\`
                          + \`<div class="card-thumb-placeholder" style="display:none">📰</div>\`
                        : \`<div class="card-thumb-placeholder">📰</div>\`;

                    html += \`<a class="card \${n.isLoved ? 'hot' : ''}" href="\${n.link}" target="_blank" rel="noopener">
                        \${thumbHtml}
                        <div class="card-body">
                            \${n.isLoved ? '<div class="card-badge">🔥 命中關鍵字</div>' : ''}
                            <div class="card-title">\${n.title}</div>
                            <div class="card-meta">
                                \${n.source ? '<span>📡 ' + n.source + '</span>' : ''}
                                \${n.pubDate ? '<span>🕐 ' + formatDate(n.pubDate) + '</span>' : ''}
                            </div>
                        </div>
                    </a>\`;
                });
                document.getElementById('news-list').innerHTML = html;
            })
            .catch(() => {
                document.getElementById('stats').innerHTML = '<span style="color:#ef4444">❌ 載入失敗，請重試</span>';
            });
    }

    // ── TAGS ──
    function renderTags() {
        document.getElementById('love-tags').innerHTML = currentLove.map((t, i) =>
            \`<span class="tag love">💚 \${t} <span class="tag-del" onclick="removeTag('love',\${i})">×</span></span>\`
        ).join('');
        document.getElementById('block-tags').innerHTML = currentBlock.map((t, i) =>
            \`<span class="tag block">🚫 \${t} <span class="tag-del" onclick="removeTag('block',\${i})">×</span></span>\`
        ).join('');
    }

    function addTag(type) {
        const id = type === 'love' ? 'love-in' : 'block-in';
        const val = document.getElementById(id).value.trim();
        if (!val) return;
        if (type === 'love') currentLove.push(val);
        else currentBlock.push(val);
        document.getElementById(id).value = '';
        saveConfig();
    }

    function removeTag(type, index) {
        if (type === 'love') currentLove.splice(index, 1);
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

    // ── COUNTDOWN ──
    setInterval(() => {
        cd--;
        document.getElementById('cd').textContent = cd;
        if (cd <= 0) fetchNews();
    }, 1000);

    window.onload = fetchNews;
</script>
</body>
</html>`);
});

app.listen(PORT, () => {
    console.log(\`Server is running on port \${PORT}\`);
});
