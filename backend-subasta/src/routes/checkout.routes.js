const express = require('express');
const router = express.Router();

const authMiddleware = require('../middlewares/auth');
const checkoutController = require('../controllers/checkout.controller');

// GET /api/checkout/lotes/:itemId/liquidacion
router.get(
    '/checkout/lotes/:itemId/liquidacion',
    authMiddleware,
    checkoutController.obtenerLiquidacionAdjudicacion
);

module.exports = router;
