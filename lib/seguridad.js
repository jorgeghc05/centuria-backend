'use strict';

/*
 * Seguridad HTTP del backend, sin dependencias:
 *
 *   cabecerasSeguridad()  -> las cabeceras que pondría Helmet, ajustadas a una API
 *                            que solo devuelve JSON (más estrictas que las de Helmet).
 *   limitador({...})      -> límite de peticiones por IP y ventana de tiempo, con 429,
 *                            Retry-After y cabeceras RateLimit-*. En memoria: vale para
 *                            un solo servidor (Render). Si el servidor se reinicia, se
 *                            vacían los contadores, que es lo aceptable aquí.
 */

function cabecerasSeguridad({ produccion = false } = {}) {
  const fijas = {
    // La API no sirve HTML: no se puede cargar nada ni meterla en un iframe.
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
    'Cross-Origin-Opener-Policy': 'same-origin',
    // Solo afecta a cargas sin CORS (<img>, <script>…); el fetch de la web va por CORS y no lo nota.
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Origin-Agent-Cluster': '?1',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-DNS-Prefetch-Control': 'off',
    'X-Download-Options': 'noopen',
    'X-Frame-Options': 'DENY',
    'X-Permitted-Cross-Domain-Policies': 'none',
    // Helmet lo pone a 0: el filtro antiguo de los navegadores causaba más problemas que arreglaba.
    'X-XSS-Protection': '0',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()'
  };
  if (produccion) fijas['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
  return (_req, res, next) => {
    for (const [k, v] of Object.entries(fijas)) res.setHeader(k, v);
    res.removeHeader('X-Powered-By');
    next();
  };
}

const MENSAJE_LIMITE = 'Demasiadas peticiones seguidas. Espera unos minutos y vuelve a intentarlo.';

/**
 * @param {object} o
 * @param {string} o.nombre     para separar los contadores de cada grupo de rutas
 * @param {number} o.ventanaMs
 * @param {number} o.max        peticiones permitidas por IP en la ventana
 * @param {string} [o.mensaje]
 * @param {() => number} [o.ahora]  para los tests
 */
function limitador({ nombre, ventanaMs, max, mensaje = MENSAJE_LIMITE, ahora = Date.now }) {
  const contadores = new Map(); // ip -> { cuenta, reinicio }
  const limpieza = setInterval(() => {
    const t = ahora();
    for (const [ip, c] of contadores) if (c.reinicio <= t) contadores.delete(ip);
  }, Math.max(ventanaMs, 60 * 1000));
  if (limpieza.unref) limpieza.unref();

  const middleware = (req, res, next) => {
    const t = ahora();
    const ip = req.ip || (req.socket && req.socket.remoteAddress) || 'desconocida';
    let c = contadores.get(ip);
    if (!c || c.reinicio <= t) {
      c = { cuenta: 0, reinicio: t + ventanaMs };
      contadores.set(ip, c);
    }
    c.cuenta += 1;
    const segundos = Math.max(1, Math.ceil((c.reinicio - t) / 1000));
    res.setHeader('RateLimit-Policy', `${max};w=${Math.round(ventanaMs / 1000)}`);
    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, max - c.cuenta)));
    res.setHeader('RateLimit-Reset', String(segundos));
    if (c.cuenta > max) {
      res.setHeader('Retry-After', String(segundos));
      if (c.cuenta === max + 1) console.warn(`Límite de peticiones (${nombre}) superado por ${ip}`);
      return res.status(429).json({ error: mensaje });
    }
    next();
  };
  middleware.reiniciar = () => contadores.clear();
  return middleware;
}

module.exports = { cabecerasSeguridad, limitador, MENSAJE_LIMITE };
