const express = require('express');
const { body, query } = require('express-validator');
const {
  getGastos,
  getGastoById,
  createGasto,
  updateGasto,
  deleteGasto,
  getResumenGastos,
  getDashboardGastos
} = require('../controllers/gastoController');
const auth = require('../middleware/auth');

const router = express.Router();

// Aplicar middleware de autenticación a todas las rutas
router.use(auth);

// Validaciones para crear/actualizar gasto
const gastoValidation = [
  body('categoria')
    .isString()
    .withMessage('La categoría debe ser un texto')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('La categoría debe tener entre 1 y 50 caracteres'),
  body('monto')
    .isNumeric()
    .withMessage('El monto debe ser un número')
    .isFloat({ min: 0 })
    .withMessage('El monto debe ser mayor a 0'),
  body('moneda')
    .isIn(['GTQ', 'USD'])
    .withMessage('La moneda debe ser GTQ o USD'),
  body('fecha')
    .optional()
    .isISO8601()
    .withMessage('La fecha debe tener formato ISO 8601'),
  body('descripcion')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('La descripción no puede exceder 200 caracteres'),
  body('esRecurrente')
    .optional()
    .isBoolean()
    .withMessage('esRecurrente debe ser true o false'),
  body('metodoPago')
    .optional()
    .isIn(['efectivo', 'tarjeta_debito', 'tarjeta_credito', 'transferencia', 'cheque'])
    .withMessage('El método de pago debe ser una de las opciones válidas'),
  body('cuentaId')
    .optional({ nullable: true })
    .isString()
    .withMessage('cuentaId debe ser texto')
    .isLength({ min: 24, max: 24 })
    .withMessage('cuentaId inválido')
];

// Validaciones para consultas
const queryValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('La página debe ser un número mayor a 0'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('El límite debe ser un número entre 1 y 100'),
  query('categoria')
    .optional()
    .isString()
    .withMessage('La categoría debe ser un texto')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('La categoría debe tener entre 1 y 50 caracteres'),
  query('moneda')
    .optional()
    .isIn(['GTQ', 'USD'])
    .withMessage('La moneda debe ser GTQ o USD'),
  query('fechaInicio')
    .optional()
    .isISO8601()
    .withMessage('La fecha de inicio debe tener formato ISO 8601'),
  query('fechaFin')
    .optional()
    .isISO8601()
    .withMessage('La fecha de fin debe tener formato ISO 8601'),
  query('cuentaId')
    .optional()
    .isString()
    .isLength({ min: 24, max: 24 })
    .withMessage('cuentaId inválido')
  ,
  query('sinCuenta')
    .optional()
    .isBoolean()
    .withMessage('sinCuenta debe ser true o false')
];

// @route   GET /api/gastos
// @desc    Obtener todos los gastos del usuario
// @access  Private
router.get('/', queryValidation, getGastos);

// @route   GET /api/gastos/resumen
// @desc    Obtener resumen de gastos
// @access  Private
router.get('/resumen', queryValidation, getResumenGastos);

// @route   GET /api/gastos/dashboard
// @desc    Obtener datos rápidos para dashboard
// @access  Private
router.get('/dashboard', getDashboardGastos);

// @route   GET /api/gastos/:id
// @desc    Obtener un gasto por ID
// @access  Private
router.get('/:id', getGastoById);

// @route   POST /api/gastos
// @desc    Crear nuevo gasto
// @access  Private
router.post('/', gastoValidation, createGasto);

// @route   PUT /api/gastos/:id
// @desc    Actualizar gasto
// @access  Private
router.put('/:id', gastoValidation, updateGasto);

// @route   DELETE /api/gastos/:id
// @desc    Eliminar gasto
// @access  Private
router.delete('/:id', deleteGasto);

module.exports = router;
