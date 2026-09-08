const prisma = require('../src/adapters/persistence/prismaClient');
const {
  obtenerRangoMensual,
  calcularProximaFecha,
  calcularFechasEntre,
  obtenerFechasCuotaParaCalendario
} = require('../utils/fechaUtils');

const getEventosMes = async (req, res) => {
  try {
    const userId = req.user._id;
    const { mes, anio } = req.params;
    const año = anio || req.params.año;
    const { moneda } = req.query;

    const rango = obtenerRangoMensual(parseInt(año, 10), parseInt(mes, 10));

    const whereIng = {
      userId,
      fecha: { gte: rango.inicio, lte: rango.fin }
    };
    if (moneda) whereIng.moneda = moneda;

    const ingresos = await prisma.ingreso.findMany({
      where: whereIng,
      select: {
        id: true,
        fecha: true,
        monto: true,
        moneda: true,
        tipo: true,
        descripcion: true
      },
      orderBy: { fecha: 'asc' }
    });

    const whereGas = {
      userId,
      fecha: { gte: rango.inicio, lte: rango.fin }
    };
    if (moneda) whereGas.moneda = moneda;

    const gastos = await prisma.gasto.findMany({
      where: whereGas,
      select: {
        id: true,
        fecha: true,
        monto: true,
        moneda: true,
        categoria: true,
        descripcion: true
      },
      orderBy: { fecha: 'asc' }
    });

    const tarjetas = await prisma.tarjeta.findMany({
      where: { userId, tipo: 'credito', esActiva: true },
      select: {
        id: true,
        nombre: true,
        diaPago: true,
        saldoActual: true,
        limiteCredito: true,
        moneda: true
      }
    });

    const diasPagoTarjeta = new Set();
    for (const tarjeta of tarjetas) {
      if (tarjeta.diaPago) {
        const fechaPago = new Date(
          parseInt(año, 10),
          parseInt(mes, 10) - 1,
          tarjeta.diaPago
        );
        if (fechaPago >= rango.inicio && fechaPago <= rango.fin) {
          const fechaKey = fechaPago.toISOString().split('T')[0];
          diasPagoTarjeta.add(`${fechaKey}|${tarjeta.id}`);
        }
      }
    }

    const cuotas = await prisma.cuota.findMany({
      where: {
        userId,
        // Incluye 'pagada': un plan completado debe seguir viéndose en meses pasados
        // (y futuros, si se pagó por adelantado) con sus cuotas marcadas como pagadas.
        estado: { in: ['activa', 'vencida', 'pagada'] }
      },
      select: {
        id: true,
        nombre: true,
        montoCuota: true,
        moneda: true,
        estado: true,
        cuotasTotal: true,
        cuotasPagadas: true,
        fechaInicio: true,
        fechaVencimiento: true,
        proximoPago: true,
        frecuenciaPago: true,
        tarjetaId: true,
        historialPagos: true
      }
    });

    const hoyInicio = new Date();
    hoyInicio.setHours(0, 0, 0, 0);

    const cuotasEventosMes = [];
    const cuotasPorFechaTarjeta = new Map();

    for (const cuota of cuotas) {
      let items = [];
      try {
        if ((cuota.cuotasPagadas || 0) > 0) {
          items = obtenerFechasCuotaParaCalendario(cuota);
        } else {
          const diaPago = cuota.fechaInicio
            ? new Date(cuota.fechaInicio).getDate()
            : null;
          const diaSemana = cuota.fechaInicio
            ? new Date(cuota.fechaInicio).getDay()
            : null;
          const fechasPago = calcularFechasEntre(
            cuota.fechaInicio,
            cuota.fechaVencimiento,
            cuota.frecuenciaPago,
            diaPago,
            diaSemana
          );
          const total = Math.min(cuota.cuotasTotal || 1, fechasPago.length, 48);
          for (let i = 0; i < total; i++) {
            items.push({ fecha: fechasPago[i], numeroCuota: i + 1 });
          }
        }
      } catch (e) {
        continue;
      }
      for (const { fecha, numeroCuota } of items) {
        if (!fecha || fecha < rango.inicio || fecha > rango.fin) continue;
        const fechaKey = fecha.toISOString().split('T')[0];
        const fechaPasada = fecha < hoyInicio;
        const pagada = numeroCuota <= (cuota.cuotasPagadas || 0);
        // Si este día es el corte/pago de la tarjeta del plan, el evento `tarjeta_pago`
        // ya lista las cuotas en `cuotasEnFecha`; no duplicar bolita ni fila como `cuota`.
        const yaCubiertoPorPagoTarjeta =
          cuota.tarjetaId &&
          diasPagoTarjeta.has(`${fechaKey}|${cuota.tarjetaId}`);
        if (!yaCubiertoPorPagoTarjeta) {
          cuotasEventosMes.push({
            fechaKey,
            cuotaId: cuota.id,
            tipo: 'cuota',
            nombre: cuota.nombre,
            monto: cuota.montoCuota,
            moneda: cuota.moneda,
            estado: cuota.estado,
            numeroCuota,
            cuotasTotal: cuota.cuotasTotal,
            fechaPasada,
            pagada
          });
        }
        if (cuota.tarjetaId) {
          const historial = Array.isArray(cuota.historialPagos)
            ? cuota.historialPagos
            : [];
          const yaPagada =
            historial.some((p) => p.numeroCuota === numeroCuota) ||
            numeroCuota <= (cuota.cuotasPagadas || 0);
          const list = cuotasPorFechaTarjeta.get(fechaKey) || [];
          list.push({
            cuotaId: cuota.id,
            nombre: cuota.nombre,
            montoCuota: cuota.montoCuota,
            moneda: cuota.moneda,
            numeroCuota,
            cuotasTotal: cuota.cuotasTotal,
            tarjetaId: cuota.tarjetaId,
            yaPagada
          });
          cuotasPorFechaTarjeta.set(fechaKey, list);
        }
      }
    }

    const prestamos = await prisma.prestamo.findMany({
      where: {
        userId,
        estado: { in: ['activo', 'vencido'] },
        fechaVencimiento: { gte: rango.inicio, lte: rango.fin }
      },
      select: {
        id: true,
        nombre: true,
        fechaVencimiento: true,
        montoTotal: true,
        montoPagado: true,
        moneda: true,
        tipo: true,
        estado: true
      }
    });

    const tarjetasEventos = [];
    for (const tarjeta of tarjetas) {
      if (tarjeta.diaPago) {
        const fechaPago = new Date(
          parseInt(año, 10),
          parseInt(mes, 10) - 1,
          tarjeta.diaPago
        );
        if (fechaPago >= rango.inicio && fechaPago <= rango.fin) {
          const fechaKey = fechaPago.toISOString().split('T')[0];
          const rawList = cuotasPorFechaTarjeta.get(fechaKey) || [];
          const listaCuotas = rawList
            .filter(
              (c) => c.tarjetaId && c.tarjetaId === tarjeta.id
            )
            .map(
              ({
                cuotaId,
                nombre,
                montoCuota,
                moneda,
                numeroCuota,
                cuotasTotal,
                yaPagada
              }) => ({
                cuotaId,
                nombre,
                montoCuota,
                moneda,
                numeroCuota,
                cuotasTotal,
                yaPagada: !!yaPagada
              })
            );
          const totalCuotasEnFecha = listaCuotas.reduce(
            (sum, c) => sum + (c.montoCuota || 0),
            0
          );
          const saldoActual = tarjeta.saldoActual || 0;
          const tienePagosPendientes =
            listaCuotas.length > 0 || Number(saldoActual) > 0;
          if (!tienePagosPendientes) continue;
          const fechaPasada = fechaPago < hoyInicio;
          const todasCuotasPagadas =
            listaCuotas.length > 0 && listaCuotas.every((c) => c.yaPagada);
          tarjetasEventos.push({
            fecha: fechaPago,
            monto: saldoActual,
            moneda: tarjeta.moneda,
            tipo: 'tarjeta_pago',
            nombre: `Pago ${tarjeta.nombre}`,
            tarjetaId: tarjeta.id,
            cuotasEnFecha: listaCuotas,
            totalCuotasEnFecha: totalCuotasEnFecha,
            fechaPasada,
            todasCuotasPagadas
          });
        }
      }
    }

    const ingresosRecurrentes = await prisma.ingresoRecurrente.findMany({
      where: {
        userId,
        esActivo: true,
        fechaInicio: { lte: rango.fin }
      }
    });

    const ingresosRecurrentesEventos = [];
    for (const ingresoRecurrente of ingresosRecurrentes) {
      if (
        !ingresoRecurrente.fechaFin ||
        new Date(ingresoRecurrente.fechaFin) >= rango.inicio
      ) {
        let fechaGeneracion = ingresoRecurrente.ultimaGeneracion
          ? calcularProximaFecha(
              ingresoRecurrente.ultimaGeneracion,
              ingresoRecurrente.frecuencia,
              ingresoRecurrente.diaPago,
              ingresoRecurrente.diaSemana
            )
          : new Date(ingresoRecurrente.fechaInicio);

        fechaGeneracion.setHours(0, 0, 0, 0);

        while (
          fechaGeneracion <= rango.fin &&
          fechaGeneracion >= rango.inicio
        ) {
          ingresosRecurrentesEventos.push({
            fecha: fechaGeneracion,
            monto: ingresoRecurrente.monto,
            moneda: ingresoRecurrente.moneda,
            tipo: 'ingreso_recurrente',
            nombre: ingresoRecurrente.nombre,
            ingresoRecurrenteId: ingresoRecurrente.id
          });

          fechaGeneracion = calcularProximaFecha(
            fechaGeneracion,
            ingresoRecurrente.frecuencia,
            ingresoRecurrente.diaPago,
            ingresoRecurrente.diaSemana
          );
          fechaGeneracion.setHours(0, 0, 0, 0);
        }
      }
    }

    const gastosRecurrentes = await prisma.gastoRecurrente.findMany({
      where: {
        userId,
        esActivo: true,
        fechaInicio: { lte: rango.fin }
      }
    });

    const gastosRecurrentesEventos = [];
    for (const gastoRecurrente of gastosRecurrentes) {
      if (
        !gastoRecurrente.fechaFin ||
        new Date(gastoRecurrente.fechaFin) >= rango.inicio
      ) {
        let fechaGeneracion = gastoRecurrente.ultimaGeneracion
          ? calcularProximaFecha(
              gastoRecurrente.ultimaGeneracion,
              gastoRecurrente.frecuencia,
              gastoRecurrente.diaPago,
              gastoRecurrente.diaSemana
            )
          : new Date(gastoRecurrente.fechaInicio);

        fechaGeneracion.setHours(0, 0, 0, 0);

        while (
          fechaGeneracion <= rango.fin &&
          fechaGeneracion >= rango.inicio
        ) {
          gastosRecurrentesEventos.push({
            fecha: fechaGeneracion,
            monto: gastoRecurrente.monto,
            moneda: gastoRecurrente.moneda,
            tipo: 'gasto_recurrente',
            nombre: gastoRecurrente.nombre,
            categoria: gastoRecurrente.categoria,
            gastoRecurrenteId: gastoRecurrente.id
          });

          fechaGeneracion = calcularProximaFecha(
            fechaGeneracion,
            gastoRecurrente.frecuencia,
            gastoRecurrente.diaPago,
            gastoRecurrente.diaSemana
          );
          fechaGeneracion.setHours(0, 0, 0, 0);
        }
      }
    }

    const eventosPorDia = {};

    ingresos.forEach((ingreso) => {
      const fecha = ingreso.fecha.toISOString().split('T')[0];
      if (!eventosPorDia[fecha]) eventosPorDia[fecha] = [];
      eventosPorDia[fecha].push({
        tipo: 'ingreso',
        ingresoId: ingreso.id,
        monto: ingreso.monto,
        moneda: ingreso.moneda,
        descripcion: ingreso.descripcion || ingreso.tipo
      });
    });

    gastos.forEach((gasto) => {
      const fecha = gasto.fecha.toISOString().split('T')[0];
      if (!eventosPorDia[fecha]) eventosPorDia[fecha] = [];
      eventosPorDia[fecha].push({
        tipo: 'gasto',
        gastoId: gasto.id,
        monto: gasto.monto,
        moneda: gasto.moneda,
        categoria: gasto.categoria,
        descripcion: gasto.descripcion
      });
    });

    cuotasEventosMes.forEach((ev) => {
      if (!eventosPorDia[ev.fechaKey]) eventosPorDia[ev.fechaKey] = [];
      eventosPorDia[ev.fechaKey].push({
        tipo: 'cuota',
        cuotaId: ev.cuotaId,
        nombre: ev.nombre,
        monto: ev.monto,
        moneda: ev.moneda,
        estado: ev.estado,
        numeroCuota: ev.numeroCuota,
        cuotasTotal: ev.cuotasTotal,
        fechaPasada: ev.fechaPasada,
        pagada: ev.pagada === true
      });
    });

    prestamos.forEach((prestamo) => {
      const fecha = prestamo.fechaVencimiento.toISOString().split('T')[0];
      if (!eventosPorDia[fecha]) eventosPorDia[fecha] = [];
      eventosPorDia[fecha].push({
        tipo: 'prestamo',
        prestamoId: prestamo.id,
        nombre: prestamo.nombre,
        monto: prestamo.montoTotal - prestamo.montoPagado,
        moneda: prestamo.moneda,
        tipoPrestamo: prestamo.tipo,
        estado: prestamo.estado
      });
    });

    ingresosRecurrentesEventos.forEach((evento) => {
      const fecha = evento.fecha.toISOString().split('T')[0];
      if (!eventosPorDia[fecha]) eventosPorDia[fecha] = [];
      eventosPorDia[fecha].push({
        tipo: 'ingreso_recurrente',
        nombre: evento.nombre,
        monto: evento.monto,
        moneda: evento.moneda,
        ingresoRecurrenteId: evento.ingresoRecurrenteId
      });
    });

    gastosRecurrentesEventos.forEach((evento) => {
      const fecha = evento.fecha.toISOString().split('T')[0];
      if (!eventosPorDia[fecha]) eventosPorDia[fecha] = [];
      eventosPorDia[fecha].push({
        tipo: 'gasto_recurrente',
        nombre: evento.nombre,
        monto: evento.monto,
        moneda: evento.moneda,
        categoria: evento.categoria,
        gastoRecurrenteId: evento.gastoRecurrenteId
      });
    });

    tarjetasEventos.forEach((evento) => {
      const fecha = evento.fecha.toISOString().split('T')[0];
      if (!eventosPorDia[fecha]) eventosPorDia[fecha] = [];
      eventosPorDia[fecha].push({
        tipo: 'tarjeta_pago',
        nombre: evento.nombre,
        monto: evento.monto,
        moneda: evento.moneda,
        tarjetaId: evento.tarjetaId,
        cuotasEnFecha: evento.cuotasEnFecha || [],
        totalCuotasEnFecha: evento.totalCuotasEnFecha || 0,
        fechaPasada: evento.fechaPasada,
        todasCuotasPagadas: evento.todasCuotasPagadas
      });
    });

    res.json({
      success: true,
      data: {
        mes: parseInt(mes, 10),
        año: parseInt(año, 10),
        eventosPorDia,
        resumen: {
          totalIngresos: ingresos.length,
          totalGastos: gastos.length,
          totalCuotas: cuotas.length,
          totalPrestamos: prestamos.length,
          totalTarjetas: tarjetasEventos.length,
          ingresosRecurrentes: ingresosRecurrentesEventos.length,
          gastosRecurrentes: gastosRecurrentesEventos.length
        }
      }
    });
  } catch (error) {
    console.error('Error obteniendo eventos del mes:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

const getProximosEventos = async (req, res) => {
  try {
    const userId = req.user._id;
    const { dias = 30 } = req.query;

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fechaLimite = new Date(hoy);
    fechaLimite.setDate(fechaLimite.getDate() + parseInt(dias, 10));
    fechaLimite.setHours(23, 59, 59, 999);

    const eventos = [];

    const cuotas = await prisma.cuota.findMany({
      where: {
        userId,
        estado: { in: ['activa', 'vencida'] },
        proximoPago: { gte: hoy, lte: fechaLimite }
      },
      select: {
        nombre: true,
        proximoPago: true,
        montoCuota: true,
        moneda: true,
        estado: true
      }
    });

    cuotas.forEach((cuota) => {
      eventos.push({
        fecha: cuota.proximoPago,
        tipo: 'cuota',
        nombre: cuota.nombre,
        monto: cuota.montoCuota,
        moneda: cuota.moneda,
        estado: cuota.estado,
        prioridad: 'alta'
      });
    });

    const prestamos = await prisma.prestamo.findMany({
      where: {
        userId,
        estado: { in: ['activo', 'vencido'] },
        fechaVencimiento: { gte: hoy, lte: fechaLimite }
      },
      select: {
        nombre: true,
        fechaVencimiento: true,
        montoTotal: true,
        montoPagado: true,
        moneda: true,
        tipo: true,
        estado: true
      }
    });

    prestamos.forEach((prestamo) => {
      eventos.push({
        fecha: prestamo.fechaVencimiento,
        tipo: 'prestamo',
        nombre: prestamo.nombre,
        monto: prestamo.montoTotal - prestamo.montoPagado,
        moneda: prestamo.moneda,
        tipoPrestamo: prestamo.tipo,
        estado: prestamo.estado,
        prioridad: prestamo.estado === 'vencido' ? 'alta' : 'media'
      });
    });

    eventos.sort(
      (a, b) => new Date(a.fecha) - new Date(b.fecha)
    );

    res.json({
      success: true,
      data: {
        eventos,
        total: eventos.length,
        dias: parseInt(dias, 10)
      }
    });
  } catch (error) {
    console.error('Error obteniendo próximos eventos:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

const getVencimientos = async (req, res) => {
  try {
    const userId = req.user._id;
    const { dias = 7 } = req.query;

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fechaLimite = new Date(hoy);
    fechaLimite.setDate(fechaLimite.getDate() + parseInt(dias, 10));
    fechaLimite.setHours(23, 59, 59, 999);

    const vencimientos = [];

    const cuotas = await prisma.cuota.findMany({
      where: {
        userId,
        estado: { in: ['activa', 'vencida'] },
        proximoPago: { lte: fechaLimite }
      },
      select: {
        nombre: true,
        proximoPago: true,
        montoCuota: true,
        moneda: true,
        estado: true,
        fechaVencimiento: true
      }
    });

    cuotas.forEach((cuota) => {
      const diasHastaVencimiento = Math.ceil(
        (new Date(cuota.proximoPago) - hoy) / (1000 * 60 * 60 * 24)
      );
      vencimientos.push({
        tipo: 'cuota',
        nombre: cuota.nombre,
        fechaVencimiento: cuota.proximoPago,
        fechaLimiteFinal: cuota.fechaVencimiento,
        monto: cuota.montoCuota,
        moneda: cuota.moneda,
        estado: cuota.estado,
        diasRestantes: diasHastaVencimiento,
        urgente: diasHastaVencimiento <= 3
      });
    });

    const prestamos = await prisma.prestamo.findMany({
      where: {
        userId,
        estado: { in: ['activo', 'vencido'] },
        fechaVencimiento: { lte: fechaLimite }
      },
      select: {
        nombre: true,
        fechaVencimiento: true,
        montoTotal: true,
        montoPagado: true,
        moneda: true,
        tipo: true,
        estado: true
      }
    });

    prestamos.forEach((prestamo) => {
      const diasHastaVencimiento = Math.ceil(
        (new Date(prestamo.fechaVencimiento) - hoy) / (1000 * 60 * 60 * 24)
      );
      vencimientos.push({
        tipo: 'prestamo',
        nombre: prestamo.nombre,
        fechaVencimiento: prestamo.fechaVencimiento,
        monto: prestamo.montoTotal - prestamo.montoPagado,
        moneda: prestamo.moneda,
        tipoPrestamo: prestamo.tipo,
        estado: prestamo.estado,
        diasRestantes: diasHastaVencimiento,
        urgente: diasHastaVencimiento <= 3 || prestamo.estado === 'vencido'
      });
    });

    vencimientos.sort((a, b) => {
      if (a.urgente !== b.urgente) return a.urgente ? -1 : 1;
      return new Date(a.fechaVencimiento) - new Date(b.fechaVencimiento);
    });

    res.json({
      success: true,
      data: {
        vencimientos,
        total: vencimientos.length,
        urgentes: vencimientos.filter((v) => v.urgente).length,
        dias: parseInt(dias, 10)
      }
    });
  } catch (error) {
    console.error('Error obteniendo vencimientos:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

module.exports = {
  getEventosMes,
  getProximosEventos,
  getVencimientos
};
