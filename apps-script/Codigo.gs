/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  CONFIRMACIONES — Gender Reveal & Baby Shower · MEDELLÍN (Nati y Santi)
 *  Pega este código completo en Extensiones → Apps Script de la hoja de Medellín.
 *  Es independiente del programa de la primera invitación.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  Cómo funciona:
 *   · Cualquier persona con el enlace de la invitación puede confirmar
 *     escribiendo su nombre. Si ese nombre ya está en la hoja (sin importar
 *     mayúsculas o tildes), se actualiza su misma fila; si no, se agrega.
 *   · También funcionan los enlaces personales (columna F, con ?i=código):
 *     esos ya traen el nombre escrito.
 *   · Cada respuesta es de UNA persona: no hay campo de acompañantes.
 *   · La hoja nunca se hace pública. El programa se ejecuta con tu cuenta.
 */

const HOJA_INVITADOS = 'Invitados';
const HOJA_CONFIG = 'Configuración';
const HOJA_RESUMEN = 'Resumen';
const URL_INVITACION = 'https://natalia579.github.io/invitacion-baby-shower-medellin/';

const COL = { ID: 1, NOMBRE: 2, ASISTENCIA: 3, FECHA: 4, ACTUALIZACION: 5, ENLACE: 6 };
const ENCABEZADOS = [
  'Identificador único',
  'Nombre',
  'Asistencia',
  'Fecha y hora de la respuesta',
  'Última actualización',
  'Enlace personal',
];
const ID_RE = /^[A-Za-z0-9]{20,40}$/;

/* ═══════════════════════════ API (la usa la invitación) ═══════════════════════════ */

/** GET ?id=CODIGO → nombre y respuesta actual de ESA invitación (nada más). */
function doGet(e) {
  const id = limpiarId_(e && e.parameter && e.parameter.id);
  if (!id) return json_({ ok: false, error: 'bad_request' });
  const fila = buscarFila_(id);
  if (!fila) return json_({ ok: false, error: 'not_found' });
  const v = hoja_(HOJA_INVITADOS).getRange(fila, 1, 1, COL.ACTUALIZACION).getValues()[0];
  return json_({ ok: true, name: String(v[COL.NOMBRE - 1] || ''), attending: aApi_(v[COL.ASISTENCIA - 1]) });
}

/** POST { id?, name?, attending: 'yes' | 'no' } → guarda o actualiza la respuesta sin duplicar. */
function doPost(e) {
  let data;
  try {
    data = JSON.parse((e && e.postData && e.postData.contents) || '');
  } catch (err) {
    return json_({ ok: false, error: 'bad_request' });
  }
  const asistencia = data && data.attending === 'yes' ? 'Sí' : data && data.attending === 'no' ? 'No' : null;
  const id = limpiarId_(data && data.id);
  const nombre = limpiarNombre_(data && data.name);
  if (!asistencia || (!id && !nombre)) return json_({ ok: false, error: 'bad_request' });

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = hoja_(HOJA_INVITADOS);
    let fila = id ? buscarFila_(id) : 0;
    if (!fila && id && !nombre) return json_({ ok: false, error: 'not_found' });
    if (!fila && nombre) fila = buscarPorNombre_(nombre);
    if (!fila) {
      // invitado nuevo: se agrega una fila con su propio identificador
      fila = Math.max(2, sh.getLastRow() + 1);
      sh.getRange(fila, COL.NOMBRE).setValue(nombre);
      completarCodigos_(sh, fila, 1);
    }
    const ahora = new Date();
    const primera = sh.getRange(fila, COL.FECHA).getValue();
    sh.getRange(fila, COL.ASISTENCIA).setValue(asistencia);
    if (!primera) {
      sh.getRange(fila, COL.FECHA).setValue(ahora); // primera respuesta
    } else {
      sh.getRange(fila, COL.ACTUALIZACION).setValue(ahora); // cambió o repitió su respuesta
    }
    SpreadsheetApp.flush();
    const v = sh.getRange(fila, 1, 1, COL.ASISTENCIA).getValues()[0];
    return json_({ ok: v[COL.ASISTENCIA - 1] === asistencia, attending: aApi_(v[COL.ASISTENCIA - 1]), name: String(v[COL.NOMBRE - 1] || ''), id: String(v[COL.ID - 1] || '') });
  } finally {
    lock.releaseLock();
  }
}

/* ═══════════════════════════ Automatización de la hoja ═══════════════════════════ */

/** Al escribir nombres en la columna B, crea su identificador y su enlace personal. */
function onEdit(e) {
  if (!e || !e.range) return;
  const sh = e.range.getSheet();
  if (sh.getName() !== HOJA_INVITADOS) return;
  const c1 = e.range.getColumn();
  const c2 = c1 + e.range.getNumColumns() - 1;
  if (c1 > COL.NOMBRE || c2 < COL.NOMBRE) return;
  completarCodigos_(sh, e.range.getRow(), e.range.getNumRows());
}

/** Por si pegas una lista larga: crea los identificadores que falten. */
function generarCodigosFaltantes() {
  const sh = hoja_(HOJA_INVITADOS);
  completarCodigos_(sh, 2, Math.max(0, sh.getLastRow() - 1));
}

function completarCodigos_(sh, desde, cuantas) {
  for (let r = Math.max(2, desde); r < desde + cuantas; r++) {
    const nombre = String(sh.getRange(r, COL.NOMBRE).getValue() || '').trim();
    const id = String(sh.getRange(r, COL.ID).getValue() || '').trim();
    if (nombre && !id) {
      sh.getRange(r, COL.ID).setValue(nuevoCodigo_());
      sh.getRange(r, COL.ENLACE).setFormula(`=IF(A${r}="","",'${HOJA_CONFIG}'!$B$2&"?i="&A${r})`);
    }
  }
}

/** Ejecútalo UNA vez: crea las pestañas, encabezados y el resumen. */
function configurar() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.setSpreadsheetTimeZone('America/Bogota');

  const primera = ss.getSheets()[0];
  const inv = ss.getSheetByName(HOJA_INVITADOS) || (primera.getLastRow() === 0 ? primera.setName(HOJA_INVITADOS) : ss.insertSheet(HOJA_INVITADOS));
  inv.getRange(1, 1, 1, ENCABEZADOS.length).setValues([ENCABEZADOS]).setFontWeight('bold').setBackground('#EFE5D5');
  inv.setFrozenRows(1);
  inv.getRange('D:E').setNumberFormat('dd/mm/yyyy hh:mm');
  inv.setColumnWidth(COL.ID, 260);
  inv.setColumnWidth(COL.NOMBRE, 220);
  inv.setColumnWidth(COL.ENLACE, 420);
  inv.getRange('C2:C').setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(['Sí', 'No'], true).setAllowInvalid(false).build(),
  );

  const cfg = ss.getSheetByName(HOJA_CONFIG) || ss.insertSheet(HOJA_CONFIG);
  cfg.getRange('A1:B1').setValues([['Ajuste', 'Valor']]).setFontWeight('bold');
  cfg.getRange('A2').setValue('Dirección de la invitación de Medellín');
  if (!cfg.getRange('B2').getValue()) cfg.getRange('B2').setValue(URL_INVITACION);

  const res = ss.getSheetByName(HOJA_RESUMEN) || ss.insertSheet(HOJA_RESUMEN);
  const I = HOJA_INVITADOS;
  res.getRange('A1:B4').setValues([
    ['Total de invitados', `=COUNTA('${I}'!B2:B)`],
    ['Asistirán', `=COUNTIF('${I}'!C2:C,"Sí")`],
    ['No asistirán', `=COUNTIF('${I}'!C2:C,"No")`],
    ['Pendientes', '=B1-B2-B3'],
  ]);
  res.getRange('A1:A4').setFontWeight('bold');
  res.getRange('D1:F1').setValues([['Asistirán', 'No asistirán', 'Pendientes']]).setFontWeight('bold');
  res.getRange('D2').setFormula(`=IFERROR(FILTER('${I}'!B2:B,'${I}'!C2:C="Sí"),"")`);
  res.getRange('E2').setFormula(`=IFERROR(FILTER('${I}'!B2:B,'${I}'!C2:C="No"),"")`);
  res.getRange('F2').setFormula(`=IFERROR(FILTER('${I}'!B2:B,'${I}'!B2:B<>"",'${I}'!C2:C=""),"")`);

  generarCodigosFaltantes();
}

/** Crea una fila de prueba para verificar la conexión (bórrala después). */
function crearInvitadoDePrueba() {
  const sh = hoja_(HOJA_INVITADOS);
  const fila = Math.max(2, sh.getLastRow() + 1);
  sh.getRange(fila, COL.NOMBRE).setValue('Invitado de prueba');
  completarCodigos_(sh, fila, 1);
}

/* ═══════════════════════════ utilidades ═══════════════════════════ */

function hoja_(nombre) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nombre);
  if (!sh) throw new Error('Falta la pestaña “' + nombre + '”. Ejecuta la función configurar().');
  return sh;
}

function buscarFila_(id) {
  const sh = hoja_(HOJA_INVITADOS);
  const n = sh.getLastRow() - 1;
  if (n < 1) return 0;
  const ids = sh.getRange(2, COL.ID, n, 1).getValues();
  for (let i = 0; i < ids.length; i++) if (String(ids[i][0]).trim() === id) return i + 2;
  return 0;
}

/** Busca una fila por nombre, sin importar mayúsculas, tildes ni espacios de más. */
function buscarPorNombre_(nombre) {
  const sh = hoja_(HOJA_INVITADOS);
  const n = sh.getLastRow() - 1;
  if (n < 1) return 0;
  const clave = normalizar_(nombre);
  const nombres = sh.getRange(2, COL.NOMBRE, n, 1).getValues();
  for (let i = 0; i < nombres.length; i++) if (normalizar_(nombres[i][0]) === clave) return i + 2;
  return 0;
}

function normalizar_(v) {
  return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Nombre escrito por el invitado: 2 a 80 caracteres, solo letras, espacios y signos comunes. */
function limpiarNombre_(v) {
  const s = String(v || '').replace(/\s+/g, ' ').trim();
  if (s.length < 2 || s.length > 80) return null;
  if (!/^[\p{L}][\p{L} .'’-]*$/u.test(s)) return null;
  return s;
}

function limpiarId_(v) {
  const s = String(v || '').trim();
  return ID_RE.test(s) ? s : null;
}

/** Identificador aleatorio de 32 caracteres (UUID v4 sin guiones). */
function nuevoCodigo_() {
  return Utilities.getUuid().replace(/-/g, '');
}

function aApi_(v) {
  return v === 'Sí' ? 'yes' : v === 'No' ? 'no' : null;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
