const express = require('express');
const { body, query } = require('express-validator');
const {
  getPrestamos,
  getPrestamoById,
  createPrestamo,
  updatePrestamo,
  deletePrestamo,
  pagarPrestamo,
  getResumenPrestamos
} = require('../controllers/prestamoController');
const auth = require('../middleware/auth');

const router = express.Router();

// Aplicar middleware de autenticación a todas las rutas
router.use(auth);

// Validaciones para crear/actualizar préstamo
const prestamoValidation = [
  body('tipo')
    .isIn(['recibido', 'otorgado'])
    .withMessage('El tipo debe ser "recibido" o "otorgado"'),
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
  body('moneda')
    .isIn(['GTQ', 'USD'])
    .withMessage('La moneda debe ser GTQ o USD'),
  body('fechaInicio')
    .optional()
    .isISO8601()
    .withMessage('La fecha de inicio debe tener formato ISO 8601'),
  body('fechaVencimiento')
    .isISO8601()
    .withMessage('La fecha de vencimiento debe tener formato ISO 8601'),
  body('tasaInteres')
    .optional()
    .isNumeric()
    .withMessage('La tasa de interés debe ser un número')
    .isFloat({ min: 0 })
    .withMessage('La tasa de interés no puede ser negativa'),
  body('frecuenciaPago')
    .optional()
    .isIn(['semanal', 'quincenal', 'mensual', 'trimestral', 'unico'])
    .withMessage('La frecuencia de pago debe ser una de las opciones válidas'),
  body('descripcion')
    .optional()
    .trim()
    .isLength({ max: 300 })
    .withMessage('La descripción no puede exceder 300 caracteres')
];

// Validaciones para pagar préstamo
const pagoPrestamoValidation = [
  body('monto')
    .isNumeric()
    .withMessage('El monto debe ser un número')
    .isFloat({ min: 0 })
    .withMessage('El monto debe ser mayor a 0'),
  body('fecha')
    .optional()
    .isISO8601()
    .withMessage('La fecha debe tener formato ISO 8601'),
  body('tipo')
    .optional()
    .isIn(['capital', 'interes', 'ambos'])
    .withMessage('El tipo de pago debe ser una de las opciones válidas'),
  body('nota')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('La nota no puede exceder 200 caracteres')
];

// Validaciones para consultas
const queryValidation = [
  query('tipo')
    .optional()
    .isIn(['recibido', 'otorgado'])
    .withMessage('El tipo debe ser "recibido" o "otorgado"'),
  query('estado')
    .optional()
    .isIn(['activo', 'pagado', 'vencido', 'cancelado'])
    .withMessage('El estado debe ser una de las opciones válidas')
];

// @route   GET /api/prestamos
router.get('/', queryValidation, getPrestamos);

// @route   GET /api/prestamos/resumen
router.get('/resumen', getResumenPrestamos);

// @route   GET /api/prestamos/:id
router.get('/:id', getPrestamoById);

// @route   POST /api/prestamos
router.post('/', prestamoValidation, createPrestamo);

// @route   PUT /api/prestamos/:id
router.put('/:id', prestamoValidation, updatePrestamo);

// @route   DELETE /api/prestamos/:id
router.delete('/:id', deletePrestamo);

// @route   POST /api/prestamos/:id/pagar
router.post('/:id/pagar', pagoPrestamoValidation, pagarPrestamo);

module.exports = router;
