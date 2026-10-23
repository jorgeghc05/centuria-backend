/**
 * BACKEND DE CENTURIA SEA ADVENTURE (Node.js + Express)
 * ------------------------------------------------------
 * Este servidor ligero gestiona los pagos de fianza con Stripe y 
 * la automatización de reservas en Google Calendar.
 * 
 * ==========================================
 * INSTRUCCIONES DE DESPLIEGUE (Render, Heroku, etc.)
 * ==========================================
 * 1. Inicializa el proyecto en tu carpeta: `npm init -y`
 * 2. Instala dependencias: `npm install express stripe googleapis cors dotenv`
 * 3. Crea un archivo `.env` en la raíz con estas variables:
 *    PORT=3000
 *    FRONTEND_URL=https://tu-dominio.com
 *    STRIPE_SECRET_KEY=sk_test_... (Tu clave privada de Stripe)
 *    STRIPE_WEBHOOK_SECRET=whsec_... (El secreto del Webhook de Stripe)
 *    GOOGLE_CLIENT_ID=... (De Google Cloud Console)
 *    GOOGLE_CLIENT_SECRET=...
 *    GOOGLE_REFRESH_TOKEN=...
 *    GOOGLE_CALENDAR_ID=primary (O el ID de un calendario específico)
 * 4. Sube este código a GitHub y conéctalo a un servicio gratuito/barato como Render.com.
 * 5. Configura las variables de entorno (.env) en el panel de Render.
 * 6. En el panel de Stripe, añade la URL de tu webhook: https://tu-backend.onrender.com/api/webhook
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { google } = require('googleapis');

const app = express();

// Configuración de CORS para permitir peticiones desde tu web
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));

// IMPORTANTE: Para el webhook de Stripe necesitamos el "raw body", para el resto JSON.
app.use((req, res, next) => {
  if (req.originalUrl === '/api/webhook') {
    next();
  } else {
    express.json()(req, res, next);
  }
});

// Configuración de la API de Google Calendar usando OAuth2
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'https://developers.google.com/oauthplayground' // URI genérica si usas Refresh Token fijo
);
oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

const FIANZA_POR_PERSONA = 20; // 20€ de fianza

// ==========================================
// 1. ENDPOINT: Crear sesión de pago (Fianza)
// ==========================================
app.post('/api/crear-checkout', async (req, res) => {
  try {
    const { cliente, fecha, turno, actividad, personas, extras, codigo_promo, total_actividad, resto_efectivo } = req.body;
    
    const cantidadPersonas = parseInt(personas) || 1;
    const fianzaTotal = cantidadPersonas * FIANZA_POR_PERSONA;

    // Crear la sesión en Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: {
            name: `Fianza de Reserva: ${actividad}`,
            description: `Turno: ${turno} | Para ${cantidadPersonas} personas. Resto a abonar en el barco: ${resto_efectivo}€`,
          },
          unit_amount: fianzaTotal * 100, // Stripe funciona en céntimos
        },
        quantity: 1,
      }],
      // Guardamos todos los datos en metadata para recuperarlos en el webhook
      metadata: {
        cliente, 
        fecha, 
        turno, 
        actividad, 
        personas: cantidadPersonas.toString(), 
        extras: Array.isArray(extras) ? extras.join(' + ') : (extras || 'Ninguno'), 
        codigo_promo: codigo_promo || 'Ninguno', 
        total_actividad: total_actividad.toString(), 
        resto_efectivo: resto_efectivo.toString()
      },
      success_url: `${process.env.FRONTEND_URL}/pago-exito.html`,
      cancel_url: `${process.env.FRONTEND_URL}/disponibilidad.html`,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("Error al crear sesión de Stripe:", error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 2. ENDPOINT: Webhook de Stripe -> Google Calendar
// ==========================================
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Error de firma de webhook:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Si el pago se ha completado correctamente...
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const metadata = session.metadata;

    // Asignar horarios aproximados en base al turno seleccionado (configurable)
    let horaInicio = '10:00:00';
    let horaFin = '14:00:00';
    if (metadata.turno.includes('Tarde')) {
      horaInicio = '15:00:00';
      horaFin = '19:00:00';
    } else if (metadata.turno.includes('Atardecer') || metadata.turno.includes('Sol')) {
      horaInicio = '19:30:00';
      horaFin = '22:30:00';
    }

    // Configurar el evento para Google Calendar
    const calendarEvent = {
      summary: `🚤 RESERVA CONFIRMADA: ${metadata.actividad} - ${metadata.cliente}`,
      description: `
        👤 Cliente: ${metadata.cliente}
        👥 Personas: ${metadata.personas}
        ⚓ Actividad: ${metadata.actividad}
        🕒 Turno: ${metadata.turno}
        
        🍔 Extras contratados: ${metadata.extras}
        🎟️ Código Descuento / Hotel: ${metadata.codigo_promo}
        
        💰 Total Actividad: ${metadata.total_actividad}€
        ✅ Fianza Pagada Online: Sí
        💵 PENDIENTE EN EFECTIVO (Día de salida): ${metadata.resto_efectivo}€
      `,
      start: {
        dateTime: `${metadata.fecha}T${horaInicio}`,
        timeZone: 'Europe/Madrid',
      },
      end: {
        dateTime: `${metadata.fecha}T${horaFin}`,
        timeZone: 'Europe/Madrid',
      },
      colorId: '5', // 5 es color amarillo/naranja en GCalendar
    };

    try {
      await calendar.events.insert({
        calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
        resource: calendarEvent,
      });
      console.log('✅ Evento añadido a Google Calendar con éxito para:', metadata.cliente);
    } catch (error) {
      console.error('❌ Error al insertar en Google Calendar:', error);
    }
  }

  // Hay que devolver siempre un 200 a Stripe para que sepa que hemos recibido el aviso
  res.json({ received: true });
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor de reservas Centuria funcionando en el puerto ${PORT}`);
});