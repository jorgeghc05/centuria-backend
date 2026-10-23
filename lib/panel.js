'use strict';

/*
 * Cálculos del panel a partir de las sesiones de Checkout pagadas en Stripe.
 * Funciones puras (sin red) para poder probarlas.
 *
 * Ojo: solo ve lo que entra por la web. Las reservas que el patrón apunta a
 * mano en su calendario ("Reservado tarde") no tienen pago online y no salen.
 */

const { buscarServicio, precioTotal } = require('./catalogo');
const { bonoDesdeSesion } = require('./bonos');

const fechaMadrid = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' });
const diaMadrid = unix => fechaMadrid.format(new Date(unix * 1000));
const RE_MES = /^\d{4}-(0[1-9]|1[0-2])$/;

function sumarMeses(mes, n) {
  const [y, m] = mes.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

function diasEntre(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

const redondear = n => Math.round(n * 100) / 100;

function reembolso(sesion) {
  const pi = typeof sesion.payment_intent === 'object' && sesion.payment_intent ? sesion.payment_intent : null;
  const cargo = pi && typeof pi.latest_charge === 'object' && pi.latest_charge ? pi.latest_charge : null;
  return cargo ? (cargo.amount_refunded || 0) / 100 : 0;
}

function reservaDesdeSesion(sesion) {
  const m = sesion.metadata || {};
  if (m.tipo === 'bono' || sesion.payment_status !== 'paid' || !m.fecha || !m.servicio) return null;
  const servicio = buscarServicio(m.servicio);
  const personas = Number(m.personas) || 0;
  const senal = (sesion.amount_total || 0) / 100;
  const devuelto = reembolso(sesion);
  const precio = servicio ? precioTotal(servicio, personas) : null;
  const cliente = sesion.customer_details || {};
  const limpio = v => (v && v !== '-' ? v : '');
  return {
    sesion: sesion.id,
    creada: diaMadrid(sesion.created),
    fecha: m.fecha,
    inicio: m.inicio || '',
    fin: m.fin || '',
    servicio: m.servicio,
    salida: servicio ? servicio.nombre : m.servicio,
    personas,
    nombre: m.nombre || cliente.name || '',
    telefono: cliente.phone || '',
    email: cliente.email || '',
    extras: limpio(m.extras),
    descuento: limpio(m.codigo),
    notas: limpio(m.notas),
    idioma: m.idioma === 'en' ? 'en' : 'es',
    senal,
    devuelto,
    cancelada: devuelto > 0 && devuelto >= senal,
    precio,
    resto: precio == null ? null : redondear(precio - senal)
  };
}

/**
 * @param {object[]} sesiones  sesiones de Checkout completadas (payment_intent.latest_charge expandido)
 * @param {string} mes         'YYYY-MM'
 * @param {string} hoy         'YYYY-MM-DD' (Madrid)
 */
function resumen(sesiones, mes, hoy) {
  const reservas = [];
  const bonos = [];
  for (const s of sesiones) {
    const r = reservaDesdeSesion(s);
    if (r) {
      reservas.push(r);
      continue;
    }
    const b = bonoDesdeSesion(s, hoy);
    if (b) bonos.push({ ...b, creado: diaMadrid(s.created), devuelto: reembolso(s) });
  }

  const enMes = f => f && f.slice(0, 7) === mes;
  const vivas = reservas.filter(r => !r.cancelada);

  const salidas = vivas.filter(r => enMes(r.fecha)).sort((a, b) => (a.fecha + a.inicio).localeCompare(b.fecha + b.inicio));
  const facturacion = salidas.reduce((t, r) => t + (r.precio || 0), 0);
  const senales = salidas.reduce((t, r) => t + r.senal - r.devuelto, 0);

  const cobradoReservas = reservas.filter(r => enMes(r.creada)).reduce((t, r) => t + r.senal - r.devuelto, 0);
  const bonosMes = bonos.filter(b => enMes(b.creado));
  const cobradoBonos = bonosMes.reduce((t, b) => t + b.importe - b.devuelto, 0);
  const hechasMes = reservas.filter(r => enMes(r.creada));
  const antelaciones = hechasMes.filter(r => !r.cancelada).map(r => diasEntre(r.creada, r.fecha));

  // Últimos 12 meses hasta el elegido, por fecha de cobro.
  const serie = [];
  for (let i = 11; i >= 0; i--) {
    const m = sumarMeses(mes, -i);
    const cobro = f => f.slice(0, 7) === m;
    serie.push({
      mes: m,
      senales: redondear(reservas.filter(r => cobro(r.creada)).reduce((t, r) => t + r.senal - r.devuelto, 0)),
      bonos: redondear(bonos.filter(b => cobro(b.creado)).reduce((t, b) => t + b.importe - b.devuelto, 0)),
      salidas: vivas.filter(r => cobro(r.fecha)).length
    });
  }

  // Salidas más pedidas en los 12 meses de la serie (por fecha de salida).
  const desde = sumarMeses(mes, -11);
  const porSalida = {};
  for (const r of vivas) {
    const m = r.fecha.slice(0, 7);
    if (m < desde || m > mes) continue;
    porSalida[r.servicio] = porSalida[r.servicio] || { servicio: r.servicio, salida: r.salida, veces: 0, personas: 0 };
    porSalida[r.servicio].veces++;
    porSalida[r.servicio].personas += r.personas;
  }

  const descuentos = {};
  for (const r of hechasMes) if (r.descuento) descuentos[r.descuento] = (descuentos[r.descuento] || 0) + 1;

  const limiteProximas = fechaMasDias(hoy, 14);
  const proximas = vivas
    .filter(r => r.fecha >= hoy && r.fecha <= limiteProximas)
    .sort((a, b) => (a.fecha + a.inicio).localeCompare(b.fecha + b.inicio));

  const bonosOrdenados = bonos.sort((a, b) => b.creado.localeCompare(a.creado));
  const activos = bonosOrdenados.filter(b => b.estado === 'activo');

  return {
    mes,
    hoy,
    kpis: {
      salidas: salidas.length,
      personas: salidas.reduce((t, r) => t + r.personas, 0),
      facturacion: redondear(facturacion),
      senales: redondear(senales),
      restoEfectivo: redondear(facturacion - senales),
      cobradoOnline: redondear(cobradoReservas + cobradoBonos),
      reservasHechas: hechasMes.length,
      canceladas: hechasMes.filter(r => r.cancelada).length,
      antelacionMedia: antelaciones.length ? Math.round(antelaciones.reduce((a, b) => a + b, 0) / antelaciones.length) : null,
      bonosVendidos: bonosMes.length,
      bonosImporte: redondear(cobradoBonos),
      bonosPendientes: activos.length,
      bonosPendientesImporte: redondear(activos.reduce((t, b) => t + b.importe, 0))
    },
    salidas,
    proximas,
    serie,
    porSalida: Object.values(porSalida).sort((a, b) => b.veces - a.veces),
    descuentos: Object.entries(descuentos)
      .map(([codigo, veces]) => ({ codigo, veces }))
      .sort((a, b) => b.veces - a.veces),
    bonos: bonosOrdenados
  };
}

function fechaMasDias(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

module.exports = { RE_MES, resumen, reservaDesdeSesion, sumarMeses, diaMadrid };
