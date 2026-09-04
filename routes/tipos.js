const express = require('express');
const { query, body } = require('express-validator');
const { getTiposTransaccion, createTipoTransaccion, deleteTipoTransaccion } = require('../controllers/tipoTransaccionController');
const auth = require('../middleware/auth');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(auth);

// Validación para GET /api/tipos
const getTiposValidation = [
  query('tipo')
    .isIn(['ingreso', 'gasto'])
    .withMessage('El tipo debe ser \"ingreso\" o \"gasto\"')
];

// Validación para POST /api/tipos
const createTipoValidation = [
  body('tipo')
    .isIn(['ingreso', 'gasto'])
    .withMessage('El tipo debe ser \"ingreso\" o \"gasto\"'),
  body('label')
    .isString()
    .withMessage('El nombre debe ser un texto')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('El nombre debe tener entre 1 y 50 caracteres'),
  body('iconKey')
    .optional({ values: 'null' })
    .isString()
    .withMessage('iconKey debe ser un texto')
    .trim()
    .isLength({ max: 50 })
    .withMessage('iconKey no puede exceder 50 caracteres'),
  body('color')
    .optional({ values: 'null' })
    .isString()
    .withMessage('color debe ser un texto')
    .trim()
    .isLength({ max: 30 })
    .withMessage('El color no puede exceder 30 caracteres')
];

// @route   GET /api/tipos
// @desc    Obtener tipos de ingreso/gasto (por defecto + personalizados del usuario)
// @access  Private
router.get('/', getTiposValidation, getTiposTransaccion);

// @route   POST /api/tipos
// @desc    Crear un tipo de ingreso/gasto personalizado para el usuario
// @access  Private
router.post('/', createTipoValidation, createTipoTransaccion);

// @route   DELETE /api/tipos/:id
// @desc    Eliminar un tipo personalizado del usuario
// @access  Private
router.delete('/:id', deleteTipoTransaccion);

module.exports = router;

