const express = require('express');
const { body, query } = require('express-validator');
const {
  getIngresos,
  getIngresoById,
  createIngreso,
  updateIngreso,
  deleteIngreso,
  getResumenIngresos,
  getDashboardIngresos
} = require('../controllers/ingresoController');
const auth = require('../middleware/auth');

const router = express.Router();

// Aplicar middleware de autenticación a todas las rutas
router.use(auth);

// Validaciones para crear/actualizar ingreso
const ingresoValidation = [
  body('tipo')
    .isString()
    .withMessage('El tipo debe ser un texto')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('El tipo debe tener entre 1 y 50 caracteres'),
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
  query('tipo')
    .optional()
    .isString()
    .withMessage('El tipo debe ser un texto')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('El tipo debe tener entre 1 y 50 caracteres'),
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

// @route   GET /api/ingresos
// @desc    Obtener todos los ingresos del usuario
// @access  Private
router.get('/', queryValidation, getIngresos);

// @route   GET /api/ingresos/resumen
// @desc    Obtener resumen de ingresos
// @access  Private
router.get('/resumen', queryValidation, getResumenIngresos);

// @route   GET /api/ingresos/dashboard
// @desc    Obtener datos rápidos para dashboard
// @access  Private
router.get('/dashboard', getDashboardIngresos);

// @route   GET /api/ingresos/:id
// @desc    Obtener un ingreso por ID
// @access  Private
router.get('/:id', getIngresoById);

// @route   POST /api/ingresos
// @desc    Crear nuevo ingreso
// @access  Private
router.post('/', ingresoValidation, createIngreso);

// @route   PUT /api/ingresos/:id
// @desc    Actualizar ingreso
// @access  Private
router.put('/:id', ingresoValidation, updateIngreso);

// @route   DELETE /api/ingresos/:id
// @desc    Eliminar ingreso
// @access  Private
router.delete('/:id', deleteIngreso);

module.exports = router;
