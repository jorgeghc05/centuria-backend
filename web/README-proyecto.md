# Centuria Sea Adventure

```
web/        Web estática (Netlify). HTML + CSS + JS sin frameworks.
backend/    Servidor Node (Render). Disponibilidad desde Google Calendar y pago de la señal con Stripe.
```

## Cómo funciona una reserva

1. La web pide al backend las franjas libres del mes (`GET /api/disponibilidad`).
2. El backend lee el Google Calendar del patrón y lo traduce a tres franjas por día:

   | Franja | Horas |
   |---|---|
   | Mañana | 8:30 – 12:30 |
   | Mediodía | 12:30 – 16:30 |
   | Tarde | 17:00 – 21:00 |

3. El cliente elige salida, día y hora:
   - **Paseo, pesca 4 h, celebración 4 h**: elige franja y sale al empezar la franja.
   - **Delfines**: solo mañana, de 8:30 a 11:30.
   - **Salidas de 6 y 8 horas** (celebración 6 h, pesca 8 h, día a Maro): elige la hora de salida,
     cada media hora entre las 8:30 y la última que permite volver a las 21:00. Ocupan todas las
     franjas que tocan: un 8 h de 9:00 a 17:00 ocupa mañana y mediodía; uno de 10:00 a 18:00, las tres.
   - **Puesta de sol**: la hora la calcula la web con la puesta de sol de ese día (sale 2 h 30 min antes).
     En verano sale sobre las 19:00 (franja de tarde); en invierno hacia las 15:30 y ocupa mediodía y tarde.
   - **Fechas especiales**: horario fijo.
4. Acepta las condiciones y paga la señal (20 €/persona) en Stripe. Antes, el backend vuelve a comprobar
   que el hueco sigue libre y lo **retiene durante el pago** (30 min), para que nadie más pague lo mismo.
   Si el cliente vuelve atrás sin pagar, el hueco se suelta al momento.
5. Stripe avisa al backend (webhook) y la reserva se apunta en el calendario con los datos del cliente
   y su hora real. Esas franjas desaparecen de la web.

El bono regalo y el plan a medida no pasan por pago: abren WhatsApp con el mensaje escrito.

---

## Guía para el patrón: marcar días desde el móvil

Usa un calendario de Google solo para esto (por ejemplo «Centuria disponibilidad»).
En la app de Google Calendar del móvil, crea eventos con estos títulos:

| Título del evento | Qué hace |
|---|---|
| `Libre` | Abre las tres franjas ese día |
| `Mañana` / `Mediodía` / `Tarde` | Abre solo esa franja |
| `Mañana y tarde` | Abre esas dos |
| `Cerrado` | Cierra el día entero, aunque otro evento lo abra |
| `Cerrado tarde` | Cierra solo esa franja |
| `Reservado mediodía` | Igual que cerrado; para reservas que te llegan por teléfono |

- Da igual mayúsculas o tildes («manana», «medio dia» también valen).
- Mejor como **evento de todo el día**. Si lo pones con hora y el título no dice la franja:
  - un `Libre` abre las franjas que cubre al menos a la mitad (`Libre` de 9:00 a 14:00 abre la mañana);
  - un `Cerrado`/`Ocupado` cierra todas las franjas que toca, aunque sea un rato.
- Para abrir toda la temporada de golpe: un `Libre` que se repita, por ejemplo, de viernes a domingo de junio
  a septiembre. Luego tapas excepciones con `Cerrado`.
- Un evento de varios días (`Libre` del 1 al 15 de agosto) abre todos esos días.
- Cualquier otro título («Dentista», «Cumple Juan») se ignora. Lo que no está marcado, está cerrado.
- Las reservas pagadas aparecen solas en el calendario de reservas, en amarillo, con teléfono, precio y lo que
  queda por cobrar. Si arrastras una reserva a otra hora u otro día, la web lo respeta (lee la hora real).
- Si pone **CONFLICTO** en rojo, dos reservas coinciden: hay que llamar a una y recolocarla o devolver la señal
  desde Stripe. Con la retención durante el pago debería pasar casi nunca.
- Los cambios tardan como mucho un minuto en verse en la web.

Las fechas especiales se abren solas en su horario y solo se pueden reservar para ese evento. Si un año no
quieres salir, pon `Cerrado` ese día.

---

## Probar el calendario con tu móvil (antes de publicar)

1. Haz los pasos de «Conectar Google Calendar» (más abajo) con **tu** cuenta de Google: crea los calendarios
   «Centuria disponibilidad» y «Centuria reservas» y compártelos con la cuenta de servicio.
2. En `backend/.env` pon `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_CALENDAR_DISPONIBILIDAD` y `GOOGLE_CALENDAR_ID`.
3. Desde el móvil, crea un par de eventos (`Libre` mañana, `Cerrado tarde` pasado mañana…).
4. En el ordenador:
   ```
   cd backend
   npm install
   npm run probar-calendario
   ```
   Sale cada evento con lo que entiende la web («abre mañana + mediodía», «se ignora»…) y la tabla de franjas
   tal y como la verá un cliente. Si algo falla, el script dice qué tocar (calendario no compartido, API sin
   activar, ID mal copiado…). Con `npm run probar-calendario -- --escribir` comprueba además que se pueden
   apuntar reservas.
5. Para ver la web completa en local: `npm run dev` en `backend/` y abre `web/` con Live Server
   (en `localhost` la web usa sola el backend local). Con claves de Stripe de prueba (`sk_test_…`) puedes
   pagar con la tarjeta `4242 4242 4242 4242`. Para que el webhook llegue en local:
   `stripe listen --forward-to localhost:3000/api/webhook` (Stripe CLI) y pon el `whsec_` que te da en el `.env`.

---

## Puesta en marcha del backend (Render)

1. Sube la carpeta `backend/` a un repositorio de GitHub (el `.env` no se sube; ya está en `.gitignore`).
2. En Render: New → Web Service → ese repo. Build `npm install`, start `npm start`, Node 22 o superior.
3. Copia las variables de `backend/.env.example` en Environment.
4. Stripe → Developers → Webhooks → añadir endpoint `https://TU-BACKEND.onrender.com/api/webhook`
   con los eventos `checkout.session.completed` y `checkout.session.expired`. Copia el «signing secret» en `STRIPE_WEBHOOK_SECRET`.
5. En `web/js/datos.js` pon la URL del backend en `CONFIG.api`.

### Conectar Google Calendar (cuenta de servicio, recomendado)

El refresh token del OAuth Playground caduca a los 7 días si la app de Google está en modo «Testing».
Una cuenta de servicio no caduca:

1. Google Cloud Console → crea un proyecto → activa «Google Calendar API».
2. IAM → Cuentas de servicio → crear → Claves → «Añadir clave» JSON. Se descarga un archivo.
3. En Google Calendar (desde ordenador), en los dos calendarios (disponibilidad y reservas):
   Configuración → Compartir con personas concretas → añade el email de la cuenta de servicio
   (`...@...iam.gserviceaccount.com`) con permiso «Hacer cambios en eventos».
4. Mete el contenido del JSON en `GOOGLE_SERVICE_ACCOUNT_JSON` (tal cual o en base64).
5. El ID de cada calendario está en Configuración → Integrar el calendario → ID del calendario.

### Plan gratuito de Render

El servidor se duerme tras 15 minutos sin visitas y tarda unos 30–60 s en despertar. La web lo avisa
mientras carga el calendario. Si molesta, el plan de pago más barato lo mantiene despierto.

### Tests

```
cd backend
npm install
npm test
```

---

## Reseñas de Google

La web enseña la nota y las reseñas de la ficha de Google Maps de la empresa.

1. **Enlaces (lo mínimo):** en `web/js/datos.js` rellena `urlGoogleMaps` (en Google Maps, ficha del
   negocio, «Compartir» > «Copiar enlace») y `urlEscribirResena`
   (`https://search.google.com/local/writereview?placeid=PLACE_ID`). Con eso ya salen los botones
   «Ver en Google Maps» y «Dejar una reseña».
2. **Reseñas dentro de la web:** saca el Place ID en
   https://developers.google.com/maps/documentation/places/web-service/place-id, crea una clave de
   «Places API (New)» en Google Cloud y pon `GOOGLE_PLACE_ID` y `GOOGLE_PLACES_API_KEY` en Render.
   Google entrega como mucho 5 reseñas (las que considera más relevantes) y la web las guarda 6 horas.
   Con este uso el coste entra de sobra en el crédito gratuito mensual de Google Maps Platform.
3. **Conseguir reseñas:** el enlace `urlEscribirResena` es el que el patrón manda por WhatsApp a cada
   cliente al volver a puerto. También se puede imprimir como código QR y pegarlo en el barco.

## Antes de publicar

- [ ] Rellenar lo marcado en amarillo en `web/condiciones.html` y que lo revise un gestor o abogado.
- [ ] Confirmar con el patrón plazos de cancelación, horas de las franjas y precios.
- [ ] Comprobar que el barco tiene la autorización para alquiler con patrón y el seguro correspondiente.
- [ ] Fechas provisionales de 2027: Virgen de los submarinistas (11 de julio, hora), fuegos de la Feria (13 de agosto) y Festival Aéreo de Torre del Mar (5 de septiembre).
- [ ] Foto para el avistamiento de delfines: `web/imagenes/delfines.jpg`.
- [ ] Pasar Stripe a modo real (claves `sk_live_...`) solo cuando todo lo anterior esté hecho.
- [ ] Reseñas: solo reales. Añádelas en `RESENAS` (`web/js/datos.js`) o pon el enlace de Google en `CONFIG.urlResenasGoogle`.
