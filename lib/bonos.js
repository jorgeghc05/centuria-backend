'use strict';

/*
 * Bonos regalo que se compran online.
 *
 * No hay base de datos: el bono vive en Stripe. Cuando se crea el pago se
 * genera el código y se guarda en los metadatos de la sesión de Checkout y del
 * PaymentIntent. El canje se apunta también ahí (metadato "canjeado"), desde
 * el panel. Así no se toca el calendario del patrón, que interpreta los
 * títulos de sus eventos para abrir y cerrar franjas.
 */

const crypto = require('crypto');
const { SERVICIOS } = require('./catalogo');

const VALIDEZ_MESES = 6;
// Sin 0/O, 1/I/L: que se pueda dictar por teléfono sin errores.
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const RE_CODIGO = /^CEN-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;

function generarCodigo() {
  const trozo = () => Array.from({ length: 4 }, () => ALFABETO[crypto.randomInt(ALFABETO.length)]).join('');
  return `CEN-${trozo()}-${trozo()}`;
}

function normalizarCodigo(texto) {
  const limpio = String(texto || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const sinPrefijo = limpio.startsWith('CEN') ? limpio.slice(3) : limpio;
  if (sinPrefijo.length !== 8) return null;
  const codigo = `CEN-${sinPrefijo.slice(0, 4)}-${sinPrefijo.slice(4)}`;
  return RE_CODIGO.test(codigo) ? codigo : null;
}

// Fecha YYYY-MM-DD + 6 meses. Si el día no existe (31 de agosto -> febrero), último día del mes.
function caducidad(emitido, meses = VALIDEZ_MESES) {
  const [y, m, d] = emitido.split('-').map(Number);
  const objetivo = new Date(Date.UTC(y, m - 1 + meses, 1));
  const ultimoDia = new Date(Date.UTC(objetivo.getUTCFullYear(), objetivo.getUTCMonth() + 1, 0)).getUTCDate();
  objetivo.setUTCDate(Math.min(d, ultimoDia));
  return objetivo.toISOString().slice(0, 10);
}

// Salidas que se pueden regalar: las de precio cerrado por grupo.
// Las fechas especiales van por persona y día fijo, no tienen sentido como bono.
function salidasRegalables() {
  return Object.entries(SERVICIOS)
    .filter(([, s]) => s.precio)
    .map(([id, s]) => ({ id, nombre: s.nombre, en: s.en, horas: s.horas, precio: s.precio }));
}

function buscarRegalable(id) {
  return salidasRegalables().find(s => s.id === id) || null;
}

const texto = (v, max) =>
  String(v || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

/**
 * Valida lo que manda la web al comprar un bono.
 * @returns {{error:string}|{datos:object}}
 */
function validarCompra(b = {}) {
  if (b.aceptaCondiciones !== true) return { error: 'Hay que aceptar las condiciones.' };
  const salida = buscarRegalable(String(b.servicio || ''));
  if (!salida) return { error: 'Elige la salida que quieres regalar.' };
  const para = texto(b.para, 60);
  if (!para) return { error: 'Falta el nombre de quien recibe el regalo.' };
  const de = texto(b.de, 60);
  if (!de) return { error: 'Falta tu nombre (de parte de quién es el regalo).' };
  return {
    datos: {
      salida,
      para,
      de,
      mensaje: texto(b.mensaje, 200),
      idioma: b.idioma === 'en' ? 'en' : 'es'
    }
  };
}

/**
 * Convierte una sesión de Checkout pagada (con payment_intent expandido o no)
 * en el bono que ve el cliente o el panel. null si no es un bono pagado.
 */
function bonoDesdeSesion(sesion, hoy) {
  const m = (sesion && sesion.metadata) || {};
  if (m.tipo !== 'bono' || sesion.payment_status !== 'paid') return null;
  const pi = typeof sesion.payment_intent === 'object' && sesion.payment_intent ? sesion.payment_intent : null;
  const mpi = (pi && pi.metadata) || {};
  const salida = buscarRegalable(m.servicio) || { id: m.servicio, nombre: m.servicio, en: m.servicio, precio: null };
  const cargo = pi && typeof pi.latest_charge === 'object' && pi.latest_charge ? pi.latest_charge : null;
  const reembolsado = cargo ? cargo.amount_refunded > 0 && cargo.amount_refunded >= cargo.amount : false;
  const canjeado = mpi.canjeado || null;
  const caduca = m.caduca;
  let estado = 'activo';
  if (reembolsado) estado = 'anulado';
  else if (canjeado) estado = 'canjeado';
  else if (hoy && caduca && caduca < hoy) estado = 'caducado';
  return {
    codigo: m.codigo,
    servicio: salida.id,
    salida: salida.nombre,
    salidaEn: salida.en,
    horas: salida.horas || null,
    para: m.para,
    de: m.de,
    mensaje: m.mensaje && m.mensaje !== '-' ? m.mensaje : '',
    emitido: m.emitido,
    caduca,
    importe: (sesion.amount_total || 0) / 100,
    idioma: m.idioma === 'en' ? 'en' : 'es',
    estado,
    canjeado,
    paymentIntent: pi ? pi.id : sesion.payment_intent || null
  };
}

module.exports = {
  VALIDEZ_MESES,
  RE_CODIGO,
  generarCodigo,
  normalizarCodigo,
  caducidad,
  salidasRegalables,
  buscarRegalable,
  validarCompra,
  bonoDesdeSesion
};
