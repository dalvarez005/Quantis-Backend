const { validationResult } = require('express-validator');
const prisma = require('../src/adapters/persistence/prismaClient');
const { newObjectId } = require('../src/domain/id');
const { serializeCuenta } = require('../src/adapters/persistence/serialize');
const cuentaUseCases = require('../src/application/usecases/cuentaUseCases');

const getCuentas = async (req, res) => {
  try {
    const userId = req.user._id;
    const { moneda, esActiva } = req.query;
    const rows = await cuentaUseCases.listCuentas(userId, { moneda, esActiva });
    res.json({
      success: true,
      data: { cuentas: rows.map((c) => serializeCuenta(c)) }
    });
  } catch (error) {
    console.error('Error obteniendo cuentas:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

const getCuentaById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const row = await cuentaUseCases.getCuentaById(id, userId);
    if (!row) {
      return res.status(404).json({
        success: false,
        message: 'Cuenta no encontrada'
      });
    }
    res.json({
      success: true,
      data: { cuenta: serializeCuenta(row) }
    });
  } catch (error) {
    console.error('Error obteniendo cuenta:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

const createCuenta = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Datos de entrada inválidos',
        errors: errors.array()
      });
    }
    const { nombre, moneda } = req.body;
    const userId = req.user._id;
    const row = await cuentaUseCases.createCuenta(userId, {
      id: newObjectId(),
      nombre,
      moneda
    });
    res.status(201).json({
      success: true,
      message: 'Cuenta creada exitosamente',
      data: { cuenta: serializeCuenta(row) }
    });
  } catch (error) {
    console.error('Error creando cuenta:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

const updateCuenta = async (req, res) => {
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
    const allowed = ['nombre', 'moneda', 'esActiva'];
    const data = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) data[k] = req.body[k];
    }
    if (Object.keys(data).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No hay datos para actualizar'
      });
    }
    const row = await cuentaUseCases.updateCuenta(id, userId, data);
    if (!row) {
      return res.status(404).json({
        success: false,
        message: 'Cuenta no encontrada'
      });
    }
    res.json({
      success: true,
      message: 'Cuenta actualizada exitosamente',
      data: { cuenta: serializeCuenta(row) }
    });
  } catch (error) {
    console.error('Error actualizando cuenta:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

const deleteCuenta = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const row = await cuentaUseCases.softDeleteCuenta(id, userId);
    if (!row) {
      return res.status(404).json({
        success: false,
        message: 'Cuenta no encontrada'
      });
    }
    res.json({
      success: true,
      message: 'Cuenta desactivada exitosamente',
      data: { cuenta: serializeCuenta(row) }
    });
  } catch (error) {
    console.error('Error desactivando cuenta:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

/**
 * Saldos por cuenta (ingresos − gastos), agrupados por cuentaId y moneda.
 * Incluye movimientos sin cuenta (cuentaId null) como fila aparte.
 */
const getCuentasBalances = async (req, res) => {
  try {
    const userId = req.user._id;

    const [ingresosAgg, gastosAgg] = await Promise.all([
      prisma.ingreso.groupBy({
        by: ['cuentaId', 'moneda'],
        where: { userId },
        _sum: { monto: true }
      }),
      prisma.gasto.groupBy({
        by: ['cuentaId', 'moneda'],
        where: { userId },
        _sum: { monto: true }
      })
    ]);

    const mergeKey = (cuentaId, moneda) =>
      `${cuentaId === null || cuentaId === undefined ? 'null' : cuentaId}_${moneda}`;
    const map = new Map();

    ingresosAgg.forEach((row) => {
      const k = mergeKey(row.cuentaId, row.moneda);
      const prev = map.get(k) || {
        cuentaId: row.cuentaId,
        moneda: row.moneda,
        ingresos: 0,
        gastos: 0
      };
      prev.ingresos += Number(row._sum.monto || 0);
      map.set(k, prev);
    });

    gastosAgg.forEach((row) => {
      const k = mergeKey(row.cuentaId, row.moneda);
      const prev = map.get(k) || {
        cuentaId: row.cuentaId,
        moneda: row.moneda,
        ingresos: 0,
        gastos: 0
      };
      prev.gastos += Number(row._sum.monto || 0);
      map.set(k, prev);
    });

    const balances = Array.from(map.values()).map((b) => ({
      cuentaId: b.cuentaId,
      moneda: b.moneda,
      ingresos: b.ingresos,
      gastos: b.gastos,
      balance: b.ingresos - b.gastos
    }));

    res.json({
      success: true,
      data: { balances }
    });
  } catch (error) {
    console.error('Error obteniendo saldos por cuenta:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

module.exports = {
  getCuentas,
  getCuentaById,
  getCuentasBalances,
  createCuenta,
  updateCuenta,
  deleteCuenta
};
