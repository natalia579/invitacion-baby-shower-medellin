// Genera index.html: una sola página con las ilustraciones incrustadas.
//   node tools/build.mjs                       → index.html sin conexión a la hoja (muestra “muy pronto”)
//   RSVP_ENDPOINT=https://script.google.com/macros/s/…/exec node tools/build.mjs
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
let html = fs.readFileSync(path.join(root, 'index.src.html'), 'utf8');
html = html.replace(/\{\{IMG:([\w-]+)\}\}/g, (_, n) => {
  const b = fs.readFileSync(path.join(root, 'arte', 'png', n + '.webp'));
  return 'data:image/webp;base64,' + b.toString('base64');
});
html = html.replace('{{ENDPOINT}}', process.env.RSVP_ENDPOINT || '').replace('{{WHATSAPP}}', process.env.WHATSAPP || '');
const outDir = path.join(root, process.env.OUT || '.');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'index.html'), html);
console.log('index.html', (html.length / 1024).toFixed(0) + ' KB →', outDir);
