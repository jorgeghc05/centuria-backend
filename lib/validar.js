'use strict';

/*
 * Validación por esquemas, al estilo de Bean Validation (@NotNull, @Size, @Pattern…),
 * sin dependencias. Cada endpoint declara qué espera; si algo no encaja se responde
 * 400 con un mensaje claro y la petición no llega a la lógica.
 *
 *   const esquema = v.objeto({
 *     nombre: v.texto({ min: 1, max: 80, recortar: true, mensaje: 'Falta el nombre.' }),
 *     personas: v.entero({ min: 1, max: 8 }),
 *     notas: v.opcional(v.texto({ max: 450 }))
 *   });
 *   app.post('/ruta', validar({ body: esquema }), (req, res) => { req.datos.body.nombre … });
 *
 * Los campos que no están en el esquema se descartan.
 */

class ErrorValidacion extends Error {
  constructor(campo, mensaje) {
    super(mensaje);
    this.campo = campo;
  }
}

const fallo = (ruta, mensaje) => {
  throw new ErrorValidacion(ruta || '(cuerpo)', mensaje);
};

const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const RE_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

const v = {
  texto({ min = 0, max = 1000, patron = null, recortar = true, multilinea = false, mensaje } = {}) {
    return (valor, ruta) => {
      if (typeof valor !== 'string') fallo(ruta, mensaje || `${ruta}: tiene que ser texto.`);
      const s = recortar ? valor.trim() : valor;
      if (RE_CONTROL.test(s) || (!multilinea && /[\r\n]/.test(s))) fallo(ruta, mensaje || `${ruta}: contiene caracteres no permitidos.`);
      if (s.length < min) fallo(ruta, mensaje || `${ruta}: es obligatorio.`);
      if (s.length > max) fallo(ruta, mensaje || `${ruta}: máximo ${max} caracteres.`);
      if (patron && !patron.test(s)) fallo(ruta, mensaje || `${ruta}: formato no válido.`);
      return s;
    };
  },

  // Acepta número o texto con dígitos («4»), como hacen los formularios.
  entero({ min = -Infinity, max = Infinity, mensaje } = {}) {
    return (valor, ruta) => {
      const n = typeof valor === 'string' && /^-?\d{1,9}$/.test(valor.trim()) ? Number(valor) : valor;
      if (!Number.isInteger(n) || n < min || n > max) fallo(ruta, mensaje || `${ruta}: tiene que ser un número entre ${min} y ${max}.`);
      return n;
    };
  },

  verdadero({ mensaje } = {}) {
    return (valor, ruta) => {
      if (valor !== true) fallo(ruta, mensaje || `${ruta}: tiene que ser true.`);
      return true;
    };
  },

  enumerado(opciones, { mensaje } = {}) {
    return (valor, ruta) => {
      if (!opciones.includes(valor)) fallo(ruta, mensaje || `${ruta}: valor no válido.`);
      return valor;
    };
  },

  // YYYY-MM-DD y fecha real (rechaza 2027-02-30).
  fecha({ mensaje } = {}) {
    return (valor, ruta) => {
      if (typeof valor !== 'string' || !RE_FECHA.test(valor)) fallo(ruta, mensaje || `${ruta}: fecha no válida (YYYY-MM-DD).`);
      const d = new Date(`${valor}T00:00:00Z`);
      if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== valor) fallo(ruta, mensaje || `${ruta}: fecha no válida.`);
      return valor;
    };
  },

  lista(elemento, { max = 50, mensaje } = {}) {
    return (valor, ruta) => {
      if (!Array.isArray(valor) || valor.length > max) fallo(ruta, mensaje || `${ruta}: lista no válida (máximo ${max}).`);
      return valor.map((x, i) => {
        try {
          return elemento(x, `${ruta}[${i}]`);
        } catch (err) {
          if (mensaje && err instanceof ErrorValidacion) fallo(err.campo, mensaje);
          throw err;
        }
      });
    };
  },

  objeto(campos, { mensaje } = {}) {
    return (valor, ruta = '') => {
      if (!valor || typeof valor !== 'object' || Array.isArray(valor)) fallo(ruta, mensaje || 'Petición no válida.');
      const limpio = {};
      // En el orden del esquema: el primer error que se ve es el del primer campo.
      for (const [clave, validador] of Object.entries(campos)) {
        const r = validador(valor[clave], ruta ? `${ruta}.${clave}` : clave);
        if (r !== undefined) limpio[clave] = r;
      }
      return limpio;
    };
  },

  // undefined, null o '' -> el campo no está.
  opcional(validador) {
    return (valor, ruta) => (valor === undefined || valor === null || valor === '' ? undefined : validador(valor, ruta));
  }
};

/**
 * Middleware de Express. Deja lo validado en req.datos.{body,query,params}.
 * Responde 400 { error, campo } al primer fallo.
 */
function validar(esquemas) {
  return (req, res, next) => {
    req.datos = {};
    try {
      for (const parte of ['params', 'query', 'body']) {
        if (esquemas[parte]) req.datos[parte] = esquemas[parte](req[parte] || {}, '');
      }
    } catch (err) {
      if (err instanceof ErrorValidacion) return res.status(400).json({ error: err.message, campo: err.campo });
      return next(err);
    }
    next();
  };
}

module.exports = { v, validar, ErrorValidacion };
