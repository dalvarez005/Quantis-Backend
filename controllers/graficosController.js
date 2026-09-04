const prisma = require('../src/adapters/persistence/prismaClient');
const { obtenerRangoMensual } = require('../utils/fechaUtils');
const { cuotaProgresoPago } = require('../src/domain/prestamoCuota');

const getIngresosGastos = async (req, res) => {
  try {
    const userId = req.user._id;
    const { mes, año, moneda } = req.query;

    let ingresos;
    let gastos;

    if (mes && año) {
      const rango = obtenerRangoMensual(parseInt(año, 10), parseInt(mes, 10));
      if (moneda) {
        ingresos = await prisma.$queryRaw`
          SELECT to_char(date_trunc('day', fecha), 'YYYY-MM-DD') as "_id",
                 sum(monto)::float as total,
                 min(moneda) as moneda
          FROM ingresos
          WHERE "userId" = ${userId}
            AND fecha >= ${rango.inicio}
            AND fecha <= ${rango.fin}
            AND moneda = ${moneda}
          GROUP BY 1 ORDER BY 1`;
        gastos = await prisma.$queryRaw`
          SELECT to_char(date_trunc('day', fecha), 'YYYY-MM-DD') as "_id",
                 sum(monto)::float as total,
                 min(moneda) as moneda
          FROM gastos
          WHERE "userId" = ${userId}
            AND fecha >= ${rango.inicio}
            AND fecha <= ${rango.fin}
            AND moneda = ${moneda}
          GROUP BY 1 ORDER BY 1`;
      } else {
        ingresos = await prisma.$queryRaw`
          SELECT to_char(date_trunc('day', fecha), 'YYYY-MM-DD') as "_id",
                 sum(monto)::float as total,
                 min(moneda) as moneda
          FROM ingresos
          WHERE "userId" = ${userId}
            AND fecha >= ${rango.inicio}
            AND fecha <= ${rango.fin}
          GROUP BY 1 ORDER BY 1`;
        gastos = await prisma.$queryRaw`
          SELECT to_char(date_trunc('day', fecha), 'YYYY-MM-DD') as "_id",
                 sum(monto)::float as total,
                 min(moneda) as moneda
          FROM gastos
          WHERE "userId" = ${userId}
            AND fecha >= ${rango.inicio}
            AND fecha <= ${rango.fin}
          GROUP BY 1 ORDER BY 1`;
      }
    } else if (moneda) {
      ingresos = await prisma.$queryRaw`
        SELECT to_char(date_trunc('day', fecha), 'YYYY-MM-DD') as "_id",
               sum(monto)::float as total,
               min(moneda) as moneda
        FROM ingresos
        WHERE "userId" = ${userId} AND moneda = ${moneda}
        GROUP BY 1 ORDER BY 1`;
      gastos = await prisma.$queryRaw`
        SELECT to_char(date_trunc('day', fecha), 'YYYY-MM-DD') as "_id",
               sum(monto)::float as total,
               min(moneda) as moneda
        FROM gastos
        WHERE "userId" = ${userId} AND moneda = ${moneda}
        GROUP BY 1 ORDER BY 1`;
    } else {
      ingresos = await prisma.$queryRaw`
        SELECT to_char(date_trunc('day', fecha), 'YYYY-MM-DD') as "_id",
               sum(monto)::float as total,
               min(moneda) as moneda
        FROM ingresos
        WHERE "userId" = ${userId}
        GROUP BY 1 ORDER BY 1`;
      gastos = await prisma.$queryRaw`
        SELECT to_char(date_trunc('day', fecha), 'YYYY-MM-DD') as "_id",
               sum(monto)::float as total,
               min(moneda) as moneda
        FROM gastos
        WHERE "userId" = ${userId}
        GROUP BY 1 ORDER BY 1`;
    }

    res.json({
      success: true,
      data: {
        ingresos,
        gastos,
        periodo: mes && año ? `${mes}/${año}` : 'Todos los períodos'
      }
    });
  } catch (error) {
    console.error('Error obteniendo datos de ingresos-gastos:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

const getGastosCategoria = async (req, res) => {
  try {
    const userId = req.user._id;
    const { mes, año, moneda } = req.query;

    let rows;
    if (mes && año) {
      const rango = obtenerRangoMensual(parseInt(año, 10), parseInt(mes, 10));
      if (moneda) {
        rows = await prisma.$queryRaw`
          SELECT categoria as "_id",
                 sum(monto)::float as total,
                 count(*)::int as cantidad,
                 min(moneda) as moneda
          FROM gastos
          WHERE "userId" = ${userId}
            AND fecha >= ${rango.inicio}
            AND fecha <= ${rango.fin}
            AND moneda = ${moneda}
          GROUP BY categoria ORDER BY total DESC`;
      } else {
        rows = await prisma.$queryRaw`
          SELECT categoria as "_id",
                 sum(monto)::float as total,
                 count(*)::int as cantidad,
                 min(moneda) as moneda
          FROM gastos
          WHERE "userId" = ${userId}
            AND fecha >= ${rango.inicio}
            AND fecha <= ${rango.fin}
          GROUP BY categoria ORDER BY total DESC`;
      }
    } else if (moneda) {
      rows = await prisma.$queryRaw`
        SELECT categoria as "_id",
               sum(monto)::float as total,
               count(*)::int as cantidad,
               min(moneda) as moneda
        FROM gastos
        WHERE "userId" = ${userId} AND moneda = ${moneda}
        GROUP BY categoria ORDER BY total DESC`;
    } else {
      rows = await prisma.$queryRaw`
        SELECT categoria as "_id",
               sum(monto)::float as total,
               count(*)::int as cantidad,
               min(moneda) as moneda
        FROM gastos
        WHERE "userId" = ${userId}
        GROUP BY categoria ORDER BY total DESC`;
    }

    res.json({
      success: true,
      data: {
        categorias: rows,
        periodo: mes && año ? `${mes}/${año}` : 'Todos los períodos'
      }
    });
  } catch (error) {
    console.error('Error obteniendo gastos por categoría:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

const getEvolucion = async (req, res) => {
  try {
    const userId = req.user._id;
    const { meses = 6, moneda } = req.query;

    const fechaInicio = new Date();
    fechaInicio.setMonth(fechaInicio.getMonth() - parseInt(meses, 10));
    fechaInicio.setDate(1);
    fechaInicio.setHours(0, 0, 0, 0);

    let ingresosMensuales;
    let gastosMensuales;

    if (moneda) {
      ingresosMensuales = await prisma.$queryRaw`
        SELECT date_part('year', fecha)::int as y,
               date_part('month', fecha)::int as m,
               sum(monto)::float as total,
               count(*)::int as cantidad,
               min(moneda) as moneda
        FROM ingresos
        WHERE "userId" = ${userId} AND fecha >= ${fechaInicio} AND moneda = ${moneda}
        GROUP BY 1, 2 ORDER BY 1, 2`;
      gastosMensuales = await prisma.$queryRaw`
        SELECT date_part('year', fecha)::int as y,
               date_part('month', fecha)::int as m,
               sum(monto)::float as total,
               count(*)::int as cantidad,
               min(moneda) as moneda
        FROM gastos
        WHERE "userId" = ${userId} AND fecha >= ${fechaInicio} AND moneda = ${moneda}
        GROUP BY 1, 2 ORDER BY 1, 2`;
    } else {
      ingresosMensuales = await prisma.$queryRaw`
        SELECT date_part('year', fecha)::int as y,
               date_part('month', fecha)::int as m,
               sum(monto)::float as total,
               count(*)::int as cantidad,
               min(moneda) as moneda
        FROM ingresos
        WHERE "userId" = ${userId} AND fecha >= ${fechaInicio}
        GROUP BY 1, 2 ORDER BY 1, 2`;
      gastosMensuales = await prisma.$queryRaw`
        SELECT date_part('year', fecha)::int as y,
               date_part('month', fecha)::int as m,
               sum(monto)::float as total,
               count(*)::int as cantidad,
               min(moneda) as moneda
        FROM gastos
        WHERE "userId" = ${userId} AND fecha >= ${fechaInicio}
        GROUP BY 1, 2 ORDER BY 1, 2`;
    }

    const mapMes = (rows) =>
      rows.map((r) => ({
        _id: { año: r.y, mes: r.m },
        total: r.total,
        cantidad: r.cantidad,
        moneda: r.moneda
      }));

    res.json({
      success: true,
      data: {
        ingresos: mapMes(ingresosMensuales),
        gastos: mapMes(gastosMensuales),
        meses: parseInt(meses, 10)
      }
    });
  } catch (error) {
    console.error('Error obteniendo evolución:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

const getCuotasProgreso = async (req, res) => {
  try {
    const userId = req.user._id;

    const cuotas = await prisma.cuota.findMany({
      where: { userId, estado: { in: ['activa', 'vencida'] } }
    });

    const datos = cuotas.map((cuota) => ({
      nombre: cuota.nombre,
      cuotasPagadas: cuota.cuotasPagadas,
      cuotasTotal: cuota.cuotasTotal,
      progreso: cuotaProgresoPago(cuota),
      montoPagado: cuota.cuotasPagadas * cuota.montoCuota,
      montoTotal: cuota.montoTotal,
      moneda: cuota.moneda,
      estado: cuota.estado
    }));

    res.json({
      success: true,
      data: { cuotas: datos }
    });
  } catch (error) {
    console.error('Error obteniendo progreso de cuotas:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

const getPrestamosProgreso = async (req, res) => {
  try {
    const userId = req.user._id;
    const { tipo } = req.query;

    const where = { userId, estado: { in: ['activo', 'vencido'] } };
    if (tipo) where.tipo = tipo;

    const prestamos = await prisma.prestamo.findMany({ where });

    const datos = prestamos.map((prestamo) => ({
      nombre: prestamo.nombre,
      tipo: prestamo.tipo,
      montoPagado: prestamo.montoPagado,
      montoTotal: prestamo.montoTotal,
      progreso:
        prestamo.montoTotal === 0
          ? 0
          : Math.min(
              100,
              (prestamo.montoPagado / prestamo.montoTotal) * 100
            ),
      moneda: prestamo.moneda,
      estado: prestamo.estado,
      diasRestantes: Math.ceil(
        (new Date(prestamo.fechaVencimiento) - new Date()) /
          (1000 * 60 * 60 * 24)
      )
    }));

    res.json({
      success: true,
      data: { prestamos: datos }
    });
  } catch (error) {
    console.error('Error obteniendo progreso de préstamos:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

const getDashboard = async (req, res) => {
  try {
    const userId = req.user._id;
    const { moneda } = req.query;

    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    inicioMes.setHours(0, 0, 0, 0);

    const whereIng = { userId, fecha: { gte: inicioMes } };
    const whereGas = { userId, fecha: { gte: inicioMes } };
    if (moneda) {
      whereIng.moneda = moneda;
      whereGas.moneda = moneda;
    }

    const totalIngresos = await prisma.ingreso.groupBy({
      by: ['moneda'],
      where: whereIng,
      _sum: { monto: true },
      _count: true
    });

    const totalGastos = await prisma.gasto.groupBy({
      by: ['moneda'],
      where: whereGas,
      _sum: { monto: true },
      _count: true
    });

    const totalIngresosMapped = totalIngresos.map((g) => ({
      _id: g.moneda,
      total: g._sum.monto || 0,
      cantidad: g._count._all
    }));

    const totalGastosMapped = totalGastos.map((g) => ({
      _id: g.moneda,
      total: g._sum.monto || 0,
      cantidad: g._count._all
    }));

    const cuotasActivas = await prisma.cuota.count({
      where: { userId, estado: 'activa' }
    });

    const limiteProx = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000
    );
    const cuotasProximas = await prisma.cuota.findMany({
      where: {
        userId,
        estado: 'activa',
        proximoPago: { lte: limiteProx }
      },
      take: 5,
      orderBy: { proximoPago: 'asc' },
      select: {
        nombre: true,
        proximoPago: true,
        montoCuota: true,
        moneda: true
      }
    });

    const prestamosActivos = await prisma.prestamo.count({
      where: { userId, estado: 'activo' }
    });

    const gastosCategoria = await prisma.gasto.groupBy({
      by: ['categoria'],
      where: whereGas,
      _sum: { monto: true },
      orderBy: { _sum: { monto: 'desc' } },
      take: 5
    });

    const gastosCategoriaMapped = gastosCategoria.map((g) => ({
      _id: g.categoria,
      total: g._sum.monto || 0
    }));

    res.json({
      success: true,
      data: {
        totalIngresos: totalIngresosMapped,
        totalGastos: totalGastosMapped,
        cuotasActivas,
        cuotasProximas,
        prestamosActivos,
        gastosCategoria: gastosCategoriaMapped,
        periodo: `${hoy.getMonth() + 1}/${hoy.getFullYear()}`
      }
    });
  } catch (error) {
    console.error('Error obteniendo datos del dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

module.exports = {
  getIngresosGastos,
  getGastosCategoria,
  getEvolucion,
  getCuotasProgreso,
  getPrestamosProgreso,
  getDashboard
};
