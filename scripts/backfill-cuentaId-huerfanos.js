/**
 * Asigna una cuenta "Efectivo" (creándola si hace falta) a cualquier gasto o
 * ingreso que haya quedado con cuentaId nulo — datos de antes de que
 * resolveCuentaIdForMovimiento garantizara que todo movimiento tenga cuenta.
 *
 * Sin esto, esos movimientos quedan invisibles en el carrusel de Balance del
 * dashboard (que ya no tiene un slide "Sin cuenta"), aunque sí se sigan
 * contando en "Todas las cuentas" — un descuadre silencioso entre el total y
 * la suma de cuentas visibles.
 *
 * Uso:
 *   node scripts/backfill-cuentaId-huerfanos.js          # dry-run (solo imprime)
 *   node scripts/backfill-cuentaId-huerfanos.js --apply  # aplica los cambios
 */
const prisma = require('../src/adapters/persistence/prismaClient');
const { newObjectId } = require('../src/domain/id');

const NOMBRE_CUENTA_EFECTIVO = 'Efectivo';

async function obtenerOCrearCuentaEfectivo(userId, moneda, cache, apply) {
  const key = `${userId}:${moneda}`;
  if (cache.has(key)) return cache.get(key);

  const existente = await prisma.cuenta.findFirst({
    where: {
      userId,
      moneda,
      esActiva: true,
      nombre: { equals: NOMBRE_CUENTA_EFECTIVO, mode: 'insensitive' }
    }
  });
  if (existente) {
    cache.set(key, existente);
    return existente;
  }

  if (!apply) {
    const fake = { id: '(se creará)' };
    cache.set(key, fake);
    return fake;
  }

  const creada = await prisma.cuenta.create({
    data: {
      id: newObjectId(),
      userId,
      nombre: NOMBRE_CUENTA_EFECTIVO,
      moneda,
      saldoInicial: 0,
      esActiva: true
    }
  });
  cache.set(key, creada);
  return creada;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const cache = new Map();

  const gastos = await prisma.gasto.findMany({
    where: { cuentaId: null },
    select: { id: true, userId: true, moneda: true, descripcion: true }
  });
  const ingresos = await prisma.ingreso.findMany({
    where: { cuentaId: null },
    select: { id: true, userId: true, moneda: true, descripcion: true }
  });

  console.log(`${gastos.length} gasto(s) y ${ingresos.length} ingreso(s) sin cuenta.`);

  for (const g of gastos) {
    const cuenta = await obtenerOCrearCuentaEfectivo(g.userId, g.moneda, cache, apply);
    console.log(`  gasto ${g.id} "${g.descripcion || ''}" (${g.moneda}) -> cuenta ${cuenta.id}`);
    if (apply) {
      await prisma.gasto.update({ where: { id: g.id }, data: { cuentaId: cuenta.id } });
    }
  }

  for (const i of ingresos) {
    const cuenta = await obtenerOCrearCuentaEfectivo(i.userId, i.moneda, cache, apply);
    console.log(`  ingreso ${i.id} "${i.descripcion || ''}" (${i.moneda}) -> cuenta ${cuenta.id}`);
    if (apply) {
      await prisma.ingreso.update({ where: { id: i.id }, data: { cuentaId: cuenta.id } });
    }
  }

  console.log(apply ? '\nAplicado.' : '\nEjecuta con --apply para corregir.');
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
