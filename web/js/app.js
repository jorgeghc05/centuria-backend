'use strict';

/*
 * Código común a todas las páginas: idioma, menú, WhatsApp, listas de salidas
 * y fechas especiales, galería.
 *
 * Idioma: el español está escrito directamente en el HTML. Los elementos con
 * data-i18n="clave" se sustituyen por EN[clave] (js/en.js) al cambiar a inglés,
 * y vuelven a su HTML original al volver a español.
 */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// Textos que genera JavaScript (no están en el HTML).
const UI = {
  es: {
    reservar: 'Reservar',
    consultar: 'A consultar',
    porPersona: p => `${p} por persona`,
    provisional: 'Fecha provisional',
    turno: t => TURNOS[t].es,
    reservarEsta: 'Reservar esta salida',
    menu: 'Menú',
    cerrar: 'Cerrar',
    masInfo: 'Más información',
    estrellas: n => `${n} de 5 estrellas`,
    enGoogle: n => `en Google (${n} ${n === 1 ? 'reseña' : 'reseñas'})`,
    basadoEn: n => `${n} ${n === 1 ? 'reseña' : 'reseñas'} en Google`,
    verGoogle: 'Ver en Google Maps',
    escribirResena: 'Dejar una reseña',
    resenasInvita: '¿Ya has salido con nosotros? Tu opinión ayuda a otros a decidirse.',
    resenasSinApi: 'Lee lo que cuentan quienes ya han salido con nosotros, o deja tu opinión si ya has venido.',
    fuenteGoogle: 'Reseñas de Google. Se muestran las que Google destaca como más relevantes.',
    foto: n => `Ver foto ${n}`,
    anterior: 'Foto anterior',
    siguiente: 'Foto siguiente',
    duracion: 'Duración',
    horario: 'Horario',
    fecha: 'Fecha',
    grupo: 'Grupo',
    grupoTexto: n => `Hasta ${n} personas, solo vuestro grupo`,
    plan: 'Cómo es la salida',
    incluye: 'Incluido',
    llevar: 'Qué traer',
    porPersonaCorto: 'por persona',
    notaPrecio: 'IVA y gasolina incluidos. Al reservar pagas una señal de 20 € por persona; el resto, en efectivo el día de la salida.',
    notaProvisional: 'La fecha la fija la organización. Si cambia, te ofrecemos la nueva o te devolvemos la señal.',
    incluyeLista: ['Patrón durante toda la salida', 'Barco solo para vuestro grupo', 'Kit de snorkel y flotadores', 'Baño completo y ducha a bordo', 'Gasolina, amarre, seguros e IVA'],
    llevarLista: ['Bañador y toalla', 'Crema solar y gafas de sol', 'Calzado plano que no marque', 'Algo de abrigo para la vuelta', 'Vuestra comida y bebida, si queréis']
  },
  en: {
    reservar: 'Book',
    consultar: 'On request',
    porPersona: p => `${p} per person`,
    provisional: 'Provisional date',
    turno: t => TURNOS[t].en,
    reservarEsta: 'Book this trip',
    menu: 'Menu',
    cerrar: 'Close',
    masInfo: 'More info',
    estrellas: n => `${n} out of 5 stars`,
    enGoogle: n => `on Google (${n} ${n === 1 ? 'review' : 'reviews'})`,
    basadoEn: n => `${n} ${n === 1 ? 'review' : 'reviews'} on Google`,
    verGoogle: 'See on Google Maps',
    escribirResena: 'Write a review',
    resenasInvita: 'Been out with us already? Your review helps others decide.',
    resenasSinApi: 'Read what people who have sailed with us say, or leave your own review if you have been out with us.',
    fuenteGoogle: 'Reviews from Google, showing the ones Google ranks as most relevant.',
    foto: n => `Show photo ${n}`,
    anterior: 'Previous photo',
    siguiente: 'Next photo',
    duracion: 'Duration',
    horario: 'Time',
    fecha: 'Date',
    grupo: 'Group',
    grupoTexto: n => `Up to ${n} people, just your group`,
    plan: 'How the trip goes',
    incluye: 'Included',
    llevar: 'What to bring',
    porPersonaCorto: 'per person',
    notaPrecio: 'VAT and fuel included. To book you pay a €20 per person deposit; the rest in cash on the day.',
    notaProvisional: 'The organisers set the date. If it changes, we offer you the new one or refund the deposit.',
    incluyeLista: ['Skipper for the whole trip', 'The boat just for your group', 'Snorkel kit and floats', 'Full bathroom and shower on board', 'Fuel, mooring, insurance and VAT'],
    llevarLista: ['Swimwear and towel', 'Sunscreen and sunglasses', 'Flat, non-marking shoes', 'A light layer for the way back', 'Your own food and drinks, if you like']
  }
};

const Idioma = {
  actual: 'es',
  alCambiar: [],
  original: new WeakMap(),

  iniciar() {
    let guardado = null;
    try {
      guardado = localStorage.getItem('centuria_idioma');
    } catch {
      /* modo privado: da igual */
    }
    this.poner(guardado === 'en' ? 'en' : 'es');
    $$('.lang button').forEach(b => b.addEventListener('click', () => this.poner(b.dataset.lang)));
  },

  poner(lang) {
    this.actual = lang === 'en' ? 'en' : 'es';
    try {
      localStorage.setItem('centuria_idioma', this.actual);
    } catch {
      /* nada */
    }
    document.documentElement.lang = this.actual;

    for (const el of $$('[data-i18n]')) {
      if (!this.original.has(el)) this.original.set(el, el.innerHTML);
      const clave = el.dataset.i18n;
      el.innerHTML = this.actual === 'en' && EN[clave] !== undefined ? EN[clave] : this.original.get(el);
    }
    for (const el of $$('[data-i18n-placeholder]')) {
      if (!el.dataset.placeholderEs) el.dataset.placeholderEs = el.placeholder;
      const clave = el.dataset.i18nPlaceholder;
      el.placeholder = this.actual === 'en' && EN[clave] ? EN[clave] : el.dataset.placeholderEs;
    }
    $$('.lang button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === this.actual)));
    this.alCambiar.forEach(fn => fn(this.actual));
  },

  t(clave, ...args) {
    const v = UI[this.actual][clave];
    return typeof v === 'function' ? v(...args) : v;
  }
};

function formatoFecha(iso, opciones) {
  const [y, m, d] = iso.split('-').map(Number);
  const locale = Idioma.actual === 'en' ? 'en-GB' : 'es-ES';
  return new Intl.DateTimeFormat(locale, opciones).format(new Date(y, m - 1, d));
}

function formatoPrecio(euros) {
  if (!euros) return Idioma.t('consultar');
  return new Intl.NumberFormat(Idioma.actual === 'en' ? 'en-GB' : 'es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(euros);
}

// Precio total en euros (0 si es a consultar). Salidas: por barco. Fechas especiales: por persona.
function precioTotal(datos, personas) {
  if (datos.precioPersona) return datos.precioPersona * personas;
  return datos.precio || 0;
}

function hoyISO() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
}

function escapar(texto) {
  return String(texto).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function enlaceWhatsApp(mensaje) {
  return `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(mensaje)}`;
}

// ---------------------------------------------------------------------------
// Listas de la portada
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Carrusel de fotos con puntitos (tarjetas y ficha). Se desliza con el dedo
// (scroll-snap nativo); los puntos y flechas solo mueven el scroll.
// ---------------------------------------------------------------------------
function htmlCarrusel(fotos, alt, { grande = false } = {}) {
  const imgs = fotos
    .map((f, i) => `<img src="${f}" alt="${escapar(alt)}${fotos.length > 1 ? ` (${i + 1}/${fotos.length})` : ''}" loading="${i === 0 && !grande ? 'eager' : 'lazy'}" decoding="async" draggable="false">`)
    .join('');
  if (fotos.length < 2) return `<div class="carrusel${grande ? ' carrusel--grande' : ''}"><div class="carrusel-pista">${imgs}</div></div>`;
  const puntos = fotos.map((_, i) => `<button type="button" aria-label="${Idioma.t('foto', i + 1)}"${i === 0 ? ' aria-current="true"' : ''}></button>`).join('');
  return `
    <div class="carrusel${grande ? ' carrusel--grande' : ''}" data-carrusel>
      <div class="carrusel-pista" tabindex="0" aria-label="${escapar(alt)}">${imgs}</div>
      <button type="button" class="carrusel-flecha carrusel-flecha--ant" aria-label="${Idioma.t('anterior')}" hidden>‹</button>
      <button type="button" class="carrusel-flecha carrusel-flecha--sig" aria-label="${Idioma.t('siguiente')}">›</button>
      <div class="carrusel-puntos">${puntos}</div>
    </div>`;
}

function activarCarruseles(raiz = document) {
  $$('[data-carrusel]', raiz).forEach(c => {
    if (c.dataset.listo) return;
    c.dataset.listo = '1';
    const pista = $('.carrusel-pista', c);
    const puntos = $$('.carrusel-puntos button', c);
    const ant = $('.carrusel-flecha--ant', c);
    const sig = $('.carrusel-flecha--sig', c);
    const ir = i => pista.scrollTo({ left: i * pista.clientWidth, behavior: 'smooth' });
    const actual = () => Math.round(pista.scrollLeft / pista.clientWidth);
    const marcar = () => {
      const i = actual();
      puntos.forEach((p, n) => (n === i ? p.setAttribute('aria-current', 'true') : p.removeAttribute('aria-current')));
      ant.hidden = i === 0;
      sig.hidden = i === puntos.length - 1;
    };
    let espera;
    pista.addEventListener('scroll', () => {
      clearTimeout(espera);
      espera = setTimeout(marcar, 60);
    }, { passive: true });
    puntos.forEach((p, i) => p.addEventListener('click', e => { e.stopPropagation(); ir(i); }));
    ant.addEventListener('click', e => { e.stopPropagation(); ir(actual() - 1); });
    sig.addEventListener('click', e => { e.stopPropagation(); ir(actual() + 1); });
    pista.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') ir(actual() + 1);
      if (e.key === 'ArrowLeft') ir(actual() - 1);
    });
  });
}

// ---------------------------------------------------------------------------
// Listas de la portada
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Horarios. Misma lógica que backend/lib/catalogo.js: si cambias algo aquí,
// cámbialo también allí (el backend es el que manda al cobrar).
// ---------------------------------------------------------------------------
const Horario = {
  aMin(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  },
  aHora(min) {
    const m = ((Math.round(min) % 1440) + 1440) % 1440;
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  },
  // '08:30' -> '8:30'
  bonita(hhmm) {
    return hhmm.replace(/^0/, '');
  },
  rango(inicio, fin) {
    return `${this.bonita(inicio)}–${this.bonita(fin)}`;
  },
  intervalo({ inicio, fin }) {
    const a = this.aMin(inicio);
    let b = this.aMin(fin);
    if (b <= a) b += 1440;
    return [a, b];
  },
  turnosQueSolapa(a, b) {
    return Object.keys(TURNOS).filter(t => {
      const [s, e] = this.intervalo(TURNOS[t]);
      return a < e && s < b;
    });
  },

  // Puesta de sol en El Candado, hora de Madrid ('HH:MM'). Algoritmo de la NOAA.
  puestaDeSol(fecha) {
    const [y, mo, d] = fecha.split('-').map(Number);
    const rad = Math.PI / 180;
    const diaDelAno = (Date.UTC(y, mo - 1, d) - Date.UTC(y, 0, 0)) / 86400000;
    const g = ((2 * Math.PI) / 365) * (diaDelAno - 1 + 0.25);
    const ecTiempo = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
    const decl =
      0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
    const lat = PUERTO.lat * rad;
    const ha = Math.acos(Math.cos(90.833 * rad) / (Math.cos(lat) * Math.cos(decl)) - Math.tan(lat) * Math.tan(decl)) / rad;
    const minutosUTC = 720 - 4 * (PUERTO.lon - ha) - ecTiempo;
    return new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(
      new Date(Date.UTC(y, mo - 1, d) + minutosUTC * 60000)
    );
  },

  /**
   * Horarios que se pueden elegir para una salida (o fecha especial) en un día.
   * @returns {Array<{valor, inicio, fin, turnos}>} valor: franja, 'HH:MM', 'sol' o 'evento'
   */
  opciones(s, fecha) {
    const op = (valor, a, b, turnos) => ({ valor, inicio: this.aHora(a), fin: this.aHora(b), turnos: turnos || this.turnosQueSolapa(a, b) });
    if (s.horario) {
      const [a, b] = this.intervalo(s.horario);
      return [op('evento', a, b, s.turnos)];
    }
    const duracion = s.horas * 60;
    if (s.modo === 'sol') {
      const a = Math.floor((this.aMin(this.puestaDeSol(fecha)) - PUERTO.atardecerAntesMin) / 15) * 15;
      return [op('sol', a, a + duracion)];
    }
    if (s.modo === 'inicio') {
      const lista = [];
      for (let m = this.aMin(JORNADA.primeraSalida); m <= this.aMin(JORNADA.ultimaVuelta) - duracion; m += JORNADA.pasoMinutos) lista.push(op(this.aHora(m), m, m + duracion));
      return lista;
    }
    return s.turnos.map(t => op(t, this.aMin(TURNOS[t].inicio), this.aMin(TURNOS[t].inicio) + duracion, [t]));
  },

  // Texto corto para las tarjetas: «mañana, mediodía o tarde», «8:30–11:30»…
  texto(s, l = Idioma.actual) {
    if (s.horario) return this.rango(s.horario.inicio, s.horario.fin);
    if (s.modo === 'sol') return l === 'en' ? 'timed for sunset' : 'según la puesta de sol';
    if (s.modo === 'inicio') {
      const ultima = this.aHora(this.aMin(JORNADA.ultimaVuelta) - s.horas * 60);
      return l === 'en'
        ? `you choose the start, ${this.bonita(JORNADA.primeraSalida)}–${this.bonita(ultima)}`
        : `tú eliges la hora de salida, de ${this.bonita(JORNADA.primeraSalida)} a ${this.bonita(ultima)}`;
    }
    if (s.turnos.length === 1) {
      const [o] = this.opciones(s, hoyISO());
      return this.rango(o.inicio, o.fin);
    }
    const nombres = s.turnos.map(t => Idioma.t('turno', t).toLowerCase());
    return nombres.length > 1 ? `${nombres.slice(0, -1).join(', ')} ${l === 'en' ? 'or' : 'o'} ${nombres.at(-1)}` : nombres[0];
  }
};

function horarioSalida(s, l = Idioma.actual) {
  return Horario.texto(s, l);
}

function pintarSalidas() {
  const cont = $('#salidas');
  if (!cont) return;
  const l = Idioma.actual;
  cont.innerHTML = SALIDAS.filter(s => !s.grupo).map(s => {
    // Variantes (p. ej. celebración de 4 y de 6 horas) en la misma fila, cada una con su precio y su botón.
    const variantes = [s, ...SALIDAS.filter(v => v.grupo === s.id)];
    const opciones = variantes.map(v => `
          <div class="trip-option">
            <span class="trip-price">${formatoPrecio(v.precio)}</span>
            ${variantes.length > 1 ? `<span class="small">${escapar(v[l].duracion)}, ${escapar(horarioSalida(v))}</span>` : ''}
            <a class="btn btn--small" href="disponibilidad.html?servicio=${v.id}">${Idioma.t('reservar')}</a>
          </div>`).join('');
    const meta = variantes.length > 1 ? variantes.map(v => v[l].duracion).join(l === 'en' ? ' or ' : ' o ') : `${s[l].duracion}, ${horarioSalida(s)}`;
    return `
      <article class="trip" id="salida-${s.id}">
        ${htmlCarrusel(s.fotos, s[l].nombre)}
        <div class="trip-body">
          <h3><a href="#ficha=${s.id}" class="trip-title">${escapar(s[l].nombre)}</a></h3>
          <div class="trip-meta">${escapar(meta)}</div>
          <p>${escapar(s[l].texto)}</p>
          <a class="link-arrow" href="#ficha=${s.id}">${Idioma.t('masInfo')}</a>
        </div>
        <div class="trip-options">${opciones}</div>
      </article>`;
  }).join('');
  activarCarruseles(cont);
}

function pintarFechasEspeciales() {
  const cont = $('#fechas');
  if (!cont) return;
  const l = Idioma.actual;
  const hoy = hoyISO();
  const futuros = EVENTOS.filter(e => e.fecha >= hoy);
  const seccion = cont.closest('section');
  if (!futuros.length) {
    if (seccion) seccion.hidden = true;
    return;
  }
  cont.innerHTML = futuros.map(e => `
    <article class="date-card">
      ${e.provisional ? `<span class="tag">${Idioma.t('provisional')}</span>` : ''}
      <div class="date-num">${Number(e.fecha.slice(8))}</div>
      <div class="month">${formatoFecha(e.fecha, { month: 'long', year: 'numeric' })}</div>
      <h3>${escapar(e[l].nombre)}</h3>
      <div class="trip-meta">${Idioma.t('porPersona', formatoPrecio(e.precioPersona))}, ${escapar(e[l].duracion)} (${Horario.texto(e)})</div>
      <p>${escapar(e[l].texto)}</p>
      <div class="date-actions">
        <a class="btn btn--small" href="disponibilidad.html?servicio=${e.id}">${Idioma.t('reservar')}</a>
        <a class="date-more" href="#ficha=${e.id}">${Idioma.t('masInfo')}</a>
      </div>
    </article>`).join('');
}

// ---------------------------------------------------------------------------
// Ficha lateral de cada salida. Se abre con #ficha=<id> en la URL, así el
// enlace se puede compartir y el botón «atrás» del móvil la cierra.
// ---------------------------------------------------------------------------
const Ficha = {
  abierta: null,
  origenFoco: null,

  htmlSalida(s) {
    const l = Idioma.actual;
    const t = s[l];
    const variantes = [s, ...SALIDAS.filter(v => v.grupo === s.id)];
    const precios = variantes
      .map(v => `<div class="ficha-precio"><strong>${formatoPrecio(v.precio)}</strong><span>${escapar(v[l].duracion)}, ${escapar(horarioSalida(v))}</span>
        <a class="btn btn--small" href="disponibilidad.html?servicio=${v.id}">${Idioma.t('reservar')}</a></div>`)
      .join('');
    return {
      cuerpo: `
        ${htmlCarrusel(s.fotos, t.nombre, { grande: true })}
        <div class="ficha-texto">
          <h2 id="ficha-titulo">${escapar(t.nombre)}</h2>
          <ul class="ficha-datos">
            <li><span>${Idioma.t('duracion')}</span>${escapar(variantes.map(v => v[l].duracion).join(' / '))}</li>
            <li><span>${Idioma.t('horario')}</span>${escapar(horarioSalida(s))}</li>
            <li><span>${Idioma.t('grupo')}</span>${Idioma.t('grupoTexto', CONFIG.maxPersonas)}</li>
          </ul>
          <p class="ficha-lead">${escapar(t.texto)}</p>
          ${t.mas ? `<p>${escapar(t.mas)}</p>` : ''}
          ${t.plan ? `<h3>${Idioma.t('plan')}</h3><ol class="ficha-plan">${t.plan.map(p => `<li>${escapar(p)}</li>`).join('')}</ol>` : ''}
          ${this.htmlComun()}
        </div>`,
      pie: `<div class="ficha-precios">${precios}</div><p class="small">${Idioma.t('notaPrecio')}</p>`
    };
  },

  htmlEvento(e) {
    const l = Idioma.actual;
    const t = e[l];
    const fecha = formatoFecha(e.fecha, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    return {
      cuerpo: `
        <div class="ficha-portada">
          <span class="date-num">${Number(e.fecha.slice(8))}</span>
          <span>${formatoFecha(e.fecha, { month: 'long', year: 'numeric' })}</span>
        </div>
        <div class="ficha-texto">
          ${e.provisional ? `<span class="tag">${Idioma.t('provisional')}</span>` : ''}
          <h2 id="ficha-titulo">${escapar(t.nombre)}</h2>
          <ul class="ficha-datos">
            <li><span>${Idioma.t('fecha')}</span>${escapar(fecha)}</li>
            <li><span>${Idioma.t('horario')}</span>${Horario.texto(e)} (${escapar(t.duracion)})</li>
            <li><span>${Idioma.t('grupo')}</span>${Idioma.t('grupoTexto', CONFIG.maxPersonas)}</li>
          </ul>
          <p class="ficha-lead">${escapar(t.texto)}</p>
          ${e.provisional ? `<p class="small">${Idioma.t('notaProvisional')}</p>` : ''}
          ${this.htmlComun()}
        </div>`,
      pie: `<div class="ficha-precios"><div class="ficha-precio"><strong>${formatoPrecio(e.precioPersona)}</strong><span>${Idioma.t('porPersonaCorto')}</span>
        <a class="btn btn--small" href="disponibilidad.html?servicio=${e.id}">${Idioma.t('reservar')}</a></div></div>
        <p class="small">${Idioma.t('notaPrecio')}</p>`
    };
  },

  htmlComun() {
    const lista = clave => `<ul class="ticks">${Idioma.t(clave).map(x => `<li>${escapar(x)}</li>`).join('')}</ul>`;
    return `<div class="ficha-listas">
        <div><h3>${Idioma.t('incluye')}</h3>${lista('incluyeLista')}</div>
        <div><h3>${Idioma.t('llevar')}</h3>${lista('llevarLista')}</div>
      </div>`;
  },

  abrir(id) {
    const salida = SALIDAS.find(s => s.id === id && !s.grupo);
    const evento = EVENTOS.find(e => e.id === id);
    if (!salida && !evento) return this.cerrar(false);
    const { cuerpo, pie } = salida ? this.htmlSalida(salida) : this.htmlEvento(evento);
    const caja = $('#ficha');
    $('#ficha-cuerpo').innerHTML = cuerpo;
    $('#ficha-pie').innerHTML = pie;
    $('#ficha-cuerpo').scrollTop = 0;
    activarCarruseles(caja);
    if (!this.abierta) this.origenFoco = document.activeElement;
    this.abierta = id;
    caja.classList.add('open');
    caja.setAttribute('aria-hidden', 'false');
    document.documentElement.classList.add('sin-scroll');
    requestAnimationFrame(() => $('.ficha-panel', caja).focus());
  },

  cerrar(tocarUrl = true) {
    const caja = $('#ficha');
    if (!caja || !this.abierta) return;
    this.abierta = null;
    caja.classList.remove('open');
    caja.setAttribute('aria-hidden', 'true');
    document.documentElement.classList.remove('sin-scroll');
    if (tocarUrl && location.hash.startsWith('#ficha=')) history.pushState(null, '', location.pathname + location.search);
    if (this.origenFoco) this.origenFoco.focus({ preventScroll: true });
  },

  desdeUrl() {
    const m = location.hash.match(/^#ficha=([\w-]+)$/);
    if (m) this.abrir(m[1]);
    else this.cerrar(false);
  },

  iniciar() {
    if (!$('#ficha')) return;
    window.addEventListener('hashchange', () => this.desdeUrl());
    $$('#ficha [data-cerrar]').forEach(b => b.addEventListener('click', () => this.cerrar()));
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && this.abierta) this.cerrar();
      // Mantener el foco dentro de la ficha
      if (e.key === 'Tab' && this.abierta) {
        const focos = $$('#ficha a[href], #ficha button:not([hidden]), #ficha [tabindex="0"]').filter(el => el.offsetParent);
        if (!focos.length) return;
        const [primero, ultimo] = [focos[0], focos[focos.length - 1]];
        if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
        else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
      }
    });
    Idioma.alCambiar.push(() => this.abierta && this.abrir(this.abierta));
    this.desdeUrl();
  }
};

// ---------------------------------------------------------------------------
// Reseñas de Google. El backend las pide a Google (Places API) y las guarda
// unas horas. Si no está configurado, se muestran solo los enlaces a Google Maps.
// ---------------------------------------------------------------------------
const Resenas = {
  datos: null,

  estrellas(nota) {
    const llenas = Math.round(nota);
    return `<span class="stars" role="img" aria-label="${Idioma.t('estrellas', nota)}">${'★'.repeat(llenas)}<span>${'★'.repeat(5 - llenas)}</span></span>`;
  },

  async cargar() {
    if (!$('[data-resenas]')) return;
    try {
      const r = await fetch(`${CONFIG.api}/api/resenas?idioma=${Idioma.actual}`);
      this.datos = r.ok ? await r.json() : null;
    } catch {
      this.datos = null;
    }
    this.pintar();
  },

  pintar() {
    const api = this.datos && this.datos.configurado ? this.datos : null;
    const manual = CONFIG.notaGoogleManual;
    const d = api || (manual ? { nota: manual.nota, total: manual.total, resenas: [] } : null);
    const urlMaps = (api && api.urlMaps) || CONFIG.urlGoogleMaps;
    // Sin enlace directo de reseña, la ficha de Maps ya tiene el botón «Escribir una reseña».
    const urlEscribir = (api && api.urlEscribir) || CONFIG.urlEscribirResena || urlMaps;
    const manuales = RESENAS.map(r => ({ nota: 5, texto: r.texto, autor: r.autor, cuando: r.salida || '' }));
    const lista = d && d.resenas.length ? d.resenas : manuales;

    // Nota en la franja de datos de la portada
    const chapa = $('#nota-google');
    if (chapa && d && d.nota) {
      chapa.innerHTML = `<a href="#opiniones"><strong>★ ${d.nota.toLocaleString(Idioma.actual === 'en' ? 'en-GB' : 'es-ES', { minimumFractionDigits: 1 })}</strong> ${Idioma.t('enGoogle', d.total)}</a>`;
      chapa.hidden = false;
    }

    $$('[data-resenas]').forEach(cont => {
      const seccion = cont.closest('section');
      if (!d && !lista.length && !urlMaps) {
        if (seccion) seccion.hidden = true;
        return;
      }
      if (seccion) seccion.hidden = false;
      const botones = `
        ${urlMaps ? `<a class="btn btn--line btn--small" href="${urlMaps}" target="_blank" rel="noopener">${Idioma.t('verGoogle')}</a>` : ''}
        ${urlEscribir ? `<a class="btn btn--small" href="${urlEscribir}" target="_blank" rel="noopener">${Idioma.t('escribirResena')}</a>` : ''}`;
      const resumen = d && d.nota
        ? `<div class="resenas-resumen">
             <span class="g-logo" aria-hidden="true">G</span>
             <strong class="resenas-nota">${d.nota.toLocaleString(Idioma.actual === 'en' ? 'en-GB' : 'es-ES', { minimumFractionDigits: 1 })}</strong>
             ${this.estrellas(d.nota)}
             <span class="small">${Idioma.t('basadoEn', d.total)}</span>
             ${lista.length ? '' : `<p class="resenas-invita">${Idioma.t('resenasInvita')}</p>`}
             <div class="resenas-botones">${botones}</div>
           </div>`
        : `<div class="resenas-resumen">
             <span class="g-logo" aria-hidden="true">G</span>
             <p>${Idioma.t('resenasSinApi')}</p>
             <div class="resenas-botones">${botones}</div>
           </div>`;
      const tarjetas = lista.map(r => `
        <figure class="resena">
          ${this.estrellas(r.nota)}
          <blockquote>${escapar(r.texto.length > 420 ? r.texto.slice(0, 400).trim() + '…' : r.texto)}</blockquote>
          <figcaption>
            ${r.foto ? `<img src="${r.foto}" alt="" width="36" height="36" loading="lazy" referrerpolicy="no-referrer">` : `<span class="avatar">${escapar(r.autor.charAt(0))}</span>`}
            <span>${r.urlAutor ? `<a href="${r.urlAutor}" target="_blank" rel="noopener">${escapar(r.autor)}</a>` : escapar(r.autor)}<small>${escapar(r.cuando)}</small></span>
          </figcaption>
        </figure>`).join('');
      cont.classList.toggle('resenas--solo', !lista.length);
      cont.innerHTML = resumen + (tarjetas ? `<div class="resenas-lista">${tarjetas}</div>` : '') +
        (api ? `<p class="small resenas-fuente">${Idioma.t('fuenteGoogle')}</p>` : '');
    });
  }
};

// Mapa de Google cargado solo al pulsar (no mete cookies de Google sin permiso).
function iniciarMapa() {
  const boton = $('#mapa-cargar');
  if (!boton) return;
  boton.addEventListener('click', () => {
    $('#mapa').innerHTML = '<iframe title="Mapa del Real Club El Candado" src="https://www.google.com/maps?q=Centuria+Sea+Adventure+M%C3%A1laga&z=15&output=embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe>';
  });
}

// Formulario de dudas -> WhatsApp con el mensaje escrito.
function iniciarDudas() {
  const form = $('#dudas-form');
  if (!form) return;
  form.addEventListener('submit', e => {
    e.preventDefault();
    const nombre = $('#duda-nombre').value.trim();
    const texto = $('#duda-texto').value.trim();
    const fecha = $('#duda-fecha').value.trim();
    $('#duda-error').hidden = Boolean(nombre && texto);
    if (!nombre || !texto) return;
    const lineas = [`Hola, soy ${nombre}.`, texto];
    if (fecha) lineas.push(`Fecha aproximada: ${fecha}`);
    if (Idioma.actual === 'en') lineas.push('(Escribo desde la web en inglés.)');
    window.open(enlaceWhatsApp(lineas.join('\n')), '_blank', 'noopener');
  });
}

// ---------------------------------------------------------------------------
// Piezas comunes
// ---------------------------------------------------------------------------
function iniciarMenu() {
  const boton = $('.menu-btn');
  const nav = $('.nav');
  if (!boton || !nav) return;
  boton.addEventListener('click', () => {
    const abierto = nav.classList.toggle('open');
    boton.setAttribute('aria-expanded', String(abierto));
  });
}

function iniciarContacto() {
  const saludo = 'Hola, he visto la web de Centuria y quería preguntar por una salida en barco.';
  $$('[data-wa]').forEach(a => {
    a.href = enlaceWhatsApp(saludo);
    a.target = '_blank';
    a.rel = 'noopener';
  });
  $$('[data-telefono]').forEach(el => {
    el.textContent = CONFIG.telefono;
    if (el.tagName === 'A') el.href = `tel:${CONFIG.telefono.replace(/\s/g, '')}`;
  });
  $$('[data-anio]').forEach(el => (el.textContent = new Date().getFullYear()));
}

function iniciarGaleria() {
  const visor = $('#visor');
  if (!visor) return;
  const img = $('img', visor);
  const pie = $('p', visor);
  const cerrar = () => {
    visor.classList.remove('open');
    img.src = '';
  };
  $$('.gallery button').forEach(b =>
    b.addEventListener('click', () => {
      img.src = b.dataset.foto;
      img.alt = b.textContent.trim();
      pie.textContent = b.textContent.trim();
      visor.classList.add('open');
      $('button', visor).focus();
    })
  );
  $('button', visor).addEventListener('click', cerrar);
  visor.addEventListener('click', e => e.target === visor && cerrar());
  document.addEventListener('keydown', e => e.key === 'Escape' && cerrar());
}

document.addEventListener('DOMContentLoaded', () => {
  Idioma.alCambiar.push(pintarSalidas, pintarFechasEspeciales, () => Resenas.cargar());
  Ficha.iniciar();
  iniciarMapa();
  iniciarDudas();
  iniciarMenu();
  iniciarContacto();
  iniciarGaleria();
  Idioma.iniciar();
});
