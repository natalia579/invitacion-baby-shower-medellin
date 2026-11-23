/* ═══════════════════ CONFIRMACIÓN INDIVIDUAL ═══════════════════ */
const form = $('#formulario'), panel = $('#rsvp'), aviso = $('#aviso'), campoNombre = $('#nombre');
const notaNombre = $('#notaNombre'), msj = $('#mensaje'), botonEnviar = $('#enviar');
const ID_RE = /^[A-Za-z0-9]{20,40}$/;
const idInvitado = (() => {
  try {
    const u = new URL(location.href);
    const v = u.searchParams.get('i') || new URLSearchParams(u.hash.slice(1)).get('i');
    return v && ID_RE.test(v) ? v : null;
  } catch (e) { return null; }
})();
const conectado = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(RSVP_URL) || /^http:\/\/localhost:\d+\/exec$/.test(RSVP_URL);
let invitado = null;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const primerNombre = (n) => String(n || '').trim().split(/\s+/)[0] || '';
const PUNTOS = '<span class="puntos" aria-hidden="true"><i></i><i></i><i></i></span>';
const ICONO_INFO = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg>';
const conTiempo = (p, ms = 20000) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('tiempo')), ms))]);

function bloquear(texto) {
  form.classList.add('form-off');
  aviso.innerHTML = `<div class="aviso">${ICONO_INFO}<div>${texto}</div></div>`;
  form.querySelectorAll('input, button').forEach((e) => (e.disabled = true));
}
function desbloquear() {
  form.classList.remove('form-off');
  aviso.innerHTML = '';
  form.querySelectorAll('input[type=radio], button').forEach((e) => (e.disabled = false));
}

async function consultar() {
  const r = await conTiempo(fetch(`${RSVP_URL}?id=${encodeURIComponent(idInvitado)}`, { redirect: 'follow' }));
  if (!r.ok) throw new Error('http');
  return r.json();
}
async function guardar(attending) {
  const r = await conTiempo(fetch(RSVP_URL, {
    method: 'POST', redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ id: idInvitado, attending }),
  }));
  if (!r.ok) throw new Error('http');
  const j = await r.json();
  if (!j || j.ok !== true || j.attending !== attending) throw new Error('no-guardado');
  return j;
}

function mostrarFormulario(texto) {
  panel.querySelector('.listo')?.remove();
  form.hidden = false;
  desbloquear();
  campoNombre.value = invitado.name;
  notaNombre.textContent = 'Esta invitación es personal.';
  form.querySelectorAll('input[name=asistencia]').forEach((r) => (r.checked = r.value === invitado.attending));
  botonEnviar.textContent = invitado.attending ? 'ACTUALIZAR RESPUESTA' : 'CONFIRMAR ASISTENCIA';
  msj.className = 'mensaje' + (texto ? ' error' : '');
  msj.textContent = texto || '';
}

function mostrarListo(recien) {
  const si = invitado.attending === 'yes';
  const nombre = esc(primerNombre(invitado.name));
  form.hidden = true;
  panel.querySelector('.listo')?.remove();
  const div = document.createElement('div');
  div.className = 'listo';
  div.innerHTML = `${recien ? '<svg class="check" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="21" opacity=".35"/><path d="M15 24.5 L21.5 31 L33.5 18"/></svg>' : ''}
    <div class="gracias">${si ? `¡Gracias, ${nombre}!` : `Gracias, ${nombre}`}</div>
    <p class="texto mt1" style="text-align:center">${si
      ? (recien ? 'Tu confirmación quedó registrada. Nos hace muy felices que nos acompañes.' : 'Ya tenemos tu confirmación. Nos hace muy felices que nos acompañes.')
      : (recien ? 'Tu respuesta quedó registrada. Te vamos a extrañar, gracias por avisarnos.' : 'Ya tenemos tu respuesta. Te vamos a extrañar.')}</p>
    <div class="resp">${si ? 'ASISTIRÁS' : 'NO PODRÁS ASISTIR'}</div><br>
    <button class="enlace" type="button">Cambiar mi respuesta</button>`;
  div.querySelector('button').onclick = () => mostrarFormulario();
  panel.appendChild(div);
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!invitado) return;
  const elegida = form.querySelector('input[name=asistencia]:checked');
  if (!elegida) { msj.className = 'mensaje error'; msj.textContent = 'Elige una opción para confirmar.'; return; }
  form.querySelectorAll('input, button').forEach((x) => (x.disabled = true));
  msj.className = 'mensaje';
  msj.innerHTML = `Guardando tu respuesta ${PUNTOS}`;
  try {
    const j = await guardar(elegida.value);
    invitado.attending = j.attending;
    mostrarListo(true);
  } catch (err) {
    mostrarFormulario('No pudimos guardar tu respuesta. Revisa tu conexión e inténtalo de nuevo.');
    form.querySelector(`input[value="${elegida.value}"]`).checked = true;
  }
});

async function iniciarRsvp() {
  if (!conectado) {
    bloquear('<b>Confirmación pendiente de conexión.</b><br>Todavía no está conectada la hoja de confirmaciones, así que por ahora no se guarda ninguna respuesta.');
    return;
  }
  if (!idInvitado) {
    bloquear('Esta invitación es personal. Para confirmar, abre el enlace que te enviamos por WhatsApp.');
    return;
  }
  bloquear(`Buscando tu invitación ${PUNTOS}`);
  try {
    const j = await consultar();
    if (j && j.ok) {
      invitado = { name: j.name, attending: j.attending };
      return invitado.attending ? mostrarListo(false) : mostrarFormulario();
    }
    if (j && j.error === 'not_found') return bloquear('No encontramos esta invitación. Escríbenos por WhatsApp y te ayudamos.');
    throw new Error('respuesta');
  } catch (e) {
    bloquear('No pudimos conectarnos en este momento. <button class="enlace" type="button" id="reintentar" style="margin:0;padding:0 4px">Intentar de nuevo</button>');
    const b = $('#reintentar'); b.disabled = false; b.onclick = iniciarRsvp;
  }
}
iniciarRsvp();
