const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const errors = [];
const expect = (condition, message) => { if (!condition) errors.push(message); };
const indexPath = path.join(ROOT, 'index.html');
expect(fs.existsSync(indexPath), 'root index.html must exist');
const html = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, 'utf8') : '';

if (html) {
  const refs = [...html.matchAll(/(?:src|href)=["']([^"']+)["']|url\(["']?([^"')]+)/g)]
    .map(match => match[1] || match[2])
    .filter(ref => ref.startsWith('assets/'));
  const missing = [...new Set(refs)].filter(ref => !fs.existsSync(path.join(ROOT, ref)));
  expect(missing.length === 0, `all local assets must exist; missing: ${missing.join(', ')}`);
  expect(/<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex[^"']*nofollow/i.test(html), 'review release must keep noindex, nofollow');
  expect(!/\bautoplay\b/i.test(html), 'videos must not autoplay');
  expect(!/\.mobile-shop\s*\{[^}]*position\s*:\s*fixed/is.test(html), 'must not ship a fixed mobile purchase bar');
  expect(!/eczema|psoriasis|healing properties|prescription alternative|no prescription needed/i.test(html), 'uncleared medical or disease-adjacent claims must not ship');
  expect(!/fonts\.googleapis|fonts\.gstatic|https?:\/\/[^"'\s)]+\.(?:css|js)/i.test(html), 'must not load remote runtime CSS or JavaScript');
  const shopLinks = [...html.matchAll(/href=["']([^"']+)["']/g)].map(m => m[1]).filter(href => /truth-bar|\/cart\//i.test(href));
  expect(shopLinks.length >= 1, 'at least one purchase link must exist');
  expect(shopLinks.every(href => href === 'https://vonettacosmetics.com/cart/2417037312009:1'), `all purchase links must use the approved one-bar cart; found: ${shopLinks.join(', ')}`);
  const videos = [...html.matchAll(/<video\b[\s\S]*?<\/video>/gi)].map(m => m[0]);
  expect(videos.length >= 2, 'expected customer video controls');
  expect(videos.every(video => /\bcontrols\b/i.test(video) && !/\bautoplay\b/i.test(video)), 'every active video must use native controls without autoplay');
  expect(videos.every(video => /<track\b[^>]+kind=["']captions["']/i.test(video)), 'every active video with audio must include captions');
}

expect(!fs.existsSync(path.join(ROOT, 'api')), 'static sales page must not ship API handlers');
expect(!fs.existsSync(path.join(ROOT, 'Truth_Bar_Landing_Page.html')), 'duplicate source HTML must not remain publicly addressable');

if (errors.length) {
  console.error(errors.map((error, i) => `${i + 1}. ${error}`).join('\n'));
  process.exit(1);
}
console.log('release-tests: PASS');
