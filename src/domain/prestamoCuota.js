/** Lógica equivalente a los hooks pre('save') de Mongoose para préstamos y cuotas */

function applyPrestamoEstado(p) {
  const montoPendiente = Math.max(0, p.montoTotal - p.montoPagado);
  let estado = p.estado;
  if (montoPendiente <= 0) {
    estado = 'pagado';
  } else if (estado === 'activo' && new Date() > new Date(p.fechaVencimiento)) {
    estado = 'vencido';
  }
  return { ...p, estado, montoPendiente };
}

function prestamoProgresoPago(p) {
  if (!p.montoTotal) return 0;
  return Math.min(100, (p.montoPagado / p.montoTotal) * 100);
}

function prestamoDiasRestantes(p) {
  const hoy = new Date();
  const diferencia = new Date(p.fechaVencimiento) - hoy;
  return Math.ceil(diferencia / (1000 * 60 * 60 * 24));
}

function applyCuotaEstado(c) {
  const montoPendiente = Math.max(
    0,
    c.montoTotal - c.cuotasPagadas * c.montoCuota
  );
  let estado = c.estado;
  if (montoPendiente <= 0 && c.cuotasPagadas >= c.cuotasTotal) {
    estado = 'pagada';
  } else if (estado === 'activa' && new Date() > new Date(c.fechaVencimiento)) {
    estado = 'vencida';
  }
  return { ...c, estado, montoPendiente };
}

function cuotaProgresoPago(c) {
  if (!c.cuotasTotal) return 0;
  return Math.min(100, (c.cuotasPagadas / c.cuotasTotal) * 100);
}

module.exports = {
  applyPrestamoEstado,
  prestamoProgresoPago,
  prestamoDiasRestantes,
  applyCuotaEstado,
  cuotaProgresoPago
};
