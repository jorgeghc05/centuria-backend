# Bono regalo online y panel

## Qué hay nuevo

**Servidor (`server.js`, `lib/bonos.js`, `lib/panel.js`)**

- `GET /api/bono/salidas`: salidas que se pueden regalar con su precio (las de precio por grupo; las fechas especiales no).
- `POST /api/bono/checkout`: crea el pago del bono en Stripe con el precio completo de la salida. El código (`CEN-XXXX-XXXX`, sin letras que se confundan) y la caducidad (6 meses) se guardan en los metadatos del pago.
- `GET /api/bono?sesion=cs_…`: devuelve el bono ya pagado para enseñarlo e imprimirlo.
- El webhook ya no intenta apuntar los bonos en Google Calendar: un bono no ocupa hueco.
- Panel, protegido con `PANEL_CLAVE`:
  - `GET /api/panel/resumen?mes=YYYY-MM`: salidas del mes, facturación, señales, resto a cobrar el día, cobrado online, bonos, próximas salidas, más pedidas y serie de 12 meses.
  - `GET /api/panel/bono?codigo=…`: comprobar un bono.
  - `POST /api/panel/bono/canjear`: marcar un bono como canjeado (o deshacerlo).
  - Tras 10 claves mal en 15 minutos desde la misma IP, bloquea un rato.

No hay base de datos nueva: todo sale de Stripe.

**Páginas**

- `regalo.html`: compra del bono con vista previa en directo (ES/EN). Al volver de Stripe enseña el bono final con botones de guardar en PDF, enviar por WhatsApp y copiar enlace.
- `panel.html`: el panel (no aparece en Google: `noindex`).

## Para ponerlo en marcha

1. **Render → Environment**: añade `PANEL_CLAVE` con una clave larga. Sin ella el panel responde "no activado".
2. **Stripe → Webhooks**: no hace falta nada nuevo; el bono usa el mismo evento `checkout.session.completed` que ya tienes.
3. Sube `regalo.html` y `panel.html` a la web (misma carpeta que `index.html`, junto a `imagenes/`).
4. En la web, cambia los botones de "Regalar una salida" / "Pedir un bono regalo" para que apunten a `regalo.html`.
5. Prueba con las claves de test de Stripe (tarjeta `4242 4242 4242 4242`) antes de pasar a las reales. El panel avisa en amarillo cuando está leyendo pagos de prueba.

## Cómo se usa el bono

1. Alguien compra el bono en `regalo.html`, paga y se lo descarga o lo manda.
2. Quien lo recibe escribe por WhatsApp con el código.
3. El patrón lo comprueba en el panel ("Comprobar"), cierra fecha y aparta el hueco en su calendario como siempre ("Reservado tarde"), y pulsa "Canjear".

## Límites

- El panel solo ve lo que se paga por la web. Las reservas apuntadas a mano en el calendario no salen.
- Si se devuelve una señal entera en Stripe, esa reserva cuenta como cancelada.
