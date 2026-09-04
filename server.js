const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
require('dotenv').config();

// Importar configuración de base de datos
const connectDB = require('./config/database');

// Importar configuración de Passport
const passport = require('./config/passport');
const { getCorsOrigins } = require('./config/frontendEnv');

// Importar rutas
const authRoutes = require('./routes/auth');
const ingresoRoutes = require('./routes/ingresos');
const gastoRoutes = require('./routes/gastos');
const googleAuthRoutes = require('./routes/googleAuth');
const forgotPasswordRoutes = require('./routes/forgotPassword');
const recurrenciaRoutes = require('./routes/recurrencias');
const cuotaRoutes = require('./routes/cuotas');
const prestamoRoutes = require('./routes/prestamos');
const graficosRoutes = require('./routes/graficos');
const calendarioRoutes = require('./routes/calendario');
const tarjetaRoutes = require('./routes/tarjetas');
const tiposRoutes = require('./routes/tipos');
const cuentasRoutes = require('./routes/cuentas');
const feedbackRoutes = require('./routes/feedback');

// Importar servicio de cron
const { iniciarCronJobs } = require('./services/cronService');

// Conectar a la base de datos
connectDB();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    const allowed = getCorsOrigins();
    if (!origin || allowed.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Configuración de sesión para Passport
app.use(session({
  secret: process.env.SESSION_SECRET || 'tu_session_secret_aqui',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Cambiar a true en producción con HTTPS
}));

// Inicializar Passport
app.use(passport.initialize());
app.use(passport.session());

// Las imágenes ahora se sirven desde MongoDB a través del endpoint /api/auth/avatar/:userId

// Middleware de logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Rutas de la API
app.use('/api/auth', authRoutes);
app.use('/api/ingresos', ingresoRoutes);
app.use('/api/gastos', gastoRoutes);
app.use('/api/auth', googleAuthRoutes);
app.use('/api', forgotPasswordRoutes);
app.use('/api/recurrencias', recurrenciaRoutes);
app.use('/api/cuotas', cuotaRoutes);
app.use('/api/prestamos', prestamoRoutes);
app.use('/api/graficos', graficosRoutes);
app.use('/api/calendario', calendarioRoutes);
app.use('/api/tarjetas', tarjetaRoutes);
app.use('/api/tipos', tiposRoutes);
app.use('/api/cuentas', cuentasRoutes);
app.use('/api', feedbackRoutes);

// Ruta de prueba
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'API de Quantis funcionando correctamente',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Middleware para manejar rutas no encontradas
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Ruta no encontrada'
  });
});

// Middleware global de manejo de errores
app.use((error, req, res, next) => {
  console.error('Error global:', error);
  
  if (error.name === 'PrismaClientValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Error de validación de datos'
    });
  }

  if (error.code === 'P2002') {
    return res.status(400).json({
      success: false,
      message: 'Ya existe un registro con esos datos únicos'
    });
  }

  // Error de JWT
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Token inválido'
    });
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expirado'
    });
  }

  // Error por defecto
  res.status(500).json({
    success: false,
    message: 'Error interno del servidor'
  });
});

// Las imágenes de perfil se guardan en PostgreSQL (BYTEA)

const prisma = require('./src/adapters/persistence/prismaClient');

const server = app.listen(PORT, () => {
  const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
  console.log(`🚀 Servidor ejecutándose en puerto ${PORT}`);
  console.log(`📊 Entorno: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 URL: ${baseUrl}`);
  console.log(`📋 Health check: ${baseUrl}/api/health`);

  iniciarCronJobs();
});

async function shutdown() {
  try {
    await prisma.$disconnect();
  } catch (e) {
    console.error('Error al cerrar Prisma:', e);
  }
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

module.exports = app;
