/**
 * Recalcula `fechaVencimiento` (última cuota) de todos los planes de cuotas
 * a partir de `fechaInicio` + `cuotasTotal` + `frecuenciaPago`.
 *
 * Corrige datos creados con el bug donde el frontend guardaba
 * fechaVencimiento a las 23:59:59.999 hora LOCAL del navegador: al
 * convertir a UTC (toISOString) en zonas detrás de UTC (p. ej.
 * America/Guatemala, UTC-6) el día de calendario se corría un día hacia
 * adelante (ej. "28 de marzo" quedaba guardado como "29 de marzo").
 *
 * Uso:
 *   node scripts/backfill-fecha-vencimiento-cuotas.js          # dry-run (solo imprime)
 *   node scripts/backfill-fecha-vencimiento-cuotas.js --apply  # aplica los cambios
 */
const prisma = require('../src/adapters/persistence/prismaClient');

// Aritmética de fechas en UTC puro (independiente de la zona horaria de la
// máquina donde corre el script): evita reintroducir el mismo tipo de bug
// que este script corrige. Replica exactamente la semántica "ciega" (sin
// diaPago) de calcularProximaFecha en utils/fechaUtils.js y
// src/utils/cuotaFechaUtils.js (frontend): si el día no existe en el mes
// destino, Date.UTC() lo desborda al mes siguiente (no lo recorta al
// último día) — mismo comportamiento que `fecha.setMonth(...)` en esas
// funciones.
function avanzarUTC(fecha, frecuencia) {
  const y = fecha.getUTCFullYear();
  const m = fecha.getUTCMonth();
  const d = fecha.getUTCDate();
  switch (frecuencia) {
    case 'diario':
      return new Date(Date.UTC(y, m, d + 1));
    case 'semanal':
      return new Date(Date.UTC(y, m, d + 7));
    case 'quincenal':
      return new Date(Date.UTC(y, m, d + 15));
    case 'trimestral':
      return new Date(Date.UTC(y, m + 3, d));
    case 'anual':
      return new Date(Date.UTC(y + 1, m, d));
    case 'mensual':
    default:
      return new Date(Date.UTC(y, m + 1, d));
  }
}

function fechaUltimaCuotaDesdePrimera(fechaInicio, cuotasTotal, frecuencia) {
  const total = Math.max(1, Math.floor(Number(cuotasTotal) || 1));
  const base = new Date(fechaInicio);
  let cursor = new Date(
    Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate())
  );
  for (let i = 0; i < total - 1; i++) {
    cursor = avanzarUTC(cursor, frecuencia || 'mensual');
  }
  return cursor;
}

function ymd(d) {
  return new Date(d).toISOString().slice(0, 10);
}

async function main() {
  const apply = process.argv.includes('--apply');
  const cuotas = await prisma.cuota.findMany({
    where: { cuotasTotal: { gt: 0 } }
  });

  let mismatches = 0;
  for (const c of cuotas) {
    if (!c.fechaInicio || !c.fechaVencimiento) continue;
    const correcta = fechaUltimaCuotaDesdePrimera(
      c.fechaInicio,
      c.cuotasTotal,
      c.frecuenciaPago
    );
    const actualYmd = ymd(c.fechaVencimiento);
    const correctaYmd = ymd(correcta);
    if (actualYmd !== correctaYmd) {
      mismatches++;
      console.log(
        `Cuota ${c.id} "${c.nombre}": fechaVencimiento ${actualYmd} -> ${correctaYmd}`
      );
      if (apply) {
        await prisma.cuota.update({
          where: { id: c.id },
          data: { fechaVencimiento: correcta }
        });
      }
    }
  }

  console.log(
    `\n${mismatches} de ${cuotas.length} cuota(s) con fechaVencimiento incorrecta.` +
      (apply ? ' Aplicado.' : ' Ejecuta con --apply para corregir.')
  );
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
