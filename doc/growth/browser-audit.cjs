const fs = require('node:fs');
const path = require('node:path');
async function main() {
  const links = path.join(process.env.LOCALAPPDATA, 'ms-playwright', '.links');
  const packagePath = fs.readdirSync(links).map(name => fs.readFileSync(path.join(links, name), 'utf8').trim()).find(candidate => fs.existsSync(candidate));
  if (!packagePath) throw new Error('No installed browser package found');
  const { chromium } = require(packagePath);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const observations = { checkedAt: new Date().toISOString(), pages: [], blockedPosts: [] };
  await context.route('https://rubricheck.com/api/**', async route => {
    if (route.request().method() !== 'GET') {
      observations.blockedPosts.push(new URL(route.request().url()).pathname);
      return route.abort();
    }
    return route.continue();
  });
  const directory = path.join(__dirname, 'evidence');
  fs.mkdirSync(directory, { recursive: true });
  async function capture(name) {
    await page.screenshot({ path: path.join(directory, `${name}.png`), fullPage: true });
    observations.pages.push({ name, url: page.url(), title: await page.title(), text: await page.locator('body').innerText() });
  }
  try {
    await page.goto('https://rubricheck.com/', { waitUntil: 'networkidle', timeout: 45000 });
    await capture('home-desktop');
    await page.getByRole('button', { name: 'Grade my assignment', exact: true }).click();
    await capture('first-evaluation-login');
    await page.goto('https://rubricheck.com/pricing', { waitUntil: 'networkidle', timeout: 45000 });
    await capture('pricing-monthly');
    await page.getByRole('button', { name: 'Annual', exact: true }).click();
    await capture('pricing-annual');
    await page.getByRole('button', { name: 'Evaluation Top-Ups', exact: true }).click();
    await capture('pricing-topups');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('https://rubricheck.com/', { waitUntil: 'networkidle', timeout: 45000 });
    await capture('home-mobile');
    observations.mobileHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  } finally {
    fs.writeFileSync(path.join(directory, 'public-site-observations.json'), JSON.stringify(observations, null, 2));
    await browser.close();
  }
  console.log(JSON.stringify(observations, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
