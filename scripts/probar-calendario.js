'use strict';

/*
 * Prueba la conexión con Google Calendar sin tocar Stripe ni la web.
 *
 *   npm run probar-calendario              -> próximos 21 días
 *   npm run probar-calendario -- 45        -> próximos 45 días
 *   npm run probar-calendario -- --escribir   también crea y borra un evento de prueba
 *                                              en el calendario de reservas
 *
 * Enseña, para cada evento del calendario, cómo lo entiende la web, y al final
 * la tabla de franjas libres tal y como la verá un cliente.
 */

require('dotenv').config();
const { crearCalendario, credencialesCuentaServicio, idsCalendarios, listarEventos } = require('../lib/google');
const { calcular, interpretar, desdeGoogle, sumarDias } = require('../lib/disponibilidad');
const { EVENTOS, ORDEN_TURNOS, TURNOS, buscarServicio } = require('../lib/catalogo');

const args = process.argv.slice(2);
const escribir = args.includes('--escribir');
const dias = Math.min(Number(args.find(a => /^\d+$/.test(a))) || 21, 100);

const verde = t => `\x1b[32m${t}\x1b[0m`;
const rojo = t => `\x1b[31m${t}\x1b[0m`;
const gris = t => `\x1b[90m${t}\x1b[0m`;
const amarillo = t => `\x1b[33m${t}\x1b[0m`;
const negrita = t => `\x1b[1m${t}\x1b[0m`;

function fallo(msg, ayuda) {
  console.error(`\n${rojo('✗')} ${msg}`);
  if (ayuda) console.error(`  ${ayuda.split('\n').join('\n  ')}`);
  process.exit(1);
}

function explicarErrorGoogle(err, calendarId, cuenta) {
  const code = err.code || (err.response && err.response.status);
  if (code === 404) {
    return fallo(
      `No encuentro el calendario «${calendarId}».`,
      cuenta
        ? `Lo más normal: no está compartido con la cuenta de servicio.\nEn Google Calendar (desde ordenador) > ese calendario > Configuración y uso compartido >\n«Compartir con determinadas personas» > añade ${negrita(cuenta)}\ncon el permiso «Hacer cambios en eventos». Si ya lo hiciste, revisa que el ID esté bien copiado.`
        : 'Revisa que el ID del calendario esté bien copiado.'
    );
  }
  if (code === 403) {
    return fallo(
      `Google no deja leer «${calendarId}» (403).`,
      '¿Está activada la «Google Calendar API» en el proyecto de Google Cloud?\nConsola de Google Cloud > APIs y servicios > Biblioteca > Google Calendar API > Habilitar.'
    );
  }
  if (code === 400 || /invalid_grant/.test(String(err.message))) {
    return fallo('Las credenciales de Google no son válidas o han caducado.', 'Vuelve a descargar el JSON de la cuenta de servicio y pégalo en GOOGLE_SERVICE_ACCOUNT_JSON.');
  }
  return fallo(`Error de Google: ${err.message}`);
}

async function main() {
  console.log(negrita('\nPrueba del calendario de Centuria\n'));

  // 1. Credenciales
  let cuenta = null;
  try {
    const cred = credencialesCuentaServicio();
    if (cred) {
      cuenta = cred.client_email;
      console.log(`${verde('✓')} Cuenta de servicio: ${cuenta}`);
    } else if (process.env.GOOGLE_REFRESH_TOKEN) {
      console.log(`${amarillo('!')} Usando OAuth con refresh token (caduca a los 7 días si la app está en modo «Testing»).`);
    } else {
      fallo('No hay credenciales de Google en el .env.', 'Rellena GOOGLE_SERVICE_ACCOUNT_JSON (ver README, «Conectar Google Calendar»).');
    }
  } catch {
    fallo('GOOGLE_SERVICE_ACCOUNT_JSON no es un JSON válido.', 'Pega el contenido entero del archivo .json descargado (en una línea) o su versión en base64.');
  }

  const calendar = crearCalendario();
  const ids = idsCalendarios();
  if (ids.disponibilidad === 'primary' && cuenta) {
    fallo(
      'Falta el ID del calendario.',
      'Con cuenta de servicio, «primary» es el calendario vacío de la propia cuenta, no el tuyo.\nPon GOOGLE_CALENDAR_DISPONIBILIDAD y GOOGLE_CALENDAR_ID en el .env.'
    );
  }

  // 2. Acceso a cada calendario
  for (const [papel, id] of Object.entries({ disponibilidad: ids.disponibilidad, reservas: ids.reservas })) {
    try {
      const { data } = await calendar.calendars.get({ calendarId: id });
      console.log(`${verde('✓')} Calendario de ${papel}: «${data.summary}» (${data.timeZone})`);
      if (data.timeZone !== 'Europe/Madrid') console.log(`  ${amarillo('!')} Su zona horaria no es Europe/Madrid. La web interpreta las horas en hora de Madrid igualmente.`);
    } catch (err) {
      explicarErrorGoogle(err, id, cuenta);
    }
  }
  if (ids.disponibilidad === ids.reservas) console.log(gris('  (se usa el mismo calendario para marcar y para las reservas)'));

  // 3. Eventos y cómo se interpretan
  const desde = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
  const hasta = sumarDias(desde, dias - 1);
  let crudos = [];
  try {
    const listas = await Promise.all([...new Set([ids.disponibilidad, ids.reservas])].map(id => listarEventos(calendar, id, desde, hasta)));
    const empieza = g => (g.start && (g.start.dateTime || g.start.date)) || '';
    crudos = listas.flat().sort((a, b) => empieza(a).localeCompare(empieza(b)));
  } catch (err) {
    explicarErrorGoogle(err, ids.disponibilidad, cuenta);
  }

  console.log(negrita(`\nEventos del ${desde} al ${hasta} (${crudos.length})\n`));
  const eventos = [];
  for (const g of crudos) {
    const ev = desdeGoogle(g);
    if (!ev) continue;
    eventos.push(ev);
    const cuando = ev.todoElDia ? `${ev.inicio} (todo el día)` : `${ev.inicio.replace('T', ' ')}–${ev.fin.slice(11)}`;
    const r = interpretar(ev);
    let efecto;
    if (!r) efecto = gris('se ignora (no es una marca)');
    else {
      const porFecha = {};
      for (const m of r.marcas) (porFecha[m.fecha] ||= []).push(TURNOS[m.turno].nombre.toLowerCase());
      const detalle = Object.entries(porFecha)
        .map(([f, t]) => (Object.keys(porFecha).length > 1 ? `${f.slice(5)}: ${t.join('+')}` : t.join(' + ')))
        .join(', ');
      efecto = r.accion === 'abre' ? verde(`abre ${detalle}`) : r.accion === 'cierra' ? rojo(`cierra ${detalle}`) : amarillo(`reserva: ocupa ${detalle}`);
      if (!r.marcas.length) efecto += gris(' (no toca ninguna franja)');
    }
    console.log(`  ${cuando.padEnd(32)} ${`«${ev.titulo}»`.padEnd(28)} → ${efecto}`);
  }

  // 4. Lo que verá el cliente
  const abiertoPorDefecto = !/^(0|false|no)$/i.test(String(process.env.ABIERTO_POR_DEFECTO ?? 'true').trim());
  const disp = calcular({ desde, hasta, eventos, especiales: EVENTOS.map(e => buscarServicio(e.id)), abiertoPorDefecto });
  const antelacion = Number(process.env.ANTELACION_DIAS ?? 1);
  console.log(negrita('\nLo que verá la web\n'));
  console.log(
    gris(
      abiertoPorDefecto
        ? '  Modo: todo libre salvo lo que cierres («Cerrado», «Cerrado tarde»…). Cambia con ABIERTO_POR_DEFECTO=false.\n'
        : '  Modo: todo cerrado salvo lo que abras («Libre», «Mañana»…). Cambia con ABIERTO_POR_DEFECTO=true.\n'
    )
  );
  console.log(`  ${'Día'.padEnd(17)} ${ORDEN_TURNOS.map(t => `${TURNOS[t].nombre} ${TURNOS[t].inicio}–${TURNOS[t].fin}`.padEnd(24)).join('')}`);
  const fmt = new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  let alguno = false;
  for (let f = desde; f <= hasta; f = sumarDias(f, 1)) {
    const d = disp[f];
    if (!d) continue;
    alguno = true;
    const celdas = ORDEN_TURNOS.map(t => {
      const estado = d[t];
      const ev = d.eventos && d.eventos[t];
      const txt = estado === 'libre' ? (ev ? `★ ${ev}` : '● libre') : estado === 'ocupado' ? '■ reservado' : '· cerrado';
      const pintar = estado === 'libre' ? verde : estado === 'ocupado' ? amarillo : gris;
      return pintar(txt.slice(0, 23).padEnd(24));
    });
    const pronto = f < sumarDias(desde, antelacion) ? gris(' (no reservable aún: ANTELACION_DIAS)') : '';
    console.log(`  ${fmt.format(new Date(f + 'T00:00:00Z')).padEnd(17)} ${celdas.join('')}${pronto}`);
  }
  if (!alguno) {
    console.log(amarillo('  No hay ninguna franja abierta en estas fechas.'));
    console.log('  Crea un evento de todo el día llamado «Libre» en el calendario y vuelve a probar.');
  }

  // 5. Permiso de escritura (opcional)
  if (escribir) {
    console.log(negrita('\nPrueba de escritura en el calendario de reservas\n'));
    const manana = sumarDias(desde, 1);
    try {
      const { data } = await calendar.events.insert({
        calendarId: ids.reservas,
        requestBody: {
          summary: 'Prueba web Centuria (se borra sola)',
          start: { dateTime: `${manana}T08:00:00`, timeZone: 'Europe/Madrid' },
          end: { dateTime: `${manana}T08:15:00`, timeZone: 'Europe/Madrid' }
        }
      });
      await calendar.events.delete({ calendarId: ids.reservas, eventId: data.id });
      console.log(`${verde('✓')} Se puede escribir: las reservas pagadas aparecerán en el calendario.`);
    } catch (err) {
      const code = err.code || (err.response && err.response.status);
      if (code === 403) {
        fallo(
          'Se puede leer pero no escribir en el calendario de reservas.',
          `Cambia el permiso de ${cuenta || 'la cuenta'} a «Hacer cambios en eventos» en la configuración de uso compartido.`
        );
      }
      explicarErrorGoogle(err, ids.reservas, cuenta);
    }
  } else {
    console.log(gris('\nPara comprobar también que se pueden apuntar reservas: npm run probar-calendario -- --escribir'));
  }
  console.log('');
}

main();
