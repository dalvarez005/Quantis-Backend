const cron = require('node-cron');
const prisma = require('../src/adapters/persistence/prismaClient');
const { generarTodasLasRecurrencias } = require('./recurrenciaService');

function iniciarCronJobs() {
  console.log('🕐 Iniciando tareas programadas (cron jobs)...');

  cron.schedule(
    '0 2 * * *',
    async () => {
      console.log(
        '📅 Ejecutando tarea programada: Generar transacciones recurrentes'
      );
      try {
        const ingUserIds = await prisma.ingresoRecurrente.findMany({
          where: { esActivo: true },
          select: { userId: true },
          distinct: ['userId']
        });
        const gastUserIds = await prisma.gastoRecurrente.findMany({
          where: { esActivo: true },
          select: { userId: true },
          distinct: ['userId']
        });
        const idSet = new Set([
          ...ingUserIds.map((r) => r.userId),
          ...gastUserIds.map((r) => r.userId)
        ]);

        let totalIngresos = 0;
        let totalGastos = 0;

        for (const userId of idSet) {
          try {
            const resultado = await generarTodasLasRecurrencias(userId);
            totalIngresos += resultado.totalIngresos;
            totalGastos += resultado.totalGastos;
          } catch (error) {
            console.error(
              `Error generando recurrencias para usuario ${userId}:`,
              error
            );
          }
        }

        console.log(
          `✅ Transacciones generadas: ${totalIngresos} ingresos, ${totalGastos} gastos`
        );
      } catch (error) {
        console.error(
          '❌ Error en tarea programada de generación de transacciones:',
          error
        );
      }
    },
    {
      scheduled: true,
      timezone: 'America/Guatemala'
    }
  );

  cron.schedule(
    '0 3 * * *',
    async () => {
      console.log(
        '📅 Ejecutando tarea programada: Actualizar estados de cuotas'
      );
      try {
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        const r = await prisma.cuota.updateMany({
          where: {
            estado: 'activa',
            fechaVencimiento: { lt: hoy }
          },
          data: { estado: 'vencida' }
        });

        console.log(
          `✅ ${r.count} cuota(s) marcada(s) como vencida(s)`
        );
      } catch (error) {
        console.error(
          '❌ Error en tarea programada de actualización de cuotas:',
          error
        );
      }
    },
    {
      scheduled: true,
      timezone: 'America/Guatemala'
    }
  );

  cron.schedule(
    '15 3 * * *',
    async () => {
      console.log(
        '📅 Ejecutando tarea programada: Actualizar estados de préstamos'
      );
      try {
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        const r = await prisma.prestamo.updateMany({
          where: {
            estado: 'activo',
            fechaVencimiento: { lt: hoy }
          },
          data: { estado: 'vencido' }
        });

        console.log(
          `✅ ${r.count} préstamo(s) marcado(s) como vencido(s)`
        );
      } catch (error) {
        console.error(
          '❌ Error en tarea programada de actualización de préstamos:',
          error
        );
      }
    },
    {
      scheduled: true,
      timezone: 'America/Guatemala'
    }
  );

  cron.schedule(
    '0 1 * * 0',
    async () => {
      console.log(
        '📅 Ejecutando tarea programada semanal: Verificar transacciones recurrentes pendientes'
      );
      try {
        const ingUserIds = await prisma.ingresoRecurrente.findMany({
          where: { esActivo: true },
          select: { userId: true },
          distinct: ['userId']
        });
        const gastUserIds = await prisma.gastoRecurrente.findMany({
          where: { esActivo: true },
          select: { userId: true },
          distinct: ['userId']
        });
        const idSet = new Set([
          ...ingUserIds.map((r) => r.userId),
          ...gastUserIds.map((r) => r.userId)
        ]);

        let totalIngresos = 0;
        let totalGastos = 0;

        for (const userId of idSet) {
          try {
            const fechaLimite = new Date();
            fechaLimite.setDate(fechaLimite.getDate() + 30);
            const resultado = await generarTodasLasRecurrencias(
              userId,
              fechaLimite
            );
            totalIngresos += resultado.totalIngresos;
            totalGastos += resultado.totalGastos;
          } catch (error) {
            console.error(
              `Error generando recurrencias para usuario ${userId}:`,
              error
            );
          }
        }

        console.log(
          `✅ Verificación semanal completada: ${totalIngresos} ingresos, ${totalGastos} gastos`
        );
      } catch (error) {
        console.error('❌ Error en tarea programada semanal:', error);
      }
    },
    {
      scheduled: true,
      timezone: 'America/Guatemala'
    }
  );

  console.log('✅ Tareas programadas configuradas correctamente');
}

function detenerCronJobs() {
  console.log('🛑 Deteniendo tareas programadas...');
}

module.exports = {
  iniciarCronJobs,
  detenerCronJobs
};
