-- AlterTable
ALTER TABLE "gastos" ADD COLUMN     "cuentaId" VARCHAR(24);

-- AlterTable
ALTER TABLE "ingresos" ADD COLUMN     "cuentaId" VARCHAR(24);

-- CreateTable
CREATE TABLE "cuentas" (
    "id" VARCHAR(24) NOT NULL,
    "userId" VARCHAR(24) NOT NULL,
    "nombre" TEXT NOT NULL,
    "moneda" TEXT NOT NULL,
    "esActiva" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cuentas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cuentas_userId_idx" ON "cuentas"("userId");

-- CreateIndex
CREATE INDEX "cuentas_userId_moneda_idx" ON "cuentas"("userId", "moneda");

-- CreateIndex
CREATE INDEX "gastos_userId_cuentaId_fecha_idx" ON "gastos"("userId", "cuentaId", "fecha" DESC);

-- CreateIndex
CREATE INDEX "ingresos_userId_cuentaId_fecha_idx" ON "ingresos"("userId", "cuentaId", "fecha" DESC);

-- AddForeignKey
ALTER TABLE "cuentas" ADD CONSTRAINT "cuentas_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingresos" ADD CONSTRAINT "ingresos_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "cuentas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "cuentas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
