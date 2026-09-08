const express = require('express');
const { body, query } = require('express-validator');
const {
  getCuotas,
  getCuotaById,
  createCuota,
  updateCuota,
  deleteCuota,
  pagarCuota,
  getProximasCuotas,
  getResumenCuotas
} = require('../controllers/cuotaController');
const auth = require('../middleware/auth');

const router = express.Router();

// Aplicar middleware de autenticación a todas las rutas
router.use(auth);

// Validaciones para crear/actualizar cuota
const cuotaValidation = [
  body('nombre')
    .isString()
    .withMessage('El nombre debe ser un texto')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('El nombre debe tener entre 1 y 100 caracteres'),
  body('montoTotal')
    .isNumeric()
    .withMessage('El monto total debe ser un número')
    .isFloat({ min: 0 })
    .withMessage('El monto total debe ser mayor a 0'),
  body('montoCuota')
    .isNumeric()
    .withMessage('El monto de cuota debe ser un número')
    .isFloat({ min: 0 })
    .withMessage('El monto de cuota debe ser mayor a 0'),
  body('cuotasTotal')
    .isInt({ min: 1, max: 48 })
    .withMessage('El número total de cuotas debe estar entre 1 y 48'),
  body('cuotasPagadas')
    .optional({ values: 'null' })
    .custom((value, { req }) => {
      if (value === undefined || value === null || value === '') return true;
      const v = parseInt(String(value), 10);
      if (Number.isNaN(v) || v < 0 || v > 47) {
        throw new Error('Las cuotas pagadas deben ser un entero entre 0 y 47');
      }
      const total = parseInt(String(req.body?.cuotasTotal), 10);
      if (!Number.isNaN(total) && v >= total) {
        throw new Error('Las cuotas pagadas deben ser menores que el total de cuotas');
      }
      return true;
    }),
  body('moneda')
    .isIn(['GTQ', 'USD'])
    .withMessage('La moneda debe ser GTQ o USD'),
  body('frecuenciaPago')
    .isIn(['semanal', 'quincenal', 'mensual', 'trimestral'])
    .withMessage('La frecuencia de pago debe ser una de las opciones válidas'),
  body('fechaInicio')
    .isISO8601()
    .withMessage('La fecha de inicio debe tener formato ISO 8601'),
  body('fechaVencimiento')
    .isISO8601()
    .withMessage('La fecha de vencimiento debe tener formato ISO 8601'),
  body('proximoPago')
    .optional()
    .isISO8601()
    .withMessage('La próxima fecha de pago debe tener formato ISO 8601'),
  body('descripcion')
    .optional()
    .trim()
    .isLength({ max: 300 })
    .withMessage('La descripción no puede exceder 300 caracteres'),
  body('categoria')
    .optional({ values: 'null' })
    .isString()
    .withMessage('La categoría debe ser un texto')
    .trim()
    .isLength({ max: 60 })
    .withMessage('La categoría no puede exceder 60 caracteres')
];

/** PUT parcial: solo se validan los campos enviados (p. ej. nombre + categoría). */
const cuotaUpdateValidation = [
  body('nombre')
    .optional()
    .isString()
    .withMessage('El nombre debe ser un texto')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('El nombre debe tener entre 1 y 100 caracteres'),
  body('montoTotal')
    .optional()
    .isNumeric()
    .withMessage('El monto total debe ser un número')
    .isFloat({ min: 0 })
    .withMessage('El monto total debe ser mayor a 0'),
  body('montoCuota')
    .optional()
    .isNumeric()
    .withMessage('El monto de cuota debe ser un número')
    .isFloat({ min: 0 })
    .withMessage('El monto de cuota debe ser mayor a 0'),
  body('cuotasTotal')
    .optional()
    .isInt({ min: 1, max: 48 })
    .withMessage('El número total de cuotas debe estar entre 1 y 48'),
  body('cuotasPagadas')
    .optional({ values: 'null' })
    .custom((value, { req }) => {
      if (value === undefined || value === null || value === '') return true;
      const v = parseInt(String(value), 10);
      if (Number.isNaN(v) || v < 0 || v > 47) {
        throw new Error('Las cuotas pagadas deben ser un entero entre 0 y 47');
      }
      const total = parseInt(String(req.body?.cuotasTotal), 10);
      if (!Number.isNaN(total) && v >= total) {
        throw new Error('Las cuotas pagadas deben ser menores que el total de cuotas');
      }
      return true;
    }),
  body('moneda')
    .optional()
    .isIn(['GTQ', 'USD'])
    .withMessage('La moneda debe ser GTQ o USD'),
  body('frecuenciaPago')
    .optional()
    .isIn(['semanal', 'quincenal', 'mensual', 'trimestral'])
    .withMessage('La frecuencia de pago debe ser una de las opciones válidas'),
  body('fechaInicio')
    .optional()
    .isISO8601()
    .withMessage('La fecha de inicio debe tener formato ISO 8601'),
  body('fechaVencimiento')
    .optional()
    .isISO8601()
    .withMessage('La fecha de vencimiento debe tener formato ISO 8601'),
  body('proximoPago')
    .optional({ values: 'null' })
    .isISO8601()
    .withMessage('La próxima fecha de pago debe tener formato ISO 8601'),
  body('descripcion')
    .optional({ values: 'null' })
    .trim()
    .isLength({ max: 300 })
    .withMessage('La descripción no puede exceder 300 caracteres'),
  body('categoria')
    .optional({ values: 'null' })
    .isString()
    .withMessage('La categoría debe ser un texto')
    .trim()
    .isLength({ max: 60 })
    .withMessage('La categoría no puede exceder 60 caracteres'),
];

// Validaciones para pagar cuota
const pagoCuotaValidation = [
  body('monto')
    .optional()
    .isNumeric()
    .withMessage('El monto debe ser un número')
    .isFloat({ min: 0 })
    .withMessage('El monto debe ser mayor a 0'),
  body('fecha')
    .optional()
    .isISO8601()
    .withMessage('La fecha debe tener formato ISO 8601'),
  body('nota')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('La nota no puede exceder 200 caracteres'),
  body('sinDebitar')
    .optional()
    .isBoolean()
    .withMessage('sinDebitar debe ser verdadero o falso')
];

// Validaciones para consultas
const queryValidation = [
  query('estado')
    .optional()
    .isIn(['activa', 'pagada', 'vencida', 'cancelada'])
    .withMessage('El estado debe ser una de las opciones válidas'),
  query('dias')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Los días deben ser un número mayor a 0')
];

// @route   GET /api/cuotas
router.get('/', queryValidation, getCuotas);

// @route   GET /api/cuotas/proximas
router.get('/proximas', queryValidation, getProximasCuotas);

// @route   GET /api/cuotas/resumen
router.get('/resumen', getResumenCuotas);

// @route   GET /api/cuotas/:id
router.get('/:id', getCuotaById);

// @route   POST /api/cuotas
router.post('/', cuotaValidation, createCuota);

// @route   PUT /api/cuotas/:id
router.put('/:id', cuotaUpdateValidation, updateCuota);

// @route   DELETE /api/cuotas/:id
router.delete('/:id', deleteCuota);

// @route   POST /api/cuotas/:id/pagar
router.post('/:id/pagar', pagoCuotaValidation, pagarCuota);

module.exports = router;
