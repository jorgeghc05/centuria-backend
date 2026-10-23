'use strict';

// ============================================================================
// PANEL DE GESTIÓN CENTRALIZADO (Fácil de editar tras enseñar la demo al dueño)
// ============================================================================
const CONFIG = {
  whatsapp: '34687549223',
  phone: '+34 687 549 223',
  maxPassengers: 6,
  giftValidityMonths: 6,
  harbor: 'Real Club El Candado (Málaga)'
};

let currentLang = localStorage.getItem('centuria_lang') || 'es';

const experiences = [
  {
    id: 'paseo',
    image: 'imagenes/centuria_mar.jpg',
    defaultSlotKey: 'morning',
    es: {
      name: 'Paseo privado por la costa',
      duration: '3–4 horas',
      price: 'Consultar',
      desc: 'Una escapada a tu ritmo para contemplar la costa de Málaga, fondear en aguas tranquilas y darte un baño lejos del bullicio.',
      tag: 'PARA DESCONECTAR'
    },
    en: {
      name: 'Private Coastal Cruise',
      duration: '3–4 hours',
      price: 'Ask for price',
      desc: 'A relaxing getaway at your own pace to admire the Malaga coastline, anchor in calm waters and enjoy a swim.',
      tag: 'UNWIND AT SEA'
    }
  },
  {
    id: 'atardecer',
    image: 'imagenes/atardecer_penyon_cuervo.jpg',
    defaultSlotKey: 'sunset',
    es: {
      name: 'Atardecer en el Mediterráneo',
      duration: '3 horas',
      price: 'Consultar',
      desc: 'Disfruta de la luz mágica de la puesta de sol frente al Peñón del Cuervo y la bahía de Málaga desde el agua.',
      tag: 'EL MÁS ESPECIAL'
    },
    en: {
      name: 'Mediterranean Sunset Cruise',
      duration: '3 hours',
      price: 'Ask for price',
      desc: 'Enjoy the magical golden hour light facing Peñón del Cuervo and the Bay of Malaga from the water.',
      tag: 'MOST POPULAR'
    }
  },
  {
    id: 'pesca',
    image: 'imagenes/centuria_cabina.jpeg',
    defaultSlotKey: 'morning',
    es: {
      name: 'Jornada de pesca con el patrón',
      duration: 'A convenir',
      price: 'Consultar',
      desc: 'Sal a pescar con quien conoce los fondos de la zona. Una mañana auténtica de pesca recreativa según condiciones y normativa.',
      tag: 'PARA LOS MÁS MARINEROS'
    },
    en: {
      name: 'Fishing Trip with the Skipper',
      duration: 'Flexible',
      price: 'Ask for price',
      desc: 'Go fishing with a local captain who knows the best spots. An authentic recreational fishing outing.',
      tag: 'FOR SEA LOVERS'
    }
  },
  {
    id: 'celebracion',
    image: 'imagenes/moet_centuria.jpeg',
    defaultSlotKey: 'afternoon',
    es: {
      name: 'Celebraciones privadas a bordo',
      duration: '4 horas',
      price: 'Consultar',
      desc: 'Cumpleaños, aniversarios o un brindis especial con tu grupo en total privacidad y siempre con un patrón al mando.',
      tag: 'CON TU GENTE'
    },
    en: {
      name: 'Private Celebrations on Board',
      duration: '4 hours',
      price: 'Ask for price',
      desc: 'Birthdays, anniversaries or a special toast with your group in total privacy with your own captain at the helm.',
      tag: 'WITH YOUR PEOPLE'
    }
  },
  {
    id: 'medio-dia',
    image: 'imagenes/chicas_tabla_centuria.jpg',
    defaultSlotKey: 'morning',
    es: {
      name: 'Mañana o tarde de sol y baño',
      duration: '4 horas',
      price: 'Consultar',
      desc: 'Media jornada para navegar, fondear, disfrutar de la tabla de paddle surf, los flotadores y tomar el sol en cubierta.',
      tag: 'UNA ESCAPADA PERFECTA'
    },
    en: {
      name: 'Half-Day Sun & Swim Charter',
      duration: '4 hours',
      price: 'Ask for price',
      desc: 'Four hours to sail, anchor in clear waters, enjoy the stand-up paddleboard, floats and sunbathe on deck.',
      tag: 'PERFECT GETAWAY'
    }
  },
  {
    id: 'dia',
    image: 'imagenes/cascada_maro.jpg',
    defaultSlotKey: 'fullday',
    es: {
      name: 'Día completo rumbo a Maro',
      duration: '8 horas',
      price: 'Consultar',
      desc: 'Dedica el día entero a descubrir los acantilados y la cascada de Maro sin prisas, organizando la ruta junto al patrón.',
      tag: 'EXPERIENCIA ESTRELLA · SIN PRISAS'
    },
    en: {
      name: 'Full-Day Charter to Maro Cliffs',
      duration: '8 hours',
      price: 'Ask for price',
      desc: 'Spend a full day discovering the cliffs and waterfall of Maro at an unhurried pace, planning the route with the skipper.',
      tag: 'SIGNATURE FULL DAY'
    }
  }
];

const TIME_SLOTS = [
  {
    key: 'morning',
    es: 'Mañana (aprox. 10:00 - 14:00)',
    en: 'Morning (approx. 10:00 - 14:00)'
  },
  {
    key: 'afternoon',
    es: 'Tarde (aprox. 15:00 - 19:00)',
    en: 'Afternoon (approx. 15:00 - 19:00)'
  },
  {
    key: 'sunset',
    es: 'Puesta de sol (Atardecer)',
    en: 'Sunset Cruise (Golden Hour)'
  },
  {
    key: 'fullday',
    es: 'Día completo (8 horas)',
    en: 'Full Day (8 hours)'
  },
  {
    key: 'gift_open',
    es: 'Bono Regalo · Fecha abierta (Validez 6 meses)',
    en: 'Gift Voucher · Open Date (Valid for 6 months)'
  },
  {
    key: 'flexible',
    es: 'Flexible / A convenir con el patrón',
    en: 'Flexible / To be arranged with the skipper'
  }
];

const reviews = [
  {
    stars: '★★★★★',
    es: {
      author: 'Familia Gómez · Madrid',
      trip: 'Día completo rumbo a Maro',
      text: 'Se nota muchísimo cuando el barco es del propio patrón y no de una empresa de alquiler masivo. Nos llevó a calas preciosas, estuvo pendiente de los niños en todo momento y el barco está impecable.'
    },
    en: {
      author: 'Gómez Family · Madrid',
      trip: 'Full-Day Charter to Maro',
      text: 'You can really tell the difference when the boat belongs to the captain himself rather than a massive rental agency. He took us to gorgeous coves, looked after the kids and the boat is spotless.'
    }
  },
  {
    stars: '★★★★★',
    es: {
      author: 'Laura y amigos · Málaga',
      trip: 'Atardecer en el Mediterráneo',
      text: 'Regalamos una tarjeta regalo por un cumpleaños y fue un acierto total. Ver ponerse el sol detrás de Málaga bañándonos junto al Peñón del Cuervo fue inolvidable. Repetiremos seguro.'
    },
    en: {
      author: 'Laura & friends · Málaga',
      trip: 'Mediterranean Sunset Cruise',
      text: 'We bought a gift voucher for a birthday and it was a huge hit. Watching the sun set behind Malaga while swimming near Peñón del Cuervo was unforgettable.'
    }
  },
  {
    stars: '★★★★★',
    es: {
      author: 'Carlos M. · Córdoba',
      trip: 'Jornada de pesca y paseo',
      text: 'Un trato de diez, cercano y auténtico. El patrón conoce la costa como la palma de su mano, nos enseñó rincones increíbles y pasamos una mañana de mar espectacular.'
    },
    en: {
      author: 'Carlos M. · Córdoba',
      trip: 'Fishing & Coastal Cruise',
      text: 'Ten out of ten service, warm and authentic. The skipper knows the coast like the back of his hand, showed us incredible spots and we had an amazing morning at sea.'
    }
  }
];

// ============================================================================
// DICCIONARIO BILINGÜE (ES / EN)
// ============================================================================
const I18N = {
  es: {
    demoBanner: 'VERSIÓN DEMOSTRACIÓN · Precios, horarios y disponibilidad sujetos a confirmación del patrón',
    brandSub: 'MÁLAGA · COSTA DEL SOL',
    navServices: 'Servicios',
    navBoat: 'El barco y el patrón',
    navAvail: 'Disponibilidad',
    navContact: 'Contacto y reseñas',
    navCta: 'Consultar fecha →',
    heroEyebrow: 'REAL CLUB EL CANDADO · MÁLAGA · TRATO DIRECTO CON EL PATRÓN',
    heroTitle: 'El Mediterráneo<br/>se vive <em>desde dentro.</em>',
    heroDesc: 'Escápate de las rutas masificadas. Navega por la costa de Málaga en un barco privado cuidado al detalle por su propio capitán, solo para tu grupo y a vuestro ritmo.',
    heroBtn1: 'Explorar experiencias <span>↓</span>',
    heroBtnGift: '🎁 Regalar una salida →',
    trust1: '✦ Patrón propietario a bordo',
    trust2: '✦ Un único barco · 100% privado',
    trust3: '✦ Salidas desde El Candado (Málaga)',
    trust4: '✦ Sin intermediarios ni agencias',
    introEyebrow: 'AUTENTICIDAD EN CADA MILLA',
    introTitle: 'Un barco con alma. Mil maneras de <em>disfrutar.</em>',
    introDesc: 'Aquí no alquilas un barco de una flota impersonal. Subes a bordo del <strong>Centuria</strong> de la mano de su propio dueño y patrón: décadas de experiencia marinera en la bahía de Málaga para llevarte a las calas más tranquilas, fondear con seguridad y hacerte sentir como en casa.',
    strip1Title: 'Trato humano y cercano',
    strip1Desc: 'Hablas y reservas directamente con quien lleva el timón. Sin plataformas automáticas ni recargos ocultos.',
    strip2Title: 'Exclusividad real',
    strip2Desc: 'Un solo barco mimado al detalle. Nunca compartirás cubierta con desconocidos; el mar es para vosotros.',
    strip3Title: 'Sabiduría local',
    strip3Desc: 'Conocemos cada viento, cada fondeadero en el Peñón del Cuervo y los mejores rincones hacia los acantilados de Maro.',
    expEyebrow: 'ELIGE TU PLAN A BORDO',
    expTitle: 'Experiencias para recordar.',
    expDesc: 'Salidas privadas diseñadas a medida. Elige tu experiencia favorita y pulsa en consultar para comprobar tu fecha directamente con nosotros.',
    cardSkipper: '⚓ Patrón incluido',
    cardPrivate: '♧ Grupo privado',
    cardBtn: 'Consultar fecha ↗',
    incEyebrow: 'TRANSPARENCIA TOTAL · SIN SORPRESAS EN EL PUERTO',
    incTitle: '¿Qué incluye siempre tu salida privada?',
    inc1: '<strong>Patrón profesional</strong> durante toda la travesía',
    inc2: '<strong>Barco 100% exclusivo</strong> para tu grupo (máx. 6 personas)',
    inc3: '<strong>Tabla de Paddle Surf y flotadores</strong> para el baño',
    inc4: '<strong>Amarre en Real Club El Candado</strong> y seguros obligatorios',
    customTitle: '¿Tienes otro plan en mente?',
    customDesc: 'Como es nuestro propio barco, nos adaptamos a lo que busques: pedidas de mano, sesiones de fotos, rutas personalizadas o combinación de pesca y baño.',
    customBtn: 'Proponer mi propio plan ↗',
    pricingNote: 'Los detalles mostrados son orientativos para la demo y deben validarse con el propietario, incluidos impuestos y condiciones de navegación antes de publicar.',
    giftEyebrow: 'EL REGALO MÁS ORIGINAL EN MÁLAGA',
    giftTitle: 'Regala el mar con nuestra <em>Tarjeta Regalo.</em>',
    giftDesc: 'Sorprende en un cumpleaños, aniversario, Navidad o celebración especial con una salida privada a bordo del Centuria. Compra hoy el bono con fecha abierta y quien lo reciba podrá elegir el día que prefiera para navegar.',
    giftFeat1: '<strong>⏳ Validez de 6 meses:</strong> Caduca a los 6 meses desde la fecha de emisión para disfrutarlo con total flexibilidad.',
    giftFeat2: '<strong>📅 Fecha abierta:</strong> No necesitas saber qué día saldrán al mar en el momento de hacer el regalo.',
    giftFeat3: '<strong>✉️ Bono personalizado:</strong> Te preparamos el bono regalo con el nombre de la persona homenajeada y la experiencia elegida.',
    giftBtn: 'Solicitar Tarjeta Regalo (6 meses) ↗',
    voucherLabel: 'BONO REGALO OFICIAL · FECHA ABIERTA',
    voucherFor: 'VALE POR UNA EXPERIENCIA PRIVADA EN BARCO CON PATRÓN',
    voucherExp: 'Paseo Privado / Puesta de Sol en Málaga',
    voucherNote: 'Exclusivo para tu grupo (hasta 6 personas) · Salida desde Real Club El Candado',
    voucherValLabel: 'CADUCIDAD DEL BONO',
    voucherValValue: '6 meses desde su emisión',
    voucherStamp: 'VÁLIDO 6 MESES',
    routesEyebrow: 'NUESTRA ZONA DE NAVEGACIÓN',
    routesTitle: 'Rutas con salida desde <em>El Candado.</em>',
    routesDesc: 'Nuestra ubicación al este de Málaga nos permite llegar rápido a las aguas más limpias y tranquilas de la costa.',
    route1Tag: 'RUTA OESTE · BAHÍA (A 10 MIN DE PUERTO)',
    route1Title: 'Peñón del Cuervo, Baños del Carmen y Bahía de Málaga',
    route1Desc: 'Ideal para salidas de 3 a 4 horas y puestas de sol. Fondeo frente a la emblemática roca del Peñón del Cuervo, baño tranquilo y vistas panorámicas del skyline de Málaga iluminado al atardecer.',
    route1Link: 'Consultar para atardecer →',
    route2Tag: 'RUTA ESTE · NATURALEZA Y ACANTILADOS',
    route2Title: 'Calas de La Araña, Rincón de la Victoria y Cascada de Maro',
    route2Desc: 'Nuestra opción estrella para jornadas de día completo o medio día largo. Navegación hacia aguas cristalinas y cascadas naturales donde solo se puede acceder cómodamente desde el mar.',
    route2Link: 'Consultar día completo →',
    boatPageEyebrow: 'TRADICIÓN MARINERA Y CONFORT A BORDO',
    boatPageTitle: 'El barco, el patrón y galería',
    boatPhotoCredit: 'Cabina y puente de mando · Centuria',
    storyEyebrow: 'EL BARCO · EL PATRÓN · TU EXPERIENCIA',
    storyTitle: 'La tranquilidad de navegar con quien ama <em>su propio barco.</em>',
    storyDesc: 'El <strong>Centuria</strong> no es un barco de alquiler masivo: es la embarcación personal de su patrón, cuidada con mimo durante todo el año en el Real Club El Candado. Esa diferencia se nota desde el primer minuto en que pisas la cubierta.',
    feat1Title: 'Experiencia y seguridad al timón',
    feat1Desc: 'Tu patrón conoce cada rincón de la costa malagueña. Tú solo te preocupas de relajarte, bañarte y disfrutar del mar.',
    feat2Title: 'Solo para vuestro grupo (hasta 6 personas)',
    feat2Desc: 'Privacidad total en un ambiente familiar y acogedor, sin compartir espacio con desconocidos.',
    feat3Title: 'El ritmo lo marcáis vosotros',
    feat3Desc: '¿Queréis parar más tiempo a bañaros con la tabla o el flotador, brindar al sol o echar las cañas? Adaptamos la salida sobre la marcha.',
    storyBtn1: 'Ver fechas disponibles →',
    storyBtnGift: '🎁 Regalar esta experiencia (6 meses) ↗',
    specsEyebrow: 'EQUIPAMIENTO Y COMODIDAD',
    specsTitle: 'Todo listo a bordo del <em>Centuria.</em>',
    specsDesc: 'Una embarcación estable, marinera y perfectamente equipada para pasar desde unas horas hasta el día entero en el mar.',
    spec1Label: 'CAPACIDAD',
    spec1Title: 'Hasta 6 pasajeros + Patrón',
    spec1Desc: 'Espacio cómodo tanto en bañera exterior como en proa para que todo el grupo disfrute con amplitud.',
    spec2Label: 'CONFORT EN CUBIERTA',
    spec2Title: 'Zona de sol y sombra (Toldo)',
    spec2Desc: 'Cabina resguardada, asientos exteriores acolchados y zona para tomar el sol o resguardarse en las horas centrales.',
    spec3Label: 'DIVERSIÓN EN EL AGUA',
    spec3Title: 'Baño, tabla de paddle y flotadores',
    spec3Desc: 'Escalera de baño cómoda para subir a bordo tras fondear en calas de agua limpia.',
    spec4Label: 'SEGURIDAD Y PUERTO BASE',
    spec4Title: 'Real Club El Candado (Málaga)',
    spec4Desc: 'Despacho en regla, chalecos homologados para todas las edades y electrónica de navegación completa.',
    galEyebrow: 'UN ADELANTO DE LO QUE TE ESPERA',
    galTitle: 'Momentos reales que <em>saben a mar.</em>',
    galDesc: 'Haz clic en cualquier fotografía para ampliarla. Imágenes auténticas de nuestras salidas por Málaga y Maro.',
    galCap1: 'La costa y Maro desde otra perspectiva',
    galCap2: 'Momentos para compartir',
    galCap3: 'Tu propio ritmo en el agua',
    galCap4: 'Recuerdos que duran mucho más que el verano',
    galCap5: 'Navegación tranquila por la bahía',
    galCap6: 'Celebraciones y brindis a bordo',
    availPageEyebrow: 'RESERVA FÁCIL Y SIN INTERMEDIARIOS',
    availPageTitle: 'Disponibilidad y Tarjeta Regalo',
    bookEyebrow: 'PLANIFICA TU ESCAPADA EN 1 MINUTO',
    bookTitle: 'Elige tu fecha. <em>Nosotros ponemos el mar.</em>',
    bookDesc: 'Selecciona el día en el calendario (o elige la opción de Tarjeta Regalo con fecha abierta y validez de 6 meses) y envíanos tu consulta directa por WhatsApp.',
    step1Title: '1. Elige fecha o Bono Regalo',
    step1Desc: 'Toca un día o selecciona Tarjeta Regalo (6 meses)',
    step2Title: '2. Personaliza tu plan',
    step2Desc: 'Experiencia, horario y número de personas',
    step3Title: '3. Confirmación con el patrón',
    step3Desc: 'Te respondemos personalmente por WhatsApp',
    calNote: '○ Fecha seleccionable &nbsp; ● Tu fecha elegida<br/>Al tratarse de un único barco exclusivo, confirmamos cada horario personalmente con el patrón antes de zarpar.',
    weatherTitle: 'Garantía de Buena Mar:',
    weatherDesc: 'El patrón revisa el parte oficial antes de cada salida. Si el tiempo no permite navegar con seguridad, cambiamos de fecha sin ningún coste.',
    formBadgeDefault: 'Solicitud directa sin compromiso',
    formHeading: 'Tu próxima aventura',
    labelService: 'Experiencia o Tarjeta Regalo',
    giftBannerTitle: '🎁 Modalidad Tarjeta Regalo activada (Caducidad: 6 meses)',
    giftBannerDesc: 'Puedes indicar la fecha en que quieres entregar el regalo o una fecha orientativa. El bono tendrá una validez de 6 meses desde su emisión con fecha abierta para navegar.',
    labelDate: 'Fecha deseada',
    labelDateGift: 'Fecha de entrega del regalo (u orientativa)',
    labelSlot: 'Horario o modalidad',
    labelPeople: 'Personas (máx. 6)',
    labelName: 'Tu nombre',
    placeholderName: '¿Cómo te llamas?',
    labelNotes: 'Cuéntanos tu idea o para quién es el regalo (opcional)',
    placeholderNotes: '¿Celebráis un cumpleaños, es para una Tarjeta Regalo (nombre del destinatario), os apetece ir a Maro?',
    formSubmit: 'Consultar por WhatsApp ↗',
    formNote: 'Se abrirá WhatsApp con tu solicitud lista para enviar al patrón. No se realiza ningún cobro automático en la web.',
    optGift: '🎁 Tarjeta Regalo con fecha abierta (Caduca a los 6 meses)',
    optCustom: '✨ Plan personalizado a medida',
    faqEyebrow: 'TODO CLARO ANTES DE ZARPAR',
    faqTitle: 'Preguntas frecuentes.',
    faqDesc: 'Resolvemos las dudas más habituales para que vengáis al puerto con total tranquilidad.',
    faq1Q: '¿Necesito tener licencia o experiencia para navegar?',
    faq1A: 'En absoluto. Todas las salidas se realizan con el patrón propietario a bordo. No tienes que preocuparte por maniobras, fondeos ni fianzas de alquiler; solo de disfrutar del mar.',
    faqGiftQ: '¿Cómo funciona la Tarjeta Regalo y cuándo caduca?',
    faqGiftA: 'Es muy sencillo: nos solicitas el bono por WhatsApp indicando el nombre de la persona afortunada y la experiencia que quieres regalar. La Tarjeta Regalo tiene una caducidad de 6 meses desde su fecha de emisión y queda con fecha abierta para que quien la reciba reserve el día que mejor le venga.',
    faq2Q: '¿Cuántas personas pueden venir y el barco es privado?',
    faq2A: 'Sí, la salida es 100% privada para vuestro grupo (nunca mezclamos clientes). La capacidad autorizada en esta demostración es de hasta 6 pasajeros más el patrón.',
    faq3Q: '¿Dónde nos encontramos el día de la salida?',
    faq3A: 'Nuestro puerto base es el Real Club El Candado (Málaga Este). Al confirmar tu reserva te enviaremos la ubicación exacta de encuentro para recibirte en la entrada del pantalán.',
    faq4Q: '¿Qué pasa si hace mal tiempo o levanta viento?',
    faq4A: 'La seguridad y vuestra comodidad son lo primero. El patrón revisa el parte meteorológico antes de cada salida; si las condiciones del mar no permiten disfrutar con seguridad, cambiamos la fecha o acordamos la mejor alternativa sin compromiso.',
    faq5Q: '¿Puedo llevar nuestra propia comida y bebida?',
    faq5A: 'Por supuesto. Podéis traer vuestros aperitivos, bebidas y hielo para disfrutar a bordo. Consúltanos al reservar para indicarte el espacio disponible en nevera y las recomendaciones para navegar cómodos.',
    contactPageEyebrow: 'ATENCIÓN PERSONALIZADA Y CERCANA',
    contactPageTitle: 'Contacto, puerto base y reseñas',
    contactEyebrow: '¿LISTO PARA SOLTAR AMARRAS?',
    contactTitle: 'Tu próxima aventura <em>empieza con un mensaje.</em>',
    contactDesc: 'Cuéntanos qué día tenéis pensado venir, cuántos sois o si quieres encargar una Tarjeta Regalo (validez de 6 meses). Te responderemos personalmente para organizarlo todo.',
    contactBtnWa: 'Hablar por WhatsApp ↗',
    contactBtnCal: 'Elegir fecha en calendario →',
    contactHarborLabel: 'PUERTO BASE DE SALIDA',
    contactHarborSub: 'A solo 15 minutos del centro de Málaga y junto al Peñón del Cuervo.',
    contactPhoneLabel: 'TELÉFONO Y WHATSAPP',
    contactModeLabel: 'MODALIDAD DE RESERVA',
    contactModeSub: 'Atención directa con el patrón. Ubicación exacta de embarque y condiciones sujetas a confirmación previa.',
    harborEyebrow: 'PUNTO DE ENCUENTRO',
    harborTitle: 'Cómo llegar al Puerto Deportivo El Candado',
    harborDesc: 'Salir desde el <strong>Real Club El Candado</strong> tiene una gran ventaja: nada más abandonar la bocana del puerto ya estás frente a las calas del Peñón del Cuervo y La Araña, sin perder tiempo saliendo de grandes puertos comerciales.',
    harborCar: '<strong>En coche o taxi/VTC:</strong> Acceso directo desde la A-7 o la N-340 (salida El Candado), con zonas de aparcamiento en los alrededores del club náutico.',
    harborBus: '<strong>En autobús urbano (EMT):</strong> Líneas 3 y 11 desde el centro de Málaga y Paseo del Parque con parada justo frente al acceso de El Candado.',
    harborCoordLabel: 'COORDENADAS NÁUTICAS',
    harborMapsBtn: 'Abrir ubicación en Google Maps ↗',
    revEyebrow: 'LA EXPERIENCIA DE NUESTROS INVITADOS',
    revTitle: 'Lo que dicen al <em>volver a puerto.</em>',
    revDesc: 'Muestra de reseñas para la versión demostración (personalizables con las opiniones reales de clientes).',
    footerSub: 'Experiencias náuticas privadas con patrón en Málaga · Puerto El Candado',
    backTop: 'Volver arriba ↑',
    footerDisclaimer: 'Sitio de demostración no oficial. No introducir pagos ni considerar confirmada una reserva. Fotografías del proyecto, pendientes de revisión.',
    waFloating: 'Hablar con nosotros',
    weekdays: ['L', 'M', 'X', 'J', 'V', 'S', 'D']
  },
  en: {
    demoBanner: 'DEMO VERSION · Prices, schedules and availability subject to skipper confirmation',
    brandSub: 'MALAGA · COSTA DEL SOL',
    navServices: 'Experiences',
    navBoat: 'The Boat & Skipper',
    navAvail: 'Availability',
    navContact: 'Contact & Reviews',
    navCta: 'Check dates →',
    heroEyebrow: 'REAL CLUB EL CANDADO · MALAGA · DIRECT WITH THE CAPTAIN',
    heroTitle: 'Experience the Mediterranean <em>from within.</em>',
    heroDesc: 'Escape the crowded tourist boats. Sail the Malaga coastline on a private boat lovingly maintained by its own captain, exclusively for your group and at your own pace.',
    heroBtn1: 'Explore experiences <span>↓</span>',
    heroBtnGift: '🎁 Gift a Boat Trip →',
    trust1: '✦ Owner-skipper on board',
    trust2: '✦ Single boat · 100% private',
    trust3: '✦ Departing from El Candado (Malaga)',
    trust4: '✦ No middlemen or agency fees',
    introEyebrow: 'AUTHENTICITY IN EVERY MILE',
    introTitle: 'A boat with soul. A thousand ways <em>to enjoy.</em>',
    introDesc: 'Here you are not renting from an impersonal fleet. You step aboard the <strong>Centuria</strong> with her own owner and skipper: decades of seamanship in the Bay of Malaga to take you to the calmest coves, anchor safely and make you feel at home.',
    strip1Title: 'Warm, personal service',
    strip1Desc: 'You talk and book directly with the captain at the helm. No automated platforms or hidden fees.',
    strip2Title: 'True exclusivity',
    strip2Desc: 'One single boat cared for in every detail. You will never share the deck with strangers; the sea is yours.',
    strip3Title: 'Local knowledge',
    strip3Desc: 'We know every wind, every anchorage at Peñón del Cuervo and the best secret corners towards the Maro cliffs.',
    expEyebrow: 'CHOOSE YOUR PLAN ON BOARD',
    expTitle: 'Unforgettable sea experiences.',
    expDesc: 'Tailor-made private charters. Choose your favourite experience and click to check your date directly with us.',
    cardSkipper: '⚓ Skipper included',
    cardPrivate: '♧ Private group',
    cardBtn: 'Check date ↗',
    incEyebrow: 'TOTAL TRANSPARENCY · NO SURPRISES AT THE MARINA',
    incTitle: 'What is always included in your private trip?',
    inc1: '<strong>Professional captain</strong> throughout the entire trip',
    inc2: '<strong>100% exclusive boat</strong> for your group (up to 6 guests)',
    inc3: '<strong>Stand-Up Paddleboard & floats</strong> for swimming stops',
    inc4: '<strong>Mooring at Real Club El Candado</strong> & full insurance',
    customTitle: 'Have another plan in mind?',
    customDesc: 'Because it is our own boat, we adapt to what you are looking for: proposals, photo shoots, custom routes or a mix of fishing and swimming.',
    customBtn: 'Propose my own plan ↗',
    pricingNote: 'Details shown are indicative for this demo and must be validated with the owner, including taxes and sailing conditions prior to publishing.',
    giftEyebrow: 'THE MOST ORIGINAL GIFT IN MALAGA',
    giftTitle: 'Gift the sea with our <em>Gift Voucher.</em>',
    giftDesc: 'Surprise someone on a birthday, anniversary, Christmas or special occasion with a private trip aboard the Centuria. Get an open-date voucher today and let them choose when to sail.',
    giftFeat1: '<strong>⏳ Valid for 6 months:</strong> Expires 6 months from the issue date so they can enjoy it with complete flexibility.',
    giftFeat2: '<strong>📅 Open date:</strong> You do not need to pick the exact sailing day when purchasing the gift.',
    giftFeat3: '<strong>✉️ Personalised voucher:</strong> We prepare the gift card with the recipient’s name and chosen experience.',
    giftBtn: 'Request Gift Voucher (6 months) ↗',
    voucherLabel: 'OFFICIAL GIFT VOUCHER · OPEN DATE',
    voucherFor: 'GOOD FOR A PRIVATE BOAT EXPERIENCE WITH SKIPPER',
    voucherExp: 'Private Cruise / Sunset Trip in Malaga',
    voucherNote: 'Exclusive for your group (up to 6 guests) · Departing from Real Club El Candado',
    voucherValLabel: 'VOUCHER EXPIRY',
    voucherValValue: '6 months from issue date',
    voucherStamp: 'VALID 6 MONTHS',
    routesEyebrow: 'OUR SAILING AREA',
    routesTitle: 'Routes departing from <em>El Candado.</em>',
    routesDesc: 'Our marina in eastern Malaga lets us quickly reach the cleanest and calmest waters on the coast.',
    route1Tag: 'WEST ROUTE · BAY (10 MIN FROM PORT)',
    route1Title: 'Peñón del Cuervo, Baños del Carmen & Malaga Bay',
    route1Desc: 'Ideal for 3–4 hour trips and sunset cruises. Anchor opposite the iconic Peñón del Cuervo rock, enjoy a quiet swim and take in panoramic views of the Malaga skyline at dusk.',
    route1Link: 'Check sunset availability →',
    route2Tag: 'EAST ROUTE · NATURE & CLIFFS',
    route2Title: 'La Araña Coves, Rincón de la Victoria & Maro Waterfall',
    route2Desc: 'Our star option for full-day or extended half-day charters. Sail east towards crystal-clear waters and natural waterfalls best reached from the sea.',
    route2Link: 'Check full-day availability →',
    boatPageEyebrow: 'SEAFARING TRADITION & ON-BOARD COMFORT',
    boatPageTitle: 'The boat, the skipper & gallery',
    boatPhotoCredit: 'Cabin & helm station · Centuria',
    storyEyebrow: 'THE BOAT · THE SKIPPER · YOUR EXPERIENCE',
    storyTitle: 'The peace of mind of sailing with someone who loves <em>his own boat.</em>',
    storyDesc: 'The <strong>Centuria</strong> is not a mass-market rental boat: she is the personal vessel of her skipper, lovingly looked after all year round at Real Club El Candado. You feel that difference the moment you step on deck.',
    feat1Title: 'Experience and safety at the helm',
    feat1Desc: 'Your captain knows every corner of the Malaga coast. All you have to do is relax, swim and enjoy the sea.',
    feat2Title: 'Just for your group (up to 6 guests)',
    feat2Desc: 'Complete privacy in a warm, welcoming atmosphere without sharing space with strangers.',
    feat3Title: 'You set the pace',
    feat3Desc: 'Want more time to swim with the paddleboard or float, toast in the sun or cast a fishing line? We adapt on the go.',
    storyBtn1: 'Check available dates →',
    storyBtnGift: '🎁 Gift this experience (6 months) ↗',
    specsEyebrow: 'EQUIPMENT & COMFORT',
    specsTitle: 'Everything ready aboard the <em>Centuria.</em>',
    specsDesc: 'A stable, seaworthy boat fully equipped to spend anything from a few hours to a full day at sea.',
    spec1Label: 'CAPACITY',
    spec1Title: 'Up to 6 guests + Skipper',
    spec1Desc: 'Comfortable space both in the aft cockpit and on the bow so your whole group can relax.',
    spec2Label: 'DECK COMFORT',
    spec2Title: 'Sun & shade area (Bimini top)',
    spec2Desc: 'Sheltered cabin, cushioned outdoor seating and space to sunbathe or relax in the shade.',
    spec3Label: 'FUN IN THE WATER',
    spec3Title: 'Swimming, SUP board & floats',
    spec3Desc: 'Convenient swim ladder to climb back aboard after anchoring in clear coves.',
    spec4Label: 'SAFETY & HOME PORT',
    spec4Title: 'Real Club El Candado (Malaga)',
    spec4Desc: 'Fully licensed, approved lifejackets for all ages and complete navigation electronics.',
    galEyebrow: 'A PREVIEW OF WHAT AWAITS YOU',
    galTitle: 'Real moments that <em>taste like the sea.</em>',
    galDesc: 'Click any photo to enlarge. Authentic pictures from our outings along Malaga and Maro.',
    galCap1: 'The coast and Maro from another perspective',
    galCap2: 'Moments to share together',
    galCap3: 'Your own pace on the water',
    galCap4: 'Memories that last much longer than summer',
    galCap5: 'Calm sailing across the bay',
    galCap6: 'Private celebrations and toasts on board',
    availPageEyebrow: 'EASY BOOKING WITH NO MIDDLEMEN',
    availPageTitle: 'Availability & Gift Voucher',
    bookEyebrow: 'PLAN YOUR GETAWAY IN 1 MINUTE',
    bookTitle: 'Pick your date. <em>We bring the sea.</em>',
    bookDesc: 'Select a day on the calendar (or choose the open-date Gift Voucher valid for 6 months) and send us your direct enquiry via WhatsApp.',
    step1Title: '1. Pick a date or Gift Card',
    step1Desc: 'Tap a day or select Gift Voucher (6 months)',
    step2Title: '2. Customise your plan',
    step2Desc: 'Experience, time slot and group size',
    step3Title: '3. Captain’s confirmation',
    step3Desc: 'We reply personally on WhatsApp',
    calNote: '○ Selectable date &nbsp; ● Your chosen date<br/>Because we operate a single exclusive boat, we confirm every schedule personally with the skipper before setting sail.',
    weatherTitle: 'Good Weather Guarantee:',
    weatherDesc: 'The captain checks the official marine forecast before every trip. If conditions are not safe to enjoy, we reschedule at no extra cost.',
    formBadgeDefault: 'Direct no-obligation enquiry',
    formHeading: 'Your next adventure',
    labelService: 'Experience or Gift Voucher',
    giftBannerTitle: '🎁 Gift Voucher mode active (Valid for 6 months)',
    giftBannerDesc: 'You can select the date when you plan to give the gift (or any approximate date). The voucher will be valid for 6 months from issue with an open sailing date.',
    labelDate: 'Desired date',
    labelDateGift: 'Gift delivery or approximate date',
    labelSlot: 'Preferred time or mode',
    labelPeople: 'Guests (max. 6)',
    labelName: 'Your name',
    placeholderName: 'What is your name?',
    labelNotes: 'Tell us your plan or who the gift is for (optional)',
    placeholderNotes: 'Celebrating a birthday, buying a Gift Voucher (recipient name), or keen on sailing to Maro?',
    formSubmit: 'Enquire via WhatsApp ↗',
    formNote: 'WhatsApp will open with your message ready to send to the skipper (automatically formatted in Spanish/English). No online payment is taken.',
    optGift: '🎁 Open-Date Gift Voucher (Expires in 6 months)',
    optCustom: '✨ Custom Tailor-Made Plan',
    faqEyebrow: 'EVERYTHING CLEAR BEFORE SETTING SAIL',
    faqTitle: 'Frequently asked questions.',
    faqDesc: 'Answers to the most common questions so you arrive at the marina with total peace of mind.',
    faq1Q: 'Do I need a boat licence or sailing experience?',
    faq1A: 'Not at all. Every trip includes our owner-skipper on board. You do not need to worry about manoeuvres, anchoring or security deposits—just enjoy the sea.',
    faqGiftQ: 'How does the Gift Voucher work and when does it expire?',
    faqGiftA: 'Simply request the voucher via WhatsApp letting us know the recipient’s name and the experience you wish to gift. The Gift Voucher is valid for 6 months from the issue date and comes with an open date so the recipient can book whenever suits them best.',
    faq2Q: 'How many people can come and is the boat private?',
    faq2A: 'Yes, every outing is 100% private for your group (we never mix strangers). Maximum authorised capacity in this demo is up to 6 guests plus the skipper.',
    faq3Q: 'Where do we meet on the day of the trip?',
    faq3A: 'Our home port is Real Club El Candado (East Malaga). Upon confirming your booking we will send the exact meeting point to welcome you at the pontoon gate.',
    faq4Q: 'What happens if the weather is bad or windy?',
    faq4A: 'Safety and comfort come first. The skipper checks the marine forecast before every trip; if sea conditions are not suitable, we change the date or agree on the best alternative.',
    faq5Q: 'Can we bring our own food and drinks?',
    faq5A: 'Of course. You are welcome to bring snacks, drinks and ice to enjoy on board. Ask us when booking so we can advise on cooler space and tips.',
    contactPageEyebrow: 'PERSONAL & FRIENDLY SERVICE',
    contactPageTitle: 'Contact, home port & reviews',
    contactEyebrow: 'READY TO CAST OFF?',
    contactTitle: 'Your next adventure <em>starts with a message.</em>',
    contactDesc: 'Tell us which day you would like to come, how many you are, or if you want to order a Gift Voucher (valid for 6 months). We will reply personally.',
    contactBtnWa: 'Chat on WhatsApp ↗',
    contactBtnCal: 'Pick a date on the calendar →',
    contactHarborLabel: 'DEPARTURE HOME PORT',
    contactHarborSub: 'Just 15 minutes from Malaga city centre, right next to Peñón del Cuervo.',
    contactPhoneLabel: 'PHONE & WHATSAPP',
    contactModeLabel: 'BOOKING METHOD',
    contactModeSub: 'Direct contact with the skipper. Exact boarding point and conditions subject to prior confirmation.',
    harborEyebrow: 'MEETING POINT',
    harborTitle: 'How to get to El Candado Marina',
    harborDesc: 'Departing from <strong>Real Club El Candado</strong> is a huge advantage: as soon as you leave the harbour mouth you are right in front of Peñón del Cuervo and La Araña coves, wasting zero time exiting busy commercial ports.',
    harborCar: '<strong>By car or taxi/Uber:</strong> Direct access from the A-7 or N-340 (El Candado exit), with parking areas around the yacht club.',
    harborBus: '<strong>By city bus (EMT):</strong> Lines 3 and 11 from Malaga city centre stop right outside the entrance to El Candado.',
    harborCoordLabel: 'NAUTICAL COORDINATES',
    harborMapsBtn: 'Open location in Google Maps ↗',
    revEyebrow: 'OUR GUESTS’ EXPERIENCE',
    revTitle: 'What they say when <em>returning to port.</em>',
    revDesc: 'Sample reviews for the demo version (customisable with real client feedback).',
    footerSub: 'Private boat experiences with skipper in Malaga · El Candado Marina',
    backTop: 'Back to top ↑',
    footerDisclaimer: 'Unofficial demonstration site. Do not enter payments or consider any booking confirmed. Project photos pending final review.',
    waFloating: 'Chat with us',
    weekdays: ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  }
};

const $ = id => document.getElementById(id);

const now = new Date();
now.setHours(0, 0, 0, 0);
let shown = new Date(now.getFullYear(), now.getMonth(), 1);
let selected = '';

const pad = n => String(n).padStart(2, '0');
const dateISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const formatSpanishDate = isoStr => {
  if (!isoStr) return 'Fecha abierta (Bono Regalo 6 meses)';
  const [y, m, d] = isoStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(dateObj);
};

// ============================================================================
// 1. COMPONENTES DINÁMICOS (TARJETAS, SELECTORES, RESEÑAS Y CALENDARIO)
// ============================================================================
function renderExperienceCards() {
  const container = $('experienceCards');
  if (!container) return;
  const dict = I18N[currentLang];
  container.innerHTML = experiences.map(e => {
    const t = e[currentLang];
    return `
      <article class="experience-card reveal visible">
        <a href="disponibilidad.html?service=${e.id}" class="card-image-link" aria-label="${t.name}">
          <div class="card-image" style="background-image:url('${e.image}')"></div>
        </a>
        <div class="card-content">
          <span class="card-top">${t.tag}</span>
          <h3>${t.name}</h3>
          <p>${t.desc}</p>
          <div class="card-meta">
            <span>◷ ${t.duration}</span>
            <span>${dict.cardSkipper}</span>
            <span>${dict.cardPrivate}</span>
          </div>
          <div class="card-bottom">
            <strong>${t.price}</strong>
            <a class="card-btn" href="disponibilidad.html?service=${e.id}">${dict.cardBtn}</a>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

function renderServiceAndSlotOptions() {
  const serviceSelect = $('service');
  const slotSelect = $('timeSlot');
  if (!serviceSelect || !slotSelect) return;

  const currentServiceVal = serviceSelect.value;
  const currentSlotVal = slotSelect.value;
  const dict = I18N[currentLang];

  serviceSelect.innerHTML =
    experiences.map(e => `<option value="${e.id}">${e[currentLang].name} (${e[currentLang].duration})</option>`).join('') +
    `<option value="regalo">${dict.optGift}</option>` +
    `<option value="personalizado">${dict.optCustom}</option>`;

  slotSelect.innerHTML = TIME_SLOTS.map(s => `<option value="${s.key}">${s[currentLang]}</option>`).join('');

  if (currentServiceVal && serviceSelect.querySelector(`option[value="${currentServiceVal}"]`)) {
    serviceSelect.value = currentServiceVal;
  }
  if (currentSlotVal && slotSelect.querySelector(`option[value="${currentSlotVal}"]`)) {
    slotSelect.value = currentSlotVal;
  }
}

function updateBookingFormUI() {
  const serviceSelect = $('service');
  if (!serviceSelect) return;
  const val = serviceSelect.value;
  const dict = I18N[currentLang];
  const isGift = val === 'regalo';
  const found = experiences.find(e => e.id === val);

  if ($('giftInfoBanner')) {$('giftInfoBanner').hidden = !isGift;
  }
  if ($('dateLabel')) {$('dateLabel').textContent = isGift ? dict.labelDateGift : dict.labelDate;
  }
  if ($('date')) {$('date').required = !isGift;
  }
  if (isGift && $('timeSlot')) {$('timeSlot').value = 'gift_open';
  } else if (found && $('timeSlot') && found.defaultSlotKey) {$('timeSlot').value = found.defaultSlotKey;
  }

  if ($('selectedServiceBadge')) {
    if (isGift) {
      $('selectedServiceBadge').textContent = dict.optGift;
      $('selectedServiceBadge').classList.add('highlighted');
    } else if (found) {
      $('selectedServiceBadge').textContent = `✦ ${found[currentLang].name}`;
      $('selectedServiceBadge').classList.add('highlighted');
    } else {
      $('selectedServiceBadge').textContent = dict.formBadgeDefault;
      $('selectedServiceBadge').classList.remove('highlighted');
    }
  }
}

function renderReviews() {
  const container = $('reviewsContainer');
  if (!container) return;
  container.innerHTML = reviews.map(r => {
    const t = r[currentLang];
    return `
      <article class="review-card">
        <div class="review-stars" aria-label="5 stars">${r.stars}</div>
        <span class="review-trip">${t.trip}</span>
        <p>“${t.text}”</p>
        <strong class="review-author">— ${t.author}</strong>
      </article>
    `;
  }).join('');
}

function renderCalendar() {
  if (!$('calendarDays')) return;
  const locale = currentLang === 'en' ? 'en-GB' : 'es-ES';
  const fmt = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' });
  $('monthTitle').textContent = fmt.format(shown);$('prevMonth').disabled = shown.getFullYear() === now.getFullYear() && shown.getMonth() === now.getMonth();

  if ($('calendarWeekdays')) {$('calendarWeekdays').innerHTML = I18N[currentLang].weekdays.map(w => `<span>${w}</span>`).join('');
  }

  const first = (shown.getDay() + 6) % 7;
  const count = new Date(shown.getFullYear(), shown.getMonth() + 1, 0).getDate();
  let html = '';
  for (let i = 0; i < first; i++) html += '<span></span>';
  for (let n = 1; n <= count; n++) {
    const d = new Date(shown.getFullYear(), shown.getMonth(), n);
    const iso = dateISO(d);
    const isSelected = selected === iso;
    html += `<button type="button" data-date="${iso}" class="${isSelected ? 'selected' : ''}" ${d < now ? 'disabled' : ''} aria-label="${n} ${fmt.format(shown)}" aria-pressed="${isSelected}">${n}</button>`;
  }
  $('calendarDays').innerHTML = html;
}

// ============================================================================
// 2. APLICACIÓN DE IDIOMA (ES / EN) EN TIEMPO REAL
// ============================================================================
function applyLanguage(lang) {
  currentLang = lang === 'en' ? 'en' : 'es';
  localStorage.setItem('centuria_lang', currentLang);
  document.documentElement.lang = currentLang;

  const dict = I18N[currentLang];
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (dict[key]) {
      el.innerHTML = dict[key];
    }
  });

  if ($('name'))$('name').placeholder = dict.placeholderName;
  if ($('notes'))$('notes').placeholder = dict.placeholderNotes;

  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === currentLang);
  });

  renderExperienceCards();
  renderServiceAndSlotOptions();
  updateBookingFormUI();
  renderReviews();
  renderCalendar();
}

document.querySelectorAll('.lang-btn').forEach(btn => {
  btn.addEventListener('click', () => applyLanguage(btn.dataset.lang));
});

// ============================================================================
// 3. INICIALIZACIÓN DE RESERVAS Y LECTURA DE PARÁMETROS URL (?service=...)
// ============================================================================
if ($('date'))$('date').min = dateISO(now);

applyLanguage(currentLang);

if ($('service')) {
  const params = new URLSearchParams(window.location.search);
  const requestedService = params.get('service');
  if (requestedService && $('service').querySelector(`option[value="${requestedService}"]`)) {
    $('service').value = requestedService;
    updateBookingFormUI();
  }
  $('service').addEventListener('change', updateBookingFormUI);
}

if ($('calendarDays')) {$('prevMonth').addEventListener('click', () => {
    shown = new Date(shown.getFullYear(), shown.getMonth() - 1, 1);
    renderCalendar();
  });

  $('nextMonth').addEventListener('click', () => {
    shown = new Date(shown.getFullYear(), shown.getMonth() + 1, 1);
    renderCalendar();
  });

  $('calendarDays').addEventListener('click', event => {
    const b = event.target.closest('button[data-date]');
    if (!b) return;
    selected = b.dataset.date;
    $('date').value = selected;
    renderCalendar();
  });

  $('date').addEventListener('change', () => {
    selected = $('date').value;
    if (selected) {
      const [y, m] = selected.split('-').map(Number);
      shown = new Date(y, m - 1, 1);
      renderCalendar();
    }
  });

  $('bookingForm').addEventListener('submit', event => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;

    const serviceVal = $('service').value;
    const isGift = serviceVal === 'regalo';
    const pax = Number($('people').value);
    if (!Number.isInteger(pax) || pax < 1 || pax > CONFIG.maxPassengers) {
      alert(
        currentLang === 'en'
          ? `Maximum capacity is ${CONFIG.maxPassengers} guests.`
          : `La capacidad máxima es de ${CONFIG.maxPassengers} personas.`
      );
      return;
    }

    const date = $('date').value;
    if (date && date < dateISO(now)) {
      alert(
        currentLang === 'en'
          ? 'Please select a future date.'
          : 'Por favor, selecciona una fecha a partir de hoy.'
      );
      return;
    }

    const name = $('name').value.trim();
    if (!name) return;

    const serviceObj = experiences.find(e => e.id === serviceVal);
    const serviceNameEs = isGift
      ? `🎁 TARJETA REGALO (Caducidad: ${CONFIG.giftValidityMonths} meses desde emisión)`
      : serviceObj
      ? serviceObj.es.name
      : 'Plan personalizado a medida';

    const slotObj = TIME_SLOTS.find(s => s.key === $('timeSlot').value);
    const slotEs = slotObj ? slotObj.es : 'A convenir';
    const note = $('notes').value.trim();
    const readableDateEs = formatSpanishDate(date);

    // El mensaje se genera SIEMPRE en español claro para el patrón (con nota bilingüe si el cliente usó la web en inglés)
    let msg =
      `¡Hola! Soy *${name}*. Me gustaría consultar con Centuria Sea Adventure:\n\n` +
      `⚓ *Modalidad:* ${serviceNameEs}\n` +
      `📅 *Fecha:* ${readableDateEs}${date ? ' (' + date + ')' : ''}\n` +
      `🕒 *Horario:* ${slotEs}\n` +
      `👥 *Personas:* ${pax}\n` +
      (isGift ? `⏳ *Condición del bono:* Fecha abierta con validez de 6 meses.\n` : '') +
      (note ? `💬 *Detalles / Destinatario:* ${note}\n` : '') +
      `\n¿Me podéis confirmar disponibilidad, precio y pasos a seguir? ¡Gracias!`;

    if (currentLang === 'en') {
      msg += `\n\n---\n🇬🇧 *(Client browsing in English: Hello! I would like to check availability/details for this request. Thank you!)*`;
    }

    window.open(`https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
  });
}

// ============================================================================
// 4. GALERÍA INTERACTIVA CON VISOR LIGHTBOX (BARCO.HTML)
// ============================================================================
const lightbox = $('lightbox');
if (lightbox) {
  const lbImg = $('lightboxImg');
  const lbCap = $('lightboxCaption');
  const lbClose = $('lightboxClose');

  const openLightbox = tile => {
    const imgSrc = tile.getAttribute('data-img');
    const spanText = tile.querySelector('span')?.textContent || tile.getAttribute('data-caption') || '';
    if (!imgSrc) return;
    lbImg.src = imgSrc;
    lbCap.textContent = spanText;
    lightbox.classList.add('active');
    lightbox.setAttribute('aria-hidden', 'false');
  };

  const closeLightbox = () => {
    lightbox.classList.remove('active');
    lightbox.setAttribute('aria-hidden', 'true');
    lbImg.src = '';
  };

  document.querySelectorAll('.gallery-tile[data-img]').forEach(tile => {
    tile.addEventListener('click', () => openLightbox(tile));
    tile.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openLightbox(tile);
      }
    });
  });

  lbClose.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', e => {
    if (e.target === lightbox) closeLightbox();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && lightbox.classList.contains('active')) closeLightbox();
  });
}

// ============================================================================
// 5. WHATSAPP GENERAL, MENÚ MÓVIL Y ANIMACIONES SUAVES
// ============================================================================
const defaultWaMsg = '¡Hola! He visto la web de Centuria Sea Adventure y me gustaría recibir información sobre las salidas en barco / Tarjeta Regalo.';
const waUrl = `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(defaultWaMsg)}`;

if ($('contactWhatsapp')) {$('contactWhatsapp').href = waUrl;
  $('contactWhatsapp').target = '_blank';$('contactWhatsapp').rel = 'noopener noreferrer';
}
if ($('floatingWhatsapp')) {$('floatingWhatsapp').href = waUrl;
  $('floatingWhatsapp').target = '_blank';$('floatingWhatsapp').rel = 'noopener noreferrer';
}
if ($('contactPhone'))$('contactPhone').textContent = CONFIG.phone;
if ($('year'))$('year').textContent = new Date().getFullYear();

const toggle = document.querySelector('.menu-toggle');
const nav = $('nav');
if (toggle && nav) {
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? '✕' : '☰';
  });
  nav.querySelectorAll('a').forEach(a =>
    a.addEventListener('click', () => {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.textContent = '☰';
    })
  );
}

const revealItems = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window && revealItems.length) {
  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  revealItems.forEach(el => observer.observe(el));
} else {
  revealItems.forEach(el => el.classList.add('visible'));
}