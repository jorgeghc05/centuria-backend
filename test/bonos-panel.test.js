'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const bonos = require('../lib/bonos');
const { resumen, sumarMeses } = require('../lib/panel');

// Sesión de Checkout como la devuelve Stripe con payment_intent.latest_charge expandido.
let n = 0;
function sesion({ creado, importe, metadata, reembolsado = 0, piMeta = {} }) {
  n++;
  return {
    id: `cs_test_${n}`,
    created: Math.floor(Date.parse(`${creado}T12:00:00+02:00`) / 1000),
    amount_total: importe * 100,
    payment_status: 'paid',
    customer_details: { name: 'Cliente', email: 'c@e.es', phone: '+34600000000' },
    metadata,
    payment_intent: { id: `pi_${n}`, metadata: piMeta, latest_charge: { amount: importe * 100, amount_refunded: reembolsado * 100 } }
  };
}
const reserva = (creado, fecha, servicio, personas, extra = {}) =>
  sesion({ creado, importe: personas * 20, metadata: { servicio, fecha, inicio: '17:00', fin: '20:00', personas: String(personas), nombre: 'Ana', codigo: '-', extras: '-', notas: '-' }, ...extra });
const bono = (creado, servicio, importe, extra = {}) =>
  sesion({ creado, importe, metadata: { tipo: 'bono', codigo: bonos.generarCodigo(), servicio, para: 'Luis', de: 'Ana', mensaje: '-', emitido: creado, caduca: bonos.caducidad(creado) }, ...extra });

test('el código del bono se puede dictar y se reconoce escrito de cualquier manera', () => {
  for (let i = 0; i < 200; i++) {
    const c = bonos.generarCodigo();
    assert.match(c, bonos.RE_CODIGO);
    assert.doesNotMatch(c.slice(4), /[01OIL]/);
    assert.equal(bonos.normalizarCodigo(c.toLowerCase().replace(/-/g, ' ')), c);
  }
  assert.equal(bonos.normalizarCodigo('ABCD2345'), 'CEN-ABCD-2345');
  assert.equal(bonos.normalizarCodigo('CEN-ABCD-234'), null);
  assert.equal(bonos.normalizarCodigo('CEN-AB0D-2345'), null);
});

test('el bono caduca a los 6 meses y aguanta fin de mes y cambio de año', () => {
  assert.equal(bonos.caducidad('2026-10-24'), '2027-04-24');
  assert.equal(bonos.caducidad('2026-08-31'), '2027-02-28');
  assert.equal(bonos.caducidad('2027-08-31'), '2028-02-29');
});

test('solo se regalan salidas con precio de grupo, no las fechas especiales', () => {
  const ids = bonos.salidasRegalables().map(s => s.id);
  assert.ok(ids.includes('atardecer') && ids.includes('dia'));
  assert.ok(!ids.some(id => id.endsWith('-2027')));
});

test('validación de la compra del bono', () => {
  assert.ok(bonos.validarCompra({ servicio: 'atardecer', para: 'Luis', de: 'Ana' }).error);
  assert.ok(bonos.validarCompra({ aceptaCondiciones: true, servicio: 'legion-2027', para: 'L', de: 'A' }).error);
  assert.ok(bonos.validarCompra({ aceptaCondiciones: true, servicio: 'atardecer', para: '  ', de: 'A' }).error);
  const ok = bonos.validarCompra({ aceptaCondiciones: true, servicio: 'atardecer', para: ' Luis\n y Ana ', de: 'Pepe', mensaje: 'x'.repeat(500) });
  assert.equal(ok.datos.para, 'Luis y Ana');
  assert.equal(ok.datos.mensaje.length, 200);
  assert.equal(ok.datos.salida.precio, 350);
});

test('estado del bono: activo, canjeado, caducado, anulado', () => {
  const hoy = '2027-01-10';
  assert.equal(bonos.bonoDesdeSesion(bono('2026-12-01', 'paseo', 350), hoy).estado, 'activo');
  assert.equal(bonos.bonoDesdeSesion(bono('2026-12-01', 'paseo', 350, { piMeta: { canjeado: '2027-01-05T10:00:00Z' } }), hoy).estado, 'canjeado');
  assert.equal(bonos.bonoDesdeSesion(bono('2026-05-01', 'paseo', 350), hoy).estado, 'caducado');
  assert.equal(bonos.bonoDesdeSesion(bono('2026-12-01', 'paseo', 350, { reembolsado: 350 }), hoy).estado, 'anulado');
  assert.equal(bonos.bonoDesdeSesion(reserva('2026-12-01', '2027-01-20', 'paseo', 4), hoy), null);
});

test('resumen del mes: salidas por fecha, cobros por fecha de pago, cancelaciones fuera', () => {
  const sesiones = [
    reserva('2027-05-20', '2027-06-05', 'paseo', 6), // salida en junio, pagada en mayo
    reserva('2027-06-01', '2027-06-12', 'pesca', 4),
    reserva('2027-06-02', '2027-06-15', 'celebracion', 8, { reembolsado: 160 }), // cancelada
    reserva('2027-06-10', '2027-07-03', 'dia', 5), // pagada en junio, salida en julio
    reserva('2027-06-11', '2027-03-25', 'legion-2027', 3), // otro mes
    bono('2027-06-14', 'atardecer', 350),
    bono('2027-05-01', 'dia', 600, { piMeta: { canjeado: '2027-06-01T09:00:00Z' } })
  ];
  const r = resumen(sesiones, '2027-06', '2027-06-08');
  assert.equal(r.kpis.salidas, 2);
  assert.equal(r.kpis.personas, 10);
  assert.equal(r.kpis.facturacion, 350 + 399);
  assert.equal(r.kpis.senales, 120 + 80);
  assert.equal(r.kpis.restoEfectivo, 749 - 200);
  // cobrado en junio: señales de reservas pagadas en junio (80 + 0 neto cancelada + 100 + 60) + bono 350
  assert.equal(r.kpis.cobradoOnline, 80 + 100 + 60 + 350);
  assert.equal(r.kpis.reservasHechas, 4);
  assert.equal(r.kpis.canceladas, 1);
  assert.equal(r.kpis.bonosVendidos, 1);
  assert.equal(r.kpis.bonosPendientes, 1);
  assert.deepEqual(r.salidas.map(s => s.fecha), ['2027-06-05', '2027-06-12']);
  assert.deepEqual(r.proximas.map(s => s.fecha), ['2027-06-12']);
  assert.equal(r.serie.length, 12);
  assert.equal(r.serie.at(-1).mes, '2027-06');
  assert.equal(r.serie.at(-2).bonos, 600);
  assert.equal(r.bonos.length, 2);
  assert.equal(r.bonos[0].estado, 'activo');
  assert.equal(r.bonos[1].estado, 'canjeado');
});

test('sumarMeses cruza el año', () => {
  assert.equal(sumarMeses('2027-01', -1), '2026-12');
  assert.equal(sumarMeses('2026-12', 1), '2027-01');
  assert.equal(sumarMeses('2027-06', -11), '2026-07');
});
