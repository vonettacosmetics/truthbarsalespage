const assert = require('node:assert');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('/opt/data/projects/win-healthy-horizons/node_modules/playwright');

const ROOT = path.resolve(__dirname, '..');
const EVIDENCE = '/opt/data/work/truthbar-new-design-evidence';
fs.mkdirSync(EVIDENCE, { recursive: true });

function mime(file) {
  return ({'.html':'text/html; charset=utf-8','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.mp4':'video/mp4','.vtt':'text/vtt; charset=utf-8','.json':'application/json'})[path.extname(file).toLowerCase()] || 'application/octet-stream';
}
function createServer() {
  return http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    let rel = decodeURIComponent(url.pathname);
    if (rel === '/') rel = '/index.html';
    const file = path.resolve(ROOT, `.${rel}`);
    if (!file.startsWith(`${ROOT}${path.sep}`) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); return res.end('Not found');
    }
    res.writeHead(200, {'Content-Type': mime(file), 'Cache-Control':'no-store'});
    fs.createReadStream(file).pipe(res);
  });
}

async function run() {
  const app = createServer();
  await new Promise(resolve => app.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${app.address().port}`;
  const browser = await chromium.launch({headless:true, executablePath:'/opt/data/back-home-herbals-quiz/browsers/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell'});
  const evidence = {pass:true, base, viewports:[], reducedMotion:null};
  try {
    for (const viewport of [{name:'desktop',width:1440,height:900},{name:'mobile',width:390,height:844},{name:'narrow',width:320,height:720}]) {
      const page = await browser.newPage({viewport});
      const consoleErrors=[]; const httpErrors=[]; const pageErrors=[];
      page.on('console', m => { if (m.type()==='error') consoleErrors.push(m.text()); });
      page.on('pageerror', e => pageErrors.push(e.message));
      page.on('response', r => { if (r.url().startsWith(base) && r.status() >= 400) httpErrors.push(`${r.status()} ${r.url()}`); });
      const response = await page.goto(base, {waitUntil:'domcontentloaded', timeout:120000});
      assert.equal(response.status(), 200);
      await page.evaluate(()=>document.querySelectorAll('img[loading="lazy"]').forEach(image=>{ image.loading='eager'; }));
      await page.evaluate(async()=>{for(let y=0;y<document.body.scrollHeight;y+=Math.max(420,innerHeight*.75)){scrollTo(0,y);await new Promise(r=>setTimeout(r,40))}scrollTo(0,0)});
      await page.waitForFunction(()=>[...document.images].every(i=>i.complete), null, {timeout:120000});
      const metrics = await page.evaluate(() => {
        const visible=e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>1&&r.height>1};
        const controls=[...document.querySelectorAll('a[href],button,summary,video')].filter(visible).map(e=>{const r=e.getBoundingClientRect();return {tag:e.tagName,label:(e.getAttribute('aria-label')||e.textContent||'').trim().slice(0,70),w:r.width,h:r.height};});
        return {
          title:document.title,
          h1:document.querySelectorAll('h1').length,
          docW:document.documentElement.scrollWidth,
          bodyW:document.body.scrollWidth,
          clientW:document.documentElement.clientWidth,
          broken:[...document.images].filter(i=>i.currentSrc||i.getAttribute('src')).filter(i=>!i.complete||!i.naturalWidth).map(i=>i.getAttribute('src')),
          clipped:[...document.querySelectorAll('main img,main video,main a,main button,main summary,main h1,main h2,main h3,main p,main li')].filter(visible).filter(e=>{const r=e.getBoundingClientRect();return r.left < -1 || r.right > innerWidth+1}).map(e=>`${e.tagName}.${e.className}`).slice(0,30),
          undersized:controls.filter(t=>t.w<44||t.h<44),
          fixedPurchases:[...document.querySelectorAll('a[href*="/cart/"]')].filter(e=>['fixed','sticky'].includes(getComputedStyle(e).position)).length,
          purchaseLinks:[...document.querySelectorAll('a[href*="/cart/"]')].map(a=>a.href),
          videos:[...document.querySelectorAll('video')].map(v=>({controls:v.controls,autoplay:v.autoplay,captions:v.querySelectorAll('track[kind="captions"]').length})),
          tickerPause:document.querySelector('.ticker-pause')?.getAttribute('aria-pressed')
        };
      });
      assert.equal(metrics.title, 'The TRUTH Bar™ | Sulfur Face + Body Cleanser | Vonetta Cosmetics');
      assert.equal(metrics.h1,1); assert.equal(metrics.docW,metrics.clientW); assert.equal(metrics.bodyW,metrics.clientW);
      assert.deepEqual(metrics.broken,[]); assert.deepEqual(metrics.clipped,[]); assert.deepEqual(metrics.undersized,[]);
      assert.equal(metrics.fixedPurchases,0); assert.equal(metrics.purchaseLinks.length,3);
      assert.ok(metrics.purchaseLinks.every(h=>h==='https://vonettacosmetics.com/cart/2417037312009:1'));
      assert.equal(metrics.videos.length,2); assert.ok(metrics.videos.every(v=>v.controls&&!v.autoplay&&v.captions===1));
      assert.deepEqual(consoleErrors,[]); assert.deepEqual(httpErrors,[]); assert.deepEqual(pageErrors,[]);
      await page.click('.ticker-pause'); assert.equal(await page.getAttribute('.ticker-pause','aria-pressed'),'true');
      const screenshot=path.join(EVIDENCE,`${viewport.name}.png`); await page.screenshot({path:screenshot,fullPage:true,timeout:120000});
      evidence.viewports.push({viewport,metrics,consoleErrors,httpErrors,pageErrors,screenshot});
      await page.close();
    }
    const context=await browser.newContext({reducedMotion:'reduce',viewport:{width:390,height:844}}); const page=await context.newPage();
    await page.goto(base,{waitUntil:'domcontentloaded',timeout:120000});
    const reduced=await page.evaluate(()=>({matches:matchMedia('(prefers-reduced-motion: reduce)').matches,animations:document.getAnimations().length,tickerDisplay:getComputedStyle(document.querySelector('.ticker-track')).animationName}));
    assert.equal(reduced.matches,true); assert.equal(reduced.animations,0); assert.equal(reduced.tickerDisplay,'none');
    evidence.reducedMotion=reduced; await context.close();
  } finally { await browser.close(); await new Promise(resolve=>app.close(resolve)); }
  fs.writeFileSync(path.join(EVIDENCE,'browser-evidence.json'),JSON.stringify(evidence,null,2)+'\n');
  console.log('browser-tests: PASS');
}
run().catch(error=>{console.error(error.stack||error);process.exit(1)});
