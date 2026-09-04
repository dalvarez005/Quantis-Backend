const prisma = require('./prismaClient');

function listByUser(userId, { moneda, esActiva } = {}) {
  const where = { userId };
  if (moneda) where.moneda = moneda;
  if (esActiva !== undefined) where.esActiva = esActiva;
  return prisma.cuenta.findMany({
    where,
    orderBy: [{ esActiva: 'desc' }, { nombre: 'asc' }]
  });
}

function findByIdForUser(id, userId) {
  return prisma.cuenta.findFirst({ where: { id, userId } });
}

function create(data) {
  return prisma.cuenta.create({ data });
}

function update(id, data) {
  return prisma.cuenta.update({ where: { id }, data });
}

async function softDelete(id, userId) {
  const row = await prisma.cuenta.findFirst({ where: { id, userId } });
  if (!row) return null;
  return prisma.cuenta.update({
    where: { id },
    data: { esActiva: false }
  });
}

module.exports = {
  listByUser,
  findByIdForUser,
  create,
  update,
  softDelete
};
