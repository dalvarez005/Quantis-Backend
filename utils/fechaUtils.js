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
 * Fechas de cuotas para calendario: misma serie que con 0 pagadas (fechaInicio → fechaVencimiento),
 * priorizando fecha real en historialPagos por número de cuota. Así aparecen cuotas pasadas estimadas
 * aunque no exista movimiento en historial, y las futuras aunque proximoPago no venga en el select.
 */
function obtenerFechasCuotaParaCalendario(cuota) {
  const total = Math.min(Math.max(1, cuota.cuotasTotal || 1), 48);
  if (!cuota.fechaInicio || !cuota.fechaVencimiento) {
    return [];
  }
  const historial = Array.isArray(cuota.historialPagos) ? cuota.historialPagos : [];
  const byNum = new Map();
  for (const h of historial) {
    if (h && typeof h.numeroCuota === 'number' && h.fecha) {
      const d = new Date(h.fecha);
      if (!Number.isNaN(d.getTime())) {
        byNum.set(h.numeroCuota, d);
      }
    }
  }
  const diaPago = new Date(cuota.fechaInicio).getDate();
  const diaSemana = new Date(cuota.fechaInicio).getDay();
  const fechasPago = calcularFechasEntre(
    cuota.fechaInicio,
    cuota.fechaVencimiento,
    cuota.frecuenciaPago || 'mensual',
    diaPago,
    diaSemana
  );
  const n = Math.min(total, fechasPago.length);
  const out = [];
  for (let i = 0; i < n; i++) {
    const numeroCuota = i + 1;
    const dHist = byNum.get(numeroCuota);
    const dSynth = fechasPago[i];
    const fecha = dHist || dSynth;
    if (!fecha) continue;
    const copy = new Date(fecha);
    copy.setHours(0, 0, 0, 0);
    out.push({ fecha: copy, numeroCuota });
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
  fechaUltimaCuotaDesdeProximo,
  obtenerFechasCuotaParaCalendario
};
