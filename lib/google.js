'use strict';

/*
 * Conexión con Google Calendar. La usan el servidor y el script de prueba
 * (scripts/probar-calendario.js).
 * Preferible: cuenta de servicio (no caduca). Alternativa: refresh token OAuth.
 */

const { google } = require('googleapis');
const { sumarDias } = require('./disponibilidad');

function credencialesCuentaServicio(env = process.env) {
  if (!env.GOOGLE_SERVICE_ACCOUNT_JSON) return null;
  let raw = env.GOOGLE_SERVICE_ACCOUNT_JSON.trim();
  if (!raw.startsWith('{')) raw = Buffer.from(raw, 'base64').toString('utf8');
  return JSON.parse(raw);
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
