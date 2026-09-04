const express = require('express');
const { body } = require('express-validator');
const {
  getIngresosRecurrentes,
  getIngresoRecurrenteById,
  createIngresoRecurrente,
  updateIngresoRecurrente,
  deleteIngresoRecurrente,
  getGastosRecurrentes,
  getGastoRecurrenteById,
  createGastoRecurrente,
  updateGastoRecurrente,
  deleteGastoRecurrente,
  generarTransaccion
} = require('../controllers/recurrenciaController');
const auth = require('../middleware/auth');

const router = express.Router();

// Aplicar middleware de autenticación a todas las rutas
router.use(auth);

// Validaciones para ingresos recurrentes
const ingresoRecurrenteValidation = [
  body('nombre')
    .isString()
    .withMessage('El nombre debe ser un texto')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('El nombre debe tener entre 1 y 100 caracteres'),
  body('monto')
    .isNumeric()
    .withMessage('El monto debe ser un número')
    .isFloat({ min: 0 })
    .withMessage('El monto debe ser mayor a 0'),
  body('moneda')
    .isIn(['GTQ', 'USD'])
    .withMessage('La moneda debe ser GTQ o USD'),
  body('frecuencia')
    .isIn(['diario', 'semanal', 'quincenal', 'mensual', 'trimestral', 'anual'])
    .withMessage('La frecuencia debe ser una de las opciones válidas'),
  body('diaPago')
    .optional()
    .isInt({ min: 1, max: 31 })
    .withMessage('El día de pago debe ser entre 1 y 31'),
  body('diaSemana')
    .optional()
    .isInt({ min: 0, max: 6 })
    .withMessage('El día de la semana debe ser entre 0 y 6'),
  body('fechaInicio')
    .optional()
    .isISO8601()
    .withMessage('La fecha de inicio debe tener formato ISO 8601'),
  body('fechaFin')
    .optional()
    .isISO8601()
    .withMessage('La fecha fin debe tener formato ISO 8601'),
  body('categoria')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('La categoría no puede exceder 50 caracteres'),
  body('descripcion')
    .optional()
    .trim()
    .isLength({ max: 300 })
    .withMessage('La descripción no puede exceder 300 caracteres')
];

// Validaciones para gastos recurrentes
const gastoRecurrenteValidation = [
  body('nombre')
    .isString()
    .withMessage('El nombre debe ser un texto')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('El nombre debe tener entre 1 y 100 caracteres'),
  body('monto')
    .isNumeric()
    .withMessage('El monto debe ser un número')
    .isFloat({ min: 0 })
    .withMessage('El monto debe ser mayor a 0'),
  body('moneda')
    .isIn(['GTQ', 'USD'])
    .withMessage('La moneda debe ser GTQ o USD'),
  body('frecuencia')
    .isIn(['diario', 'semanal', 'quincenal', 'mensual', 'trimestral', 'anual'])
    .withMessage('La frecuencia debe ser una de las opciones válidas'),
  body('categoria')
    .isIn(['alimentacion', 'transporte', 'vivienda', 'salud', 'entretenimiento', 'educacion', 'ropa', 'servicios', 'otros'])
    .withMessage('La categoría debe ser una de las opciones válidas'),
  body('metodoPago')
    .optional()
    .isIn(['efectivo', 'tarjeta_debito', 'tarjeta_credito', 'transferencia', 'cheque'])
    .withMessage('El método de pago debe ser una de las opciones válidas'),
  body('diaPago')
    .optional()
    .isInt({ min: 1, max: 31 })
    .withMessage('El día de pago debe ser entre 1 y 31'),
  body('diaSemana')
    .optional()
    .isInt({ min: 0, max: 6 })
    .withMessage('El día de la semana debe ser entre 0 y 6'),
  body('fechaInicio')
    .optional()
    .isISO8601()
    .withMessage('La fecha de inicio debe tener formato ISO 8601'),
  body('fechaFin')
    .optional()
    .isISO8601()
    .withMessage('La fecha fin debe tener formato ISO 8601'),
  body('esSuscripcion')
    .optional()
    .isBoolean()
    .withMessage('esSuscripcion debe ser true o false'),
  body('descripcion')
    .optional()
    .trim()
    .isLength({ max: 300 })
    .withMessage('La descripción no puede exceder 300 caracteres')
];

// ========== RUTAS DE INGRESOS RECURRENTES ==========

// @route   GET /api/recurrencias/ingresos
router.get('/ingresos', getIngresosRecurrentes);

// @route   GET /api/recurrencias/ingresos/:id
router.get('/ingresos/:id', getIngresoRecurrenteById);

// @route   POST /api/recurrencias/ingresos
router.post('/ingresos', ingresoRecurrenteValidation, createIngresoRecurrente);

// @route   PUT /api/recurrencias/ingresos/:id
router.put('/ingresos/:id', ingresoRecurrenteValidation, updateIngresoRecurrente);

// @route   DELETE /api/recurrencias/ingresos/:id
router.delete('/ingresos/:id', deleteIngresoRecurrente);

// ========== RUTAS DE GASTOS RECURRENTES ==========

// @route   GET /api/recurrencias/gastos
router.get('/gastos', getGastosRecurrentes);

// @route   GET /api/recurrencias/gastos/:id
router.get('/gastos/:id', getGastoRecurrenteById);

// @route   POST /api/recurrencias/gastos
router.post('/gastos', gastoRecurrenteValidation, createGastoRecurrente);

// @route   PUT /api/recurrencias/gastos/:id
router.put('/gastos/:id', gastoRecurrenteValidation, updateGastoRecurrente);

// @route   DELETE /api/recurrencias/gastos/:id
router.delete('/gastos/:id', deleteGastoRecurrente);

// ========== RUTA DE GENERACIÓN MANUAL ==========

// @route   POST /api/recurrencias/generar/:tipo/:id
router.post('/generar/:tipo/:id', generarTransaccion);

module.exports = router;
