const express = require('express');
const { body, query } = require('express-validator');
const {
  getCuentas,
  getCuentaById,
  getCuentasBalances,
  createCuenta,
  updateCuenta,
  deleteCuenta
} = require('../controllers/cuentaController');
const auth = require('../middleware/auth');

const router = express.Router();

router.use(auth);

const cuentaCreateValidation = [
  body('nombre')
    .isString()
    .withMessage('El nombre debe ser un texto')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('El nombre debe tener entre 1 y 100 caracteres'),
  body('moneda')
    .isIn(['GTQ', 'USD'])
    .withMessage('La moneda debe ser GTQ o USD'),
  body('saldoInicial')
    .optional({ values: 'null' })
    .isNumeric()
    .withMessage('El saldo inicial debe ser un número')
];

const cuentaUpdateValidation = [
  body('nombre')
    .optional()
    .isString()
    .withMessage('El nombre debe ser un texto')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('El nombre debe tener entre 1 y 100 caracteres'),
  body('moneda')
    .optional()
    .isIn(['GTQ', 'USD'])
    .withMessage('La moneda debe ser GTQ o USD'),
  body('esActiva')
    .optional()
    .isBoolean()
    .withMessage('esActiva debe ser true o false'),
  body('saldoInicial')
    .optional({ values: 'null' })
    .isNumeric()
    .withMessage('El saldo inicial debe ser un número')
];

const queryValidation = [
  query('moneda')
    .optional()
    .isIn(['GTQ', 'USD'])
    .withMessage('La moneda debe ser GTQ o USD'),
  query('esActiva')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('esActiva debe ser true o false')
];

router.get('/', queryValidation, getCuentas);
router.get('/balances', getCuentasBalances);
router.get('/:id', getCuentaById);
router.post('/', cuentaCreateValidation, createCuenta);
router.put('/:id', cuentaUpdateValidation, updateCuenta);
router.delete('/:id', deleteCuenta);

module.exports = router;
