'use strict';

/*
 * Datos editables de la web. Lo normal es tocar solo este archivo.
 * Los ids de SALIDAS y EVENTOS tienen que coincidir con backend/lib/catalogo.js.
 */

const CONFIG = {
  // En local (Live Server, localhost) usa el backend arrancado con «npm run dev».
  api: /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? 'http://localhost:3000' : 'https://centuria-backend-xef0.onrender.com',
  whatsapp: '34687549223',
  telefono: '+34 687 549 223',
  maxPersonas: 8,
  senalPorPersona: 20,
  // Ley 11/2021: operaciones de 1.000 € o más no se pueden pagar en efectivo.
  limiteEfectivo: 1000,
  mesesValidezBono: 6,
  email: 'info@centuriaseaadventure.com',
  redes: {
    instagram: 'https://www.instagram.com/centuria_sea_adventure/',
    facebook: 'https://www.facebook.com/centuriaseaadventure',
    tiktok: 'https://www.tiktok.com/@centuria.sea.adventure'
  },
  // Ficha de la empresa en Google Maps (botón «Compartir» > «Copiar enlace»)
  urlGoogleMaps: 'https://share.google/A1wiRXLTEsKEWQeVw',
  // Enlace para dejar reseña: https://search.google.com/local/writereview?placeid=TU_PLACE_ID
  // Es el que el patrón manda a sus clientes después de cada salida.
  urlEscribirResena: '',
  // Nota de Google mientras no esté conectada la API de reseñas (actualízala a mano de vez en cuando).
  // Si la API está configurada en el backend, se usa la nota real y esto se ignora.
  notaGoogleManual: { nota: 5.0, total: 3 },
};

// Franjas del día. Tienen que coincidir con backend/lib/catalogo.js.
const TURNOS = {
  manana: { es: 'Mañana', en: 'Morning', inicio: '08:30', fin: '12:30' },
  mediodia: { es: 'Mediodía', en: 'Midday', inicio: '12:30', fin: '16:30' },
  tarde: { es: 'Tarde', en: 'Afternoon', inicio: '17:00', fin: '21:00' }
};
// Salidas con hora de inicio libre (6 y 8 horas): entre qué horas y cada cuánto.
const JORNADA = { primeraSalida: '08:30', ultimaVuelta: '21:00', pasoMinutos: 30 };
// Para calcular la puesta de sol (Real Club El Candado). El atardecer sale 2 h 30 min antes.
const PUERTO = { lat: 36.7165, lon: -4.3505, atardecerAntesMin: 150 };

// horas: duración. modo: cómo se elige la hora (igual que en el backend):
//   'turno'  -> el cliente elige franja (turnos) y sale al empezar la franja
//   'inicio' -> el cliente elige la hora de salida
//   'sol'    -> la hora la marca la puesta de sol de ese día
// precio: euros por salida para todo el grupo, IVA y gasolina incluidos. Sin precio = «a consultar».
const SALIDAS = [
  {
    id: 'paseo',
    precio: 350,
    fotos: ['imagenes/centuria_mar.jpg', 'imagenes/chicas_flotador_centuria.jpg', 'imagenes/chicas_tabla_centuria.jpg'],
    horas: 3,
    modo: 'turno',
    turnos: ['manana', 'mediodia', 'tarde'],
    es: {
      nombre: 'Paseo por la costa',
      duracion: '3 horas',
      texto: 'Salimos hacia el Peñón del Cuervo o hacia La Araña según el viento, fondeamos en una cala y os dais un baño.',
      mas: 'La salida para quien quiere probar el mar sin complicarse. El patrón elige la cala según el viento de ese día, para que el fondeo sea tranquilo y el agua esté limpia. Hay tiempo para un par de baños, para tomar algo en cubierta y para volver sin prisas.',
      plan: ['Embarque en El Candado y explicación rápida de seguridad', 'Navegación por la costa hasta la cala elegida', 'Fondeo, baño y snorkel', 'Vuelta a puerto bordeando la costa']
    },
    en: {
      nombre: 'Coastal trip',
      duracion: '3 hours',
      texto: 'We head to Peñón del Cuervo or La Araña depending on the wind, anchor in a cove and you go for a swim.',
      mas: 'The trip for anyone who wants to enjoy the sea without fuss. The skipper picks the cove according to the day’s wind, so the anchorage is calm and the water clear. There is time for a couple of swims, a drink on deck and an unhurried trip back.',
      plan: ['Boarding at El Candado and a quick safety briefing', 'Cruise along the coast to the chosen cove', 'Anchor, swim and snorkel', 'Back to port along the coastline']
    }
  },
  {
    id: 'atardecer',
    precio: 350,
    fotos: ['imagenes/atardecer_penyon_cuervo.jpg', 'imagenes/moet_centuria.jpeg', 'imagenes/centuria_mar.jpg'],
    horas: 3,
    modo: 'sol',
    es: {
      nombre: 'Puesta de sol',
      duracion: '3 horas',
      texto: 'Salimos con tiempo para un baño y volvemos con Málaga encendiéndose detrás. La hora cambia con la estación.',
      mas: 'La hora de salida se ajusta a la puesta de sol de ese día: en pleno verano salimos sobre las 19:00 y en invierno hacia las 15:30. Al reservar te decimos la hora exacta de ese día. Nos bañamos con la luz de la tarde y, cuando baja el sol, fondeamos frente a la bahía para verlo con la ciudad de fondo. Es la salida que más se reserva para aniversarios y pedidas.',
      plan: ['Embarque dos horas y media antes de la puesta de sol', 'Baño en una cala con la luz de la tarde', 'Fondeo frente a la bahía para ver ponerse el sol', 'Vuelta a puerto con las luces de Málaga']
    },
    en: {
      nombre: 'Sunset trip',
      duracion: '3 hours',
      texto: 'We leave in time for a swim and come back as Málaga lights up behind us. The time changes with the season.',
      mas: 'Departure time follows that day’s sunset: around 19:00 in midsummer and about 15:30 in winter. When you book we show you the exact time for that day. We swim in the afternoon light and, as the sun goes down, anchor off the bay to watch it with the city behind. It is the trip most often booked for anniversaries and proposals.',
      plan: ['Boarding two and a half hours before sunset', 'Swim in a cove in the afternoon light', 'Anchor off the bay to watch the sunset', 'Back to port with Málaga lit up']
    }
  },
  {
    id: 'delfines',
    precio: 350,
    fotos: ['imagenes/delfines.jpg', 'imagenes/centuria_mar.jpg'],
    horas: 3,
    modo: 'turno',
    turnos: ['manana'],
    es: {
      nombre: 'Avistamiento de delfines',
      duracion: '3 horas',
      texto: 'Salimos temprano, con el mar en calma, a buscar delfines mar adentro. Son animales salvajes y no podemos garantizar verlos. Nos acercamos despacio, sin perseguirlos y guardando la distancia que marca la normativa.',
      mas: 'A primera hora el mar suele estar más quieto y es más fácil ver las aletas. Navegamos unas millas mar adentro y vamos parando a mirar. Cuando aparecen, reducimos la velocidad, apagamos el motor si se acercan y dejamos que sean ellos quienes decidan. Si hay suerte, nadan junto al barco.',
      plan: ['Salida temprano con el mar en calma', 'Navegación mar adentro buscando señales', 'Observación con el motor al ralentí o parado', 'Baño en una cala de vuelta, si apetece']
    },
    en: {
      nombre: 'Dolphin watching',
      duracion: '3 hours',
      texto: 'We go out early, while the sea is calm, to look for dolphins offshore. They are wild animals, so we cannot guarantee a sighting. We approach slowly, never chase them and keep the legal distance.',
      mas: 'Early in the morning the sea is usually flatter and fins are easier to spot. We head a few miles offshore and stop to look around. When they show up we slow down, cut the engine if they come close and let them decide. With luck, they swim alongside the boat.',
      plan: ['Early departure on a calm sea', 'Cruise offshore looking for signs', 'Watching with the engine idling or off', 'A swim in a cove on the way back, if you like']
    }
  },
  {
    id: 'pesca',
    precio: 399,
    fotos: ['imagenes/centuria_cabina.jpeg', 'imagenes/centuria_mar.jpg'],
    horas: 4,
    modo: 'turno',
    turnos: ['manana', 'mediodia', 'tarde'],
    es: {
      nombre: 'Pesca con el patrón',
      duracion: '4 horas',
      texto: 'Pesca recreativa en los fondos que el patrón conoce. Llevamos el material; las capturas siguen la normativa de pesca recreativa.',
      mas: 'El patrón lleva años pescando en esta costa y sabe dónde suele haber movimiento según la época. El barco lleva localizador de peces, depósito de cebo vivo y portacañas. Ponemos cañas, cebo y todo lo necesario, y os enseñamos a montar y a lanzar si no habéis pescado nunca. Se respetan tallas mínimas y cupos, y lo que no se pueda quedar vuelve al agua. Hay opción de 4 o de 8 horas.',
      plan: ['Embarque y preparación del material', 'Navegación a los primeros fondos', 'Pesca en dos o tres puntos según la picada', 'Vuelta a puerto con lo pescado']
    },
    en: {
      nombre: 'Fishing with the skipper',
      duracion: '4 hours',
      texto: 'Recreational fishing over grounds the skipper knows well. Gear included; catches follow recreational fishing rules.',
      mas: 'The skipper has fished this coast for years and knows where the fish usually are in each season. The boat has a fish finder, live bait well and rod holders. We provide rods, bait and everything else, and show you how to rig and cast if you have never fished. Minimum sizes and limits are respected, and anything that cannot be kept goes back in. Choose 4 or 8 hours.',
      plan: ['Boarding and gear preparation', 'Cruise to the first fishing grounds', 'Fishing at two or three spots depending on the bite', 'Back to port with your catch']
    }
  },
  {
    // Jornada larga de pesca. Se muestra en la misma fila que la de 4 horas.
    id: 'pesca-8h',
    grupo: 'pesca',
    precio: 600,
    fotos: ['imagenes/centuria_cabina.jpeg'],
    horas: 8,
    modo: 'inicio',
    es: {
      nombre: 'Pesca con el patrón',
      duracion: '8 horas',
      texto: 'Jornada completa de pesca: más tiempo para buscar fondos lejos de la costa y parar a comer fondeados.'
    },
    en: {
      nombre: 'Fishing with the skipper',
      duracion: '8 hours',
      texto: 'A full fishing day: more time to reach grounds further offshore and stop for lunch at anchor.'
    }
  },
  {
    id: 'celebracion',
    precio: 350,
    fotos: ['imagenes/moet_centuria.jpeg', 'imagenes/chicas_tabla_centuria.jpg', 'imagenes/atardecer_penyon_cuervo.jpg'],
    horas: 4,
    modo: 'turno',
    turnos: ['manana', 'mediodia', 'tarde'],
    es: {
      nombre: 'Celebración a bordo',
      duracion: '4 horas',
      texto: 'Cumpleaños, despedidas o una pedida de mano. Traed vuestra comida y bebida; nosotros ponemos el barco y la nevera.',
      mas: 'El barco es solo para vuestro grupo, así que la celebración la montáis a vuestro gusto: música, tarta, cava o lo que queráis traer. Si lo preferís, os lo dejamos preparado con los extras de decoración, cava o el pack de pedida de mano. Hay opción de 4 o de 6 horas.',
      plan: ['Embarque con todo preparado', 'Navegación y primer baño', 'Fondeo para comer, brindar y celebrar', 'Vuelta a puerto']
    },
    en: {
      nombre: 'Celebration on board',
      duracion: '4 hours',
      texto: 'Birthdays, hen and stag parties or a proposal. Bring your own food and drinks; we provide the boat and the cool box.',
      mas: 'The boat is just for your group, so you set the party up your way: music, cake, cava or whatever you bring. If you prefer, we can have it ready with the decoration, cava or proposal pack extras. Choose 4 or 6 hours.',
      plan: ['Boarding with everything ready', 'Cruise and a first swim', 'Anchor to eat, toast and celebrate', 'Back to port']
    }
  },
  {
    // Variante larga de la celebración. Se muestra en la misma fila que la de 4 horas.
    id: 'celebracion-6h',
    grupo: 'celebracion',
    precio: 500,
    fotos: ['imagenes/moet_centuria.jpeg'],
    horas: 6,
    modo: 'inicio',
    es: {
      nombre: 'Celebración a bordo',
      duracion: '6 horas',
      texto: 'La celebración con más tiempo. Elegís vosotros a qué hora salir.'
    },
    en: {
      nombre: 'Celebration on board',
      duracion: '6 hours',
      texto: 'The longer celebration. You choose what time to set off.'
    }
  },
  {
    id: 'dia',
    precio: 600,
    fotos: ['imagenes/cascada_maro.jpg', 'imagenes/chicas_tabla_centuria.jpg', 'imagenes/chicas_flotador_centuria.jpg', 'imagenes/centuria_mar.jpg'],
    horas: 8,
    modo: 'inicio',
    es: {
      nombre: 'Día completo a Maro',
      duracion: '8 horas',
      texto: 'Navegamos hacia el este hasta los acantilados y la cascada de Maro, con paradas para bañarse y comer fondeados.',
      mas: 'La salida más completa. Recorremos la costa hacia el este, pasando por Rincón de la Victoria y Torre del Mar, hasta los acantilados de Maro y Cerro Gordo, un paraje natural que solo se ve bien desde el agua. Allí está la cascada que cae directamente al mar. Paramos en varias calas para bañarnos y comemos fondeados.',
      plan: ['Embarque por la mañana en El Candado', 'Navegación hacia el este por la costa', 'Acantilados y cascada de Maro, baño y comida fondeados', 'Vuelta por la tarde con alguna parada más']
    },
    en: {
      nombre: 'Full day to Maro',
      duracion: '8 hours',
      texto: 'We sail east to the Maro cliffs and waterfall, stopping to swim and to have lunch at anchor.',
      mas: 'Our most complete trip. We cruise east past Rincón de la Victoria and Torre del Mar to the cliffs of Maro and Cerro Gordo, a protected natural area best seen from the water, with a waterfall that drops straight into the sea. We stop at several coves to swim and have lunch at anchor.',
      plan: ['Morning boarding at El Candado', 'Cruise east along the coast', 'Maro cliffs and waterfall, swim and lunch at anchor', 'Afternoon return with another stop or two']
    }
  }
];

// Salidas en fechas concretas. precioPersona: euros por persona, IVA y gasolina incluidos.
// horario: hora de salida y de vuelta. Ocupa las franjas con las que se solapa
// (turnos solo hace falta ponerlo si cae fuera de franja). provisional: la organización aún no ha dado la fecha.
const EVENTOS = [
  {
    id: 'legion-2027',
    precioPersona: 200,
    horario: { inicio: '08:30', fin: '12:30' },
    fecha: '2027-03-25',
    provisional: false,
    es: {
      duracion: '4 horas',
      nombre: 'Desembarco de la Legión',
      texto: 'Jueves Santo. Vemos desde el agua la llegada del buque al puerto de Málaga, siempre fuera de la zona que acote Capitanía Marítima ese día.'
    },
    en: {
      duracion: '4 hours',
      nombre: 'Spanish Legion landing',
      texto: 'Maundy Thursday. We watch the ship arrive at Málaga port from the water, outside whatever area the Harbour Master closes that day.'
    }
  },
  {
    id: 'virgen-submarinistas-2027',
    precioPersona: 150,
    horario: { inicio: '10:00', fin: '13:00' },
    fecha: '2027-07-11',
    provisional: true,
    es: {
      duracion: '3 horas',
      nombre: 'Virgen de los submarinistas',
      texto: 'El domingo antes del Carmen, los buzos sacan del fondo, frente a Benalmádena, la pequeña Virgen del Carmen que vive en una cueva submarina. Lo vemos desde el agua. La hora la confirma la organización.'
    },
    en: {
      duracion: '3 hours',
      nombre: 'The divers’ Virgin',
      texto: 'On the Sunday before the Carmen, divers bring up the small Virgen del Carmen kept in an underwater cave off Benalmádena. We watch from the water. Time to be confirmed by the organisers.'
    }
  },
  {
    id: 'virgen-carmen-2027',
    precioPersona: 160,
    horario: { inicio: '19:00', fin: '22:00' },
    fecha: '2027-07-16',
    provisional: false,
    es: {
      duracion: '3 horas',
      nombre: 'Virgen del Carmen',
      texto: 'Acompañamos desde el mar la procesión marítima de la Virgen del Carmen frente a El Palo y Pedregalejo.'
    },
    en: {
      duracion: '3 hours',
      nombre: 'Virgen del Carmen',
      texto: 'We follow the Virgen del Carmen sea procession off El Palo and Pedregalejo.'
    }
  },
  {
    id: 'eclipse-2027',
    precioPersona: 180,
    horario: { inicio: '09:30', fin: '12:00' },
    fecha: '2027-08-02',
    provisional: false,
    es: {
      duracion: '2,5 horas',
      nombre: 'Eclipse total de sol',
      texto: 'Málaga queda dentro de la franja de totalidad: hacia las 10:48 el sol se tapa entero durante casi dos minutos. Lo vemos fondeados. Hacen falta gafas con norma ISO 12312-2.'
    },
    en: {
      duracion: '2.5 hours',
      nombre: 'Total solar eclipse',
      texto: 'Málaga is inside the path of totality: around 10:48 the sun is fully covered for almost two minutes. We watch it at anchor. You need ISO 12312-2 eclipse glasses.'
    }
  },
  {
    id: 'fuegos-feria-2027',
    precioPersona: 200,
    horario: { inicio: '21:00', fin: '01:00' },
    fecha: '2027-08-13',
    turnos: ['tarde'],
    provisional: true,
    es: {
      duracion: '4 horas',
      nombre: 'Fuegos artificiales de la Feria de Málaga',
      texto: 'Los fuegos que abren la Feria se lanzan a medianoche frente a La Malagueta. Los vemos fondeados en primera fila, sin el gentío de la playa.'
    },
    en: {
      duracion: '4 hours',
      nombre: 'Málaga Fair fireworks',
      texto: 'The fireworks that open the Fair go off at midnight off La Malagueta. We watch them at anchor from the front row, away from the beach crowds.'
    }
  },
  {
    id: 'festival-aereo-2027',
    precioPersona: 200,
    horario: { inicio: '11:00', fin: '16:00' },
    fecha: '2027-09-05',
    provisional: true,
    es: {
      duracion: '5 horas',
      nombre: 'Festival Aéreo de Torre del Mar',
      texto: 'Suele ser el primer fin de semana de septiembre. Vemos la exhibición del domingo desde el mar, frente a la playa de Torre del Mar.'
    },
    en: {
      duracion: '5 hours',
      nombre: 'Torre del Mar Air Show',
      texto: 'Usually the first weekend of September. We watch the Sunday display from the sea, off Torre del Mar beach.'
    }
  }
];

// Extras. Los de pago se abonan en efectivo el día de la salida.
// gratis: true -> no cuesta nada, pero hay que marcarlo para que el patrón lo lleve.
// aviso: texto que se muestra al marcarlo. grupo: apartado del formulario (ver GRUPOS_EXTRAS).
const GRUPOS_EXTRAS = {
  gratis: { es: 'Gratis, márcalo para que lo llevemos', en: 'Free, tick it so we bring it' },
  agua: { es: 'En el agua', en: 'In the water' },
  comida: { es: 'Comida y bebida', en: 'Food and drinks' },
  fiesta: { es: 'Celebraciones y recuerdos', en: 'Celebrations and keepsakes' }
};
const EXTRAS = [
  { id: 'snorkel', grupo: 'gratis', es: 'Kit de snorkel (gafas y tubo)', en: 'Snorkel kit (mask and snorkel)', gratis: true },
  { id: 'paddle', grupo: 'agua', es: 'Tabla de paddle surf', en: 'Paddleboard', precio: '20 €' },
  { id: 'kayak', grupo: 'agua', es: 'Kayak', en: 'Kayak', precio: '20 €' },
  { id: 'esqui', grupo: 'agua', es: 'Esquí acuático', en: 'Water skis', precio: '20 €' },
  { id: 'rosco', grupo: 'agua', es: 'Deslizador (rosco hinchable)', en: 'Towable ring', precio: '15 €' },
  { id: 'refrescos', grupo: 'comida', es: 'Pack de refrescos, agua y hielo', en: 'Soft drinks, water and ice', precio: '10 €' },
  { id: 'cervezas', grupo: 'comida', es: 'Pack de cervezas frías', en: 'Cold beer pack', precio: '15 €' },
  { id: 'cava', grupo: 'comida', es: 'Botella de cava con copas y hielo', en: 'Bottle of cava with glasses and ice', precio: '40 €' },
  { id: 'tardeo', grupo: 'comida', es: 'Pack tardeo (vino blanco, quesos, embutidos y picos)', en: 'Afternoon pack (white wine, cheese, cured meats and breadsticks)', precio: '50 €' },
  { id: 'helado', grupo: 'comida', es: 'Helado artesano malagueño (1 litro)', en: 'Artisan Málaga ice cream (1 litre)', precio: '18 €' },
  { id: 'quesos', grupo: 'comida', es: 'Tabla de quesos e ibéricos', en: 'Cheese and Iberian ham board', precio: '15 €/pers.' },
  { id: 'menu', grupo: 'comida', es: 'Menú andaluz', en: 'Andalusian food box', precio: '25 €/pers.' },
  { id: 'decoracion', grupo: 'fiesta', es: 'Decoración de celebración (globos y guirnalda)', en: 'Party decoration (balloons and banner)', precio: '30 €' },
  { id: 'pedida', grupo: 'fiesta', es: 'Pack pedida de mano (flores, cava, decoración y fotos)', en: 'Proposal pack (flowers, cava, decoration and photos)', precio: '120 €' },
  { id: 'fotos', grupo: 'fiesta', es: 'Fotos con cámara acuática, enviadas por WhatsApp', en: 'Waterproof camera photos, sent on WhatsApp', precio: '35 €' },
  {
    id: 'mascota', grupo: 'gratis',
    es: 'Viene una mascota',
    en: 'Bringing a pet',
    gratis: true,
    aviso: {
      es: 'El barco admite mascotas, pero confírmalo antes con el patrón por WhatsApp (tamaño, raza, si se marea…).',
      en: 'Pets are welcome, but please check with the skipper on WhatsApp first (size, breed, seasickness…).'
    }
  }
];

// Solo reseñas reales, con permiso de quien las escribe.
// Ejemplo: { texto: '...', autor: 'Laura, Málaga', salida: 'Puesta de sol' }
const RESENAS = [];
