'use strict';

/*
 * Recordatorio por email unos dos días antes de la salida.
 * Lógica pura (sin red) para poder probarla: cuándo toca, a quién y qué se manda.
 *
 * Un cron externo (cron-job.org, gratis) llama cada hora a /api/recordatorios.
 * Se manda cuando faltan 48 h o menos (y más de 6 h), una sola vez por fecha de
 * salida: si el cliente mueve la reserva, se vuelve a mandar para la nueva fecha.
 * Si la reserva se acaba de hacer (menos de 6 h), se espera: acaba de ver su página.
 */

const HORA_MS = 60 * 60 * 1000;
const VENTANA = { maxHoras: 48, minHoras: 6, esperaTrasReservarHoras: 6 };
const RE_EMAIL = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]{2,}$/;

function debeEnviar({ inicioMs, creadoMs, ahoraMs, enviadoPara }) {
  if (!Number.isFinite(inicioMs)) return false;
  const horas = (inicioMs - ahoraMs) / HORA_MS;
  if (horas <= VENTANA.minHoras || horas > VENTANA.maxHoras) return false;
  if (Number.isFinite(creadoMs) && ahoraMs - creadoMs < VENTANA.esperaTrasReservarHoras * HORA_MS) return false;
  return enviadoPara !== new Date(inicioMs).toISOString();
}

// Email del cliente: propiedad privada de la reserva o, en reservas antiguas, la línea «Email:».
function emailDeEvento(ev) {
  const p = (ev.extendedProperties && ev.extendedProperties.private) || {};
  let email = p.email || '';
  if (!email) {
    const m = /^Email: (.+)$/m.exec(ev.description || '');
    email = m ? m[1].trim() : '';
  }
  return RE_EMAIL.test(email) ? email : null;
}

// ---------------------------------------------------------------------------
// Parte del mar (Open-Meteo), resumido para el email
// ---------------------------------------------------------------------------
function resumirParte(tiempo, mar, inicio, fin) {
  if (!tiempo || !tiempo.hourly || !inicio) return null;
  const hIni = Number(inicio.slice(0, 2));
  let hFin = fin ? Number(fin.slice(0, 2)) + (Number(fin.slice(3, 5)) > 0 ? 1 : 0) : hIni + 3;
  if (hFin <= hIni) hFin = 24;
  const tramo = (serie, a = hIni, b = hFin) => (serie || []).slice(a, b).filter(v => v !== null && v !== undefined);
  const max = s => (s.length ? Math.max(...s) : null);
  const th = tiempo.hourly;
  const viento = max(tramo(th.wind_speed_10m));
  if (viento === null) return null;
  const mh = mar && mar.hourly;
  const olas = mh ? max(tramo(mh.wave_height)) : null;
  const agua = mh ? tramo(mh.sea_surface_temperature, hIni, hIni + 1)[0] ?? null : null;
  let veredicto = 'movida';
  if (viento <= 15 && (olas === null || olas <= 0.4)) veredicto = 'calma';
  else if (viento <= 25 && (olas === null || olas <= 0.8)) veredicto = 'buena';
  return {
    viento: Math.round(viento),
    direccion: tramo(th.wind_direction_10m, hIni, hIni + 1)[0] ?? 0,
    olas,
    agua: agua !== null ? Math.round(agua) : null,
    veredicto
  };
}

// ---------------------------------------------------------------------------
// Texto del email
// ---------------------------------------------------------------------------
const TX = {
  es: {
    cuando: d => (d <= 0 ? 'hoy' : d === 1 ? 'mañana' : 'pasado mañana'),
    asunto: (cuando, hora) => `Tu salida en el Centuria es ${cuando}, a las ${hora}`,
    hola: n => (n ? `Hola, ${n}:` : 'Hola:'),
    intro: cuando => `Te recordamos que ${cuando} salís en el Centuria. Aquí tienes lo importante.`,
    personas: n => `${n} ${n === 1 ? 'persona' : 'personas'}`,
    encuentroT: 'Punto de encuentro',
    encuentro: 'Puerto Deportivo El Candado, Carretera de Almería (La Araña) 74, Málaga.',
    llega: h => `Llega 15 minutos antes, sobre las ${h}. El patrón te manda el pantalán exacto por WhatsApp.`,
    marT: 'El mar',
    veredicto: { calma: 'Mar en calma', buena: 'Buen día de mar', movida: 'Mar movido' },
    mar: p =>
      `viento de ${p.viento} km/h ${DIR.es[dir8(p.direccion)]}${p.olas !== null ? `, olas de ${fmt(p.olas, 'es')} m` : ''}${p.agua !== null ? `, agua a ${p.agua} °C` : ''}.`,
    marNota: 'La víspera, el patrón revisa el parte oficial. Si el mar no está para salir, te propone otra fecha o te devuelve la señal.',
    llevarT: 'Qué llevar',
    llevar: 'Bañador y toalla, crema solar y gafas de sol, calzado plano que no marque y algo de abrigo para la vuelta. Si sueles marearte, tómate lo de siempre antes de embarcar.',
    pagoT: 'Pago',
    resto: (e, bizum) => `Quedan ${e} por pagar ${bizum ? 'por Bizum o transferencia antes de salir' : 'en efectivo en el barco'}. Los extras, también en el barco.`,
    restoConsultar: 'El patrón te confirma lo que queda por pagar.',
    boton: 'Ver mi salida',
    pagina: 'En tu página puedes ver el parte del mar actualizado, compartirla con tu grupo y, según las condiciones de reserva, cambiar la hora.',
    dudas: tel => `¿Alguna duda? Responde a este email o escribe por WhatsApp al ${tel}.`,
    pie: 'Centuria Sea Adventure · Salidas privadas en barco con patrón · Real Club El Candado, Málaga'
  },
  en: {
    cuando: d => (d <= 0 ? 'today' : d === 1 ? 'tomorrow' : 'the day after tomorrow'),
    asunto: (cuando, hora) => `Your Centuria trip is ${cuando}, at ${hora}`,
    hola: n => (n ? `Hi ${n},` : 'Hi,'),
    intro: cuando => `Just a reminder that you are going out on the Centuria ${cuando}. Here is what matters.`,
    personas: n => `${n} ${n === 1 ? 'guest' : 'guests'}`,
    encuentroT: 'Meeting point',
    encuentro: 'El Candado Marina, Carretera de Almería (La Araña) 74, Málaga.',
    llega: h => `Please arrive 15 minutes early, around ${h}. The skipper sends you the exact pontoon on WhatsApp.`,
    marT: 'The sea',
    veredicto: { calma: 'Calm sea', buena: 'Good day at sea', movida: 'Choppy sea' },
    mar: p =>
      `wind ${p.viento} km/h ${DIR.en[dir8(p.direccion)]}${p.olas !== null ? `, waves ${fmt(p.olas, 'en')} m` : ''}${p.agua !== null ? `, water ${p.agua} °C` : ''}.`,
    marNota: 'The evening before, the skipper checks the official forecast. If the sea is not right, he offers you another date or refunds the deposit.',
    llevarT: 'What to bring',
    llevar: 'Swimwear and towel, sunscreen and sunglasses, flat non-marking shoes and a light layer for the way back. If you tend to get seasick, take your usual remedy before boarding.',
    pagoT: 'Payment',
    resto: (e, bizum) => `${e} left to pay ${bizum ? 'by Bizum or bank transfer before departure' : 'in cash on board'}. Extras are paid on board too.`,
    restoConsultar: 'The skipper will confirm what is left to pay.',
    boton: 'See my trip',
    pagina: 'On your page you can see the latest sea forecast, share it with your group and, within the booking terms, change the time.',
    dudas: tel => `Any questions? Reply to this email or message us on WhatsApp at ${tel}.`,
    pie: 'Centuria Sea Adventure · Private boat trips with skipper · Real Club El Candado, Málaga'
  }
};
const DIR = {
  es: ['del norte', 'del noreste', 'de levante', 'del sureste', 'del sur', 'del suroeste', 'de poniente', 'del noroeste'],
  en: ['from the north', 'from the north-east', 'easterly (levante)', 'from the south-east', 'from the south', 'from the south-west', 'westerly (poniente)', 'from the north-west']
};
const dir8 = grados => Math.round((((grados % 360) + 360) % 360) / 45) % 8;
const fmt = (n, l) => n.toLocaleString(l === 'en' ? 'en-GB' : 'es-ES', { maximumFractionDigits: 1 });

function escapar(texto) {
  return String(texto).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function hora(hhmm) {
  return hhmm ? hhmm.replace(/^0/, '') : '';
}

function menosQuince(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const t = (h * 60 + m - 15 + 1440) % 1440;
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

function diasEntre(desdeISO, hastaISO) {
  return Math.round((Date.parse(`${hastaISO}T12:00:00Z`) - Date.parse(`${desdeISO}T12:00:00Z`)) / 86400000);
}

/**
 * @param {object} r
 * @param {'es'|'en'} r.idioma
 * @param {string} r.nombre      nombre de pila
 * @param {string} r.salida      nombre de la salida
 * @param {string} r.fecha       YYYY-MM-DD
 * @param {string} r.inicio      HH:MM
 * @param {string|null} r.fin    HH:MM
 * @param {number|null} r.personas
 * @param {number|null} r.resto  euros
 * @param {boolean} r.bizum      el resto no se puede pagar en efectivo
 * @param {string} r.url         enlace a «Tu salida»
 * @param {string} r.telefono
 * @param {string} r.hoy         YYYY-MM-DD (Madrid)
 * @param {object|null} r.parte  resultado de resumirParte()
 * @returns {{asunto:string, html:string, texto:string}}
 */
function componerEmail(r) {
  const l = r.idioma === 'en' ? 'en' : 'es';
  const t = TX[l];
  const cuando = t.cuando(diasEntre(r.hoy, r.fecha));
  const fechaLarga = new Intl.DateTimeFormat(l === 'en' ? 'en-GB' : 'es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${r.fecha}T12:00:00Z`));
  const horario = `${hora(r.inicio)}${r.fin ? ` – ${hora(r.fin)}` : ''}`;
  const euros = r.resto !== null && r.resto !== undefined
    ? new Intl.NumberFormat(l === 'en' ? 'en-GB' : 'es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: Number.isInteger(r.resto) ? 0 : 2 }).format(r.resto)
    : null;
  const pago = euros !== null ? t.resto(euros, r.bizum) : t.restoConsultar;
  const mar = r.parte ? `${t.veredicto[r.parte.veredicto]}: ${t.mar(r.parte)}` : null;

  const bloques = [
    [t.encuentroT, `${t.encuentro} ${t.llega(menosQuince(r.inicio))}`],
    ...(mar ? [[t.marT, `${mar} ${t.marNota}`]] : [[t.marT, t.marNota]]),
    [t.llevarT, t.llevar],
    [t.pagoT, pago]
  ];

  const texto = [
    t.hola(r.nombre),
    '',
    t.intro(cuando),
    '',
    `${r.salida}`,
    `${fechaLarga} · ${horario}${r.personas ? ` · ${t.personas(r.personas)}` : ''}`,
    '',
    ...bloques.flatMap(([titulo, cuerpo]) => [`${titulo.toUpperCase()}`, cuerpo, '']),
    `${t.boton}: ${r.url}`,
    t.pagina,
    '',
    t.dudas(r.telefono),
    '',
    t.pie
  ].join('\n');

  const e = escapar;
  const html = `<!doctype html>
<html lang="${l}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${e(t.asunto(cuando, hora(r.inicio)))}</title></head>
<body style="margin:0;padding:0;background:#f5f5f4;">
<div style="display:none;max-height:0;overflow:hidden;">${e(`${r.salida} · ${fechaLarga} · ${horario}`)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e7e5e4;border-radius:16px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#171717;">
<tr><td style="background:#0a0c0f;padding:28px 28px 22px;">
<div style="font-size:20px;font-weight:900;font-style:italic;letter-spacing:-0.01em;color:#ffffff;">CENTURIA</div>
<div style="height:4px;background:#f2592a;border-radius:4px;margin-top:10px;"></div>
</td></tr>
<tr><td style="padding:28px 28px 8px;">
<p style="margin:0 0 6px;font-size:16px;line-height:1.5;">${e(t.hola(r.nombre))}</p>
<p style="margin:0 0 20px;font-size:16px;line-height:1.5;color:#525252;">${e(t.intro(cuando))}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafaf9;border:1px solid #e7e5e4;border-radius:12px;">
<tr><td style="padding:16px 18px;">
<div style="font-size:18px;font-weight:600;letter-spacing:-0.01em;">${e(r.salida)}</div>
<div style="margin-top:4px;font-size:15px;color:#404040;">${e(fechaLarga)} · <strong>${e(horario)}</strong>${r.personas ? ` · ${e(t.personas(r.personas))}` : ''}</div>
</td></tr></table>
</td></tr>
${bloques
  .map(
    ([titulo, cuerpo]) => `<tr><td style="padding:14px 28px 0;">
<div style="font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#737373;">${e(titulo)}</div>
<p style="margin:6px 0 0;font-size:15px;line-height:1.55;color:#262626;">${e(cuerpo)}</p>
</td></tr>`
  )
  .join('\n')}
<tr><td style="padding:26px 28px 6px;">
<a href="${e(r.url)}" style="display:inline-block;background:#f2592a;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:10px;">${e(t.boton)}</a>
<p style="margin:12px 0 0;font-size:13px;line-height:1.5;color:#737373;">${e(t.pagina)}</p>
</td></tr>
<tr><td style="padding:20px 28px 26px;">
<p style="margin:0;font-size:14px;line-height:1.5;color:#404040;">${e(t.dudas(r.telefono))}</p>
</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid #f0efee;font-size:12px;line-height:1.5;color:#a3a3a3;">${e(t.pie)}</td></tr>
</table>
</td></tr></table>
</body></html>`;

  return { asunto: t.asunto(cuando, hora(r.inicio)), html, texto };
}

module.exports = { VENTANA, RE_EMAIL, debeEnviar, emailDeEvento, resumirParte, componerEmail };
