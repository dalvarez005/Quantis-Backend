-- AlterTable
ALTER TABLE "gastos" ADD COLUMN     "esPagoTarjeta" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tarjetaId" VARCHAR(24);

-- CreateIndex
CREATE INDEX "gastos_userId_tarjetaId_fecha_idx" ON "gastos"("userId", "tarjetaId", "fecha" DESC);

-- AddForeignKey
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_tarjetaId_fkey" FOREIGN KEY ("tarjetaId") REFERENCES "tarjetas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
