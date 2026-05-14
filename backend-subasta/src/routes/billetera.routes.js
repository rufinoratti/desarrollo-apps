const express = require('express');
const router = express.Router();

const authMiddleware = require('../middlewares/auth');
const billeteraController = require('../controllers/billetera.controller');

// GET /api/billetera/medios-pago
router.get('/billetera/medios-pago', authMiddleware, billeteraController.listarMediosPago);

// POST /api/billetera/medios-pago
router.post('/billetera/medios-pago', authMiddleware, billeteraController.agregarMedioPago);

// GET /api/billetera/medios-pago/:id
router.get('/billetera/medios-pago/:id', authMiddleware, billeteraController.obtenerMedioPago);

// DELETE /api/billetera/medios-pago/:id
router.delete('/billetera/medios-pago/:id', authMiddleware, billeteraController.eliminarMedioPago);

module.exports = router;
