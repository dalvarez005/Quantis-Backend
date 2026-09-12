const prisma = require('../../adapters/persistence/prismaClient');
const cuentaRepo = require('../../adapters/persistence/cuentaRepository');

const NOMBRE_CUENTA_EFECTIVO = 'Efectivo';

/** Error específico: falta elegir/crear cuenta para registrar el movimiento. */
class CuentaRequeridaError extends Error {
  constructor(moneda, ambigua = false) {
    super(
      ambigua
        ? `Tienes más de una cuenta en ${moneda}. Elige con cuál registrar este movimiento.`
        : `No tienes ninguna cuenta en ${moneda}. Crea una cuenta en ${moneda} antes de registrar movimientos en esa moneda.`
    );
    this.name = 'CuentaRequeridaError';
    this.isCuentaRequerida = true;
    this.moneda = moneda;
  }
}

/**
 * La cuenta es obligatoria: nunca se crea ni se usa "Efectivo" como default
 * en ninguna moneda, ni siquiera si ya existe una cuenta con ese nombre
 * (pudo quedar de antes de esta regla). Si no viene cuenta en el body,
 * solo se autoselecciona cuando no hay ninguna ambigüedad posible — hay
 * exactamente una cuenta REAL (nombre distinto de "Efectivo") activa en
 * esa moneda; en cualquier otro caso (0, o 2+) se rechaza el movimiento
 * pidiendo elegir/crear una cuenta a propósito.
 */
async function resolveCuentaIdForMovimiento(userId, cuentaIdFromBody, moneda) {
  const raw =
    cuentaIdFromBody != null && String(cuentaIdFromBody).trim() !== ''
      ? String(cuentaIdFromBody).trim()
      : null;
  if (raw) return raw;

  const activasReales = await prisma.cuenta.findMany({
    where: {
      userId,
      moneda,
      esActiva: true,
      NOT: { nombre: { equals: NOMBRE_CUENTA_EFECTIVO, mode: 'insensitive' } }
    },
    select: { id: true },
    take: 2
  });
  if (activasReales.length === 1) return activasReales[0].id;

  throw new CuentaRequeridaError(moneda, activasReales.length > 1);
}

async function validateCuentaParaMovimiento(userId, cuentaId, moneda) {
  if (!cuentaId) return { valid: true };
  const c = await prisma.cuenta.findFirst({
    where: { id: cuentaId, userId }
  });
  if (!c) {
    return { valid: false, message: 'Cuenta no encontrada' };
  }
  if (!c.esActiva) {
    return { valid: false, message: 'La cuenta no está activa' };
  }
  if (c.moneda !== moneda) {
    return { valid: false, message: 'La moneda no coincide con la cuenta' };
  }
  return { valid: true };
}

async function listCuentas(userId, { moneda, esActiva } = {}) {
  const filters = {};
  if (moneda) filters.moneda = moneda;
  if (esActiva !== undefined && esActiva !== '') {
    filters.esActiva = esActiva === true || esActiva === 'true';
  }
  return cuentaRepo.listByUser(userId, filters);
}

async function getCuentaById(id, userId) {
  return cuentaRepo.findByIdForUser(id, userId);
}

async function createCuenta(userId, { id, nombre, moneda, saldoInicial }) {
  return cuentaRepo.create({
    id,
    userId,
    nombre,
    moneda,
    saldoInicial: saldoInicial != null ? Number(saldoInicial) : 0,
    esActiva: true
  });
}

async function updateCuenta(id, userId, data) {
  const existing = await cuentaRepo.findByIdForUser(id, userId);
  if (!existing) return null;
  return cuentaRepo.update(id, data);
}

/**
 * Revierte en `cuota` el pago que representa `gasto` (mismo efecto que
 * borrar ese gasto individualmente vía deleteGasto): quita su entrada del
 * historial, resta 1 a cuotasPagadas y recalcula proximoPago/estado. Se usa
 * al borrar en bloque un gasto que quedó ligado tanto a una cuenta como a
 * una cuota (posible si se le asignó cuenta manualmente al editarlo), para
 * que borrar la cuenta no deje la cuota marcada como pagada de más.
 */
async function revertirPagoCuotaDeGasto(tx, userId, gasto) {
  if (!gasto.cuotaId || gasto.numeroCuotaPago == null) return;
  const cuota = await tx.cuota.findFirst({ where: { id: gasto.cuotaId, userId } });
  if (!cuota) return;

  const numeroQuitar = gasto.numeroCuotaPago;
  const historial = Array.isArray(cuota.historialPagos) ? [...cuota.historialPagos] : [];
  const entrada = historial.find((p) => p.numeroCuota === numeroQuitar);
  if (!entrada) return;

  const nuevaHist = historial.filter((p) => p.numeroCuota !== numeroQuitar);
  const cuotasPagadas = Math.max(0, (cuota.cuotasPagadas || 0) - 1);
  const proximoPago = new Date(entrada.fecha);
  proximoPago.setHours(0, 0, 0, 0);
  let estado = cuota.estado;
  if (estado === 'pagada') {
    estado = proximoPago < new Date() ? 'vencida' : 'activa';
  }
  await tx.cuota.update({
    where: { id: cuota.id },
    data: { historialPagos: nuevaHist, cuotasPagadas, proximoPago, estado }
  });
}

/**
 * Elimina la cuenta (desactivándola) y, junto con ella, TODOS los ingresos y
 * gastos que tenía asociados — a petición explícita: al borrar una cuenta
 * no debe quedar historial huérfano de movimientos que ya no tienen dónde
 * verse. Es irreversible; la confirmación de esto vive en el frontend.
 * Devuelve { cuenta, gastosEliminados, ingresosEliminados } o null si la
 * cuenta no existe / no es del usuario.
 */
async function softDeleteCuenta(id, userId) {
  const existing = await cuentaRepo.findByIdForUser(id, userId);
  if (!existing) return null;

  const result = await prisma.$transaction(async (tx) => {
    const [gastosDeLaCuenta, ingresosDeLaCuenta] = await Promise.all([
      tx.gasto.findMany({ where: { userId, cuentaId: id } }),
      tx.ingreso.findMany({ where: { userId, cuentaId: id }, select: { id: true } })
    ]);
    for (const gasto of gastosDeLaCuenta) {
      await revertirPagoCuotaDeGasto(tx, userId, gasto);
    }

    // Si alguno de estos movimientos vino de una recurrencia, borrar
    // también su marca en TransaccionGenerada — si no, el generador de
    // recurrencias la sigue viendo como "ya generada" para ese período y
    // nunca vuelve a crear el ingreso/gasto que se acaba de borrar.
    const transaccionIds = [
      ...gastosDeLaCuenta.map((g) => g.id),
      ...ingresosDeLaCuenta.map((i) => i.id)
    ];
    if (transaccionIds.length > 0) {
      await tx.transaccionGenerada.deleteMany({
        where: { userId, transaccionId: { in: transaccionIds } }
      });
    }

    const gastosEliminados = await tx.gasto.deleteMany({ where: { userId, cuentaId: id } });
    const ingresosEliminados = await tx.ingreso.deleteMany({ where: { userId, cuentaId: id } });
    const cuenta = await tx.cuenta.update({ where: { id }, data: { esActiva: false } });

    return {
      cuenta,
      gastosEliminados: gastosEliminados.count,
      ingresosEliminados: ingresosEliminados.count
    };
  });

  return result;
}

/** Cuántos ingresos/gastos se perderían si se elimina esta cuenta (para pedir confirmación informada). */
async function contarMovimientosDeCuenta(id, userId) {
  const cuenta = await cuentaRepo.findByIdForUser(id, userId);
  if (!cuenta) return null;
  const [gastos, ingresos] = await Promise.all([
    prisma.gasto.count({ where: { userId, cuentaId: id } }),
    prisma.ingreso.count({ where: { userId, cuentaId: id } })
  ]);
  return { gastos, ingresos };
}

module.exports = {
  resolveCuentaIdForMovimiento,
  validateCuentaParaMovimiento,
  listCuentas,
  getCuentaById,
  createCuenta,
  updateCuenta,
  softDeleteCuenta,
  contarMovimientosDeCuenta,
  CuentaRequeridaError
};
