'use strict';

/*
 * Conexión con Google Calendar. La usan el servidor y el script de prueba
 * (scripts/probar-calendario.js).
 * Preferible: cuenta de servicio (no caduca). Alternativa: refresh token OAuth.
 */

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const { sumarDias } = require('./disponibilidad');

// Dónde puede estar la clave de la cuenta de servicio, por orden:
//   1. Archivo secreto de Render: /etc/secrets/google-service-account.json (lo más fácil)
//   2. Archivo indicado en GOOGLE_SERVICE_ACCOUNT_FILE (o google-service-account.json junto al servidor)
//   3. Variable GOOGLE_SERVICE_ACCOUNT_JSON, con el JSON tal cual o en base64
const RUTAS_ARCHIVO = ['/etc/secrets/google-service-account.json', path.join(__dirname, '..', 'google-service-account.json')];

function credencialesCuentaServicio(env = process.env) {
  for (const ruta of [env.GOOGLE_SERVICE_ACCOUNT_FILE, ...RUTAS_ARCHIVO].filter(Boolean)) {
    if (fs.existsSync(ruta)) return leerJson(fs.readFileSync(ruta, 'utf8'), `el archivo ${ruta}`);
  }
  if (!env.GOOGLE_SERVICE_ACCOUNT_JSON) return null;
  // Quita comillas y saltos de línea que se cuelan al copiar y pegar.
  let raw = env.GOOGLE_SERVICE_ACCOUNT_JSON.trim().replace(/^['"]|['"]$/g, '').trim();
  if (!raw.startsWith('{')) raw = Buffer.from(raw.replace(/\s+/g, ''), 'base64').toString('utf8');
  return leerJson(raw, 'GOOGLE_SERVICE_ACCOUNT_JSON');
}

function leerJson(texto, origen) {
  try {
    const datos = JSON.parse(texto);
    if (!datos.client_email || !datos.private_key) throw new Error('le faltan client_email o private_key');
    return datos;
  } catch (err) {
    const e = new Error(
      `La clave de Google de ${origen} no es válida (${err.message}). ` +
        'Lo más fácil: en Render > Environment > Secret Files, crea google-service-account.json y pega dentro el contenido del .json descargado de Google Cloud.'
    );
    e.code = 'CLAVE_GOOGLE';
    throw e;
  }
}

function crearAuthGoogle(env = process.env) {
  const scopes = ['https://www.googleapis.com/auth/calendar'];
  const credenciales = credencialesCuentaServicio(env);
  if (credenciales) return new google.auth.GoogleAuth({ credentials: credenciales, scopes });
  const oauth = new google.auth.OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, 'https://developers.google.com/oauthplayground');
  oauth.setCredentials({ refresh_token: env.GOOGLE_REFRESH_TOKEN });
  return oauth;
}

function crearCalendario(env = process.env) {
  return google.calendar({ version: 'v3', auth: crearAuthGoogle(env) });
}

function idsCalendarios(env = process.env) {
  return {
    disponibilidad: env.GOOGLE_CALENDAR_DISPONIBILIDAD || env.GOOGLE_CALENDAR_ID || 'primary',
    reservas: env.GOOGLE_CALENDAR_ID || 'primary'
  };
}

async function listarEventos(calendar, calendarId, desde, hasta) {
  const eventos = [];
  let pageToken;
  do {
    const { data } = await calendar.events.list({
      calendarId,
      // Un día de margen a cada lado; luego se filtra por fecha local.
      timeMin: `${sumarDias(desde, -1)}T00:00:00Z`,
      timeMax: `${sumarDias(hasta, 2)}T00:00:00Z`,
      singleEvents: true,
      timeZone: 'Europe/Madrid',
      maxResults: 2500,
      pageToken
    });
    eventos.push(...(data.items || []));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return eventos;
}

module.exports = { crearCalendario, credencialesCuentaServicio, idsCalendarios, listarEventos };
