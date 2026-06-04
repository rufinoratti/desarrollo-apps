const express = require('express');
const router = express.Router();

const authMiddleware = require('../middlewares/auth');
const notificacionesController = require('../controllers/notificaciones.controller');

// GET /api/notificaciones
router.get('/notificaciones', authMiddleware, notificacionesController.listarNotificaciones);

// POST /api/notificaciones/:id/leer
router.post(
    '/notificaciones/:id/leer',
    authMiddleware,
    notificacionesController.marcarComoLeida
);

module.exports = router;
