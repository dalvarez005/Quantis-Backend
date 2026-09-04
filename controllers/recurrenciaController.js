const { validationResult } = require('express-validator');
const prisma = require('../src/adapters/persistence/prismaClient');
const { newObjectId } = require('../src/domain/id');
const {
  serializeIngresoRecurrente,
  serializeGastoRecurrente,
  serializeIngreso,
  serializeGasto
} = require('../src/adapters/persistence/serialize');
const {
  generarIngresosRecurrentes,
  generarGastosRecurrentes
} = require('../services/recurrenciaService');
const { validateCuentaParaMovimiento } = require('../src/application/usecases/cuentaUseCases');
const { userMini } = require('../src/application/queries/aggregateHelpers');

const getIngresosRecurrentes = async (req, res) => {
  try {
    const userId = req.user._id;
    const rows = await prisma.ingresoRecurrente.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
    const ingresosRecurrentes = rows.map((r) => serializeIngresoRecurrente(r));
    res.json({
      success: true,
      data: { ingresosRecurrentes }
    });
  } catch (error) {
    console.error('Error obteniendo ingresos recurrentes:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

const getIngresoRecurrenteById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const row = await prisma.ingresoRecurrente.findFirst({
      where: { id, userId }
    });

    if (!row) {
      return res.status(404).json({
        success: false,
        message: 'Ingreso recurrente no encontrado'
      });
    }

    res.json({
      success: true,
      data: { ingresoRecurrente: serializeIngresoRecurrente(row) }
    });
  } catch (error) {
    console.error('Error obteniendo ingreso recurrente:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

const createIngresoRecurrente = async (req, res) => {
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
    const b = req.body;

    if (b.cuentaId) {
      const check = await validateCuentaParaMovimiento(
        userId,
        b.cuentaId,
        b.moneda
      );
      if (!check.valid) {
        return res.status(400).json({
          success: false,
          message: check.message
        });
      }
    }

    const row = await prisma.ingresoRecurrente.create({
      data: {
        id: newObjectId(),
        userId,
        nombre: b.nombre,
        monto: b.monto,
        moneda: b.moneda,
        frecuencia: b.frecuencia,
        diaPago: b.diaPago,
        diaSemana: b.diaSemana,
        fechaInicio: new Date(b.fechaInicio),
        fechaFin: b.fechaFin ? new Date(b.fechaFin) : null,
        esActivo: b.esActivo !== false,
        categoria: b.categoria,
        descripcion: b.descripcion,
        ultimaGeneracion: b.ultimaGeneracion
          ? new Date(b.ultimaGeneracion)
          : null,
        cuentaId: b.cuentaId || null
      }
    });

    res.status(201).json({
      success: true,
      message: 'Ingreso recurrente creado exitosamente',
      data: { ingresoRecurrente: serializeIngresoRecurrente(row) }
    });
  } catch (error) {
    console.error('Error creando ingreso recurrente:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

const updateIngresoRecurrente = async (req, res) => {
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
    const b = req.body;
    const data = { ...b };
    if (data.fechaInicio) data.fechaInicio = new Date(data.fechaInicio);
    if (data.fechaFin) data.fechaFin = new Date(data.fechaFin);
    if (data.ultimaGeneracion)
      data.ultimaGeneracion = new Date(data.ultimaGeneracion);

    const row = await prisma.ingresoRecurrente.updateMany({
      where: { id, userId },
      data
    });

    if (row.count === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ingreso recurrente no encontrado'
      });
    }

    const updated = await prisma.ingresoRecurrente.findFirst({
      where: { id, userId }
    });

    res.json({
      success: true,
      message: 'Ingreso recurrente actualizado exitosamente',
      data: { ingresoRecurrente: serializeIngresoRecurrente(updated) }
    });
  } catch (error) {
    console.error('Error actualizando ingreso recurrente:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

const deleteIngresoRecurrente = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const del = await prisma.ingresoRecurrente.deleteMany({
      where: { id, userId }
    });

    if (del.count === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ingreso recurrente no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Ingreso recurrente eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error eliminando ingreso recurrente:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

const getGastosRecurrentes = async (req, res) => {
  try {
    const userId = req.user._id;
    const rows = await prisma.gastoRecurrente.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
    const gastosRecurrentes = rows.map((r) => serializeGastoRecurrente(r));
    res.json({
      success: true,
      data: { gastosRecurrentes }
    });
  } catch (error) {
    console.error('Error obteniendo gastos recurrentes:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

const getGastoRecurrenteById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const row = await prisma.gastoRecurrente.findFirst({
      where: { id, userId }
    });

    if (!row) {
      return res.status(404).json({
        success: false,
        message: 'Gasto recurrente no encontrado'
      });
    }

    res.json({
      success: true,
      data: { gastoRecurrente: serializeGastoRecurrente(row) }
    });
  } catch (error) {
    console.error('Error obteniendo gasto recurrente:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

const createGastoRecurrente = async (req, res) => {
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
    const b = req.body;

    if (b.cuentaId) {
      const check = await validateCuentaParaMovimiento(
        userId,
        b.cuentaId,
        b.moneda
      );
      if (!check.valid) {
        return res.status(400).json({
          success: false,
          message: check.message
        });
      }
    }

    const row = await prisma.gastoRecurrente.create({
      data: {
        id: newObjectId(),
        userId,
        nombre: b.nombre,
        monto: b.monto,
        moneda: b.moneda,
        frecuencia: b.frecuencia,
        diaPago: b.diaPago,
        diaSemana: b.diaSemana,
        fechaInicio: new Date(b.fechaInicio),
        fechaFin: b.fechaFin ? new Date(b.fechaFin) : null,
        esActivo: b.esActivo !== false,
        categoria: b.categoria,
        metodoPago: b.metodoPago || 'tarjeta_credito',
        esSuscripcion: !!b.esSuscripcion,
        descripcion: b.descripcion,
        ultimaGeneracion: b.ultimaGeneracion
          ? new Date(b.ultimaGeneracion)
          : null,
        cuentaId: b.cuentaId || null
      }
    });

    res.status(201).json({
      success: true,
      message: 'Gasto recurrente creado exitosamente',
      data: { gastoRecurrente: serializeGastoRecurrente(row) }
    });
  } catch (error) {
    console.error('Error creando gasto recurrente:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

const updateGastoRecurrente = async (req, res) => {
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
    const b = req.body;
    const data = { ...b };
    if (data.fechaInicio) data.fechaInicio = new Date(data.fechaInicio);
    if (data.fechaFin) data.fechaFin = new Date(data.fechaFin);
    if (data.ultimaGeneracion)
      data.ultimaGeneracion = new Date(data.ultimaGeneracion);

    const row = await prisma.gastoRecurrente.updateMany({
      where: { id, userId },
      data
    });

    if (row.count === 0) {
      return res.status(404).json({
        success: false,
        message: 'Gasto recurrente no encontrado'
      });
    }

    const updated = await prisma.gastoRecurrente.findFirst({
      where: { id, userId }
    });

    res.json({
      success: true,
      message: 'Gasto recurrente actualizado exitosamente',
      data: { gastoRecurrente: serializeGastoRecurrente(updated) }
    });
  } catch (error) {
    console.error('Error actualizando gasto recurrente:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

const deleteGastoRecurrente = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const del = await prisma.gastoRecurrente.deleteMany({
      where: { id, userId }
    });

    if (del.count === 0) {
      return res.status(404).json({
        success: false,
        message: 'Gasto recurrente no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Gasto recurrente eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error eliminando gasto recurrente:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

const generarTransaccion = async (req, res) => {
  try {
    const { tipo, id } = req.params;
    const userId = req.user._id;
    const pop = await userMini(userId);

    if (tipo === 'ingreso') {
      const ingresoRecurrente = await prisma.ingresoRecurrente.findFirst({
        where: { id, userId }
      });
      if (!ingresoRecurrente) {
        return res.status(404).json({
          success: false,
          message: 'Ingreso recurrente no encontrado'
        });
      }

      const ingresos = await generarIngresosRecurrentes(ingresoRecurrente);
      res.json({
        success: true,
        message: `${ingresos.length} ingreso(s) generado(s)`,
        data: { ingresos: ingresos.map((i) => serializeIngreso(i, pop)) }
      });
    } else if (tipo === 'gasto') {
      const gastoRecurrente = await prisma.gastoRecurrente.findFirst({
        where: { id, userId }
      });
      if (!gastoRecurrente) {
        return res.status(404).json({
          success: false,
          message: 'Gasto recurrente no encontrado'
        });
      }

      const gastos = await generarGastosRecurrentes(gastoRecurrente);
      res.json({
        success: true,
        message: `${gastos.length} gasto(s) generado(s)`,
        data: { gastos: gastos.map((g) => serializeGasto(g, pop)) }
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Tipo inválido. Debe ser "ingreso" o "gasto"'
      });
    }
  } catch (error) {
    console.error('Error generando transacción:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

module.exports = {
  getIngresosRecurrentes,
  getIngresoRecurrenteById,
  createIngresoRecurrente,
  updateIngresoRecurrente,
  deleteIngresoRecurrente,
  getGastosRecurrentes,
  getGastoRecurrenteById,
  createGastoRecurrente,
  updateGastoRecurrente,
  deleteGastoRecurrente,
  generarTransaccion
};
