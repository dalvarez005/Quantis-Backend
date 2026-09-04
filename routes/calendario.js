const express = require('express');
const { query, param } = require('express-validator');
const {
  getEventosMes,
  getProximosEventos,
  getVencimientos
} = require('../controllers/calendarioController');
const auth = require('../middleware/auth');

const router = express.Router();

// Aplicar middleware de autenticación a todas las rutas
router.use(auth);

// Validaciones para consultas
const queryValidation = [
  query('moneda')
    .optional()
    .isIn(['GTQ', 'USD'])
    .withMessage('La moneda debe ser GTQ o USD'),
  query('dias')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('Los días deben ser un número entre 1 y 365')
];

// Validaciones para parámetros (usamos "anio" en la ruta para evitar problemas con "ñ" en la URL)
const paramValidation = [
  param('mes')
    .isInt({ min: 1, max: 12 })
    .withMessage('El mes debe ser un número entre 1 y 12'),
  param('anio')
    .isInt({ min: 2000, max: 2100 })
    .withMessage('El año debe ser un número válido')
];

// Rutas literales primero para que no sean capturadas por :mes/:año
// @route   GET /api/calendario/proximos
router.get('/proximos', queryValidation, getProximosEventos);

// @route   GET /api/calendario/vencimientos
router.get('/vencimientos', queryValidation, getVencimientos);

// @route   GET /api/calendario/:mes/:anio
router.get('/:mes/:anio', paramValidation, queryValidation, getEventosMes);

module.exports = router;
