const { validationResult } = require('express-validator');
const prisma = require('../src/adapters/persistence/prismaClient');
const { newObjectId } = require('../src/domain/id');

const DEFAULT_TIPOS_INGRESO = [
  { slug: 'quincena', label: 'Quincena', iconKey: 'WalletIcon' },
  { slug: 'fin_mes', label: 'Fin de Mes', iconKey: 'CurrencyDollarIcon' },
  { slug: 'comision', label: 'Comisión', iconKey: 'ArrowTrendingUpIcon' }
];

const DEFAULT_TIPOS_GASTO = [
  { slug: 'alimentacion', label: 'Alimentación', iconKey: 'ShoppingCartIcon' },
  { slug: 'transporte', label: 'Transporte', iconKey: 'TruckIcon' },
  { slug: 'otros', label: 'Otros', iconKey: 'EllipsisHorizontalCircleIcon' }
];

const toSlug = (text = '') => {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 60);
};

const getTiposTransaccion = async (req, res) => {
  try {
    const { tipo } = req.query;
    const userId = req.user._id;

    if (!tipo || !['ingreso', 'gasto'].includes(tipo)) {
      return res.status(400).json({
        success: false,
        message: 'El parámetro tipo debe ser "ingreso" o "gasto"'
      });
    }

    const tiposUsuario = await prisma.tipoTransaccion.findMany({
      where: { userId, tipo },
      orderBy: { createdAt: 'asc' }
    });

    const defaults =
      tipo === 'ingreso' ? DEFAULT_TIPOS_INGRESO : DEFAULT_TIPOS_GASTO;

    res.json({
      success: true,
      data: {
        tipo,
        tipos: [
          ...defaults.map((t) => ({ ...t, isDefault: true })),
          ...tiposUsuario.map((t) => ({
            id: t.id,
            slug: t.slug,
            label: t.label,
            iconKey: t.iconKey,
            color: t.color || null,
            isDefault: false
          }))
        ]
      }
    });
  } catch (error) {
    console.error('Error obteniendo tipos de transacción:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

const createTipoTransaccion = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Datos de entrada inválidos',
        errors: errors.array()
      });
    }

    const { tipo, label, iconKey, color } = req.body;
    const userId = req.user._id;

    const slug = toSlug(label);
    if (!slug) {
      return res.status(400).json({
        success: false,
        message: 'No se pudo generar un identificador válido para el tipo'
      });
    }

    const existente = await prisma.tipoTransaccion.findFirst({
      where: { userId, tipo, slug }
    });
    if (existente) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe un tipo con ese nombre para este usuario'
      });
    }

    try {
      const tipoTransaccion = await prisma.tipoTransaccion.create({
        data: {
          id: newObjectId(),
          userId,
          tipo,
          slug,
          label: label.trim(),
          iconKey: iconKey || null,
          color: color || null
        }
      });

      res.status(201).json({
        success: true,
        message: 'Tipo de transacción creado exitosamente',
        data: {
          id: tipoTransaccion.id,
          slug: tipoTransaccion.slug,
          label: tipoTransaccion.label,
          iconKey: tipoTransaccion.iconKey,
          color: tipoTransaccion.color,
          isDefault: false
        }
      });
    } catch (error) {
      if (error.code === 'P2002') {
        return res.status(400).json({
          success: false,
          message: 'Ya existe un tipo con ese nombre para este usuario'
        });
      }
      throw error;
    }
  } catch (error) {
    console.error('Error creando tipo de transacción:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

const deleteTipoTransaccion = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const del = await prisma.tipoTransaccion.deleteMany({
      where: { id, userId }
    });

    if (del.count === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tipo no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Tipo eliminado correctamente'
    });
  } catch (error) {
    console.error('Error eliminando tipo de transacción:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

module.exports = {
  getTiposTransaccion,
  createTipoTransaccion,
  deleteTipoTransaccion
};
