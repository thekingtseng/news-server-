Cat > /mnt/user-data/outputs/index.js << 'ENDOFFILE'
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 10000;
const CACHE_FILE = '/tmp/news_cache.json';

app.use(express.json());

let cache = [];
try {
    const saved = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    if (saved.length) { cache = saved; console.log('讀快取：' + cache.length + ' 則'); }
} catch(e) {}

async function refresh() {
    try {
        const r = await axios.get(
            'https://news.google.com/rss?hl=zh-TW&gl=TW&ceid=TW:zh-Hant',
            { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 8000 }
        );
        const news = [];
        r.data.split('<item>').slice(1).forEach(it => {
            const tM = it.match(/<title>([\s\S]*?)<\/title>/);
            const lM = it.match(/<link>([\s\S]*?)<\/link>/);
            const dM = it.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
            if (!tM || !lM) return;
            const raw = tM[1].replace('<![CDATA[','').replace(']]>','').trim();
            const dash = raw.lastIndexOf(' - ');
            news.push({
                title: dash > 0 ? raw.substring(0, dash) : raw,
                src:   dash > 0 ? raw.substring(dash + 3) : '',
                url:   lM[1].trim(),
                date:  dM ? dM[1].trim() : ''
            });
        });
        if (news.length) { cache = news; fs.writeFileSync(CACHE_FILE, JSON.stringify(news)); console.log('更新：' + news.length + ' 則'); }
    } catch(e) { console.log('失敗:' + e.message); }
}

refresh();
setInterval(refresh, 120000);

app.get('/news.json', (req, res) => res.json(cache));
app.post('/api/refresh', (req, res) => { refresh(); res.json({ ok: true }); });

app.get('/', (req, res) => res.send(`<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>THE KING TSENG — TAIWAN INTEL FEED</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700;1,300;1,400&family=Josefin+Sans:wght@100;300;400;600&display=swap" rel="stylesheet">
<style>
:root{
  --gold:#D4AF37;--gold-light:#E8CC6A;--gold-pale:#F5E4A0;
  --gold-dim:rgba(212,175,55,0.12);--gold-glow:rgba(212,175,55,0.32);--gold-border:rgba(212,175,55,0.28);
  --navy:#0A192F;--navy-mid:#0C1F3A;--navy-card:#0F2445;--navy-deep:#060F1E;
  --text:#E0D8C8;--text-dim:rgba(224,216,200,0.52);--white:#F0EAD6;--white-faint:rgba(240,234,214,0.08);
  --green:#00D97E;--red:#FF4C4C;
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html{scroll-behavior:smooth;}
body{background:var(--navy-deep);color:var(--text);font-family:'Josefin Sans','Helvetica Neue',sans-serif;font-weight:300;overflow-x:hidden;}
body::before{content:'';position:fixed;inset:0;z-index:0;pointer-events:none;
  background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E");opacity:0.4;}
body::after{content:'';position:fixed;inset:0;z-index:0;pointer-events:none;
  background-image:linear-gradient(rgba(212,175,55,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(212,175,55,0.04) 1px,transparent 1px);
  background-size:56px 56px;}
#scrollLine{position:fixed;top:0;left:0;height:2px;width:0%;background:linear-gradient(to right,var(--gold),var(--gold-light));z-index:9999;transition:width .1s linear;}

/* HEADER */
header{position:fixed;top:0;left:0;right:0;z-index:500;display:flex;justify-content:space-between;align-items:center;padding:16px 28px;
  background:linear-gradient(to bottom,rgba(6,15,30,0.97) 80%,transparent);backdrop-filter:blur(10px);
  border-bottom:1px solid rgba(212,175,55,0.07);}
.logo-main{font-family:'Cormorant Garamond',serif;font-size:18px;font-weight:700;color:var(--gold);letter-spacing:0.28em;text-transform:uppercase;}
.logo-sub{font-size:10px;letter-spacing:0.55em;text-transform:uppercase;color:var(--text-dim);margin-top:2px;font-weight:100;}
.header-right{display:flex;align-items:center;gap:20px;}
.live-badge{display:flex;align-items:center;gap:7px;font-size:11px;letter-spacing:0.32em;color:var(--gold);text-transform:uppercase;}
.live-dot{width:6px;height:6px;background:var(--gold);border-radius:50%;animation:blinkDot 1.5s ease-in-out infinite;flex-shrink:0;}
@keyframes blinkDot{0%,100%{opacity:1;}50%{opacity:.15;}}
.header-time{font-size:11px;letter-spacing:.2em;color:var(--text-dim);}

/* HERO */
.hero{position:relative;z-index:1;padding:120px 28px 56px;text-align:center;}
.hero-eyebrow{font-size:11px;letter-spacing:.55em;text-transform:uppercase;color:var(--gold);margin-bottom:18px;font-weight:400;}
.hero-eyebrow::before{content:'';display:inline-block;width:28px;height:1px;background:var(--gold);vertical-align:middle;margin-right:12px;}
.hero-eyebrow::after{content:'';display:inline-block;width:28px;height:1px;background:var(--gold);vertical-align:middle;margin-left:12px;}
.hero-title{font-family:'Cormorant Garamond',serif;font-size:clamp(36px,8vw,72px);font-weight:300;line-height:1.05;}
.hero-title em{font-style:italic;color:var(--gold);}
.hero-sub{margin-top:18px;font-size:13px;letter-spacing:.14em;color:var(--text-dim);line-height:2;}
.gold-rule{position:relative;z-index:1;height:1px;background:linear-gradient(to right,transparent,var(--gold) 20%,var(--gold) 80%,transparent);opacity:.2;margin:0 28px;}

/* SECTION WRAP */
.wrap{max-width:920px;margin:0 auto;padding:0 20px;}

/* TICKER */
.ticker-section{position:relative;z-index:1;padding:40px 0 0;}
.section-label{font-size:11px;letter-spacing:.55em;text-transform:uppercase;color:var(--gold);margin-bottom:12px;font-weight:400;}
.section-label::before{content:'// ';opacity:.45;}
.ticker-box{background:var(--navy-card);border:1px solid var(--gold-border);position:relative;overflow:hidden;margin-bottom:4px;}
.ticker-box::before,.ticker-box::after{content:'';position:absolute;width:18px;height:18px;border-color:var(--gold);border-style:solid;}
.ticker-box::before{top:-1px;left:-1px;border-width:1px 0 0 1px;}
.ticker-box::after{bottom:-1px;right:-1px;border-width:0 1px 1px 0;}
.ticker-inner{display:flex;align-items:stretch;min-height:80px;}
.ticker-tag{background:linear-gradient(135deg,var(--gold),var(--gold-light));color:var(--navy);font-size:10px;font-weight:700;letter-spacing:1px;padding:0 16px;display:flex;align-items:center;flex-shrink:0;text-transform:uppercase;}
.ticker-content{flex:1;padding:14px 48px 14px 18px;text-decoration:none;display:flex;flex-direction:column;justify-content:center;transition:background .15s;cursor:pointer;}
.ticker-content:hover{background:var(--gold-dim);}
.ticker-hot{font-size:10px;font-weight:700;color:var(--green);margin-bottom:4px;letter-spacing:.5px;text-transform:uppercase;}
.ticker-title{font-size:15px;font-weight:400;line-height:1.5;color:var(--white);font-family:'Cormorant Garamond',serif;}
.ticker-content:hover .ticker-title{color:var(--gold);}
.ticker-meta{font-size:11px;color:var(--text-dim);margin-top:5px;letter-spacing:.1em;}
.ticker-counter{position:absolute;top:10px;right:12px;background:rgba(212,175,55,.12);border:1px solid var(--gold-border);color:var(--gold);font-size:11px;font-weight:700;padding:3px 10px;border-radius:0;letter-spacing:.1em;}
.ticker-footer{display:flex;align-items:center;border-top:1px solid rgba(212,175,55,.1);background:rgba(0,0,0,.2);}
.ticker-prog-wrap{flex:1;padding:0 14px;}
.ticker-prog-bg{background:rgba(212,175,55,.1);height:2px;overflow:hidden;}
.ticker-prog-fill{height:100%;background:linear-gradient(to right,var(--gold),var(--gold-light));width:0%;transition:width .1s linear;}
.ticker-btns{display:flex;}
.ticker-btn{background:none;border:none;border-left:1px solid rgba(212,175,55,.1);color:var(--text-dim);font-size:18px;padding:8px 16px;cursor:pointer;transition:color .15s,background .15s;font-family:'Josefin Sans',sans-serif;}
.ticker-btn:hover{color:var(--gold);background:var(--gold-dim);}

/* CONTROLS */
.controls-section{position:relative;z-index:1;padding:32px 0 0;}
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;}
@media(max-width:560px){.two-col{grid-template-columns:1fr;}}
.ctrl-box{background:var(--navy-card);border:1px solid var(--gold-border);padding:18px;position:relative;}
.ctrl-box::before,.ctrl-box::after{content:'';position:absolute;width:12px;height:12px;border-color:var(--gold);border-style:solid;opacity:.35;}
.ctrl-box::before{top:-1px;left:-1px;border-width:1px 0 0 1px;}
.ctrl-box::after{bottom:-1px;right:-1px;border-width:0 1px 1px 0;}
.ctrl-label{font-size:11px;letter-spacing:.42em;text-transform:uppercase;margin-bottom:12px;font-weight:600;}
.ctrl-label.lv{color:var(--green);}
.ctrl-label.bk{color:var(--red);}
.ctrl-label::before{content:'// ';opacity:.45;}
.inp-row{display:flex;gap:8px;}
.inp-row input{flex:1;background:rgba(0,0,0,.38);border:1px solid var(--gold-border);color:var(--text);padding:9px 12px;font-family:'Josefin Sans',sans-serif;font-size:13px;font-weight:300;outline:none;transition:border-color .3s,box-shadow .3s;letter-spacing:.05em;}
.inp-row input::placeholder{color:rgba(224,216,200,.2);}
.inp-row input:focus{border-color:var(--gold);box-shadow:0 0 18px var(--gold-dim);}
.inp-btn{padding:9px 16px;border:1px solid;font-family:'Josefin Sans',sans-serif;font-size:12px;font-weight:600;letter-spacing:.3em;text-transform:uppercase;cursor:pointer;transition:all .25s;flex-shrink:0;}
.inp-btn.lv{background:transparent;border-color:var(--green);color:var(--green);}
.inp-btn.lv:hover{background:rgba(0,217,126,.1);}
.inp-btn.bk{background:transparent;border-color:var(--red);color:var(--red);}
.inp-btn.bk:hover{background:rgba(255,76,76,.1);}
.tag-row{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;min-height:4px;}
.tag{display:inline-flex;align-items:center;gap:4px;font-size:11px;padding:3px 10px;font-weight:600;letter-spacing:.15em;text-transform:uppercase;cursor:default;}
.tag.lv{background:rgba(0,217,126,.07);color:var(--green);border:1px solid rgba(0,217,126,.25);}
.tag.bk{background:rgba(255,76,76,.07);color:var(--red);border:1px solid rgba(255,76,76,.25);}
.tag-del{cursor:pointer;opacity:.6;font-size:13px;}
.tag-del:hover{opacity:1;}

/* ACTION BAR */
.action-bar{display:flex;gap:12px;align-items:stretch;margin-bottom:14px;}
.btn-refresh{flex:1;background:transparent;border:1px solid var(--gold);color:var(--gold);font-family:'Josefin Sans',sans-serif;font-size:14px;font-weight:400;letter-spacing:.5em;text-transform:uppercase;padding:14px;cursor:pointer;position:relative;overflow:hidden;transition:color .35s;}
.btn-refresh::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,var(--gold),var(--gold-light));transform:scaleX(0);transform-origin:left;transition:transform .45s ease;z-index:0;}
.btn-refresh:hover{color:var(--navy);}
.btn-refresh:hover::before{transform:scaleX(1);}
.btn-refresh span{position:relative;z-index:1;}
.cd-box{background:var(--navy-card);border:1px solid var(--gold-border);padding:10px 16px;text-align:center;min-width:72px;display:flex;flex-direction:column;justify-content:center;}
.cd-box .n{font-family:'Cormorant Garamond',serif;font-size:28px;font-weight:700;color:var(--gold);line-height:1;}
.cd-box .l{font-size:9px;letter-spacing:.4em;color:var(--text-dim);margin-top:3px;text-transform:uppercase;}

/* STATS BAR */
.stats-bar{background:rgba(0,0,0,.3);border:1px solid rgba(212,175,55,.12);padding:10px 16px;display:flex;flex-wrap:wrap;gap:16px;align-items:center;font-size:12px;color:var(--text-dim);letter-spacing:.1em;margin-bottom:28px;}
.stats-bar b{color:var(--gold);font-weight:700;}
.stats-pill{font-size:10px;letter-spacing:.2em;padding:2px 9px;border:1px solid;font-weight:600;text-transform:uppercase;}
.stats-pill.lv{background:rgba(0,217,126,.06);color:var(--green);border-color:rgba(0,217,126,.25);}
.stats-pill.bk{background:rgba(255,76,76,.06);color:var(--red);border-color:rgba(255,76,76,.25);}
.stats-bar .right{margin-left:auto;font-size:10px;letter-spacing:.2em;}

/* DIVIDER */
.divider{display:flex;align-items:center;gap:12px;font-size:10px;letter-spacing:.55em;text-transform:uppercase;color:var(--text-dim);margin-bottom:18px;}
.divider::before,.divider::after{content:'';flex:1;height:1px;background:linear-gradient(to right,transparent,rgba(212,175,55,.2),transparent);}

/* NEWS LIST */
.news-section{position:relative;z-index:1;padding-bottom:60px;}
.news-item{background:var(--navy-card);border:1px solid var(--gold-border);padding:18px 20px;margin-bottom:10px;position:relative;display:block;transition:border-color .2s,background .2s,transform .15s;cursor:pointer;}
.news-item::before{content:'';position:absolute;left:0;top:0;bottom:0;width:2px;background:var(--gold);transform:scaleY(0);transform-origin:top;transition:transform .28s ease;}
.news-item:hover::before{transform:scaleY(1);}
.news-item:hover{background:rgba(15,36,69,.9);border-color:var(--gold);transform:translateX(3px);}
.news-item.hot{border-left:3px solid var(--green);}
.news-item.hot::before{background:var(--green);}
.hot-badge{font-size:10px;font-weight:700;color:var(--green);margin-bottom:5px;letter-spacing:.5em;text-transform:uppercase;}
.news-title-text{font-family:'Cormorant Garamond',serif;font-size:17px;font-weight:400;line-height:1.5;color:var(--white);margin-bottom:8px;}
.news-item:hover .news-title-text{color:var(--gold);}
.news-item.hot:hover .news-title-text{color:var(--green);}
.news-meta-row{display:flex;align-items:center;gap:12px;flex-wrap:wrap;font-size:11px;color:var(--text-dim);letter-spacing:.08em;}
.media-badge{background:rgba(212,175,55,.08);border:1px solid var(--gold-border);color:var(--gold-light);padding:2px 8px;font-size:10px;font-weight:600;letter-spacing:.2em;text-transform:uppercase;}
.block-src-btn{background:none;border:none;color:rgba(224,216,200,.3);cursor:pointer;font-size:10px;font-family:'Josefin Sans',sans-serif;letter-spacing:.2em;text-transform:uppercase;padding:0;text-decoration:underline;margin-left:auto;transition:color .15s;}
.block-src-btn:hover{color:var(--red);}

/* LOADING */
.loading-text{text-align:center;color:var(--gold);font-style:italic;font-size:13px;letter-spacing:.25em;padding:40px 0;animation:blink 1.6s ease-in-out infinite;}
@keyframes blink{0%,100%{opacity:.45;}50%{opacity:1;}}

.spin{display:inline-block;width:14px;height:14px;border:2px solid rgba(212,175,55,.2);border-top-color:var(--gold);border-radius:50%;animation:sp .7s linear infinite;vertical-align:middle;margin-right:6px;}
@keyframes sp{to{transform:rotate(360deg)}}

footer{position:relative;z-index:1;padding:28px;border-top:1px solid var(--white-faint);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;}
.footer-logo{font-family:'Cormorant Garamond',serif;font-size:16px;font-weight:700;letter-spacing:.3em;color:var(--gold);text-transform:uppercase;}
.footer-text{font-size:11px;letter-spacing:.2em;color:var(--text-dim);}
</style>
</head>
<body>
<div id="scrollLine"></div>

<header>
  <div>
    <div class="logo-main">The King Tseng</div>
    <div class="logo-sub">Taiwan Intel Feed · Real-time Strategic News</div>
  </div>
  <div class="header-right">
    <div class="header-time" id="headerTime"></div>
    <div class="live-badge"><div class="live-dot"></div>Live</div>
  </div>
</header>

<div class="hero">
  <div class="hero-eyebrow">AI-Curated Taiwan Intelligence</div>
  <h1 class="hero-title">精選新聞<br><em>即時情報</em></h1>
  <p class="hero-sub">皇上曾奕瑋 · The Gold Content of News</p>
</div>

<div class="gold-rule"></div>

<!-- TICKER -->
<div class="ticker-section">
<div class="wrap">
  <div class="section-label">Top 15 Intelligence Stream</div>
  <div class="ticker-box">
    <div class="ticker-inner">
      <div class="ticker-tag">TOP<br>15</div>
      <a class="ticker-content" id="ticker-link" href="#" target="_blank">
        <div class="ticker-hot" id="ticker-hot" style="display:none">★ 命中喜好關鍵字</div>
        <div class="ticker-title" id="ticker-title"><span class="spin"></span>載入中...</div>
        <div class="ticker-meta" id="ticker-meta"></div>
      </a>
      <div class="ticker-counter" id="ticker-counter">- / -</div>
    </div>
    <div class="ticker-footer">
      <div class="ticker-prog-wrap"><div class="ticker-prog-bg"><div class="ticker-prog-fill" id="ticker-prog"></div></div></div>
      <div class="ticker-btns">
        <button class="ticker-btn" onclick="tickerPrev()">&#8249;</button>
        <button class="ticker-btn" onclick="tickerNext()">&#8250;</button>
      </div>
    </div>
  </div>
</div>
</div>

<div class="gold-rule" style="margin-top:32px;"></div>

<!-- CONTROLS -->
<div class="controls-section">
<div class="wrap">
  <div class="two-col">
    <div class="ctrl-box">
      <div class="ctrl-label lv">喜好關鍵字（置頂）</div>
      <div class="inp-row">
        <input id="li" placeholder="曾奕瑋、AI、台積電..." onkeydown="if(event.key==='Enter')aT('love')">
        <button class="inp-btn lv" onclick="aT('love')">加入</button>
      </div>
      <div class="tag-row" id="lt"></div>
    </div>
    <div class="ctrl-box">
      <div class="ctrl-label bk">封鎖黑名單（過濾）</div>
      <div class="inp-row">
        <input id="bi" placeholder="三立、爆料公社..." onkeydown="if(event.key==='Enter')aT('block')">
        <button class="inp-btn bk" onclick="aT('block')">封鎖</button>
      </div>
      <div class="tag-row" id="bt"></div>
    </div>
  </div>

  <div class="action-bar">
    <button class="btn-refresh" onclick="hardRefresh()"><span>⊕ &nbsp; 立即更新新聞</span></button>
    <div class="cd-box">
      <div class="n" id="cd">60</div>
      <div class="l">Auto Refresh</div>
    </div>
  </div>

  <div class="stats-bar" id="st"><span class="spin"></span>載入中</div>
</div>
</div>

<!-- NEWS -->
<div class="news-section">
<div class="wrap">
  <div class="divider">Intelligence Feed</div>
  <div id="nl"></div>
</div>

</div>

<div class="gold-rule"></div>
<footer>
  <div class="footer-logo">The King Tseng AI</div>
  <div class="footer-text">Taiwan Intel Feed · Real-time</div>
  <div class="footer-text">For Reference Only · Not Investment Advice</div>
</footer>

<script>
var LOVE_KEY='love_v5',BLOCK_KEY='block_v5';
var cL=JSON.parse(localStorage.getItem(LOVE_KEY)||'["曾奕瑋","台積電","晶片","AI","正妹"]');
var cB=JSON.parse(localStorage.getItem(BLOCK_KEY)||'["三立","民視","SETN","FTV"]');
var all=[],filtered=[],cd=60,tIdx=0,tTimer=null,tPTimer=null,tPVal=0;

function save(){localStorage.setItem(LOVE_KEY,JSON.stringify(cL));localStorage.setItem(BLOCK_KEY,JSON.stringify(cB));}

// scroll line
window.addEventListener('scroll',function(){
  var p=window.scrollY/(document.body.scrollHeight-window.innerHeight)*100;
  document.getElementById('scrollLine').style.width=p+'%';
});

// header clock
function updateClock(){
  var now=new Date();
  document.getElementById('headerTime').textContent=
    now.getHours().toString().padStart(2,'0')+':'+now.getMinutes().toString().padStart(2,'0')+':'+now.getSeconds().toString().padStart(2,'0');
}
setInterval(updateClock,1000);updateClock();

function fmt(s){
  if(!s)return'';
  var d=new Date(s),m=Math.floor((new Date()-d)/60000);
  if(isNaN(d))return'';
  if(m<0)m=0; // 時區防禦：防止負數導致顯示錯誤
  if(m<1)return'Just now';if(m<60)return m+' min ago';
  if(m<1440)return Math.floor(m/60)+' hr ago';
  return(d.getMonth()+1)+'/'+(d.getDate());
}

function render(){
  filtered=all.filter(function(n){return !cB.some(function(w){return n.title.includes(w);});});
  filtered=filtered.map(function(n){return Object.assign({},n,{hot:cL.some(function(w){return n.title.includes(w);})});});
  filtered.sort(function(a,b){return b.hot-a.hot;});

  var hot=filtered.filter(function(n){return n.hot;}).length;
  var blocked=all.length-filtered.length;
  var now=new Date();
  document.getElementById('st').innerHTML=
    '總計 <b>'+all.length+'</b> 則 &nbsp;·&nbsp; 顯示 <b>'+filtered.length+'</b> 則 &nbsp;'+
    '<span class="stats-pill lv">★ 命中 '+hot+'</span> &nbsp;'+
    '<span class="stats-pill bk">✕ 過濾 '+blocked+'</span>'+
    '<span class="right">上次更新 '+now.getHours().toString().padStart(2,'0')+':'+now.getMinutes().toString().padStart(2,'0')+'</span>';

  document.getElementById('nl').innerHTML=filtered.map(function(n){
    var src=n.src||'';
    // 改為 div 容器避免 W3C 語法衝突，並透過 onclick 全域跳轉
    return '<div class="news-item'+(n.hot?' hot':'')+'" onclick="window.open(\''+n.url+'\', \'_blank\')">'+
      (n.hot?'<div class="hot-badge">★ 命中喜好關鍵字</div>':'')+
      '<div class="news-title-text">'+n.title+'</div>'+
      '<div class="news-meta-row">'+
      (src?'<span class="media-badge">'+src+'</span>':'')+
      (n.date?'<span>'+fmt(n.date)+'</span>':'')+
      (src?'<button class="block-src-btn" onclick="blockSrc(event,\''+src+'\')">✕ 封鎖此媒體</button>':'')+
      '</div></div>';
  }).join('');

  rTags();
  tickerInit();
}

function blockSrc(e,src){
  e.preventDefault();e.stopPropagation(); // 這裡配合外層 div 點擊能完美阻斷冒泡
  if(!cB.includes(src)){cB.push(src);save();render();}
}

function tickerInit(){
  var list=filtered.slice(0,15);
  if(!list.length)return;
  tIdx=0;tickerShow(list);
}
function tickerShow(list){
  if(!list.length)return;
  var n=list[tIdx];
  document.getElementById('ticker-link').href=n.url;
  document.getElementById('ticker-hot').style.display=n.hot?'block':'none';
  document.getElementById('ticker-title').textContent=n.title;
  document.getElementById('ticker-meta').innerHTML=
    (n.src?'<span>'+n.src+'</span>':'')+
    (n.date?'<span> · '+fmt(n.date)+'</span>':'');
  document.getElementById('ticker-counter').textContent=(tIdx+1)+' / '+list.length;
  tickerStartProg(list);
}
function tickerStartProg(list){
  clearTimeout(tTimer);clearInterval(tPTimer);
  tPVal=0;document.getElementById('ticker-prog').style.width='0%';
  tPTimer=setInterval(function(){tPVal+=2;document.getElementById('ticker-prog').style.width=Math.min(tPVal,100)+'%';},100);
  tTimer=setTimeout(function(){tIdx=(tIdx+1)%list.length;tickerShow(list);},5000);
}
function tickerPrev(){var l=filtered.slice(0,15);if(!l.length)return;tIdx=(tIdx-1+l.length)%l.length;tickerShow(l);}
function tickerNext(){var l=filtered.slice(0,15);if(!l.length)return;tIdx=(tIdx+1)%l.length;tickerShow(l);}

function rTags(){
  document.getElementById('lt').innerHTML=cL.map(function(t,i){
    return '<span class="tag lv">'+t+' <span class="tag-del" onclick="rT(\'love\','+i+')">×</span></span>';
  }).join('');
  document.getElementById('bt').innerHTML=cB.map(function(t,i){
    return '<span class="tag bk">'+t+' <span class="tag-del" onclick="rT(\'block\','+i+')">×</span></span>';
  }).join('');
}
function aT(type){
  var id=type==='love'?'li':'bi',v=document.getElementById(id).value.trim();
  if(!v)return;
  if(type==='love')cL.push(v);else cB.push(v);
  document.getElementById(id).value='';save();render();
}
function rT(type,i){if(type==='love')cL.splice(i,1);else cB.splice(i,1);save();render();}

function load(retry){
  retry=retry||0;cd=60;
  fetch('/news.json').then(function(r){return r.json();}).then(function(d){
    if(!d||!d.length){
      if(retry<6){
        document.getElementById('st').innerHTML='<span class="spin"></span>Initializing... ('+(retry+1)+'/6)';
        setTimeout(function(){load(retry+1);},2000);
      } else {
        document.getElementById('st').innerHTML='<span style="color:var(--red)">✕ 無法取得新聞，請按更新按鈕</span>';
      }
      return;
    }
    all=d;render();
  }).catch(function(){
    document.getElementById('st').innerHTML='<span style="color:var(--red)">✕ 載入失敗，請重試</span>';
  });
}

function hardRefresh(){
  document.getElementById('st').innerHTML='<span class="spin"></span>Executing intel retrieval...';
  fetch('/api/refresh',{method:'POST'}).then(function(){setTimeout(load,3000);}).catch(load);
}

setInterval(function(){cd--;document.getElementById('cd').textContent=cd;if(cd<=0)load();},1000);
window.onload=load;
</script>
</body>
</html>`));

app.listen(PORT, () => console.log('port ' + PORT));
ENDOFFILE
node --check /mnt/user-data/outputs/index.js && echo "SYNTAX OK"
