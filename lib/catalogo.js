'use strict';

/*
 * Catálogo de salidas y reglas de horario.
 * Los ids tienen que coincidir con web/js/datos.js.
 *
 * El día del barco se divide en tres franjas (TURNOS). El patrón abre o cierra
 * franjas en su Google Calendar. Cada salida ocupa las franjas con las que se
 * solapa su horario, así que una salida larga o una puesta de sol de invierno
 * puede ocupar dos o tres.
 *
 * Cómo se elige la hora (campo modo):
 *   'turno'  -> el cliente elige franja y sale al empezar la franja (paseo, pesca 4 h…)
 *   'inicio' -> el cliente elige la hora de salida, cada 30 min (salidas de 6 y 8 h)
 *   'sol'    -> la hora la marca la puesta de sol de ese día (atardecer)
 * Las fechas especiales tienen horario fijo.
 */

// Franjas del día, hora de Madrid.
const TURNOS = {
  manana: { inicio: '08:30', fin: '12:30', nombre: 'Mañana' },
  mediodia: { inicio: '12:30', fin: '16:30', nombre: 'Mediodía' },
  tarde: { inicio: '17:00', fin: '21:00', nombre: 'Tarde' }
};
const ORDEN_TURNOS = ['manana', 'mediodia', 'tarde'];

// Para las salidas con hora de inicio libre.
const JORNADA = { primeraSalida: '08:30', ultimaVuelta: '21:00', pasoMinutos: 30 };

// Puesta de sol: se calcula para el Real Club El Candado.
const PUERTO = { lat: 36.7165, lon: -4.3505 };
// La salida de atardecer empieza 2 h 30 min antes de que se ponga el sol
// (baño con luz, ver la puesta fondeados y media hora de vuelta).
const ATARDECER_ANTES_MIN = 150;

// precio: euros por salida (todo el grupo), IVA y gasolina incluidos. null = a consultar.
const SERVICIOS = {
  paseo: { nombre: 'Paseo por la costa', en: 'Coastal trip', horas: 3, modo: 'turno', turnos: ['manana', 'mediodia', 'tarde'], precio: 350 },
  atardecer: { nombre: 'Puesta de sol', en: 'Sunset trip', horas: 3, modo: 'sol', precio: 350 },
  delfines: { nombre: 'Avistamiento de delfines', en: 'Dolphin watching', horas: 3, modo: 'turno', turnos: ['manana'], precio: 350 },
  pesca: { nombre: 'Pesca con el patrón (4 h)', en: 'Fishing with the skipper (4 h)', horas: 4, modo: 'turno', turnos: ['manana', 'mediodia', 'tarde'], precio: 399 },
  'pesca-8h': { nombre: 'Pesca con el patrón (8 h)', en: 'Fishing with the skipper (8 h)', horas: 8, modo: 'inicio', precio: 600 },
  celebracion: { nombre: 'Celebración a bordo (4 h)', en: 'Celebration on board (4 h)', horas: 4, modo: 'turno', turnos: ['manana', 'mediodia', 'tarde'], precio: 350 },
  'celebracion-6h': { nombre: 'Celebración a bordo (6 h)', en: 'Celebration on board (6 h)', horas: 6, modo: 'inicio', precio: 500 },
  dia: { nombre: 'Día completo a Maro', en: 'Full day to Maro', horas: 8, modo: 'inicio', precio: 600 }
};

/*
 * Fechas especiales. Ese día sus franjas se abren solas en la web (no hace falta
 * que el patrón las marque) y solo se pueden reservar para el evento.
 * Si el patrón pone "Cerrado" ese día, manda lo suyo.
 *
 * turnos: se deducen del horario. Solo hace falta ponerlos a mano si el evento
 * cae fuera de las franjas (los fuegos, a medianoche).
 * provisional: true -> la fecha aún no la ha anunciado la organización.
 */
const EVENTOS = [
  {
    id: 'legion-2027',
    precioPersona: 200,
    fecha: '2027-03-25',
    horario: { inicio: '08:30', fin: '12:30' },
    nombre: 'Desembarco de la Legión (Jueves Santo)',
    en: 'Spanish Legion landing (Maundy Thursday)',
    provisional: false
  },
  {
    id: 'virgen-submarinistas-2027',
    precioPersona: 150,
    fecha: '2027-07-11',
    horario: { inicio: '10:00', fin: '13:00' },
    nombre: 'Virgen de los submarinistas (Benalmádena)',
    en: 'The divers’ Virgin (Benalmádena)',
    provisional: true
  },
  {
    id: 'virgen-carmen-2027',
    precioPersona: 160,
    fecha: '2027-07-16',
    horario: { inicio: '19:00', fin: '22:00' },
    nombre: 'Virgen del Carmen: procesión marítima',
    en: 'Virgen del Carmen sea procession',
    provisional: false
  },
  {
    id: 'eclipse-2027',
    precioPersona: 180,
    fecha: '2027-08-02',
    horario: { inicio: '09:30', fin: '12:00' },
    nombre: 'Eclipse total de sol desde el mar',
    en: 'Total solar eclipse from the sea',
    provisional: false
  },
  {
    // Termina pasada la medianoche: el evento del calendario se cierra al día siguiente.
    id: 'fuegos-feria-2027',
    precioPersona: 200,
    fecha: '2027-08-13',
    horario: { inicio: '21:00', fin: '01:00' },
    turnos: ['tarde'],
    nombre: 'Fuegos artificiales de la Feria de Málaga',
    en: 'Málaga Fair fireworks',
    provisional: true
  },
  {
    id: 'festival-aereo-2027',
    precioPersona: 200,
    fecha: '2027-09-05',
    horario: { inicio: '11:00', fin: '16:00' },
    nombre: 'Festival Aéreo de Torre del Mar',
    en: 'Torre del Mar Air Show',
    provisional: true
  }
];

// ---------------------------------------------------------------------------
// Horas
// ---------------------------------------------------------------------------
const RE_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

function aMinutos(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function aHora(minutos) {
  const m = ((Math.round(minutos) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

// [inicio, fin) en minutos desde las 00:00. Si termina pasada la medianoche, fin > 1440.
function intervalo({ inicio, fin }) {
  const a = aMinutos(inicio);
  let b = aMinutos(fin);
  if (b <= a) b += 1440;
  return [a, b];
}

function turnosQueSolapa(a, b) {
  return ORDEN_TURNOS.filter(t => {
    const [s, e] = intervalo(TURNOS[t]);
    return a < e && s < b;
  });
}

function turnosDeHorario(horario) {
  return turnosQueSolapa(...intervalo(horario));
}

// ---------------------------------------------------------------------------
// Puesta de sol (algoritmo de la NOAA, error de 1–2 minutos)
// ---------------------------------------------------------------------------
const formatoMadrid = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

function puestaDeSol(fecha, { lat, lon } = PUERTO) {
  const [y, mo, d] = fecha.split('-').map(Number);
  const rad = Math.PI / 180;
  const diaDelAno = (Date.UTC(y, mo - 1, d) - Date.UTC(y, 0, 0)) / 86400000;
  const g = ((2 * Math.PI) / 365) * (diaDelAno - 1 + 0.25);
  const ecTiempo = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl =
    0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const ha = Math.acos(Math.cos(90.833 * rad) / (Math.cos(lat * rad) * Math.cos(decl)) - Math.tan(lat * rad) * Math.tan(decl)) / rad;
  const minutosUTC = 720 - 4 * (lon - ha) - ecTiempo;
  return formatoMadrid.format(new Date(Date.UTC(y, mo - 1, d) + minutosUTC * 60000));
}

// ---------------------------------------------------------------------------
// Servicios y opciones de horario
// ---------------------------------------------------------------------------
function buscarServicio(id) {
  if (Object.prototype.hasOwnProperty.call(SERVICIOS, id)) return { tipo: 'servicio', ...SERVICIOS[id], id };
  const ev = EVENTOS.find(e => e.id === id);
  if (ev) return { tipo: 'evento', ...ev, turnos: ev.turnos || turnosDeHorario(ev.horario) };
  return null;
}

function opcion(valor, inicioMin, finMin, turnos) {
  return { valor, inicio: aHora(inicioMin), fin: aHora(finMin), turnos: turnos || turnosQueSolapa(inicioMin, finMin) };
}

/**
 * Horarios que se pueden elegir para un servicio en una fecha.
 * @returns {Array<{valor:string, inicio:string, fin:string, turnos:string[]}>}
 *   valor es lo que manda la web: id de franja, 'HH:MM', 'sol' o 'evento'.
 */
function opciones(servicio, fecha) {
  if (servicio.tipo === 'evento') {
    const [a, b] = intervalo(servicio.horario);
    return [opcion('evento', a, b, servicio.turnos)];
  }
  const duracion = servicio.horas * 60;
  if (servicio.modo === 'sol') {
    const inicio = Math.floor((aMinutos(puestaDeSol(fecha)) - ATARDECER_ANTES_MIN) / 15) * 15;
    return [opcion('sol', inicio, inicio + duracion)];
  }
  if (servicio.modo === 'inicio') {
    const lista = [];
    const ultima = aMinutos(JORNADA.ultimaVuelta) - duracion;
    for (let m = aMinutos(JORNADA.primeraSalida); m <= ultima; m += JORNADA.pasoMinutos) {
      lista.push(opcion(aHora(m), m, m + duracion));
    }
    return lista;
  }
  return servicio.turnos.map(t => {
    const ini = aMinutos(TURNOS[t].inicio);
    return opcion(t, ini, ini + duracion, [t]);
  });
}

function resolverHorario(servicio, fecha, valor) {
  return opciones(servicio, fecha).find(o => o.valor === valor) || null;
}

// Precio total de la salida en euros, o null si es a consultar.
function precioTotal(servicio, personas) {
  if (servicio.precioPersona) return servicio.precioPersona * personas;
  return servicio.precio || null;
}

module.exports = {
  TURNOS,
  ORDEN_TURNOS,
  JORNADA,
  SERVICIOS,
  EVENTOS,
  RE_HORA,
  aMinutos,
  aHora,
  turnosQueSolapa,
  turnosDeHorario,
  puestaDeSol,
  buscarServicio,
  opciones,
  resolverHorario,
  precioTotal
};
