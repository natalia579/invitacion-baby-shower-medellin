// Prueba de punta a punta en tamaño de celular (requiere el simulador en :8787 y la página en :8080)
import { chromium, devices } from 'playwright';
import fs from 'node:fs';

const OUT = 'capturas';
fs.mkdirSync(OUT, { recursive: true });
const disp = process.argv[2] || 'iphone';
const perfiles = {
  iphone: { ...devices['iPhone 13'] },
  android: { ...devices['Pixel 7'] },
  pc: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
};
const ids = await (await fetch('http://localhost:8787/__ids')).json();
const filas = async () => (await fetch('http://localhost:8787/__rows')).json();

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const ctx = await browser.newContext({ ...perfiles[disp], recordVideo: disp === 'iphone' ? { dir: OUT + '/video', size: { width: 390, height: 844 } } : undefined });
const page = await ctx.newPage();
const errores = [];
page.on('pageerror', (e) => errores.push(e.message));
page.on('console', (m) => m.type() === 'error' && errores.push(m.text()));

const shot = (n) => page.screenshot({ path: `${OUT}/${disp}-${n}.png` });
await page.goto(`http://localhost:8080/?i=${ids[0]}`);
if (disp === 'iphone') {
  for (const [ms, n] of [[1700, '01-entra'], [1500, '02-rueda'], [900, '03-cae'], [900, '04-aterriza'], [1400, '05-sale'], [1300, '06-camara']]) {
    await page.waitForTimeout(ms); await shot(n);
  }
}
await page.waitForSelector('#sello.listo', { timeout: 20000 });
await page.waitForTimeout(1300);
await shot('07-toca');
await page.click('#sello');
for (const [ms, n] of [[420, '08-grieta'], [700, '09-solapa'], [1100, '10-carta-sale'], [1400, '11-despliega']]) {
  await page.waitForTimeout(ms); await shot(n);
}
await page.waitForTimeout(3500);
await shot('12-carta');

const secciones = await page.$$('.seccion');
for (let i = 1; i < secciones.length; i++) {
  await secciones[i].scrollIntoViewIfNeeded();
  await page.waitForTimeout(1300);
  await shot(`13-seccion-${i}`);
}

/* confirmación */
const res = {};
await page.locator('#confirmar').scrollIntoViewIfNeeded();
await page.waitForSelector('[data-r="yes"]', { timeout: 10000 });
res.saludo = await page.textContent('.rsvp-hola');
await page.click('[data-r="yes"]');
await page.waitForSelector('#cambiar', { timeout: 10000 });
await page.waitForTimeout(900);
await shot('14-confirmado');
res.trasSi = (await filas()).map((r) => r.slice(1, 5));
await page.click('#cambiar');
await page.click('[data-r="no"]');
await page.waitForSelector('#cambiar', { timeout: 10000 });
res.trasNo = (await filas()).map((r) => r.slice(1, 5));
res.textoNo = await page.textContent('.rsvp-actual');

/* sin enlace personal y con enlace inválido */
const p2 = await ctx.newPage();
await p2.goto('http://localhost:8080/');
res.sinEnlace = await p2.textContent('#rsvp');
await p2.goto('http://localhost:8080/?i=' + '0'.repeat(32));
await p2.waitForTimeout(800);
res.enlaceFalso = await p2.textContent('#rsvp');
res.maps = await page.getAttribute('#mapa', 'href');
res.cuenta = (await page.textContent('#cuenta')).replace(/\s+/g, ' ');
res.errores = errores;
console.log(JSON.stringify(res, null, 1));
await ctx.close();
await browser.close();
