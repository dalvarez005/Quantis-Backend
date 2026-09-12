const prisma = require('../../adapters/persistence/prismaClient');

async function userMini(userId) {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true }
  });
  if (!u) return null;
  return { _id: u.id, name: u.name, email: u.email };
}

async function tarjetaMini(id) {
  if (!id) return null;
  const t = await prisma.tarjeta.findUnique({
    where: { id },
    select: {
      id: true,
      nombre: true,
      banco: true,
      tipo: true,
      limiteCredito: true,
      saldoActual: true,
      disponible: true
    }
  });
  if (!t) return null;
  return {
    _id: t.id,
    nombre: t.nombre,
    banco: t.banco,
    tipo: t.tipo,
    limiteCredito: t.limiteCredito,
    saldoActual: t.saldoActual,
    disponible: t.disponible
  };
}

/** Igual que tarjetaMini pero para varias tarjetas a la vez (evita N+1). */
async function tarjetaMiniMap(ids) {
  const unicos = [...new Set((ids || []).filter(Boolean))];
  if (unicos.length === 0) return new Map();
  const rows = await prisma.tarjeta.findMany({
    where: { id: { in: unicos } },
    select: {
      id: true,
      nombre: true,
      banco: true,
      tipo: true,
      limiteCredito: true,
      saldoActual: true,
      disponible: true
    }
  });
  const map = new Map();
  for (const t of rows) {
    map.set(t.id, {
      _id: t.id,
      nombre: t.nombre,
      banco: t.banco,
      tipo: t.tipo,
      limiteCredito: t.limiteCredito,
      saldoActual: t.saldoActual,
      disponible: t.disponible
    });
  }
  return map;
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
  tarjetaMini,
  tarjetaMiniMap,
  nestResumenIngresos,
  nestResumenGastos
};
