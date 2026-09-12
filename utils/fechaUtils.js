/**
 * Utilidades para manejo de fechas y cálculos de frecuencias
 */

/**
 * Calcula la próxima fecha de pago según la frecuencia
 * @param {Date} fechaBase - Fecha base para calcular
 * @param {String} frecuencia - Frecuencia: 'diario', 'semanal', 'quincenal', 'mensual', 'trimestral', 'anual'
 * @param {Number} diaPago - Día del mes (para frecuencias mensuales, trimestrales, anuales)
 * @param {Number} diaSemana - Día de la semana 0-6 (0=domingo, 6=sábado) para frecuencia semanal
 * @returns {Date} Próxima fecha de pago
 */
function calcularProximaFecha(fechaBase, frecuencia, diaPago = null, diaSemana = null) {
  const fecha = new Date(fechaBase);
  fecha.setHours(0, 0, 0, 0);

  switch (frecuencia) {
    case 'diario':
      fecha.setDate(fecha.getDate() + 1);
      break;

    case 'semanal':
      if (diaSemana !== null) {
        const diasHastaProximo = (diaSemana - fecha.getDay() + 7) % 7;
        fecha.setDate(fecha.getDate() + (diasHastaProximo === 0 ? 7 : diasHastaProximo));
      } else {
        fecha.setDate(fecha.getDate() + 7);
      }
      break;

    case 'quincenal':
      fecha.setDate(fecha.getDate() + 15);
      break;

    case 'mensual':
      if (diaPago !== null) {
        fecha.setMonth(fecha.getMonth() + 1);
        fecha.setDate(diaPago);
        // Si el día no existe en el mes (ej: 31 en febrero), usar el último día del mes
        if (fecha.getDate() !== diaPago) {
          fecha.setDate(0); // Último día del mes anterior
        }
      } else {
        fecha.setMonth(fecha.getMonth() + 1);
      }
      break;

    case 'trimestral':
      if (diaPago !== null) {
        fecha.setMonth(fecha.getMonth() + 3);
        fecha.setDate(diaPago);
        if (fecha.getDate() !== diaPago) {
          fecha.setDate(0);
        }
      } else {
        fecha.setMonth(fecha.getMonth() + 3);
      }
      break;

    case 'anual':
      if (diaPago !== null) {
        fecha.setFullYear(fecha.getFullYear() + 1);
        fecha.setDate(diaPago);
        if (fecha.getDate() !== diaPago) {
          fecha.setDate(0);
        }
      } else {
        fecha.setFullYear(fecha.getFullYear() + 1);
      }
      break;

    default:
      throw new Error(`Frecuencia no válida: ${frecuencia}`);
  }

  return fecha;
}

/**
 * Inversa de calcularProximaFecha: la fecha anterior según la frecuencia.
 * Se usa para reconstruir fechas pasadas de una cuota anclando en `proximoPago`
 * (que sí se mantiene correcto) en vez de recalcular desde `fechaInicio`.
 */
function calcularFechaAnterior(fechaBase, frecuencia, diaPago = null, diaSemana = null) {
  const fecha = new Date(fechaBase);
  fecha.setHours(0, 0, 0, 0);

  switch (frecuencia) {
    case 'diario':
      fecha.setDate(fecha.getDate() - 1);
      break;

    case 'semanal':
      if (diaSemana !== null) {
        const diasDesdeAnterior = (fecha.getDay() - diaSemana + 7) % 7;
        fecha.setDate(fecha.getDate() - (diasDesdeAnterior === 0 ? 7 : diasDesdeAnterior));
      } else {
        fecha.setDate(fecha.getDate() - 7);
      }
      break;

    case 'quincenal':
      fecha.setDate(fecha.getDate() - 15);
      break;

    case 'mensual':
      if (diaPago !== null) {
        fecha.setMonth(fecha.getMonth() - 1);
        fecha.setDate(diaPago);
        if (fecha.getDate() !== diaPago) {
          fecha.setDate(0);
        }
      } else {
        fecha.setMonth(fecha.getMonth() - 1);
      }
      break;

    case 'trimestral':
      if (diaPago !== null) {
        fecha.setMonth(fecha.getMonth() - 3);
        fecha.setDate(diaPago);
        if (fecha.getDate() !== diaPago) {
          fecha.setDate(0);
        }
      } else {
        fecha.setMonth(fecha.getMonth() - 3);
      }
      break;

    case 'anual':
      if (diaPago !== null) {
        fecha.setFullYear(fecha.getFullYear() - 1);
        fecha.setDate(diaPago);
        if (fecha.getDate() !== diaPago) {
          fecha.setDate(0);
        }
      } else {
        fecha.setFullYear(fecha.getFullYear() - 1);
      }
      break;

    default:
      throw new Error(`Frecuencia no válida: ${frecuencia}`);
  }

  return fecha;
}

/**
 * Calcula todas las fechas de generación entre dos fechas según la frecuencia
 * @param {Date} fechaInicio - Fecha de inicio
 * @param {Date} fechaFin - Fecha fin (o null para indefinido)
 * @param {String} frecuencia - Frecuencia
 * @param {Number} diaPago - Día del mes
 * @param {Number} diaSemana - Día de la semana
 * @returns {Array<Date>} Array de fechas
 */
function calcularFechasEntre(fechaInicio, fechaFin, frecuencia, diaPago = null, diaSemana = null) {
  const fechas = [];
  let fechaActual = new Date(fechaInicio);
  fechaActual.setHours(0, 0, 0, 0);

  const fechaLimite = fechaFin ? new Date(fechaFin) : null;
  if (fechaLimite) {
    fechaLimite.setHours(23, 59, 59, 999);
  }

  // Ajustar fecha inicial según frecuencia
  if (frecuencia === 'mensual' && diaPago !== null) {
    fechaActual.setDate(diaPago);
    if (fechaActual < new Date(fechaInicio)) {
      fechaActual = calcularProximaFecha(fechaActual, frecuencia, diaPago);
    }
  } else if (frecuencia === 'semanal' && diaSemana !== null) {
    const diasHastaProximo = (diaSemana - fechaActual.getDay() + 7) % 7;
    fechaActual.setDate(fechaActual.getDate() + (diasHastaProximo === 0 ? 7 : diasHastaProximo));
  }

  while (!fechaLimite || fechaActual <= fechaLimite) {
    fechas.push(new Date(fechaActual));
    fechaActual = calcularProximaFecha(fechaActual, frecuencia, diaPago, diaSemana);
    
    // Límite de seguridad para evitar loops infinitos
    if (fechas.length > 1000) break;
  }

  return fechas;
}

/**
 * Obtiene el período en formato string según la frecuencia
 * @param {Date} fecha - Fecha
 * @param {String} frecuencia - Frecuencia
 * @returns {String} Período en formato "YYYY-MM", "YYYY-WW", etc.
 */
function obtenerPeriodo(fecha, frecuencia) {
  const fechaObj = new Date(fecha);
  const año = fechaObj.getFullYear();
  const mes = String(fechaObj.getMonth() + 1).padStart(2, '0');

  switch (frecuencia) {
    case 'diario':
      const dia = String(fechaObj.getDate()).padStart(2, '0');
      return `${año}-${mes}-${dia}`;

    case 'semanal':
      // Calcular semana del año
      const inicioAño = new Date(año, 0, 1);
      const dias = Math.floor((fechaObj - inicioAño) / (24 * 60 * 60 * 1000));
      const semana = Math.ceil((dias + inicioAño.getDay() + 1) / 7);
      return `${año}-W${String(semana).padStart(2, '0')}`;

    case 'quincenal':
      const quincena = fechaObj.getDate() <= 15 ? '01' : '02';
      return `${año}-${mes}-Q${quincena}`;

    case 'mensual':
      return `${año}-${mes}`;

    case 'trimestral':
      const trimestre = Math.floor(fechaObj.getMonth() / 3) + 1;
      return `${año}-T${trimestre}`;

    case 'anual':
      return `${año}`;

    default:
      return `${año}-${mes}`;
  }
}

/**
 * Valida si una fecha está dentro del rango de una recurrencia
 * @param {Date} fecha - Fecha a validar
 * @param {Date} fechaInicio - Fecha de inicio de la recurrencia
 * @param {Date} fechaFin - Fecha fin (null = indefinido)
 * @returns {Boolean} True si está en el rango
 */
function estaEnRango(fecha, fechaInicio, fechaFin) {
  const fechaObj = new Date(fecha);
  fechaObj.setHours(0, 0, 0, 0);
  
  const inicio = new Date(fechaInicio);
  inicio.setHours(0, 0, 0, 0);
  
  if (fechaObj < inicio) return false;
  
  if (fechaFin) {
    const fin = new Date(fechaFin);
    fin.setHours(23, 59, 59, 999);
    return fechaObj <= fin;
  }
  
  return true;
}

/**
 * Formatea una fecha para respuestas de API
 * @param {Date} fecha - Fecha a formatear
 * @returns {String} Fecha en formato ISO 8601
 */
function formatearFecha(fecha) {
  if (!fecha) return null;
  return new Date(fecha).toISOString();
}

/**
 * Calcula días hasta una fecha
 * @param {Date} fecha - Fecha objetivo
 * @returns {Number} Días hasta la fecha (negativo si ya pasó)
 */
function diasHasta(fecha) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  
  const fechaObj = new Date(fecha);
  fechaObj.setHours(0, 0, 0, 0);
  
  const diferencia = fechaObj - hoy;
  return Math.ceil(diferencia / (1000 * 60 * 60 * 24));
}

/**
 * Obtiene el primer y último día del mes
 * @param {Number} año - Año
 * @param {Number} mes - Mes (1-12)
 * @returns {Object} { inicio, fin }
 */
function obtenerRangoMensual(año, mes) {
  const inicio = new Date(año, mes - 1, 1);
  inicio.setHours(0, 0, 0, 0);
  
  const fin = new Date(año, mes, 0);
  fin.setHours(23, 59, 59, 999);
  
  return { inicio, fin };
}

/**
 * Primer día de mes `diaPago` en o después de fechaRef (YYYY-MM-DD).
 */
function proximoDiaPagoDesde(fechaRefStr, diaPago) {
  if (!fechaRefStr || diaPago == null) return null;
  const d = new Date(`${fechaRefStr}T12:00:00`);
  d.setHours(0, 0, 0, 0);
  let y = d.getFullYear();
  let m = d.getMonth();
  const dayStart = d.getDate();
  const lastDay = new Date(y, m + 1, 0).getDate();
  const target = Math.min(diaPago, lastDay);
  if (target >= dayStart) {
    return new Date(y, m, target);
  }
  const m2 = m + 1;
  const y2 = y + Math.floor(m2 / 12);
  const mNorm = ((m2 % 12) + 12) % 12;
  const last2 = new Date(y2, mNorm + 1, 0).getDate();
  return new Date(y2, mNorm, Math.min(diaPago, last2));
}

/**
 * Ciclo de facturación (corte) de una tarjeta que contiene `fechaRefStr`.
 * `fin` es el corte en o después de fechaRef; `inicio` es el día siguiente
 * al corte anterior (un mes antes de `fin`).
 * @returns {{inicio: Date, fin: Date}}
 */
function cicloDeCorte(fechaRefStr, fechaCorte) {
  // Mediodía (no medianoche ni 23:59:59.999): al serializar a ISO/UTC para el
  // frontend, un extremo del día en hora LOCAL del proceso puede desbordar al
  // día de calendario siguiente o anterior en UTC si el servidor no corre en
  // UTC — el mismo bug que corrigió el frontend para fechaVencimiento de
  // cuotas. Mediodía tiene margen de sobra para cualquier zona horaria real.
  const fin = proximoDiaPagoDesde(fechaRefStr, fechaCorte);
  fin.setHours(12, 0, 0, 0);

  // Un mes antes de "fin", recortado al último día de ese mes si es más
  // corto que fechaCorte (ej. corte=31: en febrero cae el 28/29, no se
  // desborda a marzo). `new Date(y, m, 0)` da el último día del mes
  // anterior a `m`.
  const y = fin.getFullYear();
  const m = fin.getMonth();
  const ultimoDiaMesAnterior = new Date(y, m, 0).getDate();
  const diaFinAnterior = Math.min(fechaCorte, ultimoDiaMesAnterior);
  const finAnterior = new Date(y, m - 1, diaFinAnterior);

  const inicio = new Date(finAnterior);
  inicio.setDate(inicio.getDate() + 1);
  inicio.setHours(12, 0, 0, 0);
  return { inicio, fin };
}

/** Última fecha: `restantes` pagos desde proximo (inclusive). */
function fechaUltimaCuotaDesdeProximo(proximo, frecuencia, restantes) {
  if (!proximo || restantes <= 0) return null;
  let cursor = new Date(proximo);
  cursor.setHours(0, 0, 0, 0);
  for (let i = 0; i < restantes - 1; i++) {
    cursor = calcularProximaFecha(cursor, frecuencia);
  }
  return cursor;
}

/**
 * Fechas de cuotas para calendario, ancladas en `proximoPago` (el campo que
 * `pagarCuota` mantiene al día paso a paso y que ya se muestra correctamente
 * en el detalle del plan), no en `fechaInicio`. Recalcular toda la serie
 * desde `fechaInicio` la desalinea del calendario cuando ese campo no
 * coincide exactamente con `proximoPago` (p. ej. planes con historial
 * previo a un cambio de lógica de creación): la cuota `cuotasPagadas + 1`
 * es por definición `proximoPago`; las anteriores se reconstruyen
 * retrocediendo desde ahí, y las futuras avanzando desde ahí.
 */
function obtenerFechasCuotaParaCalendario(cuota) {
  const total = Math.min(Math.max(1, cuota.cuotasTotal || 1), 48);
  if (!cuota.proximoPago) {
    return [];
  }
  const frecuencia = cuota.frecuenciaPago || 'mensual';
  const proximo = new Date(cuota.proximoPago);
  proximo.setHours(0, 0, 0, 0);
  const diaPago = proximo.getDate();
  const diaSemana = proximo.getDay();

  const pagadas = Math.max(0, Math.min(cuota.cuotasPagadas || 0, total));
  const numeroProximo = pagadas + 1; // número de cuota al que corresponde `proximoPago`

  const out = [];
  for (let numeroCuota = 1; numeroCuota <= total; numeroCuota++) {
    let fecha = new Date(proximo);
    if (numeroCuota < numeroProximo) {
      for (let i = 0; i < numeroProximo - numeroCuota; i++) {
        fecha = calcularFechaAnterior(fecha, frecuencia, diaPago, diaSemana);
      }
    } else if (numeroCuota > numeroProximo) {
      for (let i = 0; i < numeroCuota - numeroProximo; i++) {
        fecha = calcularProximaFecha(fecha, frecuencia, diaPago, diaSemana);
      }
    }
    fecha.setHours(0, 0, 0, 0);
    out.push({ fecha, numeroCuota });
  }
  return out;
}

module.exports = {
  calcularProximaFecha,
  calcularFechasEntre,
  obtenerPeriodo,
  estaEnRango,
  formatearFecha,
  diasHasta,
  obtenerRangoMensual,
  proximoDiaPagoDesde,
  cicloDeCorte,
  fechaUltimaCuotaDesdeProximo,
  obtenerFechasCuotaParaCalendario
};
