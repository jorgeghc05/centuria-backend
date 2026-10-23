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
 * Configuración en .env (ver .env.example y README.md).
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Stripe = require('stripe');

const { SERVICIOS, EVENTOS, TURNOS, RE_HORA, buscarServicio, resolverHorario, precioTotal } = require('./lib/catalogo');
const { calcular, comprobarHueco, aplicarRetenciones, desdeGoogle, sumarDias } = require('./lib/disponibilidad');
const { crearCalendario, idsCalendarios, listarEventos } = require('./lib/google');

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
  versionCondiciones: env.VERSION_CONDICIONES || '2026-10',
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

const calendar = crearCalendario(env);
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

app.get('/salud', (_req, res) => res.json({ ok: true }));

app.get('/api/disponibilidad', async (req, res) => {
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
    console.error('Error leyendo Google Calendar:', err.message);
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

app.get('/api/resenas', async (req, res) => {
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

app.post('/api/validar-codigo', (req, res) => {
  const codigo = String(req.body.codigo || '').trim().toUpperCase();
  res.json({ valido: Boolean(codigo) && CFG.codigos.includes(codigo) });
});

app.post('/create-checkout-session', async (req, res) => {
  const b = req.body || {};
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
  const extras = Array.isArray(b.extras) ? b.extras.map(String).slice(0, 10) : [];
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
        idioma
      },
      success_url: `${CFG.frontend}/pago-exito.html?sesion={CHECKOUT_SESSION_ID}`,
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
app.post('/api/liberar', async (req, res) => {
  const sesion = String((req.body && req.body.sesion) || '');
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
    `Pago Stripe: ${session.payment_intent}`
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
        private: { centuria: 'reserva', turnos: h.turnos.join(','), horario: m.turno, servicio: m.servicio, sesion: session.id }
      }
    }
  });

  cache.clear();
  retenciones.delete(session.id);
  console.log(`Reserva apuntada: ${m.fecha} ${h.inicio}-${h.fin} ${m.nombre}${conflicto ? ' (CONFLICTO)' : ''}`);
}

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