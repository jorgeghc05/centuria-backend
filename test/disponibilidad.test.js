'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { calcular, comprobarHueco, aplicarRetenciones, interpretar, desdeGoogle } = require('../lib/disponibilidad');
const { buscarServicio, opciones, puestaDeSol, EVENTOS } = require('../lib/catalogo');

const todoElDia = (titulo, inicio, finExclusivo) => ({ titulo, todoElDia: true, inicio, fin: finExclusivo, reserva: null });
const conHora = (titulo, inicio, fin) => ({ titulo, todoElDia: false, inicio, fin, reserva: null });
const reserva = (inicio, fin) => ({ titulo: 'Reserva', todoElDia: false, inicio, fin, reserva: { turnos: null, turno: null } });
const especiales = EVENTOS.map(e => buscarServicio(e.id));
const JUNIO = { desde: '2027-06-01', hasta: '2027-06-30' };
const LIBRE = { manana: 'libre', mediodia: 'libre', tarde: 'libre' };

test('"Libre" abre las tres franjas y "Cerrado tarde" cierra solo la tarde', () => {
  const r = calcular({ ...JUNIO, eventos: [todoElDia('Libre', '2027-06-05', '2027-06-06'), todoElDia('Cerrado tarde', '2027-06-05', '2027-06-06')] });
  assert.deepEqual(r['2027-06-05'], { manana: 'libre', mediodia: 'libre', tarde: 'cerrado' });
});

test('acentos, mayúsculas y "medio día" separado dan igual', () => {
  const r = calcular({
    ...JUNIO,
    eventos: [todoElDia('MAÑANA', '2027-06-07', '2027-06-08'), todoElDia('Medio día', '2027-06-08', '2027-06-09'), todoElDia('Mañana y tarde', '2027-06-09', '2027-06-10')]
  });
  assert.deepEqual(r['2027-06-07'], { manana: 'libre', mediodia: 'cerrado', tarde: 'cerrado' });
  assert.deepEqual(r['2027-06-08'], { manana: 'cerrado', mediodia: 'libre', tarde: 'cerrado' });
  assert.deepEqual(r['2027-06-09'], { manana: 'libre', mediodia: 'cerrado', tarde: 'libre' });
});

test('"Mediodía" no se confunde con "día"', () => {
  const r = interpretar(todoElDia('Mediodía', '2027-06-08', '2027-06-09'));
  assert.deepEqual(r.marcas.map(m => m.turno), ['mediodia']);
});

test('evento de varios días abre todo el rango (fin exclusivo)', () => {
  const r = calcular({ ...JUNIO, eventos: [todoElDia('Libre', '2027-06-10', '2027-06-13')] });
  assert.ok(r['2027-06-10'] && r['2027-06-12']);
  assert.equal(r['2027-06-13'], undefined);
});

test('con hora: abre las franjas que cubre al menos a la mitad', () => {
  const r = calcular({
    ...JUNIO,
    eventos: [
      conHora('Libre', '2027-06-20T09:00', '2027-06-20T14:00'), // mañana entera, mediodía 1,5 h de 4
      conHora('Disponible', '2027-06-21T08:30', '2027-06-21T21:00'),
      conHora('Libre', '2027-06-22T14:00', '2027-06-22T21:00') // mediodía 2,5 h de 4 y tarde
    ]
  });
  assert.deepEqual(r['2027-06-20'], { manana: 'libre', mediodia: 'cerrado', tarde: 'cerrado' });
  assert.deepEqual(r['2027-06-21'], LIBRE);
  assert.deepEqual(r['2027-06-22'], { manana: 'cerrado', mediodia: 'libre', tarde: 'libre' });
});

test('con hora: "Ocupado" cierra todas las franjas que toca, aunque sea un rato', () => {
  const r = calcular({
    ...JUNIO,
    eventos: [todoElDia('Libre', '2027-06-20', '2027-06-21'), conHora('Ocupado', '2027-06-20T12:00', '2027-06-20T13:00')]
  });
  assert.deepEqual(r['2027-06-20'], { manana: 'cerrado', mediodia: 'cerrado', tarde: 'libre' });
});

test('títulos que no son marcas se ignoran', () => {
  const r = calcular({ ...JUNIO, eventos: [todoElDia('Dentista', '2027-06-05', '2027-06-06'), conHora('Cumple de Juan', '2027-06-05T18:00', '2027-06-05T20:00')] });
  assert.deepEqual(r, {});
});

test('una reserva pagada ocupa las franjas de su hora real', () => {
  const r = calcular({
    ...JUNIO,
    eventos: [
      todoElDia('Libre', '2027-06-01', '2027-06-04'),
      reserva('2027-06-01T08:30', '2027-06-01T11:30'), // paseo de mañana
      reserva('2027-06-02T09:00', '2027-06-02T17:00'), // 8 h: mañana y mediodía
      reserva('2027-06-03T10:00', '2027-06-03T18:00') // 8 h: las tres
    ]
  });
  assert.deepEqual(r['2027-06-01'], { manana: 'ocupado', mediodia: 'libre', tarde: 'libre' });
  assert.deepEqual(r['2027-06-02'], { manana: 'ocupado', mediodia: 'ocupado', tarde: 'libre' });
  assert.deepEqual(r['2027-06-03'], { manana: 'ocupado', mediodia: 'ocupado', tarde: 'ocupado' });
});

test('reservas antiguas (turno "dia") ocupan el día entero', () => {
  const r = calcular({
    ...JUNIO,
    eventos: [todoElDia('Libre', '2027-06-01', '2027-06-02'), { titulo: 'x', todoElDia: true, inicio: '2027-06-01', fin: '2027-06-02', reserva: { turnos: null, turno: 'dia' } }]
  });
  assert.deepEqual(r['2027-06-01'], { manana: 'ocupado', mediodia: 'ocupado', tarde: 'ocupado' });
});

test('las fechas especiales se abren solas y solo valen para su evento', () => {
  const r = calcular({ desde: '2027-07-10', hasta: '2027-08-03', eventos: [], especiales });
  assert.deepEqual(r['2027-08-02'], { manana: 'libre', mediodia: 'cerrado', tarde: 'cerrado', eventos: { manana: 'eclipse-2027' } });
  assert.equal(comprobarHueco(r, buscarServicio('eclipse-2027'), '2027-08-02', 'evento'), null);
  assert.ok(comprobarHueco(r, buscarServicio('paseo'), '2027-08-02', 'manana'));
  // La de los submarinistas (10:00–13:00) ocupa mañana y mediodía
  assert.deepEqual(r['2027-07-11'].eventos, { manana: 'virgen-submarinistas-2027', mediodia: 'virgen-submarinistas-2027' });
});

test('"Cerrado" el día de un evento manda sobre el evento', () => {
  const r = calcular({ desde: '2027-08-01', hasta: '2027-08-03', eventos: [todoElDia('Cerrado', '2027-08-02', '2027-08-03')], especiales });
  assert.equal(r['2027-08-02'], undefined);
});

test('primerDia oculta lo anterior', () => {
  const r = calcular({ ...JUNIO, eventos: [todoElDia('Libre', '2027-06-01', '2027-06-05')], primerDia: '2027-06-03' });
  assert.deepEqual(Object.keys(r), ['2027-06-03', '2027-06-04']);
});

test('salidas de 6 y 8 horas: horas de inicio y franjas que ocupan', () => {
  const dia = opciones(buscarServicio('dia'), '2027-06-01');
  assert.equal(dia[0].valor, '08:30');
  assert.equal(dia.at(-1).valor, '13:00'); // la última vuelve a las 21:00
  assert.deepEqual(dia.find(o => o.valor === '09:00').turnos, ['manana', 'mediodia']);
  assert.deepEqual(dia.find(o => o.valor === '10:00').turnos, ['manana', 'mediodia', 'tarde']);
  const seis = opciones(buscarServicio('celebracion-6h'), '2027-06-01');
  assert.equal(seis.at(-1).valor, '15:00');
  assert.deepEqual(seis.find(o => o.valor === '12:30').turnos, ['mediodia', 'tarde']);
});

test('comprobarHueco con hora de inicio libre', () => {
  const r = { '2027-06-01': { manana: 'libre', mediodia: 'libre', tarde: 'ocupado' } };
  const dia = buscarServicio('dia');
  assert.equal(comprobarHueco(r, dia, '2027-06-01', '09:00'), null); // 9–17 no toca la tarde
  assert.ok(comprobarHueco(r, dia, '2027-06-01', '10:00')); // 10–18 sí
  assert.ok(comprobarHueco(r, dia, '2027-06-01', '09:15')); // no es una hora ofrecida
  assert.equal(comprobarHueco(r, buscarServicio('paseo'), '2027-06-01', 'mediodia'), null);
  assert.ok(comprobarHueco(r, buscarServicio('delfines'), '2027-06-01', 'tarde'));
});

test('puesta de sol en Málaga y hora de la salida de atardecer', () => {
  const aMin = h => Number(h.slice(0, 2)) * 60 + Number(h.slice(3));
  // Valores de referencia (AEMET / timeanddate) con margen de 3 minutos
  assert.ok(Math.abs(aMin(puestaDeSol('2027-06-21')) - aMin('21:40')) <= 3);
  assert.ok(Math.abs(aMin(puestaDeSol('2027-12-21')) - aMin('18:04')) <= 3);
  const verano = opciones(buscarServicio('atardecer'), '2027-06-21')[0];
  assert.deepEqual(verano.turnos, ['tarde']);
  // En invierno el sol se pone pronto y la salida empieza en la franja de mediodía
  const invierno = opciones(buscarServicio('atardecer'), '2027-12-21')[0];
  assert.deepEqual(invierno.turnos, ['mediodia', 'tarde']);
});

test('retenciones: el hueco de un pago en curso sale como retenido', () => {
  const disp = { '2027-06-01': { ...LIBRE } };
  const r = aplicarRetenciones(disp, [{ fecha: '2027-06-01', turnos: ['manana', 'mediodia'] }]);
  assert.deepEqual(r['2027-06-01'], { manana: 'retenido', mediodia: 'retenido', tarde: 'libre' });
  assert.deepEqual(disp['2027-06-01'], LIBRE); // no modifica el original (está en caché)
  assert.match(comprobarHueco(r, buscarServicio('paseo'), '2027-06-01', 'manana'), /terminando de pagar/);
  assert.equal(comprobarHueco(r, buscarServicio('paseo'), '2027-06-01', 'tarde'), null);
});

test('desdeGoogle lee eventos de todo el día, con hora y reservas', () => {
  assert.deepEqual(desdeGoogle({ summary: 'Libre', start: { date: '2027-06-01' }, end: { date: '2027-06-02' } }), {
    titulo: 'Libre',
    todoElDia: true,
    inicio: '2027-06-01',
    fin: '2027-06-02',
    reserva: null
  });
  const r = desdeGoogle({
    summary: 'Reserva',
    start: { dateTime: '2027-06-01T10:00:00+02:00' },
    end: { dateTime: '2027-06-01T14:00:00+02:00' },
    extendedProperties: { private: { centuria: 'reserva', turnos: 'manana,mediodia' } }
  });
  assert.equal(r.inicio, '2027-06-01T10:00');
  assert.deepEqual(r.reserva.turnos, ['manana', 'mediodia']);
  assert.equal(desdeGoogle({ status: 'cancelled', start: { date: '2027-06-01' } }), null);
});
