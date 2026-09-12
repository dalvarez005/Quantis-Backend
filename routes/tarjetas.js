const express = require('express');
const { body, query } = require('express-validator');
const {
  getTarjetas,
  getTarjetaById,
  createTarjeta,
  updateTarjeta,
  deleteTarjeta,
  getResumenTarjetas,
  getResumenTarjeta
} = require('../controllers/tarjetaController');
const auth = require('../middleware/auth');

const router = express.Router();

// Aplicar middleware de autenticación a todas las rutas
router.use(auth);

// Validaciones para crear/actualizar tarjeta (coerción para evitar "Datos de entrada inválidos")
const tarjetaValidation = [
  body('nombre')
    .isString()
    .withMessage('El nombre debe ser un texto')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('El nombre debe tener entre 1 y 100 caracteres'),
  body('tipo')
    .isIn(['credito', 'debito'])
    .withMessage('El tipo debe ser "credito" o "debito"'),
  body('moneda')
    .isIn(['GTQ', 'USD'])
    .withMessage('La moneda debe ser GTQ o USD'),
  body('banco')
    .optional({ values: 'falsy' })
    .isString()
    .withMessage('El banco debe ser texto')
    .trim()
    .isLength({ max: 100 })
    .withMessage('El banco no puede exceder 100 caracteres'),
  body('limiteCredito')
    .optional()
    .isNumeric()
    .withMessage('El límite de crédito debe ser un número')
    .custom((value) => {
      if (value != null && value < 0) {
        throw new Error('El límite de crédito debe ser mayor o igual a 0');
      }
      return true;
    }),
  body('diaPago')
    .optional()
    .custom((val) => val === undefined || val === null || (Number(val) >= 1 && Number(val) <= 31))
    .withMessage('El día de pago debe ser entre 1 y 31'),
  body('fechaCorte')
    .optional()
    .custom((val) => val === undefined || val === null || (Number(val) >= 1 && Number(val) <= 31))
    .withMessage('La fecha de corte debe ser entre 1 y 31'),
  body('saldoActual')
    .optional()
    .isNumeric()
    .withMessage('El saldo actual debe ser un número')
    .custom((value) => {
      if (value != null && value < 0) {
        throw new Error('El saldo actual no puede ser negativo');
      }
      return true;
    }),
  body('color')
    .optional({ values: 'falsy' })
    .isString()
    .trim()
    .isLength({ max: 20 })
    .withMessage('El color no puede exceder 20 caracteres')
];

// Rutas
router.get('/', getTarjetas);
router.get('/resumen', getResumenTarjetas);
router.get('/:id/resumen', getResumenTarjeta);
router.get('/:id', getTarjetaById);
router.post('/', tarjetaValidation, createTarjeta);
router.put('/:id', tarjetaValidation, updateTarjeta);
router.delete('/:id', deleteTarjeta);

module.exports = router;
