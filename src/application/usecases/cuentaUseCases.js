const prisma = require('../../adapters/persistence/prismaClient');
const cuentaRepo = require('../../adapters/persistence/cuentaRepository');

/**
 * Si no viene cuenta en el body, usa la cuenta predeterminada del usuario si coincide la moneda.
 */
async function resolveCuentaIdForMovimiento(userId, cuentaIdFromBody, moneda) {
  const raw =
    cuentaIdFromBody != null && String(cuentaIdFromBody).trim() !== ''
      ? String(cuentaIdFromBody).trim()
      : null;
  if (raw) return raw;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { cuentaDefaultId: true }
  });
  if (!user?.cuentaDefaultId) return undefined;

  const c = await prisma.cuenta.findFirst({
    where: {
      id: user.cuentaDefaultId,
      userId,
      esActiva: true,
      moneda
    }
  });
  return c ? c.id : undefined;
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

async function softDeleteCuenta(id, userId) {
  return cuentaRepo.softDelete(id, userId);
}

module.exports = {
  resolveCuentaIdForMovimiento,
  validateCuentaParaMovimiento,
  listCuentas,
  getCuentaById,
  createCuenta,
  updateCuenta,
  softDeleteCuenta
};
