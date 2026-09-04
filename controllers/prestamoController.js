const { validationResult } = require('express-validator');
const prisma = require('../src/adapters/persistence/prismaClient');
const { newObjectId } = require('../src/domain/id');
const { applyPrestamoEstado } = require('../src/domain/prestamoCuota');
const { serializePrestamo } = require('../src/adapters/persistence/serialize');

const getPrestamos = async (req, res) => {
  try {
    const userId = req.user._id;
    const { tipo, estado } = req.query;

    const where = { userId };
    if (tipo) where.tipo = tipo;
    if (estado) where.estado = estado;

    const rows = await prisma.prestamo.findMany({
      where,
      orderBy: { fechaVencimiento: 'asc' }
    });

    const prestamos = rows.map((p) => serializePrestamo(p));

    res.json({
      success: true,
      data: { prestamos }
    });
  } catch (error) {
    console.error('Error obteniendo préstamos:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

const getPrestamoById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const row = await prisma.prestamo.findFirst({
      where: { id, userId }
    });

    if (!row) {
      return res.status(404).json({
        success: false,
        message: 'Préstamo no encontrado'
      });
    }

    res.json({
      success: true,
      data: { prestamo: serializePrestamo(row) }
    });
  } catch (error) {
    console.error('Error obteniendo préstamo:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

const createPrestamo = async (req, res) => {
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
    const body = req.body;

    let row = await prisma.prestamo.create({
      data: {
        id: newObjectId(),
        userId,
        tipo: body.tipo,
        nombre: body.nombre,
        montoTotal: body.montoTotal,
        montoPagado: body.montoPagado ?? 0,
        moneda: body.moneda,
        fechaInicio: new Date(body.fechaInicio),
        fechaVencimiento: new Date(body.fechaVencimiento),
        tasaInteres: body.tasaInteres ?? 0,
        frecuenciaPago: body.frecuenciaPago || 'mensual',
        historialPagos: body.historialPagos || [],
        estado: body.estado || 'activo',
        contacto: body.contacto ?? null,
        descripcion: body.descripcion
      }
    });

    const merged = applyPrestamoEstado(row);
    row = await prisma.prestamo.update({
      where: { id: row.id },
      data: { estado: merged.estado }
    });

    try {
      if (row.tipo === 'recibido') {
        await prisma.ingreso.create({
          data: {
            id: newObjectId(),
            userId,
            tipo: `Préstamo recibido: ${row.nombre}`,
            monto: row.montoTotal,
            moneda: row.moneda,
            fecha: row.fechaInicio,
            descripcion: `Préstamo recibido${row.descripcion ? ` - ${row.descripcion}` : ''}`,
            esRecurrente: false
          }
        });
      } else if (row.tipo === 'otorgado') {
        await prisma.gasto.create({
          data: {
            id: newObjectId(),
            userId,
            categoria: 'otros',
            monto: row.montoTotal,
            moneda: row.moneda,
            fecha: row.fechaInicio,
            descripcion: `Préstamo otorgado: ${row.nombre}${row.descripcion ? ` - ${row.descripcion}` : ''}`,
            metodoPago: 'transferencia',
            esRecurrente: false
          }
        });
      }
    } catch (transaccionError) {
      console.error(
        'Error creando transacción automática al crear préstamo:',
        transaccionError
      );
    }

    res.status(201).json({
      success: true,
      message: 'Préstamo creado exitosamente',
      data: { prestamo: serializePrestamo(row) }
    });
  } catch (error) {
    console.error('Error creando préstamo:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

const updatePrestamo = async (req, res) => {
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

    const existing = await prisma.prestamo.findFirst({ where: { id, userId } });
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Préstamo no encontrado'
      });
    }

    let row = await prisma.prestamo.update({
      where: { id },
      data: body
    });
    const merged = applyPrestamoEstado(row);
    row = await prisma.prestamo.update({
      where: { id },
      data: { estado: merged.estado }
    });

    res.json({
      success: true,
      message: 'Préstamo actualizado exitosamente',
      data: { prestamo: serializePrestamo(row) }
    });
  } catch (error) {
    console.error('Error actualizando préstamo:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

const deletePrestamo = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const del = await prisma.prestamo.deleteMany({ where: { id, userId } });

    if (del.count === 0) {
      return res.status(404).json({
        success: false,
        message: 'Préstamo no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Préstamo eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error eliminando préstamo:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

const pagarPrestamo = async (req, res) => {
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
    const { monto, fecha, tipo, nota } = req.body;

    let prestamo = await prisma.prestamo.findFirst({
      where: { id, userId }
    });

    if (!prestamo) {
      return res.status(404).json({
        success: false,
        message: 'Préstamo no encontrado'
      });
    }

    if (prestamo.estado === 'pagado') {
      return res.status(400).json({
        success: false,
        message: 'Este préstamo ya está completamente pagado'
      });
    }

    const historial = Array.isArray(prestamo.historialPagos)
      ? [...prestamo.historialPagos]
      : [];
    historial.push({
      fecha: fecha ? new Date(fecha) : new Date(),
      monto,
      tipo: tipo || 'ambos',
      nota: nota || ''
    });

    let montoPagado = prestamo.montoPagado + monto;
    if (montoPagado > prestamo.montoTotal) {
      montoPagado = prestamo.montoTotal;
    }

    prestamo = await prisma.prestamo.update({
      where: { id: prestamo.id },
      data: { historialPagos: historial, montoPagado }
    });

    const merged = applyPrestamoEstado(prestamo);
    prestamo = await prisma.prestamo.update({
      where: { id: prestamo.id },
      data: { estado: merged.estado }
    });

    try {
      const fechaPago = fecha ? new Date(fecha) : new Date();
      const montoPago = monto;

      if (prestamo.tipo === 'recibido') {
        await prisma.gasto.create({
          data: {
            id: newObjectId(),
            userId,
            categoria: 'otros',
            monto: montoPago,
            moneda: prestamo.moneda,
            fecha: fechaPago,
            descripcion: `Pago de préstamo recibido: ${prestamo.nombre}${nota ? ` - ${nota}` : ''}`,
            metodoPago: 'transferencia',
            esRecurrente: false
          }
        });
      } else if (prestamo.tipo === 'otorgado') {
        await prisma.ingreso.create({
          data: {
            id: newObjectId(),
            userId,
            tipo: `Pago de préstamo otorgado: ${prestamo.nombre}`,
            monto: montoPago,
            moneda: prestamo.moneda,
            fecha: fechaPago,
            descripcion: `Pago recibido de préstamo otorgado${nota ? ` - ${nota}` : ''}`,
            esRecurrente: false
          }
        });
      }
    } catch (transaccionError) {
      console.error(
        'Error creando transacción automática al pagar préstamo:',
        transaccionError
      );
    }

    res.json({
      success: true,
      message: 'Pago registrado exitosamente',
      data: { prestamo: serializePrestamo(prestamo) }
    });
  } catch (error) {
    console.error('Error registrando pago:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

const getResumenPrestamos = async (req, res) => {
  try {
    const userId = req.user._id;

    const prestamos = await prisma.prestamo.findMany({ where: { userId } });

    const resumen = {
      total: prestamos.length,
      recibidos: prestamos.filter((p) => p.tipo === 'recibido').length,
      otorgados: prestamos.filter((p) => p.tipo === 'otorgado').length,
      activos: prestamos.filter((p) => p.estado === 'activo').length,
      pagados: prestamos.filter((p) => p.estado === 'pagado').length,
      vencidos: prestamos.filter((p) => p.estado === 'vencido').length,
      montoTotalRecibido: prestamos
        .filter((p) => p.tipo === 'recibido')
        .reduce((sum, p) => sum + p.montoTotal, 0),
      montoTotalOtorgado: prestamos
        .filter((p) => p.tipo === 'otorgado')
        .reduce((sum, p) => sum + p.montoTotal, 0),
      montoPendienteRecibir: prestamos
        .filter(
          (p) =>
            p.tipo === 'recibido' &&
            (p.estado === 'activo' || p.estado === 'vencido')
        )
        .reduce((sum, p) => sum + (p.montoTotal - p.montoPagado), 0),
      montoPendientePagar: prestamos
        .filter(
          (p) =>
            p.tipo === 'otorgado' &&
            (p.estado === 'activo' || p.estado === 'vencido')
        )
        .reduce((sum, p) => sum + (p.montoTotal - p.montoPagado), 0)
    };

    res.json({
      success: true,
      data: { resumen }
    });
  } catch (error) {
    console.error('Error obteniendo resumen de préstamos:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

module.exports = {
  getPrestamos,
  getPrestamoById,
  createPrestamo,
  updatePrestamo,
  deletePrestamo,
  pagarPrestamo,
  getResumenPrestamos
};
