const express = require('express');
const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>台灣新聞</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:sans-serif;background:#0d0f14;color:#e2e8f0;padding:12px;min-height:100vh}
h1{text-align:center;font-size:18px;margin-bottom:14px;color:#fff}
h1 span{color:#3b82f6}
.cd{background:#161a23;border:1px solid #2a3044;border-radius:8px;display:flex;overflow:hidden;text-decoration:none;margin-bottom:8px;transition:border-color .15s}
.cd:hover{border-color:#3b82f6}
.cd.ht{border-left:3px solid #10b981}
.cp{width:90px;min-height:68px;flex-shrink:0;background:#1e2433;display:flex;align-items:center;justify-content:center;font-size:22px;color:#2a3044}
.cd img{width:90px;min-height:68px;max-height:90px;flex-shrink:0;object-fit:cover}
.cb{flex:1;padding:9px 11px;display:flex;flex-direction:column;justify-content:center}
.cbg{font-size:10px;font-weight:700;color:#10b981;margin-bottom:3px}
.ct{font-size:13px;font-weight:600;line-height:1.4;color:#e2e8f0}
.cm{font-size:11px;color:#64748b;margin-top:4px}
.sb{background:#161a23;border:1px solid #2a3044;border-radius:7px;padding:8px 12px;font-size:12px;color:#64748b;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center}
.sb b{color:#e2e8f0}
.spin{display:inline-block;width:20px;height:20px;border:2px solid #2a3044;border-top-color:#3b82f6;border-radius:50%;animation:sp .7s linear infinite;vertical-align:middle;margin-right:6px}
@keyframes sp{to{transform:rotate(360deg)}}
</style>
</head>
<body>
<h1>🎯 台灣新聞 <span>每30秒更新</span></h1>
<div class="sb">
  <span id="st"><span class="spin"></span>載入中...</span>
  <span id="cd" style="color:#3b82f6;font-weight:700">30</span>
</div>
<div id="nl"></div>

<script>
var PROXY = 'https://api.rss2json.com/v1/api.json?rss_url=';
var FEED = 'https://news.google.com/rss?hl=zh-TW&gl=TW&ceid=TW:zh-Hant';
var allNews = [], shown = 0, cd = 30, loading = false;

function fmt(s){
  if(!s)return'';
  var d=new Date(s),now=new Date(),m=Math.floor((now-d)/60000);
  if(isNaN(d))return'';
  if(m<1)return'剛剛';
  if(m<60)return m+'分前';
  if(m<1440)return Math.floor(m/60)+'小時前';
  return(d.getMonth()+1)+'/'+(d.getDate());
}

function render(items){
  var h='';
  items.forEach(function(n){
    var th=n.img?'<img src="'+n.img+'" loading="lazy" alt="" onerror="this.style.display=\'none\'">':'<div class="cp">📰</div>';
    h+='<a class="cd'+(n.hot?' ht':'')+'" href="'+n.url+'" target="_blank">'+th+
      '<div class="cb">'+(n.hot?'<div class="cbg">🔥 熱門</div>':'')+
      '<div class="ct">'+n.title+'</div>'+
      '<div class="cm">'+(n.src?'📡 '+n.src+' · ':'')+fmt(n.date)+'</div>'+
      '</div></a>';
  });
  document.getElementById('nl').innerHTML=h;
}

function showNext(){
  if(!allNews.length) return;
  var slice = allNews.slice(shown, shown+15);
  if(slice.length < 15) shown=0, slice=allNews.slice(0,15);
  else shown+=15;
  render(slice);
  document.getElementById('st').innerHTML='✅ 共 <b>'+allNews.length+'</b> 則｜顯示第 '+Math.max(1,shown-14)+'–'+Math.min(shown,allNews.length)+' 則';
}

function fetchFeed(){
  if(loading) return;
  loading=true;
  document.getElementById('st').innerHTML='<span class="spin"></span>更新中...';
  fetch(PROXY + encodeURIComponent(FEED) + '&count=50&api_key=')
    .then(function(r){return r.json();})
    .then(function(d){
      if(!d.items||!d.items.length) throw new Error('empty');
      allNews=[];
      d.items.forEach(function(item){
        var title=(item.title||'').trim();
        var src='', dash=title.lastIndexOf(' - ');
        if(dash!==-1){src=title.substring(dash+3);title=title.substring(0,dash);}
        allNews.push({
          title:title, url:item.link||'#',
          img:item.thumbnail||item.enclosure&&item.enclosure.link||null,
          src:src, date:item.pubDate||null, hot:false
        });
      });
      shown=0;
      showNext();
      loading=false;
    })
    .catch(function(){
      // fallback: 用 fetch + CORS proxy
      fetch('https://corsproxy.io/?' + encodeURIComponent(FEED))
        .then(function(r){return r.text();})
        .then(function(xml){
          allNews=[];
          var items=xml.split('<item>');
          for(var i=1;i<items.length;i++){
            var it=items[i];
            var tM=it.match(/<title>([\s\S]*?)<\/title>/);
            var lM=it.match(/<link>([\s\S]*?)<\/link>/);
            var dM=it.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
            var mM=it.match(/media:content[^>]+url="([^"]+)"/)||it.match(/<enclosure[^>]+url="([^"]+)"/);
            if(!tM||!lM)continue;
            var rawT=tM[1].replace('<![CDATA[','').replace(']]>','').trim();
            var src='',dash=rawT.lastIndexOf(' - ');
            if(dash!==-1){src=rawT.substring(dash+3);rawT=rawT.substring(0,dash);}
            allNews.push({title:rawT,url:lM[1].trim(),img:mM?mM[1]:null,src:src,date:dM?dM[1].trim():null,hot:false});
          }
          shown=0;showNext();loading=false;
        })
        .catch(function(){
          document.getElementById('st').innerHTML='<span style="color:#ef4444">❌ 無法載入，請稍後再試</span>';
          loading=false;
        });
    });
}

// 每30秒換15則，每5分鐘重抓一次
setInterval(function(){
  cd--;
  document.getElementById('cd').textContent=cd;
  if(cd<=0){
    cd=30;
    showNext();
  }
}, 1000);

setInterval(fetchFeed, 5*60*1000);

fetchFeed();
</script>
</body>
</html>`);
});

app.listen(PORT, function(){
    console.log('Server running on port ' + PORT);
});
