// Renderiza cada pieza de arte/arte.html a WebP transparente (2×) con Chrome sin interfaz.
import { chromium } from 'playwright';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = path.join(root, 'arte', 'png');
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const page = await browser.newPage({ deviceScaleFactor: 2.5 });
await page.goto('file://' + path.join(root, 'arte', 'arte.html'));
await page.waitForTimeout(300);
const ids = ['sobre-interior', 'sobre-bolsillo', 'sobre-solapa', 'sobre-solapa-int', 'carta', 'sello', 'avioneta', 'helice', 'nube-a', 'nube-b', 'nube-c', 'nube-d', 'globo-v-marfil', 'globo-v-arena', 'globo-v-rosa', 'globo-v-bruma', 'regalo', 'paisaje'];
for (const id of ids) {
  const buf = await page.locator('#' + id).screenshot({ omitBackground: true });
  fs.writeFileSync(path.join(out, id + '.png'), buf);
  await sharp(buf).resize(id.startsWith('nube-') && id.length === 6 ? { width: 860 } : id === 'avioneta' ? { width: 1000 } : id.startsWith('globo') ? { width: 200 } : id === 'paisaje' ? { width: 640 } : id === 'regalo' ? { width: 520 } : undefined).webp({ quality: id.startsWith('nube') ? 80 : 86, alphaQuality: 88, effort: 6 }).toFile(path.join(out, id + '.webp'));
  console.log(id, (fs.statSync(path.join(out, id + '.webp')).size / 1024).toFixed(0) + ' KB');
}
await page.setViewportSize({ width: 1500, height: 900 });
await page.screenshot({ path: path.join(out, '_hoja.png'), fullPage: true });
await browser.close();
