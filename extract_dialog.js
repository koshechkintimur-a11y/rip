const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto('https://chatgpt.com/share/6a8b2d6c-9eb8-83eb-a683-d81c23844cad', { waitUntil: 'networkidle', timeout: 60000 });
  // подождём рендер сообщений
  await page.waitForTimeout(5000);

  const text = await page.evaluate(() => {
    // ищем контейнеры сообщений — у ChatGPT share есть article/div с data-message-author-role
    const articles = document.querySelectorAll('article, [data-message-author-role]');
    if (articles.length) {
      return Array.from(articles).map(a => {
        const role = a.getAttribute('data-message-author-role') || '?';
        return `### ${role}\n${a.innerText}`;
      }).join('\n\n');
    }
    return document.body.innerText;
  });

  console.log(text.slice(0, 60000));
  await browser.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
