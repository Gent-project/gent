// Run with NODE_PATH pointing to a Playwright installation and the production server on port 3105.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const scenario of ['public', 'denied', 'private']) {
      const context = await browser.newContext();
      const page = await context.newPage();
      const requests = [];
      await page.route('https://gent-api.onrender.com/api/**', async route => {
        const url = new URL(route.request().url());
        requests.push(url.pathname);
        const detail = url.pathname === '/api/repos/1/demo/';
        await route.fulfill({ status: scenario === 'denied' ? 401 : 200,
          contentType: 'application/json', body: JSON.stringify(detail ? {
            id: 1, owner_id: 1, owner_email: 'owner@example.com', name: 'demo',
            description: 'Public browsing test', is_private: scenario === 'private',
            default_branch: 'main', created_at: '2026-09-01', updated_at: '2026-09-01'
          } : []) });
      });
      await page.goto('http://localhost:3105/dashboard/repository/1/demo');
      if (scenario === 'public') {
        await page.getByRole('heading', { name: 'owner / demo' }).waitFor();
        assert.equal(await page.getByRole('link', { name: 'Settings', exact: true }).count(), 0);
        assert.equal(await page.getByRole('button', { name: 'Add file', exact: true }).isVisible(), false);
        await page.getByRole('button', { name: /^Branches/ }).click();
        assert.equal(await page.getByRole('button', { name: 'New branch', exact: true }).isVisible(), false);
        await page.getByRole('button', { name: /^Tags/ }).click();
        assert.equal(await page.getByRole('button', { name: 'New tag', exact: true }).isVisible(), false);
        assert.match(await page.getByRole('link', {name:'Sign in', exact:true}).getAttribute('href'), /next=/);
      } else {
        await page.getByRole('heading', { name: 'Repository not found' }).waitFor({ timeout: 20000 });
        assert(!requests.some(p => /branches|commits|tags/.test(p)));
      }
      assert(page.url().endsWith('/dashboard/repository/1/demo'));
      assert(!requests.includes('/api/repos/'));
      await page.goto('http://localhost:3105/dashboard/repository/1/demo/settings');
      await page.waitForURL('**/auth/login?next=**');
      console.log(`${scenario}: guest access, mutation controls, settings protection passed`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
