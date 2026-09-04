-- CreateTable
CREATE TABLE "users" (
    "id" VARCHAR(24) NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "googleId" TEXT,
    "avatar" TEXT,
    "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
    "resetPasswordToken" TEXT,
    "resetPasswordExpires" TIMESTAMP(3),
    "profileImage" TEXT,
    "profileImageData" BYTEA,
    "profileImageContentType" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'GTQ',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");

CREATE TABLE "ingresos" (
    "id" VARCHAR(24) NOT NULL,
    "userId" VARCHAR(24) NOT NULL,
    "tipo" TEXT NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "moneda" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "descripcion" TEXT,
    "esRecurrente" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ingresos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ingresos_userId_fecha_idx" ON "ingresos"("userId", "fecha" DESC);

CREATE TABLE "tarjetas" (
    "id" VARCHAR(24) NOT NULL,
    "userId" VARCHAR(24) NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "banco" TEXT,
    "numeroUltimosDigitos" TEXT,
    "limiteCredito" DOUBLE PRECISION,
    "moneda" TEXT NOT NULL,
    "diaPago" INTEGER,
    "fechaCorte" INTEGER,
    "saldoActual" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "disponible" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "esActiva" BOOLEAN NOT NULL DEFAULT true,
    "descripcion" TEXT,
    "color" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tarjetas_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "tarjetas_userId_tipo_idx" ON "tarjetas"("userId", "tipo");
CREATE INDEX "tarjetas_userId_esActiva_idx" ON "tarjetas"("userId", "esActiva");

CREATE TABLE "cuotas" (
    "id" VARCHAR(24) NOT NULL,
    "userId" VARCHAR(24) NOT NULL,
    "nombre" TEXT NOT NULL,
    "montoTotal" DOUBLE PRECISION NOT NULL,
    "montoCuota" DOUBLE PRECISION NOT NULL,
    "cuotasTotal" INTEGER NOT NULL,
    "cuotasPagadas" INTEGER NOT NULL DEFAULT 0,
    "moneda" TEXT NOT NULL,
    "frecuenciaPago" TEXT NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaVencimiento" TIMESTAMP(3) NOT NULL,
    "proximoPago" TIMESTAMP(3) NOT NULL,
    "historialPagos" JSONB NOT NULL DEFAULT '[]',
    "descripcion" TEXT,
    "categoria" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'activa',
    "notificaciones" JSONB NOT NULL DEFAULT '{}',
    "tarjetaId" VARCHAR(24),
    "crearGastoAutomatico" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cuotas_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cuotas_userId_estado_idx" ON "cuotas"("userId", "estado");
CREATE INDEX "cuotas_userId_proximoPago_idx" ON "cuotas"("userId", "proximoPago");
CREATE INDEX "cuotas_userId_fechaVencimiento_idx" ON "cuotas"("userId", "fechaVencimiento");

CREATE TABLE "gastos" (
    "id" VARCHAR(24) NOT NULL,
    "userId" VARCHAR(24) NOT NULL,
    "categoria" TEXT NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "moneda" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "descripcion" TEXT,
    "esRecurrente" BOOLEAN NOT NULL DEFAULT false,
    "metodoPago" TEXT NOT NULL DEFAULT 'efectivo',
    "cuotaId" VARCHAR(24),
    "numeroCuotaPago" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gastos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "gastos_userId_fecha_idx" ON "gastos"("userId", "fecha" DESC);
CREATE INDEX "gastos_userId_categoria_idx" ON "gastos"("userId", "categoria");

CREATE TABLE "prestamos" (
    "id" VARCHAR(24) NOT NULL,
    "userId" VARCHAR(24) NOT NULL,
    "tipo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "montoTotal" DOUBLE PRECISION NOT NULL,
    "montoPagado" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "moneda" TEXT NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaVencimiento" TIMESTAMP(3) NOT NULL,
    "tasaInteres" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "frecuenciaPago" TEXT NOT NULL DEFAULT 'mensual',
    "historialPagos" JSONB NOT NULL DEFAULT '[]',
    "estado" TEXT NOT NULL DEFAULT 'activo',
    "contacto" JSONB,
    "descripcion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prestamos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "prestamos_userId_estado_idx" ON "prestamos"("userId", "estado");
CREATE INDEX "prestamos_userId_tipo_idx" ON "prestamos"("userId", "tipo");
CREATE INDEX "prestamos_userId_fechaVencimiento_idx" ON "prestamos"("userId", "fechaVencimiento");

CREATE TABLE "tipos_transaccion" (
    "id" VARCHAR(24) NOT NULL,
    "userId" VARCHAR(24) NOT NULL,
    "tipo" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "iconKey" TEXT,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tipos_transaccion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tipos_transaccion_userId_tipo_slug_key" ON "tipos_transaccion"("userId", "tipo", "slug");

CREATE TABLE "ingresos_recurrentes" (
    "id" VARCHAR(24) NOT NULL,
    "userId" VARCHAR(24) NOT NULL,
    "nombre" TEXT NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "moneda" TEXT NOT NULL,
    "frecuencia" TEXT NOT NULL,
    "diaPago" INTEGER,
    "diaSemana" INTEGER,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3),
    "esActivo" BOOLEAN NOT NULL DEFAULT true,
    "categoria" TEXT,
    "descripcion" TEXT,
    "ultimaGeneracion" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ingresos_recurrentes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ingresos_recurrentes_userId_esActivo_idx" ON "ingresos_recurrentes"("userId", "esActivo");

CREATE TABLE "gastos_recurrentes" (
    "id" VARCHAR(24) NOT NULL,
    "userId" VARCHAR(24) NOT NULL,
    "nombre" TEXT NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "moneda" TEXT NOT NULL,
    "frecuencia" TEXT NOT NULL,
    "diaPago" INTEGER,
    "diaSemana" INTEGER,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3),
    "esActivo" BOOLEAN NOT NULL DEFAULT true,
    "categoria" TEXT NOT NULL,
    "metodoPago" TEXT NOT NULL DEFAULT 'tarjeta_credito',
    "esSuscripcion" BOOLEAN NOT NULL DEFAULT false,
    "descripcion" TEXT,
    "ultimaGeneracion" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gastos_recurrentes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "gastos_recurrentes_userId_esActivo_idx" ON "gastos_recurrentes"("userId", "esActivo");

CREATE TABLE "transacciones_generadas" (
    "id" VARCHAR(24) NOT NULL,
    "tipo" TEXT NOT NULL,
    "recurrenciaId" VARCHAR(24) NOT NULL,
    "recurrenciaModel" TEXT NOT NULL,
    "transaccionId" VARCHAR(24) NOT NULL,
    "transaccionModel" TEXT NOT NULL,
    "fechaGeneracion" TIMESTAMP(3) NOT NULL,
    "periodo" TEXT NOT NULL,
    "userId" VARCHAR(24) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transacciones_generadas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "transacciones_generadas_recurrenciaId_periodo_tipo_key" ON "transacciones_generadas"("recurrenciaId", "periodo", "tipo");
CREATE INDEX "transacciones_generadas_userId_fechaGeneracion_idx" ON "transacciones_generadas"("userId", "fechaGeneracion" DESC);
CREATE INDEX "transacciones_generadas_recurrenciaId_tipo_idx" ON "transacciones_generadas"("recurrenciaId", "tipo");
CREATE INDEX "transacciones_generadas_periodo_idx" ON "transacciones_generadas"("periodo");

CREATE TABLE "gastos_fijos" (
    "id" VARCHAR(24) NOT NULL,
    "userId" VARCHAR(24) NOT NULL,
    "nombre" TEXT NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "moneda" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "descripcion" TEXT,
    "diaPago" INTEGER NOT NULL,
    "esActivo" BOOLEAN NOT NULL DEFAULT true,
    "esRecurrente" BOOLEAN NOT NULL DEFAULT true,
    "fechaInicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaFin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gastos_fijos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "gastos_fijos_userId_esActivo_idx" ON "gastos_fijos"("userId", "esActivo");

-- AddForeignKey
ALTER TABLE "ingresos" ADD CONSTRAINT "ingresos_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tarjetas" ADD CONSTRAINT "tarjetas_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cuotas" ADD CONSTRAINT "cuotas_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cuotas" ADD CONSTRAINT "cuotas_tarjetaId_fkey" FOREIGN KEY ("tarjetaId") REFERENCES "tarjetas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "gastos" ADD CONSTRAINT "gastos_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_cuotaId_fkey" FOREIGN KEY ("cuotaId") REFERENCES "cuotas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "prestamos" ADD CONSTRAINT "prestamos_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tipos_transaccion" ADD CONSTRAINT "tipos_transaccion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ingresos_recurrentes" ADD CONSTRAINT "ingresos_recurrentes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "gastos_recurrentes" ADD CONSTRAINT "gastos_recurrentes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "transacciones_generadas" ADD CONSTRAINT "transacciones_generadas_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "gastos_fijos" ADD CONSTRAINT "gastos_fijos_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
