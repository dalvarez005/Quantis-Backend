const express = require('express');
const { query } = require('express-validator');
const {
  getIngresosGastos,
  getGastosCategoria,
  getEvolucion,
  getCuotasProgreso,
  getPrestamosProgreso,
  getDashboard
} = require('../controllers/graficosController');
const auth = require('../middleware/auth');

const router = express.Router();

// Aplicar middleware de autenticación a todas las rutas
router.use(auth);

// Validaciones para consultas
const queryValidation = [
  query('mes')
    .optional()
    .isInt({ min: 1, max: 12 })
    .withMessage('El mes debe ser un número entre 1 y 12'),
  query('año')
    .optional()
    .isInt({ min: 2000, max: 2100 })
    .withMessage('El año debe ser un número válido'),
  query('moneda')
    .optional()
    .isIn(['GTQ', 'USD'])
    .withMessage('La moneda debe ser GTQ o USD'),
  query('meses')
    .optional()
    .isInt({ min: 1, max: 24 })
    .withMessage('Los meses deben ser un número entre 1 y 24'),
  query('dias')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('Los días deben ser un número entre 1 y 365'),
  query('tipo')
    .optional()
    .isIn(['recibido', 'otorgado'])
    .withMessage('El tipo debe ser "recibido" o "otorgado"')
];

// @route   GET /api/graficos/ingresos-gastos
router.get('/ingresos-gastos', queryValidation, getIngresosGastos);

// @route   GET /api/graficos/gastos-categoria
router.get('/gastos-categoria', queryValidation, getGastosCategoria);

// @route   GET /api/graficos/evolucion
router.get('/evolucion', queryValidation, getEvolucion);

// @route   GET /api/graficos/cuotas-progreso
router.get('/cuotas-progreso', getCuotasProgreso);

// @route   GET /api/graficos/prestamos-progreso
router.get('/prestamos-progreso', queryValidation, getPrestamosProgreso);

// @route   GET /api/graficos/dashboard
router.get('/dashboard', queryValidation, getDashboard);

module.exports = router;
