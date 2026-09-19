import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { chromium } from 'playwright-core';
import lighthouse from 'lighthouse';
import assert from 'node:assert/strict';

// Production assets, real local API, same-origin proxy. No financial writes.
const root = resolve('dist/browser');
const out = resolve('artifacts/audit');
await mkdir(out, { recursive: true });
const server = createServer(async (req, res) => {
  try {
    if (req.url.startsWith('/api/')) {
      if (req.url === '/api/v1/session' && !req.headers.cookie?.includes('Finanzas-Session')) {
        res.writeHead(401, { 'content-type': 'application/json' });
        res.end('{"title":"Authentication required"}'); return;
      }
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = Buffer.concat(chunks);
      const upstream = await fetch(`http://localhost:5198${req.url}`, {
        method: req.method,
        headers: { cookie: req.headers.cookie ?? '', 'content-type': req.headers['content-type'] ?? 'application/json' },
        ...(body.length ? { body } : {}),
        redirect: 'manual',
      });
      res.writeHead(upstream.status, {
        'content-type': upstream.headers.get('content-type') ?? 'application/json',
        'set-cookie': upstream.headers.getSetCookie(),
      });
      if (req.url === '/api/v1/events') { res.end(); return; }
      res.end(Buffer.from(await upstream.arrayBuffer())); return;
    }
    if (req.url === '/config.js') {
      res.writeHead(200, { 'content-type': 'text/javascript' });
      res.end('window.__FINANZAS_CONFIG__={mode:"api",apiBaseUrl:location.origin};'); return;
    }
    const url = new URL(req.url, 'http://localhost');
    let path = resolve(root, '.' + url.pathname);
    if (!path.startsWith(root + '/') && !path.startsWith(root + '\\')) path = resolve(root, 'index.html');
    let data;
    try { data = await readFile(path); } catch { path = resolve(root, 'index.html'); data = await readFile(path); }
    res.writeHead(200, { 'content-type': ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' })[extname(path)] ?? 'application/octet-stream' });
    res.end(data);
  } catch (e) { res.writeHead(502); res.end(String(e)); }
});
await new Promise(r => server.listen(4400, '127.0.0.1', r));
let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--remote-debugging-port=9223'] });
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.status() >= 400) console.error('HTTP', r.status(), r.url()); });
  const login = await context.request.post('http://127.0.0.1:4400/api/v1/auth/dev-login?who=admin');
  if (!login.ok()) throw new Error(`Local login: ${login.status()}`);
  const metrics = [];
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['dashboard', 'movements', 'accounts', 'calendar', 'people', 'portfolio', 'planning', 'reports', 'notifications', 'settings', 'admin']) {
      const start = performance.now();
      await page.goto(`http://127.0.0.1:4400/${route}`);
      try { await page.locator('.topbar').waitFor(); }
      catch (error) {
        await page.screenshot({ path: `${out}/failure.png` });
        console.error({ route, width, url: page.url(), errors, text: (await page.locator('body').innerText()).slice(0, 1500) });
        throw error;
      }
      await page.waitForTimeout(400);
      assert.equal(new URL(page.url()).pathname, `/${route}`, 'Route must not silently redirect');
      metrics.push({ width, route, loadMs: Math.round(performance.now() - start), ...await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth + 2, charts: document.querySelectorAll('canvas').length })) });
    }
    await page.goto('http://127.0.0.1:4400/accounts');
    await page.locator('.topbar').waitFor();
    if (width === 1440) {
      const colors = await page.locator('[hlmSidebarMenuButton]').evaluateAll(links =>
        links.map(link => ({ active: link.getAttribute('data-active') === 'true', background: getComputedStyle(link).backgroundColor })));
      const active = colors.find(link => link.active);
      assert.ok(active, 'Current route must be marked active');
      assert.ok(colors.filter(link => !link.active).every(link => link.background !== active.background), 'Inactive sidebar links must not look selected');
    }
    if (width === 390) {
      await page.locator('.menu-toggle').click();
      await page.locator('[data-mobile="true"]').waitFor();
      await page.screenshot({ path: `${out}/sidebar-mobile.png` });
      await page.keyboard.press('Escape');
      await page.locator('[data-mobile="true"]').waitFor({ state: 'hidden' });
      assert.ok(await page.locator('.menu-toggle').evaluate(el => el === document.activeElement), 'Closing the mobile menu must restore trigger focus');
    } else {
      await page.screenshot({ path: `${out}/sidebar-desktop.png` });
    }
  }
  const cdp = await context.newCDPSession(page);
  await cdp.send('HeapProfiler.collectGarbage');
  const before = await cdp.send('Memory.getDOMCounters');
  for (let i = 0; i < 10; i++) {
    await page.locator('.menu-toggle').click();
    await page.locator('[data-mobile="true"]').waitFor();
    await page.keyboard.press('Escape');
    await page.locator('[data-mobile="true"]').waitFor({ state: 'hidden' });
  }
  await cdp.send('HeapProfiler.collectGarbage');
  const after = await cdp.send('Memory.getDOMCounters');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('.menu-toggle').click();
  await page.locator('[data-mobile="true"]').waitFor();
  assert.equal(await page.locator('[data-mobile="true"]').evaluate(el => getComputedStyle(el).animationName), 'none', 'Reduced motion must disable drawer animation');
  await page.keyboard.press('Escape');
  await page.locator('[data-mobile="true"]').waitFor({ state: 'hidden' });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  assert.deepEqual(errors, [], 'Routes must not raise uncaught JavaScript errors');
  assert.ok(metrics.every(metric => !metric.overflow), 'Routes must fit the viewport');
  await writeFile(`${out}/browser.json`, JSON.stringify({ metrics, errors, sidebarCycles: { before, after }, scope: 'Production frontend; real seeded local API; session proxy returns 401 without cookie; SSE closed in proxy.' }, null, 2));
  const result = await lighthouse('http://127.0.0.1:4400/login', { port: 9223, output: ['html', 'json'], onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'], logLevel: 'error' });
  await writeFile(`${out}/lighthouse.html`, result.report[0]);
  await writeFile(`${out}/lighthouse.json`, result.report[1]);
  console.log(JSON.stringify({ routes: metrics.length, errors, overflows: metrics.filter(x => x.overflow), sidebarCycles: { before, after }, lighthouse: Object.fromEntries(Object.entries(result.lhr.categories).map(([k, v]) => [k, v.score])) }, null, 2));
} finally { await browser?.close(); server.closeAllConnections(); server.close(); }
