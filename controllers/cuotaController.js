const { validationResult } = require('express-validator');
const prisma = require('../src/adapters/persistence/prismaClient');
const { newObjectId } = require('../src/domain/id');
const {
  calcularProximaFecha,
  proximoDiaPagoDesde,
  fechaUltimaCuotaDesdeProximo
} = require('../utils/fechaUtils');
const { applyCuotaEstado } = require('../src/domain/prestamoCuota');
const {
  serializeCuota,
  serializeGasto
} = require('../src/adapters/persistence/serialize');
const { userMini } = require('../src/application/queries/aggregateHelpers');

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

const getCuotas = async (req, res) => {
  try {
    const userId = req.user._id;
    const { estado } = req.query;

    const where = { userId };
    if (estado) where.estado = estado;

    const rows = await prisma.cuota.findMany({
      where,
      orderBy: { proximoPago: 'asc' },
      include: { tarjeta: true }
    });

    const cuotas = await Promise.all(
      rows.map(async (c) => {
        const t = c.tarjeta
          ? {
              _id: c.tarjeta.id,
              nombre: c.tarjeta.nombre,
              banco: c.tarjeta.banco,
              tipo: c.tarjeta.tipo
            }
          : null;
        return serializeCuota(c, t);
      })
    );

    res.json({
      success: true,
      data: { cuotas }
    });
  } catch (error) {
    console.error('Error obteniendo cuotas:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

const getCuotaById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const row = await prisma.cuota.findFirst({
      where: { id, userId },
      include: { tarjeta: true }
    });

    if (!row) {
      return res.status(404).json({
        success: false,
        message: 'Cuota no encontrada'
      });
    }

    const t = row.tarjeta
      ? await tarjetaMini(row.tarjeta.id)
      : null;
    res.json({
      success: true,
      data: { cuota: serializeCuota(row, t) }
    });
  } catch (error) {
    console.error('Error obteniendo cuota:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

const createCuota = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Datos de entrada inválidos',
        errors: errors.array()
      });
    }

    const userId = req.user._id;
    const datos = req.body;

    const cuotasPagadasRaw =
      datos.cuotasPagadas != null
        ? parseInt(String(datos.cuotasPagadas), 10)
        : 0;
    const cuotasPagadas = Number.isNaN(cuotasPagadasRaw)
      ? 0
      : Math.max(0, cuotasPagadasRaw);

    if (cuotasPagadas >= datos.cuotasTotal) {
      return res.status(400).json({
        success: false,
        message:
          'Las cuotas ya pagadas deben ser menores que el número total de cuotas'
      });
    }

    let proximoPago = datos.proximoPago
      ? new Date(datos.proximoPago)
      : null;
    if (!proximoPago && datos.fechaInicio && datos.frecuenciaPago) {
      let cursor = new Date(datos.fechaInicio);
      cursor.setHours(0, 0, 0, 0);
      for (let i = 0; i < cuotasPagadas; i++) {
        cursor = calcularProximaFecha(cursor, datos.frecuenciaPago);
      }
      proximoPago = cursor;
    }
    if (!proximoPago) {
      proximoPago = new Date(datos.fechaInicio || Date.now());
    }

    let row = await prisma.cuota.create({
      data: {
        id: newObjectId(),
        userId,
        nombre: datos.nombre,
        montoTotal: datos.montoTotal,
        montoCuota: datos.montoCuota,
        cuotasTotal: datos.cuotasTotal,
        cuotasPagadas,
        moneda: datos.moneda,
        frecuenciaPago: datos.frecuenciaPago,
        fechaInicio: new Date(datos.fechaInicio),
        fechaVencimiento: new Date(datos.fechaVencimiento),
        proximoPago,
        historialPagos: datos.historialPagos || [],
        descripcion: datos.descripcion,
        categoria: datos.categoria ?? null,
        estado: datos.estado ?? 'activa',
        notificaciones: datos.notificaciones || {},
        tarjetaId: datos.tarjeta || datos.tarjetaId || null,
        crearGastoAutomatico: datos.crearGastoAutomatico !== false
      }
    });

    const merged = applyCuotaEstado(row);
    row = await prisma.cuota.update({
      where: { id: row.id },
      data: { estado: merged.estado }
    });

    res.status(201).json({
      success: true,
      message: 'Cuota creada exitosamente',
      data: { cuota: serializeCuota(row, await tarjetaMini(row.tarjetaId)) }
    });
  } catch (error) {
    console.error('Error creando cuota:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

const updateCuota = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Datos de entrada inválidos',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const userId = req.user._id;
    const body = { ...req.body };
    if (body.fechaInicio) body.fechaInicio = new Date(body.fechaInicio);
    if (body.fechaVencimiento) body.fechaVencimiento = new Date(body.fechaVencimiento);
    if (body.proximoPago) body.proximoPago = new Date(body.proximoPago);
    if (body.tarjeta !== undefined) {
      body.tarjetaId = body.tarjeta || null;
      delete body.tarjeta;
    }
    delete body.user;
    delete body.userId;

    const existing = await prisma.cuota.findFirst({ where: { id, userId } });
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Cuota no encontrada'
      });
    }

    const needNorm =
      (existing.cuotasPagadas || 0) > 0 &&
      (body.tarjetaId !== undefined ||
        body.cuotasTotal !== undefined ||
        body.montoTotal !== undefined);

    if (needNorm) {
      const pagadas = existing.cuotasPagadas || 0;
      const tarjetaIdFinal =
        body.tarjetaId !== undefined ? body.tarjetaId : existing.tarjetaId;
      const tarjeta =
        tarjetaIdFinal &&
        (await prisma.tarjeta.findFirst({
          where: { id: tarjetaIdFinal, userId }
        }));
      const cuotasTotal =
        body.cuotasTotal !== undefined ? body.cuotasTotal : existing.cuotasTotal;
      const montoTotal =
        body.montoTotal !== undefined ? body.montoTotal : existing.montoTotal;
      if (cuotasTotal > 0 && montoTotal != null) {
        body.montoCuota = Math.round((montoTotal / cuotasTotal) * 100) / 100;
      }

      const frecuencia =
        body.frecuenciaPago !== undefined
          ? body.frecuenciaPago
          : existing.frecuenciaPago;

      let proximoPago =
        body.proximoPago !== undefined
          ? body.proximoPago
          : existing.proximoPago
            ? new Date(existing.proximoPago)
            : null;

      if (body.tarjetaId !== undefined && tarjeta?.diaPago) {
        const baseStr = proximoPago
          ? proximoPago.toISOString().slice(0, 10)
          : existing.fechaInicio
            ? new Date(existing.fechaInicio).toISOString().slice(0, 10)
            : null;
        const snapped = proximoDiaPagoDesde(baseStr, tarjeta.diaPago);
        if (snapped) proximoPago = snapped;
      }

      const restantes = Math.max(0, cuotasTotal - pagadas);
      const ultima = fechaUltimaCuotaDesdeProximo(proximoPago, frecuencia, restantes);
      if (proximoPago) body.proximoPago = proximoPago;
      if (ultima) body.fechaVencimiento = ultima;
    }

    let row = await prisma.cuota.update({
      where: { id },
      data: body
    });
    const merged = applyCuotaEstado(row);
    row = await prisma.cuota.update({
      where: { id },
      data: { estado: merged.estado }
    });

    res.json({
      success: true,
      message: 'Cuota actualizada exitosamente',
      data: { cuota: serializeCuota(row, await tarjetaMini(row.tarjetaId)) }
    });
  } catch (error) {
    console.error('Error actualizando cuota:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

const deleteCuota = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const permanente =
      req.query.permanente === 'true' ||
      req.query.permanente === '1' ||
      req.body?.permanente === true;

    const cuota = await prisma.cuota.findFirst({
      where: { id, userId }
    });

    if (!cuota) {
      return res.status(404).json({
        success: false,
        message: 'Cuota no encontrada'
      });
    }

    /** Eliminación definitiva: borra el plan; los gastos ya registrados quedan en Gastos (cuotaId → null por FK). */
    if (permanente) {
      await prisma.cuota.delete({ where: { id } });
      return res.json({
        success: true,
        message:
          'Plan eliminado. Los gastos que ya se generaron con los pagos siguen en tus movimientos; solo se quita el plan de cuotas.'
      });
    }

    if (cuota.estado === 'pagada') {
      await prisma.cuota.delete({ where: { id } });
    } else {
      await prisma.cuota.update({
        where: { id },
        data: { estado: 'cancelada' }
      });
    }

    res.json({
      success: true,
      message: 'Cuota eliminada/cancelada exitosamente'
    });
  } catch (error) {
    console.error('Error eliminando cuota:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

const pagarCuota = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Datos de entrada inválidos',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const userId = req.user._id;
    const { monto, fecha, nota } = req.body;

    let cuota = await prisma.cuota.findFirst({
      where: { id, userId }
    });

    if (!cuota) {
      return res.status(404).json({
        success: false,
        message: 'Cuota no encontrada'
      });
    }

    if (cuota.estado === 'pagada') {
      return res.status(400).json({
        success: false,
        message: 'Esta cuota ya está completamente pagada'
      });
    }

    const montoPendiente = Math.max(
      0,
      cuota.montoTotal - cuota.cuotasPagadas * cuota.montoCuota
    );
    const montoIngresado =
      typeof monto === 'number'
        ? monto
        : monto != null
          ? parseFloat(String(monto))
          : cuota.montoCuota;
    const esPagoCompleto = montoIngresado >= montoPendiente - 0.01;

    const fechaPago = fecha ? new Date(fecha) : new Date();
    let montoPago;
    let numeroCuota;
    let descripcionGasto;

    const historial = Array.isArray(cuota.historialPagos)
      ? [...cuota.historialPagos]
      : [];

    if (esPagoCompleto && montoPendiente > 0) {
      montoPago = montoPendiente;
      numeroCuota = cuota.cuotasPagadas + 1;
      const cuotasRestantes = cuota.cuotasTotal - cuota.cuotasPagadas;
      historial.push({
        fecha: fechaPago,
        monto: montoPago,
        numeroCuota,
        nota: (nota || '').trim() ? nota : 'Pago completo'
      });
      cuota = await prisma.cuota.update({
        where: { id: cuota.id },
        data: {
          historialPagos: historial,
          cuotasPagadas: cuota.cuotasTotal
        }
      });
      descripcionGasto = `Pago completo (${cuotasRestantes} cuotas) - ${cuota.nombre}${nota ? ` - ${nota}` : ''}`;
    } else {
      montoPago = montoIngresado || cuota.montoCuota;
      numeroCuota = cuota.cuotasPagadas + 1;
      historial.push({
        fecha: fechaPago,
        monto: montoPago,
        numeroCuota,
        nota: nota || ''
      });
      let prox = cuota.proximoPago;
      if (numeroCuota < cuota.cuotasTotal) {
        prox = calcularProximaFecha(
          cuota.proximoPago || new Date(),
          cuota.frecuenciaPago
        );
      }
      cuota = await prisma.cuota.update({
        where: { id: cuota.id },
        data: {
          historialPagos: historial,
          cuotasPagadas: numeroCuota,
          proximoPago: prox
        }
      });
      descripcionGasto = `Pago de cuota ${numeroCuota}/${cuota.cuotasTotal} - ${cuota.nombre}${nota ? ` - ${nota}` : ''}`;
    }

    const merged = applyCuotaEstado(cuota);
    cuota = await prisma.cuota.update({
      where: { id: cuota.id },
      data: { estado: merged.estado }
    });

    if (cuota.crearGastoAutomatico !== false) {
      try {
        const g = await prisma.gasto.create({
          data: {
            id: newObjectId(),
            userId,
            categoria: cuota.categoria || 'otros',
            monto: montoPago,
            moneda: cuota.moneda,
            fecha: fechaPago,
            descripcion: descripcionGasto,
            metodoPago: cuota.tarjetaId ? 'tarjeta_credito' : 'efectivo',
            esRecurrente: false,
            cuotaId: cuota.id,
            numeroCuotaPago: numeroCuota
          }
        });
        await serializeGasto(g, await userMini(userId));
      } catch (gastoError) {
        console.error(
          'Error creando gasto automático al pagar cuota:',
          gastoError
        );
      }
    }

    res.json({
      success: true,
      message: 'Pago registrado exitosamente',
      data: { cuota: serializeCuota(cuota, await tarjetaMini(cuota.tarjetaId)) }
    });
  } catch (error) {
    console.error('Error registrando pago:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

const getProximasCuotas = async (req, res) => {
  try {
    const userId = req.user._id;
    const { dias = 30 } = req.query;

    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() + parseInt(dias, 10));

    const rows = await prisma.cuota.findMany({
      where: {
        userId,
        estado: 'activa',
        proximoPago: { lte: fechaLimite }
      },
      orderBy: { proximoPago: 'asc' },
      take: 20,
      include: { tarjeta: true }
    });

    const cuotas = await Promise.all(
      rows.map(async (c) => {
        const t = c.tarjeta
          ? {
              _id: c.tarjeta.id,
              nombre: c.tarjeta.nombre,
              banco: c.tarjeta.banco,
              tipo: c.tarjeta.tipo
            }
          : null;
        return serializeCuota(c, t);
      })
    );

    res.json({
      success: true,
      data: { cuotas }
    });
  } catch (error) {
    console.error('Error obteniendo próximas cuotas:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

const getResumenCuotas = async (req, res) => {
  try {
    const userId = req.user._id;

    const cuotas = await prisma.cuota.findMany({ where: { userId } });

    const resumen = {
      total: cuotas.length,
      activas: cuotas.filter((c) => c.estado === 'activa').length,
      pagadas: cuotas.filter((c) => c.estado === 'pagada').length,
      vencidas: cuotas.filter((c) => c.estado === 'vencida').length,
      canceladas: cuotas.filter((c) => c.estado === 'cancelada').length,
      montoTotalPendiente: cuotas
        .filter((c) => c.estado === 'activa' || c.estado === 'vencida')
        .reduce(
          (sum, c) =>
            sum + (c.montoTotal - c.cuotasPagadas * c.montoCuota),
          0
        ),
      proximasVencimientos: cuotas
        .filter((c) => c.estado === 'activa')
        .sort((a, b) => a.proximoPago - b.proximoPago)
        .slice(0, 5)
        .map((c) => ({
          nombre: c.nombre,
          proximoPago: c.proximoPago,
          montoCuota: c.montoCuota
        }))
    };

    res.json({
      success: true,
      data: { resumen }
    });
  } catch (error) {
    console.error('Error obteniendo resumen de cuotas:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

module.exports = {
  getCuotas,
  getCuotaById,
  createCuota,
  updateCuota,
  deleteCuota,
  pagarCuota,
  getProximasCuotas,
  getResumenCuotas
};
