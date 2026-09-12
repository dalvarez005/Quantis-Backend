const prisma = require('../src/adapters/persistence/prismaClient');
const { newObjectId } = require('../src/domain/id');
const {
  resolveCuentaIdForMovimiento
} = require('../src/application/usecases/cuentaUseCases');
const {
  calcularProximaFecha,
  obtenerPeriodo,
  estaEnRango
} = require('../utils/fechaUtils');

async function generarIngresosRecurrentes(ingresoRecurrente, hastaFecha = null) {
  const ingresosGenerados = [];
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const fechaLimite = hastaFecha || ingresoRecurrente.fechaFin || new Date();
  fechaLimite.setHours(23, 59, 59, 999);

  let fechaGeneracion = ingresoRecurrente.ultimaGeneracion
    ? calcularProximaFecha(
        ingresoRecurrente.ultimaGeneracion,
        ingresoRecurrente.frecuencia,
        ingresoRecurrente.diaPago,
        ingresoRecurrente.diaSemana
      )
    : new Date(ingresoRecurrente.fechaInicio);

  fechaGeneracion.setHours(0, 0, 0, 0);

  if (
    !estaEnRango(
      fechaGeneracion,
      ingresoRecurrente.fechaInicio,
      ingresoRecurrente.fechaFin
    )
  ) {
    return ingresosGenerados;
  }

  const fechaMaxima = hastaFecha || hoy;

  while (fechaGeneracion <= fechaMaxima && fechaGeneracion <= fechaLimite) {
    const periodo = obtenerPeriodo(
      fechaGeneracion,
      ingresoRecurrente.frecuencia
    );

    const existeTransaccion = await prisma.transaccionGenerada.findFirst({
      where: {
        recurrenciaId: ingresoRecurrente.id,
        tipo: 'ingreso_recurrente',
        periodo
      }
    });

    if (!existeTransaccion) {
      let cuentaId = ingresoRecurrente.cuentaId || null;
      if (!cuentaId) {
        try {
          cuentaId = await resolveCuentaIdForMovimiento(
            ingresoRecurrente.userId,
            null,
            ingresoRecurrente.moneda
          );
        } catch (err) {
          if (err.isCuentaRequerida) {
            // Sin cuenta en esa moneda y no es la principal del usuario: no
            // se puede generar este ingreso recurrente ni los siguientes
            // períodos (misma causa). No se marca como generado, para que
            // se reintente solo si el usuario crea la cuenta.
            console.warn(
              `Recurrencia ${ingresoRecurrente.id}: ${err.message}`
            );
            break;
          }
          throw err;
        }
      }
      const nuevoIngreso = await prisma.ingreso.create({
        data: {
          id: newObjectId(),
          userId: ingresoRecurrente.userId,
          tipo: ingresoRecurrente.categoria || 'recurrente',
          monto: ingresoRecurrente.monto,
          moneda: ingresoRecurrente.moneda,
          fecha: fechaGeneracion,
          descripcion:
            ingresoRecurrente.descripcion ||
            `Ingreso recurrente: ${ingresoRecurrente.nombre}`,
          esRecurrente: true,
          ...(cuentaId ? { cuentaId } : {})
        }
      });

      await prisma.transaccionGenerada.create({
        data: {
          id: newObjectId(),
          tipo: 'ingreso_recurrente',
          recurrenciaId: ingresoRecurrente.id,
          recurrenciaModel: 'IngresoRecurrente',
          transaccionId: nuevoIngreso.id,
          transaccionModel: 'Ingreso',
          fechaGeneracion: hoy,
          periodo,
          userId: ingresoRecurrente.userId
        }
      });

      ingresosGenerados.push(nuevoIngreso);
    }

    fechaGeneracion = calcularProximaFecha(
      fechaGeneracion,
      ingresoRecurrente.frecuencia,
      ingresoRecurrente.diaPago,
      ingresoRecurrente.diaSemana
    );
    fechaGeneracion.setHours(0, 0, 0, 0);
  }

  if (ingresosGenerados.length > 0) {
    await prisma.ingresoRecurrente.update({
      where: { id: ingresoRecurrente.id },
      data: {
        ultimaGeneracion:
          ingresosGenerados[ingresosGenerados.length - 1].fecha
      }
    });
  }

  return ingresosGenerados;
}

async function generarGastosRecurrentes(gastoRecurrente, hastaFecha = null) {
  const gastosGenerados = [];
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const fechaLimite = hastaFecha || gastoRecurrente.fechaFin || new Date();
  fechaLimite.setHours(23, 59, 59, 999);

  let fechaGeneracion = gastoRecurrente.ultimaGeneracion
    ? calcularProximaFecha(
        gastoRecurrente.ultimaGeneracion,
        gastoRecurrente.frecuencia,
        gastoRecurrente.diaPago,
        gastoRecurrente.diaSemana
      )
    : new Date(gastoRecurrente.fechaInicio);

  fechaGeneracion.setHours(0, 0, 0, 0);

  if (
    !estaEnRango(
      fechaGeneracion,
      gastoRecurrente.fechaInicio,
      gastoRecurrente.fechaFin
    )
  ) {
    return gastosGenerados;
  }

  const fechaMaxima = hastaFecha || hoy;

  while (fechaGeneracion <= fechaMaxima && fechaGeneracion <= fechaLimite) {
    const periodo = obtenerPeriodo(
      fechaGeneracion,
      gastoRecurrente.frecuencia
    );

    const existeTransaccion = await prisma.transaccionGenerada.findFirst({
      where: {
        recurrenciaId: gastoRecurrente.id,
        tipo: 'gasto_recurrente',
        periodo
      }
    });

    if (!existeTransaccion) {
      let cuentaId = gastoRecurrente.cuentaId || null;
      if (!cuentaId) {
        try {
          cuentaId = await resolveCuentaIdForMovimiento(
            gastoRecurrente.userId,
            null,
            gastoRecurrente.moneda
          );
        } catch (err) {
          if (err.isCuentaRequerida) {
            // Sin cuenta en esa moneda y no es la principal del usuario: no
            // se puede generar este gasto recurrente ni los siguientes
            // períodos (misma causa). No se marca como generado, para que
            // se reintente solo si el usuario crea la cuenta.
            console.warn(
              `Recurrencia ${gastoRecurrente.id}: ${err.message}`
            );
            break;
          }
          throw err;
        }
      }
      const nuevoGasto = await prisma.gasto.create({
        data: {
          id: newObjectId(),
          userId: gastoRecurrente.userId,
          categoria: gastoRecurrente.categoria,
          monto: gastoRecurrente.monto,
          moneda: gastoRecurrente.moneda,
          fecha: fechaGeneracion,
          descripcion:
            gastoRecurrente.descripcion ||
            `Gasto recurrente: ${gastoRecurrente.nombre}`,
          esRecurrente: true,
          metodoPago: gastoRecurrente.metodoPago,
          ...(cuentaId ? { cuentaId } : {})
        }
      });

      await prisma.transaccionGenerada.create({
        data: {
          id: newObjectId(),
          tipo: 'gasto_recurrente',
          recurrenciaId: gastoRecurrente.id,
          recurrenciaModel: 'GastoRecurrente',
          transaccionId: nuevoGasto.id,
          transaccionModel: 'Gasto',
          fechaGeneracion: hoy,
          periodo,
          userId: gastoRecurrente.userId
        }
      });

      gastosGenerados.push(nuevoGasto);
    }

    fechaGeneracion = calcularProximaFecha(
      fechaGeneracion,
      gastoRecurrente.frecuencia,
      gastoRecurrente.diaPago,
      gastoRecurrente.diaSemana
    );
    fechaGeneracion.setHours(0, 0, 0, 0);
  }

  if (gastosGenerados.length > 0) {
    await prisma.gastoRecurrente.update({
      where: { id: gastoRecurrente.id },
      data: {
        ultimaGeneracion: gastosGenerados[gastosGenerados.length - 1].fecha
      }
    });
  }

  return gastosGenerados;
}

async function generarTodasLasRecurrencias(userId, hastaFecha = null) {
  const fechaLimite = hastaFecha || new Date();

  const ingresosRecurrentes = await prisma.ingresoRecurrente.findMany({
    where: { userId, esActivo: true }
  });

  const gastosRecurrentes = await prisma.gastoRecurrente.findMany({
    where: { userId, esActivo: true }
  });

  const ingresosGenerados = [];
  const gastosGenerados = [];

  for (const ir of ingresosRecurrentes) {
    const ingresos = await generarIngresosRecurrentes(ir, fechaLimite);
    ingresosGenerados.push(...ingresos);
  }

  for (const gr of gastosRecurrentes) {
    const gastos = await generarGastosRecurrentes(gr, fechaLimite);
    gastosGenerados.push(...gastos);
  }

  return {
    ingresos: ingresosGenerados,
    gastos: gastosGenerados,
    totalIngresos: ingresosGenerados.length,
    totalGastos: gastosGenerados.length
  };
}

function puedeGenerar(recurrencia) {
  if (!recurrencia.esActivo) return false;

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const fechaInicio = new Date(recurrencia.fechaInicio);
  fechaInicio.setHours(0, 0, 0, 0);

  if (hoy < fechaInicio) return false;

  if (recurrencia.fechaFin) {
    const fechaFin = new Date(recurrencia.fechaFin);
    fechaFin.setHours(23, 59, 59, 999);
    if (hoy > fechaFin) return false;
  }

  return true;
}

module.exports = {
  generarIngresosRecurrentes,
  generarGastosRecurrentes,
  generarTodasLasRecurrencias,
  puedeGenerar
};
