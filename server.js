'use strict';

/*
 * Backend de reservas de Centuria Sea Adventure.
 *
 *   GET  /salud                     -> para despertar el servidor (Render free se duerme)
 *   GET  /api/disponibilidad        -> huecos libres leídos del Google Calendar del patrón
 *   POST /api/validar-codigo        -> comprueba un código de descuento
 *   POST /create-checkout-session   -> valida la reserva y crea el pago de la señal en Stripe
 *   POST /api/liberar               -> el cliente vuelve atrás desde Stripe: se suelta el hueco
 *   POST /api/webhook               -> Stripe avisa del pago; se apunta la reserva en el calendario
 *
 *   GET  /api/bono/salidas          -> salidas que se pueden regalar y su precio
 *   POST /api/bono/checkout         -> crea el pago de un bono regalo en Stripe
 *   GET  /api/bono?sesion=cs_…      -> datos del bono ya pagado (para enseñarlo e imprimirlo)
 *
 *   Página privada «Tu salida» (tu-salida.html?r=CODIGO), ver lib/mireserva.js:
 *   GET  /api/mi-reserva/:codigo            -> datos de la reserva y qué se puede cambiar
 *   PUT  /api/mi-reserva/:codigo/extras     -> cambiar los extras (hasta 48 h antes)
 *   GET  /api/mi-reserva/:codigo/opciones   -> horarios libres para mover la salida a otra fecha
 *   POST /api/mi-reserva/:codigo/cambiar    -> mover la salida (plazos de las condiciones)
 *
 *   GET|POST /api/recordatorios?clave=…     -> manda el email de recordatorio ~48 h antes (ver lib/recordatorio.js).
 *                                              Lo llama cada hora un cron externo (cron-job.org).
 *
 *   Panel (cabecera Authorization: Bearer <PANEL_CLAVE>):
 *   GET  /api/panel/resumen?mes=YYYY-MM -> reservas, ingresos y bonos
 *   GET  /api/panel/bono?codigo=CEN-…   -> comprobar un bono
 *   POST /api/panel/bono/canjear        -> marcar un bono como canjeado (o deshacerlo)
 *
 * Configuración en .env (ver .env.example y README.md).
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Stripe = require('stripe');

const { SERVICIOS, EVENTOS, TURNOS, RE_HORA, buscarServicio, opciones, resolverHorario, precioTotal } = require('./lib/catalogo');
const { calcular, comprobarHueco, aplicarRetenciones, desdeGoogle, sumarDias } = require('./lib/disponibilidad');
const { crearCalendario, credencialesCuentaServicio, idsCalendarios, listarEventos } = require('./lib/google');
const MiReserva = require('./lib/mireserva');
const Recordatorio = require('./lib/recordatorio');
const { cabecerasSeguridad, limitador } = require('./lib/seguridad');
const { v, validar } = require('./lib/validar');
const bonos = require('./lib/bonos');
const panel = require('./lib/panel');
const crypto = require('crypto');

const env = process.env;
const CFG = {
  puerto: Number(env.PORT) || 3000,
  frontend: (env.FRONTEND_URL || 'http://localhost:5500').replace(/\/$/, ''),
  senalPorPersona: Number(env.SENAL_POR_PERSONA) || 20,
  maxPersonas: Number(env.MAX_PERSONAS) || 8,
  antelacionDias: Number(env.ANTELACION_DIAS ?? 1),
  // true (por defecto): todos los días libres salvo lo que el patrón cierre.
  // false: todo cerrado salvo lo que el patrón marque como libre.
  abiertoPorDefecto: !/^(0|false|no)$/i.test(String(env.ABIERTO_POR_DEFECTO ?? 'true').trim()),
  calendarioDisponibilidad: idsCalendarios(env).disponibilidad,
  calendarioReservas: idsCalendarios(env).reservas,
  versionCondiciones: env.VERSION_CONDICIONES || '2026-11',
  panelClave: String(env.PANEL_CLAVE || '').trim(),
  // Recordatorios por email (Resend). Sin RESEND_API_KEY no se manda nada.
  resendKey: (env.RESEND_API_KEY || '').trim(),
  resendUrl: env.RESEND_API_URL || 'https://api.resend.com/emails',
  emailRemitente: env.EMAIL_REMITENTE || 'Centuria Sea Adventure <reservas@centuriaseaadventure.com>',
  emailResponderA: env.EMAIL_RESPONDER_A || 'info@centuriaseaadventure.com',
  claveRecordatorios: (env.CLAVE_RECORDATORIOS || '').trim(),
  telefono: env.TELEFONO_CONTACTO || '+34 687 549 223',
  codigos: (env.CODIGOS_DESCUENTO || '')
    .split(',')
    .map(c => c.trim().toUpperCase())
    .filter(Boolean),
  origenes: (env.ALLOWED_ORIGINS || 'https://centuria1710.netlify.app')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean)
};

const stripe = Stripe(env.STRIPE_SECRET_KEY);

// Si la clave de Google está mal, el servidor arranca igual (pagos, reseñas…)
// y el calendario responde con error, que se ve en los Logs de Render.
let calendar;
try {
  calendar = crearCalendario(env);
} catch (err) {
  console.error(`⚠ ${err.message}`);
  const sinCalendario = async () => {
    throw err;
  };
  calendar = { events: { list: sinCalendario, insert: sinCalendario, patch: sinCalendario }, calendars: { get: sinCalendario } };
}
const especiales = EVENTOS.map(e => buscarServicio(e.id));

// ---------------------------------------------------------------------------
// Disponibilidad con caché corta (1 min) para no gastar cuota de Google
// ---------------------------------------------------------------------------
const cache = new Map();
const CACHE_MS = 60 * 1000;

function hoyMadrid() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
}

async function obtenerDisponibilidad(desde, hasta, { sinCache = false } = {}) {
  const clave = `${desde}|${hasta}`;
  const enCache = cache.get(clave);
  if (!sinCache && enCache && Date.now() - enCache.t < CACHE_MS) return enCache.datos;

  const ids = [...new Set([CFG.calendarioDisponibilidad, CFG.calendarioReservas])];
  const listas = await Promise.all(ids.map(id => listarEventos(calendar, id, desde, hasta)));
  const datos = calcular({
    desde,
    hasta,
    eventos: listas.flat().map(desdeGoogle),
    especiales,
    primerDia: sumarDias(hoyMadrid(), CFG.antelacionDias),
    abiertoPorDefecto: CFG.abiertoPorDefecto
  });
  cache.set(clave, { t: Date.now(), datos });
  return datos;
}

// ---------------------------------------------------------------------------
// Retenciones: mientras alguien está en la pasarela de pago (máx. 30 min),
// su hueco sale como no disponible para los demás. Se guardan en memoria:
// si el servidor se reinicia se pierden, y entonces el aviso de CONFLICTO
// del calendario sigue cubriendo el caso raro de dos pagos a la vez.
// ---------------------------------------------------------------------------
const retenciones = new Map(); // id de sesión de Stripe -> { fecha, turnos, expira }
const RETENCION_MS = 31 * 60 * 1000;

function retencionesVigentes(excluirSesion) {
  const ahora = Date.now();
  const lista = [];
  for (const [id, r] of retenciones) {
    if (r.expira < ahora) retenciones.delete(id);
    else if (id !== excluirSesion) lista.push(r);
  }
  return lista;
}

async function disponibilidadConRetenciones(desde, hasta, opciones = {}) {
  const datos = await obtenerDisponibilidad(desde, hasta, opciones);
  return aplicarRetenciones(datos, retencionesVigentes(opciones.excluirSesion));
}

const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;
// Ley 11/2021: operaciones de 1.000 € o más no se pueden pagar en efectivo.
const LIMITE_EFECTIVO = 1000;

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
const app = express();
app.disable('x-powered-by');
// Render pone un proxy delante: así req.ip es la IP real del cliente (para los límites).
app.set('trust proxy', 1);
// Cabeceras de seguridad (lo que haría Helmet), en todas las respuestas.
app.use(cabecerasSeguridad({ produccion: env.NODE_ENV === 'production' }));

const origenPermitido = origin =>
  !origin ||
  CFG.origenes.includes(origin) ||
  /^https:\/\/[a-z0-9-]+--centuria1710\.netlify\.app$/.test(origin) ||
  (env.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin));

app.use(cors({ origin: (origin, cb) => cb(null, origenPermitido(origin)) }));

// El webhook necesita el cuerpo sin parsear para verificar la firma de Stripe,
// por eso se registra antes de express.json().
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Firma de webhook no válida:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.expired') retenciones.delete(event.data.object.id);

  // Los bonos regalo no ocupan ningún hueco: no se apuntan en el calendario.
  // El código y su estado viven en los metadatos del pago en Stripe.
  if (event.type === 'checkout.session.completed' && (event.data.object.metadata || {}).tipo === 'bono') {
    const m = event.data.object.metadata;
    console.log(`Bono regalo pagado: ${m.codigo} · ${m.servicio} · para ${m.para}`);
    sesionesCache.t = 0;
    return res.json({ received: true });
  }

  if (event.type === 'checkout.session.completed' && event.data.object.payment_status === 'paid') {
    try {
      await apuntarReserva(event.data.object);
    } catch (err) {
      // 500 -> Stripe reintenta más tarde. apuntarReserva es idempotente.
      console.error('No se pudo apuntar la reserva en el calendario:', err);
      return res.status(500).json({ error: 'calendar' });
    }
  }
  res.json({ received: true });
});

app.use(express.json({ limit: '20kb' }));

// ---------------------------------------------------------------------------
// Límites de peticiones por IP (lib/seguridad.js). El webhook de Stripe va antes
// y no tiene límite: llega firmado y Stripe reintenta si falla.
// ---------------------------------------------------------------------------
const MIN = 60 * 1000;
const LIMITES = {
  general: limitador({ nombre: 'general', ventanaMs: 15 * MIN, max: 600 }),
  lectura: limitador({ nombre: 'lectura', ventanaMs: MIN, max: 120 }),
  diagnostico: limitador({ nombre: 'diagnostico', ventanaMs: 15 * MIN, max: 20 }),
  // Probar códigos de descuento a ciegas: pocos intentos.
  codigo: limitador({ nombre: 'codigo', ventanaMs: 15 * MIN, max: 15, mensaje: 'Demasiados intentos con el código. Espera un rato o escríbenos por WhatsApp.' }),
  pago: limitador({ nombre: 'pago', ventanaMs: 15 * MIN, max: 12 }),
  liberar: limitador({ nombre: 'liberar', ventanaMs: 15 * MIN, max: 30 }),
  miReserva: limitador({ nombre: 'miReserva', ventanaMs: 10 * MIN, max: 120 }),
  miReservaCambios: limitador({ nombre: 'miReservaCambios', ventanaMs: 10 * MIN, max: 20 }),
  recordatorios: limitador({ nombre: 'recordatorios', ventanaMs: 60 * MIN, max: 30 }),
  bono: limitador({ nombre: 'bono', ventanaMs: 15 * MIN, max: 12 }),
  // El panel lo usa una sola persona (el patrón): deja margen de sobra, pero
  // el verdadero freno a probar claves a ciegas es exigirClavePanel (10 fallos).
  panel: limitador({ nombre: 'panel', ventanaMs: MIN, max: 60 })
};
app.use(LIMITES.general);

// ---------------------------------------------------------------------------
// Esquemas de lo que acepta cada endpoint (lib/validar.js). Lo que no encaja -> 400.
// Los mensajes son los que ve el cliente en la web.
// ---------------------------------------------------------------------------
const RE_ID = /^[a-z0-9-]{1,60}$/;
const ESQUEMAS = {
  disponibilidad: v.objeto({
    desde: v.fecha({ mensaje: 'Parámetros desde/hasta no válidos (YYYY-MM-DD).' }),
    hasta: v.fecha({ mensaje: 'Parámetros desde/hasta no válidos (YYYY-MM-DD).' })
  }),
  resenas: v.objeto({ idioma: v.opcional(v.enumerado(['es', 'en'])) }),
  codigo: v.objeto({ codigo: v.opcional(v.texto({ max: 40, mensaje: 'Código no válido.' })) }),
  checkout: v.objeto({
    aceptaCondiciones: v.verdadero({ mensaje: 'Hay que aceptar las condiciones de reserva.' }),
    servicio: v.texto({ min: 1, max: 60, patron: RE_ID, mensaje: 'Salida no válida.' }),
    fecha: v.fecha({ mensaje: 'Fecha no válida.' }),
    horario: v.opcional(v.texto({ max: 10, patron: /^[a-z0-9:]+$/, mensaje: 'Horario no válido para esta salida.' })),
    turno: v.opcional(v.texto({ max: 10, patron: /^[a-z0-9:]+$/, mensaje: 'Horario no válido para esta salida.' })),
    personas: v.entero({ min: 1, max: CFG.maxPersonas, mensaje: `El número de personas debe estar entre 1 y ${CFG.maxPersonas}.` }),
    nombre: v.texto({ min: 1, max: 80, mensaje: 'Falta el nombre (máximo 80 caracteres).' }),
    notas: v.opcional(v.texto({ max: 450, multilinea: true, mensaje: 'Las notas son demasiado largas (máximo 450 caracteres).' })),
    extras: v.opcional(v.lista(v.texto({ max: 120 }), { max: 20, mensaje: 'Extras no válidos.' })),
    extrasIds: v.opcional(v.lista(v.texto({ max: 30, patron: /^[a-z0-9-]{1,30}$/ }), { max: 20, mensaje: 'Extras no válidos.' })),
    codigo: v.opcional(v.texto({ max: 40, mensaje: 'Código no válido.' })),
    idioma: v.opcional(v.enumerado(['es', 'en']))
  }),
  liberar: v.objeto({ sesion: v.opcional(v.texto({ max: 220 })) }),
  extras: v.objeto({
    extras: v.lista(v.objeto({ id: v.texto({ min: 1, max: 30, patron: /^[a-z0-9-]{1,30}$/ }), nombre: v.texto({ min: 1, max: 90 }) }), {
      max: 20,
      mensaje: 'Lista de extras no válida.'
    })
  }),
  opciones: v.objeto({ fecha: v.fecha({ mensaje: 'Fecha no válida.' }) }),
  cambiar: v.objeto({
    fecha: v.fecha({ mensaje: 'Fecha no válida.' }),
    horario: v.texto({ min: 1, max: 10, patron: /^[a-z0-9:]+$/, mensaje: 'Horario no válido para esta salida.' })
  }),
  recordatorios: v.objeto({ clave: v.opcional(v.texto({ max: 200 })), prueba: v.opcional(v.enumerado(['1', '0'])) }),
  bonoCheckout: v.objeto({
    aceptaCondiciones: v.verdadero({ mensaje: 'Hay que aceptar las condiciones.' }),
    servicio: v.texto({ min: 1, max: 60, patron: RE_ID, mensaje: 'Elige la salida que quieres regalar.' }),
    para: v.texto({ min: 1, max: 60, mensaje: 'Falta el nombre de quien recibe el regalo.' }),
    de: v.texto({ min: 1, max: 60, mensaje: 'Falta tu nombre (de parte de quién es el regalo).' }),
    mensaje: v.opcional(v.texto({ max: 200, multilinea: true })),
    idioma: v.opcional(v.enumerado(['es', 'en']))
  }),
  bonoSesion: v.objeto({ sesion: v.texto({ min: 1, max: 220, mensaje: 'Enlace de bono no válido.' }) }),
  panelResumen: v.objeto({ mes: v.opcional(v.texto({ max: 7 })), recargar: v.opcional(v.enumerado(['1', '0'])) }),
  panelBono: v.objeto({ codigo: v.texto({ min: 1, max: 40, mensaje: 'Código no válido.' }) }),
  panelCanjear: v.objeto({
    codigo: v.texto({ min: 1, max: 40, mensaje: 'Código no válido.' }),
    // Boolean suelto, no "v.verdadero" (ese exige que sea exactamente true):
    // el panel manda siempre deshacer:true/false.
    deshacer: valor => valor === true,
    fechaSalida: v.opcional(v.fecha({ mensaje: 'Fecha no válida.' }))
  })
};

app.get('/salud', (_req, res) => res.json({ ok: true }));

// Diagnóstico de la conexión con Google: qué cuenta usa, qué calendarios
// busca y si los ve. No enseña claves.
app.get('/api/diagnostico', LIMITES.diagnostico, async (_req, res) => {
  const tapar = id => (id.length > 16 ? `${id.slice(0, 6)}…${id.slice(-28)}` : id);
  const salida = { cuenta: null, origenClave: null, calendarios: [] };
  try {
    const cred = credencialesCuentaServicio(env);
    salida.cuenta = cred ? cred.client_email : '(sin cuenta de servicio: se usa OAuth)';
    salida.origenClave = require('fs').existsSync('/etc/secrets/google-service-account.json')
      ? 'Secret File de Render'
      : env.GOOGLE_SERVICE_ACCOUNT_JSON
        ? 'variable GOOGLE_SERVICE_ACCOUNT_JSON'
        : 'ninguna';
  } catch (err) {
    salida.cuenta = `ERROR: ${err.message}`;
  }
  for (const [nombre, id] of [
    ['GOOGLE_CALENDAR_DISPONIBILIDAD', CFG.calendarioDisponibilidad],
    ['GOOGLE_CALENDAR_ID (reservas)', CFG.calendarioReservas]
  ]) {
    const info = { variable: nombre, id: tapar(id), largo: id.length, espaciosOComillas: /^\s|\s$|["']/.test(id) };
    try {
      const { data } = await calendar.calendars.get({ calendarId: id.trim() });
      info.resultado = `OK: «${data.summary}»`;
    } catch (err) {
      info.resultado = `ERROR: ${err.message}`;
    }
    salida.calendarios.push(info);
  }
  res.json(salida);
});

app.get('/api/disponibilidad', LIMITES.lectura, validar({ query: ESQUEMAS.disponibilidad }), async (req, res) => {
  const desde = String(req.query.desde || '');
  const hasta = String(req.query.hasta || '');
  if (!RE_FECHA.test(desde) || !RE_FECHA.test(hasta) || hasta < desde) {
    return res.status(400).json({ error: 'Parámetros desde/hasta no válidos (YYYY-MM-DD).' });
  }
  if (hasta > sumarDias(desde, 100)) {
    return res.status(400).json({ error: 'Rango demasiado largo (máx. 100 días).' });
  }
  try {
    const dias = await disponibilidadConRetenciones(desde, hasta);
    res.set('Cache-Control', 'public, max-age=30');
    res.json({ desde, hasta, dias });
  } catch (err) {
    console.error(`Error leyendo Google Calendar (${CFG.calendarioDisponibilidad} / ${CFG.calendarioReservas}):`, err.message, '-> abre /api/diagnostico');
    res.status(502).json({ error: 'No se pudo consultar el calendario.' });
  }
});

// ---------------------------------------------------------------------------
// Reseñas de Google (Places API). Sin clave configurada responde
// { configurado: false } y la web solo enseña los enlaces a Google Maps.
// Google devuelve como mucho 5 reseñas; se guardan 6 horas para no gastar cuota.
// ---------------------------------------------------------------------------
let cacheResenas = { t: 0, idioma: '', datos: null };
const RESENAS_MS = 6 * 60 * 60 * 1000;

app.get('/api/resenas', LIMITES.lectura, validar({ query: ESQUEMAS.resenas }), async (req, res) => {
  if (!env.GOOGLE_PLACES_API_KEY || !env.GOOGLE_PLACE_ID) return res.json({ configurado: false });
  const idioma = req.query.idioma === 'en' ? 'en' : 'es';
  if (cacheResenas.datos && cacheResenas.idioma === idioma && Date.now() - cacheResenas.t < RESENAS_MS) {
    return res.json(cacheResenas.datos);
  }
  try {
    const r = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(env.GOOGLE_PLACE_ID)}?languageCode=${idioma}`, {
      headers: {
        'X-Goog-Api-Key': env.GOOGLE_PLACES_API_KEY,
        'X-Goog-FieldMask': 'rating,userRatingCount,googleMapsUri,reviews'
      }
    });
    if (!r.ok) throw new Error(`Places HTTP ${r.status}`);
    const p = await r.json();
    const datos = {
      configurado: true,
      nota: p.rating || null,
      total: p.userRatingCount || 0,
      urlMaps: p.googleMapsUri || null,
      urlEscribir: `https://search.google.com/local/writereview?placeid=${encodeURIComponent(env.GOOGLE_PLACE_ID)}`,
      resenas: (p.reviews || []).map(rv => ({
        nota: rv.rating,
        texto: (rv.text && rv.text.text) || (rv.originalText && rv.originalText.text) || '',
        autor: (rv.authorAttribution && rv.authorAttribution.displayName) || 'Google',
        urlAutor: (rv.authorAttribution && rv.authorAttribution.uri) || null,
        foto: (rv.authorAttribution && rv.authorAttribution.photoUri) || null,
        cuando: rv.relativePublishTimeDescription || ''
      }))
    };
    cacheResenas = { t: Date.now(), idioma, datos };
    res.set('Cache-Control', 'public, max-age=3600');
    res.json(datos);
  } catch (err) {
    console.error('Reseñas de Google:', err.message);
    res.json({ configurado: false });
  }
});

app.post('/api/validar-codigo', LIMITES.codigo, validar({ body: ESQUEMAS.codigo }), (req, res) => {
  const codigo = String(req.datos.body.codigo || '').trim().toUpperCase();
  res.json({ valido: Boolean(codigo) && CFG.codigos.includes(codigo) });
});

app.post('/create-checkout-session', LIMITES.pago, validar({ body: ESQUEMAS.checkout }), async (req, res) => {
  const b = req.datos.body;
  const fallo = (msg, status = 400) => res.status(status).json({ error: msg });

  if (b.aceptaCondiciones !== true) return fallo('Hay que aceptar las condiciones de reserva.');

  const servicio = buscarServicio(String(b.servicio || ''));
  if (!servicio) return fallo('Salida no válida.');

  const fecha = String(b.fecha || '');
  // Franja ('manana'…), hora de salida ('09:30'), 'sol' o 'evento'. Ver catalogo.opciones().
  const eleccion = String(b.horario || b.turno || '');
  if (!RE_FECHA.test(fecha)) return fallo('Fecha no válida.');
  const horario = resolverHorario(servicio, fecha, eleccion);
  if (!horario) return fallo('Horario no válido para esta salida.');

  const personas = Number(b.personas);
  if (!Number.isInteger(personas) || personas < 1 || personas > CFG.maxPersonas) {
    return fallo(`El número de personas debe estar entre 1 y ${CFG.maxPersonas}.`);
  }

  const nombre = String(b.nombre || '').trim().slice(0, 80);
  if (!nombre) return fallo('Falta el nombre.');

  try {
    const disp = await disponibilidadConRetenciones(fecha, fecha, { sinCache: true });
    const motivo = comprobarHueco(disp, servicio, fecha, eleccion);
    if (motivo) return fallo(motivo, 409);
  } catch (err) {
    console.error('Error comprobando disponibilidad:', err.message);
    return fallo('No se pudo comprobar la disponibilidad. Inténtalo en un momento.', 502);
  }

  const codigo = String(b.codigo || '').trim().toUpperCase();
  const extras = Array.isArray(b.extras) ? b.extras.map(String).slice(0, 20) : [];
  const extrasIds = MiReserva.idsExtrasValidos(b.extrasIds);
  // Código del enlace privado «Tu salida». Viaja en los metadatos de Stripe hasta el calendario.
  const acceso = MiReserva.generarToken();
  const idioma = b.idioma === 'en' ? 'en' : 'es';
  const nombreServicio = idioma === 'en' ? servicio.en : servicio.nombre;
  const importe = personas * CFG.senalPorPersona;
  const total = precioTotal(servicio, personas);
  const franjaTexto = `${horario.inicio}–${horario.fin}`;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      locale: idioma,
      phone_number_collection: { enabled: true },
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'eur',
            unit_amount: importe * 100,
            product_data: {
              name: idioma === 'en' ? `Booking deposit · ${nombreServicio}` : `Señal de reserva · ${nombreServicio}`,
              description: total
                ? `${fecha} · ${franjaTexto} · ${personas} pax · Total ${total} € (IVA y gasolina incl.), resto ${total - importe} € ${total >= LIMITE_EFECTIVO ? 'por Bizum o transferencia' : 'en efectivo'} el día de la salida`
                : `${fecha} · ${franjaTexto} · ${personas} pax`
            }
          }
        }
      ],
      metadata: {
        servicio: servicio.id,
        fecha,
        turno: eleccion,
        inicio: horario.inicio,
        fin: horario.fin,
        turnos: horario.turnos.join(','),
        personas: String(personas),
        nombre,
        extras: extras.join(', ').slice(0, 400) || '-',
        codigo: CFG.codigos.includes(codigo) ? codigo : '-',
        notas: String(b.notas || '').slice(0, 450) || '-',
        condiciones_version: CFG.versionCondiciones,
        condiciones_aceptadas: new Date().toISOString(),
        idioma,
        acceso,
        extras_ids: extrasIds.join(',').slice(0, 450)
      },
      success_url: `${CFG.frontend}/pago-exito.html?sesion={CHECKOUT_SESSION_ID}&r=${acceso}`,
      cancel_url: `${CFG.frontend}/disponibilidad.html?servicio=${encodeURIComponent(servicio.id)}&cancelado=1`
    });
    retenciones.set(session.id, { fecha, turnos: horario.turnos, expira: Date.now() + RETENCION_MS });
    res.json({ url: session.url, sesion: session.id });
  } catch (err) {
    console.error('Error creando la sesión de Stripe:', err.message);
    fallo('No se pudo iniciar el pago.', 500);
  }
});

// El cliente ha vuelto atrás desde Stripe sin pagar: se cierra la sesión de
// pago y se suelta el hueco para que pueda elegir otro (o lo coja otro).
app.post('/api/liberar', LIMITES.liberar, validar({ body: ESQUEMAS.liberar }), async (req, res) => {
  const sesion = String(req.datos.body.sesion || '');
  if (!/^cs_[A-Za-z0-9_]{10,200}$/.test(sesion) || !retenciones.has(sesion)) return res.json({ ok: true });
  try {
    await stripe.checkout.sessions.expire(sesion);
  } catch (err) {
    // Si ya estaba pagada o caducada, Stripe no deja cerrarla: no se suelta nada.
    console.error('No se pudo cerrar la sesión de pago:', err.message);
    return res.json({ ok: false });
  }
  retenciones.delete(sesion);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Bono regalo comprado online
// ---------------------------------------------------------------------------
app.get('/api/bono/salidas', LIMITES.lectura, (_req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  res.json({ validezMeses: bonos.VALIDEZ_MESES, salidas: bonos.salidasRegalables() });
});

app.post('/api/bono/checkout', LIMITES.bono, validar({ body: ESQUEMAS.bonoCheckout }), async (req, res) => {
  const r = bonos.validarCompra(req.datos.body);
  if (r.error) return res.status(400).json({ error: r.error });
  const { salida, para, de, mensaje, idioma } = r.datos;
  const codigo = bonos.generarCodigo();
  const emitido = hoyMadrid();
  const caduca = bonos.caducidad(emitido);
  const nombre = idioma === 'en' ? salida.en : salida.nombre;
  const metadata = {
    tipo: 'bono',
    codigo,
    servicio: salida.id,
    para,
    de,
    mensaje: mensaje || '-',
    emitido,
    caduca,
    idioma,
    condiciones_version: CFG.versionCondiciones,
    condiciones_aceptadas: new Date().toISOString()
  };
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      locale: idioma,
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'eur',
            unit_amount: salida.precio * 100,
            product_data: {
              name: idioma === 'en' ? `Gift voucher · ${nombre}` : `Bono regalo · ${nombre}`,
              description:
                idioma === 'en'
                  ? `For ${para} · up to ${CFG.maxPersonas} people · open date, valid until ${caduca}`
                  : `Para ${para} · hasta ${CFG.maxPersonas} personas · fecha abierta, válido hasta el ${caduca}`
            }
          }
        }
      ],
      metadata,
      // El canje se apunta en el PaymentIntent, así que lleva los mismos datos.
      payment_intent_data: { metadata, description: `Bono regalo ${codigo} · ${salida.nombre} · para ${para}` },
      success_url: `${CFG.frontend}/regalo.html?sesion={CHECKOUT_SESSION_ID}`,
      cancel_url: `${CFG.frontend}/regalo.html?servicio=${encodeURIComponent(salida.id)}&cancelado=1`
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('Error creando el pago del bono:', err.message);
    res.status(500).json({ error: 'No se pudo iniciar el pago.' });
  }
});

// El id de sesión de Stripe es largo y aleatorio: quien lo tiene (el comprador,
// que vuelve con él desde Stripe) puede ver e imprimir su bono.
app.get('/api/bono', LIMITES.lectura, validar({ query: ESQUEMAS.bonoSesion }), async (req, res) => {
  const sesion = req.datos.query.sesion;
  if (!/^cs_[A-Za-z0-9_]{10,200}$/.test(sesion)) return res.status(400).json({ error: 'Enlace de bono no válido.' });
  try {
    const s = await stripe.checkout.sessions.retrieve(sesion, { expand: ['payment_intent.latest_charge'] });
    if ((s.metadata || {}).tipo !== 'bono') return res.status(404).json({ error: 'Bono no encontrado.' });
    if (s.payment_status !== 'paid') return res.status(402).json({ error: 'El pago del bono aún no se ha completado.', pendiente: true });
    const b = bonos.bonoDesdeSesion(s, hoyMadrid());
    res.set('Cache-Control', 'private, no-store');
    res.json({
      codigo: b.codigo,
      servicio: b.servicio,
      salida: b.salida,
      salidaEn: b.salidaEn,
      horas: b.horas,
      para: b.para,
      de: b.de,
      mensaje: b.mensaje,
      emitido: b.emitido,
      caduca: b.caduca,
      idioma: b.idioma,
      estado: b.estado,
      maxPersonas: CFG.maxPersonas
    });
  } catch (err) {
    if (err && err.statusCode === 404) return res.status(404).json({ error: 'Bono no encontrado.' });
    console.error('Error leyendo el bono:', err.message);
    res.status(502).json({ error: 'No se pudo cargar el bono. Inténtalo en un momento.' });
  }
});

// ---------------------------------------------------------------------------
// Página privada «Tu salida» (tu-salida.html?r=CODIGO)
// El código va en las propiedades privadas del evento de la reserva.
// ---------------------------------------------------------------------------
async function buscarReserva(codigo) {
  if (!MiReserva.RE_TOKEN.test(codigo)) return null;
  const { data } = await calendar.events.list({
    calendarId: CFG.calendarioReservas,
    privateExtendedProperty: [`acceso=${codigo}`],
    timeZone: 'Europe/Madrid',
    maxResults: 2
  });
  return (data.items || []).find(ev => ev.status !== 'cancelled') || null;
}

function plazosDe(ev) {
  const p = ev.extendedProperties.private;
  const servicio = buscarServicio(p.servicio);
  const h = MiReserva.horarioDeEvento(ev);
  return {
    servicio,
    h,
    plazos: MiReserva.plazosReserva({
      inicioMs: h.inicioMs,
      ahoraMs: Date.now(),
      esEvento: !servicio || servicio.tipo === 'evento',
      cambiosTardios: Number(p.cambiosTardios) || 0
    })
  };
}

// Disponibilidad de un día sin contar la propia reserva (para poder moverla dentro del mismo día).
async function disponibilidadSinReserva(fecha, idEvento) {
  const ids = [...new Set([CFG.calendarioDisponibilidad, CFG.calendarioReservas])];
  const listas = await Promise.all(ids.map(id => listarEventos(calendar, id, fecha, fecha)));
  const datos = calcular({
    desde: fecha,
    hasta: fecha,
    eventos: listas
      .flat()
      .filter(ev => ev.id !== idEvento)
      .map(desdeGoogle),
    especiales,
    primerDia: sumarDias(hoyMadrid(), CFG.antelacionDias),
    abiertoPorDefecto: CFG.abiertoPorDefecto
  });
  return aplicarRetenciones(datos, retencionesVigentes());
}

// Atiende una petición de la página: busca la reserva y maneja los errores comunes.
function conReserva(manejador) {
  return async (req, res) => {
    const codigo = String(req.params.codigo || '');
    let ev;
    try {
      ev = await buscarReserva(codigo);
    } catch (err) {
      console.error('Error buscando la reserva:', err.message);
      return res.status(502).json({ error: 'No se pudo consultar la reserva. Inténtalo en un momento.' });
    }
    if (!ev || !ev.extendedProperties || !ev.extendedProperties.private) {
      return res.status(404).json({ error: 'No encontramos esta reserva. Puede que el enlace esté incompleto o que la reserva se haya cancelado.' });
    }
    try {
      await manejador(req, res, ev);
    } catch (err) {
      console.error('Error en la página de la reserva:', err.message);
      res.status(502).json({ error: 'No se pudo guardar el cambio. Inténtalo en un momento o escríbenos por WhatsApp.' });
    }
  };
}

app.get(
  '/api/mi-reserva/:codigo',
  LIMITES.miReserva,
  conReserva(async (_req, res, ev) => {
    const p = ev.extendedProperties.private;
    const { servicio, h, plazos } = plazosDe(ev);
    const personas = Number(p.personas) || null;
    const precio = servicio && personas ? precioTotal(servicio, personas) : null;
    const senal = Number(p.senal) || (personas ? personas * CFG.senalPorPersona : 0);
    res.set('Cache-Control', 'no-store');
    res.json({
      servicio: p.servicio,
      tipo: servicio ? servicio.tipo : null,
      fecha: h.fecha,
      inicio: h.inicio,
      fin: h.fin,
      inicioISO: new Date(h.inicioMs).toISOString(),
      personas,
      nombre: MiReserva.primerNombre(p.nombre),
      idioma: p.idioma === 'en' ? 'en' : 'es',
      extras: (p.extras || '').split(',').filter(Boolean),
      precio,
      senal,
      resto: precio ? Math.max(0, precio - senal) : null,
      pagoResto: precio && precio >= LIMITE_EFECTIVO ? 'bizum' : 'efectivo',
      cambiada: String(ev.summary || '').startsWith('✎ '),
      ...plazos,
      primerDia: sumarDias(hoyMadrid(), CFG.antelacionDias)
    });
  })
);

app.put(
  '/api/mi-reserva/:codigo/extras',
  LIMITES.miReservaCambios,
  validar({ body: ESQUEMAS.extras }),
  conReserva(async (req, res, ev) => {
    const { plazos } = plazosDe(ev);
    if (!plazos.extrasEditables) return res.status(409).json({ error: 'Los extras se pueden cambiar hasta 48 horas antes de la salida. Para algo de última hora, escríbenos por WhatsApp.' });
    const extras = MiReserva.limpiarExtras(req.datos.body.extras);
    if (!extras) return res.status(400).json({ error: 'Lista de extras no válida.' });

    const p = ev.extendedProperties.private;
    const texto = extras.map(x => x.nombre).join(', ') || '-';
    let descripcion = MiReserva.reemplazarLinea(ev.description, 'Extras: ', texto);
    descripcion = MiReserva.anotarCambio(descripcion, `extras → ${texto}`);
    await calendar.events.patch({
      calendarId: CFG.calendarioReservas,
      eventId: ev.id,
      requestBody: {
        summary: MiReserva.marcarTitulo(ev.summary),
        description: descripcion,
        extendedProperties: { private: { ...p, extras: extras.map(x => x.id).join(',').slice(0, 450) } }
      }
    });
    res.json({ ok: true, extras: extras.map(x => x.id) });
  })
);

app.get(
  '/api/mi-reserva/:codigo/opciones',
  LIMITES.miReserva,
  validar({ query: ESQUEMAS.opciones }),
  conReserva(async (req, res, ev) => {
    const fecha = req.datos.query.fecha;
    const { servicio, plazos } = plazosDe(ev);
    if (plazos.cambio === 'no' || !servicio) return res.json({ fecha, opciones: [] });
    const primerDia = sumarDias(hoyMadrid(), CFG.antelacionDias);
    if (fecha < primerDia || fecha > sumarDias(hoyMadrid(), 365)) return res.json({ fecha, opciones: [] });

    const disp = await disponibilidadSinReserva(fecha, ev.id);
    const actual = MiReserva.horarioDeEvento(ev);
    const lista = opciones(servicio, fecha)
      .filter(o => !comprobarHueco(disp, servicio, fecha, o.valor))
      .filter(o => !(fecha === actual.fecha && o.inicio === actual.inicio))
      .map(({ valor, inicio, fin }) => ({ valor, inicio, fin }));
    res.set('Cache-Control', 'no-store');
    res.json({ fecha, opciones: lista });
  })
);

app.post(
  '/api/mi-reserva/:codigo/cambiar',
  LIMITES.miReservaCambios,
  validar({ body: ESQUEMAS.cambiar }),
  conReserva(async (req, res, ev) => {
    const b = req.datos.body;
    const fecha = String(b.fecha || '');
    const valor = String(b.horario || '');
    const { servicio, h: antes, plazos } = plazosDe(ev);
    if (plazos.cambio === 'no' || !servicio) {
      return res.status(409).json({ error: 'Esta reserva ya no se puede cambiar desde la página. Escríbenos por WhatsApp y lo vemos.' });
    }
    if (!RE_FECHA.test(fecha)) return res.status(400).json({ error: 'Fecha no válida.' });
    if (fecha < sumarDias(hoyMadrid(), CFG.antelacionDias) || fecha > sumarDias(hoyMadrid(), 365)) {
      return res.status(400).json({ error: 'Esa fecha no se puede elegir.' });
    }
    const nuevo = resolverHorario(servicio, fecha, valor);
    if (!nuevo) return res.status(400).json({ error: 'Horario no válido para esta salida.' });

    const disp = await disponibilidadSinReserva(fecha, ev.id);
    const motivo = comprobarHueco(disp, servicio, fecha, valor);
    if (motivo) return res.status(409).json({ error: motivo });

    const p = ev.extendedProperties.private;
    const cambiosTardios = (Number(p.cambiosTardios) || 0) + (plazos.cambio === 'una' ? 1 : 0);
    const horarioTexto = `${nuevo.inicio}-${nuevo.fin} (${nuevo.turnos.map(t => TURNOS[t].nombre.toLowerCase()).join(', ')})`;
    let descripcion = MiReserva.reemplazarLinea(ev.description, 'Horario: ', horarioTexto);
    descripcion = MiReserva.anotarCambio(descripcion, `salida movida del ${antes.fecha} ${antes.inicio || ''} al ${fecha} ${nuevo.inicio}`);

    await calendar.events.patch({
      calendarId: CFG.calendarioReservas,
      eventId: ev.id,
      requestBody: {
        summary: MiReserva.marcarTitulo(ev.summary),
        description: descripcion,
        start: { dateTime: `${fecha}T${nuevo.inicio}:00`, timeZone: 'Europe/Madrid' },
        end: { dateTime: `${nuevo.fin < nuevo.inicio ? sumarDias(fecha, 1) : fecha}T${nuevo.fin}:00`, timeZone: 'Europe/Madrid' },
        colorId: '6',
        extendedProperties: {
          private: { ...p, turnos: nuevo.turnos.join(','), horario: valor, cambiosTardios: String(cambiosTardios) }
        }
      }
    });
    cache.clear();
    console.log(`Reserva movida por el cliente: ${antes.fecha} ${antes.inicio} -> ${fecha} ${nuevo.inicio}`);
    res.json({ ok: true, fecha, inicio: nuevo.inicio, fin: nuevo.fin });
  })
);

// ---------------------------------------------------------------------------
// Recordatorio por email ~48 h antes de la salida (lib/recordatorio.js)
// Render gratis se duerme, así que no puede programarlo él solo: un cron externo
// (cron-job.org) llama cada hora a /api/recordatorios?clave=CLAVE_RECORDATORIOS.
// Con &prueba=1 dice a quién mandaría, sin mandar nada.
// ---------------------------------------------------------------------------
let recordatoriosEnMarcha = false;

function claveCorrecta(recibida) {
  const a = Buffer.from(String(recibida || ''));
  const b = Buffer.from(CFG.claveRecordatorios);
  return b.length > 0 && a.length === b.length && require('crypto').timingSafeEqual(a, b);
}

async function parteDelMar(fecha, inicio, fin) {
  const comun = `&timezone=Europe%2FMadrid&start_date=${fecha}&end_date=${fecha}`;
  const leer = url =>
    fetch(url, { signal: AbortSignal.timeout(8000) })
      .then(r => (r.ok ? r.json() : null))
      .catch(() => null);
  const [tiempo, mar] = await Promise.all([
    leer(`https://api.open-meteo.com/v1/forecast?latitude=36.7165&longitude=-4.3505&hourly=wind_speed_10m,wind_direction_10m${comun}`),
    leer(`https://marine-api.open-meteo.com/v1/marine?latitude=36.7&longitude=-4.35&hourly=wave_height,sea_surface_temperature${comun}`)
  ]);
  return Recordatorio.resumirParte(tiempo, mar, inicio, fin);
}

async function mandarEmail({ para, asunto, html, texto, idempotencia }) {
  const res = await fetch(CFG.resendUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CFG.resendKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencia.slice(0, 256)
    },
    body: JSON.stringify({ from: CFG.emailRemitente, to: [para], reply_to: CFG.emailResponderA, subject: asunto, html, text: texto }),
    signal: AbortSignal.timeout(15000)
  });
  if (!res.ok) {
    const detalle = await res.text().catch(() => '');
    throw new Error(`Resend ${res.status}: ${detalle.slice(0, 200)}`);
  }
}

const taparEmail = email => email.replace(/^(.{2})[^@]*/, '$1…');

async function procesarRecordatorios({ prueba }) {
  const hoy = hoyMadrid();
  const ahora = Date.now();
  const eventos = await listarEventos(calendar, CFG.calendarioReservas, hoy, sumarDias(hoy, 3));
  const resultado = { enviados: [], pendientes: [], errores: [] };
  const partes = new Map();

  for (const ev of eventos) {
    const p = ev.extendedProperties && ev.extendedProperties.private;
    if (ev.status === 'cancelled' || !p || p.centuria !== 'reserva') continue;
    const h = MiReserva.horarioDeEvento(ev);
    if (!Recordatorio.debeEnviar({ inicioMs: h.inicioMs, creadoMs: Date.parse(ev.created), ahoraMs: ahora, enviadoPara: p.recordatorio })) continue;
    const email = Recordatorio.emailDeEvento(ev);
    if (!email) {
      resultado.errores.push({ fecha: h.fecha, inicio: h.inicio, motivo: 'sin email' });
      continue;
    }

    const servicio = buscarServicio(p.servicio);
    const idioma = p.idioma === 'en' ? 'en' : 'es';
    const personas = Number(p.personas) || null;
    const precio = servicio && personas ? precioTotal(servicio, personas) : null;
    const senal = Number(p.senal) || (personas ? personas * CFG.senalPorPersona : 0);
    const clave = `${h.fecha}|${h.inicio}|${h.fin}`;
    if (!partes.has(clave)) partes.set(clave, prueba ? null : await parteDelMar(h.fecha, h.inicio, h.fin));

    // Reservas de antes de la página «Tu salida»: se les crea su código ahora.
    let acceso = p.acceso;
    if (!MiReserva.RE_TOKEN.test(acceso || '') && !prueba) {
      acceso = MiReserva.generarToken();
      await calendar.events.patch({
        calendarId: CFG.calendarioReservas,
        eventId: ev.id,
        requestBody: {
          description: `${ev.description || ''}\n\nPágina del cliente (puedes reenviársela): ${CFG.frontend}/tu-salida.html?r=${acceso}`,
          extendedProperties: { private: { ...p, acceso } }
        }
      });
      p.acceso = acceso;
    }

    const mensaje = Recordatorio.componerEmail({
      idioma,
      nombre: MiReserva.primerNombre(p.nombre || (/^Cliente: (.+)$/m.exec(ev.description || '') || [])[1]),
      salida: servicio ? (idioma === 'en' ? servicio.en : servicio.nombre) : p.servicio,
      fecha: h.fecha,
      inicio: h.inicio || '08:30',
      fin: h.fin,
      personas,
      resto: precio ? Math.max(0, precio - senal) : null,
      bizum: Boolean(precio && precio >= LIMITE_EFECTIVO),
      url: `${CFG.frontend}/tu-salida.html?r=${acceso || ''}`,
      telefono: CFG.telefono,
      hoy,
      parte: partes.get(clave)
    });
    const info = { fecha: h.fecha, inicio: h.inicio, para: taparEmail(email), asunto: mensaje.asunto };
    if (prueba) {
      resultado.pendientes.push(info);
      continue;
    }

    const enviadoPara = new Date(h.inicioMs).toISOString();
    try {
      await mandarEmail({ para: email, ...mensaje, idempotencia: `recordatorio-${ev.id}-${enviadoPara}` });
      await calendar.events.patch({
        calendarId: CFG.calendarioReservas,
        eventId: ev.id,
        requestBody: { extendedProperties: { private: { ...p, recordatorio: enviadoPara } } }
      });
      resultado.enviados.push(info);
      console.log(`Recordatorio enviado: ${h.fecha} ${h.inicio} -> ${info.para}`);
    } catch (err) {
      console.error(`No se pudo mandar el recordatorio (${h.fecha} ${h.inicio}):`, err.message);
      resultado.errores.push({ ...info, motivo: err.message });
    }
  }
  return resultado;
}

app.all('/api/recordatorios', LIMITES.recordatorios, validar({ query: ESQUEMAS.recordatorios }), async (req, res) => {
  if (!CFG.claveRecordatorios) return res.status(503).json({ configurado: false, error: 'Falta CLAVE_RECORDATORIOS en el servidor.' });
  if (!claveCorrecta(req.query.clave || req.get('x-clave'))) return res.status(403).json({ error: 'Clave incorrecta.' });
  const prueba = req.query.prueba === '1' || !CFG.resendKey;
  if (recordatoriosEnMarcha) return res.json({ ok: true, enMarcha: true });
  recordatoriosEnMarcha = true;
  try {
    const r = await procesarRecordatorios({ prueba });
    res.json({ ok: true, modo: prueba ? (CFG.resendKey ? 'prueba' : 'prueba (falta RESEND_API_KEY)') : 'envio', ...r });
  } catch (err) {
    console.error('Error con los recordatorios:', err.message);
    res.status(502).json({ error: 'No se pudo leer el calendario.' });
  } finally {
    recordatoriosEnMarcha = false;
  }
});

// ---------------------------------------------------------------------------
// Panel del patrón: protegido con PANEL_CLAVE
// ---------------------------------------------------------------------------
const intentosPanel = new Map(); // ip -> { fallos, desde }
const VENTANA_INTENTOS_MS = 15 * 60 * 1000;

function exigirClavePanel(req, res, next) {
  if (!CFG.panelClave) return res.status(503).json({ error: 'El panel no está activado: falta PANEL_CLAVE en el servidor.' });
  const ip = req.ip || 'desconocida';
  const reg = intentosPanel.get(ip);
  if (reg && Date.now() - reg.desde > VENTANA_INTENTOS_MS) intentosPanel.delete(ip);
  const actual = intentosPanel.get(ip);
  if (actual && actual.fallos >= 10) return res.status(429).json({ error: 'Demasiados intentos. Espera un rato.' });

  const dada = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const a = crypto.createHash('sha256').update(dada).digest();
  const b = crypto.createHash('sha256').update(CFG.panelClave).digest();
  if (!dada || !crypto.timingSafeEqual(a, b)) {
    const r = intentosPanel.get(ip) || { fallos: 0, desde: Date.now() };
    r.fallos++;
    intentosPanel.set(ip, r);
    return res.status(401).json({ error: 'Clave incorrecta.' });
  }
  intentosPanel.delete(ip);
  res.set('Cache-Control', 'private, no-store');
  next();
}

// Pagos completados de los últimos 2 años, con caché de 2 minutos.
const sesionesCache = { t: 0, datos: null };
const SESIONES_MS = 2 * 60 * 1000;

async function sesionesPagadas({ sinCache = false } = {}) {
  if (!sinCache && sesionesCache.datos && Date.now() - sesionesCache.t < SESIONES_MS) return sesionesCache.datos;
  const desde = Math.floor(Date.now() / 1000) - 730 * 86400;
  const datos = await stripe.checkout.sessions
    .list({ status: 'complete', created: { gte: desde }, limit: 100, expand: ['data.payment_intent.latest_charge'] })
    .autoPagingToArray({ limit: 10000 });
  // Solo lo que ha creado esta web (reservas y bonos).
  const propias = datos.filter(s => s.metadata && (s.metadata.tipo === 'bono' || s.metadata.servicio));
  sesionesCache.t = Date.now();
  sesionesCache.datos = propias;
  return propias;
}

app.get('/api/panel/resumen', LIMITES.panel, exigirClavePanel, validar({ query: ESQUEMAS.panelResumen }), async (req, res) => {
  const hoy = hoyMadrid();
  const mes = String(req.datos.query.mes || hoy.slice(0, 7));
  if (!panel.RE_MES.test(mes)) return res.status(400).json({ error: 'Mes no válido (YYYY-MM).' });
  try {
    const sesiones = await sesionesPagadas({ sinCache: req.datos.query.recargar === '1' });
    res.json({ ...panel.resumen(sesiones, mes, hoy), modoPrueba: String(env.STRIPE_SECRET_KEY || '').startsWith('sk_test') });
  } catch (err) {
    console.error('Panel: error leyendo Stripe:', err.message);
    res.status(502).json({ error: 'No se pudieron leer los pagos de Stripe.' });
  }
});

async function buscarBono(codigoTexto) {
  const codigo = bonos.normalizarCodigo(codigoTexto);
  if (!codigo) return { error: 'Código no válido. Tiene esta forma: CEN-XXXX-XXXX.', status: 400 };
  const sesiones = await sesionesPagadas({ sinCache: true });
  const s = sesiones.find(x => x.metadata.tipo === 'bono' && x.metadata.codigo === codigo);
  if (!s) return { error: `No hay ningún bono pagado con el código ${codigo}.`, status: 404 };
  return { sesion: s, bono: bonos.bonoDesdeSesion(s, hoyMadrid()) };
}

app.get('/api/panel/bono', LIMITES.panel, exigirClavePanel, validar({ query: ESQUEMAS.panelBono }), async (req, res) => {
  try {
    const r = await buscarBono(req.datos.query.codigo);
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json(r.bono);
  } catch (err) {
    console.error('Panel: error buscando bono:', err.message);
    res.status(502).json({ error: 'No se pudo consultar Stripe.' });
  }
});

app.post('/api/panel/bono/canjear', LIMITES.panel, exigirClavePanel, validar({ body: ESQUEMAS.panelCanjear }), async (req, res) => {
  const b = req.datos.body;
  const deshacer = b.deshacer === true;
  try {
    const r = await buscarBono(b.codigo);
    if (r.error) return res.status(r.status).json({ error: r.error });
    if (!r.bono.paymentIntent) return res.status(500).json({ error: 'El bono no tiene pago asociado.' });
    if (!deshacer && r.bono.estado === 'anulado') return res.status(409).json({ error: 'Este bono se devolvió: no se puede canjear.' });
    if (!deshacer && r.bono.estado === 'canjeado') return res.status(409).json({ error: `Este bono ya se canjeó el ${r.bono.canjeado.slice(0, 10)}.` });
    const notaFecha = String(b.fechaSalida || '').trim();
    // En Stripe, poner un metadato a '' lo borra.
    await stripe.paymentIntents.update(r.bono.paymentIntent, {
      metadata: deshacer
        ? { canjeado: '', canje_salida: '' }
        : { canjeado: new Date().toISOString(), canje_salida: /^\d{4}-\d{2}-\d{2}$/.test(notaFecha) ? notaFecha : '' }
    });
    sesionesCache.t = 0;
    const tras = await buscarBono(r.bono.codigo);
    res.json(tras.bono || { ok: true });
  } catch (err) {
    console.error('Panel: error canjeando bono:', err.message);
    res.status(502).json({ error: 'No se pudo actualizar el bono en Stripe.' });
  }
});

// ---------------------------------------------------------------------------
// Apuntar la reserva pagada en Google Calendar
// ---------------------------------------------------------------------------
async function apuntarReserva(session) {
  const m = session.metadata || {};
  const calendarId = CFG.calendarioReservas;

  // Stripe puede mandar el mismo aviso más de una vez: si ya existe, no se duplica.
  const { data: existentes } = await calendar.events.list({
    calendarId,
    privateExtendedProperty: [`sesion=${session.id}`],
    maxResults: 1
  });
  if (existentes.items && existentes.items.length) return;

  const servicio = buscarServicio(m.servicio) || { nombre: m.servicio };
  // El horario que se cobró va en los metadatos; si faltara, se recalcula.
  const h =
    m.inicio && RE_HORA.test(m.inicio) && RE_HORA.test(m.fin || '')
      ? { inicio: m.inicio, fin: m.fin, turnos: (m.turnos || '').split(',').filter(t => TURNOS[t]) }
      : resolverHorario(servicio, m.fecha, m.turno) || { inicio: TURNOS.manana.inicio, fin: TURNOS.tarde.fin, turnos: Object.keys(TURNOS) };

  // Si a pesar de la retención alguien cogió el mismo hueco (p. ej. el patrón lo
  // cerró o el servidor se reinició), se apunta igual pero marcado, para que el
  // patrón devuelva la señal o recoloque.
  let conflicto = false;
  try {
    const disp = await disponibilidadConRetenciones(m.fecha, m.fecha, { sinCache: true, excluirSesion: session.id });
    const dia = disp[m.fecha];
    conflicto = !dia || h.turnos.some(t => dia[t] !== 'libre' || (dia.eventos && dia.eventos[t] && dia.eventos[t] !== m.servicio));
  } catch {
    /* si Google falla aquí, lo intentamos apuntar igualmente */
  }

  const cliente = session.customer_details || {};
  const total = ((session.amount_total || 0) / 100).toFixed(2);
  const precio = precioTotal(servicio, Number(m.personas));
  const acceso = MiReserva.RE_TOKEN.test(m.acceso || '') ? m.acceso : MiReserva.generarToken();

  const descripcion = [
    `Cliente: ${m.nombre}`,
    `Teléfono: ${cliente.phone || '-'}`,
    `Email: ${cliente.email || '-'}`,
    `Personas: ${m.personas}`,
    `Salida: ${servicio.nombre}`,
    `Horario: ${h.inicio}-${h.fin} (${h.turnos.map(t => TURNOS[t].nombre.toLowerCase()).join(', ')})`,
    `Extras: ${m.extras}`,
    `Código descuento: ${m.codigo}`,
    `Notas: ${m.notas}`,
    '',
    `Precio: ${precio ? `${precio} € (IVA y gasolina incluidos)${servicio.precioPersona ? `, ${servicio.precioPersona} €/persona` : ''}` : 'a consultar'}`,
    `Señal pagada online: ${total} €`,
    precio && precio >= LIMITE_EFECTIVO
      ? `Resto: ${(precio - Number(total)).toFixed(2)} € por BIZUM o TRANSFERENCIA (1.000 € o más: no se puede cobrar en efectivo)`
      : `Resto a cobrar EN EFECTIVO: ${precio ? `${(precio - Number(total)).toFixed(2)} €` : 'según lo acordado'}`,
    '',
    `Condiciones aceptadas: v${m.condiciones_version} el ${m.condiciones_aceptadas}`,
    `Pago Stripe: ${session.payment_intent}`,
    '',
    `Página del cliente (puedes reenviársela): ${CFG.frontend}/tu-salida.html?r=${acceso}`
  ].join('\n');

  await calendar.events.insert({
    calendarId,
    requestBody: {
      summary: `${conflicto ? 'CONFLICTO · ' : ''}Reserva ${servicio.nombre} · ${m.nombre} (${m.personas})`,
      description: descripcion,
      start: { dateTime: `${m.fecha}T${h.inicio}:00`, timeZone: 'Europe/Madrid' },
      // Si termina después de medianoche (fuegos de la Feria), el fin es al día siguiente.
      end: { dateTime: `${h.fin < h.inicio ? sumarDias(m.fecha, 1) : m.fecha}T${h.fin}:00`, timeZone: 'Europe/Madrid' },
      colorId: conflicto ? '11' : '5',
      extendedProperties: {
        private: {
          centuria: 'reserva',
          turnos: h.turnos.join(','),
          horario: m.turno,
          servicio: m.servicio,
          sesion: session.id,
          // Para la página «Tu salida»
          acceso,
          nombre: String(m.nombre || '').slice(0, 80),
          personas: String(m.personas || ''),
          extras: (m.extras_ids || '').slice(0, 450),
          senal: total,
          idioma: m.idioma === 'en' ? 'en' : 'es',
          cambiosTardios: '0',
          // Para el recordatorio por email (lib/recordatorio.js)
          email: String(cliente.email || '').slice(0, 200)
        }
      }
    }
  });

  cache.clear();
  retenciones.delete(session.id);
  console.log(`Reserva apuntada: ${m.fecha} ${h.inicio}-${h.fin} ${m.nombre}${conflicto ? ' (CONFLICTO)' : ''}`);
}

// JSON mal formado o demasiado grande: respuesta clara en vez de la página de error de Express.
app.use((err, _req, res, next) => {
  if (res.headersSent) return next(err);
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Petición no válida (JSON mal formado).' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Petición demasiado grande.' });
  console.error('Error no controlado:', err);
  res.status(500).json({ error: 'Error interno. Inténtalo en un momento.' });
});

// Cualquier otra ruta: 404 en JSON.
app.use((_req, res) => res.status(404).json({ error: 'No existe.' }));

if (require.main === module) {
  // Express 5 no lanza el error si el puerto está ocupado: llega aquí.
  app.listen(CFG.puerto, err => {
    if (err) {
      console.error(
        err.code === 'EADDRINUSE'
          ? `El puerto ${CFG.puerto} ya está en uso: seguramente tienes el servidor abierto en otra ventana. Ciérrala (Ctrl+C) o usa esa.`
          : `No se pudo arrancar el servidor: ${err.message}`
      );
      process.exit(1);
    }
    console.log(`Reservas Centuria escuchando en :${CFG.puerto}`);
  });
}

module.exports = { app, SERVICIOS };
