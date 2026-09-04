# Quantis Backend

API REST para Quantis, un gestor de finanzas personales y presupuestos.

## Stack

- Node.js + Express
- PostgreSQL + Prisma ORM
- JWT y Google OAuth (Passport) para autenticación
- Docker / Docker Compose

## Requisitos

- Node.js 18 o superior
- Docker y Docker Compose (para levantar Postgres, o el stack completo)

## Configuración

Copia el archivo de ejemplo y ajusta los valores según tu entorno:

```bash
cp .env.example .env
```

Variables principales:

| Variable | Descripción |
| --- | --- |
| `DATABASE_URL` | Cadena de conexión a PostgreSQL |
| `PORT` | Puerto en el que corre la API (por defecto `5000`) |
| `FRONTEND_URL` | Orígenes permitidos por CORS (separados por coma) |
| `JWT_SECRET` / `SESSION_SECRET` | Secretos de autenticación |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Credenciales de Google OAuth (opcional) |
| `EMAIL_USER` / `EMAIL_PASS` | Credenciales para envío de correos de recuperación de contraseña |

## Desarrollo local

Con Postgres en Docker y la API corriendo en tu máquina:

```bash
docker compose up -d postgres
npm install
npx prisma migrate deploy
npm run dev
```

La API queda disponible en `http://localhost:5000`.

## Con Docker (Postgres + API)

```bash
docker compose up -d --build
```

Esto levanta Postgres y la API (`api` en el puerto `5000` por defecto). El frontend se levanta por separado desde el repo `Quantis-Frontend`.

## Scripts disponibles

- `npm run dev`: levanta la API con recarga automática (nodemon)
- `npm start`: levanta la API en modo producción
- `npm run prisma:generate`: genera el cliente de Prisma
- `npm run prisma:migrate`: aplica migraciones pendientes
- `npm run smoke` / `npm test`: corre el smoke test (`scripts/smoke-test.js`)

## Endpoints principales

Todos bajo el prefijo `/api`:

- `/auth`: registro, login, Google OAuth, recuperación de contraseña
- `/cuentas`: cuentas del usuario
- `/ingresos`, `/gastos`: transacciones de ingresos y gastos
- `/recurrencias`: transacciones recurrentes
- `/cuotas`, `/prestamos`: cuotas y préstamos
- `/tarjetas`: tarjetas asociadas
- `/tipos`: tipos de transacción
- `/graficos`: datos agregados para gráficos
- `/calendario`: vista de calendario financiero
- `/feedback`: retroalimentación de usuarios (panel de administración)

## Base de datos

El esquema y las migraciones viven en `prisma/`. Tras clonar el repo o cambiar de rama, corre `npx prisma migrate deploy` (o `npx prisma migrate dev` en desarrollo) para mantener la base de datos al día.
