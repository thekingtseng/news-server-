const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());

let blockList = ['三立', '民視', 'SETN', 'FTV'];
let loveList = ['正妹', '台積電', '晶片', 'AI', '曾奕瑋'];

// 快取機制
let cache = null;
let cacheTime = 0;
const CACHE_TTL = 55 * 1000; // 55 秒快取

// 安全的圖片擷取 Regex
function extractImage(itemText) {
    const mediaMatch = itemText.match(/media:content[^>]+url=["']([^"']+)["']/i);
    if (mediaMatch) return mediaMatch[1];
    const enclosureMatch = itemText.match(/<enclosure[^>]+url=["']([^"']+)["']/i);
    if (enclosureMatch) return enclosureMatch[1];
    const imgMatch = itemText.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (imgMatch) return imgMatch[1];
    return null;
}

function extractSource(title) {
    const dashIndex = title.lastIndexOf(' - ');
    if (dashIndex !== -1) return title.substring(dashIndex + 3);
    return '';
}

async function fetchAllNews() {
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
    const TIMEOUT = 3000; // 縮短為 3 秒，避免木桶效應卡死

    // 基本訂閱源 (6個)
    let urls = [
        'https://news.google.com/rss?hl=zh-TW&gl=TW&ceid=TW:zh-Hant',
        'https://news.google.com/rss/topics/CAAqIQgKIhtDQkFTRGdvSUwyMHZNRFZ4ZERCV0VnSlVVa0F0S0FBUAE?hl=zh-TW&gl=TW&ceid=TW:zh-Hant',
        'https://news.google.com/rss/topics/CAAqIQgKIhtDQkFTRGdvSUwyMHZNRFp4WkRjU0VnSlVVa0F0S0FBUAE?hl=zh-TW&gl=TW&ceid=TW:zh-Hant',
        'https://news.google.com/rss/topics/CAAqIQgKIhtDQkFTRGdvSUwyMHZNRGR6TVdZU0VnSlVVa0F0S0FBUAE?hl=zh-TW&gl=TW&ceid=TW:zh-Hant',
        'https://news.google.com/rss/topics/CAAqIQgKIhtDQkFTRGdvSUwyMHZNR3B6YldZd0VnSlVVa0F0S0FBUAE?hl=zh-TW&gl=TW&ceid=TW:zh-Hant',
        'https://news.google.com/rss/topics/CAAqIQgKIhtDQkFTRGdvSUwyMHZNRWx6Y0d3U0VnSlVVa0F0S0FBUAE?hl=zh-TW&gl=TW&ceid=TW:zh-Hant'
    ];

    // 【核心優化】將所有喜好關鍵字合併成單一 Google 搜尋請求，利用 OR 語法避免多次 I/O
    if (loveList && loveList.length > 0) {
        const combinedKeyword = loveList.map(k => `(${k.trim()})`).join('OR');
        const encodedKeyword = encodeURIComponent(combinedKeyword);
        urls.push(`https://news.google.com/rss/search?q=${encodedKeyword}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`);
    }

    const requests = urls.map(url =>
        axios.get(url, {
            headers: { 'User-Agent': userAgent },
            timeout: TIMEOUT
        }).catch(() => null) // 發生錯誤或超時直接回傳 null，不影響整體
    );

    const responses = await Promise.all(requests);

    let allItems = [];
    responses.forEach(response => {
        if (response && response.data) {
            // 使用不分大小寫且相容屬性的規律分割 <item>
            const items = response.data.split(/<item[\s>]/i);
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
        const titleMatch = item.match(/<title>([\s\S]*?)<\/title>/i);
        const linkMatch = item.match(/<link>([\s\S]*?)<\/link>/i);
        const pubDateMatch = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);

        if (titleMatch && linkMatch) {
            const rawTitle = titleMatch[1].replace('<![CDATA--', '').replace(']]>', '').trim();
            const link = linkMatch[1].trim();
            const pubDate = pubDateMatch ? pubDateMatch[1].trim() : null;

            if (seenUrls.has(link)) { totalCount--; return; }

            const isBlocked = blockList.some(word => rawTitle.includes(word));
            if (isBlocked) { blockedCount++; return; }

            const isLoved = loveList.some(word => rawTitle.includes(word));
            if (isLoved) lovedCount++;

            const image = extractImage(item);
            const source = extractSource(rawTitle);
            const title = source ? rawTitle.replace(' - ' + source, '') : rawTitle;

            seenUrls.add(link);
            finalNewsList.push({ title, link, isLoved, image, source, pubDate });
        }
    });

    // 排序：命中喜好關鍵字置頂，其餘依時間由新到舊排序
    finalNewsList.sort((a, b) => {
        if (b.isLoved !== a.isLoved) return b.isLoved - a.isLoved;
        const ta = a.pubDate ? new Date(a.pubDate) : 0;
        const tb = b.pubDate ? new Date(b.pubDate) : 0;
        return tb - ta;
    });

    return {
        stats: { total: totalCount, blocked: blockedCount, loved: lovedCount, visible: finalNewsList.length },
        news: finalNewsList,
        blockList,
        loveList
    };
}

app.get('/api/news', async (req, res) => {
    try {
        const now = Date.now();
        const forceRefresh = req.query.refresh === '1';

        if (!forceRefresh && cache && (now - cacheTime) < CACHE_TTL) {
            return res.json({ ...cache, cached: true });
        }

        const data = await fetchAllNews();
        cache = data;
        cacheTime = now;
        res.json({ ...data, cached: false });
    } catch (error) {
        if (cache) {
            return res.json({ ...cache, cached: true, error: error.message });
        }
        res.status(500).json({ error: error.message });
    }
});

// 背景預熱
fetchAllNews().then(data => {
    cache = data;
    cacheTime = Date.now();
    console.log('預熱完成，已快取 ' + data.news.length + ' 則新聞');
}).catch(err => {
    console.log('預熱失敗：' + err.message);
});

app.post('/api/config', (req, res) => {
    if (req.body.blockList) blockList = req.body.blockList;
    if (req.body.loveList) loveList = req.body.loveList;
    cache = null;
    cacheTime = 0;
    res.json({ success: true, blockList, loveList });
});

app.get('/', (req, res) => {
    const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>台灣新聞自訂瀏覽器</title>
    <style>
        :root {
            --bg: #0d0f14; --surface: #161a23; --surface2: #1e2433;
            --border: #2a3044; --accent: #3b82f6; --accent-glow: rgba(59,130,246,0.3);
            --love: #10b981; --love-glow: rgba(16,185,129,0.3);
            --block: #ef4444; --text: #e2e8f0; --text-muted: #64748b;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Noto Sans TC', sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; padding: 16px; }
        .header { text-align: center; margin-bottom: 20px; }
        .header h1 { font-size: 22px; font-weight: 700; letter-spacing: 1px; }
        .header h1 span { color: var(--accent); }

        #slideshow-wrap { position: relative; width: 100%; max-width: 860px; margin: 0 auto 20px; border-radius: 12px; overflow: hidden; background: var(--surface); box-shadow: 0 0 30px rgba(0,0,0,0.5); min-height: 260px; }
        .slide { display: none; position: relative; width: 100%; }
        .slide.active { display: block; }
        .slide-img { width: 100%; height: 260px; object-fit: cover; display: block; }
        .slide-img-placeholder { width: 100%; height: 260px; background: linear-gradient(135deg, #1e2433 0%, #0d0f14 100%); display: flex; align-items: center; justify-content: center; font-size: 48px; color: var(--border); }
        .slide-overlay { position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(transparent, rgba(0,0,0,0.88)); padding: 40px 20px 18px; }
        .slide-badge { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: var(--love); margin-bottom: 6px; }
        .slide-title { font-size: 17px; font-weight: 700; line-height: 1.5; color: #fff; text-decoration: none; display: block; }
        .slide-title:hover { color: var(--accent); }
        .slide-source { font-size: 12px; color: #94a3b8; margin-top: 6px; }
        .slide-counter { position: absolute; top: 12px; right: 14px; background: rgba(0,0,0,0.6); color: #fff; font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 20px; backdrop-filter: blur(4px); display: none; }
        .slide-progress { position: absolute; bottom: 0; left: 0; height: 3px; background: var(--accent); transition: width 0.1s linear; }
        .slide-nav { position: absolute; top: 50%; transform: translateY(-50%); background: rgba(0,0,0,0.5); color: #fff; border: none; font-size: 22px; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; display: none; align-items: center; justify-content: center; backdrop-filter: blur(4px); }
        .slide-nav:hover { background: var(--accent); }
        .slide-nav.prev { left: 10px; }
        .slide-nav.next { right: 10px; }

        .controls-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; max-width: 860px; margin: 0 auto 16px; }
        @media(max-width:600px) { .controls-grid { grid-template-columns: 1fr; } }
        .panel { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 14px; }
        .panel-title { font-size: 13px; font-weight: 700; margin-bottom: 10px; }
        .panel-title.love { color: var(--love); }
        .panel-title.block { color: var(--block); }
        .input-row { display: flex; gap: 8px; }
        .input-row input { flex: 1; background: var(--surface2); border: 1px solid var(--border); color: var(--text); padding: 8px 12px; border-radius: 6px; font-size: 13px; outline: none; }
        .input-row input:focus { border-color: var(--accent); }
        .btn-add { padding: 8px 14px; border: none; border-radius: 6px; font-size: 13px; font-weight: 700; cursor: pointer; }
        .btn-add.love { background: var(--love); color: #fff; }
        .btn-add.block { background: var(--block); color: #fff; }
        .tag-area { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
        .tag { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; padding: 3px 10px; border-radius: 20px; font-weight: 600; }
        .tag.love { background: rgba(16,185,129,0.12); color: var(--love); border: 1px solid rgba(16,185,129,0.3); }
        .tag.block { background: rgba(239,68,68,0.12); color: var(--block); border: 1px solid rgba(239,68,68,0.3); }
        .tag-del { cursor: pointer; font-size: 14px; line-height: 1; }

        .action-bar { max-width: 860px; margin: 0 auto 16px; display: flex; align-items: center; gap: 12px; }
        .btn-refresh { flex: 1; background: var(--accent); color: #fff; border: none; border-radius: 8px; padding: 12px; font-size: 15px; font-weight: 700; cursor: pointer; }
        .btn-refresh:disabled { background: var(--text-muted); cursor: not-allowed; }
        .countdown-box { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 10px 16px; text-align: center; min-width: 80px; }
        .countdown-box .num { font-size: 22px; font-weight: 700; color: var(--accent); line-height: 1; }
        .countdown-box .lbl { font-size: 10px; color: var(--text-muted); margin-top: 2px; }

        .stats-bar { max-width: 860px; margin: 0 auto 16px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 10px 16px; font-size: 13px; color: var(--text-muted); display: flex; gap: 16px; flex-wrap: wrap; }
        .stats-bar span b { color: var(--text); }

        .news-list { max-width: 860px; margin: 0 auto; display: flex; flex-direction: column; gap: 10px; }
        .card { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; display: flex; overflow: hidden; text-decoration: none; transition: border-color 0.2s; }
        .card:hover { border-color: var(--accent); }
        .card.hot { border-color: rgba(16,185,129,0.4); }
        .card.hot:hover { border-color: var(--love); }
        .card-thumb { width: 110px; min-height: 80px; flex-shrink: 0; object-fit: cover; }
        .card-thumb-placeholder { width: 110px; min-height: 80px; flex-shrink: 0; background: var(--surface2); display: flex; align-items: center; justify-content: center; font-size: 28px; color: var(--border); }
        .card-body { flex: 1; padding: 12px 14px; display: flex; flex-direction: column; justify-content: center; }
        .card-badge { font-size: 10px; font-weight: 700; color: var(--love); margin-bottom: 4px; }
        .card-title { font-size: 14px; font-weight: 600; line-height: 1.5; color: var(--text); }
        .card-meta { display: flex; gap: 10px; margin-top: 6px; font-size: 11px; color: var(--text-muted); flex-wrap: wrap; }

        .loading { text-align: center; padding: 40px; color: var(--text-muted); font-size: 14px; width: 100%; }
        .spinner { display: inline-block; width: 28px; height: 28px; border: 3px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 10px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .cached-badge { font-size: 11px; color: var(--love); margin-left: 8px; }
    </style>
</head>
<body>

<div class="header"><h1>🎯 台灣新聞 <span>自訂瀏覽器</span></h1></div>

<div id="slideshow-wrap">
    <div class="loading"><div class="spinner"></div><br>載入輪播中...</div>
    <div class="slide-counter" id="slide-counter"></div>
    <button class="slide-nav prev" id="prev-btn" onclick="slidePrev()">&#8249;</button>
    <button class="slide-nav next" id="next-btn" onclick="slideNext()">&#8250;</button>
    <div class="slide-progress" id="slide-progress" style="width:0%"></div>
</div>

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

<div class="action-bar">
    <button class="btn-refresh" id="btn-refresh" onclick="fetchNews(true)">🔄 立即手動更新新聞</button>
    <div class="countdown-box">
        <div class="num" id="cd">60</div>
        <div class="lbl">自動刷新</div>
    </div>
</div>

<div class="stats-bar" id="stats"><span>⏳ 正在載入...</span></div>
<div class="news-list" id="news-list"></div>

<script>
    var currentBlock = [], currentLove = [];
    var slideIndex = 0;
    var slideTimer = null, progressTimer = null, progressVal = 0;
    var cd = 60;
    var globalCountdownInterval = null; // 新增全域計時器參照，防堵疊加 Bug

    function formatDate(str) {
        if (!str) return '';
        var d = new Date(str);
        if (isNaN(d)) return '';
        var now = new Date();
        var diffMin = Math.floor((now - d) / 60000);
        if (diffMin < 1) return '剛剛';
        if (diffMin < 60) return diffMin + ' 分鐘前';
        if (diffMin < 1440) return Math.floor(diffMin / 60) + ' 小時前';
        return (d.getMonth()+1) + '/' + d.getDate();
    }

    function buildSlideshow(newsArr) {
        var slides = newsArr.slice(0, 15);
        slideIndex = 0;
        var wrap = document.getElementById('slideshow-wrap');

        // 只清除舊的 slide 節點
        wrap.querySelectorAll('.slide').forEach(function(el) { el.remove(); });

        var counter = document.getElementById('slide-counter');
        var prevBtn = document.getElementById('prev-btn');
        var nextBtn = document.getElementById('next-btn');

        if(slides.length === 0) {
            wrap.innerHTML = '<div class="loading">目前沒有符合篩選的新聞</div>';
            counter.style.display = 'none';
            prevBtn.style.display = 'none';
            nextBtn.style.display = 'none';
            return;
        }

        slides.forEach(function(n, i) {
            var div = document.createElement('div');
            div.className = 'slide' + (i === 0 ? ' active' : '');

            // 優化優化：如果圖片加載失敗，動態隱藏自己並亮起備用的 placeholder 元件，防範排版塌陷
            var imgHtml = n.image
                ? '<img class="slide-img" src="' + n.image + '" onerror="this.style.display=\\'none\\'; this.parentElement.querySelector(\\`.slide-img-placeholder\\`).style.display=\\`flex\\`;" alt="">' + '<div class="slide-img-placeholder" style="display:none">📰</div>'
                : '<div class="slide-img-placeholder">📰</div>';

            div.innerHTML = imgHtml +
                '<div class="slide-overlay">' +
                (n.isLoved ? '<div class="slide-badge">🔥 命中喜好關鍵字</div>' : '') +
                '<a class="slide-title" href="' + n.link + '" target="_blank" rel="noopener">' + n.title + '</a>' +
                '<div class="slide-source">' +
                (n.source ? '📡 ' + n.source : '') +
                (n.pubDate ? '　🕐 ' + formatDate(n.pubDate) : '') +
                '</div></div>';

            wrap.insertBefore(div, counter);
        });

        if (slides.length > 1) {
            counter.style.display = 'block';
            prevBtn.style.display = 'flex';
            nextBtn.style.display = 'flex';
        } else {
            counter.style.display = 'none';
            prevBtn.style.display = 'none';
            nextBtn.style.display = 'none';
        }

        updateSlideCounter();
        startSlideAuto();
    }

    function showSlide(idx) {
        var slides = document.querySelectorAll('.slide');
        if (!slides.length) return;
        slides.forEach(function(el) { el.classList.remove('active'); });
        slideIndex = ((idx % slides.length) + slides.length) % slides.length;
        slides[slideIndex].classList.add('active');
        updateSlideCounter();
    }

    function slidePrev() { clearSlideAuto(); showSlide(slideIndex - 1); startSlideAuto(); }
    function slideNext() { clearSlideAuto(); showSlide(slideIndex + 1); startSlideAuto(); }

    function updateSlideCounter() {
        var total = document.querySelectorAll('.slide').length;
        document.getElementById('slide-counter').textContent = (slideIndex + 1) + ' / ' + total;
    }

    function startSlideAuto() {
        clearSlideAuto();
        progressVal = 0;
        document.getElementById('slide-progress').style.width = '0%';

        progressTimer = setInterval(function() {
            progressVal += 2;
            if (progressVal > 100) progressVal = 100;
            document.getElementById('slide-progress').style.width = progressVal + '%';
        }, 100);

        slideTimer = setTimeout(function() {
            showSlide(slideIndex + 1);
            startSlideAuto();
        }, 5000);
    }

    function clearSlideAuto() {
        clearTimeout(slideTimer);
        clearInterval(progressTimer);
    }

    // 建立獨立的倒數計時重置器，解決手動觸發時重疊的問題
    function resetCountdownClock() {
        if (globalCountdownInterval) clearInterval(globalCountdownInterval);
        cd = 60;
        document.getElementById('cd').textContent = cd;
        globalCountdownInterval = setInterval(function() {
            cd--;
            document.getElementById('cd').textContent = cd;
            if (cd <= 0) {
                clearInterval(globalCountdownInterval);
                fetchNews(false);
            }
        }, 1000);
    }

    function fetchNews(forceRefresh) {
        document.getElementById('stats').innerHTML = '<span>⏳ 載入中...</span>';
        var btn = document.getElementById('btn-refresh');
        btn.disabled = true;
        btn.textContent = '🔄 正在極速撈取中...';

        var url = forceRefresh ? '/api/news?refresh=1' : '/api/news';

        fetch(url)
            .then(function(res) { return res.json(); })
            .then(function(data) {
                currentBlock = data.blockList;
                currentLove = data.loveList;
                renderTags();

                var s = data.stats;
                var cachedLabel = data.cached ? '<span class="cached-badge">⚡ 快取</span>' : '';
                document.getElementById('stats').innerHTML =
                    '<span>📰 撈取 <b>' + s.total + '</b> 則</span>' +
                    '<span>👁️ 顯示 <b>' + s.visible + '</b> 則</span>' +
                    '<span>❤️ 命中 <b>' + s.loved + '</b> 則</span>' +
                    '<span>🚫 蒸發 <b>' + s.blocked + '</b> 則</span>' +
                    cachedLabel;

                buildSlideshow(data.news);

                var html = '';
                data.news.forEach(function(n) {
                    var thumbHtml = n.image
                        ? '<img class="card-thumb" src="' + n.image + '" loading="lazy" alt="" onerror="this.style.display=\\'none\\'; this.parentElement.querySelector(\\`.card-thumb-placeholder\\`).style.display=\\`flex\\`;">' + '<div class="card-thumb-placeholder" style="display:none">📰</div>'
                        : '<div class="card-thumb-placeholder">📰</div>';

                    html += '<a class="card ' + (n.isLoved ? 'hot' : '') + '" href="' + n.link + '" target="_blank" rel="noopener">' +
                        thumbHtml +
                        '<div class="card-body">' +
                        (n.isLoved ? '<div class="card-badge">🔥 命中關鍵字</div>' : '') +
                        '<div class="card-title">' + n.title + '</div>' +
                        '<div class="card-meta">' +
                        (n.source ? '<span>📡 ' + n.source + '</span>' : '') +
                        (n.pubDate ? '<span>🕐 ' + formatDate(n.pubDate) + '</span>' : '') +
                        '</div></div></a>';
                });
                document.getElementById('news-list').innerHTML = html;
            })
            .catch(function() {
                document.getElementById('stats').innerHTML = '<span style="color:#ef4444">❌ 載入失敗，請重試</span>';
            })
            .finally(function() {
                btn.disabled = false;
                btn.textContent = '🔄 立即手動更新新聞';
                resetCountdownClock(); // 無論成功失敗都重置並開啟新的計時週期
            });
    }

    function renderTags() {
        document.getElementById('love-tags').innerHTML = currentLove.map(function(t, i) {
            return '<span class="tag love">💚 ' + t + ' <span class="tag-del" onclick="removeTag(\\'love\\',' + i + ')">×</span></span>';
        }).join('');
        document.getElementById('block-tags').innerHTML = currentBlock.map(function(t, i) {
            return '<span class="tag block">🚫 ' + t + ' <span class="tag-del" onclick="removeTag(\\'block\\',' + i + ')">×</span></span>';
        }).join('');
    }

    function addTag(type) {
        var id = type === 'love' ? 'love-in' : 'block-in';
        var val = document.getElementById(id).value.trim();
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
        }).then(function() { fetchNews(true); });
    }

    window.onload = function() { fetchNews(false); };
</script>
</body>
</html>`;
    res.send(html);
});

app.listen(PORT, function() {
    console.log('Server is running on port ' + PORT);
});
