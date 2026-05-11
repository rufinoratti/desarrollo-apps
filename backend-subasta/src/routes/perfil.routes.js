const express = require('express');
const router = express.Router();

const authMiddleware = require('../middlewares/auth');
const perfilController = require('../controllers/perfil.controller');

router.get('/perfil', authMiddleware, perfilController.obtenerPerfil);
router.put('/perfil', authMiddleware, perfilController.actualizarPerfil);
router.get('/perfil/estadisticas', authMiddleware, perfilController.obtenerEstadisticas);
router.get('/perfil/restricciones', authMiddleware, perfilController.obtenerRestricciones);

module.exports = router;
