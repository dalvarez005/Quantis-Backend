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

module.exports = {
  listByUser,
  findByIdForUser,
  create,
  update
};
