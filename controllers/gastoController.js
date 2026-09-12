const { validationResult } = require('express-validator');
const prisma = require('../src/adapters/persistence/prismaClient');
const { newObjectId } = require('../src/domain/id');
const { serializeGasto } = require('../src/adapters/persistence/serialize');
const {
  userMini,
  tarjetaMini,
  tarjetaMiniMap,
  nestResumenGastos
} = require('../src/application/queries/aggregateHelpers');
const {
  resolveCuentaIdForMovimiento,
  validateCuentaParaMovimiento
} = require('../src/application/usecases/cuentaUseCases');

async function validateTarjetaParaGasto(userId, tarjetaId) {
  if (!tarjetaId) return { valid: true };
  const tarjeta = await prisma.tarjeta.findFirst({
    where: { id: tarjetaId, userId }
  });
  if (!tarjeta) {
    return { valid: false, message: 'Tarjeta no encontrada' };
  }
  return { valid: true, tarjeta };
}

const getGastos = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      categoria,
      moneda,
      fechaInicio,
      fechaFin,
      cuentaId,
      tarjetaId
    } = req.query;
    const userId = req.user._id;

    const where = { userId };
    if (categoria) where.categoria = categoria;
    if (moneda) where.moneda = moneda;
    if (cuentaId) where.cuentaId = cuentaId;
    if (tarjetaId) where.tarjetaId = tarjetaId;
    if (fechaInicio || fechaFin) {
      where.fecha = {};
      if (fechaInicio) where.fecha.gte = new Date(fechaInicio);
      if (fechaFin) where.fecha.lte = new Date(fechaFin);
    }

    const skip = (page - 1) * limit;
    const [rows, total] = await Promise.all([
      prisma.gasto.findMany({
        where,
        orderBy: { fecha: 'desc' },
        skip,
        take: parseInt(limit, 10)
      }),
      prisma.gasto.count({ where })
    ]);

    const pop = await userMini(userId);
    const tarjetas = await tarjetaMiniMap(rows.map((r) => r.tarjetaId));
    const gastos = rows.map((r) =>
      serializeGasto(r, pop, tarjetas.get(r.tarjetaId))
    );

    res.json({
      success: true,
      data: {
        gastos,
        pagination: {
          currentPage: parseInt(page, 10),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit, 10)
        }
      }
    });
  } catch (error) {
    console.error('Error obteniendo gastos:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

const getGastoById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const row = await prisma.gasto.findFirst({
      where: { id, userId }
    });

    if (!row) {
      return res.status(404).json({
        success: false,
        message: 'Gasto no encontrado'
      });
    }

    const pop = await userMini(userId);
    res.json({
      success: true,
      data: { gasto: serializeGasto(row, pop, await tarjetaMini(row.tarjetaId)) }
    });
  } catch (error) {
    console.error('Error obteniendo gasto:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

const createGasto = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Datos de entrada inválidos',
        errors: errors.array()
      });
    }

    const {
      categoria,
      monto,
      moneda,
      fecha,
      descripcion,
      esRecurrente = false,
      metodoPago = 'efectivo',
      cuentaId: cuentaIdBody,
      tarjetaId,
      esPagoTarjeta = false
    } = req.body;
    const userId = req.user._id;

    // Un gasto pagado con tarjeta de crédito no sale de ninguna cuenta de
    // efectivo/banco: se vuelve deuda de la tarjeta. Solo se resuelve/crea
    // cuenta cuando el pago sí es un movimiento de cuenta real.
    const esCredito = metodoPago === 'tarjeta_credito' && !esPagoTarjeta;
    const cuentaId = esCredito
      ? undefined
      : await resolveCuentaIdForMovimiento(userId, cuentaIdBody, moneda);

    const check = await validateCuentaParaMovimiento(userId, cuentaId, moneda);
    if (!check.valid) {
      return res.status(400).json({
        success: false,
        message: check.message
      });
    }

    const checkTarjeta = await validateTarjetaParaGasto(userId, tarjetaId);
    if (!checkTarjeta.valid) {
      return res.status(400).json({
        success: false,
        message: checkTarjeta.message
      });
    }

    const row = await prisma.gasto.create({
      data: {
        id: newObjectId(),
        userId,
        categoria,
        monto,
        moneda,
        fecha: fecha ? new Date(fecha) : new Date(),
        descripcion,
        esRecurrente,
        metodoPago,
        cuentaId: cuentaId || undefined,
        tarjetaId: tarjetaId || undefined,
        esPagoTarjeta
      }
    });

    const pop = await userMini(userId);
    res.status(201).json({
      success: true,
      message: 'Gasto creado exitosamente',
      data: { gasto: serializeGasto(row, pop, checkTarjeta.tarjeta ? await tarjetaMini(tarjetaId) : null) }
    });
  } catch (error) {
    if (error.isCuentaRequerida) {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error('Error creando gasto:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

const updateGasto = async (req, res) => {
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
    const allowed = [
      'categoria',
      'monto',
      'moneda',
      'fecha',
      'descripcion',
      'esRecurrente',
      'metodoPago',
      'cuotaId',
      'numeroCuotaPago',
      'cuentaId',
      'tarjetaId',
      'esPagoTarjeta'
    ];
    const data = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) {
        if ((k === 'cuentaId' || k === 'tarjetaId') && req.body[k] === null) {
          data[k] = null;
        } else {
          data[k] = k === 'fecha' ? new Date(req.body[k]) : req.body[k];
        }
      }
    }

    const existing = await prisma.gasto.findFirst({ where: { id, userId } });
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Gasto no encontrado'
      });
    }
    const monedaFinal = data.moneda !== undefined ? data.moneda : existing.moneda;
    const metodoPagoFinal =
      data.metodoPago !== undefined ? data.metodoPago : existing.metodoPago;
    const esPagoTarjetaFinal =
      data.esPagoTarjeta !== undefined ? data.esPagoTarjeta : existing.esPagoTarjeta;
    if (metodoPagoFinal === 'tarjeta_credito' && !esPagoTarjetaFinal) {
      data.cuentaId = null;
    }
    const cuentaIdFinal =
      data.cuentaId !== undefined ? data.cuentaId : existing.cuentaId;
    const check = await validateCuentaParaMovimiento(
      userId,
      cuentaIdFinal,
      monedaFinal
    );
    if (!check.valid) {
      return res.status(400).json({
        success: false,
        message: check.message
      });
    }

    const tarjetaIdFinal =
      data.tarjetaId !== undefined ? data.tarjetaId : existing.tarjetaId;
    const checkTarjeta = await validateTarjetaParaGasto(userId, tarjetaIdFinal);
    if (!checkTarjeta.valid) {
      return res.status(400).json({
        success: false,
        message: checkTarjeta.message
      });
    }

    const updated = await prisma.gasto.updateMany({
      where: { id, userId },
      data
    });

    if (updated.count === 0) {
      return res.status(404).json({
        success: false,
        message: 'Gasto no encontrado'
      });
    }

    const row = await prisma.gasto.findFirst({ where: { id, userId } });
    const pop = await userMini(userId);
    res.json({
      success: true,
      message: 'Gasto actualizado exitosamente',
      data: { gasto: serializeGasto(row, pop, await tarjetaMini(row.tarjetaId)) }
    });
  } catch (error) {
    console.error('Error actualizando gasto:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

const deleteGasto = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const gasto = await prisma.gasto.findFirst({
      where: { id, userId }
    });

    if (!gasto) {
      return res.status(404).json({
        success: false,
        message: 'Gasto no encontrado'
      });
    }

    if (gasto.cuotaId && gasto.numeroCuotaPago != null) {
      const cuota = await prisma.cuota.findFirst({
        where: { id: gasto.cuotaId, userId }
      });
      if (cuota) {
        const numeroQuitar = gasto.numeroCuotaPago;
        const historial = Array.isArray(cuota.historialPagos)
          ? [...cuota.historialPagos]
          : [];
        const entrada = historial.find((p) => p.numeroCuota === numeroQuitar);
        if (entrada) {
          const nuevaHist = historial.filter(
            (p) => p.numeroCuota !== numeroQuitar
          );
          let cuotasPagadas = Math.max(0, (cuota.cuotasPagadas || 0) - 1);
          let proximoPago = new Date(entrada.fecha);
          proximoPago.setHours(0, 0, 0, 0);
          let estado = cuota.estado;
          if (estado === 'pagada') {
            estado = proximoPago < new Date() ? 'vencida' : 'activa';
          }
          await prisma.cuota.update({
            where: { id: cuota.id },
            data: {
              historialPagos: nuevaHist,
              cuotasPagadas,
              proximoPago,
              estado
            }
          });
        }
      }
    }

    await prisma.gasto.deleteMany({ where: { id, userId } });

    res.json({
      success: true,
      message: 'Gasto eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error eliminando gasto:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

const getResumenGastos = async (req, res) => {
  try {
    const { mes, año, fechaInicio, fechaFin, cuentaId, sinCuenta } = req.query;
    const userId = req.user._id;

    // Un pago de tarjeta (esPagoTarjeta) no es un gasto nuevo: el gasto ya
    // se contó cuando se hizo la compra con la tarjeta. Incluirlo aquí
    // duplicaría el monto en "total gastado".
    const where = { userId, esPagoTarjeta: false };
    // Scope por cuenta (mutuamente excluyente): cuentaId > sinCuenta
    if (cuentaId) {
      where.cuentaId = String(cuentaId);
    } else if (String(sinCuenta).toLowerCase() === 'true') {
      where.cuentaId = null;
    }

    // Rango por fechas: prioridad fechaInicio/fechaFin; fallback mes/año
    if (fechaInicio || fechaFin) {
      where.fecha = {};
      if (fechaInicio) {
        const d = new Date(fechaInicio);
        d.setHours(0, 0, 0, 0);
        where.fecha.gte = d;
      }
      if (fechaFin) {
        const d = new Date(fechaFin);
        d.setHours(23, 59, 59, 999);
        where.fecha.lte = d;
      }
    } else if (mes && año) {
      const m = Number(mes);
      const y = Number(año);
      const dIni = new Date(y, m - 1, 1);
      dIni.setHours(0, 0, 0, 0);
      const dFin = new Date(y, m, 0);
      dFin.setHours(23, 59, 59, 999);
      where.fecha = { gte: dIni, lte: dFin };
    }

    const grouped = await prisma.gasto.groupBy({
      by: ['categoria', 'moneda'],
      where,
      _sum: { monto: true },
      _count: true
    });

    const resumen = nestResumenGastos(grouped);

    const totalesGenerales = await prisma.gasto.groupBy({
      by: ['moneda'],
      where,
      _sum: { monto: true },
      _count: true
    });

    const totalesMapped = totalesGenerales.map((g) => ({
      _id: g.moneda,
      total: g._sum.monto || 0,
      cantidad: g._count._all
    }));

    const gastosPorMetodoPago = await prisma.gasto.groupBy({
      by: ['metodoPago'],
      where,
      _sum: { monto: true },
      _count: true
    });

    const metodoMapped = gastosPorMetodoPago.map((g) => ({
      _id: g.metodoPago,
      total: g._sum.monto || 0,
      cantidad: g._count._all
    }));

    res.json({
      success: true,
      data: {
        resumen,
        totalesGenerales: totalesMapped,
        gastosPorMetodoPago: metodoMapped,
        periodo:
          (fechaInicio || fechaFin)
            ? `${fechaInicio || '-'} a ${fechaFin || '-'}`
            : (mes && año ? `${mes}/${año}` : 'Todos los períodos')
      }
    });
  } catch (error) {
    console.error('Error obteniendo resumen de gastos:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

const getDashboardGastos = async (req, res) => {
  try {
    const userId = req.user._id;
    const { moneda } = req.query;

    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    inicioMes.setHours(0, 0, 0, 0);

    const where = { userId, esPagoTarjeta: false, fecha: { gte: inicioMes } };
    if (moneda) where.moneda = moneda;

    const totalMes = await prisma.gasto.groupBy({
      by: ['moneda'],
      where,
      _sum: { monto: true },
      _count: true
    });

    const totalMesMapped = totalMes.map((g) => ({
      _id: g.moneda,
      total: g._sum.monto || 0,
      cantidad: g._count._all
    }));

    const ultimosGastos = await prisma.gasto.findMany({
      where,
      orderBy: { fecha: 'desc' },
      take: 5,
      select: {
        categoria: true,
        monto: true,
        moneda: true,
        fecha: true,
        descripcion: true,
        metodoPago: true,
        esRecurrente: true
      }
    });

    const gastosPorCategoria = await prisma.gasto.groupBy({
      by: ['categoria'],
      where,
      _sum: { monto: true },
      _count: true,
      orderBy: { _sum: { monto: 'desc' } },
      take: 5
    });

    const gastosPorCategoriaMapped = gastosPorCategoria.map((g) => ({
      _id: g.categoria,
      total: g._sum.monto || 0,
      cantidad: g._count._all
    }));

    const gastosPorMetodoPago = await prisma.gasto.groupBy({
      by: ['metodoPago'],
      where,
      _sum: { monto: true },
      _count: true,
      orderBy: { _sum: { monto: 'desc' } }
    });

    const metodoMapped = gastosPorMetodoPago.map((g) => ({
      _id: g.metodoPago,
      total: g._sum.monto || 0,
      cantidad: g._count._all
    }));

    const inicioMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    inicioMesAnterior.setHours(0, 0, 0, 0);
    const finMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth(), 0, 23, 59, 59);

    const whereAnt = {
      userId,
      esPagoTarjeta: false,
      fecha: { gte: inicioMesAnterior, lte: finMesAnterior }
    };
    if (moneda) whereAnt.moneda = moneda;

    const totalMesAnterior = await prisma.gasto.groupBy({
      by: ['moneda'],
      where: whereAnt,
      _sum: { monto: true }
    });

    const totalMesAnteriorMapped = totalMesAnterior.map((g) => ({
      _id: g.moneda,
      total: g._sum.monto || 0
    }));

    res.json({
      success: true,
      data: {
        totalMes: totalMesMapped,
        totalMesAnterior: totalMesAnteriorMapped,
        ultimosGastos,
        gastosPorCategoria: gastosPorCategoriaMapped,
        gastosPorMetodoPago: metodoMapped,
        periodo: `${hoy.getMonth() + 1}/${hoy.getFullYear()}`
      }
    });
  } catch (error) {
    console.error('Error obteniendo dashboard de gastos:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

module.exports = {
  getGastos,
  getGastoById,
  createGasto,
  updateGasto,
  deleteGasto,
  getResumenGastos,
  getDashboardGastos
};
