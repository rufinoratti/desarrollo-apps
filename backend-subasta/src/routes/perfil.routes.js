const express = require('express');
const router = express.Router();

const authMiddleware = require('../middlewares/auth');
const perfilController = require('../controllers/perfil.controller');
const { createUploader, multerErrorHandler } = require('../middlewares/upload');

/**
 * Multer con memoryStorage: la foto de perfil se recibe como Buffer
 * en req.file.buffer y se sube a Supabase Storage desde el servicio
 * (carpeta 'perfiles/'). El archivo anterior se borra automáticamente
 * para no acumular objetos huérfanos.
 */
const upload = createUploader({
    maxSize: 10 * 1024 * 1024,
    mimeTypes: ['jpeg', 'jpg', 'png', 'gif', 'webp']
});

router.get('/perfil', authMiddleware, perfilController.obtenerPerfil);
router.put('/perfil', authMiddleware, perfilController.actualizarPerfil);
router.post('/perfil/foto', authMiddleware, upload.single('foto'), multerErrorHandler, perfilController.subirFotoPerfil);
router.delete('/perfil/foto', authMiddleware, perfilController.eliminarFotoPerfil);
router.get('/perfil/estadisticas', authMiddleware, perfilController.obtenerEstadisticas);
router.get('/perfil/restricciones', authMiddleware, perfilController.obtenerRestricciones);
router.get('/perfil/estado-cuenta', authMiddleware, perfilController.obtenerEstadoCuenta);
router.post('/perfil/duenio', authMiddleware, perfilController.registrarComoDuenio);

module.exports = router;
