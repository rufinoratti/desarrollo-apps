const express = require('express');
const router = express.Router();

const authMiddleware = require('../middlewares/auth');
const pujasController = require('../controllers/pujas.controller');

// GET /api/items/:id/pujas
router.get('/items/:id/pujas', authMiddleware, pujasController.obtenerEstadoPujasItem);

// POST /api/pujas
router.post('/pujas', authMiddleware, pujasController.realizarPuja);

// GET /api/pujas/actuales
router.get('/pujas/actuales', authMiddleware, pujasController.listarPujasActuales);

module.exports = router;
