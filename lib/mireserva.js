'use strict';

/*
 * Página privada «Tu salida»: lógica pura (sin red) para poder probarla.
 *
 * Cada reserva pagada lleva un código de acceso aleatorio (acceso) guardado en
 * las propiedades privadas del evento de Google Calendar. Quien tiene el enlace
 * tu-salida.html?r=CODIGO puede ver su salida, cambiar los extras y, según los
 * plazos de las condiciones de reserva, mover la fecha u hora.
 *
 * Plazos (condiciones, punto 3):
 *   - Extras: hasta 48 h antes de la salida.
 *   - Cambio de fecha u hora: libre con más de 72 h; entre 72 y 24 h, una sola
 *     vez; con menos de 24 h, no. Las fechas especiales no se pueden mover.
 */

const crypto = require('crypto');

const HORA_MS = 60 * 60 * 1000;
const PLAZOS = { extrasHoras: 48, cambioLibreHoras: 72, cambioMinimoHoras: 24 };

const RE_TOKEN = /^[A-Za-z0-9_-]{20,64}$/;
const RE_ID_EXTRA = /^[a-z0-9-]{1,30}$/;
const MAX_EXTRAS = 20;

function generarToken() {
  return crypto.randomBytes(18).toString('base64url'); // 24 caracteres, 144 bits
}

/**
 * Qué puede hacer el cliente según cuánto falta para la salida.
 * @param {object} p
 * @param {number} p.inicioMs        inicio de la salida (epoch ms)
 * @param {number} p.ahoraMs
 * @param {boolean} p.esEvento       fecha especial: no se puede mover
 * @param {number} p.cambiosTardios  cambios ya hechos entre 72 y 24 h antes
 */
function plazosReserva({ inicioMs, ahoraMs, esEvento = false, cambiosTardios = 0 }) {
  const horas = (inicioMs - ahoraMs) / HORA_MS;
  const pasada = horas <= 0;
  const extrasHasta = new Date(inicioMs - PLAZOS.extrasHoras * HORA_MS).toISOString();
  const cambioHasta = new Date(inicioMs - PLAZOS.cambioMinimoHoras * HORA_MS).toISOString();
  const cambioLibreHasta = new Date(inicioMs - PLAZOS.cambioLibreHoras * HORA_MS).toISOString();

  let cambio = 'no';
  let motivoCambio = null;
  if (pasada) motivoCambio = 'pasada';
  else if (esEvento) motivoCambio = 'evento';
  else if (horas > PLAZOS.cambioLibreHoras) cambio = 'libre';
  else if (horas >= PLAZOS.cambioMinimoHoras) {
    if (cambiosTardios < 1) cambio = 'una';
    else motivoCambio = 'yaCambiada';
  } else motivoCambio = 'plazo';

  return {
    horas,
    pasada,
    extrasEditables: !pasada && horas >= PLAZOS.extrasHoras,
    extrasHasta,
    cambio,
    motivoCambio,
    cambioHasta,
    cambioLibreHasta
  };
}

/**
 * Extras que manda la página: [{ id, nombre }]. Devuelve la lista limpia o null si no vale.
 * El id sirve para marcar las casillas; el nombre es lo que lee el patrón en el calendario.
 */
function limpiarExtras(lista) {
  if (!Array.isArray(lista) || lista.length > MAX_EXTRAS) return null;
  const vistos = new Set();
  const limpios = [];
  for (const x of lista) {
    if (!x || typeof x !== 'object') return null;
    const id = String(x.id || '');
    const nombre = String(x.nombre || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 90);
    if (!RE_ID_EXTRA.test(id) || !nombre) return null;
    if (vistos.has(id)) continue;
    vistos.add(id);
    limpios.push({ id, nombre });
  }
  return limpios;
}

function idsExtrasValidos(lista) {
  if (!Array.isArray(lista)) return [];
  return [...new Set(lista.map(String).filter(id => RE_ID_EXTRA.test(id)))].slice(0, MAX_EXTRAS);
}

// Cambia la línea que empieza por `prefijo` (p. ej. 'Extras: ') de la descripción del evento.
// Si no existe, la añade al principio.
function reemplazarLinea(descripcion, prefijo, nueva) {
  const lineas = String(descripcion || '').split('\n');
  const i = lineas.findIndex(l => l.startsWith(prefijo));
  if (i >= 0) lineas[i] = prefijo + nueva;
  else lineas.unshift(prefijo + nueva);
  return lineas.join('\n');
}

// Añade una línea al historial de cambios del cliente, al final de la descripción.
function anotarCambio(descripcion, texto, ahora = new Date()) {
  // dd/mm, hh:mm en hora de Madrid (montado a mano: el formato de Intl cambia entre versiones).
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(ahora)
      .map(x => [x.type, x.value])
  );
  const cuando = `${partes.day}/${partes.month}, ${partes.hour}:${partes.minute}`;
  const base = String(descripcion || '').replace(/\s+$/, '');
  const cabecera = '— Cambios hechos por el cliente en su página —';
  const conCabecera = base.includes(cabecera) ? base : `${base}\n\n${cabecera}`;
  return `${conCabecera}\n✎ ${cuando}: ${texto}`.slice(0, 8000);
}

// ✎ delante del título para que el patrón vea en el calendario que el cliente tocó algo.
function marcarTitulo(titulo) {
  const t = String(titulo || '');
  return t.startsWith('✎ ') ? t : `✎ ${t}`;
}

// Fecha y hora local (Madrid) de un evento de Google pedido con timeZone=Europe/Madrid.
function horarioDeEvento(ev) {
  const s = ev.start || {};
  const e = ev.end || {};
  if (s.dateTime) {
    return {
      fecha: String(s.dateTime).slice(0, 10),
      inicio: String(s.dateTime).slice(11, 16),
      fin: e.dateTime ? String(e.dateTime).slice(11, 16) : null,
      inicioMs: Date.parse(s.dateTime)
    };
  }
  // Si el patrón la pasó a «todo el día», tomamos las 8:30 de ese día como referencia.
  const fecha = s.date;
  return { fecha, inicio: null, fin: null, inicioMs: Date.parse(`${fecha}T08:30:00+02:00`) };
}

function primerNombre(nombre) {
  return String(nombre || '').trim().split(/\s+/)[0].slice(0, 40);
}

module.exports = {
  PLAZOS,
  RE_TOKEN,
  generarToken,
  plazosReserva,
  limpiarExtras,
  idsExtrasValidos,
  reemplazarLinea,
  anotarCambio,
  marcarTitulo,
  horarioDeEvento,
  primerNombre
};
