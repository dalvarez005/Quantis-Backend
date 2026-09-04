const prisma = require('../../adapters/persistence/prismaClient');

async function userMini(userId) {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true }
  });
  if (!u) return null;
  return { _id: u.id, name: u.name, email: u.email };
}

/** Replica el resultado anidado de getResumenIngresos (Mongo aggregate) */
function nestResumenIngresos(flatRows) {
  const byTipo = new Map();
  for (const row of flatRows) {
    const tipo = row.tipo;
    const moneda = row.moneda;
    const total = row._sum.monto || 0;
    const cantidad = row._count._all;
    if (!byTipo.has(tipo)) byTipo.set(tipo, []);
    byTipo.get(tipo).push({ moneda, total, cantidad });
  }
  return Array.from(byTipo.entries()).map(([tipo, totales]) => ({
    _id: tipo,
    totales
  }));
}

/** Replica getResumenGastos nested */
function nestResumenGastos(flatRows) {
  const byCat = new Map();
  for (const row of flatRows) {
    const cat = row.categoria;
    const moneda = row.moneda;
    const total = row._sum.monto || 0;
    const cantidad = row._count._all;
    if (!byCat.has(cat)) byCat.set(cat, []);
    byCat.get(cat).push({ moneda, total, cantidad });
  }
  return Array.from(byCat.entries()).map(([categoria, totales]) => ({
    _id: categoria,
    totales
  }));
}

module.exports = {
  userMini,
  nestResumenIngresos,
  nestResumenGastos
};
