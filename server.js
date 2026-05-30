const express = require('express');
const axios   = require('axios');
const fs      = require('fs');
const path    = require('path');
const app     = express();
const PORT    = process.env.PORT || 10000;
// [修正 1] 將快取路徑移到專案根目錄，防止個別容器環境下的 /tmp 權限遭平台抹除
const CACHE_FILE = path.join(__dirname, 'nc.json');

app.use(express.json());

let cache = [];

// 啟動時安全讀取快取
try {
    if (fs.existsSync(CACHE_FILE)) {
        const s = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
        if (Array.isArray(s) && s.length > 0) {
            cache = s;
            console.log('[CACHE] 成功載入歷史情報：' + cache.length + ' 則');
        }
    }
} catch(e) {
    console.log('[CACHE] 讀取失敗: ' + e.message);
}

// 高強度偽裝 RSS 抓取器
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
            src:   dash > 0 ? raw.substring(dash+3).trim() : '焦點新聞',
            url:   lM[1].trim(),
            date:  dM ? dM[1].trim() : new Date().toUTCString()
        });
    });
    return news;
}

async function doRefresh() {
    try {
        // [修正 2] 升級為高階 Mac Chrome 瀏覽器標頭，防止被 Google 反爬蟲機制無情封鎖
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
            console.log('[RSS] 戰略情報成功更新：' + news.length + ' 則');
            return true;
        }
    } catch(e) {
        console.log('[RSS] 抓取失敗: ' + e.message);
    }
    return false;
}

// 伺服器啟動馬上抓（異步背景執行），每 2 分鐘自動更新
setTimeout(doRefresh, 100);
setInterval(doRefresh, 120000);

function safeJSON(data) {
    return JSON.stringify(data)
        .replace(/<\/script>/gi, '<\\/script>')
        .replace(/<!--/g, '<\\!--');
}

// ─── [修正 3] 移除阻塞主頁的 waitForCache 12秒等待 ───────────────────
// 讓網頁做到 0.1 秒極速「秒開」，如果快取暫時沒資料，由前端優雅呈現載入狀態，絕不卡死
app.get('/', function(req, res) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(buildHTML());
});

app.get('/news.json', function(req, res) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.json(cache);
});

app.post('/api/refresh', async function(req, res) {
    const ok = await doRefresh();
    res.json({ ok: ok, count: cache.length });
});

app.listen(PORT, function() { console.log('【皇上御製系統二版】監聽埠口已成功開閘：' + PORT); });

function buildHTML() {
    const DATA = safeJSON(cache);

    return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>THE KING TSENG — TAIWAN INTEL FEED</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700;1,300;1,400&family=Josefin+Sans:wght@100;300;400;600&display=swap" rel="stylesheet">
<style>
:root{--gold:#D4AF37;--gold-light:#E8CC6A;--gold-dim:rgba(212,175,55,0.12);--gold-border:rgba(212,175,55,0.28);--navy:#0A192F;--navy-mid:#0C1F3A;--navy-card:#0F2445;--navy-deep:#060F1E;--text:#E0D8C8;--text-dim:rgba(224,216,200,0.52);--white:#F0EAD6;--white-faint:rgba(240,234,214,0.08);--green:#00D97E;--red:#FF4C4C;}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
body{background:var(--navy-deep);color:var(--text);font-family:"Josefin Sans",sans-serif;font-weight:300;overflow-x:hidden;}
body::before{content:"";position:fixed;inset:0;z-index:0;pointer-events:none;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E");opacity:0.4;}
body::after{content:"";position:fixed;inset:0;z-index:0;pointer-events:none;background-image:linear-gradient(rgba(212,175,55,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(212,175,55,0.04) 1px,transparent 1px);background-size:56px 56px;}
#sl{position:fixed;top:0;left:0;height:2px;width:0%;background:linear-gradient(to right,var(--gold),var(--gold-light));z-index:9999;}
header{position:fixed;top:0;left:0;right:0;z-index:500;display:flex;justify-content:space-between;align-items:center;padding:16px 28px;background:linear-gradient(to bottom,rgba(6,15,30,0.97) 80%,transparent);backdrop-filter:blur(10px);border-bottom:1px solid rgba(212,175,55,0.07);}
.lm{font-family:"Cormorant Garamond",serif;font-size:18px;font-weight:700;color:var(--gold);letter-spacing:0.28em;text-transform:uppercase;}
.ls{font-size:10px;letter-spacing:0.5em;text-transform:uppercase;color:var(--text-dim);margin-top:2px;}
.hr{display:flex;align-items:center;gap:20px;}
.lb{display:flex;align-items:center;gap:7px;font-size:11px;letter-spacing:0.3em;color:var(--gold);text-transform:uppercase;}
.ld{width:6px;height:6px;background:var(--gold);border-radius:50%;animation:blink 1.5s ease-in-out infinite;}
@keyframes blink{0%,100%{opacity:1;}50%{opacity:.15;}}
.ht{font-size:11px;letter-spacing:.2em;color:var(--text-dim);}
.hero{position:relative;z-index:1;padding:120px 28px 56px;text-align:center;}
.hew{font-size:11px;letter-spacing:.55em;text-transform:uppercase;color:var(--gold);margin-bottom:18px;}
.hew::before,.hew::after{content:"";display:inline-block;width:28px;height:1px;background:var(--gold);vertical-align:middle;margin:0 12px;}
.htl{font-family:"Cormorant Garamond",serif;font-size:clamp(36px,8vw,72px);font-weight:300;line-height:1.05;}
.htl em{font-style:italic;color:var(--gold);}
.hsb{margin-top:18px;font-size:13px;letter-spacing:.14em;color:var(--text-dim);line-height:2;}
.gr{position:relative;z-index:1;height:1px;background:linear-gradient(to right,transparent,var(--gold) 20%,var(--gold) 80%,transparent);opacity:.2;margin:0 28px;}
.wrap{max-width:920px;margin:0 auto;padding:0 20px;}
.sec{position:relative;z-index:1;padding:36px 0 0;}
.sl2{font-size:11px;letter-spacing:.55em;text-transform:uppercase;color:var(--gold);margin-bottom:12px;}
.sl2::before{content:"// ";opacity:.45;}
.tkb{background:var(--navy-card);border:1px solid var(--gold-border);position:relative;overflow:hidden;margin-bottom:4px;}
.tkb::before,.tkb::after{content:"";position:absolute;width:18px;height:18px;border-color:var(--gold);border-style:solid;}
.tkb::before{top:-1px;left:-1px;border-width:1px 0 0 1px;}\n' +
'.tkb::after{bottom:-1px;right:-1px;border-width:0 1px 1px 0;}\n' +
'.tki{display:flex;align-items:stretch;min-height:80px;}\n' +
'.tkt{background:linear-gradient(135deg,var(--gold),var(--gold-light));color:var(--navy);font-size:10px;font-weight:700;letter-spacing:1px;padding:0 16px;display:flex;align-items:center;flex-shrink:0;text-transform:uppercase;}\n' +
'.tkc{flex:1;padding:14px 52px 14px 18px;text-decoration:none;display:flex;flex-direction:column;justify-content:center;transition:background .15s;}\n' +
'.tkc:hover{background:var(--gold-dim);}\n' +
'.tkh{font-size:10px;font-weight:700;color:var(--green);margin-bottom:4px;letter-spacing:.5px;text-transform:uppercase;}\n' +
'.tktt{font-size:15px;font-weight:400;line-height:1.5;color:var(--white);font-family:"Cormorant Garamond",serif;}\n' +
'.tkc:hover .tktt{color:var(--gold);}\n' +
'.tkm{font-size:11px;color:var(--text-dim);margin-top:5px;}\n' +
'.tkcnt{position:absolute;top:10px;right:12px;background:rgba(212,175,55,.12);border:1px solid var(--gold-border);color:var(--gold);font-size:11px;font-weight:700;padding:3px 10px;letter-spacing:.1em;}\n' +
'.tkf{display:flex;align-items:center;border-top:1px solid rgba(212,175,55,.1);background:rgba(0,0,0,.2);}\n' +
'.tkpw{flex:1;padding:8px 14px;}\n' +
'.tkpb{background:rgba(212,175,55,.1);height:2px;overflow:hidden;}\n' +
'.tkpf{height:100%;background:linear-gradient(to right,var(--gold),var(--gold-light));width:0%;transition:width .1s linear;}\n' +
'.tknv{display:flex;}\n' +
'.tknvb{background:none;border:none;border-left:1px solid rgba(212,175,55,.1);color:var(--text-dim);font-size:18px;padding:8px 16px;cursor:pointer;transition:color .15s,background .15s;}\n' +
'.tknvb:hover{color:var(--gold);background:var(--gold-dim);}\n' +
'.two{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;}\n' +
'@media(max-width:560px){.two{grid-template-columns:1fr;}}\n' +
'.cb{background:var(--navy-card);border:1px solid var(--gold-border);padding:18px;position:relative;}\n' +
'.cb::before,.cb::after{content:"";position:absolute;width:12px;height:12px;border-color:var(--gold);border-style:solid;opacity:.35;}\n' +
'.cb::before{top:-1px;left:-1px;border-width:1px 0 0 1px;}\n' +
'.cb::after{bottom:-1px;right:-1px;border-width:0 1px 1px 0;}\n' +
'.cl{font-size:11px;letter-spacing:.42em;text-transform:uppercase;margin-bottom:12px;font-weight:600;}\n' +
'.cl::before{content:"// ";opacity:.45;}\n' +
'.cl.lv{color:var(--green);}.cl.bk{color:var(--red);}\n' +
'.ir{display:flex;gap:8px;}\n' +
'.ir input{flex:1;background:rgba(0,0,0,.38);border:1px solid var(--gold-border);color:var(--text);padding:9px 12px;font-family:"Josefin Sans",sans-serif;font-size:13px;outline:none;transition:border-color .3s,box-shadow .3s;}\n' +
'.ir input::placeholder{color:rgba(224,216,200,.2);}\n' +
'.ir input:focus{border-color:var(--gold);box-shadow:0 0 18px var(--gold-dim);}\n' +
'.ib{padding:9px 16px;border:1px solid;font-family:"Josefin Sans",sans-serif;font-size:12px;font-weight:600;letter-spacing:.3em;text-transform:uppercase;cursor:pointer;transition:all .25s;flex-shrink:0;background:transparent;}\n' +
'.ib.lv{border-color:var(--green);color:var(--green);}.ib.lv:hover{background:rgba(0,217,126,.1);}\n' +
'.ib.bk{border-color:var(--red);color:var(--red);}.ib.bk:hover{background:rgba(255,76,76,.1);}\n' +
'.tr{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;min-height:4px;}\n' +
'.tg{display:inline-flex;align-items:center;gap:4px;font-size:11px;padding:3px 10px;font-weight:600;letter-spacing:.15em;text-transform:uppercase;}\n' +
'.tg.lv{background:rgba(0,217,126,.07);color:var(--green);border:1px solid rgba(0,217,126,.25);}\n' +
'.tg.bk{background:rgba(255,76,76,.07);color:var(--red);border:1px solid rgba(255,76,76,.25);}\n' +
'.td{cursor:pointer;opacity:.6;font-size:13px;}.td:hover{opacity:1;}\n' +
'.ab{display:flex;gap:12px;align-items:stretch;margin-bottom:14px;}\n' +
'.br{flex:1;background:transparent;border:1px solid var(--gold);color:var(--gold);font-family:"Josefin Sans",sans-serif;font-size:14px;font-weight:400;letter-spacing:.5em;text-transform:uppercase;padding:14px;cursor:pointer;position:relative;overflow:hidden;transition:color .35s;}\n' +
'.br::before{content:"";position:absolute;inset:0;background:linear-gradient(135deg,var(--gold),var(--gold-light));transform:scaleX(0);transform-origin:left;transition:transform .45s ease;z-index:0;}\n' +
'.br:hover{color:var(--navy);}.br:hover::before{transform:scaleX(1);}\n' +
'.br span{position:relative;z-index:1;}\n' +
'.cdb{background:var(--navy-card);border:1px solid var(--gold-border);padding:10px 16px;text-align:center;min-width:72px;display:flex;flex-direction:column;justify-content:center;}\n' +
'.cdn{font-family:"Cormorant Garamond",serif;font-size:28px;font-weight:700;color:var(--gold);line-height:1;}\n' +
'.cdl{font-size:9px;letter-spacing:.4em;color:var(--text-dim);margin-top:3px;text-transform:uppercase;}\n' +
'.sb{background:rgba(0,0,0,.3);border:1px solid rgba(212,175,55,.12);padding:10px 16px;display:flex;flex-wrap:wrap;gap:12px;align-items:center;font-size:12px;color:var(--text-dim);letter-spacing:.1em;margin-bottom:28px;}\n' +
'.sb b{color:var(--gold);}\n' +
'.sp{font-size:10px;letter-spacing:.2em;padding:2px 9px;border:1px solid;font-weight:600;text-transform:uppercase;}\n' +
'.sp.lv{background:rgba(0,217,126,.06);color:var(--green);border-color:rgba(0,217,126,.25);}\n' +
'.sp.bk{background:rgba(255,76,76,.06);color:var(--red);border-color:rgba(255,76,76,.25);}\n' +
'.sr{margin-left:auto;font-size:10px;letter-spacing:.2em;}\n' +
'.dv{display:flex;align-items:center;gap:12px;font-size:10px;letter-spacing:.55em;text-transform:uppercase;color:var(--text-dim);margin-bottom:18px;}\n' +
'.dv::before,.dv::after{content:"";flex:1;height:1px;background:linear-gradient(to right,transparent,rgba(212,175,55,.2),transparent);}\n' +
'.ni{background:var(--navy-card);border:1px solid var(--gold-border);padding:18px 20px;margin-bottom:10px;position:relative;cursor:pointer;transition:border-color .2s,transform .15s;}\n' +
'.ni::before{content:"";position:absolute;left:0;top:0;bottom:0;width:2px;background:var(--gold);transform:scaleY(0);transform-origin:top;transition:transform .28s ease;}\n' +
'.ni:hover::before{transform:scaleY(1);}\n' +
'.ni:hover{border-color:var(--gold);transform:translateX(3px);}\n' +
'.ni.hot{border-left:3px solid var(--green);}\n' +
'.ni.hot::before{background:var(--green);}\n' +
'.hb{font-size:10px;font-weight:700;color:var(--green);margin-bottom:5px;letter-spacing:.5em;text-transform:uppercase;}\n' +
'.nt{font-family:"Cormorant Garamond",serif;font-size:17px;font-weight:400;line-height:1.5;color:var(--white);margin-bottom:8px;}\n' +
'.ni:hover .nt{color:var(--gold);}\n' +
'.ni.hot:hover .nt{color:var(--green);}\n' +
'.nm{display:flex;align-items:center;gap:12px;flex-wrap:wrap;font-size:11px;color:var(--text-dim);}\n' +
'.mb{background:rgba(212,175,55,.08);border:1px solid var(--gold-border);color:var(--gold-light);padding:2px 8px;font-size:10px;font-weight:600;letter-spacing:.2em;text-transform:uppercase;}\n' +
'.bb{background:none;border:none;color:rgba(224,216,200,.25);cursor:pointer;font-size:10px;font-family:"Josefin Sans",sans-serif;letter-spacing:.2em;text-transform:uppercase;padding:0;text-decoration:underline;margin-left:auto;transition:color .15s;}\n' +
'.bb:hover{color:var(--red);}\n' +
'.spin{display:inline-block;width:14px;height:14px;border:2px solid rgba(212,175,55,.2);border-top-color:var(--gold);border-radius:50%;animation:sp .7s linear infinite;vertical-align:middle;margin-right:6px;}\n' +
'@keyframes sp{to{transform:rotate(360deg)}}\n' +
'.em{text-align:center;color:var(--text-dim);font-style:italic;font-size:13px;letter-spacing:.25em;padding:40px 0;}\n' +
'footer{position:relative;z-index:1;padding:28px;border-top:1px solid var(--white-faint);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;}\n' +
'.fl{font-family:"Cormorant Garamond",serif;font-size:16px;font-weight:700;letter-spacing:.3em;color:var(--gold);text-transform:uppercase;}\n' +
'.ft{font-size:11px;letter-spacing:.2em;color:var(--text-dim);}\n' +
'</style>\n' +
'</head>\n' +
'<body>\n' +
'<div id="sl"></div>\n' +
'<header>\n' +
'  <div><div class="lm">The King Tseng</div><div class="ls">Taiwan Intel Feed · Real-time Strategic News</div></div>\n' +
'  <div class="hr"><div class="ht" id="hdrTime"></div><div class="lb"><div class="ld"></div>Live</div></div>\n' +
'</header>\n' +
'<div class="hero">\n' +
'  <div class="hew">AI-Curated Taiwan Intelligence</div>\n' +
'  <h1 class="htl">精選新聞<br><em>即時情報</em></h1>\n' +
'  <p class="hsb">皇上曾奕瑋 · The Gold Content of News</p>\n' +
'</div>\n' +
'<div class="gr"></div>\n' +
'<div class="sec"><div class="wrap">\n' +
'  <div class="sl2">Top 15 Intelligence Stream</div>\n' +
'  <div class="tkb">\n' +
'    <div class="tki">\n' +
'      <div class="tkt">TOP<br>15</div>\n' +
'      <a class="tkc" id="tLink" href="#" target="_blank">\n' +
'        <div class="tkh" id="tHot" style="display:none">★ 命中喜好關鍵字</div>\n' +
'        <div class="tktt" id="tTitle">載入中...</div>\n' +
'        <div class="tkm" id="tMeta"></div>\n' +
'      </a>\n' +
'      <div class="tkcnt" id="tCnt">- / -</div>\n' +
'    </div>\n' +
'    <div class="tkf">\n' +
'      <div class="tkpw"><div class="tkpb"><div class="tkpf" id="tProg"></div></div></div>\n' +
'      <div class="tknv">\n' +
'        <button class="tknvb" onclick="tPrev()">&#8249;</button>\n' +
'        <button class="tknvb" onclick="tNext()">&#8250;</button>\n' +
'      </div>\n' +
'    </div>\n' +
'  </div>\n' +
'</div></div>\n' +
'<div class="gr" style="margin-top:32px;"></div>\n' +
'<div class="sec"><div class="wrap">\n' +
'  <div class="two">\n' +
'    <div class="cb"><div class="cl lv">喜好關鍵字（置頂）</div><div class="ir"><input id="li" placeholder="曾奕瑋、AI..." onkeydown="if(event.key===\\'Enter\\')aT(\\'love\\')"><button class="ib lv" onclick="aT(\\'love\\')">加入</button></div><div class="tr" id="lt"></div></div>\n' +
'    <div class="cb"><div class="cl bk">封鎖黑名單（過濾）</div><div class="ir"><input id="bi" placeholder="三立、爆料..." onkeydown="if(event.key===\\'Enter\\')aT(\\'block\\')"><button class="ib bk" onclick="aT(\\'block\\')">封鎖</button></div><div class="tr" id="bt"></div></div>\n' +
'  </div>\n' +
'  <div class="ab"><button class="br" onclick="hardRefresh()"><span>⊕ &nbsp; 立即更新新聞</span></button><div class="cdb"><div class="cdn" id="cd">60</div><div class="cdl">Auto Refresh</div></div></div>\n' +
'  <div class="sb" id="st">初始化...</div>\n' +
'</div></div>\n' +
'<div class="sec" style="padding-bottom:60px;"><div class="wrap">\n' +
'  <div class="dv">Intelligence Feed</div>\n' +
'  <div id="nl"></div>\n' +
'</div></div>\n' +
'<div class="gr"></div>\n' +
'<footer><div class="fl">The King Tseng AI</div><div class="ft">Taiwan Intel Feed · Real-time</div><div class="ft">For Reference Only</div></footer>\n' +
'<script>\n' +
'var all = ' + DATA + ';\n' +
'var LK="lv7",BK="bk7";\n' +
'var cL=JSON.parse(localStorage.getItem(LK)||\'["曾奕瑋","台積電","晶片","AI","正妹"]\');\n' +
'var cB=JSON.parse(localStorage.getItem(BK)||\'["三立","民視","SETN","FTV"]\');\n' +
'var filtered=[],cd=60,tI=0,tT=null,pT=null,pV=0;\n' +
'function save(){localStorage.setItem(LK,JSON.stringify(cL));localStorage.setItem(BK,JSON.stringify(cB));}\n' +
'window.addEventListener("scroll",function(){var p=window.scrollY/(document.body.scrollHeight-window.innerHeight)*100;document.getElementById("sl").style.width=p+"%";});\n' +
'setInterval(function(){var n=new Date();document.getElementById("hdrTime").textContent=n.getHours().toString().padStart(2,"0")+":"+n.getMinutes().toString().padStart(2,"0")+":"+n.getSeconds().toString().padStart(2,"0");},1000);\n' +
'function fmt(s){if(!s)return"";var d=new Date(s),m=Math.floor((new Date()-d)/60000);if(isNaN(d))return"";if(m<0)m=0;if(m<1)return"Just now";if(m<60)return m+" min ago";if(m<1440)return Math.floor(m/60)+" hr ago";return(d.getMonth()+1)+"/"+(d.getDate());}\n' +
'function render(){\n' +
'  filtered=all.filter(function(n){return !cB.some(function(w){return n.title.includes(w);});});\n' +
'  filtered=filtered.map(function(n){return Object.assign({},n,{hot:cL.some(function(w){return n.title.includes(w);})});});\n' +
'  filtered.sort(function(a,b){return b.hot-a.hot;});\n' +
'  var hot=filtered.filter(function(n){return n.hot;}).length;\n' +
'  var now=new Date();\n' +
'  document.getElementById("st").innerHTML="總計 <b>"+all.length+"</b> 則 &nbsp;·&nbsp; 顯示 <b>"+filtered.length+"</b> 則 &nbsp;<span class=\\"sp lv\\">★ "+hot+"</span> &nbsp;<span class=\\"sp bk\\">✕ "+(all.length-filtered.length)+"</span><span class=\\"sr\\">"+now.getHours().toString().padStart(2,"0")+":"+now.getMinutes().toString().padStart(2,"0")+"</span>";\n' +
'  document.getElementById("nl").innerHTML=filtered.length===0?"<div class=\\"em\\">暫無符合條件的情報</div>":filtered.map(function(n){var s=n.src||"";return\'<div class="ni\'+(n.hot?" hot":"")+\'" onclick="window.open(\\\'"+n.url+"\\\'  ,\\\'_blank\\\')">\'+(n.hot?\'<div class="hb">★ 命中喜好關鍵字</div>\':"")+\'<div class="nt">\'+n.title+\'</div><div class="nm">\'+(s?\'<span class="mb">\'+s+"</span>":""")+(n.date?"<span>"+fmt(n.date)+"</span>":"")+(s?\'<button class="bb" onclick="bS(event,\\\'"+s+"\\\'  )">✕ 封鎖此媒體</button>\':"")+\'</div></div>\';}).join("");\n' +
'  rT2(); tInit();\n' +
'}\n' +
'function bS(e,s){e.preventDefault();e.stopPropagation();if(!cB.includes(s)){cB.push(s);save();render();}}\n' +
'function tInit(){var l=filtered.slice(0,15);if(!l.length){document.getElementById("tTitle").textContent="偵測系統背景初始化中...";return;}tI=0;tShow(l);}\n' +
'function tShow(l){if(!l.length)return;var n=l[tI];document.getElementById("tLink").href=n.url;document.getElementById("tHot").style.display=n.hot?"block":"none";document.getElementById("tTitle").textContent=n.title;document.getElementById("tMeta").innerHTML=(n.src||"")+(n.date?" · "+fmt(n.date):"");document.getElementById("tCnt").textContent=(tI+1)+" / "+l.length;clearTimeout(tT);clearInterval(pT);pV=0;document.getElementById("tProg").style.width="0%";pT=setInterval(function(){pV+=2;document.getElementById("tProg").style.width=Math.min(pV,100)+"%";},100);tT=setTimeout(function(){tI=(tI+1)%l.length;tShow(l);},5000);}\n' +
'function tPrev(){var l=filtered.slice(0,15);if(!l.length)return;tI=(tI-1+l.length)%l.length;tShow(l);}\n' +
'function tNext(){var l=filtered.slice(0,15);if(!l.length)return;tI=(tI+1)%l.length;tShow(l);}\n' +
'function rT2(){document.getElementById("lt").innerHTML=cL.map(function(t,i){return\'<span class="tg lv">\'+t+\' <span class="td" onclick="rT(\\\'love\\\',\'+i+\')">×</span></span>\';}).join("");document.getElementById("bt").innerHTML=cB.map(function(t,i){return\'<span class="tg bk">\'+t+\' <span class="td" onclick="rT(\\\'block\\\',\'+i+\')">×</span></span>\';}).join("");}\n' +
'function aT(type){var id=type==="love"?"li":"bi",v=document.getElementById(id).value.trim();if(!v)return;if(type==="love")cL.push(v);else cB.push(v);document.getElementById(id).value="";save();render();}\n' +
'function rT(type,i){if(type==="love")cL.splice(i,1);else cB.splice(i,1);save();render()}\n' +
'function hardRefresh(){document.getElementById("st").innerHTML=\'<span class="spin"></span>重新提取情報...\';fetch("/api/refresh",{method:"POST"}).then(function(r){return r.json();}).then(function(res){if(res.ok){all=res.cache||all;render();}else{window.location.reload();}}).catch(function(){window.location.reload();});}\n' +
'// ─── [修正 4] 將原本強制的整頁面 reload 升級為「異步無感背景沖刷」 ───\n' +
'// 每 60 秒時間到時，悄悄去問後端有沒有新新聞，有的話「就地更新數據」，使用者完全不用忍受重開網頁的卡頓感！\n' +
'setInterval(function(){\n' +
'  cd--;\n' +
'  document.getElementById("cd").textContent=cd;\n' +
'  if(cd<=0){\n' +
'     cd=60;\n' +
'     fetch("/news.json?t=" + new Date().getTime())\n' +
'       .then(function(res){return res.json();})\n' +
'       .then(function(d){\n' +
'          if(d && d.length){ all = d; render(); }\n' +
'       }).catch(function(){});\n' +
'  }\n' +
'},1000);\n' +
'if(!all || !all.length){\n' +
'   // 如果初次進來伺服器還在進貨，自動啟動每隔1.5秒的快速撈取，直到資料到手為止\n' +
'   var fI = setInterval(function(){\n' +
'      fetch("/news.json").then(function(r){return r.json()}).then(function(d){\n' +
'         if(d && d.length){ all = d; render(); clearInterval(fI); }\n' +
'      })\n' +
'   }, 1500);\n' +
'}\n' +
'render();\n' +
'<\/script>\n' +
'</body></html>`;
}
