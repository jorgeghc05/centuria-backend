'use strict';

/*
 * Convierte los eventos del Google Calendar del patrón en franjas reservables.
 *
 * Franjas: mañana (8:30–12:30), mediodía (12:30–16:30) y tarde (17:00–21:00).
 *
 * Convención (pensada para usarla desde el móvil sin pensar):
 *   "Libre"                   -> abre las tres franjas ese día
 *   "Mañana" / "Mediodía" / "Tarde" -> abre solo esa franja
 *   "Mañana y tarde"          -> abre esas dos
 *   "Cerrado"                 -> cierra el día (gana siempre a lo que abre)
 *   "Cerrado tarde"           -> cierra solo esa franja
 *   "Reservado mediodía"      -> igual que cerrado (reservas que le llegan por teléfono)
 *
 * Eventos con hora y sin franja en el título:
 *   - si abren ("Libre" de 9:00 a 14:00), abren las franjas que cubren al menos a la mitad;
 *   - si cierran ("Ocupado" de 15:00 a 16:00), cierran todas las franjas que tocan.
 * Los eventos repetidos ("Libre" todos los sábados) funcionan porque pedimos a
 * Google las ocurrencias ya expandidas. Cualquier otro título se ignora.
 *
 * Las reservas pagadas se leen por su hora real, así que si el patrón arrastra
 * una reserva a otro día u otra hora en el calendario, la web lo respeta.
 *
 * Todo este módulo es puro (sin red) para poder probarlo.
 */

const { TURNOS, ORDEN_TURNOS, aMinutos, resolverHorario, turnosQueSolapa } = require('./catalogo');

const RE_CIERRA = /\b(cerrad[oa]s?|ocupad[oa]s?|reservad[oa]s?|reservas?|bloquead[oa]s?|no disponible|no salgo)\b/;
const RE_ABRE = /\b(libres?|abiert[oa]s?|disponibles?|mananas?|medio ?dias?|tardes?|dia|todo)\b/;
const RE_FRANJA = {
  manana: /\bmananas?\b/,
  mediodia: /\bmedio ?dias?\b/,
  tarde: /\btardes?\b/
};

function normalizar(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sumarDias(iso, n) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function rangoFechas(desde, hastaIncluido) {
  const fechas = [];
  for (let f = desde; f <= hastaIncluido; f = sumarDias(f, 1)) fechas.push(f);
  return fechas;
}

// Minutos absolutos de 'YYYY-MM-DDTHH:MM' (solo para restar entre sí).
function minutosAbs(fechaHora) {
  const [f, h] = fechaHora.split('T');
  return Date.parse(f + 'T00:00:00Z') / 60000 + aMinutos(h);
}

// Evento de la API de Google -> forma mínima que usamos aquí.
function desdeGoogle(ev) {
  if (!ev || ev.status === 'cancelled' || !ev.start) return null;
  const privadas = (ev.extendedProperties && ev.extendedProperties.private) || {};
  const todoElDia = Boolean(ev.start.date);
  let reserva = null;
  if (privadas.centuria === 'reserva') {
    reserva = { turnos: privadas.turnos ? privadas.turnos.split(',').filter(t => TURNOS[t]) : null, turno: privadas.turno || null };
  }
  return {
    titulo: ev.summary || '',
    todoElDia,
    // Con timeZone=Europe/Madrid en la petición, dateTime ya viene en hora local.
    inicio: todoElDia ? ev.start.date : String(ev.start.dateTime).slice(0, 16),
    fin: todoElDia ? ev.end.date : String(ev.end.dateTime).slice(0, 16),
    reserva
  };
}

// Trozos de un evento con hora, día a día: [{fecha, desde, hasta}] en minutos del día.
function trozosPorDia(ev) {
  const ini = minutosAbs(ev.inicio);
  const fin = Math.max(minutosAbs(ev.fin), ini + 1);
  const trozos = [];
  for (const fecha of rangoFechas(ev.inicio.slice(0, 10), ev.fin.slice(0, 10))) {
    const base = minutosAbs(`${fecha}T00:00`);
    const desde = Math.max(ini, base) - base;
    const hasta = Math.min(fin, base + 1440) - base;
    if (hasta > desde) trozos.push({ fecha, desde, hasta });
  }
  return trozos;
}

function franjasQueCubre(desde, hasta) {
  return ORDEN_TURNOS.filter(t => {
    const s = aMinutos(TURNOS[t].inicio);
    const e = aMinutos(TURNOS[t].fin);
    return Math.min(hasta, e) - Math.max(desde, s) >= (e - s) / 2;
  });
}

// Reservas antiguas guardaban 'manana' | 'tarde' | 'dia'.
function turnosDeReservaAntigua(turno) {
  if (TURNOS[turno]) return [turno];
  return ORDEN_TURNOS;
}

/**
 * Qué hace un evento del calendario.
 * @returns {{accion:'abre'|'cierra'|'reserva', marcas:Array<{fecha, turno}>}|null}
 *          null si el título no es una marca (se ignora).
 */
function interpretar(ev) {
  if (!ev) return null;
  const marcas = [];

  if (ev.reserva) {
    if (!ev.todoElDia) {
      for (const tr of trozosPorDia(ev)) for (const turno of turnosQueSolapa(tr.desde, tr.hasta)) marcas.push({ fecha: tr.fecha, turno });
    } else {
      const turnos = ev.reserva.turnos || turnosDeReservaAntigua(ev.reserva.turno);
      for (const turno of turnos) marcas.push({ fecha: ev.inicio.slice(0, 10), turno });
    }
    return { accion: 'reserva', marcas };
  }

  const titulo = normalizar(ev.titulo);
  const cierra = RE_CIERRA.test(titulo);
  if (!cierra && !RE_ABRE.test(titulo)) return null;
  const accion = cierra ? 'cierra' : 'abre';
  const nombradas = ORDEN_TURNOS.filter(t => RE_FRANJA[t].test(titulo));

  if (ev.todoElDia) {
    // En Google, la fecha de fin de un evento de todo el día es exclusiva.
    for (const fecha of rangoFechas(ev.inicio.slice(0, 10), sumarDias(ev.fin.slice(0, 10), -1))) {
      for (const turno of nombradas.length ? nombradas : ORDEN_TURNOS) marcas.push({ fecha, turno });
    }
  } else {
    for (const tr of trozosPorDia(ev)) {
      const turnos = nombradas.length ? nombradas : cierra ? turnosQueSolapa(tr.desde, tr.hasta) : franjasQueCubre(tr.desde, tr.hasta);
      for (const turno of turnos) marcas.push({ fecha: tr.fecha, turno });
    }
  }
  return { accion, marcas };
}

/**
 * @param {object} p
 * @param {string} p.desde       YYYY-MM-DD
 * @param {string} p.hasta       YYYY-MM-DD (incluido)
 * @param {Array}  p.eventos     eventos ya pasados por desdeGoogle()
 * @param {Array}  p.especiales  fechas especiales, con sus turnos ya resueltos
 * @param {string} p.primerDia   primera fecha reservable (YYYY-MM-DD)
 * @param {boolean} p.abiertoPorDefecto  true: todo está libre salvo lo que el patrón cierre;
 *                               false: todo está cerrado salvo lo que el patrón abra
 * @returns {Object<string, {manana, mediodia, tarde, eventos?}>}
 *          Cada franja: 'libre' | 'ocupado' | 'cerrado'.
 *          Solo incluye días con algo libre u ocupado. Lo que no aparece está cerrado.
 */
function calcular({ desde, hasta, eventos, especiales = [], primerDia, abiertoPorDefecto = false }) {
  const dias = new Map();
  const franja = (fecha, turno) => {
    if (fecha < desde || fecha > hasta || !TURNOS[turno]) return null;
    if (!dias.has(fecha)) {
      dias.set(fecha, Object.fromEntries(ORDEN_TURNOS.map(t => [t, { abierto: false, cerrado: false, ocupado: false, evento: null }])));
    }
    return dias.get(fecha)[turno];
  };

  if (abiertoPorDefecto) {
    for (const fecha of rangoFechas(desde, hasta)) for (const t of ORDEN_TURNOS) franja(fecha, t).abierto = true;
  }

  for (const ev of eventos) {
    const r = interpretar(ev);
    if (!r) continue;
    for (const { fecha, turno } of r.marcas) {
      const s = franja(fecha, turno);
      if (!s) continue;
      if (r.accion === 'reserva') s.ocupado = true;
      else if (r.accion === 'cierra') s.cerrado = true;
      else s.abierto = true;
    }
  }

  for (const esp of especiales) {
    for (const turno of esp.turnos) {
      const s = franja(esp.fecha, turno);
      if (!s) continue;
      s.abierto = true;
      s.evento = esp.id;
    }
  }

  const resultado = {};
  for (const fecha of [...dias.keys()].sort()) {
    if (primerDia && fecha < primerDia) continue;
    const d = dias.get(fecha);
    const salida = {};
    const eventosDia = {};
    for (const t of ORDEN_TURNOS) {
      const s = d[t];
      salida[t] = s.ocupado ? 'ocupado' : s.cerrado || !s.abierto ? 'cerrado' : 'libre';
      if (s.evento && salida[t] === 'libre') eventosDia[t] = s.evento;
    }
    if (ORDEN_TURNOS.every(t => salida[t] === 'cerrado')) continue;
    if (Object.keys(eventosDia).length) salida.eventos = eventosDia;
    resultado[fecha] = salida;
  }
  return resultado;
}

/**
 * Marca como 'retenido' las franjas de pagos que están en curso, para que
 * otra persona no pague el mismo hueco mientras tanto.
 * @param {object} disp  resultado de calcular() (no se modifica)
 * @param {Array<{fecha, turnos}>} retenciones
 */
function aplicarRetenciones(disp, retenciones) {
  if (!retenciones.length) return disp;
  const copia = {};
  for (const [fecha, dia] of Object.entries(disp)) copia[fecha] = { ...dia };
  for (const r of retenciones) {
    const dia = copia[r.fecha];
    if (!dia) continue;
    for (const t of r.turnos) if (dia[t] === 'libre') dia[t] = 'retenido';
  }
  return copia;
}

/**
 * ¿Se puede reservar este servicio en esta fecha y horario?
 * @param {string} valor  franja, 'HH:MM', 'sol' o 'evento' (ver catalogo.opciones)
 * @returns {string|null} null si se puede; si no, el motivo.
 */
function comprobarHueco(disponibilidad, servicio, fecha, valor) {
  if (servicio.tipo === 'evento' && servicio.fecha !== fecha) return 'Esta salida solo se hace en su fecha.';
  const op = resolverHorario(servicio, fecha, valor);
  if (!op || !op.turnos.length) return 'Ese horario no está disponible para esta salida.';
  const dia = disponibilidad[fecha];
  if (!dia) return 'Ese día no hay salidas disponibles.';
  for (const t of op.turnos) {
    if (dia[t] === 'retenido') return 'Otra persona está terminando de pagar ese hueco. Si no lo completa, vuelve a quedar libre en media hora.';
    if (dia[t] !== 'libre') return 'Ese horario ya no está libre.';
    const evento = dia.eventos && dia.eventos[t];
    if (evento && evento !== servicio.id) return 'Esa franja está reservada para una salida especial.';
  }
  return null;
}

module.exports = { calcular, comprobarHueco, aplicarRetenciones, interpretar, desdeGoogle, normalizar, sumarDias };
