/**
 * Simulador local de Google Sheets + Apps Script para probar apps-script/Codigo.gs
 * SIN cuenta de Google. Ejecuta el código real del programa sobre una hoja en memoria.
 *
 *   node tools/simulador-sheets.mjs test    → pruebas automáticas
 *   node tools/simulador-sheets.mjs serve   → http://localhost:8787/exec para probar la invitación
 */
import fs from 'node:fs';
import http from 'node:http';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const CODE = fs.readFileSync(fileURLToPath(new URL('../apps-script/Codigo.gs', import.meta.url)), 'utf8');
const colNum = (l) => l.split('').reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0);

class Sheet {
  constructor(name) { this.name = name; this.cells = new Map(); }
  getName() { return this.name; }
  setName(n) { this.name = n; return this; }
  get(r, c) { return this.cells.get(`${r},${c}`) ?? { v: '', f: '' }; }
  set(r, c, cell) { this.cells.set(`${r},${c}`, cell); }
  getLastRow() {
    let m = 0;
    for (const [k, cell] of this.cells) if (cell.v !== '' || cell.f) m = Math.max(m, Number(k.split(',')[0]));
    return m;
  }
  setFrozenRows() {}
  setColumnWidth() {}
  getRange(a, b, nr = 1, nc = 1) {
    if (typeof a === 'string') {
      const m = a.match(/^([A-Z]+)(\d*)(?::([A-Z]+)(\d*))?$/);
      const c1 = colNum(m[1]), r1 = Number(m[2] || 1);
      const c2 = m[3] ? colNum(m[3]) : c1, r2 = m[4] ? Number(m[4]) : m[2] ? r1 : 1000;
      return new Range(this, r1, c1, r2 - r1 + 1, c2 - c1 + 1);
    }
    return new Range(this, a, b, nr, nc);
  }
}

class Range {
  constructor(sheet, r, c, nr, nc) { Object.assign(this, { sheet, r, c, nr, nc }); }
  getSheet() { return this.sheet; }
  getRow() { return this.r; }
  getColumn() { return this.c; }
  getNumRows() { return this.nr; }
  getNumColumns() { return this.nc; }
  getValue() { return this.sheet.get(this.r, this.c).v; }
  getValues() {
    return Array.from({ length: this.nr }, (_, i) => Array.from({ length: this.nc }, (_, j) => this.sheet.get(this.r + i, this.c + j).v));
  }
  setValue(v) { this.sheet.set(this.r, this.c, { v, f: '' }); return this; }
  setValues(rows) {
    rows.forEach((row, i) => row.forEach((v, j) => {
      const isF = typeof v === 'string' && v.startsWith('=');
      this.sheet.set(this.r + i, this.c + j, isF ? { v: '', f: v } : { v, f: '' });
    }));
    return this;
  }
  setFormula(f) { this.sheet.set(this.r, this.c, { v: '', f }); return this; }
  getFormula() { return this.sheet.get(this.r, this.c).f; }
  setFontWeight() { return this; }
  setNumberFormat() { return this; }
  setBackground() { return this; }
  setDataValidation() { return this; }
}

export function createEnv() {
  const sheets = [];
  const first = new Sheet('Hoja 1');
  sheets.push(first);
  const ss = {
    tz: 'UTC',
    getSheets: () => sheets,
    getSheetByName: (n) => sheets.find((s) => s.getName() === n) ?? null,
    insertSheet: (n) => { const s = new Sheet(n); sheets.push(s); return s; },
    setSpreadsheetTimeZone(tz) { this.tz = tz; },
  };
  const dv = { requireValueInList() { return dv; }, setAllowInvalid() { return dv; }, build() { return {}; } };
  const ctx = {
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, newDataValidation: () => dv, flush() {} },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (text) => ({ text, setMimeType() { return this; }, getContent() { return this.text; } }),
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: { getUuid: () => crypto.randomUUID() },
    console,
  };
  vm.createContext(ctx);
  vm.runInContext(CODE, ctx);
  const api = {
    ss, ctx,
    get: (id) => JSON.parse(ctx.doGet({ parameter: { id } }).getContent()),
    post: (body) => JSON.parse(ctx.doPost({ postData: { contents: typeof body === 'string' ? body : JSON.stringify(body) } }).getContent()),
    getSave: (params) => JSON.parse(ctx.doGet({ parameter: params }).getContent()),
    addGuests(names) {
      const sh = ss.getSheetByName('Invitados');
      const start = sh.getLastRow() + 1;
      names.forEach((n, i) => sh.getRange(start + i, 2).setValue(n));
      ctx.onEdit({ range: sh.getRange(start, 2, names.length, 1) });
      return names.map((_, i) => sh.getRange(start + i, 1).getValue());
    },
    rows() {
      const sh = ss.getSheetByName('Invitados');
      return sh.getRange(2, 1, Math.max(0, sh.getLastRow() - 1), 6).getValues();
    },
  };
  ctx.configurar();
  return api;
}

function runTests() {
  const t = createEnv();
  const results = [];
  const check = (name, fn) => {
    try { fn(); results.push(['OK   ', name]); } catch (e) { results.push(['FALLA', `${name} — ${e.message}`]); }
  };
  const isDate = (v) => Object.prototype.toString.call(v) === '[object Date]';

  check('configurar() usa la primera pestaña como “Invitados” y crea Configuración y Resumen', () => {
    assert.equal(t.ss.getSheets()[0].getName(), 'Invitados');
    for (const n of ['Configuración', 'Resumen']) assert.ok(t.ss.getSheetByName(n));
    assert.equal(t.ss.tz, 'America/Bogota');
    assert.deepEqual(t.ss.getSheetByName('Invitados').getRange(1, 1, 1, 6).getValues()[0], [
      'Identificador único', 'Nombre', 'Asistencia', 'Fecha y hora de la respuesta', 'Última actualización', 'Enlace personal',
    ]);
    assert.equal(t.ss.getSheetByName('Configuración').getRange('B2').getValue(), 'https://natalia579.github.io/invitacion-baby-shower-medellin/');
  });

  const [ana, beto, carla] = t.addGuests(['Ana Gómez', 'Beto Ruiz', 'Carla Díaz']);
  check('cada invitado recibe un identificador único de 32 caracteres', () => {
    for (const id of [ana, beto, carla]) assert.match(id, /^[a-f0-9]{32}$/);
    assert.equal(new Set([ana, beto, carla]).size, 3);
  });
  check('se crea su enlace personal (?i=identificador)', () => {
    assert.match(t.ss.getSheetByName('Invitados').getRange(2, 6).getFormula(), /\?i="&A2/);
  });
  check('con su enlace, el invitado ve SOLO su nombre y su estado', () => {
    assert.deepEqual(t.get(ana), { ok: true, name: 'Ana Gómez', attending: null });
  });
  check('un identificador inválido o inexistente no revela nada', () => {
    assert.deepEqual(t.get('abc'), { ok: false, error: 'bad_request' });
    assert.deepEqual(t.get('0'.repeat(32)), { ok: false, error: 'not_found' });
    assert.deepEqual(t.get(''), { ok: false, error: 'bad_request' });
  });
  check('“Sí asistiré” se guarda con fecha y hora', () => {
    assert.deepEqual(t.post({ id: ana, attending: 'yes' }), { ok: true, attending: 'yes', name: 'Ana Gómez', id: ana });
    const r = t.rows()[0];
    assert.equal(r[2], 'Sí');
    assert.ok(isDate(r[3]));
    assert.equal(r[4], '');
  });
  check('“No podré asistir” se guarda', () => {
    assert.equal(t.post({ id: beto, attending: 'no' }).ok, true);
    assert.equal(t.rows()[1][2], 'No');
  });
  check('cambiar la respuesta actualiza la MISMA fila y registra la última actualización', () => {
    const antes = t.rows().length;
    const primera = t.rows()[0][3];
    t.post({ id: ana, attending: 'no' });
    t.post({ id: ana, attending: 'yes' });
    assert.equal(t.rows().length, antes);
    const r = t.rows()[0];
    assert.equal(r[2], 'Sí');
    assert.equal(r[3], primera, 'la fecha de la primera respuesta se conserva');
    assert.ok(isDate(r[4]));
  });
  check('el nombre lo pone la hoja: lo que envíe el navegador se ignora', () => {
    t.post({ id: beto, attending: 'no', name: 'Otra Persona' });
    assert.equal(t.rows()[1][1], 'Beto Ruiz');
  });
  check('cualquiera con el enlace puede confirmar escribiendo su nombre (se crea su fila)', () => {
    const antes = t.rows().length;
    const r = t.post({ name: 'Elena Restrepo', attending: 'yes' });
    assert.equal(r.ok, true);
    assert.match(r.id, /^[a-f0-9]{32}$/);
    assert.equal(t.rows().length, antes + 1);
    const fila = t.rows().at(-1);
    assert.deepEqual(fila.slice(1, 3), ['Elena Restrepo', 'Sí']);
  });
  check('el mismo nombre (con otras mayúsculas o tildes) actualiza su fila, sin duplicar', () => {
    const antes = t.rows().length;
    t.post({ name: '  elena   RESTREPÓ ', attending: 'no' });
    t.post({ name: 'Elena Restrepo', attending: 'yes' });
    assert.equal(t.rows().length, antes);
    const fila = t.rows().find((r) => r[1] === 'Elena Restrepo');
    assert.equal(fila[2], 'Sí');
    assert.ok(Object.prototype.toString.call(fila[4]) === '[object Date]');
  });
  check('un nombre ya cargado en la hoja se reconoce al escribirlo', () => {
    const antes = t.rows().length;
    t.post({ name: 'beto ruiz', attending: 'yes' });
    assert.equal(t.rows().length, antes);
    assert.equal(t.rows()[1][2], 'Sí');
  });
  check('nombres inválidos o vacíos se rechazan', () => {
    const antes = t.rows().length;
    for (const n of ['', 'A', '<script>', '123', 'x'.repeat(90)]) assert.equal(t.post({ name: n, attending: 'yes' }).error, 'bad_request', n);
    assert.equal(t.post({ id: '0'.repeat(32), attending: 'yes' }).error, 'not_found');
    assert.equal(t.rows().length, antes);
  });
  check('no hay campo de acompañantes: datos extra se ignoran', () => {
    const antes = t.rows().length;
    t.post({ id: carla, attending: 'yes', guests: 4, companions: ['X'] });
    const r = t.rows()[2];
    assert.deepEqual(r.slice(1, 3), ['Carla Díaz', 'Sí']);
    assert.equal(t.rows().length, antes);
  });
  check('guardar por GET (como usa la invitación) funciona y no duplica', () => {
    const antes = t.rows().length;
    const r = t.getSave({ name: 'Lourdes Abuela', attending: 'yes' });
    assert.equal(r.ok, true);
    assert.equal(t.rows().length, antes + 1);
    const r2 = t.getSave({ id: r.id, attending: 'no' });
    assert.equal(r2.attending, 'no');
    t.getSave({ name: 'lourdes abuela', attending: 'yes' });
    assert.equal(t.rows().length, antes + 1);
    assert.equal(t.getSave({ name: 'x', attending: 'yes' }).error, 'bad_request');
  });
  check('datos inválidos se rechazan', () => {
    assert.equal(t.post({ id: carla, attending: 'quizás' }).error, 'bad_request');
    assert.equal(t.post('no-es-json').error, 'bad_request');
  });
  check('pegar una lista y generar identificadores faltantes', () => {
    const sh = t.ss.getSheetByName('Invitados');
    sh.getRange(5, 2).setValue('Diana Mora');
    t.ctx.generarCodigosFaltantes();
    assert.match(sh.getRange(5, 1).getValue(), /^[a-f0-9]{32}$/);
  });
  check('invitado de prueba para verificar la conexión', () => {
    t.ctx.crearInvitadoDePrueba();
    const r = t.rows().at(-1);
    assert.equal(r[1], 'Invitado de prueba');
    assert.match(r[0], /^[a-f0-9]{32}$/);
  });

  for (const [s, n] of results) console.log(`${s}  ${n}`);
  const failed = results.filter(([s]) => s !== 'OK   ').length;
  console.log(failed ? `\n${failed} prueba(s) fallaron` : `\nTodas las pruebas pasaron (${results.length}).`);
  process.exit(failed ? 1 : 0);
}

function serve() {
  const t = createEnv();
  const ids = t.addGuests(['Laura Martínez', 'Invitado de prueba']);
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    if (url.pathname === '/__rows') return res.end(JSON.stringify(t.rows()));
    if (url.pathname === '/__ids') return res.end(JSON.stringify(ids));
    if (url.pathname !== '/exec') { res.statusCode = 404; return res.end(); }
    if (req.method === 'GET') return setTimeout(() => res.end(JSON.stringify(t.getSave(Object.fromEntries(url.searchParams)))), url.searchParams.get('attending') ? 500 : 0);
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => setTimeout(() => res.end(JSON.stringify(t.post(body))), 600));
  });
  server.listen(8787, () => console.log('Simulador en http://localhost:8787/exec · identificadores:', ids.join(', ')));
}

if (process.argv[2] === 'test') runTests();
else if (process.argv[2] === 'serve') serve();
