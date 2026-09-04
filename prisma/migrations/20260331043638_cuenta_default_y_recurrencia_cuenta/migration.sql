-- AlterTable
ALTER TABLE "gastos_recurrentes" ADD COLUMN     "cuentaId" VARCHAR(24);

-- AlterTable
ALTER TABLE "ingresos_recurrentes" ADD COLUMN     "cuentaId" VARCHAR(24);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "cuentaDefaultId" VARCHAR(24);

-- AddForeignKey
ALTER TABLE "ingresos_recurrentes" ADD CONSTRAINT "ingresos_recurrentes_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "cuentas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos_recurrentes" ADD CONSTRAINT "gastos_recurrentes_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "cuentas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
