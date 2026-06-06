const express = require('express');
const router = express.Router();

const authMiddleware = require('../middlewares/auth');
const pujasController = require('../controllers/pujas.controller');

// GET /api/pujas/actuales - pujas activas del usuario
router.get('/pujas/actuales', authMiddleware, pujasController.obtenerPujasActuales);

// GET /api/pujas/ganadas - items ganados por el usuario
router.get('/pujas/ganadas', authMiddleware, pujasController.obtenerPujasGanadas);

// GET /api/items/:id/pujas - estado de pujas de un item
router.get('/items/:id/pujas', authMiddleware, pujasController.obtenerEstadoPujasItem);

// POST /api/pujas
router.post('/pujas', authMiddleware, pujasController.realizarPuja);

module.exports = router;
