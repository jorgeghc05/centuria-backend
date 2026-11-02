'use strict';

/*
 * Página de reservas: calendario con tres franjas (mañana, mediodía y tarde)
 * leídas del Google Calendar del patrón (vía backend), elección de hora,
 * formulario y pago de la señal.
 *
 * Estado de cada franja que devuelve el backend: 'libre' | 'ocupado' |
 * 'retenido' (alguien está pagando ese hueco) | 'cerrado'.
 * Si un día no aparece, está cerrado.
 *
 * Lo que se elige (this.eleccion) depende de la salida (ver Horario.opciones):
 * una franja ('manana'), una hora de salida ('09:30'), 'sol' o 'evento'.
 */

const TX = {
  es: {
    semana: ['L', 'M', 'X', 'J', 'V', 'S', 'D'],
    grupoSalidas: 'Salidas',
    grupoEventos: 'Fechas especiales',
    grupoOtros: 'Otros',
    regalo: 'Bono regalo (fecha abierta, 6 meses)',
    personalizado: 'Plan a medida',
    infoRegalo: 'El bono no necesita fecha. Te lo preparamos por WhatsApp con el nombre de quien lo recibe.',
    infoPersonalizado: 'Cuéntanos la idea en las notas. Si eliges día y franja, lo miramos para esa fecha.',
    infoEvento: (fecha, provisional) => `Solo el ${fecha}.${provisional ? ' Fecha provisional: si la organización la cambia, te ofrecemos la nueva o te devolvemos la señal.' : ''}`,
    gratis: 'gratis',
    sinFecha: 'Toca un día del calendario.',
    fechaElegida: f => `Día elegido: ${f}`,
    sinTurnos: 'Ese día no hay hueco para esta salida.',
    elegirFranja: 'Elige franja',
    elegirHora: 'Elige la hora de salida',
    horaFija: 'Horario',
    salida: 'Salida',
    vuelta: 'Vuelta',
    vueltaA: h => `vuelta a las ${h}`,
    solSePone: h => `Ese día el sol se pone a las ${h}.`,
    ocupaFranjas: l => `Ocupa ${l}.`,
    horaNoLibre: 'No disponible',
    franjaEstado: { libre: '', ocupado: 'Reservada', retenido: 'Reservándose', cerrado: 'No disponible', especial: 'Fecha especial' },
    linea: 'El día en el barco',
    cargando: 'Cargando disponibilidad… La primera vez puede tardar unos segundos.',
    errorCarga: 'No se ha podido cargar el calendario. Puedes reservar por WhatsApp mientras tanto.',
    abrirWa: 'Abrir WhatsApp',
    mesSinHuecos: 'Este mes no hay hueco para esta salida. Prueba el mes siguiente o escríbenos.',
    liberado: 'Has vuelto sin pagar: el hueco vuelve a estar libre y puedes cambiar lo que quieras.',
    pagar: n => `Pagar señal de ${n} €`,
    pedirWa: 'Enviar por WhatsApp',
    notaPago: 'Te llevamos a la pasarela de pago de Stripe. Allí te pedirá email y teléfono para el recibo y para contactarte.',
    notaWa: 'Se abre WhatsApp con el mensaje escrito; solo tienes que enviarlo.',
    conectando: 'Conectando con la pasarela…',
    rSalida: 'Salida',
    rDia: 'Día',
    rTurno: 'Horario',
    rPersonas: 'Personas',
    rPrecio: 'Precio',
    rSenal: 'Señal ahora',
    rResto: 'Resto en efectivo el día de la salida',
    rRestoNoEfectivo: 'Resto por Bizum o transferencia',
    rIncluye: 'IVA y gasolina incluidos. El resto y los extras se pagan en efectivo en el barco.',
    rLimite: 'Como el total llega a 1.000 €, la ley no permite pagarlo en efectivo: el resto se paga por Bizum o transferencia antes de salir. Los extras, en efectivo.',
    rConsultar: 'El precio de esta salida te lo confirma el patrón. La señal se descuenta del total y el resto se paga en efectivo.',
    eFecha: 'Elige un día en el calendario.',
    eTurno: 'Elige la hora de salida.',
    eNombre: 'Escribe tu nombre.',
    ePersonas: n => `Entre 1 y ${n} personas.`,
    eAcepto: 'Para pagar hay que aceptar las condiciones de reserva.',
    eRed: 'No se ha podido conectar con el servidor. Inténtalo de nuevo o escríbenos por WhatsApp.',
    codigoOk: 'Código válido. Se aplicará en el precio final.',
    codigoKo: 'Ese código no es válido.',
    diaAria: (f, m, md, t) => `${f}. Mañana: ${m}. Mediodía: ${md}. Tarde: ${t}.`,
    y: 'y',
    estado: { libre: 'libre', ocupado: 'reservado', retenido: 'reservado', cerrado: 'no disponible' }
  },
  en: {
    semana: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
    grupoSalidas: 'Trips',
    grupoEventos: 'Special dates',
    grupoOtros: 'Other',
    regalo: 'Gift voucher (open date, 6 months)',
    personalizado: 'Tailor-made plan',
    infoRegalo: 'The voucher needs no date. We prepare it on WhatsApp with the recipient’s name.',
    infoPersonalizado: 'Tell us your idea in the notes. If you pick a day and time slot, we will check that date.',
    infoEvento: (fecha, provisional) => `Only on ${fecha}.${provisional ? ' Provisional date: if the organisers move it, we offer you the new date or refund the deposit.' : ''}`,
    gratis: 'free',
    sinFecha: 'Tap a day on the calendar.',
    fechaElegida: f => `Chosen day: ${f}`,
    sinTurnos: 'No room that day for this trip.',
    elegirFranja: 'Pick a time slot',
    elegirHora: 'Pick your start time',
    horaFija: 'Time',
    salida: 'Departure',
    vuelta: 'Back',
    vueltaA: h => `back at ${h}`,
    solSePone: h => `That day the sun sets at ${h}.`,
    ocupaFranjas: l => `Takes up the ${l} slot${l.includes(' and ') ? 's' : ''}.`,
    horaNoLibre: 'Not available',
    franjaEstado: { libre: '', ocupado: 'Booked', retenido: 'Being booked', cerrado: 'Not available', especial: 'Special date' },
    linea: 'The boat’s day',
    cargando: 'Loading availability… The first time may take a few seconds.',
    errorCarga: 'The calendar could not be loaded. You can book on WhatsApp in the meantime.',
    abrirWa: 'Open WhatsApp',
    mesSinHuecos: 'No room this month for this trip. Try next month or message us.',
    liberado: 'You came back without paying: the slot is free again and you can change anything you like.',
    pagar: n => `Pay €${n} deposit`,
    pedirWa: 'Send on WhatsApp',
    notaPago: 'You will go to Stripe’s payment page, which asks for your email and phone for the receipt and so we can contact you.',
    notaWa: 'WhatsApp opens with the message written; you just send it.',
    conectando: 'Connecting to payment…',
    rSalida: 'Trip',
    rDia: 'Day',
    rTurno: 'Time',
    rPersonas: 'Guests',
    rPrecio: 'Price',
    rSenal: 'Deposit now',
    rResto: 'Rest in cash on the day',
    rRestoNoEfectivo: 'Rest by bank transfer or Bizum',
    rIncluye: 'VAT and fuel included. The rest and any extras are paid in cash on board.',
    rLimite: 'As the total reaches €1,000, Spanish law does not allow paying it in cash: the rest is paid by bank transfer or Bizum before departure. Extras in cash.',
    rConsultar: 'The skipper will confirm the price of this trip. The deposit is taken off the total.',
    eFecha: 'Pick a day on the calendar.',
    eTurno: 'Pick a start time.',
    eNombre: 'Enter your name.',
    ePersonas: n => `Between 1 and ${n} guests.`,
    eAcepto: 'You need to accept the booking terms to pay.',
    eRed: 'Could not reach the server. Try again or message us on WhatsApp.',
    codigoOk: 'Valid code. It will be applied to the final price.',
    codigoKo: 'That code is not valid.',
    diaAria: (f, m, md, t) => `${f}. Morning: ${m}. Midday: ${md}. Afternoon: ${t}.`,
    y: 'and',
    estado: { libre: 'free', ocupado: 'booked', retenido: 'booked', cerrado: 'not available' }
  }
};

const Reservas = {
  listo: false,
  meses: new Map(), // 'YYYY-MM' -> { estado: 'cargando'|'ok'|'error', dias }
  mesVisto: null, // Date día 1
  fecha: '',
  eleccion: '',
  codigoValido: false,

  tx(clave, ...args) {
    const v = TX[Idioma.actual][clave];
    return typeof v === 'function' ? v(...args) : v;
  },

  // -------------------------------------------------------------------------
  // Servicio elegido
  // -------------------------------------------------------------------------
  servicio() {
    const id = $('#servicio').value;
    const salida = SALIDAS.find(s => s.id === id);
    if (salida) return { id, tipo: 'salida', datos: salida };
    const evento = EVENTOS.find(e => e.id === id);
    if (evento) return { id, tipo: 'evento', datos: evento };
    if (id === 'regalo') return { id, tipo: 'regalo', datos: null };
    // Plan a medida: se elige franja (opcional) y se manda por WhatsApp.
    return { id: 'personalizado', tipo: 'personalizado', datos: { modo: 'turno', horas: 4, turnos: Object.keys(TURNOS) } };
  },

  esPago() {
    const t = this.servicio().tipo;
    return t === 'salida' || t === 'evento';
  },

  nombreServicio(srv, lang = Idioma.actual) {
    if (srv.tipo === 'regalo') return TX[lang].regalo;
    if (srv.tipo === 'personalizado') return TX[lang].personalizado;
    return srv.datos[lang].nombre;
  },

  pintarSelectorServicio() {
    const sel = $('#servicio');
    const previo = sel.value;
    const l = Idioma.actual;
    const hoy = hoyISO();
    const opt = (v, txt) => `<option value="${v}">${escapar(txt)}</option>`;
    sel.innerHTML =
      `<optgroup label="${this.tx('grupoSalidas')}">${SALIDAS.map(s => opt(s.id, `${s[l].nombre} (${s[l].duracion}${s.precio ? `, ${formatoPrecio(s.precio)}` : ''})`)).join('')}</optgroup>` +
      `<optgroup label="${this.tx('grupoEventos')}">${EVENTOS.filter(e => e.fecha >= hoy)
        .map(e => opt(e.id, `${e[l].nombre}, ${formatoFecha(e.fecha, { day: 'numeric', month: 'short', year: 'numeric' })} (${Idioma.t('porPersona', formatoPrecio(e.precioPersona))})`))
        .join('')}</optgroup>` +
      `<optgroup label="${this.tx('grupoOtros')}">${opt('regalo', this.tx('regalo'))}${opt('personalizado', this.tx('personalizado'))}</optgroup>`;
    if (previo && sel.querySelector(`option[value="${previo}"]`)) sel.value = previo;
  },

  // -------------------------------------------------------------------------
  // Disponibilidad
  // -------------------------------------------------------------------------
  claveMes(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  },

  async cargarMes(d, { forzar = false } = {}) {
    const clave = this.claveMes(d);
    const actual = this.meses.get(clave);
    if (!forzar && actual && actual.estado !== 'error') return;

    this.meses.set(clave, { estado: 'cargando', dias: {} });
    this.pintar();

    const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const url = `${CONFIG.api}/api/disponibilidad?desde=${clave}-01&hasta=${clave}-${String(ultimo).padStart(2, '0')}`;
    const ctrl = new AbortController();
    const temporizador = setTimeout(() => ctrl.abort(), 70000); // Render gratis tarda en despertar
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      this.meses.set(clave, { estado: 'ok', dias: json.dias || {} });
    } catch (err) {
      console.error('Disponibilidad:', err);
      this.meses.set(clave, { estado: 'error', dias: {} });
    } finally {
      clearTimeout(temporizador);
    }
    this.pintar();
  },

  diaDisp(fecha) {
    const mes = this.meses.get(fecha.slice(0, 7));
    return mes && mes.dias[fecha];
  },

  // Horarios de la salida para ese día, cada uno con libre: true/false.
  opcionesDia(fecha, srv = this.servicio()) {
    if (!srv.datos || !fecha) return [];
    if (srv.tipo === 'evento' && srv.datos.fecha !== fecha) return [];
    const dia = this.diaDisp(fecha);
    return Horario.opciones(srv.datos, fecha).map(o => ({
      ...o,
      libre:
        Boolean(dia) &&
        o.turnos.length > 0 &&
        o.turnos.every(t => {
          const evento = dia.eventos && dia.eventos[t];
          return dia[t] === 'libre' && (!evento || evento === srv.id);
        })
    }));
  },

  hayHueco(fecha, srv = this.servicio()) {
    return this.opcionesDia(fecha, srv).some(o => o.libre);
  },

  opcionElegida() {
    return this.opcionesDia(this.fecha).find(o => o.valor === this.eleccion && o.libre) || null;
  },

  listaFranjas(turnos) {
    const n = turnos.map(t => Idioma.t('turno', t).toLowerCase());
    return n.length > 1 ? `${n.slice(0, -1).join(', ')} ${this.tx('y')} ${n.at(-1)}` : n[0] || '';
  },

  // -------------------------------------------------------------------------
  // Pintado
  // -------------------------------------------------------------------------
  pintar() {
    if (!this.listo) return;
    this.pintarCalendario();
    this.pintarFormulario();
  },

  pintarCalendario() {
    const d = this.mesVisto;
    const srv = this.servicio();
    const mes = this.meses.get(this.claveMes(d)) || { estado: 'cargando', dias: {} };
    const locale = Idioma.actual === 'en' ? 'en-GB' : 'es-ES';

    const titulo = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(d);
    $('#mes-titulo').textContent = titulo.charAt(0).toUpperCase() + titulo.slice(1);
    const hoy = new Date();
    $('#mes-anterior').disabled = d.getFullYear() === hoy.getFullYear() && d.getMonth() === hoy.getMonth();
    const limite = new Date(hoy.getFullYear(), hoy.getMonth() + 15, 1);
    $('#mes-siguiente').disabled = d >= limite;
    $('#cal-semana').innerHTML = this.tx('semana').map(s => `<span>${s}</span>`).join('');
    $('#cal').classList.toggle('loading', mes.estado === 'cargando');

    const huecos = (d.getDay() + 6) % 7;
    const total = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const estados = TX[Idioma.actual].estado;
    let html = '<span></span>'.repeat(huecos);
    let algunoUsable = false;

    for (let n = 1; n <= total; n++) {
      const fecha = `${this.claveMes(d)}-${String(n).padStart(2, '0')}`;
      const dia = this.diaDisp(fecha);
      const est = Object.keys(TURNOS).map(t => (dia ? dia[t] : 'cerrado'));
      const usable = srv.tipo !== 'regalo' && this.hayHueco(fecha, srv);
      if (usable) algunoUsable = true;
      const etiqueta = this.tx('diaAria', formatoFecha(fecha, { weekday: 'long', day: 'numeric', month: 'long' }), ...est.map(e => estados[e]));
      html += `
        <button type="button" class="day${dia && dia.eventos ? ' evento' : ''}${usable ? ' usable' : ''}" data-fecha="${fecha}"
          aria-pressed="${fecha === this.fecha}" aria-label="${escapar(etiqueta)}" ${usable ? '' : 'disabled'}>
          <span class="num">${n}</span>
          ${dia ? `<span class="franjas">${est.map(e => `<i class="${e}"></i>`).join('')}</span>` : ''}
        </button>`;
    }
    $('#cal-dias').innerHTML = html;

    const aviso = $('#cal-aviso');
    aviso.hidden = true;
    if (mes.estado === 'cargando') {
      aviso.textContent = this.tx('cargando');
      aviso.hidden = false;
    } else if (mes.estado === 'error') {
      aviso.innerHTML = `${this.tx('errorCarga')} <a href="${enlaceWhatsApp('Hola, quería reservar una salida en el Centuria.')}" target="_blank" rel="noopener">${this.tx('abrirWa')}</a>`;
      aviso.hidden = false;
    } else if (!algunoUsable && srv.tipo !== 'regalo' && srv.tipo !== 'evento') {
      aviso.textContent = this.tx('mesSinHuecos');
      aviso.hidden = false;
    }
  },

  pintarFormulario() {
    const srv = this.servicio();
    const pago = this.esPago();
    const l = Idioma.actual;

    // Información de la salida elegida
    let info = '';
    if (srv.tipo === 'regalo') info = this.tx('infoRegalo');
    else if (srv.tipo === 'personalizado') info = this.tx('infoPersonalizado');
    else if (srv.tipo === 'evento') {
      info = this.tx('infoEvento', formatoFecha(srv.datos.fecha, { day: 'numeric', month: 'long', year: 'numeric' }), srv.datos.provisional);
    } else info = srv.datos[l].texto;
    $('#servicio-info').textContent = info;

    $('#bloque-fecha').hidden = srv.tipo === 'regalo';
    $('#bloque-pago').hidden = !pago;
    $('#bloque-acepto').hidden = !pago;
    $('#acepto').required = pago;

    // Fecha y turnos
    $('#fecha-elegida').textContent = this.fecha
      ? this.tx('fechaElegida', formatoFecha(this.fecha, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))
      : this.tx('sinFecha');

    this.pintarHorarios();

    // Extras
    const marcados = new Set($$('#extras input:checked').map(i => i.value));
    $('#extras').innerHTML = Object.entries(GRUPOS_EXTRAS)
      .map(([grupo, titulo]) => {
        const items = EXTRAS.filter(x => x.grupo === grupo)
          .map(x => `<label><input type="checkbox" value="${x.id}" ${marcados.has(x.id) ? 'checked' : ''}> ${escapar(x[l])}${x.gratis ? '' : ` (${x.precio})`}</label>`)
          .join('');
        return `<p class="extras-grupo">${escapar(titulo[l])}</p>${items}`;
      })
      .join('');
    this.pintarAvisosExtras();

    this.pintarResumen();
  },

  // Elección de hora según el tipo de salida, más la línea del día.
  pintarHorarios() {
    const srv = this.servicio();
    const caja = $('#turnos');
    const ops = this.opcionesDia(this.fecha, srv);
    const libres = ops.filter(o => o.libre);
    if (this.eleccion && !libres.some(o => o.valor === this.eleccion)) this.eleccion = '';
    if (!this.eleccion && libres.length === 1 && srv.tipo !== 'personalizado') this.eleccion = libres[0].valor;

    if (!this.fecha || srv.tipo === 'regalo') {
      caja.innerHTML = '';
      caja.className = 'horarios';
      return;
    }
    if (!libres.length) {
      caja.className = 'horarios';
      caja.innerHTML = `<p class="small">${this.tx('sinTurnos')}</p>`;
      return;
    }

    const dia = this.diaDisp(this.fecha) || {};
    const modo = srv.tipo === 'evento' ? 'evento' : srv.datos.modo;
    const radio = (o, extra = '') =>
      `<input type="radio" name="horario" value="${o.valor}" ${o.valor === this.eleccion ? 'checked' : ''} ${o.libre ? '' : 'disabled'} ${extra}>`;
    let html = '';

    if (modo === 'turno') {
      // Una tarjeta por franja: nombre, horas de la salida y estado.
      html = `<p class="horarios-titulo">${this.tx('elegirFranja')}</p><div class="franjas-elegir">${ops
        .map(o => {
          const t = o.turnos[0];
          const estado = o.libre ? '' : dia.eventos && dia.eventos[t] && dia[t] === 'libre' ? 'especial' : dia[t] || 'cerrado';
          return `<label class="franja-op">${radio(o)}
            <strong>${Idioma.t('turno', t)}</strong>
            <span>${Horario.rango(o.inicio, o.fin)}</span>
            ${estado ? `<em>${this.tx('franjaEstado')[estado]}</em>` : ''}</label>`;
        })
        .join('')}</div>`;
    } else if (modo === 'inicio') {
      // Rejilla de horas de salida, cada 30 minutos.
      html = `<p class="horarios-titulo">${this.tx('elegirHora')}</p><div class="horas-elegir">${ops
        .map(o => `<label class="hora-op" title="${o.libre ? escapar(this.tx('vueltaA', Horario.bonita(o.fin))) : this.tx('horaNoLibre')}">${radio(o)}<span>${Horario.bonita(o.inicio)}</span></label>`)
        .join('')}</div>`;
    } else {
      // Puesta de sol o fecha especial: la hora viene dada.
      const o = ops[0];
      html = `<div class="hora-fija">${radio(o, 'hidden')}
        <div><span>${this.tx('salida')}</span><strong>${Horario.bonita(o.inicio)}</strong></div>
        <div><span>${this.tx('vuelta')}</span><strong>${Horario.bonita(o.fin)}</strong></div>
        ${modo === 'sol' ? `<p>${this.tx('solSePone', Horario.bonita(Horario.puestaDeSol(this.fecha)))}</p>` : ''}</div>`;
    }

    caja.className = 'horarios';
    caja.innerHTML = html + this.htmlLinea(dia, this.opcionElegida());
  },

  // Línea del día de 8:00 a 22:30 con las tres franjas y, encima, la salida elegida.
  htmlLinea(dia, op) {
    const ini = 8 * 60;
    const fin = 22.5 * 60;
    const pct = m => `${(((Math.min(Math.max(m, ini), fin) - ini) / (fin - ini)) * 100).toFixed(2)}%`;
    const tramos = Object.entries(TURNOS)
      .map(([t, f]) => {
        const [a, b] = Horario.intervalo(f);
        const estado = dia[t] || 'cerrado';
        return `<span class="linea-franja ${estado}" style="left:${pct(a)};width:calc(${pct(b)} - ${pct(a)})" title="${escapar(Idioma.t('turno', t))}: ${escapar(TX[Idioma.actual].estado[estado])}"></span>`;
      })
      .join('');
    const marcas = [8.5, 12.5, 16.5, 21].map(h => `<span class="linea-hora" style="left:${pct(h * 60)}">${Horario.bonita(Horario.aHora(h * 60))}</span>`).join('');
    let salida = '';
    let pie = '';
    if (op) {
      const [a, b] = Horario.intervalo(op);
      salida = `<span class="linea-salida" style="left:${pct(a)};width:calc(${pct(b)} - ${pct(a)})"></span>`;
      pie = `<p class="linea-pie"><strong>${Horario.rango(op.inicio, op.fin)}</strong> · ${escapar(this.tx('ocupaFranjas', this.listaFranjas(op.turnos)))}</p>`;
    }
    return `<div class="linea" aria-hidden="true"><span class="linea-titulo">${this.tx('linea')}</span>
      <div class="linea-pista">${tramos}${salida}</div><div class="linea-horas">${marcas}</div></div>${pie}`;
  },

  // Avisos de los extras marcados (p. ej. mascota: confirmarlo por WhatsApp).
  pintarAvisosExtras() {
    const l = Idioma.actual;
    const avisos = $$('#extras input:checked')
      .map(i => EXTRAS.find(x => x.id === i.value))
      .filter(x => x && x.aviso);
    $('#extras-aviso').innerHTML = avisos
      .map(x => `${escapar(x.aviso[l])} <a href="${enlaceWhatsApp('Hola, quería reservar una salida en el Centuria y llevar a mi mascota.')}" target="_blank" rel="noopener">${this.tx('abrirWa')}</a>`)
      .join('<br>');
    $('#extras-aviso').hidden = !avisos.length;
  },

  pintarResumen() {
    const srv = this.servicio();
    const resumen = $('#resumen');
    const boton = $('#enviar');
    if (!this.esPago()) {
      resumen.hidden = true;
      boton.textContent = this.tx('pedirWa');
      $('#nota-envio').textContent = this.tx('notaWa');
      return;
    }
    const personas = Math.min(Math.max(Number($('#personas').value) || 1, 1), CONFIG.maxPersonas);
    const senal = personas * CONFIG.senalPorPersona;
    const precio = precioTotal(srv.datos, personas);
    const sinEfectivo = precio >= CONFIG.limiteEfectivo;
    const fila = (k, v, clase = '') => `<dt>${this.tx(k)}</dt><dd${clase ? ` class="${clase}"` : ''}>${escapar(v)}</dd>`;
    resumen.hidden = false;
    resumen.innerHTML = `
      <dl>
        ${fila('rSalida', `${this.nombreServicio(srv)} (${srv.datos[Idioma.actual].duracion})`)}
        ${fila('rDia', this.fecha ? formatoFecha(this.fecha, { weekday: 'short', day: 'numeric', month: 'short' }) : '–')}
        ${fila('rTurno', this.opcionElegida() ? Horario.rango(this.opcionElegida().inicio, this.opcionElegida().fin) : '–')}
        ${fila('rPersonas', String(personas))}
        ${precio ? fila('rPrecio', srv.datos.precioPersona ? `${formatoPrecio(precio)} (${personas} × ${formatoPrecio(srv.datos.precioPersona)})` : formatoPrecio(precio)) : ''}
        ${fila('rSenal', formatoPrecio(senal), 'total')}
        ${precio ? fila(sinEfectivo ? 'rRestoNoEfectivo' : 'rResto', formatoPrecio(Math.max(precio - senal, 0))) : ''}
      </dl>
      <p class="small">${this.tx(!precio ? 'rConsultar' : sinEfectivo ? 'rLimite' : 'rIncluye')}</p>`;
    boton.textContent = this.tx('pagar', senal);
    $('#nota-envio').textContent = this.tx('notaPago');
  },

  // -------------------------------------------------------------------------
  // Acciones
  // -------------------------------------------------------------------------
  irAMes(d) {
    this.mesVisto = new Date(d.getFullYear(), d.getMonth(), 1);
    this.pintar();
    this.cargarMes(this.mesVisto);
  },

  alCambiarServicio() {
    const srv = this.servicio();
    this.eleccion = '';
    if (srv.tipo === 'evento') {
      this.fecha = srv.datos.fecha;
      const [y, m] = this.fecha.split('-').map(Number);
      this.irAMes(new Date(y, m - 1, 1));
    } else {
      if (this.fecha && !this.hayHueco(this.fecha, srv)) this.fecha = '';
      this.pintar();
    }
    const url = new URL(location.href);
    url.searchParams.set('servicio', srv.id);
    url.searchParams.delete('cancelado');
    history.replaceState(null, '', url);
  },

  error(msg) {
    const caja = $('#form-error');
    caja.innerHTML = msg;
    caja.hidden = !msg;
    if (msg) caja.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  },

  async validarCodigo() {
    const codigo = $('#codigo').value.trim();
    const msg = $('#codigo-msg');
    if (!codigo) {
      msg.textContent = '';
      return;
    }
    try {
      const res = await fetch(`${CONFIG.api}/api/validar-codigo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo })
      });
      const { valido } = await res.json();
      this.codigoValido = valido;
      msg.textContent = this.tx(valido ? 'codigoOk' : 'codigoKo');
      msg.className = `code-msg ${valido ? 'ok' : 'ko'}`;
    } catch {
      msg.textContent = this.tx('eRed');
      msg.className = 'code-msg ko';
    }
  },

  mensajeWhatsApp(srv, personas, nombre, notas) {
    const lineas = [`Hola, soy ${nombre}.`];
    if (srv.tipo === 'regalo') {
      lineas.push(`Quiero un bono regalo para ${personas} persona${personas > 1 ? 's' : ''}.`);
    } else {
      lineas.push(`Quería proponer un plan a medida para ${personas} persona${personas > 1 ? 's' : ''}.`);
      if (this.fecha) {
        const op = this.opcionElegida();
        const turno = op ? `, ${TURNOS[op.turnos[0]].es.toLowerCase()} (${Horario.rango(op.inicio, op.fin)})` : '';
        lineas.push(`Fecha: ${formatoFecha(this.fecha, { weekday: 'long', day: 'numeric', month: 'long' })}${turno}.`);
      }
    }
    if (notas) lineas.push(notas);
    if (Idioma.actual === 'en') lineas.push('(Escribo desde la web en inglés.)');
    return lineas.join('\n');
  },

  async enviar(e) {
    e.preventDefault();
    this.error('');
    const srv = this.servicio();
    const nombre = $('#nombre').value.trim();
    const personas = Number($('#personas').value);
    const notas = $('#notas').value.trim();

    if (!Number.isInteger(personas) || personas < 1 || personas > CONFIG.maxPersonas) return this.error(this.tx('ePersonas', CONFIG.maxPersonas));
    if (!nombre) return this.error(this.tx('eNombre'));

    if (!this.esPago()) {
      window.open(enlaceWhatsApp(this.mensajeWhatsApp(srv, personas, nombre, notas)), '_blank', 'noopener');
      return;
    }

    if (!this.fecha) return this.error(this.tx('eFecha'));
    if (!this.opcionElegida()) return this.error(this.tx('eTurno'));
    if (!$('#acepto').checked) return this.error(this.tx('eAcepto'));

    const boton = $('#enviar');
    const textoBoton = boton.textContent;
    boton.disabled = true;
    boton.textContent = this.tx('conectando');

    try {
      const res = await fetch(`${CONFIG.api}/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          servicio: srv.id,
          fecha: this.fecha,
          horario: this.eleccion,
          personas,
          nombre,
          notas,
          extras: $$('#extras input:checked').map(i => EXTRAS.find(x => x.id === i.value).es),
          codigo: $('#codigo').value.trim(),
          aceptaCondiciones: true,
          idioma: Idioma.actual
        })
      });
      const datos = await res.json().catch(() => ({}));
      if (res.ok && datos.url) {
        // Por si vuelve atrás desde Stripe sin pagar: así se suelta el hueco.
        try {
          sessionStorage.setItem('centuria_sesion', datos.sesion || '');
        } catch {
          /* nada */
        }
        location.href = datos.url;
        return;
      }
      if (res.status === 409) {
        // Alguien ha cogido el hueco: recargamos el mes para que se vea.
        this.fecha = '';
        this.eleccion = '';
        this.cargarMes(this.mesVisto, { forzar: true });
      }
      this.error(escapar(datos.error || this.tx('eRed')));
    } catch {
      this.error(`${this.tx('eRed')} <a href="${enlaceWhatsApp('Hola, quería reservar una salida en el Centuria.')}" target="_blank" rel="noopener">${this.tx('abrirWa')}</a>`);
    }
    boton.disabled = false;
    boton.textContent = textoBoton;
  },

  iniciar() {
    if (!$('#reserva')) return;

    this.pintarSelectorServicio();
    const params = new URLSearchParams(location.search);
    const pedido = params.get('servicio') || params.get('service');
    if (pedido && $(`#servicio option[value="${CSS.escape(pedido)}"]`)) $('#servicio').value = pedido;

    const hoy = new Date();
    this.mesVisto = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const srv = this.servicio();
    if (srv.tipo === 'evento') {
      this.fecha = srv.datos.fecha;
      const [y, m] = this.fecha.split('-').map(Number);
      this.mesVisto = new Date(y, m - 1, 1);
    }

    $('#servicio').addEventListener('change', () => this.alCambiarServicio());
    $('#mes-anterior').addEventListener('click', () => this.irAMes(new Date(this.mesVisto.getFullYear(), this.mesVisto.getMonth() - 1, 1)));
    $('#mes-siguiente').addEventListener('click', () => this.irAMes(new Date(this.mesVisto.getFullYear(), this.mesVisto.getMonth() + 1, 1)));
    $('#cal-dias').addEventListener('click', e => {
      const b = e.target.closest('button[data-fecha]');
      if (!b || b.disabled) return;
      this.fecha = b.dataset.fecha;
      this.eleccion = '';
      this.pintar();
      // En móvil el formulario queda debajo: lo acercamos.
      if (window.matchMedia('(max-width: 1000px)').matches) $('#bloque-fecha').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    $('#turnos').addEventListener('change', e => {
      if (e.target.name === 'horario') {
        this.eleccion = e.target.value;
        this.pintarHorarios();
        this.pintarResumen();
        const marcado = $('#turnos input:checked');
        if (marcado) marcado.focus();
      }
    });
    $('#personas').addEventListener('input', () => this.pintarResumen());
    $('#aplicar-codigo').addEventListener('click', () => this.validarCodigo());
    $('#extras').addEventListener('change', () => this.pintarAvisosExtras());
    $('#reserva').addEventListener('submit', e => this.enviar(e));

    Idioma.alCambiar.push(() => {
      this.pintarSelectorServicio();
      this.pintar();
    });

    this.listo = true;
    this.pintar();
    this.cargarMes(this.mesVisto).then(() => this.liberarSiVuelve());
  },

  // Si vuelve de Stripe sin pagar, se avisa al backend para soltar el hueco
  // (si no, queda retenido media hora y ni él mismo podría cogerlo).
  async liberarSiVuelve() {
    const params = new URLSearchParams(location.search);
    if (!params.has('cancelado')) return;
    let sesion = '';
    try {
      sesion = sessionStorage.getItem('centuria_sesion') || '';
      sessionStorage.removeItem('centuria_sesion');
    } catch {
      /* nada */
    }
    const url = new URL(location.href);
    url.searchParams.delete('cancelado');
    history.replaceState(null, '', url);
    if (!sesion) return;
    try {
      const res = await fetch(`${CONFIG.api}/api/liberar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sesion })
      });
      const { ok } = await res.json();
      if (!ok) return;
      this.meses.clear();
      await this.cargarMes(this.mesVisto, { forzar: true });
      const aviso = $('#cal-aviso');
      aviso.textContent = this.tx('liberado');
      aviso.hidden = false;
    } catch {
      /* si falla, el hueco se suelta solo en media hora */
    }
  }
};

document.addEventListener('DOMContentLoaded', () => Reservas.iniciar());
