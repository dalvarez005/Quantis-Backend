const { validationResult } = require('express-validator');
const prisma = require('../src/adapters/persistence/prismaClient');
const { newObjectId } = require('../src/domain/id');
const { serializeTarjeta } = require('../src/adapters/persistence/serialize');
const { userMini } = require('../src/application/queries/aggregateHelpers');

const getTarjetas = async (req, res) => {
  try {
    const userId = req.user._id;
    const { tipo, esActiva } = req.query;

    const where = { userId };
    if (tipo) where.tipo = tipo;
    if (esActiva !== undefined) where.esActiva = esActiva === 'true';

    const rows = await prisma.tarjeta.findMany({
      where,
      orderBy: { nombre: 'asc' }
    });

    const tarjetas = rows.map((t) => serializeTarjeta(t));

    res.json({
      success: true,
      data: { tarjetas }
    });
  } catch (error) {
    console.error('Error obteniendo tarjetas:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

const getTarjetaById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const tarjeta = await prisma.tarjeta.findFirst({
      where: { id, userId }
    });

    if (!tarjeta) {
      return res.status(404).json({
        success: false,
        message: 'Tarjeta no encontrada'
      });
    }

    const cuotas = await prisma.cuota.findMany({
      where: { tarjetaId: id, userId }
    });

    const pop = await userMini(userId);
    res.json({
      success: true,
      data: {
        tarjeta: serializeTarjeta(tarjeta),
        cuotas: cuotas.map((c) => ({
          ...c,
          _id: c.id,
          user: userId,
          tarjeta: c.tarjetaId
        }))
      }
    });
  } catch (error) {
    console.error('Error obteniendo tarjeta:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

const createTarjeta = async (req, res) => {
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
    const datos = { ...req.body };

    if (datos.diaPago != null) {
      datos.diaPago = Math.min(
        31,
        Math.max(1, parseInt(datos.diaPago, 10) || 1)
      );
    }
    if (datos.fechaCorte != null) {
      datos.fechaCorte = Math.min(
        31,
        Math.max(1, parseInt(datos.fechaCorte, 10) || 1)
      );
    }
    if (datos.banco === '') delete datos.banco;
    if (datos.color === '') delete datos.color;

    let disponible = datos.disponible;
    if (datos.tipo === 'credito' && datos.limiteCredito && disponible == null) {
      disponible = datos.limiteCredito - (datos.saldoActual || 0);
    }

    const row = await prisma.tarjeta.create({
      data: {
        id: newObjectId(),
        userId,
        nombre: datos.nombre,
        tipo: datos.tipo,
        banco: datos.banco,
        numeroUltimosDigitos: datos.numeroUltimosDigitos,
        limiteCredito: datos.limiteCredito,
        moneda: datos.moneda,
        diaPago: datos.diaPago,
        fechaCorte: datos.fechaCorte,
        saldoActual: datos.saldoActual ?? 0,
        disponible: disponible ?? 0,
        esActiva: datos.esActiva !== false,
        descripcion: datos.descripcion,
        color: datos.color || ''
      }
    });

    res.status(201).json({
      success: true,
      message: 'Tarjeta creada exitosamente',
      data: { tarjeta: serializeTarjeta(row) }
    });
  } catch (error) {
    console.error('Error creando tarjeta:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

const updateTarjeta = async (req, res) => {
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
    const datos = { ...req.body };

    if (datos.diaPago != null) {
      datos.diaPago = Math.min(
        31,
        Math.max(1, parseInt(datos.diaPago, 10) || 1)
      );
    }
    if (datos.fechaCorte != null) {
      datos.fechaCorte = Math.min(
        31,
        Math.max(1, parseInt(datos.fechaCorte, 10) || 1)
      );
    }
    if (datos.banco === '') delete datos.banco;
    if (datos.color === '') delete datos.color;

    const existing = await prisma.tarjeta.findFirst({
      where: { id, userId }
    });
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Tarjeta no encontrada'
      });
    }

    const merged = { ...existing, ...datos };
    if (merged.tipo === 'credito' && merged.limiteCredito != null) {
      merged.disponible = Math.max(
        0,
        merged.limiteCredito - (merged.saldoActual || 0)
      );
    }

    const row = await prisma.tarjeta.update({
      where: { id },
      data: {
        nombre: merged.nombre,
        tipo: merged.tipo,
        banco: merged.banco,
        numeroUltimosDigitos: merged.numeroUltimosDigitos,
        limiteCredito: merged.limiteCredito,
        moneda: merged.moneda,
        diaPago: merged.diaPago,
        fechaCorte: merged.fechaCorte,
        saldoActual: merged.saldoActual,
        disponible: merged.disponible,
        esActiva: merged.esActiva,
        descripcion: merged.descripcion,
        color: merged.color
      }
    });

    res.json({
      success: true,
      message: 'Tarjeta actualizada exitosamente',
      data: { tarjeta: serializeTarjeta(row) }
    });
  } catch (error) {
    console.error('Error actualizando tarjeta:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

const deleteTarjeta = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const cuotasAsociadas = await prisma.cuota.count({
      where: { tarjetaId: id, userId }
    });

    if (cuotasAsociadas > 0) {
      return res.status(400).json({
        success: false,
        message: `No se puede eliminar la tarjeta porque tiene ${cuotasAsociadas} cuota(s) asociada(s).`
      });
    }

    const del = await prisma.tarjeta.deleteMany({ where: { id, userId } });

    if (del.count === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tarjeta no encontrada'
      });
    }

    res.json({
      success: true,
      message: 'Tarjeta eliminada exitosamente'
    });
  } catch (error) {
    console.error('Error eliminando tarjeta:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

const getResumenTarjetas = async (req, res) => {
  try {
    const userId = req.user._id;

    const tarjetas = await prisma.tarjeta.findMany({
      where: { userId, tipo: 'credito' }
    });

    const resumen = {
      total: tarjetas.length,
      activas: tarjetas.filter((t) => t.esActiva).length,
      limiteTotal: tarjetas.reduce((sum, t) => sum + (t.limiteCredito || 0), 0),
      saldoTotal: tarjetas.reduce((sum, t) => sum + (t.saldoActual || 0), 0),
      disponibleTotal: tarjetas.reduce((sum, t) => sum + (t.disponible || 0), 0)
    };

    res.json({
      success: true,
      data: { resumen }
    });
  } catch (error) {
    console.error('Error obteniendo resumen de tarjetas:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

module.exports = {
  getTarjetas,
  getTarjetaById,
  createTarjeta,
  updateTarjeta,
  deleteTarjeta,
  getResumenTarjetas
};
