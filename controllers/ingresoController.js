const { validationResult } = require('express-validator');
const prisma = require('../src/adapters/persistence/prismaClient');
const { newObjectId } = require('../src/domain/id');
const { serializeIngreso } = require('../src/adapters/persistence/serialize');
const {
  userMini,
  nestResumenIngresos
} = require('../src/application/queries/aggregateHelpers');
const {
  resolveCuentaIdForMovimiento,
  validateCuentaParaMovimiento
} = require('../src/application/usecases/cuentaUseCases');

const getIngresos = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      tipo,
      moneda,
      fechaInicio,
      fechaFin,
      cuentaId
    } = req.query;
    const userId = req.user._id;

    const where = { userId };
    if (tipo) where.tipo = tipo;
    if (moneda) where.moneda = moneda;
    if (cuentaId) where.cuentaId = cuentaId;
    if (fechaInicio || fechaFin) {
      where.fecha = {};
      if (fechaInicio) where.fecha.gte = new Date(fechaInicio);
      if (fechaFin) where.fecha.lte = new Date(fechaFin);
    }

    const skip = (page - 1) * limit;
    const [rows, total] = await Promise.all([
      prisma.ingreso.findMany({
        where,
        orderBy: { fecha: 'desc' },
        skip,
        take: parseInt(limit, 10)
      }),
      prisma.ingreso.count({ where })
    ]);

    const pop = await userMini(userId);
    const ingresos = rows.map((r) => serializeIngreso(r, pop));

    res.json({
      success: true,
      data: {
        ingresos,
        pagination: {
          currentPage: parseInt(page, 10),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit, 10)
        }
      }
    });
  } catch (error) {
    console.error('Error obteniendo ingresos:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

const getIngresoById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const row = await prisma.ingreso.findFirst({
      where: { id, userId }
    });

    if (!row) {
      return res.status(404).json({
        success: false,
        message: 'Ingreso no encontrado'
      });
    }

    const pop = await userMini(userId);
    res.json({
      success: true,
      data: { ingreso: serializeIngreso(row, pop) }
    });
  } catch (error) {
    console.error('Error obteniendo ingreso:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

const createIngreso = async (req, res) => {
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
      tipo,
      monto,
      moneda,
      fecha,
      descripcion,
      esRecurrente = false,
      cuentaId: cuentaIdBody
    } = req.body;
    const userId = req.user._id;

    const cuentaId = await resolveCuentaIdForMovimiento(
      userId,
      cuentaIdBody,
      moneda
    );

    const check = await validateCuentaParaMovimiento(userId, cuentaId, moneda);
    if (!check.valid) {
      return res.status(400).json({
        success: false,
        message: check.message
      });
    }

    const row = await prisma.ingreso.create({
      data: {
        id: newObjectId(),
        userId,
        tipo,
        monto,
        moneda,
        fecha: fecha ? new Date(fecha) : new Date(),
        descripcion,
        esRecurrente,
        cuentaId: cuentaId || undefined
      }
    });

    const pop = await userMini(userId);
    res.status(201).json({
      success: true,
      message: 'Ingreso creado exitosamente',
      data: { ingreso: serializeIngreso(row, pop) }
    });
  } catch (error) {
    console.error('Error creando ingreso:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

const updateIngreso = async (req, res) => {
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
      'tipo',
      'monto',
      'moneda',
      'fecha',
      'descripcion',
      'esRecurrente',
      'cuentaId'
    ];
    const data = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) {
        if (k === 'cuentaId' && req.body[k] === null) {
          data[k] = null;
        } else {
          data[k] = k === 'fecha' ? new Date(req.body[k]) : req.body[k];
        }
      }
    }

    const existing = await prisma.ingreso.findFirst({ where: { id, userId } });
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Ingreso no encontrado'
      });
    }
    const monedaFinal = data.moneda !== undefined ? data.moneda : existing.moneda;
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

    const row = await prisma.ingreso.updateMany({
      where: { id, userId },
      data
    });

    if (row.count === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ingreso no encontrado'
      });
    }

    const updated = await prisma.ingreso.findFirst({ where: { id, userId } });
    const pop = await userMini(userId);
    res.json({
      success: true,
      message: 'Ingreso actualizado exitosamente',
      data: { ingreso: serializeIngreso(updated, pop) }
    });
  } catch (error) {
    console.error('Error actualizando ingreso:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

const deleteIngreso = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const del = await prisma.ingreso.deleteMany({ where: { id, userId } });

    if (del.count === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ingreso no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Ingreso eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error eliminando ingreso:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

const getResumenIngresos = async (req, res) => {
  try {
    const { mes, año, fechaInicio, fechaFin, cuentaId, sinCuenta } = req.query;
    const userId = req.user._id;

    const where = { userId };
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

    const grouped = await prisma.ingreso.groupBy({
      by: ['tipo', 'moneda'],
      where,
      _sum: { monto: true },
      _count: true
    });

    const resumen = nestResumenIngresos(grouped);

    const totalesGenerales = await prisma.ingreso.groupBy({
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

    res.json({
      success: true,
      data: {
        resumen,
        totalesGenerales: totalesMapped,
        periodo:
          (fechaInicio || fechaFin)
            ? `${fechaInicio || '-'} a ${fechaFin || '-'}`
            : (mes && año ? `${mes}/${año}` : 'Todos los períodos')
      }
    });
  } catch (error) {
    console.error('Error obteniendo resumen de ingresos:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

const getDashboardIngresos = async (req, res) => {
  try {
    const userId = req.user._id;
    const { moneda } = req.query;

    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    inicioMes.setHours(0, 0, 0, 0);

    const where = { userId, fecha: { gte: inicioMes } };
    if (moneda) where.moneda = moneda;

    const totalMes = await prisma.ingreso.groupBy({
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

    const ultimosIngresos = await prisma.ingreso.findMany({
      where,
      orderBy: { fecha: 'desc' },
      take: 5,
      select: {
        tipo: true,
        monto: true,
        moneda: true,
        fecha: true,
        descripcion: true,
        esRecurrente: true
      }
    });

    const ingresosPorTipo = await prisma.ingreso.groupBy({
      by: ['tipo'],
      where,
      _sum: { monto: true },
      _count: true,
      orderBy: { _sum: { monto: 'desc' } },
      take: 5
    });

    const ingresosPorTipoMapped = ingresosPorTipo.map((g) => ({
      _id: g.tipo,
      total: g._sum.monto || 0,
      cantidad: g._count._all
    }));

    const inicioMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    inicioMesAnterior.setHours(0, 0, 0, 0);
    const finMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth(), 0, 23, 59, 59);

    const whereAnt = {
      userId,
      fecha: { gte: inicioMesAnterior, lte: finMesAnterior }
    };
    if (moneda) whereAnt.moneda = moneda;

    const totalMesAnterior = await prisma.ingreso.groupBy({
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
        ultimosIngresos,
        ingresosPorTipo: ingresosPorTipoMapped,
        periodo: `${hoy.getMonth() + 1}/${hoy.getFullYear()}`
      }
    });
  } catch (error) {
    console.error('Error obteniendo dashboard de ingresos:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

module.exports = {
  getIngresos,
  getIngresoById,
  createIngreso,
  updateIngreso,
  deleteIngreso,
  getResumenIngresos,
  getDashboardIngresos
};
