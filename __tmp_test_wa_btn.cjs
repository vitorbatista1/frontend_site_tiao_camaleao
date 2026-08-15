const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('http://localhost:4321/presente', { waitUntil: 'networkidle' });
  await page.fill('input[placeholder="Digite o nome da criança aqui"]', 'Pedro');
  await page.getByText('🎧 Ouvir agora!').click();
  await page.waitForSelector('text=Aperte o play', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await page.getByText(/Conhecer as cantigas para/).click();
  await page.waitForSelector('text=Vamos lá!', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(500);

  const href = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find(b => b.textContent.includes('Prefiro comprar com o vendedor'));
    return btn ? 'found button, text: ' + btn.textContent : 'NOT FOUND';
  });
  console.log(href);

  // Intercept window.open to see the URL without actually opening a new tab
  await page.exposeFunction('__capturedOpen', (url) => console.log('window.open called with:', url));
  await page.evaluate(() => {
    window.open = (url) => { window.__capturedOpen(url); return null; };
  });
  await page.getByText('Prefiro comprar com o vendedor').click();
  await page.waitForTimeout(300);

  await page.screenshot({ path: 'C:\\Users\\HTF\\AppData\\Local\\Temp\\claude\\C--Users-HTF-Documents-projetos-ivan-site-tiao\\d9125749-82db-41ec-baf2-d5665260b257\\scratchpad\\oferta-com-wa-btn.png', fullPage: true });

  await browser.close();
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
